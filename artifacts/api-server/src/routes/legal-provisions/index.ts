import { Router } from "express";
import { db } from "@workspace/db";
import { legalProvisionsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { requireAuth } from "../../auth/entra-guard";

const router = Router();

/* ── GET /api/legal-provisions — list all provisions ── */
router.get("/", requireAuth, async (_req, res, next) => {
  try {
    const rows = await db
      .select()
      .from(legalProvisionsTable)
      .orderBy(legalProvisionsTable.category, legalProvisionsTable.title);
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

/* ── GET /api/legal-provisions/active — active provisions only (used by COMPANION context) ── */
router.get("/active", requireAuth, async (_req, res, next) => {
  try {
    const rows = await db
      .select()
      .from(legalProvisionsTable)
      .where(eq(legalProvisionsTable.status, "active"))
      .orderBy(legalProvisionsTable.category);
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

/* ── GET /api/legal-provisions/:id ── */
router.get("/:id", requireAuth, async (req, res, next) => {
  try {
    const id = parseInt(req.params.id as string, 10);
    if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
    const [row] = await db.select().from(legalProvisionsTable).where(eq(legalProvisionsTable.id, id)).limit(1);
    if (!row) { res.status(404).json({ error: "Not found" }); return; }
    res.json(row);
  } catch (err) {
    next(err);
  }
});

/* ── POST /api/legal-provisions — create ── */
router.post("/", requireAuth, async (req, res, next) => {
  try {
    const { title, category, purpose, content, keyStatutes, companionCategories, status } = req.body;
    if (!title || !category || !content) {
      res.status(400).json({ error: "title, category, and content are required" });
      return;
    }
    const [row] = await db.insert(legalProvisionsTable).values({
      title,
      category,
      purpose: purpose ?? "",
      content,
      keyStatutes: keyStatutes ?? [],
      companionCategories: companionCategories ?? [],
      status: status ?? "active",
    }).returning();
    res.status(201).json(row);
  } catch (err) {
    next(err);
  }
});

/* ── PATCH /api/legal-provisions/:id — update ── */
router.patch("/:id", requireAuth, async (req, res, next) => {
  try {
    const id = parseInt(req.params.id as string, 10);
    if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
    const { title, category, purpose, content, keyStatutes, companionCategories, status } = req.body;
    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (title !== undefined) updates.title = title;
    if (category !== undefined) updates.category = category;
    if (purpose !== undefined) updates.purpose = purpose;
    if (content !== undefined) updates.content = content;
    if (keyStatutes !== undefined) updates.keyStatutes = keyStatutes;
    if (companionCategories !== undefined) updates.companionCategories = companionCategories;
    if (status !== undefined) updates.status = status;
    const [row] = await db.update(legalProvisionsTable).set(updates).where(eq(legalProvisionsTable.id, id)).returning();
    if (!row) { res.status(404).json({ error: "Not found" }); return; }
    res.json(row);
  } catch (err) {
    next(err);
  }
});

/* ── DELETE /api/legal-provisions/:id ── */
router.delete("/:id", requireAuth, async (req, res, next) => {
  try {
    const id = parseInt(req.params.id as string, 10);
    if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
    await db.delete(legalProvisionsTable).where(eq(legalProvisionsTable.id, id));
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export default router;
