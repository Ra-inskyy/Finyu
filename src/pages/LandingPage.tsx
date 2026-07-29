import { useConvexAuth } from "convex/react";
import {
  ArrowRight,
  Check,
  LineChart,
  MessageCircle,
  PiggyBank,
  Receipt,
  ShieldCheck,
  Sparkles,
  Users,
  Wallet,
} from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

const FEATURES = [
  {
    icon: Receipt,
    title: "Catat pengeluaran < 15 detik",
    body: "Kategori & sub-kategori, lampiran foto struk, filter tanggal, dan riwayat lengkap yang bisa diedit atau dipulihkan.",
  },
  {
    icon: PiggyBank,
    title: "Tabungan dengan target",
    body: "Banyak goal sekaligus, progres visual, estimasi pencapaian, dan auto-alokasi dari sisa uang bulanan.",
  },
  {
    icon: MessageCircle,
    title: "Streaming ke bot WhatsApp",
    body: "Alert real-time tiap transaksi, ringkasan harian/mingguan/bulanan terjadwal, plus perintah /saldo dan /catat lewat chat.",
  },
  {
    icon: LineChart,
    title: "Dashboard real-time",
    body: "Chart kategori, tren harian–bulanan, heatmap kalender 365 hari, dan perbandingan anggaran vs realisasi.",
  },
  {
    icon: Wallet,
    title: "Multi-dompet",
    body: "Kas, rekening bank, e-wallet, transfer antar dompet, dan saldo yang selalu terhitung otomatis.",
  },
  {
    icon: Users,
    title: "Kolaborasi keluarga & UMKM",
    body: "Undang pasangan atau kolega dengan hak akses lihat saja atau bisa edit.",
  },
];

function LandingPageView({
  isAuthenticated,
  isLoading,
  showAuthActions,
}: {
  isAuthenticated: boolean;
  isLoading: boolean;
  showAuthActions: boolean;
}) {
  return (
    <div className="flex-1">
      <section className="relative overflow-hidden border-b bg-gradient-to-b from-emerald-50 via-background to-background dark:from-emerald-950/30">
        <div className="container grid gap-10 py-16 md:grid-cols-2 md:py-24">
          <div className="space-y-6">
            <span className="inline-flex items-center gap-2 rounded-full border bg-background px-3 py-1 text-xs font-medium">
              <Sparkles className="size-3 text-emerald-500" />
              Catatan keuangan + bot WhatsApp
            </span>
            <h1 className="text-4xl font-bold leading-[1.1] tracking-tight sm:text-5xl">
              Uangmu terpantau,
              <br />
              <span className="text-emerald-600">tanpa ribet.</span>
            </h1>
            <p className="max-w-lg text-base leading-relaxed text-muted-foreground md:text-lg">
              Finyu mencatat pengeluaran & pemasukan, mengelola target tabungan,
              dan mengirim notifikasi serta ringkasan keuangan langsung ke
              WhatsApp kamu. Cocok untuk pribadi, keluarga, maupun UMKM.
            </p>
            <div className="flex flex-col gap-3 sm:flex-row">
              {!isLoading && isAuthenticated ? (
                <Button size="lg" className="h-11 px-6 text-base" asChild>
                  <Link to="/dashboard">
                    Buka Dashboard
                    <ArrowRight className="size-4" />
                  </Link>
                </Button>
              ) : (
                <>
                  <Button size="lg" className="h-11 px-6 text-base" asChild>
                    <Link to="/signup">
                      Mulai gratis
                      <ArrowRight className="size-4" />
                    </Link>
                  </Button>
                  <Button
                    size="lg"
                    variant="outline"
                    className="h-11 px-6 text-base"
                    asChild
                  >
                    <Link to="/login">Masuk</Link>
                  </Button>
                </>
              )}
            </div>
            <div className="flex flex-wrap gap-x-6 gap-y-2 pt-2 text-sm text-muted-foreground">
              {[
                "Input cepat & rapi",
                "Notifikasi WhatsApp",
                "Laporan siap ekspor",
              ].map(item => (
                <span key={item} className="flex items-center gap-1.5">
                  <Check className="size-4 text-emerald-500" />
                  {item}
                </span>
              ))}
            </div>
          </div>

          <div className="relative">
            <div className="rounded-2xl border bg-card p-5 shadow-xl">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    Pengeluaran bulan ini
                  </p>
                  <p className="text-3xl font-semibold tabular-nums">
                    Rp 4.250.000
                  </p>
                </div>
                <span className="rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-600">
                  −12% vs bulan lalu
                </span>
              </div>
              <div className="space-y-2.5">
                {[
                  ["Makan & Minum", 38, "#10b981"],
                  ["Transportasi", 24, "#0d9488"],
                  ["Tagihan", 18, "#34d399"],
                  ["Belanja", 12, "#84cc16"],
                ].map(([label, percent, color]) => (
                  <div key={label as string} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span>{label}</span>
                      <span className="text-muted-foreground">{percent}%</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${percent}%`,
                          backgroundColor: color as string,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-5 rounded-xl bg-[#e7f5ec] p-3 dark:bg-muted/40">
                <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wide text-emerald-700">
                  Bot WhatsApp
                </p>
                <div className="ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-sm bg-emerald-500 px-3 py-1.5 text-xs text-white">
                  /catat 25000 makan siang bareng klien
                </div>
                <div className="mt-1.5 w-fit max-w-[90%] whitespace-pre-line rounded-2xl rounded-bl-sm bg-white px-3 py-1.5 text-xs shadow-sm dark:bg-card">
                  {
                    "✅ Pengeluaran dicatat!\nNominal: Rp 25.000\nKategori: Makan & Minum\nTotal bulan ini: Rp 4.250.000"
                  }
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-b bg-muted/20 py-16 md:py-24">
        <div className="container">
          <div className="mb-12 text-center">
            <p className="mb-2 text-sm font-medium uppercase tracking-wide text-muted-foreground">
              Fitur
            </p>
            <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
              Semua yang dibutuhkan untuk disiplin keuangan
            </h2>
          </div>
          <div className="mx-auto grid max-w-5xl gap-4 md:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map(feature => (
              <div
                key={feature.title}
                className="group rounded-2xl border bg-card p-6 transition hover:border-emerald-500/40 hover:shadow-md"
              >
                <span className="mb-4 inline-flex size-11 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600">
                  <feature.icon className="size-5" />
                </span>
                <h3 className="mb-1.5 font-semibold">{feature.title}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {feature.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16 md:py-20">
        <div className="container grid gap-6 md:grid-cols-3">
          {[
            {
              icon: ShieldCheck,
              title: "Data terlindungi",
              body: "Setiap akun hanya bisa mengakses datanya sendiri, dengan auto logout saat idle dan log aktivitas.",
            },
            {
              icon: LineChart,
              title: "Laporan siap pakai",
              body: "Filter periode & kategori, lalu ekspor ke CSV/Excel atau cetak PDF dalam sekali klik.",
            },
            {
              icon: MessageCircle,
              title: "Bot yang paham bahasa santai",
              body: '"berapa pengeluaran minggu ini", "catat 50rb transport ojol" — semua dimengerti.',
            },
          ].map(item => (
            <div key={item.title} className="flex gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600">
                <item.icon className="size-5" />
              </span>
              <div>
                <h3 className="font-semibold">{item.title}</h3>
                <p className="text-sm text-muted-foreground">{item.body}</p>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

export function LandingPage() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  return (
    <LandingPageView
      isAuthenticated={isAuthenticated}
      isLoading={isLoading}
      showAuthActions
    />
  );
}
