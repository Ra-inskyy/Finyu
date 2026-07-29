import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import {
  internalMutation,
  type MutationCtx,
  mutation,
  query,
} from "./_generated/server";
import {
  addMonths,
  daysBetween,
  formatMoney,
  monthBounds,
  notify,
  requireEditScope,
  resolveScope,
  todayInTz,
} from "./lib";
import { autoAllocateType, reminderFrequency, savingsTxType } from "./schema";

export type GoalStatus = "achieved" | "overdue" | "behind" | "on_track";

export function goalStatus(
  goal: Doc<"savingsGoals">,
  today: string,
): GoalStatus {
  if (goal.currentAmount >= goal.targetAmount) return "achieved";
  if (goal.deadline && goal.deadline < today) return "overdue";
  if (goal.deadline) {
    const total = daysBetween(
      new Date(goal._creationTime).toISOString().slice(0, 10),
      goal.deadline,
    );
    const passed = daysBetween(
      new Date(goal._creationTime).toISOString().slice(0, 10),
      today,
    );
    if (total > 0) {
      const expected = (passed / total) * goal.targetAmount;
      if (goal.currentAmount < expected * 0.9) return "behind";
    }
  }
  return "on_track";
}

export const listGoals = query({
  args: {
    ownerId: v.optional(v.id("users")),
    includeArchived: v.optional(v.boolean()),
  },
  handler: async (ctx, { ownerId, includeArchived }) => {
    const scope = await resolveScope(ctx, ownerId);
    const today = todayInTz();
    const goals = await ctx.db
      .query("savingsGoals")
      .withIndex("by_user", q => q.eq("userId", scope.ownerId))
      .collect();
    const txs = await ctx.db
      .query("savingsTransactions")
      .withIndex("by_user_date", q => q.eq("userId", scope.ownerId))
      .collect();

    return goals
      .filter(g => includeArchived || !g.isArchived)
      .map(g => {
        const goalTxs = txs.filter(t => t.goalId === g._id);
        const deposits = goalTxs.filter(t => t.type !== "withdrawal");
        const avgDeposit =
          deposits.length > 0
            ? deposits.reduce((s, t) => s + t.amount, 0) / deposits.length
            : 0;
        const remaining = Math.max(0, g.targetAmount - g.currentAmount);
        const percent =
          g.targetAmount > 0
            ? Math.min(100, (g.currentAmount / g.targetAmount) * 100)
            : 0;
        return {
          id: g._id,
          name: g.name,
          description: g.description ?? "",
          icon: g.icon,
          color: g.color,
          targetAmount: g.targetAmount,
          currentAmount: g.currentAmount,
          deadline: g.deadline ?? null,
          remaining,
          percent,
          daysLeft: g.deadline ? daysBetween(today, g.deadline) : null,
          status: goalStatus(g, today),
          avgDeposit,
          txCount: goalTxs.length,
          autoAllocateType: g.autoAllocateType,
          autoAllocateValue: g.autoAllocateValue,
          autoAllocateActive: g.autoAllocateActive,
          reminderFrequency: g.reminderFrequency,
          reminderTime: g.reminderTime ?? null,
          reminderViaWa: g.reminderViaWa,
          isArchived: g.isArchived,
        };
      })
      .sort(
        (a, b) =>
          Number(a.isArchived) - Number(b.isArchived) || b.percent - a.percent,
      );
  },
});

export const goalTransactions = query({
  args: {
    goalId: v.id("savingsGoals"),
    type: v.optional(savingsTxType),
    dateFrom: v.optional(v.string()),
    dateTo: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const goal = await ctx.db.get(args.goalId);
    if (!goal) throw new Error("Goal tidak ditemukan");
    await resolveScope(ctx, goal.userId);
    const rows = await ctx.db
      .query("savingsTransactions")
      .withIndex("by_goal_date", q => q.eq("goalId", args.goalId))
      .collect();
    return rows
      .filter(r => {
        if (args.type && r.type !== args.type) return false;
        if (args.dateFrom && r.date < args.dateFrom) return false;
        if (args.dateTo && r.date > args.dateTo) return false;
        return true;
      })
      .sort(
        (a, b) =>
          b.date.localeCompare(a.date) || b._creationTime - a._creationTime,
      )
      .map(r => ({
        id: r._id,
        type: r.type,
        amount: r.amount,
        source: r.source ?? "",
        note: r.note ?? "",
        date: r.date,
      }));
  },
});

