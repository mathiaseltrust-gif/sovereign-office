import { useEffect, useState } from "react";
import { useAuth, roleLandingPath } from "@/components/auth-provider";

const BASE_PATH = import.meta.env.BASE_URL.replace(/\/$/, "");

function friendlyError(raw: string): string {
  if (raw.includes("AADSTS50011")) {
    return "The redirect URI for this app is not registered in Azure Portal. An administrator must add it under App Registrations → Authentication → Redirect URIs.";
  }
  if (raw.includes("AADSTS700016")) {
    return "The application was not found in the Azure directory. Check that the Client ID is correct.";
  }
  if (raw.includes("AADSTS65001")) {
    return "Administrator consent is required before this application can sign users in.";
  }
  if (raw.includes("AADSTS50020")) {
    return "Guest accounts from external tenants are not supported. Please sign in with your organisation account.";
  }
  return raw;
}

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
      const raw = errorDesc ?? error;
      setErrorMsg(friendlyError(raw));
      setStatus("error");

      if (window.opener && !window.opener.closed) {
        window.opener.postMessage(
          { type: "OAUTH_ERROR", error: friendlyError(raw) },
          window.location.origin,
        );
        window.close();
      }
      return;
    }

    if (!code) {
      setErrorMsg("No authorization code received from Microsoft.");
      setStatus("error");
      return;
    }

    const redirectUri = `${window.location.origin}${window.location.pathname}`;

    (async () => {
      try {
        const res = await fetch("/api/auth/microsoft/exchange", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code, redirectUri }),
        });

        const data = await res.json() as {
          sessionToken?: string;
          user?: { id: number; email: string; name: string; role: string; roles?: string[] };
          error?: string;
        };

        if (!res.ok || !data.sessionToken || !data.user) {
          const msg = friendlyError(data.error ?? "Token exchange failed. Please try again.");
          setErrorMsg(msg);
          setStatus("error");
          if (window.opener && !window.opener.closed) {
            window.opener.postMessage({ type: "OAUTH_ERROR", error: msg }, window.location.origin);
            window.close();
          }
          return;
        }

        const roles = data.user.roles ?? [data.user.role];

        if (window.opener && !window.opener.closed) {
          window.opener.postMessage(
            {
              type: "OAUTH_SUCCESS",
              sessionToken: data.sessionToken,
              user: { id: data.user.id, email: data.user.email, name: data.user.name, roles },
            },
            window.location.origin,
          );
          window.close();
          return;
        }

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
      } catch {
        const msg = "Could not reach the authentication server. Please try again.";
        setErrorMsg(msg);
        setStatus("error");
        if (window.opener && !window.opener.closed) {
          window.opener.postMessage({ type: "OAUTH_ERROR", error: msg }, window.location.origin);
          window.close();
        }
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
            href={`${BASE_PATH}/login`}
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
