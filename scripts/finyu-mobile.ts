import { runTest } from "./auth";

/** Memeriksa tampilan Finyu di ukuran layar HP (390x844, seperti iPhone 14). */
runTest("Finyu tampilan mobile", async helper => {
  const { page } = helper;
  await page.setViewportSize({ width: 390, height: 844 });

  const routes: Array<[string, string]> = [
    ["/dashboard", "mobile-dashboard"],
    ["/pengeluaran", "mobile-pengeluaran"],
    ["/tabungan", "mobile-tabungan"],
  ];

  for (const [route, name] of routes) {
    await helper.goto(route);
    await page.waitForTimeout(2000);
    await page.screenshot({ path: `tmp/${name}.png` });
    // Deteksi overflow horizontal (tanda layout jebol di HP)
    const overflow = await page.evaluate(() => {
      const el = document.documentElement;
      return { scrollW: el.scrollWidth, clientW: el.clientWidth };
    });
    console.log(
      `${route}: scrollWidth=${overflow.scrollW} clientWidth=${overflow.clientW}`,
    );
    if (overflow.scrollW > overflow.clientW + 2) {
      console.log(`⚠️  ${route} melebar melebihi layar HP`);
    }
  }
  console.log("✅ Selesai cek mobile");
}).catch(error => {
  console.error("Gagal:", error instanceof Error ? error.stack : error);
  process.exit(1);
});
