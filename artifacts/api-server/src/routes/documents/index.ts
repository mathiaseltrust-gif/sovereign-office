import { Router } from "express";
import { db } from "@workspace/db";
import { nfrDocumentsTable, trustInstrumentsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth } from "../../auth/entra-guard";
import { buildNfrPdfBuffer, buildInstrumentPdfBuffer, type PdfBuildInput } from "../../lib/pdf-builder";
import { logger } from "../../lib/logger";

const router = Router();

router.get("/nfr/:id/pdf", requireAuth, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) {
      res.status(400).json({ error: "Invalid document ID" });
      return;
    }

    const results = await db
      .select()
      .from(nfrDocumentsTable)
      .where(eq(nfrDocumentsTable.id, id))
      .limit(1);

    if (!results[0]) {
      res.status(404).json({ error: "NFR document not found" });
      return;
    }

    const doc = results[0];
    logger.info({ nfrId: id }, "Generating NFR PDF");
    const pdfBuffer = await buildNfrPdfBuffer(id, doc.content);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="nfr-document-${id}.pdf"`);
    res.setHeader("Content-Length", pdfBuffer.length);
    res.send(pdfBuffer);
  } catch (err) {
    next(err);
  }
});

router.get("/instrument/:id/pdf", requireAuth, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) {
      res.status(400).json({ error: "Invalid instrument ID" });
      return;
    }

    const results = await db
      .select({
        id: trustInstrumentsTable.id,
        content: trustInstrumentsTable.content,
        title: trustInstrumentsTable.title,
        jurisdiction: trustInstrumentsTable.jurisdiction,
        landJson: trustInstrumentsTable.landJson,
        partiesJson: trustInstrumentsTable.partiesJson,
        provisionsJson: trustInstrumentsTable.provisionsJson,
        recorderMetadata: trustInstrumentsTable.recorderMetadata,
        trusteeNotes: trustInstrumentsTable.trusteeNotes,
      })
      .from(trustInstrumentsTable)
      .where(eq(trustInstrumentsTable.id, id))
      .limit(1);

    if (!results[0]) {
      res.status(404).json({ error: "Trust instrument not found" });
      return;
    }

    const inst = results[0];
    logger.info({ instrumentId: id }, "Generating instrument PDF");

    const inputOverride: Partial<PdfBuildInput> = {
      title: inst.title,
      parties: (inst.partiesJson ?? {}) as Record<string, string>,
      land: (inst.landJson ?? {}) as PdfBuildInput["land"],
      provisions: (inst.provisionsJson as unknown as string[]) ?? [],
      trusteeNotes: inst.trusteeNotes ?? undefined,
      recorderMetadata: (inst.recorderMetadata ?? {}) as PdfBuildInput["recorderMetadata"],
    };

    const pdfBuffer = await buildInstrumentPdfBuffer(id, inst.content, inst.jurisdiction ?? "", inputOverride);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="trust-instrument-${id}.pdf"`);
    res.setHeader("Content-Length", pdfBuffer.length);
    res.send(pdfBuffer);
  } catch (err) {
    next(err);
  }
});

export default router;
