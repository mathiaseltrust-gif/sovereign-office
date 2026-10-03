import { describe, expect, it } from "vitest";
import { reconcileVerifiedMaternalChain } from "../engines/maternal-lineage-reconciliation";

describe("maternal lineage reconciliation", () => {
  it("repairs the Pamela duplicate actually connected to the visual tree", () => {
    const result = reconcileVerifiedMaternalChain([
      { id: 1, fullName: "Pamela Denise McCaster", birthYear: 1961, parentIds: [], childrenIds: [] },
      { id: 2, fullName: "Pamela Denise McCaster", birthYear: 1961, parentIds: [], childrenIds: [], sourceType: "verified_lineage" },
      { id: 3, fullName: "Cornelia Morant Ruff", birthYear: 1940, parentIds: [], childrenIds: [], sourceType: "verified_lineage" },
      { id: 4, fullName: "Richard Henry Morant", birthYear: 1918, parentIds: [], childrenIds: [] },
      { id: 5, fullName: "Johnnie Mae Allen", birthYear: 1917, parentIds: [], childrenIds: [] },
    ]);

    const pamela1 = result.nodes.find((node) => node.id === 1)!;
    const pamela2 = result.nodes.find((node) => node.id === 2)!;
    expect(pamela1.parentIds).toContain(3);
    expect(pamela2.parentIds).toContain(3);
    expect(pamela1.gender).toBe("female");
    expect(pamela2.gender).toBe("female");
  });

  it("repairs every Cornelia spelling/duplicate without deleting existing parents", () => {
    const result = reconcileVerifiedMaternalChain([
      { id: 10, fullName: "Pamela Denise McCaster", birthYear: 1961, parentIds: [], childrenIds: [] },
      { id: 20, fullName: "Cornella Morant Ruff", birthYear: 1940, parentIds: [99], childrenIds: [] },
      { id: 21, fullName: "Cornelia Morant Ruff", birthYear: 1940, parentIds: [], childrenIds: [], sourceType: "verified_lineage" },
      { id: 30, fullName: "Richard Henry Morant", birthYear: 1918, parentIds: [], childrenIds: [] },
      { id: 31, fullName: "Johnnie Mae Allen", birthYear: 1917, parentIds: [], childrenIds: [] },
    ]);

    for (const id of [20, 21]) {
      const cornelia = result.nodes.find((node) => node.id === id)!;
      expect(cornelia.parentIds).toEqual(expect.arrayContaining([30, 31]));
      expect(cornelia.gender).toBe("female");
    }
    expect(result.nodes.find((node) => node.id === 20)!.parentIds).toContain(99);
  });

  it("does nothing destructive when the canonical ancestor record is missing", () => {
    const result = reconcileVerifiedMaternalChain([
      { id: 1, fullName: "Pamela Denise McCaster", birthYear: 1961, parentIds: [88], childrenIds: [] },
    ]);
    expect(result.nodes[0].parentIds).toEqual([88]);
    expect(result.diagnostics.canonicalCorneliaId).toBeNull();
  });
});
