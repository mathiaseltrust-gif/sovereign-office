import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getCurrentBearerToken } from "@/components/auth-provider";
import { BookOpen, Plus, X, Edit2, Check, Brain, Hash, Clock, Tag } from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface JournalEntry {
  id: number;
  entryNumber: string;
  userId: number;
  title: string | null;
  content: string;
  mood: string | null;
  tags: string[];
  kiConversationId: number | null;
  createdAt: string;
  updatedAt: string;
}

interface MemoryStatus {
  journalEntries: number;
  companionMemoryEntries: number;
  memoryPipelineActive: boolean;
  recentEntries: { entryNumber: string; title: string | null; createdAt: string }[];
  status: string;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const MOODS = [
  { value: "reflective",  label: "Reflective",  color: "bg-blue-500/20 text-blue-300 border-blue-500/30" },
  { value: "grateful",    label: "Grateful",    color: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30" },
  { value: "determined",  label: "Determined",  color: "bg-amber-500/20 text-amber-300 border-amber-500/30" },
  { value: "grounded",    label: "Grounded",    color: "bg-green-600/20 text-green-300 border-green-600/30" },
  { value: "concerned",   label: "Concerned",   color: "bg-orange-500/20 text-orange-300 border-orange-500/30" },
  { value: "at_peace",    label: "At Peace",    color: "bg-sky-500/20 text-sky-300 border-sky-500/30" },
  { value: "seeking",     label: "Seeking",     color: "bg-violet-500/20 text-violet-300 border-violet-500/30" },
  { value: "celebratory", label: "Celebratory", color: "bg-pink-500/20 text-pink-300 border-pink-500/30" },
  { value: "processing",  label: "Processing",  color: "bg-slate-500/20 text-slate-300 border-slate-500/30" },
];

function moodStyle(mood: string | null): string {
  return MOODS.find(m => m.value === mood)?.color ?? "bg-muted text-muted-foreground";
}
function moodLabel(mood: string | null): string {
  return MOODS.find(m => m.value === mood)?.label ?? (mood ?? "");
}

// ── Auth ──────────────────────────────────────────────────────────────────────

function authHeaders() {
  return { Authorization: `Bearer ${getCurrentBearerToken() ?? ""}` };
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    year: "numeric", month: "long", day: "numeric",
  });
}
function formatDateTime(dateStr: string): string {
  return new Date(dateStr).toLocaleString("en-US", {
    year: "numeric", month: "short", day: "numeric",
    hour: "numeric", minute: "2-digit",
  });
}

// ── API ───────────────────────────────────────────────────────────────────────

async function fetchEntries(): Promise<{ entries: JournalEntry[]; total: number }> {
  const r = await fetch("/api/journal", { headers: authHeaders() });
  if (!r.ok) throw new Error("Failed to load journal entries");
  return r.json();
}

async function fetchMemoryStatus(): Promise<MemoryStatus> {
  const r = await fetch("/api/journal/memory/status", { headers: authHeaders() });
  if (!r.ok) throw new Error("Failed to load memory status");
  return r.json();
}

