import { useConvexAuth } from "convex/react";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Navigate, useSearchParams } from "react-router-dom";

/**
 * Landing route for OAuth return. Waits for ConvexAuthProvider to exchange
 * the verification code, then redirects to dashboard on success or back to
 * login on timeout.
 */
function hasStoredAuthToken(): boolean {
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.includes("convexAuthToken")) {
        const val = localStorage.getItem(key);
        if (val && val !== "null" && val !== "undefined") return true;
      }
    }
  } catch {
    // ignore
  }
  return false;
}

export function ViktorOAuthCallbackPage() {
  const { isAuthenticated } = useConvexAuth();
  const [searchParams] = useSearchParams();
  const [timedOut, setTimedOut] = useState(false);

  const hasError =
    searchParams.has("error") || window.location.hash.includes("error=");

  useEffect(() => {
    if (isAuthenticated) return;
    const timeoutMs = hasError ? 500 : 15_000;
    const timer = setTimeout(() => setTimedOut(true), timeoutMs);
    return () => clearTimeout(timer);
  }, [isAuthenticated, hasError]);

  const tokenPresent = hasStoredAuthToken();

  if (isAuthenticated || tokenPresent) {
    return <Navigate to="/dashboard" replace />;
  }

  if (timedOut) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-3">
      <Loader2 className="size-6 animate-spin text-muted-foreground" />
      <p className="text-sm text-muted-foreground">
        Sedang memprosesmu masuk...
      </p>
    </div>
  );
}
