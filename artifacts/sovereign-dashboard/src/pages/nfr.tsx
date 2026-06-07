import { useMemo, useState } from "react";
import { Link } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useListNfrs, useExportNfrPdf, getListNfrsQueryKey } from "@workspace/api-client-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { getCurrentBearerToken, useIsOfficer } from "@/components/auth-provider";
import { AlertTriangle, FileText, Gavel, RefreshCw, ShieldAlert } from "lucide-react";
import { OpenInvestigationModal } from "@/components/OpenInvestigationModal";

interface Investigation {
  id: number;
  signalType: string;
  triggeringEventType: string;
  affectedMatter: string | null;
  triggeringEntity: string | null;
  protectionCategory: string | null;
  urgencyScore: number | null;
  recommendedReviewLevel: string | null;
  status: string;
  nfrId: number | null;
  implicatedLaws?: string[] | null;
  internalActions?: Array<{ step: number; action: string; status: string }> | null;
  externalActions?: Array<{ step: number; action: string; status: string }> | null;
  requiredFollowthrough?: Array<{ step: number; item: string; status: string }> | null;
  summary: string | null;
  createdAt: string;
  updatedAt?: string;
}

function label(v?: string | null) {
  return (v ?? "—").replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}

function statusVariant(status: string): "destructive" | "default" | "secondary" | "outline" {
  if (status === "open" || status === "escalated") return "destructive";
  if (status === "under_review") return "default";
  if (status === "resolved") return "secondary";
  return "outline";
}

function urgencyVariant(score: number | null): "destructive" | "default" | "secondary" | "outline" {
  if (!score) return "outline";
  if (score >= 9) return "destructive";
  if (score >= 7) return "default";
  return "secondary";
}

function urgencyLabel(score: number | null): string {
  if (!score) return "Pending";
  if (score >= 9) return `Critical ${score}/10`;
  if (score >= 7) return `High ${score}/10`;
  return `Medium ${score}/10`;
}

function categoryBorder(cat: string | null): string {
  const map: Record<string, string> = {
    LAND: "border-l-amber-500",
    FORECLOSURE: "border-l-red-600",
    TAX_OR_LIEN: "border-l-orange-500",
    IDENTITY: "border-l-blue-500",
    JURISDICTION: "border-l-purple-500",
    ICWA: "border-l-red-500",
    TRUST_RESPONSIBILITY: "border-l-red-700",
    BENEFITS: "border-l-green-500",
    FEDERAL_PROGRAM: "border-l-teal-500",
    TREATY: "border-l-indigo-500",
    RECORDER: "border-l-yellow-500",
    MANAGED_CARE: "border-l-pink-500",
    CONTINUITY: "border-l-cyan-500",
  };
  return map[cat ?? ""] ?? "border-l-muted-foreground/30";
}

