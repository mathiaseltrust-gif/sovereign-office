import { useState } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Shield, Flag, AlertTriangle, Clock, ChevronRight,
  Loader2, AlertCircle, Zap, FileText, CheckCircle2, ChevronDown,
  ChevronUp, BookOpen, Building2, ArrowRight, BarChart3,
} from "lucide-react";
import { api, TraceMatter, TraceAnalysis, TraceDraft, ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { SessionExpiredBanner } from "@/App";

const STATUS_LABELS: Record<string, { label: string; cls: string }> = {
  pending:   { label: "Pending",   cls: "bg-gray-100 text-gray-700 border-gray-200" },
  analyzing: { label: "Analyzing", cls: "bg-blue-50 text-blue-700 border-blue-200" },
  reviewed:  { label: "Reviewed",  cls: "bg-green-50 text-green-700 border-green-200" },
  escalated: { label: "Escalated", cls: "bg-amber-50 text-amber-700 border-amber-200" },
  monitoring:{ label: "Monitoring",cls: "bg-purple-50 text-purple-700 border-purple-200" },
  closed:    { label: "Closed",    cls: "bg-slate-100 text-slate-500 border-slate-200" },
};

const RISK_LABELS: Record<string, { label: string; cls: string }> = {
  low:      { label: "Low",      cls: "bg-green-50 text-green-700 border-green-200" },
  medium:   { label: "Medium",   cls: "bg-yellow-50 text-yellow-700 border-yellow-200" },
  high:     { label: "High",     cls: "bg-orange-50 text-orange-700 border-orange-200" },
  critical: { label: "Critical", cls: "bg-red-50 text-red-700 border-red-200" },
};

const MATTER_TYPE_LABELS: Record<string, string> = {
  apa_review:         "APA Review",
  cfr_review:         "CFR Review",
  niac_review:        "NIAC Review",
  indigenous_rights:  "Indigenous Rights",
  oversight_trigger:  "Oversight Trigger",
  general:            "General",
};

const DRAFT_TYPES = [
  { value: "procedural_audit_report", label: "Procedural Audit Report" },
  { value: "oversight_map",           label: "Oversight & Agency Map" },
  { value: "response_letter",         label: "Response Letter" },
  { value: "escalation_memo",         label: "Escalation Memo" },
  { value: "summary",                 label: "Executive Summary" },
];

const STATUS_OPTIONS = [
  "pending", "analyzing", "reviewed", "escalated", "monitoring", "closed"
];

function RiskGauge({ score }: { score: number }) {
  const pct = Math.min(100, Math.max(0, score));
  const color =
    pct >= 76 ? "#ef4444" :
    pct >= 51 ? "#f97316" :
    pct >= 26 ? "#eab308" : "#22c55e";

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
        <span>Risk Score</span>
        <span className="font-bold text-foreground" style={{ color }}>{pct}/100</span>
      </div>
      <div className="h-2 rounded-full bg-muted overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>Low</span><span>Med</span><span>High</span><span>Critical</span>
      </div>
    </div>
  );
}

function Accordion({ title, icon: Icon, children, defaultOpen = false }: {
  title: string;
  icon: React.ElementType;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-card-border rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 px-4 py-3 bg-muted/40 hover:bg-muted/60 transition-colors text-left"
      >
        <Icon className="h-4 w-4 text-primary shrink-0" />
        <span className="text-sm font-medium text-foreground flex-1">{title}</span>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>
      {open && <div className="px-4 py-3 text-sm text-muted-foreground">{children}</div>}
    </div>
  );
}

function StringList({ items, emptyText = "None identified." }: { items: string[] | null | undefined; emptyText?: string }) {
  if (!items || items.length === 0) {
    return <p className="italic text-xs text-muted-foreground">{emptyText}</p>;
  }
  return (
    <ul className="space-y-1">
      {items.map((item, i) => (
        <li key={i} className="flex items-start gap-1.5 text-xs">
          <ChevronRight className="h-3 w-3 text-primary shrink-0 mt-0.5" />
          {item}
        </li>
      ))}
    </ul>
  );
}

