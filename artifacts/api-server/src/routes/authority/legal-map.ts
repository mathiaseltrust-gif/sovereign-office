/**
 * GET /api/authority/legal-map          — list all legal authority mappings
 * GET /api/authority/legal-map/:issueType — get mappings for a specific issue type
 */
import { Router } from "express";
import { requireAuth } from "../../auth/entra-guard";
import { db } from "@workspace/db";
import { authorityLegalMapTable } from "@workspace/db";
import { ilike, or, asc } from "drizzle-orm";

const router = Router();

router.get("/", requireAuth, async (req, res, next) => {
  try {
    const { q, issueType, federalAuthority } = req.query as Record<string, string | undefined>;

    let whereClause;
    if (q) {
      whereClause = or(
        ilike(authorityLegalMapTable.issueType, `%${q}%`),
        ilike(authorityLegalMapTable.authorityName, `%${q}%`),
        ilike(authorityLegalMapTable.uscReference, `%${q}%`),
        ilike(authorityLegalMapTable.cfrReference, `%${q}%`),
      );
    } else if (issueType) {
      whereClause = ilike(authorityLegalMapTable.issueType, `%${issueType}%`);
    } else if (federalAuthority) {
      whereClause = ilike(authorityLegalMapTable.federalAuthority, `%${federalAuthority}%`);
    }

    const maps = await db
      .select()
      .from(authorityLegalMapTable)
      .where(whereClause)
      .orderBy(asc(authorityLegalMapTable.issueType));
    res.json({ count: maps.length, maps });
  } catch (err) {
    next(err);
  }
});

router.get("/:issueType", requireAuth, async (req, res, next) => {
  try {
    const maps = await db
      .select()
      .from(authorityLegalMapTable)
      .where(ilike(authorityLegalMapTable.issueType, `%${req.params.issueType}%`))
      .orderBy(asc(authorityLegalMapTable.issueType));

    res.json({ count: maps.length, maps });
  } catch (err) {
    next(err);
  }
});

export default router;
