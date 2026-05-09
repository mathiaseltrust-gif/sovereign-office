import { useListFilings, useGetFiling, getGetFilingQueryKey } from "@workspace/api-client-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Link, useRoute } from "wouter";

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
      <div className="mb-8">
        <h1 className="text-3xl font-serif font-bold text-foreground">Trust Filings</h1>
        <p className="text-muted-foreground mt-1">Recorder submissions and their status</p>
      </div>
      {isLoading ? (
        <div className="space-y-3">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-16" />)}</div>
      ) : (filings ?? []).length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">No filings yet.</CardContent></Card>
      ) : (
        <div className="space-y-3">
          {(filings ?? []).map((f) => (
            <Card key={f.id} data-testid={`filing-card-${f.id}`} className="hover:border-primary transition-colors">
              <CardContent className="flex items-center justify-between py-4">
                <div>
                  <Link href={`/filings/${f.id}`}>
                    <h3 className="font-semibold hover:text-primary cursor-pointer">
                      Filing #{f.id} — {f.county}, {f.state}
                    </h3>
                  </Link>
                  <div className="flex items-center gap-2 mt-1 flex-wrap text-xs text-muted-foreground">
                    {f.documentType && <span>{f.documentType}</span>}
                    {f.filingNumber && <span>· #/{f.filingNumber}</span>}
                    <span>· Instrument #{f.instrumentId}</span>
                    <span>· {new Date(f.createdAt).toLocaleDateString()}</span>
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

export function FilingDetailPage({ params }: { params: { id: string } }) {
  const id = Number(params.id);
  const { data: filing, isLoading } = useGetFiling(id, { query: { enabled: !!id, queryKey: getGetFilingQueryKey(id) } });

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
      <div className="mt-4">
        <Link href={`/instruments/${filing.instrumentId}`} className="text-sm text-primary hover:underline">
          View associated instrument →
        </Link>
      </div>
    </div>
  );
}
