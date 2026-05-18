/**
 * Authority Directory — startup ingestion utility.
 * Runs once at server startup (non-blocking, best-effort).
 * Seeds federal agencies and CA structural agencies if the table is empty.
 * Full re-ingestion (Census + Socrata) is available via GET /api/authority/sync (admin-only).
 */
import { db } from "@workspace/db";
import { authorityAgenciesTable } from "@workspace/db";
import { sql, count } from "drizzle-orm";
import { logger } from "./logger";

const FEDERAL_AGENCIES = [
  { name: "Internal Revenue Service", type: "tax_authority", level: "federal", address: "1111 Constitution Ave NW, Washington, DC 20224", website: "https://www.irs.gov" },
  { name: "Bureau of Indian Affairs", type: "federal_indian_affairs", level: "federal", address: "1849 C Street NW, Washington, DC 20240", website: "https://www.bia.gov" },
  { name: "Bureau of Land Management", type: "land_management", level: "federal", address: "1849 C Street NW, Washington, DC 20240", website: "https://www.blm.gov" },
  { name: "Department of Housing and Urban Development", type: "housing", level: "federal", address: "451 7th Street SW, Washington, DC 20410", website: "https://www.hud.gov" },
  { name: "Department of Justice — Civil Rights Division", type: "civil_rights", level: "federal", address: "950 Pennsylvania Ave NW, Washington, DC 20530", website: "https://www.justice.gov/crt" },
  { name: "Indian Health Service", type: "health_services", level: "federal", address: "5600 Fishers Lane, Rockville, MD 20857", website: "https://www.ihs.gov" },
  { name: "Centers for Medicare and Medicaid Services", type: "health_insurance", level: "federal", address: "7500 Security Blvd, Baltimore, MD 21244", website: "https://www.cms.gov" },
  { name: "Department of Health and Human Services", type: "health_services", level: "federal", address: "200 Independence Ave SW, Washington, DC 20201", website: "https://www.hhs.gov" },
  { name: "Federal Trade Commission", type: "consumer_protection", level: "federal", address: "600 Pennsylvania Ave NW, Washington, DC 20580", website: "https://www.ftc.gov" },
  { name: "Consumer Financial Protection Bureau", type: "financial_protection", level: "federal", address: "1700 G Street NW, Washington, DC 20552", website: "https://www.consumerfinance.gov" },
  { name: "Office of the Comptroller of the Currency", type: "financial_regulator", level: "federal", address: "400 7th Street SW, Washington, DC 20219", website: "https://www.occ.gov" },
  { name: "Federal Communications Commission", type: "communications_regulator", level: "federal", address: "45 L Street NE, Washington, DC 20554", website: "https://www.fcc.gov" },
  { name: "Environmental Protection Agency", type: "environmental_regulator", level: "federal", address: "1200 Pennsylvania Ave NW, Washington, DC 20460", website: "https://www.epa.gov" },
  { name: "Federal Housing Finance Agency", type: "financial_regulator", level: "federal", address: "400 7th Street SW, Washington, DC 20219", website: "https://www.fhfa.gov" },
  { name: "United States Postal Service", type: "postal_service", level: "federal", address: "475 L'Enfant Plaza SW, Washington, DC 20260", website: "https://www.usps.com" },
];

const CA_STATE_AGENCIES = [
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

const CA_COUNTIES = [
  "Alameda","Alpine","Amador","Butte","Calaveras","Colusa","Contra Costa",
  "Del Norte","El Dorado","Fresno","Glenn","Humboldt","Imperial","Inyo",
  "Kern","Kings","Lake","Lassen","Los Angeles","Madera","Marin","Mariposa",
  "Mendocino","Merced","Modoc","Mono","Monterey","Napa","Nevada","Orange",
  "Placer","Plumas","Riverside","Sacramento","San Benito","San Bernardino",
  "San Diego","San Francisco","San Joaquin","San Luis Obispo","San Mateo",
  "Santa Barbara","Santa Clara","Santa Cruz","Shasta","Sierra","Siskiyou",
  "Solano","Sonoma","Stanislaus","Sutter","Tehama","Trinity","Tulare",
  "Tuolumne","Ventura","Yolo","Yuba",
];

export async function runStartupIngest(): Promise<void> {
  try {
    const [{ value: rowCount }] = await db.select({ value: count() }).from(authorityAgenciesTable);
    if (Number(rowCount) > 50) {
      logger.info({ rowCount }, "authority.startup-ingest: agency_directory already populated, skipping");
      return;
    }

    logger.info("authority.startup-ingest: seeding federal + CA agencies");
    const now = new Date().toISOString();

    for (const ag of FEDERAL_AGENCIES) {
      try {
        await db.execute(sql.raw(`
          INSERT INTO agency_directory (agency_name, agency_type, government_level, physical_address, website, confidence_score, last_synced_at)
          VALUES ('${ag.name.replace(/'/g, "''")}', '${ag.type}', '${ag.level}', '${ag.address.replace(/'/g, "''")}', '${ag.website}', 0.98, '${now}')
          ON CONFLICT DO NOTHING
        `));
      } catch { /* skip duplicates */ }
    }

    for (const ag of CA_STATE_AGENCIES) {
      try {
        await db.execute(sql.raw(`
          INSERT INTO agency_directory (agency_name, agency_type, government_level, state_code, website, confidence_score, last_synced_at)
          VALUES ('${ag.name.replace(/'/g, "''")}', '${ag.type}', 'state', 'CA', '${ag.web}', 0.95, '${now}')
          ON CONFLICT DO NOTHING
        `));
      } catch { /* skip */ }
    }

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
        } catch { /* skip */ }
      }
    }

    logger.info("authority.startup-ingest: complete");
  } catch (err) {
    logger.warn({ err }, "authority.startup-ingest: failed");
  }
}
