import { Router } from "express";
import { db } from "@workspace/db";
import { traceMattersTable, traceAnalysisTable, traceDraftsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { requireTraceAccess, requireRole } from "../../auth/entra-guard";
import { generateTraceDraft } from "../../engines/trace-engine";
import { logger } from "../../lib/logger";

const router = Router();

router.post("/:id/draft", requireTraceAccess, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const { draftType } = req.body as { draftType?: string };

    const allowedTypes = [
      "procedural_audit_report",
      "oversight_map",
      "response_letter",
      "escalation_memo",
      "summary",
    ];

    if (!draftType || !allowedTypes.includes(draftType)) {
      res.status(400).json({ error: `draftType must be one of: ${allowedTypes.join(", ")}` });
      return;
    }

    const [matter] = await db
      .select()
      .from(traceMattersTable)
      .where(eq(traceMattersTable.id, id))
      .limit(1);

    if (!matter) {
      res.status(404).json({ error: "Matter not found" });
      return;
    }

    const [latestAnalysis] = await db
      .select()
      .from(traceAnalysisTable)
      .where(eq(traceAnalysisTable.matterId, id))
      .orderBy(desc(traceAnalysisTable.version))
      .limit(1);

    const content = await generateTraceDraft(
      draftType,
      { title: matter.title, description: matter.description, matterType: matter.matterType },
      latestAnalysis
        ? {
            requiredProcedure: latestAnalysis.requiredProcedure ?? undefined,
            actualConduct: latestAnalysis.actualConduct ?? undefined,
            proceduralGaps: (latestAnalysis.proceduralGaps as string[] | null) ?? undefined,
            authorityMap: latestAnalysis.authorityMap as { statutes: string[]; regulations: string[]; treaties: string[]; guidance: string[] } | undefined,
            oversightMap: latestAnalysis.oversightMap as { agencies: string[]; pathways: string[]; triggers: string[] } | undefined,
          }
        : undefined,
    );

    const [draft] = await db
      .insert(traceDraftsTable)
      .values({
        matterId: id,
        draftType,
        content,
        approved: false,
      })
      .returning();

    logger.info({ matterId: id, draftType, draftId: draft.id }, "TRACE draft generated");
    res.status(201).json(draft);
  } catch (err) {
    next(err);
  }
});

router.get("/:id/drafts", requireTraceAccess, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const drafts = await db
      .select()
      .from(traceDraftsTable)
      .where(eq(traceDraftsTable.matterId, id))
      .orderBy(desc(traceDraftsTable.createdAt));
    res.json({ drafts });
  } catch (err) {
    next(err);
  }
});

router.post("/:matterId/drafts/:draftId/approve", requireTraceAccess, requireRole("officer"), async (req, res, next) => {
  try {
    const draftId = Number(req.params.draftId);
    const approvedBy = req.user?.dbId ?? null;

    const [updated] = await db
      .update(traceDraftsTable)
      .set({ approved: true, approvedBy, approvedAt: new Date() })
      .where(eq(traceDraftsTable.id, draftId))
      .returning();

    if (!updated) {
      res.status(404).json({ error: "Draft not found" });
      return;
    }
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

export default router;