async function createEntry(data: { title?: string; content: string; mood?: string; tags?: string[] }): Promise<JournalEntry> {
  const r = await fetch("/api/journal", {
    method: "POST",
    headers: { ...authHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!r.ok) throw new Error("Failed to create entry");
  return r.json();
}

async function updateEntry(id: number, data: { title?: string; content?: string; mood?: string; tags?: string[] }): Promise<JournalEntry> {
  const r = await fetch(`/api/journal/${id}`, {
    method: "PUT",
    headers: { ...authHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!r.ok) throw new Error("Failed to update entry");
  return r.json();
}

async function deleteEntry(id: number): Promise<void> {
  const r = await fetch(`/api/journal/${id}`, { method: "DELETE", headers: authHeaders() });
  if (!r.ok) throw new Error("Failed to delete entry");
}

// ── Compose / Edit Form ───────────────────────────────────────────────────────

interface ComposeFormProps {
  initial?: JournalEntry;
  onSave: () => void;
  onCancel: () => void;
}

function ComposeForm({ initial, onSave, onCancel }: ComposeFormProps) {
  const qc = useQueryClient();
  const isEdit = !!initial;
  const [title, setTitle] = useState(initial?.title ?? "");
  const [content, setContent] = useState(initial?.content ?? "");
  const [mood, setMood] = useState(initial?.mood ?? "");
  const [tagInput, setTagInput] = useState(initial?.tags?.join(", ") ?? "");
  const [error, setError] = useState("");

  const createMutation = useMutation({
    mutationFn: createEntry,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["journal"] }); qc.invalidateQueries({ queryKey: ["journal-memory"] }); onSave(); },
    onError: () => setError("Could not save entry. Please try again."),
  });

  const updateMutation = useMutation({
    mutationFn: (data: Parameters<typeof updateEntry>[1]) => updateEntry(initial!.id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["journal"] }); qc.invalidateQueries({ queryKey: ["journal-memory"] }); onSave(); },
    onError: () => setError("Could not update entry."),
  });

  const isPending = createMutation.isPending || updateMutation.isPending;

  function handleSubmit() {
    if (!content.trim()) { setError("Please write something before saving."); return; }
    setError("");
    const tags = tagInput.split(",").map(t => t.trim()).filter(Boolean);
    const data = { title: title.trim() || undefined, content: content.trim(), mood: mood || undefined, tags };
    if (isEdit) updateMutation.mutate(data);
    else createMutation.mutate(data);
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Title <span className="text-muted-foreground/50">(optional)</span></label>
        <Input
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="Name this entry…"
          className="mt-1"
        />
      </div>
      <div>
        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Entry *</label>
        <textarea
          value={content}
          onChange={e => setContent(e.target.value)}
          placeholder="Write your reflection, insight, memory, or record…"
          rows={10}
          className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Mood</label>
          <Select value={mood} onValueChange={setMood}>
            <SelectTrigger className="mt-1"><SelectValue placeholder="Select mood…" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No mood</SelectItem>
              {MOODS.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Tags <span className="text-muted-foreground/50">(comma-separated)</span></label>
          <Input
            value={tagInput}
            onChange={e => setTagInput(e.target.value)}
            placeholder="land, sovereignty, family…"
            className="mt-1"
          />
        </div>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="flex gap-2 pt-2">
        <Button onClick={handleSubmit} disabled={isPending} className="gap-2">
          <Check size={14} />
          {isPending ? "Saving to memory…" : isEdit ? "Update Entry" : "Save Journal Entry"}
        </Button>
        <Button variant="outline" onClick={onCancel} disabled={isPending}>Cancel</Button>
      </div>
      {!isEdit && (
        <p className="text-xs text-muted-foreground flex items-center gap-1.5">
          <Brain size={11} />
          This entry will be automatically synced to COMPANION's long-term memory.
        </p>
      )}
    </div>
  );
}

// ── Entry Detail View ─────────────────────────────────────────────────────────

interface EntryDetailProps {
  entry: JournalEntry;
  onEdit: () => void;
  onDelete: () => void;
  onClose: () => void;
}

function EntryDetail({ entry, onEdit, onDelete, onClose }: EntryDetailProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <Badge variant="outline" className="text-xs font-mono text-rose-600/80 border-rose-500/30">
              <Hash size={10} className="mr-1" />{entry.entryNumber}
            </Badge>
            {entry.mood && (
              <Badge className={`text-xs border ${moodStyle(entry.mood)}`}>{moodLabel(entry.mood)}</Badge>
            )}
            {entry.kiConversationId && (
              <Badge className="text-xs bg-violet-500/10 text-violet-400 border-violet-500/20 border">
                <Brain size={9} className="mr-1" />In Memory
              </Badge>
            )}
          </div>
          {entry.title && <h2 className="text-xl font-serif font-bold">{entry.title}</h2>}
          <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
            <Clock size={10} />{formatDateTime(entry.createdAt)}
            {entry.updatedAt !== entry.createdAt && ` · Edited ${formatDateTime(entry.updatedAt)}`}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button size="sm" variant="outline" onClick={onEdit} className="gap-1 text-xs">
            <Edit2 size={12} /> Edit
          </Button>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X size={16} />
          </button>
        </div>
      </div>

      {entry.tags && entry.tags.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <Tag size={12} className="text-muted-foreground" />
          {entry.tags.map(t => (
            <Badge key={t} variant="secondary" className="text-xs">{t}</Badge>
          ))}
        </div>
      )}

      <div className="prose prose-sm dark:prose-invert max-w-none">
        <div className="whitespace-pre-wrap text-sm leading-relaxed border-l-2 border-muted pl-4">
          {entry.content}
        </div>
      </div>

      <div className="pt-4 border-t flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          {entry.kiConversationId
            ? "✓ This entry lives in COMPANION's memory."
            : "This entry is not yet in COMPANION's memory."}
        </p>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => { if (confirm(`Delete entry ${entry.entryNumber}? This will also remove it from COMPANION's memory.`)) onDelete(); }}
          className="text-xs text-destructive hover:text-destructive"
        >
          Delete Entry
        </Button>
      </div>
    </div>
  );
}

