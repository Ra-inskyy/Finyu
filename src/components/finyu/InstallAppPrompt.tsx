import { Download, Share, Smartphone, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { isIos, isStandalone } from "@/pwa/registerServiceWorker";

/** Event `beforeinstallprompt` belum ada di tipe bawaan TypeScript. */
type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const DISMISS_KEY = "finyu.installPromptDismissedAt";
const DISMISS_DAYS = 14;

function recentlyDismissed(): boolean {
  const raw = localStorage.getItem(DISMISS_KEY);
  if (!raw) return false;
  const at = Number(raw);
  if (!Number.isFinite(at)) return false;
  return Date.now() - at < DISMISS_DAYS * 24 * 60 * 60 * 1000;
}

/**
 * Banner "Pasang aplikasi Finyu" di bawah layar.
 *
 * Android/Chrome/Edge: pakai event `beforeinstallprompt` supaya satu klik
 * langsung memasang. iOS Safari tidak punya event itu, jadi kita tampilkan
 * instruksi Bagikan → Tambahkan ke Layar Utama. Banner disembunyikan kalau
 * aplikasi sudah terpasang atau baru saja ditutup pengguna.
 */
export function InstallAppPrompt() {
  const [installEvent, setInstallEvent] = useState<InstallPromptEvent | null>(
    null,
  );
  const [showIosHint, setShowIosHint] = useState(false);
  const [hidden, setHidden] = useState(true);

  useEffect(() => {
    if (isStandalone() || recentlyDismissed()) return;

    const onPrompt = (event: Event) => {
      event.preventDefault();
      setInstallEvent(event as InstallPromptEvent);
      setHidden(false);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);

    const onInstalled = () => setHidden(true);
    window.addEventListener("appinstalled", onInstalled);

    // iOS tidak mengirim beforeinstallprompt — tunggu sebentar lalu tawarkan
    // instruksi manual supaya tidak mengganggu saat halaman baru dibuka.
    let timer: ReturnType<typeof setTimeout> | undefined;
    if (isIos()) {
      timer = setTimeout(() => {
        setShowIosHint(true);
        setHidden(false);
      }, 4000);
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
      if (timer) clearTimeout(timer);
    };
  }, []);

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
    setHidden(true);
  };

  const install = async () => {
    if (!installEvent) return;
    await installEvent.prompt();
    const { outcome } = await installEvent.userChoice;
    if (outcome === "accepted") setHidden(true);
    else dismiss();
    setInstallEvent(null);
  };

  if (hidden || (!installEvent && !showIosHint)) return null;

  return (
    <div className="fixed inset-x-3 bottom-3 z-50 mx-auto max-w-md rounded-xl border bg-card p-4 shadow-lg pb-[max(1rem,env(safe-area-inset-bottom))]">
      <div className="flex items-start gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600">
          <Smartphone className="size-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-medium">Pasang Finyu sebagai aplikasi</p>
          {showIosHint && !installEvent ? (
            <p className="mt-1 flex flex-wrap items-center gap-1 text-sm text-muted-foreground">
              Ketuk <Share className="inline size-4" /> Bagikan, lalu pilih
              <span className="font-medium">Tambahkan ke Layar Utama</span>.
            </p>
          ) : (
            <p className="mt-1 text-sm text-muted-foreground">
              Buka langsung dari layar utama, layar penuh tanpa address bar.
            </p>
          )}
          {installEvent && (
            <Button size="sm" className="mt-3" onClick={() => void install()}>
              <Download className="mr-1 size-4" />
              Pasang sekarang
            </Button>
          )}
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="size-8 shrink-0"
          aria-label="Tutup"
          onClick={dismiss}
        >
          <X className="size-4" />
        </Button>
      </div>
    </div>
  );
}
