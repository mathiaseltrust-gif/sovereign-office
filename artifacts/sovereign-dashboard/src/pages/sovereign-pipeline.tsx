import { useState, useRef } from "react";
import { useLocation } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useAuth, getCurrentBearerToken } from "@/components/auth-provider";
import { useToast } from "@/hooks/use-toast";
import {
  FileText, Shield, Eye, BookOpen, Archive, Stamp,
  CheckCircle2, Clock, AlertTriangle, ChevronRight, Printer, RotateCcw, List,
  Mic, MicOff, Upload, X, Loader2
} from "lucide-react";

const API = import.meta.env.VITE_API_BASE_URL ?? "";

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

// ── Types ──────────────────────────────────────────────────────────────────────

interface PipelineResult {
  id: number;
  fileNumber: string;
  matterType: string;
  riskLevel: string;
  status: string;
  templateKey: string;
  templateTitle: string;
  generatedSummary: string;
  intakeResult: {
    violations: string[];
    doctrinesTriggered: string[];
    canonicalPosture: string;
    redFlag: boolean;
    troRecommended: boolean;
    indianStatusViolation: boolean;
  };
  doctrineOverlay: {
    doctrinesApplied: string[];
    federalLaw: string[];
    guardrails: string[];
    sovereigntyProtections: string[];
    recommendation: string;
    allDoctrines: string[];
  };
  analystApproved: boolean;
  analystNotes: string;
  templateProvisions: string[];
  templateParties: Record<string, string>;
  createdAt: string;
}

interface PrintResult {
  fileNumber: string;
  printCount: number;
  sealApplied: boolean;
  status: string;
}

