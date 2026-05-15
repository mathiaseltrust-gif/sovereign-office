import { Router } from "express";
import { db } from "@workspace/db";
import { ancestralMemoriesTable } from "@workspace/db";
import { eq, desc, sql } from "drizzle-orm";
import { requireAuth } from "../../auth/entra-guard";

const router = Router();

// ── GET /api/ancestral-memories ───────────────────────────────────────────────
// List all memories visible to the current user.
// Query params: ?memberId=&ancestorId=&topic=&era=&limit=&offset=
router.get("/", requireAuth, async (req, res, next) => {
  try {
    const { memberId, ancestorId, topic, era, limit = "50", offset = "0" } = req.query as Record<string, string>;

    let query = db.select().from(ancestralMemoriesTable).$dynamic();

    if (era) {
      query = query.where(eq(ancestralMemoriesTable.memoryEra, era));
    }

    const memories = await query
      .orderBy(desc(ancestralMemoriesTable.createdAt))
      .limit(Number(limit))
      .offset(Number(offset));

    // Filter by tagged member or ancestor in JS (jsonb array filter)
    let filtered = memories;
    if (memberId) {
      filtered = filtered.filter(m => {
        const ids = m.taggedMemberIds as number[];
        return ids?.includes(Number(memberId));
      });
    }
    if (ancestorId) {
      filtered = filtered.filter(m => {
        const ids = m.taggedAncestorIds as number[];
        return ids?.includes(Number(ancestorId));
      });
    }
    if (topic) {
      filtered = filtered.filter(m => {
        const topics = m.topics as string[];
        return topics?.includes(topic);
      });
    }

    res.json(filtered);
  } catch (err) {
    next(err);
  }
});

// ── GET /api/ancestral-memories/:id ──────────────────────────────────────────
router.get("/:id", requireAuth, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const results = await db.select().from(ancestralMemoriesTable).where(eq(ancestralMemoriesTable.id, id)).limit(1);
    if (!results[0]) {
      res.status(404).json({ error: "Memory not found" });
      return;
    }
    res.json(results[0]);
  } catch (err) {
    next(err);
  }
});

// ── POST /api/ancestral-memories ─────────────────────────────────────────────
router.post("/", requireAuth, async (req, res, next) => {
  try {
    const user = req.user;
    const authorMemberId = user?.dbId ?? null;

    const {
      title, body, memoryDate, memoryEra, taggedMemberIds, taggedAncestorIds,
      taggedPeopleNames, topics, location, emotionalTone, visibility, isHistoricalEvent,
    } = req.body as {
      title: string;
      body: string;
      memoryDate?: string;
      memoryEra?: string;
      taggedMemberIds?: number[];
      taggedAncestorIds?: number[];
      taggedPeopleNames?: { name: string; relation: string }[];
      topics?: string[];
      location?: string;
      emotionalTone?: string;
      visibility?: string;
      isHistoricalEvent?: boolean;
    };

    if (!title || !body) {
      res.status(400).json({ error: "title and body are required" });
      return;
    }

    const [created] = await db
      .insert(ancestralMemoriesTable)
      .values({
        authorMemberId,
        title,
        body,
        memoryDate,
        memoryEra,
        taggedMemberIds: taggedMemberIds ?? [],
        taggedAncestorIds: taggedAncestorIds ?? [],
        taggedPeopleNames: taggedPeopleNames ?? [],
        topics: topics ?? [],
        location,
        emotionalTone: (emotionalTone as "joy" | "grief" | "pride" | "gratitude" | "warning" | "neutral") ?? "neutral",
        visibility: (visibility as "tribe" | "family" | "private") ?? "tribe",
        isHistoricalEvent: isHistoricalEvent ?? false,
      })
      .returning();

    res.status(201).json(created);
  } catch (err) {
    next(err);
  }
});

// ── PUT /api/ancestral-memories/:id ──────────────────────────────────────────
router.put("/:id", requireAuth, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const user = req.user;

    const existing = await db.select().from(ancestralMemoriesTable).where(eq(ancestralMemoriesTable.id, id)).limit(1);
    if (!existing[0]) {
      res.status(404).json({ error: "Memory not found" });
      return;
    }

    const isAuthor = existing[0].authorMemberId === user?.dbId;
    const isTrustee = (user as Record<string, unknown>)?.role === "trustee" || (user as Record<string, unknown>)?.role === "sovereign_admin";
    if (!isAuthor && !isTrustee) {
      res.status(403).json({ error: "Not authorized to edit this memory" });
      return;
    }

    const {
      title, body, memoryDate, memoryEra, taggedMemberIds, taggedAncestorIds,
      taggedPeopleNames, topics, location, emotionalTone, visibility, isHistoricalEvent,
    } = req.body as Partial<{
      title: string; body: string; memoryDate: string; memoryEra: string;
      taggedMemberIds: number[]; taggedAncestorIds: number[];
      taggedPeopleNames: { name: string; relation: string }[];
      topics: string[]; location: string; emotionalTone: string;
      visibility: string; isHistoricalEvent: boolean;
    }>;

    const [updated] = await db
      .update(ancestralMemoriesTable)
      .set({
        title: title ?? existing[0].title,
        body: body ?? existing[0].body,
        memoryDate: memoryDate ?? existing[0].memoryDate,
        memoryEra: memoryEra ?? existing[0].memoryEra,
        taggedMemberIds: taggedMemberIds ?? existing[0].taggedMemberIds,
        taggedAncestorIds: taggedAncestorIds ?? existing[0].taggedAncestorIds,
        taggedPeopleNames: taggedPeopleNames ?? existing[0].taggedPeopleNames,
        topics: topics ?? existing[0].topics,
        location: location ?? existing[0].location,
        emotionalTone: (emotionalTone ?? existing[0].emotionalTone) as "joy" | "grief" | "pride" | "gratitude" | "warning" | "neutral",
        visibility: (visibility ?? existing[0].visibility) as "tribe" | "family" | "private",
        isHistoricalEvent: isHistoricalEvent ?? existing[0].isHistoricalEvent,
        updatedAt: new Date(),
      })
      .where(eq(ancestralMemoriesTable.id, id))
      .returning();

    res.json(updated);
  } catch (err) {
    next(err);
  }
});

// ── DELETE /api/ancestral-memories/:id ───────────────────────────────────────
router.delete("/:id", requireAuth, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const user = req.user;

    const existing = await db.select().from(ancestralMemoriesTable).where(eq(ancestralMemoriesTable.id, id)).limit(1);
    if (!existing[0]) {
      res.status(404).json({ error: "Memory not found" });
      return;
    }

    const isAuthor = existing[0].authorMemberId === user?.dbId;
    const isTrustee = (user as Record<string, unknown>)?.role === "trustee" || (user as Record<string, unknown>)?.role === "sovereign_admin";
    if (!isAuthor && !isTrustee) {
      res.status(403).json({ error: "Not authorized to delete this memory" });
      return;
    }

    await db.delete(ancestralMemoriesTable).where(eq(ancestralMemoriesTable.id, id));
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// ── GET /api/ancestral-memories/stats/summary ─────────────────────────────────
router.get("/stats/summary", requireAuth, async (_req, res, next) => {
  try {
    const rows = await db.select({
      total: sql<number>`count(*)::int`,
    }).from(ancestralMemoriesTable);
    res.json({ total: rows[0]?.total ?? 0 });
  } catch (err) {
    next(err);
  }
});

export default router;
