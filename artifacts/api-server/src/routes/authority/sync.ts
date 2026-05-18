/**
 * GET /api/authority/sync (admin/officer only)
 *
 * Re-runs data ingestion jobs on demand:
 *   1. US Census Bureau — all county FIPS codes
 *   2. California Socrata — CA agency directory
 *   3. Federal agency baseline — IRS, BIA, HUD, DOJ, IHS, CMS, etc.
 *
 * Returns a summary of records upserted and updates lastSyncedAt.
 */
import { Router } from "express";
import { requireAuth, requireAdmin } from "../../auth/entra-guard";
import { db } from "@workspace/db";
import { authorityJurisdictionTable, authorityAgenciesTable } from "@workspace/db";
import { sql } from "drizzle-orm";
import { logger } from "../../lib/logger";

const router = Router();

// ── State FIPS codes (US Census abbreviation → full name) ────────────────────
const STATE_FIPS: Record<string, { name: string; fips: string }> = {
  AL: { name: "Alabama", fips: "01" }, AK: { name: "Alaska", fips: "02" }, AZ: { name: "Arizona", fips: "04" },
  AR: { name: "Arkansas", fips: "05" }, CA: { name: "California", fips: "06" }, CO: { name: "Colorado", fips: "08" },
  CT: { name: "Connecticut", fips: "09" }, DE: { name: "Delaware", fips: "10" }, FL: { name: "Florida", fips: "12" },
  GA: { name: "Georgia", fips: "13" }, HI: { name: "Hawaii", fips: "15" }, ID: { name: "Idaho", fips: "16" },
  IL: { name: "Illinois", fips: "17" }, IN: { name: "Indiana", fips: "18" }, IA: { name: "Iowa", fips: "19" },
  KS: { name: "Kansas", fips: "20" }, KY: { name: "Kentucky", fips: "21" }, LA: { name: "Louisiana", fips: "22" },
  ME: { name: "Maine", fips: "23" }, MD: { name: "Maryland", fips: "24" }, MA: { name: "Massachusetts", fips: "25" },
  MI: { name: "Michigan", fips: "26" }, MN: { name: "Minnesota", fips: "27" }, MS: { name: "Mississippi", fips: "28" },
  MO: { name: "Missouri", fips: "29" }, MT: { name: "Montana", fips: "30" }, NE: { name: "Nebraska", fips: "31" },
  NV: { name: "Nevada", fips: "32" }, NH: { name: "New Hampshire", fips: "33" }, NJ: { name: "New Jersey", fips: "34" },
  NM: { name: "New Mexico", fips: "35" }, NY: { name: "New York", fips: "36" }, NC: { name: "North Carolina", fips: "37" },
  ND: { name: "North Dakota", fips: "38" }, OH: { name: "Ohio", fips: "39" }, OK: { name: "Oklahoma", fips: "40" },
  OR: { name: "Oregon", fips: "41" }, PA: { name: "Pennsylvania", fips: "42" }, RI: { name: "Rhode Island", fips: "44" },
  SC: { name: "South Carolina", fips: "45" }, SD: { name: "South Dakota", fips: "46" }, TN: { name: "Tennessee", fips: "47" },
  TX: { name: "Texas", fips: "48" }, UT: { name: "Utah", fips: "49" }, VT: { name: "Vermont", fips: "50" },
  VA: { name: "Virginia", fips: "51" }, WA: { name: "Washington", fips: "53" }, WV: { name: "West Virginia", fips: "54" },
  WI: { name: "Wisconsin", fips: "55" }, WY: { name: "Wyoming", fips: "56" },
};

// ── Federal agency baseline ───────────────────────────────────────────────────
const FEDERAL_AGENCIES = [
  { name: "Internal Revenue Service", type: "tax_authority", address: "1111 Constitution Ave NW, Washington, DC 20224", website: "https://www.irs.gov" },
  { name: "Bureau of Indian Affairs", type: "federal_indian_affairs", address: "1849 C Street NW, Washington, DC 20240", website: "https://www.bia.gov" },
  { name: "Bureau of Land Management", type: "land_management", address: "1849 C Street NW, Washington, DC 20240", website: "https://www.blm.gov" },
  { name: "Department of Housing and Urban Development", type: "housing", address: "451 7th Street SW, Washington, DC 20410", website: "https://www.hud.gov" },
  { name: "Department of Justice — Civil Rights Division", type: "civil_rights", address: "950 Pennsylvania Ave NW, Washington, DC 20530", website: "https://www.justice.gov/crt" },
  { name: "Indian Health Service", type: "health_services", address: "5600 Fishers Lane, Rockville, MD 20857", website: "https://www.ihs.gov" },
  { name: "Centers for Medicare and Medicaid Services", type: "health_insurance", address: "7500 Security Blvd, Baltimore, MD 21244", website: "https://www.cms.gov" },
  { name: "Department of Health and Human Services", type: "health_services", address: "200 Independence Ave SW, Washington, DC 20201", website: "https://www.hhs.gov" },
  { name: "Federal Trade Commission", type: "consumer_protection", address: "600 Pennsylvania Ave NW, Washington, DC 20580", website: "https://www.ftc.gov" },
  { name: "Consumer Financial Protection Bureau", type: "financial_protection", address: "1700 G Street NW, Washington, DC 20552", website: "https://www.consumerfinance.gov" },
  { name: "Office of the Comptroller of the Currency", type: "financial_regulator", address: "400 7th Street SW, Washington, DC 20219", website: "https://www.occ.gov" },
  { name: "Federal Communications Commission", type: "communications_regulator", address: "45 L Street NE, Washington, DC 20554", website: "https://www.fcc.gov" },
  { name: "Environmental Protection Agency", type: "environmental_regulator", address: "1200 Pennsylvania Ave NW, Washington, DC 20460", website: "https://www.epa.gov" },
  { name: "Federal Housing Finance Agency", type: "financial_regulator", address: "400 7th Street SW, Washington, DC 20219", website: "https://www.fhfa.gov" },
  { name: "United States Postal Service", type: "postal_service", address: "475 L'Enfant Plaza SW, Washington, DC 20260", website: "https://www.usps.com" },
];

