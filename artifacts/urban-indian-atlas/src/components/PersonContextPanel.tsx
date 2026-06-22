import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { X, Info, AlertTriangle, MapPin, Clock, Users, FileText, CheckCircle2, ShieldAlert, BookOpen, Printer, Zap, Shield, ScrollText, ChevronDown, ChevronRight } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import type { AncestorRecord, AncestorContextMatch } from "@/pages/atlas";
import { ContinuityReport } from "@/components/ContinuityReport";
import { authHeaders } from "@/lib/atlasAuth";
import { buildAffiliationSignals } from "@/lib/affiliationSignals";

const API = import.meta.env.VITE_API_BASE_URL ?? "";

interface AffiliationMatch {
  tribalNation: string;
  confidence: "confirmed" | "high" | "moderate" | "inferred";
  basis: string;
  activeEra: string;
  removalImpact: string | null;
  treaties: string[];
  survivingCommunity: string | null;
}

interface TribalAffiliationResult {
  ancestorId: number;
  fullName: string;
  detectedState: string | null;
  era: string;
  affiliations: AffiliationMatch[];
  logicSummary: string;
  reasoning: string[];
  confidence: "confirmed" | "high" | "moderate" | "inferred";
}

const CONF_COLORS: Record<string, string> = {
  confirmed: "text-emerald-400 border-emerald-700/40 bg-emerald-900/20",
  high:      "text-sky-400 border-sky-700/40 bg-sky-900/20",
  moderate:  "text-amber-400 border-amber-700/40 bg-amber-900/20",
  inferred:  "text-zinc-400 border-zinc-700/40 bg-zinc-800/40",
};

interface PersonContextPanelProps {
  ancestor: AncestorRecord | null;
  contextMatches: AncestorContextMatch[];
  onClose: () => void;
  onEventFocus?: (coords: [number, number]) => void;
}

const severityColors: Record<string, string> = {
  critical: "bg-[#a64115] hover:bg-[#a64115]",
  high: "bg-[#c29b40] hover:bg-[#c29b40]",
  moderate: "bg-[#5c744c] hover:bg-[#5c744c]",
};

const relationshipLabels: Record<string, { label: string; hedged: string }> = {
  alive_during: {
    label: "Alive During",
    hedged: "Records suggest this ancestor was alive when this event occurred. This event may have potentially affected them or their community directly.",
  },
  near_contemporary: {
    label: "Near Contemporary (±20 yr)",
    hedged: "This ancestor lived within 20 years of this event. While direct personal exposure cannot be confirmed, the policy environment almost certainly shaped the world their family inhabited.",
  },
  born_before: {
    label: "Born Before Event",
    hedged: "This ancestor was born before this event and may have lived through its earliest effects. The full impact on their record history requires source review.",
  },
  era_overlap: {
    label: "Era Overlap",
    hedged: "This ancestor's life partially overlapped with the era during which this event occurred. Contextual relevance is possible but not confirmed.",
  },
};

const confidenceBadge: Record<string, string> = {
  high: "bg-emerald-900/40 text-emerald-300 border-emerald-700/40",
  moderate: "bg-amber-900/40 text-amber-300 border-amber-700/40",
  low: "bg-zinc-800 text-zinc-400 border-zinc-700/40",
};

// Map location confidence strings to readable labels and badge styles
const locationConfidence = {
  records: { label: "From records", badge: "bg-blue-900/40 text-blue-300 border-blue-700/40", detail: "Drawn from ancestralTimelineEvents — actual document-level location data." },
  inferred: { label: "Inferred", badge: "bg-amber-900/40 text-amber-300 border-amber-700/40", detail: "Derived from tribal nation or lineage tags. Approximation only — no specific place record." },
  unknown: { label: "Location unknown", badge: "bg-zinc-800 text-zinc-400 border-zinc-700/40", detail: "No location data available in any record. Adding timeline events improves coverage." },
};

function ContextDisclaimer() {
  return (
    <div className="bg-amber-500/5 border border-amber-500/20 rounded-lg p-3 mb-4">
      <div className="flex gap-2">
        <Info className="w-3.5 h-3.5 text-amber-400 mt-0.5 shrink-0" />
        <p className="text-xs text-amber-200/70 leading-relaxed">
          Historical connections shown here are computationally derived from recorded dates, tribal nation, and affected regions. They are <strong>potentially relevant</strong> — not confirmed facts. All connections require source review. Record gaps, reclassification, and enumerator error mean documentary absence is not evidence of non-exposure.
        </p>
      </div>
    </div>
  );
}

// ─── Life Journey Components ───────────────────────────────────────────────────

const sevBorder: Record<string, string> = {
  critical: "border-[#a64115]/50 bg-[#a64115]/8",
  high:     "border-[#c29b40]/40 bg-[#c29b40]/6",
  moderate: "border-[#5c744c]/40 bg-[#5c744c]/6",
};
const sevDot: Record<string, string> = {
  critical: "bg-[#a64115]",
  high:     "bg-[#c29b40]",
  moderate: "bg-[#5c744c]",
};

