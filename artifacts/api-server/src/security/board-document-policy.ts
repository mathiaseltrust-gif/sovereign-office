export const BOARD_DOCUMENT_RELATIONSHIPS = new Set([
  "evidence",
  "governing_instrument",
  "correspondence",
  "attachment",
  "report",
  "resolution",
  "minutes",
]);

export function canLinkDocumentToBoardMatter(input: {
  requesterId: number | null;
  documentCreatedBy: number | null;
  matterOrgId: string;
  documentOrganizationIds: string[];
}): boolean {
  if (
    input.requesterId != null &&
    input.documentCreatedBy != null &&
    input.requesterId === input.documentCreatedBy
  ) {
    return true;
  }

  const organizations = new Set(input.documentOrganizationIds);
  return (
    organizations.has(input.matterOrgId) ||
    organizations.has("board_of_trustees")
  );
}
