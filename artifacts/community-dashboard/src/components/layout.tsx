import React, { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { COMMUNITY_TOKEN_KEY } from "@/lib/utils";
import {
  Home,
  MessageSquare,
  Megaphone,
  Menu,
  Sun,
  Moon,
  Shield,
  Users,
  X,
  LogOut,
  GraduationCap,
  UserCircle,
  Globe2,
  ExternalLink,
  TreePine,
  FolderOpen,
  Camera,
} from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { getSovereignSession } from "@/lib/utils";
import { useChatManager } from "@/components/ChatManager";
import { CommandPalette } from "./CommandPalette";
import { useCommandPalette } from "@/hooks/useCommandPalette";

const LS_RECENT_KEY = "sovereign_recent_pages_v1";
const LS_PREFIX = "community:";
function recordCommunityPage(path: string) {
  if (!path) return;
  try {
    const existing: string[] = JSON.parse(localStorage.getItem(LS_RECENT_KEY) ?? "[]");
    const key = LS_PREFIX + path;
    localStorage.setItem(LS_RECENT_KEY, JSON.stringify([key, ...existing.filter(p => p !== key)].slice(0, 10)));
  } catch { /* non-fatal */ }
}

const navigation: { name: string; href: string; icon: React.ElementType; external?: boolean; externalHref?: string; badge?: string }[] = [
  { name: "Dashboard", href: "/", icon: Home },
  { name: "Family Directory", href: "/directory", icon: Users },
  { name: "Community Forum", href: "/forum", icon: MessageSquare },
  { name: "Announcements", href: "/announcements", icon: Megaphone },
  { name: "SDU University", href: "/university", icon: GraduationCap },
  { name: "My Profile", href: "/profile", icon: UserCircle },
  { name: "Admin", href: "/admin", icon: Shield },
  { name: "Photo Manager", href: "/photos", icon: Camera },
  {
    name: "Tribal Heritage",
    href: "#heritage",
    icon: TreePine,
    external: true,
    externalHref: "/sovereign-dashboard/ancestral-affiliations",
    badge: "Heritage",
  },
  {
    name: "Ancestral Atlas",
    href: "#atlas",
    icon: Globe2,
    external: true,
    externalHref: "/atlas/?mode=atlas",
    badge: "Atlas",
  },
  {
    name: "Case File Registry",
    href: "#casefiles",
    icon: FolderOpen,
    external: true,
    externalHref: "/authority/case-files",
    badge: "Cases",
  },
];

const MOBILE_NAV_HREFS = ["/", "/directory", "/forum", "/announcements", "/profile"];
const mobileNav = navigation.filter((item) => MOBILE_NAV_HREFS.includes(item.href));

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const [location] = useLocation();
  const { totalUnread } = useChatManager();
  return (
    <div className="space-y-0.5">
      {navigation.map((item) => {
        const isActive =
          !item.external &&
          (location === item.href ||
          (item.href !== "/" && location.startsWith(item.href)));
        const showBadge = item.href === "/directory" && totalUnread > 0;

        if (item.external && item.externalHref) {
          return (
            <a
              key={item.name}
              href={item.externalHref}
              target="_blank"
              rel="noopener noreferrer"
              onClick={onNavigate}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors cursor-pointer text-muted-foreground hover:bg-secondary hover:text-foreground group"
              data-testid="ancestral-atlas-nav-link"
            >
              <item.icon className="h-4 w-4 shrink-0" />
              <span className="font-medium text-sm">{item.name}</span>
              {item.badge && (
                <span className="ml-auto text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded bg-primary/15 text-primary border border-primary/20 group-hover:bg-primary/25 transition-colors">
                  {item.badge}
                </span>
              )}
              <ExternalLink className="w-3 h-3 opacity-40 group-hover:opacity-70 transition-opacity ml-0.5" />
            </a>
          );
        }

        return (
          <Link key={item.name} href={item.href} onClick={onNavigate}>
            <div
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors cursor-pointer ${
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground"
              }`}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              <span className="font-medium text-sm">{item.name}</span>
              {item.name === "Admin" && (
                <span className="ml-auto text-[10px] font-semibold uppercase tracking-wider opacity-60">Office</span>
              )}
              {showBadge && (
                <span className="ml-auto bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                  {totalUnread > 9 ? "9+" : totalUnread}
                </span>
              )}
            </div>
          </Link>
        );
      })}
    </div>
  );
}

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { theme, setTheme } = useTheme();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sessionUser, setSessionUser] = useState<{ name: string; email: string } | null>(null);
  const { totalUnread: dmUnread } = useChatManager();
  const { open: paletteOpen, openPalette, closePalette } = useCommandPalette();

  useEffect(() => { recordCommunityPage(location); }, [location]);

  useEffect(() => {
    const u = getSovereignSession();
    if (u) setSessionUser({ name: u.name, email: u.email });
  }, []);

  const initials = sessionUser?.name?.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2) ?? null;

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col md:flex-row">
      <CommandPalette open={paletteOpen} onClose={closePalette} />
      {/* Mobile header */}
      <header className="md:hidden flex items-center justify-between px-4 py-3 border-b bg-card sticky top-0 z-30 shadow-sm">
        <Link href="/">
          <div className="flex items-center gap-2.5 cursor-pointer">
            <img src={`${import.meta.env.BASE_URL}tribal-seal.png`} alt="Mathias El Tribe Seal" className="h-9 w-9 object-contain rounded-full" />
            <span className="font-bold text-base leading-tight">Mathias El Tribe</span>
          </div>
        </Link>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          >
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setMobileMenuOpen((v) => !v)}
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>
      </header>

      {/* Mobile slide-out menu */}
      {mobileMenuOpen && (
        <>
          <div
            className="md:hidden fixed inset-0 bg-black/40 z-40 backdrop-blur-sm"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="md:hidden fixed top-0 left-0 h-full w-72 bg-card border-r z-50 flex flex-col shadow-xl animate-in slide-in-from-left duration-200">
            <Link href="/" onClick={() => setMobileMenuOpen(false)}>
              <div className="p-4 border-b flex items-center gap-2.5 cursor-pointer hover:bg-muted/30 transition-colors">
                <img src={`${import.meta.env.BASE_URL}tribal-seal.png`} alt="Mathias El Tribe Seal" className="h-9 w-9 object-contain rounded-full shrink-0" />
                <div>
                  <p className="font-bold text-base leading-none">Mathias El Tribe</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Community Center</p>
                </div>
              </div>
            </Link>
            <div className="flex-1 overflow-auto p-3">
              <NavLinks onNavigate={() => setMobileMenuOpen(false)} />
            </div>
            <div className="p-3 border-t">
              <Button
                variant="outline"
                className="w-full justify-start gap-2 text-sm"
                onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              >
                {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                {theme === "dark" ? "Light Mode" : "Dark Mode"}
              </Button>
            </div>
          </div>
        </>
      )}

      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-60 flex-col border-r bg-card h-screen sticky top-0">
        <div className="p-4 border-b">
          <Link href="/">
            <div className="flex items-center gap-2.5 cursor-pointer group">
              <img src={`${import.meta.env.BASE_URL}tribal-seal.png`} alt="Mathias El Tribe Seal" className="h-9 w-9 object-contain rounded-full shrink-0 group-hover:opacity-80 transition-opacity" />
              <div className="min-w-0">
                <p className="font-bold text-sm leading-tight truncate group-hover:text-primary transition-colors">Mathias El Tribe</p>
                <p className="text-xs text-muted-foreground mt-0.5 truncate">Community Center</p>
              </div>
            </div>
          </Link>
          {sessionUser && (
            <div className="mt-3 flex items-center gap-2 bg-muted/50 rounded-lg px-2.5 py-2">
              <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center shrink-0">
                <span className="text-[10px] font-bold text-primary-foreground">{initials}</span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-foreground truncate">{sessionUser.name}</p>
              </div>
            </div>
          )}
        </div>
        <div className="flex-1 overflow-auto p-3">
          <NavLinks />
        </div>
        <div className="p-3 border-t space-y-1">
          <Button
            variant="outline"
            className="w-full justify-start gap-2 text-sm"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          >
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            <span>{theme === "dark" ? "Light Mode" : "Dark Mode"}</span>
          </Button>
          {sessionUser && (
            <Button
              variant="ghost"
              className="w-full justify-start gap-2 text-sm text-muted-foreground"
              onClick={() => { localStorage.removeItem("community_auth_user"); localStorage.removeItem(COMMUNITY_TOKEN_KEY); setSessionUser(null); }}
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </Button>
          )}
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 flex flex-col min-h-0 overflow-hidden">
        <div className="flex-1 overflow-auto p-4 pb-20 md:p-6 md:pb-6">
          <div className="max-w-5xl mx-auto w-full">
            {children}
          </div>
        </div>
      </main>

      {/* Mobile bottom navigation bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-card border-t z-30 shadow-lg">
        <div className="flex">
          {mobileNav.map((item) => {
            const isActive =
              location === item.href ||
              (item.href !== "/" && location.startsWith(item.href));
            const showBadge = item.href === "/directory" && dmUnread > 0;
            return (
              <Link key={item.name} href={item.href} className="flex-1">
                <div
                  className={`relative flex flex-col items-center justify-center py-2 gap-0.5 transition-colors ${
                    isActive ? "text-primary" : "text-muted-foreground"
                  }`}
                >
                  <item.icon className="h-5 w-5" />
                  {showBadge && (
                    <span className="absolute top-1 right-1/4 bg-red-500 text-white text-[8px] font-bold rounded-full min-w-[14px] h-[14px] flex items-center justify-center px-0.5">
                      {dmUnread > 9 ? "9+" : dmUnread}
                    </span>
                  )}
                  <span className="text-[9px] font-medium leading-none">{item.name.split(" ")[0]}</span>
                </div>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
