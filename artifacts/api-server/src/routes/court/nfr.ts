import { Router } from "express";
import { db } from "@workspace/db";
import { nfrDocumentsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth, requireRole } from "../../auth/entra-guard";
import { buildNfrPdf } from "../../lib/pdf-builder";

const router = Router();

router.get("/", requireAuth, async (_req, res, next) => {
  try {
    const docs = await db.select().from(nfrDocumentsTable).orderBy(nfrDocumentsTable.createdAt);
    res.json(docs);
  } catch (err) {
    next(err);
  }
});

router.get("/:id", requireAuth, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const results = await db.select().from(nfrDocumentsTable).where(eq(nfrDocumentsTable.id, id)).limit(1);
    if (!results[0]) {
      res.status(404).json({ error: "NFR document not found" });
      return;
    }
    res.json(results[0]);
  } catch (err) {
    next(err);
  }
});

router.put("/:id", requireAuth, requireRole("officer"), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const { content, status } = req.body as { content?: string; status?: string };
    const existing = await db.select().from(nfrDocumentsTable).where(eq(nfrDocumentsTable.id, id)).limit(1);
    if (!existing[0]) {
      res.status(404).json({ error: "NFR document not found" });
      return;
    }
    const updated = await db
      .update(nfrDocumentsTable)
      .set({
        content: content ?? existing[0].content,
        status: status ?? existing[0].status,
        updatedAt: new Date(),
      })
      .where(eq(nfrDocumentsTable.id, id))
      .returning();
    res.json(updated[0]);
  } catch (err) {
    next(err);
  }
});

router.post("/:id/export-pdf", requireAuth, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const results = await db.select().from(nfrDocumentsTable).where(eq(nfrDocumentsTable.id, id)).limit(1);
    if (!results[0]) {
      res.status(404).json({ error: "NFR document not found" });
      return;
    }
    const pdfResult = buildNfrPdf(id, results[0].content);
    await db
      .update(nfrDocumentsTable)
      .set({ pdfUrl: pdfResult.pdfUrl, updatedAt: new Date() })
      .where(eq(nfrDocumentsTable.id, id));
    res.json(pdfResult);
  } catch (err) {
    next(err);
  }
});

export default router;
