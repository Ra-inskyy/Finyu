import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import {
  requireEditScope,
  requireUserId,
  resolveScope,
  todayInTz,
} from "./lib";
import { walletType } from "./schema";

/** Daftar dompet + saldo terkini (saldo awal + pemasukan − pengeluaran ± transfer). */
export const list = query({
  args: { ownerId: v.optional(v.id("users")) },
  handler: async (ctx, { ownerId }) => {
    const scope = await resolveScope(ctx, ownerId);
    const wallets = await ctx.db
      .query("wallets")
      .withIndex("by_user", q => q.eq("userId", scope.ownerId))
      .collect();
    const txs = await ctx.db
      .query("transactions")
      .withIndex("by_user_date", q => q.eq("userId", scope.ownerId))
      .collect();
    const active = txs.filter(t => !t.deletedAt);

    return wallets.map(w => {
      let balance = w.initialBalance;
      for (const t of active) {
        if (t.walletId === w._id) {
          if (t.kind === "income") balance += t.amount;
          else balance -= t.amount; // expense & transfer keluar
        }
        if (t.kind === "transfer" && t.toWalletId === w._id) {
          balance += t.amount;
        }
      }
      return {
        id: w._id,
        name: w.name,
        type: w.type,
        color: w.color,
        icon: w.icon,
        initialBalance: w.initialBalance,
        isArchived: w.isArchived,
        balance,
      };
    });
  },
});

export const create = mutation({
  args: {
    ownerId: v.optional(v.id("users")),
    name: v.string(),
    type: walletType,
    initialBalance: v.number(),
    color: v.optional(v.string()),
    icon: v.optional(v.string()),
  },
  returns: v.id("wallets"),
  handler: async (ctx, args) => {
    const scope = await requireEditScope(ctx, args.ownerId);
    const name = args.name.trim();
    if (!name) throw new Error("Nama dompet wajib diisi");
    return await ctx.db.insert("wallets", {
      userId: scope.ownerId,
      name,
      type: args.type,
      initialBalance: args.initialBalance,
      color: args.color ?? "#10B981",
      icon: args.icon ?? "wallet",
      isArchived: false,
    });
  },
});

export const update = mutation({
  args: {
    id: v.id("wallets"),
    name: v.optional(v.string()),
    type: v.optional(walletType),
    initialBalance: v.optional(v.number()),
    color: v.optional(v.string()),
    isArchived: v.optional(v.boolean()),
  },
  returns: v.null(),
  handler: async (ctx, { id, ...patch }) => {
    const wallet = await ctx.db.get(id);
    if (!wallet) throw new Error("Dompet tidak ditemukan");
    await requireEditScope(ctx, wallet.userId);
    const clean: Record<string, unknown> = {};
    if (patch.name !== undefined) clean.name = patch.name.trim();
    if (patch.type !== undefined) clean.type = patch.type;
    if (patch.initialBalance !== undefined)
      clean.initialBalance = patch.initialBalance;
    if (patch.color !== undefined) clean.color = patch.color;
    if (patch.isArchived !== undefined) clean.isArchived = patch.isArchived;
    await ctx.db.patch(id, clean);
    return null;
  },
});

export const remove = mutation({
  args: { id: v.id("wallets") },
  returns: v.object({ archived: v.boolean() }),
  handler: async (ctx, { id }) => {
    const wallet = await ctx.db.get(id);
    if (!wallet) throw new Error("Dompet tidak ditemukan");
    await requireEditScope(ctx, wallet.userId);
    const used = await ctx.db
      .query("transactions")
      .withIndex("by_wallet", q => q.eq("walletId", id))
      .first();
    if (used) {
      await ctx.db.patch(id, { isArchived: true });
      return { archived: true };
    }
    await ctx.db.delete(id);
    return { archived: false };
  },
});

/** Transfer antar dompet — dicatat sebagai satu transaksi kind="transfer". */
export const transfer = mutation({
  args: {
    ownerId: v.optional(v.id("users")),
    fromWalletId: v.id("wallets"),
    toWalletId: v.id("wallets"),
    amount: v.number(),
    date: v.optional(v.string()),
    note: v.optional(v.string()),
  },
  returns: v.id("transactions"),
  handler: async (ctx, args) => {
    const scope = await requireEditScope(ctx, args.ownerId);
    const actorId = await requireUserId(ctx);
    if (args.fromWalletId === args.toWalletId)
      throw new Error("Dompet asal dan tujuan tidak boleh sama");
    if (args.amount <= 0) throw new Error("Nominal harus lebih dari 0");
    return await ctx.db.insert("transactions", {
      userId: scope.ownerId,
      kind: "transfer",
      amount: args.amount,
      walletId: args.fromWalletId,
      toWalletId: args.toWalletId,
      note: args.note,
      date: args.date ?? todayInTz(),
      receipts: [],
      source: "web",
      createdBy: actorId,
    });
  },
});