function EventChip({
  match, onFocus, expanded, onExpand, lifeStart,
}: {
  match: AncestorContextMatch;
  onFocus?: (coords: [number, number]) => void;
  expanded: string | null;
  onExpand: (id: string | null) => void;
  lifeStart: number | null;
}) {
  const isOpen = expanded === match.eventId;
  const hasCoords = match.coordinateLat != null && match.coordinateLng != null;
  const ageStr = lifeStart && match.year >= lifeStart ? `Age ${match.year - lifeStart}` : null;
  const rel = relationshipLabels[match.relationshipType] ?? relationshipLabels.era_overlap;
  const confStyle = confidenceBadge[match.confidenceLevel] ?? confidenceBadge.low;

  return (
    <div className={`rounded-md border overflow-hidden ${sevBorder[match.severityLevel] ?? "border-border/40"}`}>
      <button
        className="w-full flex items-start gap-2.5 p-2.5 text-left hover:bg-white/5 transition-colors"
        onClick={() => onExpand(isOpen ? null : match.eventId)}
      >
        <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${sevDot[match.severityLevel] ?? "bg-muted"}`} />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-serif font-medium text-foreground/90 leading-snug">{match.title}</p>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            <span className="text-[10px] text-muted-foreground/60">{match.year}</span>
            {ageStr && <span className="text-[10px] text-muted-foreground/40">· {ageStr}</span>}
            <span className="text-[10px] text-muted-foreground/40 capitalize">· {match.severityLevel}</span>
            {match.locationMatch && (
              <span className="text-[10px] text-primary/60">· region match</span>
            )}
          </div>
        </div>
        {isOpen
          ? <ChevronDown className="w-3.5 h-3.5 mt-0.5 shrink-0 opacity-60" />
          : <ChevronRight className="w-3.5 h-3.5 mt-0.5 shrink-0 opacity-40" />
        }
      </button>

      {isOpen && (
        <div className="px-3 pb-3 pt-1 space-y-2 border-t border-white/10">
          {match.ancestorRelevanceNote && (
            <div className="bg-[#a64115]/8 border border-[#a64115]/20 rounded p-2">
              <p className="text-[10px] font-semibold text-[#c47040]/80 uppercase tracking-wider mb-0.5">If this affected your ancestor</p>
              <p className="text-xs text-foreground/75 leading-relaxed italic">{match.ancestorRelevanceNote}</p>
            </div>
          )}
          {match.identityImpact && (
            <div className="bg-amber-500/8 border border-amber-500/20 rounded p-2">
              <p className="text-[10px] font-semibold text-amber-400/80 uppercase tracking-wider mb-0.5">Identity Impact</p>
              <p className="text-xs text-foreground/75 leading-relaxed">{match.identityImpact}</p>
            </div>
          )}
          {match.reclassificationImpact && (
            <div className="flex items-start gap-1.5">
              <AlertTriangle className="w-3 h-3 text-amber-500/70 mt-0.5 shrink-0" />
              <p className="text-xs text-muted-foreground/80 leading-relaxed">{match.reclassificationImpact}</p>
            </div>
          )}
          <div className="bg-primary/5 border border-primary/15 rounded p-2">
            <p className="text-[10px] font-medium text-primary/70 uppercase tracking-wider mb-0.5">{rel.label}</p>
            <p className="text-xs text-foreground/60 leading-relaxed italic">{rel.hedged}</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap pt-0.5">
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-medium border ${confStyle}`}>
              {match.confidenceLevel} confidence
            </span>
            <span className="text-[10px] text-muted-foreground/50">{match.era}</span>
            {hasCoords && onFocus && (
              <button
                className="flex items-center gap-1 text-[10px] text-primary/70 hover:text-primary transition-colors ml-auto"
                onClick={(e) => { e.stopPropagation(); onFocus([match.coordinateLat!, match.coordinateLng!]); }}
              >
                <MapPin className="w-3 h-3" /> View on map
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function LifeJourneyTab({
  ancestor, contextMatches, onEventFocus,
}: {
  ancestor: AncestorRecord;
  contextMatches: AncestorContextMatch[];
  onEventFocus?: (coords: [number, number]) => void;
}) {
  const [expandedEvent, setExpandedEvent] = useState<string | null>(null);

  const lifeStart = ancestor.birthYear;
  const lifeEnd = ancestor.deathYear;

  if (!lifeStart) {
    return (
      <div className="text-center py-10 px-5 text-muted-foreground">
        <BookOpen className="w-7 h-7 mx-auto mb-2 opacity-25" />
        <p className="text-sm font-serif italic">Add a birth year to this record to enable the Life Journey view.</p>
      </div>
    );
  }

  // Generate decade buckets spanning the person's entire documented life
  const decadeStart = Math.floor(lifeStart / 10) * 10;
  const decadeEnd = Math.floor((lifeEnd ?? lifeStart + 20) / 10) * 10;
  const decades: number[] = [];
  for (let d = decadeStart; d <= decadeEnd; d += 10) decades.push(d);

  // Group matched events by decade
  const eventsByDecade = new Map<number, AncestorContextMatch[]>();
  for (const d of decades) {
    eventsByDecade.set(d, contextMatches.filter(m => m.year >= d && m.year <= d + 9).sort((a, b) => a.year - b.year));
  }

  // Pre-life events (up to 20 years before birth) that shaped the world he entered
  const preLifeEvents = contextMatches
    .filter(m => m.year < lifeStart && m.year >= lifeStart - 20)
    .sort((a, b) => a.year - b.year);

  const totalEvents = contextMatches.length;
  const critCount = contextMatches.filter(e => e.severityLevel === "critical").length;

  return (
    <div className="divide-y divide-border/30">
      {/* Life summary banner */}
      <div className="px-5 py-3 bg-card/40 space-y-1">
        <div className="flex items-center gap-2 text-xs text-muted-foreground/70">
          <Clock className="w-3 h-3" />
          <span>
            {lifeStart}{lifeEnd ? ` – ${lifeEnd}` : " – ?"}{lifeEnd && lifeStart ? ` · ${lifeEnd - lifeStart} years` : ""}
          </span>
        </div>
        {(ancestor.birthPlace || ancestor.locationAddress) && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground/60">
            <MapPin className="w-3 h-3" />
            <span>{ancestor.birthPlace ?? ancestor.locationAddress}</span>
          </div>
        )}
        {totalEvents > 0 && (
          <p className="text-[10px] text-muted-foreground/50 pt-0.5">
            {totalEvents} matched historical event{totalEvents !== 1 ? "s" : ""}
            {critCount > 0 ? ` · ${critCount} critical` : ""}
          </p>
        )}
      </div>

      {/* Birth anchor */}
      <div className="flex items-center gap-3 px-5 py-2.5 bg-emerald-900/10">
        <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/70 shrink-0 ring-2 ring-emerald-500/20" />
        <div>
          <p className="text-[10px] font-bold text-emerald-400/80 uppercase tracking-wider">Born {lifeStart}</p>
          <p className="text-[10px] text-muted-foreground/55">
            {ancestor.birthDate ? `${ancestor.birthDate} · ` : ""}
            {ancestor.birthPlace ?? ancestor.locationAddress ?? ancestor.tribalNation ?? "Location unrecorded"}
          </p>
        </div>
      </div>

      {/* Pre-life context */}
      {preLifeEvents.length > 0 && (
        <div className="px-5 py-3 bg-muted/5">
          <p className="text-[10px] font-semibold text-muted-foreground/50 uppercase tracking-wider mb-2.5">
            Before his birth — shaped the world he entered
          </p>
          <div className="space-y-2">
            {preLifeEvents.map(ev => (
              <EventChip key={ev.eventId} match={ev} onFocus={onEventFocus} expanded={expandedEvent} onExpand={setExpandedEvent} lifeStart={lifeStart} />
            ))}
          </div>
        </div>
      )}

      {/* Decade timeline */}
      {decades.map((decade, idx) => {
        const evts = eventsByDecade.get(decade) ?? [];
        const ageAtDecadeStart = Math.max(0, decade - lifeStart);
        const decadeEndYear = decade + 9;
        const isBirthDecade = lifeStart >= decade && lifeStart <= decadeEndYear;
        const isDeathDecade = lifeEnd != null && lifeEnd >= decade && lifeEnd <= decadeEndYear;
        const isLast = idx === decades.length - 1;

        return (
          <div key={decade}>
            {/* Decade marker row */}
            <div className={`flex items-center gap-3 px-5 py-2 ${evts.length > 0 ? "bg-card/15" : ""}`}>
              <div className="flex flex-col items-center w-5 shrink-0 self-stretch">
                <div className={`w-px flex-1 ${idx === 0 ? "bg-transparent" : "bg-border/30"}`} />
                <div className={`w-2 h-2 rounded-full shrink-0 ${evts.length > 0 ? "bg-primary/40 ring-1 ring-primary/20" : "bg-border/30"}`} />
                <div className={`w-px flex-1 ${isLast ? "bg-transparent" : "bg-border/30"}`} />
              </div>
              <div className="flex-1 flex items-baseline gap-2 min-w-0">
                <p className="text-xs font-bold text-foreground/75">{decade}s</p>
                <p className="text-[10px] text-muted-foreground/45 truncate">
                  Age {ageAtDecadeStart}–{Math.min(ageAtDecadeStart + 9, (lifeEnd ?? lifeStart + 80) - lifeStart)}
                  {isBirthDecade ? " · Birth decade" : ""}
                  {isDeathDecade && lifeEnd ? ` · Died ${lifeEnd}` : ""}
                </p>
              </div>
              {evts.length > 0 && (
                <span className="text-[10px] text-muted-foreground/50 shrink-0">
                  {evts.length} event{evts.length !== 1 ? "s" : ""}
                </span>
              )}
              {evts.length === 0 && (
                <span className="text-[10px] text-muted-foreground/25 italic shrink-0">quiet</span>
              )}
            </div>

            {/* Events in this decade */}
            {evts.length > 0 && (
              <div className="px-5 pb-3 space-y-2">
                {evts.map(ev => (
                  <EventChip key={ev.eventId} match={ev} onFocus={onEventFocus} expanded={expandedEvent} onExpand={setExpandedEvent} lifeStart={lifeStart} />
                ))}
              </div>
            )}
          </div>
        );
      })}

      {/* Death anchor */}
      {lifeEnd && (
        <div className="flex items-center gap-3 px-5 py-2.5 bg-rose-900/10">
          <div className="w-2.5 h-2.5 rounded-full bg-rose-500/60 shrink-0 ring-2 ring-rose-500/20" />
          <div>
            <p className="text-[10px] font-bold text-rose-400/70 uppercase tracking-wider">Died {lifeEnd}</p>
            <p className="text-[10px] text-muted-foreground/55">
              {ancestor.deathDate ? `${ancestor.deathDate} · ` : ""}
              {ancestor.deathPlace ?? ancestor.locationAddress ?? ""}
              {lifeStart ? ` · ${lifeEnd - lifeStart} years` : ""}
            </p>
          </div>
        </div>
      )}

      {/* Empty state */}
      {contextMatches.length === 0 && (
        <div className="text-center py-8 px-5 text-muted-foreground">
          <p className="text-xs font-serif italic">No historical events matched to this ancestor's lifespan yet.</p>
          <p className="text-[10px] mt-1 opacity-60">Confirm birth/death years and tribal nation to improve matching.</p>
        </div>
      )}

      {/* Disclaimer */}
      <div className="px-5 py-3">
        <ContextDisclaimer />
      </div>
    </div>
  );
}

// ─── Tribal Affiliation Logic Engine Section ──────────────────────────────────

function TribalAffiliationSection({ ancestorId }: { ancestorId: number }) {
  const [expanded, setExpanded] = useState(false);

  const { data, isLoading, isError } = useQuery<TribalAffiliationResult>({
    queryKey: ["tribal-affiliation", ancestorId],
    queryFn: async () => {
      const res = await fetch(`${API}/api/ancestors/${ancestorId}/affiliation`, {
        headers: { "Content-Type": "application/json", ...authHeaders() },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json() as Promise<TribalAffiliationResult>;
    },
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  if (isLoading) {
    return (
      <div className="bg-card/60 border border-border/60 rounded-lg p-3 flex items-center gap-2 text-xs text-muted-foreground">
        <Zap className="w-3.5 h-3.5 animate-pulse text-primary/60" />
        Running affiliation analysis…
      </div>
    );
  }

  if (isError || !data) return null;

  const hasAffiliations = data.affiliations.length > 0;
  const confColor = CONF_COLORS[data.confidence] ?? CONF_COLORS.inferred;

  return (
    <div className="bg-card/60 border border-border/60 rounded-lg overflow-hidden">
      <button
        className="w-full flex items-center gap-2 p-3 text-left hover:bg-white/5 transition-colors"
        onClick={() => setExpanded(v => !v)}
      >
        <Zap className="w-3.5 h-3.5 text-primary/80 shrink-0" />
        <div className="flex-1 min-w-0">
          <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Tribal Affiliation Analysis
          </h3>
          {hasAffiliations && (
            <p className="text-[10px] text-foreground/60 truncate mt-0.5">
              {data.affiliations.slice(0, 3).map(a => a.tribalNation).join(" · ")}
            </p>
          )}
          {!hasAffiliations && (
            <p className="text-[10px] text-muted-foreground/60 mt-0.5">Add location data to unlock analysis</p>
          )}
        </div>
        <span className={`text-[9px] font-semibold px-2 py-0.5 rounded-full border ${confColor}`}>
          {data.confidence}
        </span>
        {expanded ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground shrink-0" /> : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />}
      </button>

      {expanded && (
        <div className="border-t border-border/50 p-3 space-y-3">
          {/* Logic summary */}
          <p className="text-xs text-foreground/75 leading-relaxed">{data.logicSummary}</p>

          {/* Era */}
          <p className="text-[10px] text-muted-foreground/60 font-medium">{data.era}{data.detectedState ? ` · ${data.detectedState.replace(/\b\w/g, c => c.toUpperCase())}` : ""}</p>

          {/* Affiliations list */}
          {data.affiliations.map((a, i) => (
            <div key={i} className="bg-card/40 border border-border/50 rounded-md p-2.5 space-y-1.5">
              <div className="flex items-start gap-2">
                <Shield className="w-3 h-3 text-primary/60 mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <p className="text-xs font-semibold text-foreground">{a.tribalNation}</p>
                    <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded-full border ${CONF_COLORS[a.confidence] ?? CONF_COLORS.inferred}`}>
                      {a.confidence}
                    </span>
                  </div>
                  <p className="text-[10px] text-muted-foreground/70 leading-relaxed mt-0.5">{a.basis}</p>
                </div>
              </div>
              {a.treaties.length > 0 && (
                <div className="flex items-start gap-1.5 pl-5">
                  <ScrollText className="w-2.5 h-2.5 text-muted-foreground/50 mt-0.5 shrink-0" />
                  <p className="text-[10px] text-muted-foreground/60">{a.treaties.slice(0, 2).join(" · ")}</p>
                </div>
              )}
              {a.survivingCommunity && (
                <p className="text-[10px] text-primary/60 pl-5 leading-relaxed">
                  Today: {a.survivingCommunity}
                </p>
              )}
            </div>
          ))}

          {/* First reasoning sentence */}
          {data.reasoning.length > 0 && (
            <p className="text-[10px] text-muted-foreground/55 leading-relaxed border-t border-border/40 pt-2">
              {data.reasoning[0]}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main panel ───────────────────────────────────────────────────────────────

export function PersonContextPanel({ ancestor, contextMatches, onClose, onEventFocus }: PersonContextPanelProps) {
  const [showReport, setShowReport] = useState(false);
  const [activeView, setActiveView] = useState<"journey" | "analysis">("journey");

  if (!ancestor) return null;

  const lifespan = [ancestor.birthYear, ancestor.deathYear].filter(Boolean).join(" – ") || "Dates unknown";

  // Sort by severity first, then by confidence
  const eventsByPriority = [...contextMatches].sort((a, b) => {
    const sevOrder = { critical: 0, high: 1, moderate: 2 };
    const confOrder = { high: 0, moderate: 1, low: 2 };
    return (
      ((sevOrder[a.severityLevel as keyof typeof sevOrder] ?? 2) - (sevOrder[b.severityLevel as keyof typeof sevOrder] ?? 2)) ||
      ((confOrder[a.confidenceLevel as keyof typeof confOrder] ?? 2) - (confOrder[b.confidenceLevel as keyof typeof confOrder] ?? 2))
    );
  });

  const locationMatchCount = eventsByPriority.filter(e => e.locationMatch).length;
  const criticalCount = eventsByPriority.filter(e => e.severityLevel === "critical").length;
  const highCount = eventsByPriority.filter(e => e.severityLevel === "high").length;
  const highConfidenceCount = eventsByPriority.filter(e => e.confidenceLevel === "high").length;
  const affiliationSignals = buildAffiliationSignals(ancestor);

  // ── Location records (with confidence tier) ─────────────────────────────────
  // We surface all known location signals for this ancestor, each with an
  // explicit confidence label so the reader knows what kind of evidence exists.
  const locationRecords: { label: string; text: string; confidence: keyof typeof locationConfidence }[] = [];
  if (ancestor.locationText && ancestor.hasTimelineLocation) {
    locationRecords.push({
      label: "Recorded location",
      text: ancestor.locationText,
      confidence: "records",
    });
  }
  if (ancestor.locationAddress && !locationRecords.some(r => r.text === ancestor.locationAddress)) {
    locationRecords.push({
      label: "Known address / location",
      text: ancestor.locationAddress,
      confidence: "records",
    });
  }
  if (ancestor.tribalNation) {
    locationRecords.push({
      label: "Likely Ancestral Affiliation / Lineage",
      text: `Likely ${ancestor.tribalNation} lineage / family affiliation`,
      confidence: "inferred",
    });
  }

  // ── Classification & community identity notes ────────────────────────────────
  // Pull the subset of context matches that relate to census classification,
  // reclassification, or identity — these are the events most directly tied to
  // continuity disruption and are shown as a dedicated "Classification Record"
  // section distinct from the general historical events list.
  const classificationEvents = eventsByPriority.filter(e => {
    const et = (e.eventType ?? "").toLowerCase();
    const pa = (e.policyArea ?? "").toLowerCase();
    return (
      et.includes("census classif") ||
      et.includes("reclassif") ||
      et.includes("tribal enrollment") ||
      et.includes("blood quantum") ||
      pa.includes("reclassif") ||
      pa.includes("enrollment") ||
      pa.includes("blood quantum") ||
      pa.includes("identity") ||
      (e.reclassificationImpact && e.reclassificationImpact.length > 0) ||
      (e.identityImpact && e.identityImpact.length > 0)
    );
  });

  return (
    <AnimatePresence>
      <motion.div
        initial={{ x: "100%", opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: "100%", opacity: 0 }}
        transition={{ type: "spring", damping: 25, stiffness: 200 }}
        className="absolute right-0 top-0 bottom-0 w-full max-w-[440px] bg-background bg-parchment-texture border-l border-border shadow-2xl z-30 flex flex-col"
        data-testid="person-context-panel"
      >
        {/* Header */}
        <div className="flex-none p-4 border-b border-border/50 flex justify-between items-center bg-card/50">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center">
              <Users className="w-3.5 h-3.5 text-primary" />
            </div>
            {ancestor.recordStatus === "household_member" ? (
              <Badge variant="outline" className="font-mono bg-background text-xs border-emerald-500/40 text-emerald-400">Protected Member</Badge>
            ) : ancestor.recordStatus === "extended_family" ? (
              <Badge variant="outline" className="font-mono bg-background text-xs border-sky-500/40 text-sky-400">Eligible Family / Protected Lineage</Badge>
            ) : (
              <Badge variant="outline" className="font-mono bg-background text-xs">Ancestor Record</Badge>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setShowReport(true)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded bg-primary/15 text-primary hover:bg-primary/25 transition-colors text-xs font-medium border border-primary/25"
              data-testid="generate-report-button"
              title="Generate printable Continuity Report for this ancestor"
            >
              <Printer className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Generate Report</span>
            </button>
            <button onClick={onClose} className="p-1 rounded hover:bg-muted" data-testid="person-panel-close">
              <X className="w-5 h-5 opacity-70" />
            </button>
          </div>
        </div>

        {/* ── View tabs ── */}
        <div className="flex-none flex border-b border-border/50 bg-card/30">
          <button
            className={`flex-1 py-2 text-xs font-semibold tracking-wide transition-colors flex items-center justify-center gap-1.5 ${activeView === "journey" ? "text-primary border-b-2 border-primary bg-primary/5" : "text-muted-foreground hover:text-foreground"}`}
            onClick={() => setActiveView("journey")}
          >
            <Clock className="w-3.5 h-3.5" /> Life Journey
          </button>
          <button
            className={`flex-1 py-2 text-xs font-semibold tracking-wide transition-colors flex items-center justify-center gap-1.5 ${activeView === "analysis" ? "text-primary border-b-2 border-primary bg-primary/5" : "text-muted-foreground hover:text-foreground"}`}
            onClick={() => setActiveView("analysis")}
          >
            <FileText className="w-3.5 h-3.5" /> Analysis
          </button>
        </div>

        {/* ── Life Journey tab ── */}
        {activeView === "journey" && (
          <ScrollArea className="flex-1">
            {/* Compact profile header */}
            <div className="flex items-center gap-3 px-5 pt-4 pb-3 border-b border-border/30">
              {ancestor.photoUrl && (
                <img src={ancestor.photoUrl} alt={ancestor.fullName}
                  className="w-10 h-10 rounded-full object-cover border border-border/50 shrink-0"
                  onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                />
              )}
              <div className="min-w-0">
                <h2 className="font-serif text-base font-bold text-foreground leading-tight truncate">{ancestor.fullName}</h2>
                <p className="text-[10px] text-muted-foreground/60 mt-0.5">{lifespan}
                  {ancestor.tribalNation ? ` · ${ancestor.tribalNation}` : ""}</p>
              </div>
            </div>
            <LifeJourneyTab ancestor={ancestor} contextMatches={contextMatches} onEventFocus={onEventFocus} />
          </ScrollArea>
        )}

        {/* ── Analysis tab ── */}
        {activeView === "analysis" && (
        <ScrollArea className="flex-1">
          <div className="p-5 space-y-6">

            {/* ── Person Profile ── */}
            <div>
              {ancestor.photoUrl && (
                <div className="mb-3">
                  <img
                    src={ancestor.photoUrl}
                    alt={ancestor.fullName}
                    className="w-20 h-20 rounded-full object-cover border-2 border-border shadow-md"
                    onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                  />
                </div>
              )}
              <h2 className="font-serif text-2xl font-bold text-foreground mb-1 leading-tight">{ancestor.fullName}</h2>
              <div className="flex flex-wrap gap-1.5 mb-3">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Clock className="w-3 h-3" />
                  <span>{lifespan}</span>
                </div>
                {ancestor.tribalNation && (
                  <div className="flex items-center gap-1.5 text-xs text-amber-600/80">
                    <MapPin className="w-3 h-3" />
                    <span className="italic">{ancestor.tribalNation}</span>
                  </div>
                )}
              </div>

              {(ancestor.birthDate || ancestor.birthPlace || ancestor.deathDate || ancestor.deathPlace || ancestor.burialPlace) && (
                <div className="text-xs space-y-1 mb-3 border border-border/50 rounded-md px-3 py-2 bg-muted/30">
                  {(ancestor.birthDate || ancestor.birthPlace) && (
                    <div className="flex gap-2">
                      <span className="text-muted-foreground w-16 shrink-0">Born</span>
                      <span className="text-foreground">{[ancestor.birthDate, ancestor.birthPlace].filter(Boolean).join(" — ")}</span>
                    </div>
                  )}
                  {(ancestor.deathDate || ancestor.deathPlace) && (
                    <div className="flex gap-2">
                      <span className="text-muted-foreground w-16 shrink-0">Died</span>
                      <span className="text-foreground">{[ancestor.deathDate, ancestor.deathPlace].filter(Boolean).join(" — ")}</span>
                    </div>
                  )}
                  {ancestor.burialPlace && (
                    <div className="flex gap-2">
                      <span className="text-muted-foreground w-16 shrink-0">Buried</span>
                      <span className="text-foreground">{ancestor.burialPlace}</span>
                    </div>
                  )}
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                {ancestor.generationalPosition !== undefined && ancestor.generationalPosition !== null && ancestor.generationalPosition > 0 && (
                  <Badge variant="secondary" className="text-[10px] uppercase tracking-wider">
                    Gen. {ancestor.generationalPosition}
                  </Badge>
                )}
                {ancestor.recordStatus === "household_member" && (
                  <Badge variant="outline" className="text-[10px] uppercase tracking-wider bg-emerald-900/20 border-emerald-500/30 text-emerald-400">
                    Protected Member
                  </Badge>
                )}
                {ancestor.recordStatus === "extended_family" && (
                  <Badge variant="outline" className="text-[10px] uppercase tracking-wider bg-sky-900/20 border-sky-500/30 text-sky-400">
                    Eligible Family
                  </Badge>
                )}
                {ancestor.isDeceased && (
                  <Badge variant="outline" className="text-[10px] uppercase tracking-wider bg-background opacity-60">
                    Ancestor
                  </Badge>
                )}
              </div>
            </div>

            {/* ── Known Locations (with confidence scoring) ── */}
            <div className="bg-card/60 border border-border/60 rounded-lg p-4 space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5" /> Known Locations
              </h3>
              {locationRecords.length === 0 ? (
                <div className="flex items-start gap-2">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-medium border ${locationConfidence.unknown.badge}`}>
                    {locationConfidence.unknown.label}
                  </span>
                  <p className="text-xs text-muted-foreground/70 leading-relaxed">{locationConfidence.unknown.detail}</p>
                </div>
              ) : (
                locationRecords.map((loc, i) => {
                  const conf = locationConfidence[loc.confidence];
                  return (
                    <div key={i} className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-medium border ${conf.badge}`}>
                          {conf.label}
                        </span>
                        <span className="text-[10px] text-muted-foreground/60 font-medium uppercase tracking-wider">{loc.label}</span>
                      </div>
                      <p className="text-sm text-foreground/90 pl-0.5">{loc.text}</p>
                      <p className="text-[10px] text-muted-foreground/55 leading-relaxed">{conf.detail}</p>
                    </div>
                  );
                })
              )}
              {locationMatchCount > 0 && (
                <div className="flex items-center gap-1.5 text-[10px] text-primary/80 pt-1 border-t border-border/40">
                  <CheckCircle2 className="w-3 h-3" />
                  <span>{locationMatchCount} historical event{locationMatchCount !== 1 ? "s" : ""} with region overlap to known locations</span>
                </div>
              )}
              {/* Disclaimer — always shown to avoid political misreading */}
              <div className="mt-2 pt-2 border-t border-border/30">
                <p className="text-[9px] text-muted-foreground/45 leading-relaxed italic">
                  This location is based on known ancestry records, last known residence, historical movement, and likely lineage affiliation. It does not determine political jurisdiction or tribal citizenship by itself. Presence in a territory does not automatically mean a person was governed by, subject to, or politically part of that nation.
                </p>
              </div>
            </div>


            {/* ── Affiliation Signals ── */}
            <div className="bg-amber-500/5 border border-amber-500/20 rounded-lg p-4 space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                <ShieldAlert className="w-3.5 h-3.5" /> Affiliation Signals
              </h3>
              {affiliationSignals.length === 0 ? (
                <p className="text-xs text-muted-foreground/70 leading-relaxed">
                  No geography-based probable affiliation signals are available yet. This does not mean affiliation is unknown or absent; it means the Atlas needs more place, date, or source evidence.
                </p>
              ) : (
                <div className="space-y-3">
                  {affiliationSignals.map((signal, i) => (
                    <div key={`${signal.type}-${signal.tribeOrTerritory}-${i}`} className="rounded-md border border-amber-500/20 bg-background/50 p-3 space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline" className="text-[9px] uppercase tracking-wider border-amber-500/30 text-amber-300 bg-amber-500/10">
                          {signal.label}
                        </Badge>
                        <Badge variant="outline" className="text-[9px] uppercase tracking-wider border-border/60 text-muted-foreground">
                          {signal.confidence} confidence
                        </Badge>
                      </div>
                      <p className="text-sm font-semibold text-foreground">{signal.tribeOrTerritory}</p>
                      <ul className="space-y-1 list-disc pl-4">
                        {signal.basis.map((basis, basisIndex) => (
                          <li key={basisIndex} className="text-xs text-muted-foreground/80 leading-relaxed">{basis}</li>
                        ))}
                      </ul>
                      <p className="text-[10px] text-amber-200/65 leading-relaxed italic">{signal.warning}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* ── Tribal Affiliation Logic Engine ── */}
            <TribalAffiliationSection ancestorId={ancestor.id} />

            {/* ── Classification & Community Identity Record ── */}
            {classificationEvents.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-xs font-mono font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                  <ShieldAlert className="w-3.5 h-3.5 text-amber-500/80" />
                  Classification & Identity Record
                </h3>
                <div className="bg-amber-500/5 border border-amber-500/20 rounded-lg p-3 mb-2">
                  <p className="text-[10px] text-amber-200/65 leading-relaxed">
                    These events directly affected how Native identity was recorded, enumerated, and legally defined during this ancestor's lifetime. Reclassification, enrollment, and blood-quantum policies are primary mechanisms of continuity disruption.
                  </p>
                </div>
                {classificationEvents.map((match, i) => {
                  const confStyle = confidenceBadge[match.confidenceLevel] ?? confidenceBadge.low;
                  return (
                    <div key={`class-${match.eventId}-${i}`} className="bg-card/50 border border-amber-500/20 rounded-lg p-3 space-y-2">
                      <div className="flex flex-wrap gap-1.5 mb-1">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-widest text-white border-none ${severityColors[match.severityLevel] ?? ""}`}>
                          {match.severityLevel}
                        </span>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-medium border ${confStyle}`}>
                          {match.confidenceLevel} confidence
                        </span>
                        {match.locationMatch && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-medium border bg-primary/10 text-primary border-primary/25">
                            <CheckCircle2 className="w-2.5 h-2.5" /> region match
                          </span>
                        )}
                      </div>
                      <p className="text-sm font-serif font-medium text-foreground leading-snug">{match.title}</p>
                      <p className="text-xs text-muted-foreground">{match.year} · {match.era}</p>
                      {match.identityImpact && (
                        <div className="bg-amber-500/8 border border-amber-500/20 rounded p-2">
                          <p className="text-[10px] font-medium text-amber-400/80 uppercase tracking-wider mb-0.5">Identity Impact</p>
                          <p className="text-xs text-foreground/80 leading-relaxed">{match.identityImpact}</p>
                        </div>
                      )}
                      {match.reclassificationImpact && (
                        <div className="mt-1 flex items-start gap-1.5">
                          <AlertTriangle className="w-3 h-3 text-amber-500/70 mt-0.5 shrink-0" />
                          <p className="text-xs text-muted-foreground/80 leading-relaxed">{match.reclassificationImpact}</p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* ── Exposure Summary ── */}
            {eventsByPriority.length > 0 && (
              <div className="bg-card/60 border border-border/60 rounded-lg p-4 space-y-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Potentially Relevant Historical Events</h3>
                <div className="flex flex-wrap gap-3 text-xs">
                  {criticalCount > 0 && <span className="text-[#a64115] font-semibold">{criticalCount} Critical</span>}
                  {highCount > 0 && <span className="text-[#c29b40] font-medium">{highCount} High</span>}
                  {highConfidenceCount > 0 && (
                    <span className="text-emerald-400">
                      {highConfidenceCount} high-confidence match{highConfidenceCount !== 1 ? "es" : ""}
                    </span>
                  )}
                  {locationMatchCount > 0 && (
                    <span className="text-primary/80 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" />
                      {locationMatchCount} region match{locationMatchCount !== 1 ? "es" : ""}
                    </span>
                  )}
                  <span className="text-muted-foreground">{eventsByPriority.length} total</span>
                </div>
              </div>
            )}

            {/* Disclaimer */}
            <ContextDisclaimer />

            {/* ── Full Historical Context Events ── */}
            {eventsByPriority.length > 0 ? (
              <div className="space-y-4">
                <h3 className="text-xs font-mono font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                  <FileText className="w-3.5 h-3.5" />
                  Historical Context
                </h3>
                {eventsByPriority.map((match, i) => {
                  const rel = relationshipLabels[match.relationshipType] ?? relationshipLabels.era_overlap;
                  const confStyle = confidenceBadge[match.confidenceLevel] ?? confidenceBadge.low;
                  // Skip events already shown in the Classification section above to avoid duplication
                  const alreadyShown = classificationEvents.some(c => c.eventId === match.eventId);
                  return (
                    <div key={`${match.eventId}-${i}`} className={`bg-card/50 border border-border/50 rounded-lg overflow-hidden ${alreadyShown ? "opacity-50" : ""}`}>
                      <div className="p-3">
                        <div className="flex items-start gap-2 mb-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap gap-1.5 mb-1">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-widest text-white border-none ${severityColors[match.severityLevel] ?? ""}`}>
                                {match.severityLevel}
                              </span>
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-medium border ${confStyle}`}>
                                {match.confidenceLevel} confidence
                              </span>
                              {match.locationMatch && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-medium border bg-primary/10 text-primary border-primary/25">
                                  <CheckCircle2 className="w-2.5 h-2.5" /> region match
                                </span>
                              )}
                              {alreadyShown && (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] border bg-muted/30 text-muted-foreground border-border/40">
                                  shown above
                                </span>
                              )}
                            </div>
                            <p className="text-sm font-serif font-medium text-foreground leading-snug">{match.title}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">{match.year} · {match.era}</p>
                          </div>
                        </div>

                        <div className="bg-primary/5 border border-primary/15 rounded p-2 mb-2">
                          <p className="text-[10px] font-medium text-primary/80 uppercase tracking-wider mb-0.5">{rel.label}</p>
                          <p className="text-xs text-foreground/80 leading-relaxed">{rel.hedged}</p>
                        </div>

                        {match.ancestorRelevanceNote && (
                          <div className="bg-[#a64115]/8 border border-[#a64115]/20 rounded p-2 mt-2">
                            <p className="text-xs text-foreground/75 leading-relaxed italic">
                              <span className="font-medium not-italic text-[#a64115]/80">If this affected your ancestor: </span>
                              {match.ancestorRelevanceNote}
                            </p>
                          </div>
                        )}

                        {!alreadyShown && match.reclassificationImpact && (
                          <div className="mt-2 flex items-start gap-1.5">
                            <AlertTriangle className="w-3 h-3 text-amber-500/70 mt-0.5 shrink-0" />
                            <p className="text-xs text-muted-foreground/80 leading-relaxed">{match.reclassificationImpact}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <BookOpen className="w-8 h-8 mx-auto mb-3 opacity-30" />
                <p className="text-sm font-serif italic">No historical event overlaps found for this ancestor's recorded lifespan.</p>
                <p className="text-xs mt-1 opacity-60">Missing birth/death years limit matching. Adding dates to the lineage record improves context.</p>
              </div>
            )}

          </div>
        </ScrollArea>
        )}
      </motion.div>

      {/* Continuity Report modal — rendered outside the sliding panel so it covers full screen */}
      {showReport && (
        <ContinuityReport
          key={ancestor.id}
          ancestor={ancestor}
          contextMatches={contextMatches}
          onClose={() => setShowReport(false)}
        />
      )}
    </AnimatePresence>
  );
}