export default function MatterDetailPage() {
  const { id } = useParams<{ id: string }>();
  const matterId = Number(id);
  const qc = useQueryClient();

  const [selectedDraftType, setSelectedDraftType] = useState("summary");
  const [editingStatus, setEditingStatus] = useState(false);
  const [newStatus, setNewStatus] = useState("");
  const [viewingDraft, setViewingDraft] = useState<TraceDraft | null>(null);

  const { data: matter, isLoading: matterLoading, error: matterError } = useQuery({
    queryKey: ["trace-matter", matterId],
    queryFn: () => api.getMatter(matterId),
  });

  const { data: reportData, isLoading: reportLoading } = useQuery({
    queryKey: ["trace-report", matterId],
    queryFn: () => api.getReport(matterId),
    enabled: !!matter,
  });

  const { data: draftsData, isLoading: draftsLoading } = useQuery({
    queryKey: ["trace-drafts", matterId],
    queryFn: () => api.getDrafts(matterId),
    enabled: !!matter,
  });

  const analyzeMutation = useMutation({
    mutationFn: () => api.analyzeMatter(matterId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["trace-matter", matterId] });
      qc.invalidateQueries({ queryKey: ["trace-report", matterId] });
    },
  });

  const draftMutation = useMutation({
    mutationFn: () => api.generateDraft(matterId, selectedDraftType),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["trace-drafts", matterId] });
    },
  });

  const approveMutation = useMutation({
    mutationFn: (draftId: number) => api.approveDraft(matterId, draftId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["trace-drafts", matterId] }),
  });

  const updateMutation = useMutation({
    mutationFn: (status: string) => api.updateMatter(matterId, { status }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["trace-matter", matterId] });
      qc.invalidateQueries({ queryKey: ["trace-matters"] });
      setEditingStatus(false);
    },
  });

  const is401 = (matterError as ApiError)?.status === 401;

  if (is401) {
    return <div className="p-6"><SessionExpiredBanner /></div>;
  }

  if (matterLoading) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mr-2" />
        Loading matter…
      </div>
    );
  }

  if (matterError || !matter) {
    return (
      <div className="p-6">
        <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 flex items-center gap-2 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {(matterError as ApiError)?.status === 403
            ? "Access denied. You do not have TRACE portal access."
            : (matterError as ApiError)?.status === 404
            ? "Matter not found."
            : "Failed to load matter."}
        </div>
      </div>
    );
  }

  const analyses = reportData?.analyses ?? [];
  const latestAnalysis = analyses[0] as TraceAnalysis | undefined;
  const drafts = draftsData?.drafts ?? [];

  const statusInfo = STATUS_LABELS[matter.status] ?? { label: matter.status, cls: "bg-gray-100 text-gray-700 border-gray-200" };
  const riskInfo = RISK_LABELS[matter.riskLevel] ?? { label: matter.riskLevel, cls: "bg-gray-100 text-gray-700 border-gray-200" };

  return (
    <div className="p-4 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <h1 className="text-lg font-semibold text-foreground leading-tight">{matter.title}</h1>
            {matter.niacPathway && (
              <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded border border-purple-300 bg-purple-50 text-purple-700 font-semibold shrink-0">
                <Flag className="h-3 w-3" /> NIAC Review
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 flex-wrap text-xs text-muted-foreground">
            <span>{MATTER_TYPE_LABELS[matter.matterType] ?? matter.matterType}</span>
            <span>·</span>
            <span>#{matter.id}</span>
            <span>·</span>
            <span>Created {new Date(matter.createdAt).toLocaleDateString()}</span>
            {matter.deadlineAt && (
              <>
                <span>·</span>
                <span className={cn("flex items-center gap-1", new Date(matter.deadlineAt) < new Date() && "text-red-600 font-medium")}>
                  <Clock className="h-3 w-3" />
                  Deadline: {new Date(matter.deadlineAt).toLocaleDateString()}
                </span>
              </>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className={cn("text-xs px-2 py-0.5 rounded border font-medium", riskInfo.cls)}>{riskInfo.label}</span>
          {editingStatus ? (
            <div className="flex items-center gap-1">
              <select
                value={newStatus}
                onChange={(e) => setNewStatus(e.target.value)}
                className="text-xs rounded border border-input bg-background px-2 py-1 text-foreground"
              >
                <option value="">Select…</option>
                {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <Button
                size="sm"
                onClick={() => newStatus && updateMutation.mutate(newStatus)}
                disabled={!newStatus || updateMutation.isPending}
              >
                Save
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setEditingStatus(false)}>
                Cancel
              </Button>
            </div>
          ) : (
            <button
              onClick={() => { setEditingStatus(true); setNewStatus(matter.status); }}
              className={cn("text-xs px-2 py-0.5 rounded border font-medium cursor-pointer hover:opacity-80 transition-opacity", statusInfo.cls)}
            >
              {statusInfo.label}
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* LEFT — Metadata */}
        <div className="space-y-4">
          <div className="bg-card border border-card-border rounded-lg p-4 space-y-3">
            <h2 className="text-xs font-semibold text-foreground uppercase tracking-wider">Matter Details</h2>
            <dl className="space-y-2 text-xs">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Source</dt>
                <dd className="font-medium text-foreground capitalize">{matter.sourceType}</dd>
              </div>
              {matter.sourceRef && (
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Source Ref</dt>
                  <dd className="font-medium text-foreground truncate max-w-[120px]" title={matter.sourceRef}>{matter.sourceRef}</dd>
                </div>
              )}
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Risk Level</dt>
                <dd><span className={cn("px-1.5 py-0.5 rounded border font-medium", riskInfo.cls)}>{riskInfo.label}</span></dd>
              </div>
              {matter.niacPathway && (
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">NIAC Type</dt>
                  <dd className="font-medium text-foreground">
                    {matter.niacReviewType ?? <span className="text-muted-foreground/50 italic text-xs">Unclassified</span>}
                  </dd>
                </div>
              )}
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Analysis</dt>
                <dd className="font-medium text-foreground">{analyses.length} version{analyses.length !== 1 ? "s" : ""}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Drafts</dt>
                <dd className="font-medium text-foreground">{drafts.length}</dd>
              </div>
            </dl>
          </div>

          <div className="bg-card border border-card-border rounded-lg p-4">
            <h2 className="text-xs font-semibold text-foreground uppercase tracking-wider mb-2">Description</h2>
            <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap line-clamp-12">
              {matter.description}
            </p>
          </div>

          {/* Analyze button */}
          <Button
            className="w-full"
            onClick={() => analyzeMutation.mutate()}
            disabled={analyzeMutation.isPending || matter.status === "analyzing"}
          >
            {analyzeMutation.isPending ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Analyzing…</>
            ) : (
              <><Zap className="h-4 w-4" /> {analyses.length > 0 ? "Re-Analyze" : "Run Analysis"}</>
            )}
          </Button>

          {analyzeMutation.error && (
            <div className="text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded-md p-2 flex items-center gap-1">
              <AlertCircle className="h-3 w-3 shrink-0" />
              {(analyzeMutation.error as Error).message}
            </div>
          )}
        </div>

        {/* CENTER — Analysis */}
        <div className="space-y-3">
          {latestAnalysis ? (
            <>
              <div className="bg-card border border-card-border rounded-lg p-4">
                <RiskGauge score={latestAnalysis.riskScore ?? 0} />
              </div>

              <Accordion title="Procedural Reconstruction" icon={Shield} defaultOpen>
                <div className="space-y-3">
                  <div>
                    <p className="text-xs font-medium text-foreground mb-1">Required Procedure</p>
                    <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap">
                      {latestAnalysis.requiredProcedure ?? "Not determined."}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-foreground mb-1">Actual Conduct</p>
                    <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap">
                      {latestAnalysis.actualConduct ?? "Not determined."}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-foreground mb-1">Procedural Gaps</p>
                    <StringList items={latestAnalysis.proceduralGaps} />
                  </div>
                </div>
              </Accordion>

              <Accordion title="Authority Map" icon={BookOpen}>
                {(() => {
                  const am = latestAnalysis.authorityMap;
                  if (!am) return <p className="italic text-xs">No authority map generated.</p>;
                  return (
                    <div className="space-y-3">
                      {[
                        { key: "statutes",    label: "Statutes (USC)" },
                        { key: "regulations", label: "Regulations (CFR)" },
                        { key: "treaties",    label: "Treaties" },
                        { key: "guidance",    label: "Agency Guidance" },
                      ].map(({ key, label }) => (
                        <div key={key}>
                          <p className="text-xs font-medium text-foreground mb-1">{label}</p>
                          <StringList items={(am as Record<string, string[]>)[key]} />
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </Accordion>

              <Accordion title="Oversight Map" icon={Building2}>
                {(() => {
                  const om = latestAnalysis.oversightMap;
                  const recs = latestAnalysis.escalationRecs;
                  if (!om) return <p className="italic text-xs">No oversight map generated.</p>;
                  return (
                    <div className="space-y-3">
                      <div>
                        <p className="text-xs font-medium text-foreground mb-1">Applicable Agencies</p>
                        <StringList items={om.agencies} />
                      </div>
                      <div>
                        <p className="text-xs font-medium text-foreground mb-1">Oversight Pathways</p>
                        <StringList items={om.pathways} />
                      </div>
                      <div>
                        <p className="text-xs font-medium text-foreground mb-1">Escalation Recommendations</p>
                        <StringList items={recs} />
                      </div>
                    </div>
                  );
                })()}
              </Accordion>

              {analyses.length > 1 && (
                <div className="text-xs text-muted-foreground text-center">
                  Showing v{latestAnalysis.version} of {analyses.length} analysis versions
                </div>
              )}
            </>
          ) : (
            <div className="bg-card border border-card-border rounded-lg p-8 text-center">
              <BarChart3 className="mx-auto h-8 w-8 text-muted-foreground/30 mb-3" />
              <p className="text-sm text-muted-foreground">No analysis yet.</p>
              <p className="text-xs text-muted-foreground mt-1">
                Click "Run Analysis" to generate the procedural audit.
              </p>
            </div>
          )}
        </div>

        {/* RIGHT — Drafts */}
        <div className="space-y-3">
          <div className="bg-card border border-card-border rounded-lg p-4">
            <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
              <FileText className="h-4 w-4 text-primary" />
              Drafts Panel
            </h2>

            {!latestAnalysis && (
              <div className="mb-3 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">
                Run analysis first for best draft quality.
              </div>
            )}

            <div className="space-y-2 mb-3">
              <label className="text-xs font-medium text-foreground">Draft Type</label>
              <select
                value={selectedDraftType}
                onChange={(e) => setSelectedDraftType(e.target.value)}
                className="w-full text-xs rounded-md border border-input bg-background px-3 py-2 text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              >
                {DRAFT_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>

            <Button
              size="sm"
              className="w-full mb-4"
              onClick={() => draftMutation.mutate()}
              disabled={draftMutation.isPending}
            >
              {draftMutation.isPending ? (
                <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Generating…</>
              ) : (
                <><FileText className="h-3.5 w-3.5" /> Generate Draft</>
              )}
            </Button>

            {draftsLoading ? (
              <div className="text-center py-4">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground mx-auto" />
              </div>
            ) : drafts.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">No drafts yet.</p>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {drafts.map((d) => (
                  <DraftCard
                    key={d.id}
                    draft={d}
                    onView={() => setViewingDraft(d)}
                    onApprove={() => approveMutation.mutate(d.id)}
                    isApproving={approveMutation.isPending}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Draft viewer modal */}
      {viewingDraft && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={() => setViewingDraft(null)}>
          <div
            className="bg-background border border-border rounded-lg w-full max-w-3xl max-h-[85vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <h3 className="text-sm font-semibold text-foreground">
                {DRAFT_TYPES.find(t => t.value === viewingDraft.draftType)?.label ?? viewingDraft.draftType}
              </h3>
              <div className="flex items-center gap-2">
                {viewingDraft.approved && (
                  <span className="text-xs text-green-700 flex items-center gap-1">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Approved
                  </span>
                )}
                <button onClick={() => setViewingDraft(null)} className="text-muted-foreground hover:text-foreground">
                  ✕
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-5">
              <pre className="text-xs text-foreground whitespace-pre-wrap font-sans leading-relaxed">
                {viewingDraft.content}
              </pre>
            </div>
            <div className="px-5 py-3 border-t border-border flex justify-end gap-2">
              {!viewingDraft.approved && (
                <Button
                  size="sm"
                  onClick={() => { approveMutation.mutate(viewingDraft.id); setViewingDraft(null); }}
                  disabled={approveMutation.isPending}
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Approve Draft
                </Button>
              )}
              <Button size="sm" variant="outline" onClick={() => setViewingDraft(null)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function DraftCard({ draft, onView, onApprove, isApproving }: {
  draft: TraceDraft;
  onView: () => void;
  onApprove: () => void;
  isApproving: boolean;
}) {
  const typeLabel = DRAFT_TYPES.find(t => t.value === draft.draftType)?.label ?? draft.draftType;

  return (
    <div className="border border-border rounded-md p-3 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-foreground">{typeLabel}</span>
        {draft.approved ? (
          <span className="text-xs text-green-700 flex items-center gap-0.5">
            <CheckCircle2 className="h-3 w-3" /> Approved
          </span>
        ) : (
          <span className="text-xs text-amber-600">Pending</span>
        )}
      </div>
      <p className="text-xs text-muted-foreground line-clamp-2">{draft.content.substring(0, 120)}…</p>
      <div className="flex gap-1.5">
        <button
          onClick={onView}
          className="flex items-center gap-1 text-xs px-2 py-1 rounded border border-border bg-background text-foreground hover:bg-muted transition-colors"
        >
          <ArrowRight className="h-3 w-3" /> View
        </button>
        {!draft.approved && (
          <button
            onClick={onApprove}
            disabled={isApproving}
            className="flex items-center gap-1 text-xs px-2 py-1 rounded border border-green-200 bg-green-50 text-green-700 hover:bg-green-100 transition-colors"
          >
            <CheckCircle2 className="h-3 w-3" /> Approve
          </button>
        )}
      </div>
    </div>
  );
}
