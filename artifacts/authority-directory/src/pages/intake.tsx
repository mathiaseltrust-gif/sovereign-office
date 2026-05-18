import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useMutation } from "@tanstack/react-query";
import {
  FileSearch, AlertTriangle, Copy, Download, Save,
  CheckCircle2, Clock, ShieldAlert, BookMarked, Building2,
  FileText, ChevronDown, ChevronUp, Loader2,
} from "lucide-react";
import { api, IntakeExtraction } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

const URGENCY_COLORS: Record<string, string> = {
  critical: "text-red-600 bg-red-50 border-red-200",
  high: "text-orange-600 bg-orange-50 border-orange-200",
  medium: "text-amber-700 bg-amber-50 border-amber-200",
  low: "text-emerald-700 bg-emerald-50 border-emerald-200",
  routine: "text-blue-700 bg-blue-50 border-blue-200",
};

function PendingBadge() {
  return (
    <Badge variant="outline" className="text-amber-700 border-amber-300 bg-amber-50 text-xs gap-1">
      <Clock className="h-3 w-3" /> Pending Review
    </Badge>
  );
}

interface ResultBlockProps {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
  className?: string;
}

function ResultBlock({ icon, title, children, className }: ResultBlockProps) {
  return (
    <div className={cn("bg-card border border-card-border rounded-lg overflow-hidden", className)}>
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2 text-sm font-medium text-foreground">
          {icon}
          {title}
        </div>
        <PendingBadge />
      </div>
      <div className="px-4 py-3">{children}</div>
    </div>
  );
}

