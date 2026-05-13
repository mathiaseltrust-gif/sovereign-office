import { useEffect, useState } from "react";
import { useAuth, roleLandingPath } from "@/components/auth-provider";

const REDIRECT_URI = "https://sovereign-dashboard.redstone-3e658f00.eastus.azurecontainerapps.io/microsoft/callback";

export default function MicrosoftCallback() {
  const { loginWithSessionToken } = useAuth();
  const [status, setStatus] = useState<"exchanging" | "error">("exchanging");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const error = params.get("error");
    const errorDesc = params.get("error_description");

    if (error) {
      setErrorMsg(errorDesc ?? error);
      setStatus("error");
      return;
    }

    if (!code) {
      setErrorMsg("No authorization code received from Microsoft.");
      setStatus("error");
      return;
    }

    (async () => {
      try {
        const res = await fetch("/api/auth/microsoft/exchange", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code, redirectUri: REDIRECT_URI }),
        });

        const data = await res.json() as {
          sessionToken?: string;
          user?: { id: number; email: string; name: string; role: string; roles?: string[] };
          error?: string;
        };

        if (!res.ok || !data.sessionToken || !data.user) {
          setErrorMsg(data.error ?? "Token exchange failed. Please try again.");
          setStatus("error");
          return;
        }

        const roles = data.user.roles ?? [data.user.role];
        loginWithSessionToken(data.sessionToken, {
          id: data.user.id,
          dbId: data.user.id,
          email: data.user.email,
          name: data.user.name,
          roles,
        });

        const next = sessionStorage.getItem("oauth_next");
        sessionStorage.removeItem("oauth_next");
        window.location.replace(next ?? roleLandingPath(roles[0] as never ?? "member"));
      } catch (err) {
        setErrorMsg("Could not reach the authentication server. Please try again.");
        setStatus("error");
      }
    })();
  }, [loginWithSessionToken]);

  if (status === "error") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="w-full max-w-sm text-center space-y-4">
          <div className="text-4xl">⚠️</div>
          <h2 className="text-xl font-serif font-bold text-foreground">Sign-In Failed</h2>
          <p className="text-sm text-muted-foreground">{errorMsg}</p>
          <a
            href="/login"
            className="inline-block mt-4 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            Return to Login
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="w-full max-w-sm text-center space-y-4">
        <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-sm text-muted-foreground">Completing sign-in…</p>
      </div>
    </div>
  );
}
