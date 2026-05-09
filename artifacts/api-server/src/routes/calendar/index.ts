import { Router } from "express";
import { db } from "@workspace/db";
import { calendarEventsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth } from "../../auth/entra-guard";

const router = Router();

router.get("/", requireAuth, async (_req, res, next) => {
  try {
    const events = await db.select().from(calendarEventsTable).orderBy(calendarEventsTable.date);
    res.json(events);
  } catch (err) {
    next(err);
  }
});

router.get("/:id", requireAuth, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const results = await db.select().from(calendarEventsTable).where(eq(calendarEventsTable.id, id)).limit(1);
    if (!results[0]) {
      res.status(404).json({ error: "Calendar event not found" });
      return;
    }
    res.json(results[0]);
  } catch (err) {
    next(err);
  }
});

router.post("/", requireAuth, async (req, res, next) => {
  try {
    const { title, description, date, type, relatedId, relatedType } = req.body as {
      title: string;
      description?: string;
      date: string;
      type?: string;
      relatedId?: number;
      relatedType?: string;
    };

    if (!title || !date) {
      res.status(400).json({ error: "title and date are required" });
      return;
    }

    const [created] = await db
      .insert(calendarEventsTable)
      .values({
        title,
        description,
        date: new Date(date),
        type: type ?? "general",
        relatedId,
        relatedType,
      })
      .returning();
    res.status(201).json(created);
  } catch (err) {
    next(err);
  }
});

router.put("/:id", requireAuth, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const { title, description, date, type } = req.body as Partial<{
      title: string;
      description: string;
      date: string;
      type: string;
    }>;

    const existing = await db.select().from(calendarEventsTable).where(eq(calendarEventsTable.id, id)).limit(1);
    if (!existing[0]) {
      res.status(404).json({ error: "Calendar event not found" });
      return;
    }
    const updated = await db
      .update(calendarEventsTable)
      .set({
        title: title ?? existing[0].title,
        description: description ?? existing[0].description,
        date: date ? new Date(date) : existing[0].date,
        type: type ?? existing[0].type,
      })
      .where(eq(calendarEventsTable.id, id))
      .returning();
    res.json(updated[0]);
  } catch (err) {
    next(err);
  }
});

router.delete("/:id", requireAuth, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    await db.delete(calendarEventsTable).where(eq(calendarEventsTable.id, id));
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

export default router;
