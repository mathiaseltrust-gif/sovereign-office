import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/components/auth-provider";
import { Link } from "wouter";
import { WhatNextPanel } from "@/components/WhatNextPanel";

function makeToken(u: unknown) { return btoa(JSON.stringify(u)); }

interface GatewayData {
  identity: { legalName: string; tribalName: string; familyGroup: string; displayName: string; identityTags: string[] };
  isElder: boolean;
  elderStatus: string | null;
  elderAuthorities: string[];
  lineageSummary: string;
  ancestorChain: string[];
  tribalNations: string[];
  membershipVerified: boolean;
  protectionLevel: string;
  orgAffiliations: { org: string; role: string; active: boolean }[];
  delegatedAuthorities: { familyGovernance: boolean; familyDocuments: boolean; elderAuthority: boolean };
}

const ELDER_DUTIES = [
  { title: "Lineage Correction", desc: "Review and submit corrections to family lineage records in your care.", href: "/family-tree" },
  { title: "Family Governance", desc: "Preside over family governance documents and council decisions.", href: "/family-tree" },
  { title: "Cultural Authority", desc: "Represent cultural interests in filings and court matters.", href: "/complaints" },
  { title: "Advisory Role", desc: "Submit advisory input to the Sovereign Office on governance matters.", href: "/profile" },
  { title: "Welfare Review", desc: "Review and endorse welfare instrument requests for family members.", href: "/welfare" },
  { title: "Medical Oversight", desc: "Oversee and generate medical notes for dependents in your care.", href: "/medical-notes" },
];

export default function ElderDashboard() {
  const { user } = useAuth();
  const token = makeToken(user);

  const { data, isLoading } = useQuery<GatewayData>({
    queryKey: ["identity-gateway"],
    queryFn: async () => {
      const r = await fetch("/api/identity/gateway", { headers: { Authorization: `Bearer ${token}` } });
      if (!r.ok) throw new Error("Failed to load identity gateway");
      return r.json();
    },
    staleTime: 60_000,
  });

  if (isLoading) return <div className="space-y-4">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-20" />)}</div>;

  const elderLabel = data?.elderStatus
    ? `${data.elderStatus.charAt(0).toUpperCase() + data.elderStatus.slice(1)} Elder`
    : "Elder";

  return (
    <div data-testid="page-elder-dashboard" className="space-y-8">
      <div>
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-3xl font-serif font-bold text-foreground">Elder Dashboard</h1>
          {data?.isElder && (
            <Badge className="bg-amber-100 text-amber-800 border border-amber-300 text-sm px-3 py-1">
              ★ {elderLabel}
            </Badge>
          )}
        </div>
        <p className="text-muted-foreground mt-1">
          Mathias El Tribe Elder Advisory Council — recognized under tribal custom and federal Indian law
        </p>
      </div>

      {/* Identity Summary */}
      {data && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="border-amber-200 bg-amber-50/40">
            <CardContent className="pt-5 space-y-2">
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Display Name</p>
              <p className="font-serif font-bold text-xl text-foreground">{data.identity.displayName || data.identity.legalName}</p>
              {data.identity.tribalName && <p className="text-sm text-muted-foreground italic">{data.identity.tribalName}</p>}
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5 space-y-2">
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Family Group</p>
              <p className="font-semibold text-foreground">{data.identity.familyGroup || "On file with the Office"}</p>
              <Badge variant={data.membershipVerified ? "default" : "secondary"} className="text-xs">
                {data.membershipVerified ? "Membership Verified" : "Pending Verification"}
              </Badge>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5 space-y-2">
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Lineage</p>
              <p className="text-sm text-muted-foreground">{data.lineageSummary}</p>
              {data.tribalNations.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {data.tribalNations.map((n) => <Badge key={n} variant="outline" className="text-xs">{n}</Badge>)}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Elder Authorities */}
      {data?.elderAuthorities && data.elderAuthorities.length > 0 && (
        <Card className="border-amber-300">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm uppercase tracking-widest">Active Elder Authorities</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {data.elderAuthorities.map((auth, i) => (
                <div key={i} className="flex gap-2 text-sm">
                  <span className="text-amber-600 font-bold shrink-0">★</span>
                  <span>{auth}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Ancestor Chain */}
      {data && data.ancestorChain.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm uppercase tracking-widest">Ancestor Chain</CardTitle>
            <p className="text-xs text-muted-foreground">Your documented lineage chain on record with the Sovereign Office</p>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2 items-center">
              {data.ancestorChain.slice(0, 7).map((a, i) => (
                <div key={i} className="flex items-center gap-1">
                  {i > 0 && <span className="text-muted-foreground">→</span>}
                  <Badge variant="secondary" className="text-xs">{a}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          {/* Elder duties grid */}
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground mb-3">Elder Duties & Authorities</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {ELDER_DUTIES.map((d) => (
                <Link key={d.title} href={d.href}>
                  <Card className="cursor-pointer hover:border-primary transition-colors h-full">
                    <CardContent className="pt-4">
                      <p className="text-sm font-semibold text-foreground mb-1">{d.title}</p>
                      <p className="text-xs text-muted-foreground">{d.desc}</p>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </div>

          {/* Identity Tags */}
          {data && data.identity.identityTags.length > 0 && (
            <Card className="mt-6">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm uppercase tracking-widest">Identity Tags</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {data.identity.identityTags.map((t) => <Badge key={t} variant="outline" className="text-xs">{t}</Badge>)}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Quick actions */}
          <Card className="mt-6">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm uppercase tracking-widest">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-3">
              <Link href="/tribal-id">
                <Button size="sm" variant="outline">Generate Tribal ID</Button>
              </Link>
              <Link href="/family-tree">
                <Button size="sm" variant="outline">View Family Tree</Button>
              </Link>
              <Link href="/medical-notes">
                <Button size="sm" variant="outline">Medical Notes</Button>
              </Link>
              <Link href="/profile">
                <Button size="sm" variant="outline">Identity Profile</Button>
              </Link>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-1">
          <WhatNextPanel />
        </div>
      </div>
    </div>
  );
}
