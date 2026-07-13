import { useState, useRef } from "react";
import { useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/components/auth-provider";
import { getCurrentBearerToken } from "@/components/auth-provider";
import { SovereignIntakeGuard } from "@/components/SovereignIntakeGuard";
import { ArrowRight, Shield, FileText, Mic, MicOff, Volume2, VolumeX, Copy } from "lucide-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

const INSTRUMENT_TO_DOC: Record<string, string> = {
  ICWA_NOTICE: "icwa_notice", ICWA: "icwa_notice",
  NFR: "nfr_notice", NFR_NOTICE: "nfr_notice", FEDERAL_REVIEW: "nfr_notice",
  TRO: "court_document", TRO_GENERAL: "court_document",
  GWE: "gwe_letter", GWE_LETTER: "gwe_letter",
  WELFARE: "welfare_letter", WELFARE_LETTER: "welfare_letter",
  AFFIDAVIT: "tribal_affidavit", TRIBAL_AFFIDAVIT: "tribal_affidavit",
  CEASE: "cease_and_desist", CEASE_AND_DESIST: "cease_and_desist",
  TRUST: "trust_instrument", TRUST_INSTRUMENT: "trust_instrument",
  RESOLUTION: "tribal_resolution", TRIBAL_RESOLUTION: "tribal_resolution",
  IDENTITY: "identity_declaration", IDENTITY_DECLARATION: "identity_declaration",
};

const DOC_LABELS: Record<string, string> = {
  icwa_notice: "ICWA Notice", nfr_notice: "Federal Review Notice",
  court_document: "Court Document", gwe_letter: "GWE Letter",
  welfare_letter: "Welfare Letter", tribal_affidavit: "Tribal Affidavit",
  cease_and_desist: "Cease & Desist", trust_instrument: "Trust Instrument",
  tribal_resolution: "Tribal Resolution", identity_declaration: "Identity Declaration",
};

function storeIntakeContext(report: IntakeAgentReport, docType: string, inputText: string) {
  const notes = [
    `AI Intake Summary:\n${report.summary}`,
    report.factSummary ? `\nFact Summary:\n${report.factSummary}` : "",
    report.intakeFlags.violations.length
      ? `\nViolations: ${report.intakeFlags.violations.join("; ")}`
      : "",
    inputText ? `\n\nOriginal text excerpt:\n${inputText.substring(0, 600)}` : "",
  ].join("").trim();
  sessionStorage.setItem("intake_context", JSON.stringify({ docType, notes, riskLevel: report.riskLevel }));
}

function IntakeActionBar({ report, inputText }: { report: IntakeAgentReport; inputText: string }) {
  const [, navigate] = useLocation();
  const elevated = ["elevated", "critical", "emergency"].includes(report.riskLevel);

  const docTypes = Array.from(new Set(
    report.recommendedInstruments
      .map(i => INSTRUMENT_TO_DOC[i.toUpperCase().replace(/ /g, "_")] ?? "court_document")
  ));

  if (docTypes.length === 0 && !elevated) return null;

  return (
    <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 space-y-3">
      <p className="text-xs font-semibold uppercase tracking-widest text-primary">Next Steps — Take Action</p>

      {docTypes.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">Draft a response instrument based on this analysis:</p>
          <div className="flex flex-wrap gap-2">
            {docTypes.map((dt) => (
              <Button
                key={dt}
                size="sm"
                variant="outline"
                className="gap-1.5 text-xs h-8 border-primary/40 hover:border-primary hover:bg-primary/10"
                onClick={() => {
                  storeIntakeContext(report, dt, inputText);
                  navigate(`${BASE}/drafts`);
                }}
              >
                <FileText className="h-3 w-3" />
                Draft {DOC_LABELS[dt] ?? dt}
                <ArrowRight className="h-3 w-3" />
              </Button>
            ))}
          </div>
        </div>
      )}

      {elevated && (
        <div className="flex items-center gap-3 pt-1 border-t border-primary/20">
          <p className="text-xs text-muted-foreground flex-1">Risk level requires formal sovereign processing:</p>
          <Button
            size="sm"
            className="gap-1.5 text-xs h-8 bg-[#8B0000] hover:bg-[#6B0000] text-white shrink-0"
            onClick={() => {
              sessionStorage.setItem("pipeline_prefill", inputText);
              navigate(`${BASE}/sovereign-pipeline`);
            }}
          >
            <Shield className="h-3 w-3" />
            Run Sovereign Pipeline
            <ArrowRight className="h-3 w-3" />
          </Button>
        </div>
      )}
    </div>
  );
}

interface IntakeFilterResult {
  indianStatusViolation: boolean;
  redFlag: boolean;
  troRecommended: boolean;
  nfrRecommended: boolean;
  violations: string[];
  doctrinesTriggered: string[];
  canonicalPosture: string;
  redBannerMessage: string | null;
}

interface LawReference {
  type: "federal" | "tribal" | "doctrine";
  title: string;
  citation: string;
  excerpt: string;
  relevanceReason: string;
}

interface IntakeAgentReport {
  summary: string;
  riskLevel: "low" | "moderate" | "elevated" | "critical" | "emergency";
  intakeFlags: IntakeFilterResult;
  doctrinesApplied: string[];
  lawRefs: LawReference[];
  recommendedActions: string[];
  recommendedInstruments: string[];
  factSummary: string;
  officerNotes: string;
  nfrRecommended: boolean;
  troRecommended: boolean;
  aiConfidence: number;
  processedAt: string;
}

