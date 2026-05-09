import { Router } from "express";
import { db } from "@workspace/db";
import { welfareInstrumentsTable, welfareActsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { requireAuth, requireRole } from "../../auth/entra-guard";
import { generateWelfareInstrument, type WelfareInstrumentRequest } from "../../sovereign/welfare-engine";
import { buildWelfarePdf } from "../../lib/pdf-builder";
import { runIntakeFilter } from "../../sovereign/intake-filter";
import { notifyWelfareGenerated, notifyTroGenerated, notifyRedFlag } from "../../sovereign/notification-engine";
import {
  listWelfareActs,
  getWelfareAct,
  createWelfareAct,
  ensureWelfareActsSeeded,
} from "../../sovereign/welfare-authority";
import { logger } from "../../lib/logger";

const router = Router();

router.get("/acts", requireAuth, async (_req, res, next) => {
  try {
    const acts = await listWelfareActs();
    res.json(acts);
  } catch (err) {
    next(err);
  }
});

router.get("/acts/:code", requireAuth, async (req, res, next) => {
  try {
    const act = await getWelfareAct(req.params.code);
    if (!act) {
      res.status(404).json({ error: "Welfare act not found" });
      return;
    }
    res.json(act);
  } catch (err) {
    next(err);
  }
});

router.post("/acts", requireAuth, requireRole("admin"), async (req, res, next) => {
  try {
    const { code, label, description, federalStatutes, doctrines, troEligible, emergencyEligible } = req.body as {
      code: string;
      label: string;
      description?: string;
      federalStatutes?: string[];
      doctrines?: string[];
      troEligible?: boolean;
      emergencyEligible?: boolean;
    };
    if (!code || !label) {
      res.status(400).json({ error: "code and label are required" });
      return;
    }
    const userId: string = (req as any).user?.id ?? "system";
    const act = await createWelfareAct({ code, label, description, federalStatutes, doctrines, troEligible, emergencyEligible, createdBy: userId });
    res.status(201).json(act);
  } catch (err) {
    next(err);
  }
});

router.get("/", requireAuth, async (_req, res, next) => {
  try {
    const rows = await db
      .select()
      .from(welfareInstrumentsTable)
      .orderBy(desc(welfareInstrumentsTable.createdAt));
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

router.get("/:id", requireAuth, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const rows = await db
      .select()
      .from(welfareInstrumentsTable)
      .where(eq(welfareInstrumentsTable.id, id))
      .limit(1);
    if (!rows[0]) {
      res.status(404).json({ error: "Welfare instrument not found" });
      return;
    }
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
});

router.post("/generate", requireAuth, async (req, res, next) => {
  try {
    const userId: string = (req as any).user?.id ?? "unknown";
    const userRoles: string[] = (req as any).user?.roles ?? [];

    const canGenerate = userRoles.some((r) => ["admin", "trustee", "officer"].includes(r));
    if (!canGenerate) {
      res.status(403).json({ error: "Only Intake Officers and Chief Justice & Trustee may generate welfare instruments" });
      return;
    }

    const body = req.body as WelfareInstrumentRequest;
    if (!body.welfareAct || !body.instrumentType) {
      res.status(400).json({ error: "welfareAct and instrumentType are required" });
      return;
    }

    const intakeText = JSON.stringify({ ...body.caseDetails, ...body.parties, relief: body.requestedRelief });
    const intakeFilter = runIntakeFilter(intakeText);

    await ensureWelfareActsSeeded();

    const instrument = generateWelfareInstrument(body);

    const auditEntry = {
      ts: new Date().toISOString(),
      action: "generated",
      userId,
      detail: `Generated ${instrument.instrumentType} under ${instrument.welfareAct}`,
      doctrinesApplied: instrument.doctrinesApplied,
      troSensitive: instrument.troSensitive,
      emergencyOrder: instrument.emergencyOrder,
      intakeFlags: {
        redFlag: intakeFilter.redFlag,
        indianStatusViolation: intakeFilter.indianStatusViolation,
        troRecommended: intakeFilter.troRecommended,
        violations: intakeFilter.violations,
      },
    };

    const inserted = await db
      .insert(welfareInstrumentsTable)
      .values({
        welfareAct: instrument.welfareAct,
        instrumentType: instrument.instrumentType,
        status: "prepared",
        troSensitive: instrument.troSensitive,
        emergencyOrder: instrument.emergencyOrder,
        caseDetails: body.caseDetails,
        childInfo: body.child ?? null,
        parties: body.parties,
        landStatus: body.landStatus ?? null,
        requestedRelief: body.requestedRelief,
        doctrineContext: body.doctrineContext ?? [],
        doctrinesApplied: instrument.doctrinesApplied,
        content: instrument.content,
        generatedBy: userId,
        auditLog: [auditEntry],
      })
      .returning();

    logger.info({ id: inserted[0]?.id, welfareAct: instrument.welfareAct, troSensitive: instrument.troSensitive }, "Welfare instrument created");

    await notifyWelfareGenerated({
      instrumentId: inserted[0]!.id,
      instrumentType: instrument.instrumentType,
      welfareAct: instrument.welfareAct,
      troSensitive: instrument.troSensitive,
      emergency: instrument.emergencyOrder,
    });

    if (intakeFilter.redFlag && intakeFilter.violations.length > 0) {
      await notifyRedFlag({
        violations: intakeFilter.violations,
        relatedId: inserted[0]!.id,
        relatedType: "welfare_instrument",
      });
    }

    res.status(201).json({
      id: inserted[0]?.id,
      ...instrument,
      intakeFilter,
      dbRecord: inserted[0],
    });
  } catch (err) {
    next(err);
  }
});

router.post("/tro", requireAuth, async (req, res, next) => {
  try {
    const userId: string = (req as any).user?.id ?? "unknown";
    const userRoles: string[] = (req as any).user?.roles ?? [];

    const canGenerate = userRoles.some((r) => ["admin", "trustee", "officer"].includes(r));
    if (!canGenerate) {
      res.status(403).json({ error: "Only Intake Officers and Chief Justice & Trustee may generate TRO instruments" });
      return;
    }

    const body = req.body as Omit<WelfareInstrumentRequest, "instrumentType">;

    const troRequest: WelfareInstrumentRequest = {
      ...body,
      instrumentType: "tro_supporting_declaration",
      emergency: true,
    };

    const instrument = generateWelfareInstrument(troRequest);

    const auditEntry = {
      ts: new Date().toISOString(),
      action: "tro_generated",
      userId,
      detail: "TRO-supporting declaration generated",
      doctrinesApplied: instrument.doctrinesApplied,
      troSensitive: true,
      emergencyOrder: true,
    };

    const inserted = await db
      .insert(welfareInstrumentsTable)
      .values({
        welfareAct: instrument.welfareAct,
        instrumentType: "tro_supporting_declaration",
        status: "prepared",
        troSensitive: true,
        emergencyOrder: true,
        caseDetails: body.caseDetails,
        childInfo: body.child ?? null,
        parties: body.parties,
        landStatus: body.landStatus ?? null,
        requestedRelief: body.requestedRelief,
        doctrineContext: body.doctrineContext ?? [],
        doctrinesApplied: instrument.doctrinesApplied,
        content: instrument.content,
        generatedBy: userId,
        auditLog: [auditEntry],
      })
      .returning();

    await notifyTroGenerated({
      instrumentId: inserted[0]!.id,
      caseNumber: body.caseDetails?.caseNumber,
    });

    res.status(201).json({
      id: inserted[0]?.id,
      ...instrument,
      dbRecord: inserted[0],
    });
  } catch (err) {
    next(err);
  }
});

router.get("/:id/pdf", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const rows = await db
      .select()
      .from(welfareInstrumentsTable)
      .where(eq(welfareInstrumentsTable.id, id))
      .limit(1);

    if (!rows[0]) {
      res.status(404).json({ error: "Welfare instrument not found" });
      return;
    }

    const row = rows[0];
    const pdfResult = await buildWelfarePdf({
      id,
      title: buildTitle(row.instrumentType),
      welfareAct: row.welfareAct,
      troSensitive: row.troSensitive,
      emergencyOrder: row.emergencyOrder,
      parties: (row.parties as Record<string, string>) ?? {},
      content: row.content ?? "",
      doctrinesApplied: (row.doctrinesApplied as string[]) ?? [],
    });

    await db
      .update(welfareInstrumentsTable)
      .set({ pdfUrl: `/api/court/welfare/${id}/pdf`, updatedAt: new Date() })
      .where(eq(welfareInstrumentsTable.id, id));

    const filename = `welfare-instrument-${id}.pdf`;
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(pdfResult.buffer);
  } catch (err) {
    next(err);
  }
});

router.post("/:id/issue", requireAuth, requireRole("trustee"), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const userId: string = (req as any).user?.id ?? "unknown";
    const userRoles: string[] = (req as any).user?.roles ?? [];

    if (!userRoles.some((r) => ["admin", "trustee"].includes(r))) {
      res.status(403).json({ error: "Only Chief Justice & Trustee or Admin may issue welfare instruments" });
      return;
    }

    const rows = await db.select().from(welfareInstrumentsTable).where(eq(welfareInstrumentsTable.id, id)).limit(1);
    if (!rows[0]) {
      res.status(404).json({ error: "Welfare instrument not found" });
      return;
    }

    const existing = rows[0];
    const auditLog = [...((existing.auditLog as any[]) ?? []), {
      ts: new Date().toISOString(),
      action: "issued",
      userId,
      detail: "Issued by Chief Justice & Trustee",
      doctrinesApplied: existing.doctrinesApplied,
    }];

    const updated = await db
      .update(welfareInstrumentsTable)
      .set({ status: "issued", issuedBy: userId, auditLog, updatedAt: new Date() })
      .where(eq(welfareInstrumentsTable.id, id))
      .returning();

    res.json(updated[0]);
  } catch (err) {
    next(err);
  }
});

function buildTitle(instrumentType: string | null): string {
  const map: Record<string, string> = {
    icwa_notice: "ICWA NOTICE OF PROCEEDING",
    icwa_transfer_request: "ICWA TRANSFER REQUEST",
    icwa_jurisdiction_declaration: "DECLARATION OF TRIBAL COURT JURISDICTION",
    tribal_family_placement_preference: "TRIBAL FAMILY PLACEMENT PREFERENCE DECLARATION",
    tribal_welfare_certification: "TRIBAL WELFARE CERTIFICATION",
    tribal_medical_necessity_certification: "TRIBAL MEDICAL NECESSITY CERTIFICATION",
    tribal_protective_order: "TRIBAL PROTECTIVE ORDER",
    emergency_welfare_order: "EMERGENCY WELFARE ORDER",
    tro_supporting_declaration: "TRO-SUPPORTING DECLARATION",
  };
  return map[instrumentType ?? ""] ?? "WELFARE INSTRUMENT";
}

export default router;
