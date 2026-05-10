import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/components/auth-provider";

interface Template { id: string; name: string; documentType: string; category: string; troSensitive: boolean; emergencyEligible: boolean }
interface CourtDoc {
  id: number; templateId: string; templateName: string; documentType: string; title: string;
  caseNumber: string | null; court: string | null; status: string; troSensitive: boolean;
  emergencyOrder: boolean; intakeFlags: Record<string, unknown>; createdAt: string; pdfUrl: string | null;
}

function makeToken(user: unknown) { return btoa(JSON.stringify(user)); }

function useTemplates() {
  const { user } = useAuth();
  return useQuery<Template[]>({
    queryKey: ["court-doc-templates"],
    queryFn: async () => {
      const r = await fetch("/api/court/documents/templates", { headers: { Authorization: `Bearer ${makeToken(user)}` } });
      if (!r.ok) throw new Error("Failed to load templates");
      return r.json();
    },
    staleTime: 120_000,
  });
}

function useCourtDocs() {
  const { user } = useAuth();
  return useQuery<CourtDoc[]>({
    queryKey: ["court-docs"],
    queryFn: async () => {
      const r = await fetch("/api/court/documents", { headers: { Authorization: `Bearer ${makeToken(user)}` } });
      if (!r.ok) throw new Error("Failed to load court documents");
      return r.json();
    },
    staleTime: 30_000,
  });
}

const DOC_TYPE_COLORS: Record<string, string> = {
  tro: "bg-red-700",
  icwa_notice: "bg-blue-700",
  protective_order: "bg-purple-700",
  trust_deed: "bg-amber-700",
  nfr: "bg-orange-700",
  jurisdictional_statement: "bg-slate-700",
  emergency_welfare: "bg-red-900",
};

