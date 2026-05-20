import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "next-themes";
import NotFound from "@/pages/not-found";
import { Layout } from "@/components/layout";
import Dashboard from "@/pages/dashboard";
import Directory from "@/pages/directory";
import MemberDetail from "@/pages/member-detail";
import Forum from "@/pages/forum";
import ForumPost from "@/pages/forum-post";
import Announcements from "@/pages/announcements";
import Admin from "@/pages/admin";
import University from "@/pages/university";
import ProfilePage from "@/pages/profile";
import Legal from "@/pages/legal";
import PhotoManager from "@/pages/photos";
import { ChatManagerProvider } from "@/components/ChatManager";
import { getSovereignSession } from "@/lib/utils";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 0,
      refetchOnWindowFocus: true,
    },
  },
});

function getSessionToken(): string | null {
  try {
    const raw = localStorage.getItem("sovereign_auth_v3");
    if (raw) {
      const s = JSON.parse(raw) as {
        sessionToken?: string;
        user?: { id?: string | number; email?: string; name?: string; roles?: string[] };
      };
      if (s.sessionToken) return s.sessionToken;
      // Dev mode: no sessionToken — synthesize a dev token from stored user
      if (s.user?.email) {
        const u = s.user;
        const id = String(u.id ?? u.email ?? "");
        if (id && u.email) {
          return btoa(JSON.stringify({
            id,
            email: u.email,
            name: u.name ?? u.email,
            roles: Array.isArray(u.roles) ? u.roles : ["member"],
          }));
        }
      }
    }
  } catch { /* ignore */ }
  return null;
}

function Router() {
  return (
    <Layout>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/directory" component={Directory} />
        <Route path="/directory/:id" component={MemberDetail} />
        <Route path="/forum" component={Forum} />
        <Route path="/forum/:id" component={ForumPost} />
        <Route path="/announcements" component={Announcements} />
        <Route path="/admin" component={Admin} />
        <Route path="/university" component={University} />
        <Route path="/profile" component={ProfilePage} />
        <Route path="/legal" component={Legal} />
        <Route path="/photos" component={PhotoManager} />
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

const OFFICE_LOGIN = "https://office.mathiaseltribe.org/login";

function AuthGuard({ children }: { children: React.ReactNode }) {
  const session = getSovereignSession();
  if (!session) {
    const next = encodeURIComponent(window.location.href);
    window.location.replace(`${OFFICE_LOGIN}?next=${next}`);
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground text-sm">Redirecting to Sovereign Office sign in…</p>
      </div>
    );
  }
  return <>{children}</>;
}

function App() {
  const session = getSovereignSession();
  const currentUserId = session?.id ? parseInt(session.id, 10) : null;
  const token = getSessionToken();

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
        <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <AuthGuard>
              <ChatManagerProvider currentUserId={currentUserId} token={token}>
                <Router />
              </ChatManagerProvider>
            </AuthGuard>
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
