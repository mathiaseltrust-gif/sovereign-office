import { Router } from "express";
import { db } from "@workspace/db";
import {
  trustInstrumentsTable,
  trustFilingsTable,
  searchIndexTable,
} from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth, requireRole } from "../../auth/entra-guard";
import {
  buildInstrumentContent,
  validateInstrumentForRecorder,
  DEFAULT_RECORDER_FORMAT,
  type InstrumentOptions,
} from "../../sovereign/trust-service";
import {
  buildRecorderPdf,
  buildInstrumentRecorderPdf,
  type PdfBuildInput,
} from "../../lib/pdf-builder";
import {
  validateRecorderDocument,
  validateMargins,
  DEFAULT_RECORDER_SPEC,
  DOCTRINE_RECORDER_SPEC,
  isDoctrineTemplate,
} from "../../sovereign/recorder-engine";
import { getStateIntel, getIndianLandClassification } from "../../sovereign/state-intel";
import { renderTemplate, getBuiltInTemplate, listBuiltInTemplates } from "../../sovereign/template-engine";

const router = Router();

router.get("/", async (_req, res, next) => {
  try {
    const instruments = await db
      .select({
        id: trustInstrumentsTable.id,
        title: trustInstrumentsTable.title,
        instrumentType: trustInstrumentsTable.instrumentType,
        status: trustInstrumentsTable.status,
        jurisdiction: trustInstrumentsTable.jurisdiction,
        state: trustInstrumentsTable.state,
        county: trustInstrumentsTable.county,
        landClassification: trustInstrumentsTable.landClassification,
        pdfUrl: trustInstrumentsTable.pdfUrl,
        validationErrors: trustInstrumentsTable.validationErrors,
        createdAt: trustInstrumentsTable.createdAt,
        updatedAt: trustInstrumentsTable.updatedAt,
      })
      .from(trustInstrumentsTable)
      .orderBy(trustInstrumentsTable.createdAt);
    res.json(instruments);
  } catch (err) {
    next(err);
  }
});

router.get("/templates", async (_req, res, next) => {
  try {
    res.json({ templates: listBuiltInTemplates() });
  } catch (err) {
    next(err);
  }
});

router.get("/templates/:key", async (req, res, next) => {
  try {
    const tpl = getBuiltInTemplate(req.params.key);
    if (!tpl) {
      res.status(404).json({ error: "Template not found" });
      return;
    }
    res.json(tpl);
  } catch (err) {
    next(err);
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const results = await db
      .select({
        id: trustInstrumentsTable.id,
        title: trustInstrumentsTable.title,
        instrumentType: trustInstrumentsTable.instrumentType,
        content: trustInstrumentsTable.content,
        landJson: trustInstrumentsTable.landJson,
        partiesJson: trustInstrumentsTable.partiesJson,
        provisionsJson: trustInstrumentsTable.provisionsJson,
        recorderMetadata: trustInstrumentsTable.recorderMetadata,
        trusteeNotes: trustInstrumentsTable.trusteeNotes,
        status: trustInstrumentsTable.status,
        jurisdiction: trustInstrumentsTable.jurisdiction,
        state: trustInstrumentsTable.state,
        county: trustInstrumentsTable.county,
        landClassification: trustInstrumentsTable.landClassification,
        pdfUrl: trustInstrumentsTable.pdfUrl,
        validationErrors: trustInstrumentsTable.validationErrors,
        versionHistory: trustInstrumentsTable.versionHistory,
        createdAt: trustInstrumentsTable.createdAt,
        updatedAt: trustInstrumentsTable.updatedAt,
      })
      .from(trustInstrumentsTable)
      .where(eq(trustInstrumentsTable.id, id))
      .limit(1);

    if (!results[0]) {
      res.status(404).json({ error: "Instrument not found" });
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
      .select({ pdfBuffer: trustInstrumentsTable.pdfBuffer, title: trustInstrumentsTable.title, status: trustInstrumentsTable.status })
      .from(trustInstrumentsTable)
      .where(eq(trustInstrumentsTable.id, id))
      .limit(1);

    if (!results[0]) {
      res.status(404).json({ error: "Instrument not found" });
      return;
    }
    if (!results[0].pdfBuffer) {
      res.status(404).json({ error: "PDF not yet generated. POST /api/trust/instruments/:id/generate-pdf first." });
      return;
    }
    const filename = `trust-instrument-${id}.pdf`.replace(/[^a-zA-Z0-9.-]/g, "_");
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(results[0].pdfBuffer);
  } catch (err) {
    next(err);
  }
});

router.get("/:id/filings", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const filings = await db
      .select()
      .from(trustFilingsTable)
      .where(eq(trustFilingsTable.instrumentId, id));
    res.json(filings);
  } catch (err) {
    next(err);
  }
});

