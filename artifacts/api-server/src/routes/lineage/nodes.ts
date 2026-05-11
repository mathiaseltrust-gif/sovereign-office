import { Router } from "express";
import { db } from "@workspace/db";
import { familyLineageTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { requireAuth } from "../../auth/entra-guard";

const router = Router();

router.get("/", requireAuth, async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(String(req.query.page ?? "1"), 10));
    const limit = Math.min(200, Math.max(1, parseInt(String(req.query.limit ?? "100"), 10)));
    const offset = (page - 1) * limit;

    const nodes = await db
      .select({
        id: familyLineageTable.id,
        fullName: familyLineageTable.fullName,
        firstName: familyLineageTable.firstName,
        lastName: familyLineageTable.lastName,
        birthYear: familyLineageTable.birthYear,
        deathYear: familyLineageTable.deathYear,
        gender: familyLineageTable.gender,
        tribalNation: familyLineageTable.tribalNation,
        isDeceased: familyLineageTable.isDeceased,
        isAncestor: familyLineageTable.isAncestor,
        generationalPosition: familyLineageTable.generationalPosition,
        parentIds: familyLineageTable.parentIds,
        childrenIds: familyLineageTable.childrenIds,
        spouseIds: familyLineageTable.spouseIds,
        protectionLevel: familyLineageTable.protectionLevel,
        membershipStatus: familyLineageTable.membershipStatus,
        nameVariants: familyLineageTable.nameVariants,
        entraObjectId: familyLineageTable.entraObjectId,
        icwaEligible: familyLineageTable.icwaEligible,
        welfareEligible: familyLineageTable.welfareEligible,
        trustBeneficiary: familyLineageTable.trustBeneficiary,
        sourceType: familyLineageTable.sourceType,
        linkedProfileUserId: familyLineageTable.linkedProfileUserId,
        lineageTags: familyLineageTable.lineageTags,
        notes: familyLineageTable.notes,
        createdAt: familyLineageTable.createdAt,
      })
      .from(familyLineageTable)
      .orderBy(desc(familyLineageTable.generationalPosition), desc(familyLineageTable.createdAt))
      .limit(limit)
      .offset(offset);

    res.json({ nodes, page, limit, count: nodes.length });
  } catch (err) {
    next(err);
  }
});

router.get("/:id", requireAuth, async (req, res, next) => {
  try {
    const id = parseInt(String(req.params.id), 10);
    if (isNaN(id)) {
      res.status(400).json({ error: "Invalid ID" });
      return;
    }

    const [node] = await db.select().from(familyLineageTable).where(eq(familyLineageTable.id, id)).limit(1);
    if (!node) {
      res.status(404).json({ error: "Lineage node not found" });
      return;
    }

    const parentIds = Array.isArray(node.parentIds) ? (node.parentIds as number[]) : [];
    const childrenIds = Array.isArray(node.childrenIds) ? (node.childrenIds as number[]) : [];

    const resolveNames = async (ids: number[]) => {
      if (ids.length === 0) return [];
      const rows = await Promise.all(
        ids.map((pid) =>
          db.select({ id: familyLineageTable.id, fullName: familyLineageTable.fullName, birthYear: familyLineageTable.birthYear })
            .from(familyLineageTable).where(eq(familyLineageTable.id, pid)).limit(1)
            .then((r) => r[0] ?? null)
        )
      );
      return rows.filter(Boolean);
    };

    const [parents, children] = await Promise.all([resolveNames(parentIds), resolveNames(childrenIds)]);

    res.json({ ...node, _parents: parents, _children: children });
  } catch (err) {
    next(err);
  }
});

export default router;
