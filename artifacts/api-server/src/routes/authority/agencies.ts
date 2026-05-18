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

    // Validate + clamp confidenceScore to prevent injection via unquoted numeric interpolation
    const rawScore = confidenceScore != null ? Number(confidenceScore) : 0.8;
    if (!Number.isFinite(rawScore)) {
      res.status(400).json({ error: "confidenceScore must be a finite number" });
      return;
    }
    const scoreSafe = Math.max(0, Math.min(1, rawScore));

    // Use raw SQL to target the functional unique index
    // (COALESCE(state_code,''), COALESCE(county,'')) which Drizzle cannot express as a conflict target.
    const agencyTypeSafe = agencyType.replace(/'/g, "''");
    const agencyNameSafe = agencyName.replace(/'/g, "''");
    const governmentLevelSafe = governmentLevel.replace(/'/g, "''");
    const stateSafe = stateCode ? `'${stateCode.replace(/'/g, "''")}'` : "NULL";
    const countySafe = county ? `'${county.replace(/'/g, "''")}'` : "NULL";
    const citySafe = city ? `'${city.replace(/'/g, "''")}'` : "NULL";
    const mailSafe = mailingAddress ? `'${mailingAddress.replace(/'/g, "''")}'` : "NULL";
    const physSafe = physicalAddress ? `'${physicalAddress.replace(/'/g, "''")}'` : "NULL";
    const parentSafe = parentAgency ? `'${parentAgency.replace(/'/g, "''")}'` : "NULL";
    const oversightSafe = oversightAgency ? `'${oversightAgency.replace(/'/g, "''")}'` : "NULL";
    const emailSafe = contactEmail ? `'${contactEmail.replace(/'/g, "''")}'` : "NULL";
    const phoneSafe = phone ? `'${phone.replace(/'/g, "''")}'` : "NULL";
    const webSafe = website ? `'${website.replace(/'/g, "''")}'` : "NULL";
    const sourceSafe = sourceUrl ? `'${sourceUrl.replace(/'/g, "''")}'` : "NULL";
    const verifiedSafe = verifiedAt.toISOString();

    const result = await db.execute(sql.raw(`
      INSERT INTO agency_directory
        (agency_name, agency_type, government_level, state_code, county, city,
         mailing_address, physical_address, parent_agency, oversight_agency,
         contact_email, phone, website, source_url, confidence_score, last_verified_date, last_synced_at)
      VALUES
        ('${agencyNameSafe}', '${agencyTypeSafe}', '${governmentLevelSafe}', ${stateSafe}, ${countySafe}, ${citySafe},
         ${mailSafe}, ${physSafe}, ${parentSafe}, ${oversightSafe},
         ${emailSafe}, ${phoneSafe}, ${webSafe}, ${sourceSafe}, ${scoreSafe}, '${verifiedSafe}', NOW())
      ON CONFLICT (agency_name, government_level, COALESCE(state_code,''), COALESCE(county,''))
      DO UPDATE SET
        agency_type        = EXCLUDED.agency_type,
        mailing_address    = EXCLUDED.mailing_address,
        physical_address   = EXCLUDED.physical_address,
        parent_agency      = EXCLUDED.parent_agency,
        oversight_agency   = EXCLUDED.oversight_agency,
        contact_email      = EXCLUDED.contact_email,
        phone              = EXCLUDED.phone,
        website            = EXCLUDED.website,
        source_url         = EXCLUDED.source_url,
        confidence_score   = EXCLUDED.confidence_score,
        last_verified_date = EXCLUDED.last_verified_date,
        last_synced_at     = NOW(),
        updated_at         = NOW()
      RETURNING *
    `));

    const upserted = (result as { rows: unknown[] }).rows?.[0] ?? null;
    res.status(201).json({ action: "upserted", agency: upserted });
  } catch (err) {
    next(err);
  }
});

export default router;
