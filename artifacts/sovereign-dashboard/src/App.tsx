import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/components/auth-provider";
import { Layout } from "@/components/layout";
import NotFound from "@/pages/not-found";
import TrusteeDashboard from "@/pages/dashboard-trustee";
import OfficerDashboard from "@/pages/dashboard-officer";
import MemberDashboard from "@/pages/dashboard-member";
import InstrumentsPage from "@/pages/instruments";
import InstrumentDetail from "@/pages/instrument-detail";
import { FilingsListPage, FilingDetailPage } from "@/pages/filings";
import NfrPage from "@/pages/nfr";
import ClassifyPage from "@/pages/classify";
import { ComplaintsListPage, ComplaintDetailPage } from "@/pages/complaints";
import TasksPage from "@/pages/tasks";
import CalendarPage from "@/pages/calendar";
import SearchPage from "@/pages/search";
import AdminPage from "@/pages/admin";
import ProfilePage from "@/pages/profile";
import TemplatesPage from "@/pages/templates";
import WelfarePage from "@/pages/welfare";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30_000 },
  },
});

function Router() {
  return (
    <Layout>
      <Switch>
        <Route path="/">
          <Redirect to="/dashboard/trustee" />
        </Route>
        <Route path="/dashboard/trustee" component={TrusteeDashboard} />
        <Route path="/dashboard/officer" component={OfficerDashboard} />
        <Route path="/dashboard/member" component={MemberDashboard} />
        <Route path="/dashboard">
          <Redirect to="/dashboard/trustee" />
        </Route>
        <Route path="/instruments" component={InstrumentsPage} />
        <Route path="/instruments/:id">
          {(params) => <InstrumentDetail params={params} />}
        </Route>
        <Route path="/filings" component={FilingsListPage} />
        <Route path="/filings/:id">
          {(params) => <FilingDetailPage params={params} />}
        </Route>
        <Route path="/nfr" component={NfrPage} />
        <Route path="/classify" component={ClassifyPage} />
        <Route path="/complaints" component={ComplaintsListPage} />
        <Route path="/complaints/:id">
          {(params) => <ComplaintDetailPage params={params} />}
        </Route>
        <Route path="/tasks" component={TasksPage} />
        <Route path="/calendar" component={CalendarPage} />
        <Route path="/search" component={SearchPage} />
        <Route path="/admin" component={AdminPage} />
        <Route path="/profile" component={ProfilePage} />
        <Route path="/templates" component={TemplatesPage} />
        <Route path="/welfare" component={WelfarePage} />
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <Router />
          </WouterRouter>
          <Toaster />
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
