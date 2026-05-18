/**
 * GET /api/authority/jurisdictions
 * Lists jurisdiction reference records with optional filtering.
 */
import { Router } from "express";
import { requireAuth } from "../../auth/entra-guard";
import { db } from "@workspace/db";
import { authorityJurisdictionTable } from "@workspace/db";
import { eq, and, ilike, or } from "drizzle-orm";

const router = Router();

router.get("/", requireAuth, async (req, res, next) => {
  try {
    const { state, county, city, tribal, q } = req.query as Record<string, string | undefined>;

    const conditions = [];
    if (state) conditions.push(eq(authorityJurisdictionTable.stateCode, state.toUpperCase()));
    if (county) conditions.push(ilike(authorityJurisdictionTable.county, `%${county}%`));
    if (city) conditions.push(ilike(authorityJurisdictionTable.city, `%${city}%`));
    if (tribal === "true") conditions.push(eq(authorityJurisdictionTable.tribalLandFlag, true));
    if (q) {
      conditions.push(
        or(
          ilike(authorityJurisdictionTable.county, `%${q}%`),
          ilike(authorityJurisdictionTable.city, `%${q}%`),
          ilike(authorityJurisdictionTable.stateName, `%${q}%`),
          ilike(authorityJurisdictionTable.fipsCode, `%${q}%`),
        )
      );
    }

    const results = await db
      .select()
      .from(authorityJurisdictionTable)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .limit(100)
      .orderBy(authorityJurisdictionTable.stateCode, authorityJurisdictionTable.county);

    res.json({ count: results.length, results });
  } catch (err) {
    next(err);
  }
});

export default router;
