export type CoordinateStatus =
  | "verified"
  | "approximate"
  | "tribal_territory"
  | "unknown";

export interface LocationCoordinates {
  lat: number;
  lng: number;
}

export interface LocationSource {
  type:
    | "life_event"
    | "profile"
    | "land_assignment"
    | "manual"
    | "historical_context"
    | "unknown";
  label?: string;
  reference?: string | null;
}

export interface PlaceIntelligence {
  canonicalName: string;
  displayName: string;
  coordinates: LocationCoordinates | null;
  coordinateStatus: CoordinateStatus;
  confidence: number;
  source: LocationSource;
  relatedLifeEventIds: string[];
  relatedPeopleIds: string[];
  jurisdictionContext: string[];
  tribalContext: string[];
  historicalContext: string[];
  machineSummary: string;
}
