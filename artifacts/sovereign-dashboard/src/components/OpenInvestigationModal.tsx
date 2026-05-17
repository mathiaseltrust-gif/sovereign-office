import { useState } from "react";
import { useLocation } from "wouter";
import { X, Loader2, Gavel, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { getCurrentBearerToken } from "@/components/auth-provider";

// ── Types ─────────────────────────────────────────────────────────────────────

type ReviewSignalType =
  | "UNAUTHORIZED_LAND_ENCUMBRANCE"
  | "TRUST_LAND_INTERFERENCE"
  | "STATE_JURISDICTION_CLAIMED"
  | "JURISDICTIONAL_OVERREACH"
  | "NOTICES_SENT_NO_RESPONSE"
  | "STATUS_NOT_ON_RECORD"
  | "ICWA_PROCEEDING_DETECTED"
  | "ADMINISTRATIVE_CAPITULATION_RISK"
  | "FEDERAL_PROGRAM_ACCESS_DENIED"
  | "BENEFIT_DENIAL"
  | "TREATY_RIGHT_NOT_INVOKED"
  | "TRUST_RESPONSIBILITY_BREACH"
  | "FEDERAL_TRUST_TRIGGER"
  | "TRIBAL_COURT_JURISDICTION_NOT_INVOKED"
  | "DOCUMENT_REJECTION"
  | "RECORDER_REFUSAL"
  | "MANAGED_CARE_INTERFERENCE"
  | "PROTECTED_RIGHTS_VIOLATION"
  | "TAX_OR_LIEN_ASSERTION"
  | "FORECLOSURE_ACTIVITY"
  | "UTILITY_LIEN_ASSERTED"
  | "AGENCY_DENIAL"
  | "IDENTITY_CHALLENGED"
  | "PROCEEDING_WITHOUT_STATUS_ASSERTION"
  | "DEBT_COLLECTION_ACTIVE"
  | "CREDIT_REPORTING_ACTIVE";

const SIGNAL_OPTIONS: { value: ReviewSignalType; label: string; category: string }[] = [
  { value: "UNAUTHORIZED_LAND_ENCUMBRANCE",        label: "Unauthorized Land Encumbrance",              category: "Land" },
  { value: "TRUST_LAND_INTERFERENCE",              label: "Trust Land Interference",                    category: "Land" },
  { value: "FORECLOSURE_ACTIVITY",                 label: "Foreclosure Activity",                       category: "Land" },
  { value: "TAX_OR_LIEN_ASSERTION",                label: "Tax or Lien Assertion",                      category: "Land" },
  { value: "UTILITY_LIEN_ASSERTED",                label: "Utility Lien Asserted",                      category: "Land" },
  { value: "STATE_JURISDICTION_CLAIMED",           label: "State Jurisdiction Claimed",                 category: "Jurisdiction" },
  { value: "JURISDICTIONAL_OVERREACH",             label: "Jurisdictional Overreach",                   category: "Jurisdiction" },
  { value: "TRIBAL_COURT_JURISDICTION_NOT_INVOKED",label: "Tribal Court Jurisdiction Not Invoked",     category: "Jurisdiction" },
  { value: "IDENTITY_CHALLENGED",                  label: "Identity Challenged",                        category: "Identity" },
  { value: "PROCEEDING_WITHOUT_STATUS_ASSERTION",  label: "Proceeding Without Status Assertion",        category: "Identity" },
  { value: "STATUS_NOT_ON_RECORD",                 label: "Status Not on Record",                       category: "Identity" },
  { value: "NOTICES_SENT_NO_RESPONSE",             label: "Notices Sent — No Response",                 category: "Administrative" },
  { value: "ADMINISTRATIVE_CAPITULATION_RISK",     label: "Administrative Capitulation Risk",           category: "Administrative" },
  { value: "DOCUMENT_REJECTION",                   label: "Document Rejection",                         category: "Administrative" },
  { value: "RECORDER_REFUSAL",                     label: "Recorder Refusal",                           category: "Administrative" },
  { value: "AGENCY_DENIAL",                        label: "Agency Denial",                              category: "Administrative" },
  { value: "FEDERAL_PROGRAM_ACCESS_DENIED",        label: "Federal Program Access Denied",              category: "Benefits" },
  { value: "BENEFIT_DENIAL",                       label: "Benefit Denial",                             category: "Benefits" },
  { value: "DEBT_COLLECTION_ACTIVE",               label: "Debt Collection Active",                     category: "Benefits" },
  { value: "CREDIT_REPORTING_ACTIVE",              label: "Credit Reporting Active",                    category: "Benefits" },
  { value: "MANAGED_CARE_INTERFERENCE",            label: "Managed Care Interference",                  category: "Benefits" },
  { value: "TREATY_RIGHT_NOT_INVOKED",             label: "Treaty Right Not Invoked",                   category: "Treaty" },
  { value: "TRUST_RESPONSIBILITY_BREACH",          label: "Trust Responsibility Breach",                category: "Treaty" },
  { value: "FEDERAL_TRUST_TRIGGER",                label: "Federal Trust Trigger",                      category: "Treaty" },
  { value: "PROTECTED_RIGHTS_VIOLATION",           label: "Protected Rights Violation",                 category: "Treaty" },
  { value: "ICWA_PROCEEDING_DETECTED",             label: "ICWA Proceeding Detected",                   category: "ICWA" },
];

// ── Props ─────────────────────────────────────────────────────────────────────

export interface OpenInvestigationModalProps {
  onClose: () => void;
  /** Pre-selected signal type (optional) */
  defaultSignalType?: ReviewSignalType;
  /** Pre-filled triggering entity (optional) */
  defaultTriggeringEntity?: string;
  /** If this relates to a land parcel, pass its ID */
  affectedParcelId?: number;
  /** If this relates to a trust instrument, pass its ID */
  affectedInstrumentId?: number;
  /** Free-form matter description to pre-fill */
  affectedMatter?: string;
  /** Source label displayed in the header (e.g. "Encumbrance #3") */
  sourceLabel?: string;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function OpenInvestigationModal({
  onClose,
  defaultSignalType,
  defaultTriggeringEntity = "",
  affectedParcelId,
  affectedInstrumentId,
  affectedMatter = "",
  sourceLabel,
}: OpenInvestigationModalProps) {
  const { toast } = useToast();
  const [, navigate] = useLocation();

  const [signalType, setSignalType] = useState<ReviewSignalType>(
    defaultSignalType ?? "UNAUTHORIZED_LAND_ENCUMBRANCE"
  );
  const [triggeringEntity, setTriggeringEntity] = useState(defaultTriggeringEntity);
  const [contextNote, setContextNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setError(null);
    setSubmitting(true);
    try {
      const token = await getCurrentBearerToken();
      const res = await fetch("/api/court/review-engine/trigger", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          signalType,
          eventType: "manual_trigger",
          affectedParcelId: affectedParcelId ?? undefined,
          affectedInstrumentId: affectedInstrumentId ?? undefined,
          affectedMatter: affectedMatter || undefined,
          triggeringEntity: triggeringEntity.trim() || undefined,
          context: contextNote.trim() || undefined,
        }),
      });

      if (!res.ok) {
        const body = await res.text();
        setError(`Request failed (${res.status}): ${body}`);
        return;
      }

      const result = await res.json();
      const investigationId: number | undefined = result.investigationId ?? result.investigation?.id;
      const nfrId: number | undefined = result.nfrId ?? result.nfr?.id;

      toast({
        title: investigationId
          ? `Investigation #${investigationId} opened`
          : "Investigation opened",
        description: nfrId
          ? `NFR draft #${nfrId} created. Signal: ${signalType.replace(/_/g, " ")}`
          : `Signal: ${signalType.replace(/_/g, " ")}`,
      });

      onClose();
      if (investigationId) {
        navigate(`/investigations/${investigationId}`);
      } else {
        navigate("/supreme-court");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setSubmitting(false);
    }
  }

  const grouped = SIGNAL_OPTIONS.reduce<Record<string, typeof SIGNAL_OPTIONS>>((acc, o) => {
    (acc[o.category] ??= []).push(o);
    return acc;
  }, {});

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-[#111] border border-border rounded-xl w-full max-w-lg shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between px-6 py-4 border-b border-border">
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <Gavel className="w-4 h-4 text-amber-400" />
              <h2 className="text-base font-semibold text-amber-400">Open Investigation</h2>
            </div>
            {sourceLabel && (
              <p className="text-xs text-muted-foreground">Triggered from: {sourceLabel}</p>
            )}
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground mt-0.5">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">
          {/* Signal type */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-muted-foreground">Signal Type</label>
            <select
              value={signalType}
              onChange={e => setSignalType(e.target.value as ReviewSignalType)}
              className="bg-background border border-border rounded-md px-3 py-2 text-sm text-foreground w-full focus:outline-none focus:ring-1 focus:ring-amber-500"
            >
              {Object.entries(grouped).map(([cat, opts]) => (
                <optgroup key={cat} label={cat}>
                  {opts.map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>

          {/* Triggering entity */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-muted-foreground">
              Triggering Entity <span className="text-muted-foreground/60">(optional)</span>
            </label>
            <Input
              value={triggeringEntity}
              onChange={e => setTriggeringEntity(e.target.value)}
              placeholder="Name of person, agency, or entity responsible"
            />
          </div>

          {/* Context note */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-muted-foreground">
              Context Note <span className="text-muted-foreground/60">(optional)</span>
            </label>
            <Textarea
              value={contextNote}
              onChange={e => setContextNote(e.target.value)}
              placeholder="Any additional context, legal basis, or evidence notes to include in the investigation record…"
              className="resize-none h-24"
            />
          </div>

          {/* Pre-filled context badges */}
          {(affectedParcelId || affectedMatter) && (
            <div className="flex flex-wrap gap-2">
              {affectedParcelId && (
                <span className="text-[11px] bg-amber-900/30 text-amber-300 border border-amber-700/40 rounded px-2 py-0.5">
                  Parcel ID: {affectedParcelId}
                </span>
              )}
              {affectedMatter && (
                <span className="text-[11px] bg-muted text-muted-foreground border border-border rounded px-2 py-0.5 max-w-xs truncate">
                  Matter: {affectedMatter}
                </span>
              )}
            </div>
          )}

          {error && (
            <div className="flex items-start gap-2 text-sm text-red-400 bg-red-950/30 border border-red-700/40 rounded px-3 py-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 pb-5 flex justify-end gap-2 border-t border-border pt-4">
          <Button variant="outline" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button
            onClick={submit}
            disabled={submitting}
            className="bg-amber-700 hover:bg-amber-600 text-white"
            data-testid="button-open-investigation-submit"
          >
            {submitting ? (
              <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Opening…</>
            ) : (
              <><Gavel className="w-3.5 h-3.5 mr-1.5" /> Open Investigation</>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
