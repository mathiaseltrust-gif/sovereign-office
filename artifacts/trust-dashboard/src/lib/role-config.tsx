import {
  LayoutDashboard,
  FolderOpen,
  FileText,
  Scale,
  Users,
  BookOpen,
  TreePine,
  Heart,
  Building2,
  Globe,
  Star,
  UserCircle,
  Shield,
  Stethoscope,
  ScrollText,
} from "lucide-react";

export interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  group?: string;
}

export interface RoleConfig {
  roleLabel: string;
  roleSubtitle: string;
  navItems: NavItem[];
  canCreateInstrument: boolean;
  canManageFilings: boolean;
  canViewNFR: boolean;
  whatNext: Array<{ title: string; description: string }>;
  overviewPanels: string[];
}

const ROLE_LEVELS: Record<string, number> = {
  chief_justice: 5,
  sovereign_admin: 5,
  trustee: 4,
  officer: 3,
  medical_provider: 3,
  elder: 3,
  community_elder: 3,
  family_elder: 2,
  grandparent_elder: 2,
  adult_with_dependents: 2,
  niac_role: 2,
  charitable_trust_role: 2,
  iee_role: 2,
  adult: 1,
  minor: 1,
  member: 1,
  visitor_media: 0,
};

export const ELDER_ROLES = new Set([
  "elder",
  "community_elder",
  "family_elder",
  "grandparent_elder",
]);

export function getRoleLevel(roles: string[]): number {
  return Math.max(0, ...roles.map((r) => ROLE_LEVELS[r] ?? 0));
}

