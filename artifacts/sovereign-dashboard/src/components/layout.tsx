import { Link, useLocation } from "wouter";
import { useAuth, roleLandingPath, type Role } from "./auth-provider";
import { canManageGovernors } from "@/lib/governor-access";
import { Button } from "@/components/ui/button";
import type { LucideIcon } from "lucide-react";
import {
  Archive, Zap, ScrollText, Gavel, FolderOpen, FileText, Scale, Wand2,
  Building2, AlertTriangle, Users, Heart, Mail, Star, TreePine,
  MessageSquare, Briefcase, BookOpen, Brain, Bot, Tag, CheckSquare,
  Database, Monitor, ShieldCheck, Bell, CalendarDays, Search,
  UserCircle, CreditCard, Stethoscope, ClipboardList, LayoutDashboard,
  Settings, FilePen, Globe, BadgeCheck, ChevronDown, BookMarked, PenLine,
  GraduationCap, BookOpenCheck,
} from "lucide-react";
import { useState } from "react";

const POSITION_TITLES: Partial<Record<Role, string>> = {
  trustee:          "Chief Justice & Trustee",
  sovereign_admin:  "Tribal Administrator",
  officer:          "Duty Officer",
  elder:            "Tribal Elder",
  medical_provider: "Medical Provider",
  visitor_media:    "Visitor",
};

interface NavItemDef {
  href: string;
  label: string;
  highlight?: boolean;
  icon: LucideIcon;
}

interface NavSectionDef {
  id: string;
  label: string;
  defaultOpen?: boolean;
  items: NavItemDef[];
}

// ── Nav definitions per role ───────────────────────────────────────────────────

function getTrusteeNav(): NavSectionDef[] {
  return [
    {
      id: "office",
      label: "Chief's Office",
      defaultOpen: true,
      items: [
        { href: "/profile",              label: "Office & Profile",    highlight: true, icon: Archive },
        { href: "/sovereign-pipeline",  label: "Intake Pipeline",  highlight: true, icon: Zap },
        { href: "/official-documents",  label: "Official Documents",  highlight: true, icon: ScrollText },
        { href: "/documents",           label: "Court Documents",     icon: Gavel },
      ],
    },
    {
      id: "governance",
      label: "Governance",
      defaultOpen: true,
      items: [
        { href: "/files",        label: "Files",                    icon: FolderOpen },
        { href: "/filings",      label: "Filings",                  icon: FileText },
        { href: "/instruments",  label: "Trust Instruments",        icon: Scale },
        { href: "/instrument-wizard", label: "Template Wizard",      icon: Wand2 },
        { href: "/org",          label: "Organizations",            icon: Building2 },
        { href: "/nfr",          label: "Notice of Federal Review", icon: AlertTriangle },
        { href: "/templates",    label: "Templates",                icon: FilePen },
      ],
    },
    {
      id: "community",
      label: "Community",
      defaultOpen: false,
      items: [
        { href: "/membership",         label: "Membership Status",     icon: BadgeCheck },
        { href: "/welfare",            label: "Welfare Instruments",   icon: Heart },
        { href: "/gwe-letter",         label: "GWE Letters",           icon: Mail },
        { href: "/elder-advisory",     label: "Elder Advisory",        icon: Star },
        { href: "/family-governance",  label: "Family Governance",     icon: Users },
        { href: "/family-tree",          label: "Family Tree & Lineage",  icon: TreePine },
        { href: "/ancestral-memories",   label: "Ancestral Memory Bank",  icon: BookMarked },
        { href: "/journal",              label: "Sovereign Journal",      icon: PenLine },
        { href: "/complaints",           label: "Complaints",             icon: MessageSquare },
        { href: "/medical-notes",        label: "Medical Notes",          icon: Stethoscope },
        { href: "/business-canvas",      label: "Business Canvas",        icon: Briefcase },
      ],
    },
    {
      id: "admin",
      label: "Administration",
      defaultOpen: false,
      items: [
        { href: "/law",                 label: "Law Library",          icon: BookOpen },
        { href: "/intake-ai",           label: "AI Intake Review",     icon: Brain },
        { href: "/drafts",              label: "AI Document Drafts",   icon: Bot },
        { href: "/classify",            label: "Classification",       icon: Tag },
        { href: "/tasks",               label: "Tasks",                icon: CheckSquare },
        { href: "/admin/lineage-import",label: "Lineage Registry",     icon: Database },
        { href: "/m365",                label: "Microsoft 365",        icon: Monitor },
        { href: "/role-governors",      label: "Role Governor", highlight: true, icon: ShieldCheck },
      ],
    },
  ];
}

