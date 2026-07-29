import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import {
  internalAction,
  internalMutation,
  internalQuery,
  type MutationCtx,
  mutation,
  query,
} from "./_generated/server";
import {
  addDays,
  formatMoney,
  isValidIdPhone,
  monthBounds,
  normalizePhone,
  notify,
  nowPartsInTz,
  requireUserId,
  todayInTz,
  writeAudit,
} from "./lib";
import { scheduleType } from "./schema";
import { parseWaMessage, WA_HELP_TEXT } from "./waParser";

declare const process: { env: Record<string, string | undefined> };

const RATE_LIMIT_PER_MINUTE = 30;

// ────────────────────────── Query publik ──────────────────────────

export const connection = query({
  args: {},
  handler: async ctx => {
    const userId = await requireUserId(ctx);
    const conn = await ctx.db
      .query("waConnections")
      .withIndex("by_user", q => q.eq("userId", userId))
      .unique();
    const gatewayConfigured = Boolean(process.env.WA_GATEWAY_URL && process.env.WA_GATEWAY_TOKEN);
    const botPhone = process.env.WA_BOT_PHONE ?? "";
    if (!conn) {
      return {
        status: "disconnected" as const,
        phone: "",
        connectedAt: null,
        lastError: null,
        alertRealtime: true,
        alertBudget: true,
        alertGoal: true,
        mutedCategoryIds: [] as Array<Id<"categories">>,
        gatewayConfigured,
        botPhone,
      };
    }
    return {
      status: conn.status,
      phone: conn.phone,
      connectedAt: conn.connectedAt ?? null,
      lastError: conn.lastError ?? null,
      alertRealtime: conn.alertRealtime,
      alertBudget: conn.alertBudget,
      alertGoal: conn.alertGoal,
      mutedCategoryIds: conn.mutedCategoryIds,
      gatewayConfigured,
      botPhone,
    };
  },
});

export const schedules = query({
  args: {},
  handler: async ctx => {
    const userId = await requireUserId(ctx);
    const rows = await ctx.db
      .query("waSchedules")
      .withIndex("by_user", q => q.eq("userId", userId))
      .collect();
    return rows.map(r => ({
      id: r._id,
      type: r.type,
      sendTime: r.sendTime,
      dayOfWeek: r.dayOfWeek ?? null,
      dayOfMonth: r.dayOfMonth ?? null,
      timezone: r.timezone,
      isActive: r.isActive,
      lastSentAt: r.lastSentAt ?? null,
    }));
  },
});

export const logs = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit }) => {
    const userId = await requireUserId(ctx);
    const rows = await ctx.db
      .query("waMessageLogs")
      .withIndex("by_user", q => q.eq("userId", userId))
      .order("desc")
      .take(limit ?? 40);
    return rows.map(r => ({
      id: r._id,
      direction: r.direction,
      message: r.message,
      intent: r.intent ?? null,
      status: r.status,
      error: r.error ?? null,
      at: r._creationTime,
    }));
  },
});

// ────────────────────────── Koneksi ──────────────────────────

export const connect = mutation({
  args: { phone: v.string() },
  returns: v.null(),
  handler: async (ctx, { phone }) => {
    const userId = await requireUserId(ctx);
    if (!isValidIdPhone(phone))
      throw new Error("Nomor WhatsApp tidak valid (pakai format 08xx / +62xx)");
    const normalized = normalizePhone(phone);

    // Satu nomor hanya boleh dipakai satu akun aktif.
    const others = await ctx.db
      .query("waConnections")
      .withIndex("by_phone", q => q.eq("phone", normalized))
      .collect();
    for (const other of others) {
      if (other.userId !== userId && other.status === "connected") {
        await ctx.db.patch(other._id, {
          status: "disconnected",
          lastError: "Nomor dipakai di akun lain",
        });
      }
    }

    const existing = await ctx.db
      .query("waConnections")
      .withIndex("by_user", q => q.eq("userId", userId))
      .unique();
    const sessionName = `finyu-${userId.slice(-8)}`;
    const patch = {
      phone: normalized,
      sessionName,
      status: "connected" as const,
      mode: "gateway" as const,
      connectedAt: Date.now(),
      qrPayload: undefined,
      qrIssuedAt: undefined,
      lastError: undefined,
    };
    if (existing) await ctx.db.patch(existing._id, patch);
    else
      await ctx.db.insert("waConnections", {
        userId,
        ...patch,
        alertRealtime: true,
        alertBudget: true,
        alertGoal: true,
        mutedCategoryIds: [],
      });

    // Simpan nomor ke profil user.
    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_user", q => q.eq("userId", userId))
      .unique();
    if (profile) await ctx.db.patch(profile._id, { phone: normalized });

    await writeAudit(ctx, userId, "wa_connected", normalized);
    await notify(
      ctx,
      userId,
      "WhatsApp terhubung",
      `Nomor ${normalized} berhasil dikaitkan. Kirim pesan ke bot Finyu untuk mulai mencatat keuangan.`,
      "whatsapp",
    );
    return null;
  },
});

