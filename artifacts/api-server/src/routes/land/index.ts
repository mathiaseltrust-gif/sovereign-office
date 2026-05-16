import { Router, type Request, type Response, type NextFunction } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { requireAuth } from "../../auth/entra-guard";
import { logger } from "../../lib/logger";

const router = Router();

// Land write access: trustee, officer, sovereign_admin, admin, chief_justice
const LAND_WRITE_ROLES = new Set(["trustee", "officer", "sovereign_admin", "admin", "chief_justice"]);
function requireLandWrite(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) { res.status(401).json({ error: "Authentication required." }); return; }
  const roles: string[] = req.user.roles ?? [];
  if (!roles.some(r => LAND_WRITE_ROLES.has(r))) {
    res.status(403).json({ error: "Insufficient privileges for land management. Required: trustee, officer, or sovereign admin." });
    return;
  }
  next();
}

// ── helpers ───────────────────────────────────────────────────────────────────

function num(v: unknown): number | null {
  if (v === undefined || v === null || v === "") return null;
  const n = Number(v);
  return isNaN(n) ? null : n;
}

function str(v: unknown): string | null {
  if (v === undefined || v === null || v === "") return null;
  return String(v).trim();
}

function bool(v: unknown): boolean {
  return v === true || v === "true" || v === 1 || v === "1";
}

// ── GET /api/land/stats ────────────────────────────────────────────────────────

router.get("/stats", requireAuth, async (_req, res, next) => {
  try {
    const [parcels, leases, pipeline, enc, notices] = await Promise.all([
      db.execute(sql`
        SELECT
          COUNT(*)::int                                                       AS total_parcels,
          COALESCE(SUM(acreage),0)                                            AS total_acreage,
          COALESCE(SUM(CASE WHEN internal_tribal_status='tribal_government_land' THEN acreage ELSE 0 END),0)    AS gov_acreage,
          COALESCE(SUM(CASE WHEN internal_tribal_status='tribal_trust_stewardship' THEN acreage ELSE 0 END),0) AS trust_acreage,
          COALESCE(SUM(CASE WHEN internal_tribal_status='protected_tribal_land' THEN acreage ELSE 0 END),0)    AS protected_acreage,
          COALESCE(SUM(CASE WHEN internal_tribal_status='sacred_cultural_land' THEN acreage ELSE 0 END),0)     AS sacred_acreage,
          COALESCE(SUM(CASE WHEN internal_tribal_status='beneficiary_stewardship' THEN acreage ELSE 0 END),0)  AS beneficiary_acreage,
          COALESCE(SUM(CASE WHEN internal_tribal_status='restricted_tribal_status' THEN acreage ELSE 0 END),0) AS restricted_acreage,
          COUNT(CASE WHEN status='active' THEN 1 END)::int                   AS active_parcels,
          COUNT(CASE WHEN status='disputed' THEN 1 END)::int                 AS disputed_parcels,
          COUNT(CASE WHEN jurisdictional_status='exclusive_tribal' THEN 1 END)::int AS exclusive_jurisdiction,
          COUNT(CASE WHEN jurisdictional_status='contested' THEN 1 END)::int AS contested_parcels
        FROM land_parcels
      `),
      db.execute(sql`
        SELECT
          COUNT(*)::int                                           AS total_leases,
          COUNT(CASE WHEN status='active' THEN 1 END)::int       AS active_leases,
          COALESCE(SUM(CASE WHEN status='active' THEN annual_rent ELSE 0 END),0) AS annual_revenue,
          COUNT(CASE WHEN status='active' AND end_date BETWEEN NOW() AND NOW() + INTERVAL '90 days' THEN 1 END)::int AS expiring_soon
        FROM land_leases
      `),
      db.execute(sql`
        SELECT COUNT(*)::int AS pipeline_count,
               COUNT(CASE WHEN stage NOT IN ('transferred','cancelled','restored') THEN 1 END)::int AS active_pipeline,
               COALESCE(SUM(CASE WHEN stage NOT IN ('transferred','cancelled','restored') THEN acreage ELSE 0 END),0) AS pipeline_acreage
        FROM land_acquisition_pipeline
      `),
      db.execute(sql`
        SELECT COUNT(*)::int AS total_encumbrances,
               COUNT(CASE WHEN status='active' THEN 1 END)::int AS active_encumbrances,
               COUNT(CASE WHEN void_ab_initio=true THEN 1 END)::int AS void_ab_initio_count
        FROM land_encumbrances
      `),
      db.execute(sql`
        SELECT COUNT(*)::int AS total_notices,
               COUNT(CASE WHEN status='issued' OR status='served' THEN 1 END)::int AS active_notices
        FROM land_notices
      `),
    ]);

    const p = parcels.rows[0] as Record<string, unknown>;
    const l = leases.rows[0] as Record<string, unknown>;
    const q = pipeline.rows[0] as Record<string, unknown>;
    const e = enc.rows[0] as Record<string, unknown>;
    const n = notices.rows[0] as Record<string, unknown>;

    res.json({
      totalParcels: p.total_parcels,
      totalAcreage: Number(p.total_acreage),
      govAcreage: Number(p.gov_acreage),
      trustAcreage: Number(p.trust_acreage),
      protectedAcreage: Number(p.protected_acreage),
      sacredAcreage: Number(p.sacred_acreage),
      beneficiaryAcreage: Number(p.beneficiary_acreage),
      restrictedAcreage: Number(p.restricted_acreage),
      activeParcels: p.active_parcels,
      disputedParcels: p.disputed_parcels,
      exclusiveJurisdiction: p.exclusive_jurisdiction,
      contestedParcels: p.contested_parcels,
      totalLeases: l.total_leases,
      activeLeases: l.active_leases,
      annualRevenue: Number(l.annual_revenue),
      expiringSoon: l.expiring_soon,
      pipelineCount: q.pipeline_count,
      activePipeline: q.active_pipeline,
      pipelineAcreage: Number(q.pipeline_acreage),
      activeEncumbrances: e.active_encumbrances,
      voidAbInitioCount: e.void_ab_initio_count,
      activeNotices: n.active_notices,
    });
  } catch (err) { next(err); }
});

