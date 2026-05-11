import { Link, useLocation, useRouter } from "wouter";
import { useAuth, roleLandingPath, type Role } from "./auth-provider";
import { Button } from "@/components/ui/button";

const ROLE_LABELS: Record<Role, string> = {
  trustee: "Chief Justice & Trustee",
  officer: "Officer",
  member: "Member",
  sovereign_admin: "Sovereign Admin",
  elder: "Tribal Elder",
  medical_provider: "Medical Provider",
  visitor_media: "Visitor / Media",
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
    { href: "/tribal-id", label: "Tribal ID & Verification" },
  ];

  if (role === "visitor_media") {
    return [
      { href: "/dashboard/visitor", label: "Visitor Portal" },
      { href: "/search", label: "Search Public Records" },
    ];
  }

  if (role === "medical_provider") {
    return [
      { href: "/dashboard/medical-provider", label: "Medical Dashboard" },
      { href: "/medical-notes", label: "Medical Notes" },
      { href: "/family-tree", label: "Patient Lineage" },
      ...common,
    ];
  }

  if (role === "elder") {
    return [
      { href: "/dashboard/elder", label: "Elder Dashboard" },
      { href: "/family-tree", label: "Family Tree & Lineage" },
      { href: "/medical-notes", label: "Medical Notes" },
      { href: "/welfare", label: "Welfare Instruments" },
      { href: "/complaints", label: "Complaints" },
      ...common,
    ];
  }

  if (role === "member") {
    return [
      { href: "/dashboard/member", label: "Dashboard" },
      { href: "/business-canvas", label: "Business Canvas" },
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
      { href: "/business-canvas", label: "Business Canvas" },
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
    { href: "/business-canvas", label: "Business Canvas" },
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

function getOrgsNav(role: Role): NavSection["items"] {
  if (role === "visitor_media") return [];
  if (role === "medical_provider") {
    return [
      { href: "/medical-notes", label: "Medical Center" },
    ];
  }
  return [
    { href: "/medical-notes", label: "Medical Center" },
    { href: "/supreme-court", label: "Supreme Court" },
    { href: "/tribal-trust", label: "Tribal Trust" },
    { href: "/charitable-trust", label: "Charitable Trust (501c3)" },
    { href: "/niac", label: "NIAC (§527 Political)" },
    { href: "/iee", label: "Indian Economic Enterprises" },
  ];
}

function getAdminNav(role: Role): NavSection["items"] | null {
  if (role === "member" || role === "elder" || role === "medical_provider" || role === "visitor_media") return null;

  const officerAdminItems = [
    { href: "/law", label: "Law Library" },
    { href: "/intake-ai", label: "AI Intake Review" },
  ];

  if (role === "officer") return officerAdminItems;

  return [
    { href: "/law", label: "Law Library" },
    { href: "/intake-ai", label: "AI Intake Review" },
    { href: "/templates", label: "Templates" },
    ...(role === "sovereign_admin" || role === "trustee"
      ? [
          { href: "/m365", label: "Microsoft 365" },
          { href: "/admin/lineage-import", label: "Lineage Registry" },
        ]
      : []),
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
  const { activeRole, switchRole, mode, user, logout } = useAuth();
  const [location] = useLocation();

  const coreNav = getCoreNav(activeRole);
  const orgsNav = getOrgsNav(activeRole);
  const adminNav = getAdminNav(activeRole);

  function handleRoleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    switchRole(e.target.value as Role);
  }

  return (
    <div className="flex h-screen bg-background overflow-hidden font-sans">
      <aside className="w-64 border-r bg-card flex flex-col shrink-0">
        <div className="p-5 border-b flex flex-col items-center text-center">
          <img
            src={`${import.meta.env.BASE_URL}tribal-seal.png`}
            alt="Office of the Chief Justice and Trustee — Mathias El Tribe"
            className="w-20 h-20 object-contain mb-3 drop-shadow-md"
          />
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-[0.18em] mb-0.5">
            Office of the
          </p>
          <h1 className="font-serif text-sm font-bold text-primary leading-tight">
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

          {orgsNav.length > 0 && (
            <div>
              <p className="px-3 mb-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                Organizations
              </p>
              <div className="space-y-0.5">
                {orgsNav.map((item) => (
                  <NavLink key={item.href} href={item.href} label={item.label} location={location} />
                ))}
              </div>
            </div>
          )}

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

        <div className="p-3 border-t space-y-2">
          <div className="px-1">
            <p className="text-xs font-semibold text-foreground truncate">{user?.name ?? "—"}</p>
            <p className="text-[10px] text-muted-foreground truncate">{user?.email ?? ""}</p>
          </div>
          {mode === "dev" && (
            <>
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
                <option value="elder">Tribal Elder</option>
                <option value="medical_provider">Medical Provider</option>
                <option value="visitor_media">Visitor / Media</option>
              </select>
            </>
          )}
          <Button
            variant="outline"
            size="sm"
            className="w-full text-xs"
            onClick={logout}
          >
            Sign Out
          </Button>
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
