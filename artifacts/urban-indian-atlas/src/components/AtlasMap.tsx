import { useEffect, useState, useMemo } from "react";
import { MapContainer, TileLayer, Marker, CircleMarker, Polyline, Tooltip, useMap } from "react-leaflet";
import L from "leaflet";
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";
import { AtlasEvent, AncestorRecord, ActiveLayers } from "@/pages/atlas";
import tribalTerritoriesData from "@/data/tribalTerritories.json";

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
});

const ancestorIcon = L.divIcon({
  className: "",
  html: `<div style="width:14px;height:14px;border-radius:50%;background:#7c9cbc;border:2px solid #fff;box-shadow:0 0 6px rgba(124,156,188,0.8);"></div>`,
  iconSize: [14, 14],
  iconAnchor: [7, 7],
});

const ancestorSelectedIcon = L.divIcon({
  className: "",
  html: `<div style="width:18px;height:18px;border-radius:50%;background:#5b8db8;border:3px solid #fff;box-shadow:0 0 10px rgba(91,141,184,0.9);"></div>`,
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});

interface AtlasMapProps {
  events: AtlasEvent[];
  filteredEvents: AtlasEvent[];
  selectedEventId: string | null;
  onSelectEvent: (id: string) => void;
  urbanLocations: any;
  atlasMode: boolean;
  ancestors: AncestorRecord[];
  selectedPersonId: number | null;
  onSelectPerson: (id: number) => void;
  activeLayers: ActiveLayers;
  yearRange: [number, number];
}

const severityColors = {
  critical: "#a64115",
  high: "#c29b40",
  moderate: "#5c744c",
};

const severityRadius = {
  critical: 12,
  high: 9,
  moderate: 7,
};

// Region name → approximate centroid. Used by resolveAncestorCoord for both
// verified locationText (from ancestralTimelineEvents) and tribal-nation fallback.
const REGION_COORD_MAP: Record<string, [number, number]> = {
  oklahoma: [35.5, -97.5],
  cherokee: [35.5, -95.9],
  choctaw: [34.7, -95.3],
  chickasaw: [34.3, -97.1],
  seminole: [35.2, -96.7],
  creek: [35.7, -96.0],
  muscogee: [35.7, -96.0],
  osage: [36.7, -96.4],
  navajo: [36.5, -108.5],
  "diné": [36.5, -108.5],
  lakota: [43.5, -102.0],
  sioux: [43.5, -102.0],
  ojibwe: [46.5, -91.0],
  chippewa: [46.5, -91.0],
  apache: [33.5, -109.0],
  comanche: [34.6, -98.4],
  paiute: [38.5, -117.5],
  shoshone: [43.0, -115.0],
  cheyenne: [45.5, -107.0],
  crow: [45.6, -107.5],
  blackfeet: [48.7, -112.8],
  blackfoot: [48.7, -112.8],
  "nez perce": [46.0, -116.5],
  yakama: [46.6, -120.5],
  lummi: [48.8, -122.6],
  pueblo: [35.5, -106.5],
  zuni: [35.1, -108.8],
  hopi: [35.8, -110.3],
  mississippi: [32.5, -89.5],
  "north carolina": [35.5, -79.0],
  virginia: [37.5, -79.0],
  alabama: [32.8, -86.8],
  georgia: [32.5, -83.5],
  florida: [28.0, -82.5],
  louisiana: [31.0, -92.0],
  "south carolina": [34.0, -81.0],
  tennessee: [36.0, -86.5],
  arkansas: [34.8, -92.2],
  texas: [31.0, -100.0],
  california: [36.5, -119.5],
  "los angeles": [34.05, -118.24],
  chicago: [41.88, -87.63],
  minneapolis: [44.98, -93.27],
  "san francisco": [37.77, -122.42],
  seattle: [47.6, -122.33],
  denver: [39.74, -104.99],
  phoenix: [33.45, -112.07],
  tahlequah: [35.91, -94.97],
  tulsa: [36.15, -95.99],
  "new mexico": [34.5, -106.0],
  arizona: [34.0, -111.5],
  "south dakota": [44.5, -100.0],
  "north dakota": [47.5, -100.0],
  montana: [47.0, -110.0],
  idaho: [44.0, -114.5],
  washington: [47.5, -120.5],
  oregon: [44.0, -120.5],
  minnesota: [46.5, -94.0],
  wisconsin: [44.5, -90.0],
  michigan: [44.0, -85.0],
};