// ── PARCELS ───────────────────────────────────────────────────────────────────

router.get("/parcels", requireAuth, async (req, res, next) => {
  try {
    const { classification, status, county, internalStatus, jurisdictionalStatus } = req.query as Record<string, string>;
    let q = sql`SELECT * FROM land_parcels WHERE 1=1`;
    if (classification) q = sql`${q} AND classification = ${classification}`;
    if (status) q = sql`${q} AND status = ${status}`;
    if (county) q = sql`${q} AND LOWER(county) LIKE ${"%" + county.toLowerCase() + "%"}`;
    if (internalStatus) q = sql`${q} AND internal_tribal_status = ${internalStatus}`;
    if (jurisdictionalStatus) q = sql`${q} AND jurisdictional_status = ${jurisdictionalStatus}`;
    q = sql`${q} ORDER BY created_at DESC`;
    const result = await db.execute(q);
    res.json(result.rows);
  } catch (err) { next(err); }
});

router.post("/parcels", requireAuth, requireLandWrite, async (req, res, next) => {
  try {
    const {
      tractNumber, parcelId, legalDescription, acreage, classification,
      status, county, state, plssDescription, ownerType, acquiredDate,
      acquisitionSource, biaTractNumber, lat, lng, notes,
      // tribal code authority
      internalTribalStatus, federalAdminStatus, jurisdictionalStatus,
      beneficiaryStewType, protectionRestrictionStatus, tribalCodeRef,
      tribalCourtOrderNum, protectedStatusBasis, restrictionBasis,
      enforcementAuthority, federalLawCrossRef, stewardshipPurpose,
      culturalSignificance, historicalOccupancy,
    } = req.body as Record<string, unknown>;

    const result = await db.execute(sql`
      INSERT INTO land_parcels (
        tract_number, parcel_id, legal_description, acreage, classification,
        status, county, state, plss_description, owner_type, acquired_date,
        acquisition_source, bia_tract_number, lat, lng, notes,
        internal_tribal_status, federal_admin_status, jurisdictional_status,
        beneficiary_stewardship_type, protection_restriction_status, tribal_code_ref,
        tribal_court_order_num, protected_status_basis, restriction_basis,
        enforcement_authority, federal_law_cross_ref, stewardship_purpose,
        cultural_significance, historical_occupancy
      ) VALUES (
        ${str(tractNumber)}, ${str(parcelId)}, ${str(legalDescription)},
        ${num(acreage)}, ${str(classification) ?? "protected_tribal_land"},
        ${str(status) ?? "active"}, ${str(county)}, ${str(state) ?? "TX"},
        ${str(plssDescription)}, ${str(ownerType) ?? "tribal"},
        ${str(acquiredDate)}, ${str(acquisitionSource)},
        ${str(biaTractNumber)}, ${str(lat)}, ${str(lng)}, ${str(notes)},
        ${str(internalTribalStatus)}, ${str(federalAdminStatus)}, ${str(jurisdictionalStatus)},
        ${str(beneficiaryStewType)}, ${str(protectionRestrictionStatus)}, ${str(tribalCodeRef)},
        ${str(tribalCourtOrderNum)}, ${str(protectedStatusBasis)}, ${str(restrictionBasis)},
        ${str(enforcementAuthority)}, ${str(federalLawCrossRef)}, ${str(stewardshipPurpose)},
        ${str(culturalSignificance)}, ${str(historicalOccupancy)}
      )
      RETURNING *
    `);
    logger.info({ id: (result.rows[0] as Record<string, unknown>).id }, "Land parcel created");
    res.status(201).json(result.rows[0]);
  } catch (err) { next(err); }
});

