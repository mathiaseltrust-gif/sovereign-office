import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth, getCurrentBearerToken } from "@/components/auth-provider";
import { useToast } from "@/hooks/use-toast";
import { Download, Printer, Upload, User, ShieldCheck } from "lucide-react";

interface GatewayData {
  identity: {
    userId: number;
    legalName: string;
    tribalName: string;
    title: string;
    familyGroup: string;
    courtCaption: string;
    role: string;
    identityTags: string[];
    displayName: string;
    tribalEnrollmentNumber: string | null;
    tribalIdNumber: string | null;
  };
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
  profilePhoto: string | null;
}

const PROTECTION_BADGE: Record<string, string> = {
  standard: "bg-emerald-600 text-white",
  elevated: "bg-amber-600 text-white",
  critical: "bg-red-700 text-white",
};

export default function TribalIdPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [generating, setGenerating] = useState(false);
  const [genLetter, setGenLetter] = useState(false);

  const { data, isLoading } = useQuery<GatewayData>({
    queryKey: ["identity-gateway", user?.id],
    queryFn: async () => {
      const r = await fetch("/api/identity/gateway", {
        headers: { Authorization: `Bearer ${getCurrentBearerToken() ?? ""}` },
      });
      if (!r.ok) throw new Error("Failed to load identity gateway");
      return r.json();
    },
    enabled: !!user,
    staleTime: 60_000,
  });

  const photoMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("photo", file);
      const r = await fetch("/api/identity/photo", {
        method: "POST",
        headers: { Authorization: `Bearer ${getCurrentBearerToken() ?? ""}` },
        body: formData,
      });
      if (!r.ok) throw new Error("Upload failed");
      return r.json();
    },
    onSuccess: () => {
      toast({ title: "Photo updated", description: "Your profile photo has been saved." });
      qc.invalidateQueries({ queryKey: ["identity-gateway", user?.id] });
    },
    onError: (e) => toast({ title: "Upload failed", description: (e as Error).message, variant: "destructive" }),
  });

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) photoMutation.mutate(file);
  };

  const handleDownloadId = async () => {
    setGenerating(true);
    try {
      const r = await fetch(`/api/identity/tribal-id/${user!.id}`, {
        headers: { Authorization: `Bearer ${getCurrentBearerToken() ?? ""}` },
      });
      if (!r.ok) throw new Error("Failed to generate Tribal ID");
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `tribal-id-${data?.identity.tribalEnrollmentNumber ?? user!.id}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: "Tribal ID Generated", description: "Your Tribal ID PDF has been downloaded." });
    } catch (err) {
      toast({ title: "Error", description: (err as Error).message, variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  };

  const handleVerificationLetter = async () => {
    setGenLetter(true);
    try {
      const r = await fetch("/api/identity/verification-letter/generate", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${getCurrentBearerToken() ?? ""}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ purpose: "General Identity Verification" }),
      });
      if (!r.ok) throw new Error("Failed to generate Verification Letter");
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `verification-letter-${data?.identity.tribalEnrollmentNumber ?? user!.id}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: "Verification Letter Generated", description: "Verification letter PDF downloaded." });
    } catch (err) {
      toast({ title: "Error", description: (err as Error).message, variant: "destructive" });
    } finally {
      setGenLetter(false);
    }
  };

  if (!user) return null;
  if (isLoading) {
    return (
      <div className="space-y-4">
        {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24" />)}
      </div>
    );
  }
  if (!data) return null;

  const ssmel = data.identity.tribalEnrollmentNumber;
  const idNumber = data.identity.tribalIdNumber;
  const activeBenefits = Object.entries(data.benefitEligibility ?? {}).filter(([, v]) => v);
  const BENEFIT_LABELS: Record<string, string> = {
    icwa: "ICWA", tribalWelfare: "Tribal Welfare", trustBeneficiary: "Trust Beneficiary",
    membershipBenefits: "Member Benefits", ancestralLandRights: "Ancestral Land Rights",
  };

  return (
    <div data-testid="page-tribal-id" className="space-y-8 max-w-4xl">
      <div>
        <h1 className="text-3xl font-serif font-bold text-foreground">Tribal ID & Verification</h1>
        <p className="text-muted-foreground mt-1">
          Mathias El Tribe Sovereign Identity Gateway — Issued by the Office of the Chief Justice &amp; Trustee
        </p>
      </div>

      {/* ── ID CARD ─────────────────────────────────────────────────────────── */}
      <div
        id="tribal-id-card"
        className="rounded-xl overflow-hidden shadow-2xl print:shadow-none"
        style={{ background: "linear-gradient(135deg, #0d1529 0%, #141e3c 60%, #0a1020 100%)", border: "1.5px solid #8a6e24" }}
      >
        <div className="flex">
          {/* Left panel — logo + photo + SSMEL */}
          <div
            className="flex flex-col items-center justify-between py-6 px-4 gap-4 shrink-0"
            style={{ width: 160, background: "rgba(0,0,0,0.35)", borderRight: "1px solid rgba(138,110,36,0.4)" }}
          >
            {/* Tribe name */}
            <div className="text-center">
              <p className="text-[9px] tracking-[0.2em] font-semibold" style={{ color: "#d4af37" }}>MATHIAS EL</p>
              <p className="text-[9px] tracking-[0.2em] font-semibold" style={{ color: "#d4af37" }}>TRIBE</p>
            </div>

            {/* Full-color tribal seal — original colors preserved */}
            <img
              src="/tribal-seal.png"
              alt="Mathias El Tribe Seal"
              className="w-24 h-24 object-contain"
              style={{ filter: "none" }}
            />

            {/* Profile photo section */}
            <div className="flex flex-col items-center gap-2">
              <div
                className="relative w-16 h-20 rounded overflow-hidden flex items-center justify-center cursor-pointer group"
                style={{ border: "1.5px solid #8a6e24", background: "rgba(20,30,60,0.6)" }}
                onClick={() => fileInputRef.current?.click()}
                title="Click to upload profile photo"
              >
                {data.profilePhoto ? (
                  <img src={data.profilePhoto} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  <div className="flex flex-col items-center gap-1">
                    <User className="w-6 h-6" style={{ color: "#8a6e24" }} />
                    <span className="text-[7px] text-center leading-tight" style={{ color: "#8a6e24" }}>
                      PHOTO
                    </span>
                  </div>
                )}
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <Upload className="w-4 h-4 text-white" />
                </div>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handlePhotoSelect}
              />
              {photoMutation.isPending && (
                <span className="text-[8px]" style={{ color: "#d4af37" }}>Uploading…</span>
              )}
            </div>

            {/* SSMEL enrollment number */}
            <div className="text-center">
              {ssmel && (
                <p className="font-bold text-[11px] tracking-widest" style={{ color: "#d4af37" }}>{ssmel}</p>
              )}
              <p className="text-[7px] tracking-wider" style={{ color: "rgba(212,175,55,0.6)" }}>ENROLLMENT NO.</p>
            </div>
          </div>

          {/* Right — identity content */}
          <div className="flex-1 p-6">
            {/* Header strip */}
            <div className="flex items-start justify-between mb-4 pb-3" style={{ borderBottom: "0.5px solid rgba(138,110,36,0.4)" }}>
              <div>
                <p className="text-[9px] tracking-[0.18em] font-semibold mb-1" style={{ color: "#d4af37" }}>
                  SOVEREIGN IDENTITY DOCUMENT
                </p>
                <p className="text-[8px]" style={{ color: "rgba(160,165,200,0.8)" }}>
                  Office of the Chief Justice &amp; Trustee
                </p>
              </div>
              {/* Tribal ID number badge */}
              {idNumber && (
                <div className="text-right">
                  <p className="text-2xl font-bold tracking-widest" style={{ color: "#d4af37", fontFamily: "serif" }}>
                    NO. {idNumber}
                  </p>
                  <p className="text-[8px]" style={{ color: "rgba(160,165,200,0.7)" }}>
                    Exp: {new Date(new Date().setFullYear(new Date().getFullYear() + 2)).toLocaleDateString("en-US", { year: "numeric", month: "short" })}
                  </p>
                </div>
              )}
            </div>

            {/* Two-column layout */}
            <div className="grid grid-cols-2 gap-x-6 gap-y-3">
              <div>
                <p className="text-[8px] tracking-widest mb-0.5" style={{ color: "rgba(160,165,200,0.6)" }}>LEGAL NAME</p>
                <p className="text-lg font-bold" style={{ color: "rgba(255,255,255,0.95)", fontFamily: "serif" }}>
                  {data.identity.legalName}
                </p>
              </div>

              {data.identity.tribalName && (
                <div>
                  <p className="text-[8px] tracking-widest mb-0.5" style={{ color: "rgba(160,165,200,0.6)" }}>TRIBAL NAME</p>
                  <p className="text-sm" style={{ color: "rgba(230,230,245,0.9)" }}>{data.identity.tribalName}</p>
                </div>
              )}

              {data.identity.title && (
                <div>
                  <p className="text-[8px] tracking-widest mb-0.5" style={{ color: "rgba(160,165,200,0.6)" }}>TITLE / OFFICE</p>
                  <p className="text-sm" style={{ color: "rgba(230,230,245,0.9)" }}>{data.identity.title}</p>
                </div>
              )}

              <div>
                <p className="text-[8px] tracking-widest mb-0.5" style={{ color: "rgba(160,165,200,0.6)" }}>ROLE</p>
                <p className="text-sm capitalize" style={{ color: "rgba(230,230,245,0.9)" }}>
                  {data.identity.role.replace(/_/g, " ")}
                </p>
              </div>

              <div>
                <p className="text-[8px] tracking-widest mb-0.5" style={{ color: "rgba(160,165,200,0.6)" }}>MEMBERSHIP STATUS</p>
                <div className="flex items-center gap-2">
                  {data.membershipVerified
                    ? <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                    : null}
                  <p className="text-sm" style={{ color: data.membershipVerified ? "#4ade80" : "rgba(230,230,245,0.9)" }}>
                    {data.membershipVerified ? "Verified Member" : "Pending Verification"}
                  </p>
                </div>
              </div>

              <div>
                <p className="text-[8px] tracking-widest mb-0.5" style={{ color: "rgba(160,165,200,0.6)" }}>PROTECTION LEVEL</p>
                <span className={`inline-block text-[9px] font-bold px-2 py-0.5 rounded ${PROTECTION_BADGE[data.protectionLevel]}`}>
                  {data.protectionLevel.toUpperCase()}
                </span>
              </div>

              <div className="col-span-2">
                <p className="text-[8px] tracking-widest mb-0.5" style={{ color: "rgba(160,165,200,0.6)" }}>LINEAGE SUMMARY</p>
                <p className="text-[11px] leading-relaxed" style={{ color: "rgba(180,183,215,0.85)" }}>
                  {data.lineageSummary}
                </p>
              </div>
            </div>

            {/* Bottom bar */}
            <div
              className="mt-4 pt-2 text-[7.5px] text-center"
              style={{ borderTop: "0.5px solid rgba(138,110,36,0.3)", color: "rgba(120,125,165,0.7)" }}
            >
              Issued under inherent sovereign authority of the Mathias El Tribe &nbsp;|&nbsp; Federal Trust Responsibility &nbsp;|&nbsp; Worcester v. Georgia, 31 U.S. 515 (1832)
            </div>
          </div>
        </div>
      </div>

      {/* ── ACTION BUTTONS ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Button
          className="gap-2"
          onClick={handleDownloadId}
          disabled={generating}
        >
          <Download className="w-4 h-4" />
          {generating ? "Generating…" : "Download Tribal ID (PDF)"}
        </Button>

        <Button
          variant="outline"
          className="gap-2"
          onClick={handleVerificationLetter}
          disabled={genLetter}
        >
          <Download className="w-4 h-4" />
          {genLetter ? "Generating…" : "Verification Letter (PDF)"}
        </Button>

        <Button
          variant="ghost"
          className="gap-2"
          onClick={() => window.print()}
        >
          <Printer className="w-4 h-4" />
          Print ID Card
        </Button>
      </div>

      {/* ── ACTIVE BENEFITS ─────────────────────────────────────────────────── */}
      {activeBenefits.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm uppercase tracking-widest">Benefit Eligibility</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {activeBenefits.map(([k]) => (
                <Badge key={k} className="bg-blue-100 text-blue-800 border border-blue-200 text-xs">
                  {BENEFIT_LABELS[k] ?? k}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── ORG AFFILIATIONS ────────────────────────────────────────────────── */}
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

      {/* ── LINEAGE CHAIN ───────────────────────────────────────────────────── */}
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

      {/* ── IDENTITY TAGS ───────────────────────────────────────────────────── */}
      {data.identity.identityTags.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm uppercase tracking-widest">Identity Tags</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {data.identity.identityTags.map((t) => (
                <Badge key={t} variant="secondary" className="text-xs">{t}</Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Print stylesheet override */}
      <style>{`
        @media print {
          body > *:not(#tribal-id-card) { display: none !important; }
          #tribal-id-card { width: 100% !important; break-inside: avoid; }
        }
      `}</style>
    </div>
  );
}
