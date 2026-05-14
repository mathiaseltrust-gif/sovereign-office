import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { getCurrentBearerToken } from "@/components/auth-provider";
import { Link } from "wouter";
import { FileText, Download, Eye, Edit2, Search, FolderOpen, CheckCircle, Clock, XCircle, AlertCircle } from "lucide-react";

const API = import.meta.env.VITE_API_BASE_URL ?? "";

interface Instrument {
  id: number;
  title: string;
  instrumentType: string;
  status: string;
  jurisdiction: string | null;
  state: string | null;
  county: string | null;
  landClassification: string | null;
  pdfUrl: string | null;
  validationErrors: unknown;
  createdAt: string;
  updatedAt: string;
  recorderMetadata?: {
    filingNumber?: string;
    documentType?: string;
    county?: string;
    state?: string;
  };
}

type Category =
  | "all"
  | "trust_deed"
  | "tribal_resolution"
  | "gwe_letter"
  | "tribal_id"
  | "court_document"
  | "doctrine"
  | "other";

const CATEGORY_LABELS: Record<Category, string> = {
  all: "All Documents",
  trust_deed: "Trust Deeds",
  tribal_resolution: "Tribal Resolutions",
  gwe_letter: "GWE Letters",
  tribal_id: "Tribal IDs",
  court_document: "Court Documents",
  doctrine: "Doctrine Instruments",
  other: "Other",
};

const CATEGORY_TYPES: Record<Exclude<Category, "all">, string[]> = {
  trust_deed: ["trust_deed", "trust_instrument", "warranty_deed", "quitclaim_deed", "deed_of_trust"],
  tribal_resolution: ["tribal_resolution", "resolution"],
  gwe_letter: ["gwe_letter", "gwe"],
  tribal_id: ["tribal_id", "id_card"],
  court_document: ["court_document", "motion", "petition", "order", "judgment", "subpoena"],
  doctrine: ["doctrine", "worcester", "snyder", "federal_preemption"],
  other: [],
};

function categorize(instrument: Instrument): Category {
  const t = (instrument.instrumentType ?? "").toLowerCase();
  for (const [cat, types] of Object.entries(CATEGORY_TYPES) as [Exclude<Category, "all">, string[]][]) {
    if (types.some((type) => t.includes(type))) return cat;
  }
  return "other";
}

function statusBadge(status: string) {
  switch (status) {
    case "valid":
      return <Badge variant="outline" className="text-green-700 border-green-400 bg-green-50"><CheckCircle className="h-3 w-3 mr-1" />Valid</Badge>;
    case "filed":
      return <Badge variant="default" className="bg-blue-700"><CheckCircle className="h-3 w-3 mr-1" />Filed</Badge>;
    case "submitted":
      return <Badge variant="outline" className="text-blue-700 border-blue-400"><Clock className="h-3 w-3 mr-1" />Submitted</Badge>;
    case "draft":
      return <Badge variant="secondary"><Edit2 className="h-3 w-3 mr-1" />Draft</Badge>;
    case "rejected":
      return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Rejected</Badge>;
    default:
      return <Badge variant="outline"><AlertCircle className="h-3 w-3 mr-1" />{status}</Badge>;
  }
}

