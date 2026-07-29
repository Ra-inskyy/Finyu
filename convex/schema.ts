import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

/** Validator bersama supaya tidak ada duplikasi union yang tidak sinkron. */
export const txKind = v.union(
  v.literal("expense"),
  v.literal("income"),
  v.literal("transfer"),
);
export const categoryKind = v.union(v.literal("expense"), v.literal("income"));
export const walletType = v.union(
  v.literal("cash"),
  v.literal("bank"),
  v.literal("ewallet"),
  v.literal("other"),
);
export const savingsTxType = v.union(
  v.literal("deposit"),
  v.literal("withdrawal"),
  v.literal("auto_allocate"),
);
export const autoAllocateType = v.union(
  v.literal("none"),
  v.literal("percent"),
  v.literal("fixed"),
);
export const reminderFrequency = v.union(
  v.literal("none"),
  v.literal("daily"),
  v.literal("weekly"),
  v.literal("monthly"),
);
export const waStatus = v.union(
  v.literal("disconnected"),
  v.literal("pending_qr"),
  v.literal("connected"),
  v.literal("failed"),
);
export const waMode = v.union(v.literal("simulasi"), v.literal("gateway"));
export const scheduleType = v.union(
  v.literal("daily"),
  v.literal("weekly"),
  v.literal("monthly"),
);
export const collabRole = v.union(v.literal("viewer"), v.literal("editor"));
export const collabStatus = v.union(
  v.literal("pending"),
  v.literal("accepted"),
  v.literal("revoked"),
);
export const txSource = v.union(v.literal("web"), v.literal("whatsapp"));

