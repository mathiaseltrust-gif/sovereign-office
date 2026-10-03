export interface MaternalLineageNode {
  id: number;
  fullName: string;
  birthYear?: number | null;
  gender?: string | null;
  parentIds?: number[] | null;
  childrenIds?: number[] | null;
  sourceType?: string | null;
  membershipStatus?: string | null;
  pendingReview?: boolean | null;
}

export interface MaternalReconciliationResult<T extends MaternalLineageNode> {
  nodes: T[];
  diagnostics: {
    pamelaIds: number[];
    corneliaIds: number[];
    canonicalCorneliaId: number | null;
    richardId: number | null;
    johnnieId: number | null;
    repairedPamelaIds: number[];
    repairedCorneliaIds: number[];
  };
}

function normalizeName(value: unknown): string {
  return String(value ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

function mergeIds(current: unknown, additions: number[]): number[] {
  const base = Array.isArray(current)
    ? current.map(Number).filter((id) => Number.isFinite(id) && id > 0)
    : [];
  return [...new Set([...base, ...additions.filter((id) => Number.isFinite(id) && id > 0)])];
}

function scoreCanonical(node: MaternalLineageNode, expectedBirthYear: number): number {
  return (
    (node.birthYear === expectedBirthYear ? 8 : 0)
    + (node.sourceType !== "archived" ? 4 : 0)
    + (node.membershipStatus !== "rejected" ? 2 : 0)
    + (!node.pendingReview ? 1 : 0)
  );
}

function pickCanonical<T extends MaternalLineageNode>(
  nodes: T[],
  names: string[],
  expectedBirthYear: number,
): T | null {
  const accepted = new Set(names.map(normalizeName));
  const matches = nodes.filter((node) =>
    accepted.has(normalizeName(node.fullName))
    && (node.birthYear == null || node.birthYear === expectedBirthYear),
  );
  if (matches.length === 0) return null;
  return [...matches].sort((a, b) =>
    scoreCanonical(b, expectedBirthYear) - scoreCanonical(a, expectedBirthYear)
    || a.id - b.id
  )[0] ?? null;
}

/**
 * Reconciles the verified maternal chain across duplicate legacy person rows.
 *
 * Historical imports can leave more than one Pamela/Cornelia row. The visual
 * tree may be connected to a different duplicate than a migration originally
 * repaired. We therefore add the verified relationship to every matching active
 * representation while preserving all unrelated existing relationships.
 *
 * This function never deletes, merges, or substitutes identities.
 */
export function reconcileVerifiedMaternalChain<T extends MaternalLineageNode>(
  inputNodes: T[],
): MaternalReconciliationResult<T> {
  const nodes = inputNodes.map((node) => ({
    ...node,
    parentIds: mergeIds(node.parentIds, []),
    childrenIds: mergeIds(node.childrenIds, []),
  })) as T[];

  const pamelas = nodes.filter((node) =>
    normalizeName(node.fullName) === "pamela denise mccaster"
    && (node.birthYear == null || node.birthYear === 1961)
  );
  const cornelias = nodes.filter((node) =>
    ["cornelia morant ruff", "cornella morant ruff"].includes(normalizeName(node.fullName))
    && (node.birthYear == null || node.birthYear === 1940)
  );

  const canonicalCornelia = pickCanonical(
    nodes,
    ["Cornelia Morant Ruff", "Cornella Morant Ruff"],
    1940,
  );
  const richard = pickCanonical(nodes, ["Richard Henry Morant"], 1918);
  const johnnie = pickCanonical(nodes, ["Johnnie Mae Allen"], 1917);

  const repairedPamelaIds: number[] = [];
  const repairedCorneliaIds: number[] = [];

  if (canonicalCornelia) {
    for (const pamela of pamelas) {
      const before = JSON.stringify(pamela.parentIds ?? []);
      pamela.parentIds = mergeIds(pamela.parentIds, [canonicalCornelia.id]);
      pamela.gender = "female";
      if (JSON.stringify(pamela.parentIds) !== before) repairedPamelaIds.push(pamela.id);
    }

    canonicalCornelia.childrenIds = mergeIds(
      canonicalCornelia.childrenIds,
      pamelas.map((pamela) => pamela.id),
    );
  }

  for (const cornelia of cornelias) {
    const additions = [richard?.id, johnnie?.id].filter((id): id is number => id != null);
    const before = JSON.stringify(cornelia.parentIds ?? []);
    cornelia.parentIds = mergeIds(cornelia.parentIds, additions);
    cornelia.gender = "female";
    if (JSON.stringify(cornelia.parentIds) !== before) repairedCorneliaIds.push(cornelia.id);
  }

  if (richard) {
    richard.childrenIds = mergeIds(
      richard.childrenIds,
      cornelias.map((cornelia) => cornelia.id),
    );
  }
  if (johnnie) {
    johnnie.childrenIds = mergeIds(
      johnnie.childrenIds,
      cornelias.map((cornelia) => cornelia.id),
    );
  }

  return {
    nodes,
    diagnostics: {
      pamelaIds: pamelas.map((node) => node.id),
      corneliaIds: cornelias.map((node) => node.id),
      canonicalCorneliaId: canonicalCornelia?.id ?? null,
      richardId: richard?.id ?? null,
      johnnieId: johnnie?.id ?? null,
      repairedPamelaIds,
      repairedCorneliaIds,
    },
  };
}
