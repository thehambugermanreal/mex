import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  messages: defineTable({
    name: v.string(),
    text: v.string(),
    userId: v.optional(v.id("users")),
    replyTo: v.optional(v.id("messages")),
    editedAt: v.optional(v.number()),
    deleted: v.optional(v.boolean()),
  }).index("by_user", ["userId"]),
  reactions: defineTable({
    messageId: v.id("messages"),
    userId: v.id("users"),
    emoji: v.string(),
  }).index("by_message", ["messageId"]).index("by_user", ["userId"]),
  users: defineTable({
    username: v.string(),
    passwordHash: v.string(),
    salt: v.string(),
  }).index("by_username", ["username"]),
  sessions: defineTable({
    token: v.string(),
    userId: v.id("users"),
    expiresAt: v.number(),
  }).index("by_token", ["token"]).index("by_user", ["userId"]),
});
