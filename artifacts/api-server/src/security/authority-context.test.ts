import { describe, expect, it } from "vitest";
import { deriveAuthorityKeys } from "../engines/authority-context";

describe("server authority context derivation", () => {
  it("does not let a trustee become Chief through a governor selection", () => {
    const keys = deriveAuthorityKeys(["trustee"], "chief_justice");
    expect(keys).toContain("trustee");
    expect(keys).not.toContain("chief_justice");
  });

  it("does not let an Officer or member become Chief through a governor selection", () => {
    expect(deriveAuthorityKeys(["officer"], "chief_justice")).not.toContain("chief_justice");
    expect(deriveAuthorityKeys(["member"], "chief_justice")).not.toContain("chief_justice");
  });

  it("accepts Chief governor posture only when the authenticated base identity is explicitly Chief/System", () => {
    expect(deriveAuthorityKeys(["sovereign_admin", "trustee"], "chief_justice"))
      .toEqual(expect.arrayContaining(["sovereign_admin", "chief_justice"]));

    expect(deriveAuthorityKeys(["chief_justice_trustee"], "chief_justice"))
      .toEqual(expect.arrayContaining(["chief_justice_trustee", "chief_justice"]));
  });

  it("does not invent authority from a lower-scope governor that is absent from the base identity", () => {
    expect(deriveAuthorityKeys(["member"], "officer")).toEqual(["member"]);
    expect(deriveAuthorityKeys(["officer"], "officer")).toEqual(["officer"]);
  });

  it("ignores missing governor state and preserves authenticated base roles only", () => {
    expect(deriveAuthorityKeys(["sovereign_admin", "trustee"], null))
      .toEqual(expect.arrayContaining(["sovereign_admin", "trustee"]));
  });
});
