import { Router } from "express";
import { db } from "@workspace/db";
import { nfrInvestigationsTable, nfrReviewSignalsTable, nfrAuditLogTable } from "@workspace/db";
import { eq, desc, and, inArray } from "drizzle-orm";
import { requireAuth, requireRole } from "../../auth/entra-guard";
import { triggerReviewEngine, auditLog, type ReviewSignalType, type TriggeringEventType } from "../../engines/nfr-review-engine";
import { logger } from "../../lib/logger";

const router = Router();

// ── GET /court/review-engine/active-matters ────────────────────────────────
// Chief Justice dashboard feed — open investigations ordered by urgency
router.get("/active-matters", requireAuth, async (req, res, next) => {
  try {
    const matters = await db
      .select()
      .from(nfrInvestigationsTable)
      .where(inArray(nfrInvestigationsTable.status, ["open", "under_review", "escalated"]))
      .orderBy(desc(nfrInvestigationsTable.urgencyScore), desc(nfrInvestigationsTable.createdAt))
      .limit(50);

    res.setHeader("Cache-Control", "no-store");
    res.json(matters);
  } catch (err) {
    next(err);
  }
});

// ── GET /court/review-engine/investigations ────────────────────────────────
router.get("/investigations", requireAuth, async (_req, res, next) => {
  try {
    const investigations = await db
      .select()
      .from(nfrInvestigationsTable)
      .orderBy(desc(nfrInvestigationsTable.createdAt))
      .limit(100);

    res.setHeader("Cache-Control", "no-store");
    res.json(investigations);
  } catch (err) {
    next(err);
  }
});

// ── GET /court/review-engine/investigations/:id ────────────────────────────
router.get("/investigations/:id", requireAuth, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const [investigation] = await db
      .select()
      .from(nfrInvestigationsTable)
      .where(eq(nfrInvestigationsTable.id, id))
      .limit(1);

    if (!investigation) {
      res.status(404).json({ error: "Investigation not found" });
      return;
    }

    const signals = await db
      .select()
      .from(nfrReviewSignalsTable)
      .where(eq(nfrReviewSignalsTable.investigationId, id))
      .orderBy(desc(nfrReviewSignalsTable.detectedAt));

    const auditEntries = await db
      .select()
      .from(nfrAuditLogTable)
      .where(and(
        eq(nfrAuditLogTable.resourceType, "nfr_investigation"),
        eq(nfrAuditLogTable.resourceId, id),
      ))
      .orderBy(desc(nfrAuditLogTable.createdAt))
      .limit(50);

    res.json({ ...investigation, signals, auditLog: auditEntries });
  } catch (err) {
    next(err);
  }
});

