/**
 * Case Files API
 *
 * GET  /api/case-files              — list all case files (with optional filters)
 * GET  /api/case-files/:caseNumber  — get a single case file by its case number
 * POST /api/case-files              — manually open a new case file
 * PATCH /api/case-files/:id/status  — update status (open / active / closed / archived)
 */

import { Router } from "express";
import { db } from "@workspace/db";
import { caseFilesTable } from "@workspace/db";
import { eq, desc, and, like } from "drizzle-orm";
import { requireAuth, requireRole } from "../../auth/entra-guard";
import { openCaseFile, updateCaseFileStatus } from "../../lib/case-file-service";
import { logger } from "../../lib/logger";

const router = Router();

router.get("/", requireAuth, async (req, res, next) => {
  try {
    const { caseType, jurisdictionLevel, status, matterType, q } = req.query as Record<string, string | undefined>;

    let query = db.select().from(caseFilesTable).$dynamic();

    const conditions = [];
    if (caseType)         conditions.push(eq(caseFilesTable.caseType, caseType));
    if (jurisdictionLevel) conditions.push(eq(caseFilesTable.jurisdictionLevel, jurisdictionLevel));
    if (status)           conditions.push(eq(caseFilesTable.status, status));
    if (matterType)       conditions.push(eq(caseFilesTable.matterType, matterType));
    if (q)                conditions.push(like(caseFilesTable.caseNumber, `%${q}%`));

    if (conditions.length) {
      query = query.where(and(...conditions));
    }

    const rows = await query.orderBy(desc(caseFilesTable.createdAt)).limit(200);
    res.json({ total: rows.length, cases: rows });
  } catch (err) {
    next(err);
  }
});

router.get("/:caseNumber", requireAuth, async (req, res, next) => {
  try {
    const caseNumber = req.params.caseNumber as string;
    const rows = await db
      .select()
      .from(caseFilesTable)
      .where(eq(caseFilesTable.caseNumber, caseNumber))
      .limit(1);
    if (!rows[0]) {
      res.status(404).json({ error: "Case file not found" });
      return;
    }
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
});

router.post("/", requireAuth, requireRole("officer"), async (req, res, next) => {
  try {
    const {
      caseType,
      jurisdictionLevel,
      matterType,
      title,
      linkedDocumentType,
      linkedDocumentId,
      linkedDocumentRef,
      notes,
      metadata,
    } = req.body as {
      caseType?: string;
      jurisdictionLevel?: "federal" | "state" | "tribal" | "private";
      matterType?: string;
      title?: string;
      linkedDocumentType?: string;
      linkedDocumentId?: number;
      linkedDocumentRef?: string;
      notes?: string;
      metadata?: Record<string, unknown>;
    };

    if (!title) {
      res.status(400).json({ error: "title is required" });
      return;
    }

    const assignedOfficerId = req.user?.dbId ?? undefined;
    const record = await openCaseFile({
      caseType:          caseType ?? "general",
      jurisdictionLevel: jurisdictionLevel ?? "federal",
      matterType,
      title,
      linkedDocumentType,
      linkedDocumentId,
      linkedDocumentRef,
      assignedOfficerId,
      notes,
      metadata,
    });

    logger.info({ caseNumber: record.caseNumber, userId: req.user?.dbId }, "Case file manually opened via API");
    res.status(201).json(record);
  } catch (err) {
    next(err);
  }
});

router.patch("/:id/status", requireAuth, requireRole("officer"), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const { status, notes } = req.body as { status?: string; notes?: string };

    if (!status) {
      res.status(400).json({ error: "status is required" });
      return;
    }

    const allowed = ["open", "active", "pending_review", "closed", "archived"];
    if (!allowed.includes(status)) {
      res.status(400).json({ error: `status must be one of: ${allowed.join(", ")}` });
      return;
    }

    await updateCaseFileStatus(id, status, notes);

    const updated = await db.select().from(caseFilesTable).where(eq(caseFilesTable.id, id)).limit(1);
    res.json(updated[0] ?? { id, status });
  } catch (err) {
    next(err);
  }
});

export default router;
