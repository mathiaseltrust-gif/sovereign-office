export interface CanonicalDocumentAccessInput {
  requesterId: number;
  documentCreatedBy: number | null;
  sensitivityLevel: string | null;
  authorityKeys: string[];
}

const PROTECTED_REVIEW_ROLES = new Set([
  "chief_justice",
  "chief_justice_trustee",
  "sovereign_admin",
]);

const OFFICE_REVIEW_ROLES = new Set([
  "officer",
  "trustee",
  "admin",
  "sovereign_admin",
  "chief_justice",
  "chief_justice_trustee",
]);

/**
 * Canonical document metadata follows a stricter rule once sensitivity has
 * been raised to "protected". A broad hierarchical role is not itself enough.
 */
export function canReviewCanonicalDocument(input: CanonicalDocumentAccessInput): boolean {
  if (input.documentCreatedBy != null && input.documentCreatedBy === input.requesterId) {
    return true;
  }

  const sensitivity = String(input.sensitivityLevel ?? "internal").toLowerCase();
  if (sensitivity === "protected") {
    return input.authorityKeys.some((role) => PROTECTED_REVIEW_ROLES.has(role));
  }

  return input.authorityKeys.some((role) => OFFICE_REVIEW_ROLES.has(role));
}
