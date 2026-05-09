export interface StateIntelEntry {
  state: string;
  indianLandRules: string[];
  protectedStatusRules: string[];
  statutoryReferences: string[];
  countyQuirks: Record<string, string>;
}

const STATE_INTEL_DB: Record<string, StateIntelEntry> = {
  AZ: {
    state: "Arizona",
    indianLandRules: [
      "Navajo Nation — no state property tax on trust land",
      "All Indian trust land is exempt from state recording fees",
      "BIA approval required for trust-to-trust transfers",
    ],
    protectedStatusRules: [
      "25 U.S.C. § 177 — Indian non-intercourse act applies",
      "State court jurisdiction excluded on reservation land",
    ],
    statutoryReferences: ["A.R.S. § 11-480 (recording fees)", "A.R.S. § 42-11127 (tax exemption for Indian land)"],
    countyQuirks: {
      Apache: "Requires tribal council certification attached",
      Navajo: "Requires BIA area office stamp",
    },
  },
  NM: {
    state: "New Mexico",
    indianLandRules: [
      "Pueblo land grant land requires Office of Indian Affairs review",
      "Trust land transfers require Superintendent approval",
    ],
    protectedStatusRules: ["N.M. Stat. § 47-1-43 (Indian land exemption)", "State lacks jurisdiction over Pueblo land"],
    statutoryReferences: ["N.M. Stat. § 14-8-1 (recording act)", "N.M. Stat. § 47-1-43"],
    countyQuirks: {
      Sandoval: "Requires tribal resolution if Pueblo land",
      McKinley: "Navajo Nation separate recorder office applies",
    },
  },
  SD: {
    state: "South Dakota",
    indianLandRules: [
      "Sioux tribal trust land — state recording offices lack jurisdiction",
      "All allotments require BIA Realty Services certification",
    ],
    protectedStatusRules: ["S.D.C.L. § 43-4 (land recording)", "Federal Indian Reorganization Act applies on trust land"],
    statutoryReferences: ["S.D.C.L. § 43-4-19", "25 C.F.R. Part 150 (land title records)"],
    countyQuirks: {
      Shannon: "Shannon County (Oglala Lakota) — tribal recording office only",
      Todd: "Rosebud Sioux Tribe recorder must co-file",
    },
  },
};

export function getStateIntel(stateCode: string): StateIntelEntry | null {
  return STATE_INTEL_DB[stateCode.toUpperCase()] ?? null;
}

export function getAllStateIntel(): StateIntelEntry[] {
  return Object.values(STATE_INTEL_DB);
}

export function getIndianLandClassification(state: string, landDescription: string): string {
  const lower = landDescription.toLowerCase();
  if (lower.includes("allotment") || lower.includes("allotted")) return "Indian Allotment";
  if (lower.includes("trust") && lower.includes("tribal")) return "Tribal Trust Land";
  if (lower.includes("trust")) return "Individual Indian Trust Land";
  if (lower.includes("reservation")) return "Indian Reservation Land";
  if (lower.includes("pueblo")) return "Pueblo Land Grant";
  if (lower.includes("restricted")) return "Restricted Indian Fee Land";
  void state;
  return "Fee Land (Indian Ownership)";
}
