import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Info, AlertTriangle, MapPin, Clock, Users, FileText, CheckCircle2, ShieldAlert, BookOpen, Printer } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import type { AncestorRecord, AncestorContextMatch } from "@/pages/atlas";
import { ContinuityReport } from "@/components/ContinuityReport";

interface PersonContextPanelProps {
  ancestor: AncestorRecord | null;
  contextMatches: AncestorContextMatch[];
  onClose: () => void;
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

export function PersonContextPanel({ ancestor, contextMatches, onClose }: PersonContextPanelProps) {
  const [showReport, setShowReport] = useState(false);

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
  if (ancestor.tribalNation) {
    locationRecords.push({
      label: "Tribal nation homeland",
      text: `${ancestor.tribalNation} (approximate territory)`,
      confidence: ancestor.hasTimelineLocation ? "inferred" : "inferred",
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
            <Badge variant="outline" className="font-mono bg-background text-xs">Ancestor Record</Badge>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setShowReport(true)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded bg-primary/15 text-primary hover:bg-primary/25 transition-colors text-xs font-medium border border-primary/25"
              data-testid="generate-report-button"
              title="Generate printable Continuity Report for this ancestor"
            >
              <Printer className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Generate Continuity Report</span>
            </button>
            <button onClick={onClose} className="p-1 rounded hover:bg-muted" data-testid="person-panel-close">
              <X className="w-5 h-5 opacity-70" />
            </button>
          </div>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-5 space-y-6">

            {/* ── Person Profile ── */}
            <div>
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

              <div className="flex flex-wrap gap-2">
                {ancestor.generationalPosition !== undefined && ancestor.generationalPosition !== null && ancestor.generationalPosition > 0 && (
                  <Badge variant="secondary" className="text-[10px] uppercase tracking-wider">
                    Gen. {ancestor.generationalPosition}
                  </Badge>
                )}
                {ancestor.isDeceased && (
                  <Badge variant="outline" className="text-[10px] uppercase tracking-wider bg-background opacity-60">
                    Deceased
                  </Badge>
                )}
                {ancestor.isAncestor && (
                  <Badge variant="outline" className="text-[10px] uppercase tracking-wider bg-background">
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
            </div>

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
