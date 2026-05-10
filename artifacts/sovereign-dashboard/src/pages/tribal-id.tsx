import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/components/auth-provider";
import { useToast } from "@/hooks/use-toast";

function makeToken(u: unknown) { return btoa(JSON.stringify(u)); }

interface GatewayData {
  identity: { userId: number; legalName: string; tribalName: string; title: string; familyGroup: string; courtCaption: string; role: string; identityTags: string[]; displayName: string };
  lineageSummary: string;
  membershipVerified: boolean;
  protectionLevel: "standard" | "elevated" | "critical";
  isElder: boolean;
  elderStatus: string | null;
  orgAffiliations: { org: string; role: string; active: boolean }[];
  tribalNations: string[];
  ancestorChain: string[];
  benefitEligibility: Record<string, boolean>;
  delegatedAuthorities: { canGenerateTribalId: boolean; memberType: string };
}

const PROTECTION_COLOR: Record<string, string> = {
  standard: "bg-green-100 text-green-800 border-green-300",
  elevated: "bg-orange-100 text-orange-800 border-orange-300",
  critical: "bg-red-100 text-red-800 border-red-300",
};

export default function TribalIdPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  if (!user) return null;
  const token = makeToken(user);
  const [generating, setGenerating] = useState(false);
  const [genLetter, setGenLetter] = useState(false);

  const { data, isLoading } = useQuery<GatewayData>({
    queryKey: ["identity-gateway"],
    queryFn: async () => {
      const r = await fetch("/api/identity/gateway", { headers: { Authorization: `Bearer ${token}` } });
      if (!r.ok) throw new Error("Failed to load identity gateway");
      return r.json();
    },
    staleTime: 60_000,
  });

  const handleDownloadId = async () => {
    setGenerating(true);
    try {
      const r = await fetch(`/api/identity/tribal-id/${user.id}`, { headers: { Authorization: `Bearer ${token}` } });
      if (!r.ok) throw new Error("Failed to generate Tribal ID");
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `tribal-id-${user.id}.pdf`; a.click();
      URL.revokeObjectURL(url);
      toast({ title: "Tribal ID Generated", description: "Your Tribal ID PDF has been downloaded." });
    } catch (err) {
      toast({ title: "Error", description: (err as Error).message, variant: "destructive" });
    } finally { setGenerating(false); }
  };

  const handleVerificationLetter = async () => {
    setGenLetter(true);
    try {
      const r = await fetch("/api/identity/verification-letter/generate", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ purpose: "General Identity Verification" }),
      });
      if (!r.ok) throw new Error("Failed to generate Verification Letter");
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url;
      a.download = `verification-letter-${user.id}.pdf`; a.click();
      URL.revokeObjectURL(url);
      toast({ title: "Verification Letter Generated", description: "Verification letter PDF downloaded." });
    } catch (err) {
      toast({ title: "Error", description: (err as Error).message, variant: "destructive" });
    } finally { setGenLetter(false); }
  };

  if (isLoading) return <div className="space-y-4">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-20" />)}</div>;
  if (!data) return null;

  const activeBenefits = Object.entries(data.benefitEligibility ?? {}).filter(([, v]) => v);
  const BENEFIT_LABELS: Record<string, string> = { icwa: "ICWA", tribalWelfare: "Tribal Welfare", trustBeneficiary: "Trust Beneficiary", membershipBenefits: "Member Benefits", ancestralLandRights: "Ancestral Land Rights" };

  return (
    <div data-testid="page-tribal-id" className="space-y-8 max-w-3xl">
      <div>
        <h1 className="text-3xl font-serif font-bold text-foreground">Tribal ID & Verification</h1>
        <p className="text-muted-foreground mt-1">Mathias El Tribe Sovereign Identity Gateway — Issued by the Office of the Chief Justice & Trustee</p>
      </div>

      {/* ID Card Preview */}
      <div className="border-2 border-primary/30 rounded-xl overflow-hidden shadow-lg bg-gradient-to-br from-amber-50 to-white">
        <div className="bg-primary text-primary-foreground px-6 py-3 flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-widest opacity-80">Mathias El Tribe</p>
            <p className="font-serif font-bold text-lg">Sovereign Identity Document</p>
          </div>
          <Badge className={`${PROTECTION_COLOR[data.protectionLevel]} border text-xs font-semibold`}>
            {data.protectionLevel.toUpperCase()} Protection
          </Badge>
        </div>
        <div className="px-6 py-5 grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-3">
            <div>
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Legal Name</p>
              <p className="font-semibold text-foreground text-lg">{data.identity.legalName || "—"}</p>
            </div>
            {data.identity.tribalName && (
              <div>
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Tribal Name</p>
                <p className="font-medium text-foreground">{data.identity.tribalName}</p>
              </div>
            )}
            {data.identity.title && (
              <div>
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Title</p>
                <p className="text-foreground">{data.identity.title}</p>
              </div>
            )}
            <div>
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Family Group</p>
              <p className="text-foreground">{data.identity.familyGroup || "On file with the Office"}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Role</p>
              <p className="text-foreground capitalize">{data.identity.role.replace(/_/g, " ")}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Membership</p>
              <Badge variant={data.membershipVerified ? "default" : "secondary"} className="text-xs mt-0.5">
                {data.membershipVerified ? "Verified Member" : "Pending Verification"}
              </Badge>
            </div>
            {data.isElder && (
              <div>
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Elder Status</p>
                <Badge className="bg-amber-100 text-amber-800 text-xs border border-amber-300 capitalize mt-0.5">
                  {data.elderStatus ? `${data.elderStatus} Elder` : "Elder"}
                </Badge>
              </div>
            )}
          </div>
          <div className="space-y-3">
            <div>
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Lineage Summary</p>
              <p className="text-sm text-muted-foreground">{data.lineageSummary}</p>
            </div>
            {data.tribalNations.length > 0 && (
              <div>
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Tribal Nations</p>
                <div className="flex flex-wrap gap-1 mt-0.5">
                  {data.tribalNations.map((n) => <Badge key={n} variant="outline" className="text-xs">{n}</Badge>)}
                </div>
              </div>
            )}
            {activeBenefits.length > 0 && (
              <div>
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Benefit Eligibility</p>
                <div className="flex flex-wrap gap-1 mt-0.5">
                  {activeBenefits.map(([k]) => <Badge key={k} className="bg-blue-100 text-blue-800 text-xs">{BENEFIT_LABELS[k] ?? k}</Badge>)}
                </div>
              </div>
            )}
            {data.identity.identityTags.length > 0 && (
              <div>
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Identity Tags</p>
                <div className="flex flex-wrap gap-1 mt-0.5">
                  {data.identity.identityTags.slice(0, 6).map((t) => <Badge key={t} variant="secondary" className="text-xs">{t}</Badge>)}
                </div>
              </div>
            )}
            <div className="pt-2 border-t">
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Issuing Authority</p>
              <p className="text-xs text-muted-foreground">Mathias El Tribe Sovereign Identity Gateway</p>
              <p className="text-xs text-muted-foreground">Office of the Chief Justice & Trustee</p>
            </div>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm uppercase tracking-widest">Tribal ID Document</CardTitle>
            <p className="text-xs text-muted-foreground">
              Official Tribal ID PDF with QR code, lineage summary (3–5 generation chain), identity tags, and issuing authority block.
            </p>
          </CardHeader>
          <CardContent>
            <Button className="w-full" onClick={handleDownloadId} disabled={generating}>
              {generating ? "Generating..." : "Download Tribal ID (PDF)"}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm uppercase tracking-widest">Verification Letter</CardTitle>
            <p className="text-xs text-muted-foreground">
              Formal letter verifying identity, lineage, membership, delegated authorities, jurisdictional protections, and sovereign signature block.
            </p>
          </CardHeader>
          <CardContent>
            <Button className="w-full" variant="outline" onClick={handleVerificationLetter} disabled={genLetter}>
              {genLetter ? "Generating..." : "Download Verification Letter (PDF)"}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Org Affiliations */}
      {data.orgAffiliations.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm uppercase tracking-widest">Organizational Affiliations</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {data.orgAffiliations.map((org, i) => (
                <div key={i} className="flex items-center justify-between py-1.5 border-b last:border-0">
                  <span className="text-sm font-medium">{org.org}</span>
                  <Badge variant="outline" className="text-xs capitalize">{org.role}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Ancestor Chain */}
      {data.ancestorChain.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm uppercase tracking-widest">Lineage Chain (3–5 Generations)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {data.ancestorChain.slice(0, 5).map((a, i) => (
                <div key={i} className="flex items-center gap-1">
                  {i > 0 && <span className="text-muted-foreground text-xs">→</span>}
                  <Badge variant="secondary" className="text-xs">{a}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
