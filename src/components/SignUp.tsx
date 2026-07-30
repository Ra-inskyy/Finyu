import { useAuthActions } from "@convex-dev/auth/react";
import { ArrowLeft, Loader2, Mail } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "./ui/button";
import { Card, CardContent } from "./ui/card";
import { Input } from "./ui/input";
import { Label } from "./ui/label";

export function SignUp() {
  const { signIn } = useAuthActions();
  const [step, setStep] = useState<"signUp" | "verifyOtp">("signUp");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [countdown, setCountdown] = useState(0);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (countdown > 0) {
      timer = setTimeout(() => setCountdown(c => c - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [countdown]);

  const handleStartSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setError("");
    setLoading(true);

    try {
      // Send 6-Digit OTP via Resend to the registered email address
      await signIn("resend-otp", { email });
      setStep("verifyOtp");
      setCountdown(60);
    } catch (err: any) {
      console.error(err);
      setError(err?.message || "Gagal mengirimkan kode OTP ke email tersebut. Pastikan email valid.");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtpAndRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code || code.length < 6) {
      setError("Masukkan 6-digit kode OTP yang valid");
      return;
    }
    setError("");
    setLoading(true);

    try {
      // Verify OTP code with Resend and finalize sign in
      await signIn("resend-otp", { email, code });
    } catch (err: any) {
      console.error(err);
      setError("Kode OTP salah atau sudah kedaluwarsa.");
    } finally {
      setLoading(false);
    }
  };

  if (step === "signUp") {
    return (
      <Card variant="elevated">
        <CardContent className="pt-6">
          <form onSubmit={handleStartSignUp} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nama Lengkap</Label>
              <Input
                id="name"
                type="text"
                placeholder="Nama kamu"
                value={name}
                onChange={e => setName(e.target.value)}
                className="h-11"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email Pendaftaran</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="h-11"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Kata Sandi</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                minLength={6}
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="h-11"
                required
              />
              <p className="text-xs text-muted-foreground">Minimal 6 karakter</p>
            </div>

            {error && (
              <p className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2 text-center">
                {error}
              </p>
            )}

            <Button type="submit" className="w-full h-11" disabled={loading}>
              {loading && <Loader2 className="size-4 animate-spin mr-2" />}
              {loading ? "Mengirimkan OTP..." : "Kirim Kode OTP Verifikasi"}
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
            <Mail className="size-6 text-primary" />
          </div>
          <h3 className="font-bold text-lg">Verifikasi Kode OTP</h3>
          <p className="text-sm text-muted-foreground">
            Kami telah mengirimkan 6-digit kode OTP ke <span className="font-medium text-foreground">{email}</span>
          </p>
        </div>

        <form onSubmit={handleVerifyOtpAndRegister} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="code">Masukkan Kode OTP (6-Digit)</Label>
            <Input
              id="code"
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
            {loading ? "Memverifikasi..." : "Verifikasi & Selesaikan Pendaftaran"}
          </Button>
        </form>

        <div className="flex items-center justify-between pt-2 text-xs">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-muted-foreground hover:text-foreground"
            onClick={() => {
              setStep("signUp");
              setError("");
            }}
          >
            <ArrowLeft className="size-3.5 mr-1" /> Ubah Pendaftaran
          </Button>

          <Button
            type="button"
            variant="link"
            size="sm"
            disabled={countdown > 0 || loading}
            onClick={handleStartSignUp}
            className="text-primary font-medium"
          >
            {countdown > 0 ? `Kirim ulang (${countdown}s)` : "Kirim ulang OTP"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
