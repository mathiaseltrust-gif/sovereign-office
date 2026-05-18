/**
 * GET  /api/authority/agencies        — filtered agency search (requires ≥1 param, max 50)
 * GET  /api/authority/agencies/:id    — single agency by ID
 * POST /api/authority/agencies        — manually add or upsert an agency (trustee/admin only)
 */
import { Router } from "express";
import { requireAuth, requireAnyRole } from "../../auth/entra-guard";
import { db } from "@workspace/db";
import { authorityAgenciesTable } from "@workspace/db";
import { eq, ilike, and, or, asc, SQL, sql } from "drizzle-orm";

const router = Router();

router.get("/", requireAuth, async (req, res, next) => {
  try {
    const { state, county, city, level, type, name, agencyType, governmentLevel, q } = req.query as Record<string, string | undefined>;

    const agencyTypeFinal = type ?? agencyType;
    const govLevelFinal = level ?? governmentLevel;

    const hasFilter = state || county || city || govLevelFinal || agencyTypeFinal || name || q;
    if (!hasFilter) {
      res.status(400).json({
        error: "At least one filter is required: state, county, city, level, type, name, or q",
      });
      return;
    }

    const conditions: SQL<unknown>[] = [];
    if (state) conditions.push(eq(authorityAgenciesTable.stateCode, state.toUpperCase()));
    if (county) conditions.push(ilike(authorityAgenciesTable.county, `%${county}%`));
    if (city) conditions.push(ilike(authorityAgenciesTable.city, `%${city}%`));
    if (govLevelFinal) conditions.push(ilike(authorityAgenciesTable.governmentLevel, `%${govLevelFinal}%`));
    if (agencyTypeFinal) conditions.push(ilike(authorityAgenciesTable.agencyType, `%${agencyTypeFinal}%`));
    if (name) {
      conditions.push(
        or(
          ilike(authorityAgenciesTable.agencyName, `%${name}%`),
          ilike(authorityAgenciesTable.parentAgency, `%${name}%`),
        ) as SQL<unknown>
      );
    }
    if (q) {
      conditions.push(
        or(
          ilike(authorityAgenciesTable.agencyName, `%${q}%`),
          ilike(authorityAgenciesTable.county, `%${q}%`),
          ilike(authorityAgenciesTable.city, `%${q}%`),
          ilike(authorityAgenciesTable.parentAgency, `%${q}%`),
          ilike(authorityAgenciesTable.agencyType, `%${q}%`),
        ) as SQL<unknown>
      );
    }

    const whereClause = conditions.length === 1
      ? conditions[0]
      : and(...(conditions as [SQL<unknown>, ...SQL<unknown>[]]));

    const results = await db
      .select()
      .from(authorityAgenciesTable)
      .where(whereClause)
      .limit(50)
      .orderBy(asc(authorityAgenciesTable.governmentLevel), asc(authorityAgenciesTable.agencyName));

    res.json({ count: results.length, results });
  } catch (err) {
    next(err);
  }
});

router.get("/:id", requireAuth, async (req, res, next) => {
  try {
    const id = parseInt(String(req.params.id), 10);
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

router.post("/", requireAuth, requireAnyRole(["trustee", "admin"]), async (req, res, next) => {
  try {
    const {
      agencyName,
      agencyType,
      governmentLevel,
      stateCode,
      county,
      city,
      mailingAddress,
      physicalAddress,
      parentAgency,
      oversightAgency,
      contactEmail,
      phone,
      website,
      sourceUrl,
      confidenceScore,
      lastVerifiedDate,
    } = req.body as {
      agencyName: string;
      agencyType: string;
      governmentLevel: string;
      stateCode?: string;
      county?: string;
      city?: string;
      mailingAddress?: string;
      physicalAddress?: string;
      parentAgency?: string;
      oversightAgency?: string;
      contactEmail?: string;
      phone?: string;
      website?: string;
      sourceUrl?: string;
      confidenceScore?: number;
      lastVerifiedDate?: string;
    };

    if (!agencyName || !agencyType || !governmentLevel) {
      res.status(400).json({ error: "agencyName, agencyType, and governmentLevel are required" });
      return;
    }

    const verifiedAt = lastVerifiedDate ? new Date(lastVerifiedDate) : new Date();

    const values = {
      agencyName,
      agencyType,
      governmentLevel,
      stateCode: stateCode ?? null,
      county: county ?? null,
      city: city ?? null,
      mailingAddress: mailingAddress ?? null,
      physicalAddress: physicalAddress ?? null,
      parentAgency: parentAgency ?? null,
      oversightAgency: oversightAgency ?? null,
      contactEmail: contactEmail ?? null,
      phone: phone ?? null,
      website: website ?? null,
      sourceUrl: sourceUrl ?? null,
      confidenceScore: confidenceScore ?? 0.8,
      lastVerifiedDate: verifiedAt,
    };

    const [upserted] = await db
      .insert(authorityAgenciesTable)
      .values(values)
      .onConflictDoUpdate({
        target: [
          authorityAgenciesTable.agencyName,
          authorityAgenciesTable.governmentLevel,
        ],
        set: {
          agencyType,
          mailingAddress: mailingAddress ?? null,
          physicalAddress: physicalAddress ?? null,
          parentAgency: parentAgency ?? null,
          oversightAgency: oversightAgency ?? null,
          contactEmail: contactEmail ?? null,
          phone: phone ?? null,
          website: website ?? null,
          sourceUrl: sourceUrl ?? null,
          confidenceScore: confidenceScore ?? 0.8,
          lastVerifiedDate: verifiedAt,
          updatedAt: new Date(),
        },
      })
      .returning();

    res.status(201).json({ action: "upserted", agency: upserted });
  } catch (err) {
    next(err);
  }
});

export default router;
