export interface LineageDocumentAccessInput {
  requesterId: number;
  targetLinkedProfileUserId?: number | null;
  targetUserId?: number | null;
  roles: string[];
}

const LINEAGE_DOCUMENT_REVIEW_ROLES = new Set([
  "chief_justice",
  "chief_justice_trustee",
  "sovereign_admin",
]);

/**
 * Supporting documents attached to a lineage/person record are not public just
 * because the lineage node itself may be visible. Access follows the subject or
 * explicit highest-order Office authority.
 */
export function canViewLineageDocuments(input: LineageDocumentAccessInput): boolean {
  if (
    input.targetLinkedProfileUserId === input.requesterId ||
    input.targetUserId === input.requesterId
  ) {
    return true;
  }

  return input.roles.some((role) => LINEAGE_DOCUMENT_REVIEW_ROLES.has(role));
}