router.get("/parcels/:id", requireAuth, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const [parcel, leases, assets, enc, notices] = await Promise.all([
      db.execute(sql`SELECT * FROM land_parcels WHERE id = ${id}`),
      db.execute(sql`SELECT * FROM land_leases WHERE parcel_id = ${id} ORDER BY end_date ASC`),
      db.execute(sql`SELECT * FROM land_assets WHERE parcel_id = ${id} ORDER BY asset_type, name`),
      db.execute(sql`SELECT * FROM land_encumbrances WHERE parcel_id = ${id} ORDER BY created_at DESC`),
      db.execute(sql`SELECT * FROM land_notices WHERE parcel_id = ${id} ORDER BY created_at DESC`),
    ]);
    if (!parcel.rows[0]) { res.status(404).json({ error: "Parcel not found" }); return; }
    res.json({
      ...(parcel.rows[0] as Record<string, unknown>),
      leases: leases.rows, assets: assets.rows,
      encumbrances: enc.rows, notices: notices.rows,
    });
  } catch (err) { next(err); }
});

router.put("/parcels/:id", requireAuth, requireLandWrite, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const {
      tractNumber, parcelId, legalDescription, acreage, classification,
      status, county, state, plssDescription, ownerType, acquiredDate,
      acquisitionSource, biaTractNumber, lat, lng, notes,
      internalTribalStatus, federalAdminStatus, jurisdictionalStatus,
      beneficiaryStewType, protectionRestrictionStatus, tribalCodeRef,
      tribalCourtOrderNum, protectedStatusBasis, restrictionBasis,
      enforcementAuthority, federalLawCrossRef, stewardshipPurpose,
      culturalSignificance, historicalOccupancy,
    } = req.body as Record<string, unknown>;
    await db.execute(sql`
      UPDATE land_parcels SET
        tract_number = ${str(tractNumber)},
        parcel_id = ${str(parcelId)},
        legal_description = ${str(legalDescription)},
        acreage = ${num(acreage)},
        classification = ${str(classification)},
        status = ${str(status)},
        county = ${str(county)},
        state = ${str(state)},
        plss_description = ${str(plssDescription)},
        owner_type = ${str(ownerType)},
        acquired_date = ${str(acquiredDate)},
        acquisition_source = ${str(acquisitionSource)},
        bia_tract_number = ${str(biaTractNumber)},
        lat = ${str(lat)},
        lng = ${str(lng)},
        notes = ${str(notes)},
        internal_tribal_status = ${str(internalTribalStatus)},
        federal_admin_status = ${str(federalAdminStatus)},
        jurisdictional_status = ${str(jurisdictionalStatus)},
        beneficiary_stewardship_type = ${str(beneficiaryStewType)},
        protection_restriction_status = ${str(protectionRestrictionStatus)},
        tribal_code_ref = ${str(tribalCodeRef)},
        tribal_court_order_num = ${str(tribalCourtOrderNum)},
        protected_status_basis = ${str(protectedStatusBasis)},
        restriction_basis = ${str(restrictionBasis)},
        enforcement_authority = ${str(enforcementAuthority)},
        federal_law_cross_ref = ${str(federalLawCrossRef)},
        stewardship_purpose = ${str(stewardshipPurpose)},
        cultural_significance = ${str(culturalSignificance)},
        historical_occupancy = ${str(historicalOccupancy)},
        updated_at = NOW()
      WHERE id = ${id}
    `);
    const updated = await db.execute(sql`SELECT * FROM land_parcels WHERE id = ${id}`);
    res.json(updated.rows[0]);
  } catch (err) { next(err); }
});

