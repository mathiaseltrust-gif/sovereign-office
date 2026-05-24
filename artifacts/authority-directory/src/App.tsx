import { useState, useEffect } from "react";
import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Layout } from "@/components/layout";
import { SignInPrompt } from "@/components/sign-in-prompt";
import { getAuthState } from "@/lib/auth";
import { ApiError } from "@/lib/api";
import NotFound from "@/pages/not-found";
import JurisdictionPage from "@/pages/jurisdiction";
import IntakePage from "@/pages/intake";
import MattersPage from "@/pages/matters";
import LegalMapPage from "@/pages/legal-map";
import CaseFilesPage from "@/pages/case-files";
import CaseFileDetailPage from "@/pages/case-file-detail";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (count, err: unknown) => {
        const status = (err as ApiError)?.status;
        if (status === 401 || status === 403) return false;
        return count < 2;
      },
    },
  },
});

// Exported for use in individual pages as a fallback / inline banner
export function SessionExpiredBanner() {
  return (
    <div className="m-5 rounded-lg border border-amber-300 bg-amber-50 px-4 py-4 text-sm">
      <p className="font-semibold text-amber-900 mb-1">Session expired — sign in required.</p>
      <p className="text-amber-800 text-xs mb-3">
        Your session has ended or you are not yet signed in to access this system.
      </p>
      <a
        href="/sovereign-dashboard/"
        className="inline-block rounded-md bg-amber-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-800 transition-colors"
      >
        Sign in via Sovereign Dashboard
      </a>
    </div>
  );
}

function getSovereignLoginUrl() {
  if (typeof window === "undefined") return "/sovereign-dashboard/login";
  const { hostname, origin } = window.location;
  if (hostname === "localhost" || hostname === "127.0.0.1") return "/sovereign-dashboard/login";
  return `${origin}/sovereign-dashboard/login`;
}

// Full-page session-expired notice shown when any API call returns 401
function SessionExpiredPage() {
  const loginUrl = getSovereignLoginUrl();
  function handleSignIn(e: React.MouseEvent) {
    e.preventDefault();
    window.open(loginUrl, "_blank", "noopener,noreferrer");
  }
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="max-w-sm w-full text-center space-y-4">
        <img
          src="/authority-directory/tribal-seal.png"
          alt="Mathias El Tribe Seal"
          className="mx-auto h-20 w-20 object-contain"
        />
        <h2 className="text-lg font-semibold text-foreground">Session Expired</h2>
        <p className="text-sm text-muted-foreground">
          Your Sovereign Office session has expired. Sign in again, then return to this tab and refresh.
        </p>
        <a
          href={loginUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={handleSignIn}
          className="inline-block rounded-md bg-amber-700 px-4 py-2 text-sm font-medium text-white hover:bg-amber-800 transition-colors"
        >
          Sign in via Sovereign Office
        </a>
      </div>
    </div>
  );
}

function AuthGuard({ children }: { children: React.ReactNode }) {
  const auth = getAuthState();
  if (!auth) return <SignInPrompt />;
  return <>{children}</>;
}

function Router() {
  return (
    <AuthGuard>
      <Layout>
        <Switch>
          <Route path="/" component={() => <Redirect to="/jurisdiction" />} />
          <Route path="/jurisdiction" component={JurisdictionPage} />
          <Route path="/intake" component={IntakePage} />
          <Route path="/matters" component={MattersPage} />
          <Route path="/legal-map" component={LegalMapPage} />
          <Route path="/case-files" component={CaseFilesPage} />
          <Route path="/case-files/:caseNumber" component={CaseFileDetailPage} />
          <Route component={NotFound} />
        </Switch>
      </Layout>
    </AuthGuard>
  );
}

export default function App() {
  // Centralized 401 interceptor — api.ts fires "auth:session-expired" on any 401 response
  const [sessionExpired, setSessionExpired] = useState(false);

  useEffect(() => {
    function handleSessionExpired() {
      setSessionExpired(true);
    }
    window.addEventListener("auth:session-expired", handleSessionExpired);
    return () => window.removeEventListener("auth:session-expired", handleSessionExpired);
  }, []);

  if (sessionExpired) {
    return (
      <TooltipProvider>
        <SessionExpiredPage />
      </TooltipProvider>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={(() => {
            const envBase = import.meta.env.BASE_URL.replace(/\/$/, "");
            if (envBase && envBase !== "") return envBase;
            if (typeof window !== "undefined" && window.location.pathname.startsWith("/authority-directory")) return "/authority-directory";
            return "";
          })()}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}
