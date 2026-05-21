import { useState } from "react";
import { Link, useRoute } from "wouter";
import {
  Shield,
  LayoutDashboard,
  FilePlus2,
  Flag,
  Activity,
  Users,
  Menu,
  X,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getAuthState } from "@/lib/auth";

const navItems = [
  {
    path: "/",
    label: "Matter Queue",
    icon: LayoutDashboard,
    description: "Dashboard & active matters",
  },
  {
    path: "/matters/new",
    label: "New Matter",
    icon: FilePlus2,
    description: "Submit a new matter for review",
  },
  {
    path: "/niac",
    label: "NIAC Review",
    icon: Flag,
    description: "Indigenous rights review queue",
  },
  {
    path: "/monitoring",
    label: "Monitoring",
    icon: Activity,
    description: "Long-term case monitoring",
  },
  {
    path: "/access",
    label: "Access Management",
    icon: Users,
    description: "Grant or revoke TRACE access",
  },
];

function NavLink({ path, label, icon: Icon, description }: (typeof navItems)[0]) {
  const exactPath = path === "/" ? "/" : path;
  const [isMatch] = useRoute(exactPath);
  return (
    <Link href={path}>
      <div
        className={cn(
          "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm transition-colors cursor-pointer hover-elevate",
          isMatch
            ? "bg-sidebar-accent text-sidebar-primary font-medium"
            : "text-sidebar-foreground/80 hover:text-sidebar-foreground"
        )}
      >
        <Icon className="h-4 w-4 shrink-0" />
        <div className="min-w-0">
          <div className="truncate">{label}</div>
          {isMatch && (
            <div className="text-xs text-sidebar-foreground/50 truncate mt-0.5">{description}</div>
          )}
        </div>
        {isMatch && <ChevronRight className="h-3.5 w-3.5 shrink-0 ml-auto text-sidebar-primary/70" />}
      </div>
    </Link>
  );
}

interface LayoutProps {
  children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const auth = getAuthState();

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex flex-col w-64 bg-sidebar border-r border-sidebar-border transition-transform duration-200",
          "lg:static lg:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex items-center gap-3 px-4 py-5 border-b border-sidebar-border">
          <div className="flex h-9 w-9 items-center justify-center rounded-md bg-sidebar-primary shrink-0">
            <Shield className="h-5 w-5 text-sidebar-primary-foreground" />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold text-sidebar-primary leading-tight truncate">
              TRACE
            </div>
            <div className="text-xs text-sidebar-foreground/50 leading-tight">
              Compliance Engine
            </div>
          </div>
          <button
            className="ml-auto lg:hidden text-sidebar-foreground/60 hover:text-sidebar-foreground"
            onClick={() => setMobileOpen(false)}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          <div className="px-3 pb-2">
            <p className="text-xs font-medium text-sidebar-foreground/40 uppercase tracking-wider">
              Navigation
            </p>
          </div>
          {navItems.map((item) => (
            <NavLink key={item.path} {...item} />
          ))}
        </nav>

        <div className="border-t border-sidebar-border px-3 py-3">
          {auth ? (
            <div className="flex items-center gap-2.5 px-2">
              <div className="h-7 w-7 rounded-full bg-sidebar-accent flex items-center justify-center shrink-0">
                <span className="text-xs font-medium text-sidebar-foreground">
                  {auth.user.name?.charAt(0)?.toUpperCase() ?? "?"}
                </span>
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-xs font-medium text-sidebar-foreground truncate">
                  {auth.user.name}
                </div>
                <div className="text-xs text-sidebar-foreground/50 truncate">
                  {auth.user.roles[0] ?? "member"}
                </div>
              </div>
            </div>
          ) : (
            <div className="px-2 text-xs text-sidebar-foreground/50">Not signed in</div>
          )}
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="flex items-center gap-3 px-5 py-3 border-b border-border bg-card shrink-0">
          <button
            onClick={() => setMobileOpen(true)}
            className="lg:hidden text-foreground/60 hover:text-foreground mr-1 shrink-0"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="min-w-0">
            <div className="text-sm font-semibold text-foreground leading-tight">
              TRACE — Tribal Rights &amp; Administrative Compliance Engine
            </div>
            <div className="text-xs text-muted-foreground leading-tight">
              Mathias El Tribe — Sovereign Procedural Intelligence Portal
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