function getOfficerNav(): NavSectionDef[] {
  return [
    {
      id: "core",
      label: "My Work",
      defaultOpen: true,
      items: [
        { href: "/dashboard/officer",  label: "Dashboard",            icon: LayoutDashboard },
        { href: "/my-office",          label: "My Office",            icon: Archive },
        { href: "/membership",         label: "Membership Status",    icon: BadgeCheck },
        { href: "/org",                label: "Organizations",        icon: Building2 },
        { href: "/complaints",         label: "Complaints",           icon: MessageSquare },
        { href: "/welfare",            label: "Welfare Instruments",  icon: Heart },
        { href: "/gwe-letter",         label: "GWE Letters",          icon: Mail },
        { href: "/nfr",                label: "Notice of Federal Review", icon: AlertTriangle },
        { href: "/family-tree",          label: "Family Tree & Lineage", icon: TreePine },
        { href: "/ancestral-memories",   label: "Ancestral Memory Bank", icon: BookMarked },
        { href: "/journal",              label: "Sovereign Journal",     icon: PenLine },
        { href: "/medical-notes",        label: "Medical Notes",         icon: Stethoscope },
        { href: "/business-canvas",      label: "Business Canvas",       icon: Briefcase },
      ],
    },
    {
      id: "tools",
      label: "Resources",
      defaultOpen: false,
      items: [
        { href: "/drafts",    label: "AI Document Drafts", icon: Bot },
        { href: "/law",       label: "Law Library",        icon: BookOpen },
        { href: "/intake-ai", label: "AI Intake Review",   icon: Brain },
        { href: "/classify",  label: "Classification",     icon: Tag },
        { href: "/tasks",     label: "Tasks",              icon: CheckSquare },
      ],
    },
  ];
}

function getMemberNav(): NavSectionDef[] {
  return [
    {
      id: "core",
      label: "My Portal",
      defaultOpen: true,
      items: [
        { href: "/dashboard/member",  label: "Dashboard",            icon: LayoutDashboard },
        { href: "/membership",        label: "Membership Status",    icon: BadgeCheck },
        { href: "/filings",           label: "Filings",              icon: FileText },
        { href: "/welfare",           label: "Welfare Instruments",  icon: Heart },
        { href: "/family-governance", label: "Family Governance",    icon: Users },
        { href: "/family-tree",          label: "Family Tree & Lineage", icon: TreePine },
        { href: "/ancestral-memories",   label: "Ancestral Memory Bank", icon: BookMarked },
        { href: "/journal",              label: "Sovereign Journal",     icon: PenLine },
        { href: "/complaints",           label: "Complaints",            icon: MessageSquare },
        { href: "/medical-notes",        label: "Medical Notes",         icon: Stethoscope },
        { href: "/business-canvas",      label: "Business Canvas",       icon: Briefcase },
      ],
    },
  ];
}

function getElderNav(): NavSectionDef[] {
  return [
    {
      id: "core",
      label: "Elder Portal",
      defaultOpen: true,
      items: [
        { href: "/dashboard/elder",    label: "Dashboard",            icon: LayoutDashboard },
        { href: "/elder-advisory",     label: "Elder Advisory Panel", icon: Star },
        { href: "/family-governance",  label: "Family Governance",    icon: Users },
        { href: "/family-tree",          label: "Family Tree & Lineage", icon: TreePine },
        { href: "/ancestral-memories",   label: "Ancestral Memory Bank", icon: BookMarked },
        { href: "/journal",              label: "Sovereign Journal",     icon: PenLine },
        { href: "/membership",           label: "Membership Status",     icon: BadgeCheck },
        { href: "/welfare",              label: "Welfare Instruments",   icon: Heart },
        { href: "/medical-notes",        label: "Medical Notes",         icon: Stethoscope },
        { href: "/complaints",           label: "Complaints",            icon: MessageSquare },
        { href: "/business-canvas",      label: "Business Canvas",       icon: Briefcase },
      ],
    },
  ];
}

