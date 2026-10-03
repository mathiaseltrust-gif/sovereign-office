import { Router, type Request, type Response, type NextFunction } from "express";
import { db } from "@workspace/db";
import { profilesTable, usersTable } from "@workspace/db";
import { sql, eq } from "drizzle-orm";
import { requireAuth } from "../../auth/entra-guard";
import { logger } from "../../lib/logger";
import { nextDocRef } from "../../lib/doc-ref";
import {
  checkEligibility,
  getOrAssignLandCode,
  deriveLocationCode,
  buildLandCode,
  nextSeqForLocation,
} from "../../engines/land-code-service";
import { triggerReviewEngine, auditLog } from "../../engines/nfr-review-engine";
import { ensureEntityAlias } from "../../engines/entity-resolver";
import { associateDocument, recordListenerEvent, registerDocument } from "../../engines/document-association";
import { createHash } from "crypto";
import { readFile } from "fs/promises";

const router = Router();

// Land management access: trustee, officer, sovereign_admin, admin, chief_justice
const LAND_WRITE_ROLES = new Set(["trustee", "officer", "sovereign_admin", "admin", "chief_justice"]);
function requireLandAccess(req: Request, res: Response, next: NextFunction): void {
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

type RepositoryDeedDocument = {
  id: string;
  title: string;
  filename: string;
  parcelIdentifier: string;
  tractNumber?: string;
  deedType: string;
  grantor: string;
  grantee: string;
  recordingJurisdiction: string;
  county: string;
  state: string;
  consideration: number;
  exemptionBasis: string;
  communityLandUse: string;
  tribalCodeRef: string;
  federalLawRef: string;
  defaultStatus: string;
  note: string;
  aliases?: Array<{ type: string; value: string }>;
};

const REPOSITORY_DEED_DOCUMENTS: RepositoryDeedDocument[] = [
  {
    id: "kern-tribal-grant-deed",
    title: "Tribal Grant Deed — Kern County APN 514-364-11-00-1",
    filename: "tribal-grant-deed-kern-ca-APN-514-364-11-00-1.pdf",
    parcelIdentifier: "514-364-11-00-1",
    tractNumber: "MET-TL-BC-001",
    deedType: "grant_deed",
    grantor: "Mathew-Allen: McCaster",
    grantee: "Mathias El Tribe Trust",
    recordingJurisdiction: "Kern County, California",
    county: "Kern",
    state: "CA",
    consideration: 0,
    exemptionBasis: "Voluntary conveyance into Tribal Trust — no monetary consideration. Instrument cites 25 U.S.C. §177 and Cal. Rev. & Tax. Code §11930.",
    communityLandUse: "housing",
    tribalCodeRef: "METC.T4.§3",
    federalLawRef: "25USC177",
    defaultStatus: "pending",
    note: "Existing Sovereign Office repository document. Recorder space in this generated instrument is blank; enter county recording information only when independently confirmed.",
    aliases: [
      { type: "atn", value: "514-364-11-00-1" },
      { type: "parcelId", value: "514-364-11-6" },
      { type: "apn", value: "514-300-03" },
      { type: "tractNumber", value: "MET-TL-BC-001" },
    ],
  },
];

const REPOSITORY_DOCUMENT_ROOT =
  process.env.REPOSITORY_DOCUMENT_ROOT ??
  (process.env.NODE_ENV === "production" ? "/app/repository-documents" : `${process.cwd()}/attached_assets`);

function repositoryDeedById(id: string): RepositoryDeedDocument | undefined {
  return REPOSITORY_DEED_DOCUMENTS.find((doc) => doc.id === id);
}

async function registerRepositoryParcelAliases(
  doc: RepositoryDeedDocument,
  parcelId: number,
  userId: number | null,
): Promise<void> {
  const aliases = [
    { type: "parcelId", value: doc.parcelIdentifier },
    ...(doc.tractNumber ? [{ type: "tractNumber", value: doc.tractNumber }] : []),
    ...(doc.aliases ?? []),
  ];

  for (const alias of aliases) {
    await ensureEntityAlias({
      entityType: "parcel",
      entityId: String(parcelId),
      aliasType: alias.type,
      aliasValue: alias.value,
      verified: true,
      source: "repository_deed",
      createdBy: userId,
    });
  }
}

async function ensureRepositoryCanonicalDocument(
  doc: RepositoryDeedDocument,
  userId: number | null,
) {
  const existing = await db.execute(sql`
    SELECT id, document_ref
    FROM document_registry
    WHERE storage_provider = 'repository_asset'
      AND external_id = ${doc.id}
    ORDER BY id ASC
    LIMIT 1
  `);
  if (existing.rows[0]) {
    return {
      id: Number((existing.rows[0] as Record<string, unknown>).id),
      documentRef: String((existing.rows[0] as Record<string, unknown>).document_ref),
    };
  }

  let sha256: string | null = null;
  let sizeBytes: number | null = null;
  try {
    const bytes = await readFile(`${REPOSITORY_DOCUMENT_ROOT}/${doc.filename}`);
    sha256 = createHash("sha256").update(bytes).digest("hex");
    sizeBytes = bytes.byteLength;
  } catch (err) {
    logger.warn({ err, documentId: doc.id }, "Repository document hash unavailable during registry creation");
  }

  const registered = await registerDocument({
    originalFilename: doc.filename,
    title: doc.title,
    mimeType: "application/pdf",
    sizeBytes,
    sha256,
    storageProvider: "repository_asset",
    storageKey: `repository:${doc.id}`,
    externalId: doc.id,
    sourceChannel: "repository_asset",
    sourceUri: `/api/land/repository-documents/${doc.id}/download`,
    classification: doc.deedType,
    verificationState: "repository_verified",
    sensitivityLevel: "internal",
    metadata: {
      grantor: doc.grantor,
      grantee: doc.grantee,
      recordingJurisdiction: doc.recordingJurisdiction,
      parcelIdentifier: doc.parcelIdentifier,
    },
    createdBy: null,
  });

  await recordListenerEvent({
    documentId: registered.record.id,
    listenerName: "repository-document-adapter",
    eventType: "REPOSITORY_DOCUMENT_REGISTERED",
    actionState: "active",
    payload: {
      repositoryDocumentId: doc.id,
      documentRef: registered.record.documentRef,
      registeredBy: userId,
    },
  });

  return {
    id: registered.record.id,
    documentRef: registered.record.documentRef,
  };
}

async function associateRepositoryDeedDocument(input: {
  doc: RepositoryDeedDocument;
  parcelId: number;
  deedId: number;
  userId: number | null;
}) {
  const canonical = await ensureRepositoryCanonicalDocument(input.doc, input.userId);

  await associateDocument({
    documentId: canonical.id,
    entityType: "parcel",
    entityId: String(input.parcelId),
    relationshipType: "related_property",
    confidence: "exact",
    resolutionMethod: "system_created",
    metadata: {
      repositoryDocumentId: input.doc.id,
      parcelIdentifier: input.doc.parcelIdentifier,
    },
    verifiedBy: input.userId,
  });

  await associateDocument({
    documentId: canonical.id,
    entityType: "land_deed",
    entityId: String(input.deedId),
    relationshipType: "source_record",
    confidence: "exact",
    resolutionMethod: "system_created",
    metadata: {
      repositoryDocumentId: input.doc.id,
      deedType: input.doc.deedType,
    },
    verifiedBy: input.userId,
  });

  await recordListenerEvent({
    documentId: canonical.id,
    listenerName: "land-repository",
    eventType: "DOCUMENT_LINKED_TO_PARCEL",
    actionState: "active",
    payload: {
      parcelId: input.parcelId,
      deedId: input.deedId,
      repositoryDocumentId: input.doc.id,
    },
  });

  return canonical;
}

// ── GET /api/land/stats ────────────────────────────────────────────────────────

router.get("/stats", requireAuth, requireLandAccess, async (_req, res, next) => {
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

router.get("/parcels", requireAuth, requireLandAccess, async (req, res, next) => {
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
    res.set("Cache-Control", "no-store");
    res.json(result.rows);
  } catch (err) { next(err); }
});

router.post("/parcels", requireAuth, requireLandAccess, async (req, res, next) => {
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
      // atlas
      atlasNodeType,
      // coordinate provenance
      coordinateSource,
    } = req.body as Record<string, unknown>;

    const parcelRef = await nextDocRef("land_parcel");

    const result = await db.execute(sql`
      INSERT INTO land_parcels (
        tract_number, parcel_id, legal_description, acreage, classification,
        status, county, state, plss_description, owner_type, acquired_date,
        acquisition_source, bia_tract_number, lat, lng, notes,
        internal_tribal_status, federal_admin_status, jurisdictional_status,
        beneficiary_stewardship_type, protection_restriction_status, tribal_code_ref,
        tribal_court_order_num, protected_status_basis, restriction_basis,
        enforcement_authority, federal_law_cross_ref, stewardship_purpose,
        cultural_significance, historical_occupancy,
        atlas_node_type, coordinate_source, tribal_ref
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
        ${str(culturalSignificance)}, ${str(historicalOccupancy)},
        ${str(atlasNodeType)}, ${str(coordinateSource)}, ${parcelRef}
      )
      RETURNING *
    `);
    logger.info({ id: (result.rows[0] as Record<string, unknown>).id }, "Land parcel created");
    res.status(201).json(result.rows[0]);
  } catch (err) { next(err); }
});

