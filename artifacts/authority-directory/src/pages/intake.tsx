import { useState, useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  FileSearch, Clock, ShieldAlert, BookMarked, Building2,
  FileText, Loader2, Copy, AlertTriangle, CheckCircle2,
  ChevronRight, AlertCircle, Save, Printer, FileX,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { api, IntakeAnalysisResult, RoutingRecipient, ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { SessionExpiredBanner } from "@/App";

// ─── Shared helpers ───────────────────────────────────────────────────────────

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
  onCopy?: () => void;
}

function Block({ icon, title, children, className, onCopy }: BlockProps) {
  return (
    <div className={cn("bg-card border border-card-border rounded-lg overflow-hidden", className)}>
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2 text-sm font-medium text-foreground">
          {icon}
          {title}
        </div>
        <div className="flex items-center gap-2">
          <PendingBadge />
          {onCopy && (
            <button
              onClick={onCopy}
              title={`Copy ${title}`}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <Copy className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
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

function CopyAddressBtn({ recipient }: { recipient: RoutingRecipient }) {
  const { toast } = useToast();
  function copyAddress() {
    const lines = [
      recipient.name,
      recipient.mailingAddress ?? "",
      recipient.phone ?? "",
      recipient.contact ?? "",
      recipient.website ?? "",
    ].filter(Boolean).join("\n");
    navigator.clipboard.writeText(lines).then(() => {
      toast({ title: "Address block copied", description: `${recipient.name} contact block copied.` });
    });
  }
  return (
    <button
      onClick={copyAddress}
      className="text-xs text-primary hover:underline flex items-center gap-1 mt-1"
    >
      <Copy className="h-3 w-3" /> Copy address block
    </button>
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
      <CopyAddressBtn recipient={r} />
    </div>
  );
}

// Flag chip always labeled as "Possible flag — pending review: [TYPE]"
function FlagChip({ label, active }: { label: string; active: boolean }) {
  if (!active) return null;
  return (
    <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded border border-amber-300 bg-amber-50 text-amber-800 font-medium">
      <ShieldAlert className="h-3 w-3 shrink-0" />
      Possible flag — pending review: {label}
    </span>
  );
}

// ─── Build export / print content ────────────────────────────────────────────

function buildExportLines(result: IntakeAnalysisResult): string[] {
  const rr = result.routingRecommendation;
  return [
    "========================================",
    "MATHIAS EL TRIBE — INTAKE ANALYSIS SUMMARY",
    `Record ID: ${result.id ?? "unsaved"}`,
    `Extraction Source: ${result.extractionSource}`,
    `Date: ${new Date().toLocaleString()}`,
    "========================================",
    "",
    "--- EXTRACTED FIELDS ---",
    result.detectedEntityName ? `Entity / Issuer: ${result.detectedEntityName}` : "",
    result.detectedAddress ? `Address: ${result.detectedAddress}` : "",
    result.detectedDeadline ? `Deadline / Due Date: ${result.detectedDeadline}` : "",
    result.detectedAccountOrReferenceNumber ? `Account / Reference #: ${result.detectedAccountOrReferenceNumber}` : "",
    result.detectedApn ? `APN: ${result.detectedApn}` : "",
    result.detectedState ? `State: ${result.detectedState}` : "",
    result.detectedCounty ? `County: ${result.detectedCounty}` : "",
    `Matter Type: ${result.detectedMatterType}`,
    `Action Type: ${result.detectedActionType}`,
    "",
    "--- PRIMARY RECIPIENT ---",
    rr.primaryRecipient
      ? [rr.primaryRecipient.name, rr.primaryRecipient.mailingAddress, rr.primaryRecipient.phone, rr.primaryRecipient.contact].filter(Boolean).join("\n")
      : "Not identified",
    "",
    "--- OVERSIGHT / CC ---",
    rr.oversightRecipient
      ? [rr.oversightRecipient.name, rr.oversightRecipient.mailingAddress].filter(Boolean).join("\n")
      : "Not identified",
    ...(rr.ccList.length > 0 ? ["CC:", ...rr.ccList.map((c) => `  - ${c}`)] : []),
    "",
    "--- LEGAL FLAGS (POSSIBLE — PENDING REVIEW) ---",
    result.tribalLandFlag ? "Possible flag — pending review: Tribal Land" : "",
    result.icwaFlag ? "Possible flag — pending review: ICWA" : "",
    result.indianLawFlag ? "Possible flag — pending review: Indian Law" : "",
    result.trustLandFlag ? "Possible flag — pending review: Trust Land" : "",
    result.federalReviewFlag ? "Possible flag — pending review: Federal Review" : "",
    ...(result.legalFlags.length > 0 ? ["Specific concerns:", ...result.legalFlags.map((f) => `  - ${f}`)] : []),
    ...(rr.legalFlagSummary.length > 0 ? ["Authority warnings:", ...rr.legalFlagSummary.map((s) => `  - ${s}`)] : []),
    "",
    "--- SUGGESTED TEMPLATE & ESCALATION ---",
    rr.suggestedTemplateKey ? `Template Key: ${rr.suggestedTemplateKey}` : "No template assigned",
    rr.escalationPath ? `Escalation: ${rr.escalationPath}` : "",
    rr.tribalLawApplicable ? `Tribal Law: ${rr.tribalLawApplicable}` : "",
    "",
    "========================================",
    rr.disclaimer,
    "SUGGESTED PENDING REVIEW — human authorization required before any action.",
    "========================================",
  ];
}

function buildExportText(result: IntakeAnalysisResult): string {
  return buildExportLines(result).filter((l) => l !== "").join("\n");
}

function exportAsPdf(result: IntakeAnalysisResult) {
  const lines = buildExportLines(result).filter((l) => l !== "");
  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>Intake Analysis — Record #${result.id ?? "draft"}</title>
  <style>
    body { font-family: 'Courier New', monospace; font-size: 11px; padding: 2cm; line-height: 1.5; color: #111; }
    h2 { font-size: 13px; margin-bottom: 0.5em; }
    @media print { body { margin: 0; } }
  </style>
</head>
<body>
  <h2>Mathias El Tribe — Intake Analysis Summary</h2>
  <pre>${lines.map((l) => l.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")).join("\n")}</pre>
</body>
</html>`;
  const pw = window.open("", "_blank", "width=800,height=900");
  if (!pw) return;
  pw.document.write(html);
  pw.document.close();
  pw.focus();
  pw.print();
}

// ─── Results panel ─────────────────────────────────────────────────────────────

interface AnalysisResultsProps {
  result: IntakeAnalysisResult;
  onUseExtracted: (state: string, county: string, matterType: string) => void;
}

function AnalysisResults({ result, onUseExtracted }: AnalysisResultsProps) {
  const { toast } = useToast();
  const [saved, setSaved] = useState(!!result.id);
  const rr = result.routingRecommendation;

  function copyText(text: string, label: string) {
    navigator.clipboard.writeText(text).then(() => {
      toast({ title: "Copied", description: `${label} copied to clipboard.` });
    });
  }

  function handleSave() {
    if (result.id) {
      setSaved(true);
      toast({
        title: `Record #${result.id} saved`,
        description: "Intake record was automatically persisted when analysis ran. ID confirmed.",
      });
    } else {
      toast({
        title: "Record not persisted",
        description: "No record ID returned — re-analyze to save.",
        variant: "destructive",
      });
    }
  }

  function useExtracted() {
    onUseExtracted(
      result.detectedState ?? "",
      result.detectedCounty ?? "",
      result.detectedMatterType ?? "",
    );
    toast({ title: "Context hints updated", description: "State, county, and matter type pre-filled from extracted values." });
  }

  // Block copy helpers
  function copyBlock1() {
    const lines = [
      `Entity: ${result.detectedEntityName ?? "—"}`,
      `Address: ${result.detectedAddress ?? "—"}`,
      `Deadline: ${result.detectedDeadline ?? "—"}`,
      `Ref #: ${result.detectedAccountOrReferenceNumber ?? "—"}`,
      `APN: ${result.detectedApn ?? "—"}`,
      `State: ${result.detectedState ?? "—"}`,
      `County: ${result.detectedCounty ?? "—"}`,
      `Matter Type: ${result.detectedMatterType}`,
      `Action Type: ${result.detectedActionType}`,
      result.id ? `Record ID: #${result.id}` : "",
    ].filter(Boolean).join("\n");
    copyText(lines, "Extracted fields");
  }

  function copyBlock2() {
    const r = rr.primaryRecipient;
    if (!r) { copyText("No primary recipient identified.", "Primary recipient"); return; }
    const lines = [r.name, r.mailingAddress, r.phone, r.contact, r.website].filter(Boolean).join("\n");
    copyText(lines, "Primary recipient");
  }

  function copyBlock3() {
    const r = rr.oversightRecipient;
    const lines = r
      ? [r.name, r.mailingAddress, r.phone, r.contact].filter(Boolean).join("\n")
      : "No oversight agency identified.";
    const cc = rr.ccList.length > 0 ? "\nCC:\n" + rr.ccList.map((c) => `  - ${c}`).join("\n") : "";
    copyText(lines + cc, "Oversight / CC");
  }

  function copyBlock4() {
    const flags = [
      result.tribalLandFlag ? "Possible flag — pending review: Tribal Land" : "",
      result.icwaFlag ? "Possible flag — pending review: ICWA" : "",
      result.indianLawFlag ? "Possible flag — pending review: Indian Law" : "",
      result.trustLandFlag ? "Possible flag — pending review: Trust Land" : "",
      result.federalReviewFlag ? "Possible flag — pending review: Federal Review" : "",
      ...result.legalFlags,
      ...rr.legalFlagSummary,
    ].filter(Boolean);
    copyText(flags.length ? flags.join("\n") : "No flags raised.", "Legal flags");
  }

  function copyBlock5() {
    const lines = [
      rr.suggestedTemplateKey ? `Template: ${rr.suggestedTemplateKey}` : "No template assigned.",
      rr.escalationPath ? `Escalation: ${rr.escalationPath}` : "",
      rr.tribalLawApplicable ? `Tribal Law: ${rr.tribalLawApplicable}` : "",
    ].filter(Boolean);
    copyText(lines.join("\n"), "Template & escalation");
  }

  return (
    <div className="space-y-4 mt-6">
      {/* Saved badge */}
      {saved && result.id && (
        <div className="flex items-center gap-2 rounded-md bg-emerald-50 border border-emerald-300 px-3 py-2 text-sm text-emerald-800">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          Record <span className="font-bold">#{result.id}</span> persisted — auto-saved when analysis ran.
        </div>
      )}

      {/* Disclaimer banner */}
      <div className="flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3">
        <AlertTriangle className="h-4 w-4 text-amber-700 mt-0.5 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-amber-900 mb-0.5">Human review required before any action.</p>
          <p className="text-xs text-amber-800">{rr.disclaimer}</p>
        </div>
        <button onClick={() => copyText(rr.disclaimer, "Disclaimer")} className="shrink-0 text-amber-700 hover:text-amber-900">
          <Copy className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Block 1: Extracted Fields */}
      <Block
        icon={<FileText className="h-4 w-4 text-primary" />}
        title="Extracted Fields"
        onCopy={copyBlock1}
      >
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
          <div className="text-xs text-muted-foreground pt-1 flex items-center justify-between flex-wrap gap-2">
            <span>
              Source: <span className="font-medium text-foreground">{result.extractionSource}</span>
              {result.id && (
                <> · Record ID: <span className="font-medium text-foreground">#{result.id}</span></>
              )}
            </span>
            <button
              onClick={useExtracted}
              className="text-xs text-primary hover:underline flex items-center gap-1"
              title="Pre-fill context hints from extracted state, county, and matter type"
            >
              <ChevronRight className="h-3 w-3" /> Use extracted values as context hints
            </button>
          </div>
        </div>
      </Block>

      {/* Block 2: Primary Recipient */}
      <Block
        icon={<Building2 className="h-4 w-4 text-primary" />}
        title="Routing Recommendation — Primary Recipient"
        onCopy={copyBlock2}
      >
        {rr.primaryRecipient ? (
          <RecipientCard r={rr.primaryRecipient} label="Primary" />
        ) : (
          <p className="text-xs text-muted-foreground italic">
            No primary recipient identified — check Matter Type Reference for routing guidance.
          </p>
        )}
      </Block>

      {/* Block 3: Oversight & CC */}
      <Block
        icon={<CheckCircle2 className="h-4 w-4 text-emerald-600" />}
        title="Routing Recommendation — Oversight & CC"
        onCopy={copyBlock3}
      >
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
      <Block
        icon={<ShieldAlert className="h-4 w-4 text-amber-600" />}
        title="Legal Flag Summary"
        onCopy={copyBlock4}
      >
        <div className="space-y-3">
          {/* Boolean flags as chips — consistently labeled "Possible flag — pending review: X" */}
          <div className="flex flex-wrap gap-1.5">
            <FlagChip label="Tribal Land" active={result.tribalLandFlag} />
            <FlagChip label="ICWA" active={result.icwaFlag} />
            <FlagChip label="Indian Law" active={result.indianLawFlag} />
            <FlagChip label="Trust Land" active={result.trustLandFlag} />
            <FlagChip label="Federal Review" active={result.federalReviewFlag} />
            {!result.tribalLandFlag && !result.icwaFlag && !result.indianLawFlag && !result.trustLandFlag && !result.federalReviewFlag && (
              <span className="text-xs text-muted-foreground italic">No sovereignty flags raised.</span>
            )}
          </div>

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
      <Block
        icon={<BookMarked className="h-4 w-4 text-muted-foreground" />}
        title="Suggested Template & Escalation"
        onCopy={copyBlock5}
      >
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
            <p className="text-xs text-muted-foreground italic">No template or escalation data for this matter type.</p>
          )}
        </div>
      </Block>

      {/* Action row */}
      <div className="flex flex-wrap gap-2 pt-1">
        {/* Confirm saved record — analyze auto-persists; this confirms the ID */}
        <Button
          variant={saved ? "default" : "outline"}
          size="sm"
          className={cn("gap-1.5", saved && "bg-emerald-600 hover:bg-emerald-700 text-white border-0")}
          onClick={handleSave}
        >
          <Save className="h-3.5 w-3.5" />
          {saved && result.id ? `Confirmed — Record #${result.id}` : "Confirm Saved Record"}
        </Button>

        {/* Export PDF summary */}
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5"
          onClick={() => exportAsPdf(result)}
        >
          <Printer className="h-3.5 w-3.5" /> Export PDF Summary
        </Button>

        {/* Draft Notice — disabled, requires Chief authorization */}
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="inline-flex">
              <Button
                variant="ghost"
                size="sm"
                className="gap-1.5 opacity-50 cursor-not-allowed"
                disabled
                tabIndex={-1}
              >
                <FileX className="h-3.5 w-3.5" /> Draft Notice
              </Button>
            </span>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-xs text-xs">
            Draft Notice requires Chief authorization. Contact the Sovereign Office to initiate this action — do not proceed without explicit approval.
          </TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
}

// ─── Context hint matter types ────────────────────────────────────────────────

const MATTER_TYPE_OPTIONS = [
  "icwa_violation", "utility_shutoff", "tax_lien", "tax_assessment",
  "foreclosure", "court_order", "recorder_refusal", "zoning",
  "jurisdictional_overreach", "health_plan_denial", "deed",
  "identity_verification", "trust_declaration", "agency_denial",
  "code_enforcement", "general",
];

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function IntakePage() {
  const { toast } = useToast();
  const [documentText, setDocumentText] = useState("");
  const [hintState, setHintState] = useState("");
  const [hintCounty, setHintCounty] = useState("");
  const [hintMatterType, setHintMatterType] = useState("");

  function handleUseExtracted(state: string, county: string, matterType: string) {
    if (state) setHintState(state);
    if (county) setHintCounty(county);
    if (matterType) setHintMatterType(matterType);
  }

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
          Paste document text to extract entities, detect matter type, identify applicable law, and generate routing guidance. Records are auto-persisted on analyze.
        </p>
      </div>

      {/* Input form */}
      <div className="bg-card border border-card-border rounded-lg p-4 space-y-4">
        {/* Context hints */}
        <div>
          <p className="text-xs font-medium text-foreground mb-2">
            Context Hints
            <span className="font-normal text-muted-foreground ml-1">(optional — improve extraction accuracy)</span>
          </p>
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

        {/* Document text — this is the canonical intake pathway: paste or type the full document text */}
        <div>
          <label className="block text-xs font-medium text-foreground mb-1">
            Document Text
            <span className="font-normal text-muted-foreground ml-1">— paste, transcribe, or type the full document (canonical intake pathway)</span>
          </label>
          <textarea
            className="w-full text-sm rounded-md border border-input bg-background px-3 py-2.5 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-none"
            rows={9}
            placeholder="Paste or transcribe the full document text here. For pre-extracted text from uploads, paste the extracted content directly. The engine will extract entity names, addresses, deadlines, reference numbers, APN, matter type, applicable law, and generate routing recommendations…"
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

        {/* Errors */}
        {analyzeMutation.isError && !is401 && (
          <div className="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2 flex items-center gap-2 text-sm text-destructive">
            <AlertCircle className="h-4 w-4 shrink-0" />
            Analysis failed: {(analyzeMutation.error as Error).message}
          </div>
        )}
        {is401 && <SessionExpiredBanner />}
      </div>

      {/* Results */}
      {result && <AnalysisResults result={result} onUseExtracted={handleUseExtracted} />}
    </div>
  );
}
