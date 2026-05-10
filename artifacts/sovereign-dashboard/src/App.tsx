import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth, roleLandingPath } from "@/components/auth-provider";
import { Layout } from "@/components/layout";
import NotFound from "@/pages/not-found";
import TrusteeDashboard from "@/pages/dashboard-trustee";
import OfficerDashboard from "@/pages/dashboard-officer";
import MemberDashboard from "@/pages/dashboard-member";
import AdminDashboard from "@/pages/dashboard-admin";
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
import NotificationsPage from "@/pages/notifications";
import LawLibraryPage from "@/pages/law";
import IntakeAiPage from "@/pages/intake-ai";
import CourtDocumentsPage from "@/pages/court-documents";
import AdminStubPage from "@/pages/admin-stub";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30_000 },
  },
});

function RootRedirect() {
  const { activeRole } = useAuth();
  return <Redirect to={roleLandingPath(activeRole)} />;
}

function DashboardRedirect() {
  const { activeRole } = useAuth();
  return <Redirect to={roleLandingPath(activeRole)} />;
}

function Router() {
  return (
    <Layout>
      <Switch>
        <Route path="/" component={RootRedirect} />
        <Route path="/dashboard/trustee" component={TrusteeDashboard} />
        <Route path="/dashboard/officer" component={OfficerDashboard} />
        <Route path="/dashboard/member" component={MemberDashboard} />
        <Route path="/dashboard/admin" component={AdminDashboard} />
        <Route path="/dashboard" component={DashboardRedirect} />
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
        <Route path="/notifications" component={NotificationsPage} />
        <Route path="/law" component={LawLibraryPage} />
        <Route path="/intake-ai" component={IntakeAiPage} />
        <Route path="/documents" component={CourtDocumentsPage} />
        <Route path="/search" component={SearchPage} />
        <Route path="/admin" component={AdminPage} />
        <Route path="/profile" component={ProfilePage} />
        <Route path="/templates" component={TemplatesPage} />
        <Route path="/welfare" component={WelfarePage} />
        <Route path="/doctrine" component={() => <AdminStubPage title="Doctrine Manager" description="Manage controlling legal doctrines, Indian Canons of Construction, and case law applied by the intake filter and classification engines." />} />
        <Route path="/recorder-rules" component={() => <AdminStubPage title="Recorder Rules" description="Configure and maintain recorder-compliance validation rules for trust instruments, NFR documents, and court filings." />} />
        <Route path="/welfare-acts" component={() => <AdminStubPage title="Welfare Acts" description="Administer welfare act instruments, emergency declarations, and benefit authorizations issued under the Office." />} />
        <Route path="/role-delegation" component={() => <AdminStubPage title="Role Delegation" description="Grant and revoke role-based access permissions. Delegate officer authority and configure member access levels." />} />
        <Route path="/audit-logs" component={() => <AdminStubPage title="Audit Logs" description="System-wide audit trail for all instruments, filings, court documents, NFRs, and administrative actions." />} />
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
