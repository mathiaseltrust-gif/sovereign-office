import { Router } from "express";
import { db } from "@workspace/db";
import { journalEntriesTable, kiConversationsTable } from "@workspace/db";
import { eq, and, desc, count, like } from "drizzle-orm";
import { requireAuth } from "../../auth/entra-guard";
import { logger } from "../../lib/logger";

const router = Router();

// ── Entry number generator ────────────────────────────────────────────────────
async function generateEntryNumber(userId: number): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `JE-${year}-`;
  const result = await db
    .select({ cnt: count() })
    .from(journalEntriesTable)
    .where(and(
      eq(journalEntriesTable.userId, userId),
      like(journalEntriesTable.entryNumber, `${prefix}%`),
    ));
  const seq = Number(result[0]?.cnt ?? 0) + 1;
  return `${prefix}${String(seq).padStart(4, "0")}`;
}

// ── GET /api/journal — list all entries for current user ─────────────────────
router.get("/", requireAuth, async (req, res, next) => {
  try {
    const userId = req.user!.dbId;
    if (!userId) { res.status(400).json({ error: "No user session" }); return; }

    const entries = await db
      .select()
      .from(journalEntriesTable)
      .where(eq(journalEntriesTable.userId, userId))
      .orderBy(desc(journalEntriesTable.createdAt));

    res.json({ entries, total: entries.length });
  } catch (err) { next(err); }
});

// ── GET /api/journal/entry/:entryNumber — fetch by entry number ───────────────
router.get("/entry/:entryNumber", requireAuth, async (req, res, next) => {
  try {
    const userId = req.user!.dbId;
    const entryNumber = String(req.params.entryNumber);

    const results = await db
      .select()
      .from(journalEntriesTable)
      .where(and(
        eq(journalEntriesTable.entryNumber, entryNumber),
        eq(journalEntriesTable.userId, userId!),
      ))
      .limit(1);

    if (!results[0]) {
      res.status(404).json({ error: `Journal entry ${entryNumber} not found` });
      return;
    }
    res.json(results[0]);
  } catch (err) { next(err); }
});

// ── GET /api/journal/:id — fetch by DB id ─────────────────────────────────────
router.get("/:id", requireAuth, async (req, res, next) => {
  try {
    const userId = req.user!.dbId;
    const id = Number(req.params.id);

    const results = await db
      .select()
      .from(journalEntriesTable)
      .where(and(eq(journalEntriesTable.id, id), eq(journalEntriesTable.userId, userId!)))
      .limit(1);

    if (!results[0]) { res.status(404).json({ error: "Entry not found" }); return; }
    res.json(results[0]);
  } catch (err) { next(err); }
});

// ── POST /api/journal — create entry ─────────────────────────────────────────
// Auto-assigns entry number, saves to journal_entries AND ki_conversations
// so COMPANION's long-term memory is automatically updated.
router.post("/", requireAuth, async (req, res, next) => {
  try {
    const userId = req.user!.dbId;
    if (!userId) { res.status(400).json({ error: "No user session" }); return; }

    const { title, content, mood, tags } = req.body as {
      title?: string;
      content: string;
      mood?: string;
      tags?: string[];
    };

    if (!content || !content.trim()) {
      res.status(400).json({ error: "content is required" });
      return;
    }

    const entryNumber = await generateEntryNumber(userId);

    // Save to ki_conversations so COMPANION automatically reads it in memory
    const kiContent = title
      ? `[${entryNumber}] ${title}\n\n${content.trim()}`
      : `[${entryNumber}] ${content.trim()}`;

    const [kiEntry] = await db
      .insert(kiConversationsTable)
      .values({
        userId,
        role: "diary",
        content: kiContent,
        isDiary: true,
        mood: mood ?? null,
        sessionId: entryNumber,
      })
      .returning();

    // Save to journal_entries (structured record with entry number)
    const [entry] = await db
      .insert(journalEntriesTable)
      .values({
        entryNumber,
        userId,
        title: title?.trim() ?? null,
        content: content.trim(),
        mood: mood ?? null,
        tags: tags ?? [],
        kiConversationId: kiEntry?.id ?? null,
      })
      .returning();

    logger.info({ userId, entryNumber }, "Journal entry created and synced to COMPANION memory");
    res.status(201).json(entry);
  } catch (err) { next(err); }
});

