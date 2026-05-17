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
      const s = JSON.parse(raw) as { token?: string };
      if (s.token) return s.token;
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
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
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
            <ChatManagerProvider currentUserId={currentUserId} token={token}>
              <Router />
            </ChatManagerProvider>
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