function EditInstrumentModal({
  instrument,
  open,
  onClose,
  onSaved,
}: {
  instrument: Instrument;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [fields, setFields] = useState({
    title: instrument.title,
    trusteeNotes: "",
    filingNumber: instrument.recorderMetadata?.filingNumber ?? "",
    county: instrument.county ?? instrument.recorderMetadata?.county ?? "",
    state: instrument.state ?? instrument.recorderMetadata?.state ?? "",
  });

  async function handleSave() {
    setSaving(true);
    try {
      const token = await getCurrentBearerToken();
      const res = await fetch(`${API}/api/trust/instruments/${instrument.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          title: fields.title,
          ...(fields.trusteeNotes ? { trusteeNotes: fields.trusteeNotes } : {}),
          recorderMetadata: {
            filingNumber: fields.filingNumber || undefined,
            county: fields.county || undefined,
            state: fields.state || undefined,
          },
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error ?? "Failed to save");
      }
      toast({ title: "Saved", description: "Instrument updated. Regenerate the PDF to apply changes." });
      onSaved();
      onClose();
    } catch (e) {
      toast({ title: "Error", description: String(e), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit Before Signing — {instrument.title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div>
            <Label>Document Title</Label>
            <Input value={fields.title} onChange={(e) => setFields((f) => ({ ...f, title: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>County</Label>
              <Input value={fields.county} onChange={(e) => setFields((f) => ({ ...f, county: e.target.value }))} placeholder="e.g. Thurston" />
            </div>
            <div>
              <Label>State</Label>
              <Input value={fields.state} onChange={(e) => setFields((f) => ({ ...f, state: e.target.value }))} placeholder="e.g. WA" />
            </div>
          </div>
          <div>
            <Label>Filing Number <span className="text-muted-foreground text-xs">(assigned by officer)</span></Label>
            <Input value={fields.filingNumber} onChange={(e) => setFields((f) => ({ ...f, filingNumber: e.target.value }))} placeholder="e.g. 2025-TI-0042" />
          </div>
          <div>
            <Label>Trustee Notes <span className="text-muted-foreground text-xs">(appended to PDF)</span></Label>
            <Textarea
              value={fields.trusteeNotes}
              onChange={(e) => setFields((f) => ({ ...f, trusteeNotes: e.target.value }))}
              rows={3}
              placeholder="Any notes to add before generating the final PDF…"
            />
          </div>
          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">
            Saving will mark this instrument as <strong>Draft</strong> and clear the existing PDF. You must regenerate the PDF after editing.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Saving…" : "Save Changes"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function InstrumentRow({ instrument, onRefresh }: { instrument: Instrument; onRefresh: () => void }) {
  const { toast } = useToast();
  const [editOpen, setEditOpen] = useState(false);
  const [regenerating, setRegenerating] = useState(false);

  const meta = instrument.recorderMetadata ?? {};
  const canEdit = instrument.status !== "filed" && instrument.status !== "submitted";
  const hasPdf = !!instrument.pdfUrl;

  async function handleDownload() {
    try {
      const token = await getCurrentBearerToken();
      const res = await fetch(`${API}/api/trust/instruments/${instrument.id}/pdf`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error("PDF not available");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank");
    } catch {
      toast({ title: "No PDF", description: "Generate the PDF first from the instrument detail.", variant: "destructive" });
    }
  }

  async function handleRegenerate() {
    setRegenerating(true);
    try {
      const token = await getCurrentBearerToken();
      const res = await fetch(`${API}/api/trust/instruments/${instrument.id}/generate-pdf`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error("Failed to regenerate");
      toast({ title: "PDF regenerated", description: "The updated PDF is ready to download." });
      onRefresh();
    } catch (e) {
      toast({ title: "Error", description: String(e), variant: "destructive" });
    } finally {
      setRegenerating(false);
    }
  }

  return (
    <>
      <div className="flex items-start justify-between gap-3 p-4 border rounded-lg bg-card hover:bg-muted/30 transition-colors">
        <div className="flex items-start gap-3 min-w-0">
          <FileText className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <Link href={`/instruments/${instrument.id}`} className="font-medium text-sm hover:underline truncate">
                {instrument.title}
              </Link>
              {statusBadge(instrument.status)}
              {meta.filingNumber && (
                <span className="text-xs text-muted-foreground font-mono bg-muted px-1.5 py-0.5 rounded">
                  #{meta.filingNumber}
                </span>
              )}
            </div>
            <div className="text-xs text-muted-foreground mt-1 space-x-3">
              <span>{instrument.instrumentType?.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}</span>
              {(instrument.county || instrument.state) && (
                <span>{[instrument.county, instrument.state].filter(Boolean).join(", ")}</span>
              )}
              {instrument.landClassification && <span>{instrument.landClassification}</span>}
              <span>{new Date(instrument.createdAt).toLocaleDateString()}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {canEdit && (
            <Button size="sm" variant="ghost" onClick={() => setEditOpen(true)} title="Edit before signing">
              <Edit2 className="h-4 w-4" />
            </Button>
          )}
          {instrument.status === "draft" && (
            <Button size="sm" variant="ghost" onClick={handleRegenerate} disabled={regenerating} title="Regenerate PDF">
              {regenerating ? <Clock className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />}
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={handleDownload} disabled={!hasPdf} title={hasPdf ? "Download PDF" : "No PDF yet"}>
            <Download className="h-4 w-4" />
          </Button>
        </div>
      </div>
      {editOpen && (
        <EditInstrumentModal
          instrument={instrument}
          open={editOpen}
          onClose={() => setEditOpen(false)}
          onSaved={onRefresh}
        />
      )}
    </>
  );
}

export default function DocumentsPage() {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<Category>("all");

  const { data: instruments = [], isLoading, refetch } = useQuery<Instrument[]>({
    queryKey: ["documents-all-instruments"],
    queryFn: async () => {
      const token = await getCurrentBearerToken();
      const res = await fetch(`${API}/api/trust/instruments`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error("Failed to load documents");
      return res.json();
    },
  });

  const filtered = instruments.filter((inst) => {
    const matchesSearch =
      !search ||
      inst.title.toLowerCase().includes(search.toLowerCase()) ||
      inst.instrumentType?.toLowerCase().includes(search.toLowerCase()) ||
      (inst.county ?? "").toLowerCase().includes(search.toLowerCase()) ||
      ((inst.recorderMetadata as { filingNumber?: string })?.filingNumber ?? "").toLowerCase().includes(search.toLowerCase());
    const matchesTab = activeTab === "all" || categorize(inst) === activeTab;
    return matchesSearch && matchesTab;
  });

  const counts: Record<Category, number> = {
    all: instruments.length,
    trust_deed: 0,
    tribal_resolution: 0,
    gwe_letter: 0,
    tribal_id: 0,
    court_document: 0,
    doctrine: 0,
    other: 0,
  };
  for (const inst of instruments) {
    const cat = categorize(inst);
    counts[cat]++;
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <FolderOpen className="h-6 w-6" />
            Files &amp; Documents
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            All sovereign trust instruments, filings, and generated documents — organized by category.
          </p>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder="Search by title, type, county, or filing number…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as Category)}>
        <TabsList className="flex-wrap h-auto gap-1">
          {(Object.keys(CATEGORY_LABELS) as Category[]).map((cat) => (
            <TabsTrigger key={cat} value={cat} className="text-xs">
              {CATEGORY_LABELS[cat]}
              {counts[cat] > 0 && (
                <span className="ml-1 text-muted-foreground">({counts[cat]})</span>
              )}
            </TabsTrigger>
          ))}
        </TabsList>

        {(Object.keys(CATEGORY_LABELS) as Category[]).map((cat) => (
          <TabsContent key={cat} value={cat} className="mt-4">
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => <Skeleton key={i} className="h-20 w-full" />)}
              </div>
            ) : filtered.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  <FileText className="h-10 w-10 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">No documents found{search ? " for this search" : " in this category"}.</p>
                  {cat === "all" && !search && (
                    <p className="text-xs mt-1">
                      Create trust instruments from the{" "}
                      <Link href="/instruments" className="underline">Instruments</Link> page.
                    </p>
                  )}
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2">
                {filtered.map((inst) => (
                  <InstrumentRow key={inst.id} instrument={inst} onRefresh={() => refetch()} />
                ))}
              </div>
            )}
          </TabsContent>
        ))}
      </Tabs>

      <Card className="bg-muted/30">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Filing Number Tip</CardTitle>
        </CardHeader>
        <CardContent className="text-xs text-muted-foreground">
          Use the <Edit2 className="h-3 w-3 inline" /> edit button on any draft or valid instrument to assign a filing number before regenerating the PDF.
          The filing number will appear in the top-right corner of every page of the generated PDF, compliant with county recorder requirements.
        </CardContent>
      </Card>
    </div>
  );
}
