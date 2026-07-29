import { useAuthActions } from "@convex-dev/auth/react";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { Button } from "./ui/button";
import { Separator } from "./ui/separator";

function GoogleLogo() {
  return (
    <svg viewBox="0 0 48 48" className="size-4" aria-hidden="true">
      <title>Google</title>
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59A14.4 14.4 0 0 1 9.77 24c0-1.6.27-3.14.76-4.59l-7.98-6.19A23.94 23.94 0 0 0 0 24c0 3.88.93 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.9-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.17 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </svg>
  );
}

/**
 * "Masuk dengan Google" — OAuth Google milik aplikasi Finyu sendiri.
 */
export function GoogleSignInSection({
  showEmailDivider = true,
}: {
  showEmailDivider?: boolean;
}) {
  const { signIn } = useAuthActions();
  const [redirecting, setRedirecting] = useState(false);
  const [redirectFailed, setRedirectFailed] = useState(false);

  const handleGoogleSignIn = async () => {
    setRedirectFailed(false);
    setRedirecting(true);
    try {
      await signIn("google", { redirectTo: "/dashboard" });
    } catch (err) {
      console.error("Google sign in error:", err);
      setRedirecting(false);
      setRedirectFailed(true);
    }
  };

  return (
    <>
      <Button
        onClick={handleGoogleSignIn}
        disabled={redirecting}
        className="w-full h-11"
        variant="outline"
      >
        {redirecting ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <GoogleLogo />
        )}
        {redirecting ? "Mengalihkan..." : "Masuk dengan Google"}
      </Button>
      {redirectFailed && !redirecting && (
        <p className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">
          Gagal menghubungkan ke Google. Coba lagi atau masuk pakai email dan kata sandi.
        </p>
      )}

      {showEmailDivider && (
        <div className="relative py-4">
          <Separator />
          <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-background px-3 text-xs text-muted-foreground">
            atau pakai email
          </span>
        </div>
      )}
    </>
  );
}
