import { runTest } from "./auth";

/**
 * Smoke test end-to-end: catat pengeluaran → cek dashboard → buat goal tabungan →
 * setor → set anggaran → coba bot WhatsApp (simulator) → cek laporan.
 */
runTest("Finyu smoke test", async helper => {
  const { page } = helper;

  await helper.goto("/dashboard");
  await page.waitForTimeout(3500);
  await helper.screenshot("finyu-dashboard-awal.png");

  // ── 1. Catat pengeluaran ──
  await helper.goto("/pengeluaran");
  await page.waitForTimeout(2000);
  await page
    .getByRole("button", { name: /Tambah pengeluaran/i })
    .first()
    .click();
  await page.waitForTimeout(1200);
  await page.locator("#amount").fill("125000");
  await page.getByRole("combobox").first().click();
  await page.waitForTimeout(700);
  await page.getByRole("option").first().click();
  await page.waitForTimeout(400);
  await page.locator("#note").fill("Makan siang bareng klien (test)");
  await page.getByRole("button", { name: "Simpan", exact: true }).click();
  await page.waitForTimeout(2500);
  const hasTx = await page
    .getByText("Makan siang bareng klien (test)")
    .first()
    .isVisible();
  if (!hasTx)
    throw new Error("Transaksi baru tidak muncul di daftar pengeluaran");
  await helper.screenshot("finyu-pengeluaran.png");

  // ── 2. Goal tabungan ──
  await helper.goto("/tabungan");
  await page.waitForTimeout(2000);
  await page
    .getByRole("button", { name: /Buat goal/i })
    .first()
    .click();
  await page.waitForTimeout(1200);
  await page.locator("#goal-name").fill(`Dana Darurat ${Date.now() % 10000}`);
  const moneyInputs = page.locator("input[inputmode='numeric']");
  await moneyInputs.nth(0).fill("10000000");
  await moneyInputs.nth(1).fill("2500000");
  await page.getByRole("button", { name: /Simpan goal/i }).click();
  await page.waitForTimeout(3000);
  const hasGoal = await page.getByText("Dana Darurat").first().isVisible();
  if (!hasGoal) throw new Error("Goal tabungan tidak muncul");
  await helper.screenshot("finyu-tabungan.png");

  // ── 3. Anggaran ──
  await helper.goto("/anggaran");
  await page.waitForTimeout(2000);
  await page
    .getByRole("button", { name: /Tetapkan anggaran/i })
    .first()
    .click();
  await page.waitForTimeout(1200);
  await page.getByRole("combobox").last().click();
  await page.waitForTimeout(700);
  await page.getByRole("option").first().click();
  await page.waitForTimeout(400);
  await page.locator("input[inputmode='numeric']").last().fill("2000000");
  await page.getByRole("button", { name: "Simpan", exact: true }).click();
  await page.waitForTimeout(2500);
  await helper.screenshot("finyu-anggaran.png");

  // ── 4. Bot WhatsApp (mode simulasi) ──
  await helper.goto("/whatsapp");
  await page.waitForTimeout(2000);
  const phoneInput = page.locator("#wa-phone");
  if (await phoneInput.isVisible()) {
    await phoneInput.fill("081234567890");
    await page.getByRole("button", { name: /Hubungkan WhatsApp/i }).click();
    await page.waitForTimeout(2500);
    const scanned = page.getByRole("button", { name: /Saya sudah scan/i });
    if (await scanned.isVisible()) {
      await scanned.click();
      await page.waitForTimeout(2000);
    }
  }
  await helper.screenshot("finyu-wa-koneksi.png");

  await page
    .getByPlaceholder(/Tulis pesan seperti di WhatsApp/i)
    .fill("/saldo");
  await page.keyboard.press("Enter");
  await page.waitForTimeout(3000);
  const hasReply = await page
    .getByText(/Saldo & Ringkasan Finyu/i)
    .first()
    .isVisible();
  if (!hasReply) throw new Error("Bot tidak menjawab perintah /saldo");

  await page
    .getByPlaceholder(/Tulis pesan seperti di WhatsApp/i)
    .fill("catat 50rb transport ojol");
  await page.keyboard.press("Enter");
  await page.waitForTimeout(3000);
  const recorded = await page
    .getByText(/Pengeluaran dicatat/i)
    .first()
    .isVisible();
  if (!recorded) throw new Error("Bot gagal mencatat transaksi dari chat");
  await helper.screenshot("finyu-wa-simulator.png");

  // ── 5. Laporan ──
  await helper.goto("/laporan");
  await page.waitForTimeout(2500);
  await helper.screenshot("finyu-laporan.png");

  // ── 6. Dashboard akhir ──
  await helper.goto("/dashboard");
  await page.waitForTimeout(3500);
  await helper.screenshot("finyu-dashboard.png");

  console.log("✅ Semua langkah smoke test lolos");
}).catch(() => process.exit(1));
