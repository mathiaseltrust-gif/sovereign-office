import { Router } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { requireAuth, requireAnyRole } from "../../auth/entra-guard";
import { logger } from "../../lib/logger";

const router = Router();

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

// ── GET /api/land/stats ────────────────────────────────────────────────────────

router.get("/stats", requireAuth, async (_req, res, next) => {
  try {
    const [parcels, leases, pipeline] = await Promise.all([
      db.execute(sql`
        SELECT
          COUNT(*)::int                                                   AS total_parcels,
          COALESCE(SUM(acreage),0)                                        AS total_acreage,
          COALESCE(SUM(CASE WHEN classification='trust'       THEN acreage ELSE 0 END),0) AS trust_acreage,
          COALESCE(SUM(CASE WHEN classification='fee'         THEN acreage ELSE 0 END),0) AS fee_acreage,
          COALESCE(SUM(CASE WHEN classification='allotment'   THEN acreage ELSE 0 END),0) AS allotment_acreage,
          COALESCE(SUM(CASE WHEN classification='restricted'  THEN acreage ELSE 0 END),0) AS restricted_acreage,
          COUNT(CASE WHEN status='active' THEN 1 END)::int                AS active_parcels,
          COUNT(CASE WHEN status='disputed' THEN 1 END)::int              AS disputed_parcels
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
               COUNT(CASE WHEN stage NOT IN ('transferred','cancelled') THEN 1 END)::int AS active_pipeline,
               COALESCE(SUM(CASE WHEN stage NOT IN ('transferred','cancelled') THEN acreage ELSE 0 END),0) AS pipeline_acreage
        FROM land_acquisition_pipeline
      `),
    ]);

    const p = parcels.rows[0] as Record<string, unknown>;
    const l = leases.rows[0] as Record<string, unknown>;
    const q = pipeline.rows[0] as Record<string, unknown>;

    res.json({
      totalParcels: p.total_parcels,
      totalAcreage: Number(p.total_acreage),
      trustAcreage: Number(p.trust_acreage),
      feeAcreage: Number(p.fee_acreage),
      allotmentAcreage: Number(p.allotment_acreage),
      restrictedAcreage: Number(p.restricted_acreage),
      activeParcels: p.active_parcels,
      disputedParcels: p.disputed_parcels,
      totalLeases: l.total_leases,
      activeLeases: l.active_leases,
      annualRevenue: Number(l.annual_revenue),
      expiringSoon: l.expiring_soon,
      pipelineCount: q.pipeline_count,
      activePipeline: q.active_pipeline,
      pipelineAcreage: Number(q.pipeline_acreage),
    });
  } catch (err) { next(err); }
});

// ── GET /api/land/parcels ──────────────────────────────────────────────────────

router.get("/parcels", requireAuth, async (req, res, next) => {
  try {
    const { classification, status, county } = req.query as Record<string, string>;
    let q = sql`SELECT * FROM land_parcels WHERE 1=1`;
    if (classification) q = sql`${q} AND classification = ${classification}`;
    if (status) q = sql`${q} AND status = ${status}`;
    if (county) q = sql`${q} AND LOWER(county) LIKE ${"%" + county.toLowerCase() + "%"}`;
    q = sql`${q} ORDER BY created_at DESC`;
    const result = await db.execute(q);
    res.json(result.rows);
  } catch (err) { next(err); }
});

// ── POST /api/land/parcels ─────────────────────────────────────────────────────

router.post("/parcels", requireAuth, requireAnyRole(["trustee", "officer"]), async (req, res, next) => {
  try {
    const {
      tractNumber, parcelId, legalDescription, acreage, classification,
      status, county, state, plssDescription, ownerType, acquiredDate,
      acquisitionSource, biaTractNumber, lat, lng, notes,
    } = req.body as Record<string, unknown>;

    const result = await db.execute(sql`
      INSERT INTO land_parcels (
        tract_number, parcel_id, legal_description, acreage, classification,
        status, county, state, plss_description, owner_type, acquired_date,
        acquisition_source, bia_tract_number, lat, lng, notes
      ) VALUES (
        ${str(tractNumber)}, ${str(parcelId)}, ${str(legalDescription)},
        ${num(acreage)}, ${str(classification) ?? "trust"},
        ${str(status) ?? "active"}, ${str(county)}, ${str(state) ?? "TX"},
        ${str(plssDescription)}, ${str(ownerType) ?? "tribal"},
        ${str(acquiredDate)}, ${str(acquisitionSource)},
        ${str(biaTractNumber)}, ${str(lat)}, ${str(lng)}, ${str(notes)}
      )
      RETURNING *
    `);
    logger.info({ id: (result.rows[0] as Record<string, unknown>).id }, "Land parcel created");
    res.status(201).json(result.rows[0]);
  } catch (err) { next(err); }
});

// ── GET /api/land/parcels/:id ──────────────────────────────────────────────────