function geocodeText(text: string): [number, number] | null {
  const lower = text.toLowerCase();
  for (const [key, coords] of Object.entries(REGION_COORD_MAP)) {
    if (lower.includes(key)) return coords;
  }
  return null;
}

// Resolves an ancestor's map coordinate with a source label and optional
// "home" coordinate (tribal nation centroid) for migration arc rendering.
//
// Priority: (1) locationText from actual ancestralTimelineEvents records,
//           (2) tribalNation keyword fallback (inferred, not from user records).
//
// homeCoord is only set when locationText is used — it is the tribal-nation
// centroid that the person migrated FROM. If both exist and differ by more
// than ~0.5°, a per-ancestor migration arc is drawn on the map.
function resolveAncestorCoord(ancestor: AncestorRecord): {
  coord: [number, number];
  source: "timeline_record" | "tribal_nation";
  homeCoord: [number, number] | null; // tribal homeland, for migration arc
} | null {
  const tribalCoord = ancestor.tribalNation ? geocodeText(ancestor.tribalNation) : null;

  if (ancestor.locationText) {
    const coord = geocodeText(ancestor.locationText);
    if (coord) {
      return {
        coord,
        source: "timeline_record",
        homeCoord: tribalCoord,
      };
    }
  }
  if (tribalCoord) {
    return { coord: tribalCoord, source: "tribal_nation", homeCoord: null };
  }
  return null;
}

// ── Family Clustering ──────────────────────────────────────────────────────────
// Groups ancestors within CLUSTER_THRESHOLD_DEG (≈35 mi) of each other into
// a single cluster circle. Single-member groups render as individual markers.
const CLUSTER_THRESHOLD_DEG = 0.5;

interface AncestorPlot {
  ancestor: AncestorRecord;
  coord: [number, number];
  source: "timeline_record" | "tribal_nation";
  homeCoord: [number, number] | null;
}

interface AncestorCluster {
  centroid: [number, number];
  members: AncestorPlot[];
  hasVerified: boolean; // at least one "timeline_record" member
}

function clusterAncestors(plots: AncestorPlot[]): AncestorCluster[] {
  const clusters: AncestorCluster[] = [];
  for (const plot of plots) {
    const nearby = clusters.find(c =>
      Math.abs(c.centroid[0] - plot.coord[0]) < CLUSTER_THRESHOLD_DEG &&
      Math.abs(c.centroid[1] - plot.coord[1]) < CLUSTER_THRESHOLD_DEG
    );
    if (nearby) {
      nearby.members.push(plot);
      if (plot.source === "timeline_record") nearby.hasVerified = true;
      // Recompute centroid
      nearby.centroid = [
        nearby.members.reduce((s, m) => s + m.coord[0], 0) / nearby.members.length,
        nearby.members.reduce((s, m) => s + m.coord[1], 0) / nearby.members.length,
      ] as [number, number];
    } else {
      clusters.push({ centroid: plot.coord, members: [plot], hasVerified: plot.source === "timeline_record" });
    }
  }
  return clusters;
}

// Convert miles radius to approximate degrees
function milesToDegrees(miles: number): number {
  return miles / 69.0;
}

function MapCenterController({ center, zoom }: { center: [number, number] | null; zoom?: number }) {
  const map = useMap();
  useEffect(() => {
    if (center) {
      map.flyTo(center, zoom ?? 6, { duration: 1.2 });
    }
  }, [center, zoom, map]);
  return null;
}

