import { useGetInstrument, getGetInstrumentQueryKey, useListFilings, useFileInstrument, getListFilingsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { useAuth } from "@/components/auth-provider";

export default function InstrumentDetail({ params }: { params: { id: string } }) {
  const id = Number(params.id);
  const { data: inst, isLoading } = useGetInstrument(id, { query: { enabled: !!id, queryKey: getGetInstrumentQueryKey(id) } });
  const { data: filings } = useListFilings();
  const fileInstrument = useFileInstrument();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();
  const [fileOpen, setFileOpen] = useState(false);
  const [fileForm, setFileForm] = useState({ county: "", state: "", documentType: "", notes: "" });

  const instFilings = (filings ?? []).filter((f) => f.instrumentId === id);

  const handleFile = (e: React.FormEvent) => {
    e.preventDefault();
    fileInstrument.mutate(
      { id, data: { county: fileForm.county, state: fileForm.state, instrumentId: id, documentType: fileForm.documentType, notes: fileForm.notes } },
      {
        onSuccess: () => {
          toast({ title: "Filed", description: "Instrument submitted to recorder." });
          queryClient.invalidateQueries({ queryKey: getGetInstrumentQueryKey(id) });
          queryClient.invalidateQueries({ queryKey: getListFilingsQueryKey() });
          setFileOpen(false);
        },
        onError: () => toast({ title: "Error", description: "Failed to file.", variant: "destructive" }),
      }
    );
  };

  const downloadPdf = async () => {
    const token = btoa(JSON.stringify(user));
    const r = await fetch(`/api/trust/instruments/${id}/pdf`, { headers: { Authorization: `Bearer ${token}` } });
    if (!r.ok) { toast({ title: "Error", description: "PDF not available.", variant: "destructive" }); return; }
    const blob = await r.blob();
    const url = URL.createObjectURL(blob);
    window.open(url);
  };

  if (isLoading) return (
    <div data-testid="page-instrument-detail">
      <Skeleton className="h-10 w-64 mb-4" />
      <Skeleton className="h-48" />
    </div>
  );

  if (!inst) return <div data-testid="page-instrument-detail" className="text-muted-foreground">Instrument not found.</div>;

  return (
    <div data-testid="page-instrument-detail">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-3xl font-serif font-bold text-foreground">{inst.title}</h1>
          <div className="flex items-center gap-2 mt-2">
            <Badge>{inst.instrumentType}</Badge>
            <Badge variant="outline">{inst.status}</Badge>
            {inst.jurisdiction && <span className="text-sm text-muted-foreground">{inst.jurisdiction}</span>}
          </div>
        </div>
        <div className="flex gap-2">
          {inst.pdfUrl && (
            <Button variant="outline" onClick={downloadPdf} data-testid="button-download-pdf">Download PDF</Button>
          )}
          <Dialog open={fileOpen} onOpenChange={setFileOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-file-instrument">File with Recorder</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>File Instrument</DialogTitle></DialogHeader>
              <form onSubmit={handleFile} className="space-y-4 mt-2">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>County</Label>
                    <Input data-testid="input-county" value={fileForm.county} onChange={(e) => setFileForm({ ...fileForm, county: e.target.value })} required />
                  </div>
                  <div>
                    <Label>State</Label>
                    <Input data-testid="input-state" value={fileForm.state} onChange={(e) => setFileForm({ ...fileForm, state: e.target.value })} required />
                  </div>
                </div>
                <div>
                  <Label>Document Type</Label>
                  <Input data-testid="input-doc-type" value={fileForm.documentType} onChange={(e) => setFileForm({ ...fileForm, documentType: e.target.value })} />
                </div>
                <div>
                  <Label>Notes</Label>
                  <Input data-testid="input-notes" value={fileForm.notes} onChange={(e) => setFileForm({ ...fileForm, notes: e.target.value })} />
                </div>
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setFileOpen(false)}>Cancel</Button>
                  <Button type="submit" data-testid="button-submit-file" disabled={fileInstrument.isPending}>Submit Filing</Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 text-sm">
        {inst.state && <div><span className="text-muted-foreground">State:</span> {inst.state}</div>}
        {inst.county && <div><span className="text-muted-foreground">County:</span> {inst.county}</div>}
        {inst.landClassification && <div><span className="text-muted-foreground">Land:</span> {inst.landClassification}</div>}
        <div><span className="text-muted-foreground">Created:</span> {new Date(inst.createdAt).toLocaleDateString()}</div>
        <div><span className="text-muted-foreground">Updated:</span> {new Date(inst.updatedAt).toLocaleDateString()}</div>
      </div>

      {inst.validationErrors && (inst.validationErrors as string[]).length > 0 && (
        <Card className="mb-4 border-destructive">
          <CardHeader><CardTitle className="text-sm text-destructive">Validation Errors</CardTitle></CardHeader>
          <CardContent>
            <ul className="list-disc list-inside text-sm text-destructive space-y-1">
              {(inst.validationErrors as string[]).map((e, i) => <li key={i}>{e}</li>)}
            </ul>
          </CardContent>
        </Card>
      )}

      {inst.trusteeNotes && (
        <Card className="mb-4">
          <CardHeader><CardTitle className="text-sm">Trustee Notes</CardTitle></CardHeader>
          <CardContent><p className="text-sm text-muted-foreground whitespace-pre-wrap">{inst.trusteeNotes}</p></CardContent>
        </Card>
      )}

      <Card className="mb-4">
        <CardHeader><CardTitle className="text-sm">Instrument Content</CardTitle></CardHeader>
        <CardContent>
          <pre className="text-xs font-mono whitespace-pre-wrap text-muted-foreground bg-muted rounded p-3 max-h-96 overflow-y-auto">{inst.content}</pre>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-sm">Filing History ({instFilings.length})</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {instFilings.length === 0 ? (
            <p className="text-sm text-muted-foreground">Not yet filed with any recorder.</p>
          ) : instFilings.map((f) => (
            <div key={f.id} data-testid={`filing-row-${f.id}`} className="flex items-center justify-between py-2 border-b last:border-0">
              <span className="text-sm">{f.county}, {f.state} {f.filingNumber ? `— #${f.filingNumber}` : ""}</span>
              <Badge variant="outline">{f.filingStatus}</Badge>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
