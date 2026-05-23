import type { LucideIcon } from "lucide-react";
import {
  Archive, Zap, ScrollText, Gavel, FolderOpen, FileText, Scale, Wand2,
  Building2, AlertTriangle, Users, Heart, Mail, Star, TreePine,
  MessageSquare, Briefcase, BookOpen, Brain, Bot, Tag, CheckSquare,
  Database, Monitor, ShieldCheck, Bell, CalendarDays, Search,
  UserCircle, CreditCard, Stethoscope, ClipboardList, FilePen,
  BookOpenCheck, Landmark, Fingerprint, GitMerge, Map,
  GraduationCap, BookMarked, PenLine, Globe, Activity,
} from "lucide-react";

export type SiteRole =
  | "trustee" | "sovereign_admin" | "officer" | "elder"
  | "member" | "medical_provider" | "visitor_media" | "all";

export interface SiteFunction {
  path: string;
  label: string;
  section: string;
  description: string;
  icon: LucideIcon;
  roles: SiteRole[];
  keywords: string[];
  external?: boolean;
}

const ADMIN_ROLES: SiteRole[] = ["trustee", "sovereign_admin"];
const OFFICER_ROLES: SiteRole[] = ["trustee", "sovereign_admin", "officer"];
const MEMBER_ROLES: SiteRole[] = ["trustee", "sovereign_admin", "officer", "elder", "member"];
const ALL: SiteRole[] = ["all"];

