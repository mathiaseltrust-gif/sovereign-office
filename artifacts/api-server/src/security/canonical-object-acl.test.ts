import { describe, expect, it } from "vitest";
import { associationPrincipal } from "../engines/canonical-object-acl";

describe("canonical ACL principal projection", () => {
  it("maps active institutional relationships into narrow storage principals", () => {
    expect(associationPrincipal("organization", "tribal_trust")).toBe("org:tribal_trust");
    expect(associationPrincipal("person", "42")).toBe("lineage:42");
    expect(associationPrincipal("member", "42")).toBe("lineage:42");
    expect(associationPrincipal("household", "H-006")).toBe("household:H-006");
    expect(associationPrincipal("parcel", "17")).toBe("parcel:17");
    expect(associationPrincipal("case", "90")).toBe("case:90");
  });

  it("does not turn source-record or address associations into storage authority", () => {
    expect(associationPrincipal("organization_document", "12")).toBeNull();
    expect(associationPrincipal("land_deed", "8")).toBeNull();
    expect(associationPrincipal("address", "4305")).toBeNull();
    expect(associationPrincipal("agency", "x")).toBeNull();
  });
});