router.post("/", requireAuth, requireRole("trustee"), async (req, res, next) => {
  try {
    const body = req.body as Partial<InstrumentOptions> & {
      state?: string;
      templateKey?: string;
      templateVariables?: Array<{ key: string; value: string }>;
      pdfInput?: Partial<PdfBuildInput>;
    };

    let pdfInput: PdfBuildInput | null = null;
    let content = "";
    let instrumentTitle = body.title ?? "";

    if (body.templateKey) {
      const rendered = await renderTemplate(
        body.templateKey,
        body.templateVariables ?? [],
        { ...(body.recorderMetadata ?? {}), documentType: "TRUST INSTRUMENT" },
      );
      if (!rendered) {
        res.status(400).json({ error: `Template '${body.templateKey}' not found. Available: ${listBuiltInTemplates().join(", ")}` });
        return;
      }
      pdfInput = rendered.pdfInput;
      content = rendered.content;
      instrumentTitle = rendered.title;
    } else {
      const { type, parties, landDescription, jurisdiction } = body;
      if (!type || !parties || !landDescription || !jurisdiction) {
        res.status(400).json({ error: "type, parties, landDescription, and jurisdiction are required (or provide templateKey)" });
        return;
      }

      const opts: InstrumentOptions = {
        type,
        parties: Array.isArray(parties) ? parties : [String(parties)],
        landDescription,
        jurisdiction,
        indianLandProtection: body.indianLandProtection ?? true,
        trustStatus: body.trustStatus ?? false,
        federalPreemption: body.federalPreemption ?? true,
        tribalJurisdiction: body.tribalJurisdiction ?? false,
      };

      content = buildInstrumentContent(opts);
      instrumentTitle = body.title ?? `${type} — ${jurisdiction}`;

      pdfInput = {
        title: instrumentTitle,
        parties: { Grantor: parties[0] ?? "[Grantor]", Trustee: "Sovereign Office of the Chief Justice & Trustee" },
        land: { description: landDescription, classification: body.recorderMetadata?.landClassification ?? "Indian Trust Land" },
        provisions: [],
        trusteeNotes: body.trusteeNotes,
        recorderMetadata: {
          documentType: "TRUST INSTRUMENT",
          county: body.recorderMetadata?.county ?? body.state,
          state: body.recorderMetadata?.state ?? body.state,
          requiresNotary: body.recorderMetadata?.requiresNotary ?? true,
          ...body.recorderMetadata,
        },
      };
    }

    if (body.pdfInput) {
      pdfInput = { ...pdfInput!, ...body.pdfInput };
    }

    const isDoctrineInstrument = isDoctrineTemplate(body.templateKey);
    const recorderSpec = isDoctrineInstrument ? DOCTRINE_RECORDER_SPEC : DEFAULT_RECORDER_SPEC;

    const legacyValidation = validateInstrumentForRecorder(content, DEFAULT_RECORDER_FORMAT);
    const recorderValidation = validateRecorderDocument(content, {
      apn: pdfInput!.recorderMetadata.apn ?? pdfInput!.land.apn,
      returnAddress: pdfInput!.recorderMetadata.returnAddress,
      hasSignatureBlock: true,
      hasNotaryBlock: !!pdfInput!.recorderMetadata.requiresNotary,
      hasPageNumbers: true,
      templateKey: body.templateKey,
      documentCategory: isDoctrineInstrument ? "doctrine" : "land",
    }, recorderSpec);

    const marginValidation = validateMargins(DEFAULT_RECORDER_SPEC);

    const allErrors = [...legacyValidation.errors, ...recorderValidation.errors, ...marginValidation.errors];
    const allWarnings = [...recorderValidation.warnings, ...marginValidation.warnings];

    const stateKey = body.recorderMetadata?.state ?? body.state ?? "";
    const stateIntel = stateKey ? getStateIntel(stateKey) : null;
    const landClassification = stateKey ? getIndianLandClassification(stateKey, pdfInput!.land.description ?? "") : "Indian Trust Land";

    const pdfResult = await buildRecorderPdf(pdfInput!);

    const [instrument] = await db
      .insert(trustInstrumentsTable)
      .values({
        userId: req.user?.dbId ?? undefined,
        title: instrumentTitle,
        instrumentType: body.type ?? "trust_instrument",
        content,
        landJson: pdfInput!.land as object,
        partiesJson: pdfInput!.parties as object,
        provisionsJson: pdfInput!.provisions as unknown as object,
        recorderMetadata: pdfInput!.recorderMetadata as object,
        trusteeNotes: pdfInput!.trusteeNotes,
        pdfBuffer: pdfResult.buffer,
        pdfUrl: `/api/trust/instruments/${0}/pdf`,
        validationErrors: allErrors as unknown as object,
        jurisdiction: (body.recorderMetadata?.county ?? (body as Record<string,unknown>).jurisdiction) as string | undefined,
        state: body.recorderMetadata?.state ?? body.state,
        county: body.recorderMetadata?.county,
        landClassification,
        status: allErrors.length === 0 ? "valid" : "draft",
      })
      .returning();

    if (!instrument) {
      res.status(500).json({ error: "Failed to create instrument" });
      return;
    }

    await db
      .update(trustInstrumentsTable)
      .set({ pdfUrl: `/api/trust/instruments/${instrument.id}/pdf` })
      .where(eq(trustInstrumentsTable.id, instrument.id));

    await db.insert(searchIndexTable).values({
      entityType: "instrument",
      entityId: String(instrument.id),
      content: `${instrumentTitle} ${pdfInput!.land.description ?? ""} ${stateKey}`,
      metadata: { instrumentType: body.type, landClassification, state: stateKey, status: instrument.status },
    });

    res.status(201).json({
      instrument: { ...instrument, pdfUrl: `/api/trust/instruments/${instrument.id}/pdf` },
      validation: { errors: allErrors, warnings: allWarnings, valid: allErrors.length === 0 },
      stateIntel,
      landClassification,
      pdf: { pages: pdfResult.pageCount, checksum: pdfResult.checksum, generatedAt: pdfResult.generatedAt, downloadUrl: `/api/trust/instruments/${instrument.id}/pdf` },
    });
  } catch (err) {
    next(err);
  }
});