// (QR-based pairing removed — users connect by entering their phone number directly)

export const disconnect = mutation({
  args: {},
  returns: v.null(),
  handler: async ctx => {
    const userId = await requireUserId(ctx);
    const conn = await ctx.db
      .query("waConnections")
      .withIndex("by_user", q => q.eq("userId", userId))
      .unique();
    if (!conn) return null;
    await ctx.db.patch(conn._id, {
      status: "disconnected",
      qrPayload: undefined,
      connectedAt: undefined,
    });
    const scheduleRows = await ctx.db
      .query("waSchedules")
      .withIndex("by_user", q => q.eq("userId", userId))
      .collect();
    for (const s of scheduleRows)
      await ctx.db.patch(s._id, { isActive: false });
    await writeAudit(ctx, userId, "wa_disconnect", conn.phone);
    return null;
  },
});

export const updatePrefs = mutation({
  args: {
    alertRealtime: v.optional(v.boolean()),
    alertBudget: v.optional(v.boolean()),
    alertGoal: v.optional(v.boolean()),
    mutedCategoryIds: v.optional(v.array(v.id("categories"))),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const conn = await ctx.db
      .query("waConnections")
      .withIndex("by_user", q => q.eq("userId", userId))
      .unique();
    if (!conn) throw new Error("Hubungkan WhatsApp dulu");
    const patch: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(args))
      if (value !== undefined) patch[key] = value;
    await ctx.db.patch(conn._id, patch);
    return null;
  },
});

// ────────────────────────── Jadwal ringkasan ──────────────────────────

export const upsertSchedule = mutation({
  args: {
    id: v.optional(v.id("waSchedules")),
    type: scheduleType,
    sendTime: v.string(),
    dayOfWeek: v.optional(v.number()),
    dayOfMonth: v.optional(v.number()),
    isActive: v.boolean(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(args.sendTime))
      throw new Error("Format jam harus HH:MM");
    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_user", q => q.eq("userId", userId))
      .unique();
    const timezone = profile?.timezone ?? "Asia/Jakarta";
    if (args.id) {
      const row = await ctx.db.get(args.id);
      if (!row || row.userId !== userId)
        throw new Error("Jadwal tidak ditemukan");
      await ctx.db.patch(args.id, {
        type: args.type,
        sendTime: args.sendTime,
        dayOfWeek: args.dayOfWeek,
        dayOfMonth: args.dayOfMonth,
        isActive: args.isActive,
        timezone,
      });
    } else {
      await ctx.db.insert("waSchedules", {
        userId,
        type: args.type,
        sendTime: args.sendTime,
        dayOfWeek: args.dayOfWeek,
        dayOfMonth: args.dayOfMonth,
        timezone,
        isActive: args.isActive,
      });
    }
    return null;
  },
});

export const removeSchedule = mutation({
  args: { id: v.id("waSchedules") },
  returns: v.null(),
  handler: async (ctx, { id }) => {
    const userId = await requireUserId(ctx);
    const row = await ctx.db.get(id);
    if (!row || row.userId !== userId)
      throw new Error("Jadwal tidak ditemukan");
    await ctx.db.delete(id);
    return null;
  },
});

// ────────────────────────── Penyusun pesan ──────────────────────────

async function financeSnapshot(ctx: MutationCtx, userId: Id<"users">) {
  const today = todayInTz();
  const month = today.slice(0, 7);
  const { start, end } = monthBounds(month);
  const txs = await ctx.db
    .query("transactions")
    .withIndex("by_user_date", q =>
      q
        .eq("userId", userId)
        .gte("date", addDays(today, -40))
        .lte("date", today),
    )
    .collect();
  const active = txs.filter(t => !t.deletedAt);
  const monthExpense = active
    .filter(t => t.kind === "expense" && t.date >= start && t.date <= end)
    .reduce((s, t) => s + t.amount, 0);
  const monthIncome = active
    .filter(t => t.kind === "income" && t.date >= start && t.date <= end)
    .reduce((s, t) => s + t.amount, 0);
  const goals = await ctx.db
    .query("savingsGoals")
    .withIndex("by_user", q => q.eq("userId", userId))
    .collect();
  const savings = goals
    .filter(g => !g.isArchived)
    .reduce((s, g) => s + g.currentAmount, 0);
  return { today, month, active, monthExpense, monthIncome, savings, goals };
}

