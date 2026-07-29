/**
 * Parser perintah bot WhatsApp — rule based + keyword bahasa Indonesia
 * (tanpa LLM, supaya gratis & cepat sesuai catatan teknis PRD).
 */

export type WaIntent =
  | { intent: "saldo" }
  | {
      intent: "pengeluaran";
      period: "hari" | "minggu" | "bulan";
      date?: string;
    }
  | {
      intent: "catat";
      kind: "expense" | "income";
      amount: number;
      category: string;
      note: string;
    }
  | { intent: "bantuan" }
  | { intent: "putuskan" }
  | { intent: "unknown"; raw: string };

/** "50rb" → 50000, "1,5jt" → 1500000, "25.000" → 25000, "50k" → 50000 */
export function parseAmount(raw: string): number | null {
  const text = raw.trim().toLowerCase().replace(/\s+/g, "");
  const match = text.match(
    /^(?:rp\.?)?([0-9]+(?:[.,][0-9]+)?)(jt|juta|rb|ribu|k|m)?$/,
  );
  if (!match) return null;
  const numberPart = match[1]
    .replace(/\.(?=[0-9]{3}\b)/g, "")
    .replace(",", ".");
  let value = Number(numberPart);
  if (Number.isNaN(value)) return null;
  const unit = match[2];
  if (unit === "jt" || unit === "juta" || unit === "m") value *= 1_000_000;
  else if (unit === "rb" || unit === "ribu" || unit === "k") value *= 1_000;
  return Math.round(value);
}

const SALDO_WORDS = ["saldo", "tabungan", "duit", "uang saya", "sisa uang"];
const EXPENSE_WORDS = ["pengeluaran", "belanja", "keluar", "habis", "spend"];
const RECORD_WORDS = ["catat", "tambah", "input", "record"];
const INCOME_WORDS = ["masuk", "pemasukan", "terima", "gaji", "income"];

function detectPeriod(text: string): {
  period: "hari" | "minggu" | "bulan";
  date?: string;
} {
  const dateMatch = text.match(/(\d{4}-\d{2}-\d{2})/);
  if (dateMatch) return { period: "hari", date: dateMatch[1] };
  if (/minggu|pekan|week/.test(text)) return { period: "minggu" };
  if (/bulan|month/.test(text)) return { period: "bulan" };
  return { period: "hari" };
}

export function parseWaMessage(rawInput: string): WaIntent {
  const raw = rawInput.trim();
  const text = raw.toLowerCase();
  if (!text) return { intent: "unknown", raw };

  if (/^\/?(bantuan|help|menu)\b/.test(text)) return { intent: "bantuan" };
  if (/^\/?(putuskan|disconnect|stop)\b/.test(text))
    return { intent: "putuskan" };

  // /catat <nominal> <kategori> [catatan]  •  /pemasukan <nominal> <sumber> [catatan]
  const recordMatch = raw.match(
    /^\/?(catat|tambah|input|record|pemasukan|masuk|terima)\s+(.+)$/i,
  );
  if (recordMatch) {
    const command = recordMatch[1].toLowerCase();
    const rest = recordMatch[2].trim();
    const tokens = rest.split(/\s+/);
    // Nominal boleh di awal ("catat 50rb transport") atau di posisi kedua.
    let amount: number | null = null;
    let amountIndex = -1;
    for (let i = 0; i < Math.min(tokens.length, 3); i++) {
      const candidate = parseAmount(tokens[i]);
      if (candidate !== null) {
        amount = candidate;
        amountIndex = i;
        break;
      }
    }
    if (amount !== null) {
      const before = tokens.slice(0, amountIndex);
      const after = tokens.slice(amountIndex + 1);
      const words = [...before, ...after];
      const category = words[0] ?? "";
      const note = words.slice(1).join(" ");
      const kind =
        INCOME_WORDS.includes(command) ||
        command === "pemasukan" ||
        INCOME_WORDS.some(w => text.includes(`${w} `) && text.startsWith(w))
          ? "income"
          : "expense";
      return { intent: "catat", kind, amount, category, note };
    }
  }

  if (RECORD_WORDS.some(w => text.startsWith(w))) {
    // "catat" tanpa nominal yang bisa dibaca
    return { intent: "unknown", raw };
  }

  if (EXPENSE_WORDS.some(w => text.includes(w))) {
    const { period, date } = detectPeriod(text);
    return { intent: "pengeluaran", period, date };
  }

  if (SALDO_WORDS.some(w => text.includes(w))) return { intent: "saldo" };

  if (/^\/?saldo\b/.test(text)) return { intent: "saldo" };

  return { intent: "unknown", raw };
}

export const WA_HELP_TEXT = `🤖 *Bot Finyu* — perintah yang bisa dipakai:

• */saldo* — saldo tabungan, total pengeluaran bulan ini & sisa uang
• */pengeluaran hari* | *minggu* | *bulan* | *YYYY-MM-DD* — rekap pengeluaran
• */catat <nominal> <kategori> [catatan]* — contoh: \`/catat 25000 makan siang bareng klien\`
• */pemasukan <nominal> <sumber> [catatan]* — contoh: \`/pemasukan 5jt gaji Juli\`
• */bantuan* — tampilkan menu ini
• */putuskan* — putuskan koneksi WhatsApp

Bahasa santai juga bisa: _"berapa pengeluaran minggu ini"_, _"catat 50rb transport ojol"_, _"cek saldo tabungan"_.`;
