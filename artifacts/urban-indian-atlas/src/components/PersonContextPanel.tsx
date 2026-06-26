import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Info,
  AlertTriangle,
  MapPin,
  Clock,
  Users,
  FileText,
  CheckCircle2,
  BookOpen,
  Printer,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import type { AncestorRecord, AncestorContextMatch, AncestorLifeEvent } from "@/pages/atlas";
import { ContinuityReport } from "@/components/ContinuityReport";
import { buildPlaceIntelligence, type PlaceIntelligence } from "@/lib/location-intelligence";

interface PersonContextPanelProps {
  ancestor: AncestorRecord | null;
  contextMatches: AncestorContextMatch[];
  onClose: () => void;
  onEventFocus?: (coords: [number, number]) => void;
}

type NormalizedLifeEvent = {
  id: string;
  type: string;
  label: string;
  dateText: string | null;
  year: number | null;
  place: string | null;
  sourceType: string | null;
  sourceReference: string | null;
  coords: [number, number] | null;
  needsCoordinates: boolean;
  isAnchor: boolean;
  placeIntelligence: PlaceIntelligence;
};

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
    hedged: "This ancestor lived within 20 years of this event. While direct personal exposure cannot be confirmed, the policy environment shaped the world their family inhabited.",
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

function ContextDisclaimer() {
  return (
    <div className="bg-amber-500/5 border border-amber-500/20 rounded-lg p-3">
      <div className="flex gap-2">
        <Info className="w-3.5 h-3.5 text-amber-400 mt-0.5 shrink-0" />
        <p className="text-xs text-amber-200/70 leading-relaxed">
          Historical connections shown here are computationally derived from recorded dates, tribal nation, and affected regions. They are <strong>potentially relevant</strong> — not confirmed facts. Personal life events are shown separately from contextual history.
        </p>
      </div>
    </div>
  );
}

