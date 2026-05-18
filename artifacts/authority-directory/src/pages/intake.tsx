import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  FileSearch, Clock, ShieldAlert, BookMarked, Building2,
  FileText, Loader2, Copy, AlertTriangle, CheckCircle2,
  ChevronRight, AlertCircle,
} from "lucide-react";
import { api, IntakeAnalysisResult, RoutingRecipient, ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { SessionExpiredBanner } from "@/App";

function PendingBadge() {
  return (
    <span className="inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded border border-amber-300 bg-amber-50 text-amber-800 font-medium">
      <Clock className="h-3 w-3" /> Pending Review
    </span>
  );
}

interface BlockProps {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
  className?: string;
}

function Block({ icon, title, children, className }: BlockProps) {
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

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div className="flex gap-2 text-xs">
      <span className="font-medium text-foreground w-40 shrink-0">{label}</span>
      <span className="text-muted-foreground">{value}</span>
    </div>
  );
}

function RecipientCard({ r, label }: { r: RoutingRecipient; label: string }) {
  return (
    <div className="rounded-md border border-border bg-muted/30 px-3 py-2 space-y-1">
      <p className="text-xs font-semibold text-foreground uppercase tracking-wide">{label}</p>
      <p className="text-sm font-medium text-foreground">{r.name}</p>
      {r.mailingAddress && (
        <p className="text-xs text-muted-foreground">{r.mailingAddress}</p>
      )}
      {r.phone && (
        <a href={`tel:${r.phone}`} className="text-xs text-primary hover:underline block">{r.phone}</a>
      )}
      {r.contact && (
        <a href={`mailto:${r.contact}`} className="text-xs text-primary hover:underline block">{r.contact}</a>
      )}
      {r.website && (
        <a href={r.website} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline block truncate">{r.website}</a>
      )}
    </div>
  );
}

function FlagChip({ label, active, color }: { label: string; active: boolean; color: string }) {
  if (!active) return null;
  return (
    <span className={cn("inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border font-medium", color)}>
      <ShieldAlert className="h-3 w-3" /> {label}
    </span>
  );
}

