import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Layout } from "@/components/layout";
import { SignInPrompt } from "@/components/sign-in-prompt";
import { getAuthState } from "@/lib/auth";
import NotFound from "@/pages/not-found";
import JurisdictionPage from "@/pages/jurisdiction";
import IntakePage from "@/pages/intake";
import MattersPage from "@/pages/matters";
import LegalMapPage from "@/pages/legal-map";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (count, err: unknown) => {
        const status = (err as { status?: number })?.status;
        if (status === 401 || status === 403) return false;
        return count < 2;
      },
    },
  },
});

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
          <Route component={NotFound} />
        </Switch>
      </Layout>
    </AuthGuard>
  );
}

export default function App() {
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
