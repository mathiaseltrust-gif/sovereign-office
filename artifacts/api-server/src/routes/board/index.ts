import { Router } from "express";
import { db } from "@workspace/db";
import { boardMattersTable, tasksTable, calendarEventsTable } from "@workspace/db";
import { desc, eq, sql } from "drizzle-orm";
import { requireAuth, requireTrustee } from "../../auth/entra-guard";
import { associateDocument, recordListenerEvent } from "../../engines/document-association";

const router = Router();

const STATUSES = new Set([
  "new",
  "under_review",
  "action_directed",
  "awaiting_action",
  "awaiting_evidence",
  "closed",
]);

const PRIORITIES = new Set(["low", "normal", "high", "urgent"]);
const BOARD_DOCUMENT_RELATIONSHIPS = new Set([
  "evidence",
  "governing_instrument",
  "correspondence",
  "attachment",
  "report",
  "resolution",
  "minutes",
]);
const BOARD_ENTITY_IDS = new Set(["board_of_trustees", "tribal_trust", "charitable_trust"]);

function cleanOrgId(value: unknown, fallback = "board_of_trustees") {
  const v = String(value ?? fallback).trim();
  return BOARD_ENTITY_IDS.has(v) ? v : fallback;
}

function cleanStatus(value: unknown, fallback = "new") {
  const v = String(value ?? fallback).trim().toLowerCase();
  return STATUSES.has(v) ? v : fallback;
}

function cleanPriority(value: unknown, fallback = "normal") {
  const v = String(value ?? fallback).trim().toLowerCase();
  return PRIORITIES.has(v) ? v : fallback;
}