async function categoryTotals(
  ctx: MutationCtx,
  userId: Id<"users">,
  from: string,
  to: string,
) {
  const txs = await ctx.db
    .query("transactions")
    .withIndex("by_user_date", q =>
      q.eq("userId", userId).gte("date", from).lte("date", to),
    )
    .collect();
  const expenses = txs.filter(t => !t.deletedAt && t.kind === "expense");
  const cats = await ctx.db
    .query("categories")
    .withIndex("by_user", q => q.eq("userId", userId))
    .collect();
  const byId = new Map(cats.map(c => [c._id as string, c]));
  const totals = new Map<string, number>();
  for (const t of expenses) {
    const raw = t.categoryId ? byId.get(t.categoryId as string) : undefined;
    const parent = raw?.parentId ? byId.get(raw.parentId as string) : raw;
    const name = parent?.name ?? "Lainnya";
    totals.set(name, (totals.get(name) ?? 0) + t.amount);
  }
  const total = expenses.reduce((s, t) => s + t.amount, 0);
  return {
    total,
    count: expenses.length,
    top: [...totals.entries()]
      .map(([name, amount]) => ({ name, amount }))
      .sort((a, b) => b.amount - a.amount),
  };
}

/** Grafik ASCII sederhana untuk ringkasan mingguan. */
function asciiBar(value: number, max: number, width = 10) {
  if (max <= 0) return "".padEnd(width, "░");
  const filled = Math.max(1, Math.round((value / max) * width));
  return "█".repeat(filled).padEnd(width, "░");
}

async function buildSummaryText(
  ctx: MutationCtx,
  userId: Id<"users">,
  type: "daily" | "weekly" | "monthly",
) {
  const snap = await financeSnapshot(ctx, userId);
  const today = snap.today;
  if (type === "daily") {
    const stats = await categoryTotals(ctx, userId, today, today);
    const lines = [
      `📊 *Ringkasan Harian Finyu* — ${today}`,
      "",
      `Pengeluaran hari ini: *${formatMoney(stats.total)}* (${stats.count} transaksi)`,
    ];
    if (stats.top.length) {
      lines.push("", "Top kategori:");
      stats.top.slice(0, 3).forEach((c, i) => {
        lines.push(`${i + 1}. ${c.name} — ${formatMoney(c.amount)}`);
      });
    }
    lines.push(
      "",
      `Saldo tabungan: *${formatMoney(snap.savings)}*`,
      `Sisa uang bulan ini: *${formatMoney(snap.monthIncome - snap.monthExpense)}*`,
    );
    return lines.join("\n");
  }
  if (type === "weekly") {
    const start = addDays(today, -6);
    const prevStart = addDays(today, -13);
    const prevEnd = addDays(today, -7);
    const now = await categoryTotals(ctx, userId, start, today);
    const prev = await categoryTotals(ctx, userId, prevStart, prevEnd);
    const delta =
      prev.total > 0 ? ((now.total - prev.total) / prev.total) * 100 : null;
    const max = Math.max(...now.top.map(t => t.amount), 1);
    const lines = [
      `📈 *Ringkasan Mingguan Finyu* — ${start} s/d ${today}`,
      "",
      `Total pengeluaran: *${formatMoney(now.total)}* (${now.count} transaksi)`,
      delta === null
        ? "Minggu lalu: belum ada data"
        : `vs minggu lalu: ${delta > 0 ? "🔴 +" : "🟢 "}${delta.toFixed(0)}% (${formatMoney(prev.total)})`,
    ];
    if (now.top.length) {
      lines.push("", "Per kategori:");
      for (const c of now.top.slice(0, 5)) {
        lines.push(
          `${asciiBar(c.amount, max)} ${c.name} ${formatMoney(c.amount)}`,
        );
      }
    }
    lines.push("", `Saldo tabungan: *${formatMoney(snap.savings)}*`);
    return lines.join("\n");
  }

  const { start, end } = monthBounds(snap.month);
  const stats = await categoryTotals(ctx, userId, start, end);
  const dayCount = Number(today.slice(8));
  const budgets = await ctx.db
    .query("budgets")
    .withIndex("by_user_month", q =>
      q.eq("userId", userId).eq("month", snap.month),
    )
    .collect();
  const cats = await ctx.db
    .query("categories")
    .withIndex("by_user", q => q.eq("userId", userId))
    .collect();
  const catName = new Map(cats.map(c => [c._id as string, c.name]));
  const lines = [
    `🗓️ *Ringkasan Bulanan Finyu* — ${snap.month}`,
    "",
    `Total pengeluaran: *${formatMoney(stats.total)}*`,
    `Rata-rata harian: *${formatMoney(dayCount > 0 ? stats.total / dayCount : 0)}*`,
    `Pemasukan: *${formatMoney(snap.monthIncome)}* • Sisa uang: *${formatMoney(snap.monthIncome - snap.monthExpense)}*`,
  ];
  if (budgets.length) {
    lines.push("", "Progres anggaran:");
    for (const b of budgets.slice(0, 6)) {
      const spent =
        stats.top.find(t => t.name === catName.get(b.categoryId as string))
          ?.amount ?? 0;
      const ratio = b.amount > 0 ? (spent / b.amount) * 100 : 0;
      const icon = ratio >= 100 ? "🔴" : ratio >= 80 ? "🟡" : "🟢";
      lines.push(
        `${icon} ${catName.get(b.categoryId as string) ?? "-"}: ${formatMoney(spent)} / ${formatMoney(b.amount)} (${ratio.toFixed(0)}%)`,
      );
    }
  }
  lines.push("", `Saldo tabungan: *${formatMoney(snap.savings)}*`);
  return lines.join("\n");
}

