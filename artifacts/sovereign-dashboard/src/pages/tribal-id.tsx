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
  issueDate: string | null;
  expiryDate: string | null;
  bloodline: string | null;
}

const PROTECTION_BADGE: Record<string, string> = {
  standard: "bg-emerald-600 text-white",
  elevated: "bg-amber-600 text-white",
  critical: "bg-red-700 text-white",
};

const ROLE_DISPLAY: Record<string, string> = {
  trustee: "Chief Justice & Trustee",
  sovereign_admin: "Chief Justice & Trustee",
  admin: "Chief Justice & Trustee",
  officer: "Officer",
  elder: "Elder",
  member: "Member",
  medical_provider: "Medical Provider",
  visitor: "Visitor",
  visitor_media: "Media",
};

function formatRole(role: string): string {
  return ROLE_DISPLAY[role.toLowerCase()] ?? role.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function isSovereignOfficeRole(role: string): boolean {
  return ["trustee", "sovereign_admin", "admin"].includes(role.toLowerCase());
}

function formatCardDate(iso: string): string {
  const d = new Date(iso);
  return `${(d.getMonth() + 1).toString().padStart(2, "0")}/${d.getDate().toString().padStart(2, "0")}/${d.getFullYear()}`;
}

function IdField({ label, value, large }: { label: string; value: string; large?: boolean }) {
  return (
    <div>
      <p className="text-[8px] tracking-[0.2em] font-semibold uppercase mb-0.5" style={{ color: "rgba(255,255,255,0.55)" }}>
        {label}:
      </p>
      <p
        className={large ? "text-base font-bold leading-tight" : "text-sm font-semibold leading-tight"}
        style={{ color: "rgba(255,255,255,0.95)", fontFamily: large ? "Georgia, serif" : "inherit" }}
      >
        {value}
      </p>
    </div>
  );
}

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

      {/* ── ID CARD — physical card design ─────────────────────────────────── */}
      <div
        id="tribal-id-card"
        className="rounded-2xl overflow-hidden shadow-2xl print:shadow-none select-none"
        style={{ background: "linear-gradient(160deg, #6B0000 0%, #9B1A1A 45%, #7A0808 100%)", border: "2px solid #5A0A0A" }}
      >
        {/* ── HEADER BAND ── two seals + centered title */}
        <div
          className="relative flex items-center justify-between px-4 py-3"
          style={{ background: "rgba(0,0,0,0.35)", borderBottom: "1px solid rgba(255,255,255,0.12)" }}
        >
          {/* Left seal — Office of the Chief Justice & Trustee */}
          <img
            src={`${import.meta.env.BASE_URL}chief-justice-seal.png`}
            alt="Office of the Chief Justice & Trustee"
            style={{ width: 60, height: 60, objectFit: "contain", flexShrink: 0 }}
          />

          {/* Center title */}
          <div className="flex-1 text-center px-3">
            <h2
              className="text-2xl font-bold text-white tracking-wide leading-tight"
              style={{ fontFamily: "Georgia, 'Times New Roman', serif", textShadow: "0 1px 4px rgba(0,0,0,0.6)" }}
            >
              Mathias El Tribe
            </h2>
            <p className="text-[10px] tracking-[0.35em] font-semibold text-white/75 uppercase mt-0.5">
              Official Member ID
            </p>
          </div>

          {/* Right seal — Tribal */}
          <img
            src={`${import.meta.env.BASE_URL}tribal-seal.png`}
            alt="Tribal Seal"
            style={{ width: 60, height: 60, objectFit: "contain", flexShrink: 0 }}
          />
        </div>

        {/* ── CARD BODY ── diamond + photo + fields */}
        <div className="relative flex" style={{ minHeight: 230, overflow: "hidden", background: "#0A0400" }}>

          {/* Diamond — edge-to-edge, red fill, thick olive border (matches template) */}
          <div
            className="absolute pointer-events-none"
            style={{
              width: 900,
              height: 900,
              background: "#BB0000",
              border: "10px solid #4A7A10",
              transform: "rotate(45deg)",
              left: "50%",
              top: "50%",
              marginLeft: -450,
              marginTop: -450,
            }}
          />

          {/* Photo — left side */}
          <div className="relative z-10 flex flex-col items-center justify-center flex-shrink-0 py-4 pl-5 pr-2" style={{ width: 152 }}>
            <div
              className="relative overflow-hidden cursor-pointer group"
              style={{
                width: 108,
                height: 140,
                border: "2px solid rgba(255,255,255,0.45)",
                borderRadius: 6,
                background: "rgba(0,0,0,0.4)",
                boxShadow: "0 3px 14px rgba(0,0,0,0.5)",
              }}
              onClick={() => fileInputRef.current?.click()}
              title="Click to upload photo"
            >
              {data.profilePhoto ? (
                <img src={data.profilePhoto} alt="Profile" className="w-full h-full object-contain" style={{ background: "transparent" }} />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center gap-1">
                  <User className="w-9 h-9 text-white/40" />
                  <span className="text-[8px] text-white/40">PHOTO</span>
                </div>
              )}
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <Upload className="w-5 h-5 text-white" />
              </div>
            </div>
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoSelect} />
            {photoMutation.isPending && <span className="text-[8px] text-white/50 mt-1">Uploading…</span>}

            {/* Enrollment No. */}
            {ssmel && (
              <div className="text-center mt-2.5">
                <p className="text-[11px] font-bold tracking-widest text-white/90">{ssmel}</p>
                <p className="text-[7px] tracking-wider text-white/45">ENROLLMENT NO.</p>
              </div>
            )}
          </div>

          {/* Fields — right side */}
          <div className="relative z-10 flex-1 flex flex-col justify-between py-4 pr-5 pl-4">
            <div className="space-y-2.5">
              <IdField label="Name" value={data.identity.legalName} large />
              {data.identity.tribalName && (
                <IdField label="Tribal Name" value={data.identity.tribalName} large />
              )}
              <IdField
                label="Title / Office"
                value={
                  isSovereignOfficeRole(data.identity.role)
                    ? "Office of the Chief Justice & Trustee"
                    : data.identity.title || formatRole(data.identity.role)
                }
                large
              />
              <div className="grid grid-cols-2 gap-x-5 gap-y-2.5">
                {ssmel && <IdField label="ID #" value={ssmel} />}
                {(data.bloodline ?? data.tribalNations?.[0]) && (
                  <IdField label="Tribal Bloodline" value={data.bloodline ?? data.tribalNations?.[0] ?? ""} />
                )}
                <IdField label="Role" value={formatRole(data.identity.role)} />
                <div>
                  <p className="text-[8px] tracking-[0.2em] font-semibold uppercase mb-0.5" style={{ color: "rgba(255,255,255,0.55)" }}>
                    Status:
                  </p>
                  <div className="flex items-center gap-1">
                    {data.membershipVerified && <ShieldCheck className="w-3 h-3 text-emerald-300 flex-shrink-0" />}
                    <p className="text-sm font-semibold" style={{ color: data.membershipVerified ? "#6ee7b7" : "rgba(255,255,255,0.75)" }}>
                      {data.membershipVerified ? "Verified" : "Pending"}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* ISS / EXP dates — bottom right of fields */}
            <div
              className="flex items-end justify-between pt-2 mt-2"
              style={{ borderTop: "1px solid rgba(255,255,255,0.12)" }}
            >
              <p className="text-[7.5px] text-white/35 leading-snug max-w-[55%]">
                Issued under inherent sovereign authority · Worcester v. Georgia (1832)
              </p>
              <div className="flex gap-4 flex-shrink-0">
                {data.issueDate && (
                  <div className="text-right">
                    <p className="text-[7px] tracking-wider text-white/45 uppercase">ISS</p>
                    <p className="text-[10px] font-semibold text-white/80">{formatCardDate(data.issueDate)}</p>
                  </div>
                )}
                <div className="text-right">
                  <p className="text-[7px] tracking-wider text-white/45 uppercase">EXP</p>
                  <p className="text-[10px] font-semibold text-white/80">
                    {data.expiryDate
                      ? formatCardDate(data.expiryDate)
                      : new Date(new Date().setFullYear(new Date().getFullYear() + 2)).toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "numeric" })}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── SOVEREIGN OFFICE FOOTER BAR ── */}
        {isSovereignOfficeRole(data.identity.role) && (
          <div
            className="text-center py-1.5 text-[8px] tracking-[0.25em] font-semibold text-white/60"
            style={{ background: "rgba(0,0,0,0.4)", borderTop: "1px solid rgba(255,255,255,0.08)" }}
          >
            OFFICE OF THE CHIEF JUSTICE &amp; TRUSTEE &nbsp;·&nbsp; SOVEREIGN ADMINISTRATION
          </div>
        )}
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
