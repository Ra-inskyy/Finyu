/** Helper format angka & tanggal untuk seluruh app (locale Indonesia). */

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

export function formatMoneyShort(amount: number) {
  const abs = Math.abs(amount);
  if (abs >= 1_000_000_000) return `${(amount / 1_000_000_000).toFixed(1)} M`;
  if (abs >= 1_000_000) return `${(amount / 1_000_000).toFixed(1)} jt`;
  if (abs >= 1_000) return `${Math.round(amount / 1_000)} rb`;
  return String(Math.round(amount));
}

export function formatNumber(value: number) {
  return new Intl.NumberFormat("id-ID").format(value);
}

/** "1.250.000" → 1250000 */
export function parseMoneyInput(input: string) {
  const digits = input.replace(/[^0-9]/g, "");
  return digits ? Number(digits) : 0;
}

/** 1250000 → "1.250.000" */
export function formatMoneyInput(value: number | string) {
  const num = typeof value === "string" ? parseMoneyInput(value) : value;
  if (!num) return "";
  return new Intl.NumberFormat("id-ID").format(num);
}

export function todayISO(timezone = "Asia/Jakarta") {
  return new Date().toLocaleDateString("en-CA", { timeZone: timezone });
}

export function monthISO(date = todayISO()) {
  return date.slice(0, 7);
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

export function monthStart(month: string) {
  return `${month}-01`;
}

export function monthEnd(month: string) {
  const [y, m] = month.split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return `${month}-${String(last).padStart(2, "0")}`;
}

const MONTH_NAMES = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
];

export function monthLabel(month: string) {
  const [y, m] = month.split("-").map(Number);
  return `${MONTH_NAMES[m - 1]} ${y}`;
}

export function formatDateLong(date: string) {
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

export function formatDateShort(date: string) {
  try {
    return new Date(`${date}T00:00:00Z`).toLocaleDateString("id-ID", {
      day: "numeric",
      month: "short",
      year: "numeric",
      timeZone: "UTC",
    });
  } catch {
    return date;
  }
}

export function formatDateTime(ms: number) {
  return new Date(ms).toLocaleString("id-ID", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Jakarta",
  });
}

export function relativeTime(ms: number) {
  const diff = Date.now() - ms;
  const minutes = Math.round(diff / 60000);
  if (minutes < 1) return "baru saja";
  if (minutes < 60) return `${minutes} menit lalu`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} jam lalu`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days} hari lalu`;
  return formatDateTime(ms);
}

export const WALLET_TYPE_LABEL: Record<string, string> = {
  cash: "Kas tunai",
  bank: "Rekening bank",
  ewallet: "E-wallet",
  other: "Lainnya",
};

export const CURRENCIES = ["IDR", "USD", "EUR", "SGD", "MYR"];

/** Kompres & resize gambar di client sebelum upload (max 1080px lebar). */
export async function compressImage(
  file: File,
  maxWidth = 1080,
): Promise<Blob> {
  if (!file.type.startsWith("image/")) return file;
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxWidth / bitmap.width);
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return file;
  ctx.drawImage(bitmap, 0, 0, width, height);
  return await new Promise<Blob>(resolve => {
    canvas.toBlob(
      blob => resolve(blob ?? file),
      file.type === "image/png" ? "image/png" : "image/jpeg",
      0.82,
    );
  });
}
