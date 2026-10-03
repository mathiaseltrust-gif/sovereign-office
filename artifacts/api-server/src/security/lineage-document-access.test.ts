import { describe, expect, it } from "vitest";
import { canViewLineageDocuments } from "../security/lineage-document-access";

describe("lineage document projection access", () => {
  it("lets the linked subject read their own supporting documents", () => {
    expect(canViewLineageDocuments({
      requesterId: 6,
      targetLinkedProfileUserId: 6,
      targetUserId: null,
      roles: ["member"],
    })).toBe(true);
  });

  it("does not make lineage evidence broadly readable to officers or trustees", () => {
    for (const role of ["officer", "trustee", "admin", "elder"]) {
      expect(canViewLineageDocuments({
        requesterId: 9,
        targetLinkedProfileUserId: 6,
        targetUserId: null,
        roles: [role],
      })).toBe(false);
    }
  });

  it("allows explicit chief/system authority to review lineage supporting documents", () => {
    for (const role of ["chief_justice", "chief_justice_trustee", "sovereign_admin"]) {
      expect(canViewLineageDocuments({
        requesterId: 9,
        targetLinkedProfileUserId: 6,
        targetUserId: null,
        roles: [role],
      })).toBe(true);
    }
  });
});
