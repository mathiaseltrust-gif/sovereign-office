import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { getCurrentBearerToken, useIsOfficer } from "@/components/auth-provider";
import { AlertTriangle, Archive, Building2, CalendarClock, FileText, Gavel, Landmark, Loader2, RadioTower, Scale, Send } from "lucide-react";
import { OpenInvestigationModal } from "@/components/OpenInvestigationModal";

type NfrDocument = {
  id: number;
  status: string;
  content?: string | null;
  classificationId?: number | null;
  investigationId?: number | null;
  pdfUrl?: string | null;
  tribalRef?: string | null;
  urgencyScore?: number | null;
  protectionCategory?: string | null;
  triggeringEntity?: string | null;
  createdAt: string;
  updatedAt: string;
};

type NfrInvestigation = {
  id: number;
  nfrId?: number | null;
  signalType?: string | null;
  triggeringEventType?: string | null;
  affectedMatter?: string | null;
  triggeringEntity?: string | null;
  protectionCategory?: string | null;
  urgencyScore?: number | null;
  recommendedReviewLevel?: string | null;
  status: string;
  summary?: string | null;
  createdAt: string;
  updatedAt: string;
};

type NfrSignal = {
  id: number;
  investigationId?: number | null;
  signalType?: string | null;
  source?: string | null;
  context?: string | null;
  detectedAt: string;
};

type AdminRecord = {
  model: string;
  incidents: Array<{ id: number; incidentNo: string; signalType?: string | null; status: string; urgencyScore?: number | null; affectedMatter?: string | null; createdAt: string }>;
  entities: Array<{ name: string; count: number; investigationIds: number[] }>;
  notices: Array<{ id: number; noticeNo: string; investigationId?: number | null; status: string; pdfUrl?: string | null; triggeringEntity?: string | null; createdAt: string }>;
  evidenceFiles: Array<{ source: string; investigationIds: number[] }>;
  protectedInterests: Array<{ label: string; kind: string; investigationIds: number[] }>;
  deadlines: Array<{ id: string; investigationId: number; label: string; status: string; source: string }>;
  outcomes: Array<{ id: number; investigationId: number; status: string; summary?: string | null; updatedAt: string }>;
  recentSignals: Array<{ id: number; investigationId?: number | null; signalType?: string | null; source?: string | null; detectedAt: string }>;
};

type NfrOverview = {
  documents: NfrDocument[];
  investigations: NfrInvestigation[];
  activeMatters: NfrInvestigation[];
  recentSignals: NfrSignal[];
  administrativeRecord?: AdminRecord;
};

const emptyAdminRecord: AdminRecord = {
  model: "Incident → Entity → Notice → Evidence → Protected Interest → Deadline → Outcome",
  incidents: [],
  entities: [],
  notices: [],
  evidenceFiles: [],
  protectedInterests: [],
  deadlines: [],
  outcomes: [],
  recentSignals: [],
};

const emptyOverview: NfrOverview = {
  documents: [],
  investigations: [],
  activeMatters: [],
  recentSignals: [],
  administrativeRecord: emptyAdminRecord,
};

function authHeaders(): HeadersInit {
  const token = getCurrentBearerToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
      ...(init?.headers ?? {}),
    },
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({})) as { error?: string };
    throw new Error(body.error ?? `HTTP ${response.status}`);
  }
  return response.json() as Promise<T>;
}

function pretty(value?: string | null): string {
  if (!value) return "—";
  return value.replace(/_/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());
}

function statusClass(status?: string | null): string {
  switch (status) {
    case "open":
    case "draft":
      return "border-amber-600/40 text-amber-400";
    case "under_review":
    case "active":
      return "border-blue-600/40 text-blue-400";
    case "escalated":
      return "border-red-600/40 text-red-400";
    case "resolved":
    case "closed":
      return "border-green-600/40 text-green-400";
    default:
      return "border-muted-foreground/40 text-muted-foreground";
  }
}