function AnalysisResults({ result }: { result: IntakeExtraction }) {
  const { toast } = useToast();

  function copyResult() {
    const text = [
      `AUTHORITY DIRECTORY — INTAKE ANALYSIS`,
      `Date: ${new Date(result.createdAt).toLocaleString()}`,
      `Urgency: ${result.urgencyLevel.toUpperCase()}`,
      ``,
      `DETECTED MATTER TYPES`,
      result.detectedMatterTypes.join(", "),
      ``,
      `SUGGESTED AGENCIES`,
      result.suggestedAgencies.join("\n"),
      ``,
      `ROUTING RECOMMENDATIONS`,
      result.routingRecommendations.join("\n"),
      ``,
      `SOVEREIGNTY FLAGS`,
      result.sovereigntyFlags.join("\n"),
      ``,
      `SUMMARY`,
      result.summary ?? "(none)",
    ].join("\n");
    navigator.clipboard.writeText(text).then(() => {
      toast({ title: "Copied to clipboard", description: "Analysis summary copied." });
    });
  }

  function exportPdf() {
    toast({
      title: "PDF Export",
      description: "PDF generation for intake analysis coming soon.",
    });
  }

  const urgencyClass = URGENCY_COLORS[result.urgencyLevel] ?? "text-muted-foreground bg-muted border-muted";

  return (
    <div className="space-y-4 mt-6">
      {/* Urgency banner */}
      <div className={cn("flex items-center justify-between rounded-lg border px-4 py-3", urgencyClass)}>
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4" />
          <span className="text-sm font-semibold uppercase tracking-wide">
            Urgency Level: {result.urgencyLevel}
          </span>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={copyResult} className="gap-1.5">
            <Copy className="h-3.5 w-3.5" /> Copy
          </Button>
          <Button size="sm" variant="outline" onClick={exportPdf} className="gap-1.5">
            <Download className="h-3.5 w-3.5" /> Export PDF
          </Button>
        </div>
      </div>

      {/* Block 1: Detected Matter Types */}
      <ResultBlock
        icon={<FileText className="h-4 w-4 text-primary" />}
        title="Detected Matter Types"
      >
        {result.detectedMatterTypes.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {result.detectedMatterTypes.map((m) => (
              <Badge key={m} variant="secondary" className="font-mono text-xs">{m}</Badge>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground italic">None detected</p>
        )}
      </ResultBlock>

      {/* Block 2: Suggested Agencies */}
      <ResultBlock
        icon={<Building2 className="h-4 w-4 text-accent" />}
        title="Suggested Agencies"
      >
        {result.suggestedAgencies.length > 0 ? (
          <ul className="space-y-1">
            {result.suggestedAgencies.map((a, i) => (
              <li key={i} className="text-sm text-foreground flex items-start gap-2">
                <span className="text-muted-foreground mt-0.5 shrink-0">•</span>
                {a}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-muted-foreground italic">No agencies suggested</p>
        )}
      </ResultBlock>

      {/* Block 3: Routing Recommendations */}
      <ResultBlock
        icon={<CheckCircle2 className="h-4 w-4 text-emerald-600" />}
        title="Routing Recommendations"
      >
        {result.routingRecommendations.length > 0 ? (
          <ol className="space-y-2">
            {result.routingRecommendations.map((r, i) => (
              <li key={i} className="text-sm text-foreground flex gap-2">
                <span className="text-xs font-mono text-muted-foreground w-5 shrink-0 pt-0.5">
                  {i + 1}.
                </span>
                <span>{r}</span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-xs text-muted-foreground italic">No routing recommendations</p>
        )}
      </ResultBlock>

      {/* Block 4: Sovereignty Flags */}
      <ResultBlock
        icon={<ShieldAlert className="h-4 w-4 text-amber-600" />}
        title="Sovereignty Flags"
      >
        {result.sovereigntyFlags.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {result.sovereigntyFlags.map((f, i) => (
              <Badge key={i} variant="outline" className="text-xs text-amber-700 border-amber-300">
                {f}
              </Badge>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground italic">No sovereignty flags raised</p>
        )}
      </ResultBlock>

      {/* Block 5: Summary & Key Entities */}
      <ResultBlock
        icon={<BookMarked className="h-4 w-4 text-muted-foreground" />}
        title="Summary & Key Entities"
      >
        {result.summary && (
          <p className="text-sm text-foreground mb-3 leading-relaxed">{result.summary}</p>
        )}
        {result.keyEntities.length > 0 && (
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1.5">Key Entities Detected</p>
            <div className="flex flex-wrap gap-1">
              {result.keyEntities.map((e, i) => (
                <Badge key={i} variant="secondary" className="text-xs">{e}</Badge>
              ))}
            </div>
          </div>
        )}
        {result.jurisdictionHints.length > 0 && (
          <div className="mt-2.5">
            <p className="text-xs font-medium text-muted-foreground mb-1.5">Jurisdiction Hints</p>
            <div className="flex flex-wrap gap-1">
              {result.jurisdictionHints.map((j, i) => (
                <Badge key={i} variant="outline" className="text-xs">{j}</Badge>
              ))}
            </div>
          </div>
        )}
        {!result.summary && result.keyEntities.length === 0 && (
          <p className="text-xs text-muted-foreground italic">No summary available</p>
        )}
      </ResultBlock>

      {/* Actions row */}
      <div className="flex flex-wrap gap-2 pt-1">
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5"
          onClick={() => {
            toast({ title: "Saved", description: `Intake record #${result.id} has been saved.` });
          }}
        >
          <Save className="h-3.5 w-3.5" /> Save Intake Record
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="gap-1.5 opacity-50 cursor-not-allowed"
          disabled
          title="Draft Notice — contact Chief for authorization"
        >
          <FileText className="h-3.5 w-3.5" /> Draft Notice (Pending Authorization)
        </Button>
      </div>
    </div>
  );
}

export default function IntakePage() {
  const [documentText, setDocumentText] = useState("");
  const [stateCode, setStateCode] = useState(() => sessionStorage.getItem("ad_state") ?? "");
  const [county, setCounty] = useState(() => sessionStorage.getItem("ad_county") ?? "");
  const [historyOpen, setHistoryOpen] = useState(false);
  const [savedId, setSavedId] = useState<number | null>(null);

  const { data: jurisdiction } = useQuery({
    queryKey: ["jurisdiction"],
    queryFn: () => api.getJurisdiction(),
  });

  const { data: savedResult } = useQuery({
    queryKey: ["intake", savedId],
    queryFn: () => api.getIntake(savedId!),
    enabled: savedId !== null,
  });

  const analyzeMutation = useMutation({
    mutationFn: (input: { documentText: string; stateCode?: string; county?: string }) =>
      api.analyzeIntake(input),
    onSuccess: (data) => setSavedId(data.id),
  });

  const states = jurisdiction?.states ?? [];
  const counties = (jurisdiction?.counties ?? []).filter(
    (c) => !stateCode || c.stateCode === stateCode
  );

  const activeResult = analyzeMutation.data ?? savedResult ?? null;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <FileSearch className="h-5 w-5 text-primary" />
          <h1 className="text-xl font-semibold text-foreground">Document Intake Analysis</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Paste a document or description to detect matter types, sovereignty flags, and generate routing recommendations.
        </p>
      </div>

      {/* Input form */}
      <div className="bg-card border border-card-border rounded-lg p-4 space-y-4">
        {/* Jurisdiction filters */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-foreground mb-1">State (optional)</label>
            <select
              className="w-full text-sm rounded-md border border-input bg-background px-3 py-2 text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              value={stateCode}
              onChange={(e) => { setStateCode(e.target.value); setCounty(""); sessionStorage.setItem("ad_state", e.target.value); }}
            >
              <option value="">Any State</option>
              {states.map((s) => (
                <option key={s.code} value={s.code}>{s.name} ({s.code})</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-foreground mb-1">County (optional)</label>
            <select
              className="w-full text-sm rounded-md border border-input bg-background px-3 py-2 text-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50"
              value={county}
              onChange={(e) => { setCounty(e.target.value); sessionStorage.setItem("ad_county", e.target.value); }}
              disabled={!stateCode}
            >
              <option value="">Any County</option>
              {counties.map((c) => (
                <option key={c.name} value={c.name}>{c.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Document text */}
        <div>
          <label className="block text-xs font-medium text-foreground mb-1">
            Document Text or Description
          </label>
          <textarea
            className="w-full text-sm rounded-md border border-input bg-background px-3 py-2.5 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-none"
            rows={8}
            placeholder="Paste the full document text or describe the matter here. The engine will identify applicable matter types, relevant agencies, sovereignty implications, and recommended routing steps…"
            value={documentText}
            onChange={(e) => setDocumentText(e.target.value)}
          />
          <p className="text-xs text-muted-foreground mt-1">
            {documentText.length} characters · Minimum 20 characters required
          </p>
        </div>

        {/* Analyze button */}
        <div className="flex justify-end">
          <Button
            onClick={() =>
              analyzeMutation.mutate({
                documentText,
                stateCode: stateCode || undefined,
                county: county || undefined,
              })
            }
            disabled={documentText.trim().length < 20 || analyzeMutation.isPending}
            className="gap-2"
          >
            {analyzeMutation.isPending ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Analyzing…</>
            ) : (
              <><FileSearch className="h-4 w-4" /> Analyze Document</>
            )}
          </Button>
        </div>

        {/* Error */}
        {analyzeMutation.isError && (
          <div className="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2 text-sm text-destructive">
            Analysis failed: {(analyzeMutation.error as Error).message}
          </div>
        )}
      </div>

      {/* Results */}
      {activeResult && <AnalysisResults result={activeResult} />}

      {/* History toggle */}
      {savedId && !activeResult && (
        <div className="mt-4">
          <button
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
            onClick={() => setHistoryOpen(!historyOpen)}
          >
            {historyOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            View last saved intake (#{savedId})
          </button>
        </div>
      )}
    </div>
  );
}
