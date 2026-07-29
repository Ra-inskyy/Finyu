import { runTest } from "./auth";

/**
 * Memastikan lapisan PWA benar-benar aktif: manifest terpasang & valid,
 * service worker terdaftar, ikon bisa diakses, dan app shell tetap tampil
 * saat browser dibuat offline.
 */
runTest("Finyu PWA", async helper => {
  const { page } = helper;
  await page.setViewportSize({ width: 390, height: 844 });
  await helper.goto("/dashboard");
  await page.waitForTimeout(1500);

  // 1. Manifest terpasang dan isinya valid
  const manifestHref = await page
    .locator("link[rel=manifest]")
    .getAttribute("href");
  if (manifestHref !== "/manifest.webmanifest") {
    throw new Error(`link manifest tidak ditemukan: ${manifestHref}`);
  }
  const manifest = await page.evaluate(async () => {
    const res = await fetch("/manifest.webmanifest");
    return { status: res.status, body: await res.json() };
  });
  if (manifest.status !== 200) {
    throw new Error(`manifest status ${manifest.status}`);
  }
  const required = ["name", "short_name", "start_url", "display", "icons"];
  for (const key of required) {
    if (!(key in manifest.body)) throw new Error(`manifest tanpa ${key}`);
  }
  if (manifest.body.display !== "standalone") {
    throw new Error(`display harus standalone, dapat ${manifest.body.display}`);
  }
  const sizes = (manifest.body.icons as Array<{ sizes: string }>).map(
    icon => icon.sizes,
  );
  for (const size of ["192x192", "512x512"]) {
    if (!sizes.includes(size)) throw new Error(`ikon ${size} tidak ada`);
  }
  const maskable = (manifest.body.icons as Array<{ purpose?: string }>).some(
    icon => icon.purpose === "maskable",
  );
  if (!maskable) throw new Error("ikon maskable tidak ada");
  console.log(`Manifest OK — ikon: ${sizes.join(", ")}, maskable: ya`);

  // 2. Ikon benar-benar bisa diambil
  for (const icon of (manifest.body.icons as Array<{ src: string }>).map(
    i => i.src,
  )) {
    const status = await page.evaluate(
      async src => (await fetch(src)).status,
      icon,
    );
    if (status !== 200) throw new Error(`${icon} status ${status}`);
  }
  const appleStatus = await page.evaluate(
    async () => (await fetch("/apple-touch-icon.png")).status,
  );
  if (appleStatus !== 200) throw new Error("apple-touch-icon tidak ada");
  console.log("Semua ikon dapat diakses");

  // 3. Service worker terdaftar dan mengendalikan halaman
  const swActive = await page.evaluate(async () => {
    if (!("serviceWorker" in navigator)) return "tidak didukung";
    const registration = await navigator.serviceWorker.ready;
    return registration.active?.scriptURL ?? "tidak aktif";
  });
  if (!swActive.endsWith("/sw.js")) {
    throw new Error(`service worker tidak aktif: ${swActive}`);
  }
  console.log(`Service worker aktif: ${new URL(swActive).pathname}`);

  // 4. Meta khusus mode aplikasi
  const themeColor = await page
    .locator('meta[name="theme-color"]')
    .getAttribute("content");
  if (themeColor?.toLowerCase() !== "#10b981") {
    throw new Error(`theme-color salah: ${themeColor}`);
  }

  // 5. App shell tetap tampil saat offline (data butuh koneksi, cangkang tidak)
  await page.context().setOffline(true);
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1200);
  const html = await page.content();
  await page.screenshot({ path: "tmp/finyu-offline.png" });
  await page.context().setOffline(false);
  if (!/Finyu/i.test(html)) {
    throw new Error("halaman offline tidak menampilkan app shell Finyu");
  }
  console.log("App shell tetap tampil saat offline");

  console.log("✅ Lapisan PWA siap dipasang di HP");
}).catch(error => {
  console.error("Gagal:", error instanceof Error ? error.stack : error);
  process.exit(1);
});
