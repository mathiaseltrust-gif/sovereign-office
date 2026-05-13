import { useState, useRef } from "react";
import { useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { getCurrentBearerToken } from "@/components/auth-provider";
import { Button } from "@/components/ui/button";
import { SovereignIntakeGuard } from "@/components/SovereignIntakeGuard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

interface SuggestedStructure {
  name: string;
  description: string;
  pros: string[];
  cons: string[];
  sovereigntyNotes: string;
}

interface AgencyContact {
  name: string;
  contact: string;
  purpose: string;
  url?: string;
}

interface WhatNextStep {
  step: number;
  action: string;
  agency: string;
  contact: string;
  timeframe: string;
}

interface AiAnalysis {
  summary: string;
  suggestedStructures: SuggestedStructure[];
  protections: string[];
  agenciesToContact: AgencyContact[];
  planOutline: Record<string, string>;
  modelCanvas: Record<string, string>;
  provisions: string[];
  whatNextSteps: WhatNextStep[];
  _tier?: string;
}

const STEP_LABELS = [
  "Your Idea",
  "Structure",
  "Business Plan",
  "Legal Provisions",
  "What Next",
];

function StepIndicator({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center gap-2 mb-8">
      {Array.from({ length: total }).map((_, i) => (
        <div key={i} className="flex items-center gap-2">
          <div className={[
            "w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 shrink-0",
            i < current ? "bg-primary text-primary-foreground border-primary" :
            i === current ? "border-primary text-primary" :
            "border-muted-foreground/30 text-muted-foreground",
          ].join(" ")}>
            {i < current ? "✓" : i + 1}
          </div>
          {i < total - 1 && (
            <div className={["h-0.5 w-8 shrink-0", i < current ? "bg-primary" : "bg-muted-foreground/20"].join(" ")} />
          )}
        </div>
      ))}
      <span className="ml-2 text-sm font-medium text-muted-foreground">{STEP_LABELS[current]}</span>
    </div>
  );
}

export default function BusinessCanvasWizard() {
  const [step, setStep] = useState(0);
  const [ideaText, setIdeaText] = useState("");
  const [conceptTitle, setConceptTitle] = useState("");
  const [analysis, setAnalysis] = useState<AiAnalysis | null>(null);
  const [selectedStructure, setSelectedStructure] = useState("");
  const [planOutline, setPlanOutline] = useState<Record<string, string>>({});
  const [modelCanvas, setModelCanvas] = useState<Record<string, string>>({});
  const [analyzing, setAnalyzing] = useState(false);
  const [patching, setPatching] = useState(false);
  const [guardCleared, setGuardCleared] = useState(false);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const uploadFileRef = useRef<HTMLInputElement>(null);
  const conceptIdRef = useRef<number | null>(null);
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const form = new FormData();
      form.append("file", file);
      const token = getCurrentBearerToken() ?? "";
      const r = await fetch("/api/intake/upload", {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: form,
      });
      if (!r.ok) {
        const err = await r.json().catch(() => ({ error: "Upload failed" })) as { error?: string };
        throw new Error(err.error ?? "Upload failed");
      }
      return r.json() as Promise<{ text: string; filename: string; file_type: string; char_count: number }>;
    },
    onSuccess: (data) => {
      if (data.text && data.text.trim().length > 0) {
        setIdeaText((prev) => prev ? `${prev}\n\n---\n\n${data.text.trim()}` : data.text.trim());
        setUploadedFileName(data.filename);
        if (!conceptTitle && data.filename) {
          const name = data.filename.replace(/\.[^/.]+$/, "").replace(/[_-]/g, " ");
          setConceptTitle(name);
        }
        toast({ title: `Document extracted`, description: `${data.char_count.toLocaleString()} characters from "${data.filename}" added to the description.` });
      } else {
        toast({ title: "Nothing extracted", description: "The file had no readable text. Try a PDF with text or a typed document.", variant: "destructive" });
      }
    },
    onError: (err: Error) => {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    },
  });

  async function runAnalysis() {
    if (!ideaText.trim() || ideaText.trim().length < 10) {
      toast({ title: "Please describe your idea in more detail", variant: "destructive" });
      return;
    }
    setAnalyzing(true);
    try {
      const token = getCurrentBearerToken() ?? "";
      const res = await fetch("/api/business/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ ideaText, structure: selectedStructure || undefined }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json() as AiAnalysis;
      setAnalysis(data);
      setPlanOutline(data.planOutline ?? {});
      setModelCanvas(data.modelCanvas ?? {});
      const title = conceptTitle.trim() || ideaText.trim().substring(0, 60);

      const createRes = await fetch("/api/business/concepts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description: ideaText,
          status: "draft",
          aiSummary: data.summary,
          suggestedStructures: data.suggestedStructures,
          protections: data.protections,
          agenciesToContact: data.agenciesToContact,
          planOutline: data.planOutline,
          modelCanvas: data.modelCanvas,
          provisions: data.provisions,
          whatNextSteps: data.whatNextSteps,
        }),
      });
      if (!createRes.ok) throw new Error("Failed to save concept");
      const created = await createRes.json() as { id: number; title: string };
      conceptIdRef.current = created.id;
      if (!conceptTitle) setConceptTitle(title);

      toast({ title: "Analysis complete — concept file created" });
      setStep(1);
    } catch {
      toast({ title: "AI analysis failed", description: "Please try again.", variant: "destructive" });
    } finally {
      setAnalyzing(false);
    }
  }

  async function saveStructure() {
    const id = conceptIdRef.current;
    if (!id || !analysis) return;
    const structure = selectedStructure || analysis.suggestedStructures[0]?.name || "";
    setPatching(true);
    try {
      await fetch(`/api/business/concepts/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ structure }),
      });
    } catch {
      toast({ title: "Could not save structure selection", variant: "destructive" });
    } finally {
      setPatching(false);
    }
    setStep(2);
  }

  async function savePlanModel() {
    const id = conceptIdRef.current;
    if (!id) return;
    setPatching(true);
    try {
      await fetch(`/api/business/concepts/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planOutline, modelCanvas }),
      });
    } catch {
      toast({ title: "Could not autosave plan", variant: "destructive" });
    } finally {
      setPatching(false);
    }
    setStep(3);
  }

  function goToDetail() {
    const id = conceptIdRef.current;
    if (id) navigate(`/business-canvas/${id}`);
  }

  return (
    <div data-testid="page-business-canvas-wizard" className="max-w-3xl mx-auto">
      <div className="mb-6 flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate("/business-canvas")}>
          ← Back
        </Button>
        <div>
          <h1 className="text-2xl font-serif font-bold">New Business Idea</h1>
          <p className="text-sm text-muted-foreground">AI-guided sovereign business formation</p>
        </div>
      </div>

      {!guardCleared && (
        <SovereignIntakeGuard
          intakeType="business"
          onClear={() => setGuardCleared(true)}
        />
      )}

      <StepIndicator current={step} total={5} />

      {step === 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Step 1 — What is your business idea?</CardTitle>
            <p className="text-sm text-muted-foreground">
              Describe your idea in plain language. Our AI will analyze it, suggest sovereign business structures, protections, and a full formation plan — and create your Concept File immediately.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="title">Concept Title (optional)</Label>
              <Input
                id="title"
                placeholder="e.g. Tribal Eco-Tourism Enterprise"
                value={conceptTitle}
                onChange={(e) => setConceptTitle(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <Label htmlFor="idea">Describe Your Idea *</Label>
                <div className="flex items-center gap-2">
                  {uploadedFileName && !uploadMutation.isPending && (
                    <span className="text-xs text-muted-foreground truncate max-w-[160px]">{uploadedFileName}</span>
                  )}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="text-xs h-7 px-3"
                    onClick={() => uploadFileRef.current?.click()}
                    disabled={uploadMutation.isPending}
                  >
                    {uploadMutation.isPending ? "Extracting…" : "Upload Document"}
                  </Button>
                  <input
                    ref={uploadFileRef}
                    type="file"
                    accept=".pdf,.csv,.txt,.doc,.docx,.png,.jpg,.jpeg,.gif,.webp"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) uploadMutation.mutate(file);
                      e.target.value = "";
                    }}
                  />
                </div>
              </div>
              <Textarea
                id="idea"
                placeholder="Describe your business idea — what it does, who it serves, where it operates, and any initial thoughts on structure or goals…&#10;&#10;Or click 'Upload Document' above to extract text from a PDF, Word doc, or image."
                value={ideaText}
                onChange={(e) => setIdeaText(e.target.value)}
                className="min-h-[160px]"
              />
              <div className="flex items-center justify-between mt-1">
                <p className="text-xs text-muted-foreground">{ideaText.length} characters</p>
                {uploadMutation.isError && (
                  <p className="text-xs text-destructive">{(uploadMutation.error as Error).message}</p>
                )}
              </div>
            </div>
            <div className="flex justify-end">
              <Button onClick={runAnalysis} disabled={analyzing || ideaText.trim().length < 10} size="lg">
                {analyzing ? (
                  <><span className="animate-spin mr-2">⟳</span> Analyzing & creating concept file...</>
                ) : (
                  "Analyze with AI →"
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 1 && analysis && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <CardTitle>Step 2 — AI Analysis & Structure Selection</CardTitle>
                {analysis._tier === "azure_openai" && (
                  <Badge variant="default" className="text-xs">Azure AI</Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground">{analysis.summary}</p>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm font-semibold">Select your preferred business structure:</p>
              {analysis.suggestedStructures.map((s, i) => (
                <button
                  key={i}
                  type="button"
                  className={[
                    "w-full text-left rounded-lg border-2 p-4 transition-colors",
                    selectedStructure === s.name ? "border-primary bg-primary/5" : "border-muted hover:border-primary/50",
                  ].join(" ")}
                  onClick={() => setSelectedStructure(s.name)}
                >
                  <div className="flex items-start justify-between mb-1">
                    <span className="font-semibold text-sm">{s.name}</span>
                    {i === 0 && <Badge variant="secondary" className="text-xs shrink-0 ml-2">Recommended</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground mb-2">{s.description}</p>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="font-medium text-green-600">✓ Pros:</span>
                      <ul className="mt-0.5 space-y-0.5">
                        {s.pros.map((p, pi) => <li key={pi} className="text-muted-foreground">• {p}</li>)}
                      </ul>
                    </div>
                    <div>
                      <span className="font-medium text-amber-600">⚠ Cons:</span>
                      <ul className="mt-0.5 space-y-0.5">
                        {s.cons.map((c, ci) => <li key={ci} className="text-muted-foreground">• {c}</li>)}
                      </ul>
                    </div>
                  </div>
                  {s.sovereigntyNotes && (
                    <p className="mt-2 text-xs text-primary border-t pt-2">🛡️ {s.sovereigntyNotes}</p>
                  )}
                </button>
              ))}

              <div className="flex justify-between pt-2">
                <Button variant="outline" onClick={() => setStep(0)}>← Back</Button>
                <Button onClick={saveStructure} disabled={patching}>
                  {patching ? "Saving..." : selectedStructure ? "Continue →" : "Use Recommended →"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {step === 2 && analysis && (
        <Card>
          <CardHeader>
            <CardTitle>Step 3 — Business Plan & Model Canvas</CardTitle>
            <p className="text-sm text-muted-foreground">AI-drafted plan outline — edit inline to customize for your vision. Changes are autosaved when you continue.</p>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <h3 className="font-semibold mb-3 text-sm uppercase tracking-wider">Business Plan Outline</h3>
              <div className="space-y-3">
                {Object.entries(planOutline).map(([key, val]) => (
                  <div key={key}>
                    <Label className="capitalize text-xs font-semibold text-muted-foreground">{key.replace(/([A-Z])/g, " $1").trim()}</Label>
                    <Textarea
                      value={val}
                      onChange={(e) => setPlanOutline((prev) => ({ ...prev, [key]: e.target.value }))}
                      className="mt-1 text-sm min-h-[60px]"
                    />
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h3 className="font-semibold mb-3 text-sm uppercase tracking-wider">Business Model Canvas</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {Object.entries(modelCanvas).map(([key, val]) => (
                  <div key={key}>
                    <Label className="capitalize text-xs font-semibold text-muted-foreground">{key.replace(/([A-Z])/g, " $1").trim()}</Label>
                    <Textarea
                      value={val}
                      onChange={(e) => setModelCanvas((prev) => ({ ...prev, [key]: e.target.value }))}
                      className="mt-1 text-sm min-h-[60px]"
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-between pt-2">
              <Button variant="outline" onClick={() => setStep(1)}>← Back</Button>
              <Button onClick={savePlanModel} disabled={patching}>
                {patching ? "Saving..." : "Continue →"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 3 && analysis && (
        <Card>
          <CardHeader>
            <CardTitle>Step 4 — Legal & Protective Provisions</CardTitle>
            <p className="text-sm text-muted-foreground">
              Applicable tribal sovereign immunity provisions and federal Indian law protections for your chosen structure.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h3 className="text-sm font-semibold mb-2">Sovereign Protections</h3>
              <ul className="space-y-2">
                {analysis.protections.map((p, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <span className="text-primary mt-0.5 shrink-0">🛡️</span>
                    <span>{p}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h3 className="text-sm font-semibold mb-2">Legal Provisions to Include in Charter</h3>
              <ul className="space-y-2">
                {analysis.provisions.map((p, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <span className="text-amber-600 mt-0.5 shrink-0">§</span>
                    <span>{p}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="flex justify-between pt-2">
              <Button variant="outline" onClick={() => setStep(2)}>← Back</Button>
              <Button onClick={() => setStep(4)}>Continue →</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 4 && analysis && (
        <Card>
          <CardHeader>
            <CardTitle>Step 5 — What Next: Activation Checklist</CardTitle>
            <p className="text-sm text-muted-foreground">
              Your concept file is saved. Review the activation steps and open your Concept File to continue formation.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              {analysis.whatNextSteps.map((s, i) => (
                <div key={i} className="flex items-start gap-3 p-3 rounded-lg border bg-muted/20">
                  <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold shrink-0">
                    {s.step}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{s.action}</p>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1">
                      <span className="text-xs text-muted-foreground">📍 {s.agency}</span>
                      <span className="text-xs text-muted-foreground">📞 {s.contact}</span>
                      <span className="text-xs text-primary">⏱ {s.timeframe}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div>
              <h3 className="text-sm font-semibold mb-2">Agency Contacts</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {analysis.agenciesToContact.map((a, i) => (
                  <div key={i} className="p-3 rounded-lg border text-xs">
                    <p className="font-semibold">{a.name}</p>
                    <p className="text-muted-foreground">{a.purpose}</p>
                    <p className="text-primary mt-0.5">{a.contact}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-between pt-2">
              <Button variant="outline" onClick={() => setStep(3)}>← Back</Button>
              <Button onClick={goToDetail} size="lg">
                Open Concept File →
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
