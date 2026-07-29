import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";
import {
  formatMoney,
  monthOf,
  notify,
  requireEditScope,
  requireUserId,
  resolveScope,
  todayInTz,
} from "./lib";
import { txKind } from "./schema";

async function loadRange(
  ctx: { db: any },
  ownerId: Id<"users">,
  dateFrom?: string,
  dateTo?: string,
): Promise<Array<Doc<"transactions">>> {
  const q = ctx.db
    .query("transactions")
    .withIndex("by_user_date", (idx: any) => {
      let range = idx.eq("userId", ownerId);
      if (dateFrom) range = range.gte("date", dateFrom);
      if (dateTo) range = range.lte("date", dateTo);
      return range;
    });
  return await q.collect();
}

/** Daftar transaksi dengan filter lengkap + pagination sederhana. */
export const list = query({
  args: {
    ownerId: v.optional(v.id("users")),
    kind: v.optional(txKind),
    dateFrom: v.optional(v.string()),
    dateTo: v.optional(v.string()),
    categoryIds: v.optional(v.array(v.id("categories"))),
    walletIds: v.optional(v.array(v.id("wallets"))),
    search: v.optional(v.string()),
    includeDeleted: v.optional(v.boolean()),
    page: v.optional(v.number()),
    pageSize: v.optional(v.number()),
    sort: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const scope = await resolveScope(ctx, args.ownerId);
    const rows = await loadRange(
      ctx,
      scope.ownerId,
      args.dateFrom,
      args.dateTo,
    );
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

    const search = (args.search ?? "").trim().toLowerCase();
    const filtered = rows.filter(t => {
      if (!args.includeDeleted && t.deletedAt) return false;
      if (args.includeDeleted && !t.deletedAt) return false;
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
      if (search && !(t.note ?? "").toLowerCase().includes(search))
        return false;
      return true;
    });

    const sort = args.sort ?? "date_desc";
    filtered.sort((a, b) => {
      if (sort === "date_asc") return a.date.localeCompare(b.date);
      if (sort === "amount_desc") return b.amount - a.amount;
      if (sort === "amount_asc") return a.amount - b.amount;
      return b.date.localeCompare(a.date) || b._creationTime - a._creationTime;
    });

    const total = filtered.length;
    const totalAmount = filtered.reduce((s, t) => s + t.amount, 0);
    const pageSize = args.pageSize ?? 20;
    const page = args.page ?? 0;
    const slice = filtered.slice(page * pageSize, page * pageSize + pageSize);

    const items = await Promise.all(
      slice.map(async t => {
        const cat = t.categoryId ? catById.get(t.categoryId) : undefined;
        const sub = t.subCategoryId ? catById.get(t.subCategoryId) : undefined;
        const receiptUrls = await Promise.all(
          t.receipts.map(id => ctx.storage.getUrl(id)),
        );
        return {
          id: t._id,
          kind: t.kind,
          amount: t.amount,
          date: t.date,
          note: t.note ?? "",
          source: t.source,
          categoryId: t.categoryId ?? null,
          categoryName: cat?.name ?? null,
          categoryIcon: cat?.icon ?? null,
          categoryColor: cat?.color ?? null,
          subCategoryId: t.subCategoryId ?? null,
          subCategoryName: sub?.name ?? null,
          walletId: t.walletId ?? null,
          walletName: t.walletId
            ? (walletById.get(t.walletId)?.name ?? null)
            : null,
          toWalletId: t.toWalletId ?? null,
          toWalletName: t.toWalletId
            ? (walletById.get(t.toWalletId)?.name ?? null)
            : null,
          receiptUrls: receiptUrls.filter((u): u is string => Boolean(u)),
          deletedAt: t.deletedAt ?? null,
        };
      }),
    );

    return {
      items,
      total,
      totalAmount,
      page,
      pageSize,
      canEdit: scope.canEdit,
    };
  },
});

export const generateUploadUrl = mutation({
  args: {},
  returns: v.string(),
  handler: async ctx => {
    await requireUserId(ctx);
    return await ctx.storage.generateUploadUrl();
  },
});

/**
 * Cek anggaran setelah pengeluaran baru. Kalau lewat 80%/100% → notifikasi
 * in-app (dan WhatsApp kalau alert anggaran aktif).
 */
async function checkBudgetAfterExpense(
  ctx: any,
  ownerId: Id<"users">,
  categoryId: Id<"categories"> | undefined,
  date: string,
) {
  if (!categoryId) return;
  const month = monthOf(date);
  const budgets = await ctx.db
    .query("budgets")
    .withIndex("by_user_month", (q: any) =>
      q.eq("userId", ownerId).eq("month", month),
    )
    .collect();
  const budget = budgets.find(
    (b: Doc<"budgets">) => b.categoryId === categoryId,
  );
  if (!budget) return;

  const rows = await loadRange(ctx, ownerId, `${month}-01`, `${month}-31`);
  const cat = await ctx.db.get(categoryId);
  const children = await ctx.db
    .query("categories")
    .withIndex("by_parent", (q: any) => q.eq("parentId", categoryId))
    .collect();
  const ids = new Set<string>([
    categoryId as string,
    ...children.map((c: Doc<"categories">) => c._id as string),
  ]);
  const spent = rows
    .filter(
      (t: Doc<"transactions">) =>
        !t.deletedAt &&
        t.kind === "expense" &&
        ((t.categoryId && ids.has(t.categoryId)) ||
          (t.subCategoryId && ids.has(t.subCategoryId))),
    )
    .reduce((s: number, t: Doc<"transactions">) => s + t.amount, 0);

  const ratio = budget.amount > 0 ? spent / budget.amount : 0;
  const name = cat?.name ?? "kategori";
  if (ratio >= 1 && !budget.warn100SentAt) {
    await ctx.db.patch(budget._id, { warn100SentAt: Date.now() });
    await notify(
      ctx,
      ownerId,
      "Anggaran terlampaui",
      `Anggaran ${name} bulan ini sudah terpakai ${Math.round(ratio * 100)}% (${formatMoney(spent)} dari ${formatMoney(budget.amount)}).`,
      "budget",
    );
    await ctx.scheduler.runAfter(0, internal.whatsapp.sendBudgetAlert, {
      userId: ownerId,
      categoryName: name,
      spent,
      budget: budget.amount,
      level: 100,
    });
  } else if (ratio >= 0.8 && ratio < 1 && !budget.warn80SentAt) {
    await ctx.db.patch(budget._id, { warn80SentAt: Date.now() });
    await notify(
      ctx,
      ownerId,
      "Anggaran hampir habis",
      `Anggaran ${name} sudah terpakai ${Math.round(ratio * 100)}% (${formatMoney(spent)} dari ${formatMoney(budget.amount)}).`,
      "budget",
    );
    await ctx.scheduler.runAfter(0, internal.whatsapp.sendBudgetAlert, {
      userId: ownerId,
      categoryName: name,
      spent,
      budget: budget.amount,
      level: 80,
    });
  }
}

