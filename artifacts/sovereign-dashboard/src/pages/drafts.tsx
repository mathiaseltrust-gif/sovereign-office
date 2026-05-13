import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { getCurrentBearerToken } from "@/components/auth-provider";

type DocumentKind =
  | "court_document"
  | "tribal_affidavit"
  | "welfare_letter"
  | "nfr_notice"
  | "icwa_notice"
  | "trust_instrument"
  | "gwe_letter"
  | "tribal_resolution"
  | "identity_declaration"
  | "cease_and_desist";

type Jurisdiction = "tribal" | "county" | "state" | "federal";

interface DraftResult {
  tier: string;
  documentType: string;
  jurisdiction: string;
  title?: string;
  content: string;
  citations?: string[];
  warnings?: string[];
  recommendations?: string[];
  disclaimer?: string;
}

const DOC_KINDS: { value: DocumentKind; label: string; desc: string }[] = [
  { value: "court_document", label: "Court Document", desc: "General tribal court filing, motion, or order" },
  { value: "tribal_affidavit", label: "Tribal Affidavit", desc: "Sworn statement under tribal authority" },
  { value: "welfare_letter", label: "Welfare Letter", desc: "Tribal welfare determination or support letter" },
  { value: "nfr_notice", label: "Notice of Federal Review", desc: "NFR for federal / state agency actions affecting sovereignty" },
  { value: "icwa_notice", label: "ICWA Notice", desc: "ICWA mandatory notice for child custody proceedings" },
  { value: "trust_instrument", label: "Trust Instrument", desc: "Trust deed, declaration, or amendment" },
  { value: "gwe_letter", label: "GWE Letter", desc: "General Welfare Exclusion letter (25 U.S.C. § 117b)" },
  { value: "tribal_resolution", label: "Tribal Resolution", desc: "Formal resolution of the tribal government" },
  { value: "identity_declaration", label: "Identity Declaration", desc: "Sovereign identity affirmation document" },
  { value: "cease_and_desist", label: "Cease & Desist", desc: "Formal cease and desist under tribal sovereign authority" },
];

const JURISDICTIONS: { value: Jurisdiction; label: string }[] = [
  { value: "tribal", label: "Tribal (Internal)" },
  { value: "county", label: "County Court" },
  { value: "state", label: "State Court / Agency" },
  { value: "federal", label: "Federal Court / Agency" },
];

