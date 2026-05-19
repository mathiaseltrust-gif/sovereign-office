import { useState } from "react";
import { motion } from "framer-motion";
import {
  ChevronLeft, ChevronRight, FilterX, Layers, Users,
  MapPin, ChevronDown, ChevronRight as ChevronRightSm,
} from "lucide-react";
import { AtlasEvent, ActiveLayers } from "@/pages/atlas";
import { AtlasAIQuery, AIQueryResult } from "@/components/AtlasAIQuery";
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
  onApplyAIFilters: (result: AIQueryResult) => void;
  aiQueryMessage: string | null;
  onClearAIFilters: () => void;
}

const ERA_LABELS: Record<string, string> = {
  "colonial": "Colonial Era",
  "early-republic": "Early Republic",
  "removal": "Removal Era",
  "reservation": "Reservation Era",
  "post-civil-war": "Post-Civil War",
  "allotment": "Allotment Era",
  "jim-crow": "Jim Crow Era",
  "new-deal": "Allotment / New Deal Era",
  "termination": "Termination Era",
  "wwii-migration": "WWII & Migration",
  "self-determination": "Self-Determination Era",
  "modern": "Modern Era",
};

export const POLICY_ERA_RANGES: Record<string, [number, number]> = {
  removal_era: [1830, 1870],
  allotment_era: [1887, 1934],
  boarding_school_era: [1875, 1940],
  census_era: [1880, 1930],
  jim_crow_era: [1900, 1965],
  urban_relocation_era: [1950, 1975],
  termination_era: [1945, 1970],
};

const EXPOSURE_FILTER_GROUPS: {
  group: string;
  label: string;
  filters: { id: string; label: string; tooltip?: string }[];
}[] = [
  {
    group: "temporal",
    label: "Temporal Relationship",
    filters: [
      { id: "alive_during", label: "Alive During Event" },
      { id: "near_contemporary", label: "Near Contemporary (±20 yr)" },
      { id: "born_before", label: "Born Before Event" },
    ],
  },
  {
    group: "location",
    label: "Location & Territory",
    filters: [
      { id: "location_match", label: "Tribal Nation Matches Region" },
      { id: "has_tribal_nation", label: "Has Recorded Tribal Nation" },
    ],
  },
  {
    group: "policy_era",
    label: "Policy Era Exposure",
    filters: [
      { id: "removal_era", label: "Removal Era (1830–1870)" },
      { id: "allotment_era", label: "Allotment Era (1887–1934)" },
      { id: "boarding_school_era", label: "Boarding School Era (1875–1940)" },
      { id: "census_era", label: "Federal Census Period (1880–1930)" },
      { id: "jim_crow_era", label: "Jim Crow & Plecker Era (1900–1965)" },
      { id: "urban_relocation_era", label: "Urban Relocation (1950–1975)" },
      { id: "termination_era", label: "Termination Era (1945–1970)" },
    ],
  },
  {
    group: "impact_type",
    label: "Impact Type",
    filters: [
      { id: "reclassification_risk", label: "Reclassification & Identity" },
      { id: "health_access_impact", label: "Health Access Events" },
      { id: "land_displacement", label: "Land & Displacement" },
      { id: "family_welfare_impact", label: "Family & Child Welfare" },
      { id: "urban_migration_impact", label: "Urban Migration Events" },
      { id: "education_impact", label: "Education & School Policy" },
    ],
  },
  {
    group: "data_quality",
    label: "Data Quality",
    filters: [
      { id: "has_location_data", label: "Has Location From Records" },
      { id: "has_dates", label: "Has Birth or Death Year" },
      { id: "county_state_records", label: "State / County Records Coverage" },
      { id: "needs_location_review", label: "Location Needs Review" },
      { id: "needs_review", label: "Missing Dates — Needs Review" },
    ],
  },
];

const ATLAS_PEOPLE_LAYERS: { key: keyof ActiveLayers; label: string; description: string }[] = [
  { key: "ancestorLocations", label: "Family Ancestor Locations", description: "Shows where your ancestors lived, migrated, and resided." },
  { key: "urbanization", label: "Urban Relocation Cities", description: "Federal relocation program destination cities." },
  { key: "healthAccess", label: "Urban Indian Health Orgs", description: "Urban Indian health organizations in cities." },
];

