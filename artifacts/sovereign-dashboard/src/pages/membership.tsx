import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";
import { getCurrentBearerToken } from "@/components/auth-provider";
import { Button } from "@/components/ui/button";

interface BenefitEligibility {
  icwa: boolean;
  tribalWelfare: boolean;
  trustBeneficiary: boolean;
  membershipBenefits: boolean;
  ancestralLandRights: boolean;
}

interface DelegatedAuthority {
  canFileCourt: boolean;
  canVote: boolean;
  canReceiveWelfare: boolean;
  canReceiveICWA: boolean;
  canHoldOffice: boolean;
  memberType: string;
}

interface WhatNextStep {
  title: string;
  description: string;
  priority?: string;
}

interface MembershipData {
  membershipVerified: boolean;
  entraVerified: boolean;
  lineageVerified: boolean;
  identityTags: string[];
  familyGroup: string;
  protectionLevel: string;
  benefitEligibility: BenefitEligibility;
  delegatedAuthorities: DelegatedAuthority;
  whatNext: WhatNextStep[];
  lineageSummary: string;
  ancestorChain: string[];
  tribalNations: string[];
  memberType: string;
  message?: string;
}

const PROTECTION_COLORS: Record<string, string> = {
  standard: "bg-green-100 text-green-800 border-green-300",
  elevated: "bg-amber-100 text-amber-800 border-amber-300",
  critical: "bg-red-100 text-red-800 border-red-300",
};

const BENEFIT_LABELS: Record<keyof BenefitEligibility, string> = {
  icwa: "ICWA Protected",
  tribalWelfare: "Tribal Welfare",
  trustBeneficiary: "Trust Beneficiary",
  membershipBenefits: "Membership Benefits",
  ancestralLandRights: "Ancestral Land Rights",
};

