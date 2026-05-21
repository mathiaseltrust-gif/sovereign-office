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
import DashboardPage from "@/pages/dashboard";
import NewMatterPage from "@/pages/new-matter";
import MatterDetailPage from "@/pages/matter-detail";
import NiacPage from "@/pages/niac";
import MonitoringPage from "@/pages/monitoring";
import AccessPage from "@/pages/access";

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

export function SessionExpiredBanner() {
  return (
    <div className="m-5 rounded-lg border border-amber-300 bg-amber-50 px-4 py-4 text-sm">
      <p className="font-semibold text-amber-900 mb-1">Session expired — sign in required.</p>
      <p className="text-amber-800 text-xs mb-3">
        Your session has ended or you are not yet signed in to access TRACE.
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

function SessionExpiredPage() {
  const loginUrl = getSovereignLoginUrl();
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="max-w-sm w-full text-center space-y-4">
        <div className="mx-auto h-16 w-16 rounded-full bg-sidebar flex items-center justify-center">
          <span className="text-2xl font-bold text-sidebar-primary">T</span>
        </div>
        <h2 className="text-lg font-semibold text-foreground">Session Expired</h2>
        <p className="text-sm text-muted-foreground">
          Your Sovereign Office session has expired. Sign in again, then return to this tab and refresh.
        </p>
        <a
          href={loginUrl}
          target="_blank"
          rel="noopener noreferrer"
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
          <Route path="/" component={DashboardPage} />
          <Route path="/matters/new" component={NewMatterPage} />
          <Route path="/matters/:id" component={MatterDetailPage} />
          <Route path="/niac" component={NiacPage} />
          <Route path="/monitoring" component={MonitoringPage} />
          <Route path="/access" component={AccessPage} />
          <Route component={NotFound} />
        </Switch>
      </Layout>
    </AuthGuard>
  );
}

export default function App() {
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
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}