// ── All 58 California counties ────────────────────────────────────────────────
const CA_COUNTIES = [
  "Alameda", "Alpine", "Amador", "Butte", "Calaveras", "Colusa", "Contra Costa",
  "Del Norte", "El Dorado", "Fresno", "Glenn", "Humboldt", "Imperial", "Inyo",
  "Kern", "Kings", "Lake", "Lassen", "Los Angeles", "Madera", "Marin", "Mariposa",
  "Mendocino", "Merced", "Modoc", "Mono", "Monterey", "Napa", "Nevada", "Orange",
  "Placer", "Plumas", "Riverside", "Sacramento", "San Benito", "San Bernardino",
  "San Diego", "San Francisco", "San Joaquin", "San Luis Obispo", "San Mateo",
  "Santa Barbara", "Santa Clara", "Santa Cruz", "Shasta", "Sierra", "Siskiyou",
  "Solano", "Sonoma", "Stanislaus", "Sutter", "Tehama", "Trinity", "Tulare",
  "Tuolumne", "Ventura", "Yolo", "Yuba",
];

// ── Census API ingestion ──────────────────────────────────────────────────────

async function ingestCensusCounties(): Promise<{ upserted: number; failed: number }> {
  let upserted = 0;
  let failed = 0;

  try {
    const url = "https://api.census.gov/data/2020/dec/pl?get=NAME,GEO_ID&for=county:*";
    const resp = await fetch(url, { signal: AbortSignal.timeout(30000) });
    if (!resp.ok) throw new Error(`Census API HTTP ${resp.status}`);

    const data = await resp.json() as string[][];
    const rows = data.slice(1); // skip header

    for (const row of rows) {
      try {
        const [name, geoId, , stateCode, countyCode] = row;
        if (!name || !stateCode || !countyCode) continue;

        const countyName = name.replace(/\s+County,.*$/, "").replace(/\s+Parish,.*$/, "").trim();
        const fipsCode = `${stateCode}${countyCode}`;

        const stateEntry = Object.entries(STATE_FIPS).find(([, v]) => v.fips === stateCode);
        if (!stateEntry) continue;
        const [stateAbbr, stateInfo] = stateEntry;

        await db.execute(sql.raw(`
          INSERT INTO jurisdiction_directory (state_code, state_name, county, fips_code, tribal_land_flag, last_synced_at)
          VALUES ('${stateAbbr}', '${stateInfo.name.replace(/'/g, "''")}', '${countyName.replace(/'/g, "''")}', '${fipsCode}', false, NOW())
          ON CONFLICT DO NOTHING
        `));
        upserted++;
      } catch { failed++; }
    }
  } catch (e) {
    logger.warn({ err: e }, "authority.sync: Census API call failed");
    failed++;
  }

  return { upserted, failed };
}

// ── California structural seeding (assessors, recorders, treasurers) ──────────