// ────────────────────────── Pesan masuk (bot) ──────────────────────────

async function checkRateLimit(ctx: MutationCtx, userId: Id<"users">) {
  const recent = await ctx.db
    .query("waMessageLogs")
    .withIndex("by_user", q => q.eq("userId", userId))
    .order("desc")
    .take(RATE_LIMIT_PER_MINUTE + 1);
  const cutoff = Date.now() - 60_000;
  const inWindow = recent.filter(r => r._creationTime > cutoff);
  if (inWindow.length >= RATE_LIMIT_PER_MINUTE)
    throw new Error(
      "Terlalu banyak pesan. Coba lagi sebentar (maks 30/menit).",
    );
}

async function processIncoming(
  ctx: MutationCtx,
  userId: Id<"users">,
  text: string,
): Promise<{ reply: string; intent: string }> {
  const parsed = parseWaMessage(text);
  const conn = await ctx.db
    .query("waConnections")
    .withIndex("by_user", q => q.eq("userId", userId))
    .unique();
  const phone = conn?.phone ?? "";

  await ctx.db.insert("waMessageLogs", {
    userId,
    direction: "in",
    phone,
    message: text,
    intent: parsed.intent,
    status: "received",
  });

  let reply = "";
  switch (parsed.intent) {
    case "bantuan":
      reply = WA_HELP_TEXT;
      break;
    case "putuskan": {
      if (conn)
        await ctx.db.patch(conn._id, {
          status: "disconnected",
          connectedAt: undefined,
        });
      reply =
        "🔌 Koneksi WhatsApp diputuskan. Semua jadwal ringkasan dinonaktifkan. Hubungkan lagi dari halaman *Bot WhatsApp* di web Finyu.";
      break;
    }
    case "saldo": {
      const snap = await financeSnapshot(ctx, userId);
      const goalLines = snap.goals
        .filter(g => !g.isArchived)
        .slice(0, 3)
        .map(g => {
          const pct =
            g.targetAmount > 0
              ? Math.min(100, (g.currentAmount / g.targetAmount) * 100)
              : 0;
          return `• ${g.name}: ${formatMoney(g.currentAmount)} / ${formatMoney(g.targetAmount)} (${pct.toFixed(0)}%)`;
        });
      reply = [
        "💰 *Saldo & Ringkasan Finyu*",
        "",
        `Saldo tabungan: *${formatMoney(snap.savings)}*`,
        `Pengeluaran bulan ini: *${formatMoney(snap.monthExpense)}*`,
        `Pemasukan bulan ini: *${formatMoney(snap.monthIncome)}*`,
        `Sisa uang: *${formatMoney(snap.monthIncome - snap.monthExpense)}*`,
        ...(goalLines.length ? ["", "Goal tabungan:", ...goalLines] : []),
      ].join("\n");
      break;
    }
    case "pengeluaran": {
      const today = todayInTz();
      let from = today;
      let to = today;
      let label = `hari ini (${today})`;
      if (parsed.date) {
        from = parsed.date;
        to = parsed.date;
        label = parsed.date;
      } else if (parsed.period === "minggu") {
        from = addDays(today, -6);
        label = `7 hari terakhir (${from} s/d ${today})`;
      } else if (parsed.period === "bulan") {
        const bounds = monthBounds(today.slice(0, 7));
        from = bounds.start;
        to = today;
        label = `bulan ${today.slice(0, 7)}`;
      }
      const stats = await categoryTotals(ctx, userId, from, to);
      const lines = [
        `🧾 *Pengeluaran ${label}*`,
        "",
        `Total: *${formatMoney(stats.total)}* (${stats.count} transaksi)`,
      ];
      if (stats.top.length) {
        lines.push("");
        for (const c of stats.top.slice(0, 5))
          lines.push(`• ${c.name}: ${formatMoney(c.amount)}`);
      } else {
        lines.push("", "Belum ada transaksi di periode ini.");
      }
      reply = lines.join("\n");
      break;
    }
    case "catat": {
      const kind = parsed.kind;
      const cats = await ctx.db
        .query("categories")
        .withIndex("by_user_kind", q => q.eq("userId", userId).eq("kind", kind))
        .collect();
      const needle = parsed.category.toLowerCase();
      const match =
        cats.find(c => c.name.toLowerCase() === needle) ??
        cats.find(c => c.name.toLowerCase().includes(needle)) ??
        cats.find(c => needle.includes(c.name.toLowerCase().split(" ")[0])) ??
        cats.find(c => c.name === "Lainnya");
      if (!match) {
        reply =
          "⚠️ Kategori belum bisa dikenali dan kategori *Lainnya* tidak ada. Buat kategori dulu di web Finyu ya.";
        break;
      }
      const wallets = await ctx.db
        .query("wallets")
        .withIndex("by_user", q => q.eq("userId", userId))
        .collect();
      const wallet = wallets.find(w => !w.isArchived);
      const noteParts = [parsed.note, parsed.category]
        .filter(Boolean)
        .join(" · ");
      await ctx.db.insert("transactions", {
        userId,
        kind,
        amount: parsed.amount,
        categoryId: match.parentId ?? match._id,
        subCategoryId: match.parentId ? match._id : undefined,
        walletId: wallet?._id,
        note: noteParts || undefined,
        date: todayInTz(),
        receipts: [],
        source: "whatsapp",
        createdBy: userId,
      });
      const snap = await financeSnapshot(ctx, userId);
      reply = [
        kind === "expense"
          ? "✅ Pengeluaran dicatat!"
          : "✅ Pemasukan dicatat!",
        "",
        `Nominal: *${formatMoney(parsed.amount)}*`,
        `Kategori: ${match.name}`,
        ...(noteParts ? [`Catatan: ${noteParts}`] : []),
        `Dompet: ${wallet?.name ?? "-"}`,
        "",
        `Total pengeluaran bulan ini: ${formatMoney(snap.monthExpense)}`,
        `Saldo tabungan: ${formatMoney(snap.savings)}`,
      ].join("\n");
      break;
    }
    default:
      reply = `🤔 Perintahnya belum aku mengerti.\n\n${WA_HELP_TEXT}`;
  }

  await ctx.db.insert("waMessageLogs", {
    userId,
    direction: "out",
    phone,
    message: reply,
    intent: parsed.intent,
    status: "queued",
  });
  if (conn?.status === "connected") {
    await ctx.scheduler.runAfter(0, internal.whatsapp.deliver, {
      userId,
      text: reply,
      intent: parsed.intent,
    });
  }
  return { reply, intent: parsed.intent };
}

