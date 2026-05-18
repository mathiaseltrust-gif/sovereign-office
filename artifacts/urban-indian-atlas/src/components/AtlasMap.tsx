import { useEffect, useState, useMemo } from "react";
import { MapContainer, TileLayer, Marker, CircleMarker, GeoJSON as GeoJSONLayer, Polyline, Tooltip, useMap } from "react-leaflet";
import L from "leaflet";
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";
import { AtlasEvent, AncestorRecord, ActiveLayers } from "@/pages/atlas";
import tribalGeoJSONRaw from "@/data/tribalTerritoriesGeoJSON.json";

interface TerritoryFeatureProperties {
  nation_id: string;
  name: string;
  region: string;
  year_start: number;
  year_end: number;
  notes: string;
  current_status: string;
  removal_year: number | null;
}

interface TerritoryFeatureCollection {
  type: "FeatureCollection";
  features: Array<{
    type: "Feature";
    properties: TerritoryFeatureProperties;
    geometry: { type: string; coordinates: unknown };
  }>;
}

const tribalGeoJSONData = tribalGeoJSONRaw as TerritoryFeatureCollection;

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
});

// ── US State centroids (approximate) for multi-state impact markers ──────────
const STATE_CENTROIDS: Record<string, [number, number]> = {
  "Alabama":        [32.8,   -86.8],
  "Alaska":         [64.2,  -153.4],
  "Arizona":        [34.3,  -111.1],
  "Arkansas":       [34.8,   -92.2],
  "California":     [36.8,  -119.4],
  "Colorado":       [39.0,  -105.5],
  "Connecticut":    [41.6,   -72.7],
  "Delaware":       [39.0,   -75.5],
  "Florida":        [27.8,   -81.7],
  "Georgia":        [32.9,   -83.4],
  "Hawaii":         [20.3,  -156.4],
  "Idaho":          [44.4,  -114.5],
  "Illinois":       [40.0,   -89.2],
  "Indiana":        [40.3,   -86.1],
  "Iowa":           [42.0,   -93.5],
  "Kansas":         [38.5,   -98.4],
  "Kentucky":       [37.5,   -85.3],
  "Louisiana":      [31.2,   -91.8],
  "Maine":          [45.4,   -69.0],
  "Maryland":       [39.1,   -76.8],
  "Massachusetts":  [42.2,   -71.5],
  "Michigan":       [44.3,   -85.6],
  "Minnesota":      [46.4,   -93.1],
  "Mississippi":    [32.7,   -89.7],
  "Missouri":       [38.5,   -92.5],
  "Montana":        [46.9,  -110.5],
  "Nebraska":       [41.5,   -99.9],
  "Nevada":         [38.8,  -117.2],
  "New Hampshire":  [43.7,   -71.6],
  "New Jersey":     [40.1,   -74.5],
  "New Mexico":     [34.3,  -106.0],
  "New York":       [43.0,   -75.5],
  "North Carolina": [35.5,   -79.4],
  "North Dakota":   [47.5,  -100.3],
  "Ohio":           [40.4,   -82.8],
  "Oklahoma":       [35.6,   -96.9],
  "Oregon":         [44.0,  -120.6],
  "Pennsylvania":   [41.2,   -77.2],
  "Rhode Island":   [41.7,   -71.5],
  "South Carolina": [33.9,   -80.9],
  "South Dakota":   [44.4,  -100.2],
  "Tennessee":      [35.8,   -86.7],
  "Texas":          [31.1,   -97.6],
  "Utah":           [39.4,  -111.1],
  "Vermont":        [44.1,   -72.7],
  "Virginia":       [37.8,   -78.2],
  "Washington":     [47.4,  -120.5],
  "West Virginia":  [38.9,   -80.5],
  "Wisconsin":      [44.2,   -89.8],
  "Wyoming":        [43.0,  -107.6],
};

// ── Ancestry-style ancestor marker helpers ─────────────────────────────────

