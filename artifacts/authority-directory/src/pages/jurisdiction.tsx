import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Building2, Globe, Search, Phone, Mail, ExternalLink, MapPin, ChevronDown } from "lucide-react";
import { api, Agency } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

const GOVT_LEVELS = [
  { value: "", label: "All Levels" },
  { value: "federal", label: "Federal" },
  { value: "state", label: "State" },
  { value: "county", label: "County" },
  { value: "tribal", label: "Tribal" },
  { value: "local", label: "Local" },
];

const LEVEL_COLORS: Record<string, string> = {
  federal: "bg-blue-100 text-blue-800 border-blue-200",
  state: "bg-purple-100 text-purple-800 border-purple-200",
  county: "bg-orange-100 text-orange-800 border-orange-200",
  tribal: "bg-amber-100 text-amber-800 border-amber-200",
  local: "bg-emerald-100 text-emerald-800 border-emerald-200",
};

function AgencyCard({ agency }: { agency: Agency }) {
  const [expanded, setExpanded] = useState(false);
  const levelColor = LEVEL_COLORS[agency.govtLevel] ?? "bg-muted text-muted-foreground";

  return (
    <div className="bg-card border border-card-border rounded-lg overflow-hidden shadow-xs">
      <button
        className="w-full text-left px-4 py-3.5 flex items-start gap-3 hover:bg-muted/30 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="h-9 w-9 rounded-md bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
          <Building2 className="h-4.5 w-4.5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-0.5">
            <span className="font-medium text-foreground text-sm leading-snug">{agency.name}</span>
            {agency.acronym && (
              <span className="text-xs text-muted-foreground">({agency.acronym})</span>
            )}
          </div>
          <div className="flex flex-wrap gap-1.5 mt-1">
            <span className={cn("text-xs px-1.5 py-0.5 rounded border font-medium", levelColor)}>
              {agency.govtLevel.toUpperCase()}
            </span>
            {agency.stateCode && (
              <span className="text-xs px-1.5 py-0.5 rounded border bg-muted text-muted-foreground">
                {agency.stateCode}
                {agency.county ? ` · ${agency.county}` : ""}
              </span>
            )}
          </div>
        </div>
        <ChevronDown
          className={cn("h-4 w-4 text-muted-foreground shrink-0 mt-1 transition-transform", expanded && "rotate-180")}
        />
      </button>

      {expanded && (
        <div className="px-4 pb-4 pt-1 border-t border-border space-y-3">
          {/* Contact info */}
          {(agency.phone || agency.email || agency.website || agency.address) && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {agency.phone && (
                <a href={`tel:${agency.phone}`} className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground">
                  <Phone className="h-3.5 w-3.5 shrink-0" /> {agency.phone}
                </a>
              )}
              {agency.email && (
                <a href={`mailto:${agency.email}`} className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground">
                  <Mail className="h-3.5 w-3.5 shrink-0" /> {agency.email}
                </a>
              )}
              {agency.website && (
                <a href={agency.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-xs text-primary hover:underline">
                  <ExternalLink className="h-3.5 w-3.5 shrink-0" /> Website
                </a>
              )}
              {agency.address && (
                <div className="flex items-start gap-2 text-xs text-muted-foreground">
                  <MapPin className="h-3.5 w-3.5 shrink-0 mt-0.5" /> {agency.address}
                </div>
              )}
            </div>
          )}

          {/* Services */}
          {agency.services?.length > 0 && (
            <div>
              <p className="text-xs font-medium text-foreground mb-1.5">Services</p>
              <div className="flex flex-wrap gap-1">
                {agency.services.map((s) => (
                  <Badge key={s} variant="secondary" className="text-xs">{s}</Badge>
                ))}
              </div>
            </div>
          )}

          {/* Matter types */}
          {agency.matterTypes?.length > 0 && (
            <div>
              <p className="text-xs font-medium text-foreground mb-1.5">Handles Matter Types</p>
              <div className="flex flex-wrap gap-1">
                {agency.matterTypes.map((m) => (
                  <Badge key={m} variant="outline" className="text-xs font-mono">{m}</Badge>
                ))}
              </div>
            </div>
          )}

          {/* Notes */}
          {agency.notes && (
            <p className="text-xs text-muted-foreground italic border-l-2 border-primary/30 pl-2.5 py-0.5">
              {agency.notes}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export default function JurisdictionPage() {
  const [govtLevel, setGovtLevel] = useState(() => sessionStorage.getItem("ad_level") ?? "");
  const [stateCode, setStateCode] = useState(() => sessionStorage.getItem("ad_state") ?? "");
  const [county, setCounty] = useState(() => sessionStorage.getItem("ad_county") ?? "");
  const [search, setSearch] = useState("");

  useEffect(() => { sessionStorage.setItem("ad_level", govtLevel); }, [govtLevel]);
  useEffect(() => { sessionStorage.setItem("ad_state", stateCode); }, [stateCode]);
  useEffect(() => { sessionStorage.setItem("ad_county", county); }, [county]);

  const { data: jurisdiction } = useQuery({
    queryKey: ["jurisdiction"],
    queryFn: () => api.getJurisdiction(),
  });

  const { data: agencies, isLoading, error } = useQuery({
    queryKey: ["agencies", govtLevel, stateCode, county, search],
    queryFn: () => api.getAgencies({ govtLevel, stateCode, county, q: search }),
    placeholderData: (prev) => prev,
  });

  const states = jurisdiction?.states ?? [];
  const counties = (jurisdiction?.counties ?? []).filter(
    (c) => !stateCode || c.stateCode === stateCode
  );

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <Globe className="h-5 w-5 text-primary" />
          <h1 className="text-xl font-semibold text-foreground">Jurisdiction & Agency Lookup</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Browse and filter government agencies by jurisdiction level, state, and county.
        </p>
      </div>

      {/* Filters */}
      <div className="bg-card border border-card-border rounded-lg p-4 mb-5 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Level */}
          <div>
            <label className="block text-xs font-medium text-foreground mb-1">Government Level</label>
            <select
              className="w-full text-sm rounded-md border border-input bg-background px-3 py-2 text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              value={govtLevel}
              onChange={(e) => {
                setGovtLevel(e.target.value);
                if (e.target.value === "federal") { setStateCode(""); setCounty(""); }
              }}
            >
              {GOVT_LEVELS.map((l) => (
                <option key={l.value} value={l.value}>{l.label}</option>
              ))}
            </select>
          </div>

          {/* State */}
          <div>
            <label className="block text-xs font-medium text-foreground mb-1">State</label>
            <select
              className="w-full text-sm rounded-md border border-input bg-background px-3 py-2 text-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50"
              value={stateCode}
              onChange={(e) => { setStateCode(e.target.value); setCounty(""); }}
              disabled={govtLevel === "federal"}
            >
              <option value="">All States</option>
              {states.map((s) => (
                <option key={s.code} value={s.code}>{s.name} ({s.code})</option>
              ))}
            </select>
          </div>

          {/* County */}
          <div>
            <label className="block text-xs font-medium text-foreground mb-1">County</label>
            <select
              className="w-full text-sm rounded-md border border-input bg-background px-3 py-2 text-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50"
              value={county}
              onChange={(e) => setCounty(e.target.value)}
              disabled={!stateCode || govtLevel === "federal"}
            >
              <option value="">All Counties</option>
              {counties.map((c) => (
                <option key={c.name} value={c.name}>{c.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            type="search"
            placeholder="Search by name, acronym, or service…"
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Results */}
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-16 rounded-lg bg-muted animate-pulse" />
          ))}
        </div>
      ) : error ? (
        <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 text-sm text-destructive">
          Failed to load agencies. Please check your connection and try again.
        </div>
      ) : agencies?.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Building2 className="mx-auto h-8 w-8 mb-2 opacity-40" />
          <p className="text-sm">No agencies found matching your filters.</p>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground mb-3">
            {agencies?.length ?? 0} agenc{agencies?.length === 1 ? "y" : "ies"} found
          </p>
          {agencies?.map((agency) => (
            <AgencyCard key={agency.id} agency={agency} />
          ))}
        </div>
      )}
    </div>
  );
}
