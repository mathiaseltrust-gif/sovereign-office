import { Switch, Route, Router as WouterRouter, Redirect, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth, roleLandingPath } from "@/components/auth-provider";
import { Layout } from "@/components/layout";
import Login from "@/pages/login";
import NotFound from "@/pages/not-found";
import TrusteeDashboard from "@/pages/dashboard-trustee";
import OfficerDashboard from "@/pages/dashboard-officer";
import MemberDashboard from "@/pages/dashboard-member";
import AdminDashboard from "@/pages/dashboard-admin";
import ElderDashboard from "@/pages/dashboard-elder";
import MedicalProviderDashboard from "@/pages/dashboard-medical-provider";
import VisitorDashboard from "@/pages/dashboard-visitor";
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
import FamilyTreePage from "@/pages/family-tree";
import MedicalNotesPage from "@/pages/medical-notes";
import SupremeCourtPage from "@/pages/supreme-court";
import TribalTrustPage from "@/pages/tribal-trust";
import CharitableTrustPage from "@/pages/charitable-trust";
import NiacPage from "@/pages/niac";
import IeePage from "@/pages/iee";
import AdminStubPage from "@/pages/admin-stub";
import TribalIdPage from "@/pages/tribal-id";
import M365IntegrationPage from "@/pages/m365-integration";
import { ChatWidget } from "@/components/ChatWidget";
import { SessionExpiryWarning } from "@/components/SessionExpiryWarning";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error) => {
        if ((error as { status?: number })?.status === 401) return false;
        return failureCount < 1;
      },
      staleTime: 30_000,
    },
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

function AuthGatedChatWidget() {
  const { user } = useAuth();
  if (!user) return null;
  return <ChatWidget />;
}

function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  const { user } = useAuth();
  const [location] = useLocation();

  if (!user) {
    const returnTo = encodeURIComponent(location);
    return <Redirect to={`/login?next=${returnTo}`} />;
  }

  return <Component />;
}

