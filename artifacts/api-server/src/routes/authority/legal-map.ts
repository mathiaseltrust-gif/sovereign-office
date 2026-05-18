/**
 * GET /api/authority/legal-map          — list all legal authority mappings
 * GET /api/authority/legal-map/:issueType — get mappings for a specific issue type
 */
import { Router } from "express";
import { requireAuth } from "../../auth/entra-guard";
import { db } from "@workspace/db";
import { authorityLegalMapTable } from "@workspace/db";
import { eq, ilike, or } from "drizzle-orm";

const router = Router();

router.get("/", requireAuth, async (req, res, next) => {
  try {
    const { q } = req.query as { q?: string };
    const maps = await db
      .select()
      .from(authorityLegalMapTable)
      .where(
        q
          ? or(
              ilike(authorityLegalMapTable.issueType, `%${q}%`),
              ilike(authorityLegalMapTable.authorityName, `%${q}%`),
              ilike(authorityLegalMapTable.uscReference, `%${q}%`),
              ilike(authorityLegalMapTable.cfrReference, `%${q}%`),
            )
          : undefined
      )
      .orderBy(authorityLegalMapTable.issueType);
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
      .where(ilike(authorityLegalMapTable.issueType, `%${req.params.issueType}%`));

    res.json({ count: maps.length, maps });
  } catch (err) {
    next(err);
  }
});

export default router;
