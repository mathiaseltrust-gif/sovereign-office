import { describe, expect, it } from "vitest";
import {
  isProtectedLevel,
  normalizeEntityAlias,
  shouldEscalateProtectedAssociation,
} from "../engines/entity-resolver";
import { associationStatusFor } from "../engines/document-association";

describe("entity resolver safety policy", () => {
  it("normalizes common address punctuation without changing the identity decision itself", () => {
    expect(normalizeEntityAlias("4305 Sun Devils Avenue")).toBe("4305sundevilsavenue");
    expect(normalizeEntityAlias("4305 Sun Devils Ave.")).toBe("4305sundevilsave");
  });

  it("lets only verified aliases participate in deterministic auto-link policy", () => {
    expect(associationStatusFor("exact", "verified_alias")).toBe("active");
    expect(associationStatusFor("high", "normalized_address")).toBe("proposed");
    expect(associationStatusFor("high", "ai_extraction")).toBe("proposed");
  });

  it("recognizes elevated protection levels but not ordinary/pending levels", () => {
    expect(isProtectedLevel("critical")).toBe(true);
    expect(isProtectedLevel("restricted")).toBe(true);
    expect(isProtectedLevel("standard")).toBe(false);
    expect(isProtectedLevel("pending")).toBe(false);
    expect(isProtectedLevel(null)).toBe(false);
  });

  it("raises document sensitivity only after the protected-person relationship is active", () => {
    expect(shouldEscalateProtectedAssociation("critical", "active")).toBe(true);
    expect(shouldEscalateProtectedAssociation("critical", "proposed")).toBe(false);
    expect(shouldEscalateProtectedAssociation("critical", "unresolved")).toBe(false);
    expect(shouldEscalateProtectedAssociation("standard", "active")).toBe(false);
  });
});