/** Simulator chat di web: kirim pesan seolah-olah dari WhatsApp. */
export const simulateIncoming = mutation({
  args: { text: v.string() },
  returns: v.object({ reply: v.string(), intent: v.string() }),
  handler: async (ctx, { text }) => {
    const userId = await requireUserId(ctx);
    await checkRateLimit(ctx, userId);
    return await processIncoming(ctx, userId, text.trim());
  },
});

/** Dipakai webhook gateway (nomor → user). */
export const handleGatewayMessage = internalMutation({
  args: { phone: v.string(), text: v.string() },
  returns: v.object({ handled: v.boolean() }),
  handler: async (ctx, { phone, text }) => {
    const normalized = normalizePhone(phone);
    const conn = await ctx.db
      .query("waConnections")
      .withIndex("by_phone", q => q.eq("phone", normalized))
      .collect();
    const target = conn.find(c => c.status === "connected") ?? conn[0];
    if (!target) return { handled: false };
    await processIncoming(ctx, target.userId, text.trim());
    return { handled: true };
  },
});

// ────────────────────────── Alert & pengiriman ──────────────────────────

export const sendTransactionAlert = internalMutation({
  args: { transactionId: v.id("transactions") },
  returns: v.null(),
  handler: async (ctx, { transactionId }) => {
    const tx = await ctx.db.get(transactionId);
    if (!tx) return null;
    const conn = await ctx.db
      .query("waConnections")
      .withIndex("by_user", q => q.eq("userId", tx.userId))
      .unique();
    if (!conn || conn.status !== "connected" || !conn.alertRealtime)
      return null;
    if (tx.categoryId && conn.mutedCategoryIds.includes(tx.categoryId))
      return null;

    const cat = tx.categoryId ? await ctx.db.get(tx.categoryId) : null;
    const snap = await financeSnapshot(ctx, tx.userId);
    const emoji = tx.kind === "expense" ? "🔻" : "🔼";
    const jam = nowPartsInTz().time;
    const text = [
      `${emoji} *${tx.kind === "expense" ? "Pengeluaran" : "Pemasukan"} baru dicatat*`,
      "",
      `Nominal: *${formatMoney(tx.amount)}*`,
      `Kategori: ${cat?.name ?? "-"}`,
      ...(tx.note ? [`Catatan: ${tx.note}`] : []),
      `Waktu: ${tx.date} ${jam} WIB`,
      "",
      `Total pengeluaran bulan ini: ${formatMoney(snap.monthExpense)}`,
      `Saldo tabungan: ${formatMoney(snap.savings)}`,
    ].join("\n");

    await ctx.scheduler.runAfter(0, internal.whatsapp.deliver, {
      userId: tx.userId,
      text,
      intent: "alert_transaksi",
    });
    return null;
  },
});

