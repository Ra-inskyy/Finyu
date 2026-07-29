import { v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import { query } from "./_generated/server";
import {
  addDays,
  addMonths,
  monthBounds,
  resolveScope,
  todayInTz,
} from "./lib";

function sum(rows: Array<Doc<"transactions">>) {
  return rows.reduce((s, t) => s + t.amount, 0);
}

/** Semua data yang dibutuhkan halaman Dashboard dalam satu query. */
export const summary = query({
  args: { ownerId: v.optional(v.id("users")), month: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const scope = await resolveScope(ctx, args.ownerId);
    const today = todayInTz();
    const month = args.month ?? today.slice(0, 7);
    const prevMonth = addMonths(month, -1);
    const rangeStart = addDays(today, -400);

    const txs = await ctx.db
      .query("transactions")
      .withIndex("by_user_date", q =>
        q
          .eq("userId", scope.ownerId)
          .gte("date", rangeStart)
          .lte("date", today),
      )
      .collect();
    const active = txs.filter(t => !t.deletedAt);
    const expenses = active.filter(t => t.kind === "expense");
    const incomes = active.filter(t => t.kind === "income");

    const cats = await ctx.db
      .query("categories")
      .withIndex("by_user", q => q.eq("userId", scope.ownerId))
      .collect();
    const catById = new Map(cats.map(c => [c._id, c]));

    const thisMonthExpenses = expenses.filter(t => t.date.startsWith(month));
    const prevMonthExpenses = expenses.filter(t =>
      t.date.startsWith(prevMonth),
    );
    const thisMonthIncomes = incomes.filter(t => t.date.startsWith(month));
    const prevMonthIncomes = incomes.filter(t => t.date.startsWith(prevMonth));

    const expenseTotal = sum(thisMonthExpenses);
    const prevExpenseTotal = sum(prevMonthExpenses);
    const incomeTotal = sum(thisMonthIncomes);
    const prevIncomeTotal = sum(prevMonthIncomes);
    const leftover = incomeTotal - expenseTotal;
    const prevLeftover = prevIncomeTotal - prevExpenseTotal;

    const deltaPercent = (now: number, before: number) =>
      before > 0 ? ((now - before) / before) * 100 : null;

    // ── Breakdown per kategori (induk, dengan detail sub-kategori) ──
    const catTotals = new Map<
      string,
      { name: string; color: string; total: number; subs: Map<string, number> }
    >();
    for (const t of thisMonthExpenses) {
      const raw = t.categoryId ? catById.get(t.categoryId) : undefined;
      const parent = raw?.parentId ? catById.get(raw.parentId) : raw;
      if (!parent) continue;
      const key = parent._id as string;
      if (!catTotals.has(key))
        catTotals.set(key, {
          name: parent.name,
          color: parent.color,
          total: 0,
          subs: new Map(),
        });
      const entry = catTotals.get(key)!;
      entry.total += t.amount;
      const subName = t.subCategoryId
        ? (catById.get(t.subCategoryId)?.name ?? null)
        : raw?.parentId
          ? raw.name
          : null;
      if (subName)
        entry.subs.set(subName, (entry.subs.get(subName) ?? 0) + t.amount);
    }
    const categoryBreakdown = [...catTotals.entries()]
      .map(([id, e]) => ({
        categoryId: id,
        name: e.name,
        color: e.color,
        total: e.total,
        percent: expenseTotal > 0 ? (e.total / expenseTotal) * 100 : 0,
        subs: [...e.subs.entries()]
          .map(([name, total]) => ({ name, total }))
          .sort((a, b) => b.total - a.total),
      }))
      .sort((a, b) => b.total - a.total);

    // ── Tren: harian (14 hari), mingguan (8 minggu), bulanan (12 bulan) ──
    const dailyMap = new Map<string, number>();
    for (const t of expenses) {
      dailyMap.set(t.date, (dailyMap.get(t.date) ?? 0) + t.amount);
    }
    const daily = Array.from({ length: 14 }, (_, i) => {
      const date = addDays(today, -13 + i);
      return { label: date.slice(8), date, total: dailyMap.get(date) ?? 0 };
    });
    const weekly = Array.from({ length: 8 }, (_, i) => {
      const end = addDays(today, -7 * (7 - i));
      const start = addDays(end, -6);
      const total = expenses
        .filter(t => t.date >= start && t.date <= end)
        .reduce((s, t) => s + t.amount, 0);
      return {
        label: `${start.slice(8)}/${start.slice(5, 7)}`,
        date: start,
        total,
      };
    });
    const monthly = Array.from({ length: 12 }, (_, i) => {
      const m = addMonths(month, -11 + i);
      return {
        label: m.slice(5),
        date: m,
        total: expenses
          .filter(t => t.date.startsWith(m))
          .reduce((s, t) => s + t.amount, 0),
        income: incomes
          .filter(t => t.date.startsWith(m))
          .reduce((s, t) => s + t.amount, 0),
      };
    });

    // ── Heatmap 365 hari ──
    const heatmap = Array.from({ length: 365 }, (_, i) => {
      const date = addDays(today, -364 + i);
      const dayTx = expenses.filter(t => t.date === date);
      return { date, total: sum(dayTx), count: dayTx.length };
    });

    // ── Tabungan ──
    const goals = await ctx.db
      .query("savingsGoals")
      .withIndex("by_user", q => q.eq("userId", scope.ownerId))
      .collect();
    const activeGoals = goals.filter(g => !g.isArchived);
    const savingsTotal = activeGoals.reduce((s, g) => s + g.currentAmount, 0);
    const topGoals = [...activeGoals]
      .sort((a, b) => b.currentAmount - a.currentAmount)
      .slice(0, 3)
      .map(g => ({
        id: g._id,
        name: g.name,
        icon: g.icon,
        color: g.color,
        currentAmount: g.currentAmount,
        targetAmount: g.targetAmount,
        percent:
          g.targetAmount > 0
            ? Math.min(100, (g.currentAmount / g.targetAmount) * 100)
            : 0,
        remaining: Math.max(0, g.targetAmount - g.currentAmount),
      }));

    // ── Anggaran vs realisasi (top 5) ──
    const budgets = await ctx.db
      .query("budgets")
      .withIndex("by_user_month", q =>
        q.eq("userId", scope.ownerId).eq("month", month),
      )
      .collect();
    const budgetComparison = budgets
      .map(b => {
        const childIds = cats
          .filter(c => c.parentId === b.categoryId)
          .map(c => c._id as string);
        const ids = new Set<string>([b.categoryId as string, ...childIds]);
        const spent = thisMonthExpenses
          .filter(
            t =>
              (t.categoryId && ids.has(t.categoryId)) ||
              (t.subCategoryId && ids.has(t.subCategoryId)),
          )
          .reduce((s, t) => s + t.amount, 0);
        return {
          categoryId: b.categoryId,
          name: catById.get(b.categoryId)?.name ?? "(dihapus)",
          color: catById.get(b.categoryId)?.color ?? "#64748B",
          budget: b.amount,
          spent,
          ratio: b.amount > 0 ? spent / b.amount : 0,
        };
      })
      .sort((a, b) => b.budget - a.budget)
      .slice(0, 5);

    // ── Dompet ──
    const wallets = await ctx.db
      .query("wallets")
      .withIndex("by_user", q => q.eq("userId", scope.ownerId))
      .collect();
    const walletBalances = wallets
      .filter(w => !w.isArchived)
      .map(w => {
        let balance = w.initialBalance;
        for (const t of active) {
          if (t.walletId === w._id)
            balance += t.kind === "income" ? t.amount : -t.amount;
          if (t.kind === "transfer" && t.toWalletId === w._id)
            balance += t.amount;
        }
        return {
          id: w._id,
          name: w.name,
          color: w.color,
          icon: w.icon,
          balance,
        };
      });

    // ── Transaksi terbaru ──
    const recent = [...active]
      .sort(
        (a, b) =>
          b.date.localeCompare(a.date) || b._creationTime - a._creationTime,
      )
      .slice(0, 6)
      .map(t => ({
        id: t._id,
        kind: t.kind,
        amount: t.amount,
        date: t.date,
        note: t.note ?? "",
        categoryName: t.categoryId
          ? (catById.get(t.categoryId)?.name ?? null)
          : null,
        categoryIcon: t.categoryId
          ? (catById.get(t.categoryId)?.icon ?? null)
          : null,
        categoryColor: t.categoryId
          ? (catById.get(t.categoryId)?.color ?? null)
          : null,
        source: t.source,
      }));

    const { start: mStart, end: mEnd } = monthBounds(month);
    return {
      month,
      monthStart: mStart,
      monthEnd: mEnd,
      today,
      canEdit: scope.canEdit,
      expense: {
        total: expenseTotal,
        count: thisMonthExpenses.length,
        deltaPercent: deltaPercent(expenseTotal, prevExpenseTotal),
        prevTotal: prevExpenseTotal,
        dailyAverage:
          thisMonthExpenses.length > 0
            ? expenseTotal / Number(today.slice(8))
            : 0,
      },
      income: {
        total: incomeTotal,
        count: thisMonthIncomes.length,
        deltaPercent: deltaPercent(incomeTotal, prevIncomeTotal),
      },
      leftover: {
        total: leftover,
        prevTotal: prevLeftover,
        deltaPercent: deltaPercent(leftover, prevLeftover),
      },
      savings: { total: savingsTotal, goalCount: activeGoals.length, topGoals },
      categoryBreakdown,
      trend: { daily, weekly, monthly },
      heatmap,
      budgetComparison,
      walletBalances,
      recent,
    };
  },
});
