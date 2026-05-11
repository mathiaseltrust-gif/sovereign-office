import { Router } from "express";
import { db } from "@workspace/db";
import { familyLineageTable } from "@workspace/db";
import { eq, desc, ne } from "drizzle-orm";
import { requireAuth, requireRole } from "../../auth/entra-guard";
import { hasRole, canReviewPendingLineage } from "../../sovereign/authority";

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
        pendingReview: familyLineageTable.pendingReview,
        addedByMemberId: familyLineageTable.addedByMemberId,
        supportingDocumentName: familyLineageTable.supportingDocumentName,
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

// ── Member self-add route (any authenticated user) ───────────────────────
router.post("/member", requireAuth, async (req, res, next) => {
  try {
    const {
      fullName, firstName, lastName, birthYear, gender,
      tribalNation, relationshipType, parentIds, supportingDocumentName,
    } = req.body as Record<string, unknown>;

    if (!fullName || typeof fullName !== "string") {
      res.status(400).json({ error: "fullName is required" });
      return;
    }

    const validRelationships = ["child", "parent", "sibling"];
    if (!relationshipType || !validRelationships.includes(String(relationshipType))) {
      res.status(400).json({ error: "relationshipType must be one of: child, parent, sibling" });
      return;
    }

    const pIds: number[] = Array.isArray(parentIds) ? (parentIds as number[]) : [];
    const callerId = req.user?.dbId ?? null;

    const [node] = await db
      .insert(familyLineageTable)
      .values({
        fullName,
        firstName: typeof firstName === "string" ? firstName : undefined,
        lastName: typeof lastName === "string" ? lastName : undefined,
        birthYear: typeof birthYear === "number" ? birthYear : undefined,
        gender: typeof gender === "string" ? gender : undefined,
        tribalNation: typeof tribalNation === "string" ? tribalNation : undefined,
        notes: `Relationship: ${relationshipType}`,
        parentIds: pIds,
        childrenIds: [],
        spouseIds: [],
        protectionLevel: "pending",
        membershipStatus: "pending",
        nameVariants: [],
        isDeceased: false,
        isAncestor: false,
        sourceType: "member_self",
        pendingReview: true,
        addedByMemberId: callerId,
        supportingDocumentName: typeof supportingDocumentName === "string" ? supportingDocumentName : undefined,
      })
      .returning();

    for (const parentId of pIds) {
      const [parent] = await db.select({ childrenIds: familyLineageTable.childrenIds }).from(familyLineageTable).where(eq(familyLineageTable.id, parentId)).limit(1);
      if (parent) {
        const existing = Array.isArray(parent.childrenIds) ? (parent.childrenIds as number[]) : [];
        if (!existing.includes(node.id)) {
          await db.update(familyLineageTable).set({ childrenIds: [...existing, node.id] }).where(eq(familyLineageTable.id, parentId));
        }
      }
    }

    res.status(201).json(node);
  } catch (err) {
    next(err);
  }
});

// ── Approve a pending member-submitted node ───────────────────────────────
router.post("/:id/approve", requireAuth, async (req, res, next) => {
  try {
    if (!req.user || !canReviewPendingLineage(req.user.roles)) {
      res.status(403).json({ error: "Only officers, trustees, elders, and admins can approve submissions." });
      return;
    }
    const id = parseInt(String(req.params.id), 10);
    if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }

    const [existing] = await db.select().from(familyLineageTable).where(eq(familyLineageTable.id, id)).limit(1);
    if (!existing) { res.status(404).json({ error: "Node not found" }); return; }
    if (!existing.pendingReview) { res.status(400).json({ error: "Node is not pending review" }); return; }

    const body = req.body as Record<string, unknown>;
    const membershipStatus = typeof body.membershipStatus === "string" ? body.membershipStatus : "descendant";

    const [updated] = await db.update(familyLineageTable)
      .set({ pendingReview: false, membershipStatus, protectionLevel: "descendant", updatedAt: new Date() })
      .where(eq(familyLineageTable.id, id))
      .returning();

    res.json({ approved: true, node: updated });
  } catch (err) {
    next(err);
  }
});