// Surname-keyed palette — maps consistently so the same family always gets
// the same color across re-renders and zoom levels.
const ANCESTOR_COLOR_PALETTE = [
  "#8b2020", // deep maroon   (primary — most ancestors)
  "#b8860b", // dark gold
  "#2d6a4f", // forest green
  "#1e3a5f", // deep navy
  "#6b3070", // deep purple
  "#7a3010", // terra cotta
  "#1a5c5c", // dark teal
  "#5a3a00", // olive brown
];

function getAncestorColor(lastName: string | null | undefined): string {
  if (!lastName) return ANCESTOR_COLOR_PALETTE[0];
  let hash = 0;
  for (let i = 0; i < lastName.length; i++) {
    hash = ((hash << 5) - hash + lastName.charCodeAt(i)) & 0xffff;
  }
  return ANCESTOR_COLOR_PALETTE[Math.abs(hash) % ANCESTOR_COLOR_PALETTE.length];
}

function getInitials(firstName: string | null | undefined, lastName: string | null | undefined, fullName: string | null | undefined): string {
  if (firstName && lastName) return (firstName[0] + lastName[0]).toUpperCase();
  if (fullName) {
    const parts = fullName.trim().split(/\s+/).filter(p => /^[A-Za-z]/.test(p));
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  }
  return "?";
}

