import { coordinateConfidence } from "./confidence";
import { normalizePlaceName } from "./normalizePlace";
import { resolveCoordinates } from "./resolveCoordinates";
import { classifyPlace } from "./classifyPlace";
import type { PlaceIntelligence } from "./types";

export function buildPlaceIntelligence(input: {
  id?: string | number | null;
  personId?: string | number | null;
  eventPlace?: string | null;
  placeNormalized?: string | null;
  latitude?: number | string | null;
  longitude?: number | string | null;
  sourceType?: string | null;
  sourceReference?: string | null;
  eventType?: string | null;
  county?: string | null;
  state?: string | null;
  country?: string | null;
}): PlaceIntelligence {
  const canonicalName =
    normalizePlaceName(input.placeNormalized) ||
    normalizePlaceName(input.eventPlace) ||
    "Unknown place";

  const resolved = resolveCoordinates(input);
  const confidence = coordinateConfidence(resolved.coordinateStatus);
  const classification = classifyPlace({
    eventType: input.eventType,
    sourceType: input.sourceType,
    place: canonicalName,
  });

  return {
    canonicalName,
    displayName: canonicalName,
    classification,
    administrativeHierarchy: {
      county: input.county || null,
      state: input.state || null,
      country: input.country || null,
    },
    historicalNames: [],
    currentNames: [canonicalName],
    aliases: [],
    coordinates: resolved.coordinates,
    coordinateStatus: resolved.coordinateStatus,
    confidence,
    source: {
      type: "life_event",
      label: input.sourceType || "Life event",
      reference: input.sourceReference || null,
    },
    relatedLifeEventIds: input.id != null ? [String(input.id)] : [],
    relatedPeopleIds: input.personId != null ? [String(input.personId)] : [],
    jurisdictionContext: [],
    tribalContext: [],
    historicalContext: [],
    machineSummary:
      resolved.coordinateStatus === "verified"
        ? `${canonicalName} has verified coordinates from recorded life-event data.`
        : `${canonicalName} is recorded, but coordinates remain unresolved and should not be guessed.`,
  };
}