export function AtlasMap({
  events, filteredEvents, selectedEventId, onSelectEvent,
  urbanLocations, atlasMode, ancestors, selectedPersonId, onSelectPerson,
  activeLayers, yearRange,
}: AtlasMapProps) {
  const [mounted, setMounted] = useState(false);
  const [mapCenter, setMapCenter] = useState<[number, number] | null>(null);

  useEffect(() => { setMounted(true); }, []);

  const isEventFilteredOut = (evtId: string) => !filteredEvents.find(e => e.id === evtId);

  // Filter tribal territories by the current year range
  const visibleTerritories = useMemo(() => {
    if (!activeLayers.tribalTerritories) return [];
    return tribalTerritoriesData.filter(nation => {
      const presence = nation.historical_presence.find(
        p => p.year_start <= yearRange[1] && (p.year_end === 9999 || p.year_end >= yearRange[0])
      );
      return !!presence;
    });
  }, [activeLayers.tribalTerritories, yearRange]);

  // Resolve all ancestor coordinates, then cluster nearby ones.
  // ancestorPlots: one entry per ancestor with coord + migration homeCoord.
  // ancestorClusters: spatial groups for cluster-circle rendering.
  const { ancestorPlots, ancestorClusters } = useMemo(() => {
    if (!atlasMode || !activeLayers.ancestorLocations) {
      return { ancestorPlots: [] as AncestorPlot[], ancestorClusters: [] as AncestorCluster[] };
    }
    const plots: AncestorPlot[] = ancestors
      .map(a => {
        const result = resolveAncestorCoord(a);
        if (!result) return null;
        return { ancestor: a, coord: result.coord, source: result.source, homeCoord: result.homeCoord };
      })
      .filter(Boolean) as AncestorPlot[];
    return { ancestorPlots: plots, ancestorClusters: clusterAncestors(plots) };
  }, [ancestors, atlasMode, activeLayers.ancestorLocations]);

  // Alias for legacy usages (map centering)
  const ancestorsWithCoords = ancestorPlots;

  // Center map on selected person
  useEffect(() => {
    if (selectedPersonId) {
      const found = ancestorsWithCoords.find(a => a.ancestor.id === selectedPersonId);
      if (found) setMapCenter(found.coord);
    }
  }, [selectedPersonId, ancestorsWithCoords]);

  if (!mounted) return null;

  return (
    <div className="flex-1 w-full bg-[#f4f1ea] relative" data-testid="map-container" style={{ height: "100%", zIndex: 0 }}>
      <MapContainer
        center={[39.5, -98.35]}
        zoom={4}
        style={{ height: "100%", width: "100%" }}
        zoomControl={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
        />

        {mapCenter && <MapCenterController center={mapCenter} />}

        {/* ── Tribal Territory Circles (time-aware) ── */}
        {visibleTerritories.map(nation => {
          const presence = nation.historical_presence.find(
            p => p.year_start <= yearRange[1] && (p.year_end === 9999 || p.year_end >= yearRange[0])
          );
          if (!presence) return null;
          const center = presence.center as [number, number];
          const radiusDeg = milesToDegrees(nation.approximate_radius_miles);
          const isRemoved = nation.removal_year !== null && nation.removal_year <= yearRange[1];
          const isPersisting = presence.year_end === 9999;

          return (
            <CircleMarker
              key={nation.id}
              center={center}
              radius={Math.max(18, nation.approximate_radius_miles / 8)}
              pathOptions={{
                color: isPersisting ? "#7c5a2a" : isRemoved ? "#a64115" : "#8a7050",
                weight: 1.5,
                fillColor: isPersisting ? "#c9a96e" : isRemoved ? "#c47040" : "#c4a870",
                fillOpacity: 0.10,
                opacity: 0.55,
                dashArray: isRemoved && !isPersisting ? "4 4" : undefined,
              }}
            >
              <Tooltip direction="top" offset={[0, -10]} opacity={0.95}>
                <div className="min-w-[180px]">
                  <div className="font-serif font-semibold text-sm">{nation.name}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{nation.region}</div>
                  {nation.removal_year && nation.removal_year <= yearRange[1] && (
                    <div className="text-xs text-[#a64115] mt-0.5">Removal: {nation.removal_year}</div>
                  )}
                  <div className="text-[10px] text-muted-foreground mt-1 leading-relaxed">{presence.notes}</div>
                  <div className="text-[10px] mt-1 border-t border-border/30 pt-1 text-muted-foreground italic">{nation.current_status}</div>
                </div>
              </Tooltip>
            </CircleMarker>
          );
        })}

        {/* ── Removal Routes ── */}
        {activeLayers.migrationPaths && urbanLocations.keyRemovalRoutes?.map((route: any, i: number) => (
          <Polyline
            key={i}
            positions={route.coordinates}
            pathOptions={{ color: "#8a4b38", weight: 2, dashArray: "5, 10", opacity: 0.6 }}
          >
            <Tooltip sticky>{route.name} ({route.nation})</Tooltip>
          </Polyline>
        ))}

        {/* ── Relocation Cities ── */}
        {activeLayers.urbanization && urbanLocations.relocationCities?.map((city: any, i: number) => (
          <CircleMarker
            key={`city-${i}`}
            center={city.coordinates}
            pathOptions={{ color: "#3f4650", weight: 2, fill: false, opacity: 0.7 }}
            radius={14}
          >
            <Tooltip>{city.city}, {city.state} — Relocation City</Tooltip>
          </CircleMarker>
        ))}

        {/* ── Urban Indian Health Orgs ── */}
        {activeLayers.healthAccess && urbanLocations.urbanIndianHealthOrgs?.map((org: any, i: number) => (
          <CircleMarker
            key={`org-${i}`}
            center={org.coordinates}
            pathOptions={{ color: "#5c744c", weight: 1, fillColor: "#5c744c", fillOpacity: 0.8 }}
            radius={4}
          >
            <Tooltip>{org.name}</Tooltip>
          </CircleMarker>
        ))}

        {/* ── Historical Events ──────────────────────────────────────────────
            Events are split into thematic sub-layers controlled by the new
            first-class layer toggles. Each event belongs to at most one
            thematic layer; if none match it falls through to the catch-all
            `historicalEvents` layer.
             Layer priority (first match wins):
              reclassification  — Census Classification / Reclassification
              censusIdentity    — Tribal Enrollment / Blood Quantum / Identity
              federalActs       — Act of Congress / Federal Policy
              publicSchools     — Education / Boarding Schools
              landJurisdiction  — Land Allotment / Removal / Jurisdiction
              historicalEvents  — everything else
        ── */}
        {events.map((evt) => {
          const isFilteredOut = isEventFilteredOut(evt.id);
          const isSelected = evt.id === selectedEventId;
          const et = (evt.event_type ?? "").toLowerCase();
          const pa = (evt.policy_area ?? "").toLowerCase();
          const ti = (evt.title ?? "").toLowerCase();

          // Determine which thematic layer this event belongs to
          const isReclassification = et.includes("census classif") || et.includes("reclassif") || pa.includes("reclassif") || pa.includes("census classif");
          const isCensusIdentity = et.includes("tribal enrollment") || et.includes("blood quantum") || pa.includes("enrollment") || pa.includes("blood quantum") || (pa.includes("identity") && !isReclassification);
          const isFederalAct = et.includes("act of congress") || et.includes("federal policy") || et.includes("federal act") || pa.includes("federal legislation");
          const isPublicSchool = pa.includes("education") || et.includes("school") || ti.includes("boarding school") || ti.includes("public school");
          const isLandJurisdiction = pa.includes("land allotment") || pa.includes("allotment") || et.includes("removal") || pa.includes("jurisdiction");

          // boardingSchools: a dedicated toggle for boarding/public-school events,
          // kept separate from publicSchools so both can be toggled independently.
          // Note: a boarding-school event can match BOTH isPublicSchool and
          // isBoardingSchool — it is shown if EITHER of its layers is on.
          const isBoardingSchool = ti.includes("boarding school") || et.includes("boarding school") || pa.includes("boarding school");

          // Layer visibility check — first-match wins for thematic layers
          const visible =
            (isReclassification && activeLayers.reclassification) ||
            (isCensusIdentity && activeLayers.censusIdentity) ||
            (isFederalAct && activeLayers.federalActs) ||
            (isBoardingSchool && activeLayers.boardingSchools) ||
            (isPublicSchool && activeLayers.publicSchools) ||
            (isLandJurisdiction && activeLayers.landJurisdiction) ||
            (!isReclassification && !isCensusIdentity && !isFederalAct && !isBoardingSchool && !isPublicSchool && !isLandJurisdiction && activeLayers.historicalEvents);

          if (!visible) return null;

          return (
            <CircleMarker
              key={evt.id}
              center={evt.coordinates}
              radius={severityRadius[evt.severity_level] || 8}
              pathOptions={{
                color: isSelected ? "#000" : "white",
                weight: isSelected ? 3 : 1.5,
                fillColor: severityColors[evt.severity_level] || "#000",
                fillOpacity: isFilteredOut ? 0.2 : 0.9,
                opacity: isFilteredOut ? 0.2 : 1,
              }}
              eventHandlers={{ click: () => onSelectEvent(evt.id) }}
            >
              <Tooltip direction="top" offset={[0, -10]} opacity={1}>
                <div className="font-serif font-medium">{evt.title}</div>
                <div className="text-xs text-muted-foreground">{evt.year} · {evt.event_type}</div>
              </Tooltip>
            </CircleMarker>
          );
        })}

        {/* ── Ancestor Markers (Atlas Mode) ──────────────────────────────────
            Two visual states:
            • Blue solid ring  → locationText from ancestralTimelineEvents (real records)
            • Grey dashed ring → tribal-nation keyword inference (no verified place record)
            Both states are clearly labeled in the tooltip.
        ── */}
        {/* ── Per-ancestor migration arcs ─────────────────────────────────────
            For any ancestor whose recorded locationText differs from their
            tribal homeland by >0.5°, draw a thin dashed Polyline from the
            tribal centroid (homeCoord) to the recorded location (coord).
            This shows the movement pathway embedded in actual lineage records.
        ── */}
        {atlasMode && ancestorPlots.map(({ ancestor, coord, homeCoord }) => {
          if (!homeCoord) return null;
          const dLat = Math.abs(coord[0] - homeCoord[0]);
          const dLon = Math.abs(coord[1] - homeCoord[1]);
          if (dLat < 0.5 && dLon < 0.5) return null; // same locale, no arc
          return (
            <Polyline
              key={`arc-${ancestor.id}`}
              positions={[homeCoord, coord]}
              pathOptions={{ color: "#8a7050", weight: 1.5, opacity: 0.45, dashArray: "4 6" }}
            />
          );
        })}

        {/* ── Family clusters + individual ancestor markers ────────────────────
            Clusters of 2+ ancestors nearby share a larger circle badge showing
            the count. Single ancestors render as individual pin markers.
            Selected ancestor always shows an expanded glow ring regardless
            of whether it is part of a cluster.
        ── */}
        {atlasMode && ancestorClusters.map((cluster, ci) => {
          const count = cluster.members.length;
          const hasSelected = cluster.members.some(m => m.ancestor.id === selectedPersonId);

          if (count === 1) {
            // Single-ancestor marker
            const { ancestor, coord, source } = cluster.members[0];
            const isSelected = ancestor.id === selectedPersonId;
            const fromRecords = source === "timeline_record";
            const icon = L.divIcon({
              className: "",
              html: isSelected
                ? `<div style="width:20px;height:20px;border-radius:50%;background:${fromRecords ? "#5b8db8" : "#8a8a9a"};border:3px solid #fff;box-shadow:0 0 10px ${fromRecords ? "rgba(91,141,184,0.9)" : "rgba(138,138,154,0.6)"};"></div>`
                : `<div style="width:14px;height:14px;border-radius:50%;background:${fromRecords ? "#7c9cbc" : "#9a9aaa"};border:${fromRecords ? "2px solid #fff" : "2px dashed #ccc"};box-shadow:0 0 6px ${fromRecords ? "rgba(124,156,188,0.8)" : "rgba(0,0,0,0.2)"};"></div>`,
              iconSize: isSelected ? [20, 20] : [14, 14],
              iconAnchor: isSelected ? [10, 10] : [7, 7],
            });
            return (
              <Marker
                key={`person-${ancestor.id}`}
                position={coord}
                icon={icon}
                eventHandlers={{ click: () => onSelectPerson(ancestor.id) }}
              >
                <Tooltip direction="top" offset={[0, -10]} opacity={1}>
                  <div className="font-medium text-sm">{ancestor.fullName}</div>
                  {(ancestor.birthYear || ancestor.deathYear) && (
                    <div className="text-xs text-muted-foreground">
                      {[ancestor.birthYear, ancestor.deathYear].filter(Boolean).join(" – ")}
                    </div>
                  )}
                  {ancestor.tribalNation && (
                    <div className="text-xs italic text-amber-600/80">{ancestor.tribalNation}</div>
                  )}
                  <div className="text-[10px] mt-1 opacity-60">
                    {fromRecords
                      ? `Location: from records — "${ancestor.locationText}"`
                      : "Location: inferred from tribal nation (needs review)"}
                  </div>
                </Tooltip>
              </Marker>
            );
          }

          // Multi-ancestor cluster badge
          const clusterIcon = L.divIcon({
            className: "",
            html: `<div style="width:${hasSelected ? 34 : 28}px;height:${hasSelected ? 34 : 28}px;border-radius:50%;background:${cluster.hasVerified ? "#5b8db8" : "#9a9aaa"};border:3px solid #fff;box-shadow:0 0 ${hasSelected ? 12 : 6}px ${cluster.hasVerified ? "rgba(91,141,184,0.7)" : "rgba(0,0,0,0.25)"};display:flex;align-items:center;justify-content:center;color:#fff;font-size:${count >= 10 ? 9 : 11}px;font-weight:700;font-family:system-ui,sans-serif;">${count}</div>`,
            iconSize: hasSelected ? [34, 34] : [28, 28],
            iconAnchor: hasSelected ? [17, 17] : [14, 14],
          });
          return (
            <Marker
              key={`cluster-${ci}`}
              position={cluster.centroid}
              icon={clusterIcon}
              eventHandlers={{ click: () => onSelectPerson(cluster.members[0].ancestor.id) }}
            >
              <Tooltip direction="top" offset={[0, -10]} opacity={1}>
                <div className="font-medium text-sm">{count} ancestors in this area</div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {cluster.members.map(m => m.ancestor.fullName).join(", ")}
                </div>
                {cluster.hasVerified && (
                  <div className="text-[10px] mt-1 text-blue-600/80">Includes verified record locations</div>
                )}
              </Tooltip>
            </Marker>
          );
        })}

      </MapContainer>

      {/* Atlas Mode layer legend overlay */}
      {atlasMode && (
        <div className="absolute bottom-4 left-4 bg-background/90 border border-border rounded-lg p-3 z-10 text-xs space-y-1.5 shadow-lg max-w-[220px]">
          <p className="font-mono font-semibold text-[10px] uppercase tracking-widest text-muted-foreground mb-2">Map Legend</p>
          {activeLayers.tribalTerritories && (
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full border-2 border-[#8a7050]/60 bg-[#c4a870]/20" />
              <span className="text-muted-foreground">Tribal Territory (time-aware)</span>
            </div>
          )}
          {activeLayers.ancestorLocations && (
            <>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-[#7c9cbc] border-2 border-white shadow" />
                <span className="text-muted-foreground">Ancestor (from records)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-[#9a9aaa]" style={{ border: "2px dashed #ccc" }} />
                <span className="text-muted-foreground">Ancestor (location needs review)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-5 h-4 flex items-center">
                  <div className="w-4 h-4 rounded-full bg-[#5b8db8] border-2 border-white flex items-center justify-center text-white" style={{ fontSize: 8, fontWeight: 700 }}>N</div>
                </div>
                <span className="text-muted-foreground">Family cluster (N ancestors)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-5 h-0.5" style={{ borderTop: "1.5px dashed #8a7050", opacity: 0.55 }} />
                <span className="text-muted-foreground">Migration arc (homeland → recorded location)</span>
              </div>
            </>
          )}
          {activeLayers.migrationPaths && (
            <div className="flex items-center gap-2">
              <div className="w-5 h-0.5 bg-[#8a4b38] opacity-60" style={{ borderTop: "2px dashed #8a4b38" }} />
              <span className="text-muted-foreground">Removal Route</span>
            </div>
          )}
          {activeLayers.historicalEvents && (
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-[#a64115]" />
              <span className="text-muted-foreground">Historical Event</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
