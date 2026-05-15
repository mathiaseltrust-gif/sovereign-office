import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { getCurrentBearerToken } from "@/components/auth-provider";
import { CheckCircle, ChevronRight, ChevronLeft, Wand2, FileText, Landmark, ScrollText, Heart, AlertTriangle, Scale, BookOpen, Info, ClipboardList, Stethoscope, ShieldCheck, GitBranch } from "lucide-react";
import { cn } from "@/lib/utils";

interface TemplateInfo {
  key: string;
  title: string;
  category: string;
  icon: React.ElementType;
  description: string;
  law: string;
  partyFields: string[];
  needsLand: boolean;
  eligibilityHint?: string;
  roleRequired?: string;
}

const TEMPLATE_CATALOG: TemplateInfo[] = [
  // ── Land Instruments ──
  {
    key: "trust_deed",
    title: "Deed of Trust — Indian Trust Land",
    category: "Land Instruments",
    icon: Landmark,
    description: "Conveys Indian trust land between parties, subject to federal restrictions on alienation under the Non-Intercourse Act.",
    law: "25 U.S.C. § 177",
    partyFields: ["Grantor", "Grantee", "Beneficiary"],
    needsLand: true,
    eligibilityHint: "Use when you have a recorded APN or documented trust land parcel.",
  },
  {
    key: "allotment_lease",
    title: "Lease of Individual Indian Allotment",
    category: "Land Instruments",
    icon: Landmark,
    description: "Leases an individual Indian allotment to another party, subject to BIA approval under allotment regulations.",
    law: "25 U.S.C. § 415",
    partyFields: ["Lessor", "Lessee"],
    needsLand: true,
    eligibilityHint: "Use when leasing allotted trust land. BIA approval required.",
  },
  {
    key: "trust_transfer",
    title: "Trust Land Transfer Instrument",
    category: "Land Instruments",
    icon: Landmark,
    description: "Transfers federal trust land between tribal entities with Secretarial approval. Title remains in trust upon completion.",
    law: "25 U.S.C. § 177",
    partyFields: ["Transferor", "Transferee"],
    needsLand: true,
    eligibilityHint: "For inter-tribal or intra-tribal trust land transfers requiring BIA Land Records filing.",
  },
  {
    key: "trust_land_status_report",
    title: "Trust Land Status Report (TSR)",
    category: "Land Instruments",
    icon: FileText,
    description: "Official report documenting the current trust land status of a parcel for court, agency, or recorder filing.",
    law: "25 U.S.C. §§ 177, 5108",
    partyFields: ["Beneficial Owner(s)"],
    needsLand: true,
    eligibilityHint: "Required for recorder compliance submissions involving trust parcels.",
  },
  {
    key: "trust_land_instrument",
    title: "Trust Land Instrument (General Purpose)",
    category: "Land Instruments",
    icon: Landmark,
    description: "General-purpose trust land instrument covering conveyance, lease, right-of-way, encumbrance, or protective declaration.",
    law: "25 U.S.C. §§ 177, 415, 5108",
    partyFields: ["Grantor / Beneficial Owner", "When Recorded Return To"],
    needsLand: true,
    eligibilityHint: "Use when none of the specific land instruments fits the exact need.",
  },
  {
    key: "trust_land_decision_letter",
    title: "Decision Letter — Trust Land Action",
    category: "Land Instruments",
    icon: FileText,
    description: "Formal determination letter for a submitted trust land action request: approved, denied, conditional, or referred.",
    law: "25 U.S.C. §§ 177, 5108 / Federal Trust Responsibility",
    partyFields: ["Re: Request for", "Applicant / Petitioner", "Member ID"],
    needsLand: false,
    eligibilityHint: "Issued by the Office in response to a filed trust land request.",
  },
  {
    key: "trust_land_intake_form",
    title: "Trust Land Intake Form",
    category: "Land Instruments",
    icon: ClipboardList,
    description: "Intake and routing form for a trust land matter submitted to the Office of the Chief Justice & Trustee for review.",
    law: "25 U.S.C. §§ 177, 415, 5108",
    partyFields: ["Applicant Name", "Tract Number (if known)"],
    needsLand: false,
    eligibilityHint: "First step for any new trust land matter — creates the intake record.",
  },
  {
    key: "trust_land_probate_summary",
    title: "Trust Land Probate Summary",
    category: "Land Instruments",
    icon: FileText,
    description: "Heirship determination and distribution summary for trust land interests of a deceased tribal member under AIPRA.",
    law: "25 U.S.C. §§ 2201–2216 (AIPRA)",
    partyFields: ["Decedent", "Date of Death", "Probate Case No."],
    needsLand: true,
    eligibilityHint: "Use when a tribal member with trust land interests has passed. Coordinates with BIA Probate Office.",
  },
  {
    key: "encumbrance_review",
    title: "Encumbrance Review — Trust Land",
    category: "Land Instruments",
    icon: Scale,
    description: "Reviews and determines the validity of encumbrances (leases, mortgages, liens, ROW) on trust land under federal law.",
    law: "25 U.S.C. § 415 / BIA Trust Regulations",
    partyFields: ["Property Owner / Beneficial Interest", "Tract Number"],
    needsLand: true,
    eligibilityHint: "Use when an encumbrance or lien on trust land requires official review.",
  },
  {
    key: "notice_of_title_defect",
    title: "Notice of Title Defect",
    category: "Land Instruments",
    icon: AlertTriangle,
    description: "Formal notice of an identified defect in the chain of title for a trust land parcel, with required curative action.",
    law: "25 U.S.C. §§ 177, 5108 / United States v. Mitchell II",
    partyFields: ["Re: Tract", "Directed To"],
    needsLand: true,
    eligibilityHint: "Use when a title gap, unauthorized conveyance, or recording error is identified.",
  },
  // ── Sovereignty Declarations ──
  {
    key: "sovereign_restoration_declaration",
    title: "Sovereign Restoration Doctrine — Formal Declaration",
    category: "Sovereignty Declarations",
    icon: ScrollText,
    description: "Counter-document to territorial and identity usurpation. Restores tribal lineage and sovereignty outside state racial categories.",
    law: "SRD-2025 / Worcester v. Georgia, 31 U.S. 515 (1832)",
    partyFields: [],
    needsLand: false,
    eligibilityHint: "Available to all tribal members. Attach to agency correspondence and court filings.",
  },
  {
    key: "inherent_sovereignty_declaration",
    title: "Declaration of Inherent Sovereignty & Self-Government",
    category: "Sovereignty Declarations",
    icon: ScrollText,
    description: "Standing declaration of inherent, pre-constitutional sovereignty operative in all courts, agencies, and proceedings.",
    law: "SD-2025 / United States v. Lara, 541 U.S. 193 (2004)",
    partyFields: ["Declarant"],
    needsLand: false,
    eligibilityHint: "Available to any tribal member for inclusion in filings or correspondence.",
  },
  {
    key: "certification",
    title: "Certification — Office of the Chief Justice & Trustee",
    category: "Sovereignty Declarations",
    icon: ShieldCheck,
    description: "Standalone certification attesting to the trust land status, sovereign protections, and legal authenticity of an instrument or matter.",
    law: "25 U.S.C. §§ 177, 5108 / Federal Trust Responsibility",
    partyFields: ["Chief Justice & Trustee"],
    needsLand: false,
    eligibilityHint: "Use as a standalone attestation in BIA proceedings, court filings, and agency correspondence.",
  },
  {
    key: "cascade_engine_template",
    title: "Cascade Engine Output — Sovereign AI Drafting",
    category: "Sovereignty Declarations",
    icon: GitBranch,
    description: "Structured output record from the Sovereign AI Drafting Engine capturing all triggers, provisions, and document references for a matter.",
    law: "Tribal Law — Sovereignty & Jurisdiction",
    partyFields: ["Matter Type", "Required Authority"],
    needsLand: false,
    eligibilityHint: "Auto-generated by the intake pipeline for complex matters requiring multi-document response.",
  },
  // ── Legal Notices ──
  {
    key: "nfr",
    title: "Notice of Federal Review",
    category: "Legal Notices",
    icon: AlertTriangle,
    description: "Formal notice of violation of federal Indian law, trust terms, or tribal law, requiring remedy within a stated period.",
    law: "25 U.S.C. §§ 177, 5123",
    partyFields: ["Respondent", "Affected Party"],
    needsLand: true,
    eligibilityHint: "Issued by the Office of the Chief Justice. Serve via certified mail with proof of service.",
  },
  {
    key: "state_prohibition_notice",
    title: "State Jurisdictional Prohibitions — Cease and Desist",
    category: "Legal Notices",
    icon: AlertTriangle,
    description: "Formally prohibits a state agency or official from representing, classifying, governing, or taxing tribal members.",
    law: "SPD-2025 / Morton v. Mancari, 417 U.S. 535 (1974)",
    partyFields: ["Directed To", "Re: Tribal Member", "Member ID"],
    needsLand: false,
    eligibilityHint: "Use when a state agency has overstepped tribal jurisdictional boundaries.",
  },
  {
    key: "jurisdiction_enforcement_notice",
    title: "Tribal Jurisdiction — Criminal Jurisdiction Assertion",
    category: "Legal Notices",
    icon: Scale,
    description: "Asserts tribal and federal criminal jurisdiction over matters in Indian Country under the Indian Country Crimes Act.",
    law: "18 U.S.C. §§ 1151, 1152, 1153",
    partyFields: ["Directed To", "Re: Matter", "Indian Country Location"],
    needsLand: false,
    eligibilityHint: "Directed to law enforcement or courts asserting incorrect jurisdiction over Indian Country matters.",
  },
  // ── Medical & Welfare ──
  {
    key: "medical_protection_decree",
    title: "Jurisdictional Decree of Medical Protection & Healing Enforcement",
    category: "Medical & Welfare",
    icon: Heart,
    description: "Elevates tribal medical determinations to court decrees, enforceable against employers, insurers, SSA, and EDD.",
    law: "25 U.S.C. § 1601 et seq. (IHCIA) / Williams v. Lee",
    partyFields: ["Patient / Beneficiary", "Date of Birth", "Member ID"],
    needsLand: false,
    eligibilityHint: "For tribal members with documented medical conditions requiring protective leave or disability determination.",
  },
  {
    key: "disability_enforcement_notice",
    title: "Notice of Tribal Medical Decree — Compliance Required",
    category: "Medical & Welfare",
    icon: Heart,
    description: "Directed to agencies, employers, or insurers requiring compliance with an existing medical protection decree under federal law.",
    law: "25 U.S.C. §§ 1621e, 1647b / Title VI / 42 U.S.C. § 2000d",
    partyFields: ["Directed To", "Re: Patient / Beneficiary", "Member ID", "Decree Reference"],
    needsLand: false,
    eligibilityHint: "Issue after a Medical Protection Decree is in place. Reference its case number.",
  },
  {
    key: "tribal_health_referral",
    title: "Referral for Contract Professional Health Services",
    category: "Medical & Welfare",
    icon: Stethoscope,
    description: "Tribal health services referral for outpatient specialist or diagnostic services with the same federal standing as an IHS facility referral.",
    law: "25 U.S.C. § 1601 et seq. / 42 C.F.R. § 136.11",
    partyFields: ["Patient", "Date of Birth", "Member ID", "Referred To", "Authorizing Provider"],
    needsLand: false,
    eligibilityHint: "For tribal members requiring specialist or outpatient services outside the tribal health facility.",
  },
];

