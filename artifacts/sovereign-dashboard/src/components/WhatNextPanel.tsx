import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/components/auth-provider";
import { Link } from "wouter";

interface DelegatedAuthorities {
  medicalNotes: "none" | "self" | "self_and_dependents";
  welfareActions: boolean;
  familyDocuments: boolean;
  trustFilings: boolean;
  familyGovernance: boolean;
  lineageAccess: "none" | "read_only" | "limited" | "full";
  allAuthorities: boolean;
  memberType: string;
}

interface MembershipData {
  membershipVerified: boolean;
  entraVerified: boolean;
  lineageVerified: boolean;
  identityTags: string[];
  familyGroup: string;
  protectionLevel: "standard" | "elevated" | "critical";
  benefitEligibility: Record<string, boolean>;
  delegatedAuthorities: DelegatedAuthorities;
  whatNext: { immediate: string[]; next: string[]; protected: string[] };
  lineageSummary: string;
  ancestorChain: string[];
  tribalNations: string[];
  memberType: string;
  message?: string;
}

const PROTECTION_STYLES: Record<string, { card: string; badge: string }> = {
  standard: { card: "border-green-200 bg-green-50/50", badge: "bg-green-100 text-green-800" },
  elevated: { card: "border-orange-200 bg-orange-50/50", badge: "bg-orange-100 text-orange-800" },
  critical: { card: "border-red-200 bg-red-50/50", badge: "bg-red-100 text-red-800" },
};

const BENEFIT_LABELS: Record<string, string> = {
  icwa: "ICWA Protection",
  tribalWelfare: "Tribal Welfare",
  trustBeneficiary: "Trust Beneficiary",
  membershipBenefits: "Membership Benefits",
  ancestralLandRights: "Ancestral Land Rights",
};

const AUTHORITY_LABELS: Record<string, string> = {
  adult: "Adult Member",
  adult_with_dependents: "Adult with Dependents",
  officer: "Officer",
  trustee: "Trustee",
  chief_justice: "Chief Justice & Trustee",
  minor: "Minor (Read-Only)",
};

function makeToken(user: unknown) { return btoa(JSON.stringify(user)); }

