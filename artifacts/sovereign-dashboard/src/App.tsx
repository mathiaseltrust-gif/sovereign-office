import { lazy, Suspense, type ComponentType } from "react";
import { Switch, Route, Router as WouterRouter, Redirect, useLocation } from "wouter";
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth, roleLandingPath, getCurrentBearerToken } from "@/components/auth-provider";
import { Layout } from "@/components/layout";
import { ChatWidget } from "@/components/ChatWidget";
import { SessionExpiryWarning } from "@/components/SessionExpiryWarning";
import { ClipToCompanion } from "@/components/ClipToCompanion";
import MicrosoftCallback from "@/pages/MicrosoftCallback";
import HubPage from "@/pages/hub";
import ProfilePage from "@/pages/profile";

function lazyWithRetry(factory: () => Promise<{ default: ComponentType<any> }>) {
  return lazy(async () => {
    const key = `sovereign_chunk_retry:${window.location.pathname}`;
    try {
      const mod = await factory();
      sessionStorage.removeItem(key);
      return mod;
    } catch (error) {
      if (!sessionStorage.getItem(key)) {
        sessionStorage.setItem(key, "1");
        window.location.reload();
        return new Promise<never>(() => {});
      }
      sessionStorage.removeItem(key);
      throw error;
    }
  });
}

const CreativeStudioPage = lazyWithRetry(() => import("@/pages/creative-studio"));
const CreativeStudioProjectPage = lazyWithRetry(() => import("@/pages/creative-studio-project"));
const Login = lazyWithRetry(() => import("@/pages/login"));
const NotFound = lazyWithRetry(() => import("@/pages/not-found"));
const TrusteeDashboard = lazyWithRetry(() => import("@/pages/dashboard-trustee"));
const OfficerDashboard = lazyWithRetry(() => import("@/pages/dashboard-officer"));
const MemberDashboard = lazyWithRetry(() => import("@/pages/dashboard-member"));
const AdminDashboard = lazyWithRetry(() => import("@/pages/dashboard-admin"));
const ElderDashboard = lazyWithRetry(() => import("@/pages/dashboard-elder"));
const MedicalProviderDashboard = lazyWithRetry(() => import("@/pages/dashboard-medical-provider"));
const VisitorDashboard = lazyWithRetry(() => import("@/pages/dashboard-visitor"));
const InstrumentsPage = lazyWithRetry(() => import("@/pages/instruments"));
const InstrumentDetail = lazyWithRetry(() => import("@/pages/instrument-detail"));
const FilingsListPage = lazyWithRetry(() => import("@/pages/filings").then(m => ({ default: m.FilingsListPage })));
const FilingDetailPage = lazyWithRetry(() => import("@/pages/filings").then(m => ({ default: m.FilingDetailPage })));
const NfrPage = lazyWithRetry(() => import("@/pages/nfr"));
const InvestigationDetailPage = lazyWithRetry(() => import("@/pages/investigation-detail"));
const ClassifyPage = lazyWithRetry(() => import("@/pages/classify"));
const ComplaintsListPage = lazyWithRetry(() => import("@/pages/complaints").then(m => ({ default: m.ComplaintsListPage })));
const ComplaintDetailPage = lazyWithRetry(() => import("@/pages/complaints").then(m => ({ default: m.ComplaintDetailPage })));
const TasksPage = lazyWithRetry(() => import("@/pages/tasks"));
const CalendarPage = lazyWithRetry(() => import("@/pages/calendar"));
const SearchPage = lazyWithRetry(() => import("@/pages/search"));
const AdminPage = lazyWithRetry(() => import("@/pages/admin"));
const TemplatesPage = lazyWithRetry(() => import("@/pages/templates"));
const WelfarePage = lazyWithRetry(() => import("@/pages/welfare"));
const NotificationsPage = lazyWithRetry(() => import("@/pages/notifications"));
const LawLibraryPage = lazyWithRetry(() => import("@/pages/law"));
const IntakeAiPage = lazyWithRetry(() => import("@/pages/intake-ai"));
const IntakeCompanionPage = lazyWithRetry(() => import("@/pages/intake-companion"));
const CourtDocumentsPage = lazyWithRetry(() => import("@/pages/court-documents"));
const FamilyTreePage = lazyWithRetry(() => import("@/pages/family-tree"));
const KinshipTreePage = lazyWithRetry(() => import("@/pages/kinship-tree"));
const MedicalNotesPage = lazyWithRetry(() => import("@/pages/medical-notes"));
const SupremeCourtPage = lazyWithRetry(() => import("@/pages/supreme-court"));
const TribalTrustPage = lazyWithRetry(() => import("@/pages/tribal-trust"));
const CharitableTrustPage = lazyWithRetry(() => import("@/pages/charitable-trust"));
const NiacPage = lazyWithRetry(() => import("@/pages/niac"));
const OfficialDocumentsPage = lazyWithRetry(() => import("@/pages/official-documents"));
const SovereignPipelinePage = lazyWithRetry(() => import("@/pages/sovereign-pipeline"));
const MyOfficePage = lazyWithRetry(() => import("@/pages/my-office"));
const IeePage = lazyWithRetry(() => import("@/pages/iee"));
const SduPage = lazyWithRetry(() => import("@/pages/sdu"));
const AdminStubPage = lazyWithRetry(() => import("@/pages/admin-stub"));
const TribalIdPage = lazyWithRetry(() => import("@/pages/tribal-id"));
const M365IntegrationPage = lazyWithRetry(() => import("@/pages/m365-integration"));
const AdminLineageImportPage = lazyWithRetry(() => import("@/pages/admin-lineage-import"));
const BusinessCanvas = lazyWithRetry(() => import("@/pages/business-canvas"));
const BusinessCanvasWizard = lazyWithRetry(() => import("@/pages/business-canvas-wizard"));
const BusinessConceptDetail = lazyWithRetry(() => import("@/pages/business-canvas-detail"));
const OnboardingLineagePage = lazyWithRetry(() => import("@/pages/onboarding-lineage"));
const OnboardingPendingPage = lazyWithRetry(() => import("@/pages/onboarding-pending"));
const OnboardingCompanionPage = lazyWithRetry(() => import("@/pages/onboarding-companion"));
const GweLetterPage = lazyWithRetry(() => import("@/pages/gwe-letter"));
const MembershipPage = lazyWithRetry(() => import("@/pages/membership"));
const ElderAdvisoryPage = lazyWithRetry(() => import("@/pages/elder-advisory"));
const FamilyGovernancePage = lazyWithRetry(() => import("@/pages/family-governance"));
const OrgOverviewPage = lazyWithRetry(() => import("@/pages/org"));
const DraftsPage = lazyWithRetry(() => import("@/pages/drafts"));
const FilesPage = lazyWithRetry(() => import("@/pages/documents"));
const RoleGovernorsPage = lazyWithRetry(() => import("@/pages/role-governors"));
const InstrumentWizardPage = lazyWithRetry(() => import("@/pages/instrument-wizard"));
const AncestralAffiliationsPage = lazyWithRetry(() => import("@/pages/ancestral-affiliations"));
const AncestralMemoriesPage = lazyWithRetry(() => import("@/pages/ancestral-memories"));
const AncestorMemorialPage = lazyWithRetry(() => import("@/pages/ancestor-memorial"));
const LegalProvisionsPage = lazyWithRetry(() => import("@/pages/legal-provisions"));
const JournalPage = lazyWithRetry(() => import("@/pages/journal"));
const AncestralTimelinePage = lazyWithRetry(() => import("@/pages/ancestral-timeline"));
const SduDefinitionsPage = lazyWithRetry(() => import("@/pages/sdu-definitions"));
const LandPage = lazyWithRetry(() => import("@/pages/land"));
const AncestralExposurePage = lazyWithRetry(() => import("@/pages/ancestral-exposure"));
const GedcomImportPage = lazyWithRetry(() => import("@/pages/gedcom-import"));
const AdminEmailPreviewPage = lazyWithRetry(() => import("@/pages/admin-email-preview"));
const AdminOperationsPage = lazyWithRetry(() => import("@/pages/admin-operations"));
const AtlasAdminPage = lazyWithRetry(() => import("@/pages/atlas-admin"));
const InvestigationsListPage = lazyWithRetry(() => import("@/pages/investigations-list"));
const GitHubIntakePreviewPage = lazyWithRetry(() => import("@/pages/github-intake-preview"));

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
  const { user, activeRole } = useAuth();
  if (!user) return <Redirect to="/login" />;
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

