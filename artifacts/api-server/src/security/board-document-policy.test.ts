import { describe, expect, it } from "vitest";
import {
  BOARD_DOCUMENT_RELATIONSHIPS,
  canLinkDocumentToBoardMatter,
} from "./board-document-policy";

describe("Board Matter document scope", () => {
  it("allows a document already associated with the matter's entity", () => {
    expect(canLinkDocumentToBoardMatter({
      requesterId: 10,
      documentCreatedBy: null,
      matterOrgId: "tribal_trust",
      documentOrganizationIds: ["tribal_trust"],
    })).toBe(true);
  });

  it("allows Board records across Board Matters", () => {
    expect(canLinkDocumentToBoardMatter({
      requesterId: 10,
      documentCreatedBy: null,
      matterOrgId: "charitable_trust",
      documentOrganizationIds: ["board_of_trustees"],
    })).toBe(true);
  });

  it("allows the authenticated creator without broadening other principals", () => {
    expect(canLinkDocumentToBoardMatter({
      requesterId: 10,
      documentCreatedBy: 10,
      matterOrgId: "tribal_trust",
      documentOrganizationIds: [],
    })).toBe(true);
    expect(canLinkDocumentToBoardMatter({
      requesterId: 11,
      documentCreatedBy: 10,
      matterOrgId: "tribal_trust",
      documentOrganizationIds: [],
    })).toBe(false);
  });

  it("does not let a Charitable Trust document leak into an unrelated Tribal Trust matter", () => {
    expect(canLinkDocumentToBoardMatter({
      requesterId: 10,
      documentCreatedBy: null,
      matterOrgId: "tribal_trust",
      documentOrganizationIds: ["charitable_trust"],
    })).toBe(false);
  });

  it("permits only enumerated Board relationship classes", () => {
    expect(BOARD_DOCUMENT_RELATIONSHIPS.has("evidence")).toBe(true);
    expect(BOARD_DOCUMENT_RELATIONSHIPS.has("resolution")).toBe(true);
    expect(BOARD_DOCUMENT_RELATIONSHIPS.has("delete_record")).toBe(false);
    expect(BOARD_DOCUMENT_RELATIONSHIPS.has("financial_transaction")).toBe(false);
  });
});