function generationLabel(pos: number | null): string {
  if (pos === null) return "Ancestor";
  if (pos === 1) return "Parent";
  if (pos === 2) return "Grandparent";
  if (pos === 3) return "Great-Grandparent";
  const suffix = pos === 4 ? "2nd" : pos === 5 ? "3rd" : `${pos - 2}th`;
  return `${suffix} Great-Grandparent`;
}

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
  "mathias el": [34.05, -118.24],
  "mathias el tribe": [34.05, -118.24],
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
// Priority: (1) verified lat/lng stored on family_lineage record (documentary-quality),
//           (2) tribalNation keyword geocoded to a centroid (tribal homeland),
//           (3) location_text from the most recent ancestral_timeline_events record
//               — used as a fallback when tribal_nation yields no coordinate.
//               Mirrors the Community Dashboard member-detail map picker behaviour.
//
// homeCoord is always null — under the current priority order, if we reach the
// "timeline_record" branch it means tribalNation produced no geocodable coord,
// so there is no tribal centroid to draw a migration arc from.
// Verified coords are taken as authoritative and no migration arc is drawn.
function resolveAncestorCoord(ancestor: AncestorRecord): {
  coord: [number, number];
  source: "verified_coords" | "timeline_record" | "tribal_nation";
  homeCoord: [number, number] | null; // tribal homeland, for migration arc
} | null {
  const tribalCoord = ancestor.tribalNation ? geocodeText(ancestor.tribalNation) : null;

  // Highest priority: verified lat/lng stored directly on the family_lineage record
  if (ancestor.locationLat != null && ancestor.locationLng != null) {
    return {
      coord: [ancestor.locationLat, ancestor.locationLng],
      source: "verified_coords",
      homeCoord: null, // verified point is definitive — no migration arc
    };
  }

  // Second priority: tribal nation keyword geocoded to a centroid.
  // Mirrors Community Dashboard: tribal nation is tried before timeline text.
  if (tribalCoord) {
    return { coord: tribalCoord, source: "tribal_nation", homeCoord: null };
  }

  // Fallback: location_text from the most recent ancestral_timeline_events record.
  // Used when tribal_nation is absent or unrecognised.
  if (ancestor.locationText) {
    const coord = geocodeText(ancestor.locationText);
    if (coord) {
      return {
        coord,
        source: "timeline_record",
        homeCoord: null, // no tribal coord available to draw a migration arc from
      };
    }
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
  source: "verified_coords" | "timeline_record" | "tribal_nation";
  homeCoord: [number, number] | null;
}

interface AncestorCluster {
  centroid: [number, number];
  members: AncestorPlot[];
  hasVerified: boolean; // at least one "verified_coords" or "timeline_record" member
}

function isVerifiedSource(source: AncestorPlot["source"]): boolean {
  return source === "verified_coords" || source === "timeline_record";
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
      if (isVerifiedSource(plot.source)) nearby.hasVerified = true;
      // Recompute centroid
      nearby.centroid = [
        nearby.members.reduce((s, m) => s + m.coord[0], 0) / nearby.members.length,
        nearby.members.reduce((s, m) => s + m.coord[1], 0) / nearby.members.length,
      ] as [number, number];
    } else {
      clusters.push({ centroid: plot.coord, members: [plot], hasVerified: isVerifiedSource(plot.source) });
    }
  }
  return clusters;
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

  // Filter GeoJSON territory features by the current year range and layer toggle.
  // Each feature represents one time-period slice of a tribal territory.
  const visibleGeoJSON = useMemo((): TerritoryFeatureCollection | null => {
    if (!activeLayers.tribalTerritories) return null;
    const features = tribalGeoJSONData.features.filter(
      (f: TerritoryFeatureCollection["features"][number]) => {
        const { year_start, year_end } = f.properties;
        return year_start <= yearRange[1] && (year_end === 9999 || year_end >= yearRange[0]);
      }
    );
    return { type: "FeatureCollection", features };
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
    <div className="flex-1 w-full bg-[#1a1612] relative" data-testid="map-container" style={{ height: "100%", zIndex: 0 }}>
      <MapContainer
        center={[39.5, -98.35]}
        zoom={4}
        style={{ height: "100%", width: "100%" }}
        zoomControl={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          subdomains="abcd"
          maxZoom={20}
        />

        {mapCenter && <MapCenterController center={mapCenter} />}

        {/* ── Tribal Territory GeoJSON polygons (time-aware) ── */}
        {visibleGeoJSON && visibleGeoJSON.features.length > 0 && (
          <GeoJSONLayer
            key={[
              ...visibleGeoJSON.features.map(
                f => `${f.properties.nation_id}_${f.properties.year_start}`
              ),
              yearRange[0],
              yearRange[1],
            ].join(",")}
            data={visibleGeoJSON}
            style={(feature) => {
              if (!feature) return {};
              const p = feature.properties as TerritoryFeatureProperties;
              const isRemoved = p.removal_year !== null && p.removal_year <= yearRange[1];
              const isPersisting = p.year_end === 9999;
              return {
                color: isPersisting ? "#7c5a2a" : isRemoved ? "#a64115" : "#8a7050",
                weight: 1.5,
                fillColor: isPersisting ? "#c9a96e" : isRemoved ? "#c47040" : "#c4a870",
                fillOpacity: 0.13,
                opacity: 0.65,
                dashArray: isRemoved && !isPersisting ? "5 5" : undefined,
              };
            }}
            onEachFeature={(feature, layer) => {
              const p = feature.properties as TerritoryFeatureProperties;
              const isRemoved = p.removal_year !== null && p.removal_year <= yearRange[1];
              const html = `
                <div style="min-width:200px;font-family:serif">
                  <div style="font-weight:600;font-size:14px">${p.name}</div>
                  <div style="font-size:12px;color:#888;margin-top:2px">${p.region}</div>
                  ${isRemoved ? `<div style="font-size:12px;color:#a64115;margin-top:2px">Removal: ${p.removal_year}</div>` : ""}
                  <div style="font-size:10px;color:#666;margin-top:4px;line-height:1.5">${p.notes}</div>
                  <div style="font-size:10px;margin-top:4px;border-top:1px solid #e5e5e5;padding-top:4px;color:#888;font-style:italic">${p.current_status}</div>
                </div>`;
              layer.bindTooltip(html, { sticky: true, opacity: 0.97 });
              layer.bindPopup(html, { maxWidth: 280, className: "tribal-territory-popup" });
            }}
          />
        )}

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
            thematic layer; treaties are rendered separately as diamond markers.
             Layer priority (first match wins):
              treaties          — Treaty events (distinct diamond marker)
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
          const isTreaty = et === "treaty" || pa.includes("treaty rights") || pa === "treaty";
          const isReclassification = !isTreaty && (et.includes("census classif") || et.includes("reclassif") || pa.includes("reclassif") || pa.includes("census classif"));
          const isCensusIdentity = !isTreaty && (et.includes("tribal enrollment") || et.includes("blood quantum") || pa.includes("enrollment") || pa.includes("blood quantum") || (pa.includes("identity") && !isReclassification));
          const isFederalAct = !isTreaty && (et.includes("act of congress") || et.includes("federal policy") || et.includes("federal act") || pa.includes("federal legislation"));
          const isPublicSchool = !isTreaty && (pa.includes("education") || et.includes("school") || ti.includes("boarding school") || ti.includes("public school"));
          const isLandJurisdiction = !isTreaty && (pa.includes("land allotment") || pa.includes("allotment") || et.includes("removal") || pa.includes("jurisdiction"));
          const isBoardingSchool = !isTreaty && (ti.includes("boarding school") || et.includes("boarding school") || pa.includes("boarding school"));

          // Treaty events: rendered as special diamond markers (handled in separate pass below)
          if (isTreaty) return null;

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

        {/* ── Treaty Markers — rendered as distinct diamond/scroll icons ────────
            Treaties are shown with a unique diamond SVG marker in deep indigo
            so they stand apart from all other event markers.
        ── */}
        {activeLayers.treaties && events
          .filter(evt => {
            const et = (evt.event_type ?? "").toLowerCase();
            const pa = (evt.policy_area ?? "").toLowerCase();
            return et === "treaty" || pa.includes("treaty rights") || pa === "treaty";
          })
          .map(evt => {
            const isFilteredOut = isEventFilteredOut(evt.id);
            const isSelected = evt.id === selectedEventId;
            const size = isSelected ? 20 : 14;
            const color = "#4a3080";
            const borderColor = isSelected ? "#000" : "#fff";
            const borderWidth = isSelected ? 3 : 2;
            const opacity = isFilteredOut ? 0.25 : 1;
            // Diamond SVG as a DivIcon
            const icon = L.divIcon({
              className: "",
              html: `<div style="opacity:${opacity};filter:drop-shadow(0 1px 3px rgba(74,48,128,0.7))">
                <svg width="${size}" height="${size}" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                  <polygon points="10,1 19,10 10,19 1,10"
                    fill="${color}"
                    stroke="${borderColor}"
                    stroke-width="${borderWidth}"
                  />
                  <text x="10" y="14" text-anchor="middle" font-size="9" fill="white" font-family="serif" font-weight="bold">T</text>
                </svg>
              </div>`,
              iconSize: [size, size],
              iconAnchor: [size / 2, size / 2],
            });
            return (
              <Marker
                key={evt.id}
                position={evt.coordinates}
                icon={icon}
                eventHandlers={{ click: () => onSelectEvent(evt.id) }}
              >
                <Tooltip direction="top" offset={[0, -8]} opacity={1}>
                  <div className="font-serif font-semibold" style={{ color: "#4a3080" }}>⬦ {evt.title}</div>
                  <div className="text-xs text-muted-foreground">{evt.year} · Treaty</div>
                </Tooltip>
              </Marker>
            );
          })
        }

        {/* ── Secondary State-Impact Markers ─────────────────────────────────
            When an event is selected and has multiple statesAffected, render
            a faint pulsing ring at each state's centroid so the geographic
            scope of national acts (e.g. 1956 Relocation Act) is visible.
        ── */}
        {(() => {
          const sel = selectedEventId ? events.find(e => e.id === selectedEventId) : null;
          if (!sel) return null;
          const states = sel.states_affected;
          if (!states || states.length < 2 || states[0] === "All states") return null;
          const primaryCoord = sel.coordinates;
          return states.map(stateName => {
            const centroid = STATE_CENTROIDS[stateName];
            if (!centroid) return null;
            // Skip if centroid is very close to the event's primary marker
            const dLat = Math.abs(centroid[0] - primaryCoord[0]);
            const dLng = Math.abs(centroid[1] - primaryCoord[1]);
            if (dLat < 1.5 && dLng < 1.5) return null;
            return (
              <CircleMarker
                key={`impact-${sel.id}-${stateName}`}
                center={centroid}
                radius={14}
                pathOptions={{
                  color: "#c29b40",
                  weight: 1.5,
                  fillColor: "#c29b40",
                  fillOpacity: 0.08,
                  opacity: 0.55,
                  dashArray: "4 4",
                }}
              >
                <Tooltip direction="top" offset={[0, -10]} opacity={0.95}>
                  <div className="text-xs font-medium">{stateName}</div>
                  <div className="text-[10px] text-muted-foreground">Impact zone · {sel.short_title || sel.title}</div>
                </Tooltip>
              </CircleMarker>
            );
          });
        })()}

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
            // ── Single-ancestor initials badge ──────────────────────────────
            const { ancestor, coord, source } = cluster.members[0];
            const isSelected = ancestor.id === selectedPersonId;
            const color = getAncestorColor(ancestor.lastName);
            const initials = getInitials(ancestor.firstName, ancestor.lastName, ancestor.fullName);
            const size = isSelected ? 42 : 34;
            const fontSize = initials.length > 2 ? 10 : 12;
            // Selected: outer glow ring + larger badge
            const outerRing = isSelected
              ? `box-shadow:0 0 0 3px rgba(255,255,255,0.25),0 0 14px rgba(255,255,255,0.18),0 2px 8px rgba(0,0,0,0.55);`
              : `box-shadow:0 2px 6px rgba(0,0,0,0.45);`;
            // Inferred location: slightly desaturated with dashed border
            const borderStyle = source === "tribal_nation"
              ? `border:2px dashed rgba(255,255,255,0.55);`
              : `border:2.5px solid rgba(255,255,255,0.9);`;
            const hasPhoto = !!ancestor.photoUrl;
            const bgStyle = hasPhoto
              ? `background-image:url(${ancestor.photoUrl});background-size:cover;background-position:center;background-color:${color};`
              : `background:${color};`;
            const icon = L.divIcon({
              className: "",
              html: `<div style="
                width:${size}px;height:${size}px;border-radius:50%;
                ${bgStyle}
                ${borderStyle}
                ${outerRing}
                display:flex;align-items:center;justify-content:center;
                color:#fff;font-size:${fontSize}px;font-weight:700;
                font-family:system-ui,-apple-system,sans-serif;
                letter-spacing:0.5px;
                cursor:pointer;
                opacity:${source === "tribal_nation" ? 0.82 : 1};
              ">${hasPhoto ? "" : initials}</div>`,
              iconSize: [size, size],
              iconAnchor: [size / 2, size / 2],
            });

            const genLabel = generationLabel(ancestor.generationalPosition);
            const years = [ancestor.birthYear, ancestor.deathYear].filter(Boolean).join(" – ");
            const locationNote = source === "verified_coords"
              ? ancestor.locationAddress
                ? `Verified · ${ancestor.locationAddress}`
                : "Verified location"
              : source === "timeline_record"
                ? `From records${ancestor.locationText ? ` · ${ancestor.locationText}` : ""}`
                : ancestor.tribalNation
                  ? `Nation · ${ancestor.tribalNation}`
                  : "Location inferred";

            return (
              <Marker
                key={`person-${ancestor.id}`}
                position={coord}
                icon={icon}
                eventHandlers={{ click: () => onSelectPerson(ancestor.id) }}
              >
                <Tooltip direction="top" offset={[0, -(size / 2 + 4)]} opacity={1}>
                  <div style={{ minWidth: 150 }}>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{ancestor.fullName}</div>
                    {years && <div style={{ fontSize: 11, color: "#888", marginTop: 1 }}>{years}</div>}
                    <div style={{ fontSize: 11, color: "#aaa", marginTop: 1 }}>{genLabel}</div>
                    {ancestor.tribalNation && (
                      <div style={{ fontSize: 10, color: "#c9a96e", marginTop: 2, fontStyle: "italic" }}>{ancestor.tribalNation}</div>
                    )}
                    <div style={{ fontSize: 10, color: "#777", marginTop: 3, borderTop: "1px solid #333", paddingTop: 3 }}>{locationNote}</div>
                  </div>
                </Tooltip>
              </Marker>
            );
          }

          // ── Multi-ancestor cluster badge ───────────────────────────────────
          // Use the most common surname color in the cluster for visual cohesion.
          const surnameCounts: Record<string, number> = {};
          for (const m of cluster.members) {
            const ln = m.ancestor.lastName ?? "?";
            surnameCounts[ln] = (surnameCounts[ln] ?? 0) + 1;
          }
          const dominantSurname = Object.entries(surnameCounts).sort((a, b) => b[1] - a[1])[0]?.[0];
          const clusterColor = getAncestorColor(dominantSurname);
          const sz = hasSelected ? 46 : count >= 10 ? 40 : 36;
          const cFontSize = count >= 100 ? 11 : count >= 10 ? 13 : 15;

          // Outer ring — lighter translucent version of the same color for depth
          const ringStyle = hasSelected
            ? `box-shadow:0 0 0 4px rgba(255,255,255,0.15),0 0 16px rgba(255,255,255,0.12),0 2px 10px rgba(0,0,0,0.5);`
            : `box-shadow:0 0 0 3px rgba(255,255,255,0.12),0 2px 7px rgba(0,0,0,0.45);`;

          // Show first-letter initials of all unique surnames as a sub-label
          const uniqueSurnames = [...new Set(cluster.members.map(m => m.ancestor.lastName).filter(Boolean))];
          const surnameHint = uniqueSurnames.slice(0, 3).map(s => s![0]).join(" ");

          const clusterIcon = L.divIcon({
            className: "",
            html: `<div style="
              width:${sz}px;height:${sz}px;border-radius:50%;
              background:${clusterColor};
              border:2.5px solid rgba(255,255,255,0.85);
              ${ringStyle}
              display:flex;flex-direction:column;align-items:center;justify-content:center;
              color:#fff;
              font-family:system-ui,-apple-system,sans-serif;
              cursor:pointer;
            ">
              <span style="font-size:${cFontSize}px;font-weight:700;line-height:1;">${count}</span>
              ${surnameHint ? `<span style="font-size:7px;opacity:0.75;letter-spacing:0.5px;margin-top:1px;">${surnameHint}</span>` : ""}
            </div>`,
            iconSize: [sz, sz],
            iconAnchor: [sz / 2, sz / 2],
          });

          const names = cluster.members.map(m => m.ancestor.fullName);
          const displayNames = names.slice(0, 4).join(", ") + (names.length > 4 ? ` +${names.length - 4} more` : "");

          return (
            <Marker
              key={`cluster-${ci}`}
              position={cluster.centroid}
              icon={clusterIcon}
              eventHandlers={{ click: () => onSelectPerson(cluster.members[0].ancestor.id) }}
            >
              <Tooltip direction="top" offset={[0, -(sz / 2 + 4)]} opacity={1}>
                <div style={{ minWidth: 180 }}>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{count} ancestors in this area</div>
                  <div style={{ fontSize: 11, color: "#aaa", marginTop: 3, lineHeight: 1.5 }}>{displayNames}</div>
                  {cluster.hasVerified && (
                    <div style={{ fontSize: 10, color: "#5b9bdc", marginTop: 3 }}>✓ Includes verified record locations</div>
                  )}
                  <div style={{ fontSize: 10, color: "#666", marginTop: 3 }}>Click to select · scroll map to explore</div>
                </div>
              </Tooltip>
            </Marker>
          );
        })}

      </MapContainer>

      {/* ── Persistent Map Legend — always visible, bottom-right of the map canvas ──
          Positioned as a sibling of MapContainer (not inside it) to avoid
          Leaflet z-index interference. Uses z-[1000] to clear all Leaflet panes.
      ── */}
      <div
        className="absolute bottom-10 right-2 bg-background/95 border border-border/70 rounded-lg shadow-lg text-xs space-y-1.5 pointer-events-none select-none"
        style={{ zIndex: 1000, padding: "8px 10px", minWidth: 170, maxWidth: 210 }}
      >
        <p className="font-mono font-semibold text-[9px] uppercase tracking-widest text-muted-foreground mb-1.5">Map Legend</p>

        {/* Severity markers — always shown */}
        <div className="space-y-1">
          <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/50 mb-0.5">Event Severity</p>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-[#a64115] border border-white shadow-sm flex-shrink-0" />
            <span className="text-muted-foreground leading-tight">Critical</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-[#c29b40] border border-white shadow-sm flex-shrink-0" />
            <span className="text-muted-foreground leading-tight">High</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-[#5c744c] border border-white shadow-sm flex-shrink-0" />
            <span className="text-muted-foreground leading-tight">Moderate</span>
          </div>
        </div>

        {/* Treaty marker */}
        {activeLayers.treaties && (
          <div className="flex items-center gap-2 pt-0.5">
            <svg width="14" height="14" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg" className="flex-shrink-0">
              <polygon points="10,1 19,10 10,19 1,10" fill="#4a3080" stroke="white" strokeWidth="2"/>
              <text x="10" y="14" textAnchor="middle" fontSize="9" fill="white" fontFamily="serif" fontWeight="bold">T</text>
            </svg>
            <span className="text-muted-foreground leading-tight">Treaty</span>
          </div>
        )}

        {/* Territorial markers */}
        {activeLayers.tribalTerritories && (
          <div className="flex items-center gap-2 pt-0.5">
            <svg width="18" height="12" viewBox="0 0 18 12" fill="none" xmlns="http://www.w3.org/2000/svg" className="flex-shrink-0">
              <polygon points="9,1 17,5 14,11 4,11 1,5" fill="rgba(196,168,112,0.28)" stroke="#8a7050" strokeWidth="1.5"/>
            </svg>
            <span className="text-muted-foreground leading-tight">Tribal Territory</span>
          </div>
        )}
        {activeLayers.migrationPaths && (
          <div className="flex items-center gap-2">
            <div className="w-5 h-0.5 flex-shrink-0" style={{ borderTop: "2px dashed #8a4b38", opacity: 0.7 }} />
            <span className="text-muted-foreground leading-tight">Removal Route</span>
          </div>
        )}

        {/* Atlas Mode ancestor markers */}
        {atlasMode && activeLayers.ancestorLocations && (
          <div className="space-y-1.5 pt-0.5">
            <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/50 mb-0.5">Family</p>
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center text-[8px] font-bold text-white" style={{ background: "#8b2020", border: "2px solid rgba(255,255,255,0.85)" }}>JM</div>
              <span className="text-muted-foreground leading-tight">Ancestor (initials)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center text-[8px] font-bold text-white" style={{ background: "#8b2020", border: "2px dashed rgba(255,255,255,0.55)", opacity: 0.82 }}>JM</div>
              <span className="text-muted-foreground leading-tight">Location inferred</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center text-[8px] font-bold text-white" style={{ background: "#8b2020", border: "2px solid rgba(255,255,255,0.85)" }}>5</div>
              <span className="text-muted-foreground leading-tight">Cluster (count)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-0.5 flex-shrink-0" style={{ borderTop: "1.5px dashed #8a7050", opacity: 0.55 }} />
              <span className="text-muted-foreground leading-tight">Migration arc</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