const PENDING_ALLOWED_PATHS = new Set(["/onboarding/lineage", "/onboarding/pending", "/onboarding/companion", "/notifications", "/dashboard/visitor", "/profile", "/login", "/hub"]);

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

const ONBOARDING_EXEMPT_PATHS = new Set([
  "/onboarding/companion",
  "/onboarding/lineage",
  "/onboarding/pending",
  "/login",
  "/microsoft/callback",
]);

function CompanionOnboardingGuard({ children }: { children: React.ReactNode }) {
  const { user, lineagePending } = useAuth();
  const [location] = useLocation();

  const { data: onboardingStatus } = useQuery({
    queryKey: ["companion-onboarding-status"],
    queryFn: async () => {
      const token = getCurrentBearerToken();
      const base = (import.meta.env.BASE_URL as string).replace(/\/$/, "");
      const apiBase = base.replace(/\/sovereign-dashboard$/, "");
      try {
        const res = await fetch(`${apiBase}/api/kaya/onboarding/status`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!res.ok) return { completed: true };
        return res.json() as Promise<{ completed: boolean }>;
      } catch {
        return { completed: true };
      }
    },
    enabled: !!user && !lineagePending,
    staleTime: 15 * 60_000,
    retry: false,
  });

  if (!user || lineagePending || ONBOARDING_EXEMPT_PATHS.has(location)) {
    return <>{children}</>;
  }
  if (onboardingStatus && !onboardingStatus.completed) {
    return <Redirect to="/onboarding/companion" />;
  }
  return <>{children}</>;
}

