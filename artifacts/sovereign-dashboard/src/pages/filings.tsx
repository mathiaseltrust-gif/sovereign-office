import { useListFilings, useGetFiling, getGetFilingQueryKey } from "@workspace/api-client-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Link, useRoute } from "wouter";
import { useAuth, getCurrentBearerToken } from "@/components/auth-provider";
import { useState } from "react";

function statusVariant(status: string) {
  switch (status) {
    case "pending": return "secondary";
    case "accepted": return "default";
    case "rejected": return "destructive";
    case "submitted": return "outline";
    default: return "outline";
  }
}

export function FilingsListPage() {
  const { data: filings, isLoading } = useListFilings();

  return (
    <div data-testid="page-filings">
      <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-serif font-bold text-foreground">Trust Filings</h1>
          <p className="text-muted-foreground mt-1">Recorder submissions and their status</p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <Link href="/instruments">
            <Button size="sm">Go to Trust Instruments →</Button>
          </Link>
          <p className="text-[10px] text-muted-foreground">Create a trust instrument first, then file it from the instrument detail page.</p>
        </div>
      </div>
      {isLoading ? (
        <div className="space-y-3">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-16" />)}</div>
      ) : (filings ?? []).length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground mb-3">No filings on record yet.</p>
            <Link href="/instruments">
              <Button size="sm" variant="outline">Create a Trust Instrument to file</Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {(filings ?? []).map((f) => (
            <Card key={f.id} data-testid={`filing-card-${f.id}`} className="hover:border-primary transition-colors">
              <CardContent className="flex items-center justify-between py-4">
                <div>
                  <Link href={`/filings/${f.id}`}>
                    <h3 className="font-semibold hover:text-primary cursor-pointer">
                      {f.documentType ? f.documentType.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase()) : `Filing #${f.id}`}
                      {f.county ? ` — ${f.county}, ${f.state}` : ""}
                    </h3>
                  </Link>
                  <div className="flex items-center gap-2 mt-1 flex-wrap text-xs text-muted-foreground">
                    {f.filingNumber && <span>#{f.filingNumber}</span>}
                    <span>· Instrument #{f.instrumentId}</span>
                    <span>· {new Date(f.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
                  </div>
                </div>
                <Badge variant={statusVariant(f.filingStatus) as any}>{f.filingStatus}</Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

const CERTIFIED_COPY_ROLES = ["officer", "trustee", "admin", "sovereign_admin", "elder"];

export function FilingDetailPage({ params }: { params: { id: string } }) {
  const id = Number(params.id);
  const { data: filing, isLoading } = useGetFiling(id, { query: { enabled: !!id, queryKey: getGetFilingQueryKey(id) } });
  const { activeRole } = useAuth();
  const [downloading, setDownloading] = useState(false);
  const [certifiedMode, setCertifiedMode] = useState(false);
  const canReproduce = CERTIFIED_COPY_ROLES.includes(activeRole);

  const downloadFilingPdf = async (certified: boolean) => {
    if (!filing?.instrumentId) { alert("No instrument PDF associated with this filing."); return; }
    setDownloading(true);
    try {
      const token = getCurrentBearerToken();
      const url = certified
        ? `/api/trust/filings/${filing.id}/certified-copy`
        : `/api/trust/instruments/${filing.instrumentId}/pdf`;
      const res = await fetch(url, {
        method: certified ? "POST" : "GET",
        headers: {
          ...(certified ? { "Content-Type": "application/json" } : {}),
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        ...(certified ? { body: JSON.stringify({}) } : {}),
      });
      if (!res.ok) throw new Error(`Download failed: HTTP ${res.status}`);
      const blob = await res.blob();
      const objUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objUrl;
      a.download = certified
        ? `filing-${filing.id}-certified.pdf`
        : `filing-${filing.id}-instrument.pdf`;
      a.click();
      URL.revokeObjectURL(objUrl);
    } catch (err) {
      alert(String(err));
    } finally {
      setDownloading(false);
    }
  };

  if (isLoading) return <div data-testid="page-filing-detail"><Skeleton className="h-48" /></div>;
  if (!filing) return <div data-testid="page-filing-detail" className="text-muted-foreground">Filing not found.</div>;

  const fields = [
    { label: "County", value: filing.county },
    { label: "State", value: filing.state },
    { label: "Status", value: filing.filingStatus },
    { label: "Document Type", value: filing.documentType },
    { label: "Filing Number", value: filing.filingNumber },
    { label: "Trust Status", value: filing.trustStatus },
    { label: "Land Classification", value: filing.landClassification },
    { label: "Submitted", value: filing.submittedAt ? new Date(filing.submittedAt).toLocaleString() : null },
    { label: "Accepted", value: filing.acceptedAt ? new Date(filing.acceptedAt).toLocaleString() : null },
    { label: "Rejected", value: filing.rejectedAt ? new Date(filing.rejectedAt).toLocaleString() : null },
    { label: "Created", value: new Date(filing.createdAt).toLocaleString() },
  ];

  return (
    <div data-testid="page-filing-detail">
      <div className="mb-6">
        <Link href="/filings" className="text-xs text-muted-foreground hover:text-primary">← All Filings</Link>
        <h1 className="text-3xl font-serif font-bold text-foreground mt-2">Filing #{filing.id}</h1>
        <div className="flex items-center gap-2 mt-2">
          <Badge variant={statusVariant(filing.filingStatus) as any}>{filing.filingStatus}</Badge>
          <span className="text-sm text-muted-foreground">Instrument #{filing.instrumentId}</span>
        </div>
      </div>
      <Card>
        <CardContent className="pt-6">
          <dl className="grid grid-cols-2 gap-4">
            {fields.filter((f) => f.value).map(({ label, value }) => (
              <div key={label}>
                <dt className="text-xs text-muted-foreground uppercase tracking-widest">{label}</dt>
                <dd className="text-sm font-medium mt-1">{value}</dd>
              </div>
            ))}
          </dl>
          {filing.notes && (
            <div className="mt-4 border-t pt-4">
              <dt className="text-xs text-muted-foreground uppercase tracking-widest">Notes</dt>
              <dd className="text-sm mt-1">{filing.notes}</dd>
            </div>
          )}
        </CardContent>
      </Card>
      <div className="mt-4 flex items-center gap-4 flex-wrap">
        <Link href={`/instruments/${filing.instrumentId}`} className="text-sm text-primary hover:underline">
          View associated instrument →
        </Link>
        {filing.instrumentId && (
          <div className="flex items-center gap-3">
            {canReproduce && (
              <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer select-none">
                <input
                  type="checkbox"
                  className="accent-blue-600"
                  checked={certifiedMode}
                  onChange={(e) => setCertifiedMode(e.target.checked)}
                />
                Certified copy
              </label>
            )}
            <Button
              variant="outline"
              size="sm"
              className={certifiedMode ? "border-blue-400 text-blue-700 dark:text-blue-400" : ""}
              onClick={() => downloadFilingPdf(certifiedMode)}
              disabled={downloading}
              title={certifiedMode ? "Download as True and Certified Copy" : "Download instrument PDF"}
            >
              {downloading ? "Preparing…" : (certifiedMode ? "Download PDF (Certified)" : "Download PDF")}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
