import type { AncestorRecord } from "@/pages/atlas";

export type AffiliationSignalConfidence = "low" | "moderate" | "high";

export interface AffiliationSignal {
  type: "territory_overlap" | "indian_territory_place" | "era_overlap" | "family_cluster";
  label: "Probable tribal affiliation signal";
  tribeOrTerritory: string;
  confidence: AffiliationSignalConfidence;
  basis: string[];
  warning: string;
}

const SIGNAL_WARNING = "Geography alone does not prove enrollment or confirmed tribal citizenship; this possible affiliation signal requires evidence review.";

type LifeEventLike = {
  eventType?: string | null;
  event_type?: string | null;
  eventDate?: string | null;
  event_date?: string | null;
  eventYear?: number | null;
  event_year?: number | null;
  eventPlace?: string | null;
  event_place?: string | null;
  placeNormalized?: string | null;
  place_normalized?: string | null;
  county?: string | null;
  state?: string | null;
  country?: string | null;
  sourceType?: string | null;
  source_type?: string | null;
  sourceReference?: string | null;
  source_reference?: string | null;
};

type AncestorWithEvents = AncestorRecord & { lifeEvents?: LifeEventLike[] | null };

const TERRITORY_KEYWORDS: { pattern: RegExp; territory: string }[] = [
  { pattern: /\bindian\s+territory\b/i, territory: "Indian Territory" },
  { pattern: /\bcherokee\b/i, territory: "Cherokee Nation / Indian Territory" },
  { pattern: /\bchoctaw\b/i, territory: "Choctaw Nation / Indian Territory" },
  { pattern: /\bchickasaw\b/i, territory: "Chickasaw Nation / Indian Territory" },
  { pattern: /\b(creek|muscogee)\b/i, territory: "Muscogee (Creek) Nation / Indian Territory" },
  { pattern: /\bseminole\b/i, territory: "Seminole Nation / Indian Territory" },
  { pattern: /\breservation\b/i, territory: "Reservation-adjacent or reservation place record" },
  { pattern: /\boklahoma\b/i, territory: "Oklahoma / former Indian Territory" },
];

function compact(values: Array<string | null | undefined>): string[] {
  return values.map((v) => v?.trim()).filter((v): v is string => Boolean(v));
}

function eventYear(ev: LifeEventLike): number | null {
  if (typeof ev.eventYear === "number") return ev.eventYear;
  if (typeof ev.event_year === "number") return ev.event_year;
  const date = ev.eventDate ?? ev.event_date;
  const match = date?.match(/\b(17|18|19|20)\d{2}\b/);
  return match ? Number(match[0]) : null;
}

function eventLabel(ev: LifeEventLike): string {
  return (ev.eventType ?? ev.event_type ?? "life event").replace(/_/g, " ");
}

function eventPlaces(ancestor: AncestorWithEvents): { place: string; label: string; year: number | null; source: string | null }[] {
  const direct = [
    { place: ancestor.birthPlace, label: "birth place", year: ancestor.birthYear, source: null },
    { place: ancestor.deathPlace, label: "death place", year: ancestor.deathYear, source: null },
    { place: ancestor.burialPlace, label: "burial place", year: ancestor.deathYear, source: null },
    { place: ancestor.locationAddress, label: "recorded location", year: null, source: null },
    { place: ancestor.locationText, label: "timeline location", year: null, source: null },
  ];
  const fromEvents = (ancestor.lifeEvents ?? []).flatMap((ev) => {
    const place = compact([ev.eventPlace ?? ev.event_place, ev.placeNormalized ?? ev.place_normalized, ev.county, ev.state, ev.country]).join(", ");
    if (!place) return [];
    const src = compact([ev.sourceType ?? ev.source_type, ev.sourceReference ?? ev.source_reference]).join(" · ") || null;
    return [{ place, label: eventLabel(ev), year: eventYear(ev), source: src }];
  });
  return [...direct, ...fromEvents].filter((r): r is { place: string; label: string; year: number | null; source: string | null } => Boolean(r.place));
}

function lifespanOverlap(ancestor: AncestorRecord, start: number, end: number): boolean {
  const birth = ancestor.birthYear ?? ancestor.deathYear ?? null;
  const death = ancestor.deathYear ?? ancestor.birthYear ?? null;
  if (birth === null && death === null) return false;
  const lifeStart = birth ?? start;
  const lifeEnd = death ?? end;
  return lifeStart <= end && lifeEnd >= start;
}