function AppRouter() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/microsoft/callback" component={MicrosoftCallback} />

      <Route path="/" component={RootRedirect} />

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

      <Route path="/instrument-wizard">
        {() => <ProtectedRoute component={InstrumentWizardPage} />}
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
      <Route path="/investigations/:id">
        {(params) => (
          <ProtectedParamRoute>
            <InvestigationDetailPage params={params} />
          </ProtectedParamRoute>
        )}
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
      <Route path="/intake-companion">
        {() => <ProtectedRoute component={IntakeCompanionPage} />}
      </Route>
      <Route path="/intake-ai">
        {() => <ProtectedRoute component={IntakeAiPage} />}
      </Route>
      <Route path="/documents">
        {() => <ProtectedRoute component={CourtDocumentsPage} />}
      </Route>
      <Route path="/official-documents">
        {() => <ProtectedRoute component={OfficialDocumentsPage} />}
      </Route>
      <Route path="/sovereign-pipeline">
        {() => <ProtectedRoute component={SovereignPipelinePage} />}
      </Route>
      <Route path="/my-office">
        {() => <ProtectedRoute component={MyOfficePage} />}
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
      <Route path="/lineage">
        {() => <ProtectedRoute component={GedcomImportPage} />}
      </Route>
      <Route path="/family-tree">
        {() => <ProtectedRoute component={FamilyTreePage} />}
      </Route>
      <Route path="/kinship-tree">
        {() => <ProtectedRoute component={KinshipTreePage} />}
      </Route>
      <Route path="/ancestral-affiliations">
        {() => <ProtectedRoute component={AncestralAffiliationsPage} />}
      </Route>
      <Route path="/ancestral-memories">
        {() => <ProtectedRoute component={AncestralMemoriesPage} />}
      </Route>
      <Route path="/ancestors/:id/timeline">
        {() => (
          <ProtectedParamRoute>
            <AncestralTimelinePage />
          </ProtectedParamRoute>
        )}
      </Route>
      <Route path="/ancestors/:id">
        {() => (
          <ProtectedParamRoute>
            <AncestorMemorialPage />
          </ProtectedParamRoute>
        )}
      </Route>
      <Route path="/ancestors">
        {() => <ProtectedRoute component={AncestorMemorialPage} />}
      </Route>
      <Route path="/legal-provisions">
        {() => <ProtectedRoute component={LegalProvisionsPage} />}
      </Route>
      <Route path="/journal">
        {() => <ProtectedRoute component={JournalPage} />}
      </Route>
      <Route path="/medical-notes">
        {() => <ProtectedRoute component={MedicalNotesPage} />}
      </Route>
      <Route path="/medical">
        {() => <Redirect to="/medical-notes" />}
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
      <Route path="/sdu/definitions">
        {() => <ProtectedRoute component={SduDefinitionsPage} />}
      </Route>
      <Route path="/sdu">
        {() => <ProtectedRoute component={SduPage} />}
      </Route>
      <Route path="/tribal-id">
        {() => <ProtectedRoute component={TribalIdPage} />}
      </Route>
      <Route path="/m365">
        {() => <ProtectedRoute component={M365IntegrationPage} />}
      </Route>
      <Route path="/admin/lineage-import">
        {() => <Redirect to="/lineage" />}
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
      <Route path="/onboarding/companion">
        {() => <ProtectedRoute component={OnboardingCompanionPage} />}
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
      <Route path="/role-governors">
        {() => <ProtectedRoute component={RoleGovernorsPage} />}
      </Route>
      <Route path="/land">
        {() => <ProtectedRoute component={LandPage} />}
      </Route>
      <Route path="/ancestral-exposure">
        {() => <ProtectedRoute component={AncestralExposurePage} />}
      </Route>
      <Route path="/gedcom-import">
        {() => <Redirect to="/lineage" />}
      </Route>
      <Route path="/admin/email-preview">
        {() => <ProtectedRoute component={AdminEmailPreviewPage} />}
      </Route>
      <Route path="/admin/operations">
        {() => <ProtectedRoute component={AdminOperationsPage} />}
      </Route>
      <Route path="/atlas-admin">
        {() => <ProtectedRoute component={AtlasAdminPage} />}
      </Route>
      <Route path="/investigations">
        {() => <ProtectedRoute component={InvestigationsListPage} />}
      </Route>
      <Route path="/github-intake-preview">
        {() => <ProtectedRoute component={GitHubIntakePreviewPage} />}
      </Route>
      <Route path="/creative-studio/projects/:id">
        {() => <ProtectedRoute component={CreativeStudioProjectPage} />}
      </Route>
      <Route path="/creative-studio">
        {() => <ProtectedRoute component={CreativeStudioPage} />}
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
            <CompanionOnboardingGuard>
              <AppRouter />
            </CompanionOnboardingGuard>
          </Suspense>
        </Layout>
      ) : (
        <Suspense fallback={<PageFallback />}>
          <AppRouter />
        </Suspense>
      )}
      <AuthGatedChatWidget />
      <ClipToCompanion />
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
