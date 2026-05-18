/**
 * Authority Directory — startup ingestion utility.
 * Runs once at server startup (non-blocking, best-effort).
 * Seeds federal agencies and CA structural agencies if the agency table is empty.
 * Also attempts Census API to populate jurisdiction_directory with all US counties/FIPS.
 * Full re-ingestion (Census + Socrata + HealthData.gov) available via GET /api/authority/sync (admin-only).
 */
import { db } from "@workspace/db";
import { authorityAgenciesTable, authorityJurisdictionTable } from "@workspace/db";
import { sql, count } from "drizzle-orm";
import { logger } from "./logger";

// State FIPS mapping (subset of all US states + territories for Census API)
const STATE_FIPS: Record<string, { name: string; fips: string }> = {
  AL:{name:"Alabama",fips:"01"}, AK:{name:"Alaska",fips:"02"}, AZ:{name:"Arizona",fips:"04"},
  AR:{name:"Arkansas",fips:"05"}, CA:{name:"California",fips:"06"}, CO:{name:"Colorado",fips:"08"},
  CT:{name:"Connecticut",fips:"09"}, DE:{name:"Delaware",fips:"10"}, FL:{name:"Florida",fips:"12"},
  GA:{name:"Georgia",fips:"13"}, HI:{name:"Hawaii",fips:"15"}, ID:{name:"Idaho",fips:"16"},
  IL:{name:"Illinois",fips:"17"}, IN:{name:"Indiana",fips:"18"}, IA:{name:"Iowa",fips:"19"},
  KS:{name:"Kansas",fips:"20"}, KY:{name:"Kentucky",fips:"21"}, LA:{name:"Louisiana",fips:"22"},
  ME:{name:"Maine",fips:"23"}, MD:{name:"Maryland",fips:"24"}, MA:{name:"Massachusetts",fips:"25"},
  MI:{name:"Michigan",fips:"26"}, MN:{name:"Minnesota",fips:"27"}, MS:{name:"Mississippi",fips:"28"},
  MO:{name:"Missouri",fips:"29"}, MT:{name:"Montana",fips:"30"}, NE:{name:"Nebraska",fips:"31"},
  NV:{name:"Nevada",fips:"32"}, NH:{name:"New Hampshire",fips:"33"}, NJ:{name:"New Jersey",fips:"34"},
  NM:{name:"New Mexico",fips:"35"}, NY:{name:"New York",fips:"36"}, NC:{name:"North Carolina",fips:"37"},
  ND:{name:"North Dakota",fips:"38"}, OH:{name:"Ohio",fips:"39"}, OK:{name:"Oklahoma",fips:"40"},
  OR:{name:"Oregon",fips:"41"}, PA:{name:"Pennsylvania",fips:"42"}, RI:{name:"Rhode Island",fips:"44"},
  SC:{name:"South Carolina",fips:"45"}, SD:{name:"South Dakota",fips:"46"}, TN:{name:"Tennessee",fips:"47"},
  TX:{name:"Texas",fips:"48"}, UT:{name:"Utah",fips:"49"}, VT:{name:"Vermont",fips:"50"},
  VA:{name:"Virginia",fips:"51"}, WA:{name:"Washington",fips:"53"}, WV:{name:"West Virginia",fips:"54"},
  WI:{name:"Wisconsin",fips:"55"}, WY:{name:"Wyoming",fips:"56"},
  DC:{name:"District of Columbia",fips:"11"},
};

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