interface ExtractedFields {
  source?: string;
  documentType?: string | null;
  caseNumber?: string | null;
  docketNumber?: string | null;
  propertyNumber?: string | null;
  propertyAddress?: string | null;
  receiptNumber?: string | null;
  court?: string | null;
  judge?: string | null;
  parties?: {
    plaintiffs?: string[];
    defendants?: string[];
    petitioners?: string[];
    respondents?: string[];
    agencies?: string[];
  } | null;
  dates?: string[];
  amounts?: string[];
  allegations?: string[];
}

type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((e: { results: { length: number; [i: number]: { [i: number]: { transcript: string } } } }) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  start(): void;
  stop(): void;
};

const RISK_COLORS: Record<string, string> = {
  low: "bg-green-100 text-green-800 border-green-300",
  moderate: "bg-yellow-100 text-yellow-800 border-yellow-300",
  elevated: "bg-orange-100 text-orange-800 border-orange-300",
  critical: "bg-red-100 text-red-800 border-red-300",
  emergency: "bg-red-200 text-red-900 border-red-500 font-bold",
};

const LAW_TYPE_COLORS: Record<string, string> = {
  federal: "bg-blue-700",
  tribal: "bg-amber-700",
  doctrine: "bg-green-700",
};

function MemberReport({ report }: { report: IntakeAgentReport }) {
  return (
    <div className="space-y-4">
      <div className={`rounded-lg border-2 p-4 ${RISK_COLORS[report.riskLevel]}`}>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <span className="text-lg font-bold uppercase">Status: {report.riskLevel === "low" ? "Review Complete" : "Attention Required"}</span>
          </div>
          <div className="flex gap-2 flex-wrap">
            {report.troRecommended && <Badge className="bg-red-700 text-white">TRO Recommended</Badge>}
            {report.nfrRecommended && <Badge className="bg-orange-700 text-white">Federal Review Recommended</Badge>}
          </div>
        </div>
        <p className="mt-2 text-sm">{report.summary}</p>
      </div>

      {report.intakeFlags.redBannerMessage && (
        <div className="rounded-lg border border-red-400 bg-red-50 p-4">
          <p className="text-red-800 font-semibold text-sm">{report.intakeFlags.redBannerMessage}</p>
        </div>
      )}

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">What You Should Do</CardTitle></CardHeader>
        <CardContent>
          <ol className="space-y-1 list-decimal list-inside">
            {report.recommendedActions.slice(0, 4).map((a, i) => (
              <li key={i} className="text-sm">{a}</li>
            ))}
          </ol>
          {report.recommendedInstruments.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              <span className="text-xs text-muted-foreground">Instruments that may help:</span>
              {report.recommendedInstruments.map((inst) => (
                <Badge key={inst} variant="outline" className="text-xs">{inst}</Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground text-center">
        Analysis completed: {new Date(report.processedAt).toLocaleString()}
      </p>
    </div>
  );
}

function OfficerReport({ report }: { report: IntakeAgentReport }) {
  return (
    <div className="space-y-4">
      <div className={`rounded-lg border-2 p-4 ${RISK_COLORS[report.riskLevel]}`}>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <span className="text-lg font-bold uppercase">Risk Level: {report.riskLevel}</span>
            <span className="ml-3 text-sm opacity-75">Confidence: {report.aiConfidence}%</span>
          </div>
          <div className="flex gap-2 flex-wrap">
            {report.troRecommended && <Badge className="bg-red-700 text-white">TRO Recommended</Badge>}
            {report.nfrRecommended && <Badge className="bg-orange-700 text-white">NFR Recommended</Badge>}
            {report.intakeFlags.indianStatusViolation && <Badge className="bg-red-900 text-white">Indian Status Violation</Badge>}
          </div>
        </div>
        <p className="mt-2 text-sm">{report.summary}</p>
      </div>

      {report.intakeFlags.redBannerMessage && (
        <div className="rounded-lg border border-red-400 bg-red-50 p-4">
          <p className="text-red-800 font-semibold text-sm">{report.intakeFlags.redBannerMessage}</p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Violations Detected</CardTitle></CardHeader>
          <CardContent>
            {report.intakeFlags.violations.length === 0 ? (
              <p className="text-sm text-muted-foreground">No violations detected.</p>
            ) : (
              <ul className="space-y-1">
                {report.intakeFlags.violations.map((v, i) => (
                  <li key={i} className="text-sm text-red-700 flex items-start gap-1">
                    <span className="mt-0.5">⚑</span> {v}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Canonical Posture</CardTitle></CardHeader>
          <CardContent>
            <p className="text-sm text-foreground">{report.intakeFlags.canonicalPosture}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Recommended Actions</CardTitle></CardHeader>
        <CardContent>
          <ol className="space-y-1 list-decimal list-inside">
            {report.recommendedActions.map((a, i) => (
              <li key={i} className="text-sm">{a}</li>
            ))}
          </ol>
          {report.recommendedInstruments.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              <span className="text-xs text-muted-foreground">Instruments:</span>
              {report.recommendedInstruments.map((inst) => (
                <Badge key={inst} variant="outline" className="text-xs">{inst}</Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Applicable Law References ({report.lawRefs.length})</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-3">
            {report.lawRefs.map((ref, i) => (
              <div key={i} className="border rounded-md p-3">
                <div className="flex items-center gap-2 mb-1">
                  <Badge className={`${LAW_TYPE_COLORS[ref.type]} text-white text-xs`}>{ref.type}</Badge>
                  <span className="font-semibold text-sm">{ref.title}</span>
                </div>
                <p className="text-xs font-mono text-muted-foreground">{ref.citation}</p>
                <p className="text-xs mt-1 text-muted-foreground">{ref.relevanceReason}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground text-center">
        Analysis completed: {new Date(report.processedAt).toLocaleString()} · Confidence: {report.aiConfidence}%
      </p>
    </div>
  );
}

function FullReport({ report }: { report: IntakeAgentReport }) {
  return (
    <div className="space-y-4">
      <div className={`rounded-lg border-2 p-4 ${RISK_COLORS[report.riskLevel]}`}>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <span className="text-lg font-bold uppercase">Risk Level: {report.riskLevel}</span>
            <span className="ml-3 text-sm opacity-75">Confidence: {report.aiConfidence}%</span>
          </div>
          <div className="flex gap-2 flex-wrap">
            {report.troRecommended && <Badge className="bg-red-700 text-white">TRO Recommended</Badge>}
            {report.nfrRecommended && <Badge className="bg-orange-700 text-white">NFR Recommended</Badge>}
            {report.intakeFlags.indianStatusViolation && <Badge className="bg-red-900 text-white">Indian Status Violation</Badge>}
          </div>
        </div>
        <p className="mt-2 text-sm">{report.summary}</p>
      </div>

      {report.intakeFlags.redBannerMessage && (
        <div className="rounded-lg border border-red-400 bg-red-50 p-4">
          <p className="text-red-800 font-semibold text-sm">{report.intakeFlags.redBannerMessage}</p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Violations Detected</CardTitle></CardHeader>
          <CardContent>
            {report.intakeFlags.violations.length === 0 ? (
              <p className="text-sm text-muted-foreground">No violations detected.</p>
            ) : (
              <ul className="space-y-1">
                {report.intakeFlags.violations.map((v, i) => (
                  <li key={i} className="text-sm text-red-700 flex items-start gap-1">
                    <span className="mt-0.5">⚑</span> {v}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Officer Notes</CardTitle></CardHeader>
          <CardContent>
            <pre className="text-xs text-foreground whitespace-pre-wrap font-sans">{report.officerNotes}</pre>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Recommended Actions</CardTitle></CardHeader>
        <CardContent>
          <ol className="space-y-1 list-decimal list-inside">
            {report.recommendedActions.map((a, i) => (
              <li key={i} className="text-sm">{a}</li>
            ))}
          </ol>
          {report.recommendedInstruments.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              <span className="text-xs text-muted-foreground">Instruments:</span>
              {report.recommendedInstruments.map((inst) => (
                <Badge key={inst} variant="outline" className="text-xs">{inst}</Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Applicable Law References ({report.lawRefs.length})</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-3">
            {report.lawRefs.map((ref, i) => (
              <div key={i} className="border rounded-md p-3">
                <div className="flex items-center gap-2 mb-1">
                  <Badge className={`${LAW_TYPE_COLORS[ref.type]} text-white text-xs`}>{ref.type}</Badge>
                  <span className="font-semibold text-sm">{ref.title}</span>
                </div>
                <p className="text-xs font-mono text-muted-foreground">{ref.citation}</p>
                <p className="text-xs mt-1 text-muted-foreground">{ref.relevanceReason}</p>
                <p className="text-xs mt-1 text-foreground border-l-2 border-muted pl-2">{ref.excerpt}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Doctrines Applied ({report.doctrinesApplied.length})</CardTitle></CardHeader>
        <CardContent>
          <ul className="space-y-1">
            {report.doctrinesApplied.map((d, i) => (
              <li key={i} className="text-xs text-muted-foreground flex items-start gap-1">
                <span>•</span> {d}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Fact Summary</CardTitle></CardHeader>
        <CardContent>
          <pre className="text-xs text-foreground whitespace-pre-wrap font-sans leading-relaxed">{report.factSummary}</pre>
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground text-center">
        Analysis completed: {new Date(report.processedAt).toLocaleString()} · AI Confidence: {report.aiConfidence}%
      </p>
    </div>
  );
}

function ExtractedFieldsCard({ fields, loading }: { fields: ExtractedFields | null; loading: boolean }) {
  const [, navigate] = useLocation();
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");

  function copyValue(key: string, value: string) {
    navigator.clipboard.writeText(value).catch(() => {});
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 1500);
  }

  async function saveLandToProfile() {
    if (!fields) return;
    const payload: Record<string, string> = {};
    if (fields.propertyNumber) payload.apn = fields.propertyNumber;
    if (fields.propertyAddress) payload.mailingAddress = fields.propertyAddress;
    if (!Object.keys(payload).length) return;
    setSaveState("saving");
    try {
      const token = getCurrentBearerToken() ?? "";
      const r = await fetch("/api/user/profile", {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!r.ok) throw new Error("save failed");
      setSaveState("saved");
      setTimeout(() => setSaveState("idle"), 3000);
    } catch {
      setSaveState("error");
      setTimeout(() => setSaveState("idle"), 3000);
    }
  }

  function useInDraft() {
    const existing = JSON.parse(sessionStorage.getItem("intake_context") ?? "{}") as Record<string, string>;
    const refs = [
      fields?.documentType ? `Document Type: ${fields.documentType}` : "",
      fields?.caseNumber ? `Case No: ${fields.caseNumber}` : "",
      fields?.docketNumber ? `Docket: ${fields.docketNumber}` : "",
      fields?.propertyAddress ? `Property Address: ${fields.propertyAddress}` : "",
      fields?.propertyNumber ? `APN/Property No: ${fields.propertyNumber}` : "",
      fields?.receiptNumber ? `Receipt/Acct: ${fields.receiptNumber}` : "",
      fields?.court ? `Court: ${fields.court}` : "",
      fields?.judge ? `Judge: ${fields.judge}` : "",
      fields?.parties?.plaintiffs?.length ? `Plaintiffs: ${fields.parties.plaintiffs.join(", ")}` : "",
      fields?.parties?.defendants?.length ? `Defendants: ${fields.parties.defendants.join(", ")}` : "",
      fields?.parties?.petitioners?.length ? `Petitioners: ${fields.parties.petitioners.join(", ")}` : "",
      fields?.parties?.respondents?.length ? `Respondents: ${fields.parties.respondents.join(", ")}` : "",
      fields?.amounts?.length ? `Amounts: ${fields.amounts.join(", ")}` : "",
    ].filter(Boolean).join("\n");

    sessionStorage.setItem("intake_context", JSON.stringify({
      ...existing,
      docType: existing.docType ?? "court_document",
      notes: [(existing.notes ?? ""), refs ? `\n\nExtracted Document References:\n${refs}` : ""].join("").trim(),
    }));
    navigate(`${BASE}/drafts`);
  }

  if (loading) {
    return (
      <div className="rounded-lg border border-blue-200/60 bg-blue-50/40 p-3 mt-2">
        <p className="text-xs text-blue-600 animate-pulse">Extracting document reference fields…</p>
      </div>
    );
  }

  if (!fields) return null;

  const SCALAR: Array<{ key: keyof ExtractedFields; label: string }> = [
    { key: "documentType", label: "Document Type" },
    { key: "caseNumber", label: "Case Number" },
    { key: "docketNumber", label: "Docket Number" },
    { key: "propertyAddress", label: "Property Address" },
    { key: "propertyNumber", label: "APN / Property No." },
    { key: "receiptNumber", label: "Receipt / Acct No." },
    { key: "court", label: "Court" },
    { key: "judge", label: "Judge" },
  ];

  const visibleScalars = SCALAR.filter(({ key }) => !!(fields[key] as string | null | undefined));
  const hasParties = fields.parties && Object.values(fields.parties).some(arr => arr && arr.length > 0);
  const hasDates = (fields.dates?.length ?? 0) > 0;
  const hasAmounts = (fields.amounts?.length ?? 0) > 0;
  const hasAllegations = (fields.allegations?.length ?? 0) > 0;

  if (!visibleScalars.length && !hasParties && !hasDates && !hasAmounts) return null;

  return (
    <div className="rounded-lg border border-blue-200 bg-blue-50/50 p-3 space-y-3 mt-2">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-blue-700">
          Document References {fields.source === "ai" ? "· AI Extracted" : "· Pattern Matched"}
        </p>
        <div className="flex items-center gap-1.5 shrink-0">
          {(fields.propertyNumber || fields.propertyAddress) && (
            <Button
              size="sm"
              variant={saveState === "saved" ? "default" : "outline"}
              className={`text-xs h-6 px-2 shrink-0 ${saveState === "saved" ? "bg-green-600 hover:bg-green-600 text-white border-green-600" : saveState === "error" ? "border-red-400 text-red-600" : ""}`}
              onClick={saveLandToProfile}
              disabled={saveState === "saving" || saveState === "saved"}
            >
              {saveState === "saving" ? "Saving…" : saveState === "saved" ? "✓ Saved to Profile" : saveState === "error" ? "Save Failed" : "Save Land Data to Profile"}
            </Button>
          )}
          <Button size="sm" variant="outline" className="text-xs h-6 px-2 shrink-0" onClick={useInDraft}>
            Use in Draft →
          </Button>
        </div>
      </div>

      {visibleScalars.length > 0 && (
        <div className="grid grid-cols-2 gap-x-4 gap-y-2">
          {visibleScalars.map(({ key, label }) => {
            const val = fields[key] as string;
            return (
              <div key={key} className="group flex items-start gap-1 min-w-0">
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide leading-none mb-0.5">{label}</p>
                  <p className="text-xs font-mono text-foreground break-all leading-snug">{val}</p>
                </div>
                <button
                  className="mt-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground"
                  onClick={() => copyValue(key, val)}
                  title="Copy"
                >
                  {copiedKey === key ? <span className="text-green-600 text-xs">✓</span> : <Copy className="h-3 w-3" />}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {hasParties && fields.parties && (
        <div>
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">Parties</p>
          <div className="space-y-0.5">
            {(Object.entries(fields.parties) as Array<[string, string[] | undefined]>).map(([role, names]) => {
              if (!names?.length) return null;
              return (
                <p key={role} className="text-xs">
                  <span className="font-semibold capitalize">{role}: </span>
                  <span className="text-muted-foreground">{names.join(", ")}</span>
                </p>
              );
            })}
          </div>
        </div>
      )}

      {hasDates && (
        <div>
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">Key Dates</p>
          <div className="flex flex-wrap gap-1">
            {fields.dates!.map((d, i) => <span key={i} className="text-xs bg-muted rounded px-1.5 py-0.5">{d}</span>)}
          </div>
        </div>
      )}

      {hasAmounts && (
        <div>
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">Amounts</p>
          <div className="flex flex-wrap gap-1">
            {fields.amounts!.map((a, i) => (
              <span key={i} className="text-xs bg-green-100 text-green-800 rounded px-1.5 py-0.5 font-mono">{a}</span>
            ))}
          </div>
        </div>
      )}

      {hasAllegations && (
        <div>
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">Allegations / Claims</p>
          <ul className="space-y-0.5">
            {fields.allegations!.map((a, i) => <li key={i} className="text-xs text-muted-foreground">• {a}</li>)}
          </ul>
        </div>
      )}
    </div>
  );
}

export default function IntakeAiPage() {
  const { user, activeRole } = useAuth();
  const [text, setText] = useState(() => {
    const prefill = sessionStorage.getItem("intake_prefill");
    if (prefill) { sessionStorage.removeItem("intake_prefill"); return prefill; }
    return "";
  });
  const [actorType, setActorType] = useState("__all__");
  const [landStatus, setLandStatus] = useState("__all__");
  const [childInvolved, setChildInvolved] = useState("__none__");
  const [report, setReport] = useState<IntakeAgentReport | null>(null);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [extractedFields, setExtractedFields] = useState<ExtractedFields | null>(null);
  const [extractingFields, setExtractingFields] = useState(false);
  const voiceSupported = typeof window !== "undefined" && ("SpeechRecognition" in window || "webkitSpeechRecognition" in window);

  function startListening() {
    const Win = window as unknown as Record<string, unknown>;
    const Cls = (Win.SpeechRecognition ?? Win.webkitSpeechRecognition) as (new () => SpeechRecognitionLike) | undefined;
    if (!Cls) return;
    const r = new Cls();
    r.continuous = true;
    r.interimResults = true;
    r.lang = "en-US";
    r.onresult = (e) => {
      let t = "";
      for (let i = 0; i < e.results.length; i++) t += e.results[i][0].transcript;
      setText(t);
    };
    r.onend = () => setIsListening(false);
    r.onerror = () => setIsListening(false);
    r.start();
    recognitionRef.current = r;
    setIsListening(true);
  }

  function stopListening() {
    recognitionRef.current?.stop();
    setIsListening(false);
  }

  function speakReport(r: IntakeAgentReport) {
    if (!("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const words = [
      "AI Intake Analysis complete.",
      `Risk level: ${r.riskLevel}.`,
      r.summary,
      r.recommendedActions.length
        ? `Recommended actions: ${r.recommendedActions.slice(0, 3).join(". ")}.`
        : "",
    ].filter(Boolean).join(" ");
    const u = new SpeechSynthesisUtterance(words);
    u.rate = 0.9;
    u.pitch = 1;
    u.onstart = () => setIsSpeaking(true);
    u.onend = () => setIsSpeaking(false);
    u.onerror = () => setIsSpeaking(false);
    window.speechSynthesis.speak(u);
  }

  function stopSpeaking() {
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
  }

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      setUploadStatus(`Extracting text from ${file.name}…`);
      const form = new FormData();
      form.append("file", file);
      const token = getCurrentBearerToken() ?? "";
      const r = await fetch("/api/intake/upload", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });
      if (!r.ok) {
        const err = await r.json().catch(() => ({})) as { error?: string };
        throw new Error(err.error ?? `Upload failed (${r.status})`);
      }
      const data = await r.json() as { text: string; filename: string; char_count: number };
      setUploadStatus(`Extracted ${data.char_count.toLocaleString()} chars from ${data.filename}.`);
      const extracted = data.text.substring(0, 8000);
      setText(extracted);
      setExtractingFields(true);
      setExtractedFields(null);
      const tok2 = getCurrentBearerToken() ?? "";
      fetch("/api/intake/extract-fields", {
        method: "POST",
        headers: { Authorization: `Bearer ${tok2}`, "Content-Type": "application/json" },
        body: JSON.stringify({ text: extracted }),
      })
        .then(ex => ex.ok ? ex.json() as Promise<ExtractedFields> : Promise.resolve(null))
        .then(fld => { setExtractedFields(fld); setExtractingFields(false); })
        .catch(() => setExtractingFields(false));
      return data.text;
    },
  });

  const [pipelineRec, setPipelineRec] = useState<{ fileNumber: string; riskLevel: string } | null>(null);

  function autoSubmitToPipeline(inputText: string) {
    const token = getCurrentBearerToken() ?? "";
    fetch("/api/sovereign/pipeline", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ text: inputText }),
    })
      .then(r => r.ok ? r.json() : null)
      .then(rec => { if (rec?.fileNumber) setPipelineRec({ fileNumber: rec.fileNumber, riskLevel: rec.riskLevel }); })
      .catch(() => {});
  }

  const analyze = useMutation({
    mutationFn: async () => {
      const token = getCurrentBearerToken() ?? "";
      const r = await fetch("/api/intake/ai", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text,
          context: {
            actorType: actorType !== "__all__" ? actorType : undefined,
            landStatus: landStatus !== "__all__" ? landStatus : undefined,
            childInvolved: childInvolved === "yes" ? true : childInvolved === "no" ? false : undefined,
          },
        }),
      });
      if (!r.ok) throw new Error("AI intake analysis failed");
      return r.json() as Promise<IntakeAgentReport>;
    },
    onSuccess: (data) => {
      setReport(data);
      setUploadStatus(null);
      setPipelineRec(null);
      if (["trustee", "officer", "sovereign_admin"].includes(activeRole) && text.trim()) {
        autoSubmitToPipeline(text);
      }
    },
  });

  const isFullAccess = activeRole === "trustee" || activeRole === "sovereign_admin";
  const isOfficer = activeRole === "officer";
  const isMember = activeRole === "member";

  const subtitle = isFullAccess
    ? "Full intake analysis — red flags, ICWA violations, jurisdictional conflicts, TRO/NFR triggers, doctrines, law references"
    : isOfficer
    ? "Officer intake review — violations, risk level, recommended actions, and applicable law references"
    : "Submit a case description to receive guidance from the Office of the Chief Justice and Trustee";

  const [guardCleared, setGuardCleared] = useState(false);

  return (
    <div data-testid="page-intake-ai">
      <div className="mb-8">
        <h1 className="text-3xl font-serif font-bold text-foreground">AI Intake Review</h1>
        <p className="text-muted-foreground mt-1">{subtitle}</p>
      </div>

      {!guardCleared && (
        <SovereignIntakeGuard
          intakeType="case"
          onClear={() => setGuardCleared(true)}
        />
      )}

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base">
            {isMember ? "Submit Case for Review" : "Submit for AI Analysis"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="intake-text">
              {isMember ? "Describe Your Situation" : "Intake Text / Case Description"}
            </Label>
            <Textarea
              id="intake-text"
              rows={isMember ? 4 : 6}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={
                isMember
                  ? "Describe your situation, concern, or request. The Office will review and provide guidance…"
                  : "Paste complaint text, case summary, welfare request, recorder submission, or any case description for AI intake analysis…"
              }
              className="mt-1 font-mono text-sm"
            />
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {voiceSupported && (
              <Button
                type="button"
                variant={isListening ? "destructive" : "outline"}
                size="sm"
                onClick={isListening ? stopListening : startListening}
                className={`gap-1.5 text-xs h-8 shrink-0${isListening ? " animate-pulse" : ""}`}
                title={isListening ? "Stop voice input" : "Speak your case description"}
              >
                {isListening
                  ? <><MicOff className="h-3.5 w-3.5" /> Stop</>
                  : <><Mic className="h-3.5 w-3.5" /> Speak</>}
              </Button>
            )}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => fileRef.current?.click()}
              disabled={uploadMutation.isPending}
              className="text-xs h-8 shrink-0"
            >
              {uploadMutation.isPending ? "Extracting…" : "Upload Document"}
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept=".pdf,.csv,.txt,.png,.jpg,.jpeg,.gif,.webp"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) { setUploadedFile(file); uploadMutation.mutate(file); }
                e.target.value = "";
              }}
            />
            {uploadStatus && <p className="text-xs text-muted-foreground flex-1">{uploadStatus}</p>}
            {uploadMutation.isError && (
              <p className="text-xs text-destructive">{(uploadMutation.error as Error).message}</p>
            )}
            {uploadedFile && !uploadMutation.isPending && !uploadMutation.isError && (
              <Badge variant="outline" className="text-xs">{uploadedFile.name}</Badge>
            )}
          </div>

          <ExtractedFieldsCard fields={extractedFields} loading={extractingFields} />

          {!isMember && (
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>Actor Type</Label>
                <Select value={actorType} onValueChange={setActorType}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Any actor" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">Any actor</SelectItem>
                    <SelectItem value="federal">Federal</SelectItem>
                    <SelectItem value="state">State</SelectItem>
                    <SelectItem value="tribal">Tribal</SelectItem>
                    <SelectItem value="private">Private</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Land Status</Label>
                <Select value={landStatus} onValueChange={setLandStatus}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Any status" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">Any status</SelectItem>
                    <SelectItem value="trust">Trust</SelectItem>
                    <SelectItem value="allotment">Allotment</SelectItem>
                    <SelectItem value="fee">Fee</SelectItem>
                    <SelectItem value="public">Public</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Child Involved?</Label>
                <Select value={childInvolved} onValueChange={setChildInvolved}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Unknown" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Unknown</SelectItem>
                    <SelectItem value="yes">Yes</SelectItem>
                    <SelectItem value="no">No</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          <Button
            onClick={() => analyze.mutate()}
            disabled={analyze.isPending || text.trim().length < 10}
            className="w-full"
          >
            {analyze.isPending
              ? "Analyzing…"
              : isMember
              ? "Submit for Review"
              : "Run AI Intake Analysis"}
          </Button>
          {analyze.isError && (
            <p className="text-sm text-destructive">Analysis failed. Please try again.</p>
          )}
        </CardContent>
      </Card>

      {analyze.isPending && (
        <div className="space-y-3">
          {[...Array(isMember ? 2 : 4)].map((_, i) => <Skeleton key={i} className="h-24" />)}
        </div>
      )}

      {report && (
        <div className="flex justify-end">
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5 text-xs h-8"
            onClick={isSpeaking ? stopSpeaking : () => speakReport(report)}
          >
            {isSpeaking
              ? <><VolumeX className="h-3.5 w-3.5" /> Stop Reading</>
              : <><Volume2 className="h-3.5 w-3.5" /> Read Aloud</>}
          </Button>
        </div>
      )}

      {report && (
        isFullAccess
          ? <FullReport report={report} />
          : isOfficer
          ? <OfficerReport report={report} />
          : <MemberReport report={report} />
      )}

      {report && (
        <IntakeActionBar report={report} inputText={text} />
      )}

      {report && ["trustee", "officer", "sovereign_admin"].includes(activeRole) && (
        <div className={`flex items-center gap-2.5 rounded-md border px-3 py-2 text-xs transition-all ${
          pipelineRec
            ? "border-green-300 bg-green-50 text-green-800"
            : "border-muted bg-muted/30 text-muted-foreground animate-pulse"
        }`}>
          <Shield className={`h-3.5 w-3.5 shrink-0 ${pipelineRec ? "text-green-600" : "text-muted-foreground"}`} />
          {pipelineRec
            ? <>Pipeline record logged — <span className="font-mono font-bold">{pipelineRec.fileNumber}</span> · Risk: <span className="capitalize">{pipelineRec.riskLevel}</span></>
            : "Submitting to Sovereign Pipeline…"}
        </div>
      )}

      {report && (report.intakeFlags.redFlag || report.riskLevel === "elevated" || report.riskLevel === "critical" || report.riskLevel === "emergency") && (
        <JurisdictionalWhatNow report={report} actorType={actorType} />
      )}
    </div>
  );
}

function JurisdictionalWhatNow({ report, actorType }: { report: IntakeAgentReport; actorType: string }) {
  const actor = actorType !== "__all__" ? actorType : "any";
  const isState = actor === "state";
  const isFederal = actor === "federal";
  const isPrivate = actor === "private";

  const DOCTRINE_ACTIONS: Record<string, { label: string; steps: string[] }> = {
    "Tribal Sovereignty": {
      label: "Tribal Sovereignty — Jurisdictional Shield",
      steps: [
        "Assert tribal sovereign immunity in all written responses to the acting party.",
        "File a Notice of Jurisdictional Objection with the tribal court referencing Wheeler v. United States (1978).",
        "Demand written authority / delegation of authority letter from the acting party under 5 U.S.C. § 558.",
        "Contact the tribal attorney general or appointed legal officer within 48 hours.",
      ],
    },
    "ICWA": {
      label: "ICWA — Indian Child Welfare Act Protection",
      steps: [
        "Invoke ICWA (25 U.S.C. § 1901 et seq.) immediately in all child-related proceedings.",
        "Notify the tribe's ICWA representative in writing within 24 hours of any state action.",
        "File a notice of tribal membership and active membership status with the state court.",
        "Request transfer of proceedings to tribal court under 25 U.S.C. § 1911(b).",
        "Demand appointment of ICWA-compliant counsel and expert witnesses.",
      ],
    },
    "Federal Trust Responsibility": {
      label: "Federal Trust Responsibility",
      steps: [
        "File a formal complaint with the BIA Regional Director citing the federal trust responsibility (Seminole Nation v. United States, 1942).",
        "Send a certified letter to the DOI Office of Trust Review invoking fiduciary duty.",
        "Request a congressional oversight referral via your tribal nation's federal liaison.",
      ],
    },
    "Plenary Power": {
      label: "Plenary Power Doctrine — Congressional Delegation Check",
      steps: [
        "Challenge any state-level enforcement — plenary power over Indian affairs is exclusively federal (Art. I, § 8, cl. 3).",
        "File a written preemption notice with the state agency citing McClanahan v. Arizona (1973).",
        "Notify the tribal council to issue a formal protest resolution.",
      ],
    },
  };

  const STATE_ADMIN_STEPS = [
    { step: 1, title: "Exhaust Administrative Remedies", body: "Before court action, exhaust all state agency appeals (5 U.S.C. § 704 / state APA equivalents). Request a formal administrative hearing in writing within the statutory window." },
    { step: 2, title: "Issue a Notice of Jurisdictional Dispute", body: "Send a certified letter to the state actor asserting that the matter falls under federal Indian law and tribal sovereignty. Cite applicable doctrines from the intake report." },
    { step: 3, title: "Demand the Administrative Record", body: "Under most state APAs (e.g., 5 U.S.C. § 552 at federal level), demand the full administrative record, decision authority, and delegated authority documentation." },
    { step: 4, title: "Tribal Court Concurrent Jurisdiction", body: "File in tribal court to establish concurrent jurisdiction and obtain a tribal court order recognizing the matter as within tribal jurisdiction." },
    { step: 5, title: "Federal Court Removal / Injunction", body: "If state action continues, file for removal to federal court (28 U.S.C. § 1441) and seek a temporary restraining order (TRO) citing irreparable harm." },
  ];

  const FEDERAL_ADMIN_STEPS = [
    { step: 1, title: "Agency Challenge — APA § 706", body: "Challenge the federal agency action as arbitrary and capricious under 5 U.S.C. § 706(2)(A). File a formal written objection with the agency head within 30 days of final agency action." },
    { step: 2, title: "Freedom of Information Act Request", body: "File a FOIA request (5 U.S.C. § 552) immediately for all records, authority citations, and internal guidance used in the enforcement decision." },
    { step: 3, title: "BIA / DOI Formal Complaint", body: "File a formal complaint with the Bureau of Indian Affairs Regional Director and the DOI Office of the Solicitor citing breach of federal trust responsibility." },
    { step: 4, title: "Congressional Notification", body: "Notify your congressional representatives and the Senate Committee on Indian Affairs. This creates a public record and can trigger oversight investigations." },
    { step: 5, title: "Court of Federal Claims", body: "If the trust responsibility is violated, file in the United States Court of Federal Claims. These claims have a 6-year statute of limitations (28 U.S.C. § 2501)." },
  ];

  const GENERAL_STEPS = [
    { step: 1, title: "Invoke Sovereign Standing", body: "Issue a formal Declaration of Sovereign Standing signed by the Chief Justice or Trustee identifying the specific rights at issue and the jurisdictional basis." },
    { step: 2, title: "Document the Overreach", body: "Create a contemporaneous written record of every action, date, agent name, and badge/authority number. This is your administrative record for future proceedings." },
    { step: 3, title: "File an Administrative Protest", body: "Submit a formal administrative protest to the acting party's supervisor, citing the applicable law references from this intake report." },
    { step: 4, title: "Activate Tribal Legal Resources", body: "Contact the Office of the Chief Justice and Trustee for a legal referral. Invoke available TRO or NFR procedures identified in this report." },
    { step: 5, title: "30-Day Response Deadline", body: "Most U.S. administrative procedures have strict response windows (10–30 days). Ensure all written responses are sent certified mail and receipts are retained." },
  ];

  const steps = isFederal ? FEDERAL_ADMIN_STEPS : isState ? STATE_ADMIN_STEPS : GENERAL_STEPS;
  const matchedDoctrines = Object.entries(DOCTRINE_ACTIONS).filter(([key]) =>
    report.doctrinesApplied?.some((d) => d.toLowerCase().includes(key.toLowerCase())) ||
    report.intakeFlags.doctrinesTriggered?.some((d) => d.toLowerCase().includes(key.toLowerCase()))
  );

  return (
    <div className="mt-8 space-y-6">
      <div className="border-l-4 border-red-600 pl-4">
        <h2 className="text-xl font-serif font-bold text-red-700">What Now — Jurisdictional & Administrative Guidance</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Red flags were triggered. Below is your procedural roadmap under{" "}
          {isFederal ? "federal administrative law (APA, trust responsibility)" : isState ? "state / federal preemption doctrine" : "sovereign administrative procedure"}.
          {isPrivate && " Private actor: assert sovereign protections and seek tribal court relief."}
        </p>
      </div>

      {matchedDoctrines.length > 0 && (
        <Card className="border-amber-300 bg-amber-50/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-amber-900">Triggered Doctrines — Immediate Protections</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {matchedDoctrines.map(([, val]) => (
              <div key={val.label}>
                <p className="text-sm font-semibold text-amber-800 mb-1">{val.label}</p>
                <ul className="space-y-1">
                  {val.steps.map((s, i) => (
                    <li key={i} className="text-xs text-amber-900 flex gap-2">
                      <span className="shrink-0 font-bold">{i + 1}.</span>
                      <span>{s}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <div>
        <h3 className="text-sm font-semibold mb-3 text-foreground">
          {isFederal ? "Federal Administrative Procedure Steps" : isState ? "State Enforcement Response Steps" : "Sovereign Administrative Response Steps"}
        </h3>
        <div className="space-y-3">
          {steps.map((s) => (
            <div key={s.step} className="flex gap-4 p-4 rounded-lg border bg-muted/20">
              <div className="w-8 h-8 rounded-full bg-red-700 text-white flex items-center justify-center text-sm font-bold shrink-0">
                {s.step}
              </div>
              <div>
                <p className="text-sm font-semibold">{s.title}</p>
                <p className="text-xs text-muted-foreground mt-1">{s.body}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {report.recommendedActions && report.recommendedActions.length > 0 && (
        <Card className="border-primary/30 bg-primary/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">AI-Recommended Actions from This Intake</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {report.recommendedActions.map((action, i) => (
                <li key={i} className="text-sm flex gap-2 items-start">
                  <span className="text-primary font-bold shrink-0">→</span>
                  <span>{action}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <div className="rounded-lg border border-muted p-4 text-xs text-muted-foreground">
        <strong>Legal Notice:</strong> This guidance is generated under the laws of protection and governance of the Office of the Chief Justice and Trustee, Mathias El Tribe and does not constitute legal advice. All responses to enforcement actions should be reviewed by the Chief Justice, designated Trustee, or appointed legal counsel before submission.
      </div>
    </div>
  );
}