router.get("/parcels/:id", requireAuth, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const [parcel, leases, assets] = await Promise.all([
      db.execute(sql`SELECT * FROM land_parcels WHERE id = ${id}`),
      db.execute(sql`SELECT * FROM land_leases WHERE parcel_id = ${id} ORDER BY end_date ASC`),
      db.execute(sql`SELECT * FROM land_assets WHERE parcel_id = ${id} ORDER BY asset_type, name`),
    ]);
    if (!parcel.rows[0]) { res.status(404).json({ error: "Parcel not found" }); return; }
    res.json({ ...(parcel.rows[0] as Record<string, unknown>), leases: leases.rows, assets: assets.rows });
  } catch (err) { next(err); }
});

// ── PUT /api/land/parcels/:id ──────────────────────────────────────────────────

router.put("/parcels/:id", requireAuth, requireAnyRole(["trustee", "officer"]), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const {
      tractNumber, parcelId, legalDescription, acreage, classification,
      status, county, state, plssDescription, ownerType, acquiredDate,
      acquisitionSource, biaTractNumber, lat, lng, notes,
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
        updated_at = NOW()
      WHERE id = ${id}
      RETURNING *
    `);
    const updated = await db.execute(sql`SELECT * FROM land_parcels WHERE id = ${id}`);
    res.json(updated.rows[0]);
  } catch (err) { next(err); }
});

// ── DELETE /api/land/parcels/:id ───────────────────────────────────────────────

router.delete("/parcels/:id", requireAuth, requireAnyRole(["trustee", "officer"]), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    await db.execute(sql`DELETE FROM land_parcels WHERE id = ${id}`);
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

router.post("/leases", requireAuth, requireAnyRole(["trustee", "officer"]), async (req, res, next) => {
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

router.put("/leases/:id", requireAuth, requireAnyRole(["trustee", "officer"]), async (req, res, next) => {
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

router.delete("/leases/:id", requireAuth, requireAnyRole(["trustee", "officer"]), async (req, res, next) => {
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

router.post("/assets", requireAuth, requireAnyRole(["trustee", "officer"]), async (req, res, next) => {
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

router.put("/assets/:id", requireAuth, requireAnyRole(["trustee", "officer"]), async (req, res, next) => {
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

router.delete("/assets/:id", requireAuth, requireAnyRole(["trustee", "officer"]), async (req, res, next) => {
  try {
    await db.execute(sql`DELETE FROM land_assets WHERE id = ${Number(req.params.id)}`);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// ── ACQUISITION PIPELINE ──────────────────────────────────────────────────────

router.get("/pipeline", requireAuth, async (_req, res, next) => {
  try {
    const result = await db.execute(sql`SELECT * FROM land_acquisition_pipeline ORDER BY priority DESC, created_at DESC`);
    res.json(result.rows);
  } catch (err) { next(err); }
});

router.post("/pipeline", requireAuth, requireAnyRole(["trustee", "officer"]), async (req, res, next) => {
  try {
    const { name, description, acreage, county, state, estimatedCost, acquisitionType, stage, biaCaseNumber, priority, targetDate, notes } = req.body as Record<string, unknown>;
    const result = await db.execute(sql`
      INSERT INTO land_acquisition_pipeline (
        name, description, acreage, county, state, estimated_cost, acquisition_type, stage, bia_case_number, priority, target_date, notes
      ) VALUES (
        ${str(name)}, ${str(description)}, ${num(acreage)}, ${str(county)}, ${str(state) ?? "TX"},
        ${num(estimatedCost)}, ${str(acquisitionType) ?? "fee_to_trust"},
        ${str(stage) ?? "identified"}, ${str(biaCaseNumber)},
        ${str(priority) ?? "medium"}, ${str(targetDate)}, ${str(notes)}
      )
      RETURNING *
    `);
    res.status(201).json(result.rows[0]);
  } catch (err) { next(err); }
});

router.put("/pipeline/:id", requireAuth, requireAnyRole(["trustee", "officer"]), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const { name, description, acreage, county, state, estimatedCost, acquisitionType, stage, biaCaseNumber, priority, targetDate, notes } = req.body as Record<string, unknown>;
    await db.execute(sql`
      UPDATE land_acquisition_pipeline SET
        name = ${str(name)}, description = ${str(description)}, acreage = ${num(acreage)},
        county = ${str(county)}, state = ${str(state)}, estimated_cost = ${num(estimatedCost)},
        acquisition_type = ${str(acquisitionType)}, stage = ${str(stage)},
        bia_case_number = ${str(biaCaseNumber)}, priority = ${str(priority)},
        target_date = ${str(targetDate)}, notes = ${str(notes)}, updated_at = NOW()
      WHERE id = ${id}
    `);
    const updated = await db.execute(sql`SELECT * FROM land_acquisition_pipeline WHERE id = ${id}`);
    res.json(updated.rows[0]);
  } catch (err) { next(err); }
});

router.delete("/pipeline/:id", requireAuth, requireAnyRole(["trustee", "officer"]), async (req, res, next) => {
  try {
    await db.execute(sql`DELETE FROM land_acquisition_pipeline WHERE id = ${Number(req.params.id)}`);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

export default router;
