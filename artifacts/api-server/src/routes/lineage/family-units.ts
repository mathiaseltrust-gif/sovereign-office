import { Router } from "express";
import { db } from "@workspace/db";
import { familyLineageTable, familyUnitsTable } from "@workspace/db";
import { eq, ilike } from "drizzle-orm";
import { requireAuth, requireRole } from "../../auth/entra-guard";
import { hasRole } from "../../engines/authority";

const router = Router();

function ids(value: unknown): number[] {
  return Array.isArray(value)
    ? value.map(Number).filter((id) => Number.isFinite(id) && id > 0)
    : [];
}

type PersonLinkRow = {
  id: number;
  fullName: string;
  linkedProfileUserId: number | null;
  userId: number | null;
  parentIds: unknown;
  childrenIds: unknown;
  spouseIds: unknown;
};

function buildMemberVisibleIds(userId: number, people: PersonLinkRow[]): Set<number> {
  const byId = new Map(people.map((person) => [person.id, person]));
  const self =
    people.find((person) => person.linkedProfileUserId === userId) ??
    people.find((person) => person.userId === userId) ??
    null;

  if (!self) return new Set<number>();

  const visible = new Set<number>([self.id]);

  // The member's own household.
  ids(self.spouseIds).forEach((id) => visible.add(id));
  ids(self.childrenIds).forEach((id) => visible.add(id));
  for (const person of people) {
    if (ids(person.parentIds).includes(self.id)) visible.add(person.id);
  }

  // The member's ancestor path. Spouses of an ancestor are included so a
  // parent pair can render, but collateral branches are intentionally excluded.
  const queue = [...ids(self.parentIds)];
  const visited = new Set<number>();
  while (queue.length > 0) {
    const id = queue.shift()!;
    if (visited.has(id)) continue;
    visited.add(id);
    visible.add(id);

    const person = byId.get(id);
    if (!person) continue;

    ids(person.spouseIds).forEach((spouseId) => visible.add(spouseId));
    ids(person.parentIds).forEach((parentId) => {
      if (!visited.has(parentId)) queue.push(parentId);
    });
  }

  return visible;
}

function unitMemberIds(unit: {
  husbandId: number | null;
  wifeId: number | null;
  spouseIds: unknown;
  childIds: unknown;
}): number[] {
  return [
    unit.husbandId,
    unit.wifeId,
    ...ids(unit.spouseIds),
    ...ids(unit.childIds),
  ].filter((id): id is number => id != null && Number.isFinite(id) && id > 0);
}