function AnalysisResults({ result }: { result: IntakeAnalysisResult }) {
  const { toast } = useToast();
  const rr = result.routingRecommendation;

  function copyResult() {
    const lines = [
      "AUTHORITY DIRECTORY — INTAKE ANALYSIS RESULT",
      `Record ID: ${result.id ?? "unsaved"}`,
      `Extraction Source: ${result.extractionSource}`,
      "",
      "EXTRACTED FIELDS",
      result.detectedEntityName ? `Entity: ${result.detectedEntityName}` : "",
      result.detectedAddress ? `Address: ${result.detectedAddress}` : "",
      result.detectedDeadline ? `Deadline: ${result.detectedDeadline}` : "",
      result.detectedAccountOrReferenceNumber ? `Reference #: ${result.detectedAccountOrReferenceNumber}` : "",
      result.detectedApn ? `APN: ${result.detectedApn}` : "",
      result.detectedState ? `State: ${result.detectedState}` : "",
      result.detectedCounty ? `County: ${result.detectedCounty}` : "",
      `Matter Type: ${result.detectedMatterType}`,
      `Action Type: ${result.detectedActionType}`,
      "",
      "PRIMARY RECIPIENT",
      rr.primaryRecipient ? rr.primaryRecipient.name : "Not identified",
      "",
      "OVERSIGHT / CC",
      rr.oversightRecipient ? rr.oversightRecipient.name : "Not identified",
      ...rr.ccList.map((c) => `CC: ${c}`),
      "",
      "LEGAL FLAGS",
      ...rr.legalFlagSummary,
      "",
      "SUGGESTED TEMPLATE",
      rr.suggestedTemplateKey ?? "None",
      rr.escalationPath ? `Escalation: ${rr.escalationPath}` : "",
      "",
      rr.disclaimer,
    ].filter((l) => l !== "").join("\n");

    navigator.clipboard.writeText(lines).then(() => {
      toast({ title: "Copied to clipboard", description: "Analysis summary copied." });
    });
  }

  return (
    <div className="space-y-4 mt-6">
      {/* Disclaimer banner */}
      <div className="flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3">
        <AlertTriangle className="h-4 w-4 text-amber-700 mt-0.5 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-amber-900 mb-0.5">Human review required before any action.</p>
          <p className="text-xs text-amber-800">{rr.disclaimer}</p>
        </div>
        <Button size="sm" variant="outline" onClick={copyResult} className="gap-1.5 shrink-0">
          <Copy className="h-3.5 w-3.5" /> Copy
        </Button>
      </div>

      {/* Block 1: Extracted Fields */}
      <Block icon={<FileText className="h-4 w-4 text-primary" />} title="Extracted Fields">
        <div className="space-y-1.5">
          <Field label="Entity / Issuer" value={result.detectedEntityName} />
          <Field label="Address" value={result.detectedAddress} />
          <Field label="Deadline / Due Date" value={result.detectedDeadline} />
          <Field label="Account / Reference #" value={result.detectedAccountOrReferenceNumber} />
          <Field label="Assessor Parcel (APN)" value={result.detectedApn} />
          <Field label="State" value={result.detectedState} />
          <Field label="County" value={result.detectedCounty} />
          <div className="flex gap-2 text-xs pt-1 border-t border-border mt-1">
            <span className="font-medium text-foreground w-40 shrink-0">Matter Type</span>
            <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono text-foreground">
              {result.detectedMatterType}
            </code>
          </div>
          <div className="flex gap-2 text-xs">
            <span className="font-medium text-foreground w-40 shrink-0">Action Type</span>
            <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono text-foreground">
              {result.detectedActionType}
            </code>
          </div>
          <div className="text-xs text-muted-foreground pt-1">
            Source: <span className="font-medium text-foreground">{result.extractionSource}</span>
            {result.id && (
              <> · Record ID: <span className="font-medium text-foreground">#{result.id}</span></>
            )}
          </div>
        </div>
      </Block>

      {/* Block 2: Primary Recipient */}
      <Block icon={<Building2 className="h-4 w-4 text-primary" />} title="Primary Recipient">
        {rr.primaryRecipient ? (
          <RecipientCard r={rr.primaryRecipient} label="Primary" />
        ) : (
          <p className="text-xs text-muted-foreground italic">
            No primary recipient identified — check Matter Type Reference for routing guidance.
          </p>
        )}
      </Block>

      {/* Block 3: Oversight & CC */}
      <Block icon={<CheckCircle2 className="h-4 w-4 text-emerald-600" />} title="Oversight / CC List">
        <div className="space-y-2">
          {rr.oversightRecipient ? (
            <RecipientCard r={rr.oversightRecipient} label="Oversight" />
          ) : (
            <p className="text-xs text-muted-foreground italic">No oversight agency identified.</p>
          )}
          {rr.ccList.length > 0 && (
            <div className="pt-1">
              <p className="text-xs font-medium text-foreground mb-1.5">CC</p>
              <ul className="space-y-0.5">
                {rr.ccList.map((c, i) => (
                  <li key={i} className="text-xs text-muted-foreground flex items-start gap-1.5">
                    <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground mt-0.5" />
                    {c}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </Block>

      {/* Block 4: Legal Flag Summary */}
      <Block icon={<ShieldAlert className="h-4 w-4 text-amber-600" />} title="Legal Flag Summary">
        <div className="space-y-3">
          {/* Boolean flags as chips */}
          <div className="flex flex-wrap gap-1.5">
            <FlagChip label="Tribal Land" active={result.tribalLandFlag} color="text-amber-800 bg-amber-50 border-amber-300" />
            <FlagChip label="ICWA" active={result.icwaFlag} color="text-rose-800 bg-rose-50 border-rose-300" />
            <FlagChip label="Indian Law" active={result.indianLawFlag} color="text-blue-800 bg-blue-50 border-blue-300" />
            <FlagChip label="Trust Land" active={result.trustLandFlag} color="text-purple-800 bg-purple-50 border-purple-300" />
            <FlagChip label="Federal Review" active={result.federalReviewFlag} color="text-indigo-800 bg-indigo-50 border-indigo-300" />
            {!result.tribalLandFlag && !result.icwaFlag && !result.indianLawFlag && !result.trustLandFlag && !result.federalReviewFlag && (
              <span className="text-xs text-muted-foreground italic">No sovereignty flags raised.</span>
            )}
          </div>

          {/* Specific legal flags */}
          {result.legalFlags.length > 0 && (
            <div>
              <p className="text-xs font-medium text-foreground mb-1">Specific Concerns</p>
              <ul className="space-y-0.5">
                {result.legalFlags.map((f, i) => (
                  <li key={i} className="text-xs text-muted-foreground flex items-start gap-1.5">
                    <ChevronRight className="h-3.5 w-3.5 shrink-0 text-amber-500 mt-0.5" />
                    {f}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Legal flag summary from routing */}
          {rr.legalFlagSummary.length > 0 && (
            <div>
              <p className="text-xs font-medium text-foreground mb-1">Authority Warnings</p>
              <ul className="space-y-0.5">
                {rr.legalFlagSummary.map((s, i) => (
                  <li key={i} className="text-xs text-muted-foreground flex items-start gap-1.5">
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-500 mt-0.5" />
                    {s}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Legal authorities referenced */}
          {rr.legalAuthorities.length > 0 && (
            <div>
              <p className="text-xs font-medium text-foreground mb-1">Referenced Authorities</p>
              <div className="space-y-1">
                {rr.legalAuthorities.map((la, i) => (
                  <div key={i} className="text-xs border border-border rounded px-2 py-1.5">
                    <span className="font-medium text-foreground">{la.authorityName}</span>
                    {la.uscReference && (
                      <code className="ml-2 bg-muted px-1 py-0.5 rounded text-xs">{la.uscReference}</code>
                    )}
                    {la.cfrReference && (
                      <code className="ml-1 bg-muted px-1 py-0.5 rounded text-xs">{la.cfrReference}</code>
                    )}
                    {la.warningOrLimit && (
                      <p className="text-amber-700 mt-0.5">{la.warningOrLimit}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded px-2 py-1.5">
            Suggested Pending Review — all items above require human review before action.
          </p>
        </div>
      </Block>

      {/* Block 5: Suggested Template & Escalation */}
      <Block icon={<BookMarked className="h-4 w-4 text-muted-foreground" />} title="Suggested Template & Escalation">
        <div className="space-y-2">
          <div className="flex gap-2 text-xs">
            <span className="font-medium text-foreground w-36 shrink-0">Template Key</span>
            {rr.suggestedTemplateKey ? (
              <code className="bg-muted px-1.5 py-0.5 rounded font-mono text-foreground">
                {rr.suggestedTemplateKey}
              </code>
            ) : (
              <span className="text-muted-foreground italic">None assigned</span>
            )}
          </div>
          {rr.escalationPath && (
            <div className="flex gap-2 text-xs">
              <span className="font-medium text-foreground w-36 shrink-0">Escalation Path</span>
              <span className="text-muted-foreground">{rr.escalationPath}</span>
            </div>
          )}
          {rr.tribalLawApplicable && (
            <div className="flex gap-2 text-xs">
              <span className="font-medium text-foreground w-36 shrink-0">Tribal Law</span>
              <span className="text-muted-foreground">{rr.tribalLawApplicable}</span>
            </div>
          )}
          {!rr.suggestedTemplateKey && !rr.escalationPath && !rr.tribalLawApplicable && (
            <p className="text-xs text-muted-foreground italic">No template or escalation data available for this matter type.</p>
          )}
        </div>
      </Block>
    </div>
  );
}

const MATTER_TYPE_OPTIONS = [
  "icwa_violation", "utility_shutoff", "tax_lien", "tax_assessment",
  "foreclosure", "court_order", "recorder_refusal", "zoning",
  "jurisdictional_overreach", "health_plan_denial", "deed",
  "identity_verification", "trust_declaration", "agency_denial",
  "code_enforcement", "general",
];

export default function IntakePage() {
  const { toast } = useToast();
  const [documentText, setDocumentText] = useState("");
  const [hintState, setHintState] = useState("");
  const [hintCounty, setHintCounty] = useState("");
  const [hintMatterType, setHintMatterType] = useState("");

  const analyzeMutation = useMutation({
    mutationFn: () =>
      api.analyzeIntake(documentText, {
        state: hintState || undefined,
        county: hintCounty || undefined,
        matterType: hintMatterType || undefined,
      }),
    onSuccess: (data) => {
      toast({
        title: "Analysis complete",
        description: data.id
          ? `Record automatically persisted as #${data.id}.`
          : "Analysis complete. Record was not saved.",
      });
    },
    onError: (err) => {
      const status = (err as ApiError).status;
      if (status === 401) {
        toast({ title: "Session expired", description: "Please sign in again.", variant: "destructive" });
      }
    },
  });

  const result = analyzeMutation.data ?? null;
  const is401 = (analyzeMutation.error as ApiError)?.status === 401;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <FileSearch className="h-5 w-5 text-primary" />
          <h1 className="text-xl font-semibold text-foreground">Document Intake Analysis</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Paste document text to extract entities, detect matter type, identify applicable law, and generate routing guidance.
        </p>
      </div>

      {/* Input form */}
      <div className="bg-card border border-card-border rounded-lg p-4 space-y-4">
        {/* Context hints */}
        <div>
          <p className="text-xs font-medium text-foreground mb-2">Context Hints (optional — improve extraction accuracy)</p>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs text-muted-foreground mb-1">State</label>
              <input
                type="text"
                placeholder="e.g. CA"
                maxLength={2}
                className="w-full text-sm rounded-md border border-input bg-background px-3 py-2 text-foreground focus:outline-none focus:ring-1 focus:ring-ring uppercase"
                value={hintState}
                onChange={(e) => setHintState(e.target.value.toUpperCase())}
              />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">County</label>
              <input
                type="text"
                placeholder="e.g. Riverside"
                className="w-full text-sm rounded-md border border-input bg-background px-3 py-2 text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                value={hintCounty}
                onChange={(e) => setHintCounty(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Matter Type</label>
              <select
                className="w-full text-sm rounded-md border border-input bg-background px-3 py-2 text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                value={hintMatterType}
                onChange={(e) => setHintMatterType(e.target.value)}
              >
                <option value="">Auto-detect</option>
                {MATTER_TYPE_OPTIONS.map((m) => (
                  <option key={m} value={m}>{m.replace(/_/g, " ")}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Document text */}
        <div>
          <label className="block text-xs font-medium text-foreground mb-1">
            Document Text
          </label>
          <textarea
            className="w-full text-sm rounded-md border border-input bg-background px-3 py-2.5 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-none"
            rows={9}
            placeholder="Paste the full document text here. The engine will extract entity names, addresses, deadlines, reference numbers, APN, matter type, applicable law, and generate routing recommendations…"
            value={documentText}
            onChange={(e) => setDocumentText(e.target.value)}
          />
          <p className="text-xs text-muted-foreground mt-1">
            {documentText.length.toLocaleString()} characters · Minimum 20 required
          </p>
        </div>

        {/* Analyze button */}
        <div className="flex justify-end">
          <Button
            onClick={() => analyzeMutation.mutate()}
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
        {analyzeMutation.isError && !is401 && (
          <div className="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2 flex items-center gap-2 text-sm text-destructive">
            <AlertCircle className="h-4 w-4 shrink-0" />
            Analysis failed: {(analyzeMutation.error as Error).message}
          </div>
        )}
        {is401 && <SessionExpiredBanner />}
      </div>

      {/* Results */}
      {result && <AnalysisResults result={result} />}
    </div>
  );
}