export const create = mutation({
  args: {
    ownerId: v.optional(v.id("users")),
    kind: txKind,
    amount: v.number(),
    date: v.optional(v.string()),
    categoryId: v.optional(v.id("categories")),
    subCategoryId: v.optional(v.id("categories")),
    walletId: v.optional(v.id("wallets")),
    toWalletId: v.optional(v.id("wallets")),
    note: v.optional(v.string()),
    receipts: v.optional(v.array(v.id("_storage"))),
  },
  returns: v.id("transactions"),
  handler: async (ctx, args) => {
    const scope = await requireEditScope(ctx, args.ownerId);
    const actorId = await requireUserId(ctx);
    const date = args.date ?? todayInTz();

    if (args.amount <= 0) throw new Error("Nominal harus lebih dari 0");
    if (date > todayInTz())
      throw new Error("Tanggal tidak boleh di masa depan");
    if (args.kind !== "transfer" && !args.categoryId)
      throw new Error("Kategori wajib dipilih");
    if ((args.note ?? "").length > 500)
      throw new Error("Catatan maksimal 500 karakter");
    if ((args.receipts ?? []).length > 3)
      throw new Error("Maksimal 3 lampiran foto");

    const id = await ctx.db.insert("transactions", {
      userId: scope.ownerId,
      kind: args.kind,
      amount: args.amount,
      categoryId: args.categoryId,
      subCategoryId: args.subCategoryId,
      walletId: args.walletId,
      toWalletId: args.toWalletId,
      note: args.note,
      date,
      receipts: args.receipts ?? [],
      source: "web",
      createdBy: actorId,
    });

    if (args.kind === "expense") {
      await checkBudgetAfterExpense(ctx, scope.ownerId, args.categoryId, date);
    }
    if (args.kind !== "transfer") {
      await ctx.scheduler.runAfter(0, internal.whatsapp.sendTransactionAlert, {
        transactionId: id,
      });
    }
    return id;
  },
});

export const update = mutation({
  args: {
    id: v.id("transactions"),
    amount: v.optional(v.number()),
    date: v.optional(v.string()),
    categoryId: v.optional(v.id("categories")),
    subCategoryId: v.optional(v.union(v.id("categories"), v.null())),
    walletId: v.optional(v.id("wallets")),
    note: v.optional(v.string()),
    receipts: v.optional(v.array(v.id("_storage"))),
  },
  returns: v.null(),
  handler: async (ctx, { id, ...patch }) => {
    const tx = await ctx.db.get(id);
    if (!tx) throw new Error("Transaksi tidak ditemukan");
    await requireEditScope(ctx, tx.userId);
    const clean: Record<string, unknown> = {};
    if (patch.amount !== undefined) {
      if (patch.amount <= 0) throw new Error("Nominal harus lebih dari 0");
      clean.amount = patch.amount;
    }
    if (patch.date !== undefined) {
      if (patch.date > todayInTz())
        throw new Error("Tanggal tidak boleh di masa depan");
      clean.date = patch.date;
    }
    if (patch.categoryId !== undefined) clean.categoryId = patch.categoryId;
    if (patch.subCategoryId !== undefined)
      clean.subCategoryId = patch.subCategoryId ?? undefined;
    if (patch.walletId !== undefined) clean.walletId = patch.walletId;
    if (patch.note !== undefined) clean.note = patch.note;
    if (patch.receipts !== undefined) clean.receipts = patch.receipts;
    await ctx.db.patch(id, clean);
    return null;
  },
});

/** Soft delete — bisa dipulihkan dalam 30 hari. */
export const softDelete = mutation({
  args: { id: v.id("transactions") },
  returns: v.null(),
  handler: async (ctx, { id }) => {
    const tx = await ctx.db.get(id);
    if (!tx) throw new Error("Transaksi tidak ditemukan");
    await requireEditScope(ctx, tx.userId);
    await ctx.db.patch(id, { deletedAt: Date.now() });
    return null;
  },
});

export const restore = mutation({
  args: { id: v.id("transactions") },
  returns: v.null(),
  handler: async (ctx, { id }) => {
    const tx = await ctx.db.get(id);
    if (!tx) throw new Error("Transaksi tidak ditemukan");
    await requireEditScope(ctx, tx.userId);
    await ctx.db.patch(id, { deletedAt: undefined });
    return null;
  },
});
