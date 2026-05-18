/**
 * GET  /api/authority/routing         — list all matter routing rules
 * GET  /api/authority/routing/:matter — get routing rule for a specific matter type
 * POST /api/authority/routing/resolve — resolve which agencies handle a described matter
 *
 * Safety rule: all routing recommendations set suggestedPendingReview: true.
 * The engine flags but NEVER concludes — human review always required.
 */
import { Router } from "express";
import { requireAuth, requireRole } from "../../auth/entra-guard";
import { db } from "@workspace/db";
import {
  authorityMatterRoutingTable,
  authorityAgenciesTable,
  authorityLegalMapTable,
} from "@workspace/db";
import { eq, ilike, or, and } from "drizzle-orm";
import { logger } from "../../lib/logger";

const router = Router();

router.get("/", requireAuth, async (_req, res, next) => {
  try {
    const rules = await db
      .select()
      .from(authorityMatterRoutingTable)
      .orderBy(authorityMatterRoutingTable.matterType);
    res.json({ count: rules.length, rules });
  } catch (err) {
    next(err);
  }
});

router.get("/:matter", requireAuth, async (req, res, next) => {
  try {
    const [rule] = await db
      .select()
      .from(authorityMatterRoutingTable)
      .where(eq(authorityMatterRoutingTable.matterType, req.params.matter))
      .limit(1);

    if (!rule) {
      res.status(404).json({ error: "No routing rule found for this matter type" });
      return;
    }
    res.json(rule);
  } catch (err) {
    next(err);
  }
});

router.post("/resolve", requireAuth, async (req, res, next) => {
  try {
    const { matterType, stateCode, county, city } = req.body as {
      matterType: string;
      stateCode?: string;
      county?: string;
      city?: string;
    };

    if (!matterType) {
      res.status(400).json({ error: "matterType is required" });
      return;
    }

    const [routingRule] = await db
      .select()
      .from(authorityMatterRoutingTable)
      .where(eq(authorityMatterRoutingTable.matterType, matterType))
      .limit(1);

    const legalAuthorities = await db
      .select()
      .from(authorityLegalMapTable)
      .where(eq(authorityLegalMapTable.issueType, matterType));

    let matchedAgencies: (typeof authorityAgenciesTable.$inferSelect)[] = [];
    if (stateCode || county) {
      const agencyConditions = [];
      if (stateCode) agencyConditions.push(ilike(authorityAgenciesTable.stateCode, stateCode.toUpperCase()));
      if (county) agencyConditions.push(ilike(authorityAgenciesTable.county, `%${county}%`));
      if (routingRule?.primaryEntityType) {
        agencyConditions.push(
          or(
            ilike(authorityAgenciesTable.agencyType, `%${routingRule.primaryEntityType}%`),
            ilike(authorityAgenciesTable.governmentLevel, `%${routingRule.primaryEntityType}%`),
          )
        );
      }
      matchedAgencies = await db
        .select()
        .from(authorityAgenciesTable)
        .where(and(...agencyConditions))
        .limit(10);
    }

    logger.info({ matterType, stateCode, county, agenciesFound: matchedAgencies.length }, "authority.routing.resolve");

    res.json({
      matterType,
      routingRule: routingRule ?? null,
      matchedAgencies,
      legalAuthorities,
      suggestedPendingReview: true,
      disclaimer: "This routing recommendation requires human review before any action is taken. The system flags but does not conclude.",
    });
  } catch (err) {
    next(err);
  }
});

export default router;