export const createGoal = mutation({
  args: {
    ownerId: v.optional(v.id("users")),
    name: v.string(),
    targetAmount: v.number(),
    deadline: v.optional(v.string()),
    description: v.optional(v.string()),
    icon: v.optional(v.string()),
    color: v.optional(v.string()),
    autoAllocateType: v.optional(autoAllocateType),
    autoAllocateValue: v.optional(v.number()),
    autoAllocateActive: v.optional(v.boolean()),
    reminderFrequency: v.optional(reminderFrequency),
    reminderTime: v.optional(v.string()),
    reminderViaWa: v.optional(v.boolean()),
    initialAmount: v.optional(v.number()),
  },
  returns: v.id("savingsGoals"),
  handler: async (ctx, args) => {
    const scope = await requireEditScope(ctx, args.ownerId);
    const name = args.name.trim();
    if (!name) throw new Error("Nama goal wajib diisi");
    if (args.targetAmount <= 0) throw new Error("Target harus lebih dari 0");
    if (args.deadline && args.deadline <= todayInTz())
      throw new Error("Deadline harus setelah hari ini");

    const existing = await ctx.db
      .query("savingsGoals")
      .withIndex("by_user", q => q.eq("userId", scope.ownerId))
      .collect();
    if (existing.some(g => g.name.toLowerCase() === name.toLowerCase()))
      throw new Error("Nama goal sudah dipakai");

    const goalId = await ctx.db.insert("savingsGoals", {
      userId: scope.ownerId,
      name,
      targetAmount: args.targetAmount,
      currentAmount: 0,
      deadline: args.deadline,
      description: args.description,
      icon: args.icon ?? "piggy-bank",
      color: args.color ?? "#10B981",
      autoAllocateType: args.autoAllocateType ?? "none",
      autoAllocateValue: args.autoAllocateValue ?? 0,
      autoAllocateActive: args.autoAllocateActive ?? false,
      reminderFrequency: args.reminderFrequency ?? "none",
      reminderTime: args.reminderTime,
      reminderViaWa: args.reminderViaWa ?? false,
      isArchived: false,
    });

    if (args.initialAmount && args.initialAmount > 0) {
      await addMutation(ctx, goalId, {
        type: "deposit",
        amount: args.initialAmount,
        source: "saldo awal",
        note: "Saldo awal tabungan",
        date: todayInTz(),
      });
    }
    return goalId;
  },
});

/** Helper internal: catat mutasi + update currentAmount + cek goal tercapai. */
async function addMutation(
  ctx: MutationCtx,
  goalId: Id<"savingsGoals">,
  input: {
    type: "deposit" | "withdrawal" | "auto_allocate";
    amount: number;
    source?: string;
    note?: string;
    date: string;
  },
) {
  const goal = await ctx.db.get(goalId);
  if (!goal) throw new Error("Goal tidak ditemukan");
  if (input.amount <= 0) throw new Error("Nominal harus lebih dari 0");
  if (input.type === "withdrawal" && input.amount > goal.currentAmount)
    throw new Error("Saldo goal tidak cukup untuk penarikan ini");

  await ctx.db.insert("savingsTransactions", {
    userId: goal.userId,
    goalId,
    type: input.type,
    amount: input.amount,
    source: input.source,
    note: input.note,
    date: input.date,
  });

  const delta = input.type === "withdrawal" ? -input.amount : input.amount;
  const next = goal.currentAmount + delta;
  await ctx.db.patch(goalId, { currentAmount: next });

  if (next >= goal.targetAmount && !goal.achievedAt) {
    await ctx.db.patch(goalId, { achievedAt: Date.now() });
    await notify(
      ctx,
      goal.userId,
      "Goal tabungan tercapai! 🎉",
      `Selamat! Goal "${goal.name}" sudah mencapai target ${formatMoney(goal.targetAmount)}.`,
      "savings",
    );
    await ctx.scheduler.runAfter(0, internal.whatsapp.sendGoalAchieved, {
      userId: goal.userId,
      goalName: goal.name,
      targetAmount: goal.targetAmount,
    });
  }
}

