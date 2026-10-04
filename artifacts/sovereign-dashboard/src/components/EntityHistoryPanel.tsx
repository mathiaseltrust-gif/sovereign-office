import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, ChevronUp, Clock3, FileText, Plus, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useAuth, getCurrentBearerToken } from "@/components/auth-provider";
import { useToast } from "@/hooks/use-toast";

interface HistoryEntityLink {
  event_id: number;
  entity_type: string;
  entity_id: string;
  relationship_type: string;
}

interface HistoryDocumentLink {
  event_id: number;
  relationship_type: string;
  document_ref: string;
  title?: string | null;
  original_filename?: string | null;
  classification?: string | null;
  verification_state?: string | null;
}

interface HistoryEvent {
  id: number;
  event_ref: string;
  title: string;
  summary?: string | null;
  event_type: string;
  occurred_at?: string | null;
  occurred_end_at?: string | null;
  date_label?: string | null;
  date_precision: string;
  record_status: "asserted" | "documented" | "verified" | "disputed" | "superseded";
  source_type: string;
  source_summary?: string | null;
  sensitivity_level: string;
  entities: HistoryEntityLink[];
  documents: HistoryDocumentLink[];
}

const STATUS_CLASS: Record<string, string> = {
  asserted: "border-slate-300 text-slate-700 dark:text-slate-300",
  documented: "border-blue-300 text-blue-700 dark:text-blue-300",
  verified: "border-green-300 text-green-700 dark:text-green-300",
  disputed: "border-amber-300 text-amber-700 dark:text-amber-300",
  superseded: "border-muted-foreground/30 text-muted-foreground",
};

function displayDate(event: HistoryEvent) {
  if (event.date_label) return event.date_label;
  if (!event.occurred_at) return "Date not specified";
  const start = new Date(event.occurred_at).toLocaleDateString();
  if (!event.occurred_end_at) return start;
  return `${start} – ${new Date(event.occurred_end_at).toLocaleDateString()}`;
}