export function WhatNextPanel({ compact = false }: { compact?: boolean }) {
  const { user } = useAuth();
  const token = makeToken(user);

  const { data, isLoading } = useQuery<MembershipData>({
    queryKey: ["membership-verify"],
    queryFn: async () => {
      const r = await fetch("/api/membership/verify", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!r.ok) throw new Error("Failed to load membership data");
      return r.json();
    },
    staleTime: 60_000,
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-xs uppercase tracking-widest text-muted-foreground">What Now / What Next</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-5" />)}
        </CardContent>
      </Card>
    );
  }

  if (!data) return null;

  const styles = PROTECTION_STYLES[data.protectionLevel] ?? PROTECTION_STYLES.standard;
  const activeBenefits = Object.entries(data.benefitEligibility ?? {}).filter(([, v]) => v);

  if (compact) {
    return (
      <Card className={`${styles.card} border`}>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="text-xs uppercase tracking-widest">Status</CardTitle>
            <div className="flex gap-2 flex-wrap">
              <Badge className={`${styles.badge} text-xs`}>{data.protectionLevel.toUpperCase()}</Badge>
              <Badge variant={data.membershipVerified ? "default" : "secondary"} className="text-xs">
                {data.membershipVerified ? "Verified Member" : "Unverified"}
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground mb-2">{data.lineageSummary}</p>
          {data.whatNext.immediate.slice(0, 2).map((step, i) => (
            <p key={i} className="text-xs py-1 border-b last:border-0 text-foreground">→ {step}</p>
          ))}
          {activeBenefits.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {activeBenefits.map(([k]) => (
                <Badge key={k} className="bg-blue-700 text-white text-xs">{BENEFIT_LABELS[k] ?? k}</Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card className={`${styles.card} border-2`}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <CardTitle className="text-sm uppercase tracking-widest">What Now / What Next</CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                {AUTHORITY_LABELS[data.memberType] ?? data.memberType} —{" "}
                {data.familyGroup || "No family group on record"}
              </p>
            </div>
            <div className="flex gap-2 flex-wrap">
              <Badge className={`${styles.badge} text-xs`}>
                Protection: {data.protectionLevel.toUpperCase()}
              </Badge>
              <Badge variant={data.membershipVerified ? "default" : "secondary"} className="text-xs">
                {data.membershipVerified ? "Membership Verified" : "Membership Unverified"}
              </Badge>
              {data.entraVerified && (
                <Badge variant="outline" className="text-xs border-blue-400 text-blue-700">Entra ID Verified</Badge>
              )}
              {data.lineageVerified && (
                <Badge variant="outline" className="text-xs border-amber-500 text-amber-700">Lineage Verified</Badge>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {data.lineageSummary && (
            <p className="text-sm text-muted-foreground border-b pb-3">{data.lineageSummary}</p>
          )}

          {data.whatNext.immediate.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-2">Do Now</p>
              <ul className="space-y-1">
                {data.whatNext.immediate.map((step, i) => (
                  <li key={i} className="flex gap-2 text-sm">
                    <span className="text-primary font-bold shrink-0">→</span>
                    <span>{step}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {data.whatNext.next.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-2">Next Steps</p>
              <ul className="space-y-1">
                {data.whatNext.next.map((step, i) => (
                  <li key={i} className="flex gap-2 text-sm text-muted-foreground">
                    <span className="text-muted-foreground shrink-0">•</span>
                    <span>{step}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {data.whatNext.protected.length > 0 && (
            <div className="border-t pt-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-2">Your Protections</p>
              <ul className="space-y-1">
                {data.whatNext.protected.map((item, i) => (
                  <li key={i} className="flex gap-2 text-xs text-muted-foreground">
                    <span className="shrink-0">⚑</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>

      {activeBenefits.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase tracking-widest text-muted-foreground">Benefit Eligibility</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {activeBenefits.map(([k]) => (
                <Badge key={k} className="bg-blue-700 text-white text-xs">{BENEFIT_LABELS[k] ?? k}</Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-xs uppercase tracking-widest text-muted-foreground">Your Delegated Authority</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {[
              {
                label: "Medical Notes",
                value: data.delegatedAuthorities.medicalNotes,
                fmt: (v: string) => v.replace(/_/g, " "),
                active: data.delegatedAuthorities.medicalNotes !== "none",
              },
              { label: "Welfare Actions", value: data.delegatedAuthorities.welfareActions ? "Authorized" : "Not authorized", active: data.delegatedAuthorities.welfareActions },
              { label: "Family Documents", value: data.delegatedAuthorities.familyDocuments ? "Authorized" : "Not authorized", active: data.delegatedAuthorities.familyDocuments },
              { label: "Trust Filings", value: data.delegatedAuthorities.trustFilings ? "Authorized" : "Not authorized", active: data.delegatedAuthorities.trustFilings },
              { label: "Family Governance", value: data.delegatedAuthorities.familyGovernance ? "Authorized" : "Not authorized", active: data.delegatedAuthorities.familyGovernance },
              { label: "Lineage Access", value: data.delegatedAuthorities.lineageAccess, active: data.delegatedAuthorities.lineageAccess !== "none" },
            ].map(({ label, value, active, fmt }) => (
              <div key={label} className="flex flex-col">
                <span className="text-xs text-muted-foreground uppercase tracking-widest">{label}</span>
                <Badge
                  variant={active ? "default" : "secondary"}
                  className={`mt-1 text-xs w-fit capitalize ${active ? "" : "opacity-60"}`}
                >
                  {fmt ? fmt(value as string) : value as string}
                </Badge>
              </div>
            ))}
          </div>

          {(data.tribalNations ?? []).length > 0 && (
            <div className="mt-3 pt-3 border-t">
              <p className="text-xs text-muted-foreground mb-1">Tribal Nations in Lineage</p>
              <div className="flex flex-wrap gap-1">
                {(data.tribalNations ?? []).map((n) => (
                  <Badge key={n} variant="outline" className="text-xs">{n}</Badge>
                ))}
              </div>
            </div>
          )}

          {(data.ancestorChain ?? []).length > 0 && (
            <div className="mt-3 pt-3 border-t">
              <p className="text-xs text-muted-foreground mb-1">Ancestor Chain</p>
              <div className="flex flex-wrap gap-1">
                {(data.ancestorChain ?? []).slice(0, 6).map((a, i) => (
                  <Badge key={i} variant="secondary" className="text-xs">{a}</Badge>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {!data.membershipVerified && (
        <Card className="border-amber-300 bg-amber-50/50">
          <CardContent className="pt-4 flex items-center gap-3">
            <div className="flex-1">
              <p className="text-sm font-semibold text-amber-800">Complete Your Membership Verification</p>
              <p className="text-xs text-amber-700 mt-1">
                Import lineage records and link an ancestor to your identity to confirm membership and unlock full delegated authority.
              </p>
            </div>
            <Link href="/family-tree">
              <Button size="sm" variant="outline" className="border-amber-400 text-amber-800 hover:bg-amber-100 shrink-0">
                Go to Family Tree
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}

      {data.delegatedAuthorities.medicalNotes !== "none" && (
        <Card>
          <CardContent className="pt-4 flex items-center justify-between gap-3 flex-wrap">
            <div>
              <p className="text-sm font-semibold">Generate Medical Note</p>
              <p className="text-xs text-muted-foreground">
                {data.delegatedAuthorities.medicalNotes === "self_and_dependents"
                  ? "Authorized for yourself and dependents — Mathias El Tribe Medical Center"
                  : "Authorized for yourself — Mathias El Tribe Medical Center"}
              </p>
            </div>
            <Link href="/medical-notes">
              <Button size="sm" variant="outline" className="shrink-0">Create Medical Note</Button>
            </Link>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
