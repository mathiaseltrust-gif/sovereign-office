/**
 * Mathias El Tribe Medical Center — Institutional Identifiers
 *
 * NPI numbers are public administrative identifiers used within the national
 * healthcare system (NPPES). They are not PHI or confidential under HIPAA.
 * These identifiers are appropriate for provider enrollment, payer credentialing,
 * interoperability, referrals, claims processing, medical determinations,
 * institutional verification, and establishing healthcare authority.
 *
 * The three entities are intentionally separated for institutional continuity:
 *   1. Medical Center operational NPI
 *   2. Charitable Trust credential authority
 *   3. Practitioner-associated identifiers
 */

export const MEDICAL_CENTER_NAME = "Mathias El Tribe Medical Center";
export const CHARITABLE_TRUST_NAME = "Mathias El Tribe Charitable Trust";

/** Primary institutional identifier — Mathias El Tribe Medical Center */
export const MEDICAL_CENTER_NPI = "1760248967";

/**
 * Additional NPIs associated with the Medical Center.
 * Used for interoperability, referral routing, and secondary credentialing.
 */
export const MEDICAL_CENTER_ADDITIONAL_NPIS = ["1790542223", "1033976758"] as const;

/** Charitable Trust NPI — credential authority for I/T/U pharmacy services */
export const CHARITABLE_TRUST_NPI = "1215786538";

/**
 * I/T/U = Indian Health Service / Tribal / Urban Indian
 * Taxonomy code for I/T/U pharmacy services under the Charitable Trust.
 */
export const CHARITABLE_TRUST_TAXONOMY = "332800000X";
export const CHARITABLE_TRUST_TAXONOMY_LABEL = "I/T/U Pharmacy";

/** Director of the Medical Center */
export const MEDICAL_CENTER_DIRECTOR = "Chief Mathias El / Matthew-Allen McCaster";
export const MEDICAL_CENTER_DIRECTOR_TITLE = "Director, Mathias El Tribe Medical Center";

/**
 * Full institutional block for use in document headers, letterhead,
 * referral forms, and claims submissions.
 */
export function getMedicalCenterBlock(): string {
  return [
    MEDICAL_CENTER_NAME.toUpperCase(),
    `NPI: ${MEDICAL_CENTER_NPI}`,
    `Director: ${MEDICAL_CENTER_DIRECTOR}`,
    `Charitable Trust NPI: ${CHARITABLE_TRUST_NPI} (${CHARITABLE_TRUST_TAXONOMY_LABEL} — ${CHARITABLE_TRUST_TAXONOMY})`,
    `Additional NPIs: ${MEDICAL_CENTER_ADDITIONAL_NPIS.join(", ")}`,
    `Authority: Indian Health Care Improvement Act · Snyder Act (25 U.S.C. § 13) · IHS Jurisdiction`,
  ].join("\n");
}

/**
 * Compact one-line reference for note footers and credential blocks.
 */
export function getMedicalCenterShortRef(): string {
  return `${MEDICAL_CENTER_NAME} · NPI ${MEDICAL_CENTER_NPI} · Director: ${MEDICAL_CENTER_DIRECTOR}`;
}
