import { Link, useLocation } from "wouter";
import { useAuth, ELDER_ROLES } from "@/lib/auth";
import { getRoleConfig } from "@/lib/role-config";
import { cn } from "@/lib/utils";
import { LogOut, ChevronRight, Plus } from "lucide-react";

export function Layout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const [location] = useLocation();

  const roles = user?.roles ?? [];
  const config = getRoleConfig(roles);

  const identityTag = roles.find((r) => ELDER_ROLES.has(r));

  const groups = config.navItems.reduce<Record<string, typeof config.navItems>>((acc, item) => {
    const g = item.group ?? "";
    if (!acc[g]) acc[g] = [];
    acc[g].push(item);
    return acc;
  }, {});

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <aside className="w-64 flex-shrink-0 bg-sidebar text-sidebar-foreground flex flex-col border-r border-sidebar-border">
        <div className="px-5 py-5 border-b border-sidebar-border">
          <div className="flex flex-col items-center text-center gap-2">
            <img
              src="/dashboard/tribal-seal.png"
              alt="Office of the Chief Justice and Trustee — Mathias El Tribe"
              className="w-20 h-20 object-contain drop-shadow-md"
            />
            <div className="min-w-0">
              <p className="text-xs font-semibold text-sidebar-primary leading-tight truncate">
                Mathias El Tribe
              </p>
              <p className="text-[10px] text-sidebar-foreground/60 leading-tight truncate">
                Office of the Chief Justice & Trustee
              </p>
            </div>
          </div>
        </div>

        <nav className="flex-1 py-4 px-3 space-y-4 overflow-y-auto">
          {Object.entries(groups).map(([group, items]) => (
            <div key={group}>
              {group && (
                <p className="px-3 mb-1 text-[10px] font-semibold uppercase tracking-widest text-sidebar-foreground/40">
                  {group}
                </p>
              )}
              <div className="space-y-0.5">
                {items.map((item) => {
                  const Icon = item.icon;
                  const active =
                    location === item.href ||
                    (item.href !== "/" && location.startsWith(item.href));
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
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
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}

          {config.canCreateInstrument && (
            <div className="pt-1">
              <Link
                href="/instruments/new"
                className="flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium bg-sidebar-primary/10 text-sidebar-primary hover:bg-sidebar-primary hover:text-sidebar-primary-foreground transition-colors"
              >
                <Plus className="w-4 h-4 flex-shrink-0" />
                New Instrument
              </Link>
            </div>
          )}
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
                <p className="text-[10px] text-sidebar-foreground/50 truncate">
                  {identityTag ? config.roleLabel : config.roleLabel}
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

      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}
