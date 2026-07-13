import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Atlas from "@/pages/atlas";
import { isAtlasAuthenticated } from "@/lib/atlasAuth";

import "leaflet/dist/leaflet.css";

const queryClient = new QueryClient();

const OFFICE_LOGIN = "https://office.mathiaseltribe.org/login";

function AuthGuard({ children }: { children: React.ReactNode }) {
  const params = new URLSearchParams(window.location.search);
  const ssoToken = params.get("sso_token");
  if (ssoToken) {
    try {
      localStorage.setItem("community_auth_token", ssoToken);
      const url = new URL(window.location.href);
      url.searchParams.delete("sso_token");
      window.history.replaceState({}, "", url.toString());
    } catch { /* ignore */ }
  }

  if (!isAtlasAuthenticated()) {
    const next = encodeURIComponent(window.location.href);
    window.location.replace(`${OFFICE_LOGIN}?next=${next}`);
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <p className="text-gray-400 text-sm">Redirecting to sign in……</p>
      </div>
    );
  }

  return <>{children}</>;
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={Atlas} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
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

export default App;
