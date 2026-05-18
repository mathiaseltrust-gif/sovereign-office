import { useState } from "react";
import { Link, useRoute } from "wouter";
import {
  Building2,
  FileSearch,
  BookOpen,
  Scale,
  Menu,
  X,
  ChevronRight,
  LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getAuthState } from "@/lib/auth";

const navItems = [
  {
    path: "/jurisdiction",
    label: "Jurisdiction & Agencies",
    icon: Building2,
    description: "Look up agencies by jurisdiction",
  },
  {
    path: "/intake",
    label: "Document Intake",
    icon: FileSearch,
    description: "Analyze documents for routing",
  },
  {
    path: "/matters",
    label: "Matter Type Reference",
    icon: BookOpen,
    description: "Browse all 17 matter types",
  },
  {
    path: "/legal-map",
    label: "Legal Authority Map",
    icon: Scale,
    description: "Applicable laws and doctrines",
  },
];

function NavLink({ path, label, icon: Icon, description }: (typeof navItems)[0]) {
  const [isMatch] = useRoute(path);
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
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex flex-col w-64 bg-sidebar border-r border-sidebar-border transition-transform duration-200",
          "lg:static lg:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Brand */}
        <div className="flex items-center gap-3 px-4 py-5 border-b border-sidebar-border">
          <div className="flex h-9 w-9 items-center justify-center rounded-md bg-sidebar-primary shrink-0">
            <Scale className="h-5 w-5 text-sidebar-primary-foreground" />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold text-sidebar-primary leading-tight truncate">
              Authority Directory
            </div>
            <div className="text-xs text-sidebar-foreground/50 leading-tight">
              Oversight Routing
            </div>
          </div>
          <button
            className="ml-auto lg:hidden text-sidebar-foreground/60 hover:text-sidebar-foreground"
            onClick={() => setMobileOpen(false)}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Nav */}
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

        {/* User footer */}
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
                  {auth.user.role}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 px-2 text-xs text-sidebar-foreground/50">
              <LogOut className="h-3.5 w-3.5" />
              <span>Not signed in</span>
            </div>
          )}
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile header */}
        <header className="lg:hidden flex items-center gap-3 px-4 py-3 border-b border-border bg-card shrink-0">
          <button
            onClick={() => setMobileOpen(true)}
            className="text-foreground/60 hover:text-foreground"
          >
            <Menu className="h-5 w-5" />
          </button>
          <span className="text-sm font-semibold text-foreground">Authority Directory</span>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
