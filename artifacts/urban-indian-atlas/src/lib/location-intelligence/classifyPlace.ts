import type { PlaceClassification } from "./types";

export function classifyPlace(input: {
  eventType?: string | null;
  sourceType?: string | null;
  place?: string | null;
}): PlaceClassification {
  const eventType = String(input.eventType || "").toLowerCase();
  const sourceType = String(input.sourceType || "").toLowerCase();
  const place = String(input.place || "").toLowerCase();

  if (eventType.includes("birth")) return "birthplace";
  if (eventType.includes("burial")) return "burial";
  if (eventType.includes("death")) return "event_place";
  if (eventType.includes("residence") || eventType.includes("address")) return "residence";
  if (sourceType.includes("profile_anchor")) return "event_place";
  if (place.includes("office of the chief justice")) return "government_office";
  if (place.includes("trust")) return "trust_land";
  if (place.includes("territory") || place.includes("nation")) return "tribal_territory";

  return place ? "event_place" : "unknown";
}