router.delete("/parcels/:id", requireAuth, requireLandWrite, async (req, res, next) => {
  try {
    await db.execute(sql`DELETE FROM land_parcels WHERE id = ${Number(req.params.id)}`);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// ── LEASES ────────────────────────────────────────────────────────────────────

router.get("/leases", requireAuth, async (req, res, next) => {
  try {
    const { parcelId, status, type } = req.query as Record<string, string>;
    let q = sql`
      SELECT l.*, p.tract_number, p.legal_description, p.acreage AS parcel_acreage
      FROM land_leases l
      LEFT JOIN land_parcels p ON l.parcel_id = p.id
      WHERE 1=1
    `;
    if (parcelId) q = sql`${q} AND l.parcel_id = ${Number(parcelId)}`;
    if (status) q = sql`${q} AND l.status = ${status}`;
    if (type) q = sql`${q} AND l.lease_type = ${type}`;
    q = sql`${q} ORDER BY l.end_date ASC NULLS LAST`;
    const result = await db.execute(q);
    res.json(result.rows);
  } catch (err) { next(err); }
});

router.post("/leases", requireAuth, requireLandWrite, async (req, res, next) => {
  try {
    const {
      parcelId, leaseType, lesseeName, lesseeContact, startDate, endDate,
      annualRent, paymentFrequency, status, biaLeaseNumber, description,
    } = req.body as Record<string, unknown>;
    const result = await db.execute(sql`
      INSERT INTO land_leases (
        parcel_id, lease_type, lessee_name, lessee_contact, start_date, end_date,
        annual_rent, payment_frequency, status, bia_lease_number, description
      ) VALUES (
        ${num(parcelId)}, ${str(leaseType)}, ${str(lesseeName)},
        ${JSON.stringify(lesseeContact ?? {})},
        ${str(startDate) ? sql`${str(startDate)}::date` : sql`NULL`},
        ${str(endDate) ? sql`${str(endDate)}::date` : sql`NULL`},
        ${num(annualRent)}, ${str(paymentFrequency) ?? "annual"},
        ${str(status) ?? "active"}, ${str(biaLeaseNumber)}, ${str(description)}
      )
      RETURNING *
    `);
    res.status(201).json(result.rows[0]);
  } catch (err) { next(err); }
});

router.put("/leases/:id", requireAuth, requireLandWrite, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const {
      leaseType, lesseeName, lesseeContact, startDate, endDate,
      annualRent, paymentFrequency, status, biaLeaseNumber, description,
    } = req.body as Record<string, unknown>;
    await db.execute(sql`
      UPDATE land_leases SET
        lease_type = ${str(leaseType)},
        lessee_name = ${str(lesseeName)},
        lessee_contact = ${JSON.stringify(lesseeContact ?? {})},
        start_date = ${str(startDate) ? sql`${str(startDate)}::date` : sql`NULL`},
        end_date = ${str(endDate) ? sql`${str(endDate)}::date` : sql`NULL`},
        annual_rent = ${num(annualRent)},
        payment_frequency = ${str(paymentFrequency)},
        status = ${str(status)},
        bia_lease_number = ${str(biaLeaseNumber)},
        description = ${str(description)},
        updated_at = NOW()
      WHERE id = ${id}
    `);
    const updated = await db.execute(sql`SELECT * FROM land_leases WHERE id = ${id}`);
    res.json(updated.rows[0]);
  } catch (err) { next(err); }
});

router.delete("/leases/:id", requireAuth, requireLandWrite, async (req, res, next) => {
  try {
    await db.execute(sql`DELETE FROM land_leases WHERE id = ${Number(req.params.id)}`);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// ── ASSETS ────────────────────────────────────────────────────────────────────

router.get("/assets", requireAuth, async (req, res, next) => {
  try {
    const { parcelId, assetType } = req.query as Record<string, string>;
    let q = sql`
      SELECT a.*, p.tract_number
      FROM land_assets a
      LEFT JOIN land_parcels p ON a.parcel_id = p.id
      WHERE 1=1
    `;
    if (parcelId) q = sql`${q} AND a.parcel_id = ${Number(parcelId)}`;
    if (assetType) q = sql`${q} AND a.asset_type = ${assetType}`;
    q = sql`${q} ORDER BY a.asset_type, a.name`;
    const result = await db.execute(q);
    res.json(result.rows);
  } catch (err) { next(err); }
});

router.post("/assets", requireAuth, requireLandWrite, async (req, res, next) => {
  try {
    const { parcelId, assetType, name, description, estimatedValue, conditionRating, yearBuilt, notes } = req.body as Record<string, unknown>;
    const result = await db.execute(sql`
      INSERT INTO land_assets (parcel_id, asset_type, name, description, estimated_value, condition_rating, year_built, notes)
      VALUES (${num(parcelId)}, ${str(assetType)}, ${str(name)}, ${str(description)}, ${num(estimatedValue)}, ${str(conditionRating)}, ${num(yearBuilt)}, ${str(notes)})
      RETURNING *
    `);
    res.status(201).json(result.rows[0]);
  } catch (err) { next(err); }
});

router.put("/assets/:id", requireAuth, requireLandWrite, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const { assetType, name, description, estimatedValue, conditionRating, yearBuilt, notes } = req.body as Record<string, unknown>;
    await db.execute(sql`
      UPDATE land_assets SET
        asset_type = ${str(assetType)}, name = ${str(name)}, description = ${str(description)},
        estimated_value = ${num(estimatedValue)}, condition_rating = ${str(conditionRating)},
        year_built = ${num(yearBuilt)}, notes = ${str(notes)}, updated_at = NOW()
      WHERE id = ${id}
    `);
    const updated = await db.execute(sql`SELECT * FROM land_assets WHERE id = ${id}`);
    res.json(updated.rows[0]);
  } catch (err) { next(err); }
});

router.delete("/assets/:id", requireAuth, requireLandWrite, async (req, res, next) => {
  try {
    await db.execute(sql`DELETE FROM land_assets WHERE id = ${Number(req.params.id)}`);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// ── ENCUMBRANCES ──────────────────────────────────────────────────────────────

router.get("/encumbrances", requireAuth, async (req, res, next) => {
  try {
    const { parcelId, status, type, voidAbInitio } = req.query as Record<string, string>;
    let q = sql`
      SELECT e.*, p.tract_number
      FROM land_encumbrances e
      LEFT JOIN land_parcels p ON e.parcel_id = p.id
      WHERE 1=1
    `;
    if (parcelId) q = sql`${q} AND e.parcel_id = ${Number(parcelId)}`;
    if (status) q = sql`${q} AND e.status = ${status}`;
    if (type) q = sql`${q} AND e.encumbrance_type = ${type}`;
    if (voidAbInitio === "true") q = sql`${q} AND e.void_ab_initio = true`;
    q = sql`${q} ORDER BY e.void_ab_initio DESC, e.created_at DESC`;
    const result = await db.execute(q);
    res.json(result.rows);
  } catch (err) { next(err); }
});

router.post("/encumbrances", requireAuth, requireLandWrite, async (req, res, next) => {
  try {
    const { parcelId, encumbranceType, title, description, source, dateIdentified,
      status, federalLawImplicated, tribalCodeRef, voidAbInitio, resolutionNotes } = req.body as Record<string, unknown>;
    const result = await db.execute(sql`
      INSERT INTO land_encumbrances (
        parcel_id, encumbrance_type, title, description, source, date_identified,
        status, federal_law_implicated, tribal_code_ref, void_ab_initio, resolution_notes
      ) VALUES (
        ${num(parcelId)}, ${str(encumbranceType)}, ${str(title)}, ${str(description)},
        ${str(source)}, ${str(dateIdentified)}, ${str(status) ?? "active"},
        ${str(federalLawImplicated)}, ${str(tribalCodeRef)}, ${bool(voidAbInitio)}, ${str(resolutionNotes)}
      )
      RETURNING *
    `);
    res.status(201).json(result.rows[0]);
  } catch (err) { next(err); }
});

router.put("/encumbrances/:id", requireAuth, requireLandWrite, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const { encumbranceType, title, description, source, dateIdentified,
      status, federalLawImplicated, tribalCodeRef, voidAbInitio, resolutionNotes } = req.body as Record<string, unknown>;
    await db.execute(sql`
      UPDATE land_encumbrances SET
        encumbrance_type = ${str(encumbranceType)}, title = ${str(title)},
        description = ${str(description)}, source = ${str(source)},
        date_identified = ${str(dateIdentified)}, status = ${str(status)},
        federal_law_implicated = ${str(federalLawImplicated)},
        tribal_code_ref = ${str(tribalCodeRef)},
        void_ab_initio = ${bool(voidAbInitio)},
        resolution_notes = ${str(resolutionNotes)},
        updated_at = NOW()
      WHERE id = ${id}
    `);
    const updated = await db.execute(sql`SELECT * FROM land_encumbrances WHERE id = ${id}`);
    res.json(updated.rows[0]);
  } catch (err) { next(err); }
});

router.delete("/encumbrances/:id", requireAuth, requireLandWrite, async (req, res, next) => {
  try {
    await db.execute(sql`DELETE FROM land_encumbrances WHERE id = ${Number(req.params.id)}`);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// ── NOTICES ───────────────────────────────────────────────────────────────────

router.get("/notices", requireAuth, async (req, res, next) => {
  try {
    const { parcelId, status, type } = req.query as Record<string, string>;
    let q = sql`
      SELECT n.*, p.tract_number
      FROM land_notices n
      LEFT JOIN land_parcels p ON n.parcel_id = p.id
      WHERE 1=1
    `;
    if (parcelId) q = sql`${q} AND n.parcel_id = ${Number(parcelId)}`;
    if (status) q = sql`${q} AND n.status = ${status}`;
    if (type) q = sql`${q} AND n.notice_type = ${type}`;
    q = sql`${q} ORDER BY n.created_at DESC`;
    const result = await db.execute(q);
    res.json(result.rows);
  } catch (err) { next(err); }
});

router.post("/notices", requireAuth, requireLandWrite, async (req, res, next) => {
  try {
    const { parcelId, noticeType, title, content, issuedDate, effectiveDate,
      servedTo, serviceMethod, status, tribalCodeRef, federalLawRef,
      courtOrderRef, enforcementAction } = req.body as Record<string, unknown>;
    const result = await db.execute(sql`
      INSERT INTO land_notices (
        parcel_id, notice_type, title, content, issued_date, effective_date,
        served_to, service_method, status, tribal_code_ref, federal_law_ref,
        court_order_ref, enforcement_action
      ) VALUES (
        ${num(parcelId)}, ${str(noticeType)}, ${str(title)}, ${str(content)},
        ${str(issuedDate)}, ${str(effectiveDate)}, ${str(servedTo)},
        ${str(serviceMethod) ?? "certified"}, ${str(status) ?? "draft"},
        ${str(tribalCodeRef)}, ${str(federalLawRef)},
        ${str(courtOrderRef)}, ${str(enforcementAction)}
      )
      RETURNING *
    `);
    res.status(201).json(result.rows[0]);
  } catch (err) { next(err); }
});

router.put("/notices/:id", requireAuth, requireLandWrite, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const { noticeType, title, content, issuedDate, effectiveDate,
      servedTo, serviceMethod, status, tribalCodeRef, federalLawRef,
      courtOrderRef, enforcementAction } = req.body as Record<string, unknown>;
    await db.execute(sql`
      UPDATE land_notices SET
        notice_type = ${str(noticeType)}, title = ${str(title)}, content = ${str(content)},
        issued_date = ${str(issuedDate)}, effective_date = ${str(effectiveDate)},
        served_to = ${str(servedTo)}, service_method = ${str(serviceMethod)},
        status = ${str(status)}, tribal_code_ref = ${str(tribalCodeRef)},
        federal_law_ref = ${str(federalLawRef)}, court_order_ref = ${str(courtOrderRef)},
        enforcement_action = ${str(enforcementAction)}, updated_at = NOW()
      WHERE id = ${id}
    `);
    const updated = await db.execute(sql`SELECT * FROM land_notices WHERE id = ${id}`);
    res.json(updated.rows[0]);
  } catch (err) { next(err); }
});

router.delete("/notices/:id", requireAuth, requireLandWrite, async (req, res, next) => {
  try {
    await db.execute(sql`DELETE FROM land_notices WHERE id = ${Number(req.params.id)}`);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// ── STEWARDSHIP PIPELINE ──────────────────────────────────────────────────────

router.get("/pipeline", requireAuth, async (_req, res, next) => {
  try {
    const result = await db.execute(sql`SELECT * FROM land_acquisition_pipeline ORDER BY priority DESC, created_at DESC`);
    res.json(result.rows);
  } catch (err) { next(err); }
});

router.post("/pipeline", requireAuth, requireLandWrite, async (req, res, next) => {
  try {
    const { name, description, acreage, county, state, estimatedCost, acquisitionType, stage,
      biaCaseNumber, priority, targetDate, notes, stewardshipPurpose, culturalNotes,
      tribalCodeRef, jurisdictionalStatus } = req.body as Record<string, unknown>;
    const result = await db.execute(sql`
      INSERT INTO land_acquisition_pipeline (
        name, description, acreage, county, state, estimated_cost, acquisition_type, stage,
        bia_case_number, priority, target_date, notes, stewardship_purpose, cultural_notes,
        tribal_code_ref, jurisdictional_status
      ) VALUES (
        ${str(name)}, ${str(description)}, ${num(acreage)}, ${str(county)}, ${str(state) ?? "TX"},
        ${num(estimatedCost)}, ${str(acquisitionType) ?? "tribal_governmental_administration"},
        ${str(stage) ?? "identified"}, ${str(biaCaseNumber)},
        ${str(priority) ?? "medium"}, ${str(targetDate)}, ${str(notes)},
        ${str(stewardshipPurpose)}, ${str(culturalNotes)},
        ${str(tribalCodeRef)}, ${str(jurisdictionalStatus)}
      )
      RETURNING *
    `);
    res.status(201).json(result.rows[0]);
  } catch (err) { next(err); }
});

router.put("/pipeline/:id", requireAuth, requireLandWrite, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const { name, description, acreage, county, state, estimatedCost, acquisitionType, stage,
      biaCaseNumber, priority, targetDate, notes, stewardshipPurpose, culturalNotes,
      tribalCodeRef, jurisdictionalStatus } = req.body as Record<string, unknown>;
    await db.execute(sql`
      UPDATE land_acquisition_pipeline SET
        name = ${str(name)}, description = ${str(description)}, acreage = ${num(acreage)},
        county = ${str(county)}, state = ${str(state)}, estimated_cost = ${num(estimatedCost)},
        acquisition_type = ${str(acquisitionType)}, stage = ${str(stage)},
        bia_case_number = ${str(biaCaseNumber)}, priority = ${str(priority)},
        target_date = ${str(targetDate)}, notes = ${str(notes)},
        stewardship_purpose = ${str(stewardshipPurpose)}, cultural_notes = ${str(culturalNotes)},
        tribal_code_ref = ${str(tribalCodeRef)}, jurisdictional_status = ${str(jurisdictionalStatus)},
        updated_at = NOW()
      WHERE id = ${id}
    `);
    const updated = await db.execute(sql`SELECT * FROM land_acquisition_pipeline WHERE id = ${id}`);
    res.json(updated.rows[0]);
  } catch (err) { next(err); }
});

router.delete("/pipeline/:id", requireAuth, requireLandWrite, async (req, res, next) => {
  try {
    await db.execute(sql`DELETE FROM land_acquisition_pipeline WHERE id = ${Number(req.params.id)}`);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

export default router;
