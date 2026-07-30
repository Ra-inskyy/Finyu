import { useAuthActions } from "@convex-dev/auth/react";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "./ui/button";
import { Card, CardContent } from "./ui/card";
import { Input } from "./ui/input";
import { Label } from "./ui/label";

export function SignUp() {
  const { signIn } = useAuthActions();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleStartSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setError("");
    setLoading(true);

    try {
      // Send 6-Digit OTP via Resend to the registered email address
      await signIn("resend-otp", { email });
      // Redirect browser to dedicated verification page /verify-email
      navigate(`/verify-email?email=${encodeURIComponent(email)}`);
    } catch (err: any) {
      console.error(err);
      setError(err?.message || "Gagal mendaftar. Pastikan email valid.");
    } finally {
      setLoading(false);
    }
  };

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

          <Button type="submit" className="w-full h-11 font-semibold" disabled={loading}>
            {loading && <Loader2 className="size-4 animate-spin mr-2" />}
            {loading ? "Mengirimkan Kode OTP..." : "Daftar & Kirim Kode OTP Verifikasi"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
