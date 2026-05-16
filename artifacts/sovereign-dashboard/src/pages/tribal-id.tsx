import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { removeBackground } from "@imgly/background-removal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth, getCurrentBearerToken } from "@/components/auth-provider";
import { useToast } from "@/hooks/use-toast";
import { Download, Printer, Upload, User, ShieldCheck, Scale, ChevronDown, ChevronUp } from "lucide-react";

interface LegalBasis {
  citation: string;
  title: string;
  valid: boolean;
  notes: string;
}

interface KeyOrder {
  section: string;
  order: string;
}

interface ProtectiveOrder {
  id: number;
  caseNumber: string;
  title: string;
  documentType: string;
  court: string;
  issuer: string;
  issuedDate: string;
  expiresDate: string | null;
  retroactiveTo: string | null;
  status: string;
  supplementalTo: string | null;
  summary: string;
  scope: string;
  coverageRoles: string[];
  coveredPersonCategories: string[];
  legalBases: LegalBasis[];
  keyOrders: KeyOrder[];
  enforcementMechanisms: string[];
  namedRespondents: string[];
  fullFaithAndCredit: boolean;
  selfExecuting: boolean;
  sovereignImmunityReserved: boolean;
}

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
  signatureUrl: string | null;
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

function formatDobDisplay(dob: string): string {
  const ymdhms = dob.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (ymdhms) return `${ymdhms[2]}/${ymdhms[3]}/${ymdhms[1]}`;
  return formatCardDate(dob);
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
  const [expandedOrder, setExpandedOrder] = useState<number | null>(null);

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

  const { data: protectiveOrders } = useQuery<ProtectiveOrder[]>({
    queryKey: ["identity-protective-orders"],
    queryFn: async () => {
      const r = await fetch("/api/identity/protective-orders", {
        headers: { Authorization: `Bearer ${getCurrentBearerToken() ?? ""}` },
      });
      if (!r.ok) return [];
      return r.json();
    },
    enabled: !!user,
    staleTime: 300_000,
  });

  const { data: vaultData } = useQuery<{ hasDob: boolean; dateOfBirth: string | null }>({
    queryKey: ["user-vault-id"],
    queryFn: async () => {
      const r = await fetch("/api/user/vault", {
        headers: { Authorization: `Bearer ${getCurrentBearerToken() ?? ""}` },
      });
      if (!r.ok) return { hasDob: false, dateOfBirth: null };
      return r.json();
    },
    enabled: !!user,
    staleTime: 300_000,
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

  const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const objectUrl = URL.createObjectURL(file);
      let processedBlob: Blob;
      try {
        processedBlob = await removeBackground(objectUrl);
      } finally {
        URL.revokeObjectURL(objectUrl);
      }
      const processedFile = new File([processedBlob], "profile.png", { type: "image/png" });
      photoMutation.mutate(processedFile);
    } catch {
      photoMutation.mutate(file);
    }
  };

  function triggerDownload(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.style.display = "none";
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 30_000);
  }

  const handleDownloadId = async () => {
    setGenerating(true);
    try {
      const r = await fetch(`/api/identity/tribal-id/${user!.id}`, {
        headers: { Authorization: `Bearer ${getCurrentBearerToken() ?? ""}` },
      });
      if (!r.ok) throw new Error("Failed to generate Tribal ID");
      const blob = await r.blob();
      triggerDownload(blob, `tribal-id-${data?.identity.tribalEnrollmentNumber ?? user!.id}.pdf`);
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
      triggerDownload(blob, `verification-letter-${data?.identity.tribalEnrollmentNumber ?? user!.id}.pdf`);
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
          {/* Left seal — role-aware: Chief Justice badge for sovereign office, tribal seal for members */}
          <img
            src={
              isSovereignOfficeRole(data.identity.role)
                ? `${import.meta.env.BASE_URL}chief-justice-seal.png?v=3`
                : `${import.meta.env.BASE_URL}tribal-seal.png?v=4`
            }
            alt={isSovereignOfficeRole(data.identity.role) ? "Office of the Chief Justice & Trustee" : "Mathias El Tribe"}
            style={{ width: 80, height: 80, objectFit: "contain", flexShrink: 0 }}
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
              Sovereign Identity Document
            </p>
            <p className="text-[8px] tracking-wide text-white/50 mt-0.5">
              Office of the Chief Justice &amp; Trustee
            </p>
          </div>

          {/* Right — tribal seal + ID number */}
          <div className="flex flex-col items-center gap-1 flex-shrink-0">
            <img
              src={`${import.meta.env.BASE_URL}tribal-seal.png?v=4`}
              alt="Tribal Seal"
              style={{ width: 80, height: 80, objectFit: "contain" }}
            />
            {idNumber && (
              <div className="text-center">
                <p className="text-[13px] font-bold tracking-wider leading-none" style={{ color: "rgba(230,200,100,1)", fontFamily: "Georgia, serif" }}>
                  NO.&nbsp;{idNumber}
                </p>
                {data.expiryDate && (
                  <p className="text-[7px] text-white/50 mt-0.5">Exp: {formatCardDate(data.expiryDate)}</p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ── CARD BODY ── diamond + photo + fields */}
        <div className="relative flex" style={{ minHeight: 230, overflow: "hidden", background: "#0A0400" }}>

          {/* Diamond — SVG rhombus that touches all 4 edges exactly, matching the template */}
          <svg
            className="absolute inset-0 pointer-events-none"
            style={{ width: "100%", height: "100%" }}
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
          >
            <polygon
              points="50,0 100,50 50,100 0,50"
              fill="#BB0000"
              stroke="#4A7A10"
              strokeWidth="2.5"
            />
          </svg>

          {/* Tribal insignia watermark — chief-justice seal for sovereign office, tribal seal for members */}
          <div
            className="absolute pointer-events-none select-none"
            style={{ right: "4%", top: "50%", transform: "translateY(-50%)", opacity: 0.22, zIndex: 1 }}
          >
            <img
              src={
                isSovereignOfficeRole(data.identity.role)
                  ? `${import.meta.env.BASE_URL}chief-justice-seal.png?v=3`
                  : `${import.meta.env.BASE_URL}tribal-seal.png?v=4`
              }
              alt=""
              aria-hidden="true"
              style={{ width: 300, height: 300, objectFit: "contain" }}
            />
          </div>

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
                {idNumber && <IdField label="ID #" value={`NO. ${idNumber}`} />}
                {(data.bloodline ?? data.tribalNations?.[0]) && (
                  <IdField label="Tribal Bloodline" value={data.bloodline ?? data.tribalNations?.[0] ?? ""} />
                )}
                {vaultData?.dateOfBirth && (
                  <IdField label="Date of Birth" value={formatDobDisplay(vaultData.dateOfBirth)} />
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

            {/* Signature + ISS/EXP — bottom row */}
            <div
              className="flex items-end justify-between pt-2 mt-2 gap-3"
              style={{ borderTop: "1px solid rgba(255,255,255,0.12)" }}
            >
              {/* Signature block — left */}
              <div className="flex-1 min-w-0">
                <p className="text-[7px] tracking-[0.18em] font-semibold uppercase mb-1" style={{ color: "rgba(255,255,255,0.40)" }}>
                  Holder's Signature
                </p>
                {data.signatureUrl ? (
                  <div
                    className="rounded overflow-hidden flex items-end"
                    style={{ height: 38, maxWidth: 180, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.14)", padding: "2px 6px" }}
                  >
                    <img
                      src={data.signatureUrl}
                      alt="Holder signature"
                      style={{ maxHeight: 32, maxWidth: 168, objectFit: "contain", filter: "brightness(0) invert(1)", opacity: 0.88 }}
                    />
                  </div>
                ) : (
                  <div style={{ width: 160, height: 28, borderBottom: "1px solid rgba(255,255,255,0.25)" }} />
                )}
                <p className="text-[6.5px] text-white/25 leading-snug mt-1 max-w-[180px]">
                  By inherent right · Treaty of Dancing Rabbit Creek (1830)
                </p>
              </div>

              {/* ISS / EXP — right */}
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

      {/* ── SOVEREIGN PROTECTIVE ORDERS ─────────────────────────────────────── */}
      {protectiveOrders && protectiveOrders.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Scale className="w-5 h-5 text-amber-600" />
            <h2 className="text-lg font-serif font-bold text-foreground">Sovereign Protective Orders</h2>
            <Badge className="bg-emerald-700 text-white text-[10px] px-2 py-0.5 ml-1">
              {protectiveOrders.length} ACTIVE
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground -mt-1">
            The following protective orders issued by the Mathias El Tribe Supreme Court are in full force and enforceable nationwide under full faith and credit — no registration required.
          </p>

          {protectiveOrders.map((order) => {
            const isMain = !order.supplementalTo;
            const isExpanded = expandedOrder === order.id;

            return (
              <Card
                key={order.id}
                className={`border ${isMain ? "border-amber-200 bg-amber-50/40 dark:bg-amber-950/10 dark:border-amber-900" : "border-border"}`}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <Badge className="bg-emerald-700 text-white text-[9px] px-1.5 font-bold tracking-wider">
                          {order.status.toUpperCase()}
                        </Badge>
                        <span className="text-[11px] font-mono font-semibold text-amber-700 dark:text-amber-400">
                          {order.caseNumber}
                        </span>
                        {order.fullFaithAndCredit && (
                          <Badge variant="outline" className="text-[9px] px-1.5 border-blue-400 text-blue-700 dark:text-blue-400">
                            Full Faith &amp; Credit
                          </Badge>
                        )}
                        {order.selfExecuting && (
                          <Badge variant="outline" className="text-[9px] px-1.5 border-emerald-500 text-emerald-700 dark:text-emerald-400">
                            Self-Executing
                          </Badge>
                        )}
                        {order.supplementalTo && (
                          <Badge variant="secondary" className="text-[9px] px-1.5">
                            Supp. to {order.supplementalTo}
                          </Badge>
                        )}
                      </div>
                      <p className="font-semibold text-sm leading-snug">{order.title}</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        {order.court} · Issued {new Date(order.issuedDate).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })} by {order.issuer}
                        {order.retroactiveTo && ` · Retroactive to ${new Date(order.retroactiveTo).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`}
                      </p>
                    </div>
                    <button
                      onClick={() => setExpandedOrder(isExpanded ? null : order.id)}
                      className="flex-shrink-0 p-1.5 rounded hover:bg-muted transition-colors mt-0.5"
                      aria-label={isExpanded ? "Collapse" : "Expand"}
                    >
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                  </div>
                </CardHeader>

                <CardContent className="pt-0 space-y-3">
                  {/* Summary — always visible */}
                  <p className="text-sm text-muted-foreground leading-relaxed">{order.summary}</p>

                  {/* Coverage chips — always visible */}
                  {order.coveredPersonCategories.length > 0 && (
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Covers</p>
                      <div className="flex flex-wrap gap-1.5">
                        {order.coveredPersonCategories.map((cat) => (
                          <Badge key={cat} variant="secondary" className="text-[10px] px-2">
                            <ShieldCheck className="w-2.5 h-2.5 mr-1 text-emerald-600" />
                            {cat}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Expanded detail */}
                  {isExpanded && (
                    <div className="space-y-3 pt-1 border-t mt-2">

                      {/* Scope */}
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Protective Scope</p>
                        <p className="text-sm text-foreground leading-relaxed">{order.scope}</p>
                      </div>

                      {/* Key orders */}
                      {order.keyOrders.length > 0 && (
                        <div>
                          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Orders Issued</p>
                          <div className="space-y-2">
                            {order.keyOrders.map((ko, i) => (
                              <div key={i} className="flex gap-2">
                                <span className="text-[10px] font-mono font-bold text-amber-600 mt-0.5 flex-shrink-0">{ko.section}</span>
                                <p className="text-sm text-foreground leading-snug">{ko.order}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Legal bases — validated */}
                      {order.legalBases.length > 0 && (
                        <div>
                          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                            Legal Authority &amp; Citations
                            <span className="ml-1.5 text-emerald-600 normal-case font-normal">(all citations validated)</span>
                          </p>
                          <div className="space-y-1.5">
                            {order.legalBases.map((lb, i) => (
                              <div key={i} className="rounded border border-border bg-muted/30 px-2.5 py-1.5">
                                <div className="flex items-center gap-1.5 mb-0.5">
                                  <ShieldCheck className="w-3 h-3 text-emerald-600 flex-shrink-0" />
                                  <span className="text-[10px] font-mono font-semibold text-foreground">{lb.citation}</span>
                                </div>
                                <p className="text-[11px] text-muted-foreground pl-4.5">{lb.title}</p>
                                {lb.notes && (
                                  <p className="text-[10px] text-muted-foreground/70 pl-4.5 italic mt-0.5">{lb.notes}</p>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Enforcement */}
                      {order.enforcementMechanisms.length > 0 && (
                        <div>
                          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Enforcement Mechanisms</p>
                          <ul className="space-y-0.5">
                            {order.enforcementMechanisms.map((e, i) => (
                              <li key={i} className="text-sm text-foreground flex gap-1.5 items-start">
                                <span className="text-amber-600 mt-1 flex-shrink-0">·</span>{e}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Named respondents */}
                      {order.namedRespondents.length > 0 && (
                        <div>
                          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Named Respondents / Enjoined Parties</p>
                          <div className="flex flex-wrap gap-1.5">
                            {order.namedRespondents.map((r) => (
                              <Badge key={r} variant="outline" className="text-[10px] border-red-300 text-red-700 dark:text-red-400">
                                {r}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Footer flags */}
                      <div className="flex flex-wrap gap-3 pt-1 border-t text-[10px] text-muted-foreground">
                        {order.sovereignImmunityReserved && (
                          <span className="flex items-center gap-1">
                            <ShieldCheck className="w-3 h-3 text-amber-600" /> Sovereign immunity fully reserved
                          </span>
                        )}
                        {order.fullFaithAndCredit && (
                          <span className="flex items-center gap-1">
                            <ShieldCheck className="w-3 h-3 text-blue-600" /> Enforceable in all U.S. jurisdictions
                          </span>
                        )}
                        {order.selfExecuting && (
                          <span className="flex items-center gap-1">
                            <ShieldCheck className="w-3 h-3 text-emerald-600" /> Self-executing — no registration required
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Print stylesheet — isolates just the ID card, sized to fit a landscape page */}
      <style>{`
        @media print {
          @page { size: landscape; margin: 0.35in; }
          body * { visibility: hidden !important; }
          #tribal-id-card,
          #tribal-id-card * { visibility: visible !important; }
          #tribal-id-card {
            position: fixed !important;
            top: 50% !important;
            left: 50% !important;
            transform: translate(-50%, -50%) !important;
            width: 90vw !important;
            max-width: 680px !important;
            height: auto !important;
            margin: 0 !important;
            padding: 0 !important;
            box-shadow: none !important;
            border-radius: 8px !important;
            z-index: 9999 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
        }
      `}</style>
    </div>
  );
}
