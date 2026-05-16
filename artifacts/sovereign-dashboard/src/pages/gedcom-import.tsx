import { useState, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getCurrentBearerToken } from "@/components/auth-provider";
import {
  Upload, FileText, CheckCircle, XCircle, AlertTriangle,
  ChevronDown, ChevronUp, Users, GitMerge, Search, Filter,
  Trash2, RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";

async function authFetch(url: string, opts: RequestInit = {}): Promise<Response> {
  const token = getCurrentBearerToken();
  return fetch(url, {
    ...opts,
    headers: { ...(opts.headers ?? {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  });
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface ImportBatch {
  id: number;
  filename: string;
  importedBy: number | null;
  recordCount: number;
  approvedCount: number;
  rejectedCount: number;
  pendingCount: number;
  status: string;
  notes: string | null;
  createdAt: string;
}

interface StagedRecord {
  id: number;
  batchId: number | null;
  gedcomId: string | null;
  fullName: string;
  givenName: string | null;
  surname: string | null;
  birthDate: string | null;
  birthYear: number | null;
  birthPlace: string | null;
  deathDate: string | null;
  deathYear: number | null;
  deathPlace: string | null;
  gender: string | null;
  fatherGedcomId: string | null;
  motherGedcomId: string | null;
  spouseGedcomIds: string[];
  childrenGedcomIds: string[];
  censusLabels: string[];
  sourceRecords: string[];
  notes: string | null;
  confidenceScore: number | null;
  matchType: string;
  matchedAncestorId: number | null;
  matchedAncestorName: string | null;
  duplicateGroupId: string | null;
  status: string;
  createdAt: string;
}

// ── Match type config ─────────────────────────────────────────────────────────

const MATCH_CONFIG: Record<string, { label: string; color: string; bg: string; icon: React.ComponentType<{ className?: string }>; description: string }> = {
  exact:    { label: "Exact Match",    color: "text-red-700 dark:text-red-300",    bg: "bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-800",    icon: XCircle,      description: "Same name + birth year — likely duplicate" },
  probable: { label: "Probable Match", color: "text-amber-700 dark:text-amber-300", bg: "bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800", icon: AlertTriangle, description: "Similar name + close birth year — review before approving" },
  possible: { label: "Possible Match", color: "text-yellow-700 dark:text-yellow-300", bg: "bg-yellow-50 dark:bg-yellow-950/40 border-yellow-200 dark:border-yellow-800", icon: AlertTriangle, description: "Partial name match — may be a different person" },
  new:      { label: "New Record",     color: "text-green-700 dark:text-green-300",  bg: "bg-green-50 dark:bg-green-950/40 border-green-200 dark:border-green-800",  icon: CheckCircle,  description: "No match found — safe to approve" },
};

// ── Dropzone ──────────────────────────────────────────────────────────────────

function GedcomDropzone({ onImport, isImporting }: { onImport: (file: File) => void; isImporting: boolean }) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) onImport(file);
  }, [onImport]);

  return (
    <div
      onClick={() => inputRef.current?.click()}
      onDragOver={e => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      className={`
        border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all
        ${dragging ? "border-primary bg-primary/5 scale-[1.01]" : "border-border hover:border-primary/50 hover:bg-muted/30"}
        ${isImporting ? "pointer-events-none opacity-60" : ""}
      `}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".ged"
        className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) onImport(f); }}
      />
      <div className="flex flex-col items-center gap-3">
        {isImporting ? (
          <RefreshCw className="h-10 w-10 text-primary animate-spin" />
        ) : (
          <Upload className="h-10 w-10 text-muted-foreground" />
        )}
        <div>
          <p className="text-base font-semibold">
            {isImporting ? "Parsing & staging records…" : "Drop your GEDCOM file here"}
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            {isImporting ? "This may take a moment for large trees." : "Drag & drop a .ged file exported from Ancestry, FamilySearch, or any GEDCOM-compatible app"}
          </p>
        </div>
        {!isImporting && (
          <Button variant="outline" size="sm" className="mt-1" onClick={e => { e.stopPropagation(); inputRef.current?.click(); }}>
            <FileText className="h-4 w-4 mr-2" /> Browse for .ged file
          </Button>
        )}
        <p className="text-[11px] text-muted-foreground">Supports GEDCOM 5.5 / 5.5.1 — UTF-8, ANSEL, and ASCII encodings — max 25 MB</p>
      </div>
    </div>
  );
}

