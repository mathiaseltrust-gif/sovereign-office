import { Router } from "express";
import { db } from "@workspace/db";
import { ancestralTimelineEventsTable, familyLineageTable } from "@workspace/db";
import { eq, and, asc } from "drizzle-orm";
import { requireAuth } from "../../auth/entra-guard";
import { getHistoricalEventsForAncestor } from "./historical-events";

const router = Router();

/* ── GET /api/ancestral-timeline/:ancestorId ── */
router.get("/:ancestorId", requireAuth, async (req, res, next) => {
  try {
    const ancestorId = parseInt(req.params.ancestorId as string, 10);
    if (isNaN(ancestorId)) { res.status(400).json({ error: "Invalid ancestor id" }); return; }

    // Fetch ancestor record
    const [ancestor] = await db
      .select()
      .from(familyLineageTable)
      .where(eq(familyLineageTable.id, ancestorId))
      .limit(1);

    if (!ancestor) { res.status(404).json({ error: "Ancestor not found" }); return; }

    // Fetch user-entered timeline events
    const userEvents = await db
      .select()
      .from(ancestralTimelineEventsTable)
      .where(eq(ancestralTimelineEventsTable.ancestorId, ancestorId))
      .orderBy(asc(ancestralTimelineEventsTable.year));

    // Compute historical context based on birth/death years
    const historicalEvents = getHistoricalEventsForAncestor(
      ancestor.birthYear ?? null,
      ancestor.deathYear ?? null,
    );

    res.json({ ancestor, userEvents, historicalEvents });
  } catch (err) {
    next(err);
  }
});

/* ── POST /api/ancestral-timeline/:ancestorId/events — add event ── */
router.post("/:ancestorId/events", requireAuth, async (req, res, next) => {
  try {
    const userId = (req as any).user?.dbId;
    if (!userId) { res.status(400).json({ error: "User not registered" }); return; }

    const ancestorId = parseInt(req.params.ancestorId as string, 10);
    if (isNaN(ancestorId)) { res.status(400).json({ error: "Invalid ancestor id" }); return; }

    const { eventType, year, endYear, title, description, location, sourceType, sourceNote } = req.body;
    if (!title || !eventType) { res.status(400).json({ error: "title and eventType are required" }); return; }

    const [row] = await db.insert(ancestralTimelineEventsTable).values({
      ancestorId,
      eventType,
      year: year ? parseInt(year, 10) : null,
      endYear: endYear ? parseInt(endYear, 10) : null,
      title,
      description: description ?? null,
      location: location ?? null,
      sourceType: sourceType ?? "life_event",
      sourceNote: sourceNote ?? null,
      addedByUserId: userId,
    }).returning();

    res.status(201).json(row);
  } catch (err) {
    next(err);
  }
});

/* ── DELETE /api/ancestral-timeline/:ancestorId/events/:eventId ── */
router.delete("/:ancestorId/events/:eventId", requireAuth, async (req, res, next) => {
  try {
    const userId = (req as any).user?.dbId;
    if (!userId) { res.status(400).json({ error: "User not registered" }); return; }

    const eventId = parseInt(req.params.eventId as string, 10);
    if (isNaN(eventId)) { res.status(400).json({ error: "Invalid event id" }); return; }

    await db
      .delete(ancestralTimelineEventsTable)
      .where(and(
        eq(ancestralTimelineEventsTable.id, eventId),
        eq(ancestralTimelineEventsTable.addedByUserId, userId),
      ));

    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export default router;