const HISTORICAL_LAYER_GROUPS: { group: string; items: { key: keyof ActiveLayers; label: string; defaultOn: boolean }[] }[] = [
  {
    group: "Territorial",
    items: [
      { key: "tribalTerritories", label: "Tribal Territories (time-aware)", defaultOn: true },
      { key: "migrationPaths", label: "Removal & Migration Routes", defaultOn: true },
      { key: "landJurisdiction", label: "Land Allotment / Jurisdiction", defaultOn: true },
    ],
  },
  {
    group: "Treaties & Law",
    items: [
      { key: "treaties", label: "Treaty Timeline", defaultOn: true },
      { key: "courtDecisions", label: "Court Cases & Decisions", defaultOn: true },
      { key: "federalActs", label: "Federal Acts (Tribal Status)", defaultOn: true },
    ],
  },
  {
    group: "Identity & Records",
    items: [
      { key: "reclassification", label: "Reclassification Events", defaultOn: true },
      { key: "censusIdentity", label: "Census Identity Markers", defaultOn: true },
      { key: "historicalEvents", label: "All Historical Events", defaultOn: true },
    ],
  },
  {
    group: "Schools",
    items: [
      { key: "publicSchools", label: "Public / Boarding Schools", defaultOn: true },
      { key: "boardingSchools", label: "Boarding School Locations", defaultOn: false },
    ],
  },
];

