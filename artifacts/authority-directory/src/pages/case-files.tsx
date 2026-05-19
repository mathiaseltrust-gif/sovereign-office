import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  FolderOpen,
  Search,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  CheckCircle2,
  Clock,
  Archive,
  AlertCircle,
  FileText,
  X,
} from "lucide-react";
import { api, CaseFile, ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { SessionExpiredBanner } from "@/App";
import { useToast } from "@/hooks/use-toast";

// ── helpers ──────────────────────────────────────────────────────────────────

const CASE_TYPE_LABELS: Record<string, string> = {
  federal: "Federal",
  state: "State",
  private: "Civil / Private",
  civil: "Civil / Private",
  court: "Court",
  nfr: "NFR",
  trust: "Trust",
  icwa: "ICWA",
  sovereign: "Sovereign Pipeline",
  intake: "Intake",
  general: "General",
};

const STATUS_CONFIG: Record<string, { label: string; icon: typeof Clock; className: string }> = {
  open:           { label: "Open",           icon: Clock,        className: "bg-blue-50 text-blue-700 border-blue-200" },
  active:         { label: "Active",         icon: RefreshCw,    className: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  pending_review: { label: "Pending Review", icon: AlertCircle,  className: "bg-amber-50 text-amber-700 border-amber-200" },
  closed:         { label: "Closed",         icon: CheckCircle2, className: "bg-gray-50 text-gray-600 border-gray-200" },
  archived:       { label: "Archived",       icon: Archive,      className: "bg-gray-50 text-gray-400 border-gray-200" },
};

const CASE_TYPE_COLORS: Record<string, string> = {
  federal:  "bg-indigo-50 text-indigo-700 border-indigo-200",
  state:    "bg-violet-50 text-violet-700 border-violet-200",
  private:  "bg-orange-50 text-orange-700 border-orange-200",
  civil:    "bg-orange-50 text-orange-700 border-orange-200",
  court:    "bg-red-50 text-red-700 border-red-200",
  nfr:      "bg-red-50 text-red-700 border-red-200",
  trust:    "bg-teal-50 text-teal-700 border-teal-200",
  icwa:     "bg-pink-50 text-pink-700 border-pink-200",
  sovereign:"bg-amber-50 text-amber-700 border-amber-200",
  intake:   "bg-sky-50 text-sky-700 border-sky-200",
  general:  "bg-gray-50 text-gray-600 border-gray-200",
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.open;
  const Icon = cfg.icon;
  return (
    <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border", cfg.className)}>
      <Icon className="h-3 w-3" />
      {cfg.label}
    </span>
  );
}

function CaseTypeBadge({ caseType }: { caseType: string }) {
  return (
    <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border", CASE_TYPE_COLORS[caseType] ?? CASE_TYPE_COLORS.general)}>
      {CASE_TYPE_LABELS[caseType] ?? caseType}
    </span>
  );
}

// ── Row detail panel ──────────────────────────────────────────────────────────

function CaseRow({ cf, defaultOpen = false }: { cf: CaseFile; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const [newStatus, setNewStatus] = useState(cf.status);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const qc = useQueryClient();
  const { toast } = useToast();

  async function handleSave() {
    if (newStatus === cf.status && !notes) return;
    setSaving(true);
    try {
      await api.updateCaseFileStatus(cf.id, newStatus, notes || undefined);
      qc.invalidateQueries({ queryKey: ["case-files"] });
      toast({ title: `Case ${cf.caseNumber} updated`, description: `Status set to ${newStatus}` });
      setNotes("");
    } catch {
      toast({ title: "Update failed", description: "Could not save status change.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="border border-border rounded-lg overflow-hidden bg-card">
      {/* Summary row */}
      <button
        className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-muted/30 transition-colors"
        onClick={() => setOpen((v) => !v)}
      >
        <div className="shrink-0 w-6 flex items-center justify-center">
          {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-0.5">
            <span className="text-sm font-mono font-semibold text-primary">{cf.caseNumber}</span>
            <CaseTypeBadge caseType={cf.caseType} />
            <StatusBadge status={cf.status} />
          </div>
          <div className="text-sm text-foreground font-medium truncate">{cf.title}</div>
          <div className="flex flex-wrap gap-x-4 mt-0.5 text-xs text-muted-foreground">
            {cf.matterType && <span>Matter: <span className="font-medium text-foreground/70">{cf.matterType}</span></span>}
            <span>Opened: {fmtDate(cf.openedAt)}</span>
            {cf.closedAt && <span>Closed: {fmtDate(cf.closedAt)}</span>}
            {cf.linkedDocumentType && (
              <span>Linked: <span className="font-medium text-foreground/70">{cf.linkedDocumentType} #{cf.linkedDocumentId}</span></span>
            )}
          </div>
        </div>
      </button>

      {/* Expanded detail */}
      {open && (
        <div className="border-t border-border px-5 py-4 bg-muted/10 space-y-4">
          {/* Fields grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-3 text-sm">
            <div>
              <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-0.5">Case Number</div>
              <div className="font-mono font-semibold text-primary">{cf.caseNumber}</div>
            </div>
            <div>
              <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-0.5">Case Type</div>
              <div>{CASE_TYPE_LABELS[cf.caseType] ?? cf.caseType}</div>
            </div>
            <div>
              <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-0.5">Jurisdiction</div>
              <div className="capitalize">{cf.jurisdictionLevel}</div>
            </div>
            {cf.matterType && (
              <div>
                <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-0.5">Matter Type</div>
                <div>{cf.matterType}</div>
              </div>
            )}
            {cf.linkedDocumentRef && (
              <div>
                <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-0.5">Document Ref</div>
                <div className="font-mono text-xs">{cf.linkedDocumentRef}</div>
              </div>
            )}
            {cf.linkedDocumentType && (
              <div>
                <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-0.5">Linked Record</div>
                <div className="text-xs">{cf.linkedDocumentType} <span className="font-mono">#{cf.linkedDocumentId}</span></div>
              </div>
            )}
            <div>
              <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-0.5">Opened</div>
              <div>{fmtDate(cf.openedAt)}</div>
            </div>
            {cf.closedAt && (
              <div>
                <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-0.5">Closed</div>
                <div>{fmtDate(cf.closedAt)}</div>
              </div>
            )}
          </div>

          {cf.notes && (
            <div>
              <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Notes</div>
              <p className="text-sm text-foreground/80 bg-background border border-border rounded-md px-3 py-2">{cf.notes}</p>
            </div>
          )}

          {/* Status update */}
          <div className="pt-2 border-t border-border">
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Update Status</div>
            <div className="flex flex-wrap gap-2">
              {Object.entries(STATUS_CONFIG).map(([key, { label }]) => (
                <button
                  key={key}
                  onClick={() => setNewStatus(key)}
                  className={cn(
                    "px-3 py-1 rounded-full text-xs border font-medium transition-colors",
                    newStatus === key
                      ? STATUS_CONFIG[key].className + " ring-2 ring-offset-1 ring-primary/40"
                      : "border-border text-muted-foreground hover:text-foreground hover:border-foreground/30"
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="mt-2 flex gap-2">
              <Input
                placeholder="Optional note on status change…"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="text-sm h-8 flex-1"
              />
              <button
                onClick={handleSave}
                disabled={saving || (newStatus === cf.status && !notes)}
                className={cn(
                  "px-4 h-8 rounded-md text-xs font-medium transition-colors",
                  saving || (newStatus === cf.status && !notes)
                    ? "bg-muted text-muted-foreground cursor-not-allowed"
                    : "bg-primary text-primary-foreground hover:bg-primary/90"
                )}
              >
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

const CASE_TYPES = ["federal", "state", "private", "court", "nfr", "trust", "icwa", "sovereign", "intake", "general"];
const STATUSES   = ["open", "active", "pending_review", "closed", "archived"];
const JURISDICTIONS = ["federal", "state", "tribal", "private"];

export default function CaseFilesPage() {
  const [search, setSearch]     = useState("");
  const [caseType, setCaseType] = useState("");
  const [status, setStatus]     = useState("");
  const [jur, setJur]           = useState("");

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["case-files", caseType, status, jur],
    queryFn:  () => api.getCaseFiles({
      caseType:          caseType  || undefined,
      status:            status    || undefined,
      jurisdictionLevel: jur       || undefined,
    }),
  });

  const is401 = (error as ApiError)?.status === 401;

  const cases = data?.cases ?? [];

  const filtered = useMemo(() => {
    if (!search) return cases;
    const q = search.toLowerCase();
    return cases.filter((c) =>
      c.caseNumber.toLowerCase().includes(q) ||
      c.title.toLowerCase().includes(q) ||
      (c.matterType ?? "").toLowerCase().includes(q) ||
      (c.notes ?? "").toLowerCase().includes(q) ||
      (c.linkedDocumentRef ?? "").toLowerCase().includes(q)
    );
  }, [cases, search]);

  // Stats
  const stats = useMemo(() => ({
    total:   cases.length,
    open:    cases.filter((c) => c.status === "open").length,
    active:  cases.filter((c) => c.status === "active").length,
    closed:  cases.filter((c) => c.status === "closed" || c.status === "archived").length,
  }), [cases]);

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <FolderOpen className="h-5 w-5 text-primary" />
          <h1 className="text-xl font-semibold text-foreground">Case File Registry</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Every document, notice, order, and pipeline record is assigned an auto-generated case number the moment it is created. Use this registry to look up, filter, and update case status.
        </p>
      </div>

      {is401 && <SessionExpiredBanner />}

      {/* Stats bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        {[
          { label: "Total Cases", value: stats.total, color: "text-foreground" },
          { label: "Open",        value: stats.open,   color: "text-blue-700" },
          { label: "Active",      value: stats.active, color: "text-emerald-700" },
          { label: "Closed",      value: stats.closed, color: "text-gray-500" },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-card border border-border rounded-lg px-4 py-3">
            <div className={cn("text-2xl font-bold tabular-nums", color)}>{value}</div>
            <div className="text-xs text-muted-foreground mt-0.5">{label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-card border border-border rounded-lg p-4 mb-5 space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            type="search"
            placeholder="Search case number, title, matter type, document ref…"
            className="pl-9 text-sm"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          {/* Case type filter */}
          <div className="flex flex-wrap gap-1">
            <button
              onClick={() => setCaseType("")}
              className={cn("px-2.5 py-1 rounded-full text-xs border font-medium transition-colors",
                caseType === "" ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:text-foreground")}
            >
              All types
            </button>
            {CASE_TYPES.map((t) => (
              <button
                key={t}
                onClick={() => setCaseType(caseType === t ? "" : t)}
                className={cn("px-2.5 py-1 rounded-full text-xs border font-medium transition-colors",
                  caseType === t ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:text-foreground")}
              >
                {CASE_TYPE_LABELS[t] ?? t}
              </button>
            ))}
          </div>

          <div className="w-px bg-border self-stretch mx-1 hidden sm:block" />

          {/* Status filter */}
          <div className="flex flex-wrap gap-1">
            <button
              onClick={() => setStatus("")}
              className={cn("px-2.5 py-1 rounded-full text-xs border font-medium transition-colors",
                status === "" ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:text-foreground")}
            >
              All statuses
            </button>
            {STATUSES.map((s) => (
              <button
                key={s}
                onClick={() => setStatus(status === s ? "" : s)}
                className={cn("px-2.5 py-1 rounded-full text-xs border font-medium transition-colors",
                  status === s ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:text-foreground")}
              >
                {STATUS_CONFIG[s]?.label ?? s}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Results */}
      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-16 rounded-lg bg-muted/40 animate-pulse" />
          ))}
        </div>
      ) : error && !is401 ? (
        <div className="flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-4 text-sm text-red-800">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <div>
            <span className="font-semibold">Could not load case files. </span>
            <button onClick={() => refetch()} className="underline">Retry</button>
          </div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <FileText className="h-10 w-10 text-muted-foreground/40 mb-3" />
          <div className="text-sm font-medium text-muted-foreground">No case files found</div>
          <div className="text-xs text-muted-foreground/70 mt-1">
            {cases.length > 0 ? "Try adjusting your search or filters." : "Case files are created automatically when documents are generated."}
          </div>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs text-muted-foreground">
              Showing <span className="font-semibold text-foreground">{filtered.length}</span> of{" "}
              <span className="font-semibold text-foreground">{cases.length}</span> case files
            </p>
            <button
              onClick={() => refetch()}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <RefreshCw className="h-3 w-3" />
              Refresh
            </button>
          </div>

          <div className="space-y-2">
            {filtered.map((cf) => (
              <CaseRow key={cf.id} cf={cf} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
