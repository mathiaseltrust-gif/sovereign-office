import { Router } from "express";
import { db } from "@workspace/db";
import { traceMattersTable } from "@workspace/db";
import { eq, desc, and, sql } from "drizzle-orm";
import { requireTraceAccess } from "../../auth/entra-guard";
import { logger } from "../../lib/logger";

const router = Router();

router.get("/", requireTraceAccess, async (req, res, next) => {
  try {
    const { status, matterType, riskLevel, niac } = req.query as Record<string, string | undefined>;

    let query = db.select().from(traceMattersTable).$dynamic();
    const conditions = [];

    if (status) conditions.push(eq(traceMattersTable.status, status));
    if (matterType) conditions.push(eq(traceMattersTable.matterType, matterType));
    if (riskLevel) conditions.push(eq(traceMattersTable.riskLevel, riskLevel));
    if (niac === "true") conditions.push(eq(traceMattersTable.niacPathway, true));

    if (conditions.length) query = query.where(and(...conditions));

    const matters = await query.orderBy(desc(traceMattersTable.createdAt)).limit(200);

    const statsResult = await db.execute<{
      total: string;
      pending_analysis: string;
      critical_risk: string;
      niac_flagged: string;
    }>(sql`
      SELECT
        COUNT(*)::text AS total,
        COUNT(*) FILTER (WHERE status IN ('pending', 'analyzing'))::text AS pending_analysis,
        COUNT(*) FILTER (WHERE risk_level = 'critical')::text AS critical_risk,
        COUNT(*) FILTER (WHERE niac_pathway = true)::text AS niac_flagged
      FROM trace_matters
    `);

    const row = statsResult.rows[0];

    res.json({
      total: matters.length,
      matters,
      stats: {
        total: parseInt(row?.total ?? "0", 10),
        pendingAnalysis: parseInt(row?.pending_analysis ?? "0", 10),
        criticalRisk: parseInt(row?.critical_risk ?? "0", 10),
        niacFlagged: parseInt(row?.niac_flagged ?? "0", 10),
      },
    });
  } catch (err) {
    next(err);
  }
});

router.post("/", requireTraceAccess, async (req, res, next) => {
  try {
    const {
      title,
      description,
      sourceType,
      sourceRef,
      matterType,
      niacReviewType,
      riskLevel,
      niacPathway,
      intakeLinkId,
      deadlineAt,
      assignedTo,
    } = req.body as {
      title?: string;
      description?: string;
      sourceType?: string;
      sourceRef?: string;
      matterType?: string;
      niacReviewType?: string;
      riskLevel?: string;
      niacPathway?: boolean;
      intakeLinkId?: number;
      deadlineAt?: string;
      assignedTo?: number;
    };

    if (!title?.trim()) {
      res.status(400).json({ error: "title is required" });
      return;
    }
    if (!description?.trim()) {
      res.status(400).json({ error: "description is required" });
      return;
    }

    const createdBy = req.user?.dbId;
    if (!createdBy) {
      res.status(401).json({ error: "User must be registered to create matters" });
      return;
    }

    const [matter] = await db
      .insert(traceMattersTable)
      .values({
        title: title.trim(),
        description: description.trim(),
        createdBy,
        assignedTo: assignedTo ?? null,
        sourceType: sourceType ?? "manual",
        sourceRef: sourceRef ?? null,
        matterType: matterType ?? "general",
        niacReviewType: niacReviewType ?? null,
        status: "pending",
        riskLevel: riskLevel ?? "low",
        niacPathway: niacPathway ?? false,
        intakeLinkId: intakeLinkId ?? null,
        deadlineAt: deadlineAt ? new Date(deadlineAt) : null,
      })
      .returning();

    logger.info({ matterId: matter.id, userId: createdBy }, "TRACE matter created");
    res.status(201).json(matter);
  } catch (err) {
    next(err);
  }
});

router.get("/:id", requireTraceAccess, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const [matter] = await db
      .select()
      .from(traceMattersTable)
      .where(eq(traceMattersTable.id, id))
      .limit(1);
    if (!matter) {
      res.status(404).json({ error: "Matter not found" });
      return;
    }
    res.json(matter);
  } catch (err) {
    next(err);
  }
});

router.put("/:id", requireTraceAccess, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const {
      title,
      description,
      status,
      riskLevel,
      matterType,
      niacReviewType,
      niacPathway,
      assignedTo,
      deadlineAt,
    } = req.body as {
      title?: string;
      description?: string;
      status?: string;
      riskLevel?: string;
      matterType?: string;
      niacReviewType?: string;
      niacPathway?: boolean;
      assignedTo?: number | null;
      deadlineAt?: string | null;
    };

    const [updated] = await db
      .update(traceMattersTable)
      .set({
        ...(title !== undefined && { title }),
        ...(description !== undefined && { description }),
        ...(status !== undefined && { status }),
        ...(riskLevel !== undefined && { riskLevel }),
        ...(matterType !== undefined && { matterType }),
        ...(niacReviewType !== undefined && { niacReviewType }),
        ...(niacPathway !== undefined && { niacPathway }),
        ...(assignedTo !== undefined && { assignedTo }),
        ...(deadlineAt !== undefined && { deadlineAt: deadlineAt ? new Date(deadlineAt) : null }),
        updatedAt: new Date(),
      })
      .where(eq(traceMattersTable.id, id))
      .returning();

    if (!updated) {
      res.status(404).json({ error: "Matter not found" });
      return;
    }
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

export default router;
