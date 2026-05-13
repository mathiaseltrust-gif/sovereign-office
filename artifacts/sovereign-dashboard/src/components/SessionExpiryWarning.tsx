import { useEffect, useRef, useCallback } from "react";
import { useAuth } from "@/components/auth-provider";
import { toast } from "@/hooks/use-toast";
import { ToastAction } from "@/components/ui/toast";

const WARN_BEFORE_SECS = 2 * 60;
const CHECK_INTERVAL_MS = 30 * 1000;

export function SessionExpiryWarning() {
  const { mode, tokenExpiry, renewSession } = useAuth();
  const toastShownRef = useRef(false);
  const dismissRef = useRef<(() => void) | null>(null);

  const isRealSession = mode === "password" || mode === "microsoft";

  const handleRenew = useCallback(async () => {
    dismissRef.current?.();
    toastShownRef.current = false;
    const ok = await renewSession();
    if (!ok) {
      toast({
        title: "Session renewal failed",
        description: "Please save your work and sign in again.",
        variant: "destructive",
      });
    }
  }, [renewSession]);

  const checkExpiry = useCallback(() => {
    if (!isRealSession || !tokenExpiry) return;
    const now = Math.floor(Date.now() / 1000);
    const secsLeft = tokenExpiry - now;

    if (secsLeft > 0 && secsLeft <= WARN_BEFORE_SECS) {
      if (!toastShownRef.current) {
        toastShownRef.current = true;
        const { dismiss } = toast({
          title: "Your session is about to expire",
          description: "Save your work or renew your session to stay signed in.",
          duration: Infinity,
          action: (
            <ToastAction altText="Renew session" onClick={() => void handleRenew()}>
              Renew session
            </ToastAction>
          ),
        });
        dismissRef.current = dismiss;
      }
    } else if (secsLeft > WARN_BEFORE_SECS) {
      if (toastShownRef.current) {
        dismissRef.current?.();
        toastShownRef.current = false;
        dismissRef.current = null;
      }
    }
  }, [isRealSession, tokenExpiry, handleRenew]);

  useEffect(() => {
    if (!isRealSession || !tokenExpiry) {
      if (toastShownRef.current) {
        dismissRef.current?.();
        toastShownRef.current = false;
        dismissRef.current = null;
      }
      return;
    }

    checkExpiry();
    const interval = setInterval(checkExpiry, CHECK_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [isRealSession, tokenExpiry, checkExpiry]);

  return null;
}
