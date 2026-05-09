import { useListNfrs, useExportNfrPdf, getListNfrsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/components/auth-provider";

export default function NfrPage() {
  const { data: nfrs, isLoading } = useListNfrs();
  const exportPdf = useExportNfrPdf();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();

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
    const token = btoa(JSON.stringify(user));
    const r = await fetch(`/api/court/nfr/${id}/pdf`, { headers: { Authorization: `Bearer ${token}` } });
    if (!r.ok) { toast({ title: "Error", description: "PDF not available.", variant: "destructive" }); return; }
    const blob = await r.blob();
    window.open(URL.createObjectURL(blob));
  };

  return (
    <div data-testid="page-nfr">
      <div className="mb-8">
        <h1 className="text-3xl font-serif font-bold text-foreground">NFR Documents</h1>
        <p className="text-muted-foreground mt-1">Notices of Fault and Remedies — recorder-compliant PDFs</p>
      </div>
      {isLoading ? (
        <div className="space-y-3">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-16" />)}</div>
      ) : (nfrs ?? []).length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">No NFR documents. Submit a classification to generate one.</CardContent></Card>
      ) : (
        <div className="space-y-3">
          {(nfrs ?? []).map((n) => (
            <Card key={n.id} data-testid={`nfr-card-${n.id}`}>
              <CardContent className="flex items-center justify-between py-4">
                <div>
                  <h3 className="font-semibold">NFR #{n.id}</h3>
                  <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                    <span>Classification #{n.classificationId}</span>
                    <span>· {new Date(n.createdAt).toLocaleDateString()}</span>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1 max-w-lg truncate">{n.content?.substring(0, 100)}</div>
                </div>
                <div className="flex items-center gap-2 ml-4">
                  <Badge variant="outline">{n.status}</Badge>
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
    </div>
  );
}
