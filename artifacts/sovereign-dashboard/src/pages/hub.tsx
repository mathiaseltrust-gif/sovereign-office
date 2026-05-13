import { useAuth } from "@/components/auth-provider";
import { Link } from "wouter";
import {
  User, FileText, Brain, Building2, Users, Scale,
  Gavel, Heart, Shield, ChevronRight, LogOut, Briefcase,
  TreePine, AlertCircle, BookOpen, Star
} from "lucide-react";

const ROLE_LABELS: Record<string, string> = {
  chief_justice: "Chief Justice & Trustee",
  trustee: "Trustee",
  officer: "Officer",
  sovereign_admin: "System Administrator",
  elder: "Elder",
  medical_provider: "Medical Provider",
  member: "Member",
  visitor_media: "Visitor / Media",
};

const TRUST_URL = "https://trust-dashboard.redstone-3e658f00.eastus.azurecontainerapps.io";
const COMMUNITY_URL = "https://community-dashboard.redstone-3e658f00.eastus.azurecontainerapps.io";

function ServiceCard({
  icon: Icon,
  title,
  description,
  href,
  external,
  badge,
  color = "primary",
}: {
  icon: React.ElementType;
  title: string;
  description: string;
  href: string;
  external?: boolean;
  badge?: string;
  color?: "primary" | "amber" | "green" | "blue" | "rose";
}) {
  const colorMap = {
    primary: "bg-primary/10 text-primary",
    amber: "bg-amber-500/10 text-amber-600",
    green: "bg-green-500/10 text-green-600",
    blue: "bg-blue-500/10 text-blue-600",
    rose: "bg-rose-500/10 text-rose-600",
  };

  const content = (
    <div className="group flex items-start gap-4 p-4 rounded-xl border border-card-border bg-card hover:border-primary/40 hover:shadow-md transition-all cursor-pointer">
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${colorMap[color]}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold text-foreground">{title}</p>
          {badge && (
            <span className="text-[10px] font-bold uppercase tracking-wider bg-primary text-primary-foreground px-1.5 py-0.5 rounded-full">
              {badge}
            </span>
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{description}</p>
      </div>
      <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5 group-hover:text-primary transition-colors" />
    </div>
  );

  if (external) {
    return <a href={href} target="_blank" rel="noreferrer">{content}</a>;
  }
  return <Link href={href}>{content}</Link>;
}

function SectionHeader({ title }: { title: string }) {
  return (
    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2 px-1">{title}</p>
  );
}

export default function HubPage() {
  const { user, activeRole, logout, sessionToken } = useAuth();

  const initials = user?.name
    ?.split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2) ?? "?";

  const roleLabel = user?.roles.map((r) => ROLE_LABELS[r]).filter(Boolean)[0] ?? activeRole;

  const isGov = ["trustee", "sovereign_admin", "officer"].includes(activeRole);
  const isElder = activeRole === "elder";
  const isMedical = activeRole === "medical_provider";

  // Build SSO link: pass session token as query param so other dashboards can pick it up
  function ssoLink(baseUrl: string, path = "") {
    if (sessionToken) {
      return `${baseUrl}${path}?sso_token=${encodeURIComponent(sessionToken)}`;
    }
    return `${baseUrl}${path}`;
  }

  return (
    <div className="max-w-3xl mx-auto p-4 md:p-6 space-y-6">
      {/* Profile card */}
      <div className="bg-card border border-card-border rounded-2xl shadow-sm overflow-hidden">
        <div className="bg-sidebar px-6 pt-6 pb-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-sidebar-primary flex items-center justify-center shrink-0">
              <span className="text-xl font-bold text-sidebar-primary-foreground">{initials}</span>
            </div>
            <div className="min-w-0">
              <h1 className="text-lg font-bold text-sidebar-foreground leading-tight truncate">{user?.name}</h1>
              <p className="text-sm text-sidebar-foreground/70 truncate">{roleLabel}</p>
              <p className="text-xs text-sidebar-foreground/50 truncate">{user?.email}</p>
            </div>
            <button
              onClick={logout}
              className="ml-auto flex items-center gap-1.5 text-xs text-sidebar-foreground/50 hover:text-sidebar-foreground transition-colors shrink-0"
            >
              <LogOut className="w-3.5 h-3.5" />
              Sign out
            </button>
          </div>
        </div>
        <div className="px-6 py-3 flex items-center gap-3 border-t border-card-border text-xs text-muted-foreground">
          <Shield className="w-3.5 h-3.5 text-green-500" />
          <span>Authenticated via Microsoft — Mathias El Tribe Sovereign Office</span>
        </div>
      </div>

      {/* AI Intake Funnel */}
      <div>
        <SectionHeader title="AI Intake Funnel" />
        <div className="space-y-2">
          <ServiceCard
            icon={Brain}
            title="Case & Complaint Intake"
            description="Submit a situation for AI legal analysis — flags violations, applies tribal doctrine, and routes to the right office."
            href="/intake-ai"
            badge="AI"
            color="primary"
          />
          <ServiceCard
            icon={Users}
            title="Lineage & Membership Verification"
            description="Verify your tribal descendant status. Enter your lineage details and the system matches against the tribal registry."
            href="/onboarding/lineage"
            badge="Enroll"
            color="green"
          />
          <ServiceCard
            icon={Building2}
            title="Sovereign Business Formation"
            description="AI-guided wizard to form a Tribal Section 17, LLC, or other sovereign entity with full legal provisions."
            href="/business-canvas/new"
            badge="AI"
            color="amber"
          />
          <ServiceCard
            icon={Heart}
            title="Welfare & Community Resources"
            description="Access welfare instruments, emergency declarations, and benefit authorizations issued under the Office."
            href="/welfare"
            color="rose"
          />
        </div>
      </div>

      {/* My Services */}
      <div>
        <SectionHeader title="My Services" />
        <div className="space-y-2">
          <ServiceCard
            icon={User}
            title="My Profile & Tribal ID"
            description="View your membership record, tribal ID, lineage status, and notification preferences."
            href="/profile"
            color="blue"
          />
          <ServiceCard
            icon={TreePine}
            title="Family Tree & Lineage"
            description="View your family connections, ancestral records, and ICWA eligibility status."
            href="/family-tree"
            color="green"
          />
          <ServiceCard
            icon={FileText}
            title="My Complaints & Filings"
            description="Track submitted cases, complaints, and court filings related to your household."
            href="/complaints"
            color="primary"
          />
          <ServiceCard
            icon={BookOpen}
            title="Law Library"
            description="Access tribal code, federal Indian law, sovereignty doctrines, and case law."
            href="/law"
            color="blue"
          />
        </div>
      </div>

      {/* Government & Trust Office — only for gov roles */}
      {isGov && (
        <div>
          <SectionHeader title="Government & Trust Office" />
          <div className="space-y-2">
            <ServiceCard
              icon={Gavel}
              title="Sovereign Office Dashboard"
              description="Full administrative dashboard — instruments, filings, NFR documents, member administration."
              href={`/dashboard/${activeRole === "sovereign_admin" ? "admin" : activeRole}`}
              color="primary"
            />
            <ServiceCard
              icon={Scale}
              title="Trust Instruments Dashboard"
              description="Manage trust instruments, recorder filings, and charitable trust oversight."
              href={ssoLink(TRUST_URL)}
              external
              color="amber"
            />
            <ServiceCard
              icon={AlertCircle}
              title="Notice of Federal Review"
              description="Review and manage NFR documents and federal court correspondence."
              href="/nfr"
              color="rose"
            />
            <ServiceCard
              icon={Briefcase}
              title="Business Canvas"
              description="Review sovereign business concepts filed by tribal members."
              href="/business-canvas"
              color="amber"
            />
          </div>
        </div>
      )}

      {/* Elder-specific */}
      {isElder && (
        <div>
          <SectionHeader title="Elder Advisory" />
          <div className="space-y-2">
            <ServiceCard
              icon={Star}
              title="Elder Advisory Council"
              description="Elder council deliberations, governance recommendations, and ceremonial records."
              href="/elder-advisory"
              color="amber"
            />
            <ServiceCard
              icon={Users}
              title="Family Governance"
              description="Family governance records, elder decisions, and intergenerational matters."
              href="/family-governance"
              color="green"
            />
          </div>
        </div>
      )}

      {/* Medical */}
      {isMedical && (
        <div>
          <SectionHeader title="Medical Provider" />
          <div className="space-y-2">
            <ServiceCard
              icon={Heart}
              title="Medical Notes"
              description="Sovereign-protected medical notes and welfare records for tribal members."
              href="/medical-notes"
              color="rose"
            />
          </div>
        </div>
      )}

      {/* Community Portal */}
      <div>
        <SectionHeader title="Community Portal" />
        <div className="space-y-2">
          <ServiceCard
            icon={Users}
            title="Family & Community Dashboard"
            description="Community forum, family directory, member resources, and legal guidance."
            href={ssoLink(COMMUNITY_URL)}
            external
            color="green"
          />
        </div>
      </div>
    </div>
  );
}
