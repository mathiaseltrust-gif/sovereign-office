import { Router } from "express";
import { db } from "@workspace/db";
import { boardMattersTable, tasksTable, calendarEventsTable } from "@workspace/db";
import { desc, eq } from "drizzle-orm";
import { requireAuth, requireTrustee } from "../../auth/entra-guard";

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
          orgId: String(orgId ?? "board_of_trustees"),
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
          orgId: body.orgId != null ? String(body.orgId) : existing.orgId,
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
