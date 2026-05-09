import { Router } from "express";
import { db } from "@workspace/db";
import { searchIndexTable } from "@workspace/db";
import { requireAuth, requireRole } from "../../auth/entra-guard";
import {
  buildInstrumentContent,
  validateInstrumentForRecorder,
  DEFAULT_RECORDER_FORMAT,
  type InstrumentOptions,
} from "../../sovereign/trust-service";
import { buildInstrumentPdf } from "../../lib/pdf-builder";
import { getStateIntel, getIndianLandClassification } from "../../sovereign/state-intel";

const router = Router();

const instruments: Array<{
  id: number;
  content: string;
  options: InstrumentOptions;
  validation: { valid: boolean; errors: string[] };
  pdfResult: ReturnType<typeof buildInstrumentPdf>;
  stateIntel: ReturnType<typeof getStateIntel>;
  landClassification: string;
  createdAt: string;
}> = [];
let nextId = 1;

router.get("/", async (_req, res, next) => {
  try {
    res.json(instruments);
  } catch (err) {
    next(err);
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const instrument = instruments.find((i) => i.id === id);
    if (!instrument) {
      res.status(404).json({ error: "Instrument not found" });
      return;
    }
    res.json(instrument);
  } catch (err) {
    next(err);
  }
});

router.post("/", requireAuth, requireRole("trustee"), async (req, res, next) => {
  try {
    const body = req.body as Partial<InstrumentOptions> & { state?: string };
    const { type, parties, landDescription, jurisdiction, state } = body;

    if (!type || !parties || !landDescription || !jurisdiction) {
      res.status(400).json({ error: "type, parties, landDescription, and jurisdiction are required" });
      return;
    }

    const opts: InstrumentOptions = {
      type,
      parties: Array.isArray(parties) ? parties : [parties as unknown as string],
      landDescription,
      jurisdiction,
      indianLandProtection: body.indianLandProtection ?? true,
      trustStatus: body.trustStatus ?? false,
      federalPreemption: body.federalPreemption ?? true,
      tribalJurisdiction: body.tribalJurisdiction ?? false,
    };

    const content = buildInstrumentContent(opts);
    const validation = validateInstrumentForRecorder(content, DEFAULT_RECORDER_FORMAT);
    const stateIntel = state ? getStateIntel(state) : null;
    const landClassification = getIndianLandClassification(state ?? "", landDescription);
    const id = nextId++;
    const pdfResult = buildInstrumentPdf(id, content, jurisdiction);

    const instrument = {
      id,
      content,
      options: opts,
      validation,
      pdfResult,
      stateIntel,
      landClassification,
      createdAt: new Date().toISOString(),
    };

    instruments.push(instrument);

    await db.insert(searchIndexTable).values({
      entityType: "instrument",
      entityId: String(id),
      content: `${type} ${landDescription} ${jurisdiction}`,
      metadata: { type, jurisdiction, landClassification },
    });

    res.status(201).json(instrument);
  } catch (err) {
    next(err);
  }
});

export default router;
