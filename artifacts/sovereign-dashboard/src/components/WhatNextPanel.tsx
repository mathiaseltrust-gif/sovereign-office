import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getCurrentBearerToken } from "@/components/auth-provider";
import { Link } from "wouter";

type OrgAccessLevel = "none" | "member" | "officer" | "director" | "trustee" | "full";

interface OrgAccess {
  medicalCenter: OrgAccessLevel;
  supremeCourt: OrgAccessLevel;
  tribalTrust: OrgAccessLevel;
  charitableTrust: OrgAccessLevel;
  niac: OrgAccessLevel;
  iee: OrgAccessLevel;
}

interface DelegatedAuthorities {
  medicalNotes: "none" | "self" | "self_and_dependents" | "clinical_provider";
  welfareActions: boolean;
  familyDocuments: boolean;
  trustFilings: boolean;
  familyGovernance: boolean;
  lineageAccess: "none" | "read_only" | "limited" | "full";
  allAuthorities: boolean;
  memberType: string;
  orgAccess?: OrgAccess;
  elderAuthority?: boolean;
  clinicalAuthority?: boolean;
  canGenerateTribalId?: boolean;
  canApproveInstruments?: boolean;
  canViewTrustAssets?: boolean;
  canIssueTrustDirectives?: boolean;
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
  elder: "Tribal Elder",
  medical_provider: "Medical Provider",
  visitor_media: "Visitor / Media",
};

