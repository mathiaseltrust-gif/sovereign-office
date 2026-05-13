import { useState } from "react";
import { useListInstruments, useListInstrumentTemplates, useCreateInstrument, getListInstrumentsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { getCurrentBearerToken } from "@/components/auth-provider";
import { Link } from "wouter";

function statusColor(status: string) {
  switch (status) {
    case "draft": return "secondary";
    case "filed": return "default";
    case "submitted": return "outline";
    case "accepted": return "default";
    case "rejected": return "destructive";
    default: return "outline";
  }
}

export default function InstrumentsPage() {
  const { data: instruments, isLoading } = useListInstruments();
  const { data: templatesData } = useListInstrumentTemplates();
  const createInstrument = useCreateInstrument();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    title: "",
    type: "trust_deed",
    templateKey: "",
    landDescription: "",
    jurisdiction: "",
    state: "",
    indianLandProtection: true,
    trustStatus: true,
    federalPreemption: true,
    tribalJurisdiction: true,
    trusteeNotes: "",
  });

  const templates = templatesData?.templates ?? [];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    createInstrument.mutate(
      { data: { ...form, indianLandProtection: form.indianLandProtection, trustStatus: form.trustStatus } },
      {
        onSuccess: () => {
          toast({ title: "Instrument created", description: "Recorder-compliant PDF generated." });
          queryClient.invalidateQueries({ queryKey: getListInstrumentsQueryKey() });
          setOpen(false);
          setForm({ title: "", type: "trust_deed", templateKey: "", landDescription: "", jurisdiction: "", state: "", indianLandProtection: true, trustStatus: true, federalPreemption: true, tribalJurisdiction: true, trusteeNotes: "" });
        },
        onError: () => {
          toast({ title: "Error", description: "Failed to create instrument.", variant: "destructive" });
        },
      }
    );
  };

  return (
    <div data-testid="page-instruments">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-serif font-bold text-foreground">Trust Instruments</h1>
          <p className="text-muted-foreground mt-1">Recorder-compliant trust documents</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-create-instrument">New Instrument</Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create Trust Instrument</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 mt-2">
              <div>
                <Label htmlFor="title">Title</Label>
                <Input id="title" data-testid="input-title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="type">Type</Label>
                  <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                    <SelectTrigger data-testid="select-type"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="trust_deed">Trust Deed</SelectItem>
                      <SelectItem value="allotment_lease">Allotment Lease</SelectItem>
                      <SelectItem value="trust_transfer">Trust Transfer</SelectItem>
                      <SelectItem value="nfr">NFR</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="template">Template (optional)</Label>
                  <Select value={form.templateKey || "__none__"} onValueChange={(v) => setForm({ ...form, templateKey: v === "__none__" ? "" : v })}>
                    <SelectTrigger data-testid="select-template"><SelectValue placeholder="Select template" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">None</SelectItem>
                      {templates.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="jurisdiction">Jurisdiction</Label>
                  <Input id="jurisdiction" data-testid="input-jurisdiction" value={form.jurisdiction} onChange={(e) => setForm({ ...form, jurisdiction: e.target.value })} />
                </div>
                <div>
                  <Label htmlFor="state">State</Label>
                  <Input id="state" data-testid="input-state" value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} />
                </div>
              </div>
              <div>
                <Label htmlFor="landDescription">Land Description</Label>
                <Textarea id="landDescription" data-testid="input-land-description" value={form.landDescription} onChange={(e) => setForm({ ...form, landDescription: e.target.value })} rows={3} />
              </div>
              <div>
                <Label htmlFor="trusteeNotes">Trustee Notes</Label>
                <Textarea id="trusteeNotes" data-testid="input-trustee-notes" value={form.trusteeNotes} onChange={(e) => setForm({ ...form, trusteeNotes: e.target.value })} rows={2} />
              </div>
              <div className="flex gap-4 text-sm">
                {[
                  { key: "indianLandProtection", label: "Indian Land Protection" },
                  { key: "trustStatus", label: "Trust Status" },
                  { key: "federalPreemption", label: "Federal Preemption" },
                  { key: "tribalJurisdiction", label: "Tribal Jurisdiction" },
                ].map(({ key, label }) => (
                  <label key={key} className="flex items-center gap-1 cursor-pointer">
                    <input type="checkbox" checked={form[key as keyof typeof form] as boolean} onChange={(e) => setForm({ ...form, [key]: e.target.checked })} />
                    {label}
                  </label>
                ))}
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                <Button type="submit" data-testid="button-submit-instrument" disabled={createInstrument.isPending}>
                  {createInstrument.isPending ? "Generating PDF…" : "Create & Generate PDF"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="space-y-3">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-16" />)}</div>
      ) : (instruments ?? []).length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">No trust instruments yet.</CardContent></Card>
      ) : (
        <div className="space-y-3">
          {(instruments ?? []).map((inst) => (
            <Card key={inst.id} data-testid={`instrument-card-${inst.id}`} className="hover:border-primary transition-colors">
              <CardContent className="flex items-center justify-between py-4">
                <div className="flex-1 min-w-0">
                  <Link href={`/instruments/${inst.id}`}>
                    <h3 className="font-semibold text-foreground hover:text-primary cursor-pointer truncate">{inst.title}</h3>
                  </Link>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <span className="text-xs text-muted-foreground">{inst.instrumentType}</span>
                    {inst.jurisdiction && <span className="text-xs text-muted-foreground">· {inst.jurisdiction}</span>}
                    {inst.county && <span className="text-xs text-muted-foreground">· {inst.county}, {inst.state}</span>}
                    <span className="text-xs text-muted-foreground">· {new Date(inst.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
                <div className="flex items-center gap-3 ml-4">
                  <Badge variant={statusColor(inst.status) as any}>{inst.status}</Badge>
                  {inst.pdfUrl && (
                    <Button size="sm" variant="outline" data-testid={`button-pdf-${inst.id}`} onClick={async () => {
                      const token = getCurrentBearerToken() ?? "";
                      const r = await fetch(`/api/trust/instruments/${inst.id}/pdf`, { headers: { Authorization: `Bearer ${token}` } });
                      const blob = await r.blob();
                      const url = URL.createObjectURL(blob);
                      window.open(url);
                    }}>
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
