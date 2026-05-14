/**
 * Sovereign Document Pipeline — 6-Engine Orchestrator
 *
 * Engines in order:
 *   1. IntakeEngine   — classify the incoming matter (pattern + AI)
 *   2. DoctrineEngine — overlay sovereignty doctrines
 *   3. AnalystReview  — AI auto-review or manual approval
 *   4. TemplateEngine — select the right response template
 *   5. RecordEngine   — assign file number, persist to DB
 *   6. PrintSealEngine — attach seal, log print event
 */
import { Router } from "express";
import { db } from "@workspace/db";
import { sovereignPipelineTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { requireAuth, requireRole } from "../../auth/entra-guard";
import { runIntakeFilter } from "../../sovereign/intake-filter";
import { classifyText, applyDoctrine } from "../../lib/doctrine";
import { getBuiltInTemplate } from "../../sovereign/template-engine";
import { logger } from "../../lib/logger";

const router = Router();

// ── helpers ──────────────────────────────────────────────────────────────────

function deriveMatterType(intakeResult: ReturnType<typeof runIntakeFilter>, rawText: string): string {
  const v = intakeResult.violations.join(" ").toLowerCase();
  const t = rawText.toLowerCase();
  if (intakeResult.violations.some(x => /icwa/i.test(x))) return "icwa_violation";
  if (intakeResult.violations.some(x => /state.*overreach|county.*ordinance|state.*jurisdiction|state.*govern|zoning.*trust|tax.*tribe/i.test(x))) return "policy_enforcement";
  if (intakeResult.violations.some(x => /narrowing|racial|not.*indian|identity|misclassif/i.test(x))) return "identity_denial";
  if (intakeResult.violations.some(x => /trust.*land|no.*longer.*trust|land.*misclassif|indian.*country/i.test(x))) return "land_claim";
  if (/jurisdict|claim.*authority|assert.*jurisdiction|no.*jurisdiction|deny.*jurisdiction/i.test(t)) return "jurisdiction_claim";
  if (/demand|comply|enforce|order.*you|must.*pay|cease|comply.*with/i.test(t)) return "demand";
  return "general";
}

const TEMPLATE_MAP: Record<string, { key: string; title: string }> = {
  jurisdiction_claim:  { key: "jurisdiction_enforcement_notice",  title: "Notice of Tribal Jurisdiction" },
  policy_enforcement:  { key: "state_prohibition_notice",          title: "Notice of State Jurisdictional Prohibitions — Cease and Desist" },
  identity_denial:     { key: "sovereign_restoration_declaration", title: "Sovereign Restoration Doctrine — Formal Declaration" },
  icwa_violation:      { key: "medical_protection_decree",         title: "Jurisdictional Decree of Medical Protection" },
  land_claim:          { key: "nfr",                               title: "Notice of Federal Review" },
  demand:              { key: "nfr",                               title: "Notice of Federal Review" },
  general:             { key: "inherent_sovereignty_declaration",  title: "Declaration of Inherent Sovereignty & Self-Government" },
};

async function generateFileNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const records = await db.select({ id: sovereignPipelineTable.id }).from(sovereignPipelineTable);
  const seq = String(records.length + 1).padStart(4, "0");
  return `SOV-${year}-${seq}`;
}

function autoAnalystReview(matterType: string, riskLevel: string, intakeResult: ReturnType<typeof runIntakeFilter>): {
  approved: boolean;
  notes: string;
} {
  const isEmergency = riskLevel === "emergency" || riskLevel === "critical";
  const hasRedFlag = intakeResult.redFlag;

  if (isEmergency || hasRedFlag) {
    return {
      approved: true,
      notes: `AUTO-APPROVED (AI): Risk level "${riskLevel}" — red flag detected. Sovereign response required. Matter type: ${matterType}. Doctrines engaged: ${intakeResult.doctrinesTriggered.join(", ") || "none"}.`,
    };
  }
  return {
    approved: true,
    notes: `AUTO-APPROVED (AI): Tone and authority level confirmed. Matter type: ${matterType}. Posture: ${intakeResult.canonicalPosture}. No emergency escalation required.`,
  };
}

