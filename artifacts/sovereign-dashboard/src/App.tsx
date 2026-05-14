import { lazy, Suspense } from "react";
import { Switch, Route, Router as WouterRouter, Redirect, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth, roleLandingPath } from "@/components/auth-provider";
import { Layout } from "@/components/layout";
import { ChatWidget } from "@/components/ChatWidget";
import { SessionExpiryWarning } from "@/components/SessionExpiryWarning";

const Login = lazy(() => import("@/pages/login"));
const MicrosoftCallback = lazy(() => import("@/pages/MicrosoftCallback"));
const NotFound = lazy(() => import("@/pages/not-found"));
const TrusteeDashboard = lazy(() => import("@/pages/dashboard-trustee"));
const OfficerDashboard = lazy(() => import("@/pages/dashboard-officer"));
const MemberDashboard = lazy(() => import("@/pages/dashboard-member"));
const AdminDashboard = lazy(() => import("@/pages/dashboard-admin"));
const ElderDashboard = lazy(() => import("@/pages/dashboard-elder"));
const MedicalProviderDashboard = lazy(() => import("@/pages/dashboard-medical-provider"));
const VisitorDashboard = lazy(() => import("@/pages/dashboard-visitor"));
const InstrumentsPage = lazy(() => import("@/pages/instruments"));
const InstrumentDetail = lazy(() => import("@/pages/instrument-detail"));
const FilingsListPage = lazy(() => import("@/pages/filings").then(m => ({ default: m.FilingsListPage })));
const FilingDetailPage = lazy(() => import("@/pages/filings").then(m => ({ default: m.FilingDetailPage })));
const NfrPage = lazy(() => import("@/pages/nfr"));
const ClassifyPage = lazy(() => import("@/pages/classify"));
const ComplaintsListPage = lazy(() => import("@/pages/complaints").then(m => ({ default: m.ComplaintsListPage })));
const ComplaintDetailPage = lazy(() => import("@/pages/complaints").then(m => ({ default: m.ComplaintDetailPage })));
const TasksPage = lazy(() => import("@/pages/tasks"));
const CalendarPage = lazy(() => import("@/pages/calendar"));
const SearchPage = lazy(() => import("@/pages/search"));
const AdminPage = lazy(() => import("@/pages/admin"));
const ProfilePage = lazy(() => import("@/pages/profile"));
const TemplatesPage = lazy(() => import("@/pages/templates"));
const WelfarePage = lazy(() => import("@/pages/welfare"));
const NotificationsPage = lazy(() => import("@/pages/notifications"));
const LawLibraryPage = lazy(() => import("@/pages/law"));
const IntakeAiPage = lazy(() => import("@/pages/intake-ai"));
const CourtDocumentsPage = lazy(() => import("@/pages/court-documents"));
const FamilyTreePage = lazy(() => import("@/pages/family-tree"));
const MedicalNotesPage = lazy(() => import("@/pages/medical-notes"));
const SupremeCourtPage = lazy(() => import("@/pages/supreme-court"));
const TribalTrustPage = lazy(() => import("@/pages/tribal-trust"));
const CharitableTrustPage = lazy(() => import("@/pages/charitable-trust"));
const NiacPage = lazy(() => import("@/pages/niac"));
const IeePage = lazy(() => import("@/pages/iee"));
const AdminStubPage = lazy(() => import("@/pages/admin-stub"));
const TribalIdPage = lazy(() => import("@/pages/tribal-id"));
const M365IntegrationPage = lazy(() => import("@/pages/m365-integration"));
const AdminLineageImportPage = lazy(() => import("@/pages/admin-lineage-import"));
const BusinessCanvas = lazy(() => import("@/pages/business-canvas"));
const BusinessCanvasWizard = lazy(() => import("@/pages/business-canvas-wizard"));
const BusinessConceptDetail = lazy(() => import("@/pages/business-canvas-detail"));
const OnboardingLineagePage = lazy(() => import("@/pages/onboarding-lineage"));
const OnboardingPendingPage = lazy(() => import("@/pages/onboarding-pending"));
const HubPage = lazy(() => import("@/pages/hub"));
const GweLetterPage = lazy(() => import("@/pages/gwe-letter"));
const MembershipPage = lazy(() => import("@/pages/membership"));
const ElderAdvisoryPage = lazy(() => import("@/pages/elder-advisory"));
const FamilyGovernancePage = lazy(() => import("@/pages/family-governance"));
const OrgOverviewPage = lazy(() => import("@/pages/org"));
const DraftsPage = lazy(() => import("@/pages/drafts"));
const FilesPage = lazy(() => import("@/pages/documents"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error) => {
        if ((error as { status?: number })?.status === 401) return false;
        return failureCount < 1;
      },
      staleTime: 5 * 60_000,
      gcTime: 15 * 60_000,
      refetchOnWindowFocus: false,
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

const PENDING_ALLOWED_PATHS = new Set(["/onboarding/lineage", "/onboarding/pending", "/notifications", "/dashboard/visitor", "/profile", "/login", "/hub"]);

function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  const { user, lineagePending } = useAuth();
  const [location] = useLocation();

  if (!user) {
    const returnTo = encodeURIComponent(location);
    return <Redirect to={`/login?next=${returnTo}`} />;
  }

  if (lineagePending && !PENDING_ALLOWED_PATHS.has(location)) {
    return <Redirect to="/onboarding/pending" />;
  }

  return <Component />;
}

