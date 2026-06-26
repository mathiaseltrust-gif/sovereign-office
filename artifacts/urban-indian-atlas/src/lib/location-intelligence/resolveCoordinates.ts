import type { CoordinateStatus, LocationCoordinates } from "./types";

export function resolveCoordinates(input: {
  latitude?: number | string | null;
  longitude?: number | string | null;
}): { coordinates: LocationCoordinates | null; coordinateStatus: CoordinateStatus } {
  const lat = Number(input.latitude);
  const lng = Number(input.longitude);

  if (Number.isFinite(lat) && Number.isFinite(lng)) {
    return {
      coordinates: { lat, lng },
      coordinateStatus: "verified",
    };
  }

  return {
    coordinates: null,
    coordinateStatus: "unknown",
  };
}
