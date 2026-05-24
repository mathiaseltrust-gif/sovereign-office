import { useState } from "react";
import { useAuth, getCurrentBearerToken } from "@/components/auth-provider";
import {
  Upload, GitPullRequestArrow, Zap, Sparkles, FileText, UserCheck,
  CheckCircle2, Clock, AlertCircle, ChevronDown, ChevronRight,
  Copy, RotateCcw, ArrowRight, Info,
} from "lucide-react";
import { cn } from "@/lib/utils";

const API_BASE = `${import.meta.env.BASE_URL.replace(/\/$/, "").replace(/\/sovereign-dashboard$/, "")}/api`;

interface PipelineStep {
  step: number;
  name: string;
  status: "complete" | "skipped" | "pending" | "running" | "idle";
  reason?: string;
  method?: string;
}

interface ExtractionResult {
  extractionMethod: string;
  matterType: string;
  urgency: string;
  parties: string[];
  deadline: string | null;
  state: string | null;
  county: string | null;
  legalFlags: string[];
  recommendedInstruments: string[];
  confidence: number;
  note?: string;
}

interface IntakePreviewResponse {
  mode: "dry_run";
  dryRun: true;
  message: string;
  issueNumber?: number | null;
  issueTitle: string;
  repository?: string;
  extraction: ExtractionResult;
  draftPreview: {
    title: string;
    matterType: string;
    urgency: string;
    parties: string[];
    deadline: string | null;
    state: string | null;
    county: string | null;
    legalFlags: string[];
    recommendedInstruments: string[];
    suggestedLabels: string[];
    status: string;
  };
  pipelineSteps: PipelineStep[];
}

const STEP_ICONS = [Upload, GitPullRequestArrow, Zap, Sparkles, FileText, UserCheck];

const URGENCY_COLORS: Record<string, string> = {
  high:   "bg-red-100 text-red-800 border-red-200",
  medium: "bg-amber-100 text-amber-800 border-amber-200",
  low:    "bg-green-100 text-green-800 border-green-200",
};

const MATTER_COLORS: Record<string, string> = {
  land:          "bg-amber-100 text-amber-800 border-amber-200",
  membership:    "bg-blue-100 text-blue-800 border-blue-200",
  enrollment:    "bg-sky-100 text-sky-800 border-sky-200",
  child_welfare: "bg-purple-100 text-purple-800 border-purple-200",
  treaty_rights: "bg-orange-100 text-orange-800 border-orange-200",
  probate:       "bg-gray-100 text-gray-800 border-gray-200",
  general:       "bg-muted text-muted-foreground border-border",
};

function StatusIcon({ status }: { status: PipelineStep["status"] }) {
  if (status === "complete") return <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />;
  if (status === "skipped")  return <AlertCircle  className="h-4 w-4 text-amber-500 shrink-0" />;
  if (status === "running")  return <div className="h-4 w-4 rounded-full border-2 border-primary border-t-transparent animate-spin shrink-0" />;
  if (status === "pending")  return <Clock className="h-4 w-4 text-muted-foreground shrink-0" />;
  return <div className="h-4 w-4 rounded-full border border-muted-foreground/30 shrink-0" />;
}

const SAMPLE_DOCUMENT = `Matter Type: land
Urgency: high
Parties: John Running Bear, Bureau of Indian Affairs – Pacific Region
Deadline: 2026-07-01
State: CA
County: Kern

Document Text:
This matter concerns an unresolved allotment claim on trust land parcel APN 019-280-12
in Kern County, California. The petitioner, John Running Bear, asserts that a 2019
BIA determination incorrectly removed the parcel from trust status. Prior correspondence
with the BIA Pacific Region office (dated March 4, 2026) went unanswered.
Federal review under 25 CFR Part 151 may be required. ICWA does not directly apply.
Treaty rights under the 1851 Fort Tejon Treaty may be implicated.

Legal Flags:
- Trust land involved
- Federal review required
- Treaty rights implicated
- Involves enrolled member`;

