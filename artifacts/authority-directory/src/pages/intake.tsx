import { useState, useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  FileSearch, Clock, ShieldAlert, BookMarked, Building2,
  FileText, Loader2, Copy, AlertTriangle, CheckCircle2,
  ChevronRight, AlertCircle, Printer, FileX, Scale,
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

// ─── NFR Notice block ─────────────────────────────────────────────────────────
// Assembles a ready-to-review Notice of Federal Review from engine output.
// Appears automatically when any violation flag is active.

const MATTER_TYPE_TO_NFR_SIGNAL: Record<string, { signal: string; laws: string[]; internal: string[]; external: string[]; followthrough: string[] }> = {
  foreclosure: {
    signal: "FORECLOSURE_ACTIVITY",
    laws: ["25 U.S.C. § 177 (Nonintercourse Act — void foreclosure on restricted Indian land)", "25 U.S.C. § 483a (restrictions on alienation)", "Worcester v. Georgia, 31 U.S. 515 (1832)"],
    internal: ["Verify parcel tribal classification before any response", "Obtain all foreclosure documents, notice of default, lis pendens", "Determine whether the debt underlying the foreclosure is enforceable against tribal land"],
    external: ["Issue Notice of Federal Review to the foreclosing party and their counsel", "Send Void Ab Initio Declaration to county court and recorder", "Notify lender/servicer of Nonintercourse Act violation"],
    followthrough: ["Identify foreclosure sale date — deadline for TRO", "Determine whether emergency TRO filing is required within 72 hours"],
  },
  tax_lien: {
    signal: "TAX_OR_LIEN_ASSERTION",
    laws: ["McClanahan v. Arizona State Tax Commission, 411 U.S. 164 (1973)", "Bryan v. Itasca County, 426 U.S. 373 (1976)", "25 U.S.C. § 177 (Nonintercourse Act — liens on Indian land void without authorization)"],
    internal: ["Verify the jurisdictional status of the parcel subject to the lien", "Confirm whether the land is held in trust, restricted status, or fee", "Document the tax assessor's basis for the assertion"],
    external: ["Issue Notice of Federal Review to the taxing authority or lienholder", "Send jurisdictional notice: tax preemption under McClanahan and Bryan", "File administrative objection with the taxing authority"],
    followthrough: ["Identify the tax lien recording date and any redemption deadlines", "Identify the proper administrative appeal body"],
  },
  tax_assessment: {
    signal: "TAX_OR_LIEN_ASSERTION",
    laws: ["McClanahan v. Arizona State Tax Commission, 411 U.S. 164 (1973)", "Bryan v. Itasca County, 426 U.S. 373 (1976)", "25 U.S.C. § 177"],
    internal: ["Verify the parcel's trust or restricted status before any response", "Document the taxing authority and the basis for the assessment"],
    external: ["Issue Notice of Federal Review to the taxing authority", "Assert tax preemption under McClanahan and Bryan"],
    followthrough: ["Identify the assessment appeal deadline", "Determine whether the taxing authority has been served with a prior notice"],
  },
  jurisdictional_overreach: {
    signal: "JURISDICTIONAL_OVERREACH",
    laws: ["Worcester v. Georgia, 31 U.S. 515 (1832)", "McClanahan v. Arizona State Tax Commission, 411 U.S. 164 (1973)", "18 U.S.C. § 1151 (definition of Indian country)"],
    internal: ["Document the overreach and identify the state or county actor", "Verify that Public Law 280 does not apply in this jurisdiction", "Prepare a jurisdictional statement from the Sovereign Office"],
    external: ["Issue Notice of Federal Review asserting tribal and federal jurisdiction", "File jurisdictional statement in the relevant proceeding", "Notify the overreaching entity of federal preemption obligations"],
    followthrough: ["Identify whether the matter requires a removal petition", "Determine the proper court for jurisdictional challenge"],
  },
  recorder_refusal: {
    signal: "RECORDER_REFUSAL",
    laws: ["25 U.S.C. § 177 (tribal documents must be accepted for recording)", "25 U.S.C. § 175 (U.S. attorneys required to represent Indians)", "Federal preemption doctrine — Worcester v. Georgia"],
    internal: ["Document the exact reason for the refusal", "Verify that the instrument meets all recorder technical requirements"],
    external: ["Issue Notice of Federal Review to the county recorder", "Send formal demand for acceptance with federal law citations"],
    followthrough: ["Identify the county recorder's supervisor and legal counsel for escalation", "Determine whether a mandamus action is appropriate if refusal continues"],
  },
  icwa_violation: {
    signal: "ICWA_PROCEEDING_DETECTED",
    laws: ["25 U.S.C. § 1912 (ICWA — mandatory notice, active efforts, evidentiary standards)", "25 U.S.C. § 1911 (tribal court jurisdiction; right to intervene)", "Brackeen v. Haaland, 599 U.S. 255 (2023)"],
    internal: ["Identify the child, the proceeding court, and the agency involved", "Verify the child's Indian status and tribal membership eligibility", "Determine whether 10-day notice requirement has been met"],
    external: ["File ICWA Notice of Proceeding with the court immediately", "Assert tribal right to intervene", "Issue Notice of Federal Review to the agency and court"],
    followthrough: ["Identify the next hearing date — ICWA notice must precede it by at least 10 days", "Determine whether tribal court should claim exclusive jurisdiction under § 1911"],
  },
  health_plan_denial: {
    signal: "MANAGED_CARE_INTERFERENCE",
    laws: ["25 U.S.C. §§ 1601-1683 (Indian Health Care Improvement Act)", "25 U.S.C. § 13 (Snyder Act)", "42 U.S.C. § 1396 et seq. (Medicaid — Indian-specific provisions)"],
    internal: ["Document the managed care interference and the responsible entity", "Verify the member's Indian status and healthcare eligibility"],
    external: ["Issue Notice of Federal Review to the managed care organization", "File complaint with CMS (Centers for Medicare & Medicaid Services)", "Notify IHS of the interference with Indian healthcare rights"],
    followthrough: ["Identify any health emergency deadlines requiring immediate escalation", "Determine whether state insurance commissioner complaint is appropriate"],
  },
  agency_denial: {
    signal: "AGENCY_DENIAL",
    laws: ["25 U.S.C. § 13 (Snyder Act — federal duty to provide Indian services)", "Loper Bright Enterprises v. Raimondo (2024)", "5 U.S.C. § 702 (APA — right to challenge agency action)"],
    internal: ["Document the agency, the program, and the basis for denial", "Verify the member's eligibility under the broad federal definition"],
    external: ["File administrative appeal with the denying agency", "Issue Notice of Federal Review citing Snyder Act and Loper Bright"],
    followthrough: ["Identify the appeal filing deadline", "Determine whether exhaustion of administrative remedies is required"],
  },
};

const DEFAULT_NFR_SIGNAL = {
  signal: "PROTECTED_RIGHTS_VIOLATION",
  laws: ["Indian Canons of Construction — statutes liberally construed in favor of Indians", "25 U.S.C. § 175 (U.S. attorneys to represent Indians)", "Federal trust responsibility doctrine"],
  internal: ["Identify the specific protected right and how it was violated", "Document the violating party and the context of the violation", "Compile applicable statutes and prior sovereign notices"],
  external: ["Issue Notice of Federal Review asserting the violated right", "Send formal demand for cessation of the violation"],
  followthrough: ["Identify the applicable administrative or judicial remedy", "Determine whether immediate escalation is required"],
};

function buildNfrText(result: IntakeAnalysisResult, signal: typeof DEFAULT_NFR_SIGNAL): string {
  const rr = result.routingRecommendation;
  const date = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  const recipient = rr.primaryRecipient;
  const lines = [
    "NOTICE OF FEDERAL REVIEW",
    "================================================",
    `Date: ${date}`,
    `Issuing Office: Mathias El Tribe — Sovereign Office`,
    `Re: Matter Type: ${result.detectedMatterType.replace(/_/g, " ").toUpperCase()}`,
    result.id ? `Intake Record: #${result.id}` : "",
    "",
    "TO:",
    recipient ? recipient.name : "(Party identified — see extracted fields)",
    recipient?.mailingAddress ?? "",
    recipient?.phone ? `Phone: ${recipient.phone}` : "",
    "",
    "NOTICE IS HEREBY GIVEN that the Sovereign Office of the Mathias El Tribe",
    "has identified potential violations of federal Indian law in connection with",
    "the above-referenced matter. This notice is issued pursuant to the federal",
    "trust responsibility and applicable statutes listed below.",
    "",
    "LEGAL BASIS:",
    ...signal.laws.map((l) => `  • ${l}`),
    ...(rr.legalAuthorities.length > 0 ? rr.legalAuthorities.map((la) => `  • ${la.authorityName}${la.uscReference ? ` — ${la.uscReference}` : ""}`) : []),
    "",
    "REQUIRED INTERNAL ACTIONS (Sovereign Office):",
    ...signal.internal.map((a, i) => `  ${i + 1}. ${a}`),
    "",
    "REQUIRED EXTERNAL ACTIONS:",
    ...signal.external.map((a, i) => `  ${i + 1}. ${a}`),
    "",
    "REQUIRED FOLLOWTHROUGH:",
    ...signal.followthrough.map((f, i) => `  ${i + 1}. ${f}`),
    "",
    "OVERSIGHT / REVIEW CHAIN:",
    rr.oversightRecipient ? `  Oversight: ${rr.oversightRecipient.name}${rr.oversightRecipient.mailingAddress ? ` — ${rr.oversightRecipient.mailingAddress}` : ""}` : "",
    ...rr.ccList.map((c) => `  CC: ${c}`),
    "",
    "PENDING REVIEW — This notice is system-generated and requires human",
    "authorization before transmission. All determinations are subject to",
    "review by the appropriate officer or Chief before any action is taken.",
    "================================================",
  ];
  return lines.filter((l) => l !== "").join("\n");
}

function NfrNoticeBlock({ result }: { result: IntakeAnalysisResult }) {
  const { toast } = useToast();
  const hasViolationFlag =
    result.tribalLandFlag ||
    result.icwaFlag ||
    result.indianLawFlag ||
    result.trustLandFlag ||
    result.federalReviewFlag;

  if (!hasViolationFlag) return null;

  const signal = MATTER_TYPE_TO_NFR_SIGNAL[result.detectedMatterType] ?? DEFAULT_NFR_SIGNAL;
  const nfrText = buildNfrText(result, signal);
  const rr = result.routingRecommendation;
  const date = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

  function copyNfr() {
    navigator.clipboard.writeText(nfrText).then(() => {
      toast({ title: "NFR Notice copied", description: "Full notice text copied to clipboard." });
    });
  }

  function printNfr() {
    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>Notice of Federal Review — Record #${result.id ?? "draft"}</title>
  <style>
    body { font-family: 'Times New Roman', serif; font-size: 12px; padding: 2.5cm; line-height: 1.6; color: #000; }
    h1 { font-size: 15px; text-align: center; letter-spacing: 0.1em; margin-bottom: 0.25em; }
    .rule { border-top: 2px solid #000; margin: 0.5em 0; }
    .label { font-weight: bold; margin-top: 1em; }
    .pending { border: 1px solid #555; padding: 8px; margin-top: 1.5em; font-size: 10px; text-align: center; font-style: italic; }
    ul { margin: 0.25em 0 0.25em 1.5em; padding: 0; }
    li { margin-bottom: 0.2em; }
    @media print { body { margin: 0; } }
  </style>
</head>
<body>
  <h1>NOTICE OF FEDERAL REVIEW</h1>
  <div class="rule"></div>
  <p><strong>Date:</strong> ${date}</p>
  <p><strong>Issuing Office:</strong> Mathias El Tribe — Sovereign Office</p>
  <p><strong>Matter Type:</strong> ${result.detectedMatterType.replace(/_/g, " ").toUpperCase()}</p>
  ${result.id ? `<p><strong>Intake Record:</strong> #${result.id}</p>` : ""}
  <div class="label">TO:</div>
  <p>${rr.primaryRecipient ? `${rr.primaryRecipient.name}<br/>${rr.primaryRecipient.mailingAddress ?? ""}` : "(Party identified — see extracted fields)"}</p>
  <div class="label">LEGAL BASIS:</div>
  <ul>${signal.laws.map((l) => `<li>${l}</li>`).join("")}${rr.legalAuthorities.map((la) => `<li>${la.authorityName}${la.uscReference ? ` — ${la.uscReference}` : ""}</li>`).join("")}</ul>
  <div class="label">REQUIRED INTERNAL ACTIONS (Sovereign Office):</div>
  <ul>${signal.internal.map((a) => `<li>${a}</li>`).join("")}</ul>
  <div class="label">REQUIRED EXTERNAL ACTIONS:</div>
  <ul>${signal.external.map((a) => `<li>${a}</li>`).join("")}</ul>
  <div class="label">REQUIRED FOLLOWTHROUGH:</div>
  <ul>${signal.followthrough.map((f) => `<li>${f}</li>`).join("")}</ul>
  <div class="label">OVERSIGHT / REVIEW CHAIN:</div>
  <p>${rr.oversightRecipient ? `Oversight: ${rr.oversightRecipient.name}${rr.oversightRecipient.mailingAddress ? ` — ${rr.oversightRecipient.mailingAddress}` : ""}` : ""}${rr.ccList.map((c) => `<br/>CC: ${c}`).join("")}</p>
  <div class="pending">PENDING REVIEW — This notice is system-generated and requires human authorization before transmission.<br/>All determinations are subject to review by the appropriate officer or Chief before any action is taken.</div>
</body>
</html>`;
    const pw = window.open("", "_blank", "width=800,height=1000");
    if (!pw) return;
    pw.document.write(html);
    pw.document.close();
    pw.focus();
    pw.print();
  }

  return (
    <div className="rounded-lg border-2 border-red-300 bg-red-50/40 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-red-100/60 border-b border-red-200">
        <div className="flex items-center gap-2">
          <Scale className="h-4 w-4 text-red-700 shrink-0" />
          <span className="text-sm font-semibold text-red-900 tracking-wide uppercase">
            Notice of Federal Review
          </span>
          <span className="text-xs bg-red-200 text-red-800 px-1.5 py-0.5 rounded font-medium">
            {signal.signal.replace(/_/g, " ")}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={copyNfr} className="text-red-700 hover:text-red-900 p-1" title="Copy NFR notice text">
            <Copy className="h-3.5 w-3.5" />
          </button>
          <button onClick={printNfr} className="text-red-700 hover:text-red-900 p-1" title="Print / Export NFR notice">
            <Printer className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div className="px-4 py-3 space-y-3">
        {/* Notice header fields */}
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
          <div><span className="font-medium text-foreground">Date:</span> <span className="text-muted-foreground">{date}</span></div>
          <div><span className="font-medium text-foreground">Issuing Office:</span> <span className="text-muted-foreground">Mathias El Tribe — Sovereign Office</span></div>
          <div><span className="font-medium text-foreground">Matter Type:</span> <span className="text-muted-foreground">{result.detectedMatterType.replace(/_/g, " ").toUpperCase()}</span></div>
          {result.id && <div><span className="font-medium text-foreground">Intake Record:</span> <span className="text-muted-foreground">#{result.id}</span></div>}
        </div>

        {/* Recipient (TO) */}
        <div>
          <p className="text-xs font-semibold text-foreground uppercase tracking-wide mb-1">To (Party Being Served)</p>
          {rr.primaryRecipient ? (
            <div className="rounded border border-red-200 bg-white/60 px-3 py-2 text-xs space-y-0.5">
              <p className="font-medium text-foreground">{rr.primaryRecipient.name}</p>
              {rr.primaryRecipient.mailingAddress && <p className="text-muted-foreground">{rr.primaryRecipient.mailingAddress}</p>}
              {rr.primaryRecipient.phone && <p className="text-muted-foreground">{rr.primaryRecipient.phone}</p>}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground italic">Party identified in extracted fields — verify before serving.</p>
          )}
        </div>

        {/* Legal basis */}
        <div>
          <p className="text-xs font-semibold text-foreground uppercase tracking-wide mb-1">Legal Basis</p>
          <ul className="space-y-0.5">
            {signal.laws.map((l, i) => (
              <li key={i} className="text-xs text-muted-foreground flex items-start gap-1.5">
                <Scale className="h-3 w-3 shrink-0 text-red-600 mt-0.5" /> {l}
              </li>
            ))}
            {rr.legalAuthorities.map((la, i) => (
              <li key={`la-${i}`} className="text-xs text-muted-foreground flex items-start gap-1.5">
                <Scale className="h-3 w-3 shrink-0 text-red-400 mt-0.5" />
                <span>{la.authorityName}{la.uscReference && <code className="ml-1 bg-muted px-1 rounded">{la.uscReference}</code>}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Required actions — two columns */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <p className="text-xs font-semibold text-foreground uppercase tracking-wide mb-1">Required Internal Actions</p>
            <ol className="space-y-0.5 list-decimal list-inside">
              {signal.internal.map((a, i) => (
                <li key={i} className="text-xs text-muted-foreground">{a}</li>
              ))}
            </ol>
          </div>
          <div>
            <p className="text-xs font-semibold text-foreground uppercase tracking-wide mb-1">Required External Actions</p>
            <ol className="space-y-0.5 list-decimal list-inside">
              {signal.external.map((a, i) => (
                <li key={i} className="text-xs text-muted-foreground">{a}</li>
              ))}
            </ol>
          </div>
        </div>

        {/* Followthrough */}
        <div>
          <p className="text-xs font-semibold text-foreground uppercase tracking-wide mb-1">Required Followthrough</p>
          <ol className="space-y-0.5 list-decimal list-inside">
            {signal.followthrough.map((f, i) => (
              <li key={i} className="text-xs text-muted-foreground">{f}</li>
            ))}
          </ol>
        </div>

        {/* Oversight / CC chain */}
        {(rr.oversightRecipient || rr.ccList.length > 0) && (
          <div>
            <p className="text-xs font-semibold text-foreground uppercase tracking-wide mb-1">Oversight / Review Chain</p>
            <div className="space-y-0.5 text-xs">
              {rr.oversightRecipient && (
                <div className="flex items-start gap-1.5">
                  <span className="font-medium text-foreground w-20 shrink-0">Oversight:</span>
                  <span className="text-muted-foreground">
                    {rr.oversightRecipient.name}
                    {rr.oversightRecipient.mailingAddress && ` — ${rr.oversightRecipient.mailingAddress}`}
                  </span>
                </div>
              )}
              {rr.ccList.map((c, i) => (
                <div key={i} className="flex items-start gap-1.5">
                  <span className="font-medium text-foreground w-20 shrink-0">CC:</span>
                  <span className="text-muted-foreground">{c}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Escalation path if present */}
        {rr.escalationPath && (
          <div className="flex gap-2 text-xs">
            <span className="font-medium text-foreground w-32 shrink-0">Escalation Path:</span>
            <span className="text-muted-foreground">{rr.escalationPath}</span>
          </div>
        )}

        {/* Pending review footer */}
        <div className="flex items-start gap-2 rounded border border-red-300 bg-red-100/50 px-3 py-2 text-xs text-red-900">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5 text-red-700" />
          <span>
            <strong>Pending Review —</strong> This notice is system-assembled and requires human authorization before transmission.
            All determinations are subject to review by the appropriate officer or Chief before any action is taken.
          </span>
        </div>
      </div>
    </div>
  );
}

// ─── Results panel ─────────────────────────────────────────────────────────────

interface AnalysisResultsProps {
  result: IntakeAnalysisResult;
  onUseExtracted: (state: string, county: string, matterType: string) => void;
}

function AnalysisResults({ result, onUseExtracted }: AnalysisResultsProps) {
  const { toast } = useToast();
  const rr = result.routingRecommendation;

  function copyText(text: string, label: string) {
    navigator.clipboard.writeText(text).then(() => {
      toast({ title: "Copied", description: `${label} copied to clipboard.` });
    });
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
      {result.id && (
        <div className="flex items-center gap-2 rounded-md bg-emerald-50 border border-emerald-300 px-3 py-2 text-sm text-emerald-800">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          Record <span className="font-bold">#{result.id}</span> persisted — saved when analysis ran.
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
        title="Routing Recommendation — Oversight / CC"
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

      {/* Block NFR: Notice of Federal Review — assembled when any violation flag is active */}
      <NfrNoticeBlock result={result} />

      {/* Block 5: Suggested Notice Template */}
      <Block
        icon={<BookMarked className="h-4 w-4 text-muted-foreground" />}
        title="Suggested Notice Template"
        onCopy={copyBlock5}
      >
        <div className="space-y-2">
          <div className="flex gap-2 text-xs">
            <span className="font-medium text-foreground w-36 shrink-0">Template Name</span>
            {rr.suggestedTemplateKey ? (
              <code className="bg-muted px-1.5 py-0.5 rounded font-mono text-foreground">
                {rr.suggestedTemplateKey}
              </code>
            ) : (
              <span className="text-muted-foreground italic">None assigned for this matter type</span>
            )}
          </div>
          <div className="flex gap-2 text-xs">
            <span className="font-medium text-foreground w-36 shrink-0">Description</span>
            {rr.suggestedTemplateKey ? (
              <span className="text-muted-foreground">
                Standard notice template for <span className="font-medium text-foreground">{rr.matterType}</span> matters.
                Full template body is retrieved from the template library using the key above.
                Drafting requires Chief authorization — see Draft Notice action below.
              </span>
            ) : (
              <span className="text-muted-foreground italic">No template description available.</span>
            )}
          </div>
        </div>
      </Block>

      {/* Action row */}
      <div className="flex flex-wrap items-center gap-3 pt-1">
        {/* Save status indicator — records are persisted by the analyze endpoint; ID shown when returned */}
        {result.id ? (
          <span className="inline-flex items-center gap-1.5 text-xs text-emerald-700 font-medium">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Intake record saved — ID #{result.id}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 text-xs text-amber-700 font-medium">
            <AlertCircle className="h-3.5 w-3.5" />
            Record not persisted — re-analyze to save
          </span>
        )}

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
            Final review required before drafting. This action requires Chief authorization — contact the Sovereign Office before proceeding.
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

type TextSource = "paste" | "preextracted";

const TEXT_SOURCE_CONFIG: Record<TextSource, { label: string; sublabel: string; placeholder: string }> = {
  paste: {
    label: "Paste / Transcribe Document",
    sublabel: "Canonical intake pathway — paste or transcribe the full document text",
    placeholder:
      "Paste or type the full document text here. The engine will extract entity names, addresses, deadlines, reference numbers, APN, matter type, applicable law, and generate routing recommendations…",
  },
  preextracted: {
    label: "Pre-extracted Text (from upload / OCR)",
    sublabel: "Paste text already extracted from a scanned document, PDF, or OCR output",
    placeholder:
      "Paste the already-extracted text here (e.g., from PDF OCR, a scanning workflow, or a prior extraction pipeline). The engine will process it identically to pasted document text.",
  },
};

export default function IntakePage() {
  const { toast } = useToast();
  const [textSource, setTextSource] = useState<TextSource>("paste");
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

        {/* Document text with explicit text-source selector */}
        <div>
          {/* Source toggle */}
          <div className="flex items-center gap-1 mb-2 rounded-md border border-input bg-muted p-0.5 w-fit">
            {(["paste", "preextracted"] as TextSource[]).map((src) => (
              <button
                key={src}
                onClick={() => setTextSource(src)}
                className={cn(
                  "text-xs px-3 py-1.5 rounded font-medium transition-colors whitespace-nowrap",
                  textSource === src
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {TEXT_SOURCE_CONFIG[src].label}
              </button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mb-2">
            {TEXT_SOURCE_CONFIG[textSource].sublabel}
          </p>
          <textarea
            className="w-full text-sm rounded-md border border-input bg-background px-3 py-2.5 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-none"
            rows={9}
            placeholder={TEXT_SOURCE_CONFIG[textSource].placeholder}
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
