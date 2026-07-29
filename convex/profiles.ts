import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireUserId, writeAudit } from "./lib";

/** Kategori pengeluaran default (di-seed saat akun pertama kali dibuka). */
const DEFAULT_EXPENSE_CATEGORIES: Array<{
  name: string;
  icon: string;
  color: string;
  subs?: string[];
}> = [
  {
    name: "Makan & Minum",
    icon: "utensils",
    color: "#10B981",
    subs: ["Makan di luar", "Bahan masakan", "Kopi & snack"],
  },
  {
    name: "Transportasi",
    icon: "car",
    color: "#059669",
    subs: ["Bensin", "Ojek online", "Parkir & tol"],
  },
  { name: "Belanja", icon: "shopping-bag", color: "#34D399" },
  {
    name: "Tagihan",
    icon: "receipt",
    color: "#0D9488",
    subs: ["Listrik", "Internet", "Air"],
  },
  { name: "Hiburan", icon: "gamepad-2", color: "#22C55E" },
  { name: "Kesehatan", icon: "heart-pulse", color: "#14B8A6" },
  { name: "Pendidikan", icon: "graduation-cap", color: "#84CC16" },
  { name: "Tempat Tinggal", icon: "house", color: "#15803D" },
  { name: "Lainnya", icon: "circle-ellipsis", color: "#64748B" },
];

const DEFAULT_INCOME_CATEGORIES: Array<{ name: string; icon: string }> = [
  { name: "Gaji", icon: "wallet" },
  { name: "Bonus", icon: "gift" },
  { name: "Freelance", icon: "laptop" },
  { name: "Penjualan", icon: "store" },
  { name: "Investasi", icon: "trending-up" },
  { name: "Hadiah", icon: "party-popper" },
  { name: "Lainnya", icon: "circle-ellipsis" },
];

export const me = query({
  args: {},
  handler: async ctx => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const user = await ctx.db.get(userId);
    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_user", q => q.eq("userId", userId))
      .unique();
    return {
      userId,
      email: user?.email ?? "",
      name: profile?.fullName ?? user?.name ?? "Pengguna",
      phone: profile?.phone,
      defaultCurrency: profile?.defaultCurrency ?? "IDR",
      timezone: profile?.timezone ?? "Asia/Jakarta",
      idleTimeoutMinutes: profile?.idleTimeoutMinutes ?? 15,
      hasProfile: profile !== null,
    };
  },
});

/** Buat profil + seed kategori & dompet default kalau belum ada. */
export const bootstrap = mutation({
  args: {},
  returns: v.object({ created: v.boolean() }),
  handler: async ctx => {
    const userId = await requireUserId(ctx);
    const existing = await ctx.db
      .query("profiles")
      .withIndex("by_user", q => q.eq("userId", userId))
      .unique();
    if (existing) return { created: false };

    const user = await ctx.db.get(userId);
    await ctx.db.insert("profiles", {
      userId,
      fullName: user?.name ?? user?.email?.split("@")[0] ?? "Pengguna",
      defaultCurrency: "IDR",
      timezone: "Asia/Jakarta",
      idleTimeoutMinutes: 15,
      seededAt: Date.now(),
    });

    for (const cat of DEFAULT_EXPENSE_CATEGORIES) {
      const parentId = await ctx.db.insert("categories", {
        userId,
        name: cat.name,
        icon: cat.icon,
        color: cat.color,
        kind: "expense",
        isDefault: true,
        isArchived: false,
      });
      for (const sub of cat.subs ?? []) {
        await ctx.db.insert("categories", {
          userId,
          name: sub,
          icon: cat.icon,
          color: cat.color,
          kind: "expense",
          parentId,
          isDefault: true,
          isArchived: false,
        });
      }
    }
    for (const cat of DEFAULT_INCOME_CATEGORIES) {
      await ctx.db.insert("categories", {
        userId,
        name: cat.name,
        icon: cat.icon,
        color: "#0EA5E9",
        kind: "income",
        isDefault: true,
        isArchived: false,
      });
    }

    await ctx.db.insert("wallets", {
      userId,
      name: "Kas Tunai",
      type: "cash",
      initialBalance: 0,
      color: "#10B981",
      icon: "banknote",
      isArchived: false,
    });
    await ctx.db.insert("wallets", {
      userId,
      name: "Rekening Bank",
      type: "bank",
      initialBalance: 0,
      color: "#0D9488",
      icon: "landmark",
      isArchived: false,
    });

    // Terima undangan kolaborasi yang menunggu email ini.
    if (user?.email) {
      const invites = await ctx.db
        .query("collaborators")
        .withIndex("by_email", q =>
          q.eq("inviteEmail", user.email?.toLowerCase() ?? ""),
        )
        .collect();
      for (const inv of invites) {
        if (inv.status === "pending") {
          await ctx.db.patch(inv._id, {
            memberUserId: userId,
            status: "accepted",
            acceptedAt: Date.now(),
          });
        }
      }
    }

    await writeAudit(
      ctx,
      userId,
      "account_bootstrap",
      "Profil & data awal dibuat",
    );
    return { created: true };
  },
});

export const updateProfile = mutation({
  args: {
    fullName: v.optional(v.string()),
    phone: v.optional(v.string()),
    defaultCurrency: v.optional(v.string()),
    timezone: v.optional(v.string()),
    idleTimeoutMinutes: v.optional(v.number()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_user", q => q.eq("userId", userId))
      .unique();
    if (!profile) throw new Error("Profil belum ada");
    const patch: Record<string, unknown> = {};
    if (args.fullName !== undefined) patch.fullName = args.fullName.trim();
    if (args.phone !== undefined) patch.phone = args.phone.trim();
    if (args.defaultCurrency !== undefined)
      patch.defaultCurrency = args.defaultCurrency;
    if (args.timezone !== undefined) patch.timezone = args.timezone;
    if (args.idleTimeoutMinutes !== undefined)
      patch.idleTimeoutMinutes = Math.max(1, args.idleTimeoutMinutes);
    await ctx.db.patch(profile._id, patch);
    await writeAudit(
      ctx,
      userId,
      "profile_update",
      Object.keys(patch).join(","),
    );
    return null;
  },
});

/** Log audit keamanan (dipakai juga oleh idle-logout di frontend). */
export const logEvent = mutation({
  args: { event: v.string(), detail: v.optional(v.string()) },
  returns: v.null(),
  handler: async (ctx, { event, detail }) => {
    const userId = await requireUserId(ctx);
    await writeAudit(ctx, userId, event, detail);
    return null;
  },
});

export const auditLog = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit }) => {
    const userId = await requireUserId(ctx);
    const rows = await ctx.db
      .query("auditLogs")
      .withIndex("by_user", q => q.eq("userId", userId))
      .order("desc")
      .take(limit ?? 30);
    return rows.map(r => ({
      id: r._id,
      event: r.event,
      detail: r.detail,
      at: r._creationTime,
    }));
  },
});
