import { useAuthActions } from "@convex-dev/auth/react";
import { useMutation, useQuery } from "convex/react";
import { ShieldAlert } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { api } from "../../../convex/_generated/api";

const WARNING_SECONDS = 60;
const ACTIVITY_EVENTS = [
  "mousemove",
  "mousedown",
  "keydown",
  "scroll",
  "touchstart",
  "click",
] as const;

/**
 * Auto logout setelah tidak ada aktivitas (default 15 menit) dengan
 * peringatan hitung mundur 60 detik — sesuai AC fitur Keamanan.
 */
export function IdleTimeoutGuard() {
  const me = useQuery(api.profiles.me);
  const logEvent = useMutation(api.profiles.logEvent);
  const { signOut } = useAuthActions();
  const timeoutMinutes = me?.idleTimeoutMinutes ?? 15;
  const [countdown, setCountdown] = useState<number | null>(null);
  const lastActivity = useRef(Date.now());

  const reset = useCallback(() => {
    lastActivity.current = Date.now();
    setCountdown(null);
  }, []);

  useEffect(() => {
    for (const event of ACTIVITY_EVENTS)
      window.addEventListener(event, reset, { passive: true });
    return () => {
      for (const event of ACTIVITY_EVENTS)
        window.removeEventListener(event, reset);
    };
  }, [reset]);

  useEffect(() => {
    const idleMs = timeoutMinutes * 60_000;
    const interval = window.setInterval(() => {
      const idleFor = Date.now() - lastActivity.current;
      const remaining = Math.ceil((idleMs - idleFor) / 1000);
      if (remaining <= 0) {
        void logEvent({
          event: "logout_idle",
          detail: `Auto logout setelah ${timeoutMinutes} menit idle`,
        }).catch(() => undefined);
        void signOut();
        return;
      }
      setCountdown(remaining <= WARNING_SECONDS ? remaining : null);
    }, 1000);
    return () => window.clearInterval(interval);
  }, [timeoutMinutes, signOut, logEvent]);

  return (
    <Dialog open={countdown !== null} onOpenChange={() => reset()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldAlert className="size-5 text-warning" />
            Sesi akan berakhir
          </DialogTitle>
          <DialogDescription>
            Kamu tidak aktif selama {timeoutMinutes} menit. Untuk keamanan data
            keuangan, kamu akan otomatis keluar dalam{" "}
            <span className="font-semibold text-foreground">{countdown}</span>{" "}
            detik.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button onClick={reset} className="w-full">
            Tetap masuk
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