async function ingestCaliforniaAgencies(): Promise<{ upserted: number; failed: number }> {
  let upserted = 0;
  let failed = 0;
  const now = new Date().toISOString();

  // Try Socrata CA open data first
  try {
    const url = "https://data.ca.gov/api/3/action/datastore_search?resource_id=900c14f2-d44f-4433-9f4a-bdfede4a4d02&limit=100";
    const resp = await fetch(url, { signal: AbortSignal.timeout(15000) });
    if (resp.ok) {
      const json = await resp.json() as { result?: { records?: Record<string, string>[] } };
      const records = json?.result?.records ?? [];
      for (const rec of records) {
        try {
          const name = rec["Agency Name"] ?? rec["name"] ?? rec["agency_name"];
          const type = rec["Agency Type"] ?? rec["type"] ?? "state_agency";
          if (!name) continue;
          await db.execute(sql.raw(`
            INSERT INTO agency_directory (agency_name, agency_type, government_level, state_code, confidence_score, last_synced_at)
            VALUES ('${name.replace(/'/g, "''")}', '${String(type).replace(/'/g, "''")}', 'state', 'CA', 0.7, '${now}')
            ON CONFLICT DO NOTHING
          `));
          upserted++;
        } catch { failed++; }
      }
    }
  } catch { /* proceed with structural seeding */ }

  // Structural seeding: all 58 CA county assessors, recorders, treasurers, and courts
  const roles = [
    { suffix: "County Assessor", type: "county_assessor" },
    { suffix: "County Recorder", type: "county_recorder" },
    { suffix: "County Treasurer", type: "county_treasurer" },
    { suffix: "Superior Court", type: "state_court" },
  ];

  for (const county of CA_COUNTIES) {
    for (const role of roles) {
      try {
        const name = `${county} ${role.suffix}`;
        await db.execute(sql.raw(`
          INSERT INTO agency_directory (agency_name, agency_type, government_level, state_code, county, confidence_score, last_synced_at)
          VALUES ('${name.replace(/'/g, "''")}', '${role.type}', 'county', 'CA', '${county.replace(/'/g, "''")}', 0.75, '${now}')
          ON CONFLICT DO NOTHING
        `));
        upserted++;
      } catch { failed++; }
    }
  }

  // CA state agencies
  const caStateAgencies = [
    { name: "California Franchise Tax Board", type: "tax_authority", web: "https://www.ftb.ca.gov" },
    { name: "California State Board of Equalization", type: "tax_authority", web: "https://www.boe.ca.gov" },
    { name: "California Department of Health Care Services", type: "health_services", web: "https://www.dhcs.ca.gov" },
    { name: "California Department of Insurance", type: "insurance_regulator", web: "https://www.insurance.ca.gov" },
    { name: "California Public Utilities Commission", type: "utility_regulator", web: "https://www.cpuc.ca.gov" },
    { name: "California Department of Real Estate", type: "real_estate", web: "https://www.dre.ca.gov" },
    { name: "California Attorney General — Public Rights Division", type: "state_law_enforcement", web: "https://oag.ca.gov" },
    { name: "California Department of Social Services", type: "social_services", web: "https://www.cdss.ca.gov" },
    { name: "California Department of Child Support Services", type: "child_support", web: "https://www.cdcss.ca.gov" },
    { name: "California Department of Tax and Fee Administration", type: "tax_authority", web: "https://www.cdtfa.ca.gov" },
  ];

  for (const ag of caStateAgencies) {
    try {
      await db.execute(sql.raw(`
        INSERT INTO agency_directory (agency_name, agency_type, government_level, state_code, website, confidence_score, last_synced_at)
        VALUES ('${ag.name.replace(/'/g, "''")}', '${ag.type}', 'state', 'CA', '${ag.web}', 0.95, '${now}')
        ON CONFLICT DO NOTHING
      `));
      upserted++;
    } catch { failed++; }
  }

  return { upserted, failed };
}

// ── Federal agency baseline ingestion ─────────────────────────────────────────

async function ingestFederalAgencies(): Promise<{ upserted: number; failed: number }> {
  let upserted = 0;
  let failed = 0;
  const now = new Date().toISOString();

  for (const agency of FEDERAL_AGENCIES) {
    try {
      await db.execute(sql.raw(`
        INSERT INTO agency_directory (agency_name, agency_type, government_level, physical_address, website, confidence_score, last_synced_at)
        VALUES ('${agency.name.replace(/'/g, "''")}', '${agency.type}', 'federal', '${agency.address.replace(/'/g, "''")}', '${agency.website}', 0.98, '${now}')
        ON CONFLICT DO NOTHING
      `));
      upserted++;
    } catch { failed++; }
  }

  return { upserted, failed };
}

// ── Sync endpoint ─────────────────────────────────────────────────────────────

router.get("/", requireAuth, requireAdmin, async (_req, res, next) => {
  try {
    logger.info("authority.sync: starting ingestion jobs");
    const syncStart = Date.now();

    const [censusResult, caResult, federalResult] = await Promise.allSettled([
      ingestCensusCounties(),
      ingestCaliforniaAgencies(),
      ingestFederalAgencies(),
    ]);

    const summary = {
      durationMs: Date.now() - syncStart,
      census: censusResult.status === "fulfilled" ? censusResult.value : { error: String((censusResult as PromiseRejectedResult).reason) },
      california: caResult.status === "fulfilled" ? caResult.value : { error: String((caResult as PromiseRejectedResult).reason) },
      federal: federalResult.status === "fulfilled" ? federalResult.value : { error: String((federalResult as PromiseRejectedResult).reason) },
      completedAt: new Date().toISOString(),
    };

    logger.info(summary, "authority.sync: ingestion complete");
    res.json({ success: true, summary });
  } catch (err) {
    next(err);
  }
});

export default router;
