import { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, CircleMarker, Polyline, Tooltip } from "react-leaflet";
import L from "leaflet";
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";
import { AtlasEvent } from "@/pages/atlas";

// Fix leaflet default icon issue in Vite
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({ 
  iconUrl: markerIcon, 
  iconRetinaUrl: markerIcon2x, 
  shadowUrl: markerShadow 
});

interface AtlasMapProps {
  events: AtlasEvent[];
  filteredEvents: AtlasEvent[];
  selectedEventId: string | null;
  onSelectEvent: (id: string) => void;
  urbanLocations: any;
}

const severityColors = {
  critical: "#a64115", // deep copper/rust
  high: "#c29b40",     // muted gold
  moderate: "#5c744c"  // sage green
};

const severityRadius = {
  critical: 12,
  high: 9,
  moderate: 7
};

export function AtlasMap({ events, filteredEvents, selectedEventId, onSelectEvent, urbanLocations }: AtlasMapProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  const isEventFilteredOut = (evtId: string) => !filteredEvents.find(e => e.id === evtId);

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

        {/* Removal Routes */}
        {urbanLocations.keyRemovalRoutes?.map((route: any, i: number) => (
          <Polyline 
            key={i} 
            positions={route.coordinates} 
            pathOptions={{ color: "#8a4b38", weight: 2, dashArray: "5, 10", opacity: 0.6 }} 
          >
            <Tooltip sticky>{route.name} ({route.nation})</Tooltip>
          </Polyline>
        ))}

        {/* Relocation Cities */}
        {urbanLocations.relocationCities?.map((city: any, i: number) => (
          <CircleMarker
            key={`city-${i}`}
            center={city.coordinates}
            pathOptions={{ color: "#3f4650", weight: 2, fill: false, opacity: 0.7 }}
            radius={14}
          >
            <Tooltip>{city.city}, {city.state} - Relocation City</Tooltip>
          </CircleMarker>
        ))}

        {/* Health Orgs */}
        {urbanLocations.urbanIndianHealthOrgs?.map((org: any, i: number) => (
          <CircleMarker
            key={`org-${i}`}
            center={org.coordinates}
            pathOptions={{ color: "#5c744c", weight: 1, fillColor: "#5c744c", fillOpacity: 0.8 }}
            radius={4}
          >
            <Tooltip>{org.name}</Tooltip>
          </CircleMarker>
        ))}

        {/* Events */}
        {events.map((evt) => {
          const isFilteredOut = isEventFilteredOut(evt.id);
          const isSelected = evt.id === selectedEventId;
          
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
                opacity: isFilteredOut ? 0.2 : 1
              }}
              eventHandlers={{
                click: () => onSelectEvent(evt.id)
              }}
            >
              <Tooltip direction="top" offset={[0, -10]} opacity={1}>
                <div className="font-serif font-medium">{evt.title}</div>
                <div className="text-xs text-muted-foreground">{evt.year} • {evt.event_type}</div>
              </Tooltip>
            </CircleMarker>
          );
        })}
      </MapContainer>
    </div>
  );
}