export const SITE_FUNCTIONS: SiteFunction[] = [
  // ── Chief's Office ──────────────────────────────────────────────────────────
  {
    path: "/profile",
    label: "Office & Profile",
    section: "Chief's Office",
    description: "Chief's identity hub, land records, tribal ID, and sovereign status",
    icon: Archive,
    roles: ADMIN_ROLES,
    keywords: ["identity", "profile", "land", "tribal id", "sovereign status", "apn", "address"],
  },
  {
    path: "/sovereign-pipeline",
    label: "Intake Pipeline",
    section: "Chief's Office",
    description: "Submit and process incoming matters through the sovereign document pipeline",
    icon: Zap,
    roles: OFFICER_ROLES,
    keywords: ["intake", "submit", "pipeline", "new matter", "document", "case"],
  },
  {
    path: "/official-documents",
    label: "Official Documents",
    section: "Chief's Office",
    description: "Official tribal documents, decrees, and sovereign instruments",
    icon: ScrollText,
    roles: ADMIN_ROLES,
    keywords: ["documents", "official", "decree", "instrument", "sovereign"],
  },
  {
    path: "/documents",
    label: "Court Documents",
    section: "Chief's Office",
    description: "Court filings, tribal court records, and legal documents",
    icon: Gavel,
    roles: OFFICER_ROLES,
    keywords: ["court", "legal", "filing", "records", "gavel"],
  },

  // ── Governance ───────────────────────────────────────────────────────────────
  {
    path: "/files",
    label: "Files",
    section: "Governance",
    description: "General file repository for tribal records and documents",
    icon: FolderOpen,
    roles: OFFICER_ROLES,
    keywords: ["files", "repository", "storage", "records"],
  },
  {
    path: "/investigations",
    label: "Case File Registry",
    section: "Governance",
    description: "Open and closed case files, case tracking and management",
    icon: Scale,
    roles: OFFICER_ROLES,
    keywords: ["case", "registry", "files", "tracking", "SOV", "case number"],
  },
  {
    path: "/filings",
    label: "Filings",
    section: "Governance",
    description: "Manage and track formal filings with tribal and federal agencies",
    icon: FileText,
    roles: MEMBER_ROLES,
    keywords: ["filings", "filed", "submit", "agency", "BIA", "federal"],
  },
  {
    path: "/templates",
    label: "Document Templates",
    section: "Governance",
    description: "Ready-to-use sovereign document templates for notices, letters, and instruments",
    icon: FilePen,
    roles: OFFICER_ROLES,
    keywords: ["templates", "documents", "draft", "letter", "notice", "NFR", "ICWA"],
  },
  {
    path: "/instruments",
    label: "Trust Instruments",
    section: "Governance",
    description: "Trust deeds, instruments, and related governance documents",
    icon: Scale,
    roles: OFFICER_ROLES,
    keywords: ["trust", "deed", "instrument", "trustee", "beneficiary"],
  },
  {
    path: "/land",
    label: "Land & Asset Management",
    section: "Governance",
    description: "Land records, APN, tribal land classifications, and asset tracking",
    icon: Landmark,
    roles: OFFICER_ROLES,
    keywords: ["land", "APN", "asset", "property", "restricted", "trust land", "parcel"],
  },
  {
    path: "/org",
    label: "Organizations",
    section: "Governance",
    description: "Tribal organizations, entities, and governance structures",
    icon: Building2,
    roles: OFFICER_ROLES,
    keywords: ["organizations", "entities", "governance", "IEE", "NIAC"],
  },
  {
    path: "/nfr",
    label: "Notice of Federal Review",
    section: "Governance",
    description: "Issue, track, and manage Notices of Federal Review (NFR)",
    icon: AlertTriangle,
    roles: OFFICER_ROLES,
    keywords: ["NFR", "notice", "federal review", "BIA", "jurisdiction", "oversight"],
  },

  // ── Community ────────────────────────────────────────────────────────────────
  {
    path: "/membership",
    label: "Membership Status",
    section: "Community",
    description: "Member enrollment status, verification, and tribal membership records",
    icon: CheckSquare,
    roles: MEMBER_ROLES,
    keywords: ["membership", "enrolled", "status", "member", "registry"],
  },
  {
    path: "/welfare",
    label: "Welfare Instruments",
    section: "Community",
    description: "Welfare letters, protective instruments, and general welfare notices",
    icon: Heart,
    roles: OFFICER_ROLES,
    keywords: ["welfare", "instrument", "protective", "letter", "GWE"],
  },
  {
    path: "/gwe-letter",
    label: "GWE Letters",
    section: "Community",
    description: "General Welfare Exclusion letters for tribal members",
    icon: Mail,
    roles: OFFICER_ROLES,
    keywords: ["GWE", "general welfare", "exclusion", "letter", "IRS"],
  },
  {
    path: "/elder-advisory",
    label: "Elder Advisory",
    section: "Community",
    description: "Elder council advisory panel and elder governance records",
    icon: Star,
    roles: ["trustee", "sovereign_admin", "elder"],
    keywords: ["elder", "advisory", "council", "governance"],
  },
  {
    path: "/family-governance",
    label: "Family Governance",
    section: "Community",
    description: "Family governance records, household structures, and kinship documentation",
    icon: Users,
    roles: MEMBER_ROLES,
    keywords: ["family", "governance", "household", "kinship", "relatives"],
  },
  {
    path: "/family-tree",
    label: "Family Tree & Lineage",
    section: "Community",
    description: "Lineage records, ancestry tree, and family connections",
    icon: TreePine,
    roles: MEMBER_ROLES,
    keywords: ["family tree", "lineage", "ancestry", "ancestors", "descendants", "genealogy"],
  },
  {
    path: "/ancestral-memories",
    label: "Ancestral Memory Bank",
    section: "Community",
    description: "Preserved ancestral memories, stories, and cultural records",
    icon: BookMarked,
    roles: MEMBER_ROLES,
    keywords: ["memory", "ancestral", "stories", "cultural", "history", "oral"],
  },
  {
    path: "/ancestral-exposure",
    label: "Exposure Filter",
    section: "Community",
    description: "Filter and analyze potential identity exposure and misclassification risks",
    icon: Fingerprint,
    roles: OFFICER_ROLES,
    keywords: ["exposure", "filter", "identity", "misclassification", "risk"],
  },
  {
    path: "/journal",
    label: "Sovereign Journal",
    section: "Community",
    description: "Personal sovereign journal for reflections and official notes",
    icon: PenLine,
    roles: MEMBER_ROLES,
    keywords: ["journal", "diary", "reflections", "notes", "personal"],
  },
  {
    path: "/complaints",
    label: "Complaints",
    section: "Community",
    description: "Formal complaint submissions and complaint tracking",
    icon: MessageSquare,
    roles: MEMBER_ROLES,
    keywords: ["complaints", "grievance", "formal", "submit", "track"],
  },
  {
    path: "/medical-notes",
    label: "Medical Notes",
    section: "Community",
    description: "Medical records, health notes, and protected health information",
    icon: Stethoscope,
    roles: MEMBER_ROLES,
    keywords: ["medical", "health", "notes", "HIPAA", "IHS", "records"],
  },
  {
    path: "/business-canvas",
    label: "Business Canvas",
    section: "Community",
    description: "Business concept canvas, planning, and economic development",
    icon: Briefcase,
    roles: MEMBER_ROLES,
    keywords: ["business", "canvas", "concept", "planning", "economic", "enterprise"],
  },

  // ── Administration ───────────────────────────────────────────────────────────
  {
    path: "/law",
    label: "Law Library",
    section: "Administration",
    description: "Federal Indian law library, statutes, CFR provisions, and case law",
    icon: BookOpen,
    roles: OFFICER_ROLES,
    keywords: ["law", "library", "statutes", "CFR", "USC", "case law", "treaty", "ISDEAA", "IHCIA"],
  },
  {
    path: "/intake-ai",
    label: "AI Intake Review",
    section: "Administration",
    description: "AI-assisted review of intake submissions and document analysis",
    icon: Brain,
    roles: OFFICER_ROLES,
    keywords: ["AI", "intake", "review", "analysis", "document", "classify"],
  },
  {
    path: "/drafts",
    label: "AI Document Drafts",
    section: "Administration",
    description: "AI-generated document drafts ready for review and approval",
    icon: Bot,
    roles: OFFICER_ROLES,
    keywords: ["drafts", "AI", "documents", "generated", "review", "approve"],
  },
  {
    path: "/classify",
    label: "Classification",
    section: "Administration",
    description: "Classify and tag matters by type, actor, land status, and action type",
    icon: Tag,
    roles: OFFICER_ROLES,
    keywords: ["classify", "classification", "tag", "type", "actor", "action"],
  },
  {
    path: "/tasks",
    label: "Tasks",
    section: "Administration",
    description: "Task management and action tracking for tribal operations",
    icon: CheckSquare,
    roles: OFFICER_ROLES,
    keywords: ["tasks", "to-do", "action", "pending", "assigned", "due"],
  },
  {
    path: "/admin/lineage-import",
    label: "Lineage Registry",
    section: "Administration",
    description: "Import and manage lineage records and ancestry data",
    icon: Database,
    roles: ADMIN_ROLES,
    keywords: ["lineage", "import", "registry", "ancestry", "records"],
  },
  {
    path: "/gedcom-import",
    label: "GEDCOM Import",
    section: "Administration",
    description: "Import genealogy data from GEDCOM files",
    icon: GitMerge,
    roles: ADMIN_ROLES,
    keywords: ["GEDCOM", "genealogy", "import", "ancestry", "family tree"],
  },
  {
    path: "/atlas-admin",
    label: "Atlas Events",
    section: "Administration",
    description: "Manage Urban Indian Atlas map events and historical data",
    icon: Map,
    roles: ADMIN_ROLES,
    keywords: ["atlas", "map", "events", "historical", "urban indian"],
  },
  {
    path: "/m365",
    label: "Microsoft 365",
    section: "Administration",
    description: "Microsoft 365 integration status and email/calendar synchronization",
    icon: Monitor,
    roles: ADMIN_ROLES,
    keywords: ["Microsoft", "M365", "email", "calendar", "integration", "Outlook"],
  },
  {
    path: "/role-governors",
    label: "Role Governor",
    section: "Administration",
    description: "Configure role-based governance rules and sovereign postures",
    icon: ShieldCheck,
    roles: ADMIN_ROLES,
    keywords: ["role", "governor", "governance", "posture", "rules", "access"],
  },

  // ── Education ────────────────────────────────────────────────────────────────
  {
    path: "/sdu",
    label: "Self Determination University",
    section: "Education",
    description: "Educational modules on sovereignty, federal Indian law, and self-determination",
    icon: GraduationCap,
    roles: MEMBER_ROLES,
    keywords: ["SDU", "education", "university", "sovereignty", "learn", "training"],
  },
  {
    path: "/sdu/definitions",
    label: "Sovereign Definitions",
    section: "Education",
    description: "Glossary of key sovereign, legal, and tribal terms and definitions",
    icon: BookOpenCheck,
    roles: MEMBER_ROLES,
    keywords: ["definitions", "glossary", "terms", "sovereign", "legal"],
  },

  // ── Personal ─────────────────────────────────────────────────────────────────
  {
    path: "/notifications",
    label: "Notifications",
    section: "Personal",
    description: "System notifications, alerts, and important updates",
    icon: Bell,
    roles: MEMBER_ROLES,
    keywords: ["notifications", "alerts", "messages", "updates", "unread"],
  },
  {
    path: "/calendar",
    label: "Calendar",
    section: "Personal",
    description: "Personal and tribal calendar, important dates, and deadlines",
    icon: CalendarDays,
    roles: MEMBER_ROLES,
    keywords: ["calendar", "events", "dates", "deadlines", "schedule"],
  },
  {
    path: "/profile",
    label: "Profile & Identity",
    section: "Personal",
    description: "Personal identity record, tribal membership, and sovereign profile",
    icon: UserCircle,
    roles: MEMBER_ROLES,
    keywords: ["profile", "identity", "personal", "account", "name", "member"],
  },
  {
    path: "/tribal-id",
    label: "Tribal ID",
    section: "Personal",
    description: "Tribal identification card and credential information",
    icon: CreditCard,
    roles: MEMBER_ROLES,
    keywords: ["tribal ID", "card", "identification", "credential"],
  },
  {
    path: "/search",
    label: "Search Records",
    section: "Personal",
    description: "Search across all tribal records, cases, members, and documents",
    icon: Search,
    roles: MEMBER_ROLES,
    keywords: ["search", "find", "look up", "records", "query"],
  },

  // ── Organizations ────────────────────────────────────────────────────────────
  {
    path: "/supreme-court",
    label: "Supreme Court",
    section: "Organizations",
    description: "Mathias El Tribe Supreme Court records and proceedings",
    icon: Gavel,
    roles: OFFICER_ROLES,
    keywords: ["supreme court", "court", "proceedings", "ruling", "judicial"],
  },
  {
    path: "/tribal-trust",
    label: "Tribal Trust",
    section: "Organizations",
    description: "Tribal trust organization, beneficiaries, and trust management",
    icon: Scale,
    roles: OFFICER_ROLES,
    keywords: ["trust", "tribal trust", "beneficiary", "trustee", "organization"],
  },
  {
    path: "/charitable-trust",
    label: "Charitable Trust (501c3)",
    section: "Organizations",
    description: "Charitable trust organization for community welfare programs",
    icon: Heart,
    roles: OFFICER_ROLES,
    keywords: ["charitable", "501c3", "nonprofit", "trust", "welfare"],
  },
  {
    path: "/niac",
    label: "NIAC (§527 Political)",
    section: "Organizations",
    description: "National Indigenous American Committee political organization",
    icon: Building2,
    roles: OFFICER_ROLES,
    keywords: ["NIAC", "527", "political", "national indigenous", "committee"],
  },
  {
    path: "/iee",
    label: "Indian Economic Enterprises",
    section: "Organizations",
    description: "Tribal economic development entities and business enterprises",
    icon: Briefcase,
    roles: OFFICER_ROLES,
    keywords: ["IEE", "economic", "enterprise", "business", "development", "tribal"],
  },

  // ── Ecosystem Portals ────────────────────────────────────────────────────────
  {
    path: "/trust-dashboard",
    label: "Trust Instruments Dashboard",
    section: "Ecosystem",
    description: "Full trust instruments management portal",
    icon: Scale,
    roles: OFFICER_ROLES,
    keywords: ["trust", "dashboard", "instruments", "portal"],
    external: true,
  },
  {
    path: "/trace",
    label: "TRACE — Compliance Engine",
    section: "Ecosystem",
    description: "Tribal Rights & Administrative Compliance Engine — procedural analysis and NIAC review",
    icon: Activity,
    roles: ADMIN_ROLES,
    keywords: ["TRACE", "compliance", "APA", "CFR", "procedural", "NIAC", "oversight", "audit"],
    external: true,
  },
  {
    path: "/community-dashboard",
    label: "Community Dashboard",
    section: "Ecosystem",
    description: "Member-facing community portal for guidance and resources",
    icon: Users,
    roles: MEMBER_ROLES,
    keywords: ["community", "dashboard", "members", "portal", "guidance"],
    external: true,
  },
  {
    path: "/authority-directory",
    label: "Authority Directory",
    section: "Ecosystem",
    description: "Agency authority directory, jurisdiction maps, and oversight routing",
    icon: Globe,
    roles: OFFICER_ROLES,
    keywords: ["authority", "directory", "agency", "jurisdiction", "oversight"],
    external: true,
  },
  {
    path: "/urban-indian-atlas",
    label: "Urban Indian Continuity Atlas",
    section: "Ecosystem",
    description: "Interactive map of urban Indian territories, ancestors, and migration paths",
    icon: Map,
    roles: MEMBER_ROLES,
    keywords: ["atlas", "map", "urban indian", "territory", "ancestors", "migration"],
    external: true,
  },
];