export const sendBudgetAlert = internalMutation({
  args: {
    userId: v.id("users"),
    categoryName: v.string(),
    spent: v.number(),
    budget: v.number(),
    level: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const conn = await ctx.db
      .query("waConnections")
      .withIndex("by_user", q => q.eq("userId", args.userId))
      .unique();
    if (!conn || conn.status !== "connected" || !conn.alertBudget) return null;
    const text = [
      args.level >= 100
        ? "🔴 *Anggaran terlampaui!*"
        : "🟡 *Anggaran hampir habis*",
      "",
      `Kategori: ${args.categoryName}`,
      `Terpakai: ${formatMoney(args.spent)} dari ${formatMoney(args.budget)} (${Math.round((args.spent / Math.max(args.budget, 1)) * 100)}%)`,
    ].join("\n");
    await ctx.scheduler.runAfter(0, internal.whatsapp.deliver, {
      userId: args.userId,
      text,
      intent: "alert_anggaran",
    });
    return null;
  },
});

export const sendGoalAchieved = internalMutation({
  args: {
    userId: v.id("users"),
    goalName: v.string(),
    targetAmount: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const conn = await ctx.db
      .query("waConnections")
      .withIndex("by_user", q => q.eq("userId", args.userId))
      .unique();
    if (!conn || conn.status !== "connected" || !conn.alertGoal) return null;
    const text = [
      "🎉 *Goal tabungan tercapai!*",
      "",
      `Goal: ${args.goalName}`,
      `Target: ${formatMoney(args.targetAmount)}`,
      "",
      "Mantap! Waktunya bikin goal baru? 💪",
    ].join("\n");
    await ctx.scheduler.runAfter(0, internal.whatsapp.deliver, {
      userId: args.userId,
      text,
      intent: "alert_goal",
    });
    return null;
  },
});