const schema = defineSchema({
  ...authTables,

  /** Profil pengguna (nama, mata uang default, nomor WA, timezone). */
  profiles: defineTable({
    userId: v.id("users"),
    fullName: v.string(),
    phone: v.optional(v.string()),
    defaultCurrency: v.string(),
    timezone: v.string(),
    idleTimeoutMinutes: v.number(),
    seededAt: v.optional(v.number()),
  }).index("by_user", ["userId"]),

  /** Kategori & sub-kategori (parentId terisi = sub-kategori). */
  categories: defineTable({
    userId: v.id("users"),
    name: v.string(),
    icon: v.string(),
    color: v.string(),
    kind: categoryKind,
    parentId: v.optional(v.id("categories")),
    isDefault: v.boolean(),
    isArchived: v.boolean(),
  })
    .index("by_user_kind", ["userId", "kind"])
    .index("by_parent", ["parentId"])
    .index("by_user", ["userId"]),

  /** Dompet / rekening (kas, bank, e-wallet). */
  wallets: defineTable({
    userId: v.id("users"),
    name: v.string(),
    type: walletType,
    initialBalance: v.number(),
    color: v.string(),
    icon: v.string(),
    isArchived: v.boolean(),
  }).index("by_user", ["userId"]),

  /** Semua transaksi: pengeluaran, pemasukan, transfer antar dompet. */
  transactions: defineTable({
    userId: v.id("users"),
    kind: txKind,
    amount: v.number(),
    categoryId: v.optional(v.id("categories")),
    subCategoryId: v.optional(v.id("categories")),
    walletId: v.optional(v.id("wallets")),
    toWalletId: v.optional(v.id("wallets")),
    note: v.optional(v.string()),
    date: v.string(), // YYYY-MM-DD
    receipts: v.array(v.id("_storage")),
    source: txSource,
    createdBy: v.id("users"),
    deletedAt: v.optional(v.number()),
  })
    .index("by_user_date", ["userId", "date"])
    .index("by_user_kind_date", ["userId", "kind", "date"])
    .index("by_wallet", ["walletId"]),

  /** Target/goal tabungan. */
  savingsGoals: defineTable({
    userId: v.id("users"),
    name: v.string(),
    targetAmount: v.number(),
    currentAmount: v.number(),
    deadline: v.optional(v.string()),
    icon: v.string(),
    color: v.string(),
    description: v.optional(v.string()),
    autoAllocateType,
    autoAllocateValue: v.number(),
    autoAllocateActive: v.boolean(),
    reminderFrequency,
    reminderTime: v.optional(v.string()),
    reminderViaWa: v.boolean(),
    isArchived: v.boolean(),
    achievedAt: v.optional(v.number()),
  }).index("by_user", ["userId"]),

  /** Mutasi tabungan (setor / tarik / auto-alokasi). */
  savingsTransactions: defineTable({
    userId: v.id("users"),
    goalId: v.id("savingsGoals"),
    type: savingsTxType,
    amount: v.number(),
    source: v.optional(v.string()),
    note: v.optional(v.string()),
    date: v.string(),
  })
    .index("by_goal_date", ["goalId", "date"])
    .index("by_user_date", ["userId", "date"]),

  /** Anggaran bulanan per kategori. */
  budgets: defineTable({
    userId: v.id("users"),
    categoryId: v.id("categories"),
    month: v.string(), // YYYY-MM
    amount: v.number(),
    warn80SentAt: v.optional(v.number()),
    warn100SentAt: v.optional(v.number()),
  })
    .index("by_user_month", ["userId", "month"])
    .index("by_user", ["userId"]),

  /** Koneksi WhatsApp per pengguna. */
  waConnections: defineTable({
    userId: v.id("users"),
    phone: v.string(),
    sessionName: v.string(),
    status: waStatus,
    mode: waMode,
    qrPayload: v.optional(v.string()),
    qrIssuedAt: v.optional(v.number()),
    connectedAt: v.optional(v.number()),
    lastError: v.optional(v.string()),
    alertRealtime: v.boolean(),
    alertBudget: v.boolean(),
    alertGoal: v.boolean(),
    mutedCategoryIds: v.array(v.id("categories")),
  })
    .index("by_user", ["userId"])
    .index("by_phone", ["phone"]),

  /** Jadwal ringkasan yang dikirim ke WA. */
  waSchedules: defineTable({
    userId: v.id("users"),
    type: scheduleType,
    sendTime: v.string(), // HH:MM
    dayOfWeek: v.optional(v.number()), // 0=Minggu
    dayOfMonth: v.optional(v.number()),
    timezone: v.string(),
    isActive: v.boolean(),
    lastSentAt: v.optional(v.number()),
    lastSentKey: v.optional(v.string()),
  }).index("by_user", ["userId"]),

  /** Log pesan WA masuk & keluar (audit + rate limit). */
  waMessageLogs: defineTable({
    userId: v.id("users"),
    direction: v.union(v.literal("in"), v.literal("out")),
    phone: v.string(),
    message: v.string(),
    intent: v.optional(v.string()),
    status: v.string(),
    error: v.optional(v.string()),
  }).index("by_user", ["userId"]),

  /** Log aktivitas keamanan. */
  auditLogs: defineTable({
    userId: v.id("users"),
    event: v.string(),
    detail: v.optional(v.string()),
    userAgent: v.optional(v.string()),
  }).index("by_user", ["userId"]),

  /** Notifikasi in-app. */
  notifications: defineTable({
    userId: v.id("users"),
    title: v.string(),
    body: v.string(),
    kind: v.string(),
    readAt: v.optional(v.number()),
  }).index("by_user", ["userId"]),

  /** Kolaborasi: undangan anggota keluarga/kolega. */
  collaborators: defineTable({
    ownerId: v.id("users"),
    inviteEmail: v.string(),
    memberUserId: v.optional(v.id("users")),
    role: collabRole,
    status: collabStatus,
    invitedAt: v.number(),
    acceptedAt: v.optional(v.number()),
  })
    .index("by_owner", ["ownerId"])
    .index("by_email", ["inviteEmail"])
    .index("by_member", ["memberUserId"]),
});

export default schema;