export default function DraftsPage() {
  const { toast } = useToast();
  const [docType, setDocType] = useState<DocumentKind>("court_document");
  const [jurisdiction, setJurisdiction] = useState<Jurisdiction>("tribal");
  const [notes, setNotes] = useState("");
  const [result, setResult] = useState<DraftResult | null>(null);
  const [copied, setCopied] = useState(false);

  const draftMutation = useMutation({
    mutationFn: async () => {
      const r = await fetch("/api/drafts/create", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${getCurrentBearerToken()}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ documentType: docType, jurisdiction, userNotes: notes }),
      });
      if (!r.ok) throw new Error(await r.text());
      return r.json() as Promise<DraftResult>;
    },
    onSuccess: (data) => {
      setResult(data);
      toast({ title: "Draft generated", description: `${DOC_KINDS.find(d => d.value === docType)?.label} ready for review.` });
    },
    onError: (err: Error) => toast({ title: "Draft failed", description: err.message, variant: "destructive" }),
  });

  function copyToClipboard() {
    if (!result) return;
    navigator.clipboard.writeText(result.content).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  const selectedKind = DOC_KINDS.find(d => d.value === docType);

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1">Sovereign Office</p>
        <h1 className="text-3xl font-serif font-bold">AI Document Drafting</h1>
        <p className="text-muted-foreground mt-1">
          Generate sovereign legal documents using the AI drafting engine. All drafts are grounded in your verified identity, lineage, and delegated authorities.
        </p>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Config panel */}
        <div className="space-y-5">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm uppercase tracking-widest text-muted-foreground">Document Type</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-1.5">
                {DOC_KINDS.map(({ value, label, desc }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setDocType(value)}
                    className={[
                      "w-full text-left rounded-md border px-3 py-2.5 transition-colors",
                      docType === value
                        ? "border-primary bg-primary/5"
                        : "border-transparent hover:border-border hover:bg-secondary/50",
                    ].join(" ")}
                  >
                    <p className="text-sm font-medium">{label}</p>
                    <p className="text-xs text-muted-foreground">{desc}</p>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm uppercase tracking-widest text-muted-foreground">Jurisdiction</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-2">
                {JURISDICTIONS.map(({ value, label }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setJurisdiction(value)}
                    className={[
                      "rounded-md border px-3 py-2 text-sm font-medium text-center transition-colors",
                      jurisdiction === value
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border hover:border-primary/50",
                    ].join(" ")}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          <div className="space-y-1.5">
            <Label htmlFor="notes">Additional Notes (optional)</Label>
            <Textarea
              id="notes"
              placeholder="Describe the specific situation, parties involved, dates, or any relevant facts the AI should include in the draft…"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              className="min-h-[120px]"
            />
          </div>

          <Button
            className="w-full"
            onClick={() => draftMutation.mutate()}
            disabled={draftMutation.isPending}
            size="lg"
          >
            {draftMutation.isPending
              ? <><span className="animate-spin mr-2">⟳</span> Generating Draft…</>
              : `Generate ${selectedKind?.label ?? "Document"}`}
          </Button>
        </div>

        {/* Result panel */}
        <div>
          {result ? (
            <Card className="h-full flex flex-col">
              <CardHeader className="pb-2 flex flex-row items-start justify-between">
                <div>
                  <CardTitle className="text-base font-serif">{result.title ?? selectedKind?.label}</CardTitle>
                  <div className="flex gap-2 mt-1 flex-wrap">
                    <Badge variant="outline" className="text-xs">{result.tier}</Badge>
                    <Badge variant="secondary" className="text-xs capitalize">{result.jurisdiction}</Badge>
                  </div>
                </div>
                <Button variant="outline" size="sm" className="shrink-0" onClick={copyToClipboard}>
                  {copied ? "Copied!" : "Copy"}
                </Button>
              </CardHeader>
              <CardContent className="flex-1 space-y-4 overflow-y-auto">
                <div className="rounded-md border bg-muted/30 p-4">
                  <pre className="text-xs whitespace-pre-wrap font-serif leading-relaxed">{result.content}</pre>
                </div>

                {result.citations && result.citations.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1">Legal Citations</p>
                    <ul className="space-y-1">
                      {result.citations.map((c, i) => {
                        const text = typeof c === "string"
                          ? c
                          : (c as Record<string, string>).citation
                            ?? (c as Record<string, string>).title
                            ?? JSON.stringify(c);
                        return <li key={i} className="text-xs font-mono text-muted-foreground">{text}</li>;
                      })}
                    </ul>
                  </div>
                )}

                {result.warnings && result.warnings.length > 0 && (
                  <div className="rounded-md border border-amber-200 bg-amber-50/50 p-3">
                    <p className="text-xs font-semibold text-amber-800 mb-1 uppercase tracking-widest">Warnings</p>
                    {result.warnings.map((w, i) => <p key={i} className="text-xs text-amber-700">{w}</p>)}
                  </div>
                )}

                {result.recommendations && result.recommendations.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1">Recommendations</p>
                    <ul className="space-y-1">
                      {result.recommendations.map((r, i) => (
                        <li key={i} className="text-xs flex gap-1.5"><span className="text-primary">→</span> {r}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {result.disclaimer && (
                  <p className="text-[10px] text-muted-foreground italic border-t pt-3">{result.disclaimer}</p>
                )}
              </CardContent>
            </Card>
          ) : (
            <Card className="h-full flex items-center justify-center min-h-[400px] border-dashed">
              <CardContent className="text-center text-muted-foreground py-12">
                <p className="text-4xl mb-4">📄</p>
                <p className="font-medium">No draft yet</p>
                <p className="text-sm mt-1 max-w-xs">
                  Select a document type and jurisdiction, add any relevant notes, then click Generate.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