/** Kirim ringkasan sekarang (dipakai cron & tombol "Kirim sekarang"). */
export const sendSummaryNow = internalMutation({
  args: {
    userId: v.id("users"),
    type: scheduleType,
    scheduleId: v.optional(v.id("waSchedules")),
    sentKey: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const text = await buildSummaryText(ctx, args.userId, args.type);
    if (args.scheduleId)
      await ctx.db.patch(args.scheduleId, {
        lastSentAt: Date.now(),
        lastSentKey: args.sentKey,
      });
    await ctx.scheduler.runAfter(0, internal.whatsapp.deliver, {
      userId: args.userId,
      text,
      intent: `ringkasan_${args.type}`,
    });
    return null;
  },
});

export const requestSummary = mutation({
  args: { type: scheduleType },
  returns: v.null(),
  handler: async (ctx, { type }) => {
    const userId = await requireUserId(ctx);
    await ctx.scheduler.runAfter(0, internal.whatsapp.sendSummaryNow, {
      userId,
      type,
    });
    return null;
  },
});

export const connectionOf = internalQuery({
  args: { userId: v.id("users") },
  returns: v.union(
    v.object({
      phone: v.string(),
      mode: v.string(),
      status: v.string(),
      sessionName: v.string(),
    }),
    v.null(),
  ),
  handler: async (ctx, { userId }) => {
    const conn = await ctx.db
      .query("waConnections")
      .withIndex("by_user", q => q.eq("userId", userId))
      .unique();
    if (!conn) return null;
    return {
      phone: conn.phone,
      mode: conn.mode,
      status: conn.status,
      sessionName: conn.sessionName,
    };
  },
});

export const recordDelivery = internalMutation({
  args: {
    userId: v.id("users"),
    phone: v.string(),
    text: v.string(),
    intent: v.string(),
    status: v.string(),
    error: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.insert("waMessageLogs", {
      userId: args.userId,
      direction: "out",
      phone: args.phone,
      message: args.text,
      intent: args.intent,
      status: args.status,
      error: args.error,
    });
    if (args.error) {
      const conn = await ctx.db
        .query("waConnections")
        .withIndex("by_user", q => q.eq("userId", args.userId))
        .unique();
      if (conn) await ctx.db.patch(conn._id, { lastError: args.error });
      await notify(
        ctx,
        args.userId,
        "Gagal kirim pesan WhatsApp",
        `${args.error}. Coba hubungkan ulang WhatsApp dari halaman Bot WhatsApp.`,
        "whatsapp",
      );
    }
    return null;
  },
});

/**
 * Pengiriman pesan ke WhatsApp user via bot Fonnte terpusat.
 * Semua pesan dikirim dari 1 nomor bot Fonnte ke nomor pribadi user.
 * Retry 3x dengan exponential backoff.
 */
export const deliver = internalAction({
  args: { userId: v.id("users"), text: v.string(), intent: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const conn = await ctx.runQuery(internal.whatsapp.connectionOf, {
      userId: args.userId,
    });
    if (!conn || conn.status !== "connected") return null;

    const baseUrl = process.env.WA_GATEWAY_URL;
    const token = process.env.WA_GATEWAY_TOKEN;
    if (!baseUrl || !token) {
      await ctx.runMutation(internal.whatsapp.recordDelivery, {
        userId: args.userId,
        phone: conn.phone,
        text: args.text,
        intent: args.intent,
        status: "failed",
        error:
          "Gateway WA belum dikonfigurasi (WA_GATEWAY_URL / WA_GATEWAY_TOKEN)",
      });
      return null;
    }

    const provider = (
      process.env.WA_GATEWAY_PROVIDER ?? "fonnte"
    ).toLowerCase();

    let lastError = "";
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const response =
          provider === "waha"
            ? await fetch(`${baseUrl.replace(/\/$/, "")}/api/sendText`, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  "X-Api-Key": token,
                },
                body: JSON.stringify({
                  session: "default",
                  chatId: `${conn.phone}@c.us`,
                  text: args.text,
                }),
              })
            : await fetch(`${baseUrl.replace(/\/$/, "")}/send`, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: token,
                },
                body: JSON.stringify({
                  target: conn.phone,
                  message: args.text,
                  countryCode: "62",
                }),
              });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        await ctx.runMutation(internal.whatsapp.recordDelivery, {
          userId: args.userId,
          phone: conn.phone,
          text: args.text,
          intent: args.intent,
          status: "sent",
        });
        return null;
      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error);
        await new Promise(resolve => setTimeout(resolve, 2 ** attempt * 500));
      }
    }
    await ctx.runMutation(internal.whatsapp.recordDelivery, {
      userId: args.userId,
      phone: conn.phone,
      text: args.text,
      intent: args.intent,
      status: "failed",
      error: lastError,
    });
    return null;
  },
});

