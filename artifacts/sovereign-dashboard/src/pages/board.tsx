import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { OrgDocumentsPanel } from "@/components/OrgDocumentsPanel";
import { getCurrentBearerToken } from "@/components/auth-provider";
import { useToast } from "@/hooks/use-toast";
import { AlertTriangle, CalendarDays, CheckSquare, ClipboardList, ExternalLink, Scale, ShieldCheck } from "lucide-react";

interface BoardMatter {
  id: number;
  title: string;
  summary: string | null;
  matterType: string;
  sourceType: string | null;
  sourceId: string | null;
  orgId: string;
  status: string;
  priority: string;
  assignedTo: number | null;
  responsibleOffice: string | null;
  dueDate: string | null;
  boardAction: string | null;
  responseRequired: boolean;
  evidenceRequired: boolean;
  closureNotes: string | null;
  linkedTaskId: number | null;
  linkedCalendarEventId: number | null;
  createdAt: string;
  updatedAt: string;
}

const STATUS_FLOW = [
  "new",
  "under_review",
  "action_directed",
  "awaiting_action",
  "awaiting_evidence",
  "closed",
] as const;

const STATUS_LABELS: Record<string, string> = {
  new: "New",
  under_review: "Under Review",
  action_directed: "Action Directed",
  awaiting_action: "Awaiting Action",
  awaiting_evidence: "Awaiting Evidence",
  closed: "Closed",
};

const MATTER_TYPES = [
  ["fiduciary_review", "Fiduciary Review"],
  ["trust_asset", "Trust / Asset"],
  ["land", "Land"],
  ["instrument", "Trust Instrument"],
  ["filing", "Filing / Notice"],
  ["beneficiary", "Beneficiary"],
  ["compliance", "Compliance"],
  ["governance", "Governance"],
  ["other", "Other"],
] as const;

function authHeaders(contentType = false): HeadersInit {
  const token = getCurrentBearerToken();
  return {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(contentType ? { "Content-Type": "application/json" } : {}),
  };
}

async function apiFetch(path: string, init?: RequestInit) {
  const r = await fetch(path, {
    ...init,
    headers: {
      ...authHeaders(Boolean(init?.body)),
      ...(init?.headers ?? {}),
    },
  });
  if (!r.ok) {
    const body = await r.json().catch(() => ({ error: `HTTP ${r.status}` }));
    throw new Error(body.error ?? `HTTP ${r.status}`);
  }
  return r.json();
}

function priorityClass(priority: string) {
  switch (priority) {
    case "urgent": return "bg-red-100 text-red-800 border-red-200";
    case "high": return "bg-orange-100 text-orange-800 border-orange-200";
    case "low": return "bg-slate-100 text-slate-600 border-slate-200";
    default: return "bg-blue-50 text-blue-700 border-blue-200";
  }
}

function statusClass(status: string) {
  switch (status) {
    case "closed": return "bg-emerald-100 text-emerald-800 border-emerald-200";
    case "awaiting_evidence": return "bg-violet-100 text-violet-800 border-violet-200";
    case "awaiting_action": return "bg-amber-100 text-amber-800 border-amber-200";
    case "action_directed": return "bg-orange-100 text-orange-800 border-orange-200";
    case "under_review": return "bg-sky-100 text-sky-800 border-sky-200";
    default: return "bg-zinc-100 text-zinc-700 border-zinc-200";
  }
}

