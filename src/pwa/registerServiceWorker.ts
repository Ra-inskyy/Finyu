import { toast } from "sonner";

/**
 * Mendaftarkan service worker Finyu supaya aplikasi bisa dipasang (PWA) dan
 * tetap kebuka saat offline. Dijalankan hanya pada build produksi/preview —
 * di mode `vite dev` service worker cuma bikin cache yang membingungkan.
 */
export function registerServiceWorker(): void {
  if (!import.meta.env.PROD) return;
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

  window.addEventListener("load", () => {
    void navigator.serviceWorker
      .register("/sw.js")
      .then(registration => {
        // Kalau ada versi baru, tawarkan muat ulang ketimbang memaksa reload.
        registration.addEventListener("updatefound", () => {
          const installing = registration.installing;
          if (!installing) return;
          installing.addEventListener("statechange", () => {
            if (
              installing.state === "installed" &&
              navigator.serviceWorker.controller
            ) {
              toast("Versi baru Finyu tersedia", {
                description: "Muat ulang untuk memakai versi terbaru.",
                action: {
                  label: "Muat ulang",
                  onClick: () => {
                    installing.postMessage("SKIP_WAITING");
                    window.location.reload();
                  },
                },
                duration: 15000,
              });
            }
          });
        });
      })
      .catch(error => {
        console.warn("Service worker gagal didaftarkan:", error);
      });
  });
}

/** True kalau aplikasi sedang dibuka sebagai aplikasi terpasang, bukan tab browser. */
export function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    // iOS Safari memakai properti non-standar ini.
    (window.navigator as { standalone?: boolean }).standalone === true
  );
}

/** True untuk iPhone/iPad, yang pemasangannya manual lewat menu Bagikan. */
export function isIos(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  return (
    /iPad|iPhone|iPod/.test(ua) ||
    // iPadOS 13+ menyamar sebagai Mac, dibedakan dari layar sentuhnya.
    (/Macintosh/.test(ua) && "ontouchend" in document)
  );
}
