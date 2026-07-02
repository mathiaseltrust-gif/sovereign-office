export type ParsedPlace = {
  placeNormalized: string | null;
  county: string | null;
  state: string | null;
  country: string | null;
};

// TODO: Add a dry-run/backfill command that persists these inferred fields to
// ancestor_life_events after review. For now this is response-only enrichment.

const US_STATES: Record<string, string> = {
  al: "Alabama", alabama: "Alabama",
  ak: "Alaska", alaska: "Alaska",
  az: "Arizona", arizona: "Arizona",
  ar: "Arkansas", arkansas: "Arkansas",
  ca: "California", california: "California",
  co: "Colorado", colorado: "Colorado",
  ct: "Connecticut", connecticut: "Connecticut",
  de: "Delaware", delaware: "Delaware",
  fl: "Florida", florida: "Florida",
  ga: "Georgia", georgia: "Georgia",
  hi: "Hawaii", hawaii: "Hawaii",
  id: "Idaho", idaho: "Idaho",
  il: "Illinois", illinois: "Illinois",
  in: "Indiana", indiana: "Indiana",
  ia: "Iowa", iowa: "Iowa",
  ks: "Kansas", kansas: "Kansas",
  ky: "Kentucky", kentucky: "Kentucky",
  la: "Louisiana", louisiana: "Louisiana",
  me: "Maine", maine: "Maine",
  md: "Maryland", maryland: "Maryland",
  ma: "Massachusetts", massachusetts: "Massachusetts",
  mi: "Michigan", michigan: "Michigan",
  mn: "Minnesota", minnesota: "Minnesota",
  ms: "Mississippi", mississippi: "Mississippi",
  mo: "Missouri", missouri: "Missouri",
  mt: "Montana", montana: "Montana",
  ne: "Nebraska", nebraska: "Nebraska",
  nv: "Nevada", nevada: "Nevada",
  nh: "New Hampshire", "new hampshire": "New Hampshire",
  nj: "New Jersey", "new jersey": "New Jersey",
  nm: "New Mexico", "new mexico": "New Mexico",
  ny: "New York", "new york": "New York",
  nc: "North Carolina", "north carolina": "North Carolina",
  nd: "North Dakota", "north dakota": "North Dakota",
  oh: "Ohio", ohio: "Ohio",
  ok: "Oklahoma", oklahoma: "Oklahoma",
  or: "Oregon", oregon: "Oregon",
  pa: "Pennsylvania", pennsylvania: "Pennsylvania",
  ri: "Rhode Island", "rhode island": "Rhode Island",
  sc: "South Carolina", "south carolina": "South Carolina",
  sd: "South Dakota", "south dakota": "South Dakota",
  tn: "Tennessee", tennessee: "Tennessee",
  tx: "Texas", texas: "Texas",
  ut: "Utah", utah: "Utah",
  vt: "Vermont", vermont: "Vermont",
  va: "Virginia", virginia: "Virginia",
  wa: "Washington", washington: "Washington",
  wv: "West Virginia", "west virginia": "West Virginia",
  wi: "Wisconsin", wisconsin: "Wisconsin",
  wy: "Wyoming", wyoming: "Wyoming",
  dc: "District of Columbia", "district of columbia": "District of Columbia",
};

const COUNTRY_ALIASES: Record<string, string> = {
  usa: "United States",
  "u.s.a.": "United States",
  us: "United States",
  "u.s.": "United States",
  "united states": "United States",
  "united states of america": "United States",
  uk: "United Kingdom",
  "u.k.": "United Kingdom",
  "united kingdom": "United Kingdom",
  england: "England",
  scotland: "Scotland",
  wales: "Wales",
  ireland: "Ireland",
};

function cleanPart(value: string): string {
  return value.trim().replace(/\s+/g, " ").replace(/\.$/, "");
}

function normalizeCounty(value: string | null): string | null {
  if (!value) return null;
  const cleaned = cleanPart(value).replace(/\s+county$/i, "").trim();
  return cleaned || null;
}

function normalizeCountry(value: string | null): string | null {
  if (!value) return null;
  return COUNTRY_ALIASES[cleanPart(value).toLowerCase()] ?? cleanPart(value);
}

function normalizeState(value: string | null): string | null {
  if (!value) return null;
  return US_STATES[cleanPart(value).toLowerCase()] ?? null;
}

function isCountry(value: string | null): boolean {
  if (!value) return false;
  return Boolean(COUNTRY_ALIASES[cleanPart(value).toLowerCase()]);
}

export function parsePlaceString(place: string | null | undefined): ParsedPlace {
  if (!place?.trim()) return { placeNormalized: null, county: null, state: null, country: null };
  const parts = place.split(",").map(cleanPart).filter(Boolean);
  if (parts.length === 0) return { placeNormalized: place.trim(), county: null, state: null, country: null };

  let country: string | null = null;
  let state: string | null = null;
  let county: string | null = null;

  const last = parts[parts.length - 1] ?? null;
  const lastCountry = normalizeCountry(last);
  if (last && isCountry(last)) {
    country = lastCountry;
    parts.pop();
  }

  const maybeState = parts[parts.length - 1] ?? null;
  const usState = normalizeState(maybeState);
  if (usState) {
    state = usState;
    country ??= "United States";
    parts.pop();
  } else if (!country && maybeState && isCountry(maybeState)) {
    country = normalizeCountry(maybeState);
    parts.pop();
  } else if (country && ["England", "Scotland", "Wales", "Ireland", "United Kingdom"].includes(country)) {
    state = null;
  }

  if (country === "United Kingdom" && parts.length > 0) {
    const nation = normalizeCountry(parts[parts.length - 1]);
    if (nation && ["England", "Scotland", "Wales", "Ireland"].includes(nation)) {
      country = nation;
      parts.pop();
    }
  }

  const countyCandidate = parts.length >= 2
    ? parts[parts.length - 1]
    : parts.length === 1 && (/county$/i.test(parts[0]) || (country !== "United States" && !state))
      ? parts[0]
      : null;
  if (countyCandidate) county = normalizeCounty(countyCandidate);

  if (!country && state) country = "United States";
  if (!country && parts.length === 1 && isCountry(parts[0])) country = normalizeCountry(parts[0]);

  const normalizedParts = [county, state, country].filter(Boolean);
  const placeNormalized = normalizedParts.length > 0 ? normalizedParts.join(", ") : place.trim();
  return { placeNormalized, county, state, country };
}

export function enrichLifeEventPlace<T extends {
  event_place?: string | null;
  eventPlace?: string | null;
  place_normalized?: string | null;
  placeNormalized?: string | null;
  county?: string | null;
  state?: string | null;
  country?: string | null;
}>(event: T): T {
  const rawPlace = event.event_place ?? event.eventPlace ?? null;
  const parsed = parsePlaceString(rawPlace);
  return {
    ...event,
    place_normalized: event.place_normalized ?? parsed.placeNormalized,
    placeNormalized: event.placeNormalized ?? parsed.placeNormalized,
    county: event.county ?? parsed.county,
    state: event.state ?? parsed.state,
    country: event.country ?? parsed.country,
  };
}