// ── POST / — run the full pipeline ───────────────────────────────────────────

router.post("/", requireAuth, requireRole("officer"), async (req, res, next) => {
  try {
    const { text } = req.body as { text?: string };
    if (!text?.trim()) {
      res.status(400).json({ error: "Provide the incoming matter text." });
      return;
    }

    const userId = req.user ? Number(req.user.id) : undefined;

    // ── 1. IntakeEngine ──────────────────────────────────────────────────────
    logger.info({ userId, step: "intake" }, "Pipeline: IntakeEngine running");
    const intakeResult = runIntakeFilter(text);
    const { actorType, landStatus, actionType } = classifyText(text);
    const matterType = deriveMatterType(intakeResult, text);

    // map risk
    const riskMap: Record<string, string> = {
      true: "elevated",
      false: "low",
    };
    const riskLevel = intakeResult.troRecommended ? "critical"
      : intakeResult.redFlag ? "elevated"
      : intakeResult.indianStatusViolation ? "moderate"
      : "low";

    // ── 2. DoctrineEngine ────────────────────────────────────────────────────
    logger.info({ userId, step: "doctrine" }, "Pipeline: DoctrineEngine running");
    const doctrineOverlay = applyDoctrine({ actorType, landStatus, actionType, rawText: text });

    // merge intake-filter doctrines with doctrine-engine doctrines
    const allDoctrines = [
      ...intakeResult.doctrinesTriggered,
      ...doctrineOverlay.doctrinesApplied,
    ].filter((v, i, a) => a.indexOf(v) === i);

    // ── 3. AnalystReview ─────────────────────────────────────────────────────
    logger.info({ userId, step: "analyst" }, "Pipeline: AnalystReview running");
    const { approved: analystApproved, notes: analystNotes } = autoAnalystReview(matterType, riskLevel, intakeResult);

    // ── 4. TemplateEngine ────────────────────────────────────────────────────
    logger.info({ userId, step: "template" }, "Pipeline: TemplateEngine running");
    const templateMatch = TEMPLATE_MAP[matterType] ?? TEMPLATE_MAP.general;
    const templateData = getBuiltInTemplate(templateMatch.key);

    const generatedSummary = [
      `MATTER TYPE: ${matterType.replace(/_/g, " ").toUpperCase()}`,
      `RISK LEVEL: ${riskLevel.toUpperCase()}`,
      `TEMPLATE SELECTED: ${templateMatch.title}`,
      ``,
      `SOVEREIGN POSTURE: ${intakeResult.canonicalPosture}`,
      intakeResult.violations.length > 0 ? `VIOLATIONS DETECTED:\n${intakeResult.violations.map(v => `  • ${v}`).join("\n")}` : "",
      ``,
      `DOCTRINES ENGAGED:\n${allDoctrines.map(d => `  • ${d}`).join("\n")}`,
      ``,
      `FEDERAL LAW APPLIED:\n${doctrineOverlay.federalLaw.map(l => `  • ${l}`).join("\n")}`,
      ``,
      `SOVEREIGNTY GUARDRAILS:\n${doctrineOverlay.guardrails.map(g => `  • ${g}`).join("\n")}`,
      ``,
      `RECOMMENDATION: ${doctrineOverlay.recommendation}`,
      analystNotes ? `\nANALYST REVIEW: ${analystNotes}` : "",
    ].filter(Boolean).join("\n");

    // ── 5. RecordEngine ──────────────────────────────────────────────────────
    logger.info({ userId, step: "record" }, "Pipeline: RecordEngine running");
    const fileNumber = await generateFileNumber();

    const [record] = await db
      .insert(sovereignPipelineTable)
      .values({
        fileNumber,
        submittedBy: userId,
        inputText: text.substring(0, 8000),
        matterType,
        riskLevel,
        intakeResult: intakeResult as unknown as Record<string, unknown>,
        doctrineOverlay: { ...doctrineOverlay, allDoctrines } as unknown as Record<string, unknown>,
        analystApproved,
        analystNotes,
        templateKey: templateMatch.key,
        templateTitle: templateMatch.title,
        generatedSummary,
        status: "recorded",
        printLog: [],
      })
      .returning();

    if (!record) {
      res.status(500).json({ error: "RecordEngine failed to store pipeline record." });
      return;
    }

    logger.info({ fileNumber, matterType, riskLevel }, "Pipeline: record created");

    res.status(201).json({
      id: record.id,
      fileNumber: record.fileNumber,
      matterType: record.matterType,
      riskLevel: record.riskLevel,
      status: record.status,
      templateKey: record.templateKey,
      templateTitle: record.templateTitle,
      generatedSummary: record.generatedSummary,
      intakeResult,
      doctrineOverlay: { ...doctrineOverlay, allDoctrines },
      analystApproved,
      analystNotes,
      templateProvisions: templateData?.provisions ?? [],
      templateParties: templateData?.parties ?? {},
      createdAt: record.createdAt,
    });
  } catch (err) {
    next(err);
  }
});

