import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/lib/auth";
import Login from "@/pages/login";
import Overview from "@/pages/overview";
import Instruments from "@/pages/instruments";
import InstrumentDetail from "@/pages/instrument-detail";
import CreateInstrument from "@/pages/create-instrument";
import Filings from "@/pages/filings";
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
    },
  },
});

function AuthenticatedRouter() {
  const { user } = useAuth();

  if (!user) {
    return <Login />;
  }

  return (
    <Switch>
      <Route path="/" component={Overview} />
      <Route path="/instruments" component={Instruments} />
      <Route path="/instruments/new" component={CreateInstrument} />
      <Route path="/instruments/:id" component={InstrumentDetail} />
      <Route path="/filings" component={Filings} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <AuthenticatedRouter />
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