// ── Reject a pending member-submitted node ────────────────────────────────
router.post("/:id/reject", requireAuth, async (req, res, next) => {
  try {
    if (!req.user || !canReviewPendingLineage(req.user.roles)) {
      res.status(403).json({ error: "Only officers, trustees, elders, and admins can reject submissions." });
      return;
    }
    const id = parseInt(String(req.params.id), 10);
    if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }

    const [existing] = await db.select().from(familyLineageTable).where(eq(familyLineageTable.id, id)).limit(1);
    if (!existing) { res.status(404).json({ error: "Node not found" }); return; }
    if (!existing.pendingReview) { res.status(400).json({ error: "Node is not pending review" }); return; }

    const body = req.body as Record<string, unknown>;
    const rejectionNote = typeof body.reason === "string" ? body.reason : "Rejected by administrator";

    const [updated] = await db.update(familyLineageTable)
      .set({
        sourceType: "archived",
        pendingReview: false,
        notes: `${existing.notes ?? ""}\n[Rejected: ${rejectionNote}]`.trim(),
        updatedAt: new Date(),
      })
      .where(eq(familyLineageTable.id, id))
      .returning();

    res.json({ rejected: true, node: updated });
  } catch (err) {
    next(err);
  }
});

router.post("/", requireAuth, requireRole("trustee"), async (req, res, next) => {
  try {
    const {
      fullName, firstName, lastName, birthYear, deathYear, gender,
      tribalNation, tribalEnrollmentNumber, notes, generationalPosition,
      parentIds, icwaEligible, welfareEligible, trustBeneficiary,
      protectionLevel, nameVariants, isDeceased,
    } = req.body as Record<string, unknown>;

    if (!fullName || typeof fullName !== "string") {
      res.status(400).json({ error: "fullName is required" });
      return;
    }

    const pIds: number[] = Array.isArray(parentIds) ? (parentIds as number[]) : [];

    const [node] = await db
      .insert(familyLineageTable)
      .values({
        fullName,
        firstName: typeof firstName === "string" ? firstName : undefined,
        lastName: typeof lastName === "string" ? lastName : undefined,
        birthYear: typeof birthYear === "number" ? birthYear : undefined,
        deathYear: typeof deathYear === "number" ? deathYear : undefined,
        gender: typeof gender === "string" ? gender : undefined,
        tribalNation: typeof tribalNation === "string" ? tribalNation : undefined,
        tribalEnrollmentNumber: typeof tribalEnrollmentNumber === "string" ? tribalEnrollmentNumber : undefined,
        notes: typeof notes === "string" ? notes : undefined,
        generationalPosition: typeof generationalPosition === "number" ? generationalPosition : 0,
        parentIds: pIds,
        childrenIds: [],
        spouseIds: [],
        protectionLevel: typeof protectionLevel === "string" ? protectionLevel : "pending",
        membershipStatus: "pending",
        nameVariants: Array.isArray(nameVariants) ? nameVariants : [],
        icwaEligible: typeof icwaEligible === "boolean" ? icwaEligible : undefined,
        welfareEligible: typeof welfareEligible === "boolean" ? welfareEligible : undefined,
        trustBeneficiary: typeof trustBeneficiary === "boolean" ? trustBeneficiary : undefined,
        isDeceased: typeof isDeceased === "boolean" ? isDeceased : false,
        isAncestor: true,
        sourceType: "manual",
      })
      .returning();

    for (const parentId of pIds) {
      const [parent] = await db.select({ childrenIds: familyLineageTable.childrenIds }).from(familyLineageTable).where(eq(familyLineageTable.id, parentId)).limit(1);
      if (parent) {
        const existing = Array.isArray(parent.childrenIds) ? (parent.childrenIds as number[]) : [];
        if (!existing.includes(node.id)) {
          await db.update(familyLineageTable).set({ childrenIds: [...existing, node.id] }).where(eq(familyLineageTable.id, parentId));
        }
      }
    }

    res.status(201).json(node);
  } catch (err) {
    next(err);
  }
});

