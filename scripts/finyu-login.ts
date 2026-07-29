import { runTest } from "./auth";

const APP_URL = process.env.APP_URL || "http://localhost:5173";

/**
 * Menguji halaman masuk dalam kondisi belum login (context browser baru,
 * tanpa cookie sesi): tombol "Masuk dengan Google" muncul/menghilang sesuai
 * konfigurasi server, tombol "Sign in with Viktor" sudah tidak ada, dan
 * klik Google benar-benar mengalihkan ke accounts.google.com.
 */
runTest("Finyu login page (Google OAuth)", async helper => {
  const context = await helper.browser.newContext();
  const page = await context.newPage();
  try {
    await page.goto(`${APP_URL}/login`, { waitUntil: "networkidle" });
    await page.waitForTimeout(2500);

    const viktorButton = page.getByRole("button", {
      name: /Sign in with Viktor/i,
    });
    if (await viktorButton.isVisible().catch(() => false)) {
      throw new Error(
        "Tombol 'Sign in with Viktor' masih ada di halaman masuk",
      );
    }

    const heading = await page
      .getByText(/Masuk ke Finyu/i)
      .first()
      .isVisible();
    if (!heading) throw new Error("Judul 'Masuk ke Finyu' tidak muncul");

    await page.screenshot({
      path: "tmp/finyu-login.png",
      fullPage: true,
    });

    const googleButton = page.getByRole("button", {
      name: /Masuk dengan Google/i,
    });
    const googleVisible = await googleButton.isVisible().catch(() => false);
    console.log(`Tombol Google terlihat: ${googleVisible}`);

    if (process.env.EXPECT_GOOGLE === "true") {
      if (!googleVisible) {
        throw new Error(
          "AUTH_GOOGLE_ID di-set tapi tombol 'Masuk dengan Google' tidak muncul",
        );
      }
      await googleButton.click();
      await page.waitForURL(/accounts\.google\.com/, { timeout: 20000 });
      console.log(`Redirect OAuth ke: ${new URL(page.url()).origin}`);
      console.log(`URL lengkap: ${page.url()}`);
      await page.screenshot({ path: "tmp/finyu-google-redirect.png" });
    } else if (googleVisible) {
      throw new Error(
        "Tombol Google muncul padahal kredensial Google belum di-set",
      );
    }

    console.log("✅ Halaman masuk sesuai harapan");
  } finally {
    await context.close();
  }
}).catch(error => {
  console.error("Gagal:", error instanceof Error ? error.stack : error);
  process.exit(1);
});
