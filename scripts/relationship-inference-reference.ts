/*
 * Relationship inference reference utility.
 *
 * This file is intentionally placed under scripts/ so it is not wired into the
 * production app yet. It documents and prototypes the logic needed for
 * Ancestry-style kinship views.
 */

export type LineageNodeLike = {
  id: number;
  fullName: string;
  gender?: string | null;
  parentIds?: number[] | null;
  childrenIds?: number[] | null;
  spouseIds?: number[] | null;
  siblingIds?: number[] | null;
  visibility?: string | null;
  sourceType?: string | null;
};

export type RelationshipKind =
  | "self"
  | "parent"
  | "child"
  | "spouse"
  | "sibling"
  | "paternal_aunt"
  | "paternal_uncle"
  | "maternal_aunt"
  | "maternal_uncle"
  | "cousin"
  | "niece_nephew"
  | "collateral_relative";

export type InferredRelationship = {
  personId: number;
  relatedId: number;
  relationship: RelationshipKind;
  source: "explicit" | "shared_parent" | "parent_sibling" | "derived";
  confidence: "confirmed" | "inferred";
};

function ids(value: unknown): number[] {
  return Array.isArray(value)
    ? value.map(Number).filter((v) => Number.isFinite(v) && v > 0)
    : [];
}

function sameIdSet(a: number[], b: number[]): boolean {
  if (a.length === 0 || b.length === 0 || a.length !== b.length) return false;
  const aa = [...a].sort((x, y) => x - y).join(",");
  const bb = [...b].sort((x, y) => x - y).join(",");
  return aa === bb;
}

function isFemale(node?: LineageNodeLike): boolean {
  return String(node?.gender ?? "").toLowerCase().startsWith("f");
}

function isVisible(node: LineageNodeLike): boolean {
  return node.visibility !== "hidden" && node.sourceType !== "test";
}

export function inferRelationships(rootId: number, nodes: LineageNodeLike[]): InferredRelationship[] {
  const visible = nodes.filter(isVisible);
  const byId = new Map(visible.map((n) => [n.id, n]));
  const root = byId.get(rootId);
  if (!root) return [];

  const out: InferredRelationship[] = [{
    personId: rootId,
    relatedId: rootId,
    relationship: "self",
    source: "explicit",
    confidence: "confirmed",
  }];

  const rootParents = ids(root.parentIds);
  const rootChildren = ids(root.childrenIds);
  const rootSpouses = ids(root.spouseIds);

  for (const parentId of rootParents) {
    if (byId.has(parentId)) out.push({ personId: rootId, relatedId: parentId, relationship: "parent", source: "explicit", confidence: "confirmed" });
  }

  for (const childId of rootChildren) {
    if (byId.has(childId)) out.push({ personId: rootId, relatedId: childId, relationship: "child", source: "explicit", confidence: "confirmed" });
  }

  for (const spouseId of rootSpouses) {
    if (byId.has(spouseId)) out.push({ personId: rootId, relatedId: spouseId, relationship: "spouse", source: "explicit", confidence: "confirmed" });
  }

  for (const candidate of visible) {
    if (candidate.id === rootId) continue;
    if (sameIdSet(rootParents, ids(candidate.parentIds))) {
      out.push({ personId: rootId, relatedId: candidate.id, relationship: "sibling", source: "shared_parent", confidence: "inferred" });
    }
  }

  const father = rootParents[0] ? byId.get(rootParents[0]) : undefined;
  const mother = rootParents[1] ? byId.get(rootParents[1]) : undefined;

  for (const parent of [father, mother].filter(Boolean) as LineageNodeLike[]) {
    const parentParents = ids(parent.parentIds);
    if (parentParents.length === 0) continue;
    const isPaternalSide = father?.id === parent.id;

    for (const candidate of visible) {
      if (candidate.id === parent.id) continue;
      if (!sameIdSet(parentParents, ids(candidate.parentIds))) continue;

      const relationship: RelationshipKind = isPaternalSide
        ? (isFemale(candidate) ? "paternal_aunt" : "paternal_uncle")
        : (isFemale(candidate) ? "maternal_aunt" : "maternal_uncle");

      out.push({ personId: rootId, relatedId: candidate.id, relationship, source: "parent_sibling", confidence: "inferred" });

      for (const cousinId of ids(candidate.childrenIds)) {
        if (byId.has(cousinId)) {
          out.push({ personId: rootId, relatedId: cousinId, relationship: "cousin", source: "derived", confidence: "inferred" });
        }
      }
    }
  }

  for (const rel of [...out].filter((r) => r.relationship === "sibling")) {
    const sibling = byId.get(rel.relatedId);
    for (const childId of ids(sibling?.childrenIds)) {
      if (byId.has(childId)) {
        out.push({ personId: rootId, relatedId: childId, relationship: "niece_nephew", source: "derived", confidence: "inferred" });
      }
    }
  }

  const seen = new Set<string>();
  return out.filter((r) => {
    const key = `${r.personId}:${r.relatedId}:${r.relationship}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