export function EntityHistoryPanel({
  entityType,
  entityId,
  title = "History",
  defaultOpen = false,
  allowMemberAdd = false,
}: {
  entityType: string;
  entityId: string | number;
  title?: string;
  defaultOpen?: boolean;
  allowMemberAdd?: boolean;
}) {
  const { activeRole } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [open, setOpen] = useState(defaultOpen);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({
    title: "",
    summary: "",
    occurredAt: "",
    dateLabel: "",
    recordStatus: "asserted",
    sourceSummary: "",
    documentRefs: "",
  });

  const elevated = ["officer", "trustee", "sovereign_admin", "admin"].includes(activeRole);
  const canAdd = elevated || allowMemberAdd;

  const key = ["sovereign-history", entityType, String(entityId)];
  const query = useQuery<{ events: HistoryEvent[] }>({
    queryKey: key,
    queryFn: async () => {
      const token = getCurrentBearerToken() ?? "";
      const params = new URLSearchParams({
        entityType,
        entityId: String(entityId),
        limit: "100",
      });
      const r = await fetch(`/api/history/events?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (r.status === 403) return { events: [] };
      if (!r.ok) throw new Error("History unavailable");
      return r.json();
    },
    enabled: open,
    staleTime: 30_000,
  });

  const addEvent = useMutation({
    mutationFn: async () => {
      const token = getCurrentBearerToken() ?? "";
      const documentRefs = form.documentRefs
        .split(/[\n,]+/)
        .map((value) => value.trim())
        .filter(Boolean);

      const r = await fetch("/api/history/events", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: form.title,
          summary: form.summary || null,
          occurredAt: form.occurredAt || null,
          dateLabel: form.dateLabel || null,
          datePrecision: form.occurredAt ? "day" : form.dateLabel ? "approximate" : "unknown",
          recordStatus: form.recordStatus,
          sourceType: documentRefs.length > 0 ? "document_supported" : "manual",
          sourceSummary: form.sourceSummary || null,
          entities: [{
            entityType,
            entityId: String(entityId),
            relationshipType: "subject",
          }],
          documentRefs,
        }),
      });
      if (!r.ok) {
        const body = await r.json().catch(() => ({})) as { error?: string };
        throw new Error(body.error ?? "Could not add history event.");
      }
      return r.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: key });
      setAdding(false);
      setForm({
        title: "",
        summary: "",
        occurredAt: "",
        dateLabel: "",
        recordStatus: "asserted",
        sourceSummary: "",
        documentRefs: "",
      });
      toast({ title: "History recorded", description: "The event was added to the chronological ledger." });
    },
    onError: (err: Error) => {
      toast({ title: "History not saved", description: err.message, variant: "destructive" });
    },
  });

  const events = query.data?.events ?? [];

  return (
    <div className="border rounded-md overflow-hidden">
      <div className="flex items-center justify-between gap-2 px-3 py-2.5 bg-muted/20">
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className="flex items-center gap-2 min-w-0 text-left"
        >
          <Clock3 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">{title}</span>
          {open && !query.isLoading && <Badge variant="outline" className="text-[9px]">{events.length}</Badge>}
        </button>
        <div className="flex items-center gap-1">
          {open && canAdd && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-7 px-2 text-[10px]"
              onClick={() => setAdding((value) => !value)}
            >
              {adding ? <X className="h-3 w-3 mr-1" /> : <Plus className="h-3 w-3 mr-1" />}
              {adding ? "Cancel" : "Add"}
            </Button>
          )}
          <button type="button" onClick={() => setOpen((value) => !value)} className="p-1 text-muted-foreground">
            {open ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </button>
        </div>
      </div>

      {open && (
        <div className="p-3 space-y-3">
          {adding && (
            <div className="rounded-md border bg-muted/10 p-3 space-y-2">
              <Input
                value={form.title}
                onChange={(e) => setForm((old) => ({ ...old, title: e.target.value }))}
                placeholder="What happened?"
                className="h-8 text-xs"
              />
              <Textarea
                value={form.summary}
                onChange={(e) => setForm((old) => ({ ...old, summary: e.target.value }))}
                placeholder="Brief description of the event and why it matters"
                rows={3}
                className="text-xs"
              />
              <div className="grid grid-cols-2 gap-2">
                <Input
                  type="date"
                  value={form.occurredAt}
                  onChange={(e) => setForm((old) => ({ ...old, occurredAt: e.target.value }))}
                  className="h-8 text-xs"
                />
                <Input
                  value={form.dateLabel}
                  onChange={(e) => setForm((old) => ({ ...old, dateLabel: e.target.value }))}
                  placeholder="or circa / date label"
                  className="h-8 text-xs"
                />
              </div>
              <select
                value={form.recordStatus}
                onChange={(e) => setForm((old) => ({ ...old, recordStatus: e.target.value }))}
                className="w-full h-8 rounded-md border bg-background px-2 text-xs"
              >
                <option value="asserted">Asserted</option>
                <option value="documented">Documented</option>
                <option value="verified">Verified</option>
                <option value="disputed">Disputed</option>
                <option value="superseded">Superseded</option>
              </select>
              <Input
                value={form.sourceSummary}
                onChange={(e) => setForm((old) => ({ ...old, sourceSummary: e.target.value }))}
                placeholder="Source / provenance note"
                className="h-8 text-xs"
              />
              <Input
                value={form.documentRefs}
                onChange={(e) => setForm((old) => ({ ...old, documentRefs: e.target.value }))}
                placeholder="Canonical document ref(s), e.g. DOC-2026-..."
                className="h-8 text-xs font-mono"
              />
              <Button
                type="button"
                size="sm"
                disabled={!form.title.trim() || addEvent.isPending}
                onClick={() => addEvent.mutate()}
                className="h-8 text-xs"
              >
                {addEvent.isPending ? "Saving…" : "Record event"}
              </Button>
            </div>
          )}

          {query.isLoading ? (
            <p className="text-xs text-muted-foreground">Loading history…</p>
          ) : query.error ? (
            <p className="text-xs text-muted-foreground">History is unavailable for this record.</p>
          ) : events.length === 0 ? (
            <p className="text-xs text-muted-foreground">No chronological history has been recorded for this record yet.</p>
          ) : (
            <div className="space-y-0">
              {events.map((event, index) => (
                <div key={event.id} className="relative pl-5 pb-4 last:pb-0">
                  {index < events.length - 1 && <div className="absolute left-[5px] top-3 bottom-0 w-px bg-border" />}
                  <div className="absolute left-0 top-1.5 h-2.5 w-2.5 rounded-full border-2 border-background bg-primary" />
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-[10px] font-mono text-muted-foreground">{displayDate(event)}</p>
                      <p className="text-xs font-semibold mt-0.5">{event.title}</p>
                    </div>
                    <Badge variant="outline" className={`text-[9px] shrink-0 capitalize ${STATUS_CLASS[event.record_status] ?? ""}`}>
                      {event.record_status}
                    </Badge>
                  </div>
                  {event.summary && <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">{event.summary}</p>}
                  {event.source_summary && <p className="text-[10px] text-muted-foreground mt-1">Source: {event.source_summary}</p>}
                  {event.documents?.length > 0 && (
                    <div className="mt-1.5 space-y-1">
                      {event.documents.map((doc) => (
                        <div key={doc.document_ref} className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                          <FileText className="h-3 w-3 shrink-0" />
                          <span className="font-mono">{doc.document_ref}</span>
                          <span className="truncate">{doc.title || doc.original_filename}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  <p className="text-[9px] font-mono text-muted-foreground/60 mt-1">{event.event_ref}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