// ── Staged record row ─────────────────────────────────────────────────────────

function StagedRow({ record, onApprove, onReject, approving, rejecting }: {
  record: StagedRecord;
  onApprove: (id: number) => void;
  onReject: (id: number) => void;
  approving: boolean;
  rejecting: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const cfg = MATCH_CONFIG[record.matchType] ?? MATCH_CONFIG.new;
  const Icon = cfg.icon;
  const isActioned = record.status !== "pending";

  return (
    <div className={`rounded-lg border transition-all ${isActioned ? "opacity-50" : ""} ${cfg.bg}`}>
      <div className="flex items-center gap-3 px-4 py-3">
        {/* Match badge */}
        <Icon className={`h-4 w-4 shrink-0 ${cfg.color}`} />

        {/* Name + years */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-sm truncate">{record.fullName}</span>
            {record.birthYear || record.deathYear ? (
              <span className="text-xs text-muted-foreground font-mono">
                {record.birthYear ?? "?"}–{record.deathYear ?? ""}
              </span>
            ) : null}
            {record.gender && (
              <span className="text-[10px] text-muted-foreground capitalize">{record.gender}</span>
            )}
          </div>
          <div className="flex items-center gap-2 flex-wrap mt-0.5">
            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${cfg.color} ${cfg.bg}`}>
              {cfg.label}
            </span>
            {record.matchedAncestorName && (
              <span className="text-[10px] text-muted-foreground">
                → matches <span className="font-medium">{record.matchedAncestorName}</span>
              </span>
            )}
            {record.censusLabels.length > 0 && record.censusLabels.map(l => (
              <span key={l} className="text-[9px] px-1 py-0.5 rounded bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-700">
                {l}
              </span>
            ))}
            {record.status !== "pending" && (
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${record.status === "approved" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                {record.status.toUpperCase()}
              </span>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 text-muted-foreground"
            onClick={() => setExpanded(x => !x)}
          >
            {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </Button>
          {record.status === "pending" && (
            <>
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs border-red-300 text-red-600 hover:bg-red-50"
                disabled={rejecting}
                onClick={() => onReject(record.id)}
              >
                <XCircle className="h-3 w-3 mr-1" />
                Skip
              </Button>
              <Button
                size="sm"
                className="h-7 text-xs bg-green-600 hover:bg-green-700 text-white"
                disabled={approving}
                onClick={() => onApprove(record.id)}
              >
                <CheckCircle className="h-3 w-3 mr-1" />
                Approve
              </Button>
            </>
          )}
        </div>
      </div>

      {expanded && (
        <div className="px-4 pb-4 pt-0 grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-2 text-xs border-t border-inherit mt-1 pt-3">
          {record.birthDate && <div><span className="text-muted-foreground">Birth: </span>{record.birthDate}{record.birthPlace ? `, ${record.birthPlace}` : ""}</div>}
          {record.deathDate && <div><span className="text-muted-foreground">Death: </span>{record.deathDate}{record.deathPlace ? `, ${record.deathPlace}` : ""}</div>}
          {record.fatherGedcomId && <div><span className="text-muted-foreground">Father ID: </span><span className="font-mono">{record.fatherGedcomId}</span></div>}
          {record.motherGedcomId && <div><span className="text-muted-foreground">Mother ID: </span><span className="font-mono">{record.motherGedcomId}</span></div>}
          {record.spouseGedcomIds.length > 0 && <div><span className="text-muted-foreground">Spouses: </span>{record.spouseGedcomIds.length}</div>}
          {record.childrenGedcomIds.length > 0 && <div><span className="text-muted-foreground">Children: </span>{record.childrenGedcomIds.length}</div>}
          {record.gedcomId && <div><span className="text-muted-foreground">GEDCOM ID: </span><span className="font-mono">{record.gedcomId}</span></div>}
          {record.sourceRecords.length > 0 && (
            <div className="col-span-full"><span className="text-muted-foreground">Sources: </span>{record.sourceRecords.slice(0, 2).join("; ")}{record.sourceRecords.length > 2 ? ` +${record.sourceRecords.length - 2} more` : ""}</div>
          )}
          {record.notes && (
            <div className="col-span-full"><span className="text-muted-foreground">Notes: </span><span className="line-clamp-2">{record.notes}</span></div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function GedcomImportPage() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [selectedBatchId, setSelectedBatchId] = useState<number | null>(null);
  const [filterMatch, setFilterMatch] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("pending");
  const [search, setSearch] = useState("");
  const [isImporting, setIsImporting] = useState<{ filename: string } | null>(null);

  // ── Queries ─────────────────────────────────────────────────────────────────
  const { data: batches = [], isLoading: batchesLoading } = useQuery<ImportBatch[]>({
    queryKey: ["gedcom-batches"],
    queryFn: () => authFetch("/api/ancestry/gedcom/batches").then((r: Response) => r.json() as Promise<ImportBatch[]>),
  });

  const { data: staged = [], isLoading: stagedLoading } = useQuery<StagedRecord[]>({
    queryKey: ["gedcom-staging", selectedBatchId, filterMatch, filterStatus],
    queryFn: () => {
      const params = new URLSearchParams();
      if (selectedBatchId) params.set("batchId", String(selectedBatchId));
      if (filterMatch !== "all") params.set("matchType", filterMatch);
      if (filterStatus !== "all") params.set("status", filterStatus);
      return authFetch(`/api/ancestry/gedcom/staging?${params}`).then((r: Response) => r.json() as Promise<StagedRecord[]>);
    },
    enabled: selectedBatchId !== null || batches.length > 0,
  });

  // ── Mutations ────────────────────────────────────────────────────────────────
  const approveMut = useMutation({
    mutationFn: (id: number) => authFetch(`/api/ancestry/gedcom/staging/${id}/approve`, { method: "POST" }).then((r: Response) => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["gedcom-staging"] }); qc.invalidateQueries({ queryKey: ["gedcom-batches"] }); },
    onError: () => toast({ title: "Approve failed", variant: "destructive" }),
  });

  const rejectMut = useMutation({
    mutationFn: (id: number) => authFetch(`/api/ancestry/gedcom/staging/${id}/reject`, { method: "POST" }).then((r: Response) => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["gedcom-staging"] }); qc.invalidateQueries({ queryKey: ["gedcom-batches"] }); },
    onError: () => toast({ title: "Skip failed", variant: "destructive" }),
  });

  interface BulkApproveResult { approved: number }
  const bulkApproveMut = useMutation<BulkApproveResult, Error, string[]>({
    mutationFn: (matchTypes: string[]) =>
      authFetch("/api/ancestry/gedcom/staging/bulk-approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ batchId: selectedBatchId, matchTypes }),
      }).then((r: Response) => r.json() as Promise<BulkApproveResult>),
    onSuccess: (data: BulkApproveResult) => {
      toast({ title: `Approved ${data.approved} records` });
      qc.invalidateQueries({ queryKey: ["gedcom-staging"] });
      qc.invalidateQueries({ queryKey: ["gedcom-batches"] });
    },
    onError: () => toast({ title: "Bulk approve failed", variant: "destructive" }),
  });

  const deleteBatchMut = useMutation({
    mutationFn: (id: number) => authFetch(`/api/ancestry/gedcom/batches/${id}`, { method: "DELETE" }).then((r: Response) => r.json()),
    onSuccess: () => {
      if (selectedBatchId) setSelectedBatchId(null);
      qc.invalidateQueries({ queryKey: ["gedcom-batches"] });
      qc.invalidateQueries({ queryKey: ["gedcom-staging"] });
    },
  });

  // ── File import ──────────────────────────────────────────────────────────────
  const handleImport = async (file: File) => {
    setIsImporting({ filename: file.name });
    try {
      const formData = new FormData();
      formData.append("gedcom", file);
      const res = await authFetch("/api/ancestry/gedcom/import", { method: "POST", body: formData });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "Import failed");
      }
      const data = await res.json();
      toast({
        title: `Import complete — ${data.totalIndividuals} individuals staged`,
        description: `New: ${data.matchSummary.new} · Possible: ${data.matchSummary.possible} · Probable: ${data.matchSummary.probable} · Exact duplicate: ${data.matchSummary.exact}`,
      });
      await qc.invalidateQueries({ queryKey: ["gedcom-batches"] });
      setSelectedBatchId(data.batchId);
      setFilterStatus("pending");
      setFilterMatch("all");
    } catch (e: unknown) {
      toast({ title: "Import failed", description: e instanceof Error ? e.message : "Unknown error", variant: "destructive" });
    } finally {
      setIsImporting(null);
    }
  };

  // ── Derived ───────────────────────────────────────────────────────────────────
  const activeBatch = batches.find(b => b.id === selectedBatchId);

  const filtered = staged.filter(r => {
    if (search) {
      const q = search.toLowerCase();
      if (!r.fullName.toLowerCase().includes(q) &&
          !r.birthPlace?.toLowerCase().includes(q) &&
          !r.deathPlace?.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const newCount   = staged.filter(r => r.matchType === "new"      && r.status === "pending").length;
  const possCount  = staged.filter(r => r.matchType === "possible"  && r.status === "pending").length;
  const probCount  = staged.filter(r => r.matchType === "probable"  && r.status === "pending").length;
  const exactCount = staged.filter(r => r.matchType === "exact"     && r.status === "pending").length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-serif font-bold flex items-center gap-2">
          <GitMerge className="h-6 w-6 text-primary" />
          GEDCOM Import
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Import your Ancestry tree export. All records stage for review before entering the official ancestor database.
        </p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">

        {/* Left: upload + batch list */}
        <div className="xl:col-span-1 space-y-4">
          <GedcomDropzone onImport={handleImport} isImporting={!!isImporting} />

          {isImporting && (
            <p className="text-xs text-center text-muted-foreground animate-pulse">
              Staging "{isImporting.filename}"…
            </p>
          )}

          {/* Batch history */}
          <Card>
            <CardHeader className="pb-2 border-b">
              <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground font-semibold flex items-center gap-2">
                <FileText className="h-3.5 w-3.5" /> Import History
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {batchesLoading ? (
                <div className="p-4 space-y-2">{[1,2].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div>
              ) : batches.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-6">No imports yet</p>
              ) : (
                <div className="divide-y">
                  {batches.map(b => (
                    <button
                      key={b.id}
                      onClick={() => setSelectedBatchId(b.id)}
                      className={`w-full text-left px-4 py-3 transition-colors hover:bg-muted/40 ${selectedBatchId === b.id ? "bg-muted/60" : ""}`}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-xs font-medium truncate max-w-[140px]">{b.filename}</span>
                        <span className="text-[10px] text-muted-foreground">{b.recordCount} ppl</span>
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[9px] text-green-600">{b.approvedCount} approved</span>
                        <span className="text-[9px] text-muted-foreground">{b.pendingCount} pending</span>
                        {b.rejectedCount > 0 && <span className="text-[9px] text-gray-400">{b.rejectedCount} skipped</span>}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Help */}
          <Card className="border-blue-200 dark:border-blue-800">
            <CardContent className="p-4 text-xs space-y-2 text-muted-foreground">
              <p className="font-semibold text-foreground text-[11px] uppercase tracking-wider">How to export from Ancestry</p>
              <ol className="space-y-1 list-decimal list-inside text-[11px]">
                <li>Open your tree on Ancestry.com</li>
                <li>Tree Settings → Manage your tree</li>
                <li>Click <strong>Export tree</strong></li>
                <li>Download the .ged GEDCOM file</li>
                <li>Upload it here</li>
              </ol>
            </CardContent>
          </Card>
        </div>

        {/* Right: staging review */}
        <div className="xl:col-span-3 space-y-4">
          {!selectedBatchId && batches.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-center gap-4 text-muted-foreground">
              <Upload className="h-12 w-12 opacity-30" />
              <p className="text-sm">Upload a GEDCOM file to begin</p>
            </div>
          ) : (
            <>
              {/* Summary cards */}
              {activeBatch && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { label: "New Records",     count: newCount,   color: "text-green-600",  bg: "bg-green-50 dark:bg-green-950/30" },
                    { label: "Possible Match",  count: possCount,  color: "text-yellow-600", bg: "bg-yellow-50 dark:bg-yellow-950/30" },
                    { label: "Probable Match",  count: probCount,  color: "text-amber-600",  bg: "bg-amber-50 dark:bg-amber-950/30" },
                    { label: "Exact Duplicate", count: exactCount, color: "text-red-600",    bg: "bg-red-50 dark:bg-red-950/30" },
                  ].map(s => (
                    <Card key={s.label} className="border-none shadow-sm">
                      <CardContent className={`p-4 ${s.bg} rounded-lg`}>
                        <p className={`text-2xl font-bold ${s.color}`}>{s.count}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}

              {/* Bulk actions + filters */}
              <div className="flex flex-wrap items-center gap-2">
                {newCount > 0 && (
                  <Button
                    size="sm"
                    className="gap-1.5 bg-green-600 hover:bg-green-700 text-white"
                    disabled={bulkApproveMut.isPending}
                    onClick={() => bulkApproveMut.mutate(["new"])}
                  >
                    <CheckCircle className="h-3.5 w-3.5" />
                    Approve all new ({newCount})
                  </Button>
                )}
                <div className="relative flex-1 min-w-[160px] max-w-xs">
                  <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    className="h-8 pl-8 text-xs"
                    placeholder="Search names, places…"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                  />
                </div>
                <Select value={filterMatch} onValueChange={setFilterMatch}>
                  <SelectTrigger className="h-8 text-xs w-36">
                    <Filter className="h-3 w-3 mr-1 text-muted-foreground" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All match types</SelectItem>
                    <SelectItem value="new">New only</SelectItem>
                    <SelectItem value="possible">Possible</SelectItem>
                    <SelectItem value="probable">Probable</SelectItem>
                    <SelectItem value="exact">Exact duplicate</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger className="h-8 text-xs w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="approved">Approved</SelectItem>
                    <SelectItem value="rejected">Skipped</SelectItem>
                    <SelectItem value="all">All statuses</SelectItem>
                  </SelectContent>
                </Select>
                {activeBatch && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 text-xs text-destructive"
                    onClick={() => { if (confirm("Delete this import batch and all its staged records?")) deleteBatchMut.mutate(activeBatch.id); }}
                  >
                    <Trash2 className="h-3.5 w-3.5 mr-1" /> Delete batch
                  </Button>
                )}
              </div>

              {/* Records list */}
              {stagedLoading ? (
                <div className="space-y-2">{[1,2,3,4,5].map(i => <Skeleton key={i} className="h-16 w-full rounded-lg" />)}</div>
              ) : filtered.length === 0 ? (
                <div className="text-center py-16 text-muted-foreground">
                  <Users className="h-8 w-8 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">No records match current filters</p>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">{filtered.length} record{filtered.length !== 1 ? "s" : ""}</p>
                  {filtered.map(r => (
                    <StagedRow
                      key={r.id}
                      record={r}
                      onApprove={id => approveMut.mutate(id)}
                      onReject={id => rejectMut.mutate(id)}
                      approving={approveMut.isPending && approveMut.variables === r.id}
                      rejecting={rejectMut.isPending && rejectMut.variables === r.id}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