// ── Memory Status Panel ───────────────────────────────────────────────────────

function MemoryStatusPanel() {
  const { data, isLoading } = useQuery({ queryKey: ["journal-memory"], queryFn: fetchMemoryStatus });

  return (
    <Card className="border-violet-500/20 bg-violet-500/5">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Brain size={14} className="text-violet-400" />
          <CardTitle className="text-xs uppercase tracking-widest text-violet-300">COMPANION Memory Pipeline</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-16" />
        ) : data ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Journal entries</span>
              <span className="font-mono font-bold">{data.journalEntries}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Entries in COMPANION memory</span>
              <span className="font-mono font-bold text-violet-400">{data.companionMemoryEntries}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Memory pipeline</span>
              <span className={`font-semibold ${data.memoryPipelineActive ? "text-emerald-400" : "text-destructive"}`}>
                {data.memoryPipelineActive ? "● Active" : "○ Inactive"}
              </span>
            </div>
            {data.recentEntries.length > 0 && (
              <div className="pt-2 border-t">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1.5">Recent in memory</p>
                {data.recentEntries.map(e => (
                  <div key={e.entryNumber} className="flex items-center justify-between text-[11px] py-0.5">
                    <span className="font-mono text-violet-400">{e.entryNumber}</span>
                    <span className="text-muted-foreground truncate max-w-[140px] ml-2">{e.title ?? "Untitled"}</span>
                  </div>
                ))}
              </div>
            )}
            <p className="text-[10px] text-emerald-400/80 pt-1">{data.status}</p>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

// ── Main Journal Page ─────────────────────────────────────────────────────────

type ViewMode = "list" | "detail" | "compose" | "edit";

export default function JournalPage() {
  const qc = useQueryClient();
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [selectedEntry, setSelectedEntry] = useState<JournalEntry | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterMood, setFilterMood] = useState("all");

  const { data, isLoading } = useQuery({ queryKey: ["journal"], queryFn: fetchEntries });

  const deleteMutation = useMutation({
    mutationFn: deleteEntry,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["journal"] });
      qc.invalidateQueries({ queryKey: ["journal-memory"] });
      setSelectedEntry(null);
      setViewMode("list");
    },
  });

  const entries = data?.entries ?? [];

  const filteredEntries = useMemo(() => {
    return entries.filter(e => {
      if (filterMood !== "all" && e.mood !== filterMood) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          e.content.toLowerCase().includes(q) ||
          (e.title?.toLowerCase().includes(q) ?? false) ||
          e.entryNumber.toLowerCase().includes(q) ||
          e.tags?.some(t => t.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [entries, filterMood, searchQuery]);

  function openEntry(entry: JournalEntry) {
    setSelectedEntry(entry);
    setViewMode("detail");
  }

  function handleDeleteSelected() {
    if (selectedEntry) deleteMutation.mutate(selectedEntry.id);
  }

  return (
    <div data-testid="page-journal">
      <div className="mb-6 flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-serif font-bold text-foreground flex items-center gap-3">
            <BookOpen size={28} className="text-muted-foreground" />
            Sovereign Journal
          </h1>
          <p className="text-muted-foreground mt-1">
            Personal record of reflections, insights, and living memory — entries are automatically held by COMPANION
          </p>
        </div>
        {viewMode !== "compose" && (
          <Button onClick={() => { setViewMode("compose"); setSelectedEntry(null); }} className="gap-2">
            <Plus size={16} /> New Entry
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ── Left: Entry list ── */}
        <div className="lg:col-span-1 space-y-4">
          {/* Search + filter */}
          <div className="space-y-2">
            <Input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search entries…"
              className="text-sm"
            />
            <Select value={filterMood} onValueChange={setFilterMood}>
              <SelectTrigger className="text-sm"><SelectValue placeholder="Filter by mood" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All moods</SelectItem>
                {MOODS.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {/* Entries list */}
          <div className="space-y-2">
            {isLoading ? (
              [...Array(4)].map((_, i) => <Skeleton key={i} className="h-20" />)
            ) : filteredEntries.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground">
                <BookOpen size={32} className="mx-auto mb-2 opacity-30" />
                <p className="text-sm">{entries.length === 0 ? "No journal entries yet." : "No entries match your search."}</p>
                {entries.length === 0 && (
                  <p className="text-xs mt-1">Your first entry will be held in COMPANION's memory.</p>
                )}
              </div>
            ) : (
              filteredEntries.map(entry => (
                <button
                  key={entry.id}
                  onClick={() => openEntry(entry)}
                  className={`w-full text-left p-3 rounded-lg border transition-colors ${selectedEntry?.id === entry.id ? "bg-primary/10 border-primary/30" : "hover:bg-muted/40 border-border"}`}
                >
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <span className="text-[10px] font-mono text-muted-foreground">{entry.entryNumber}</span>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {entry.mood && (
                        <span className={`text-[9px] px-1.5 py-0.5 rounded border ${moodStyle(entry.mood)}`}>
                          {moodLabel(entry.mood)}
                        </span>
                      )}
                      {entry.kiConversationId && (
                        <Brain size={10} className="text-violet-400" />
                      )}
                    </div>
                  </div>
                  <p className="text-sm font-medium truncate">{entry.title ?? "Untitled Reflection"}</p>
                  <p className="text-xs text-muted-foreground truncate mt-0.5 leading-snug">
                    {entry.content.slice(0, 80)}{entry.content.length > 80 ? "…" : ""}
                  </p>
                  <p className="text-[10px] text-muted-foreground/60 mt-1">{formatDate(entry.createdAt)}</p>
                </button>
              ))
            )}
          </div>

          {/* Stats */}
          {entries.length > 0 && (
            <p className="text-xs text-muted-foreground text-center">
              {filteredEntries.length} of {entries.length} {entries.length === 1 ? "entry" : "entries"}
            </p>
          )}
        </div>

        {/* ── Right: Detail / Compose / Memory Status ── */}
        <div className="lg:col-span-2 space-y-4">
          {viewMode === "compose" ? (
            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="text-base font-serif">New Journal Entry</CardTitle>
                <p className="text-xs text-muted-foreground">An entry number will be assigned automatically (e.g. JE-2026-0001)</p>
              </CardHeader>
              <CardContent>
                <ComposeForm
                  onSave={() => setViewMode("list")}
                  onCancel={() => setViewMode("list")}
                />
              </CardContent>
            </Card>
          ) : viewMode === "edit" && selectedEntry ? (
            <Card>
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base font-serif">Edit Entry</CardTitle>
                  <span className="text-xs font-mono text-muted-foreground">{selectedEntry.entryNumber}</span>
                </div>
              </CardHeader>
              <CardContent>
                <ComposeForm
                  initial={selectedEntry}
                  onSave={() => { qc.invalidateQueries({ queryKey: ["journal"] }); setViewMode("list"); setSelectedEntry(null); }}
                  onCancel={() => setViewMode("detail")}
                />
              </CardContent>
            </Card>
          ) : viewMode === "detail" && selectedEntry ? (
            <Card>
              <CardContent className="pt-6">
                <EntryDetail
                  entry={selectedEntry}
                  onEdit={() => setViewMode("edit")}
                  onDelete={handleDeleteSelected}
                  onClose={() => { setViewMode("list"); setSelectedEntry(null); }}
                />
              </CardContent>
            </Card>
          ) : (
            <Card className="flex items-center justify-center h-48 text-muted-foreground border-dashed">
              <div className="text-center">
                <BookOpen size={28} className="mx-auto mb-2 opacity-20" />
                <p className="text-sm">Select an entry to read, or start a new one.</p>
              </div>
            </Card>
          )}

          {/* Memory Status Panel */}
          <MemoryStatusPanel />
        </div>
      </div>
    </div>
  );
}