router.get("/parcels/:id", requireAuth, requireLandAccess, async (req, res, next) => {
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

router.put("/parcels/:id", requireAuth, requireLandAccess, async (req, res, next) => {
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
      atlasNodeType,
      coordinateSource,
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
        atlas_node_type = ${str(atlasNodeType)},
        coordinate_source = ${str(coordinateSource)},
        updated_at = NOW()
      WHERE id = ${id}
    `);
    const updated = await db.execute(sql`SELECT * FROM land_parcels WHERE id = ${id}`);
    res.json(updated.rows[0]);
  } catch (err) { next(err); }
});

router.delete("/parcels/:id", requireAuth, requireLandAccess, async (req, res, next) => {
  try {
    await db.execute(sql`DELETE FROM land_parcels WHERE id = ${Number(req.params.id)}`);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// ── LEASES ────────────────────────────────────────────────────────────────────

router.get("/leases", requireAuth, requireLandAccess, async (req, res, next) => {
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

router.post("/leases", requireAuth, requireLandAccess, async (req, res, next) => {
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

router.put("/leases/:id", requireAuth, requireLandAccess, async (req, res, next) => {
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

router.delete("/leases/:id", requireAuth, requireLandAccess, async (req, res, next) => {
  try {
    await db.execute(sql`DELETE FROM land_leases WHERE id = ${Number(req.params.id)}`);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// ── ASSETS ────────────────────────────────────────────────────────────────────

router.get("/assets", requireAuth, requireLandAccess, async (req, res, next) => {
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

router.post("/assets", requireAuth, requireLandAccess, async (req, res, next) => {
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

router.put("/assets/:id", requireAuth, requireLandAccess, async (req, res, next) => {
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

router.delete("/assets/:id", requireAuth, requireLandAccess, async (req, res, next) => {
  try {
    await db.execute(sql`DELETE FROM land_assets WHERE id = ${Number(req.params.id)}`);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// ── ENCUMBRANCES ──────────────────────────────────────────────────────────────

router.get("/encumbrances", requireAuth, requireLandAccess, async (req, res, next) => {
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

router.post("/encumbrances", requireAuth, requireLandAccess, async (req, res, next) => {
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
    const enc = result.rows[0] as Record<string, unknown>;

    await auditLog({
      userId: req.user?.dbId ?? null,
      action: "ENCUMBRANCE_CREATED",
      resourceType: "land_encumbrance",
      resourceId: enc?.id as number | undefined,
      afterValue: enc,
      metadata: { parcelId, encumbranceType, voidAbInitio, source },
    });

    // Fire the NFR Review Engine for any encumbrance on a tribal land parcel
    const signalType = bool(voidAbInitio)
      ? "UNAUTHORIZED_LAND_ENCUMBRANCE" as const
      : (str(encumbranceType) === "foreclosure" || str(encumbranceType) === "foreclosure_notice")
        ? "FORECLOSURE_ACTIVITY" as const
        : (str(encumbranceType) === "tax_lien" || str(encumbranceType) === "utility_lien")
          ? "TAX_OR_LIEN_ASSERTION" as const
          : "TRUST_LAND_INTERFERENCE" as const;

    triggerReviewEngine({
      eventType: "encumbrance_created",
      eventId: enc?.id as number | undefined,
      signalType,
      affectedParcelId: num(parcelId) ?? undefined,
      triggeringEntity: str(source) ?? undefined,
      affectedMatter: `${str(title) ?? "Encumbrance"} on parcel #${parcelId}`,
      evidenceSource: "land_registry",
      context: `Type: ${str(encumbranceType)} | Description: ${str(description)?.slice(0, 200) ?? ""} | Federal law: ${str(federalLawImplicated) ?? "—"}`,
      triggeredByUserId: req.user?.dbId ?? undefined,
    }).catch((err) => logger.error({ err }, "Review engine fire failed (non-fatal)"));

    res.status(201).json(enc);
  } catch (err) { next(err); }
});