// ── PUT /court/review-engine/investigations/:id ────────────────────────────
router.put("/investigations/:id", requireAuth, requireRole("officer"), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const userId = req.user?.dbId ?? null;
    const { status, assignedReviewerId, summary, urgencyScore } = req.body as {
      status?: string;
      assignedReviewerId?: number;
      summary?: string;
      urgencyScore?: number;
    };

    const [existing] = await db
      .select()
      .from(nfrInvestigationsTable)
      .where(eq(nfrInvestigationsTable.id, id))
      .limit(1);

    if (!existing) {
      res.status(404).json({ error: "Investigation not found" });
      return;
    }

    const updates: Partial<typeof nfrInvestigationsTable.$inferInsert> = {
      updatedAt: new Date(),
    };
    if (status !== undefined) updates.status = status;
    if (assignedReviewerId !== undefined) updates.assignedReviewerId = assignedReviewerId;
    if (summary !== undefined) updates.summary = summary;
    if (urgencyScore !== undefined) updates.urgencyScore = urgencyScore;

    const [updated] = await db
      .update(nfrInvestigationsTable)
      .set(updates)
      .where(eq(nfrInvestigationsTable.id, id))
      .returning();

    await auditLog({
      userId,
      action: "INVESTIGATION_UPDATED",
      resourceType: "nfr_investigation",
      resourceId: id,
      beforeValue: { status: existing.status, assignedReviewerId: existing.assignedReviewerId, urgencyScore: existing.urgencyScore },
      afterValue: { status: updated.status, assignedReviewerId: updated.assignedReviewerId, urgencyScore: updated.urgencyScore },
      metadata: { updatedFields: Object.keys(updates).filter(k => k !== "updatedAt") },
    });

    logger.info({ investigationId: id, userId, status }, "Investigation updated");
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

// ── PATCH /court/review-engine/investigations/:id/followthrough/:step ──────
// Mark a single requiredFollowthrough item complete (or revert to pending)
router.patch("/investigations/:id/followthrough/:step", requireAuth, requireRole("officer"), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const step = Number(req.params.step);
    const userId = req.user?.dbId ?? null;
    const { status } = req.body as { status?: string };

    const ALLOWED_STATUSES = ["pending", "complete", "done", "in_progress", "waived"];
    if (!status) {
      res.status(400).json({ error: "status is required" });
      return;
    }
    if (!ALLOWED_STATUSES.includes(status)) {
      res.status(400).json({ error: `Invalid status. Allowed values: ${ALLOWED_STATUSES.join(", ")}` });
      return;
    }

    const [existing] = await db
      .select()
      .from(nfrInvestigationsTable)
      .where(eq(nfrInvestigationsTable.id, id))
      .limit(1);

    if (!existing) {
      res.status(404).json({ error: "Investigation not found" });
      return;
    }

    const items: Array<{ step: number; item: string; status: string; completedAt?: string }> =
      (existing.requiredFollowthrough as Array<{ step: number; item: string; status: string; completedAt?: string }> | null) ?? [];

    const itemIndex = items.findIndex(f => f.step === step);
    if (itemIndex === -1) {
      res.status(404).json({ error: "Followthrough item not found" });
      return;
    }

    const prevStatus = items[itemIndex].status;
    const updatedItem = {
      ...items[itemIndex],
      status,
      completedAt: status === "complete" ? new Date().toISOString() : items[itemIndex].completedAt,
    };
    if (status !== "complete") delete updatedItem.completedAt;

    const updatedItems = items.map((f, i) => (i === itemIndex ? updatedItem : f));

    const [updated] = await db
      .update(nfrInvestigationsTable)
      .set({ requiredFollowthrough: updatedItems, updatedAt: new Date() })
      .where(eq(nfrInvestigationsTable.id, id))
      .returning();

    await auditLog({
      userId,
      action: "FOLLOWTHROUGH_ITEM_UPDATED",
      resourceType: "nfr_investigation",
      resourceId: id,
      beforeValue: { step, status: prevStatus },
      afterValue: { step, status, completedAt: updatedItem.completedAt ?? null },
      metadata: { item: updatedItem.item },
    });

    logger.info({ investigationId: id, step, status, userId }, "Followthrough item updated");
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

// ── POST /court/review-engine/trigger ─────────────────────────────────────
// Manual trigger — from any dashboard or admin action
router.post("/trigger", requireAuth, requireRole("officer"), async (req, res, next) => {
  try {
    const userId = req.user?.dbId ?? null;
    const {
      signalType,
      eventType,
      eventId,
      affectedUserId,
      affectedParcelId,
      affectedInstrumentId,
      affectedMatter,
      triggeringEntity,
      evidenceSource,
      context,
    } = req.body as {
      signalType: ReviewSignalType;
      eventType?: TriggeringEventType;
      eventId?: number;
      affectedUserId?: number;
      affectedParcelId?: number;
      affectedInstrumentId?: number;
      affectedMatter?: string;
      triggeringEntity?: string;
      evidenceSource?: string;
      context?: string;
    };

    if (!signalType) {
      res.status(400).json({ error: "signalType is required" });
      return;
    }

    await auditLog({
      userId,
      action: "REVIEW_ENGINE_MANUAL_TRIGGER",
      resourceType: "review_engine",
      metadata: { signalType, eventType, affectedParcelId, affectedUserId, triggeringEntity },
    });

    const result = await triggerReviewEngine({
      eventType: eventType ?? "manual_trigger",
      eventId,
      signalType,
      affectedUserId,
      affectedParcelId,
      affectedInstrumentId,
      affectedMatter,
      triggeringEntity,
      evidenceSource,
      context,
      triggeredByUserId: userId ?? undefined,
    });

    if (!result) {
      res.status(500).json({ error: "Review engine could not process the trigger" });
      return;
    }

    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
});

// ── GET /court/review-engine/audit-log ────────────────────────────────────
router.get("/audit-log", requireAuth, requireRole("officer"), async (_req, res, next) => {
  try {
    const entries = await db
      .select()
      .from(nfrAuditLogTable)
      .orderBy(desc(nfrAuditLogTable.createdAt))
      .limit(200);

    res.setHeader("Cache-Control", "no-store");
    res.json(entries);
  } catch (err) {
    next(err);
  }
});

export default router;