router.get("/matters", requireAuth, requireTrustee, async (_req, res, next) => {
  try {
    const rows = await db
      .select()
      .from(boardMattersTable)
      .orderBy(desc(boardMattersTable.createdAt));
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

router.get("/matters/:id", requireAuth, requireTrustee, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const rows = await db.select().from(boardMattersTable).where(eq(boardMattersTable.id, id)).limit(1);
    if (!rows[0]) {
      res.status(404).json({ error: "Board matter not found" });
      return;
    }
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
});

router.post("/matters", requireAuth, requireTrustee, async (req, res, next) => {
  try {
    const {
      title,
      summary,
      matterType,
      sourceType,
      sourceId,
      orgId,
      status,
      priority,
      assignedTo,
      responsibleOffice,
      dueDate,
      boardAction,
      responseRequired,
      evidenceRequired,
    } = req.body ?? {};

    if (!String(title ?? "").trim()) {
      res.status(400).json({ error: "title is required" });
      return;
    }

    const created = await db.transaction(async (tx) => {
      const [matter] = await tx
        .insert(boardMattersTable)
        .values({
          title: String(title).trim(),
          summary: summary ? String(summary) : null,
          matterType: String(matterType ?? "governance"),
          sourceType: sourceType ? String(sourceType) : null,
          sourceId: sourceId ? String(sourceId) : null,
          orgId: cleanOrgId(orgId),
          status: cleanStatus(status),
          priority: cleanPriority(priority),
          assignedTo: assignedTo ? Number(assignedTo) : null,
          responsibleOffice: responsibleOffice ? String(responsibleOffice) : null,
          dueDate: dueDate ? new Date(String(dueDate)) : null,
          boardAction: boardAction ? String(boardAction) : null,
          responseRequired: Boolean(responseRequired),
          evidenceRequired: Boolean(evidenceRequired),
          createdBy: req.user?.dbId ?? null,
        })
        .returning();

      let linkedTaskId: number | null = null;
      let linkedCalendarEventId: number | null = null;

      if (matter.dueDate) {
        const [task] = await tx
          .insert(tasksTable)
          .values({
            title: `Board Matter #${matter.id}: ${matter.title}`,
            description: matter.summary
              ? `${matter.summary}\n\nBoard workflow: ${matter.status.replace(/_/g, " ")}.`
              : `Board workflow: ${matter.status.replace(/_/g, " ")}.`,
            dueDate: matter.dueDate,
            status: matter.status === "closed" ? "completed" : "pending",
            assignedTo: matter.assignedTo,
          })
          .returning();

        const [calendarEvent] = await tx
          .insert(calendarEventsTable)
          .values({
            title: `Board deadline — ${matter.title}`,
            description: `Board Matter #${matter.id}${matter.responsibleOffice ? ` · ${matter.responsibleOffice}` : ""}`,
            date: matter.dueDate,
            type: "task_due",
            relatedId: matter.id,
            relatedType: "board_matter",
          })
          .returning();

        linkedTaskId = task.id;
        linkedCalendarEventId = calendarEvent.id;

        const [updated] = await tx
          .update(boardMattersTable)
          .set({ linkedTaskId, linkedCalendarEventId, updatedAt: new Date() })
          .where(eq(boardMattersTable.id, matter.id))
          .returning();
        return updated;
      }

      return matter;
    });

    res.status(201).json(created);
  } catch (err) {
    next(err);
  }
});

router.get("/matters/:id/documents", requireAuth, requireTrustee, async (req, res, next) => {
  try {
    const matterId = Number(req.params.id);
    if (!Number.isFinite(matterId)) {
      res.status(400).json({ error: "Invalid Board Matter ID." });
      return;
    }

    const [matter] = await db.select().from(boardMattersTable).where(eq(boardMattersTable.id, matterId)).limit(1);
    if (!matter) {
      res.status(404).json({ error: "Board matter not found" });
      return;
    }

    const rows = await db.execute(sql`
      SELECT
        da.id AS association_id,
        da.relationship_type,
        da.created_at AS linked_at,
        dr.id AS registry_id,
        dr.document_ref,
        dr.title,
        dr.original_filename,
        dr.classification,
        dr.verification_state,
        dr.sensitivity_level,
        dr.storage_provider,
        dr.source_channel,
        dr.source_uri,
        COALESCE(
          (
            SELECT jsonb_agg(DISTINCT org_assoc.entity_id)
            FROM document_associations org_assoc
            WHERE org_assoc.document_id = dr.id
              AND org_assoc.entity_type = 'organization'
              AND org_assoc.status = 'active'
          ),
          '[]'::jsonb
        ) AS organization_ids
      FROM document_associations da
      JOIN document_registry dr ON dr.id = da.document_id
      WHERE da.entity_type = 'board_matter'
        AND da.entity_id = ${String(matterId)}
        AND da.status = 'active'
      ORDER BY da.created_at DESC
    `);

    res.json({
      matterId,
      orgId: matter.orgId,
      documents: rows.rows,
    });
  } catch (err) {
    next(err);
  }
});

router.get("/matters/:id/document-catalog", requireAuth, requireTrustee, async (req, res, next) => {
  try {
    const matterId = Number(req.params.id);
    if (!Number.isFinite(matterId)) {
      res.status(400).json({ error: "Invalid Board Matter ID." });
      return;
    }

    const [matter] = await db.select().from(boardMattersTable).where(eq(boardMattersTable.id, matterId)).limit(1);
    if (!matter) {
      res.status(404).json({ error: "Board matter not found" });
      return;
    }

    const userId = req.user?.dbId ?? null;
    const rows = await db.execute(sql`
      SELECT DISTINCT ON (dr.id)
        dr.id AS registry_id,
        dr.document_ref,
        dr.title,
        dr.original_filename,
        dr.classification,
        dr.verification_state,
        dr.sensitivity_level,
        dr.storage_provider,
        dr.source_channel,
        org_assoc.entity_id AS organization_id
      FROM document_registry dr
      LEFT JOIN document_associations org_assoc
        ON org_assoc.document_id = dr.id
       AND org_assoc.entity_type = 'organization'
       AND org_assoc.status = 'active'
      WHERE (
        org_assoc.entity_id = ${matter.orgId}
        OR org_assoc.entity_id = 'board_of_trustees'
        OR dr.created_by = ${userId}
      )
      AND NOT EXISTS (
        SELECT 1
        FROM document_associations existing
        WHERE existing.document_id = dr.id
          AND existing.entity_type = 'board_matter'
          AND existing.entity_id = ${String(matterId)}
          AND existing.status = 'active'
      )
      ORDER BY dr.id, dr.created_at DESC
      LIMIT 100
    `);

    res.json({
      matterId,
      orgId: matter.orgId,
      documents: rows.rows,
    });
  } catch (err) {
    next(err);
  }
});

router.post("/matters/:id/documents", requireAuth, requireTrustee, async (req, res, next) => {
  try {
    const matterId = Number(req.params.id);
    if (!Number.isFinite(matterId)) {
      res.status(400).json({ error: "Invalid Board Matter ID." });
      return;
    }

    const documentRef = String((req.body as Record<string, unknown>)?.documentRef ?? "").trim();
    const relationshipType = String((req.body as Record<string, unknown>)?.relationshipType ?? "evidence").trim();

    if (!documentRef) {
      res.status(400).json({ error: "documentRef is required." });
      return;
    }
    if (!BOARD_DOCUMENT_RELATIONSHIPS.has(relationshipType)) {
      res.status(400).json({
        error: "Invalid relationshipType.",
        allowed: [...BOARD_DOCUMENT_RELATIONSHIPS],
      });
      return;
    }

    const [matter] = await db.select().from(boardMattersTable).where(eq(boardMattersTable.id, matterId)).limit(1);
    if (!matter) {
      res.status(404).json({ error: "Board matter not found" });
      return;
    }

    const userId = req.user?.dbId ?? null;
    const documentResult = await db.execute(sql`
      SELECT
        dr.id,
        dr.document_ref,
        dr.title,
        dr.original_filename,
        EXISTS (
          SELECT 1
          FROM document_associations org_assoc
          WHERE org_assoc.document_id = dr.id
            AND org_assoc.entity_type = 'organization'
            AND org_assoc.status = 'active'
            AND org_assoc.entity_id IN (${matter.orgId}, 'board_of_trustees')
        ) AS organization_scope
      FROM document_registry dr
      WHERE dr.document_ref = ${documentRef}
        AND (
          dr.created_by = ${userId}
          OR EXISTS (
            SELECT 1
            FROM document_associations org_assoc
            WHERE org_assoc.document_id = dr.id
              AND org_assoc.entity_type = 'organization'
              AND org_assoc.status = 'active'
              AND org_assoc.entity_id IN (${matter.orgId}, 'board_of_trustees')
          )
        )
      LIMIT 1
    `);

    const document = documentResult.rows[0] as Record<string, unknown> | undefined;
    if (!document) {
      res.status(403).json({
        error: "That document is not within this Board Matter's authorized record scope.",
      });
      return;
    }

    const association = await associateDocument({
      documentId: Number(document.id),
      entityType: "board_matter",
      entityId: String(matterId),
      relationshipType,
      confidence: "exact",
      resolutionMethod: "system_created",
      metadata: {
        orgId: matter.orgId,
        matterTitle: matter.title,
        linkedByBoard: true,
      },
      verifiedBy: userId,
    });

    await recordListenerEvent({
      documentId: Number(document.id),
      listenerName: "board-matter",
      eventType: "DOCUMENT_LINKED_TO_BOARD_MATTER",
      actionState: "active",
      payload: {
        matterId,
        matterTitle: matter.title,
        orgId: matter.orgId,
        relationshipType,
        linkedBy: userId,
      },
    });

    res.status(201).json({
      success: true,
      matterId,
      documentRef,
      relationshipType,
      association,
    });
  } catch (err) {
    next(err);
  }
});

router.delete("/matters/:id/documents/:associationId", requireAuth, requireTrustee, async (req, res, next) => {
  try {
    const matterId = Number(req.params.id);
    const associationId = Number(req.params.associationId);
    if (!Number.isFinite(matterId) || !Number.isFinite(associationId)) {
      res.status(400).json({ error: "Invalid matter or association ID." });
      return;
    }

    const [matter] = await db.select().from(boardMattersTable).where(eq(boardMattersTable.id, matterId)).limit(1);
    if (!matter) {
      res.status(404).json({ error: "Board matter not found" });
      return;
    }

    const current = await db.execute(sql`
      SELECT id, document_id, relationship_type, status
      FROM document_associations
      WHERE id = ${associationId}
        AND entity_type = 'board_matter'
        AND entity_id = ${String(matterId)}
        AND status = 'active'
      LIMIT 1
    `);
    const association = current.rows[0] as Record<string, unknown> | undefined;
    if (!association) {
      res.status(404).json({ error: "Active Board Matter document association not found." });
      return;
    }

    await db.execute(sql`
      UPDATE document_associations
      SET status = 'rejected',
          verified_by = ${req.user?.dbId ?? null},
          verified_at = NOW()
      WHERE id = ${associationId}
    `);

    await recordListenerEvent({
      documentId: Number(association.document_id),
      listenerName: "board-matter",
      eventType: "DOCUMENT_UNLINKED_FROM_BOARD_MATTER",
      actionState: "rejected",
      payload: {
        matterId,
        relationshipType: association.relationship_type,
        unlinkedBy: req.user?.dbId ?? null,
      },
    });

    res.json({
      success: true,
      matterId,
      associationId,
      documentPreserved: true,
    });
  } catch (err) {
    next(err);
  }
});

router.put("/matters/:id", requireAuth, requireTrustee, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const [existing] = await db.select().from(boardMattersTable).where(eq(boardMattersTable.id, id)).limit(1);
    if (!existing) {
      res.status(404).json({ error: "Board matter not found" });
      return;
    }

    const body = req.body ?? {};
    const nextStatus = Object.prototype.hasOwnProperty.call(body, "status")
      ? cleanStatus(body.status, existing.status)
      : existing.status;
    const hasDueDate = Object.prototype.hasOwnProperty.call(body, "dueDate");
    const nextDueDate = hasDueDate
      ? (body.dueDate ? new Date(String(body.dueDate)) : null)
      : existing.dueDate;

    const updated = await db.transaction(async (tx) => {
      const [matter] = await tx
        .update(boardMattersTable)
        .set({
          title: body.title != null ? String(body.title).trim() : existing.title,
          summary: body.summary !== undefined ? (body.summary ? String(body.summary) : null) : existing.summary,
          matterType: body.matterType != null ? String(body.matterType) : existing.matterType,
          sourceType: body.sourceType !== undefined ? (body.sourceType ? String(body.sourceType) : null) : existing.sourceType,
          sourceId: body.sourceId !== undefined ? (body.sourceId ? String(body.sourceId) : null) : existing.sourceId,
          orgId: body.orgId != null ? cleanOrgId(body.orgId, existing.orgId) : existing.orgId,
          status: nextStatus,
          priority: body.priority != null ? cleanPriority(body.priority, existing.priority) : existing.priority,
          assignedTo: body.assignedTo !== undefined ? (body.assignedTo ? Number(body.assignedTo) : null) : existing.assignedTo,
          responsibleOffice: body.responsibleOffice !== undefined
            ? (body.responsibleOffice ? String(body.responsibleOffice) : null)
            : existing.responsibleOffice,
          dueDate: nextDueDate,
          boardAction: body.boardAction !== undefined ? (body.boardAction ? String(body.boardAction) : null) : existing.boardAction,
          responseRequired: body.responseRequired !== undefined ? Boolean(body.responseRequired) : existing.responseRequired,
          evidenceRequired: body.evidenceRequired !== undefined ? Boolean(body.evidenceRequired) : existing.evidenceRequired,
          closureNotes: body.closureNotes !== undefined ? (body.closureNotes ? String(body.closureNotes) : null) : existing.closureNotes,
          closedAt: nextStatus === "closed" ? (existing.closedAt ?? new Date()) : null,
          closedBy: nextStatus === "closed" ? (existing.closedBy ?? req.user?.dbId ?? null) : null,
          updatedAt: new Date(),
        })
        .where(eq(boardMattersTable.id, id))
        .returning();

      let taskId = matter.linkedTaskId;
      let calendarId = matter.linkedCalendarEventId;

      if (matter.dueDate) {
        if (taskId) {
          await tx
            .update(tasksTable)
            .set({
              title: `Board Matter #${matter.id}: ${matter.title}`,
              description: matter.summary
                ? `${matter.summary}\n\nBoard workflow: ${matter.status.replace(/_/g, " ")}.`
                : `Board workflow: ${matter.status.replace(/_/g, " ")}.`,
              dueDate: matter.dueDate,
              assignedTo: matter.assignedTo,
              status: matter.status === "closed" ? "completed" : "pending",
              updatedAt: new Date(),
            })
            .where(eq(tasksTable.id, taskId));
        } else {
          const [task] = await tx
            .insert(tasksTable)
            .values({
              title: `Board Matter #${matter.id}: ${matter.title}`,
              description: matter.summary
                ? `${matter.summary}\n\nBoard workflow: ${matter.status.replace(/_/g, " ")}.`
                : `Board workflow: ${matter.status.replace(/_/g, " ")}.`,
              dueDate: matter.dueDate,
              status: matter.status === "closed" ? "completed" : "pending",
              assignedTo: matter.assignedTo,
            })
            .returning();
          taskId = task.id;
        }

        if (calendarId) {
          await tx
            .update(calendarEventsTable)
            .set({
              title: `Board deadline — ${matter.title}`,
              description: `Board Matter #${matter.id}${matter.responsibleOffice ? ` · ${matter.responsibleOffice}` : ""}`,
              date: matter.dueDate,
              type: "task_due",
            })
            .where(eq(calendarEventsTable.id, calendarId));
        } else {
          const [calendarEvent] = await tx
            .insert(calendarEventsTable)
            .values({
              title: `Board deadline — ${matter.title}`,
              description: `Board Matter #${matter.id}${matter.responsibleOffice ? ` · ${matter.responsibleOffice}` : ""}`,
              date: matter.dueDate,
              type: "task_due",
              relatedId: matter.id,
              relatedType: "board_matter",
            })
            .returning();
          calendarId = calendarEvent.id;
        }
      } else if (hasDueDate) {
        if (taskId) {
          await tx
            .update(tasksTable)
            .set({ dueDate: null, updatedAt: new Date() })
            .where(eq(tasksTable.id, taskId));
        }
        if (calendarId) {
          await tx.delete(calendarEventsTable).where(eq(calendarEventsTable.id, calendarId));
          calendarId = null;
        }
      }

      if (taskId !== matter.linkedTaskId || calendarId !== matter.linkedCalendarEventId) {
        const [relinked] = await tx
          .update(boardMattersTable)
          .set({ linkedTaskId: taskId, linkedCalendarEventId: calendarId, updatedAt: new Date() })
          .where(eq(boardMattersTable.id, id))
          .returning();
        return relinked;
      }

      return matter;
    });

    res.json(updated);
  } catch (err) {
    next(err);
  }
});

export default router;
