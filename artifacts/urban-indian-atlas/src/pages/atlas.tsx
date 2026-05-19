import { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import urbanLocationsData from "@/data/urban-locations.json";
import sourcesData from "@/data/sources.json";
import { AtlasMap } from "@/components/AtlasMap";
import { AtlasSidebar, POLICY_ERA_RANGES } from "@/components/AtlasSidebar";
import { AtlasTimeline } from "@/components/AtlasTimeline";
import { AtlasDetailPanel } from "@/components/AtlasDetailPanel";
import { PersonContextPanel } from "@/components/PersonContextPanel";
import { ActivateAtlasButton } from "@/components/ActivateAtlasButton";
import { SourcesModal } from "@/components/SourcesModal";
import { Button } from "@/components/ui/button";
import { BookOpen, Loader2 } from "lucide-react";
import { getAtlasBearerToken, isAtlasAuthenticated, authHeaders } from "@/lib/atlasAuth";

export type EventSeverity = "critical" | "high" | "moderate";
export type Era = "colonial" | "early-republic" | "removal" | "reservation" | "post-civil-war" | "allotment" | "jim-crow" | "termination" | "wwii-migration" | "self-determination" | "modern";

export interface AtlasEvent {
  id: string;
  title: string;
  short_title: string | null;
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
  states_affected: string[];
}

// AncestorRecord only contains safe, non-PII fields returned by /api/atlas/ancestors.
// Notes, membershipStatus, and gender are NOT returned by the endpoint.
export interface AncestorRecord {
  id: number;
  fullName: string;
  firstName: string | null;
  lastName: string | null;
  birthYear: number | null;
  deathYear: number | null;
  tribalNation: string | null;
  generationalPosition: number | null;
  isDeceased: boolean;
  isAncestor: boolean;
  lineageTags: unknown;
  // Verified lat/lng stored directly on the family_lineage record (highest priority).
  locationLat: number | null;
  locationLng: number | null;
  // Human-readable address (city, county, state) stored alongside the coordinates.
  locationAddress: string | null;
  // Location from actual ancestralTimelineEvents records (secondary source).
  // When this is present the map pin is treated as "from records" and shown differently
  // from pins derived by tribal-nation keyword inference.
  locationText: string | null;
  hasTimelineLocation: boolean;
  photoUrl: string | null;
  // Record classification for display and location resolution:
  //   "ancestor"          — deceased family member or confirmed ancestor
  //   "household_member"  — living immediate household (self / spouse / children)
  //   "extended_family"   — living family outside immediate household
  recordStatus: "ancestor" | "household_member" | "extended_family";
}

export interface AncestorContextMatch {
  ancestorId: number;
  fullName: string;
  firstName: string | null;
  lastName: string | null;
  birthYear: number | null;
  deathYear: number | null;
  tribalNation: string | null;
  generationalPosition: number | null;
  atlasEventDbId: number;
  eventId: string;
  title: string;
  year: number;
  era: string;
  eventType: string;
  policyArea: string;
  severityLevel: string;
  affectedRegions: string[];
  statesAffected: string[];
  coordinateLat: number | null;
  coordinateLng: number | null;
  identityImpact: string | null;
  reclassificationImpact: string | null;
  ancestorRelevanceNote: string | null;
  tags: string[];
  relationshipType: string;
  confidenceLevel: string;
  locationMatch: boolean;
}

export interface ActiveLayers {
  tribalTerritories: boolean;
  ancestorLocations: boolean;
  migrationPaths: boolean;
  historicalEvents: boolean;
  urbanization: boolean;
  healthAccess: boolean;
  boardingSchools: boolean;
  // First-class thematic layers (default-on where relevant to continuity proof)
  reclassification: boolean;    // Census reclassification / identity reassignment events
  censusIdentity: boolean;      // Census-era identity markers (enrollment, blood quantum)
  publicSchools: boolean;       // Public school policy impact areas
  landJurisdiction: boolean;    // Land allotment / jurisdiction boundary events
  federalActs: boolean;         // Acts of Congress affecting tribal status
  treaties: boolean;            // Treaty events — shown as distinct diamond markers
}

const DEFAULT_LAYERS: ActiveLayers = {
  tribalTerritories: true,
  ancestorLocations: true,
  migrationPaths: true,
  historicalEvents: true,
  urbanization: true,
  healthAccess: true,
  boardingSchools: false, // standalone boarding-school location pins — off by default
  reclassification: true,
  censusIdentity: true,
  publicSchools: true,    // public/boarding-school policy events — on by default
  landJurisdiction: true, // land allotment / jurisdiction events  — on by default
  federalActs: true,
  treaties: true,         // treaties — on by default (foundational to continuity proof)
};

interface DbAtlasEvent {
  id: number;
  eventId: string;
  title: string;
  shortTitle: string | null;
  year: number;
  dateStart: string | null;
  dateEnd: string | null;
  era: string;
  eventType: string;
  policyArea: string;
  description: string;
  plainLanguageSummary: string;
  severityLevel: string;
  status: string;
  identityImpact: string | null;
  reclassificationImpact: string | null;
  continuitySurvivalNote: string | null;
  familyImpact: string | null;
  urbanizationImpact: string | null;
  healthAccessImpact: string | null;
  ancestorRelevanceNote: string | null;
  modernEffect: string | null;
  sourceTitle: string;
  sourceUrl: string;
  tags: string[];
  affectedRegions: string[];
  statesAffected: string[];
  coordinateLat: number | null;
  coordinateLng: number | null;
}

interface DbContextMatch {
  ancestor_id: number;
  full_name: string;
  first_name: string | null;
  last_name: string | null;
  birth_year: number | null;
  death_year: number | null;
  tribal_nation: string | null;
  generational_position: number | null;
  is_ancestor: boolean;
  atlas_event_db_id: number;
  event_id: string;
  title: string;
  year: number;
  era: string;
  event_type: string;
  policy_area: string;
  severity_level: string;
  affected_regions: string[];
  states_affected: string[];
  coordinate_lat: number | null;
  coordinate_lng: number | null;
  identity_impact: string | null;
  reclassification_impact: string | null;
  ancestor_relevance_note: string | null;
  tags: string[];
  relationship_type: string;
  confidence_level: string;
  location_match: boolean;
}

function dbToAtlasEvent(e: DbAtlasEvent): AtlasEvent {
  return {
    id: e.eventId,
    title: e.title,
    year: e.year,
    era: e.era,
    event_type: e.eventType,
    policy_area: e.policyArea,
    severity_level: (e.severityLevel as EventSeverity) || "moderate",
    description: e.description,
    plain_language_summary: e.plainLanguageSummary,
    coordinates: [e.coordinateLat ?? 38.5, e.coordinateLng ?? -97.0],
    identity_impact: e.identityImpact ?? null,
    reclassification_impact: e.reclassificationImpact ?? null,
    continuity_survival_note: e.continuitySurvivalNote ?? null,
    family_impact: e.familyImpact ?? null,
    urbanization_impact: e.urbanizationImpact ?? null,
    health_access_impact: e.healthAccessImpact ?? null,
    ancestor_relevance_note: e.ancestorRelevanceNote ?? null,
    modern_effect: e.modernEffect ?? null,
    source_title: e.sourceTitle,
    source_url: e.sourceUrl,
    tags: e.tags,
    status: e.status,
    affected_regions: e.affectedRegions,
    states_affected: e.statesAffected ?? [],
    short_title: e.shortTitle ?? null,
  };
}

function dbToContextMatch(r: DbContextMatch): AncestorContextMatch {
  return {
    ancestorId: r.ancestor_id,
    fullName: r.full_name,
    firstName: r.first_name,
    lastName: r.last_name,
    birthYear: r.birth_year,
    deathYear: r.death_year,
    tribalNation: r.tribal_nation,
    generationalPosition: r.generational_position,
    atlasEventDbId: r.atlas_event_db_id,
    eventId: r.event_id,
    title: r.title,
    year: r.year,
    era: r.era,
    eventType: r.event_type,
    policyArea: r.policy_area,
    severityLevel: r.severity_level,
    affectedRegions: r.affected_regions ?? [],
    statesAffected: r.states_affected ?? [],
    coordinateLat: r.coordinate_lat,
    coordinateLng: r.coordinate_lng,
    identityImpact: r.identity_impact,
    reclassificationImpact: r.reclassification_impact,
    ancestorRelevanceNote: r.ancestor_relevance_note,
    tags: r.tags ?? [],
    relationshipType: r.relationship_type,
    confidenceLevel: r.confidence_level,
    locationMatch: !!r.location_match,
  };
}

async function fetchAtlasEvents(): Promise<AtlasEvent[]> {
  const res = await fetch(`/api/atlas/events`);
  if (!res.ok) throw new Error("Failed to load atlas events");
  const data = await res.json() as DbAtlasEvent[];
  return data.map(dbToAtlasEvent);
}

interface DbAncestorRow {
  id: number;
  full_name: string;
  first_name: string | null;
  last_name: string | null;
  birth_year: number | null;
  death_year: number | null;
  tribal_nation: string | null;
  generational_position: number | null;
  is_ancestor: boolean;
  is_deceased: boolean;
  lineage_tags: unknown;
  location_lat: number | null;
  location_lng: number | null;
  location_address: string | null;
  location_text: string | null;
  has_timeline_location: boolean;
  photo_url: string | null;
  record_status: "ancestor" | "household_member" | "extended_family";
}

function dbToAncestorRecord(r: DbAncestorRow): AncestorRecord {
  const parsedLat = r.location_lat != null ? parseFloat(String(r.location_lat)) : null;
  const parsedLng = r.location_lng != null ? parseFloat(String(r.location_lng)) : null;
  return {
    id: r.id,
    fullName: r.full_name,
    firstName: r.first_name,
    lastName: r.last_name,
    birthYear: r.birth_year != null ? parseInt(String(r.birth_year), 10) : null,
    deathYear: r.death_year != null ? parseInt(String(r.death_year), 10) : null,
    tribalNation: r.tribal_nation,
    generationalPosition: r.generational_position != null ? parseInt(String(r.generational_position), 10) : null,
    isDeceased: r.is_deceased,
    isAncestor: r.is_ancestor,
    lineageTags: r.lineage_tags,
    locationLat: parsedLat != null && !isNaN(parsedLat) ? parsedLat : null,
    locationLng: parsedLng != null && !isNaN(parsedLng) ? parsedLng : null,
    locationAddress: r.location_address ?? null,
    locationText: r.location_text ?? null,
    hasTimelineLocation: !!r.has_timeline_location,
    photoUrl: r.photo_url ?? null,
    recordStatus: r.record_status ?? "ancestor",
  };
}

async function fetchAncestors(): Promise<AncestorRecord[]> {
  const tok = getAtlasBearerToken();
  if (!tok) return [];
  const res = await fetch(`/api/atlas/ancestors`, { headers: { Authorization: `Bearer ${tok}` } });
  if (res.status === 401) throw new Error("UNAUTHORIZED"); // token present but expired/invalid
  if (!res.ok) throw new Error("Failed to load ancestors");
  const rows = await res.json() as DbAncestorRow[];
  return rows.map(dbToAncestorRecord);
}

async function fetchAncestorContext(): Promise<AncestorContextMatch[]> {
  const tok = getAtlasBearerToken();
  if (!tok) return [];
  const res = await fetch(`/api/atlas/ancestors/context`, { headers: { Authorization: `Bearer ${tok}` } });
  if (res.status === 401) return [];
  if (!res.ok) throw new Error("Failed to load ancestor context");
  const data = await res.json() as DbContextMatch[];
  return data.map(dbToContextMatch);
}

// Client-side ancestor filter logic — covers all EXPOSURE_FILTER_GROUPS categories
function ancestorMatchesExposureFilters(
  ancestor: AncestorRecord,
  contextMatches: AncestorContextMatch[],
  activeFilters: string[]
): boolean {
  if (activeFilters.length === 0) return true;
  const matches = contextMatches.filter(m => m.ancestorId === ancestor.id);

  return activeFilters.every(filter => {
    switch (filter) {
      // Temporal
      case "alive_during":
        return matches.some(m => m.relationshipType === "alive_during");
      case "near_contemporary":
        return matches.some(m => m.relationshipType === "near_contemporary");
      case "born_before":
        return matches.some(m => m.relationshipType === "born_before");
      // Location
      case "location_match":
        return matches.some(m => m.locationMatch);
      case "has_tribal_nation":
        return !!ancestor.tribalNation;
      // Policy eras — check if ancestor was alive during era window
      case "removal_era":
      case "allotment_era":
      case "boarding_school_era":
      case "census_era":
      case "jim_crow_era":
      case "urban_relocation_era":
      case "termination_era": {
        const [start, end] = POLICY_ERA_RANGES[filter] ?? [0, 9999];
        const born = ancestor.birthYear ?? 9999;
        const died = ancestor.deathYear ?? 9999;
        return born <= end && died >= start;
      }
      // Impact type — check matching event's policyArea or tags
      case "reclassification_risk":
        return matches.some(m =>
          m.policyArea === "identity_classification" ||
          (m.tags ?? []).some((t: string) => /reclassif|racial|classif/i.test(t)) ||
          !!m.reclassificationImpact
        );
      case "health_access_impact":
        return matches.some(m =>
          m.policyArea === "healthcare" ||
          (m.tags ?? []).some((t: string) => /health|ihs|medical/i.test(t))
        );
      case "land_displacement":
        return matches.some(m =>
          m.policyArea === "land_rights" ||
          (m.tags ?? []).some((t: string) => /land|allot|remov|displace/i.test(t))
        );
      case "family_welfare_impact":
        return matches.some(m =>
          m.policyArea === "family_welfare" ||
          (m.tags ?? []).some((t: string) => /famil|child|icwa|welfare|custody/i.test(t))
        );
      case "urban_migration_impact":
        return matches.some(m =>
          m.policyArea === "urban_relocation" ||
          (m.tags ?? []).some((t: string) => /urban|reloc|migrat/i.test(t))
        );
      case "education_impact":
        return matches.some(m =>
          m.policyArea === "education" ||
          (m.tags ?? []).some((t: string) => /school|boarding|education|mission/i.test(t))
        );
      // Location quality — based on actual timeline records vs. tribal-nation inference
      case "has_location_data":
        return ancestor.hasTimelineLocation;
      case "needs_location_review":
        // Only tribal nation available for inference; no verified place from records
        return !ancestor.hasTimelineLocation;
      // Date quality
      case "has_dates":
        return !!(ancestor.birthYear || ancestor.deathYear);
      case "needs_review":
        return !ancestor.birthYear && !ancestor.deathYear;
      // Derived from context matches
      case "public_school_impact":
        return matches.some(m =>
          m.policyArea === "education" ||
          (m.tags ?? []).some((t: string) => /public.school|boarding|mission.school|education/i.test(t))
        );
      case "county_state_records":
        // Matches events related to land/territory with a confirmed location match
        // — signals the ancestor may appear in state or county-level record systems
        return matches.some(m =>
          m.locationMatch && (
            m.policyArea === "land_rights" ||
            m.policyArea === "identity_classification" ||
            (m.tags ?? []).some((t: string) => /census|county|deed|state record|court record/i.test(t))
          )
        );
      default:
        return true;
    }
  });
}

export default function Atlas() {
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [selectedPersonId, setSelectedPersonId] = useState<number | null>(null);
  const [isSourcesOpen, setIsSourcesOpen] = useState(false);
  const [yearRange, setYearRange] = useState<[number, number]>([1790, new Date().getFullYear()]);
  const [atlasMode, setAtlasMode] = useState(false);
  // Re-check localStorage on every render when atlasMode is on so tokens
  // written after page load (e.g. from signing into Sovereign Dashboard in
  // another tab) are picked up without requiring a page refresh.
  const authenticated = atlasMode ? isAtlasAuthenticated() : false;

  const [activeEras, setActiveEras] = useState<string[]>([]);
  const [activeTypes, setActiveTypes] = useState<string[]>([]);
  const [activeSeverities, setActiveSeverities] = useState<string[]>([]);
  const [activePolicies, setActivePolicies] = useState<string[]>([]);
  const [activeLayers, setActiveLayers] = useState<ActiveLayers>(DEFAULT_LAYERS);
  const [activeExposureFilters, setActiveExposureFilters] = useState<string[]>([]);

  // Read URL params on mount:
  //   ?mode=atlas  — activate Atlas Mode immediately
  //   ?person=N    — auto-select ancestor N and activate Atlas Mode
  //                  (used by Community Dashboard Tree View "View in Atlas" links)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("mode") === "atlas") {
      setAtlasMode(true);
    }
    const personParam = params.get("person");
    if (personParam) {
      const personId = parseInt(personParam, 10);
      if (!isNaN(personId)) {
        setSelectedPersonId(personId);
        setAtlasMode(true); // auto-activate Atlas Mode when a person is specified
      }
    }
  }, []);

  const { data: events = [], isLoading, isError } = useQuery({
    queryKey: ["/api/atlas/events"],
    queryFn: fetchAtlasEvents,
    staleTime: 5 * 60_000,
  });

  const { data: ancestors = [], isLoading: ancestorsLoading, isError: ancestorsFetchError, error: ancestorsError } = useQuery({
    queryKey: ["/api/atlas/ancestors", atlasMode, authenticated],
    queryFn: fetchAncestors,
    enabled: atlasMode && authenticated,
    staleTime: 5 * 60_000,
    retry: (failureCount, error) => {
      // Don't retry unauthorized — token is invalid/expired until user re-auths
      if ((error as Error)?.message === "UNAUTHORIZED") return false;
      return failureCount < 2;
    },
  });
  const ancestorsSessionExpired = ancestorsFetchError && (ancestorsError as Error)?.message === "UNAUTHORIZED";

  const { data: contextMatches = [] } = useQuery({
    queryKey: ["/api/atlas/ancestors/context", atlasMode, authenticated],
    queryFn: fetchAncestorContext,
    enabled: atlasMode && authenticated,
    staleTime: 5 * 60_000,
  });

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

  // Filter ancestors by timeline year range AND all active exposure filters.
  // Timeline-aware: only ancestors whose lifespan window overlaps the active
  // year range (with a ±30-year buffer for near-contemporary relevance) appear
  // on the map — this is what "the timeline filter controls which ancestors appear".
  const filteredAncestors = useMemo(() => {
    if (!atlasMode) return [];
    return ancestors.filter(ancestor => {
      // Year-range visibility: ancestor lifespan must overlap [yearRange[0]-30, yearRange[1]+30]
      const lifeStart = ancestor.birthYear ?? 1600;
      const lifeEnd = ancestor.deathYear ?? new Date().getFullYear();
      if (lifeEnd < yearRange[0] - 30 || lifeStart > yearRange[1] + 30) return false;
      // Exposure filters
      return ancestorMatchesExposureFilters(ancestor, contextMatches, activeExposureFilters);
    });
  }, [ancestors, contextMatches, activeExposureFilters, atlasMode, yearRange]);

  const selectedEvent = events.find((e) => e.id === selectedEventId) || null;

  const selectedAncestor = selectedPersonId !== null
    ? ancestors.find(a => a.id === selectedPersonId) ?? null
    : null;

  const selectedAncestorContext = selectedPersonId !== null
    ? contextMatches.filter(m => m.ancestorId === selectedPersonId)
    : [];

  const handleSelectPerson = (id: number) => {
    setSelectedPersonId(id);
    setSelectedEventId(null);
  };

  const handleSelectEvent = (id: string) => {
    setSelectedEventId(id);
    setSelectedPersonId(null);
  };

  const handleToggleAtlasMode = () => {
    setAtlasMode(v => !v);
    if (atlasMode) {
      setSelectedPersonId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[100dvh] bg-background">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-sm font-serif text-muted-foreground">Loading Atlas…</p>
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex items-center justify-center h-[100dvh] bg-background">
        <div className="flex flex-col items-center gap-3 max-w-sm text-center">
          <p className="text-sm font-serif text-destructive">Failed to load Atlas events. Please refresh or check the API server.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[100dvh] w-full overflow-hidden bg-background text-foreground selection:bg-primary/20">
      {/* Header */}
      <header className="flex-none h-14 border-b border-border/50 flex items-center justify-between px-4 bg-card/80 backdrop-blur shadow-sm z-20">
        <div className="flex items-center gap-4">
          <h1 className="font-serif text-xl text-primary font-medium tracking-wide">Urban Indian Continuity Atlas</h1>
          <div className="hidden md:block w-px h-4 bg-border" />
          <p className="hidden md:block text-xs text-muted-foreground tracking-wide uppercase">
            {atlasMode
              ? "Atlas Mode — Ancestors, Tribal Territories & Historical Events"
              : "Mapping identity, reclassification, migration, and survival across generations."}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {atlasMode && ancestorsLoading && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Loading ancestors…
            </div>
          )}
          {atlasMode && !authenticated && (
            <div className="flex items-center gap-1.5 text-xs text-blue-600/70 bg-blue-50/10 border border-blue-500/20 rounded px-2 py-1">
              Sign into the Sovereign Dashboard to see ancestor pins
            </div>
          )}
          {atlasMode && authenticated && !ancestorsLoading && ancestorsSessionExpired && (
            <div className="flex items-center gap-1.5 text-xs text-blue-600/70 bg-blue-50/10 border border-blue-500/20 rounded px-2 py-1">
              Session expired — sign in again to see ancestor pins
            </div>
          )}
          {atlasMode && authenticated && !ancestorsLoading && ancestorsFetchError && !ancestorsSessionExpired && (
            <div className="flex items-center gap-1.5 text-xs text-red-600/80 bg-red-50/10 border border-red-500/20 rounded px-2 py-1">
              Could not load ancestor data — please refresh
            </div>
          )}
          {atlasMode && authenticated && !ancestorsLoading && !ancestorsFetchError && ancestors.length === 0 && (
            <div className="flex items-center gap-1.5 text-xs text-amber-600/80 bg-amber-50/10 border border-amber-500/20 rounded px-2 py-1">
              No ancestor data found — add family records to see ancestor pins
            </div>
          )}
          <div className="text-xs font-mono font-medium px-2 py-1 rounded bg-secondary/10 text-secondary-foreground" data-testid="event-count-badge">
            {filteredEvents.length} Events
          </div>
          <ActivateAtlasButton
            atlasMode={atlasMode}
            onToggle={handleToggleAtlasMode}
            ancestorCount={filteredAncestors.length}
            loading={atlasMode && ancestorsLoading}
          />
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
          atlasMode={atlasMode}
          activeLayers={activeLayers}
          setActiveLayers={setActiveLayers}
          activeExposureFilters={activeExposureFilters}
          setActiveExposureFilters={setActiveExposureFilters}
          ancestorCount={filteredAncestors.length}
          isAuthenticated={authenticated}
        />

        <div className="flex-1 flex flex-col relative h-full">
          <AtlasMap
            events={events}
            filteredEvents={filteredEvents}
            selectedEventId={selectedEventId}
            onSelectEvent={handleSelectEvent}
            urbanLocations={urbanLocationsData}
            atlasMode={atlasMode}
            ancestors={filteredAncestors}
            selectedPersonId={selectedPersonId}
            onSelectPerson={handleSelectPerson}
            activeLayers={activeLayers}
            yearRange={yearRange}
          />

          <AtlasTimeline
            events={events}
            filteredEvents={filteredEvents}
            yearRange={yearRange}
            setYearRange={setYearRange}
            selectedEventId={selectedEventId}
            onSelectEvent={handleSelectEvent}
          />
        </div>

        {/* Event Detail Panel */}
        {selectedEventId && !selectedPersonId && (
          <AtlasDetailPanel
            event={selectedEvent}
            onClose={() => setSelectedEventId(null)}
            atlasMode={atlasMode}
            contextMatches={contextMatches}
            onSelectPerson={handleSelectPerson}
          />
        )}

        {/* Person Context Panel */}
        {selectedPersonId && atlasMode && (
          <PersonContextPanel
            ancestor={selectedAncestor}
            contextMatches={selectedAncestorContext}
            onClose={() => setSelectedPersonId(null)}
          />
        )}
      </div>

      <SourcesModal
        isOpen={isSourcesOpen}
        onClose={() => setIsSourcesOpen(false)}
        sources={sourcesData}
      />
    </div>
  );
}
