import { AtlasEvent, AncestorRecord, AncestorContextMatch } from "@/pages/atlas";
import { motion, AnimatePresence } from "framer-motion";
import { X, ExternalLink, Info, Users, AlertTriangle } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";

interface AtlasDetailPanelProps {
  event: AtlasEvent | null;
  onClose: () => void;
  atlasMode?: boolean;
  contextMatches?: AncestorContextMatch[];
  onSelectPerson?: (id: number) => void;
}

const ERA_LABELS: Record<string, string> = {
  "colonial": "Colonial Era",
  "early-republic": "Early Republic",
  "removal": "Removal Era",
  "reservation": "Reservation Era",
  "post-civil-war": "Post-Civil War",
  "allotment": "Allotment Era",
  "jim-crow": "Jim Crow Era",
  "termination": "Termination Era",
  "wwii-migration": "WWII & Migration",
  "self-determination": "Self-Determination Era",
  "modern": "Modern Era",
};

export function AtlasDetailPanel({ event, onClose, atlasMode = false, contextMatches = [], onSelectPerson }: AtlasDetailPanelProps) {
  // Ancestors potentially relevant to this event
  const relatedAncestors = atlasMode
    ? contextMatches.filter(m => m.eventId === event?.id)
    : [];

  const criticalAncestors = relatedAncestors.filter(m => m.confidenceLevel === "high");
  const otherAncestors = relatedAncestors.filter(m => m.confidenceLevel !== "high");

  return (
    <AnimatePresence>
      {event && (
        <motion.div
          initial={{ x: "100%", opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: "100%", opacity: 0 }}
          transition={{ type: "spring", damping: 25, stiffness: 200 }}
          className="absolute right-0 top-0 bottom-0 w-full max-w-[480px] bg-background bg-parchment-texture border-l border-border shadow-2xl z-30 flex flex-col"
          data-testid="detail-panel"
        >
          <div className="flex-none p-4 border-b border-border/50 flex justify-between items-center bg-card/50">
            <Badge variant="outline" className="font-mono bg-background">{event.year} · {ERA_LABELS[event.era] || event.era}</Badge>
            <button onClick={onClose} className="p-1 rounded hover:bg-muted" data-testid="detail-close-button">
              <X className="w-5 h-5 opacity-70" />
            </button>
          </div>

          <ScrollArea className="flex-1">
            <div className="p-6 space-y-8">
              <div>
                <h2 className="font-serif text-2xl font-bold text-foreground mb-3 leading-tight">{event.title}</h2>
                <div className="flex flex-wrap gap-2 mb-4">
                  <Badge className={`
                    ${event.severity_level === "critical" ? "bg-[#a64115] hover:bg-[#a64115]" : ""}
                    ${event.severity_level === "high" ? "bg-[#c29b40] hover:bg-[#c29b40]" : ""}
                    ${event.severity_level === "moderate" ? "bg-[#5c744c] hover:bg-[#5c744c]" : ""}
                    text-white border-none uppercase tracking-widest text-[10px]
                  `}>
                    {event.severity_level} Severity
                  </Badge>
                  <Badge variant="secondary" className="uppercase tracking-widest text-[10px]">{event.event_type}</Badge>
                  <Badge variant="outline" className="uppercase tracking-widest text-[10px] bg-background">{event.policy_area}</Badge>
                </div>

                <div className="prose prose-sm prose-stone dark:prose-invert mt-4 leading-relaxed text-foreground/90 max-w-none">
                  <p>{event.description}</p>
                </div>
              </div>

              <div className="bg-primary/10 border border-primary/20 rounded-lg p-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-primary mb-2 flex items-center gap-2">
                  <Info className="w-3.5 h-3.5" /> In plain language
                </h3>
                <p className="text-sm text-foreground/90">{event.plain_language_summary}</p>
              </div>

              {event.ancestor_relevance_note && (
                <div className="bg-[#a64115]/10 border border-[#a64115]/20 rounded-lg p-4">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-[#a64115] mb-2">If this affected your ancestor</h3>
                  <p className="text-sm text-foreground/90">{event.ancestor_relevance_note}</p>
                </div>
              )}

              {/* ── Related Ancestors (Atlas Mode) ── */}
              {atlasMode && relatedAncestors.length > 0 && (
                <div className="bg-card/60 border border-border/60 rounded-lg overflow-hidden">
                  <div className="px-4 py-3 border-b border-border/40 flex items-center gap-2">
                    <Users className="w-4 h-4 text-muted-foreground" />
                    <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Ancestors Potentially Within Scope
                    </h3>
                    <Badge variant="secondary" className="ml-auto text-[10px]">{relatedAncestors.length}</Badge>
                  </div>
                  <div className="px-4 py-2 bg-amber-500/5 border-b border-amber-500/15">
                    <p className="text-[10px] text-amber-300/60 leading-relaxed flex items-start gap-1.5">
                      <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" />
                      These connections are computationally derived from lifespan dates. They are potentially relevant — not confirmed. Requires source review.
                    </p>
                  </div>
                  <div className="p-3 space-y-2">
                    {relatedAncestors.map((match, i) => (
                      <button
                        key={`${match.ancestorId}-${i}`}
                        onClick={() => onSelectPerson?.(match.ancestorId)}
                        className="w-full flex items-start gap-2 text-left px-3 py-2 rounded-lg hover:bg-muted/40 transition-colors group"
                      >
                        <div className="w-2 h-2 rounded-full mt-1.5 shrink-0 bg-[#7c9cbc]" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground group-hover:text-primary transition-colors truncate">
                            {match.fullName}
                          </p>
                          <div className="flex items-center gap-2 mt-0.5">
                            {(match.birthYear || match.deathYear) && (
                              <span className="text-xs text-muted-foreground">
                                {[match.birthYear, match.deathYear].filter(Boolean).join(" – ")}
                              </span>
                            )}
                            {match.tribalNation && (
                              <span className="text-xs text-amber-600/70 italic truncate">{match.tribalNation}</span>
                            )}
                          </div>
                        </div>
                        <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded border shrink-0 mt-0.5 ${
                          match.confidenceLevel === "high"
                            ? "bg-emerald-900/30 text-emerald-400 border-emerald-700/30"
                            : match.confidenceLevel === "moderate"
                            ? "bg-amber-900/30 text-amber-400 border-amber-700/30"
                            : "bg-zinc-800/60 text-zinc-500 border-zinc-700/30"
                        }`}>
                          {match.relationshipType?.replace(/_/g, " ")}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-6 border-t border-border/50 pt-6">
                {event.continuity_survival_note && (
                  <div className="relative pl-4 border-l-2 border-secondary">
                    <h3 className="font-serif italic text-lg text-secondary mb-1">Survival & Continuity</h3>
                    <p className="text-sm text-foreground/80">{event.continuity_survival_note}</p>
                  </div>
                )}

                {event.identity_impact && (
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">Identity Impact</h3>
                    <p className="text-sm text-foreground/80">{event.identity_impact}</p>
                  </div>
                )}

                {event.reclassification_impact && (
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">Reclassification Impact</h3>
                    <p className="text-sm text-foreground/80">{event.reclassification_impact}</p>
                  </div>
                )}

                {event.family_impact && (
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">Family Impact</h3>
                    <p className="text-sm text-foreground/80">{event.family_impact}</p>
                  </div>
                )}

                {event.urbanization_impact && (
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">Urbanization Impact</h3>
                    <p className="text-sm text-foreground/80">{event.urbanization_impact}</p>
                  </div>
                )}

                {event.health_access_impact && (
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">Health Access</h3>
                    <p className="text-sm text-foreground/80">{event.health_access_impact}</p>
                  </div>
                )}

                {event.modern_effect && (
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-accent mb-1">Still relevant today</h3>
                    <p className="text-sm text-foreground/80">{event.modern_effect}</p>
                  </div>
                )}
              </div>

              <div className="border-t border-border/50 pt-6 pb-8">
                <h3 className="text-xs font-mono text-muted-foreground uppercase mb-2">Source Document</h3>
                <a
                  href={event.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex items-start gap-2 text-sm font-medium text-primary hover:underline"
                >
                  <span className="leading-snug">{event.source_title}</span>
                  <ExternalLink className="w-3.5 h-3.5 mt-0.5 opacity-50 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                </a>
              </div>
            </div>
          </ScrollArea>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