router.get("/family-units/audit", requireAuth, requireRole("officer"), async (req, res, next) => {
  try {
    const rawPersonId = req.query.personId;
    const rawName = typeof req.query.name === "string" ? req.query.name.trim() : "";
    let personId = Number(rawPersonId);

    let candidates: Array<{ id: number; fullName: string; birthYear: number | null }> = [];

    if (!Number.isFinite(personId) || personId <= 0) {
      if (!rawName) {
        res.status(400).json({ error: "Provide personId or name." });
        return;
      }
      candidates = await db
        .select({
          id: familyLineageTable.id,
          fullName: familyLineageTable.fullName,
          birthYear: familyLineageTable.birthYear,
        })
        .from(familyLineageTable)
        .where(ilike(familyLineageTable.fullName, `%${rawName}%`))
        .limit(12);

      if (candidates.length === 0) {
        res.status(404).json({ error: "No matching lineage person found.", candidates: [] });
        return;
      }

      const exact = candidates.find((candidate) => candidate.fullName.toLowerCase() === rawName.toLowerCase());
      personId = (exact ?? candidates[0]).id;
    }

    const [people, familyUnits] = await Promise.all([
      db
        .select({
          id: familyLineageTable.id,
          fullName: familyLineageTable.fullName,
          birthYear: familyLineageTable.birthYear,
          deathYear: familyLineageTable.deathYear,
          gender: familyLineageTable.gender,
          sourceType: familyLineageTable.sourceType,
          parentIds: familyLineageTable.parentIds,
          childrenIds: familyLineageTable.childrenIds,
          spouseIds: familyLineageTable.spouseIds,
        })
        .from(familyLineageTable),
      db
        .select({
          id: familyUnitsTable.id,
          gedcomFamId: familyUnitsTable.gedcomFamId,
          husbandId: familyUnitsTable.husbandId,
          wifeId: familyUnitsTable.wifeId,
          spouseIds: familyUnitsTable.spouseIds,
          childIds: familyUnitsTable.childIds,
          relationshipType: familyUnitsTable.relationshipType,
          sourceType: familyUnitsTable.sourceType,
          notes: familyUnitsTable.notes,
        })
        .from(familyUnitsTable),
    ]);

    const byId = new Map(people.map((person) => [person.id, person]));
    const person = byId.get(personId);
    if (!person) {
      res.status(404).json({ error: "Lineage person not found.", candidates });
      return;
    }

    const relatedUnits = familyUnits.filter((unit) => unitMemberIds(unit).includes(personId));
    const adultUnits = relatedUnits.filter((unit) =>
      [unit.husbandId, unit.wifeId, ...ids(unit.spouseIds)].filter(Boolean).includes(personId)
    );
    const birthUnits = relatedUnits.filter((unit) => ids(unit.childIds).includes(personId));

    const hydrate = (id: number | null) => {
      if (!id) return null;
      const row = byId.get(id);
      return row ? { id: row.id, fullName: row.fullName, birthYear: row.birthYear, deathYear: row.deathYear } : { id, fullName: "(missing lineage row)", birthYear: null, deathYear: null };
    };

    const hydrateUnit = (unit: typeof familyUnits[number]) => ({
      id: unit.id,
      gedcomFamId: unit.gedcomFamId,
      relationshipType: unit.relationshipType,
      sourceType: unit.sourceType,
      notes: unit.notes,
      adults: [unit.husbandId, unit.wifeId, ...ids(unit.spouseIds)]
        .filter((id, index, arr): id is number => id != null && arr.indexOf(id) === index)
        .map(hydrate),
      children: ids(unit.childIds).map(hydrate),
    });

    const flatParents = ids(person.parentIds);
    const flatChildren = ids(person.childrenIds);
    const flatSpouses = ids(person.spouseIds);

    const issues: Array<{ type: string; relatedId?: number; detail: string }> = [];

    for (const id of [...flatParents, ...flatChildren, ...flatSpouses]) {
      if (!byId.has(id)) {
        issues.push({ type: "missing_lineage_reference", relatedId: id, detail: `Relationship array references missing lineage row #${id}.` });
      }
    }

    for (const spouseId of flatSpouses) {
      const represented = adultUnits.some((unit) => {
        const adults = [unit.husbandId, unit.wifeId, ...ids(unit.spouseIds)].filter(Boolean);
        return adults.includes(spouseId);
      });
      if (!represented) {
        issues.push({
          type: "spouse_without_family_unit",
          relatedId: spouseId,
          detail: `Spouse link to ${byId.get(spouseId)?.fullName ?? `#${spouseId}`} is not represented by a family unit.`,
        });
      }

      const spouse = byId.get(spouseId);
      if (spouse && !ids(spouse.spouseIds).includes(personId)) {
        issues.push({
          type: "nonreciprocal_spouse_link",
          relatedId: spouseId,
          detail: `${person.fullName} lists ${spouse.fullName} as a spouse, but the reciprocal spouse link is missing.`,
        });
      }
    }

    for (const childId of flatChildren) {
      const represented = adultUnits.some((unit) => ids(unit.childIds).includes(childId));
      if (!represented) {
        issues.push({
          type: "child_without_family_unit",
          relatedId: childId,
          detail: `Child link to ${byId.get(childId)?.fullName ?? `#${childId}`} is not assigned to one of this person's family units.`,
        });
      }

      const child = byId.get(childId);
      if (child && !ids(child.parentIds).includes(personId)) {
        issues.push({
          type: "nonreciprocal_child_link",
          relatedId: childId,
          detail: `${person.fullName} lists ${child.fullName} as a child, but the child's parent list does not include this person.`,
        });
      }
    }

    for (const parentId of flatParents) {
      const represented = birthUnits.some((unit) => {
        const adults = [unit.husbandId, unit.wifeId, ...ids(unit.spouseIds)].filter(Boolean);
        return adults.includes(parentId);
      });
      if (!represented) {
        issues.push({
          type: "parent_without_birth_family_unit",
          relatedId: parentId,
          detail: `Parent link to ${byId.get(parentId)?.fullName ?? `#${parentId}`} is not represented in a birth family unit.`,
        });
      }

      const parent = byId.get(parentId);
      if (parent && !ids(parent.childrenIds).includes(personId)) {
        issues.push({
          type: "nonreciprocal_parent_link",
          relatedId: parentId,
          detail: `${person.fullName} lists ${parent.fullName} as a parent, but the parent's child list does not include this person.`,
        });
      }
    }

    const familyUnitLinkedIds = new Set(relatedUnits.flatMap(unitMemberIds));
    const flatLinkedIds = new Set([...flatParents, ...flatChildren, ...flatSpouses, personId]);

    res.json({
      readOnly: true,
      person: {
        id: person.id,
        fullName: person.fullName,
        birthYear: person.birthYear,
        deathYear: person.deathYear,
        gender: person.gender,
        sourceType: person.sourceType,
      },
      candidates,
      summary: {
        familyUnits: relatedUnits.length,
        birthFamilyUnits: birthUnits.length,
        partnerHouseholds: adultUnits.length,
        flatParentLinks: flatParents.length,
        flatSpouseLinks: flatSpouses.length,
        flatChildLinks: flatChildren.length,
        issues: issues.length,
        grampsConfigured: Boolean(process.env.GRAMPS_API_URL && process.env.GRAMPS_USERNAME && process.env.GRAMPS_PASSWORD),
      },
      birthFamilies: birthUnits.map(hydrateUnit),
      partnerHouseholds: adultUnits.map(hydrateUnit),
      flatRelationships: {
        parents: flatParents.map(hydrate),
        spouses: flatSpouses.map(hydrate),
        children: flatChildren.map(hydrate),
      },
      coverage: {
        linkedOnlyInFlatArrays: [...flatLinkedIds]
          .filter((id) => id !== personId && !familyUnitLinkedIds.has(id))
          .map(hydrate),
        linkedOnlyInFamilyUnits: [...familyUnitLinkedIds]
          .filter((id) => id !== personId && !flatLinkedIds.has(id))
          .map(hydrate),
      },
      issues,
    });
  } catch (err) {
    next(err);
  }
});