export function WhatNextPanel({ compact = false }: { compact?: boolean }) {
  const { data, isLoading } = useQuery<MembershipData>({
    queryKey: ["membership-verify"],
    queryFn: async () => {
      const r = await fetch("/api/membership/verify", {
        headers: { Authorization: `Bearer ${getCurrentBearerToken() ?? ""}` },
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

  const isVisitor = data.memberType === "visitor_media";
  const isElder = data.memberType === "elder" || data.delegatedAuthorities?.elderAuthority;
  const isMedical = data.memberType === "medical_provider" || data.delegatedAuthorities?.clinicalAuthority;

  const styles = PROTECTION_STYLES[data.protectionLevel] ?? PROTECTION_STYLES.standard;
  const activeBenefits = Object.entries(data.benefitEligibility ?? {}).filter(([, v]) => v);

  if (compact) {
    return (
      <Card className={`${styles.card} border`}>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="text-xs uppercase tracking-widest">Status</CardTitle>
            <div className="flex gap-2 flex-wrap">
              {isElder && <Badge className="bg-amber-100 text-amber-800 text-xs border border-amber-300">★ Elder</Badge>}
              {isMedical && <Badge className="bg-blue-100 text-blue-800 text-xs">Medical Provider</Badge>}
              {isVisitor && <Badge variant="outline" className="text-xs border-amber-400 text-amber-700">Visitor</Badge>}
              {!isVisitor && <Badge className={`${styles.badge} text-xs`}>{data.protectionLevel.toUpperCase()}</Badge>}
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

  // Visitor/Media: minimal panel
  if (isVisitor) {
    return (
      <Card className="border-amber-200 bg-amber-50/50">
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <CardTitle className="text-xs uppercase tracking-widest">Visitor Access</CardTitle>
            <Badge variant="outline" className="text-xs border-amber-400 text-amber-700">Restricted</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {data.whatNext.immediate.map((step, i) => (
            <p key={i} className="text-sm">→ {step}</p>
          ))}
          {data.whatNext.next.map((step, i) => (
            <p key={i} className="text-xs text-muted-foreground">• {step}</p>
          ))}
          {data.whatNext.protected.map((item, i) => (
            <p key={i} className="text-xs text-amber-700">⚑ {item}</p>
          ))}
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
              {isElder && <Badge className="bg-amber-100 text-amber-800 text-xs border border-amber-300">★ Elder</Badge>}
              {isMedical && <Badge className="bg-blue-100 text-blue-800 text-xs">Clinical Authority</Badge>}
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

      {/* Elder Authority panel */}
      {isElder && (
        <Card className="border-amber-200 bg-amber-50/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase tracking-widest text-amber-700">Elder Authorities Active</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {[
              "Cultural Authority — represent tribal cultural interests",
              "Lineage Correction Authority — submit lineage corrections",
              "Family Governance Authority — preside over family matters",
              "Advisory Authority — recognized advisor to the Sovereign Office",
            ].map((auth, i) => (
              <p key={i} className="text-xs text-amber-800 flex gap-1.5"><span>★</span>{auth}</p>
            ))}
            <Link href="/dashboard/elder">
              <Button size="sm" variant="outline" className="w-full mt-2 border-amber-300 text-amber-800 hover:bg-amber-100">
                Elder Dashboard
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}

      {/* Medical provider panel */}
      {isMedical && (
        <Card className="border-blue-200 bg-blue-50/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase tracking-widest text-blue-700">Medical Provider Authority</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-xs text-blue-800">Clinical note authority active — ICD/CPT authorized</p>
            <p className="text-xs text-blue-800">Dependent and patient notes authorized</p>
            <p className="text-xs text-blue-800">Tribal medical jurisdiction — IHS authority applies</p>
            <Link href="/dashboard/medical-provider">
              <Button size="sm" variant="outline" className="w-full mt-2 border-blue-300 text-blue-800 hover:bg-blue-100">
                Medical Provider Dashboard
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}

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

          {/* Extended authorities */}
          {(data.delegatedAuthorities.clinicalAuthority || data.delegatedAuthorities.canGenerateTribalId ||
            data.delegatedAuthorities.canApproveInstruments || data.delegatedAuthorities.canViewTrustAssets) && (
            <div className="mt-3 pt-3 border-t grid grid-cols-2 gap-2">
              {data.delegatedAuthorities.clinicalAuthority && (
                <div><span className="text-xs text-muted-foreground">Clinical Authority</span><Badge variant="default" className="mt-0.5 text-xs w-fit block">Active</Badge></div>
              )}
              {data.delegatedAuthorities.canGenerateTribalId && (
                <div><span className="text-xs text-muted-foreground">Tribal ID</span><Badge variant="default" className="mt-0.5 text-xs w-fit block">Authorized</Badge></div>
              )}
              {data.delegatedAuthorities.canApproveInstruments && (
                <div><span className="text-xs text-muted-foreground">Approve Instruments</span><Badge variant="default" className="mt-0.5 text-xs w-fit block">Authorized</Badge></div>
              )}
              {data.delegatedAuthorities.canViewTrustAssets && (
                <div><span className="text-xs text-muted-foreground">Trust Assets</span><Badge variant="default" className="mt-0.5 text-xs w-fit block">Authorized</Badge></div>
              )}
            </div>
          )}

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

      {!data.membershipVerified && data.memberType !== "visitor_media" && (
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

      {/* Tribal ID quick action */}
      {data.delegatedAuthorities.canGenerateTribalId && (
        <Card>
          <CardContent className="pt-4 flex items-center justify-between gap-3 flex-wrap">
            <div>
              <p className="text-sm font-semibold">Generate Tribal ID</p>
              <p className="text-xs text-muted-foreground">Official sovereign identity document with QR code and lineage summary</p>
            </div>
            <Link href="/tribal-id">
              <Button size="sm" variant="outline" className="shrink-0">Tribal ID</Button>
            </Link>
          </CardContent>
        </Card>
      )}

      {data.delegatedAuthorities.medicalNotes !== "none" && (
        <Card>
          <CardContent className="pt-4 flex items-center justify-between gap-3 flex-wrap">
            <div>
              <p className="text-sm font-semibold">
                {data.delegatedAuthorities.clinicalAuthority ? "Clinical Notes" : "Generate Medical Note"}
              </p>
              <p className="text-xs text-muted-foreground">
                {data.delegatedAuthorities.clinicalAuthority
                  ? "Clinical authority — ICD/CPT notes, dependents, patient records — Mathias El Tribe Medical Center"
                  : data.delegatedAuthorities.medicalNotes === "self_and_dependents"
                  ? "Authorized for yourself and dependents — Mathias El Tribe Medical Center"
                  : "Authorized for yourself — Mathias El Tribe Medical Center"}
              </p>
            </div>
            <Link href={data.delegatedAuthorities.clinicalAuthority ? "/dashboard/medical-provider" : "/medical-notes"}>
              <Button size="sm" variant="outline" className="shrink-0">
                {data.delegatedAuthorities.clinicalAuthority ? "Medical Dashboard" : "Create Medical Note"}
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-xs uppercase tracking-widest text-muted-foreground">Your Organization Access</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {[
            { id: "medicalCenter", label: "Medical Center", href: "/medical-notes", badge: "bg-blue-100 text-blue-800" },
            { id: "supremeCourt", label: "Supreme Court", href: "/supreme-court", badge: "bg-red-100 text-red-800" },
            { id: "tribalTrust", label: "Tribal Trust", href: "/tribal-trust", badge: "bg-amber-100 text-amber-800" },
            { id: "charitableTrust", label: "Charitable Trust (501c3)", href: "/charitable-trust", badge: "bg-green-100 text-green-800" },
            { id: "niac", label: "NIAC (§527 Political)", href: "/niac", badge: "bg-purple-100 text-purple-800" },
            { id: "iee", label: "I.E.E. (Economic Enterprises)", href: "/iee", badge: "bg-orange-100 text-orange-800" },
          ].map(({ id, label, href, badge }) => {
            const level = (data.delegatedAuthorities.orgAccess as Record<string, string> | undefined)?.[id] ?? "member";
            if (level === "none") return null;
            return (
              <Link key={id} href={href}>
                <div className="flex items-center justify-between py-1.5 border-b last:border-0 cursor-pointer hover:text-primary transition-colors">
                  <span className="text-sm">{label}</span>
                  <Badge className={`${badge} text-xs capitalize shrink-0 ml-2`}>{level}</Badge>
                </div>
              </Link>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
