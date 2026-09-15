import { mutation, query } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { v } from "convex/values";

const SESSION_DAYS = 30;

async function hashPassword(salt: string, password: string) {
  const data = new TextEncoder().encode(`${salt}:${password}`);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function createSession(ctx: MutationCtx, userId: Id<"users">) {
  const token = `${crypto.randomUUID()}${crypto.randomUUID()}`.replace(/-/g, "");
  const expiresAt = Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000;
  await ctx.db.insert("sessions", { userId, token, expiresAt });
  return token;
}

function cleanUsername(raw: string) {
  return raw.trim().toLowerCase();
}

export async function requireUser(ctx: MutationCtx | QueryCtx, token: string) {
  const session = await ctx.db
    .query("sessions")
    .withIndex("by_token", (q) => q.eq("token", token))
    .unique();
  if (!session || session.expiresAt < Date.now()) throw new Error("Sign in to chat.");
  const user = await ctx.db.get(session.userId);
  if (!user) throw new Error("Sign in to chat.");
  return user;
}

export const signup = mutation({
  args: { username: v.string(), password: v.string() },
  handler: async (ctx, args) => {
    const username = cleanUsername(args.username);
    if (!/^[a-z0-9_]{3,16}$/.test(username)) {
      throw new Error("Username must be 3-16 chars: letters, numbers, underscore.");
    }
    if (args.password.length < 4) {
      throw new Error("Password must be at least 4 characters.");
    }
    const existing = await ctx.db
      .query("users")
      .withIndex("by_username", (q) => q.eq("username", username))
      .unique();
    if (existing) throw new Error("Username is taken.");
    const salt = crypto.randomUUID();
    const passwordHash = await hashPassword(salt, args.password);
    const userId = await ctx.db.insert("users", { username, passwordHash, salt });
    const token = await createSession(ctx, userId);
    return { token, username };
  },
});

export const signin = mutation({
  args: { username: v.string(), password: v.string() },
  handler: async (ctx, args) => {
    const username = cleanUsername(args.username);
    const user = await ctx.db
      .query("users")
      .withIndex("by_username", (q) => q.eq("username", username))
      .unique();
    if (!user) throw new Error("Invalid Username Or Password.");
    const passwordHash = await hashPassword(user.salt, args.password);
    if (passwordHash !== user.passwordHash) throw new Error("Invalid Username Or Password.");
    const token = await createSession(ctx, user._id);
    return { token, username: user.username };
  },
});

export const me = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    if (!args.token) return null;
    const session = await ctx.db
      .query("sessions")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .unique();
    if (!session || session.expiresAt < Date.now()) return null;
    const user = await ctx.db.get(session.userId);
    return user ? { username: user.username } : null;
  },
});

export const changePassword = mutation({
  args: { token: v.string(), currentPassword: v.string(), newPassword: v.string() },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx, args.token);
    const currentHash = await hashPassword(user.salt, args.currentPassword);
    if (currentHash !== user.passwordHash) throw new Error("Current password is wrong.");
    if (args.newPassword.length < 4) {
      throw new Error("New password must be at least 4 characters.");
    }
    const salt = crypto.randomUUID();
    await ctx.db.patch(user._id, {
      salt,
      passwordHash: await hashPassword(salt, args.newPassword),
    });
  },
});

export const changeUsername = mutation({
  args: { token: v.string(), username: v.string() },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx, args.token);
    const username = args.username.trim().toLowerCase();
    if (!/^[a-z0-9_]{3,16}$/.test(username)) {
      throw new Error("Username must be 3-16 chars: letters, numbers, underscore.");
    }
    if (username === user.username) return { username };
    const existing = await ctx.db
      .query("users")
      .withIndex("by_username", (q) => q.eq("username", username))
      .unique();
    if (existing) throw new Error("Username is taken.");
    await ctx.db.patch(user._id, { username });
    const mine = await ctx.db
      .query("messages")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();
    await Promise.all(mine.map((m) => ctx.db.patch(m._id, { name: username })));
    return { username };
  },
});

export const deleteAccount = mutation({
  args: { token: v.string(), password: v.string() },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx, args.token);
    const hash = await hashPassword(user.salt, args.password);
    if (hash !== user.passwordHash) throw new Error("Password is wrong.");
    const mine = await ctx.db
      .query("messages")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();
    for (const m of mine) {
      const reacts = await ctx.db
        .query("reactions")
        .withIndex("by_message", (q) => q.eq("messageId", m._id))
        .collect();
      for (const r of reacts) await ctx.db.delete(r._id);
      await ctx.db.delete(m._id);
    }
    const myReacts = await ctx.db
      .query("reactions")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();
    for (const r of myReacts) await ctx.db.delete(r._id);
    const sessions = await ctx.db
      .query("sessions")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();
    for (const s of sessions) await ctx.db.delete(s._id);
    await ctx.db.delete(user._id);
  },
});

export const signout = mutation({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const session = await ctx.db
      .query("sessions")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .unique();
    if (session) await ctx.db.delete(session._id);
  },
});
