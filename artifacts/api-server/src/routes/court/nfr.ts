import { Router } from "express";
import { db } from "@workspace/db";
import { nfrDocumentsTable, classificationsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth, requireRole } from "../../auth/entra-guard";
import { buildNfrRecorderPdf } from "../../lib/pdf-builder";

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

router.get("/:id/pdf", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const results = await db
      .select({ id: nfrDocumentsTable.id, content: nfrDocumentsTable.content, classificationId: nfrDocumentsTable.classificationId })
      .from(nfrDocumentsTable)
      .where(eq(nfrDocumentsTable.id, id))
      .limit(1);

    if (!results[0]) {
      res.status(404).json({ error: "NFR document not found" });
      return;
    }

    let classData: Record<string, string> = {};
    try {
      const cls = await db
        .select()
        .from(classificationsTable)
        .where(eq(classificationsTable.id, results[0].classificationId))
        .limit(1);
      if (cls[0]) {
        classData = {
          actorType: cls[0].actorType,
          landStatus: cls[0].landStatus,
          actionType: cls[0].actionType,
          rawText: cls[0].rawText,
        };
      }
    } catch {
      // non-fatal
    }

    const pdfResult = await buildNfrRecorderPdf(id, results[0].content, classData);

    await db
      .update(nfrDocumentsTable)
      .set({ pdfUrl: `/api/court/nfr/${id}/pdf`, updatedAt: new Date() })
      .where(eq(nfrDocumentsTable.id, id));

    const filename = `nfr-${id}.pdf`;
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(pdfResult.buffer);
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
        pdfUrl: null,
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

    let classData: Record<string, string> = {};
    try {
      const cls = await db
        .select()
        .from(classificationsTable)
        .where(eq(classificationsTable.id, results[0].classificationId))
        .limit(1);
      if (cls[0]) classData = { actorType: cls[0].actorType, landStatus: cls[0].landStatus, actionType: cls[0].actionType, rawText: cls[0].rawText };
    } catch { /* non-fatal */ }

    const pdfResult = await buildNfrRecorderPdf(id, results[0].content, classData);
    const pdfUrl = `/api/court/nfr/${id}/pdf`;

    await db
      .update(nfrDocumentsTable)
      .set({ pdfUrl, updatedAt: new Date() })
      .where(eq(nfrDocumentsTable.id, id));

    res.json({
      success: true,
      pdfUrl,
      downloadUrl: pdfUrl,
      pages: pdfResult.pageCount,
      checksum: pdfResult.checksum,
      generatedAt: pdfResult.generatedAt,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