// ── Member edits their own pending submission ─────────────────────────────
router.patch("/member/:id", requireAuth, async (req, res, next) => {
  try {
    if (!req.user) { res.status(401).json({ error: "Unauthorized" }); return; }
    const id = parseInt(String(req.params.id), 10);
    if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }

    const [existing] = await db.select().from(familyLineageTable).where(eq(familyLineageTable.id, id)).limit(1);
    if (!existing) { res.status(404).json({ error: "Node not found" }); return; }
    if (!existing.pendingReview) {
      res.status(403).json({ error: "Only pending submissions can be edited by the submitter." });
      return;
    }
    if (existing.addedByMemberId !== req.user.dbId) {
      res.status(403).json({ error: "You can only edit your own pending submissions." });
      return;
    }

    const body = req.body as Record<string, unknown>;
    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (typeof body.fullName === "string" && body.fullName.trim()) updates.fullName = body.fullName.trim();
    if (typeof body.firstName === "string") updates.firstName = body.firstName || null;
    if (typeof body.lastName === "string") updates.lastName = body.lastName || null;
    if (typeof body.birthYear === "number") updates.birthYear = body.birthYear;
    if (body.birthYear === null) updates.birthYear = null;
    if (typeof body.gender === "string") updates.gender = body.gender || null;
    if (typeof body.tribalNation === "string") updates.tribalNation = body.tribalNation || null;
    if (typeof body.supportingDocumentName === "string") updates.supportingDocumentName = body.supportingDocumentName || null;

    const [updated] = await db.update(familyLineageTable)
      .set(updates)
      .where(eq(familyLineageTable.id, id))
      .returning();

    res.json({ updated: true, node: updated });
  } catch (err) {
    next(err);
  }
});

