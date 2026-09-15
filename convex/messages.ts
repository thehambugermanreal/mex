import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireUser } from "./auth";

function ownsMessage(
  message: { userId?: string | null; name: string },
  user: { _id: string; username: string },
) {
  if (message.userId) return message.userId === user._id;
  return message.name === user.username;
}

export const list = query({
  args: { token: v.optional(v.string()) },
  handler: async (ctx, args) => {
    let viewerId: string | null = null;
    if (args.token) {
      try {
        viewerId = (await requireUser(ctx, args.token))._id;
      } catch {
        viewerId = null;
      }
    }
    const messages = await ctx.db.query("messages").order("desc").take(100);
    return await Promise.all(
      messages.map(async (m) => {
        const all = await ctx.db
          .query("reactions")
          .withIndex("by_message", (q) => q.eq("messageId", m._id))
          .collect();
        const counts = new Map<string, { emoji: string; count: number; mine: boolean }>();
        for (const r of all) {
          const entry = counts.get(r.emoji) ?? { emoji: r.emoji, count: 0, mine: false };
          entry.count += 1;
          if (viewerId && r.userId === viewerId) entry.mine = true;
          counts.set(r.emoji, entry);
        }
        let reply: { name: string; text: string; deleted: boolean } | null = null;
        if (m.replyTo) {
          const parent = await ctx.db.get(m.replyTo);
          if (parent) {
            reply = {
              name: parent.name,
              text: parent.deleted ? "" : parent.text,
              deleted: !!parent.deleted,
            };
          }
        }
        return {
          _id: m._id,
          _creationTime: m._creationTime,
          name: m.name,
          text: m.deleted ? "" : m.text,
          editedAt: m.editedAt,
          deleted: !!m.deleted,
          reactions: [...counts.values()],
          reply,
        };
      }),
    );
  },
});

export const send = mutation({
  args: {
    token: v.string(),
    text: v.string(),
    replyTo: v.optional(v.id("messages")),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx, args.token);
    const text = args.text.trim().slice(0, 500);
    if (!text) throw new Error("Empty message.");
    if (args.replyTo) {
      const parent = await ctx.db.get(args.replyTo);
      if (!parent || parent.deleted) throw new Error("Original message is gone.");
    }
    await ctx.db.insert("messages", {
      name: user.username,
      text,
      userId: user._id,
      replyTo: args.replyTo,
    });
  },
});

export const editMessage = mutation({
  args: { token: v.string(), messageId: v.id("messages"), text: v.string() },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx, args.token);
    const text = args.text.trim().slice(0, 500);
    if (!text) throw new Error("Empty message.");
    const message = await ctx.db.get(args.messageId);
    if (!message || message.deleted) throw new Error("Message is gone.");
    if (!ownsMessage(message, user)) throw new Error("You can only edit your own messages.");
    await ctx.db.patch(message._id, { text, editedAt: Date.now() });
  },
});

export const deleteMessage = mutation({
  args: { token: v.string(), messageId: v.id("messages") },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx, args.token);
    const message = await ctx.db.get(args.messageId);
    if (!message || message.deleted) return;
    if (!ownsMessage(message, user)) throw new Error("You can only delete your own messages.");
    await ctx.db.patch(message._id, { deleted: true, text: "" });
  },
});

export const toggleReaction = mutation({
  args: { token: v.string(), messageId: v.id("messages"), emoji: v.string() },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx, args.token);
    const emoji = args.emoji.trim().slice(0, 16);
    if (!emoji) throw new Error("Pick an emoji.");
    const message = await ctx.db.get(args.messageId);
    if (!message || message.deleted) throw new Error("Message is gone.");
    const existing = await ctx.db
      .query("reactions")
      .withIndex("by_message", (q) => q.eq("messageId", message._id))
      .collect();
    const mine = existing.find((r) => r.userId === user._id && r.emoji === emoji);
    if (mine) {
      await ctx.db.delete(mine._id);
    } else {
      await ctx.db.insert("reactions", { messageId: message._id, userId: user._id, emoji });
    }
  },
});