async function ingestCensusJurisdictions(): Promise<{ upserted: number; failed: number; source: string }> {
  let upserted = 0;
  let failed = 0;

  try {
    const url = "https://api.census.gov/data/2020/dec/pl?get=NAME,GEO_ID&for=county:*";
    const resp = await fetch(url, { signal: AbortSignal.timeout(30000) });
    if (!resp.ok) throw new Error(`Census API HTTP ${resp.status}`);

    const data = await resp.json() as string[][];
    const rows = data.slice(1);

    for (const row of rows) {
      try {
        const [name, , , stateCode, countyCode] = row;
        if (!name || !stateCode || !countyCode) continue;

        const countyName = name.replace(/\s+County,.*$/, "").replace(/\s+Parish,.*$/, "").trim();
        const fipsCode = `${stateCode}${countyCode}`;

        const stateEntry = Object.entries(STATE_FIPS).find(([, v]) => v.fips === stateCode);
        if (!stateEntry) continue;
        const [stateAbbr, stateInfo] = stateEntry;

        const countySafe = countyName.replace(/'/g, "''");
        const stateNameSafe = stateInfo.name.replace(/'/g, "''");

        await db.execute(sql.raw(`
          INSERT INTO jurisdiction_directory (state_code, state_name, county, fips_code, tribal_land_flag, last_synced_at)
          VALUES ('${stateAbbr}', '${stateNameSafe}', '${countySafe}', '${fipsCode}', false, NOW())
          ON CONFLICT (state_code, COALESCE(county,''), COALESCE(city,''))
          DO UPDATE SET fips_code = EXCLUDED.fips_code, last_synced_at = NOW(), updated_at = NOW()
        `));
        upserted++;
      } catch { failed++; }
    }

    logger.info({ upserted, failed }, "authority.startup-ingest: Census jurisdiction ingestion complete");
    return { upserted, failed, source: "census_api" };
  } catch (e) {
    logger.warn({ err: e }, "authority.startup-ingest: Census API call failed, using CA static fallback");

    // Static fallback: seed all 58 CA counties with FIPS codes
    const CA_COUNTY_FIPS: [string, string][] = [
      ["Alameda","06001"],["Alpine","06003"],["Amador","06005"],["Butte","06007"],
      ["Calaveras","06009"],["Colusa","06011"],["Contra Costa","06013"],["Del Norte","06015"],
      ["El Dorado","06017"],["Fresno","06019"],["Glenn","06021"],["Humboldt","06023"],
      ["Imperial","06025"],["Inyo","06027"],["Kern","06029"],["Kings","06031"],
      ["Lake","06033"],["Lassen","06035"],["Los Angeles","06037"],["Madera","06039"],
      ["Marin","06041"],["Mariposa","06043"],["Mendocino","06045"],["Merced","06047"],
      ["Modoc","06049"],["Mono","06051"],["Monterey","06053"],["Napa","06055"],
      ["Nevada","06057"],["Orange","06059"],["Placer","06061"],["Plumas","06063"],
      ["Riverside","06065"],["Sacramento","06067"],["San Benito","06069"],["San Bernardino","06071"],
      ["San Diego","06073"],["San Francisco","06075"],["San Joaquin","06077"],["San Luis Obispo","06079"],
      ["San Mateo","06081"],["Santa Barbara","06083"],["Santa Clara","06085"],["Santa Cruz","06087"],
      ["Shasta","06089"],["Sierra","06091"],["Siskiyou","06093"],["Solano","06095"],
      ["Sonoma","06097"],["Stanislaus","06099"],["Sutter","06101"],["Tehama","06103"],
      ["Trinity","06105"],["Tulare","06107"],["Tuolumne","06109"],["Ventura","06111"],
      ["Yolo","06113"],["Yuba","06115"],
    ];

    for (const [county, fips] of CA_COUNTY_FIPS) {
      try {
        const countySafe = county.replace(/'/g, "''");
        await db.execute(sql.raw(`
          INSERT INTO jurisdiction_directory (state_code, state_name, county, fips_code, tribal_land_flag, last_synced_at)
          VALUES ('CA', 'California', '${countySafe}', '${fips}', false, NOW())
          ON CONFLICT (state_code, COALESCE(county,''), COALESCE(city,''))
          DO UPDATE SET fips_code = EXCLUDED.fips_code, last_synced_at = NOW(), updated_at = NOW()
        `));
        upserted++;
      } catch { failed++; }
    }

    return { upserted, failed, source: "ca_static_fallback" };
  }
}

export async function runStartupIngest(): Promise<void> {
  try {
    const [{ value: agencyCount }] = await db.select({ value: count() }).from(authorityAgenciesTable);
    const [{ value: jurisdictionCount }] = await db.select({ value: count() }).from(authorityJurisdictionTable);
    const now = new Date().toISOString();

    const shouldSeedAgencies = Number(agencyCount) <= 50;
    const shouldSeedJurisdictions = Number(jurisdictionCount) === 0;

    if (!shouldSeedAgencies && !shouldSeedJurisdictions) {
      logger.info({ agencyCount, jurisdictionCount }, "authority.startup-ingest: tables already populated, skipping");
      return;
    }

    if (shouldSeedAgencies) {
      logger.info("authority.startup-ingest: seeding federal + CA agencies");

      for (const ag of FEDERAL_AGENCIES) {
        try {
          await db.execute(sql.raw(`
            INSERT INTO agency_directory (agency_name, agency_type, government_level, physical_address, website, confidence_score, last_synced_at)
            VALUES ('${ag.name.replace(/'/g, "''")}', '${ag.type}', '${ag.level}', '${ag.address.replace(/'/g, "''")}', '${ag.website}', 0.98, '${now}')
            ON CONFLICT (agency_name, government_level, COALESCE(state_code,''), COALESCE(county,''))
            DO UPDATE SET physical_address = EXCLUDED.physical_address, website = EXCLUDED.website, last_synced_at = EXCLUDED.last_synced_at, updated_at = NOW()
          `));
        } catch { }
      }

      for (const ag of CA_STATE_AGENCIES) {
        try {
          await db.execute(sql.raw(`
            INSERT INTO agency_directory (agency_name, agency_type, government_level, state_code, website, confidence_score, last_synced_at)
            VALUES ('${ag.name.replace(/'/g, "''")}', '${ag.type}', 'state', 'CA', '${ag.web}', 0.95, '${now}')
            ON CONFLICT (agency_name, government_level, COALESCE(state_code,''), COALESCE(county,''))
            DO UPDATE SET website = EXCLUDED.website, last_synced_at = EXCLUDED.last_synced_at, updated_at = NOW()
          `));
        } catch { }
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
              ON CONFLICT (agency_name, government_level, COALESCE(state_code,''), COALESCE(county,''))
              DO UPDATE SET last_synced_at = EXCLUDED.last_synced_at, updated_at = NOW()
            `));
          } catch { }
        }
      }

      logger.info("authority.startup-ingest: agency seeding complete");
    }

    if (shouldSeedJurisdictions) {
      logger.info("authority.startup-ingest: seeding jurisdiction_directory from Census API");
      const result = await ingestCensusJurisdictions();
      logger.info(result, "authority.startup-ingest: jurisdiction seeding complete");
    }

    logger.info({ agencyCount, jurisdictionCount }, "authority.startup-ingest: complete");
  } catch (err) {
    logger.warn({ err }, "authority.startup-ingest: failed");
  }
}
