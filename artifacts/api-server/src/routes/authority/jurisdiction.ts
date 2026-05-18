/**
 * GET /api/authority/jurisdiction
 *
 * Hierarchical jurisdiction lookup:
 *   No params       → returns all distinct states
 *   ?state=CA       → returns all counties in that state
 *   ?state=CA&county=Los%20Angeles → returns cities/flags for that state+county
 *   ?tribal=true    → filter to tribal-land jurisdictions
 *   ?q=...          → free-text search across county/city/state name
 */
import { Router } from "express";
import { requireAuth } from "../../auth/entra-guard";
import { db } from "@workspace/db";
import { authorityJurisdictionTable } from "@workspace/db";
import { eq, ilike, and, asc, SQL } from "drizzle-orm";

const router = Router();

router.get("/", requireAuth, async (req, res, next) => {
  try {
    const { state, county, tribal, q } = req.query as Record<string, string | undefined>;

    // ── Free-text search mode ─────────────────────────────────────────────────
    if (q) {
      const results = await db
        .select()
        .from(authorityJurisdictionTable)
        .where(ilike(authorityJurisdictionTable.county, `%${q}%`))
        .limit(100)
        .orderBy(asc(authorityJurisdictionTable.stateCode), asc(authorityJurisdictionTable.county));
      res.json({ mode: "search", count: results.length, results });
      return;
    }

    // ── Tribal-only filter ────────────────────────────────────────────────────
    if (tribal === "true" && !state) {
      const results = await db
        .select()
        .from(authorityJurisdictionTable)
        .where(eq(authorityJurisdictionTable.tribalLandFlag, true))
        .orderBy(asc(authorityJurisdictionTable.stateCode), asc(authorityJurisdictionTable.county));
      res.json({ mode: "tribal", count: results.length, results });
      return;
    }

    // ── Hierarchical: state + county → cities / flags ─────────────────────────
    if (state && county) {
      const conditions: SQL<unknown>[] = [
        eq(authorityJurisdictionTable.stateCode, state.toUpperCase()),
        ilike(authorityJurisdictionTable.county, county),
      ];
      if (tribal === "true") conditions.push(eq(authorityJurisdictionTable.tribalLandFlag, true));
      const results = await db
        .select()
        .from(authorityJurisdictionTable)
        .where(and(...(conditions as [SQL<unknown>, ...SQL<unknown>[]])))
        .orderBy(asc(authorityJurisdictionTable.city));
      res.json({ mode: "cities", state: state.toUpperCase(), county, count: results.length, results });
      return;
    }

    // ── Hierarchical: state only → counties ──────────────────────────────────
    if (state) {
      const conditions: SQL<unknown>[] = [eq(authorityJurisdictionTable.stateCode, state.toUpperCase())];
      if (tribal === "true") conditions.push(eq(authorityJurisdictionTable.tribalLandFlag, true));
      const results = await db
        .select()
        .from(authorityJurisdictionTable)
        .where(conditions.length === 1 ? conditions[0] : and(...(conditions as [SQL<unknown>, ...SQL<unknown>[]])))
        .orderBy(asc(authorityJurisdictionTable.county));
      res.json({ mode: "counties", state: state.toUpperCase(), count: results.length, results });
      return;
    }

    // ── Default: return all distinct states ───────────────────────────────────
    const results = await db
      .selectDistinct({ stateCode: authorityJurisdictionTable.stateCode, stateName: authorityJurisdictionTable.stateName })
      .from(authorityJurisdictionTable)
      .orderBy(asc(authorityJurisdictionTable.stateCode));
    res.json({ mode: "states", count: results.length, results });
  } catch (err) {
    next(err);
  }
});

export default router;