function getMedicalNav(): NavSectionDef[] {
  return [
    {
      id: "core",
      label: "Medical Portal",
      defaultOpen: true,
      items: [
        { href: "/dashboard/medical-provider", label: "Medical Dashboard", icon: Stethoscope },
        { href: "/medical-notes",              label: "Medical Notes",     icon: ClipboardList },
        { href: "/family-tree",                label: "Patient Lineage",   icon: TreePine },
        { href: "/business-canvas",            label: "Business Canvas",   icon: Briefcase },
      ],
    },
  ];
}

function getVisitorNav(): NavSectionDef[] {
  return [
    {
      id: "core",
      label: "Visitor Access",
      defaultOpen: true,
      items: [
        { href: "/dashboard/visitor",  label: "Visitor Portal",      icon: Globe },
        { href: "/business-canvas",    label: "Business Canvas",     icon: Briefcase },
        { href: "/search",             label: "Search Public Records",icon: Search },
      ],
    },
  ];
}

function getNavSections(role: Role): NavSectionDef[] {
  if (role === "trustee" || role === "sovereign_admin") return getTrusteeNav();
  if (role === "officer")          return getOfficerNav();
  if (role === "elder")            return getElderNav();
  if (role === "member")           return getMemberNav();
  if (role === "medical_provider") return getMedicalNav();
  if (role === "visitor_media")    return getVisitorNav();
  return getMemberNav();
}

const PERSONAL_ITEMS: NavItemDef[] = [
  { href: "/notifications",  label: "Notifications",    icon: Bell },
  { href: "/calendar",       label: "Calendar",         icon: CalendarDays },
  { href: "/search",         label: "Search",           icon: Search },
  { href: "/profile",        label: "Profile & Identity",icon: UserCircle },
  { href: "/tribal-id",      label: "Tribal ID",        icon: CreditCard },
];

// ── Org section (shown for non-visitor/medical roles) ─────────────────────────
const ORG_ITEMS: NavItemDef[] = [
  { href: "/medical-notes",    label: "Medical Center",          icon: Stethoscope },
  { href: "/supreme-court",    label: "Supreme Court",           icon: Gavel },
  { href: "/tribal-trust",     label: "Tribal Trust",            icon: Scale },
  { href: "/charitable-trust", label: "Charitable Trust (501c3)",icon: Heart },
  { href: "/niac",             label: "NIAC (§527 Political)",   icon: Building2 },
  { href: "/iee",              label: "Indian Economic Enterprises",icon: Briefcase },
];

// ── Education section ──────────────────────────────────────────────────────────
const EDU_ITEMS: NavItemDef[] = [
  { href: "/sdu",             label: "Self Determination University", icon: GraduationCap },
  { href: "/sdu/definitions", label: "Sovereign Definitions",        icon: BookOpenCheck },
];

// ── Components ────────────────────────────────────────────────────────────────

function NavItem({ item, location }: { item: NavItemDef; location: string }) {
  const active = location === item.href || (item.href.length > 1 && location.startsWith(item.href));
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      className={[
        "flex items-center gap-2.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
        active
          ? "bg-primary text-primary-foreground"
          : item.highlight
          ? "text-amber-700 dark:text-amber-400 hover:bg-secondary hover:text-foreground font-semibold"
          : "text-muted-foreground hover:bg-secondary hover:text-foreground",
      ].join(" ")}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" />
      <span className="truncate">{item.label}</span>
    </Link>
  );
}