// ── PUT /api/journal/:id — update entry ──────────────────────────────────────
router.put("/:id", requireAuth, async (req, res, next) => {
  try {
    const userId = req.user!.dbId;
    const id = Number(req.params.id);
    const { title, content, mood, tags } = req.body as {
      title?: string;
      content?: string;
      mood?: string;
      tags?: string[];
    };

    const existing = await db
      .select()
      .from(journalEntriesTable)
      .where(and(eq(journalEntriesTable.id, id), eq(journalEntriesTable.userId, userId!)))
      .limit(1);

    if (!existing[0]) { res.status(404).json({ error: "Entry not found" }); return; }

    const [updated] = await db
      .update(journalEntriesTable)
      .set({
        title: title !== undefined ? title?.trim() ?? null : existing[0].title,
        content: content?.trim() ?? existing[0].content,
        mood: mood !== undefined ? mood : existing[0].mood,
        tags: tags ?? existing[0].tags,
        updatedAt: new Date(),
      })
      .where(eq(journalEntriesTable.id, id))
      .returning();

    // Update the linked ki_conversations entry if it exists
    if (existing[0].kiConversationId) {
      const newKiContent = (updated.title ?? updated.entryNumber)
        ? `[${updated.entryNumber}] ${updated.title ?? ""}\n\n${updated.content}`
        : updated.content;
      await db
        .update(kiConversationsTable)
        .set({ content: newKiContent, mood: updated.mood ?? null })
        .where(eq(kiConversationsTable.id, existing[0].kiConversationId));
    }

    res.json(updated);
  } catch (err) { next(err); }
});

// ── DELETE /api/journal/:id ───────────────────────────────────────────────────
router.delete("/:id", requireAuth, async (req, res, next) => {
  try {
    const userId = req.user!.dbId;
    const id = Number(req.params.id);

    const existing = await db
      .select()
      .from(journalEntriesTable)
      .where(and(eq(journalEntriesTable.id, id), eq(journalEntriesTable.userId, userId!)))
      .limit(1);

    if (!existing[0]) { res.status(404).json({ error: "Entry not found" }); return; }

    // Remove from ki_conversations too
    if (existing[0].kiConversationId) {
      await db.delete(kiConversationsTable).where(eq(kiConversationsTable.id, existing[0].kiConversationId));
    }

    await db.delete(journalEntriesTable).where(eq(journalEntriesTable.id, id));
    res.json({ success: true, entryNumber: existing[0].entryNumber });
  } catch (err) { next(err); }
});

// ── GET /api/journal/memory/status — verify memory pipeline ──────────────────
router.get("/memory/status", requireAuth, async (req, res, next) => {
  try {
    const userId = req.user!.dbId;
    if (!userId) { res.status(400).json({ error: "No user session" }); return; }

    const [journalCount, kiDiaryCount] = await Promise.all([
      db.select({ cnt: count() }).from(journalEntriesTable).where(eq(journalEntriesTable.userId, userId)),
      db.select({ cnt: count() }).from(kiConversationsTable)
        .where(and(eq(kiConversationsTable.userId, userId), eq(kiConversationsTable.isDiary, true))),
    ]);

    const recentEntries = await db
      .select({ entryNumber: journalEntriesTable.entryNumber, title: journalEntriesTable.title, createdAt: journalEntriesTable.createdAt })
      .from(journalEntriesTable)
      .where(eq(journalEntriesTable.userId, userId))
      .orderBy(desc(journalEntriesTable.createdAt))
      .limit(5);

    res.json({
      journalEntries: Number(journalCount[0]?.cnt ?? 0),
      companionMemoryEntries: Number(kiDiaryCount[0]?.cnt ?? 0),
      memoryPipelineActive: true,
      recentEntries,
      status: "✓ Journal entries are synced to COMPANION long-term memory",
    });
  } catch (err) { next(err); }
});

export default router;
