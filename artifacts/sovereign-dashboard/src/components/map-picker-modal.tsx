import { useState, useEffect, useCallback, useRef } from "react";
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Button } from "@/components/ui/button";
import { MapPin, Search, X, CheckCircle2, Loader2 } from "lucide-react";

const pickerIcon = L.divIcon({
  className: "",
  html: `<div style="width:22px;height:22px;border-radius:50%;background:#b45309;border:3px solid #fff;box-shadow:0 2px 8px rgba(180,83,9,0.7);"></div>`,
  iconSize: [22, 22],
  iconAnchor: [11, 11],
});

interface MapClickHandlerProps {
  onPick: (lat: number, lng: number) => void;
}

function MapClickHandler({ onPick }: MapClickHandlerProps) {
  useMapEvents({
    click(e) {
      onPick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

interface FlyToProps {
  lat: number;
  lng: number;
  zoom?: number;
}

function FlyTo({ lat, lng, zoom = 13 }: FlyToProps) {
  const map = useMap();
  useEffect(() => {
    map.flyTo([lat, lng], zoom, { duration: 1.2 });
  }, [lat, lng, zoom, map]);
  return null;
}

interface GeoSearchResult {
  display_name: string;
  lat: string;
  lon: string;
  address?: {
    county?: string;
    city?: string;
    town?: string;
    village?: string;
    state?: string;
    country?: string;
  };
}

interface ReverseGeoResult {
  display_name: string;
  address?: {
    county?: string;
    city?: string;
    town?: string;
    village?: string;
    state?: string;
    country?: string;
  };
}

function buildShortAddress(addr?: ReverseGeoResult["address"], displayName?: string): string {
  if (!addr) return displayName ?? "";
  const city = addr.city ?? addr.town ?? addr.village;
  const county = addr.county;
  const state = addr.state;
  const parts: string[] = [];
  if (city) parts.push(city);
  if (county && county !== city) parts.push(county);
  if (state) parts.push(state);
  if (parts.length > 0) return parts.join(", ");
  return displayName ?? "";
}

interface MapPickerModalProps {
  initialLat: number | null;
  initialLng: number | null;
  initialAddress?: string | null;
  onConfirm: (lat: number, lng: number, address: string) => void;
  onCancel: () => void;
}

export function MapPickerModal({ initialLat, initialLng, initialAddress, onConfirm, onCancel }: MapPickerModalProps) {
  const defaultLat = initialLat ?? 36.5;
  const defaultLng = initialLng ?? -95.5;
  const defaultZoom = initialLat != null ? 10 : 4;

  const [pickedLat, setPickedLat] = useState<number | null>(initialLat);
  const [pickedLng, setPickedLng] = useState<number | null>(initialLng);
  const [pickedAddress, setPickedAddress] = useState<string>(initialAddress ?? "");

  const [searchQuery, setSearchQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [geocoding, setGeocoding] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [flyTarget, setFlyTarget] = useState<{ lat: number; lng: number; zoom: number } | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const reverseGeocode = useCallback(async (lat: number, lng: number): Promise<string> => {
    try {
      const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&addressdetails=1`;
      const res = await fetch(url, { headers: { "Accept-Language": "en" } });
      if (!res.ok) return "";
      const data = (await res.json()) as ReverseGeoResult;
      return buildShortAddress(data.address, data.display_name);
    } catch {
      return "";
    }
  }, []);

  const handlePick = useCallback(async (lat: number, lng: number) => {
    const roundedLat = parseFloat(lat.toFixed(6));
    const roundedLng = parseFloat(lng.toFixed(6));
    setPickedLat(roundedLat);
    setPickedLng(roundedLng);
    setPickedAddress("");
    setFlyTarget(null);
    setGeocoding(true);
    const addr = await reverseGeocode(roundedLat, roundedLng);
    setPickedAddress(addr);
    setGeocoding(false);
  }, [reverseGeocode]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const q = searchQuery.trim();
    if (!q) return;
    setSearching(true);
    setSearchError(null);
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(q)}&addressdetails=1`;
      const res = await fetch(url, { headers: { "Accept-Language": "en" } });
      if (!res.ok) throw new Error("Search request failed");
      const data = (await res.json()) as GeoSearchResult[];
      if (!data.length) {
        setSearchError("No location found. Try a different name.");
        return;
      }
      const { lat, lon, address, display_name } = data[0];
      const parsedLat = parseFloat(lat);
      const parsedLng = parseFloat(lon);
      setFlyTarget({ lat: parsedLat, lng: parsedLng, zoom: 13 });
      setPickedLat(parseFloat(parsedLat.toFixed(6)));
      setPickedLng(parseFloat(parsedLng.toFixed(6)));
      setPickedAddress(buildShortAddress(address, display_name));
    } catch {
      setSearchError("Search failed. Check your connection.");
    } finally {
      setSearching(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <div className="bg-background rounded-xl shadow-2xl border border-border w-full max-w-2xl flex flex-col overflow-hidden"
           style={{ maxHeight: "min(90vh, 640px)" }}>

        <div className="flex items-center justify-between px-5 py-3.5 border-b border-border bg-amber-50 dark:bg-amber-950/20">
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-amber-700 dark:text-amber-400" />
            <span className="text-sm font-semibold text-amber-900 dark:text-amber-300">Pin Homeland Location</span>
          </div>
          <button
            onClick={onCancel}
            className="rounded-md p-1 hover:bg-amber-100 dark:hover:bg-amber-900/30 text-muted-foreground transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="px-4 pt-3 pb-2">
          <form onSubmit={handleSearch} className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setSearchError(null); }}
                placeholder='Search a place, e.g. "Montgomery, Alabama" or "Comanche County, Oklahoma"'
                className="w-full h-8 pl-8 pr-3 text-sm rounded-md border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <Button type="submit" size="sm" variant="outline" className="h-8 text-xs gap-1 shrink-0" disabled={searching}>
              {searching ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />}
              Go
            </Button>
          </form>
          {searchError && (
            <p className="text-xs text-destructive mt-1">{searchError}</p>
          )}
        </div>

        <div className="relative flex-1 min-h-0" style={{ height: "340px" }}>
          <MapContainer
            center={[defaultLat, defaultLng]}
            zoom={defaultZoom}
            style={{ height: "100%", width: "100%", cursor: "crosshair" }}
            zoomControl={true}
          >
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            />
            <MapClickHandler onPick={handlePick} />
            {flyTarget && <FlyTo lat={flyTarget.lat} lng={flyTarget.lng} zoom={flyTarget.zoom} />}
            {pickedLat != null && pickedLng != null && (
              <Marker position={[pickedLat, pickedLng]} icon={pickerIcon} />
            )}
          </MapContainer>
          <div className="absolute bottom-2 left-2 z-[1000] bg-background/90 backdrop-blur-sm text-xs px-2 py-1 rounded border border-border text-muted-foreground pointer-events-none">
            Click the map to drop a pin
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 px-5 py-3.5 border-t border-border">
          <div className="min-w-0 flex-1">
            {pickedLat != null && pickedLng != null ? (
              <div className="space-y-0.5">
                {geocoding ? (
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Loader2 className="h-3 w-3 animate-spin" /> Looking up address…
                  </span>
                ) : pickedAddress ? (
                  <p className="text-xs font-medium text-foreground truncate">{pickedAddress}</p>
                ) : null}
                <p className="text-[10px] font-mono text-muted-foreground">
                  {pickedLat.toFixed(5)}, {pickedLng.toFixed(5)}
                </p>
              </div>
            ) : (
              <span className="text-xs text-muted-foreground italic">No location selected</span>
            )}
          </div>
          <div className="flex gap-2 shrink-0">
            <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={onCancel}>
              Cancel
            </Button>
            <Button
              size="sm"
              className="h-8 text-xs gap-1 bg-amber-700 hover:bg-amber-800 text-white"
              onClick={() => pickedLat != null && pickedLng != null && onConfirm(pickedLat, pickedLng, pickedAddress)}
              disabled={pickedLat == null || pickedLng == null || geocoding}
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              Save Location
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
