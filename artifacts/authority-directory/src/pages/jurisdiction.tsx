import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Building2, Globe, Search, Phone, Mail, ExternalLink,
  MapPin, ChevronDown, ShieldCheck, AlertCircle, Calendar,
} from "lucide-react";
import { api, Agency, JurisdictionRow, ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { SessionExpiredBanner } from "@/App";

const GOVT_LEVELS = [
  { value: "federal", label: "Federal" },
  { value: "state", label: "State" },
  { value: "county", label: "County" },
  { value: "city", label: "City" },
  { value: "tribal", label: "Tribal" },
  { value: "local", label: "Local" },
  { value: "private_contractor", label: "Private Contractor" },
];

const LEVEL_COLORS: Record<string, string> = {
  federal: "bg-blue-100 text-blue-800 border-blue-200",
  state: "bg-purple-100 text-purple-800 border-purple-200",
  county: "bg-orange-100 text-orange-800 border-orange-200",
  city: "bg-sky-100 text-sky-800 border-sky-200",
  tribal: "bg-amber-100 text-amber-800 border-amber-200",
  local: "bg-emerald-100 text-emerald-800 border-emerald-200",
  private_contractor: "bg-rose-100 text-rose-800 border-rose-200",
};

interface AgencyCardProps {
  agency: Agency;
  isTribalJurisdiction: boolean;
}

function AgencyCard({ agency, isTribalJurisdiction }: AgencyCardProps) {
  const [expanded, setExpanded] = useState(false);
  const levelKey = agency.governmentLevel?.toLowerCase() ?? "";
  const levelColor = LEVEL_COLORS[levelKey] ?? "bg-muted text-muted-foreground border-muted";

  const verifiedStr = agency.lastVerifiedDate
    ? new Date(agency.lastVerifiedDate).toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : null;

  return (
    <div className={cn(
      "bg-card border rounded-lg overflow-hidden shadow-xs",
      isTribalJurisdiction ? "border-amber-300" : "border-card-border"
    )}>
      <button
        className="w-full text-left px-4 py-3.5 flex items-start gap-3 hover:bg-muted/30 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="h-9 w-9 rounded-md bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
          <Building2 className="h-4 w-4 text-primary" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <span className="font-medium text-foreground text-sm leading-snug">
              {agency.agencyName}
            </span>
            {isTribalJurisdiction && (
              <span className="inline-flex items-center gap-0.5 text-xs px-1.5 py-0.5 rounded border border-amber-300 bg-amber-50 text-amber-800 font-medium shrink-0">
                <ShieldCheck className="h-3 w-3" /> Tribal Land
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-1.5 items-center">
            <span className={cn("text-xs px-1.5 py-0.5 rounded border font-medium", levelColor)}>
              {agency.governmentLevel.replace(/_/g, " ").toUpperCase()}
            </span>
            {agency.agencyType && (
              <span className="text-xs px-1.5 py-0.5 rounded border bg-muted text-muted-foreground">
                {agency.agencyType}
              </span>
            )}
            {agency.stateCode && (
              <span className="text-xs px-1.5 py-0.5 rounded border bg-muted text-muted-foreground">
                {agency.stateCode}
                {agency.county ? ` · ${agency.county}` : ""}
                {agency.city ? ` · ${agency.city}` : ""}
              </span>
            )}
            {verifiedStr && (
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Calendar className="h-3 w-3" /> Verified {verifiedStr}
              </span>
            )}
          </div>
        </div>

        <ChevronDown
          className={cn(
            "h-4 w-4 text-muted-foreground shrink-0 mt-1 transition-transform",
            expanded && "rotate-180"
          )}
        />
      </button>

      {/* Always-visible contact fields */}
      {(agency.phone || agency.contactEmail || agency.website || agency.mailingAddress || agency.physicalAddress) && (
        <div className="px-4 pb-3 flex flex-wrap gap-x-4 gap-y-1">
          {agency.phone && (
            <a href={`tel:${agency.phone}`} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
              <Phone className="h-3 w-3 shrink-0" /> {agency.phone}
            </a>
          )}
          {agency.contactEmail && (
            <a href={`mailto:${agency.contactEmail}`} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
              <Mail className="h-3 w-3 shrink-0" /> {agency.contactEmail}
            </a>
          )}
          {agency.website && (
            <a href={agency.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-xs text-primary hover:underline">
              <ExternalLink className="h-3 w-3 shrink-0" /> Website
            </a>
          )}
          {(agency.mailingAddress || agency.physicalAddress) && (
            <span className="flex items-start gap-1.5 text-xs text-muted-foreground">
              <MapPin className="h-3 w-3 shrink-0 mt-0.5" />
              {agency.mailingAddress ?? agency.physicalAddress}
            </span>
          )}
        </div>
      )}

      {/* Expandable: parent/oversight agencies */}
      {(agency.parentAgency || agency.oversightAgency) && (
        <>
          {expanded && (
            <div className="px-4 pb-4 pt-2 border-t border-border grid grid-cols-1 sm:grid-cols-2 gap-2">
              {agency.parentAgency && (
                <div>
                  <p className="text-xs font-medium text-foreground mb-0.5">Parent Agency</p>
                  <p className="text-xs text-muted-foreground">{agency.parentAgency}</p>
                </div>
              )}
              {agency.oversightAgency && (
                <div>
                  <p className="text-xs font-medium text-foreground mb-0.5">Oversight Agency</p>
                  <p className="text-xs text-muted-foreground">{agency.oversightAgency}</p>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default function JurisdictionPage() {
  const [level, setLevel] = useState(() => sessionStorage.getItem("ad_level") ?? "federal");
  const [state, setState] = useState(() => sessionStorage.getItem("ad_state") ?? "");
  const [county, setCounty] = useState(() => sessionStorage.getItem("ad_county") ?? "");
  const [search, setSearch] = useState("");

  useEffect(() => { sessionStorage.setItem("ad_level", level); }, [level]);
  useEffect(() => { sessionStorage.setItem("ad_state", state); }, [state]);
  useEffect(() => { sessionStorage.setItem("ad_county", county); }, [county]);

  const { data: statesData } = useQuery({
    queryKey: ["jurisdiction-states"],
    queryFn: () => api.getStates(),
  });

  const { data: countiesData } = useQuery({
    queryKey: ["jurisdiction-counties", state],
    queryFn: () => api.getCounties(state),
    enabled: !!state,
  });

  // Derive tribal-land signal from FIPS jurisdiction data (not agency type/level string)
  const isTribalJurisdiction = useMemo((): boolean => {
    if (!county || !countiesData?.results) return false;
    return countiesData.results.some(
      (r: JurisdictionRow) =>
        r.county?.toLowerCase() === county.toLowerCase() && r.tribalLandFlag
    );
  }, [county, countiesData]);

  const agencyParams = {
    level: level || undefined,
    state: state || undefined,
    county: county || undefined,
    q: search.trim() || undefined,
  };
  const hasFilter = !!(agencyParams.level || agencyParams.state || agencyParams.county || agencyParams.q);

  const { data: agenciesData, isLoading, error } = useQuery({
    queryKey: ["agencies", level, state, county, search],
    queryFn: () => api.getAgencies(agencyParams),
    enabled: hasFilter,
    placeholderData: (prev) => prev,
  });

  const states = statesData?.results ?? [];
  const counties = countiesData?.results ?? [];
  const agencies = agenciesData?.results ?? [];

  // List-level "data last verified" — most recent across all results
  const lastVerifiedStr = useMemo(() => {
    const dates = agencies
      .map((a) => a.lastVerifiedDate)
      .filter(Boolean)
      .map((d) => new Date(d!).getTime());
    if (dates.length === 0) return null;
    return new Date(Math.max(...dates)).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }, [agencies]);

  const is401 = (error as ApiError)?.status === 401;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <Globe className="h-5 w-5 text-primary" />
          <h1 className="text-xl font-semibold text-foreground">Jurisdiction & Agency Lookup</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Browse and filter government agencies by jurisdiction level, state, and county. Tribal-land badge reflects FIPS jurisdiction data.
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
              value={level}
              onChange={(e) => {
                setLevel(e.target.value);
                if (e.target.value === "federal") { setState(""); setCounty(""); }
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
              value={state}
              onChange={(e) => { setState(e.target.value); setCounty(""); }}
              disabled={level === "federal"}
            >
              <option value="">All States</option>
              {states.map((s) => (
                <option key={s.stateCode} value={s.stateCode}>
                  {s.stateName} ({s.stateCode})
                </option>
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
              disabled={!state}
            >
              <option value="">All Counties</option>
              {counties.map((c) => (
                <option key={c.id} value={c.county ?? ""}>{c.county}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            type="search"
            placeholder="Search by agency name, type, county…"
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {/* Tribal land jurisdiction banner */}
        {isTribalJurisdiction && (
          <div className="flex items-center gap-2 text-xs text-amber-800 bg-amber-50 border border-amber-300 rounded px-3 py-2">
            <ShieldCheck className="h-4 w-4 shrink-0" />
            <span>
              <strong>Tribal land jurisdiction</strong> — selected county is designated tribal land per FIPS jurisdiction data.
            </span>
          </div>
        )}
      </div>

      {/* Results */}
      {is401 ? (
        <SessionExpiredBanner />
      ) : !hasFilter ? (
        <div className="text-center py-12 text-muted-foreground">
          <Building2 className="mx-auto h-8 w-8 mb-2 opacity-40" />
          <p className="text-sm">Select a government level or enter a search term to find agencies.</p>
        </div>
      ) : isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-16 rounded-lg bg-muted animate-pulse" />
          ))}
        </div>
      ) : error ? (
        <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 flex items-center gap-2 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          Failed to load agencies. {(error as Error).message}
        </div>
      ) : agencies.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Building2 className="mx-auto h-8 w-8 mb-2 opacity-40" />
          <p className="text-sm">No agencies found matching your filters.</p>
        </div>
      ) : (
        <>
          <p className="text-xs text-muted-foreground mb-3">
            {agenciesData?.count ?? agencies.length} agenc{agencies.length === 1 ? "y" : "ies"} found
          </p>
          <div className="space-y-2">
            {agencies.map((agency) => (
              <AgencyCard key={agency.id} agency={agency} isTribalJurisdiction={isTribalJurisdiction} />
            ))}
          </div>
          {/* List-level data last verified — most recent across all results */}
          {lastVerifiedStr && (
            <p className="text-xs text-muted-foreground mt-4 text-right flex items-center justify-end gap-1">
              <Calendar className="h-3.5 w-3.5" />
              Agency directory — most recent verification: <span className="font-medium text-foreground ml-1">{lastVerifiedStr}</span>
            </p>
          )}
        </>
      )}
    </div>
  );
}
