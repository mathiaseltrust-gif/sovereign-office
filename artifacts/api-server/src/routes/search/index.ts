import { Router } from "express";
import { db } from "@workspace/db";
import {
  searchIndexTable,
  tasksTable,
  calendarEventsTable,
  complaintsTable,
  nfrDocumentsTable,
  classificationsTable,
  profilesTable,
} from "@workspace/db";
import { ilike, or, eq } from "drizzle-orm";
import { requireAuth } from "../../auth/entra-guard";

const router = Router();

async function recordSearchHistory(dbId: number, query: string): Promise<void> {
  try {
    const profiles = await db.select().from(profilesTable).where(eq(profilesTable.userId, dbId)).limit(1);
    const existing = profiles[0];
    const history: string[] = Array.isArray(existing?.searchHistory) ? (existing.searchHistory as string[]) : [];
    const updated = [query, ...history.filter((h) => h !== query)].slice(0, 50);

    if (existing) {
      await db
        .update(profilesTable)
        .set({ searchHistory: updated, updatedAt: new Date() })
        .where(eq(profilesTable.userId, dbId));
    } else {
      await db.insert(profilesTable).values({ userId: dbId, searchHistory: updated });
    }
  } catch {
    // non-fatal
  }
}

router.get("/", requireAuth, async (req, res, next) => {
  try {
    const { q, type, date, officer, complaintId, actorType, landStatus, actionType } = req.query as {
      q?: string;
      type?: string;
      date?: string;
      officer?: string;
      complaintId?: string;
      actorType?: string;
      landStatus?: string;
      actionType?: string;
    };

    if (!q && !type && !date && !officer && !complaintId && !actorType && !landStatus && !actionType) {
      res.status(400).json({
        error: "Provide at least one search parameter: q, type, date, officer, complaintId, actorType, landStatus, or actionType",
      });
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
        .where(or(ilike(searchIndexTable.content, pattern), ilike(searchIndexTable.entityType, pattern)))
        .limit(50);

      for (const r of searchResults) {
        const score = r.content.toLowerCase().split(q.toLowerCase()).length - 1 > 1 ? 3 : 2;
        results.push({ entityType: r.entityType, entityId: r.entityId, content: r.content, metadata: r.metadata, score });
      }

      const nfrPattern = `%${q}%`;
      const nfrResults = await db
        .select()
        .from(nfrDocumentsTable)
        .where(ilike(nfrDocumentsTable.content, nfrPattern))
        .limit(10);
      for (const n of nfrResults) {
        results.push({ entityType: "nfr", entityId: String(n.id), content: n.content.substring(0, 300), metadata: { status: n.status, classificationId: n.classificationId }, score: 2 });
      }

      const taskPattern = `%${q}%`;
      const taskResults = await db
        .select()
        .from(tasksTable)
        .where(or(ilike(tasksTable.title, taskPattern), ilike(tasksTable.description ?? "", taskPattern)))
        .limit(10);
      for (const t of taskResults) {
        results.push({ entityType: "task", entityId: String(t.id), content: `${t.title} ${t.description ?? ""}`, metadata: { status: t.status, assignedTo: t.assignedTo }, score: 2 });
      }
    }

    if (actorType || landStatus || actionType) {
      const conditions = [];
      if (actorType) conditions.push(ilike(classificationsTable.actorType, `%${actorType}%`));
      if (landStatus) conditions.push(ilike(classificationsTable.landStatus, `%${landStatus}%`));
      if (actionType) conditions.push(ilike(classificationsTable.actionType, `%${actionType}%`));

      const classResults = await db
        .select()
        .from(classificationsTable)
        .where(conditions.length === 1 ? conditions[0] : or(...conditions))
        .limit(30);

      for (const c of classResults) {
        results.push({
          entityType: "classification",
          entityId: String(c.id),
          content: `${c.actorType} ${c.landStatus} ${c.actionType} ${c.rawText.substring(0, 200)}`,
          metadata: { actorType: c.actorType, landStatus: c.landStatus, actionType: c.actionType },
          score: actorType && landStatus && actionType ? 4 : 3,
        });
      }
    }

    if (complaintId) {
      const id = Number(complaintId);
      if (!isNaN(id)) {
        const complaints = await db.select().from(complaintsTable).where(eq(complaintsTable.id, id)).limit(5);
        for (const c of complaints) {
          results.push({ entityType: "complaint", entityId: String(c.id), content: c.text.substring(0, 200), metadata: c.classification, score: 5 });
        }
      }
    }

    if (officer) {
      const officerNum = Number(officer);
      if (!isNaN(officerNum)) {
        const officerComplaints = await db.select().from(complaintsTable).where(eq(complaintsTable.officerId, officerNum)).limit(20);
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
      const typeResults = await db.select().from(searchIndexTable).where(eq(searchIndexTable.entityType, type)).limit(30);
      for (const r of typeResults) {
        results.push({ entityType: r.entityType, entityId: r.entityId, content: r.content, metadata: r.metadata, score: 1 });
      }

      if (type === "nfr") {
        const nfrs = await db.select().from(nfrDocumentsTable).limit(20);
        for (const n of nfrs) {
          results.push({ entityType: "nfr", entityId: String(n.id), content: n.content.substring(0, 300), metadata: { status: n.status }, score: 1 });
        }
      }

      if (type === "task") {
        const tasks = await db.select().from(tasksTable).limit(20);
        for (const t of tasks) {
          results.push({ entityType: "task", entityId: String(t.id), content: `${t.title} ${t.description ?? ""}`, metadata: { status: t.status }, score: 1 });
        }
      }
    }

    if (date) {
      const targetDate = new Date(date);
      const nextDay = new Date(targetDate.getTime() + 24 * 60 * 60 * 1000);
      const dateEvents = await db.select().from(calendarEventsTable).limit(50);
      for (const e of dateEvents) {
        if (e.date >= targetDate && e.date < nextDay) {
          results.push({ entityType: "calendar_event", entityId: String(e.id), content: `${e.title} ${e.description ?? ""}`, metadata: { type: e.type, date: e.date }, score: 2 });
        }
      }
    }

    const deduplicated = Array.from(
      new Map(results.map((r) => [`${r.entityType}:${r.entityId}`, r])).values(),
    ).sort((a, b) => b.score - a.score);

    if (req.user?.dbId && q) {
      void recordSearchHistory(req.user.dbId, q);
    }

    res.json({ total: deduplicated.length, results: deduplicated });
  } catch (err) {
    next(err);
  }
});

export default router;
