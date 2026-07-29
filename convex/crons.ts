import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Kirim ringkasan terjadwal ke WhatsApp (cek setiap 5 menit, presisi jam user).
crons.interval(
  "kirim ringkasan wa terjadwal",
  { minutes: 5 },
  internal.whatsapp.dispatchSchedules,
  {},
);

// Pengingat menabung + peringatan H-7 deadline goal.
crons.interval(
  "pengingat tabungan",
  { minutes: 30 },
  internal.whatsapp.dispatchSavingsReminders,
  {},
);

// Auto-alokasi sisa uang bulan lalu ke goal aktif, tiap tanggal 1.
// 00:10 UTC = 07:10 WIB tanggal 1 (masih tanggal 1 di zona Asia/Jakarta).
crons.cron(
  "auto-alokasi tabungan bulanan",
  "10 0 1 * *",
  internal.savings.runAutoAllocationForAll,
  {},
);

export default crons;