function CollapsibleSection({
  section,
  location,
}: {
  section: NavSectionDef;
  location: string;
}) {
  const hasActive = section.items.some(
    (i) => location === i.href || (i.href.length > 1 && location.startsWith(i.href))
  );
  const [open, setOpen] = useState(section.defaultOpen || hasActive);

  return (
    <div>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center justify-between w-full px-3 mb-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors"
      >
        <span>{section.label}</span>
        <ChevronDown
          className={`h-3 w-3 transition-transform duration-150 ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && (
        <div className="space-y-0.5">
          {section.items.map((item) => (
            <NavItem key={item.href} item={item} location={location} />
          ))}
        </div>
      )}
    </div>
  );
}

export function Layout({ children }: { children: React.ReactNode }) {
  const { activeRole, switchRole, mode, user, logout } = useAuth();
  const [location] = useLocation();

  const sections = getNavSections(activeRole);
  const showOrgs = activeRole !== "visitor_media" && activeRole !== "medical_provider";
  const showPersonal = activeRole !== "visitor_media";

  return (
    <div className="flex h-screen bg-background overflow-hidden font-sans">
      {/* ── Sidebar ── */}
      <aside className="w-60 border-r bg-card flex flex-col shrink-0">

        {/* Logo + identity block */}
        <div className="px-4 pt-4 pb-3 border-b flex flex-col items-center text-center">
          <Link
            href={roleLandingPath(activeRole)}
            className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-md"
          >
            <img
              src={`${import.meta.env.BASE_URL}supreme-court-seal.png`}
              alt="Mathias El Tribe Supreme Court"
              className="w-16 h-16 object-contain mb-2 drop-shadow-md hover:opacity-80 transition-opacity cursor-pointer"
            />
          </Link>
          <p className="text-[9px] font-semibold text-muted-foreground uppercase tracking-[0.18em] mb-0.5">
            Mathias El Tribe
          </p>
          <h1 className="font-serif text-xs font-bold text-primary leading-tight">
            Supreme Court
          </h1>
          {POSITION_TITLES[activeRole] && (
            <p className="mt-1 text-[9px] text-muted-foreground leading-tight">
              {POSITION_TITLES[activeRole]}
            </p>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-3 px-2 overflow-y-auto space-y-3">
          {sections.map((section) => (
            <CollapsibleSection key={section.id} section={section} location={location} />
          ))}

          {showOrgs && (
            <CollapsibleSection
              section={{ id: "orgs", label: "Organizations", defaultOpen: false, items: ORG_ITEMS }}
              location={location}
            />
          )}

          {showOrgs && (
            <CollapsibleSection
              section={{ id: "education", label: "Education", defaultOpen: false, items: EDU_ITEMS }}
              location={location}
            />
          )}

          {showPersonal && (
            <CollapsibleSection
              section={{ id: "personal", label: "Personal", defaultOpen: false, items: PERSONAL_ITEMS }}
              location={location}
            />
          )}
        </nav>

        {/* Footer: user + role switcher + sign out */}
        <div className="p-3 border-t space-y-2">
          <div className="px-1 min-w-0">
            <p className="text-xs font-semibold text-foreground truncate">{user?.name ?? "—"}</p>
            <p className="text-[10px] text-muted-foreground truncate">{user?.email ?? ""}</p>
          </div>

          {/* Role preview switcher — only visible to the Chief Justice & Trustee (sovereign_admin) */}
          {user?.roles?.some(r => ["sovereign_admin", "admin", "chief_justice"].includes(r)) && (
            <div className="space-y-1">
              <p className="px-1 text-[10px] text-muted-foreground uppercase tracking-widest font-semibold">
                {activeRole === "sovereign_admin" ? "Preview member view" : "⚠ Previewing as"}
              </p>
              <select
                value={activeRole}
                onChange={(e) => switchRole(e.target.value as Role)}
                className={[
                  "w-full bg-input border rounded-md p-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary",
                  activeRole !== "sovereign_admin" ? "text-amber-600 border-amber-400 font-semibold" : "text-foreground",
                ].join(" ")}
              >
                <option value="sovereign_admin">Chief Justice &amp; Trustee (My View)</option>
                <option value="trustee">Trustee</option>
                <option value="officer">Officer</option>
                <option value="elder">Tribal Elder</option>
                <option value="member">Member</option>
                <option value="medical_provider">Medical Provider</option>
                <option value="visitor_media">Visitor / Media</option>
              </select>
              {activeRole !== "sovereign_admin" && (
                <p className="px-1 text-[10px] text-amber-600">
                  Previewing {activeRole.replace(/_/g, " ")} view — your access is unchanged
                </p>
              )}
            </div>
          )}

          <Button variant="outline" size="sm" className="w-full text-xs" onClick={logout}>
            Sign Out
          </Button>
        </div>
      </aside>

      {/* ── Main content ── */}
      <main className="flex-1 overflow-y-auto bg-background">
        <div className="max-w-6xl mx-auto p-6">
          {children}
        </div>
      </main>
    </div>
  );
}
