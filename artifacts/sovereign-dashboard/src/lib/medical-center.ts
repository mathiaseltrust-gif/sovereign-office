/**
 * Mathias El Tribe Medical Center — Institutional Identifiers
 *
 * NPI numbers are public administrative identifiers (NPPES). Not PHI.
 * Appropriate for: provider enrollment, payer credentialing, interoperability,
 * referrals, claims processing, medical determinations, institutional verification.
 */

export const MEDICAL_CENTER_NAME = "Mathias El Tribe Medical Center";
export const CHARITABLE_TRUST_NAME = "Mathias El Tribe Charitable Trust";

export const MEDICAL_CENTER_NPI = "1760248967";
export const MEDICAL_CENTER_ADDITIONAL_NPIS = ["1790542223", "1033976758"] as const;

export const CHARITABLE_TRUST_NPI = "1215786538";
export const CHARITABLE_TRUST_TAXONOMY = "332800000X";
export const CHARITABLE_TRUST_TAXONOMY_LABEL = "I/T/U Pharmacy";

export const MEDICAL_CENTER_DIRECTOR = "Chief Mathias El / Matthew-Allen McCaster";
export const MEDICAL_CENTER_DIRECTOR_TITLE = "Director, Mathias El Tribe Medical Center";

export interface MedicalEntityId {
  entity: string;
  npi: string;
  role: string;
  taxonomy?: string;
  taxonomyLabel?: string;
  additionalNpis?: readonly string[];
}

export const MEDICAL_ENTITY_IDS: MedicalEntityId[] = [
  {
    entity: MEDICAL_CENTER_NAME,
    npi: MEDICAL_CENTER_NPI,
    role: "Primary operational NPI — provider enrollment, referrals, claims",
    additionalNpis: MEDICAL_CENTER_ADDITIONAL_NPIS,
  },
  {
    entity: CHARITABLE_TRUST_NAME,
    npi: CHARITABLE_TRUST_NPI,
    role: "Credential authority — I/T/U pharmacy and healthcare trust",
    taxonomy: CHARITABLE_TRUST_TAXONOMY,
    taxonomyLabel: CHARITABLE_TRUST_TAXONOMY_LABEL,
  },
];