function ProtectedParamRoute({ children }: { children: React.ReactNode }) {
  const { user, lineagePending } = useAuth();
  const [location] = useLocation();

  if (!user) {
    const returnTo = encodeURIComponent(location);
    return <Redirect to={`/login?next=${returnTo}`} />;
  }

  if (lineagePending && !PENDING_ALLOWED_PATHS.has(location)) {
    return <Redirect to="/onboarding/pending" />;
  }

  return <>{children}</>;
}

function AppRouter() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/microsoft/callback" component={MicrosoftCallback} />

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
      <Route path="/files">
        {() => <ProtectedRoute component={FilesPage} />}
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
      <Route path="/admin/lineage-import">
        {() => <ProtectedRoute component={AdminLineageImportPage} />}
      </Route>
      <Route path="/business-canvas/new">
        {() => <ProtectedRoute component={BusinessCanvasWizard} />}
      </Route>
      <Route path="/business-canvas/:id">
        {(params) => (
          <ProtectedParamRoute>
            <BusinessConceptDetail params={params} />
          </ProtectedParamRoute>
        )}
      </Route>
      <Route path="/business-canvas">
        {() => <ProtectedRoute component={BusinessCanvas} />}
      </Route>
      <Route path="/hub">
        {() => <ProtectedRoute component={HubPage} />}
      </Route>
      <Route path="/gwe-letter">
        {() => <ProtectedRoute component={GweLetterPage} />}
      </Route>
      <Route path="/membership">
        {() => <ProtectedRoute component={MembershipPage} />}
      </Route>
      <Route path="/elder-advisory">
        {() => <ProtectedRoute component={ElderAdvisoryPage} />}
      </Route>
      <Route path="/family-governance">
        {() => <ProtectedRoute component={FamilyGovernancePage} />}
      </Route>
      <Route path="/org">
        {() => <ProtectedRoute component={OrgOverviewPage} />}
      </Route>
      <Route path="/drafts">
        {() => <ProtectedRoute component={DraftsPage} />}
      </Route>
      <Route path="/onboarding/lineage">
        {() => <ProtectedRoute component={OnboardingLineagePage} />}
      </Route>
      <Route path="/onboarding/pending">
        {() => <ProtectedRoute component={OnboardingPendingPage} />}
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

function PageFallback() {
  return (
    <div className="flex items-center justify-center min-h-[40vh]">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
        <p className="text-xs text-muted-foreground">Loading…</p>
      </div>
    </div>
  );
}

function AuthenticatedLayout() {
  const { user } = useAuth();

  return (
    <>
      {user ? (
        <Layout>
          <Suspense fallback={<PageFallback />}>
            <AppRouter />
          </Suspense>
        </Layout>
      ) : (
        <Suspense fallback={<PageFallback />}>
          <AppRouter />
        </Suspense>
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