router.post("/:id/generate-pdf", requireAuth, requireRole("trustee"), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const results = await db.select().from(trustInstrumentsTable).where(eq(trustInstrumentsTable.id, id)).limit(1);
    if (!results[0]) {
      res.status(404).json({ error: "Instrument not found" });
      return;
    }
    const inst = results[0];
    const pdfResult = await buildInstrumentRecorderPdf(id, inst.content, inst.jurisdiction ?? "", {
      title: inst.title,
      parties: (inst.partiesJson ?? {}) as Record<string, string>,
      land: (inst.landJson ?? {}) as PdfBuildInput["land"],
      provisions: (inst.provisionsJson as unknown as string[]) ?? [],
      trusteeNotes: inst.trusteeNotes ?? undefined,
      recorderMetadata: (inst.recorderMetadata ?? {}) as PdfBuildInput["recorderMetadata"],
    });

    await db
      .update(trustInstrumentsTable)
      .set({ pdfBuffer: pdfResult.buffer, pdfUrl: `/api/trust/instruments/${id}/pdf`, updatedAt: new Date() })
      .where(eq(trustInstrumentsTable.id, id));

    res.json({ success: true, pages: pdfResult.pageCount, checksum: pdfResult.checksum, downloadUrl: `/api/trust/instruments/${id}/pdf` });
  } catch (err) {
    next(err);
  }
});

router.post("/:id/file", requireAuth, requireRole("trustee"), async (req, res, next) => {
  try {
    const instrumentId = Number(req.params.id);
    const inst = await db.select().from(trustInstrumentsTable).where(eq(trustInstrumentsTable.id, instrumentId)).limit(1);
    if (!inst[0]) {
      res.status(404).json({ error: "Instrument not found" });
      return;
    }

    const { county, state, documentType, notes } = req.body as {
      county: string;
      state: string;
      documentType?: string;
      notes?: string;
    };

    if (!county || !state) {
      res.status(400).json({ error: "county and state are required" });
      return;
    }

    const [filing] = await db
      .insert(trustFilingsTable)
      .values({
        instrumentId,
        county,
        state,
        filingStatus: "submitted",
        submittedAt: new Date(),
        documentType: documentType ?? inst[0].instrumentType,
        trustStatus: "Federal Trust Land",
        landClassification: inst[0].landClassification ?? "Indian Trust Land",
        notes,
      })
      .returning();

    await db
      .update(trustInstrumentsTable)
      .set({ status: "filed", updatedAt: new Date() })
      .where(eq(trustInstrumentsTable.id, instrumentId));

    res.status(201).json(filing);
  } catch (err) {
    next(err);
  }
});

router.post("/:id/submit", requireAuth, requireRole("trustee"), async (req, res, next) => {
  try {
    const instrumentId = Number(req.params.id);
    const inst = await db.select().from(trustInstrumentsTable).where(eq(trustInstrumentsTable.id, instrumentId)).limit(1);
    if (!inst[0]) {
      res.status(404).json({ error: "Instrument not found" });
      return;
    }
    if (!inst[0].pdfBuffer) {
      res.status(400).json({ error: "Generate the PDF before submitting. POST /api/trust/instruments/:id/generate-pdf" });
      return;
    }

    const { county, state } = req.body as { county?: string; state?: string };
    const targetCounty = county ?? inst[0].county ?? "";
    const targetState = state ?? inst[0].state ?? "";

    if (!targetCounty || !targetState) {
      res.status(400).json({ error: "county and state are required for submission" });
      return;
    }

    const [filing] = await db
      .insert(trustFilingsTable)
      .values({
        instrumentId,
        county: targetCounty,
        state: targetState,
        filingStatus: "submitted",
        submittedAt: new Date(),
        documentType: inst[0].instrumentType,
        trustStatus: "Federal Trust Land",
        landClassification: inst[0].landClassification ?? "Indian Trust Land",
        recorderResponse: { message: "Submitted to county recorder's office. Awaiting acceptance." },
      })
      .returning();

    await db
      .update(trustInstrumentsTable)
      .set({ status: "submitted", updatedAt: new Date() })
      .where(eq(trustInstrumentsTable.id, instrumentId));

    res.status(201).json({ filing, message: "Instrument submitted to recorder" });
  } catch (err) {
    next(err);
  }
});

export default router;
