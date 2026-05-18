/**
 * GET /api/authority/matters           — list all matter routing rules (filterable by ?matterType)
 * GET /api/authority/matters/:matterType — get routing rule for a specific matter type
 * POST /api/authority/matters/resolve  — resolve agencies for a matter + jurisdiction
 *
 * Safety rule: all routing recommendations set suggestedPendingReview: true.
 */
import { Router } from "express";
import { requireAuth } from "../../auth/entra-guard";
import { db } from "@workspace/db";
import {
  authorityMatterRoutingTable,
  authorityAgenciesTable,
  authorityLegalMapTable,
} from "@workspace/db";
import { eq, ilike, and, asc, SQL, sql } from "drizzle-orm";
import { logger } from "../../lib/logger";

const router = Router();

router.get("/", requireAuth, async (req, res, next) => {
  try {
    const { matterType } = req.query as { matterType?: string };
    const where = matterType ? ilike(authorityMatterRoutingTable.matterType, `%${matterType}%`) : undefined;
    const rules = await db
      .select()
      .from(authorityMatterRoutingTable)
      .where(where)
      .orderBy(sql`matter_type ASC`);
    res.json({ count: rules.length, rules });
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
      .where(ilike(authorityLegalMapTable.issueType, `%${matterType}%`));

    let matchedAgencies: (typeof authorityAgenciesTable.$inferSelect)[] = [];
    if (stateCode) {
      const conditions: SQL<unknown>[] = [eq(authorityAgenciesTable.stateCode, stateCode.toUpperCase())];
      if (county) conditions.push(ilike(authorityAgenciesTable.county, `%${county}%`));
      if (city) conditions.push(ilike(authorityAgenciesTable.city, `%${city}%`));
      matchedAgencies = await db
        .select()
        .from(authorityAgenciesTable)
        .where(conditions.length === 1 ? conditions[0] : and(...(conditions as [SQL<unknown>, ...SQL<unknown>[]])))
        .limit(10)
        .orderBy(asc(authorityAgenciesTable.governmentLevel));
    }

    const legalFlagSummary = legalAuthorities.map(la => la.warningOrLimit ?? la.appliesWhen ?? la.authorityName).filter(Boolean);
    const primaryRecipient = matchedAgencies[0] ?? null;
    const oversightRecipient = matchedAgencies.find(a => a.id !== primaryRecipient?.id) ?? null;
    const ccList = routingRule?.oversightEntityType ? [`${routingRule.oversightEntityType} oversight`] : [];

    logger.info({ matterType, stateCode, county, agenciesFound: matchedAgencies.length }, "authority.matters.resolve");

    res.json({
      matterType,
      routingRule: routingRule ?? null,
      matchedAgencies,
      legalAuthorities,
      routingRecommendation: {
        primaryRecipient: primaryRecipient ? {
          id: primaryRecipient.id,
          name: primaryRecipient.agencyName,
          mailingAddress: primaryRecipient.mailingAddress ?? primaryRecipient.physicalAddress ?? null,
          contact: primaryRecipient.contactEmail ?? primaryRecipient.phone ?? null,
        } : null,
        oversightRecipient: oversightRecipient ? {
          id: oversightRecipient.id,
          name: oversightRecipient.agencyName,
          mailingAddress: oversightRecipient.mailingAddress ?? oversightRecipient.physicalAddress ?? null,
        } : null,
        ccList,
        legalFlagSummary,
        suggestedTemplateKey: routingRule?.requiredNoticeTemplate ?? null,
        escalationPath: routingRule?.escalationPath ?? null,
        tribalLawApplicable: routingRule?.tribalLawApplicable ?? null,
        suggestedPendingReview: true,
        disclaimer: "System flagged — human review required before any action is taken. This engine flags but does not conclude.",
      },
      suggestedPendingReview: true,
    });
  } catch (err) {
    next(err);
  }
});

router.get("/:matterType", requireAuth, async (req, res, next) => {
  try {
    const [rule] = await db
      .select()
      .from(authorityMatterRoutingTable)
      .where(sql`matter_type = ${req.params.matterType}`)
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

export default router;
