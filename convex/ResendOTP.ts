import { Email } from "@convex-dev/auth/providers/Email";

export const ResendOTP = Email({
  id: "resend-otp",
  apiKey: process.env.AUTH_RESEND_KEY,
  maxAge: 60 * 10, // Kode OTP berlaku 10 menit
  async generateVerificationToken() {
    // Generate 6 digit angka OTP acak (contoh: 482910)
    return Math.floor(100000 + Math.random() * 900000).toString();
  },
  async sendVerificationRequest({ identifier: to, token }) {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.AUTH_RESEND_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.AUTH_EMAIL_FROM || "Finyu <onboarding@resend.dev>",
        to,
        subject: `Kode Verification OTP Finyu: ${token}`,
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; padding: 24px; max-width: 480px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 16px; background-color: #ffffff;">
            <div style="text-align: center; margin-bottom: 20px;">
              <h1 style="color: #4f46e5; margin: 0; font-size: 28px; font-weight: 800; letter-spacing: -0.5px;">Finyu</h1>
              <p style="color: #6b7280; font-size: 14px; margin-top: 4px;">Kelola Keuangan Jadi Lebih Mudah</p>
            </div>
            
            <div style="padding: 20px; background-color: #f9fafb; border-radius: 12px; border: 1px solid #f3f4f6;">
              <h2 style="color: #111827; margin-top: 0; font-size: 18px; font-weight: 600; text-align: center;">Kode OTP Verifikasi</h2>
              <p style="color: #4b5563; font-size: 14px; text-align: center; margin-bottom: 20px;">Gunakan kode 6-digit berikut untuk verifikasi masuk ke akun Finyu kamu:</p>
              
              <div style="background-color: #ffffff; padding: 18px; text-align: center; border-radius: 10px; font-size: 34px; font-weight: 800; letter-spacing: 10px; color: #4f46e5; border: 2px dashed #c7d2fe; margin: 16px 0;">
                ${token}
              </div>
              
              <p style="color: #9ca3af; font-size: 12px; text-align: center; margin: 0;">Kode ini berlaku selama 10 menit. Jangan berikan kode ini kepada siapapun.</p>
            </div>

            <div style="margin-top: 24px; text-align: center; border-top: 1px solid #f3f4f6; padding-top: 16px;">
              <p style="color: #9ca3af; font-size: 12px; margin: 0;">&copy; ${new Date().getFullYear()} Finyu (finyu.web.id). All rights reserved.</p>
            </div>
          </div>
        `,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Resend API Error: ${errText}`);
    }
  },
});
