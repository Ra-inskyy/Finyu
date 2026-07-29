/**
 * Service worker Finyu.
 *
 * Tujuannya sederhana dan aman:
 * - App shell di-cache supaya aplikasi tetap kebuka walau internet mati
 *   (data transaksi tetap butuh koneksi karena tersimpan di server).
 * - Aset statis (JS/CSS/ikon) pakai strategi cache-first.
 * - Navigasi pakai network-first, kalau offline jatuh ke shell yang di-cache.
 * - Semua permintaan ke domain lain (Convex, Google OAuth, gateway WhatsApp)
 *   TIDAK PERNAH di-cache — biar data keuangan selalu segar dan auth aman.
 */

const VERSION = "finyu-v1";
const SHELL_CACHE = `${VERSION}-shell`;
const ASSET_CACHE = `${VERSION}-assets`;
const SHELL_URL = "/index.html";
const OFFLINE_FALLBACK = new Response(
  `<!doctype html><html lang="id"><head><meta charset="utf-8">
   <meta name="viewport" content="width=device-width,initial-scale=1">
   <title>Finyu — Offline</title></head>
   <body style="font-family:system-ui;padding:2rem;text-align:center;color:#065f46">
   <h1 style="color:#10b981">Finyu</h1>
   <p>Kamu sedang offline. Sambungkan internet lalu coba lagi.</p></body></html>`,
  { headers: { "Content-Type": "text/html; charset=utf-8" } },
);

self.addEventListener("install", event => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(SHELL_CACHE);
      await cache.addAll([SHELL_URL, "/manifest.webmanifest", "/icon-192.png"]);
      // Aktif segera setelah pengguna menyetujui pembaruan.
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(
        names
          .filter(name => !name.startsWith(VERSION))
          .map(name => caches.delete(name)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("message", event => {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
});

function isStaticAsset(url) {
  return (
    url.pathname.startsWith("/assets/") ||
    /\.(?:js|css|woff2?|png|jpe?g|svg|webp|ico|webmanifest)$/.test(url.pathname)
  );
}

self.addEventListener("fetch", event => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  // Domain lain (Convex, Google, dll) dibiarkan lewat tanpa campur tangan.
  if (url.origin !== self.location.origin) return;

  // Navigasi halaman: coba jaringan dulu, offline pakai shell dari cache.
  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          return await fetch(request);
        } catch {
          const cache = await caches.open(SHELL_CACHE);
          return (await cache.match(SHELL_URL)) || OFFLINE_FALLBACK.clone();
        }
      })(),
    );
    return;
  }

  if (!isStaticAsset(url)) return;

  // Aset statis: cache-first, lalu perbarui cache di belakang layar.
  event.respondWith(
    (async () => {
      const cache = await caches.open(ASSET_CACHE);
      const cached = await cache.match(request);
      if (cached) return cached;
      try {
        const response = await fetch(request);
        if (response.ok && response.type === "basic") {
          cache.put(request, response.clone());
        }
        return response;
      } catch (error) {
        if (cached) return cached;
        throw error;
      }
    })(),
  );
});