// (startGatewaySession removed — bot session dikelola global via Fonnte dashboard)

// ────────────────────────── Cron dispatcher ──────────────────────────

export const dispatchSchedules = internalMutation({
  args: {},
  returns: v.null(),
  handler: async ctx => {
    const rows = await ctx.db.query("waSchedules").collect();
    for (const row of rows) {
      if (!row.isActive) continue;
      const now = nowPartsInTz(row.timezone);
      if (now.time < row.sendTime) continue;
      if (row.type === "weekly" && row.dayOfWeek !== now.dayOfWeek) continue;
      if (row.type === "monthly" && row.dayOfMonth !== now.dayOfMonth) continue;
      const key =
        row.type === "monthly"
          ? `monthly:${now.date.slice(0, 7)}`
          : `${row.type}:${now.date}`;
      if (row.lastSentKey === key) continue;
      const conn = await ctx.db
        .query("waConnections")
        .withIndex("by_user", q => q.eq("userId", row.userId))
        .unique();
      if (!conn || conn.status !== "connected") continue;
      await ctx.scheduler.runAfter(0, internal.whatsapp.sendSummaryNow, {
        userId: row.userId,
        type: row.type,
        scheduleId: row._id,
        sentKey: key,
      });
    }
    return null;
  },
});

/** Reminder tabungan: sesuai frekuensi + H-7 deadline kalau progres < 80%. */
export const dispatchSavingsReminders = internalMutation({
  args: {},
  returns: v.null(),
  handler: async ctx => {
    const goals = await ctx.db.query("savingsGoals").collect();
    for (const goal of goals) {
      if (goal.isArchived) continue;
      const profile = await ctx.db
        .query("profiles")
        .withIndex("by_user", q => q.eq("userId", goal.userId))
        .unique();
      const now = nowPartsInTz(profile?.timezone ?? "Asia/Jakarta");
      const percent =
        goal.targetAmount > 0 ? goal.currentAmount / goal.targetAmount : 0;

      // H-7 deadline & progres < 80%
      if (goal.deadline && percent < 0.8) {
        const daysLeft = Math.round(
          (new Date(`${goal.deadline}T00:00:00Z`).getTime() -
            new Date(`${now.date}T00:00:00Z`).getTime()) /
            86400000,
        );
        if (daysLeft === 7) {
          await sendReminder(
            ctx,
            goal,
            `⏰ Goal *${goal.name}* deadline 7 hari lagi (${goal.deadline}) tapi progres baru ${(percent * 100).toFixed(0)}%. Sisa ${formatMoney(goal.targetAmount - goal.currentAmount)}.`,
          );
        }
      }

      if (goal.reminderFrequency === "none") continue;
      const targetTime = goal.reminderTime ?? "08:00";
      if (now.time.slice(0, 2) !== targetTime.slice(0, 2)) continue;
      if (goal.reminderFrequency === "weekly" && now.dayOfWeek !== 1) continue;
      if (goal.reminderFrequency === "monthly" && now.dayOfMonth !== 1)
        continue;
      await sendReminder(
        ctx,
        goal,
        `🐷 Waktunya menabung untuk *${goal.name}*! Progres ${(percent * 100).toFixed(0)}% — sisa ${formatMoney(Math.max(0, goal.targetAmount - goal.currentAmount))}.`,
      );
    }
    return null;
  },
});

async function sendReminder(
  ctx: MutationCtx,
  goal: Doc<"savingsGoals">,
  text: string,
) {
  const existing = await ctx.db
    .query("notifications")
    .withIndex("by_user", q => q.eq("userId", goal.userId))
    .order("desc")
    .take(20);
  const already = existing.some(
    n => n.body === text && Date.now() - n._creationTime < 20 * 3600 * 1000,
  );
  if (already) return;
  await notify(ctx, goal.userId, "Pengingat tabungan", text, "savings");
  if (goal.reminderViaWa) {
    const conn = await ctx.db
      .query("waConnections")
      .withIndex("by_user", q => q.eq("userId", goal.userId))
      .unique();
    if (conn && conn.status === "connected") {
      await ctx.scheduler.runAfter(0, internal.whatsapp.deliver, {
        userId: goal.userId,
        text,
        intent: "reminder_tabungan",
      });
    }
  }
}