interface RecordSummary {
  id: number;
  fileNumber: string;
  matterType: string;
  riskLevel: string;
  status: string;
  templateTitle: string;
  printCount: number;
  sealApplied: boolean;
  createdAt: string;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const RISK_STYLE: Record<string, string> = {
  low:       "bg-green-100 text-green-800 border-green-300 dark:bg-green-900/30 dark:text-green-300",
  moderate:  "bg-yellow-100 text-yellow-800 border-yellow-300 dark:bg-yellow-900/30 dark:text-yellow-300",
  elevated:  "bg-orange-100 text-orange-800 border-orange-300 dark:bg-orange-900/30 dark:text-orange-300",
  critical:  "bg-red-100 text-red-800 border-red-300 dark:bg-red-900/30 dark:text-red-300",
  emergency: "bg-red-200 text-red-900 border-red-500 dark:bg-red-900/50 dark:text-red-200 font-bold",
};

const MATTER_TO_DOC: Record<string, string> = {
  jurisdiction_claim: "court_document",
  icwa_violation: "icwa_notice",
  federal_overreach: "nfr_notice",
  welfare: "welfare_letter",
  trust_violation: "trust_instrument",
  land_claim: "court_document",
  cease_desist: "cease_and_desist",
  general: "court_document",
};

const MATTER_LABELS: Record<string, string> = {
  jurisdiction_claim:  "Jurisdiction Claim",
  policy_enforcement:  "Policy Enforcement",
  identity_denial:     "Identity Denial",
  icwa_violation:      "ICWA Violation",
  land_claim:          "Land Claim",
  demand:              "External Demand",
  general:             "General Matter",
};

const ENGINES = [
  { id: "intake",   icon: FileText,  label: "IntakeEngine",   desc: "Classify the incoming matter" },
  { id: "doctrine", icon: Shield,    label: "DoctrineEngine",  desc: "Overlay sovereignty doctrines" },
  { id: "analyst",  icon: Eye,       label: "AnalystReview",   desc: "Confirm tone & authority level" },
  { id: "template", icon: BookOpen,  label: "TemplateEngine",  desc: "Match & load response template" },
  { id: "record",   icon: Archive,   label: "RecordEngine",    desc: "Assign file number & persist" },
  { id: "print",    icon: Stamp,     label: "PrintSealEngine", desc: "Apply seal & log print event" },
];

// ── Step Indicator ────────────────────────────────────────────────────────────

function PipelineSteps({ activeStep, done }: { activeStep: number; done: boolean }) {
  return (
    <div className="flex items-start gap-0 overflow-x-auto pb-2">
      {ENGINES.map((engine, i) => {
        const Icon = engine.icon;
        const complete = done ? i < 5 : i < activeStep;
        const active = !done && i === activeStep;
        return (
          <div key={engine.id} className="flex items-center shrink-0">
            <div className="flex flex-col items-center gap-1 w-20 md:w-24">
              <div className={`rounded-full w-9 h-9 flex items-center justify-center border-2 transition-all ${
                complete ? "bg-green-600 border-green-600 text-white"
                  : active ? "bg-primary border-primary text-primary-foreground animate-pulse"
                  : "bg-muted border-muted-foreground/30 text-muted-foreground"
              }`}>
                {complete ? <CheckCircle2 className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
              </div>
              <p className={`text-[9px] font-bold text-center leading-tight ${active ? "text-primary" : complete ? "text-green-700 dark:text-green-400" : "text-muted-foreground"}`}>
                {engine.label}
              </p>
            </div>
            {i < ENGINES.length - 1 && (
              <ChevronRight className={`h-4 w-4 shrink-0 -mt-4 mx-0.5 ${complete ? "text-green-500" : "text-muted-foreground/30"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Result display ────────────────────────────────────────────────────────────

function PipelineResultCard({ result, onPrint, printing }: {
  result: PipelineResult;
  onPrint: () => void;
  printing: boolean;
}) {
  const [section, setSection] = useState<"summary" | "intake" | "doctrine" | "template">("summary");

  return (
    <Card className="border-primary/30 shadow-lg">
      <CardHeader className="bg-primary/5 border-b pb-4">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-xs font-bold text-muted-foreground">{result.fileNumber}</span>
              <Badge className={`text-xs border ${RISK_STYLE[result.riskLevel] ?? RISK_STYLE.low}`}>
                {result.riskLevel.toUpperCase()} RISK
              </Badge>
              <Badge variant="outline" className="text-xs">
                {MATTER_LABELS[result.matterType] ?? result.matterType}
              </Badge>
              {result.intakeResult.redFlag && (
                <Badge variant="destructive" className="text-xs">⚑ Red Flag</Badge>
              )}
            </div>
            <p className="text-sm font-semibold mt-1">{result.templateTitle}</p>
            <p className="text-xs text-muted-foreground">Template: <code className="font-mono">{result.templateKey}</code></p>
          </div>
          <Button onClick={onPrint} disabled={printing} className="gap-2 bg-[#8B0000] hover:bg-[#6B0000] text-white shrink-0">
            <Printer className="h-4 w-4" />
            {printing ? "Sealing…" : "Seal & Print"}
          </Button>
        </div>

        <div className="flex gap-1 mt-3 flex-wrap">
          {(["summary","intake","doctrine","template"] as const).map(s => (
            <button
              key={s}
              onClick={() => setSection(s)}
              className={`text-[10px] px-2.5 py-1 rounded-full font-semibold uppercase tracking-wider transition-colors ${
                section === s ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </CardHeader>

      <CardContent className="p-4">
        {section === "summary" && (
          <div className="space-y-3">
            <div className="bg-muted/40 rounded-lg p-4 font-mono text-xs whitespace-pre-wrap leading-relaxed border">
              {result.generatedSummary}
            </div>
            <div className="bg-amber-50 dark:bg-amber-950/30 rounded-lg p-3 border border-amber-200 dark:border-amber-800">
              <p className="text-xs font-semibold text-amber-800 dark:text-amber-300 mb-1">Analyst Review</p>
              <p className="text-xs text-amber-700 dark:text-amber-400 leading-relaxed">{result.analystNotes}</p>
            </div>
          </div>
        )}

        {section === "intake" && (
          <div className="space-y-3 text-sm">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Sovereign Posture</p>
              <p className="text-sm bg-muted/40 rounded p-3 border">{result.intakeResult.canonicalPosture || "Standard sovereign posture"}</p>
            </div>
            {result.intakeResult.violations.length > 0 && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Violations Detected</p>
                <ul className="space-y-1">
                  {result.intakeResult.violations.map((v, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-red-700 dark:text-red-400">
                      <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" /> {v}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              {result.intakeResult.troRecommended && <Badge variant="destructive" className="text-xs">TRO Recommended</Badge>}
              {result.intakeResult.indianStatusViolation && <Badge variant="outline" className="text-xs border-red-400 text-red-700">Indian Status Violation</Badge>}
            </div>
          </div>
        )}

        {section === "doctrine" && (
          <div className="space-y-4 text-sm">
            {result.doctrineOverlay.allDoctrines?.length > 0 && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Doctrines Engaged</p>
                <ul className="space-y-1">
                  {result.doctrineOverlay.allDoctrines.map((d, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs bg-blue-50 dark:bg-blue-950/30 rounded p-2 border border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-300">
                      <Shield className="h-3 w-3 shrink-0 mt-0.5 text-blue-600" /> {d}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {result.doctrineOverlay.federalLaw?.length > 0 && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Federal Law Applied</p>
                <ul className="space-y-1">
                  {result.doctrineOverlay.federalLaw.map((l, i) => (
                    <li key={i} className="text-xs text-muted-foreground border-l-2 border-primary/40 pl-3 py-1">{l}</li>
                  ))}
                </ul>
              </div>
            )}
            {result.doctrineOverlay.guardrails?.length > 0 && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Sovereignty Guardrails</p>
                <ul className="space-y-1">
                  {result.doctrineOverlay.guardrails.map((g, i) => (
                    <li key={i} className="text-xs text-amber-700 dark:text-amber-400 flex items-start gap-2">
                      <span className="shrink-0">⊛</span> {g}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {section === "template" && (
          <div className="space-y-4 text-sm">
            <div className="bg-[#8B0000]/5 border border-[#8B0000]/20 rounded-lg p-4">
              <p className="text-xs font-bold uppercase tracking-widest text-[#8B0000] mb-1">Selected Template</p>
              <p className="font-serif font-bold text-base">{result.templateTitle}</p>
              <p className="text-xs text-muted-foreground font-mono mt-0.5">{result.templateKey}</p>
            </div>
            {Object.keys(result.templateParties).length > 0 && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Parties</p>
                <div className="space-y-1">
                  {Object.entries(result.templateParties).map(([k, v]) => (
                    <div key={k} className="flex gap-2 text-xs">
                      <span className="font-semibold min-w-[120px] text-muted-foreground shrink-0">{k}:</span>
                      <span className="text-foreground/80">{v}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {result.templateProvisions.length > 0 && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                  Provisions Preview ({result.templateProvisions.length} total)
                </p>
                <div className="bg-muted/40 rounded p-3 border">
                  <p className="text-xs leading-relaxed text-foreground/80 line-clamp-6">
                    {result.templateProvisions[0]}
                  </p>
                  {result.templateProvisions.length > 1 && (
                    <p className="text-[10px] text-muted-foreground mt-2">
                      + {result.templateProvisions.length - 1} more provisions in full document
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Record Log ────────────────────────────────────────────────────────────────

function RecordLog() {
  const { data: records, isLoading } = useQuery<RecordSummary[]>({
    queryKey: ["sovereign-pipeline-records"],
    queryFn: async () => {
      const token = getCurrentBearerToken();
      const r = await fetch(`${API}/api/sovereign/pipeline`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!r.ok) throw new Error("Failed to load records");
      return r.json();
    },
    staleTime: 30_000,
  });

  if (isLoading) return <div className="text-sm text-muted-foreground py-4 text-center">Loading records…</div>;
  if (!records?.length) return <div className="text-sm text-muted-foreground py-8 text-center">No pipeline records yet.</div>;

  return (
    <div className="space-y-2">
      {records.map(rec => (
        <div key={rec.id} className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-muted/30 transition-colors">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-xs font-bold">{rec.fileNumber}</span>
              <Badge className={`text-[9px] border ${RISK_STYLE[rec.riskLevel] ?? RISK_STYLE.low}`}>{rec.riskLevel}</Badge>
              <span className="text-xs text-muted-foreground">{MATTER_LABELS[rec.matterType] ?? rec.matterType}</span>
            </div>
            <p className="text-xs text-muted-foreground truncate mt-0.5">{rec.templateTitle}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {rec.sealApplied && <Badge variant="outline" className="text-[9px] border-green-500 text-green-700 dark:text-green-400">Sealed</Badge>}
            {rec.printCount > 0 && <span className="text-[9px] text-muted-foreground">×{rec.printCount}</span>}
            <span className="text-[9px] text-muted-foreground">
              {new Date(rec.createdAt).toLocaleDateString()}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

export default function SovereignPipelinePage() {
  const { activeRole } = useAuth();
  const { toast } = useToast();
  const [, navigate] = useLocation();

  const canAccess = ["trustee", "officer", "sovereign_admin"].includes(activeRole);

  const [inputText, setInputText] = useState(() => {
    try {
      const prefill = sessionStorage.getItem("pipeline_prefill");
      if (prefill) { sessionStorage.removeItem("pipeline_prefill"); return prefill; }
    } catch { /* ignore */ }
    return "";
  });
  const [activeStep, setActiveStep] = useState(0);
  const [result, setResult] = useState<PipelineResult | null>(null);
  const [view, setView] = useState<"pipeline" | "log">("pipeline");

  // ── Voice input ──────────────────────────────────────────────────────────────
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const [isListening, setIsListening] = useState(false);
  const voiceSupported = typeof window !== "undefined" &&
    ("SpeechRecognition" in window || "webkitSpeechRecognition" in window);

  function startListening() {
    const Win = window as unknown as Record<string, unknown>;
    const Cls = (Win.SpeechRecognition ?? Win.webkitSpeechRecognition) as
      (new () => SpeechRecognitionLike) | undefined;
    if (!Cls) return;
    const r = new Cls();
    r.continuous = true;
    r.interimResults = true;
    r.lang = "en-US";
    r.onresult = (e) => {
      let t = "";
      for (let i = 0; i < e.results.length; i++) t += e.results[i][0].transcript;
      setInputText(t);
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

  // ── Document upload ──────────────────────────────────────────────────────────
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  async function handleFileUpload(file: File) {
    setIsUploading(true);
    setUploadStatus(`Reading ${file.name}…`);
    try {
      const form = new FormData();
      form.append("file", file);
      const token = getCurrentBearerToken() ?? "";
      const r = await fetch(`${API}/api/intake/upload`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });
      if (!r.ok) {
        const err = await r.json().catch(() => ({})) as { error?: string };
        throw new Error(err.error ?? `Upload failed (${r.status})`);
      }
      const data = await r.json() as { text: string; filename: string; char_count: number };
      setInputText(data.text.substring(0, 8000));
      setUploadStatus(`Extracted ${data.char_count.toLocaleString()} chars from "${data.filename}" — ready to run.`);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Upload failed";
      setUploadStatus(`Error: ${msg}`);
      toast({ title: "Upload failed", description: msg, variant: "destructive" });
    } finally {
      setIsUploading(false);
    }
  }

  const runPipeline = useMutation({
    mutationFn: async (text: string) => {
      setActiveStep(0);
      // Animate through steps 0–4 while the API runs
      const stepInterval = setInterval(() => {
        setActiveStep(prev => (prev < 4 ? prev + 1 : prev));
      }, 500);

      const token = getCurrentBearerToken();
      const r = await fetch(`${API}/api/sovereign/pipeline`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ text }),
      });

      clearInterval(stepInterval);
      setActiveStep(4);

      if (!r.ok) {
        const err = await r.json().catch(() => ({ error: "Pipeline failed" }));
        throw new Error(err.error ?? "Pipeline failed");
      }
      return r.json() as Promise<PipelineResult>;
    },
    onSuccess: (data) => {
      setResult(data);
      setActiveStep(5);
      toast({ title: `Pipeline complete — ${data.fileNumber}`, description: `${data.templateTitle}` });
    },
    onError: (err: Error) => {
      toast({ title: "Pipeline failed", description: err.message, variant: "destructive" });
      setActiveStep(0);
    },
  });

  const printSeal = useMutation({
    mutationFn: async (id: number): Promise<PrintResult> => {
      const token = getCurrentBearerToken();
      const r = await fetch(`${API}/api/sovereign/pipeline/${id}/print`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!r.ok) {
        const err = await r.json().catch(() => ({ error: "Print failed" }));
        throw new Error(err.error ?? "Print failed");
      }
      return r.json();
    },
    onSuccess: (data) => {
      toast({ title: `Seal applied — ${data.fileNumber}`, description: `Print event logged. Print #${data.printCount}` });
      window.print();
    },
    onError: (err: Error) => {
      toast({ title: "Print failed", description: err.message, variant: "destructive" });
    },
  });

  if (!canAccess) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
        <Shield className="h-12 w-12 text-muted-foreground" />
        <h2 className="text-xl font-semibold">Intake Pipeline — Chief Office Only</h2>
        <p className="text-muted-foreground max-w-sm text-sm">
          Access to the Intake Pipeline is restricted to the Chief Justice office and authorized officers.
        </p>
      </div>
    );
  }

  const isRunning = runPipeline.isPending;
  const isDone = !!result && !isRunning;

  return (
    <div className="space-y-6" data-testid="page-sovereign-pipeline">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-serif font-bold flex items-center gap-2">
            <Shield className="h-6 w-6 text-primary" />
            Intake Pipeline
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            6-engine pipeline: Intake → Doctrine → Analyst → Template → Record → Seal &amp; Print
          </p>
          <div className="flex items-center gap-1.5 mt-1.5">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-500 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-600" />
            </span>
            <span className="text-[10px] font-semibold uppercase tracking-widest text-green-700">
              Live Listener — Auto-receiving from Intake &amp; Drafts
            </span>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant={view === "pipeline" ? "default" : "outline"}
            size="sm"
            onClick={() => setView("pipeline")}
            className="gap-1.5 text-xs"
          >
            <FileText className="h-3.5 w-3.5" /> Pipeline
          </Button>
          <Button
            variant={view === "log" ? "default" : "outline"}
            size="sm"
            onClick={() => setView("log")}
            className="gap-1.5 text-xs"
          >
            <List className="h-3.5 w-3.5" /> Record Log
          </Button>
        </div>
      </div>

      {view === "log" && (
        <Card>
          <CardHeader className="border-b pb-3">
            <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              All Pipeline Records
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <RecordLog />
          </CardContent>
        </Card>
      )}

      {view === "pipeline" && (
        <>
          {/* Step indicator */}
          <Card>
            <CardContent className="pt-4 pb-3 px-4">
              <PipelineSteps activeStep={activeStep} done={isDone} />
              {isRunning && (
                <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1.5">
                  <Clock className="h-3 w-3 animate-spin" />
                  {ENGINES[activeStep]?.label} running…
                </p>
              )}
            </CardContent>
          </Card>

          {/* Input */}
          {!result && (
            <Card>
              <CardHeader className="border-b pb-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <CardTitle className="text-sm font-semibold">Incoming Matter</CardTitle>
                  {/* Voice + Upload controls */}
                  <div className="flex items-center gap-2">
                    {voiceSupported && (
                      <Button
                        type="button"
                        variant={isListening ? "destructive" : "outline"}
                        size="sm"
                        className="gap-1.5 text-xs h-7 px-2.5"
                        onClick={isListening ? stopListening : startListening}
                        title={isListening ? "Stop dictation" : "Dictate into this field"}
                      >
                        {isListening
                          ? <><MicOff className="h-3.5 w-3.5" /> Stop</>
                          : <><Mic className="h-3.5 w-3.5" /> Speak</>}
                        {isListening && (
                          <span className="ml-1 h-1.5 w-1.5 rounded-full bg-red-400 animate-pulse" />
                        )}
                      </Button>
                    )}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="gap-1.5 text-xs h-7 px-2.5"
                      onClick={() => fileRef.current?.click()}
                      disabled={isUploading}
                      title="Upload a PDF, Word doc, or image to extract text"
                    >
                      {isUploading
                        ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Reading…</>
                        : <><Upload className="h-3.5 w-3.5" /> Upload Doc</>}
                    </Button>
                    <input
                      ref={fileRef}
                      type="file"
                      className="hidden"
                      accept=".pdf,.doc,.docx,.txt,.png,.jpg,.jpeg,.tiff,.bmp"
                      onChange={e => {
                        const f = e.target.files?.[0];
                        if (f) handleFileUpload(f);
                        e.target.value = "";
                      }}
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-4 space-y-4">
                {uploadStatus && (
                  <div className="flex items-start justify-between gap-2 rounded-md border border-blue-200 bg-blue-50 dark:bg-blue-950/30 dark:border-blue-800 px-3 py-2">
                    <p className="text-xs text-blue-800 dark:text-blue-300">{uploadStatus}</p>
                    <button onClick={() => setUploadStatus(null)} className="text-blue-400 hover:text-blue-600 flex-shrink-0">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
                {isListening && (
                  <div className="flex items-center gap-2 rounded-md border border-red-200 bg-red-50 dark:bg-red-950/30 dark:border-red-800 px-3 py-2">
                    <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse flex-shrink-0" />
                    <p className="text-xs text-red-700 dark:text-red-300 font-medium">Listening — speak clearly. Words will appear in the field below. Click "Stop" when done.</p>
                  </div>
                )}
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold uppercase tracking-wider">
                    Document text — paste, speak, or upload
                  </Label>
                  <Textarea
                    value={inputText}
                    onChange={e => setInputText(e.target.value)}
                    rows={10}
                    placeholder={`Examples:\n• "The State of California hereby asserts jurisdiction over tribal land…"\n• "You are ordered to comply with county zoning ordinance 4.12…"\n• "This child does not qualify as an Indian child under ICWA…"\n• "Your tribal enrollment is not recognized by this agency…"`}
                    className="font-mono text-sm resize-y"
                  />
                  <p className="text-[10px] text-muted-foreground">
                    Paste text directly · upload a PDF/Word/image · or click <strong>Speak</strong> to dictate. The pipeline classifies the matter, overlays doctrines, selects a response template, and creates a file record automatically.
                  </p>
                </div>
                <Button
                  onClick={() => runPipeline.mutate(inputText)}
                  disabled={!inputText.trim() || isRunning}
                  className="gap-2 bg-[#8B0000] hover:bg-[#6B0000] text-white"
                >
                  <Shield className="h-4 w-4" />
                  {isRunning ? "Running Pipeline…" : "Run Intake Pipeline"}
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Result */}
          {result && (
            <>
              <PipelineResultCard
                result={result}
                onPrint={() => printSeal.mutate(result.id)}
                printing={printSeal.isPending}
              />

              <div className="flex flex-wrap gap-3">
                <Button
                  variant="default"
                  className="gap-2 text-sm"
                  onClick={() => {
                    const docType = MATTER_TO_DOC[result.matterType] ?? "court_document";
                    const notes = [
                      `Sovereign Pipeline — ${result.fileNumber}`,
                      `Matter: ${MATTER_LABELS[result.matterType] ?? result.matterType}`,
                      `Template: ${result.templateTitle}`,
                      `\nSummary:\n${result.generatedSummary}`,
                      result.doctrineOverlay.doctrinesApplied.length
                        ? `\nDoctrines: ${result.doctrineOverlay.doctrinesApplied.join("; ")}`
                        : "",
                    ].join("\n").trim();
                    sessionStorage.setItem("intake_context", JSON.stringify({ docType, notes, riskLevel: result.riskLevel }));
                    navigate("/drafts");
                  }}
                >
                  <FileText className="h-4 w-4" /> Draft Response
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setResult(null);
                    setInputText("");
                    setActiveStep(0);
                  }}
                  className="gap-2 text-sm"
                >
                  <RotateCcw className="h-4 w-4" /> Run New Matter
                </Button>
              </div>
            </>
          )}

          {/* Engine legend */}
          {!result && (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {ENGINES.map(({ id, icon: Icon, label, desc }) => (
                <div key={id} className="rounded-lg border bg-muted/20 p-3 flex items-start gap-2">
                  <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                    <Icon className="h-3.5 w-3.5 text-primary" />
                  </div>
                  <div>
                    <p className="text-xs font-bold">{label}</p>
                    <p className="text-[10px] text-muted-foreground">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