const CATEGORIES = ["Land Instruments", "Sovereignty Declarations", "Legal Notices", "Medical & Welfare"];

const CATEGORY_ICONS: Record<string, React.ElementType> = {
  "Land Instruments": Landmark,
  "Sovereignty Declarations": ScrollText,
  "Legal Notices": AlertTriangle,
  "Medical & Welfare": Heart,
};

const LAND_STATUS_OPTIONS = [
  { value: "trust", label: "Federal Trust Land" },
  { value: "allotment", label: "Individual Indian Allotment" },
  { value: "fee", label: "Fee Simple (Tribal)" },
  { value: "restricted_fee", label: "Restricted Fee" },
  { value: "dependent_indian_community", label: "Dependent Indian Community" },
  { value: "other", label: "Other / Unknown" },
];

interface ProfileData {
  name?: string;
  role?: string;
  email?: string;
  profile?: {
    legalName?: string;
    title?: string;
    mailingAddress?: string;
    apn?: string;
    landStatus?: string;
    hasRecordedInstrument?: boolean;
  };
}

interface WizardState {
  step: number;
  templateKey: string;
  // Step 2 — Identity
  legalName: string;
  officerTitle: string;
  mailingAddress: string;
  county: string;
  state: string;
  email: string;
  // Step 3 — Land
  apn: string;
  landDescription: string;
  landClassification: string;
  requiresNotary: boolean;
  // Step 4 — Parties / template-specific
  parties: Record<string, string>;
  trusteeNotes: string;
  // Meta
  saveToProfile: boolean;
}