router.put("/encumbrances/:id", requireAuth, requireLandAccess, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const { encumbranceType, title, description, source, dateIdentified,
      status, federalLawImplicated, tribalCodeRef, voidAbInitio, resolutionNotes } = req.body as Record<string, unknown>;
    const before = await db.execute(sql`SELECT * FROM land_encumbrances WHERE id = ${id}`);
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
    const row = updated.rows[0] as Record<string, unknown> | undefined;
    auditLog({
      userId: req.user ? Number(req.user.id) : null,
      action: "encumbrance.update",
      resourceType: "land_encumbrance",
      resourceId: id,
      beforeValue: before.rows[0] as Record<string, unknown> | undefined,
      afterValue: row,
      metadata: { encumbranceType: str(encumbranceType), status: str(status) },
    }).catch(() => {});
    res.json(row);
  } catch (err) { next(err); }
});

router.delete("/encumbrances/:id", requireAuth, requireLandAccess, async (req, res, next) => {
  try {
    await db.execute(sql`DELETE FROM land_encumbrances WHERE id = ${Number(req.params.id)}`);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// ── NOTICES ───────────────────────────────────────────────────────────────────

router.get("/notices", requireAuth, requireLandAccess, async (req, res, next) => {
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

router.post("/notices", requireAuth, requireLandAccess, async (req, res, next) => {
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

router.put("/notices/:id", requireAuth, requireLandAccess, async (req, res, next) => {
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

router.delete("/notices/:id", requireAuth, requireLandAccess, async (req, res, next) => {
  try {
    await db.execute(sql`DELETE FROM land_notices WHERE id = ${Number(req.params.id)}`);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// ── STEWARDSHIP PIPELINE ──────────────────────────────────────────────────────

router.get("/pipeline", requireAuth, requireLandAccess, async (_req, res, next) => {
  try {
    const result = await db.execute(sql`SELECT * FROM land_acquisition_pipeline ORDER BY priority DESC, created_at DESC`);
    res.json(result.rows);
  } catch (err) { next(err); }
});

router.post("/pipeline", requireAuth, requireLandAccess, async (req, res, next) => {
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

router.put("/pipeline/:id", requireAuth, requireLandAccess, async (req, res, next) => {
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

router.delete("/pipeline/:id", requireAuth, requireLandAccess, async (req, res, next) => {
  try {
    await db.execute(sql`DELETE FROM land_acquisition_pipeline WHERE id = ${Number(req.params.id)}`);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// ── DEEDS ─────────────────────────────────────────────────────────────────────

router.get("/repository-documents", requireAuth, requireLandAccess, async (_req, res, next) => {
  try {
    const linked = await db.execute(sql`
      SELECT file_key, parcel_id
      FROM land_deeds
      WHERE file_key LIKE 'repository:%'
    `);

    const linkedByDocument = new Map<string, number[]>();
    for (const row of linked.rows as Array<{ file_key?: string | null; parcel_id?: number | null }>) {
      const key = row.file_key?.startsWith("repository:") ? row.file_key.slice("repository:".length) : null;
      if (!key || row.parcel_id == null) continue;
      linkedByDocument.set(key, [...(linkedByDocument.get(key) ?? []), Number(row.parcel_id)]);
    }

    res.json(REPOSITORY_DEED_DOCUMENTS.map((doc) => ({
      id: doc.id,
      title: doc.title,
      filename: doc.filename,
      parcelIdentifier: doc.parcelIdentifier,
      tractNumber: doc.tractNumber ?? null,
      deedType: doc.deedType,
      grantor: doc.grantor,
      grantee: doc.grantee,
      recordingJurisdiction: doc.recordingJurisdiction,
      defaultStatus: doc.defaultStatus,
      note: doc.note,
      linkedParcelIds: linkedByDocument.get(doc.id) ?? [],
      downloadUrl: `/api/land/repository-documents/${doc.id}/download`,
    })));
  } catch (err) { next(err); }
});

router.get("/repository-documents/:documentId/download", requireAuth, requireLandAccess, async (req, res) => {
  const doc = repositoryDeedById(String(req.params.documentId));
  if (!doc) {
    res.status(404).json({ error: "Repository document not found" });
    return;
  }

  res.sendFile(doc.filename, { root: REPOSITORY_DOCUMENT_ROOT }, (err) => {
    if (err && !res.headersSent) {
      const sendFileError = err as Error & { status?: number; statusCode?: number };
      logger.error({ err, documentId: doc.id, root: REPOSITORY_DOCUMENT_ROOT }, "Repository deed download failed");
      const status = sendFileError.statusCode ?? sendFileError.status;
      res.status(status === 404 ? 404 : 500).json({ error: "Repository document file is unavailable" });
    }
  });
});

router.post("/repository-documents/:documentId/link", requireAuth, requireLandAccess, async (req, res, next) => {
  try {
    const doc = repositoryDeedById(String(req.params.documentId));
    if (!doc) {
      res.status(404).json({ error: "Repository document not found" });
      return;
    }

    const parcelId = num((req.body as Record<string, unknown>)?.parcelId);
    if (!parcelId) {
      res.status(400).json({ error: "parcelId is required" });
      return;
    }

    const parcelResult = await db.execute(sql`
      SELECT id, parcel_id, tract_number
      FROM land_parcels
      WHERE id = ${parcelId}
      LIMIT 1
    `);
    const parcel = parcelResult.rows[0] as { id: number; parcel_id?: string | null; tract_number?: string | null } | undefined;
    if (!parcel) {
      res.status(404).json({ error: "Parcel not found" });
      return;
    }

    await registerRepositoryParcelAliases(doc, parcelId, req.user?.dbId ?? null);

    const fileKey = `repository:${doc.id}`;
    const existing = await db.execute(sql`
      SELECT *
      FROM land_deeds
      WHERE parcel_id = ${parcelId}
        AND file_key = ${fileKey}
      LIMIT 1
    `);
    if (existing.rows[0]) {
      const existingDeed = existing.rows[0] as Record<string, unknown>;
      const canonical = await associateRepositoryDeedDocument({
        doc,
        parcelId,
        deedId: Number(existingDeed.id),
        userId: req.user?.dbId ?? null,
      });
      res.json({
        ...existingDeed,
        linkedExisting: true,
        documentRef: canonical.documentRef,
      });
      return;
    }

    const mismatch =
      parcel.parcel_id &&
      doc.parcelIdentifier &&
      parcel.parcel_id !== doc.parcelIdentifier;

    const result = await db.execute(sql`
      INSERT INTO land_deeds (
        parcel_id, deed_type, grantor, grantee,
        recording_jurisdiction, consideration, exemption_basis,
        sovereign_immunity_claim, conservation_easement, community_land_use,
        tribal_code_ref, federal_law_ref, file_key, file_name, file_url, notes, status
      ) VALUES (
        ${parcelId}, ${doc.deedType}, ${doc.grantor}, ${doc.grantee},
        ${doc.recordingJurisdiction}, ${doc.consideration}, ${doc.exemptionBasis},
        false, false, ${doc.communityLandUse},
        ${doc.tribalCodeRef}, ${doc.federalLawRef}, ${fileKey}, ${doc.filename},
        ${`/api/land/repository-documents/${doc.id}/download`},
        ${mismatch ? `${doc.note} Linked to parcel ${parcel.parcel_id}; repository document identifies parcel ${doc.parcelIdentifier}. Review parcel association.` : doc.note},
        ${doc.defaultStatus}
      )
      RETURNING *
    `);

    const deed = result.rows[0] as Record<string, unknown>;
    await auditLog({
      userId: req.user?.dbId ?? null,
      action: "DEED_REPOSITORY_DOCUMENT_LINKED",
      resourceType: "land_deed",
      resourceId: deed?.id as number | undefined,
      afterValue: deed,
      metadata: {
        repositoryDocumentId: doc.id,
        parcelId,
        parcelIdentifier: parcel.parcel_id ?? null,
        expectedParcelIdentifier: doc.parcelIdentifier,
        parcelMismatch: Boolean(mismatch),
      },
    });

    const canonical = await associateRepositoryDeedDocument({
      doc,
      parcelId,
      deedId: Number(deed.id),
      userId: req.user?.dbId ?? null,
    });

    res.status(201).json({
      ...deed,
      parcelMismatch: Boolean(mismatch),
      documentRef: canonical.documentRef,
    });
  } catch (err) { next(err); }
});

router.post("/repository-documents/:documentId/register-and-link", requireAuth, requireLandAccess, async (req, res, next) => {
  try {
    const doc = repositoryDeedById(String(req.params.documentId));
    if (!doc) {
      res.status(404).json({ error: "Repository document not found" });
      return;
    }

    let parcelResult = await db.execute(sql`
      SELECT *
      FROM land_parcels
      WHERE parcel_id = ${doc.parcelIdentifier}
         OR tract_number = ${doc.tractNumber ?? ""}
      ORDER BY id ASC
      LIMIT 1
    `);

    let parcelCreated = false;
    let parcel = parcelResult.rows[0] as Record<string, unknown> | undefined;

    if (!parcel) {
      const parcelRef = await nextDocRef("land_parcel");
      const created = await db.execute(sql`
        INSERT INTO land_parcels (
          tract_number, parcel_id, legal_description,
          classification, status, county, state, owner_type,
          acquisition_source, notes, tribal_ref
        ) VALUES (
          ${doc.tractNumber ?? null},
          ${doc.parcelIdentifier},
          ${`See linked deed instrument: ${doc.title}`},
          'protected_tribal_land',
          'active',
          ${doc.county},
          ${doc.state},
          'tribal',
          ${`Sovereign Office repository document: ${doc.id}`},
          ${`Parcel record created from an existing Office deed repository document. Review and complete acreage, legal description, coordinates, status classifications, and authority fields before relying on the parcel profile.`},
          ${parcelRef}
        )
        RETURNING *
      `);
      parcel = created.rows[0] as Record<string, unknown>;
      parcelCreated = true;

      await auditLog({
        userId: req.user?.dbId ?? null,
        action: "LAND_PARCEL_CREATED_FROM_REPOSITORY_DEED",
        resourceType: "land_parcel",
        resourceId: parcel?.id as number | undefined,
        afterValue: parcel,
        metadata: {
          repositoryDocumentId: doc.id,
          parcelIdentifier: doc.parcelIdentifier,
          tractNumber: doc.tractNumber ?? null,
        },
      });
    }

    const parcelId = Number(parcel.id);
    await registerRepositoryParcelAliases(doc, parcelId, req.user?.dbId ?? null);
    const fileKey = `repository:${doc.id}`;

    const existing = await db.execute(sql`
      SELECT *
      FROM land_deeds
      WHERE parcel_id = ${parcelId}
        AND file_key = ${fileKey}
      LIMIT 1
    `);

    if (existing.rows[0]) {
      const existingDeed = existing.rows[0] as Record<string, unknown>;
      const canonical = await associateRepositoryDeedDocument({
        doc,
        parcelId,
        deedId: Number(existingDeed.id),
        userId: req.user?.dbId ?? null,
      });
      res.json({
        parcel,
        deed: existingDeed,
        parcelCreated,
        linkedExisting: true,
        documentRef: canonical.documentRef,
      });
      return;
    }

    const deedResult = await db.execute(sql`
      INSERT INTO land_deeds (
        parcel_id, deed_type, grantor, grantee,
        recording_jurisdiction, consideration, exemption_basis,
        sovereign_immunity_claim, conservation_easement, community_land_use,
        tribal_code_ref, federal_law_ref, file_key, file_name, file_url, notes, status
      ) VALUES (
        ${parcelId}, ${doc.deedType}, ${doc.grantor}, ${doc.grantee},
        ${doc.recordingJurisdiction}, ${doc.consideration}, ${doc.exemptionBasis},
        false, false, ${doc.communityLandUse},
        ${doc.tribalCodeRef}, ${doc.federalLawRef}, ${fileKey}, ${doc.filename},
        ${`/api/land/repository-documents/${doc.id}/download`},
        ${doc.note},
        ${doc.defaultStatus}
      )
      RETURNING *
    `);

    const deed = deedResult.rows[0] as Record<string, unknown>;
    await auditLog({
      userId: req.user?.dbId ?? null,
      action: "DEED_REPOSITORY_DOCUMENT_REGISTERED_AND_LINKED",
      resourceType: "land_deed",
      resourceId: deed?.id as number | undefined,
      afterValue: deed,
      metadata: {
        repositoryDocumentId: doc.id,
        parcelId,
        parcelCreated,
      },
    });

    const canonical = await associateRepositoryDeedDocument({
      doc,
      parcelId,
      deedId: Number(deed.id),
      userId: req.user?.dbId ?? null,
    });

    res.status(201).json({
      parcel,
      deed,
      parcelCreated,
      documentRef: canonical.documentRef,
    });
  } catch (err) { next(err); }
});

router.get("/deeds", requireAuth, requireLandAccess, async (req, res, next) => {
  try {
    const { parcelId } = req.query as Record<string, string>;
    let q = sql`
      SELECT d.*, p.tract_number
      FROM land_deeds d
      LEFT JOIN land_parcels p ON d.parcel_id = p.id
      WHERE 1=1
    `;
    if (parcelId) q = sql`${q} AND d.parcel_id = ${Number(parcelId)}`;
    q = sql`${q} ORDER BY d.recording_date DESC NULLS LAST, d.created_at DESC`;
    const result = await db.execute(q);
    res.json(result.rows);
  } catch (err) { next(err); }
});

router.post("/deeds", requireAuth, requireLandAccess, async (req, res, next) => {
  try {
    const {
      parcelId, deedType, grantor, grantee, recordingDate, recordingNumber,
      recordingJurisdiction, instrumentDate, consideration, exemptionBasis,
      sovereignImmunityClaim, conservationEasement, communityLandUse,
      tribalCodeRef, federalLawRef, fileKey, fileName, fileUrl, notes, status,
    } = req.body as Record<string, unknown>;
    const result = await db.execute(sql`
      INSERT INTO land_deeds (
        parcel_id, deed_type, grantor, grantee, recording_date, recording_number,
        recording_jurisdiction, instrument_date, consideration, exemption_basis,
        sovereign_immunity_claim, conservation_easement, community_land_use,
        tribal_code_ref, federal_law_ref, file_key, file_name, file_url, notes, status
      ) VALUES (
        ${num(parcelId)}, ${str(deedType) ?? "warranty"}, ${str(grantor)}, ${str(grantee)},
        ${str(recordingDate) ? sql`${str(recordingDate)}::date` : sql`NULL`},
        ${str(recordingNumber)}, ${str(recordingJurisdiction)},
        ${str(instrumentDate) ? sql`${str(instrumentDate)}::date` : sql`NULL`},
        ${num(consideration)}, ${str(exemptionBasis)},
        ${bool(sovereignImmunityClaim)}, ${bool(conservationEasement)},
        ${str(communityLandUse)}, ${str(tribalCodeRef)}, ${str(federalLawRef)},
        ${str(fileKey)}, ${str(fileName)}, ${str(fileUrl)}, ${str(notes)},
        ${str(status) ?? "active"}
      )
      RETURNING *
    `);
    res.status(201).json(result.rows[0]);
  } catch (err) { next(err); }
});

router.put("/deeds/:id", requireAuth, requireLandAccess, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const {
      deedType, grantor, grantee, recordingDate, recordingNumber,
      recordingJurisdiction, instrumentDate, consideration, exemptionBasis,
      sovereignImmunityClaim, conservationEasement, communityLandUse,
      tribalCodeRef, federalLawRef, fileKey, fileName, fileUrl, notes, status,
    } = req.body as Record<string, unknown>;
    await db.execute(sql`
      UPDATE land_deeds SET
        deed_type = ${str(deedType)},
        grantor = ${str(grantor)},
        grantee = ${str(grantee)},
        recording_date = ${str(recordingDate) ? sql`${str(recordingDate)}::date` : sql`NULL`},
        recording_number = ${str(recordingNumber)},
        recording_jurisdiction = ${str(recordingJurisdiction)},
        instrument_date = ${str(instrumentDate) ? sql`${str(instrumentDate)}::date` : sql`NULL`},
        consideration = ${num(consideration)},
        exemption_basis = ${str(exemptionBasis)},
        sovereign_immunity_claim = ${bool(sovereignImmunityClaim)},
        conservation_easement = ${bool(conservationEasement)},
        community_land_use = ${str(communityLandUse)},
        tribal_code_ref = ${str(tribalCodeRef)},
        federal_law_ref = ${str(federalLawRef)},
        file_key = ${str(fileKey)},
        file_name = ${str(fileName)},
        file_url = ${str(fileUrl)},
        notes = ${str(notes)},
        status = ${str(status)},
        updated_at = NOW()
      WHERE id = ${id}
    `);
    const updated = await db.execute(sql`SELECT * FROM land_deeds WHERE id = ${id}`);
    res.json(updated.rows[0]);
  } catch (err) { next(err); }
});

router.delete("/deeds/:id", requireAuth, requireLandAccess, async (req, res, next) => {
  try {
    await db.execute(sql`DELETE FROM land_deeds WHERE id = ${Number(req.params.id)}`);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// ── TAX COMPLIANCE ────────────────────────────────────────────────────────────

router.get("/tax-compliance", requireAuth, requireLandAccess, async (req, res, next) => {
  try {
    const { parcelId, status } = req.query as Record<string, string>;
    let q = sql`
      SELECT t.*, p.tract_number, p.county
      FROM land_tax_compliance t
      LEFT JOIN land_parcels p ON t.parcel_id = p.id
      WHERE 1=1
    `;
    if (parcelId) q = sql`${q} AND t.parcel_id = ${Number(parcelId)}`;
    if (status) q = sql`${q} AND t.status = ${status}`;
    q = sql`${q} ORDER BY t.deadline_date ASC NULLS LAST, t.created_at DESC`;
    const result = await db.execute(q);
    res.json(result.rows);
  } catch (err) { next(err); }
});

router.post("/tax-compliance", requireAuth, requireLandAccess, async (req, res, next) => {
  try {
    const {
      parcelId, complianceType, jurisdiction, taxYear, deadlineDate,
      amountAssessed, amountPaid, paymentDate, status,
      sovereignImmunityClaimed, immunityClaimDate, immunityBasis,
      exemptionType, exemptionFiledDate, exemptionStatus,
      appealFiled, appealDate, appealBasis, tribalCodeRef, federalLawRef, notes,
    } = req.body as Record<string, unknown>;
    const result = await db.execute(sql`
      INSERT INTO land_tax_compliance (
        parcel_id, compliance_type, jurisdiction, tax_year, deadline_date,
        amount_assessed, amount_paid, payment_date, status,
        sovereign_immunity_claimed, immunity_claim_date, immunity_basis,
        exemption_type, exemption_filed_date, exemption_status,
        appeal_filed, appeal_date, appeal_basis, tribal_code_ref, federal_law_ref, notes
      ) VALUES (
        ${num(parcelId)}, ${str(complianceType) ?? "county_tax"}, ${str(jurisdiction)},
        ${num(taxYear)},
        ${str(deadlineDate) ? sql`${str(deadlineDate)}::date` : sql`NULL`},
        ${num(amountAssessed)}, ${num(amountPaid)},
        ${str(paymentDate) ? sql`${str(paymentDate)}::date` : sql`NULL`},
        ${str(status) ?? "pending"},
        ${bool(sovereignImmunityClaimed)},
        ${str(immunityClaimDate) ? sql`${str(immunityClaimDate)}::date` : sql`NULL`},
        ${str(immunityBasis)}, ${str(exemptionType)},
        ${str(exemptionFiledDate) ? sql`${str(exemptionFiledDate)}::date` : sql`NULL`},
        ${str(exemptionStatus)}, ${bool(appealFiled)},
        ${str(appealDate) ? sql`${str(appealDate)}::date` : sql`NULL`},
        ${str(appealBasis)}, ${str(tribalCodeRef)}, ${str(federalLawRef)}, ${str(notes)}
      )
      RETURNING *
    `);
    res.status(201).json(result.rows[0]);
  } catch (err) { next(err); }
});

router.put("/tax-compliance/:id", requireAuth, requireLandAccess, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const {
      complianceType, jurisdiction, taxYear, deadlineDate,
      amountAssessed, amountPaid, paymentDate, status,
      sovereignImmunityClaimed, immunityClaimDate, immunityBasis,
      exemptionType, exemptionFiledDate, exemptionStatus,
      appealFiled, appealDate, appealBasis, tribalCodeRef, federalLawRef, notes,
    } = req.body as Record<string, unknown>;
    await db.execute(sql`
      UPDATE land_tax_compliance SET
        compliance_type = ${str(complianceType)},
        jurisdiction = ${str(jurisdiction)},
        tax_year = ${num(taxYear)},
        deadline_date = ${str(deadlineDate) ? sql`${str(deadlineDate)}::date` : sql`NULL`},
        amount_assessed = ${num(amountAssessed)},
        amount_paid = ${num(amountPaid)},
        payment_date = ${str(paymentDate) ? sql`${str(paymentDate)}::date` : sql`NULL`},
        status = ${str(status)},
        sovereign_immunity_claimed = ${bool(sovereignImmunityClaimed)},
        immunity_claim_date = ${str(immunityClaimDate) ? sql`${str(immunityClaimDate)}::date` : sql`NULL`},
        immunity_basis = ${str(immunityBasis)},
        exemption_type = ${str(exemptionType)},
        exemption_filed_date = ${str(exemptionFiledDate) ? sql`${str(exemptionFiledDate)}::date` : sql`NULL`},
        exemption_status = ${str(exemptionStatus)},
        appeal_filed = ${bool(appealFiled)},
        appeal_date = ${str(appealDate) ? sql`${str(appealDate)}::date` : sql`NULL`},
        appeal_basis = ${str(appealBasis)},
        tribal_code_ref = ${str(tribalCodeRef)},
        federal_law_ref = ${str(federalLawRef)},
        notes = ${str(notes)},
        updated_at = NOW()
      WHERE id = ${id}
    `);
    const updated = await db.execute(sql`SELECT * FROM land_tax_compliance WHERE id = ${id}`);
    res.json(updated.rows[0]);
  } catch (err) { next(err); }
});

router.delete("/tax-compliance/:id", requireAuth, requireLandAccess, async (req, res, next) => {
  try {
    await db.execute(sql`DELETE FROM land_tax_compliance WHERE id = ${Number(req.params.id)}`);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// ── MEMBER ASSIGNMENTS ────────────────────────────────────────────────────────

router.get("/assignments", requireAuth, requireLandAccess, async (req, res, next) => {
  try {
    const { parcelId, status } = req.query as Record<string, string>;
    let q = sql`
      SELECT a.*, p.tract_number
      FROM land_member_assignments a
      LEFT JOIN land_parcels p ON a.parcel_id = p.id
      WHERE 1=1
    `;
    if (parcelId) q = sql`${q} AND a.parcel_id = ${Number(parcelId)}`;
    if (status) q = sql`${q} AND a.status = ${status}`;
    q = sql`${q} ORDER BY a.assigned_date DESC NULLS LAST, a.created_at DESC`;
    const result = await db.execute(q);
    res.json(result.rows);
  } catch (err) { next(err); }
});

router.post("/assignments", requireAuth, requireLandAccess, async (req, res, next) => {
  try {
    const {
      parcelId, memberId, memberName, memberEmail, assignmentRole, familyName,
      stewardFamily, assignedDate, endDate, status, responsibilities,
      culturalConnection, tribalCodeRef, authorizedBy, notes,
    } = req.body as Record<string, unknown>;
    const result = await db.execute(sql`
      INSERT INTO land_member_assignments (
        parcel_id, member_id, member_name, member_email, assignment_role, family_name,
        steward_family, assigned_date, end_date, status, responsibilities,
        cultural_connection, tribal_code_ref, authorized_by, notes
      ) VALUES (
        ${num(parcelId)}, ${str(memberId)}, ${str(memberName)}, ${str(memberEmail)},
        ${str(assignmentRole) ?? "steward"}, ${str(familyName)}, ${str(stewardFamily)},
        ${str(assignedDate) ? sql`${str(assignedDate)}::date` : sql`CURRENT_DATE`},
        ${str(endDate) ? sql`${str(endDate)}::date` : sql`NULL`},
        ${str(status) ?? "active"}, ${str(responsibilities)},
        ${str(culturalConnection)}, ${str(tribalCodeRef)}, ${str(authorizedBy)}, ${str(notes)}
      )
      RETURNING *
    `);
    res.status(201).json(result.rows[0]);
  } catch (err) { next(err); }
});

router.put("/assignments/:id", requireAuth, requireLandAccess, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const {
      memberId, memberName, memberEmail, assignmentRole, familyName,
      stewardFamily, assignedDate, endDate, status, responsibilities,
      culturalConnection, tribalCodeRef, authorizedBy, notes,
    } = req.body as Record<string, unknown>;
    await db.execute(sql`
      UPDATE land_member_assignments SET
        member_id = ${str(memberId)},
        member_name = ${str(memberName)},
        member_email = ${str(memberEmail)},
        assignment_role = ${str(assignmentRole)},
        family_name = ${str(familyName)},
        steward_family = ${str(stewardFamily)},
        assigned_date = ${str(assignedDate) ? sql`${str(assignedDate)}::date` : sql`CURRENT_DATE`},
        end_date = ${str(endDate) ? sql`${str(endDate)}::date` : sql`NULL`},
        status = ${str(status)},
        responsibilities = ${str(responsibilities)},
        cultural_connection = ${str(culturalConnection)},
        tribal_code_ref = ${str(tribalCodeRef)},
        authorized_by = ${str(authorizedBy)},
        notes = ${str(notes)},
        updated_at = NOW()
      WHERE id = ${id}
    `);
    const updated = await db.execute(sql`SELECT * FROM land_member_assignments WHERE id = ${id}`);
    res.json(updated.rows[0]);
  } catch (err) { next(err); }
});

router.delete("/assignments/:id", requireAuth, requireLandAccess, async (req, res, next) => {
  try {
    await db.execute(sql`DELETE FROM land_member_assignments WHERE id = ${Number(req.params.id)}`);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// ── LAND CODE & ELIGIBILITY ───────────────────────────────────────────────────

/**
 * GET /api/land/eligibility
 * Check eligibility for the authenticated user themselves.
 */
router.get("/eligibility", requireAuth, async (req, res, next) => {
  try {
    if (!req.user?.dbId) { res.status(401).json({ error: "Authentication required." }); return; }
    const result = await checkEligibility(req.user.dbId);
    res.json(result);
  } catch (err) { next(err); }
});

/**
 * GET /api/land/eligibility/:userId
 * Check eligibility for any member.
 * Members may only check themselves; trustees/officers may check anyone.
 */
router.get("/eligibility/:userId", requireAuth, requireLandAccess, async (req, res, next) => {
  try {
    if (!req.user?.dbId) { res.status(401).json({ error: "Authentication required." }); return; }
    const targetId = Number(req.params.userId);
    const roles: string[] = req.user.roles ?? [];
    const canCheckOthers = ["trustee", "officer", "sovereign_admin", "admin", "chief_justice"].some(r => roles.includes(r));
    if (!canCheckOthers && req.user.dbId !== targetId) {
      res.status(403).json({ error: "You may only check your own eligibility." });
      return;
    }
    const result = await checkEligibility(targetId);
    res.json(result);
  } catch (err) { next(err); }
});

/**
 * GET /api/land/land-code/preview
 * Preview what land code would be assigned for a given location — no save.
 * Query params: county, city, address
 */
router.get("/land-code/preview", requireAuth, requireLandAccess, async (req, res, next) => {
  try {
    const county  = String(req.query.county  ?? "").trim() || null;
    const city    = String(req.query.city    ?? "").trim() || null;
    const address = String(req.query.address ?? "").trim() || null;
    const locCode = deriveLocationCode(county, city, address);
    const seq     = await nextSeqForLocation(locCode);
    const code    = buildLandCode(locCode, seq);
    res.json({ code, locationCode: locCode, seq, preview: true });
  } catch (err) { next(err); }
});

/**
 * POST /api/land/land-code/assign
 * Assign (or return existing) tribal land code for a user.
 * Body: { userId, county?, city?, address?, dryRun? }
 * Trustees/officers may assign for any user; members may assign for themselves.
 */
router.post("/land-code/assign", requireAuth, requireLandAccess, async (req, res, next) => {
  try {
    if (!req.user?.dbId) { res.status(401).json({ error: "Authentication required." }); return; }
    const { userId, county, city, address, dryRun } = req.body as {
      userId?: number; county?: string; city?: string; address?: string; dryRun?: boolean;
    };

    const targetId = userId ?? req.user.dbId;
    const roles: string[] = req.user.roles ?? [];
    const canAssignOthers = ["trustee", "officer", "sovereign_admin", "admin", "chief_justice"].some(r => roles.includes(r));
    if (!canAssignOthers && req.user.dbId !== targetId) {
      res.status(403).json({ error: "You may only assign a land code for yourself." });
      return;
    }

    const result = await getOrAssignLandCode(targetId, { county, city, address, dryRun: dryRun ?? false });
    res.json(result);
  } catch (err) { next(err); }
});

/**
 * GET /api/land/land-code/:userId
 * Look up the current tribal land code for a user.
 */
router.get("/land-code/:userId", requireAuth, requireLandAccess, async (req, res, next) => {
  try {
    const targetId = Number(req.params.userId);
    const roles: string[] = req.user?.roles ?? [];
    const canViewOthers = ["trustee", "officer", "sovereign_admin", "admin", "chief_justice"].some(r => roles.includes(r));
    if (!canViewOthers && req.user?.dbId !== targetId) {
      res.status(403).json({ error: "Access denied." });
      return;
    }
    const [prof] = await db
      .select({ tribalLandCode: profilesTable.tribalLandCode, apn: profilesTable.apn, legalName: profilesTable.legalName })
      .from(profilesTable)
      .where(eq(profilesTable.userId, targetId))
      .limit(1);
    const [user] = await db
      .select({ name: usersTable.name })
      .from(usersTable)
      .where(eq(usersTable.id, targetId))
      .limit(1);
    res.json({
      userId: targetId,
      name: prof?.legalName ?? user?.name ?? null,
      tribalLandCode: prof?.tribalLandCode ?? null,
      apn: prof?.apn ?? null,
      hasCode: !!prof?.tribalLandCode,
    });
  } catch (err) { next(err); }
});

export default router;