function titleCase(value: string): string {
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function eventTypeOf(event: AncestorLifeEvent): string {
  return String(event.eventType ?? event.event_type ?? "life_event");
}

function dateOf(event: AncestorLifeEvent): string | null {
  return event.eventDate ?? event.event_date ?? null;
}

function yearOf(event: AncestorLifeEvent): number | null {
  const explicit = event.eventYear ?? event.event_year;
  if (typeof explicit === "number" && Number.isFinite(explicit)) return explicit;
  const date = dateOf(event);
  if (!date) return null;
  const match = String(date).match(/\d{4}/);
  return match ? Number(match[0]) : null;
}

function placeOf(event: AncestorLifeEvent): string | null {
  const fallback = [event.county, event.state, event.country]
    .filter(Boolean)
    .join(", ");

  return (
    event.eventPlace ??
    event.event_place ??
    event.placeNormalized ??
    event.place_normalized ??
    (fallback || null)
  );
}

function coordOf(event: AncestorLifeEvent): [number, number] | null {
  const raw = event as AncestorLifeEvent & {
    coordinateLat?: number | string | null;
    coordinateLng?: number | string | null;
    coordinate_lat?: number | string | null;
    coordinate_lng?: number | string | null;
    latitude?: number | string | null;
    longitude?: number | string | null;
    lat?: number | string | null;
    lng?: number | string | null;
  };
  const lat = raw.coordinateLat ?? raw.coordinate_lat ?? raw.latitude ?? raw.lat ?? null;
  const lng = raw.coordinateLng ?? raw.coordinate_lng ?? raw.longitude ?? raw.lng ?? null;
  if (lat == null || lng == null) return null;
  const parsedLat = Number(lat);
  const parsedLng = Number(lng);
  return Number.isFinite(parsedLat) && Number.isFinite(parsedLng) ? [parsedLat, parsedLng] : null;
}

function sourceTypeOf(event: AncestorLifeEvent): string | null {
  return event.sourceType ?? event.source_type ?? null;
}

function sourceReferenceOf(event: AncestorLifeEvent): string | null {
  return event.sourceReference ?? event.source_reference ?? null;
}

function normalizeLifeEvents(ancestor: AncestorRecord): NormalizedLifeEvent[] {
  const anchors: NormalizedLifeEvent[] = [];
  if (ancestor.birthYear || ancestor.birthDate || ancestor.birthPlace) {
    anchors.push({
      id: `anchor-birth-${ancestor.id}`,
      type: "birth",
      label: "Birth",
      dateText: ancestor.birthDate ?? (ancestor.birthYear ? String(ancestor.birthYear) : null),
      year: ancestor.birthYear,
      place: ancestor.birthPlace,
      sourceType: "profile_anchor",
      sourceReference: null,
      coords: null,
      needsCoordinates: !!ancestor.birthPlace,
      isAnchor: true,
      placeIntelligence: buildPlaceIntelligence({
        id: `anchor-birth-${ancestor.id}`,
        personId: ancestor.id,
        eventPlace: ancestor.birthPlace,
        sourceType: "profile_anchor",
      }),
    });
  }

  const events = (ancestor.lifeEvents ?? []).map((event, index): NormalizedLifeEvent => {
    const type = eventTypeOf(event);
    const place = placeOf(event);
    const coords = coordOf(event);
    return {
      id: `life-${ancestor.id}-${index}-${type}-${yearOf(event) ?? "unknown"}`,
      type,
      label: titleCase(type),
      dateText: dateOf(event),
      year: yearOf(event),
      place,
      sourceType: sourceTypeOf(event),
      sourceReference: sourceReferenceOf(event),
      coords,
      needsCoordinates: !!place && !coords,
      isAnchor: false,
      placeIntelligence: buildPlaceIntelligence({
        id: event.id ?? `life-${ancestor.id}-${index}`,
        personId: ancestor.id,
        eventPlace: event.eventPlace ?? event.event_place ?? null,
        placeNormalized: event.placeNormalized ?? event.place_normalized ?? null,
        latitude: (event as any).latitude ?? (event as any).coordinateLat ?? (event as any).coordinate_lat ?? null,
        longitude: (event as any).longitude ?? (event as any).coordinateLng ?? (event as any).coordinate_lng ?? null,
        sourceType: sourceTypeOf(event),
        sourceReference: sourceReferenceOf(event),
      }),
    };
  });

  if (ancestor.deathYear || ancestor.deathDate || ancestor.deathPlace) {
    anchors.push({
      id: `anchor-death-${ancestor.id}`,
      type: "death",
      label: "Death",
      dateText: ancestor.deathDate ?? (ancestor.deathYear ? String(ancestor.deathYear) : null),
      year: ancestor.deathYear,
      place: ancestor.deathPlace,
      sourceType: "profile_anchor",
      sourceReference: null,
      coords: null,
      needsCoordinates: !!ancestor.deathPlace,
      isAnchor: true,
      placeIntelligence: buildPlaceIntelligence({
        id: `anchor-death-${ancestor.id}`,
        personId: ancestor.id,
        eventPlace: ancestor.deathPlace,
        sourceType: "profile_anchor",
      }),
    });
  }

  if (ancestor.burialPlace) {
    anchors.push({
      id: `anchor-burial-${ancestor.id}`,
      type: "burial",
      label: "Burial",
      dateText: null,
      year: ancestor.deathYear,
      place: ancestor.burialPlace,
      sourceType: "profile_anchor",
      sourceReference: null,
      coords: null,
      needsCoordinates: true,
      isAnchor: true,
      placeIntelligence: buildPlaceIntelligence({
        id: `anchor-burial-${ancestor.id}`,
        personId: ancestor.id,
        eventPlace: ancestor.burialPlace,
        sourceType: "profile_anchor",
      }),
    });
  }

  const byKey = new Map<string, NormalizedLifeEvent>();
  for (const item of [...anchors, ...events]) {
    const key = [item.type, item.year ?? "", item.place ?? "", item.dateText ?? ""].join("|").toLowerCase();
    if (!byKey.has(key)) byKey.set(key, item);
  }
  return [...byKey.values()].sort((a, b) => (a.year ?? 9999) - (b.year ?? 9999));
}

function LifeEventRow({ event, onEventFocus }: { event: NormalizedLifeEvent; onEventFocus?: (coords: [number, number]) => void }) {
  const isClickable = !!event.coords && !!onEventFocus;
  const content = (
    <>
      <div className="w-2.5 h-2.5 rounded-full bg-primary/70 shrink-0 mt-1 ring-2 ring-primary/20" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-xs font-bold uppercase tracking-wider text-foreground/80">{event.label}</p>
          {event.dateText && <span className="text-[10px] text-muted-foreground/60">{event.dateText}</span>}
          {event.year != null && !event.dateText && <span className="text-[10px] text-muted-foreground/60">{event.year}</span>}
          {event.isAnchor && <Badge variant="outline" className="text-[9px] border-primary/25 text-primary/70">anchor</Badge>}
          {event.needsCoordinates && <Badge variant="outline" className="text-[9px] border-amber-500/30 text-amber-300">needs coordinates</Badge>}
          {event.coords && <Badge variant="outline" className="text-[9px] border-emerald-500/30 text-emerald-300">map ready</Badge>}
        </div>
        <p className="text-xs text-muted-foreground/75 mt-0.5 truncate">{event.place ?? "Place not recorded"}</p>
        {(event.sourceType || event.sourceReference) && (
          <p className="text-[10px] text-muted-foreground/45 mt-0.5 truncate">
            {[event.sourceType, event.sourceReference].filter(Boolean).join(" · ")}
          </p>
        )}
      </div>
      {isClickable && <MapPin className="w-3.5 h-3.5 text-primary/70 shrink-0 mt-1" />}
    </>
  );

  if (isClickable) {
    return (
      <button
        className="w-full flex items-start gap-3 rounded-md border border-border/50 bg-card/40 hover:bg-primary/5 hover:border-primary/30 transition-colors p-3 text-left"
        onClick={() => onEventFocus(event.coords!)}
        data-testid={`life-event-${event.type}-${event.year ?? "unknown"}`}
      >
        {content}
      </button>
    );
  }

  return (
    <div className="flex items-start gap-3 rounded-md border border-border/40 bg-card/30 p-3" data-testid={`life-event-${event.type}-${event.year ?? "unknown"}`}>
      {content}
    </div>
  );
}

function LifeJourneyTab({
  ancestor,
  contextMatches,
  onEventFocus,
}: {
  ancestor: AncestorRecord;
  contextMatches: AncestorContextMatch[];
  onEventFocus?: (coords: [number, number]) => void;
}) {
  const [expandedEvent, setExpandedEvent] = useState<string | null>(null);
  const lifeEvents = useMemo(() => normalizeLifeEvents(ancestor), [ancestor]);
  const mappedCount = lifeEvents.filter(event => event.coords).length;
  const needsCoordCount = lifeEvents.filter(event => event.needsCoordinates).length;
  const lifeStart = ancestor.birthYear;
  const lifeEnd = ancestor.deathYear;

  return (
    <div className="divide-y divide-border/30">
      <div className="px-5 py-3 bg-card/40 space-y-1">
        <div className="flex items-center gap-2 text-xs text-muted-foreground/70">
          <Clock className="w-3 h-3" />
          <span>{lifeStart ?? "?"}{lifeEnd ? ` – ${lifeEnd}` : " – ?"}{lifeEnd && lifeStart ? ` · ${lifeEnd - lifeStart} years` : ""}</span>
        </div>
        <p className="text-[10px] text-muted-foreground/55">
          {lifeEvents.length} recorded life event{lifeEvents.length !== 1 ? "s" : ""}
          {mappedCount > 0 ? ` · ${mappedCount} map-ready` : ""}
          {needsCoordCount > 0 ? ` · ${needsCoordCount} need coordinates` : ""}
        </p>
      </div>

      <div className="px-5 py-4 space-y-3">
        <h3 className="text-xs font-mono font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-2">
          <MapPin className="w-3.5 h-3.5" /> Recorded Life Events
        </h3>
        {lifeEvents.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <BookOpen className="w-8 h-8 mx-auto mb-3 opacity-30" />
            <p className="text-sm font-serif italic">No personal life events are attached to this person yet.</p>
            <p className="text-xs mt-1 opacity-60">When birth, residence, census, marriage, death, or burial events are added, they will appear here.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {lifeEvents.map(event => <LifeEventRow key={event.id} event={event} onEventFocus={onEventFocus} />)}
          </div>
        )}
      </div>

      {contextMatches.length > 0 && (
        <div className="px-5 py-4 space-y-3">
          <h3 className="text-xs font-mono font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-2">
            <FileText className="w-3.5 h-3.5" /> Historical Context Matches
          </h3>
          <p className="text-[10px] text-muted-foreground/55">
            These are policy/history matches, not personal life events.
          </p>
          {contextMatches.slice(0, 8).map(match => {
            const isOpen = expandedEvent === match.eventId;
            const rel = relationshipLabels[match.relationshipType] ?? relationshipLabels.era_overlap;
            return (
              <div key={match.eventId} className="rounded-md border border-border/40 bg-card/30 overflow-hidden">
                <button className="w-full flex items-start gap-2 p-3 text-left" onClick={() => setExpandedEvent(isOpen ? null : match.eventId)}>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-serif font-medium text-foreground/90 leading-snug">{match.title}</p>
                    <p className="text-[10px] text-muted-foreground/55 mt-0.5">{match.year} · {rel.label}</p>
                  </div>
                  {isOpen ? <ChevronDown className="w-3.5 h-3.5 opacity-60" /> : <ChevronRight className="w-3.5 h-3.5 opacity-40" />}
                </button>
                {isOpen && (
                  <div className="px-3 pb-3 pt-1 border-t border-border/40 space-y-2">
                    <p className="text-xs text-muted-foreground/80 leading-relaxed">{rel.hedged}</p>
                    {match.coordinateLat != null && match.coordinateLng != null && onEventFocus && (
                      <button className="text-[10px] text-primary/70 flex items-center gap-1" onClick={() => onEventFocus([match.coordinateLat!, match.coordinateLng!])}>
                        <MapPin className="w-3 h-3" /> View context event on map
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="px-5 py-3">
        <ContextDisclaimer />
      </div>
    </div>
  );
}

function AnalysisTab({ ancestor, contextMatches }: { ancestor: AncestorRecord; contextMatches: AncestorContextMatch[] }) {
  const locationRecords = [
    ancestor.birthPlace && { label: "Birth", text: ancestor.birthPlace },
    ancestor.deathPlace && { label: "Death", text: ancestor.deathPlace },
    ancestor.burialPlace && { label: "Burial", text: ancestor.burialPlace },
    ancestor.locationText && { label: "Timeline", text: ancestor.locationText },
    ancestor.locationAddress && { label: "Address", text: ancestor.locationAddress },
    ancestor.tribalNation && { label: "Tribal Nation", text: ancestor.tribalNation },
  ].filter(Boolean) as Array<{ label: string; text: string }>;

  const classificationEvents = contextMatches.filter(match => {
    const eventType = (match.eventType ?? "").toLowerCase();
    const policyArea = (match.policyArea ?? "").toLowerCase();
    return eventType.includes("classif") || eventType.includes("enrollment") || policyArea.includes("identity") || !!match.identityImpact || !!match.reclassificationImpact;
  });

  return (
    <ScrollArea className="flex-1">
      <div className="p-5 space-y-6">
        <div>
          {ancestor.photoUrl && (
            <img src={ancestor.photoUrl} alt={ancestor.fullName} className="w-20 h-20 rounded-full object-cover border-2 border-border shadow-md mb-3" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
          )}
          <h2 className="font-serif text-2xl font-bold text-foreground mb-1 leading-tight">{ancestor.fullName}</h2>
          <p className="text-xs text-muted-foreground">{[ancestor.birthYear, ancestor.deathYear].filter(Boolean).join(" – ") || "Dates unknown"}{ancestor.tribalNation ? ` · ${ancestor.tribalNation}` : ""}</p>
        </div>

        <div className="bg-card/60 border border-border/60 rounded-lg p-4 space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5" /> Known Locations</h3>
          {locationRecords.length === 0 ? (
            <p className="text-xs text-muted-foreground/70">No location records attached yet.</p>
          ) : locationRecords.map((record, index) => (
            <div key={`${record.label}-${index}`} className="space-y-0.5">
              <p className="text-[10px] text-muted-foreground/60 font-medium uppercase tracking-wider">{record.label}</p>
              <p className="text-sm text-foreground/90">{record.text}</p>
            </div>
          ))}
        </div>

        {classificationEvents.length > 0 && (
          <div className="bg-amber-500/5 border border-amber-500/20 rounded-lg p-4 space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5"><AlertTriangle className="w-3.5 h-3.5" /> Classification / Identity Context</h3>
            {classificationEvents.slice(0, 5).map(event => (
              <div key={event.eventId} className="rounded-md border border-amber-500/20 bg-background/50 p-3">
                <p className="text-sm font-serif font-medium">{event.title}</p>
                <p className="text-[10px] text-muted-foreground/60 mt-0.5">{event.year} · {event.policyArea}</p>
                {(event.identityImpact || event.reclassificationImpact) && <p className="text-xs text-muted-foreground/80 mt-1 leading-relaxed">{event.identityImpact ?? event.reclassificationImpact}</p>}
              </div>
            ))}
          </div>
        )}

        <ContextDisclaimer />

        <div className="space-y-4">
          <h3 className="text-xs font-mono font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-2"><FileText className="w-3.5 h-3.5" /> Historical Context</h3>
          {contextMatches.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <BookOpen className="w-8 h-8 mx-auto mb-3 opacity-30" />
              <p className="text-sm font-serif italic">No historical event overlaps found for this person yet.</p>
            </div>
          ) : contextMatches.map((match, index) => {
            const rel = relationshipLabels[match.relationshipType] ?? relationshipLabels.era_overlap;
            const confStyle = confidenceBadge[match.confidenceLevel] ?? confidenceBadge.low;
            return (
              <div key={`${match.eventId}-${index}`} className="bg-card/50 border border-border/50 rounded-lg overflow-hidden p-3">
                <div className="flex flex-wrap gap-1.5 mb-1">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-widest text-white border-none ${severityColors[match.severityLevel] ?? ""}`}>{match.severityLevel}</span>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-medium border ${confStyle}`}>{match.confidenceLevel} confidence</span>
                  {match.locationMatch && <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-medium border bg-primary/10 text-primary border-primary/25"><CheckCircle2 className="w-2.5 h-2.5" /> region match</span>}
                </div>
                <p className="text-sm font-serif font-medium text-foreground leading-snug">{match.title}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{match.year} · {match.era}</p>
                <div className="bg-primary/5 border border-primary/15 rounded p-2 mt-2">
                  <p className="text-[10px] font-medium text-primary/80 uppercase tracking-wider mb-0.5">{rel.label}</p>
                  <p className="text-xs text-foreground/80 leading-relaxed">{rel.hedged}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </ScrollArea>
  );
}

export function PersonContextPanel({ ancestor, contextMatches, onClose, onEventFocus }: PersonContextPanelProps) {
  const [showReport, setShowReport] = useState(false);
  const [activeView, setActiveView] = useState<"journey" | "analysis">("journey");

  if (!ancestor) return null;

  const lifespan = [ancestor.birthYear, ancestor.deathYear].filter(Boolean).join(" – ") || "Dates unknown";

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
              title="Generate printable Continuity Report for this person"
            >
              <Printer className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Generate Report</span>
            </button>
            <button onClick={onClose} className="p-1 rounded hover:bg-muted" data-testid="person-panel-close">
              <X className="w-5 h-5 opacity-70" />
            </button>
          </div>
        </div>

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

        {activeView === "journey" && (
          <ScrollArea className="flex-1">
            <div className="flex items-center gap-3 px-5 pt-4 pb-3 border-b border-border/30">
              {ancestor.photoUrl && (
                <img src={ancestor.photoUrl} alt={ancestor.fullName}
                  className="w-10 h-10 rounded-full object-cover border border-border/50 shrink-0"
                  onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                />
              )}
              <div className="min-w-0">
                <h2 className="font-serif text-base font-bold text-foreground leading-tight truncate">{ancestor.fullName}</h2>
                <p className="text-[10px] text-muted-foreground/60 mt-0.5">{lifespan}{ancestor.tribalNation ? ` · ${ancestor.tribalNation}` : ""}</p>
              </div>
            </div>
            <LifeJourneyTab ancestor={ancestor} contextMatches={contextMatches} onEventFocus={onEventFocus} />
          </ScrollArea>
        )}

        {activeView === "analysis" && <AnalysisTab ancestor={ancestor} contextMatches={contextMatches} />}
      </motion.div>

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
