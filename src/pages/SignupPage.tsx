import { Link } from "react-router-dom";
import { GoogleSignInSection } from "@/components/GoogleSignInSection";
import { SignUp } from "@/components/SignUp";
import { Button } from "@/components/ui/button";
import { APP_NAME } from "@/lib/constants";

export function SignupPage() {
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
            Buat akun {APP_NAME}
          </h1>
          <p className="text-muted-foreground text-sm">
            Gratis — mulai catat keuangan dalam satu menit
          </p>
        </div>

        <GoogleSignInSection showEmailDivider={true} />
        
        <SignUp />

        <p className="text-center text-sm text-muted-foreground">
          Sudah punya akun?{" "}
          <Button variant="link" className="p-0 h-auto font-medium" asChild>
            <Link to="/login">Masuk</Link>
          </Button>
        </p>
      </div>
    </div>
  );
}