export default function NfrPage() {
  const { data: nfrs, isLoading: docsLoading } = useListNfrs();
  const exportPdf = useExportNfrPdf();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const isOfficer = useIsOfficer();
  const [investigationNfrId, setInvestigationNfrId] = useState<number | null>(null);
  const [manualOpen, setManualOpen] = useState(false);

  const {
    data: investigations,
    isLoading: investigationsLoading,
    refetch: refetchInvestigations,
  } = useQuery<Investigation[]>({
    queryKey: ["nfr-investigations-registry"],
    queryFn: async () => {
      const token = getCurrentBearerToken() ?? "";
      const res = await fetch("/api/court/review-engine/investigations", {
        cache: "no-store",
        credentials: "include",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error("Failed to load NFR investigations");
      return res.json();
    },
    staleTime: 0,
    refetchInterval: 60_000,
  });

  const docs = nfrs ?? [];
  const matters = investigations ?? [];

  const stats = useMemo(() => {
    const active = matters.filter(m => ["open", "under_review", "escalated"].includes(m.status));
    const escalated = matters.filter(m => m.status === "escalated");
    const highest = matters.reduce((max, m) => Math.max(max, m.urgencyScore ?? 0), 0);
    return { active: active.length, escalated: escalated.length, docs: docs.length, highest };
  }, [matters, docs.length]);

  const activeMatters = useMemo(
    () => matters.filter(m => ["open", "under_review", "escalated"].includes(m.status)),
    [matters]
  );

  const handleExport = (id: number) => {
    exportPdf.mutate({ id }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListNfrsQueryKey() });
        toast({ title: "PDF exported", description: `NFR #${id} PDF ready.` });
      },
      onError: () => toast({ title: "Error", description: "PDF export failed.", variant: "destructive" }),
    });
  };

  const downloadPdf = async (id: number) => {
    const token = getCurrentBearerToken() ?? "";
    const r = await fetch(`/api/court/nfr/${id}/pdf`, { headers: { Authorization: `Bearer ${token}` } });
    if (!r.ok) {
      toast({ title: "Error", description: "PDF not available.", variant: "destructive" });
      return;
    }
    const blob = await r.blob();
    window.open(URL.createObjectURL(blob));
  };

  const investigationNfr = investigationNfrId != null
    ? docs.find(n => n.id === investigationNfrId)
    : null;

  return (
    <div data-testid="page-nfr" className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-serif font-bold text-foreground">Notice of Federal Review</h1>
          <p className="text-muted-foreground mt-1">
            NFR command center — review signals, active investigations, generated notices, service status, and follow-through.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => refetchInvestigations()}>
            <RefreshCw className="w-4 h-4 mr-1.5" /> Refresh
          </Button>
          {isOfficer && (
            <Button size="sm" onClick={() => setManualOpen(true)}>
              <Gavel className="w-4 h-4 mr-1.5" /> Open NFR Investigation
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase tracking-widest text-muted-foreground">Active Reviews</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold">{stats.active}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase tracking-widest text-muted-foreground">Escalated</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold">{stats.escalated}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase tracking-widest text-muted-foreground">NFR Documents</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold">{stats.docs}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase tracking-widest text-muted-foreground">Highest Urgency</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold">{stats.highest || "—"}</CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm uppercase tracking-widest flex items-center gap-2">
            <ShieldAlert className="w-4 h-4" />
            Active NFR Review Registry
          </CardTitle>
        </CardHeader>
        <CardContent>
          {investigationsLoading ? (
            <div className="space-y-3">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-20" />)}</div>
          ) : activeMatters.length === 0 ? (
            <div className="py-10 text-center text-muted-foreground">
              <AlertTriangle className="w-8 h-8 mx-auto mb-2 opacity-60" />
              No active NFR investigations. Open one manually or submit a classification/intake that triggers review.
            </div>
          ) : (
            <div className="space-y-3">
              {activeMatters.map(m => (
                <div
                  key={m.id}
                  className={`border border-border border-l-4 rounded-md p-4 bg-card ${categoryBorder(m.protectionCategory)}`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-semibold">Investigation #{m.id}</h3>
                        <Badge variant={statusVariant(m.status)}>{label(m.status)}</Badge>
                        <Badge variant={urgencyVariant(m.urgencyScore)}>{urgencyLabel(m.urgencyScore)}</Badge>
                        {m.nfrId && <Badge variant="secondary">NFR #{m.nfrId}</Badge>}
                      </div>

                      <p className="text-sm font-medium mt-2">{label(m.signalType)}</p>
                      <div className="text-xs text-muted-foreground mt-1 space-y-0.5">
                        <p>Category: {label(m.protectionCategory)} · Review: {m.recommendedReviewLevel ?? "TRUSTEE"}</p>
                        <p>Trigger: {label(m.triggeringEventType)} · Opened {new Date(m.createdAt).toLocaleString()}</p>
                        {m.affectedMatter && <p>Matter: {m.affectedMatter}</p>}
                        {m.triggeringEntity && <p>Entity: {m.triggeringEntity}</p>}
                      </div>

                      {m.implicatedLaws?.[0] && (
                        <p className="text-xs italic text-muted-foreground mt-2">{m.implicatedLaws[0]}</p>
                      )}

                      {m.externalActions?.[0]?.action && (
                        <p className="text-sm mt-2">Next external action: <span className="font-medium">{m.externalActions[0].action}</span></p>
                      )}
                      {m.requiredFollowthrough?.[0]?.item && (
                        <p className="text-sm mt-1">Follow-through: <span className="font-medium">{m.requiredFollowthrough[0].item}</span></p>
                      )}
                    </div>

                    <Link href={`/investigations/${m.id}`}>
                      <Button variant="outline" size="sm">Open Matter</Button>
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm uppercase tracking-widest flex items-center gap-2">
            <FileText className="w-4 h-4" />
            NFR Documents
          </CardTitle>
        </CardHeader>
        <CardContent>
          {docsLoading ? (
            <div className="space-y-3">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-16" />)}</div>
          ) : docs.length === 0 ? (
            <div className="py-10 text-center text-muted-foreground">
              No NFR documents yet. NFR investigations may exist before a final notice PDF is generated.
            </div>
          ) : (
            <div className="space-y-3">
              {docs.map((n) => (
                <Card key={n.id} data-testid={`nfr-card-${n.id}`}>
                  <CardContent className="flex items-center justify-between py-4">
                    <div>
                      <h3 className="font-semibold">NFR #{n.id}</h3>
                      <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                        <span>Classification #{n.classificationId ?? "—"}</span>
                        <span>· {new Date(n.createdAt).toLocaleDateString()}</span>
                      </div>
                      <div className="text-xs text-muted-foreground mt-1 max-w-lg truncate">{n.content?.substring(0, 140)}</div>
                    </div>
                    <div className="flex items-center gap-2 ml-4">
                      <Badge variant="outline">{n.status}</Badge>
                      {isOfficer && (
                        <Button
                          size="sm"
                          variant="outline"
                          data-testid={`button-open-investigation-nfr-${n.id}`}
                          onClick={() => setInvestigationNfrId(n.id)}
                        >
                          <Gavel className="w-3.5 h-3.5 mr-1.5" /> Open Investigation
                        </Button>
                      )}
                      {!n.pdfUrl ? (
                        <Button size="sm" variant="outline" data-testid={`button-export-pdf-${n.id}`} onClick={() => handleExport(n.id)} disabled={exportPdf.isPending}>
                          Generate PDF
                        </Button>
                      ) : (
                        <Button size="sm" variant="outline" data-testid={`button-download-pdf-${n.id}`} onClick={() => downloadPdf(n.id)}>
                          Download PDF
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {investigationNfr != null && (
        <OpenInvestigationModal
          onClose={() => setInvestigationNfrId(null)}
          defaultSignalType="TRUST_RESPONSIBILITY_BREACH"
          affectedMatter={`NFR #${investigationNfr.id}`}
          sourceLabel={`NFR #${investigationNfr.id}`}
        />
      )}

      {manualOpen && (
        <OpenInvestigationModal
          onClose={() => setManualOpen(false)}
          defaultSignalType="TRUST_RESPONSIBILITY_BREACH"
          affectedMatter="Manual Notice of Federal Review"
          sourceLabel="Notice of Federal Review"
        />
      )}
    </div>
  );
}
