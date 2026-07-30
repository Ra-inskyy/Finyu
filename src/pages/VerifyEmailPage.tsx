import { useAuthActions } from "@convex-dev/auth/react";
import { ArrowLeft, Loader2, Mail } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { APP_NAME } from "@/lib/constants";

export function VerifyEmailPage() {
  const { signIn } = useAuthActions();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialEmail = searchParams.get("email") || "";

  const [email, setEmail] = useState(initialEmail);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [countdown, setCountdown] = useState(60);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (countdown > 0) {
      timer = setTimeout(() => setCountdown(c => c - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [countdown]);

  const handleResendOtp = async () => {
    if (!email) return;
    setError("");
    setLoading(true);

    try {
      await signIn("password", { flow: "email-verification", email });
      setCountdown(60);
    } catch (err: any) {
      console.error(err);
      setError("Gagal mengirim ulang OTP. Pastikan email valid.");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code || code.length < 6) {
      setError("Masukkan 6-digit kode OTP yang valid");
      return;
    }
    setError("");
    setLoading(true);

    try {
      await signIn("password", { flow: "email-verification", email, code });
      navigate("/dashboard");
    } catch (err: any) {
      console.error(err);
      setError("Kode OTP salah atau sudah kedaluwarsa.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 flex items-center justify-center p-4 relative">
      <div className="absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute top-0 right-1/4 size-96 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute bottom-0 left-1/4 size-96 rounded-full bg-primary/5 blur-3xl" />
      </div>

      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-2">
          <div className="mx-auto size-12 rounded-xl bg-primary flex items-center justify-center mb-4">
            <span className="text-primary-foreground font-bold text-lg">F</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">
            Verifikasi Email {APP_NAME}
          </h1>
          <p className="text-muted-foreground text-sm">
            Masukkan 6-digit kode OTP untuk mengaktifkan akun kamu
          </p>
        </div>

        <Card variant="elevated">
          <CardContent className="pt-6 space-y-4">
            <div className="text-center space-y-1">
              <div className="mx-auto size-12 rounded-full bg-primary/10 flex items-center justify-center mb-2">
                <Mail className="size-6 text-primary" />
              </div>
              <p className="text-sm text-muted-foreground">
                Kode OTP telah dikirim ke <span className="font-medium text-foreground">{email}</span>
              </p>
            </div>

            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="code">Kode Verifikasi OTP (6-Digit)</Label>
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
                asChild
              >
                <Link to="/signup">
                  <ArrowLeft className="size-3.5 mr-1" /> Ubah Pendaftaran
                </Link>
              </Button>

              <Button
                type="button"
                variant="link"
                size="sm"
                disabled={countdown > 0 || loading}
                onClick={handleResendOtp}
                className="text-primary font-medium"
              >
                {countdown > 0 ? `Kirim ulang (${countdown}s)` : "Kirim ulang OTP"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
