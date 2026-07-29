import { getAuthUserId } from "@convex-dev/auth/server";
import type { Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";

/** Ambil userId yang sedang login, error kalau belum login. */
export async function requireUserId(ctx: QueryCtx | MutationCtx) {
  const userId = await getAuthUserId(ctx);
  if (!userId) throw new Error("Belum login");
  return userId;
}

/**
 * Menentukan "pemilik data" yang sedang dibuka. Kalau `ownerId` dikirim dan
 * berbeda dengan user yang login, maka user harus punya undangan kolaborasi
 * yang sudah diterima. Mengembalikan pemilik data + hak edit.
 */
export async function resolveScope(
  ctx: QueryCtx | MutationCtx,
  ownerId?: Id<"users">,
): Promise<{ ownerId: Id<"users">; canEdit: boolean; isOwner: boolean }> {
  const userId = await requireUserId(ctx);
  if (!ownerId || ownerId === userId) {
    return { ownerId: userId, canEdit: true, isOwner: true };
  }
  const share = await ctx.db
    .query("collaborators")
    .withIndex("by_member", q => q.eq("memberUserId", userId))
    .collect();
  const match = share.find(
    s => s.ownerId === ownerId && s.status === "accepted",
  );
  if (!match) throw new Error("Tidak punya akses ke data ini");
  return { ownerId, canEdit: match.role === "editor", isOwner: false };
}

export async function requireEditScope(
  ctx: MutationCtx,
  ownerId?: Id<"users">,
) {
  const scope = await resolveScope(ctx, ownerId);
  if (!scope.canEdit) throw new Error("Akses kamu hanya bisa melihat data");
  return scope;
}

/** Catat aktivitas untuk audit keamanan. */
export async function writeAudit(
  ctx: MutationCtx,
  userId: Id<"users">,
  event: string,
  detail?: string,
) {
  await ctx.db.insert("auditLogs", { userId, event, detail });
}

export async function notify(
  ctx: MutationCtx,
  userId: Id<"users">,
  title: string,
  body: string,
  kind: string,
) {
  await ctx.db.insert("notifications", { userId, title, body, kind });
}

// ── Utilitas tanggal (semua tanggal transaksi disimpan sebagai YYYY-MM-DD) ──

export function todayInTz(timezone = "Asia/Jakarta"): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: timezone });
}

export function nowPartsInTz(timezone = "Asia/Jakarta") {
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour12: false,
  });
  const parts: Record<string, string> = {};
  for (const p of fmt.formatToParts(new Date())) parts[p.type] = p.value;
  const weekdayMap: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    time: `${parts.hour}:${parts.minute}`,
    dayOfWeek: weekdayMap[parts.weekday ?? "Sun"] ?? 0,
    dayOfMonth: Number(parts.day),
  };
}

export function monthOf(date: string): string {
  return date.slice(0, 7);
}

export function monthBounds(month: string) {
  const [y, m] = month.split("-").map(Number);
  const start = `${month}-01`;
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const end = `${month}-${String(lastDay).padStart(2, "0")}`;
  return { start, end };
}

export function addMonths(month: string, delta: number) {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function addDays(date: string, delta: number) {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

export function daysBetween(from: string, to: string) {
  const a = new Date(`${from}T00:00:00Z`).getTime();
  const b = new Date(`${to}T00:00:00Z`).getTime();
  return Math.round((b - a) / 86400000);
}

/** Format Rupiah untuk pesan WhatsApp & teks server. */
export function formatMoney(amount: number, currency = "IDR") {
  try {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `Rp ${Math.round(amount).toLocaleString("id-ID")}`;
  }
}

export function formatDateId(date: string) {
  try {
    return new Date(`${date}T00:00:00Z`).toLocaleDateString("id-ID", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    });
  } catch {
    return date;
  }
}

/** Normalisasi nomor HP Indonesia ke format 62xxxxxxxxxx. */
export function normalizePhone(input: string) {
  const digits = input.replace(/[^0-9]/g, "");
  if (digits.startsWith("62")) return digits;
  if (digits.startsWith("0")) return `62${digits.slice(1)}`;
  if (digits.startsWith("8")) return `62${digits}`;
  return digits;
}

export function isValidIdPhone(input: string) {
  const p = normalizePhone(input);
  return /^62[0-9]{8,13}$/.test(p);
}
