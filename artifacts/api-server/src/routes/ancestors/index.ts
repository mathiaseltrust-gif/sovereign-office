import { Router } from "express";
import { db } from "@workspace/db";
import { familyLineageTable, ancestralMemoriesTable, importantDatesTable } from "@workspace/db";
import { eq, or, desc } from "drizzle-orm";
import { requireAuth } from "../../auth/entra-guard";

const router = Router();

// ── GET /api/ancestors ─────────────────────────────────────────────────────
// List deceased / ancestor family lineage entries for the current member.
router.get("/", requireAuth, async (req, res, next) => {
  try {
    const userId = req.user?.dbId;
    if (!userId) {
      res.status(400).json({ error: "User must be registered" });
      return;
    }

    const rows = await db
      .select({
        id: familyLineageTable.id,
        fullName: familyLineageTable.fullName,
        firstName: familyLineageTable.firstName,
        lastName: familyLineageTable.lastName,
        birthYear: familyLineageTable.birthYear,
        deathYear: familyLineageTable.deathYear,
        tribalNation: familyLineageTable.tribalNation,
        notes: familyLineageTable.notes,
        photoUrl: familyLineageTable.photoUrl,
        generationalPosition: familyLineageTable.generationalPosition,
        isDeceased: familyLineageTable.isDeceased,
        isAncestor: familyLineageTable.isAncestor,
        addedByMemberId: familyLineageTable.addedByMemberId,
      })
      .from(familyLineageTable)
      .where(
        or(
          eq(familyLineageTable.addedByMemberId, userId),
          eq(familyLineageTable.userId, userId),
        )
      )
      .orderBy(familyLineageTable.generationalPosition, familyLineageTable.fullName);

    const ancestors = rows.filter(r => r.isDeceased || r.isAncestor);
    res.json(ancestors);
  } catch (err) {
    next(err);
  }
});

// ── GET /api/ancestors/:id ─────────────────────────────────────────────────
// Ancestor detail + all memories tagged to this ancestor.
router.get("/:id", requireAuth, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!id) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }

    const [ancestor] = await db
      .select()
      .from(familyLineageTable)
      .where(eq(familyLineageTable.id, id))
      .limit(1);

    if (!ancestor) {
      res.status(404).json({ error: "Ancestor not found" });
      return;
    }

    const allMemories = await db
      .select()
      .from(ancestralMemoriesTable)
      .orderBy(desc(ancestralMemoriesTable.createdAt))
      .limit(100);

    const memories = allMemories.filter(m => {
      const tagged = m.taggedAncestorIds as number[];
      return Array.isArray(tagged) && tagged.includes(id);
    });

    const anniversaries = await db
      .select()
      .from(importantDatesTable)
      .where(eq(importantDatesTable.sourceKey, `ancestor:${id}`))
      .orderBy(importantDatesTable.month, importantDatesTable.day);

    res.json({ ancestor, memories, anniversaries });
  } catch (err) {
    next(err);
  }
});

// ── POST /api/ancestors/:id/memories ──────────────────────────────────────
// Contribute a memory for this ancestor (creates an ancestralMemory tagged to them).
router.post("/:id/memories", requireAuth, async (req, res, next) => {
  try {
    const ancestorId = Number(req.params.id);
    const userId = req.user?.dbId;
    if (!ancestorId) {
      res.status(400).json({ error: "Invalid ancestor id" });
      return;
    }

    const [ancestor] = await db
      .select({ id: familyLineageTable.id, fullName: familyLineageTable.fullName })
      .from(familyLineageTable)
      .where(eq(familyLineageTable.id, ancestorId))
      .limit(1);

    if (!ancestor) {
      res.status(404).json({ error: "Ancestor not found" });
      return;
    }

    const {
      title,
      body,
      memoryDate,
      emotionalTone,
      visibility,
      topics,
      location,
    } = req.body as {
      title: string;
      body: string;
      memoryDate?: string;
      emotionalTone?: string;
      visibility?: string;
      topics?: string[];
      location?: string;
    };

    if (!title || !body) {
      res.status(400).json({ error: "title and body are required" });
      return;
    }

    const [created] = await db
      .insert(ancestralMemoriesTable)
      .values({
        authorMemberId: userId ?? null,
        title,
        body,
        memoryDate: memoryDate ?? null,
        taggedAncestorIds: [ancestorId],
        taggedPeopleNames: [{ name: ancestor.fullName, relation: "ancestor" }],
        topics: topics ?? [],
        location: location ?? null,
        emotionalTone: (emotionalTone as "joy" | "grief" | "pride" | "gratitude" | "warning" | "neutral") ?? "neutral",
        visibility: (visibility as "tribe" | "family" | "private") ?? "tribe",
      })
      .returning();

    res.status(201).json(created);
  } catch (err) {
    next(err);
  }
});

// ── POST /api/ancestors/:id/anniversary ───────────────────────────────────
// Add an important date (birthday or memorial anniversary) for this ancestor.
router.post("/:id/anniversary", requireAuth, async (req, res, next) => {
  try {
    const ancestorId = Number(req.params.id);
    const userId = req.user?.dbId;
    if (!ancestorId) {
      res.status(400).json({ error: "Invalid ancestor id" });
      return;
    }

    const [ancestor] = await db
      .select({ fullName: familyLineageTable.fullName })
      .from(familyLineageTable)
      .where(eq(familyLineageTable.id, ancestorId))
      .limit(1);

    if (!ancestor) {
      res.status(404).json({ error: "Ancestor not found" });
      return;
    }

    const { dateType, month, day, year, notes, customLabel } = req.body as {
      dateType: string;
      month: number;
      day: number;
      year?: number;
      notes?: string;
      customLabel?: string;
    };

    if (!dateType || !month || !day) {
      res.status(400).json({ error: "dateType, month, and day are required" });
      return;
    }

    const [created] = await db
      .insert(importantDatesTable)
      .values({
        personName: ancestor.fullName,
        relation: "ancestor",
        dateType,
        month: Number(month),
        day: Number(day),
        year: year ? Number(year) : null,
        notes: notes ?? null,
        customLabel: customLabel ?? null,
        addedByUserId: userId ?? null,
        sourceKey: `ancestor:${ancestorId}`,
      })
      .returning();

    res.status(201).json(created);
  } catch (err) {
    next(err);
  }
});

export default router;
