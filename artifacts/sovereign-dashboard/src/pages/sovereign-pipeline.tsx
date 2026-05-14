import { useState } from "react";
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
  CheckCircle2, Clock, AlertTriangle, ChevronRight, Printer, RotateCcw, List
} from "lucide-react";

const API = import.meta.env.VITE_API_BASE_URL ?? "";

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

export default function SovereignPipelinePage() {
  const { activeRole } = useAuth();
  const { toast } = useToast();

  const canAccess = ["trustee", "officer", "sovereign_admin"].includes(activeRole);

  const [inputText, setInputText] = useState("");
  const [activeStep, setActiveStep] = useState(0);
  const [result, setResult] = useState<PipelineResult | null>(null);
  const [view, setView] = useState<"pipeline" | "log">("pipeline");

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
        <h2 className="text-xl font-semibold">Sovereign Pipeline — Chief Office Only</h2>
        <p className="text-muted-foreground max-w-sm text-sm">
          Access to the Sovereign Document Pipeline is restricted to the Chief Justice office and authorized officers.
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
            Sovereign Document Pipeline
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            6-engine pipeline: Intake → Doctrine → Analyst → Template → Record → Seal &amp; Print
          </p>
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
                <CardTitle className="text-sm font-semibold">Incoming Matter</CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold uppercase tracking-wider">
                    Paste the incoming document, demand, letter, or claim text
                  </Label>
                  <Textarea
                    value={inputText}
                    onChange={e => setInputText(e.target.value)}
                    rows={10}
                    placeholder={`Examples:\n• "The State of California hereby asserts jurisdiction over tribal land…"\n• "You are ordered to comply with county zoning ordinance 4.12…"\n• "This child does not qualify as an Indian child under ICWA…"\n• "Your tribal enrollment is not recognized by this agency…"`}
                    className="font-mono text-sm resize-y"
                  />
                  <p className="text-[10px] text-muted-foreground">
                    The pipeline will classify this text, overlay doctrines, select the appropriate sovereign response template, and generate a file record automatically.
                  </p>
                </div>
                <Button
                  onClick={() => runPipeline.mutate(inputText)}
                  disabled={!inputText.trim() || isRunning}
                  className="gap-2 bg-[#8B0000] hover:bg-[#6B0000] text-white"
                >
                  <Shield className="h-4 w-4" />
                  {isRunning ? "Running Pipeline…" : "Run Sovereign Pipeline"}
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
