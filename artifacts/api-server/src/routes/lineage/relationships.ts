import { Router } from "express";
import { db } from "@workspace/db";
import { familyLineageTable, familyUnitsTable } from "@workspace/db";
import { eq, inArray, or } from "drizzle-orm";
import { requireAuth } from "../../auth/entra-guard";

const router = Router();

const CHIEF_ROLES = new Set(["trustee", "sovereign_admin", "admin", "elder", "officer", "chief_justice", "chief_justice_trustee"]);

type NodeLike = {
  id: number;
  fullName: string;
  gender?: string | null;
  parentIds?: unknown;
  childrenIds?: unknown;
  spouseIds?: unknown;
  siblingIds?: unknown;
  visibility?: string | null;
  sourceType?: string | null;
  linkedProfileUserId?: number | null;
};

type RelationshipKind =
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
  | "household_member"
  | "collateral_relative";

type Relationship = {
  personId: number;
  relatedId: number;
  relationship: RelationshipKind;
  source: "explicit" | "family_unit" | "shared_parent" | "parent_sibling" | "derived";
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

function isFemale(node?: NodeLike): boolean {
  return String(node?.gender ?? "").toLowerCase().startsWith("f");
}

function isVisible(node: NodeLike, isChief: boolean, currentUserId: number | null): boolean {
  if (node.sourceType === "archived" || node.sourceType === "test") return false;
  if (node.visibility === "hidden") return false;
  if (isChief) return true;
  return node.visibility === "public" || node.visibility === "tribal" || node.linkedProfileUserId === currentUserId;
}

function pushRel(out: Relationship[], rel: Relationship) {
  if (rel.personId === rel.relatedId && rel.relationship !== "self") return;
  out.push(rel);
}

function inferRelationships(rootId: number, nodes: NodeLike[], familyUnits: any[] = []): Relationship[] {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const root = byId.get(rootId);
  if (!root) return [];

  const out: Relationship[] = [{
    personId: rootId,
    relatedId: rootId,
    relationship: "self",
    source: "explicit",
    confidence: "confirmed",
  }];

  const rootParents = ids(root.parentIds);
  const rootChildren = ids(root.childrenIds);
  const rootSpouses = ids(root.spouseIds);
  const rootSiblings = ids(root.siblingIds);

  for (const parentId of rootParents) {
    if (byId.has(parentId)) pushRel(out, { personId: rootId, relatedId: parentId, relationship: "parent", source: "explicit", confidence: "confirmed" });
  }

  for (const childId of rootChildren) {
    if (byId.has(childId)) pushRel(out, { personId: rootId, relatedId: childId, relationship: "child", source: "explicit", confidence: "confirmed" });
  }

  for (const spouseId of rootSpouses) {
    if (byId.has(spouseId)) pushRel(out, { personId: rootId, relatedId: spouseId, relationship: "spouse", source: "explicit", confidence: "confirmed" });
  }

  for (const siblingId of rootSiblings) {
    if (byId.has(siblingId)) pushRel(out, { personId: rootId, relatedId: siblingId, relationship: "sibling", source: "explicit", confidence: "confirmed" });
  }

  for (const candidate of nodes) {
    if (candidate.id === rootId) continue;
    if (sameIdSet(rootParents, ids(candidate.parentIds))) {
      pushRel(out, { personId: rootId, relatedId: candidate.id, relationship: "sibling", source: "shared_parent", confidence: "inferred" });
    }
  }

  for (const unit of familyUnits) {
    const childIds = ids(unit.childIds ?? unit.child_ids);
    const spouseIds = [unit.husbandId ?? unit.husband_id, unit.wifeId ?? unit.wife_id, ...ids(unit.spouseIds ?? unit.spouse_ids)]
      .map(Number)
      .filter((v) => Number.isFinite(v) && v > 0);

    if (spouseIds.includes(rootId)) {
      for (const otherSpouse of spouseIds.filter((id) => id !== rootId)) {
        if (byId.has(otherSpouse)) pushRel(out, { personId: rootId, relatedId: otherSpouse, relationship: "spouse", source: "family_unit", confidence: "confirmed" });
      }
      for (const childId of childIds) {
        if (byId.has(childId)) pushRel(out, { personId: rootId, relatedId: childId, relationship: "child", source: "family_unit", confidence: "confirmed" });
      }
    }

    if (childIds.includes(rootId)) {
      for (const parentId of spouseIds) {
        if (byId.has(parentId)) pushRel(out, { personId: rootId, relatedId: parentId, relationship: "parent", source: "family_unit", confidence: "confirmed" });
      }
      for (const siblingId of childIds.filter((id) => id !== rootId)) {
        if (byId.has(siblingId)) pushRel(out, { personId: rootId, relatedId: siblingId, relationship: "sibling", source: "family_unit", confidence: "confirmed" });
      }
    }
  }

  const father = rootParents[0] ? byId.get(rootParents[0]) : undefined;
  const mother = rootParents[1] ? byId.get(rootParents[1]) : undefined;

  for (const parent of [father, mother].filter(Boolean) as NodeLike[]) {
    const parentParents = ids(parent.parentIds);
    const explicitParentSiblings = ids(parent.siblingIds);
    const isPaternalSide = father?.id === parent.id;

    const parentSiblingCandidates = nodes.filter((candidate) => {
      if (candidate.id === parent.id) return false;
      if (explicitParentSiblings.includes(candidate.id)) return true;
      return sameIdSet(parentParents, ids(candidate.parentIds));
    });

    for (const candidate of parentSiblingCandidates) {
      const relationship: RelationshipKind = isPaternalSide
        ? (isFemale(candidate) ? "paternal_aunt" : "paternal_uncle")
        : (isFemale(candidate) ? "maternal_aunt" : "maternal_uncle");

      pushRel(out, {
        personId: rootId,
        relatedId: candidate.id,
        relationship,
        source: explicitParentSiblings.includes(candidate.id) ? "explicit" : "parent_sibling",
        confidence: explicitParentSiblings.includes(candidate.id) ? "confirmed" : "inferred",
      });

      for (const cousinId of ids(candidate.childrenIds)) {
        if (byId.has(cousinId)) pushRel(out, { personId: rootId, relatedId: cousinId, relationship: "cousin", source: "derived", confidence: "inferred" });
      }
    }
  }

  for (const rel of [...out].filter((r) => r.relationship === "sibling")) {
    const sibling = byId.get(rel.relatedId);
    for (const childId of ids(sibling?.childrenIds)) {
      if (byId.has(childId)) pushRel(out, { personId: rootId, relatedId: childId, relationship: "niece_nephew", source: "derived", confidence: "inferred" });
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

function groupRelationships(rels: Relationship[]) {
  return rels.reduce<Record<string, Relationship[]>>((acc, rel) => {
    (acc[rel.relationship] ??= []).push(rel);
    return acc;
  }, {});
}

async function loadVisibleNodes(req: any): Promise<NodeLike[]> {
  const roles = req.user?.roles ?? [];
  const isChief = roles.some((r: string) => CHIEF_ROLES.has(r));
  const currentUserId = req.user?.dbId ?? null;

  const rows = await db.select({
    id: familyLineageTable.id,
    fullName: familyLineageTable.fullName,
    gender: familyLineageTable.gender,
    parentIds: familyLineageTable.parentIds,
    childrenIds: familyLineageTable.childrenIds,
    spouseIds: familyLineageTable.spouseIds,
    siblingIds: familyLineageTable.siblingIds,
    visibility: familyLineageTable.visibility,
    sourceType: familyLineageTable.sourceType,
    linkedProfileUserId: familyLineageTable.linkedProfileUserId,
  }).from(familyLineageTable);

  return rows.filter((n) => isVisible(n, isChief, currentUserId));
}

async function loadFamilyUnits() {
  return db.select().from(familyUnitsTable);
}

function expandRelatedNodes(rels: Relationship[], nodes: NodeLike[]) {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  return rels
    .map((r) => ({ ...r, node: byId.get(r.relatedId) ?? null }))
    .filter((r) => r.node);
}

router.get("/self", requireAuth, async (req, res, next) => {
  try {
    const currentUserId = req.user?.dbId ?? null;
    if (!currentUserId) { res.status(401).json({ error: "Not authenticated" }); return; }

    const nodes = await loadVisibleNodes(req);
    const selfNode = nodes.find((n) => n.linkedProfileUserId === currentUserId) ?? null;
    if (!selfNode) { res.json({ root: null, relationships: [], grouped: {}, nodes: [] }); return; }

    const familyUnits = await loadFamilyUnits();
    const relationships = inferRelationships(selfNode.id, nodes, familyUnits);
    const expanded = expandRelatedNodes(relationships, nodes);
    res.json({ root: selfNode, relationships: expanded, grouped: groupRelationships(expanded), nodes: expanded.map((r) => r.node) });
  } catch (err) {
    next(err);
  }
});

router.get("/:id", requireAuth, async (req, res, next) => {
  try {
    const rootId = parseInt(String(req.params.id), 10);
    if (!Number.isFinite(rootId) || rootId <= 0) {
      res.status(400).json({ error: "Invalid lineage node ID" });
      return;
    }

    const nodes = await loadVisibleNodes(req);
    const root = nodes.find((n) => n.id === rootId) ?? null;
    if (!root) { res.status(404).json({ error: "Lineage node not found or not visible" }); return; }

    const familyUnits = await loadFamilyUnits();
    const relationships = inferRelationships(rootId, nodes, familyUnits);
    const expanded = expandRelatedNodes(relationships, nodes);
    res.json({ root, relationships: expanded, grouped: groupRelationships(expanded), nodes: expanded.map((r) => r.node) });
  } catch (err) {
    next(err);
  }
});

export default router;
