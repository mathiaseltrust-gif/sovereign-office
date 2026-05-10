import { Link, useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";
import {
  FileText,
  FolderOpen,
  LayoutDashboard,
  LogOut,
  Scale,
  Plus,
  ChevronRight,
} from "lucide-react";

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

const NAV_ITEMS: NavItem[] = [
  { label: "Overview", href: "/", icon: LayoutDashboard },
  { label: "Instruments", href: "/instruments", icon: FolderOpen },
  { label: "Filings", href: "/filings", icon: FileText },
];

export function Layout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const [location] = useLocation();

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <aside className="w-64 flex-shrink-0 bg-sidebar text-sidebar-foreground flex flex-col border-r border-sidebar-border">
        <div className="px-5 py-5 border-b border-sidebar-border">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-sidebar-primary flex items-center justify-center flex-shrink-0">
              <Scale className="w-4 h-4 text-sidebar-primary-foreground" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-sidebar-primary leading-tight truncate">
                Sovereign Office
              </p>
              <p className="text-[10px] text-sidebar-foreground/60 leading-tight truncate">
                Chief Justice & Trustee
              </p>
            </div>
          </div>
        </div>

        <nav className="flex-1 py-4 px-3 space-y-0.5 overflow-y-auto">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = location === item.href || (item.href !== "/" && location.startsWith(item.href));
            return (
              <Link key={item.href} href={item.href}>
                <a
                  className={cn(
                    "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                    active
                      ? "bg-sidebar-primary text-sidebar-primary-foreground"
                      : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground",
                  )}
                >
                  <Icon className="w-4 h-4 flex-shrink-0" />
                  {item.label}
                  {active && <ChevronRight className="w-3 h-3 ml-auto opacity-60" />}
                </a>
              </Link>
            );
          })}

          <div className="pt-3 mt-3 border-t border-sidebar-border">
            <Link href="/instruments/new">
              <a className="flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium bg-sidebar-primary/10 text-sidebar-primary hover:bg-sidebar-primary hover:text-sidebar-primary-foreground transition-colors">
                <Plus className="w-4 h-4 flex-shrink-0" />
                New Instrument
              </a>
            </Link>
          </div>
        </nav>

        <div className="px-3 py-4 border-t border-sidebar-border">
          {user && (
            <div className="flex items-center gap-3 px-2 py-2">
              <div className="w-7 h-7 rounded-full bg-sidebar-accent flex items-center justify-center flex-shrink-0">
                <span className="text-xs font-bold text-sidebar-foreground">
                  {user.name?.charAt(0)?.toUpperCase() ?? "U"}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-sidebar-foreground truncate">{user.name}</p>
                <p className="text-[10px] text-sidebar-foreground/50 truncate capitalize">
                  {user.roles.join(", ")}
                </p>
              </div>
              <button
                onClick={logout}
                className="p-1 rounded hover:bg-sidebar-accent text-sidebar-foreground/50 hover:text-sidebar-foreground transition-colors"
                title="Sign out"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