const STEPS = [
  "Select Template",
  "Identity & Contact",
  "Land & Property",
  "Document Details",
  "Review & Generate",
];

export default function InstrumentWizardPage() {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const qc = useQueryClient();

  const { data: profileData } = useQuery<ProfileData>({
    queryKey: ["profile"],
    queryFn: async () => {
      const token = getCurrentBearerToken() ?? "";
      const r = await fetch("/api/user/profile", { headers: { Authorization: `Bearer ${token}` } });
      if (!r.ok) throw new Error("Failed to load profile");
      return r.json();
    },
    staleTime: 5 * 60_000,
  });

  const [generated, setGenerated] = useState<{ id: number; title: string } | null>(null);

  const [wiz, setWiz] = useState<WizardState>({
    step: 1,
    templateKey: "",
    legalName: "",
    officerTitle: "",
    mailingAddress: "",
    county: "",
    state: "CA",
    email: "",
    apn: "",
    landDescription: "",
    landClassification: "Indian Trust Land",
    requiresNotary: false,
    parties: {},
    trusteeNotes: "",
    saveToProfile: true,
  });

  const selectedTemplate = TEMPLATE_CATALOG.find(t => t.key === wiz.templateKey) ?? null;

  const prefillFromProfile = (p: ProfileData) => {
    setWiz(prev => ({
      ...prev,
      legalName: p.profile?.legalName ?? p.name ?? prev.legalName,
      officerTitle: p.profile?.title ?? p.role ?? prev.officerTitle,
      mailingAddress: p.profile?.mailingAddress ?? prev.mailingAddress,
      email: p.email ?? prev.email,
      apn: p.profile?.apn ?? prev.apn,
    }));
  };

  const goToStep = (step: number) => {
    if (step === 2 && profileData && !wiz.legalName) prefillFromProfile(profileData);
    setWiz(prev => ({ ...prev, step }));
  };

  const setField = <K extends keyof WizardState>(key: K, value: WizardState[K]) =>
    setWiz(prev => ({ ...prev, [key]: value }));

  const setParty = (field: string, value: string) =>
    setWiz(prev => ({ ...prev, parties: { ...prev.parties, [field]: value } }));

  const generateMutation = useMutation({
    mutationFn: async () => {
      const token = getCurrentBearerToken() ?? "";

      if (wiz.saveToProfile) {
        const profilePatch: Record<string, unknown> = {};
        if (wiz.apn) profilePatch.apn = wiz.apn;
        if (wiz.mailingAddress) profilePatch.mailingAddress = wiz.mailingAddress;
        if (wiz.legalName) profilePatch.legalName = wiz.legalName;
        if (wiz.officerTitle) profilePatch.title = wiz.officerTitle;
        if (Object.keys(profilePatch).length > 0) {
          await fetch("/api/user/profile", {
            method: "PUT",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body: JSON.stringify(profilePatch),
          });
        }
      }

      const landDesc = wiz.landDescription || (wiz.apn ? `APN: ${wiz.apn}` : "");
      // Map wizard party fields directly — the template engine does replaceAll("[KEY]", value)
      // so we pass the exact placeholder text as used in the template, without extra brackets.
      const partyVars = Object.entries(wiz.parties)
        .filter(([, v]) => v.trim())
        .map(([key, value]) => ({ key, value }));

      const variables: Array<{ key: string; value: string }> = [
        ...partyVars,
        // Common identity placeholders across templates
        { key: "GRANTOR FULL NAME", value: wiz.legalName },
        { key: "FULL NAME — CHIEF / TRUSTEE / TRIBAL MEMBER", value: wiz.legalName },
        { key: "APPLICANT FULL NAME", value: wiz.legalName },
        { key: "DECLARANT", value: wiz.legalName },
        { key: "CHIEF JUSTICE FULL NAME", value: wiz.legalName },
        { key: "BENEFICIAL OWNER FULL NAME(S)", value: wiz.legalName },
        { key: "GRANTOR / BENEFICIAL OWNER FULL NAME", value: wiz.legalName },
        // Land description placeholders
        { key: "INSERT FULL LEGAL DESCRIPTION OF TRUST LAND HERE", value: landDesc },
        { key: "INSERT ALLOTMENT LEGAL DESCRIPTION", value: landDesc },
        { key: "INSERT TRUST LAND LEGAL DESCRIPTION", value: landDesc },
        { key: "INSERT DESCRIPTION OF AFFECTED TRUST LAND", value: landDesc },
        { key: "INSERT FULL LEGAL DESCRIPTION — ATTACH EXHIBIT A IF NECESSARY", value: landDesc },
        { key: "INSERT FULL LEGAL DESCRIPTION", value: landDesc },
        // County/State
        { key: "COUNTY", value: wiz.county || "Kern" },
        { key: "STATE", value: wiz.state || "CA" },
      ].filter(v => v.value.trim());

      const body = {
        templateKey: wiz.templateKey,
        templateVariables: variables.filter(v => v.value.trim()),
        recorderMetadata: {
          county: wiz.county || "Kern",
          state: wiz.state || "CA",
          apn: wiz.apn || undefined,
          returnAddress: wiz.mailingAddress || undefined,
          requiresNotary: wiz.requiresNotary,
          documentType: "TRUST INSTRUMENT",
        },
        trusteeNotes: wiz.trusteeNotes || undefined,
      };

      const r = await fetch("/api/trust/instruments", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error ?? `Error ${r.status}`);
      }
      return r.json() as Promise<{ instrument: { id: number; title: string } }>;
    },
    onSuccess: (data) => {
      setGenerated({ id: data.instrument.id, title: data.instrument.title });
      qc.invalidateQueries({ queryKey: ["instruments"] });
      toast({ title: "Document generated", description: data.instrument.title });
    },
    onError: (err: Error) => {
      toast({ title: "Generation failed", description: err.message, variant: "destructive" });
    },
  });

  if (generated) {
    return (
      <div className="max-w-xl mx-auto py-16 text-center space-y-6 px-4">
        <CheckCircle className="h-16 w-16 text-green-600 mx-auto" />
        <h2 className="text-2xl font-bold">Document Generated</h2>
        <p className="text-muted-foreground">{generated.title}</p>
        <div className="flex gap-3 justify-center flex-wrap">
          <Button asChild>
            <a href={`/sovereign-dashboard/instruments/${generated.id}`}>View Instrument</a>
          </Button>
          <Button variant="outline" onClick={() => navigate("/instruments")}>
            All Instruments
          </Button>
          <Button variant="ghost" onClick={() => { setGenerated(null); setWiz(prev => ({ ...prev, step: 1, templateKey: "" })); }}>
            Generate Another
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto py-8 px-4 space-y-6">
      <div className="flex items-center gap-3">
        <Wand2 className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Template Wizard</h1>
          <p className="text-sm text-muted-foreground">Generate trust instruments and sovereign documents from official templates</p>
        </div>
      </div>

      {/* Progress */}
      <div className="flex items-center gap-1">
        {STEPS.map((label, i) => {
          const n = i + 1;
          const done = wiz.step > n;
          const active = wiz.step === n;
          return (
            <div key={n} className="flex items-center gap-1 flex-1 min-w-0">
              <button
                onClick={() => n < wiz.step ? goToStep(n) : undefined}
                className={cn(
                  "flex items-center gap-1.5 text-xs font-medium transition-colors truncate",
                  active && "text-primary",
                  done && "text-green-600 cursor-pointer hover:underline",
                  !active && !done && "text-muted-foreground",
                )}
              >
                <span className={cn(
                  "w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold shrink-0",
                  active && "bg-primary text-white",
                  done && "bg-green-600 text-white",
                  !active && !done && "bg-muted text-muted-foreground",
                )}>
                  {done ? "✓" : n}
                </span>
                <span className="hidden sm:inline truncate">{label}</span>
              </button>
              {i < STEPS.length - 1 && <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />}
            </div>
          );
        })}
      </div>

      {/* Step 1 — Select Template */}
      {wiz.step === 1 && (
        <div className="space-y-5">
          <h2 className="text-lg font-semibold">Which document do you need?</h2>
          {CATEGORIES.map(cat => {
            const CatIcon = CATEGORY_ICONS[cat];
            const items = TEMPLATE_CATALOG.filter(t => t.category === cat);
            return (
              <div key={cat} className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                  <CatIcon className="h-4 w-4" />
                  {cat}
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {items.map(t => (
                    <button
                      key={t.key}
                      onClick={() => setField("templateKey", t.key)}
                      className={cn(
                        "text-left p-3 rounded-lg border transition-all",
                        wiz.templateKey === t.key
                          ? "border-primary bg-primary/5 ring-1 ring-primary"
                          : "border-border hover:border-primary/50 hover:bg-muted/30",
                      )}
                    >
                      <div className="font-medium text-sm leading-snug">{t.title}</div>
                      <div className="text-xs text-muted-foreground mt-1 leading-snug">{t.description}</div>
                      <div className="flex items-center gap-1 mt-2">
                        <BookOpen className="h-3 w-3 text-muted-foreground" />
                        <span className="text-[10px] text-muted-foreground font-mono">{t.law}</span>
                      </div>
                      {t.eligibilityHint && (
                        <div className="flex items-start gap-1 mt-1.5">
                          <Info className="h-3 w-3 text-blue-500 mt-0.5 shrink-0" />
                          <span className="text-[10px] text-blue-600">{t.eligibilityHint}</span>
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
          <div className="flex justify-end pt-2">
            <Button disabled={!wiz.templateKey} onClick={() => goToStep(2)}>
              Continue <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      )}

      {/* Step 2 — Identity */}
      {wiz.step === 2 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Identity &amp; Contact Information</CardTitle>
            <p className="text-sm text-muted-foreground">Pre-filled from your profile where available. Corrections here update your profile.</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Legal Name *</Label>
                <Input value={wiz.legalName} onChange={e => setField("legalName", e.target.value)} placeholder="Full legal name" />
              </div>
              <div className="space-y-1.5">
                <Label>Title / Role</Label>
                <Input value={wiz.officerTitle} onChange={e => setField("officerTitle", e.target.value)} placeholder="e.g. Chief Justice & Trustee" />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Mailing Address (Return Address)</Label>
                <Input value={wiz.mailingAddress} onChange={e => setField("mailingAddress", e.target.value)} placeholder="Street, City, State, ZIP" />
              </div>
              <div className="space-y-1.5">
                <Label>County</Label>
                <Input value={wiz.county} onChange={e => setField("county", e.target.value)} placeholder="e.g. Kern" />
              </div>
              <div className="space-y-1.5">
                <Label>State</Label>
                <Select value={wiz.state} onValueChange={v => setField("state", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["CA", "AZ", "NM", "OK", "SD", "ND", "MT", "WA", "OR", "ID", "WY", "CO", "UT", "NV", "Other"].map(s => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Email</Label>
                <Input type="email" value={wiz.email} onChange={e => setField("email", e.target.value)} placeholder="Official email" />
              </div>
            </div>
            <NavButtons prev={() => goToStep(1)} next={() => goToStep(selectedTemplate?.needsLand ? 3 : 4)} nextLabel={selectedTemplate?.needsLand ? "Next" : "Skip to Details"} nextDisabled={!wiz.legalName} />
          </CardContent>
        </Card>
      )}

      {/* Step 3 — Land & Property */}
      {wiz.step === 3 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Land &amp; Property Information</CardTitle>
            <p className="text-sm text-muted-foreground">Used in the recorder header and legal description sections of the document.</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Assessor&apos;s Parcel Number (APN)</Label>
                <Input value={wiz.apn} onChange={e => setField("apn", e.target.value)} placeholder="e.g. 381-020-17-00" />
              </div>
              <div className="space-y-1.5">
                <Label>Land Classification</Label>
                <Select value={wiz.landClassification} onValueChange={v => setField("landClassification", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {LAND_STATUS_OPTIONS.map(o => (
                      <SelectItem key={o.value} value={o.label}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Legal Description of Land</Label>
                <Textarea
                  value={wiz.landDescription}
                  onChange={e => setField("landDescription", e.target.value)}
                  placeholder="Full legal description of the parcel or territory, including lot, block, tract, township, range as recorded."
                  rows={4}
                />
              </div>
            </div>
            <div className="flex items-center gap-2 pt-1">
              <Checkbox
                id="notary"
                checked={wiz.requiresNotary}
                onCheckedChange={v => setField("requiresNotary", !!v)}
              />
              <Label htmlFor="notary" className="font-normal cursor-pointer">Include notary acknowledgment block</Label>
            </div>
            <NavButtons prev={() => goToStep(2)} next={() => goToStep(4)} />
          </CardContent>
        </Card>
      )}

      {/* Step 4 — Parties / Template-Specific Details */}
      {wiz.step === 4 && selectedTemplate && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Document Details</CardTitle>
            <p className="text-sm text-muted-foreground">
              Template: <span className="font-medium text-foreground">{selectedTemplate.title}</span>
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            {selectedTemplate.partyFields.length > 0 ? (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">Fill in the named parties for this document. These replace the placeholders in the official template.</p>
                {selectedTemplate.partyFields.map(field => (
                  <div key={field} className="space-y-1.5">
                    <Label>{field}</Label>
                    <Input
                      value={wiz.parties[field] ?? ""}
                      onChange={e => setParty(field, e.target.value)}
                      placeholder={`Full name / entity for "${field}"`}
                    />
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex items-start gap-2 p-3 bg-muted/40 rounded-md text-sm text-muted-foreground">
                <Info className="h-4 w-4 mt-0.5 shrink-0" />
                <span>This template uses standard parties from the Office of the Chief Justice &amp; Trustee. No additional party names are required.</span>
              </div>
            )}
            <div className="space-y-1.5 pt-2">
              <Label>Trustee Notes (optional)</Label>
              <Textarea
                value={wiz.trusteeNotes}
                onChange={e => setField("trusteeNotes", e.target.value)}
                placeholder="Internal notes, filing instructions, or additional context for the trustee record."
                rows={3}
              />
            </div>
            <NavButtons prev={() => goToStep(selectedTemplate.needsLand ? 3 : 2)} next={() => goToStep(5)} />
          </CardContent>
        </Card>
      )}

      {/* Step 5 — Review & Generate */}
      {wiz.step === 5 && selectedTemplate && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Review</CardTitle>
              <p className="text-sm text-muted-foreground">Confirm the information below before generating the official document.</p>
            </CardHeader>
            <CardContent className="space-y-4">
              <ReviewSection title="Document">
                <ReviewRow label="Template" value={selectedTemplate.title} />
                <ReviewRow label="Authority" value={selectedTemplate.law} />
                {wiz.requiresNotary && <ReviewRow label="Notary Block" value="Yes — included" />}
              </ReviewSection>

              <ReviewSection title="Identity">
                <ReviewRow label="Legal Name" value={wiz.legalName} />
                {wiz.officerTitle && <ReviewRow label="Title" value={wiz.officerTitle} />}
                {wiz.mailingAddress && <ReviewRow label="Return Address" value={wiz.mailingAddress} />}
                {wiz.county && <ReviewRow label="County / State" value={`${wiz.county}, ${wiz.state}`} />}
              </ReviewSection>

              {(wiz.apn || wiz.landDescription) && (
                <ReviewSection title="Land">
                  {wiz.apn && <ReviewRow label="APN" value={wiz.apn} />}
                  <ReviewRow label="Classification" value={wiz.landClassification} />
                  {wiz.landDescription && <ReviewRow label="Legal Description" value={wiz.landDescription} truncate />}
                </ReviewSection>
              )}

              {Object.keys(wiz.parties).length > 0 && (
                <ReviewSection title="Parties">
                  {Object.entries(wiz.parties).filter(([, v]) => v).map(([k, v]) => (
                    <ReviewRow key={k} label={k} value={v} />
                  ))}
                </ReviewSection>
              )}

              <div className="flex items-center gap-2 pt-1">
                <Checkbox
                  id="saveProf"
                  checked={wiz.saveToProfile}
                  onCheckedChange={v => setField("saveToProfile", !!v)}
                />
                <Label htmlFor="saveProf" className="font-normal cursor-pointer text-sm">
                  Save name, address, and APN back to my profile
                </Label>
              </div>
            </CardContent>
          </Card>

          <div className="flex gap-3 justify-between">
            <Button variant="outline" onClick={() => goToStep(4)}>
              <ChevronLeft className="h-4 w-4 mr-1" /> Back
            </Button>
            <Button
              onClick={() => generateMutation.mutate()}
              disabled={generateMutation.isPending}
              className="min-w-[160px]"
            >
              {generateMutation.isPending ? (
                <span className="flex items-center gap-2"><span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" /> Generating…</span>
              ) : (
                <span className="flex items-center gap-2"><Wand2 className="h-4 w-4" /> Generate Document</span>
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function NavButtons({
  prev,
  next,
  nextLabel = "Continue",
  nextDisabled = false,
}: {
  prev: () => void;
  next: () => void;
  nextLabel?: string;
  nextDisabled?: boolean;
}) {
  return (
    <div className="flex justify-between pt-2">
      <Button variant="outline" size="sm" onClick={prev}>
        <ChevronLeft className="h-4 w-4 mr-1" /> Back
      </Button>
      <Button size="sm" onClick={next} disabled={nextDisabled}>
        {nextLabel} <ChevronRight className="h-4 w-4 ml-1" />
      </Button>
    </div>
  );
}

function ReviewSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">{title}</div>
      <div className="divide-y divide-border rounded-md border overflow-hidden">{children}</div>
    </div>
  );
}

function ReviewRow({ label, value, truncate }: { label: string; value: string; truncate?: boolean }) {
  if (!value) return null;
  return (
    <div className="flex gap-3 px-3 py-2 text-sm">
      <span className="text-muted-foreground shrink-0 w-32">{label}</span>
      <span className={cn("font-medium break-words", truncate && "truncate")}>{value}</span>
    </div>
  );
}
