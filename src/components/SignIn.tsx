import { useAuthActions } from "@convex-dev/auth/react";
import { ArrowLeft, Loader2, Mail } from "lucide-react";
import { useState } from "react";
import { Button } from "./ui/button";
import { Card, CardContent } from "./ui/card";
import { Input } from "./ui/input";
import { Label } from "./ui/label";

function isTestEmail(email: string): boolean {
  return email.endsWith("@test.local");
}

type Step =
  | "signIn"
  | { type: "forgot"; email?: string }
  | { type: "reset-code"; email: string }
  | { type: "new-password"; email: string; code: string };

export function SignIn() {
  const { signIn } = useAuthActions();
  const [step, setStep] = useState<Step>("signIn");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  if (step === "signIn") {
    return (
      <Card variant="elevated">
        <CardContent className="pt-6">
          <form
            onSubmit={async e => {
              e.preventDefault();
              setError("");
              setLoading(true);

              const formData = new FormData(e.currentTarget);
              const email = formData.get("email") as string;
              const provider = isTestEmail(email) ? "test" : "password";
              try {
                await signIn(provider, formData);
              } catch {
                setError("Email atau kata sandi salah");
              } finally {
                setLoading(false);
              }
            }}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="you@example.com"
                autoComplete="email"
                className="h-11"
                required
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Kata sandi</Label>
                <Button
                  type="button"
                  variant="link"
                  className="px-0 h-auto text-xs text-muted-foreground hover:text-primary"
                  onClick={() => setStep({ type: "forgot" })}
                >
                  Lupa kata sandi?
                </Button>
              </div>
              <Input
                id="password"
                name="password"
                type="password"
                placeholder="••••••••"
                autoComplete="current-password"
                className="h-11"
                required
              />
            </div>
            <input name="flow" value="signIn" type="hidden" />
            {error && (
              <p className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">
                {error}
              </p>
            )}
            <Button type="submit" className="w-full h-11" disabled={loading}>
              {loading && <Loader2 className="size-4 animate-spin" />}
              {loading ? "Memproses..." : "Masuk"}
            </Button>
          </form>
        </CardContent>
      </Card>
    );
  }

  if (step.type === "forgot") {
    return (
      <Card variant="elevated">
        <CardContent className="pt-6">
          <div className="text-center mb-6">
            <h2 className="font-semibold text-lg">Reset kata sandi</h2>
            <p className="text-sm text-muted-foreground">
              Masukkan emailmu untuk menerima kode reset
            </p>
          </div>
          <form
            onSubmit={async e => {
              e.preventDefault();
              setError("");
              setLoading(true);

              const formData = new FormData(e.currentTarget);
              const email = formData.get("email") as string;
              try {
                await signIn("password", formData);
                setStep({ type: "reset-code", email });
              } catch {
                setError("Kode reset gagal dikirim. Coba lagi.");
              } finally {
                setLoading(false);
              }
            }}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="you@example.com"
                defaultValue={step.email}
                autoComplete="email"
                className="h-11"
                required
              />
            </div>
            <input name="flow" value="reset" type="hidden" />
            {error && (
              <p className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">
                {error}
              </p>
            )}
            <Button type="submit" className="w-full h-11" disabled={loading}>
              {loading && <Loader2 className="size-4 animate-spin" />}
              {loading ? "Mengirim..." : "Kirim kode reset"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="w-full"
              onClick={() => setStep("signIn")}
            >
              <ArrowLeft className="size-4" />
              Kembali ke halaman masuk
            </Button>
          </form>
        </CardContent>
      </Card>
    );
  }

  if (step.type === "reset-code") {
    return (
      <Card variant="elevated">
        <CardContent className="pt-6">
          <div className="text-center mb-6">
            <div className="mx-auto size-12 rounded-full bg-primary flex items-center justify-center mb-4">
              <Mail className="size-6 text-primary-foreground" />
            </div>
            <h2 className="font-semibold text-lg">Cek emailmu</h2>
            <p className="text-sm text-muted-foreground">
              Kode sudah dikirim ke {step.email}
            </p>
          </div>
          <form
            onSubmit={e => {
              e.preventDefault();
              setError("");
              const formData = new FormData(e.currentTarget);
              const code = formData.get("code") as string;
              setStep({ type: "new-password", email: step.email, code });
            }}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label htmlFor="code">Kode reset</Label>
              <Input
                id="code"
                name="code"
                type="text"
                placeholder="Masukkan kode"
                autoComplete="one-time-code"
                className="h-11 text-center tracking-[0.5em] font-mono"
                required
              />
            </div>
            {error && (
              <p className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">
                {error}
              </p>
            )}
            <Button type="submit" className="w-full h-11">
              Lanjut
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="w-full"
              onClick={() => setStep({ type: "forgot", email: step.email })}
            >
              Kirim ulang kode
            </Button>
          </form>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card variant="elevated">
      <CardContent className="pt-6">
        <div className="text-center mb-6">
          <h2 className="font-semibold text-lg">Buat kata sandi baru</h2>
          <p className="text-sm text-muted-foreground">
            Pilih kata sandi yang kuat
          </p>
        </div>
        <form
          onSubmit={async e => {
            e.preventDefault();
            setError("");
            setLoading(true);

            const formData = new FormData(e.currentTarget);
            try {
              await signIn("password", formData);
            } catch {
              setError(
                "Gagal mengganti kata sandi. Kodenya mungkin sudah kedaluwarsa.",
              );
              setStep({ type: "forgot", email: step.email });
            } finally {
              setLoading(false);
            }
          }}
          className="space-y-4"
        >
          <div className="space-y-2">
            <Label htmlFor="newPassword">Kata sandi baru</Label>
            <Input
              id="newPassword"
              name="newPassword"
              type="password"
              placeholder="••••••••"
              minLength={6}
              autoComplete="new-password"
              className="h-11"
              required
            />
          </div>
          <input name="flow" value="reset-verification" type="hidden" />
          <input name="email" value={step.email} type="hidden" />
          <input name="code" value={step.code} type="hidden" />
          {error && (
            <p className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">
              {error}
            </p>
          )}
          <Button type="submit" className="w-full h-11" disabled={loading}>
            {loading && <Loader2 className="size-4 animate-spin" />}
            {loading ? "Menyimpan..." : "Simpan kata sandi"}
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="w-full"
            onClick={() => setStep("signIn")}
          >
            <ArrowLeft className="size-4" />
            Batal
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
