import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";
import { getCurrentBearerToken } from "@/components/auth-provider";

type OrgType = "court" | "trust" | "charitable_trust" | "political" | "enterprise" | "medical";
type AccessLevel = "none" | "member" | "officer" | "director" | "trustee" | "full";

interface Org {
  id: string;
  name: string;
  shortName: string;
  type: OrgType;
  legalStatus: string;
  legalCode?: string;
  jurisdiction: string;
  description: string;
  mission: string;
  navPath: string;
  authorities: string[];
  federalStatutes?: string[];
  color: string;
  accessLevel: AccessLevel;
}

interface OrgSummary {
  membershipVerified: boolean;
  lineageVerified: boolean;
  icwaEligible: boolean;
  protectionLevel: string;
  familyGroup: string;
  role: string;
  totalOrgs: number;
  accessibleOrgs: number;
}

interface OrgData {
  orgs: Org[];
  summary: OrgSummary;
}

const TYPE_LABELS: Record<OrgType, string> = {
  court: "Tribal Court",
  trust: "Federal Indian Trust",
  charitable_trust: "Charitable Trust (501c3)",
  political: "§527 Political Organization",
  enterprise: "Indian Economic Enterprise",
  medical: "Tribal Health Facility",
};

const ACCESS_COLORS: Record<AccessLevel, string> = {
  none: "bg-zinc-100 text-zinc-500",
  member: "bg-blue-100 text-blue-800",
  officer: "bg-amber-100 text-amber-800",
  director: "bg-purple-100 text-purple-800",
  trustee: "bg-red-100 text-red-800",
  full: "bg-green-100 text-green-800",
};

const ORG_COLOR_CLASSES: Record<string, string> = {
  red: "border-red-200 bg-red-50/30",
  blue: "border-blue-200 bg-blue-50/30",
  green: "border-green-200 bg-green-50/30",
  amber: "border-amber-200 bg-amber-50/30",
  purple: "border-purple-200 bg-purple-50/30",
  zinc: "border-zinc-200 bg-zinc-50",
};

export default function OrgOverviewPage() {
  const { data, isLoading, error } = useQuery<OrgData>({
    queryKey: ["org-overview"],
    queryFn: async () => {
      const r = await fetch("/api/org", {
        headers: { Authorization: `Bearer ${getCurrentBearerToken()}` },
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json();
    },
  });

  if (isLoading) {
    return (
      <div className="p-6 max-w-4xl mx-auto space-y-4">
        <Skeleton className="h-10 w-72" />
        <div className="grid sm:grid-cols-2 gap-4">
          {[1,2,3,4,5,6].map(i => <Skeleton key={i} className="h-44" />)}
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="py-8 text-center text-destructive">Could not load organization data.</CardContent>
        </Card>
      </div>
    );
  }

  const { orgs, summary } = data;
  const accessible = orgs.filter(o => o.accessLevel !== "none");
  const inaccessible = orgs.filter(o => o.accessLevel === "none");

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1">Sovereign Office</p>
          <h1 className="text-3xl font-serif font-bold">Organization Overview</h1>
          <p className="text-muted-foreground mt-1">
            All sovereign entities of the Mathias El Tribe — your access level for each.
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Badge variant="outline">{summary.accessibleOrgs} of {summary.totalOrgs} accessible</Badge>
          <Badge className={summary.membershipVerified ? "bg-green-100 text-green-800" : "bg-zinc-100 text-zinc-600"}>
            {summary.membershipVerified ? "Membership Verified" : "Membership Pending"}
          </Badge>
        </div>
      </div>

      {accessible.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">Your Organizations</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            {accessible.map((org) => (
              <Card key={org.id} className={`${ORG_COLOR_CLASSES[org.color] ?? ORG_COLOR_CLASSES.zinc} border`}>
                <CardHeader className="pb-2 pt-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-xs text-muted-foreground font-medium">{TYPE_LABELS[org.type]}</p>
                      <CardTitle className="text-base font-serif font-bold mt-0.5">{org.shortName}</CardTitle>
                    </div>
                    <Badge className={`${ACCESS_COLORS[org.accessLevel]} text-xs shrink-0`}>
                      {org.accessLevel}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3">{org.description}</p>
                  {org.legalCode && (
                    <p className="text-xs text-muted-foreground font-mono">{org.legalCode}</p>
                  )}
                  {org.authorities.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {org.authorities.slice(0, 3).map(a => (
                        <Badge key={a} variant="outline" className="text-[10px]">{a}</Badge>
                      ))}
                      {org.authorities.length > 3 && (
                        <Badge variant="outline" className="text-[10px]">+{org.authorities.length - 3} more</Badge>
                      )}
                    </div>
                  )}
                  <Link href={org.navPath}>
                    <Button variant="outline" size="sm" className="text-xs h-7 w-full justify-start">
                      Open {org.shortName} →
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {inaccessible.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">Other Entities (access not granted)</h2>
          <div className="grid sm:grid-cols-2 gap-3">
            {inaccessible.map((org) => (
              <Card key={org.id} className="opacity-60 border">
                <CardHeader className="pb-1 pt-4">
                  <p className="text-xs text-muted-foreground">{TYPE_LABELS[org.type]}</p>
                  <CardTitle className="text-sm font-serif font-semibold">{org.shortName}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground line-clamp-2">{org.description}</p>
                  <p className="text-xs text-zinc-400 mt-2">Contact the Chief Justice to request access.</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      <Card className="bg-sidebar/40 border-sidebar-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-xs uppercase tracking-widest text-muted-foreground">Your Membership Summary</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
          {[
            { label: "Membership", ok: summary.membershipVerified },
            { label: "Lineage on File", ok: summary.lineageVerified },
            { label: "ICWA Eligible", ok: summary.icwaEligible },
          ].map(({ label, ok }) => (
            <div key={label} className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${ok ? "bg-green-500" : "bg-zinc-300"}`} />
              <span className={ok ? "font-medium" : "text-muted-foreground"}>{label}</span>
            </div>
          ))}
          {summary.familyGroup && (
            <div className="col-span-full text-xs text-muted-foreground">Family Group: <strong>{summary.familyGroup}</strong></div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