function isOklahomaPoint(ancestor: AncestorRecord): boolean {
  const lat = ancestor.locationLat;
  const lng = ancestor.locationLng;
  return typeof lat === "number" && typeof lng === "number" && lat >= 33.4 && lat <= 37.1 && lng >= -103.1 && lng <= -94.3;
}

function confidenceForBasis(count: number): AffiliationSignalConfidence {
  if (count >= 3) return "high";
  if (count >= 2) return "moderate";
  return "low";
}

function familyClusterBasis(ancestor: AncestorRecord, allAncestors: AncestorRecord[] | undefined): string | null {
  if (!allAncestors || !isOklahomaPoint(ancestor)) return null;
  const clustered = allAncestors.filter((other) => other.id !== ancestor.id && isOklahomaPoint(other));
  if (clustered.length < 2) return null;
  return `${clustered.length + 1} family members have mapped points in or near Oklahoma / former Indian Territory; this is a proximity signal only.`;
}

export function buildAffiliationSignals(ancestor: AncestorWithEvents, allAncestors?: AncestorRecord[]): AffiliationSignal[] {
  const signals: AffiliationSignal[] = [];
  const places = eventPlaces(ancestor);
  const matchedTerritories = new Map<string, string[]>();

  for (const record of places) {
    for (const rule of TERRITORY_KEYWORDS) {
      if (!rule.pattern.test(record.place)) continue;
      const timing = record.year ? ` in ${record.year}` : "";
      const source = record.source ? ` (${record.source})` : "";
      const basis = `${record.label} references ${record.place}${timing}${source}`;
      matchedTerritories.set(rule.territory, [...(matchedTerritories.get(rule.territory) ?? []), basis]);
    }
  }

  for (const [territory, basis] of matchedTerritories) {
    const enrichedBasis = [...basis];
    if (lifespanOverlap(ancestor, 1830, 1870)) enrichedBasis.push("Life span overlaps the removal-era policy period (1830–1870).");
    if (lifespanOverlap(ancestor, 1887, 1934)) enrichedBasis.push("Life span overlaps the allotment-era policy period (1887–1934).");
    if (lifespanOverlap(ancestor, 1875, 1940)) enrichedBasis.push("Life span overlaps the federal boarding-school era (1875–1940).");
    if (isOklahomaPoint(ancestor)) enrichedBasis.push("Mapped point falls within Oklahoma / former Indian Territory bounds.");
    const cluster = familyClusterBasis(ancestor, allAncestors);
    if (cluster) enrichedBasis.push(cluster);

    signals.push({
      type: territory.toLowerCase().includes("indian territory") ? "indian_territory_place" : "territory_overlap",
      label: "Probable tribal affiliation signal",
      tribeOrTerritory: territory,
      confidence: confidenceForBasis(enrichedBasis.length),
      basis: enrichedBasis,
      warning: SIGNAL_WARNING,
    });
  }

  if (signals.length === 0 && isOklahomaPoint(ancestor)) {
    const basis = ["Mapped point falls within Oklahoma / former Indian Territory bounds."];
    const cluster = familyClusterBasis(ancestor, allAncestors);
    if (cluster) basis.push(cluster);
    if (lifespanOverlap(ancestor, 1887, 1934)) basis.push("Life span overlaps the allotment-era policy period (1887–1934).");
    signals.push({
      type: "territory_overlap",
      label: "Probable tribal affiliation signal",
      tribeOrTerritory: "Oklahoma / former Indian Territory",
      confidence: confidenceForBasis(basis.length),
      basis,
      warning: SIGNAL_WARNING,
    });
  }

  if (signals.length === 0 && (lifespanOverlap(ancestor, 1830, 1870) || lifespanOverlap(ancestor, 1887, 1934))) {
    signals.push({
      type: "era_overlap",
      label: "Probable tribal affiliation signal",
      tribeOrTerritory: "Removal / allotment era research context",
      confidence: "low",
      basis: ["Life span overlaps a major federal Indian policy era, but no territory-specific place evidence is currently mapped."],
      warning: SIGNAL_WARNING,
    });
  }

  return signals.sort((a, b) => ({ high: 0, moderate: 1, low: 2 }[a.confidence] - { high: 0, moderate: 1, low: 2 }[b.confidence]));
}
