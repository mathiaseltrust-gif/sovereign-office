import { describe, expect, it } from "vitest";
import { associationStatusFor } from "../engines/document-association";

describe("SRAE association safety policy", () => {
  it("auto-links deterministic exact identifiers", () => {
    expect(associationStatusFor("exact", "member_id")).toBe("active");
    expect(associationStatusFor("very_high", "parcel_number")).toBe("active");
    expect(associationStatusFor("high", "tribal_id")).toBe("active");
    expect(associationStatusFor("exact", "verified_alias")).toBe("active");
    expect(associationStatusFor("exact", "system_created")).toBe("active");
  });

  it("does not let AI confidence silently merge identities", () => {
    expect(associationStatusFor("exact", "ai_extraction")).toBe("proposed");
    expect(associationStatusFor("high", "listener")).toBe("proposed");
    expect(associationStatusFor("high", "normalized_address")).toBe("proposed");
    expect(associationStatusFor("high", "normalized_name")).toBe("proposed");
  });

  it("keeps low-confidence matches unresolved", () => {
    expect(associationStatusFor("low", "ai_extraction")).toBe("unresolved");
    expect(associationStatusFor("low", "parcel_number")).toBe("unresolved");
  });

  it("allows a manually verified association to become active", () => {
    expect(associationStatusFor("exact", "manual")).toBe("active");
  });
});