export default function BoardPage() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    title: "",
    summary: "",
    matterType: "governance",
    priority: "normal",
    responsibleOffice: "",
    dueDate: "",
    responseRequired: false,
    evidenceRequired: false,
  });

  const { data: matters = [], isLoading } = useQuery<BoardMatter[]>({
    queryKey: ["board-matters"],
    queryFn: () => apiFetch("/api/board/matters"),
    staleTime: 30_000,
  });

  const createMatter = useMutation({
    mutationFn: () => apiFetch("/api/board/matters", {
      method: "POST",
      body: JSON.stringify({
        ...form,
        dueDate: form.dueDate || null,
      }),
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["board-matters"] });
      qc.invalidateQueries({ queryKey: ["tasks"] });
      qc.invalidateQueries({ queryKey: ["calendar"] });
      setOpen(false);
      setForm({
        title: "",
        summary: "",
        matterType: "governance",
        priority: "normal",
        responsibleOffice: "",
        dueDate: "",
        responseRequired: false,
        evidenceRequired: false,
      });
      toast({ title: "Board Matter created", description: "The matter is now in the trustee work queue." });
    },
    onError: (e: Error) => toast({ title: "Could not create matter", description: e.message, variant: "destructive" }),
  });

  const updateMatter = useMutation({
    mutationFn: ({ id, patch }: { id: number; patch: Record<string, unknown> }) =>
      apiFetch(`/api/board/matters/${id}`, { method: "PUT", body: JSON.stringify(patch) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["board-matters"] });
      qc.invalidateQueries({ queryKey: ["tasks"] });
      qc.invalidateQueries({ queryKey: ["calendar"] });
    },
    onError: (e: Error) => toast({ title: "Board Matter update failed", description: e.message, variant: "destructive" }),
  });

  const stats = useMemo(() => {
    const openCount = matters.filter((m) => m.status !== "closed").length;
    const urgent = matters.filter((m) => m.status !== "closed" && m.priority === "urgent").length;
    const awaiting = matters.filter((m) => ["awaiting_action", "awaiting_evidence"].includes(m.status)).length;
    const closed = matters.filter((m) => m.status === "closed").length;
    return { openCount, urgent, awaiting, closed };
  }, [matters]);

  const byStatus = useMemo(() => {
    const map = new Map<string, BoardMatter[]>();
    STATUS_FLOW.forEach((status) => map.set(status, []));
    matters.forEach((matter) => {
      const bucket = map.get(matter.status) ?? map.get("new")!;
      bucket.push(matter);
    });
    return map;
  }, [matters]);

  return (
    <div className="space-y-6" data-testid="page-board-of-trustees">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold">Office of the Chief Justice & Trustee</p>
          <h1 className="text-3xl font-serif font-bold mt-1">Board of Trustees</h1>
          <p className="text-muted-foreground mt-1">Independent Accountability & Stewardship — fiduciary oversight, directives, evidence, and institutional closure.</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <a href="/trust-dashboard/" className="inline-flex">
            <Button variant="outline" className="gap-1.5">
              <Scale className="h-4 w-4" /> Trust Administration <ExternalLink className="h-3 w-3" />
            </Button>
          </a>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>New Board Matter</Button>
            </DialogTrigger>
            <DialogContent className="max-w-xl">
              <DialogHeader><DialogTitle>Create Board Matter</DialogTitle></DialogHeader>
              <div className="space-y-4 mt-2">
                <div>
                  <Label>Title</Label>
                  <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Matter requiring trustee oversight" />
                </div>
                <div>
                  <Label>Summary</Label>
                  <Textarea value={form.summary} onChange={(e) => setForm({ ...form, summary: e.target.value })} rows={4} placeholder="What is before the Board, and why?" />
                </div>
                <div className="grid sm:grid-cols-2 gap-3">
                  <div>
                    <Label>Matter Type</Label>
                    <Select value={form.matterType} onValueChange={(value) => setForm({ ...form, matterType: value })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {MATTER_TYPES.map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Priority</Label>
                    <Select value={form.priority} onValueChange={(value) => setForm({ ...form, priority: value })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="normal">Normal</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                        <SelectItem value="urgent">Urgent</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid sm:grid-cols-2 gap-3">
                  <div>
                    <Label>Responsible Office</Label>
                    <Input value={form.responsibleOffice} onChange={(e) => setForm({ ...form, responsibleOffice: e.target.value })} placeholder="e.g. Trust, Court, Medical Center" />
                  </div>
                  <div>
                    <Label>Due Date</Label>
                    <Input type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} />
                  </div>
                </div>
                <div className="flex items-center gap-5 text-sm">
                  <label className="flex items-center gap-2">
                    <input type="checkbox" checked={form.responseRequired} onChange={(e) => setForm({ ...form, responseRequired: e.target.checked })} />
                    Response required
                  </label>
                  <label className="flex items-center gap-2">
                    <input type="checkbox" checked={form.evidenceRequired} onChange={(e) => setForm({ ...form, evidenceRequired: e.target.checked })} />
                    Evidence required
                  </label>
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                  <Button disabled={!form.title.trim() || createMatter.isPending} onClick={() => createMatter.mutate()}>
                    {createMatter.isPending ? "Creating…" : "Create Matter"}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "Open Matters", value: stats.openCount, icon: ClipboardList },
          { label: "Urgent", value: stats.urgent, icon: AlertTriangle },
          { label: "Awaiting Action / Evidence", value: stats.awaiting, icon: ShieldCheck },
          { label: "Closed", value: stats.closed, icon: CheckSquare },
        ].map(({ label, value, icon: Icon }) => (
          <Card key={label}>
            <CardContent className="pt-4 flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-widest text-muted-foreground">{label}</p>
                <p className="text-3xl font-serif font-bold mt-1">{value}</p>
              </div>
              <Icon className="h-5 w-5 text-muted-foreground" />
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <Link href="/tasks"><Button size="sm" variant="outline" className="gap-1.5"><CheckSquare className="h-3.5 w-3.5" /> Tasks</Button></Link>
        <Link href="/calendar"><Button size="sm" variant="outline" className="gap-1.5"><CalendarDays className="h-3.5 w-3.5" /> Calendar</Button></Link>
        <Link href="/instruments"><Button size="sm" variant="outline">Trust Instruments</Button></Link>
        <Link href="/land"><Button size="sm" variant="outline">Land & Assets</Button></Link>
        <Link href="/org"><Button size="sm" variant="outline">Organizations</Button></Link>
      </div>

      {isLoading ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">Loading Board Matters…</CardContent></Card>
      ) : matters.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="font-medium">No Board Matters are open yet.</p>
            <p className="text-sm text-muted-foreground mt-1">Create the first matter when an issue requires trustee review, action, evidence, or closure.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid xl:grid-cols-3 gap-4">
          {STATUS_FLOW.map((status) => {
            const items = byStatus.get(status) ?? [];
            return (
              <Card key={status} className={status === "closed" ? "opacity-80" : ""}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center justify-between">
                    <span>{STATUS_LABELS[status]}</span>
                    <Badge variant="outline">{items.length}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {items.length === 0 ? (
                    <p className="text-xs text-muted-foreground py-2">No matters in this stage.</p>
                  ) : items.map((matter) => (
                    <div key={matter.id} className="rounded-lg border p-3 space-y-2 bg-background">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold leading-snug">{matter.title}</p>
                          <p className="text-[10px] text-muted-foreground mt-0.5">Matter #{matter.id} · {matter.matterType.replace(/_/g, " ")}</p>
                        </div>
                        <Badge variant="outline" className={priorityClass(matter.priority)}>{matter.priority}</Badge>
                      </div>

                      {matter.summary && <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3">{matter.summary}</p>}

                      <div className="flex flex-wrap gap-1.5">
                        <Badge variant="outline" className={statusClass(matter.status)}>{STATUS_LABELS[matter.status] ?? matter.status}</Badge>
                        {matter.responseRequired && <Badge variant="outline" className="text-[10px]">Response required</Badge>}
                        {matter.evidenceRequired && <Badge variant="outline" className="text-[10px]">Evidence required</Badge>}
                        {matter.linkedTaskId && <Badge variant="outline" className="text-[10px]">Task #{matter.linkedTaskId}</Badge>}
                      </div>

                      {matter.responsibleOffice && <p className="text-xs"><span className="text-muted-foreground">Responsible:</span> {matter.responsibleOffice}</p>}
                      {matter.dueDate && <p className="text-xs"><span className="text-muted-foreground">Due:</span> {new Date(matter.dueDate).toLocaleDateString()}</p>}
                      {matter.boardAction && <p className="text-xs"><span className="text-muted-foreground">Board action:</span> {matter.boardAction}</p>}

                      <Select
                        value={matter.status}
                        onValueChange={(value) => updateMatter.mutate({ id: matter.id, patch: { status: value } })}
                      >
                        <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {STATUS_FLOW.map((value) => <SelectItem key={value} value={value}>{STATUS_LABELS[value]}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  ))}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <OrgDocumentsPanel
        orgId="board_of_trustees"
        orgName="Board of Trustees / Independent Accountability & Stewardship"
        defaultExpanded
      />
    </div>
  );
}
