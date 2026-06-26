export type CoordinateStatus =
  | "verified"
  | "approximate"
  | "tribal_territory"
  | "unknown";

export type PlaceClassification =
  | "birthplace"
  | "residence"
  | "burial"
  | "event_place"
  | "government_office"
  | "trust_land"
  | "tribal_territory"
  | "historical_place"
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

export interface AdministrativeHierarchy {
  locality?: string | null;
  county?: string | null;
  state?: string | null;
  country?: string | null;
}

export interface PlaceIntelligence {
  canonicalName: string;
  displayName: string;
  classification: PlaceClassification;
  administrativeHierarchy: AdministrativeHierarchy;
  historicalNames: string[];
  currentNames: string[];
  aliases: string[];
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
