import { Router } from "express";
import { db } from "@workspace/db";
import { templatesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth, requireRole } from "../../auth/entra-guard";

const router = Router();

router.get("/", async (_req, res, next) => {
  try {
    const templates = await db.select().from(templatesTable).orderBy(templatesTable.createdAt);
    res.json(templates);
  } catch (err) {
    next(err);
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const results = await db.select().from(templatesTable).where(eq(templatesTable.id, id)).limit(1);
    if (!results[0]) {
      res.status(404).json({ error: "Template not found" });
      return;
    }
    res.json(results[0]);
  } catch (err) {
    next(err);
  }
});

router.post("/", requireAuth, requireRole("trustee"), async (req, res, next) => {
  try {
    const { name, content, jurisdiction } = req.body as { name: string; content: string; jurisdiction?: string };
    if (!name || !content) {
      res.status(400).json({ error: "name and content are required" });
      return;
    }
    const userId = req.user ? Number(req.user.id) : null;
    const created = await db
      .insert(templatesTable)
      .values({ name, content, jurisdiction, createdBy: userId ?? undefined })
      .returning();
    res.status(201).json(created[0]);
  } catch (err) {
    next(err);
  }
});

router.put("/:id", requireAuth, requireRole("trustee"), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const { name, content, jurisdiction } = req.body as Partial<{ name: string; content: string; jurisdiction: string }>;
    const existing = await db.select().from(templatesTable).where(eq(templatesTable.id, id)).limit(1);
    if (!existing[0]) {
      res.status(404).json({ error: "Template not found" });
      return;
    }
    const updated = await db
      .update(templatesTable)
      .set({
        name: name ?? existing[0].name,
        content: content ?? existing[0].content,
        jurisdiction: jurisdiction ?? existing[0].jurisdiction,
        version: existing[0].version + 1,
        updatedAt: new Date(),
      })
      .where(eq(templatesTable.id, id))
      .returning();
    res.json(updated[0]);
  } catch (err) {
    next(err);
  }
});

router.delete("/:id", requireAuth, requireRole("admin"), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    await db.delete(templatesTable).where(eq(templatesTable.id, id));
    res.json({ success: true, message: `Template ${id} deleted` });
  } catch (err) {
    next(err);
  }
});

router.post("/:id/publish", requireAuth, requireRole("trustee"), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const updated = await db
      .update(templatesTable)
      .set({ status: "published", updatedAt: new Date() })
      .where(eq(templatesTable.id, id))
      .returning();
    if (!updated[0]) {
      res.status(404).json({ error: "Template not found" });
      return;
    }
    res.json({ success: true, template: updated[0] });
  } catch (err) {
    next(err);
  }
});

router.post("/:id/revoke", requireAuth, requireRole("trustee"), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const updated = await db
      .update(templatesTable)
      .set({ status: "revoked", updatedAt: new Date() })
      .where(eq(templatesTable.id, id))
      .returning();
    if (!updated[0]) {
      res.status(404).json({ error: "Template not found" });
      return;
    }
    res.json({ success: true, template: updated[0] });
  } catch (err) {
    next(err);
  }
});

export default router;