export function getRoleConfig(roles: string[]): RoleConfig {
  const level = getRoleLevel(roles);
  const has = (r: string) => roles.includes(r);
  const isElder = roles.some((r) => ELDER_ROLES.has(r));

  // ── Chief Justice / Sovereign Admin ──────────────────────────────
  if (level >= 5) {
    return {
      roleLabel: has("chief_justice") ? "Chief Justice & Trustee" : "Sovereign Administrator",
      roleSubtitle: "Full System Access",
      canCreateInstrument: true,
      canManageFilings: true,
      canViewNFR: true,
      navItems: [
        { label: "Overview", href: "/", icon: LayoutDashboard },
        { label: "Trust Instruments", href: "/instruments", icon: FolderOpen, group: "Trust Office" },
        { label: "Filings", href: "/filings", icon: FileText, group: "Trust Office" },
        { label: "Notice of Federal Review", href: "/nfr", icon: Scale, group: "Court" },
        { label: "Member Administration", href: "/members", icon: Users, group: "Administration" },
      ],
      whatNext: [
        { title: "Issue Trust Instrument", description: "Draft and sign a new sovereign trust instrument for recorder filing." },
        { title: "Review Pending Filings", description: "Approve or reject outstanding county recorder submissions." },
        { title: "Generate NFR Document", description: "Create a Notice of Federal Review for a classified matter." },
        { title: "Manage Members", description: "Administer tribal membership records and role assignments." },
      ],
      overviewPanels: ["trust-stats", "filing-stats", "nfr-notice", "recent-instruments", "recent-filings"],
    };
  }

  // ── Trustee ───────────────────────────────────────────────────────
  if (level >= 4) {
    return {
      roleLabel: "Trustee",
      roleSubtitle: "Trust Management Access",
      canCreateInstrument: true,
      canManageFilings: true,
      canViewNFR: true,
      navItems: [
        { label: "Overview", href: "/", icon: LayoutDashboard },
        { label: "Trust Instruments", href: "/instruments", icon: FolderOpen, group: "Trust Office" },
        { label: "Filings", href: "/filings", icon: FileText, group: "Trust Office" },
        { label: "Notice of Federal Review", href: "/nfr", icon: Scale, group: "Court" },
      ],
      whatNext: [
        { title: "Create Trust Instrument", description: "Draft a new trust instrument for tribal assets or declarations." },
        { title: "File to County Recorder", description: "Submit a completed instrument to the county recorder's office." },
        { title: "Review Active Filings", description: "Track and manage all outstanding recorder filings." },
      ],
      overviewPanels: ["trust-stats", "filing-stats", "recent-instruments", "recent-filings"],
    };
  }

  // ── Elder Roles ───────────────────────────────────────────────────
  if (isElder) {
    const elderLabel = has("community_elder") ? "Community Elder"
      : has("family_elder") ? "Family Elder"
      : has("grandparent_elder") ? "Grandparent Elder"
      : "Elder";

    const seniorElder = has("elder") || has("community_elder");

    const navItems: NavItem[] = [
      { label: "Overview", href: "/", icon: LayoutDashboard },
      { label: "Elder Advisory Panel", href: "/elder-advisory", icon: Star, group: "Authority" },
      { label: "Family Governance", href: "/family-governance", icon: TreePine, group: "Authority" },
    ];
    if (seniorElder) {
      navItems.push({ label: "Lineage & Family Tree", href: "/lineage", icon: BookOpen, group: "Authority" });
      navItems.push({ label: "Cultural Authority", href: "/cultural-authority", icon: Shield, group: "Authority" });
    }

    return {
      roleLabel: elderLabel,
      roleSubtitle: "Cultural & Advisory Authority",
      canCreateInstrument: false,
      canManageFilings: false,
      canViewNFR: false,
      navItems,
      whatNext: [
        { title: "Elder Protections", description: "Review rights and protections afforded to Elders under tribal law." },
        { title: "Elder Advisory Role", description: "Your advisory authority applies to family governance and lineage matters." },
        { title: "Cultural Authority", description: "Document and exercise cultural correction authority within the tribe." },
        ...(seniorElder
          ? [{ title: "Lineage Correction", description: "Submit lineage corrections or review family tree records." }]
          : []),
      ],
      overviewPanels: ["elder-welcome", "elder-authorities", "elder-what-next"],
    };
  }

  // ── Officer ───────────────────────────────────────────────────────
  if (has("officer")) {
    return {
      roleLabel: "Officer",
      roleSubtitle: "Administrative Access",
      canCreateInstrument: false,
      canManageFilings: false,
      canViewNFR: true,
      navItems: [
        { label: "Overview", href: "/", icon: LayoutDashboard },
        { label: "Trust Instruments", href: "/instruments", icon: FolderOpen, group: "Trust Office" },
        { label: "Filings", href: "/filings", icon: FileText, group: "Trust Office" },
        { label: "Notice of Federal Review", href: "/nfr", icon: Scale, group: "Court" },
      ],
      whatNext: [
        { title: "Review Instruments", description: "View all active trust instruments and their current status." },
        { title: "Track Filings", description: "Monitor county recorder submissions and filing outcomes." },
        { title: "NFR Documents", description: "Access and generate Notice of Federal Review documents." },
      ],
      overviewPanels: ["trust-stats", "recent-instruments", "recent-filings"],
    };
  }

  // ── Medical Provider ──────────────────────────────────────────────
  if (has("medical_provider")) {
    return {
      roleLabel: "Medical Provider",
      roleSubtitle: "Medical Records Access",
      canCreateInstrument: false,
      canManageFilings: false,
      canViewNFR: false,
      navItems: [
        { label: "Overview", href: "/", icon: LayoutDashboard },
        { label: "Medical Records", href: "/medical-records", icon: Stethoscope, group: "Medical" },
        { label: "My Profile", href: "/member-profile", icon: UserCircle, group: "Account" },
      ],
      whatNext: [
        { title: "Member Medical Records", description: "Access and document tribal member health records." },
        { title: "Wellness Reports", description: "Submit and review community wellness documentation." },
      ],
      overviewPanels: ["provider-welcome", "member-what-next"],
    };
  }

  // ── NIAC Role ─────────────────────────────────────────────────────
  if (has("niac_role")) {
    return {
      roleLabel: "NIAC Member",
      roleSubtitle: "National Indigenous Affairs Council",
      canCreateInstrument: false,
      canManageFilings: false,
      canViewNFR: false,
      navItems: [
        { label: "Overview", href: "/", icon: LayoutDashboard },
        { label: "NIAC Panel", href: "/niac", icon: Globe, group: "NIAC" },
        { label: "My Profile", href: "/member-profile", icon: UserCircle, group: "Account" },
      ],
      whatNext: [
        { title: "Submit NIAC Inquiry", description: "File a formal inquiry through the National Indigenous Affairs Council." },
        { title: "Review NIAC Status", description: "Check the status of your NIAC membership and standing." },
        { title: "Contact Tribal Office", description: "Reach the tribal office for NIAC-related matters." },
      ],
      overviewPanels: ["member-welcome", "niac-panel", "member-what-next"],
    };
  }

  // ── Charitable Trust Role ─────────────────────────────────────────
  if (has("charitable_trust_role")) {
    return {
      roleLabel: "Charitable Trust Member",
      roleSubtitle: "Charitable Trust Access",
      canCreateInstrument: false,
      canManageFilings: false,
      canViewNFR: false,
      navItems: [
        { label: "Overview", href: "/", icon: LayoutDashboard },
        { label: "Charitable Trust", href: "/charitable-trust", icon: Heart, group: "Trust" },
        { label: "My Profile", href: "/member-profile", icon: UserCircle, group: "Account" },
      ],
      whatNext: [
        { title: "Charitable Trust Status", description: "View your standing in the Mathias El Tribe Charitable Trust." },
        { title: "View Trust Instruments", description: "Access public trust instruments relevant to charitable programs." },
        { title: "Contact Trustee", description: "Reach the Office of the Trustee for trust-related inquiries." },
      ],
      overviewPanels: ["member-welcome", "charitable-panel", "member-what-next"],
    };
  }

  // ── IEE Role ──────────────────────────────────────────────────────
  if (has("iee_role")) {
    return {
      roleLabel: "I.E.E. Member",
      roleSubtitle: "Indigenous Economic Enterprise",
      canCreateInstrument: false,
      canManageFilings: false,
      canViewNFR: false,
      navItems: [
        { label: "Overview", href: "/", icon: LayoutDashboard },
        { label: "I.E.E. Panel", href: "/iee", icon: Building2, group: "Enterprise" },
        { label: "My Profile", href: "/member-profile", icon: UserCircle, group: "Account" },
      ],
      whatNext: [
        { title: "IEE Verification Status", description: "Check your Indigenous Economic Enterprise verification standing." },
        { title: "Enterprise Registration", description: "Register or update your enterprise affiliation with the tribe." },
        { title: "Contact IEE Office", description: "Submit questions or requests to the IEE tribal office." },
      ],
      overviewPanels: ["member-welcome", "iee-panel", "member-what-next"],
    };
  }

  // ── Adult with Dependents ─────────────────────────────────────────
  if (has("adult_with_dependents")) {
    return {
      roleLabel: "Member with Dependents",
      roleSubtitle: "Family Member Access",
      canCreateInstrument: false,
      canManageFilings: false,
      canViewNFR: false,
      navItems: [
        { label: "Overview", href: "/", icon: LayoutDashboard },
        { label: "My Profile", href: "/member-profile", icon: UserCircle, group: "Member" },
        { label: "Family Governance", href: "/family-governance", icon: TreePine, group: "Family" },
      ],
      whatNext: [
        { title: "Update Family Records", description: "Keep your household and dependent records current." },
        { title: "Dependent Status", description: "Review the status of all dependents on your tribal record." },
        { title: "Submit Family Inquiry", description: "Contact the tribal office for family-related matters." },
      ],
      overviewPanels: ["member-welcome", "family-panel", "member-what-next"],
    };
  }

  // ── Adult / Minor / Member (level 1) ──────────────────────────────
  return {
    roleLabel: has("minor") ? "Minor Member" : "Member",
    roleSubtitle: "Tribal Member Access",
    canCreateInstrument: false,
    canManageFilings: false,
    canViewNFR: false,
    navItems: [
      { label: "Overview", href: "/", icon: LayoutDashboard },
      { label: "My Profile", href: "/member-profile", icon: UserCircle, group: "Member" },
    ],
    whatNext: [
      { title: "Membership Status", description: "View and confirm your current tribal membership standing." },
      { title: "Update Your Profile", description: "Keep your personal information and contact details current." },
      { title: "Contact Tribal Office", description: "Reach the Office of the Chief Justice for member inquiries." },
    ],
    overviewPanels: ["member-welcome", "member-what-next"],
  };
}