router.patch("/:id", requireAuth, requireRole("trustee"), async (req, res, next) => {
  try {
    const id = parseInt(String(req.params.id), 10);
    if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }

    const [existing] = await db.select().from(familyLineageTable).where(eq(familyLineageTable.id, id)).limit(1);
    if (!existing) { res.status(404).json({ error: "Node not found" }); return; }

    const body = req.body as Record<string, unknown>;
    const updates: Record<string, unknown> = { updatedAt: new Date() };
    const allowed = ["fullName", "firstName", "lastName", "birthYear", "deathYear", "gender",
      "tribalNation", "tribalEnrollmentNumber", "notes", "generationalPosition",
      "icwaEligible", "welfareEligible", "trustBeneficiary", "protectionLevel",
      "nameVariants", "parentIds", "membershipStatus", "isDeceased", "isAncestor"];

    for (const field of allowed) {
      if (body[field] !== undefined) updates[field] = body[field];
    }

    const [updated] = await db.update(familyLineageTable).set(updates).where(eq(familyLineageTable.id, id)).returning();
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

router.post("/:id/merge", requireAuth, requireRole("trustee"), async (req, res, next) => {
  try {
    const sourceId = parseInt(String(req.params.id), 10);
    const targetId = parseInt(String((req.body as Record<string, unknown>).targetId), 10);

    if (isNaN(sourceId) || isNaN(targetId)) { res.status(400).json({ error: "Invalid IDs" }); return; }
    if (sourceId === targetId) { res.status(400).json({ error: "Cannot merge a node into itself" }); return; }

    const [[source], [target]] = await Promise.all([
      db.select().from(familyLineageTable).where(eq(familyLineageTable.id, sourceId)).limit(1),
      db.select().from(familyLineageTable).where(eq(familyLineageTable.id, targetId)).limit(1),
    ]);

    if (!source) { res.status(404).json({ error: "Source node not found" }); return; }
    if (!target) { res.status(404).json({ error: "Target node not found" }); return; }

    const srcParentIds = Array.isArray(source.parentIds) ? (source.parentIds as number[]) : [];
    const srcChildrenIds = Array.isArray(source.childrenIds) ? (source.childrenIds as number[]) : [];
    const srcSpouseIds = Array.isArray(source.spouseIds) ? (source.spouseIds as number[]) : [];
    const srcNameVariants = Array.isArray(source.nameVariants) ? (source.nameVariants as string[]) : [];
    const tgtParentIds = Array.isArray(target.parentIds) ? (target.parentIds as number[]) : [];
    const tgtChildrenIds = Array.isArray(target.childrenIds) ? (target.childrenIds as number[]) : [];
    const tgtSpouseIds = Array.isArray(target.spouseIds) ? (target.spouseIds as number[]) : [];
    const tgtNameVariants = Array.isArray(target.nameVariants) ? (target.nameVariants as string[]) : [];

    const mergedParentIds = [...new Set([...tgtParentIds, ...srcParentIds.filter((id) => id !== targetId)])];
    const mergedChildrenIds = [...new Set([...tgtChildrenIds, ...srcChildrenIds.filter((id) => id !== targetId)])];
    const mergedSpouseIds = [...new Set([...tgtSpouseIds, ...srcSpouseIds.filter((id) => id !== targetId)])];
    const mergedNameVariants = [...new Set([...tgtNameVariants, source.fullName, ...srcNameVariants])];

    await db.update(familyLineageTable).set({
      parentIds: mergedParentIds,
      childrenIds: mergedChildrenIds,
      spouseIds: mergedSpouseIds,
      nameVariants: mergedNameVariants,
      updatedAt: new Date(),
    }).where(eq(familyLineageTable.id, targetId));

    await db.update(familyLineageTable).set({
      sourceType: "archived",
      parentIds: [],
      childrenIds: [],
      spouseIds: [],
      notes: `${source.notes ?? ""}\n[Merged into #${targetId} by admin]`.trim(),
      updatedAt: new Date(),
    }).where(eq(familyLineageTable.id, sourceId));

    const allOtherNodes = await db
      .select({ id: familyLineageTable.id, parentIds: familyLineageTable.parentIds, childrenIds: familyLineageTable.childrenIds, spouseIds: familyLineageTable.spouseIds })
      .from(familyLineageTable)
      .where(ne(familyLineageTable.id, sourceId));

    const replaceId = (arr: number[], fromId: number, toId: number) => {
      const replaced = arr.map((id) => (id === fromId ? toId : id));
      return [...new Set(replaced.filter((id) => id !== sourceId))];
    };

    for (const node of allOtherNodes) {
      const pIds = Array.isArray(node.parentIds) ? (node.parentIds as number[]) : [];
      const cIds = Array.isArray(node.childrenIds) ? (node.childrenIds as number[]) : [];
      const sIds = Array.isArray(node.spouseIds) ? (node.spouseIds as number[]) : [];

      const hasRef = pIds.includes(sourceId) || cIds.includes(sourceId) || sIds.includes(sourceId);
      if (!hasRef) continue;

      await db.update(familyLineageTable).set({
        parentIds: replaceId(pIds, sourceId, targetId),
        childrenIds: replaceId(cIds, sourceId, targetId),
        spouseIds: replaceId(sIds, sourceId, targetId),
        updatedAt: new Date(),
      }).where(eq(familyLineageTable.id, node.id));
    }

    const [updatedTarget] = await db.select().from(familyLineageTable).where(eq(familyLineageTable.id, targetId)).limit(1);
    res.json({ merged: true, target: updatedTarget });
  } catch (err) {
    next(err);
  }
});

export default router;
