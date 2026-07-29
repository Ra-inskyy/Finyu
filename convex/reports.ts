import { v } from "convex/values";
import { query } from "./_generated/server";
import { resolveScope } from "./lib";
import { txKind } from "./schema";

/**
 * Laporan keuangan detail untuk periode tertentu — dipakai halaman Laporan
 * dan sumber data ekspor CSV/Excel/PDF.
 */
export const report = query({
  args: {
    ownerId: v.optional(v.id("users")),
    dateFrom: v.string(),
    dateTo: v.string(),
    kind: v.optional(txKind),
    categoryIds: v.optional(v.array(v.id("categories"))),
    walletIds: v.optional(v.array(v.id("wallets"))),
  },
  handler: async (ctx, args) => {
    const scope = await resolveScope(ctx, args.ownerId);
    const txs = await ctx.db
      .query("transactions")
      .withIndex("by_user_date", q =>
        q
          .eq("userId", scope.ownerId)
          .gte("date", args.dateFrom)
          .lte("date", args.dateTo),
      )
      .collect();
    const cats = await ctx.db
      .query("categories")
      .withIndex("by_user", q => q.eq("userId", scope.ownerId))
      .collect();
    const wallets = await ctx.db
      .query("wallets")
      .withIndex("by_user", q => q.eq("userId", scope.ownerId))
      .collect();
    const catById = new Map(cats.map(c => [c._id, c]));
    const walletById = new Map(wallets.map(w => [w._id, w]));

    const filtered = txs.filter(t => {
      if (t.deletedAt) return false;
      if (args.kind && t.kind !== args.kind) return false;
      if (args.categoryIds?.length) {
        const ok =
          (t.categoryId && args.categoryIds.includes(t.categoryId)) ||
          (t.subCategoryId && args.categoryIds.includes(t.subCategoryId));
        if (!ok) return false;
      }
      if (args.walletIds?.length) {
        const ok =
          (t.walletId && args.walletIds.includes(t.walletId)) ||
          (t.toWalletId && args.walletIds.includes(t.toWalletId));
        if (!ok) return false;
      }
      return true;
    });

    const rows = filtered
      .sort((a, b) => a.date.localeCompare(b.date))
      .map(t => ({
        id: t._id,
        date: t.date,
        kind: t.kind,
        amount: t.amount,
        category: t.categoryId ? (catById.get(t.categoryId)?.name ?? "") : "",
        subCategory: t.subCategoryId
          ? (catById.get(t.subCategoryId)?.name ?? "")
          : "",
        wallet: t.walletId ? (walletById.get(t.walletId)?.name ?? "") : "",
        toWallet: t.toWalletId
          ? (walletById.get(t.toWalletId)?.name ?? "")
          : "",
        note: t.note ?? "",
        source: t.source,
      }));

    const totalExpense = rows
      .filter(r => r.kind === "expense")
      .reduce((s, r) => s + r.amount, 0);
    const totalIncome = rows
      .filter(r => r.kind === "income")
      .reduce((s, r) => s + r.amount, 0);

    const byCategoryMap = new Map<string, { total: number; count: number }>();
    for (const r of rows.filter(x => x.kind === "expense")) {
      const key = r.category || "Tanpa kategori";
      const entry = byCategoryMap.get(key) ?? { total: 0, count: 0 };
      entry.total += r.amount;
      entry.count += 1;
      byCategoryMap.set(key, entry);
    }
    const byCategory = [...byCategoryMap.entries()]
      .map(([name, e]) => ({
        name,
        total: e.total,
        count: e.count,
        percent: totalExpense > 0 ? (e.total / totalExpense) * 100 : 0,
      }))
      .sort((a, b) => b.total - a.total);

    const byMonthMap = new Map<string, { expense: number; income: number }>();
    for (const r of rows) {
      const key = r.date.slice(0, 7);
      const entry = byMonthMap.get(key) ?? { expense: 0, income: 0 };
      if (r.kind === "expense") entry.expense += r.amount;
      if (r.kind === "income") entry.income += r.amount;
      byMonthMap.set(key, entry);
    }
    const byMonth = [...byMonthMap.entries()]
      .map(([month, e]) => ({ month, ...e, leftover: e.income - e.expense }))
      .sort((a, b) => a.month.localeCompare(b.month));

    return {
      rows,
      totalExpense,
      totalIncome,
      leftover: totalIncome - totalExpense,
      count: rows.length,
      byCategory,
      byMonth,
    };
  },
});
