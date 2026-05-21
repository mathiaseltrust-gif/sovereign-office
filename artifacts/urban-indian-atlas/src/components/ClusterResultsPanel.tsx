import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, MapPin, Users, ChevronDown } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { AncestorPlot } from "@/components/AtlasMap";

export type { AncestorPlot as ClusterMember };

interface ClusterResultsPanelProps {
  members: AncestorPlot[];
  onClose: () => void;
  onSelectPerson: (id: number) => void;
  locationLabel?: string;
}

const PAGE_SIZE = 10;

function generationLabel(pos: number | null): string {
  if (pos === null) return "Ancestor";
  if (pos === 1) return "Parent";
  if (pos === 2) return "Grandparent";
  if (pos === 3) return "Great-Grandparent";
  return `${pos - 2}× Great-Grandparent`;
}

const SOURCE_LABELS: Record<string, string> = {
  verified_coords: "Verified location",
  timeline_record: "From records",
  location_address: "Address record",
  tribal_nation: "Tribal nation (inferred)",
};

const EVENT_TYPE_LABELS: Record<string, string> = {
  birth: "Birth",
  death: "Death",
  burial: "Burial",
  lived_in: "Lived In",
  marriage: "Marriage",
};

export function ClusterResultsPanel({
  members,
  onClose,
  onSelectPerson,
  locationLabel,
}: ClusterResultsPanelProps) {
  const [page, setPage] = useState(1);
  const shown = members.slice(0, page * PAGE_SIZE);
  const hasMore = shown.length < members.length;

  return (
    <AnimatePresence>
      {members.length > 0 && (
        <motion.div
          initial={{ y: "100%", opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: "100%", opacity: 0 }}
          transition={{ type: "spring", damping: 28, stiffness: 220 }}
          className="absolute bottom-0 left-0 right-0 bg-background bg-parchment-texture border-t border-border shadow-2xl z-30 flex flex-col"
          style={{ maxHeight: "48%" }}
          data-testid="cluster-results-panel"
        >
          {/* Header */}
          <div className="flex-none flex items-center justify-between px-4 py-2.5 border-b border-border/50 bg-card/60">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-primary" />
              <span className="font-serif font-semibold text-sm">
                {members.length} Ancestor{members.length !== 1 ? "s" : ""} in this area
              </span>
              {locationLabel && (
                <Badge variant="outline" className="text-[10px] font-mono ml-1">
                  <MapPin className="w-2.5 h-2.5 mr-1" />
                  {locationLabel}
                </Badge>
              )}
            </div>
            <button
              onClick={onClose}
              className="p-1 rounded hover:bg-muted transition-colors"
              data-testid="cluster-panel-close"
            >
              <X className="w-4 h-4 opacity-60" />
            </button>
          </div>

          <ScrollArea className="flex-1">
            <div className="divide-y divide-border/30">
              {shown.map(({ ancestor, source, lifeEventType }) => {
                const years = [ancestor.birthYear, ancestor.deathYear].filter(Boolean).join(" – ");
                const genLabel = generationLabel(ancestor.generationalPosition);
                const locationNote = source === "tribal_nation"
                  ? ancestor.tribalNation
                    ? `Likely · ${ancestor.tribalNation}`
                    : "Inferred location"
                  : ancestor.locationAddress ?? ancestor.locationText ?? SOURCE_LABELS[source] ?? source;

                return (
                  <button
                    key={ancestor.id}
                    onClick={() => { onSelectPerson(ancestor.id); onClose(); }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-muted/30 transition-colors group"
                    data-testid={`cluster-member-${ancestor.id}`}
                  >
                    {/* Color swatch */}
                    <div
                      className="w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center text-[10px] font-bold text-white border border-white/20"
                      style={{ background: "#8b2020" }}
                    >
                      {(ancestor.firstName?.[0] ?? ancestor.fullName?.[0] ?? "?").toUpperCase()}
                      {(ancestor.lastName?.[0] ?? "").toUpperCase()}
                    </div>

                    {/* Name + meta */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground group-hover:text-primary transition-colors truncate">
                        {ancestor.fullName}
                      </p>
                      <div className="flex items-center gap-2 flex-wrap mt-0.5">
                        {years && <span className="text-[10px] text-muted-foreground">{years}</span>}
                        <span className="text-[10px] text-muted-foreground/60">· {genLabel}</span>
                        {ancestor.tribalNation && (
                          <span className="text-[10px] text-amber-500/70 italic truncate">
                            · {ancestor.tribalNation}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Right meta */}
                    <div className="flex-shrink-0 text-right">
                      {lifeEventType && lifeEventType !== "lived_in" && (
                        <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-primary/10 text-primary/70 border border-primary/20 block mb-0.5">
                          {EVENT_TYPE_LABELS[lifeEventType] ?? lifeEventType}
                        </span>
                      )}
                      <span className={`text-[9px] px-1.5 py-0.5 rounded border block ${
                        source === "verified_coords" || source === "timeline_record" || source === "location_address"
                          ? "text-blue-400/70 border-blue-700/30 bg-blue-900/20"
                          : "text-zinc-400 border-zinc-700/30 bg-zinc-800/40"
                      }`}>
                        {SOURCE_LABELS[source] ?? source}
                      </span>
                      {locationNote && (
                        <p className="text-[9px] text-muted-foreground/50 mt-0.5 max-w-[120px] truncate">
                          {locationNote}
                        </p>
                      )}
                    </div>
                  </button>
                );
              })}

              {/* Load More */}
              {hasMore && (
                <div className="px-4 py-3 flex items-center justify-center">
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs gap-1.5"
                    onClick={() => setPage(p => p + 1)}
                    data-testid="cluster-load-more"
                  >
                    <ChevronDown className="w-3.5 h-3.5" />
                    Load More ({members.length - shown.length} remaining)
                  </Button>
                </div>
              )}

              {!hasMore && members.length > PAGE_SIZE && (
                <div className="px-4 py-2 text-center">
                  <p className="text-[10px] text-muted-foreground/50">All {members.length} ancestors shown</p>
                </div>
              )}
            </div>
          </ScrollArea>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
