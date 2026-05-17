import { useState } from "react";
import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight, FilterX, Layers, Users, Globe2, Info } from "lucide-react";
import { AtlasEvent, ActiveLayers } from "@/pages/atlas";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

interface AtlasSidebarProps {
  events: AtlasEvent[];
  activeEras: string[];
  setActiveEras: (v: string[]) => void;
  activeTypes: string[];
  setActiveTypes: (v: string[]) => void;
  activeSeverities: string[];
  setActiveSeverities: (v: string[]) => void;
  activePolicies: string[];
  setActivePolicies: (v: string[]) => void;
  atlasMode: boolean;
  activeLayers: ActiveLayers;
  setActiveLayers: (v: ActiveLayers) => void;
  activeExposureFilters: string[];
  setActiveExposureFilters: (v: string[]) => void;
  ancestorCount: number;
  isAuthenticated: boolean;
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

// Full exposure filter taxonomy covering all required policy + data categories
const EXPOSURE_FILTER_GROUPS: {
  group: string;
  label: string;
  filters: { id: string; label: string; tooltip?: string }[];
}[] = [
  {
    group: "temporal",
    label: "Temporal Relationship",
    filters: [
      { id: "alive_during", label: "Alive During Event", tooltip: "Ancestor's recorded lifespan includes the event year" },
      { id: "near_contemporary", label: "Near Contemporary (±20 yr)", tooltip: "Ancestor lived within 20 years of the event" },
      { id: "born_before", label: "Born Before Event", tooltip: "Ancestor was born before the event occurred" },
    ],
  },
  {
    group: "location",
    label: "Location & Territory",
    filters: [
      { id: "location_match", label: "Tribal Nation Matches Event Region", tooltip: "Ancestor's tribal nation maps to the event's affected states" },
      { id: "has_tribal_nation", label: "Has Recorded Tribal Nation", tooltip: "Tribal nation is recorded in the family lineage entry" },
    ],
  },
  {
    group: "policy_era",
    label: "Policy Era Exposure",
    filters: [
      { id: "removal_era", label: "Removal Era (1830–1870)", tooltip: "Alive during Indian Removal Act enforcement" },
      { id: "allotment_era", label: "Allotment Era (1887–1934)", tooltip: "Alive during the Dawes Act land allotment period" },
      { id: "boarding_school_era", label: "Boarding School Era (1875–1940)", tooltip: "Alive when federal boarding schools were operating at scale" },
      { id: "census_era", label: "Federal Census Period (1880–1930)", tooltip: "Alive during the key census decades used in enrollment verification" },
      { id: "jim_crow_era", label: "Jim Crow & Plecker Era (1900–1965)", tooltip: "Alive when Virginia Plecker-style racial reclassification was active" },
      { id: "urban_relocation_era", label: "Urban Relocation Program (1950–1975)", tooltip: "Alive during the federal Indian urban relocation policy era" },
      { id: "termination_era", label: "Termination Era (1945–1970)", tooltip: "Alive during the federal termination and withdrawal policy period" },
    ],
  },
  {
    group: "impact_type",
    label: "Impact Type (from matched events)",
    filters: [
      { id: "reclassification_risk", label: "Reclassification & Identity Events", tooltip: "Matches events that altered tribal or racial classification in records" },
      { id: "health_access_impact", label: "Health Access Events", tooltip: "Matches events affecting Indian Health Service or medical access" },
      { id: "land_displacement", label: "Land & Displacement Events", tooltip: "Matches events involving land seizure, allotment, or removal" },
      { id: "family_welfare_impact", label: "Family & Child Welfare Events", tooltip: "Matches events affecting Native family structure or child custody (ICWA era)" },
      { id: "urban_migration_impact", label: "Urban Migration Events", tooltip: "Matches events driving or affecting Native urban migration patterns" },
      { id: "education_impact", label: "Education & School Policy Events", tooltip: "Matches events affecting Native schooling, boarding schools, or education access" },
    ],
  },
  {
    group: "data_quality",
    label: "Location & Data Quality",
    filters: [
      { id: "has_location_data", label: "Has Location From Records", tooltip: "Ancestor has a real location string from their ancestral timeline records — shown as a solid blue marker on the map" },
      { id: "needs_location_review", label: "Location Needs Review", tooltip: "No verified place recorded — location is inferred from tribal nation keyword only. Shown as a grey dashed marker." },
      { id: "has_dates", label: "Has Birth or Death Year", tooltip: "Ancestor record includes at least one date — improves temporal match accuracy" },
      { id: "needs_review", label: "Missing Dates — Needs Review", tooltip: "No birth or death year recorded; location inference only; review recommended" },
      { id: "public_school_impact", label: "Public School / Education Policy", tooltip: "Matches events affecting Native education, boarding schools, or public school access" },
      { id: "county_state_records", label: "State / County Records Coverage", tooltip: "Location-matched to land, census, or identity events — ancestor may appear in state or county record systems" },
    ],
  },
];

// Policy era year ranges used for client-side filtering
export const POLICY_ERA_RANGES: Record<string, [number, number]> = {
  removal_era: [1830, 1870],
  allotment_era: [1887, 1934],
  boarding_school_era: [1875, 1940],
  census_era: [1880, 1930],
  jim_crow_era: [1900, 1965],
  urban_relocation_era: [1950, 1975],
  termination_era: [1945, 1970],
};

const LAYER_ITEMS: { key: keyof ActiveLayers; label: string; defaultOn: boolean; group?: string }[] = [
  // Territorial
  { key: "tribalTerritories", label: "Tribal Territories (time-aware)", defaultOn: true, group: "Territorial" },
  { key: "migrationPaths", label: "Removal & Migration Routes", defaultOn: true, group: "Territorial" },
  { key: "landJurisdiction", label: "Land Allotment / Jurisdiction", defaultOn: true, group: "Territorial" },
  // Identity & Classification
  { key: "reclassification", label: "Reclassification Events", defaultOn: true, group: "Identity & Classification" },
  { key: "censusIdentity", label: "Census Identity Markers", defaultOn: true, group: "Identity & Classification" },
  { key: "federalActs", label: "Federal Acts (Tribal Status)", defaultOn: true, group: "Identity & Classification" },
  // Community Impact
  { key: "historicalEvents", label: "All Historical Events", defaultOn: true, group: "Community Impact" },
  { key: "publicSchools", label: "Public / Boarding Schools", defaultOn: true, group: "Community Impact" },
  { key: "boardingSchools", label: "Boarding School Locations", defaultOn: false, group: "Community Impact" },
  // People & Services
  { key: "ancestorLocations", label: "Ancestor Locations", defaultOn: true, group: "People & Services" },
  { key: "urbanization", label: "Urban Relocation Cities", defaultOn: true, group: "People & Services" },
  { key: "healthAccess", label: "Urban Indian Health Orgs", defaultOn: true, group: "People & Services" },
];

export function AtlasSidebar({
  events,
  activeEras, setActiveEras,
  activeTypes, setActiveTypes,
  activeSeverities, setActiveSeverities,
  activePolicies, setActivePolicies,
  atlasMode,
  activeLayers, setActiveLayers,
  activeExposureFilters, setActiveExposureFilters,
  ancestorCount,
  isAuthenticated,
}: AtlasSidebarProps) {
  const [collapsed, setCollapsed] = useState(false);

  const eras = Array.from(new Set(events.map(e => e.era))).sort(
    (a, b) => events.findIndex(e => e.era === a) - events.findIndex(e => e.era === b)
  );
  const types = Array.from(new Set(events.map(e => e.event_type))).sort();
  const severities = ["critical", "high", "moderate"];
  const policies = Array.from(new Set(events.map(e => e.policy_area))).sort();

  const toggleFilter = (val: string, list: string[], setter: (v: string[]) => void) => {
    setter(list.includes(val) ? list.filter(i => i !== val) : [...list, val]);
  };

  const toggleLayer = (key: keyof ActiveLayers) => {
    setActiveLayers({ ...activeLayers, [key]: !activeLayers[key] });
  };

  const clearAll = () => {
    setActiveEras([]);
    setActiveTypes([]);
    setActiveSeverities([]);
    setActivePolicies([]);
    setActiveExposureFilters([]);
  };

  const activeCount = activeEras.length + activeTypes.length + activeSeverities.length + activePolicies.length + activeExposureFilters.length;

  return (
    <motion.div
      initial={false}
      animate={{ width: collapsed ? 48 : 300 }}
      className="h-full border-r border-border bg-sidebar bg-parchment-texture z-10 flex flex-col relative"
    >
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="absolute -right-3 top-4 bg-background border border-border rounded-full p-1 shadow-sm z-20 hover:bg-muted"
        data-testid="sidebar-collapse-button"
      >
        {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
      </button>

      {collapsed ? (
        <div className="flex-1 py-4 flex flex-col items-center">
          {activeCount > 0 && (
            <Badge variant="destructive" className="mb-4 h-6 w-6 p-0 flex items-center justify-center rounded-full">
              {activeCount}
            </Badge>
          )}
          <span className="[writing-mode:vertical-lr] font-serif text-muted-foreground tracking-widest uppercase mt-4">
            {atlasMode ? "Atlas" : "Filters"}
          </span>
        </div>
      ) : (
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="p-4 border-b border-border/50 flex justify-between items-center bg-background/50">
            <h2 className="font-serif font-medium text-base flex items-center gap-2">
              {atlasMode ? (
                <>
                  <Globe2 className="w-4 h-4 text-primary" />
                  Atlas Mode
                </>
              ) : (
                "Filters"
              )}
            </h2>
            {activeCount > 0 && (
              <Button variant="ghost" size="sm" onClick={clearAll} className="h-7 text-xs px-2 gap-1 text-muted-foreground hover:text-foreground">
                <FilterX className="w-3 h-3" /> Clear
              </Button>
            )}
          </div>

          <ScrollArea className="flex-1">
            <div className="p-4 space-y-7">

              {/* ── Atlas Mode Layers ── */}
              {atlasMode && (
                <div className="space-y-3">
                  <h3 className="text-xs font-mono font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                    <Layers className="w-3 h-3" /> Map Layers
                  </h3>
                  {/* Render layer items grouped by their group field */}
                  {(() => {
                    const groups = Array.from(new Set(LAYER_ITEMS.map(i => i.group ?? "Other")));
                    return groups.map(group => (
                      <div key={group} className="space-y-1.5">
                        <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/50 mt-2 mb-1">{group}</p>
                        {LAYER_ITEMS.filter(i => (i.group ?? "Other") === group).map(item => (
                          <div key={item.key} className="flex items-center gap-2">
                            <Checkbox
                              id={`layer-${item.key}`}
                              checked={activeLayers[item.key]}
                              onCheckedChange={() => toggleLayer(item.key)}
                              data-testid={`layer-${item.key}`}
                            />
                            <Label htmlFor={`layer-${item.key}`} className="cursor-pointer text-sm flex items-center gap-1.5">
                              {item.label}
                              {!item.defaultOn && (
                                <span className="text-[9px] text-muted-foreground/60 bg-muted/40 px-1.5 py-0.5 rounded">off</span>
                              )}
                            </Label>
                          </div>
                        ))}
                      </div>
                    ));
                  })()}

                  {/* Auth + ancestor count state */}
                  {isAuthenticated ? (
                    ancestorCount > 0 ? (
                      <div className="mt-2 bg-primary/5 border border-primary/15 rounded-lg px-3 py-2">
                        <div className="flex items-center gap-1.5">
                          <Users className="w-3 h-3 text-primary/70" />
                          <span className="text-xs text-muted-foreground">
                            <strong className="text-foreground">{ancestorCount}</strong> ancestors loaded
                          </span>
                        </div>
                        <p className="text-[10px] text-muted-foreground/60 mt-1 leading-relaxed">
                          Locations are approximate — inferred from tribal nation and notes. Exact coordinates require verified records.
                        </p>
                      </div>
                    ) : (
                      <div className="mt-2 bg-muted/30 border border-border/40 rounded-lg px-3 py-2">
                        <p className="text-xs text-muted-foreground">
                          No deceased ancestors found. Add lineage records in the Family Directory to see them here.
                        </p>
                      </div>
                    )
                  ) : (
                    <div className="mt-2 bg-amber-500/5 border border-amber-500/20 rounded-lg px-3 py-2 flex items-start gap-1.5">
                      <Info className="w-3.5 h-3.5 text-amber-400 mt-0.5 shrink-0" />
                      <p className="text-xs text-amber-200/70 leading-relaxed">
                        Sign in through the Community or Sovereign Dashboard to see your ancestors on the map.
                      </p>
                    </div>
                  )}

                  <Separator className="opacity-30" />
                </div>
              )}

              {/* ── Atlas Mode: Full Exposure Filter Taxonomy ── */}
              {atlasMode && isAuthenticated && (
                <div className="space-y-5">
                  <h3 className="text-xs font-mono font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                    <Users className="w-3 h-3" /> Ancestor Filters
                  </h3>
                  {EXPOSURE_FILTER_GROUPS.map(group => (
                    <div key={group.group} className="space-y-2">
                      <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">
                        {group.label}
                      </p>
                      {group.filters.map(f => (
                        <div key={f.id} className="flex items-start gap-2">
                          <Checkbox
                            id={`exp-${f.id}`}
                            checked={activeExposureFilters.includes(f.id)}
                            onCheckedChange={() => toggleFilter(f.id, activeExposureFilters, setActiveExposureFilters)}
                            className="mt-0.5"
                            data-testid={`filter-exposure-${f.id}`}
                          />
                          <Label htmlFor={`exp-${f.id}`} className="cursor-pointer text-sm leading-snug" title={f.tooltip}>
                            {f.label}
                          </Label>
                        </div>
                      ))}
                    </div>
                  ))}
                  <Separator className="opacity-30" />
                </div>
              )}

              {/* ── Severity ── */}
              <div className="space-y-3">
                <h3 className="text-xs font-mono font-medium text-muted-foreground uppercase tracking-wider">Severity Level</h3>
                <div className="space-y-2">
                  {severities.map(s => (
                    <div key={s} className="flex items-center gap-2">
                      <Checkbox
                        id={`sev-${s}`}
                        checked={activeSeverities.includes(s)}
                        onCheckedChange={() => toggleFilter(s, activeSeverities, setActiveSeverities)}
                        data-testid={`filter-severity-${s}`}
                      />
                      <Label htmlFor={`sev-${s}`} className="capitalize flex items-center gap-2 cursor-pointer">
                        <span className={`w-2 h-2 rounded-full ${s === "critical" ? "bg-[#a64115]" : s === "high" ? "bg-[#c29b40]" : "bg-[#5c744c]"}`} />
                        {s}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>

              {/* ── Era ── */}
              <div className="space-y-3">
                <h3 className="text-xs font-mono font-medium text-muted-foreground uppercase tracking-wider">Era</h3>
                <div className="space-y-2">
                  {eras.map(e => (
                    <div key={e} className="flex items-center gap-2">
                      <Checkbox
                        id={`era-${e}`}
                        checked={activeEras.includes(e)}
                        onCheckedChange={() => toggleFilter(e, activeEras, setActiveEras)}
                        data-testid={`filter-era-${e}`}
                      />
                      <Label htmlFor={`era-${e}`} className="cursor-pointer text-sm">{ERA_LABELS[e] || e}</Label>
                    </div>
                  ))}
                </div>
              </div>

              {/* ── Event Type ── */}
              <div className="space-y-3">
                <h3 className="text-xs font-mono font-medium text-muted-foreground uppercase tracking-wider">Event Type</h3>
                <div className="space-y-2">
                  {types.map(t => (
                    <div key={t} className="flex items-center gap-2">
                      <Checkbox
                        id={`type-${t}`}
                        checked={activeTypes.includes(t)}
                        onCheckedChange={() => toggleFilter(t, activeTypes, setActiveTypes)}
                        data-testid={`filter-type-${t.replace(/\s+/g, "-").toLowerCase()}`}
                      />
                      <Label htmlFor={`type-${t}`} className="cursor-pointer text-sm">{t}</Label>
                    </div>
                  ))}
                </div>
              </div>

              {/* ── Policy Area ── */}
              <div className="space-y-3">
                <h3 className="text-xs font-mono font-medium text-muted-foreground uppercase tracking-wider">Policy Area</h3>
                <div className="space-y-2">
                  {policies.map(p => (
                    <div key={p} className="flex items-center gap-2">
                      <Checkbox
                        id={`pol-${p}`}
                        checked={activePolicies.includes(p)}
                        onCheckedChange={() => toggleFilter(p, activePolicies, setActivePolicies)}
                        data-testid={`filter-policy-${p.replace(/\s+/g, "-").toLowerCase()}`}
                      />
                      <Label htmlFor={`pol-${p}`} className="cursor-pointer text-sm">{p}</Label>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          </ScrollArea>
        </div>
      )}
    </motion.div>
  );
}
