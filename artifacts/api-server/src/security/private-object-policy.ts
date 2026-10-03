export interface OwnedPrivateObjectAccessInput {
  requestingUserId?: number;
  ownerUserId?: number | null;
}

/**
 * Private object access is record-scoped. Office role titles are intentionally
 * absent from this decision: access comes from the authorized relationship to
 * the record, not from a blanket elevated-role bypass.
 */
export function canReadOwnedPrivateObject({
  requestingUserId,
  ownerUserId,
}: OwnedPrivateObjectAccessInput): boolean {
  if (!requestingUserId || !ownerUserId) return false;
  return requestingUserId === ownerUserId;
}
