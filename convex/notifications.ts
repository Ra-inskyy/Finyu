import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireUserId } from "./lib";

export const list = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit }) => {
    const userId = await requireUserId(ctx);
    const rows = await ctx.db
      .query("notifications")
      .withIndex("by_user", q => q.eq("userId", userId))
      .order("desc")
      .take(limit ?? 30);
    return rows.map(r => ({
      id: r._id,
      title: r.title,
      body: r.body,
      kind: r.kind,
      readAt: r.readAt ?? null,
      at: r._creationTime,
    }));
  },
});

export const unreadCount = query({
  args: {},
  handler: async ctx => {
    const userId = await requireUserId(ctx);
    const rows = await ctx.db
      .query("notifications")
      .withIndex("by_user", q => q.eq("userId", userId))
      .order("desc")
      .take(100);
    return rows.filter(r => !r.readAt).length;
  },
});

export const markAllRead = mutation({
  args: {},
  returns: v.null(),
  handler: async ctx => {
    const userId = await requireUserId(ctx);
    const rows = await ctx.db
      .query("notifications")
      .withIndex("by_user", q => q.eq("userId", userId))
      .collect();
    for (const row of rows)
      if (!row.readAt) await ctx.db.patch(row._id, { readAt: Date.now() });
    return null;
  },
});
