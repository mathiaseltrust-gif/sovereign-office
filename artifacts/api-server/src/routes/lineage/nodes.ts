import { Router } from "express";
import { db } from "@workspace/db";
import { familyLineageTable, notificationsTable, profilesTable } from "@workspace/db";
import { eq, desc, ne } from "drizzle-orm";
import { requireAuth, requireRole } from "../../auth/entra-guard";
import { hasRole, canReviewPendingLineage } from "../../sovereign/authority";
import { logger } from "../../lib/logger";

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

router.get("/pending-reviews", requireAuth, requireRole("trustee"), async (req, res, next) => {
  try {
    const pending = await db
      .select()
      .from(familyLineageTable)
      .where(eq(familyLineageTable.membershipStatus, "pending"))
      .orderBy(desc(familyLineageTable.createdAt))
      .limit(50);
    res.json(pending);
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

    const validRelationships = [
      "child", "parent", "sibling", "half_sibling",
      "spouse", "grandchild", "aunt_uncle", "niece_nephew", "cousin",
    ];
    if (!relationshipType || !validRelationships.includes(String(relationshipType))) {
      res.status(400).json({ error: `relationshipType must be one of: ${validRelationships.join(", ")}` });
      return;
    }

    const callerId = req.user?.dbId ?? null;

    // Look up the submitter's lineage node so we can auto-compute generation & parentIds
    let submitterNode: { id: number; generationalPosition: number | null; parentIds: unknown; spouseIds: unknown } | null = null;
    if (callerId) {
      const [found] = await db
        .select({
          id: familyLineageTable.id,
          generationalPosition: familyLineageTable.generationalPosition,
          parentIds: familyLineageTable.parentIds,
          spouseIds: familyLineageTable.spouseIds,
        })
        .from(familyLineageTable)
        .where(eq(familyLineageTable.linkedProfileUserId, callerId))
        .limit(1);
      submitterNode = found ?? null;
    }

    const submitterGen = submitterNode?.generationalPosition ?? 0;

    // Determine generationalPosition for the new node based on relationship
    const genByRelationship: Record<string, number> = {
      child: submitterGen - 1,
      grandchild: submitterGen - 2,
      niece_nephew: submitterGen - 1,
      sibling: submitterGen,
      half_sibling: submitterGen,
      spouse: submitterGen,
      cousin: submitterGen,
      parent: submitterGen + 1,
      aunt_uncle: submitterGen + 1,
    };
    const computedGen = genByRelationship[String(relationshipType)] ?? submitterGen;

    // Auto-resolve parentIds: merge caller-supplied IDs with relationship-inferred IDs
    const rawIds: unknown[] = Array.isArray(parentIds) ? parentIds : [];
    let pIds: number[] = rawIds
      .map((v) => (typeof v === "number" ? v : parseInt(String(v), 10)))
      .filter((v) => Number.isFinite(v) && v > 0);

    const submitterParentIds: number[] = Array.isArray(submitterNode?.parentIds)
      ? (submitterNode!.parentIds as unknown[]).map(Number).filter((v) => Number.isFinite(v) && v > 0)
      : [];

    // Auto-link: for child/grandchild, make the submitter's node a parent
    if ((relationshipType === "child" || relationshipType === "niece_nephew") && submitterNode) {
      if (!pIds.includes(submitterNode.id)) pIds = [submitterNode.id, ...pIds];
    }
    // For sibling/half_sibling, inherit the submitter's parents if none supplied
    if ((relationshipType === "sibling" || relationshipType === "half_sibling") && pIds.length === 0) {
      pIds = submitterParentIds;
    }

    pIds = [...new Set(pIds)].slice(0, 6);

    if (pIds.length > 0) {
      const existingNodes = await db.select({ id: familyLineageTable.id }).from(familyLineageTable);
      const validIds = new Set(existingNodes.map((r) => r.id));
      const invalid = pIds.filter((id) => !validIds.has(id));
      if (invalid.length > 0) {
        res.status(400).json({ error: `Invalid parent node IDs: ${invalid.join(", ")}` });
        return;
      }
    }

    // Auto-resolve spouseIds for "spouse" relationship
    const newSpouseIds: number[] = [];
    if (relationshipType === "spouse" && submitterNode) {
      newSpouseIds.push(submitterNode.id);
    }

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
        spouseIds: newSpouseIds,
        generationalPosition: computedGen,
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

    // Back-link: update parent nodes' childrenIds
    for (const parentId of pIds) {
      const [parent] = await db.select({ childrenIds: familyLineageTable.childrenIds }).from(familyLineageTable).where(eq(familyLineageTable.id, parentId)).limit(1);
      if (parent) {
        const existingChildren = Array.isArray(parent.childrenIds) ? (parent.childrenIds as number[]) : [];
        if (!existingChildren.includes(node.id)) {
          await db.update(familyLineageTable).set({ childrenIds: [...existingChildren, node.id] }).where(eq(familyLineageTable.id, parentId));
        }
      }
    }

    // Back-link: update submitter's spouseIds
    if (relationshipType === "spouse" && submitterNode) {
      const existingSpouses = Array.isArray(submitterNode.spouseIds) ? (submitterNode.spouseIds as number[]) : [];
      if (!existingSpouses.includes(node.id)) {
        await db.update(familyLineageTable).set({ spouseIds: [...existingSpouses, node.id] }).where(eq(familyLineageTable.id, submitterNode.id));
      }
    }

    logger.info({ relationshipType, computedGen, submitterGen, newNodeId: node.id }, "Member self-add submitted");
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

    const [updated] = await db.update(familyLineageTable)
      .set({ pendingReview: false, membershipStatus: "descendant", protectionLevel: "descendant", updatedAt: new Date() })
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

router.post("/:id/verify", requireAuth, requireRole("trustee"), async (req, res, next) => {
  try {
    const id = parseInt(String(req.params.id), 10);
    if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }

    const [node] = await db.select().from(familyLineageTable).where(eq(familyLineageTable.id, id)).limit(1);
    if (!node) { res.status(404).json({ error: "Node not found" }); return; }
    if (node.membershipStatus !== "pending") {
      res.status(400).json({ error: "Node is not in pending status" });
      return;
    }

    await db.update(familyLineageTable).set({
      membershipStatus: "verified",
      protectionLevel: "descendant",
      updatedAt: new Date(),
    }).where(eq(familyLineageTable.id, id));

    if (node.linkedProfileUserId) {
      await db
        .insert(profilesTable)
        .values({ userId: node.linkedProfileUserId, lineageVerified: true, membershipVerified: true })
        .onConflictDoUpdate({
          target: profilesTable.userId,
          set: { lineageVerified: true, membershipVerified: true, updatedAt: new Date() },
        });

      await db.insert(notificationsTable).values({
        userId: node.linkedProfileUserId,
        channel: "dashboard",
        category: "lineage_approved",
        title: "Lineage Claim Approved",
        message: "Your lineage claim has been reviewed and approved. You now have verified descendant membership.",
        severity: "info",
        relatedId: id,
        relatedType: "family_lineage",
        read: false,
      });
    }

    logger.info({ nodeId: id, adminId: req.user?.dbId }, "Lineage node verified by admin");
    res.json({ verified: true, nodeId: id });
  } catch (err) {
    next(err);
  }
});

router.post("/:id/reject", requireAuth, requireRole("trustee"), async (req, res, next) => {
  try {
    const id = parseInt(String(req.params.id), 10);
    if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }

    const [node] = await db.select().from(familyLineageTable).where(eq(familyLineageTable.id, id)).limit(1);
    if (!node) { res.status(404).json({ error: "Node not found" }); return; }

    const reason = typeof (req.body as Record<string, unknown>).reason === "string"
      ? (req.body as Record<string, unknown>).reason as string
      : "Your lineage claim could not be verified at this time.";

    await db.update(familyLineageTable).set({
      membershipStatus: "rejected",
      protectionLevel: "pending",
      notes: `${node.notes ?? ""}\n[Rejected by admin: ${reason}]`.trim(),
      updatedAt: new Date(),
    }).where(eq(familyLineageTable.id, id));

    if (node.linkedProfileUserId) {
      await db.insert(notificationsTable).values({
        userId: node.linkedProfileUserId,
        channel: "dashboard",
        category: "lineage_rejected",
        title: "Lineage Claim Not Verified",
        message: `Your lineage claim was reviewed and could not be verified. Reason: ${reason}`,
        severity: "warning",
        relatedId: id,
        relatedType: "family_lineage",
        read: false,
      });
    }

    logger.info({ nodeId: id, adminId: req.user?.dbId }, "Lineage node rejected by admin");
    res.json({ rejected: true, nodeId: id });
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

// ── Member deletes their own pending submission ────────────────────────────
router.delete("/member/:id", requireAuth, async (req, res, next) => {
  try {
    if (!req.user) { res.status(401).json({ error: "Unauthorized" }); return; }
    const id = parseInt(String(req.params.id), 10);
    if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }

    const [existing] = await db.select().from(familyLineageTable).where(eq(familyLineageTable.id, id)).limit(1);
    if (!existing) { res.status(404).json({ error: "Record not found" }); return; }

    if (!existing.pendingReview) {
      res.status(403).json({ error: "Only pending submissions can be deleted by the submitter. Contact a trustee to remove approved records." });
      return;
    }
    if (existing.addedByMemberId !== req.user.dbId) {
      res.status(403).json({ error: "You can only delete your own pending submissions." });
      return;
    }

    await db.delete(familyLineageTable).where(eq(familyLineageTable.id, id));
    logger.info({ id, userId: req.user.dbId }, "Member deleted own pending lineage submission");
    res.json({ deleted: id });
  } catch (err) {
    next(err);
  }
});

// ── Trustee hard-deletes any node and cleans up all references ────────────
router.delete("/:id", requireAuth, requireRole("trustee"), async (req, res, next) => {
  try {
    const id = parseInt(String(req.params.id), 10);
    if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }

    const [existing] = await db.select().from(familyLineageTable).where(eq(familyLineageTable.id, id)).limit(1);
    if (!existing) { res.status(404).json({ error: "Record not found" }); return; }

    // Remove this id from every other node's parentIds / childrenIds / spouseIds
    const allOthers = await db
      .select({ id: familyLineageTable.id, parentIds: familyLineageTable.parentIds, childrenIds: familyLineageTable.childrenIds, spouseIds: familyLineageTable.spouseIds })
      .from(familyLineageTable)
      .where(ne(familyLineageTable.id, id));

    for (const node of allOthers) {
      const pIds = Array.isArray(node.parentIds) ? (node.parentIds as number[]) : [];
      const cIds = Array.isArray(node.childrenIds) ? (node.childrenIds as number[]) : [];
      const sIds = Array.isArray(node.spouseIds) ? (node.spouseIds as number[]) : [];
      if (!pIds.includes(id) && !cIds.includes(id) && !sIds.includes(id)) continue;
      await db.update(familyLineageTable).set({
        parentIds: pIds.filter((x) => x !== id),
        childrenIds: cIds.filter((x) => x !== id),
        spouseIds: sIds.filter((x) => x !== id),
        updatedAt: new Date(),
      }).where(eq(familyLineageTable.id, node.id));
    }

    await db.delete(familyLineageTable).where(eq(familyLineageTable.id, id));
    logger.info({ id, adminId: req.user?.dbId }, "Trustee hard-deleted lineage node");
    res.json({ deleted: id });
  } catch (err) {
    next(err);
  }
});

export default router;