function AdminSummaryCard({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: number }) {
  return (
    <Card>
      <CardContent className="py-4 flex items-center gap-3">
        <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center">
          <Icon className="h-4 w-4 text-muted-foreground" />
        </div>
        <div>
          <div className="text-xs text-muted-foreground">{label}</div>
          <div className="text-2xl font-semibold">{value}</div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function NfrPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const isOfficer = useIsOfficer();
  const [investigationNfrId, setInvestigationNfrId] = useState<number | null>(null);

  const { data = emptyOverview, isLoading, isError, error } = useQuery({
    queryKey: ["nfr-overview"],
    queryFn: () => apiFetch<NfrOverview>("/api/court/nfr/overview"),
    refetchInterval: 60_000,
  });

  const admin = data.administrativeRecord ?? emptyAdminRecord;

  const exportPdf = useMutation({
    mutationFn: async (id: number) => apiFetch<{ downloadUrl?: string }>(`/api/court/nfr/${id}/export-pdf`, { method: "POST", body: "{}" }),
    onSuccess: (_result, id) => {
      queryClient.invalidateQueries({ queryKey: ["nfr-overview"] });
      toast({ title: "PDF generated", description: `NFR #${id} PDF is ready.` });
    },
    onError: (err) => toast({ title: "PDF export failed", description: err instanceof Error ? err.message : String(err), variant: "destructive" }),
  });

  const downloadPdf = async (id: number) => {
    const r = await fetch(`/api/court/nfr/${id}/pdf`, { headers: authHeaders() });
    if (!r.ok) {
      toast({ title: "Error", description: "PDF not available.", variant: "destructive" });
      return;
    }
    const blob = await r.blob();
    window.open(URL.createObjectURL(blob));
  };

  const investigationNfr = investigationNfrId != null
    ? data.documents.find(n => n.id === investigationNfrId)
    : null;

  const hasRecords = data.documents.length > 0 || data.activeMatters.length > 0 || data.recentSignals.length > 0;

  return (
    <div data-testid="page-nfr" className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-serif font-bold text-foreground">Notice of Federal Review</h1>
          <p className="text-muted-foreground mt-1">
            Live NFR engine feed plus the administrative-record structure from the original review registry.
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link href="/classify">Classify Intake</Link>
          </Button>
          {isOfficer && (
            <Button onClick={() => setInvestigationNfrId(0)}>
              <Gavel className="w-4 h-4 mr-2" /> Manual NFR Trigger
            </Button>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-20" />)}</div>
      ) : isError ? (
        <Card>
          <CardContent className="py-10 text-center text-destructive">
            <AlertTriangle className="w-8 h-8 mx-auto mb-2" />
            <p className="font-medium">NFR overview failed to load</p>
            <p className="text-xs mt-1 text-muted-foreground">{error instanceof Error ? error.message : "Check API connection."}</p>
          </CardContent>
        </Card>
      ) : !hasRecords ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Scale className="w-10 h-10 mx-auto mb-3 opacity-70" />
            <p className="font-medium text-foreground">No NFR activity is open yet.</p>
            <p className="text-sm mt-1">Submit a classification or use the manual trigger to open the first review.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardContent className="py-4">
                <div className="text-xs text-muted-foreground">Active Matters</div>
                <div className="text-2xl font-semibold">{data.activeMatters.length}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="py-4">
                <div className="text-xs text-muted-foreground">NFR Documents</div>
                <div className="text-2xl font-semibold">{data.documents.length}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="py-4">
                <div className="text-xs text-muted-foreground">Recent Signals</div>
                <div className="text-2xl font-semibold">{data.recentSignals.length}</div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base"><Archive className="w-4 h-4" /> Administrative Record Bridge</CardTitle>
              <p className="text-xs text-muted-foreground">{admin.model}</p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 md:grid-cols-4">
                <AdminSummaryCard icon={RadioTower} label="Incidents" value={admin.incidents.length} />
                <AdminSummaryCard icon={Building2} label="Entities" value={admin.entities.length} />
                <AdminSummaryCard icon={Send} label="Notices" value={admin.notices.length} />
                <AdminSummaryCard icon={Landmark} label="Protected Interests" value={admin.protectedInterests.length} />
                <AdminSummaryCard icon={FileText} label="Evidence Sources" value={admin.evidenceFiles.length} />
                <AdminSummaryCard icon={CalendarClock} label="Follow-Up Items" value={admin.deadlines.length} />
                <AdminSummaryCard icon={Scale} label="Outcomes" value={admin.outcomes.length} />
                <AdminSummaryCard icon={AlertTriangle} label="Signals" value={admin.recentSignals.length} />
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <div className="rounded-lg border p-4">
                  <h3 className="text-sm font-semibold mb-3">Accountable Entities</h3>
                  {admin.entities.length === 0 ? <p className="text-xs text-muted-foreground">No entities linked yet.</p> : admin.entities.slice(0, 6).map(entity => (
                    <div key={entity.name} className="flex items-center justify-between py-2 border-b last:border-0">
                      <span className="text-sm truncate">{entity.name}</span>
                      <Badge variant="secondary">{entity.count}</Badge>
                    </div>
                  ))}
                </div>

                <div className="rounded-lg border p-4">
                  <h3 className="text-sm font-semibold mb-3">Pending Follow-Up</h3>
                  {admin.deadlines.length === 0 ? <p className="text-xs text-muted-foreground">No follow-up items generated yet.</p> : admin.deadlines.slice(0, 6).map(item => (
                    <div key={item.id} className="py-2 border-b last:border-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm truncate">{item.label}</span>
                        <Badge variant="outline" className={statusClass(item.status)}>{pretty(item.status)}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">Investigation #{item.investigationId} · {item.source}</p>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base"><RadioTower className="w-4 h-4" /> Active NFR Investigations</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {data.activeMatters.length === 0 ? (
                <p className="text-sm text-muted-foreground">No active investigations.</p>
              ) : data.activeMatters.map((matter) => (
                <div key={matter.id} className="rounded-lg border p-4 flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold">Investigation #{matter.id}</h3>
                      <Badge variant="outline" className={statusClass(matter.status)}>{pretty(matter.status)}</Badge>
                      {matter.urgencyScore != null && <Badge variant="secondary">Urgency {matter.urgencyScore}/10</Badge>}
                    </div>
                    <p className="text-sm mt-1">{pretty(matter.signalType)}</p>
                    <p className="text-xs text-muted-foreground mt-1 truncate max-w-3xl">{matter.summary ?? matter.affectedMatter ?? "No summary recorded."}</p>
                  </div>
                  <Button asChild size="sm" variant="outline">
                    <Link href={`/investigations/${matter.id}`}>Open</Link>
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base"><FileText className="w-4 h-4" /> Generated NFR Documents</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {data.documents.length === 0 ? (
                <p className="text-sm text-muted-foreground">No NFR documents have been drafted yet.</p>
              ) : data.documents.map((n) => (
                <div key={n.id} className="rounded-lg border p-4 flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold">NFR #{n.id}</h3>
                      <Badge variant="outline" className={statusClass(n.status)}>{pretty(n.status)}</Badge>
                      {n.tribalRef && <Badge variant="secondary">{n.tribalRef}</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {n.investigationId ? `Investigation #${n.investigationId}` : `Classification #${n.classificationId ?? "—"}`} · {new Date(n.createdAt).toLocaleDateString()}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1 max-w-3xl truncate">{n.content?.substring(0, 180) ?? "No content preview."}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {isOfficer && (
                      <Button size="sm" variant="outline" onClick={() => setInvestigationNfrId(n.id)}>
                        <Gavel className="w-3.5 h-3.5 mr-1.5" /> Review
                      </Button>
                    )}
                    {!n.pdfUrl ? (
                      <Button size="sm" variant="outline" onClick={() => exportPdf.mutate(n.id)} disabled={exportPdf.isPending}>
                        {exportPdf.isPending ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : null}
                        Generate PDF
                      </Button>
                    ) : (
                      <Button size="sm" variant="outline" onClick={() => downloadPdf(n.id)}>Download PDF</Button>
                    )}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </>
      )}

      {(investigationNfrId === 0 || investigationNfr != null) && (
        <OpenInvestigationModal
          onClose={() => setInvestigationNfrId(null)}
          defaultSignalType={investigationNfr ? "TRUST_RESPONSIBILITY_BREACH" : "FEDERAL_TRUST_TRIGGER"}
          affectedMatter={investigationNfr ? `NFR #${investigationNfr.id}` : "Manual Notice of Federal Review"}
          sourceLabel={investigationNfr ? `NFR #${investigationNfr.id}` : "NFR manual trigger"}
        />
      )}
    </div>
  );
}