function ProtectedParamRoute({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [location] = useLocation();

  if (!user) {
    const returnTo = encodeURIComponent(location);
    return <Redirect to={`/login?next=${returnTo}`} />;
  }

  return <>{children}</>;
}

function AppRouter() {
  return (
    <Switch>
      <Route path="/login" component={Login} />

      <Route path="/">
        {() => {
          const { user, activeRole } = useAuth();
          if (!user) return <Redirect to="/login" />;
          return <Redirect to={roleLandingPath(activeRole)} />;
        }}
      </Route>

      <Route path="/dashboard/trustee">
        {() => <ProtectedRoute component={TrusteeDashboard} />}
      </Route>
      <Route path="/dashboard/officer">
        {() => <ProtectedRoute component={OfficerDashboard} />}
      </Route>
      <Route path="/dashboard/member">
        {() => <ProtectedRoute component={MemberDashboard} />}
      </Route>
      <Route path="/dashboard/admin">
        {() => <ProtectedRoute component={AdminDashboard} />}
      </Route>
      <Route path="/dashboard/elder">
        {() => <ProtectedRoute component={ElderDashboard} />}
      </Route>
      <Route path="/dashboard/medical-provider">
        {() => <ProtectedRoute component={MedicalProviderDashboard} />}
      </Route>
      <Route path="/dashboard/visitor">
        {() => <ProtectedRoute component={VisitorDashboard} />}
      </Route>
      <Route path="/dashboard">
        {() => <ProtectedRoute component={DashboardRedirect} />}
      </Route>

      <Route path="/instruments">
        {() => <ProtectedRoute component={InstrumentsPage} />}
      </Route>
      <Route path="/instruments/:id">
        {(params) => (
          <ProtectedParamRoute>
            <InstrumentDetail params={params} />
          </ProtectedParamRoute>
        )}
      </Route>
      <Route path="/filings">
        {() => <ProtectedRoute component={FilingsListPage} />}
      </Route>
      <Route path="/filings/:id">
        {(params) => (
          <ProtectedParamRoute>
            <FilingDetailPage params={params} />
          </ProtectedParamRoute>
        )}
      </Route>
      <Route path="/nfr">
        {() => <ProtectedRoute component={NfrPage} />}
      </Route>
      <Route path="/classify">
        {() => <ProtectedRoute component={ClassifyPage} />}
      </Route>
      <Route path="/complaints">
        {() => <ProtectedRoute component={ComplaintsListPage} />}
      </Route>
      <Route path="/complaints/:id">
        {(params) => (
          <ProtectedParamRoute>
            <ComplaintDetailPage params={params} />
          </ProtectedParamRoute>
        )}
      </Route>
      <Route path="/tasks">
        {() => <ProtectedRoute component={TasksPage} />}
      </Route>
      <Route path="/calendar">
        {() => <ProtectedRoute component={CalendarPage} />}
      </Route>
      <Route path="/notifications">
        {() => <ProtectedRoute component={NotificationsPage} />}
      </Route>
      <Route path="/law">
        {() => <ProtectedRoute component={LawLibraryPage} />}
      </Route>
      <Route path="/intake-ai">
        {() => <ProtectedRoute component={IntakeAiPage} />}
      </Route>
      <Route path="/documents">
        {() => <ProtectedRoute component={CourtDocumentsPage} />}
      </Route>
      <Route path="/search">
        {() => <ProtectedRoute component={SearchPage} />}
      </Route>
      <Route path="/admin">
        {() => <ProtectedRoute component={AdminPage} />}
      </Route>
      <Route path="/profile">
        {() => <ProtectedRoute component={ProfilePage} />}
      </Route>
      <Route path="/templates">
        {() => <ProtectedRoute component={TemplatesPage} />}
      </Route>
      <Route path="/welfare">
        {() => <ProtectedRoute component={WelfarePage} />}
      </Route>
      <Route path="/family-tree">
        {() => <ProtectedRoute component={FamilyTreePage} />}
      </Route>
      <Route path="/medical-notes">
        {() => <ProtectedRoute component={MedicalNotesPage} />}
      </Route>
      <Route path="/supreme-court">
        {() => <ProtectedRoute component={SupremeCourtPage} />}
      </Route>
      <Route path="/tribal-trust">
        {() => <ProtectedRoute component={TribalTrustPage} />}
      </Route>
      <Route path="/charitable-trust">
        {() => <ProtectedRoute component={CharitableTrustPage} />}
      </Route>
      <Route path="/niac">
        {() => <ProtectedRoute component={NiacPage} />}
      </Route>
      <Route path="/iee">
        {() => <ProtectedRoute component={IeePage} />}
      </Route>
      <Route path="/tribal-id">
        {() => <ProtectedRoute component={TribalIdPage} />}
      </Route>
      <Route path="/m365">
        {() => <ProtectedRoute component={M365IntegrationPage} />}
      </Route>
      <Route path="/doctrine">
        {() => (
          <ProtectedRoute
            component={() => (
              <AdminStubPage
                title="Doctrine Manager"
                description="Manage controlling legal doctrines, Indian Canons of Construction, and case law applied by the intake filter and classification engines."
              />
            )}
          />
        )}
      </Route>
      <Route path="/recorder-rules">
        {() => (
          <ProtectedRoute
            component={() => (
              <AdminStubPage
                title="Recorder Rules"
                description="Configure and maintain recorder-compliance validation rules for trust instruments, NFR documents, and court filings."
              />
            )}
          />
        )}
      </Route>
      <Route path="/welfare-acts">
        {() => (
          <ProtectedRoute
            component={() => (
              <AdminStubPage
                title="Welfare Acts"
                description="Administer welfare act instruments, emergency declarations, and benefit authorizations issued under the Office."
              />
            )}
          />
        )}
      </Route>
      <Route path="/role-delegation">
        {() => (
          <ProtectedRoute
            component={() => (
              <AdminStubPage
                title="Role Delegation"
                description="Grant and revoke role-based access permissions. Delegate officer authority and configure member access levels."
              />
            )}
          />
        )}
      </Route>
      <Route path="/audit-logs">
        {() => (
          <ProtectedRoute
            component={() => (
              <AdminStubPage
                title="Audit Logs"
                description="System-wide audit trail for all instruments, filings, court documents, NFRs, and administrative actions."
              />
            )}
          />
        )}
      </Route>

      <Route component={NotFound} />
    </Switch>
  );
}

function AuthenticatedLayout() {
  const { user } = useAuth();

  return (
    <>
      {user ? (
        <Layout>
          <AppRouter />
        </Layout>
      ) : (
        <AppRouter />
      )}
      <AuthGatedChatWidget />
      <SessionExpiryWarning />
      <Toaster />
    </>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <AuthenticatedLayout />
          </WouterRouter>
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
