import { Router } from "express";
import { db } from "@workspace/db";
import { searchIndexTable, tasksTable, calendarEventsTable, complaintsTable, nfrDocumentsTable } from "@workspace/db";
import { ilike, or, eq, and } from "drizzle-orm";
import { requireAuth } from "../../auth/entra-guard";

const router = Router();

router.get("/", requireAuth, async (req, res, next) => {
  try {
    const { q, type, date, officer, complaintId } = req.query as {
      q?: string;
      type?: string;
      date?: string;
      officer?: string;
      complaintId?: string;
    };

    if (!q && !type && !date && !officer && !complaintId) {
      res.status(400).json({ error: "Provide at least one search parameter: q, type, date, officer, or complaintId" });
      return;
    }

    const results: Array<{
      entityType: string;
      entityId: string;
      content: string;
      metadata: unknown;
      score: number;
    }> = [];

    if (q) {
      const pattern = `%${q}%`;
      const searchResults = await db
        .select()
        .from(searchIndexTable)
        .where(
          or(
            ilike(searchIndexTable.content, pattern),
            ilike(searchIndexTable.entityType, pattern),
          ),
        )
        .limit(50);

      for (const r of searchResults) {
        const score = r.content.toLowerCase().includes(q.toLowerCase()) ? 2 : 1;
        results.push({ entityType: r.entityType, entityId: r.entityId, content: r.content, metadata: r.metadata, score });
      }
    }

    if (complaintId) {
      const id = Number(complaintId);
      const complaints = await db.select().from(complaintsTable).where(eq(complaintsTable.id, id)).limit(5);
      for (const c of complaints) {
        results.push({ entityType: "complaint", entityId: String(c.id), content: c.text.substring(0, 200), metadata: c.classification, score: 3 });
      }
    }

    if (officer) {
      const officerNum = Number(officer);
      if (!isNaN(officerNum)) {
        const officerComplaints = await db
          .select()
          .from(complaintsTable)
          .where(eq(complaintsTable.officerId, officerNum))
          .limit(20);
        for (const c of officerComplaints) {
          results.push({ entityType: "complaint", entityId: String(c.id), content: c.text.substring(0, 200), metadata: c.classification, score: 2 });
        }
        const officerTasks = await db.select().from(tasksTable).where(eq(tasksTable.assignedTo, officerNum)).limit(20);
        for (const t of officerTasks) {
          results.push({ entityType: "task", entityId: String(t.id), content: `${t.title} ${t.description ?? ""}`, metadata: { status: t.status }, score: 2 });
        }
      }
    }

    if (type) {
      const typeResults = await db
        .select()
        .from(searchIndexTable)
        .where(eq(searchIndexTable.entityType, type))
        .limit(30);
      for (const r of typeResults) {
        results.push({ entityType: r.entityType, entityId: r.entityId, content: r.content, metadata: r.metadata, score: 1 });
      }
    }

    if (date) {
      const targetDate = new Date(date);
      const nextDay = new Date(targetDate.getTime() + 24 * 60 * 60 * 1000);
      const dateEvents = await db
        .select()
        .from(calendarEventsTable)
        .limit(20);
      for (const e of dateEvents) {
        if (e.date >= targetDate && e.date < nextDay) {
          results.push({ entityType: "calendar_event", entityId: String(e.id), content: `${e.title} ${e.description ?? ""}`, metadata: { type: e.type, date: e.date }, score: 2 });
        }
      }
    }

    const deduplicated = Array.from(
      new Map(results.map((r) => [`${r.entityType}:${r.entityId}`, r])).values(),
    ).sort((a, b) => b.score - a.score);

    void and;
    void nfrDocumentsTable;

    res.json({ total: deduplicated.length, results: deduplicated });
  } catch (err) {
    next(err);
  }
});

export default router;
