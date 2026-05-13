import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";
import { useAuth, getCurrentBearerToken } from "@/components/auth-provider";

const GOVERNANCE_SECTIONS = [
  {
    title: "Household Registry",
    description: "View and manage the members registered under your family household record in the tribal registry.",
    href: "/family-tree",
    action: "View Household",
    color: "border-blue-200 bg-blue-50/40",
  },
  {
    title: "Family Tree & Lineage",
    description: "Review your family's lineage tree as recorded in the tribal registry, with AI document import and deduplication.",
    href: "/family-tree",
    action: "Open Lineage Tree",
    color: "border-green-200 bg-green-50/40",
  },
  {
    title: "Family Governance Orders",
    description: "View active and historical governance orders issued within your family unit. File new orders through the Supreme Court.",
    href: "/supreme-court",
    action: "View Court Orders",
    color: "border-amber-200 bg-amber-50/40",
  },
  {
    title: "Dependent & Minor Status",
    description: "Review the tribal membership status of all dependents and minors in your household. ICWA protections apply.",
    href: "/welfare",
    action: "View Welfare Records",
    color: "border-purple-200 bg-purple-50/40",
  },
  {
    title: "Membership Verification",
    description: "Check your current membership status, benefit eligibility, and delegated authorities under sovereign law.",
    href: "/membership",
    action: "Membership Status",
    color: "border-rose-200 bg-rose-50/40",
  },
  {
    title: "Identity & Tribal ID",
    description: "Access your verified tribal identification card, enrollment number, and sovereign identity documents.",
    href: "/tribal-id",
    action: "View Tribal ID",
    color: "border-zinc-200 bg-zinc-50",
  },
];

const FAMILY_RIGHTS = [
  "Family units have standing to file complaints and court matters on behalf of dependent members.",
  "Lineage records on file with the tribal registry are admissible in all federal and tribal court proceedings.",
  "ICWA protections automatically apply to all enrolled minor members in any state court custody proceeding.",
  "Family governance orders issued by the tribal court carry Full Faith and Credit under 28 U.S.C. § 1738.",
];

interface FamilyTreeStats {
  total: number;
  ancestors: number;
  verified: number;
  deceased: number;
}

export default function FamilyGovernancePage() {
  const { user, activeRole } = useAuth();

  const { data: treeStats, isLoading } = useQuery<FamilyTreeStats>({
    queryKey: ["family-tree-stats"],
    queryFn: async () => {
      const r = await fetch("/api/family-tree", {
        headers: { Authorization: `Bearer ${getCurrentBearerToken()}` },
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const json = await r.json();
      const nodes = json.nodes ?? [];
      return {
        total: nodes.length,
        ancestors: nodes.filter((n: { isAncestor?: boolean }) => n.isAncestor).length,
        verified: nodes.filter((n: { membershipStatus?: string }) => n.membershipStatus === "confirmed").length,
        deceased: nodes.filter((n: { isDeceased?: boolean }) => n.isDeceased).length,
      };
    },
  });

  const ROLE_LABELS: Record<string, string> = {
    elder: "Tribal Elder",
    trustee: "Chief Justice & Trustee",
    officer: "Officer",
    sovereign_admin: "Sovereign Administrator",
    member: "Member",
    medical_provider: "Medical Provider",
    visitor_media: "Visitor",
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1">Sovereign Office</p>
          <h1 className="text-3xl font-serif font-bold">Family Governance</h1>
          <p className="text-muted-foreground mt-1">
            Family records, lineage, and governance matters for {user?.name ?? "your household"}.
          </p>
        </div>
        <Badge variant="outline" className="border-green-400 text-green-700 h-fit text-xs">
          {ROLE_LABELS[activeRole] ?? "Member"}
        </Badge>
      </div>

      {/* Family tree stats */}
      {isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[1,2,3,4].map(i => <Skeleton key={i} className="h-20" />)}
        </div>
      ) : treeStats && treeStats.total > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: "Total Records", value: treeStats.total, color: "text-primary" },
            { label: "Ancestors on File", value: treeStats.ancestors, color: "text-amber-700" },
            { label: "Confirmed Members", value: treeStats.verified, color: "text-green-700" },
            { label: "Deceased on Record", value: treeStats.deceased, color: "text-zinc-500" },
          ].map(({ label, value, color }) => (
            <Card key={label}>
              <CardHeader className="pb-1 pt-4">
                <CardTitle className="text-xs uppercase tracking-widest text-muted-foreground">{label}</CardTitle>
              </CardHeader>
              <CardContent className="pb-4">
                <p className={`text-3xl font-serif font-bold ${color}`}>{value}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="border-amber-200 bg-amber-50/40">
          <CardContent className="py-4 text-sm text-amber-800">
            No lineage records on file yet. Use the Family Tree page to import ancestors or add them manually.
          </CardContent>
        </Card>
      )}

      {/* Governance sections */}
      <div className="grid sm:grid-cols-2 gap-4">
        {GOVERNANCE_SECTIONS.map(({ title, description, href, action, color }) => (
          <Card key={title} className={`${color} border`}>
            <CardHeader className="pb-2 pt-4">
              <CardTitle className="text-sm font-semibold">{title}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
              <Link href={href}>
                <Button variant="outline" size="sm" className="text-xs h-7 w-full justify-start">{action} →</Button>
              </Link>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Family rights */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm uppercase tracking-widest text-muted-foreground">Family Rights Under Tribal &amp; Federal Law</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2">
            {FAMILY_RIGHTS.map((r, i) => (
              <li key={i} className="flex gap-2 text-sm">
                <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-xs flex items-center justify-center font-bold shrink-0 mt-0.5">§</span>
                <span>{r}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