export default function GitHubIntakePreviewPage() {
  const { user } = useAuth();
  const [issueTitle, setIssueTitle] = useState("[INTAKE] Land allotment dispute — Kern County parcel");
  const [issueBody,  setIssueBody]  = useState(SAMPLE_DOCUMENT);
  const [issueNumber, setIssueNumber] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<IntakePreviewResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showRaw, setShowRaw] = useState(false);

  const runPreview = async () => {
    if (!issueTitle.trim() || !issueBody.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch(`${API_BASE}/github/intake`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getCurrentBearerToken() ?? ""}`,
        },
        body: JSON.stringify({
          issueNumber: issueNumber ? parseInt(issueNumber, 10) : null,
          issueTitle: issueTitle.trim(),
          issueBody: issueBody.trim(),
          labels: ["intake", "needs-review"],
          dryRun: true,
        }),
      });

      const data = await res.json() as IntakePreviewResponse | { error: string };
      if (!res.ok) {
        setError((data as { error: string }).error ?? `HTTP ${res.status}`);
        return;
      }
      setResult(data as IntakePreviewResponse);
    } catch (e) {
      setError("Could not reach the API server.");
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setResult(null);
    setError(null);
    setShowRaw(false);
  };

  return (
    <div className="max-w-3xl mx-auto space-y-5 pb-12" data-testid="page-github-intake-preview">

      {/* ── Header ── */}
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
          <GitPullRequestArrow className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-lg font-serif font-bold leading-tight">GitHub Intake Pipeline</h1>
            <span className="text-xs font-semibold px-2 py-0.5 rounded border border-amber-300 bg-amber-50 text-amber-800">
              DRY RUN
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Preview the full pipeline — document upload → issue → AI extraction → draft record.
            No DB writes until dryRun=false is enabled.
          </p>
        </div>
      </div>

      {/* ── Pipeline diagram ── */}
      <div className="bg-card border border-border rounded-lg px-4 py-3">
        <p className="text-xs font-medium text-muted-foreground mb-3 uppercase tracking-wide">Pipeline Steps</p>
        <div className="flex items-center gap-1 flex-wrap">
          {[
            "Document Upload",
            "GitHub Issue",
            "Action Parser",
            "AI Extraction",
            "Draft Record",
            "Officer Review",
          ].map((label, i) => {
            const Icon = STEP_ICONS[i];
            const stepResult = result?.pipelineSteps?.[i];
            const status = loading && i === 2 ? "running" : (stepResult?.status ?? "idle");
            return (
              <div key={i} className="flex items-center gap-1">
                <div className={cn(
                  "flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-md border font-medium transition-all",
                  status === "complete" ? "bg-green-50 border-green-200 text-green-800" :
                  status === "skipped"  ? "bg-amber-50 border-amber-200 text-amber-700" :
                  status === "running"  ? "bg-primary/10 border-primary/30 text-primary" :
                  status === "pending"  ? "bg-muted border-border text-muted-foreground" :
                  "bg-background border-border text-muted-foreground"
                )}>
                  <StatusIcon status={status} />
                  <Icon className="h-3 w-3 shrink-0" />
                  <span className="hidden sm:inline">{label}</span>
                </div>
                {i < 5 && <ArrowRight className="h-3 w-3 text-muted-foreground/40 shrink-0" />}
              </div>
            );
          })}
        </div>
        {result && (
          <p className="text-xs text-amber-700 mt-2.5 flex items-center gap-1">
            <Info className="h-3 w-3" />
            Step 5 (Draft Record) is skipped — dryRun=true. Step 6 is pending draft creation.
          </p>
        )}
      </div>

      {/* ── Test form ── */}
      {!result && (
        <div className="bg-card border border-border rounded-lg divide-y divide-border">
          <div className="px-4 py-3">
            <h2 className="text-sm font-semibold text-foreground">Submit Test Document</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Fill in the fields below (or keep the sample) and run the dry-run preview.
            </p>
          </div>

          <div className="px-4 py-4 space-y-3">
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <label className="block text-xs font-medium text-foreground mb-1">Issue Title</label>
                <input
                  className="w-full text-sm rounded-md border border-input bg-background px-3 py-2 focus:outline-none focus:ring-1 focus:ring-ring"
                  value={issueTitle}
                  onChange={e => setIssueTitle(e.target.value)}
                  placeholder="[INTAKE] matter description"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">Issue # (optional)</label>
                <input
                  className="w-full text-sm rounded-md border border-input bg-background px-3 py-2 focus:outline-none focus:ring-1 focus:ring-ring"
                  value={issueNumber}
                  onChange={e => setIssueNumber(e.target.value)}
                  placeholder="e.g. 42"
                  type="number"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-foreground mb-1">Issue Body / Document Text</label>
              <textarea
                className="w-full text-xs rounded-md border border-input bg-background px-3 py-2 focus:outline-none focus:ring-1 focus:ring-ring font-mono leading-relaxed"
                rows={10}
                value={issueBody}
                onChange={e => setIssueBody(e.target.value)}
                placeholder="Paste document text or use the sample..."
              />
            </div>
          </div>

          <div className="px-4 py-3 flex items-center gap-3">
            <button
              onClick={runPreview}
              disabled={loading || !issueTitle.trim() || !issueBody.trim()}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? (
                <><div className="w-3.5 h-3.5 rounded-full border-2 border-primary-foreground border-t-transparent animate-spin" /> Running…</>
              ) : (
                <><Zap className="h-3.5 w-3.5" /> Run Dry-Run Preview</>
              )}
            </button>
            <button
              onClick={() => { setIssueTitle("[INTAKE] Land allotment dispute — Kern County parcel"); setIssueBody(SAMPLE_DOCUMENT); setIssueNumber(""); }}
              className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
            >
              <RotateCcw className="h-3 w-3" /> Reset to sample
            </button>
            <span className="text-xs text-muted-foreground ml-auto flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" /> dryRun=true — no writes
            </span>
          </div>
        </div>
      )}

      {/* ── Error ── */}
      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* ── Result panels ── */}
      {result && (
        <div className="space-y-4">

          {/* Success banner */}
          <div className="flex items-center gap-3 rounded-lg border border-green-200 bg-green-50 px-4 py-3">
            <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-green-900">Dry-run complete — pipeline wired correctly</p>
              <p className="text-xs text-green-700 mt-0.5">{result.message}</p>
            </div>
            <button onClick={reset} className="text-xs text-green-700 hover:text-green-900 flex items-center gap-1 shrink-0">
              <RotateCcw className="h-3 w-3" /> Run again
            </button>
          </div>

          {/* Submitted issue */}
          <div className="bg-card border border-border rounded-lg divide-y divide-border">
            <div className="px-4 py-2.5 flex items-center gap-2">
              <GitPullRequestArrow className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-semibold">GitHub Issue (Simulated)</span>
            </div>
            <div className="px-4 py-3 space-y-1">
              <p className="text-sm font-medium text-foreground">{result.issueTitle}</p>
              <div className="flex flex-wrap gap-1.5 mt-1">
                {["intake", "needs-review", result.extraction.matterType].map(l => (
                  <span key={l} className="text-xs px-1.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 font-mono">
                    {l}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Extracted fields */}
          <div className="bg-card border border-border rounded-lg divide-y divide-border">
            <div className="px-4 py-2.5 flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-semibold">AI Extracted Fields</span>
              <span className="ml-auto text-xs text-muted-foreground">
                {result.extraction.extractionMethod} · {Math.round((result.extraction.confidence ?? 0) * 100)}% confidence
              </span>
            </div>

            <div className="px-4 py-4 grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-xs text-muted-foreground mb-0.5">Matter Type</p>
                <span className={cn("text-xs px-2 py-0.5 rounded border font-medium", MATTER_COLORS[result.extraction.matterType] ?? MATTER_COLORS.general)}>
                  {result.extraction.matterType.replace(/_/g, " ")}
                </span>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-0.5">Urgency</p>
                <span className={cn("text-xs px-2 py-0.5 rounded border font-medium", URGENCY_COLORS[result.extraction.urgency] ?? "bg-muted text-muted-foreground border-border")}>
                  {result.extraction.urgency}
                </span>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-0.5">Parties</p>
                <p className="text-sm text-foreground leading-snug">{result.extraction.parties.join(", ")}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-0.5">Deadline</p>
                <p className="text-sm text-foreground">{result.extraction.deadline ?? "—"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-0.5">State / County</p>
                <p className="text-sm text-foreground">
                  {[result.extraction.state, result.extraction.county].filter(Boolean).join(" · ") || "—"}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-0.5">Legal Flags</p>
                <div className="flex flex-wrap gap-1">
                  {result.extraction.legalFlags.length > 0
                    ? result.extraction.legalFlags.map(f => (
                        <span key={f} className="text-xs px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-200">
                          {f.replace(/_/g, " ")}
                        </span>
                      ))
                    : <span className="text-muted-foreground text-xs">None detected</span>
                  }
                </div>
              </div>
              <div className="col-span-2">
                <p className="text-xs text-muted-foreground mb-1">Recommended Instruments</p>
                <ul className="space-y-0.5">
                  {result.extraction.recommendedInstruments.map(inst => (
                    <li key={inst} className="text-xs text-foreground flex items-center gap-1.5">
                      <ChevronRight className="h-3 w-3 text-primary shrink-0" /> {inst}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {result.extraction.note && (
              <div className="px-4 py-2 flex items-center gap-1.5 text-xs text-amber-700">
                <Info className="h-3 w-3 shrink-0" /> {result.extraction.note}
              </div>
            )}
          </div>

          {/* Draft preview */}
          <div className="bg-card border border-border rounded-lg divide-y divide-border">
            <div className="px-4 py-2.5 flex items-center gap-2">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-semibold">Draft Record Preview</span>
              <span className="ml-auto text-xs font-medium px-2 py-0.5 rounded border border-amber-300 bg-amber-50 text-amber-700">
                SKIPPED — dryRun=true
              </span>
            </div>
            <div className="px-4 py-4 space-y-2 opacity-70">
              <p className="text-sm font-medium text-foreground">{result.draftPreview.title}</p>
              <div className="flex flex-wrap gap-1.5">
                {result.draftPreview.suggestedLabels.map(l => (
                  <span key={l} className="text-xs px-1.5 py-0.5 rounded-full font-mono bg-muted text-muted-foreground border border-border">
                    {l}
                  </span>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                Status: <span className="font-medium text-foreground">{result.draftPreview.status}</span>
              </p>
            </div>
            <div className="px-4 py-3 text-xs text-muted-foreground">
              When dryRun=false is enabled, this record will be created in the pipeline DB table and appear in the AI Intake & Pipeline triage queue.
            </div>
          </div>

          {/* Officer review placeholder */}
          <div className="bg-card border border-border rounded-lg divide-y divide-border">
            <div className="px-4 py-2.5 flex items-center gap-2">
              <UserCheck className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-semibold">Officer Review</span>
              <span className="ml-auto text-xs text-muted-foreground">Pending draft creation</span>
            </div>
            <div className="px-4 py-4 flex items-center gap-3">
              <button disabled className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-green-100 text-green-800 border border-green-200 text-xs font-medium opacity-50 cursor-not-allowed">
                <CheckCircle2 className="h-3.5 w-3.5" /> Approve → Create Draft
              </button>
              <button disabled className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-muted text-muted-foreground border border-border text-xs font-medium opacity-50 cursor-not-allowed">
                Archive
              </button>
              <button disabled className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-amber-100 text-amber-800 border border-amber-200 text-xs font-medium opacity-50 cursor-not-allowed">
                Escalate
              </button>
              <span className="text-xs text-muted-foreground ml-auto">Enabled after dryRun=false</span>
            </div>
          </div>

          {/* Raw JSON toggle */}
          <div className="bg-card border border-border rounded-lg">
            <button
              className="w-full flex items-center gap-2 px-4 py-3 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
              onClick={() => setShowRaw(!showRaw)}
            >
              <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", showRaw && "rotate-180")} />
              Raw API response (JSON)
              <Copy
                className="h-3 w-3 ml-auto hover:text-primary"
                onClick={(e) => { e.stopPropagation(); void navigator.clipboard.writeText(JSON.stringify(result, null, 2)); }}
              />
            </button>
            {showRaw && (
              <pre className="px-4 pb-4 text-[11px] leading-relaxed text-muted-foreground font-mono overflow-x-auto whitespace-pre-wrap">
                {JSON.stringify(result, null, 2)}
              </pre>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