export default function MembershipPage() {
  const { data, isLoading, error } = useQuery<MembershipData>({
    queryKey: ["membership-verify"],
    queryFn: async () => {
      const r = await fetch("/api/membership/verify", {
        headers: { Authorization: `Bearer ${getCurrentBearerToken()}` },
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json();
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-4 p-6 max-w-3xl mx-auto">
        <Skeleton className="h-10 w-64" />
        {[1, 2, 3].map(i => <Skeleton key={i} className="h-32 w-full" />)}
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-6 max-w-3xl mx-auto">
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="py-8 text-center text-destructive">
            Could not load membership data. Make sure you are logged in.
          </CardContent>
        </Card>
      </div>
    );
  }

  const protColor = PROTECTION_COLORS[data.protectionLevel] ?? PROTECTION_COLORS.standard;
  const eligibleBenefits = (Object.keys(data.benefitEligibility) as Array<keyof BenefitEligibility>)
    .filter(k => data.benefitEligibility[k]);

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1">Sovereign Office</p>
        <h1 className="text-3xl font-serif font-bold">Membership Verification</h1>
        <p className="text-muted-foreground mt-1">
          Your tribal membership status, benefit eligibility, and delegated authorities under sovereign law.
        </p>
      </div>

      {/* Status row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: "Membership", value: data.membershipVerified, yes: "Verified", no: "Unverified" },
          { label: "Microsoft / Entra ID", value: data.entraVerified, yes: "Linked", no: "Not linked" },
          { label: "Lineage Record", value: data.lineageVerified, yes: "On file", no: "Not on file" },
        ].map(({ label, value, yes, no }) => (
          <Card key={label}>
            <CardHeader className="pb-1 pt-4">
              <CardTitle className="text-xs uppercase tracking-widest text-muted-foreground">{label}</CardTitle>
            </CardHeader>
            <CardContent className="pb-4">
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-sm font-semibold ${value ? "bg-green-100 text-green-800" : "bg-zinc-100 text-zinc-600"}`}>
                <span className={`w-2 h-2 rounded-full ${value ? "bg-green-500" : "bg-zinc-400"}`} />
                {value ? yes : no}
              </span>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Protection level + member type */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm uppercase tracking-widest text-muted-foreground">Identity & Protection</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2 items-center">
            <Badge className={protColor}>Protection: {data.protectionLevel}</Badge>
            <Badge variant="outline">{data.memberType}</Badge>
            {data.familyGroup && <Badge variant="secondary">Family: {data.familyGroup}</Badge>}
            {data.identityTags.slice(0, 4).map(t => (
              <Badge key={t} variant="outline" className="text-xs">{t}</Badge>
            ))}
          </div>
          {data.lineageSummary && (
            <p className="text-sm text-muted-foreground border-l-2 border-primary/30 pl-3 italic">{data.lineageSummary}</p>
          )}
          {data.ancestorChain.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1">Ancestor Chain</p>
              <p className="text-sm">{data.ancestorChain.join(" → ")}</p>
            </div>
          )}
          {data.tribalNations.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1">Tribal Nations</p>
              <div className="flex gap-1 flex-wrap">
                {data.tribalNations.map(n => <Badge key={n} variant="secondary" className="text-xs">{n}</Badge>)}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Benefit eligibility */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm uppercase tracking-widest text-muted-foreground">Benefit Eligibility</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {(Object.keys(data.benefitEligibility) as Array<keyof BenefitEligibility>).map(key => (
              <div key={key} className={`flex items-center gap-2 rounded-md border px-3 py-2.5 text-sm ${data.benefitEligibility[key] ? "border-green-200 bg-green-50" : "border-zinc-100 bg-zinc-50 opacity-60"}`}>
                <span className={`w-2 h-2 rounded-full shrink-0 ${data.benefitEligibility[key] ? "bg-green-500" : "bg-zinc-300"}`} />
                <span className={data.benefitEligibility[key] ? "font-medium" : "text-muted-foreground"}>{BENEFIT_LABELS[key]}</span>
              </div>
            ))}
          </div>
          {eligibleBenefits.length === 0 && (
            <p className="text-sm text-muted-foreground mt-2">No benefits currently unlocked. Complete lineage verification and membership enrollment to activate benefits.</p>
          )}
        </CardContent>
      </Card>

      {/* Delegated authorities */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm uppercase tracking-widest text-muted-foreground">Delegated Authorities</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {[
              { label: "Court Filing", value: data.delegatedAuthorities.canFileCourt },
              { label: "Tribal Vote", value: data.delegatedAuthorities.canVote },
              { label: "Receive Welfare", value: data.delegatedAuthorities.canReceiveWelfare },
              { label: "ICWA Protections", value: data.delegatedAuthorities.canReceiveICWA },
              { label: "Hold Office", value: data.delegatedAuthorities.canHoldOffice },
            ].map(({ label, value }) => (
              <div key={label} className={`flex items-center gap-2 rounded-md border px-3 py-2 text-sm ${value ? "border-primary/20 bg-primary/5" : "border-zinc-100 opacity-50"}`}>
                <span className={`text-base ${value ? "text-primary" : "text-zinc-400"}`}>{value ? "✓" : "✗"}</span>
                <span className="text-xs font-medium">{label}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* What Next */}
      {data.whatNext && data.whatNext.length > 0 && (
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm uppercase tracking-widest text-muted-foreground">Recommended Next Steps</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.whatNext.map((step, i) => (
              <div key={i} className="flex gap-3">
                <span className="w-5 h-5 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center font-bold shrink-0 mt-0.5">{i + 1}</span>
                <div>
                  <p className="text-sm font-semibold">{step.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{step.description}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {data.message && (
        <p className="text-sm text-muted-foreground italic border rounded-md p-3">{data.message}</p>
      )}

      <div className="flex flex-wrap gap-2 pt-2">
        <Link href="/family-tree"><Button variant="outline" size="sm">View Family Tree</Button></Link>
        <Link href="/tribal-id"><Button variant="outline" size="sm">Tribal ID & Verification</Button></Link>
        <Link href="/profile"><Button variant="outline" size="sm">Edit Profile</Button></Link>
      </div>
    </div>
  );
}
