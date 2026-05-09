import { Router } from "express";
import multer from "multer";
import { db } from "@workspace/db";
import {
  classificationsTable,
  nfrDocumentsTable,
  tasksTable,
  calendarEventsTable,
  searchIndexTable,
} from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth, requireRole } from "../../auth/entra-guard";
import { classifyText, applyDoctrine } from "../../lib/doctrine";
import { buildNfrRecorderPdf } from "../../lib/pdf-builder";

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

router.post("/", requireAuth, requireRole("officer"), upload.single("pdf"), async (req, res, next) => {
  try {
    const text: string =
      req.body.text ??
      (req.file ? `[PDF: ${req.file.originalname}] ${req.file.buffer.toString("utf8", 0, 2000)}` : "");

    if (!text.trim()) {
      res.status(400).json({ error: "Provide text or a PDF file for classification" });
      return;
    }

    const sourceType = req.file ? "pdf" : "text";
    const { actorType, landStatus, actionType } = classifyText(text);
    const doctrine = applyDoctrine({ actorType, landStatus, actionType, rawText: text });

    const [classification] = await db
      .insert(classificationsTable)
      .values({
        actorType,
        landStatus,
        actionType,
        rawText: text.substring(0, 5000),
        sourceType,
        doctrineApplied: doctrine,
      })
      .returning();

    if (!classification) {
      res.status(500).json({ error: "Failed to store classification" });
      return;
    }

    const nfrContent = [
      `NON-FEDERAL RECORD (NFR)`,
      `Classification ID: ${classification.id}`,
      `Actor Type: ${actorType}`,
      `Land Status: ${landStatus}`,
      `Action Type: ${actionType}`,
      ``,
      `DOCTRINES APPLIED:`,
      ...doctrine.doctrinesApplied.map((d) => `  - ${d}`),
      ``,
      `FEDERAL LAW:`,
      ...doctrine.federalLaw.map((l) => `  - ${l}`),
      ``,
      `SOVEREIGNTY GUARDRAILS:`,
      ...doctrine.guardrails.map((g) => `  - ${g}`),
      ``,
      `RECOMMENDATION: ${doctrine.recommendation}`,
    ].join("\n");

    const [nfr] = await db
      .insert(nfrDocumentsTable)
      .values({
        classificationId: classification.id,
        doctrineApplied: doctrine,
        content: nfrContent,
        status: "draft",
      })
      .returning();

    if (!nfr) {
      res.status(500).json({ error: "Failed to create NFR document" });
      return;
    }

    await buildNfrRecorderPdf(nfr.id, nfrContent);
    const nfrPdfUrl = `/api/court/nfr/${nfr.id}/pdf`;
    await db
      .update(nfrDocumentsTable)
      .set({ pdfUrl: nfrPdfUrl, updatedAt: new Date() })
      .where(eq(nfrDocumentsTable.id, nfr.id));

    const dueDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    const [calEvent] = await db
      .insert(calendarEventsTable)
      .values({
        title: `NFR Review Deadline — ${actionType} (${landStatus})`,
        description: `Review NFR Document #${nfr.id} by this date. Classification: ${actorType}/${landStatus}/${actionType}`,
        date: dueDate,
        type: "nfr_deadline",
        relatedId: nfr.id,
        relatedType: "nfr",
      })
      .returning();

    const [task] = await db
      .insert(tasksTable)
      .values({
        title: `Review NFR #${nfr.id} — ${actionType}`,
        description: `Classify and finalize NFR for: ${actorType} — ${landStatus} — ${actionType}`,
        dueDate,
        status: "pending",
        assignedTo: req.user ? Number(req.user.id) : undefined,
        nfrId: nfr.id,
        calendarEventId: calEvent?.id,
      })
      .returning();

    await db.insert(searchIndexTable).values({
      entityType: "classification",
      entityId: String(classification.id),
      content: `${actorType} ${landStatus} ${actionType} ${text.substring(0, 500)}`,
      metadata: { actorType, landStatus, actionType, nfrId: nfr.id },
    });

    res.status(201).json({
      classification,
      nfr: { ...nfr, pdfUrl: nfrPdfUrl },
      task,
      calendarEvent: calEvent,
      doctrine,
    });
  } catch (err) {
    next(err);
  }
});

router.get("/", requireAuth, async (_req, res, next) => {
  try {
    const classifications = await db
      .select()
      .from(classificationsTable)
      .orderBy(classificationsTable.createdAt);
    res.json(classifications);
  } catch (err) {
    next(err);
  }
});

export default router;
