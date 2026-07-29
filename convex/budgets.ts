import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { addMonths, monthBounds, requireEditScope, resolveScope } from "./lib";

/** Anggaran bulan tertentu + realisasi & status. */
export const listByMonth = query({
  args: { ownerId: v.optional(v.id("users")), month: v.string() },
  handler: async (ctx, { ownerId, month }) => {
    const scope = await resolveScope(ctx, ownerId);
    const { start, end } = monthBounds(month);
    const budgets = await ctx.db
      .query("budgets")
      .withIndex("by_user_month", q =>
        q.eq("userId", scope.ownerId).eq("month", month),
      )
      .collect();
    const cats = await ctx.db
      .query("categories")
      .withIndex("by_user", q => q.eq("userId", scope.ownerId))
      .collect();
    const catById = new Map(cats.map(c => [c._id, c]));
    const txs = await ctx.db
      .query("transactions")
      .withIndex("by_user_date", q =>
        q.eq("userId", scope.ownerId).gte("date", start).lte("date", end),
      )
      .collect();
    const expenses = txs.filter(t => !t.deletedAt && t.kind === "expense");

    const rows = budgets.map(b => {
      const childIds = cats
        .filter(c => c.parentId === b.categoryId)
        .map(c => c._id as string);
      const ids = new Set<string>([b.categoryId as string, ...childIds]);
      const spent = expenses
        .filter(
          t =>
            (t.categoryId && ids.has(t.categoryId)) ||
            (t.subCategoryId && ids.has(t.subCategoryId)),
        )
        .reduce((s, t) => s + t.amount, 0);
      const ratio = b.amount > 0 ? spent / b.amount : 0;
      return {
        id: b._id,
        categoryId: b.categoryId,
        categoryName: catById.get(b.categoryId)?.name ?? "(kategori dihapus)",
        categoryColor: catById.get(b.categoryId)?.color ?? "#64748B",
        categoryIcon: catById.get(b.categoryId)?.icon ?? "tag",
        amount: b.amount,
        spent,
        remaining: b.amount - spent,
        ratio,
        status: ratio >= 1 ? "over" : ratio >= 0.8 ? "warning" : "safe",
      };
    });

    const totalBudget = rows.reduce((s, r) => s + r.amount, 0);
    const totalSpent = rows.reduce((s, r) => s + r.spent, 0);
    return {
      month,
      rows: rows.sort((a, b) => b.amount - a.amount),
      totalBudget,
      totalSpent,
      canEdit: scope.canEdit,
    };
  },
});

export const upsert = mutation({
  args: {
    ownerId: v.optional(v.id("users")),
    categoryId: v.id("categories"),
    month: v.string(),
    amount: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const scope = await requireEditScope(ctx, args.ownerId);
    if (args.amount < 0) throw new Error("Anggaran tidak boleh negatif");
    const existing = await ctx.db
      .query("budgets")
      .withIndex("by_user_month", q =>
        q.eq("userId", scope.ownerId).eq("month", args.month),
      )
      .collect();
    const found = existing.find(b => b.categoryId === args.categoryId);
    if (found) {
      await ctx.db.patch(found._id, {
        amount: args.amount,
        warn80SentAt: undefined,
        warn100SentAt: undefined,
      });
    } else {
      await ctx.db.insert("budgets", {
        userId: scope.ownerId,
        categoryId: args.categoryId,
        month: args.month,
        amount: args.amount,
      });
    }
    return null;
  },
});

export const remove = mutation({
  args: { id: v.id("budgets") },
  returns: v.null(),
  handler: async (ctx, { id }) => {
    const budget = await ctx.db.get(id);
    if (!budget) throw new Error("Anggaran tidak ditemukan");
    await requireEditScope(ctx, budget.userId);
    await ctx.db.delete(id);
    return null;
  },
});

/** Salin semua anggaran dari bulan sebelumnya. */
export const copyFromPreviousMonth = mutation({
  args: { ownerId: v.optional(v.id("users")), month: v.string() },
  returns: v.object({ copied: v.number() }),
  handler: async (ctx, { ownerId, month }) => {
    const scope = await requireEditScope(ctx, ownerId);
    const prev = addMonths(month, -1);
    const prevBudgets = await ctx.db
      .query("budgets")
      .withIndex("by_user_month", q =>
        q.eq("userId", scope.ownerId).eq("month", prev),
      )
      .collect();
    const current = await ctx.db
      .query("budgets")
      .withIndex("by_user_month", q =>
        q.eq("userId", scope.ownerId).eq("month", month),
      )
      .collect();
    const existingCats = new Set(current.map(b => b.categoryId as string));
    let copied = 0;
    for (const b of prevBudgets) {
      if (existingCats.has(b.categoryId as string)) continue;
      await ctx.db.insert("budgets", {
        userId: scope.ownerId,
        categoryId: b.categoryId,
        month,
        amount: b.amount,
      });
      copied += 1;
    }
    return { copied };
  },
});

/** Riwayat rencana vs realisasi 6 bulan terakhir. */
export const history = query({
  args: { ownerId: v.optional(v.id("users")), month: v.string() },
  handler: async (ctx, { ownerId, month }) => {
    const scope = await resolveScope(ctx, ownerId);
    const months = Array.from({ length: 6 }, (_, i) =>
      addMonths(month, -5 + i),
    );
    const budgets = await ctx.db
      .query("budgets")
      .withIndex("by_user", q => q.eq("userId", scope.ownerId))
      .collect();
    const start = monthBounds(months[0]).start;
    const end = monthBounds(months[months.length - 1]).end;
    const txs = await ctx.db
      .query("transactions")
      .withIndex("by_user_date", q =>
        q.eq("userId", scope.ownerId).gte("date", start).lte("date", end),
      )
      .collect();
    const expenses = txs.filter(t => !t.deletedAt && t.kind === "expense");
    return months.map(m => ({
      month: m,
      budget: budgets
        .filter(b => b.month === m)
        .reduce((s, b) => s + b.amount, 0),
      actual: expenses
        .filter(t => t.date.startsWith(m))
        .reduce((s, t) => s + t.amount, 0),
    }));
  },
});