router.get("/family-units", requireAuth, async (req, res, next) => {
  try {
    const [familyUnits, people] = await Promise.all([
      db
        .select({
          id:               familyUnitsTable.id,
          gedcomFamId:      familyUnitsTable.gedcomFamId,
          husbandId:        familyUnitsTable.husbandId,
          wifeId:           familyUnitsTable.wifeId,
          spouseIds:        familyUnitsTable.spouseIds,
          childIds:         familyUnitsTable.childIds,
          relationshipType: familyUnitsTable.relationshipType,
          sourceType:       familyUnitsTable.sourceType,
        })
        .from(familyUnitsTable),
      db
        .select({
          id: familyLineageTable.id,
          fullName: familyLineageTable.fullName,
          linkedProfileUserId: familyLineageTable.linkedProfileUserId,
          userId: familyLineageTable.userId,
          parentIds: familyLineageTable.parentIds,
          childrenIds: familyLineageTable.childrenIds,
          spouseIds: familyLineageTable.spouseIds,
        })
        .from(familyLineageTable),
    ]);

    const roles = req.user?.roles ?? [];
    if (hasRole(roles, "officer") || roles.includes("elder")) {
      res.json({ familyUnits });
      return;
    }

    const userId = req.user?.dbId;
    if (!userId) {
      res.json({ familyUnits: [] });
      return;
    }

    const visible = buildMemberVisibleIds(userId, people);
    const scoped = familyUnits
      .map((unit) => {
        const husbandId = unit.husbandId && visible.has(unit.husbandId) ? unit.husbandId : null;
        const wifeId = unit.wifeId && visible.has(unit.wifeId) ? unit.wifeId : null;
        const spouseIds = ids(unit.spouseIds).filter((id) => visible.has(id));
        const childIds = ids(unit.childIds).filter((id) => visible.has(id));
        const participants = new Set(
          [husbandId, wifeId, ...spouseIds, ...childIds].filter((id): id is number => id != null)
        );

        if (participants.size < 2) return null;

        return {
          id: unit.id,
          gedcomFamId: null,
          husbandId,
          wifeId,
          spouseIds,
          childIds,
          relationshipType: unit.relationshipType,
          sourceType: unit.sourceType,
        };
      })
      .filter((unit): unit is NonNullable<typeof unit> => unit !== null);

    res.json({ familyUnits: scoped });
  } catch (err) {
    next(err);
  }
});

export default router;
