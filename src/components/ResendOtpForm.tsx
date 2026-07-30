import { useAuthActions } from "@convex-dev/auth/react";
import { ArrowLeft, KeyRound, Loader2, Mail } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "./ui/button";
import { Card, CardContent } from "./ui/card";
import { Input } from "./ui/input";
import { Label } from "./ui/label";

interface ResendOtpFormProps {
  title?: string;
  buttonText?: string;
}

export function ResendOtpForm({
  title = "Masuk / Daftar via OTP Email (Resend)",
  buttonText = "Kirim Kode OTP",
}: ResendOtpFormProps = {}) {
  const { signIn } = useAuthActions();
  const [step, setStep] = useState<"input-email" | "input-code">("input-email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [resendCountdown, setResendCountdown] = useState(0);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (resendCountdown > 0) {
      timer = setTimeout(() => setResendCountdown(c => c - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [resendCountdown]);

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setError("");
    setLoading(true);

    try {
      await signIn("resend-otp", { email });
      setStep("input-code");
      setResendCountdown(60);
    } catch (err: any) {
      console.error(err);
      setError(err?.message || "Gagal mengirimkan kode OTP. Pastikan email valid.");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code || code.length < 6) {
      setError("Masukkan 6 digit kode OTP yang valid");
      return;
    }
    setError("");
    setLoading(true);

    try {
      await signIn("resend-otp", { email, code });
    } catch (err: any) {
      console.error(err);
      setError("Kode OTP salah atau sudah kedaluwarsa.");
    } finally {
      setLoading(false);
    }
  };

  if (step === "input-email") {
    return (
      <Card variant="elevated">
        <CardContent className="pt-6">
          <form onSubmit={handleSendOtp} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="otp-email" className="flex items-center gap-2">
                <Mail className="size-4 text-primary" />
                {title}
              </Label>
              <Input
                id="otp-email"
                type="email"
                placeholder="emailkamu@gmail.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="h-11"
                required
              />
            </div>
            {error && (
              <p className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">
                {error}
              </p>
            )}
            <Button type="submit" className="w-full h-11" disabled={loading}>
              {loading && <Loader2 className="size-4 animate-spin mr-2" />}
              {loading ? "Mengirim OTP..." : buttonText}
            </Button>
          </form>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card variant="elevated">
      <CardContent className="pt-6 space-y-4">
        <div className="text-center space-y-1">
          <div className="mx-auto size-12 rounded-full bg-primary/10 flex items-center justify-center mb-2">
            <KeyRound className="size-6 text-primary" />
          </div>
          <h3 className="font-bold text-lg">Cek Email Kamu</h3>
          <p className="text-sm text-muted-foreground">
            Kode OTP 6-digit telah dikirim ke <span className="font-medium text-foreground">{email}</span>
          </p>
        </div>

        <form onSubmit={handleVerifyOtp} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="otp-code">Masukkan Kode OTP 6-Digit</Label>
            <Input
              id="otp-code"
              type="text"
              maxLength={6}
              placeholder="123456"
              value={code}
              onChange={e => setCode(e.target.value.replace(/\D/g, ""))}
              className="h-12 text-center text-xl font-mono tracking-[0.5em] font-bold"
              autoFocus
              required
            />
          </div>

          {error && (
            <p className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2 text-center">
              {error}
            </p>
          )}

          <Button type="submit" className="w-full h-11" disabled={loading || code.length < 6}>
            {loading && <Loader2 className="size-4 animate-spin mr-2" />}
            {loading ? "Memverifikasi..." : "Verifikasi & Masuk"}
          </Button>
        </form>

        <div className="flex items-center justify-between pt-2 text-xs">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-muted-foreground hover:text-foreground"
            onClick={() => {
              setStep("input-email");
              setError("");
            }}
          >
            <ArrowLeft className="size-3.5 mr-1" /> Ubah Email
          </Button>

          <Button
            type="button"
            variant="link"
            size="sm"
            disabled={resendCountdown > 0 || loading}
            onClick={handleSendOtp}
            className="text-primary font-medium"
          >
            {resendCountdown > 0 ? `Kirim ulang (${resendCountdown}s)` : "Kirim ulang OTP"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
