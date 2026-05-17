import { useState, useMemo } from "react";
import eventsData from "@/data/events.json";
import urbanLocationsData from "@/data/urban-locations.json";
import sourcesData from "@/data/sources.json";
import { AtlasMap } from "@/components/AtlasMap";
import { AtlasSidebar } from "@/components/AtlasSidebar";
import { AtlasTimeline } from "@/components/AtlasTimeline";
import { AtlasDetailPanel } from "@/components/AtlasDetailPanel";
import { SourcesModal } from "@/components/SourcesModal";
import { Button } from "@/components/ui/button";
import { BookOpen } from "lucide-react";

export type EventSeverity = "critical" | "high" | "moderate";
export type Era = "colonial" | "early-republic" | "removal" | "reservation" | "post-civil-war" | "allotment" | "jim-crow" | "termination" | "wwii-migration" | "self-determination" | "modern";

export interface AtlasEvent {
  id: string;
  title: string;
  year: number;
  era: string;
  event_type: string;
  policy_area: string;
  severity_level: EventSeverity;
  description: string;
  plain_language_summary: string;
  coordinates: [number, number];
  identity_impact: string | null;
  reclassification_impact: string | null;
  continuity_survival_note: string | null;
  family_impact: string | null;
  urbanization_impact: string | null;
  health_access_impact: string | null;
  ancestor_relevance_note: string | null;
  modern_effect: string | null;
  source_title: string;
  source_url: string;
  tags: string[];
  status: string;
  affected_regions: string[];
}

export default function Atlas() {
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [isSourcesOpen, setIsSourcesOpen] = useState(false);
  const [yearRange, setYearRange] = useState<[number, number]>([1790, 2024]);
  
  // Filters
  const [activeEras, setActiveEras] = useState<string[]>([]);
  const [activeTypes, setActiveTypes] = useState<string[]>([]);
  const [activeSeverities, setActiveSeverities] = useState<string[]>([]);
  const [activePolicies, setActivePolicies] = useState<string[]>([]);

  const events = eventsData as unknown as AtlasEvent[];
  
  const filteredEvents = useMemo(() => {
    return events.filter((e) => {
      if (e.year < yearRange[0] || e.year > yearRange[1]) return false;
      if (activeEras.length > 0 && !activeEras.includes(e.era)) return false;
      if (activeTypes.length > 0 && !activeTypes.includes(e.event_type)) return false;
      if (activeSeverities.length > 0 && !activeSeverities.includes(e.severity_level)) return false;
      if (activePolicies.length > 0 && !activePolicies.includes(e.policy_area)) return false;
      return true;
    });
  }, [events, yearRange, activeEras, activeTypes, activeSeverities, activePolicies]);

  const selectedEvent = events.find((e) => e.id === selectedEventId) || null;

  return (
    <div className="flex flex-col h-[100dvh] w-full overflow-hidden bg-background text-foreground selection:bg-primary/20">
      {/* Header */}
      <header className="flex-none h-14 border-b border-border/50 flex items-center justify-between px-4 bg-card/80 backdrop-blur shadow-sm z-20">
        <div className="flex items-center gap-4">
          <h1 className="font-serif text-xl text-primary font-medium tracking-wide">Urban Indian Continuity Atlas</h1>
          <div className="hidden md:block w-px h-4 bg-border" />
          <p className="hidden md:block text-xs text-muted-foreground tracking-wide uppercase">
            Mapping identity, reclassification, migration, and survival across generations.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-xs font-mono font-medium px-2 py-1 rounded bg-secondary/10 text-secondary-foreground" data-testid="event-count-badge">
            {filteredEvents.length} Events
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            className="text-xs font-serif italic gap-2 h-8"
            onClick={() => setIsSourcesOpen(true)}
            data-testid="sources-modal-button"
          >
            <BookOpen className="w-3.5 h-3.5" />
            Sources Archive
          </Button>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden relative">
        <AtlasSidebar 
          events={events}
          activeEras={activeEras}
          setActiveEras={setActiveEras}
          activeTypes={activeTypes}
          setActiveTypes={setActiveTypes}
          activeSeverities={activeSeverities}
          setActiveSeverities={setActiveSeverities}
          activePolicies={activePolicies}
          setActivePolicies={setActivePolicies}
        />
        
        <div className="flex-1 flex flex-col relative h-full">
          <AtlasMap 
            events={events}
            filteredEvents={filteredEvents}
            selectedEventId={selectedEventId}
            onSelectEvent={setSelectedEventId}
            urbanLocations={urbanLocationsData}
          />
          
          <AtlasTimeline 
            events={events}
            filteredEvents={filteredEvents}
            yearRange={yearRange}
            setYearRange={setYearRange}
            selectedEventId={selectedEventId}
            onSelectEvent={setSelectedEventId}
          />
        </div>

        <AtlasDetailPanel 
          event={selectedEvent} 
          onClose={() => setSelectedEventId(null)} 
        />
      </div>

      <SourcesModal 
        isOpen={isSourcesOpen} 
        onClose={() => setIsSourcesOpen(false)} 
        sources={sourcesData}
      />
    </div>
  );
}