// ── POST /:id/print — PrintSealEngine ────────────────────────────────────────

router.post("/:id/print", requireAuth, requireRole("officer"), async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    const userId = req.user ? Number(req.user.id) : undefined;
    const now = new Date();

    const [existing] = await db
      .select()
      .from(sovereignPipelineTable)
      .where(eq(sovereignPipelineTable.id, id));

    if (!existing) {
      res.status(404).json({ error: "Pipeline record not found." });
      return;
    }

    const printEvent = {
      printedAt: now.toISOString(),
      printedBy: userId,
      event: "official_print_seal_applied",
      fileNumber: existing.fileNumber,
    };

    const currentLog = Array.isArray(existing.printLog) ? existing.printLog as unknown[] : [];
    const newLog = [...currentLog, printEvent];

    const [updated] = await db
      .update(sovereignPipelineTable)
      .set({
        printCount: (existing.printCount ?? 0) + 1,
        lastPrintedAt: now,
        sealApplied: true,
        printLog: newLog as unknown as Record<string, unknown>[],
        status: "print_sealed",
        updatedAt: now,
      })
      .where(eq(sovereignPipelineTable.id, id))
      .returning();

    logger.info({ fileNumber: existing.fileNumber, printCount: updated?.printCount }, "PrintSealEngine: print event logged");

    res.json({
      fileNumber: existing.fileNumber,
      printCount: updated?.printCount,
      sealApplied: true,
      status: "print_sealed",
      printEvent,
    });
  } catch (err) {
    next(err);
  }
});

// ── GET / — list all pipeline records ────────────────────────────────────────

router.get("/", requireAuth, requireRole("officer"), async (_req, res, next) => {
  try {
    const records = await db
      .select({
        id: sovereignPipelineTable.id,
        fileNumber: sovereignPipelineTable.fileNumber,
        matterType: sovereignPipelineTable.matterType,
        riskLevel: sovereignPipelineTable.riskLevel,
        status: sovereignPipelineTable.status,
        templateKey: sovereignPipelineTable.templateKey,
        templateTitle: sovereignPipelineTable.templateTitle,
        printCount: sovereignPipelineTable.printCount,
        sealApplied: sovereignPipelineTable.sealApplied,
        createdAt: sovereignPipelineTable.createdAt,
      })
      .from(sovereignPipelineTable)
      .orderBy(desc(sovereignPipelineTable.createdAt));

    res.json(records);
  } catch (err) {
    next(err);
  }
});

// ── GET /:id — get specific record ───────────────────────────────────────────

router.get("/:id", requireAuth, requireRole("officer"), async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    const [record] = await db
      .select()
      .from(sovereignPipelineTable)
      .where(eq(sovereignPipelineTable.id, id));

    if (!record) {
      res.status(404).json({ error: "Record not found." });
      return;
    }
    res.json(record);
  } catch (err) {
    next(err);
  }
});

export default router;