export default function CourtDocumentsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: templates, isLoading: templatesLoading } = useTemplates();
  const { data: docs, isLoading: docsLoading } = useCourtDocs();

  const [selectedTemplate, setSelectedTemplate] = useState("__none__");
  const [caseNumber, setCaseNumber] = useState("");
  const [court, setCourt] = useState("");
  const [petitioner, setPetitioner] = useState("");
  const [respondent, setRespondent] = useState("");
  const [childName, setChildName] = useState("");
  const [tribe, setTribe] = useState("");
  const [notes, setNotes] = useState("");

  const generate = useMutation({
    mutationFn: async () => {
      const r = await fetch("/api/court/documents/generate", {
        method: "POST",
        headers: { Authorization: `Bearer ${makeToken(user)}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          templateId: selectedTemplate,
          caseDetails: { caseNumber, court, notes },
          parties: {
            ...(petitioner ? { Petitioner: petitioner } : {}),
            ...(respondent ? { Respondent: respondent } : {}),
            ...(childName ? { Child: childName } : {}),
            ...(tribe ? { Tribe: tribe } : {}),
          },
          vars: { caseNumber, court },
        }),
      });
      if (!r.ok) {
        const err = await r.json().catch(() => ({ error: "Generation failed" }));
        throw new Error(err.error ?? "Generation failed");
      }
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["court-docs"] });
      toast({ title: "Document generated", description: "Court document created successfully." });
      setCaseNumber(""); setCourt(""); setPetitioner(""); setRespondent(""); setChildName(""); setTribe(""); setNotes("");
      setSelectedTemplate("__none__");
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const downloadPdf = async (id: number) => {
    const r = await fetch(`/api/court/documents/${id}/pdf`, { headers: { Authorization: `Bearer ${makeToken(user)}` } });
    if (!r.ok) { toast({ title: "Error", description: "PDF not available.", variant: "destructive" }); return; }
    const blob = await r.blob();
    window.open(URL.createObjectURL(blob));
  };

  const selectedTpl = templates?.find(t => t.id === selectedTemplate);

  return (
    <div data-testid="page-court-documents">
      <div className="mb-8">
        <h1 className="text-3xl font-serif font-bold text-foreground">Court Documents</h1>
        <p className="text-muted-foreground mt-1">
          Unified document generator — TRO · ICWA Notice · Protective Orders · Trust Deeds · NFR · Emergency Declarations
        </p>
      </div>

      <Tabs defaultValue="generate">
        <TabsList className="mb-6">
          <TabsTrigger value="generate">Generate New</TabsTrigger>
          <TabsTrigger value="all">All Documents ({docs?.length ?? 0})</TabsTrigger>
          <TabsTrigger value="templates">Templates ({templates?.length ?? 0})</TabsTrigger>
        </TabsList>

        <TabsContent value="generate">
          <Card>
            <CardHeader><CardTitle className="text-base">Generate Court Document</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Document Template</Label>
                <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Select a template…" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Select a template…</SelectItem>
                    {templatesLoading
                      ? <SelectItem value="__loading__" disabled>Loading…</SelectItem>
                      : (templates ?? []).map(t => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.name} {t.troSensitive ? "⚑" : ""}
                        </SelectItem>
                      ))
                    }
                  </SelectContent>
                </Select>
                {selectedTpl && (
                  <div className="mt-2 flex gap-2">
                    <Badge className={`${DOC_TYPE_COLORS[selectedTpl.documentType] ?? "bg-slate-600"} text-white text-xs`}>
                      {selectedTpl.documentType.replace(/_/g, " ")}
                    </Badge>
                    <Badge variant="outline" className="text-xs">{selectedTpl.category}</Badge>
                    {selectedTpl.troSensitive && <Badge className="bg-red-700 text-white text-xs">TRO-Sensitive</Badge>}
                    {selectedTpl.emergencyEligible && <Badge className="bg-orange-600 text-white text-xs">Emergency Eligible</Badge>}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Case Number</Label>
                  <Input value={caseNumber} onChange={e => setCaseNumber(e.target.value)} placeholder="TC-2026-001" className="mt-1" />
                </div>
                <div>
                  <Label>Court</Label>
                  <Input value={court} onChange={e => setCourt(e.target.value)} placeholder="Tribal Court" className="mt-1" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Petitioner / Protected Person</Label>
                  <Input value={petitioner} onChange={e => setPetitioner(e.target.value)} className="mt-1" />
                </div>
                <div>
                  <Label>Respondent / Agency</Label>
                  <Input value={respondent} onChange={e => setRespondent(e.target.value)} className="mt-1" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Child Name (ICWA matters)</Label>
                  <Input value={childName} onChange={e => setChildName(e.target.value)} className="mt-1" />
                </div>
                <div>
                  <Label>Tribe</Label>
                  <Input value={tribe} onChange={e => setTribe(e.target.value)} className="mt-1" />
                </div>
              </div>

              <div>
                <Label>Notes / Additional Context</Label>
                <Input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Additional case context…" className="mt-1" />
              </div>

              <Button
                onClick={() => generate.mutate()}
                disabled={generate.isPending || selectedTemplate === "__none__"}
                className="w-full"
              >
                {generate.isPending ? "Generating…" : "Generate Document"}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="all">
          {docsLoading ? (
            <div className="space-y-3">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-16" />)}</div>
          ) : (docs ?? []).length === 0 ? (
            <Card><CardContent className="py-12 text-center text-muted-foreground">No court documents yet. Generate one from the Generate New tab.</CardContent></Card>
          ) : (
            <div className="space-y-3">
              {(docs ?? []).map(doc => (
                <Card key={doc.id} className={doc.troSensitive ? "border-red-200" : doc.emergencyOrder ? "border-red-400" : ""}>
                  <CardContent className="flex items-center justify-between py-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge className={`${DOC_TYPE_COLORS[doc.documentType] ?? "bg-slate-600"} text-white text-xs`}>
                          {doc.documentType.replace(/_/g, " ")}
                        </Badge>
                        <span className="font-semibold text-sm">{doc.title}</span>
                        {doc.troSensitive && <Badge className="bg-red-700 text-white text-xs">TRO-Sensitive</Badge>}
                        {doc.emergencyOrder && <Badge className="bg-red-900 text-white text-xs">EMERGENCY</Badge>}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {doc.caseNumber && <span>Case: {doc.caseNumber} · </span>}
                        {doc.court && <span>{doc.court} · </span>}
                        {new Date(doc.createdAt).toLocaleDateString()}
                        {(doc.intakeFlags as Record<string, unknown>)?.redFlag && (
                          <span className="ml-2 text-red-600 font-semibold">⚑ Red Flag</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 ml-4 shrink-0">
                      <Badge variant="outline" className="text-xs">{doc.status}</Badge>
                      <Button size="sm" variant="outline" onClick={() => downloadPdf(doc.id)}>PDF</Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="templates">
          {templatesLoading ? (
            <div className="space-y-3">{[...Array(6)].map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
          ) : (
            <div className="space-y-2">
              {(templates ?? []).map(t => (
                <Card key={t.id}>
                  <CardContent className="flex items-center justify-between py-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <Badge className={`${DOC_TYPE_COLORS[t.documentType] ?? "bg-slate-600"} text-white text-xs`}>
                          {t.documentType.replace(/_/g, " ")}
                        </Badge>
                        <span className="font-semibold text-sm">{t.name}</span>
                        {t.troSensitive && <Badge className="bg-red-700 text-white text-xs">TRO-Sensitive</Badge>}
                        {t.emergencyEligible && <Badge className="bg-orange-600 text-white text-xs">Emergency</Badge>}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">Category: {t.category} · ID: {t.id}</p>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => setSelectedTemplate(t.id)}>
                      Use Template
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
