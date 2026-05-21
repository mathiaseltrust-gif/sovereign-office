import { Router } from "express";
import { db } from "@workspace/db";
import { traceMattersTable, traceAnalysisTable } from "@workspace/db";
import { eq, desc, max } from "drizzle-orm";
import { requireTraceAccess } from "../../auth/entra-guard";
import { runTraceAnalysis } from "../../engines/trace-engine";
import { logger } from "../../lib/logger";

const router = Router();

router.post("/matters/:id/analyze", requireTraceAccess, async (req, res, next) => {
  try {
    const id = Number(req.params.id);

    const [matter] = await db
      .select()
      .from(traceMattersTable)
      .where(eq(traceMattersTable.id, id))
      .limit(1);

    if (!matter) {
      res.status(404).json({ error: "Matter not found" });
      return;
    }

    await db
      .update(traceMattersTable)
      .set({ status: "analyzing", updatedAt: new Date() })
      .where(eq(traceMattersTable.id, id));

    const [versionRow] = await db
      .select({ maxVer: max(traceAnalysisTable.version) })
      .from(traceAnalysisTable)
      .where(eq(traceAnalysisTable.matterId, id));

    const nextVersion = (versionRow?.maxVer ?? 0) + 1;

    let engineResult;
    try {
      engineResult = await runTraceAnalysis({
        matterId: id,
        title: matter.title,
        description: matter.description,
        matterType: matter.matterType,
        niacPathway: matter.niacPathway,
      });
    } catch (aiErr) {
      await db
        .update(traceMattersTable)
        .set({ status: "pending", updatedAt: new Date() })
        .where(eq(traceMattersTable.id, id));
      throw aiErr;
    }

    const { proceduralReconstruction, authorityMap, oversightMap, riskScore, rawResponses } = engineResult;

    const [analysis] = await db
      .insert(traceAnalysisTable)
      .values({
        matterId: id,
        version: nextVersion,
        requiredProcedure: proceduralReconstruction.requiredProcedure,
        actualConduct: proceduralReconstruction.actualConduct,
        proceduralGaps: proceduralReconstruction.proceduralGaps,
        authorityMap: {
          statutes: authorityMap.statutes,
          regulations: authorityMap.regulations,
          treaties: authorityMap.treaties,
          guidance: authorityMap.guidance,
        },
        oversightMap: {
          agencies: oversightMap.agencies,
          pathways: oversightMap.pathways,
          triggers: oversightMap.triggers,
        },
        riskScore,
        escalationRecs: oversightMap.escalationRecs,
        rawAiResponse: JSON.stringify(rawResponses),
      })
      .returning();

    const newRiskLevel =
      riskScore >= 76 ? "critical" :
      riskScore >= 51 ? "high" :
      riskScore >= 26 ? "medium" : "low";

    await db
      .update(traceMattersTable)
      .set({
        status: "reviewed",
        riskLevel: newRiskLevel,
        niacPathway: matter.niacPathway || oversightMap.niacTrigger,
        updatedAt: new Date(),
      })
      .where(eq(traceMattersTable.id, id));

    logger.info({ matterId: id, riskScore, version: nextVersion }, "TRACE analysis saved");
    res.json({ analysis, riskScore, newRiskLevel });
  } catch (err) {
    next(err);
  }
});

router.get("/matters/:id/report", requireTraceAccess, async (req, res, next) => {
  try {
    const id = Number(req.params.id);

    const [matter] = await db
      .select()
      .from(traceMattersTable)
      .where(eq(traceMattersTable.id, id))
      .limit(1);

    if (!matter) {
      res.status(404).json({ error: "Matter not found" });
      return;
    }

    const analyses = await db
      .select()
      .from(traceAnalysisTable)
      .where(eq(traceAnalysisTable.matterId, id))
      .orderBy(desc(traceAnalysisTable.version));

    res.json({ matter, analyses });
  } catch (err) {
    next(err);
  }
});

export default router;