export const deposit = mutation({
  args: {
    goalId: v.id("savingsGoals"),
    amount: v.number(),
    date: v.optional(v.string()),
    source: v.optional(v.string()),
    note: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const goal = await ctx.db.get(args.goalId);
    if (!goal) throw new Error("Goal tidak ditemukan");
    await requireEditScope(ctx, goal.userId);
    await addMutation(ctx, args.goalId, {
      type: "deposit",
      amount: args.amount,
      source: args.source,
      note: args.note,
      date: args.date ?? todayInTz(),
    });
    return null;
  },
});

export const withdraw = mutation({
  args: {
    goalId: v.id("savingsGoals"),
    amount: v.number(),
    date: v.optional(v.string()),
    source: v.optional(v.string()),
    note: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const goal = await ctx.db.get(args.goalId);
    if (!goal) throw new Error("Goal tidak ditemukan");
    await requireEditScope(ctx, goal.userId);
    if (!args.note.trim()) throw new Error("Alasan penarikan wajib diisi");
    await addMutation(ctx, args.goalId, {
      type: "withdrawal",
      amount: args.amount,
      source: args.source,
      note: args.note,
      date: args.date ?? todayInTz(),
    });
    return null;
  },
});

export const updateGoal = mutation({
  args: {
    id: v.id("savingsGoals"),
    name: v.optional(v.string()),
    targetAmount: v.optional(v.number()),
    deadline: v.optional(v.union(v.string(), v.null())),
    description: v.optional(v.string()),
    icon: v.optional(v.string()),
    color: v.optional(v.string()),
    autoAllocateType: v.optional(autoAllocateType),
    autoAllocateValue: v.optional(v.number()),
    autoAllocateActive: v.optional(v.boolean()),
    reminderFrequency: v.optional(reminderFrequency),
    reminderTime: v.optional(v.string()),
    reminderViaWa: v.optional(v.boolean()),
    isArchived: v.optional(v.boolean()),
  },
  returns: v.null(),
  handler: async (ctx, { id, ...patch }) => {
    const goal = await ctx.db.get(id);
    if (!goal) throw new Error("Goal tidak ditemukan");
    await requireEditScope(ctx, goal.userId);
    const clean: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(patch)) {
      if (value === undefined) continue;
      if (key === "deadline")
        clean.deadline = value === null ? undefined : value;
      else if (key === "name") clean.name = String(value).trim();
      else clean[key] = value;
    }
    await ctx.db.patch(id, clean);
    return null;
  },
});

export const removeGoal = mutation({
  args: { id: v.id("savingsGoals") },
  returns: v.null(),
  handler: async (ctx, { id }) => {
    const goal = await ctx.db.get(id);
    if (!goal) throw new Error("Goal tidak ditemukan");
    await requireEditScope(ctx, goal.userId);
    const txs = await ctx.db
      .query("savingsTransactions")
      .withIndex("by_goal_date", q => q.eq("goalId", id))
      .collect();
    for (const t of txs) await ctx.db.delete(t._id);
    await ctx.db.delete(id);
    return null;
  },
});

/**
 * Auto-alokasi: ambil sisa uang bulan sebelumnya (pemasukan − pengeluaran).
 * Kalau tidak ada surplus, fallback ke sisa anggaran kategori bulan tersebut.
 */
