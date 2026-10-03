import { describe, expect, it } from "vitest";
import { canReviewCanonicalDocument } from "../security/canonical-document-access";

describe("canonical document access policy", () => {
  it("always lets the creating principal review its own document", () => {
    expect(canReviewCanonicalDocument({
      requesterId: 7,
      documentCreatedBy: 7,
      sensitivityLevel: "protected",
      roles: ["member"],
    })).toBe(true);
  });

  it("does not let officer or trustee hierarchy alone open protected metadata", () => {
    for (const role of ["officer", "trustee", "admin"]) {
      expect(canReviewCanonicalDocument({
        requesterId: 8,
        documentCreatedBy: 7,
        sensitivityLevel: "protected",
        roles: [role],
      })).toBe(false);
    }
  });

  it("allows explicit chief/system authority to review protected metadata", () => {
    for (const role of ["chief_justice", "chief_justice_trustee", "sovereign_admin"]) {
      expect(canReviewCanonicalDocument({
        requesterId: 8,
        documentCreatedBy: 7,
        sensitivityLevel: "protected",
        roles: [role],
      })).toBe(true);
    }
  });

  it("retains ordinary Office review for non-protected canonical documents", () => {
    expect(canReviewCanonicalDocument({
      requesterId: 8,
      documentCreatedBy: 7,
      sensitivityLevel: "internal",
      roles: ["officer"],
    })).toBe(true);
  });
});
