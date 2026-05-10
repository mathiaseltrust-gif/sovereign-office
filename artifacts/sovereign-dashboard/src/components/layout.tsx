import { Link, useLocation, useRouter } from "wouter";
import { useAuth, roleLandingPath, type Role } from "./auth-provider";

const ROLE_LABELS: Record<Role, string> = {
  trustee: "Chief Justice & Trustee",
  officer: "Officer",
  member: "Member",
  sovereign_admin: "Sovereign Admin",
};

interface NavSection {
  label: string;
  items: Array<{ href: string; label: string; highlight?: boolean }>;
}

function getCoreNav(role: Role): NavSection["items"] {
  const common = [
    { href: "/notifications", label: "Notifications", highlight: true },
    { href: "/calendar", label: "Calendar" },
    { href: "/search", label: "Search" },
    { href: "/profile", label: "Profile & Identity" },
  ];

  if (role === "member") {
    return [
      { href: "/dashboard/member", label: "Dashboard" },
      { href: "/filings", label: "Filings" },
      { href: "/welfare", label: "Welfare Instruments" },
      { href: "/complaints", label: "Complaints" },
      { href: "/family-tree", label: "Family Tree & Lineage" },
      { href: "/medical-notes", label: "Medical Notes" },
      ...common,
    ];
  }

  if (role === "officer") {
    return [
      { href: "/dashboard/officer", label: "Dashboard" },
      { href: "/complaints", label: "Complaints" },
      { href: "/welfare", label: "Welfare Instruments" },
      { href: "/classify", label: "Classification" },
      { href: "/tasks", label: "Tasks" },
      { href: "/nfr", label: "Notice of Federal Review" },
      { href: "/family-tree", label: "Family Tree & Lineage" },
      { href: "/medical-notes", label: "Medical Notes" },
      ...common,
    ];
  }

  return [
    { href: "/dashboard/trustee", label: "Dashboard" },
    { href: "/instruments", label: "Trust Instruments" },
    { href: "/filings", label: "Filings" },
    { href: "/nfr", label: "Notice of Federal Review" },
    { href: "/welfare", label: "Welfare Instruments" },
    { href: "/documents", label: "Court Documents" },
    { href: "/classify", label: "Classification" },
    { href: "/complaints", label: "Complaints" },
    { href: "/tasks", label: "Tasks" },
    { href: "/family-tree", label: "Family Tree & Lineage" },
    { href: "/medical-notes", label: "Medical Notes" },
    ...common,
  ];
}

function getAdminNav(role: Role): NavSection["items"] | null {
  if (role === "member") return null;

  const officerAdminItems = [
    { href: "/law", label: "Law Library" },
    { href: "/intake-ai", label: "AI Intake Review" },
  ];

  if (role === "officer") return officerAdminItems;

  return [
    { href: "/law", label: "Law Library" },
    { href: "/intake-ai", label: "AI Intake Review" },
    { href: "/templates", label: "Templates" },
    ...(role === "sovereign_admin"
      ? [
          { href: "/doctrine", label: "Doctrine" },
          { href: "/recorder-rules", label: "Recorder Rules" },
          { href: "/welfare-acts", label: "Welfare Acts" },
          { href: "/role-delegation", label: "Role Delegation" },
          { href: "/audit-logs", label: "Audit Logs" },
          { href: "/admin", label: "System Configuration" },
        ]
      : []),
  ];
}

export function Layout({ children }: { children: React.ReactNode }) {
  const { activeRole, switchRole } = useAuth();
  const [location] = useLocation();

  const coreNav = getCoreNav(activeRole);
  const adminNav = getAdminNav(activeRole);

  function handleRoleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    switchRole(e.target.value as Role);
  }

  return (
    <div className="flex h-screen bg-background overflow-hidden font-sans">
      <aside className="w-64 border-r bg-card flex flex-col shrink-0">
        <div className="p-5 border-b">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-[0.18em] mb-1">
            Office of the
          </p>
          <h1 className="font-serif text-base font-bold text-primary leading-tight">
            Chief Justice and Trustee
          </h1>
          <div className="mt-2 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-secondary text-xs text-muted-foreground font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 shrink-0" />
            {ROLE_LABELS[activeRole]}
          </div>
        </div>

        <nav className="flex-1 p-3 overflow-y-auto space-y-4">
          <div>
            <p className="px-3 mb-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              Core
            </p>
            <div className="space-y-0.5">
              {coreNav.map((item) => (
                <NavLink key={item.href} href={item.href} label={item.label} location={location} highlight={item.highlight} />
              ))}
            </div>
          </div>

          {adminNav && adminNav.length > 0 && (
            <div>
              <p className="px-3 mb-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                {activeRole === "sovereign_admin" ? "Administration" : "Resources"}
              </p>
              <div className="space-y-0.5">
                {adminNav.map((item) => (
                  <NavLink key={item.href} href={item.href} label={item.label} location={location} />
                ))}
              </div>
            </div>
          )}
        </nav>

        <div className="p-3 border-t space-y-1">
          <p className="px-1 text-[10px] text-muted-foreground uppercase tracking-widest font-semibold">
            View as
          </p>
          <select
            value={activeRole}
            onChange={handleRoleChange}
            className="w-full bg-input text-foreground border rounded-md p-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="trustee">Chief Justice &amp; Trustee</option>
            <option value="officer">Officer</option>
            <option value="member">Member</option>
            <option value="sovereign_admin">Sovereign Admin</option>
          </select>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto bg-background">
        <div className="max-w-6xl mx-auto p-8">
          {children}
        </div>
      </main>
    </div>
  );
}

function NavLink({
  href,
  label,
  location,
  highlight,
}: {
  href: string;
  label: string;
  location: string;
  highlight?: boolean;
}) {
  const active = location === href || (href.length > 1 && location.startsWith(href));
  return (
    <Link
      href={href}
      className={[
        "block px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
        active
          ? "bg-primary text-primary-foreground"
          : highlight
          ? "text-amber-700 dark:text-amber-400 hover:bg-secondary hover:text-foreground font-semibold"
          : "text-muted-foreground hover:bg-secondary hover:text-foreground",
      ].join(" ")}
    >
      {label}
    </Link>
  );
}