async function computeSurplus(
  ctx: MutationCtx,
  userId: Id<"users">,
  month: string,
) {
  const { start, end } = monthBounds(month);
  const txs = await ctx.db
    .query("transactions")
    .withIndex("by_user_date", q =>
      q.eq("userId", userId).gte("date", start).lte("date", end),
    )
    .collect();
  const active = txs.filter(t => !t.deletedAt);
  const income = active
    .filter(t => t.kind === "income")
    .reduce((s, t) => s + t.amount, 0);
  const expense = active
    .filter(t => t.kind === "expense")
    .reduce((s, t) => s + t.amount, 0);
  if (income - expense > 0)
    return { surplus: income - expense, basis: "sisa uang" };

  const budgets = await ctx.db
    .query("budgets")
    .withIndex("by_user_month", q => q.eq("userId", userId).eq("month", month))
    .collect();
  let leftover = 0;
  for (const b of budgets) {
    const spent = active
      .filter(
        t =>
          t.kind === "expense" &&
          (t.categoryId === b.categoryId || t.subCategoryId === b.categoryId),
      )
      .reduce((s, t) => s + t.amount, 0);
    leftover += Math.max(0, b.amount - spent);
  }
  return { surplus: leftover, basis: "sisa anggaran" };
}

async function runAllocationFor(
  ctx: MutationCtx,
  userId: Id<"users">,
  month: string,
) {
  const { surplus, basis } = await computeSurplus(ctx, userId, month);
  const goals = await ctx.db
    .query("savingsGoals")
    .withIndex("by_user", q => q.eq("userId", userId))
    .collect();
  const active = goals.filter(
    g =>
      !g.isArchived &&
      g.autoAllocateActive &&
      g.autoAllocateType !== "none" &&
      g.currentAmount < g.targetAmount,
  );
  const results: Array<{ goal: string; amount: number }> = [];
  if (surplus <= 0 || active.length === 0) {
    return { surplus, basis, allocated: 0, results };
  }
  let remainingSurplus = surplus;
  for (const goal of active) {
    let amount =
      goal.autoAllocateType === "percent"
        ? (surplus * goal.autoAllocateValue) / 100
        : goal.autoAllocateValue;
    amount = Math.min(
      Math.round(amount),
      remainingSurplus,
      goal.targetAmount - goal.currentAmount,
    );
    if (amount <= 0) continue;
    await addMutation(ctx, goal._id, {
      type: "auto_allocate",
      amount,
      source: `auto-alokasi (${basis} ${month})`,
      note: `Auto-alokasi dari ${basis} bulan ${month}`,
      date: todayInTz(),
    });
    remainingSurplus -= amount;
    results.push({ goal: goal.name, amount });
  }
  const allocated = surplus - remainingSurplus;
  if (allocated > 0) {
    await notify(
      ctx,
      userId,
      "Auto-alokasi tabungan dijalankan",
      `${formatMoney(allocated)} dialokasikan dari ${basis} bulan ${month} ke ${results.length} goal.`,
      "savings",
    );
  }
  return { surplus, basis, allocated, results };
}

export const runAutoAllocation = mutation({
  args: { ownerId: v.optional(v.id("users")), month: v.optional(v.string()) },
  returns: v.object({
    surplus: v.number(),
    basis: v.string(),
    allocated: v.number(),
    results: v.array(v.object({ goal: v.string(), amount: v.number() })),
  }),
  handler: async (ctx, { ownerId, month }) => {
    const scope = await requireEditScope(ctx, ownerId);
    const target = month ?? addMonths(todayInTz().slice(0, 7), -1);
    return await runAllocationFor(ctx, scope.ownerId, target);
  },
});

/** Dipanggil cron tanggal 1 tiap bulan. */
export const runAutoAllocationForAll = internalMutation({
  args: {},
  returns: v.null(),
  handler: async ctx => {
    const month = addMonths(todayInTz().slice(0, 7), -1);
    const profiles = await ctx.db.query("profiles").collect();
    for (const p of profiles) {
      try {
        await runAllocationFor(ctx, p.userId, month);
      } catch (err) {
        console.error("auto-alokasi gagal", p.userId, err);
      }
    }
    return null;
  },
});
