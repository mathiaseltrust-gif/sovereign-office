/**
 * GET /api/authority/agencies
 * Hierarchical agency search — requires at least one filter param.
 * Max 50 results per call to prevent full-table scans.
 *
 * GET /api/authority/agencies/:id
 * Returns a single agency by ID.
 */
import { Router } from "express";
import { requireAuth } from "../../auth/entra-guard";
import { db } from "@workspace/db";
import { authorityAgenciesTable } from "@workspace/db";
import { eq, ilike, and, or } from "drizzle-orm";

const router = Router();

router.get("/", requireAuth, async (req, res, next) => {
  try {
    const { state, county, city, level, type, q } = req.query as Record<string, string | undefined>;

    const hasFilter = state || county || city || level || type || q;
    if (!hasFilter) {
      res.status(400).json({
        error: "At least one filter parameter is required: state, county, city, level, type, or q",
      });
      return;
    }

    const conditions = [];
    if (state) conditions.push(ilike(authorityAgenciesTable.stateCode, state.toUpperCase()));
    if (county) conditions.push(ilike(authorityAgenciesTable.county, `%${county}%`));
    if (city) conditions.push(ilike(authorityAgenciesTable.city, `%${city}%`));
    if (level) conditions.push(ilike(authorityAgenciesTable.governmentLevel, `%${level}%`));
    if (type) conditions.push(ilike(authorityAgenciesTable.agencyType, `%${type}%`));
    if (q) {
      conditions.push(
        or(
          ilike(authorityAgenciesTable.agencyName, `%${q}%`),
          ilike(authorityAgenciesTable.county, `%${q}%`),
          ilike(authorityAgenciesTable.city, `%${q}%`),
          ilike(authorityAgenciesTable.parentAgency, `%${q}%`),
        )
      );
    }

    const results = await db
      .select()
      .from(authorityAgenciesTable)
      .where(and(...conditions))
      .limit(50)
      .orderBy(authorityAgenciesTable.governmentLevel, authorityAgenciesTable.agencyName);

    res.json({ count: results.length, results });
  } catch (err) {
    next(err);
  }
});

router.get("/:id", requireAuth, async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      res.status(400).json({ error: "Invalid agency ID" });
      return;
    }
    const [agency] = await db
      .select()
      .from(authorityAgenciesTable)
      .where(eq(authorityAgenciesTable.id, id))
      .limit(1);

    if (!agency) {
      res.status(404).json({ error: "Agency not found" });
      return;
    }
    res.json(agency);
  } catch (err) {
    next(err);
  }
});

export default router;