function AccordionSection({
  title,
  icon,
  badge,
  defaultOpen = false,
  children,
}: {
  title: string;
  icon?: React.ReactNode;
  badge?: number;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-border/30 rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-muted/30 transition-colors"
      >
        <span className="flex items-center gap-2 text-xs font-mono font-medium text-muted-foreground uppercase tracking-wider">
          {icon}
          {title}
          {badge !== undefined && badge > 0 && (
            <Badge variant="secondary" className="h-4 px-1 text-[9px] font-bold">
              {badge}
            </Badge>
          )}
        </span>
        {open ? (
          <ChevronDown className="w-3.5 h-3.5 text-muted-foreground/50" />
        ) : (
          <ChevronRightSm className="w-3.5 h-3.5 text-muted-foreground/50" />
        )}
      </button>
      {open && <div className="px-3 pb-3 pt-1 space-y-2">{children}</div>}
    </div>
  );
}

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
  onApplyAIFilters,
  aiQueryMessage,
  onClearAIFilters,
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
    onClearAIFilters();
  };

  const manualFilterCount =
    activeEras.length + activeTypes.length + activeSeverities.length +
    activePolicies.length + activeExposureFilters.length;
  const activeCount = manualFilterCount + (aiQueryMessage ? 1 : 0);

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
            <Badge variant="destructive" className="mb-4 h-6 w-6 p-0 flex items-center justify-center rounded-full text-[10px]">
              {activeCount}
            </Badge>
          )}
          <span className="[writing-mode:vertical-lr] font-serif text-muted-foreground tracking-widest uppercase mt-4">
            {atlasMode ? "Atlas" : "Filters"}
          </span>
        </div>
      ) : (
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Header */}
          <div className="p-3 border-b border-border/50 flex justify-between items-center bg-background/50">
            <h2 className="font-serif font-medium text-base flex items-center gap-2">
              {atlasMode ? (
                <>
                  <MapPin className="w-4 h-4 text-primary" />
                  Atlas Mode
                </>
              ) : (
                "Map Filters"
              )}
            </h2>
            {activeCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearAll}
                className="h-7 text-xs px-2 gap-1 text-muted-foreground hover:text-foreground"
              >
                <FilterX className="w-3 h-3" /> Clear all
              </Button>
            )}
          </div>

          <ScrollArea className="flex-1">
            <div className="p-3 space-y-4">

              {/* ── AI Query ─────────────────────────────────────────────── */}
              <AtlasAIQuery
                onApplyFilters={onApplyAIFilters}
                onClear={onClearAIFilters}
                activeMessage={aiQueryMessage}
                isAuthenticated={isAuthenticated}
                ancestorCount={ancestorCount}
              />

              <Separator className="opacity-20" />

              {/* ── Atlas Mode: Family Layer ──────────────────────────────── */}
              {atlasMode && (
                <div className="space-y-3">
                  <div className="bg-primary/8 border border-primary/20 rounded-lg px-3 py-2.5">
                    <div className="flex items-center gap-1.5 mb-1">
                      <Users className="w-3.5 h-3.5 text-primary" />
                      <span className="text-xs font-semibold text-primary">Family Layer Active</span>
                    </div>
                    {isAuthenticated && ancestorCount > 0 ? (
                      <p className="text-[11px] text-primary/70 font-medium">
                        {ancestorCount} ancestor{ancestorCount !== 1 ? "s" : ""} visible on the map
                      </p>
                    ) : !isAuthenticated ? (
                      <p className="text-[11px] text-muted-foreground/60 italic">
                        Sign in via Community or Sovereign Dashboard to load your family members.
                      </p>
                    ) : (
                      <p className="text-[11px] text-muted-foreground/60">
                        No ancestor data — add family records to see ancestor pins.
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    {ATLAS_PEOPLE_LAYERS.map(item => (
                      <div key={item.key} className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <Checkbox
                            id={`layer-${item.key}`}
                            checked={activeLayers[item.key]}
                            onCheckedChange={() => toggleLayer(item.key)}
                            data-testid={`layer-${item.key}`}
                          />
                          <Label htmlFor={`layer-${item.key}`} className="cursor-pointer text-sm font-medium">
                            {item.label}
                          </Label>
                        </div>
                        <p className="text-[10px] text-muted-foreground/50 leading-snug pl-6">{item.description}</p>
                      </div>
                    ))}
                  </div>

                  <Separator className="opacity-20" />
                </div>
              )}

              {/* ── Map Layers (accordion) ────────────────────────────────── */}
              <AccordionSection
                title="Map Layers"
                icon={<Layers className="w-3 h-3" />}
                defaultOpen={false}
              >
                {HISTORICAL_LAYER_GROUPS.map(group => (
                  <div key={group.group} className="space-y-1.5">
                    <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/50 mt-2 mb-1">
                      {group.group}
                    </p>
                    {group.items.map(item => (
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
                            <span className="text-[9px] text-muted-foreground/50 bg-muted/40 px-1 py-0.5 rounded">off</span>
                          )}
                        </Label>
                      </div>
                    ))}
                  </div>
                ))}
              </AccordionSection>

              {/* ── Advanced Filters (accordion) ──────────────────────────── */}
              <AccordionSection
                title="Advanced Filters"
                icon={<FilterX className="w-3 h-3" />}
                badge={manualFilterCount}
                defaultOpen={false}
              >
                {/* Ancestor exposure filters — only in Atlas mode with ancestors */}
                {atlasMode && isAuthenticated && ancestorCount > 0 && (
                  <div className="space-y-4 mb-3">
                    <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/50 pt-1">
                      Ancestor Exposure
                    </p>
                    {EXPOSURE_FILTER_GROUPS.map(group => (
                      <div key={group.group} className="space-y-1.5">
                        <p className="text-[9px] font-semibold uppercase tracking-widest text-muted-foreground/40">
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
                    <Separator className="opacity-20" />
                  </div>
                )}

                {/* Severity */}
                <div className="space-y-1.5">
                  <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/50 pt-1">Severity</p>
                  {severities.map(s => (
                    <div key={s} className="flex items-center gap-2">
                      <Checkbox
                        id={`sev-${s}`}
                        checked={activeSeverities.includes(s)}
                        onCheckedChange={() => toggleFilter(s, activeSeverities, setActiveSeverities)}
                        data-testid={`filter-severity-${s}`}
                      />
                      <Label htmlFor={`sev-${s}`} className="capitalize flex items-center gap-2 cursor-pointer text-sm">
                        <span className={`w-2 h-2 rounded-full ${s === "critical" ? "bg-[#a64115]" : s === "high" ? "bg-[#c29b40]" : "bg-[#5c744c]"}`} />
                        {s}
                      </Label>
                    </div>
                  ))}
                </div>

                {/* Era */}
                <div className="space-y-1.5 pt-2">
                  <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/50">Era</p>
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

                {/* Event Type */}
                <div className="space-y-1.5 pt-2">
                  <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/50">Event Type</p>
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

                {/* Policy Area */}
                <div className="space-y-1.5 pt-2">
                  <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/50">Policy Area</p>
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
              </AccordionSection>

            </div>
          </ScrollArea>
        </div>
      )}
    </motion.div>
  );
}