/** Filter site functions by role. "all" roles always pass. */
export function filterByRole(role: string): SiteFunction[] {
  return SITE_FUNCTIONS.filter(
    (f) => f.roles.includes("all") || f.roles.includes(role as SiteRole),
  );
}

/** Score a site function against a query string. Returns 0 if no match. */
export function scoreFunction(fn: SiteFunction, query: string): number {
  const q = query.toLowerCase().trim();
  if (!q) return 0;
  const label = fn.label.toLowerCase();
  const section = fn.section.toLowerCase();
  const desc = fn.description.toLowerCase();
  const keywords = fn.keywords.join(" ").toLowerCase();
  if (label === q) return 10;
  if (label.startsWith(q)) return 8;
  if (label.includes(q)) return 6;
  if (keywords.includes(q)) return 4;
  if (desc.includes(q)) return 3;
  if (section.includes(q)) return 1;
  const words = q.split(" ").filter(Boolean);
  if (words.length > 1) {
    const allMatch = words.every(
      (w) => label.includes(w) || keywords.includes(w) || desc.includes(w),
    );
    if (allMatch) return 5;
  }
  return 0;
}

/** Search and rank site functions against a query. */
export function searchFunctions(query: string, role: string): SiteFunction[] {
  const available = filterByRole(role);
  if (!query.trim()) return available.slice(0, 8);
  return available
    .map((fn) => ({ fn, score: scoreFunction(fn, query) }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .map(({ fn }) => fn)
    .slice(0, 8);
}
