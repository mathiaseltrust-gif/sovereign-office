/**
 * Authority Directory — Seed Data
 *
 * Populates:
 *   - authority_matter_routing: routing rules for every supported matter type
 *   - authority_legal_map: federal/tribal legal authority for key issue types
 *   - authority_agencies: core California agencies (supplemented by live data ingestion)
 *   - authority_jurisdiction: core California jurisdictions
 *
 * Safe to run multiple times — uses ON CONFLICT DO NOTHING / upsert patterns.
 */
import { drizzle } from "drizzle-orm/node-postgres";
import { sql } from "drizzle-orm";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("[seed] DATABASE_URL is required");
  process.exit(1);
}

const db = drizzle(databaseUrl);

// ── Matter Routing Rules ──────────────────────────────────────────────────────

const MATTER_ROUTING_RULES = [
  {
    matterType: "icwa_violation",
    matterLabel: "ICWA — Indian Child Welfare Act Proceeding",
    primaryEntityType: "tribal_government",
    oversightEntityType: "federal_bia",
    requiredNoticeTemplate: "icwa_notice",
    escalationTemplate: "jurisdictional_enforcement_notice",
    legalFlagGroup: ["ICWA", "tribal_sovereignty", "federal_trust"],
    primaryRecipientNote: "Notify tribal ICWA representative and tribal court immediately",
    oversightRecipientNote: "Copy BIA Regional Director per 25 U.S.C. § 1912",
    escalationPath: "tribal_court → federal_court → BIA",
    tribalLawApplicable: "25 U.S.C. §§ 1901–1963 (ICWA); 25 C.F.R. Part 23",
  },
  {
    matterType: "tax_lien",
    matterLabel: "Tax Lien on Indian Trust Land or Tribal Property",
    primaryEntityType: "tribal_government",
    oversightEntityType: "federal_bia",
    requiredNoticeTemplate: "nfr",
    escalationTemplate: "state_prohibition_notice",
    legalFlagGroup: ["trust_land", "state_taxation_prohibited", "Indian_country"],
    primaryRecipientNote: "Issue Notice of Federal Review — state tax liens void ab initio on trust land",
    oversightRecipientNote: "Notify BIA and DOI Trust Services",
    escalationPath: "tribal_court → federal_district_court",
    tribalLawApplicable: "25 U.S.C. § 5108; McClanahan v. Arizona State Tax Comm'n, 411 U.S. 164 (1973)",
  },
  {
    matterType: "tax_assessment",
    matterLabel: "Property Tax Assessment — Contested Indian Land",
    primaryEntityType: "county_assessor",
    oversightEntityType: "state_board_of_equalization",
    requiredNoticeTemplate: "board_of_review_petition",
    escalationTemplate: "nfr",
    legalFlagGroup: ["trust_land", "state_taxation_prohibited"],
    primaryRecipientNote: "File protest with County Board of Review citing federal trust status",
    oversightRecipientNote: "Notify State Board of Equalization and BIA",
    escalationPath: "county_board_of_review → state_tax_tribunal → federal_court",
    tribalLawApplicable: "25 U.S.C. § 5108; Oklahoma Tax Comm'n v. Chickasaw Nation, 515 U.S. 450 (1995)",
  },
  {
    matterType: "foreclosure",
    matterLabel: "Foreclosure Action on Indian or Trust Land",
    primaryEntityType: "tribal_government",
    oversightEntityType: "federal_bia",
    requiredNoticeTemplate: "nfr",
    escalationTemplate: "jurisdictional_enforcement_notice",
    legalFlagGroup: ["trust_land", "Indian_country", "federal_trust", "foreclosure_void"],
    primaryRecipientNote: "Foreclosure void ab initio on trust/restricted land — issue NFR immediately",
    oversightRecipientNote: "Notify BIA, DOI, and federal district court",
    escalationPath: "tribal_court → federal_district_court → injunction",
    tribalLawApplicable: "25 U.S.C. §§ 177, 5108; Oneida Indian Nation v. County of Oneida",
  },
  {
    matterType: "court_order",
    matterLabel: "State/County Court Order Affecting Tribal Member or Land",
    primaryEntityType: "tribal_court",
    oversightEntityType: "federal_court",
    requiredNoticeTemplate: "jurisdictional_statement",
    escalationTemplate: "jurisdictional_enforcement_notice",
    legalFlagGroup: ["tribal_sovereignty", "Worcester_v_Georgia", "jurisdictional_overreach"],
    primaryRecipientNote: "Assert tribal court jurisdiction and sovereign immunity",
    oversightRecipientNote: "Copy federal district court and BIA",
    escalationPath: "tribal_court → federal_district_court → 9th_circuit",
    tribalLawApplicable: "Worcester v. Georgia, 31 U.S. 515 (1832); 25 U.S.C. § 1301",
  },
  {
    matterType: "zoning",
    matterLabel: "State/County Zoning or Permit Action on Indian Land",
    primaryEntityType: "tribal_government",
    oversightEntityType: "federal_bia",
    requiredNoticeTemplate: "state_prohibition_notice",
    escalationTemplate: "jurisdictional_enforcement_notice",
    legalFlagGroup: ["tribal_sovereignty", "Indian_country", "state_law_inapplicable"],
    primaryRecipientNote: "State/county zoning authority does not extend to Indian country",
    oversightRecipientNote: "Notify BIA and tribal council",
    escalationPath: "tribal_government → federal_court",
    tribalLawApplicable: "Worcester v. Georgia; Montana v. United States, 450 U.S. 544 (1981)",
  },
  {
    matterType: "jurisdictional_overreach",
    matterLabel: "State or County Jurisdictional Overreach",
    primaryEntityType: "tribal_government",
    oversightEntityType: "federal_doj",
    requiredNoticeTemplate: "jurisdictional_enforcement_notice",
    escalationTemplate: "state_prohibition_notice",
    legalFlagGroup: ["tribal_sovereignty", "Worcester_v_Georgia", "preemption"],
    primaryRecipientNote: "Issue formal notice of tribal jurisdiction — state authority preempted",
    oversightRecipientNote: "Copy DOJ Indian Affairs and BIA",
    escalationPath: "tribal_council → federal_district_court → DOJ",
    tribalLawApplicable: "Worcester v. Georgia; McClanahan v. Arizona State Tax Comm'n",
  },
  {
    matterType: "deed",
    matterLabel: "Deed or Title Instrument — Indian Land",
    primaryEntityType: "tribal_government",
    oversightEntityType: "federal_bia",
    requiredNoticeTemplate: "trust_declaration",
    escalationTemplate: "nfr",
    legalFlagGroup: ["trust_land", "non_intercourse_act", "federal_approval_required"],
    primaryRecipientNote: "Land transfers require federal approval under the Non-Intercourse Act",
    oversightRecipientNote: "Notify BIA Realty and DOI",
    escalationPath: "tribal_council → BIA_Realty → DOI",
    tribalLawApplicable: "25 U.S.C. § 177 (Non-Intercourse Act); 25 U.S.C. § 5108",
  },
  {
    matterType: "identity_verification",
    matterLabel: "Tribal Enrollment or Identity Challenge",
    primaryEntityType: "tribal_enrollment_office",
    oversightEntityType: "tribal_council",
    requiredNoticeTemplate: "identity_document",
    escalationTemplate: "sovereign_restoration_declaration",
    legalFlagGroup: ["tribal_citizenship", "sovereign_enrollment_authority"],
    primaryRecipientNote: "Tribal enrollment is an internal sovereign matter — external challenges have no authority",
    oversightRecipientNote: "Notify tribal council and enrollment committee",
    escalationPath: "enrollment_office → tribal_council → tribal_court",
    tribalLawApplicable: "Santa Clara Pueblo v. Martinez, 436 U.S. 49 (1978); tribal enrollment ordinance",
  },
  {
    matterType: "trust_declaration",
    matterLabel: "Trust Declaration or Trust Instrument",
    primaryEntityType: "tribal_government",
    oversightEntityType: "federal_bia",
    requiredNoticeTemplate: "trust_declaration",
    escalationTemplate: "nfr",
    legalFlagGroup: ["trust_land", "federal_trust", "DOI_approval"],
    primaryRecipientNote: "Record with BIA Realty for federal trust protection",
    oversightRecipientNote: "Copy DOI and BIA Trust Services",
    escalationPath: "tribal_government → BIA → DOI",
    tribalLawApplicable: "25 U.S.C. § 5108; Indian Reorganization Act, 25 U.S.C. §§ 5101–5144",
  },
  {
    matterType: "general",
    matterLabel: "General Sovereign Matter",
    primaryEntityType: "tribal_government",
    oversightEntityType: "federal_bia",
    requiredNoticeTemplate: "inherent_sovereignty_declaration",
    escalationTemplate: "jurisdictional_enforcement_notice",
    legalFlagGroup: ["tribal_sovereignty"],
    primaryRecipientNote: "Route to sovereign office for review and determination",
    oversightRecipientNote: "Notify BIA as appropriate",
    escalationPath: "sovereign_office → tribal_council → federal_authority",
    tribalLawApplicable: "Tribal sovereignty — inherent right of self-governance",
  },
];

// ── Legal Authority Map ───────────────────────────────────────────────────────

const LEGAL_AUTHORITY_MAP = [
  {
    issueType: "tax_lien",
    authorityName: "State Taxation Prohibition on Trust Land",
    federalAuthority: "25 U.S.C. § 5108 (formerly § 465); 25 U.S.C. § 177",
    stateAuthority: null,
    tribalAuthority: "Tribal Tax Code",
    uscReference: "25 U.S.C. § 5108",
    cfrReference: "25 C.F.R. Part 151",
    caseLawReference: "McClanahan v. Arizona State Tax Comm'n, 411 U.S. 164 (1973); Oklahoma Tax Comm'n v. Chickasaw Nation, 515 U.S. 450 (1995)",
    appliesWhen: "Land is held in trust by the United States for the benefit of an Indian tribe or individual Indian",
    warningOrLimit: "State tax liens on trust land are void ab initio. Do not negotiate — assert federal status immediately.",
    templateLanguageSnippet: "The above-captioned property is held in trust by the United States under 25 U.S.C. § 5108 and is therefore immune from state and county taxation pursuant to McClanahan v. Arizona State Tax Comm'n and Oklahoma Tax Comm'n v. Chickasaw Nation.",
    reviewRequired: true,
  },
  {
    issueType: "icwa_violation",
    authorityName: "Indian Child Welfare Act",
    federalAuthority: "25 U.S.C. §§ 1901–1963",
    stateAuthority: "California Family Code § 177; Welfare & Institutions Code § 224 et seq.",
    tribalAuthority: "Tribal Welfare Code",
    uscReference: "25 U.S.C. §§ 1901–1963",
    cfrReference: "25 C.F.R. Part 23",
    caseLawReference: "Mississippi Band of Choctaw Indians v. Holyfield, 490 U.S. 30 (1989); Adoptive Couple v. Baby Girl, 570 U.S. 637 (2013)",
    appliesWhen: "Proceeding involves an Indian child in foster care placement, termination of parental rights, or adoption",
    warningOrLimit: "Tribe must be notified of ICWA proceedings. Active efforts standard applies. Emergency removal must be followed by tribal court transfer request.",
    templateLanguageSnippet: "This matter involves an Indian child within the meaning of 25 U.S.C. § 1903(4). The [Tribe] hereby asserts its rights under the Indian Child Welfare Act, 25 U.S.C. §§ 1901–1963, and demands immediate notification and the right to intervene.",
    reviewRequired: true,
  },
  {
    issueType: "foreclosure",
    authorityName: "Prohibition on Alienation of Trust Land",
    federalAuthority: "25 U.S.C. § 177 (Non-Intercourse Act); 25 U.S.C. § 5108",
    stateAuthority: null,
    tribalAuthority: "Tribal Land Code",
    uscReference: "25 U.S.C. §§ 177, 5108",
    cfrReference: "25 C.F.R. Part 152",
    caseLawReference: "Oneida Indian Nation of New York v. County of Oneida, 414 U.S. 661 (1974)",
    appliesWhen: "Foreclosure action is brought against land held in trust or subject to federal restrictions",
    warningOrLimit: "Trust land cannot be alienated without federal approval. Foreclosure is void ab initio. Seek immediate injunctive relief.",
    templateLanguageSnippet: "The property subject to the above-referenced foreclosure action is held in federal trust and restricted from alienation under 25 U.S.C. §§ 177 and 5108. This foreclosure proceeding is void ab initio and without legal effect.",
    reviewRequired: true,
  },
  {
    issueType: "jurisdictional_overreach",
    authorityName: "Inherent Tribal Sovereignty — State Law Preemption",
    federalAuthority: "U.S. Const. Art. I § 8, cl. 3; 25 U.S.C. § 1301",
    stateAuthority: null,
    tribalAuthority: "Tribal Constitution; inherent sovereignty",
    uscReference: "25 U.S.C. § 1301",
    cfrReference: null,
    caseLawReference: "Worcester v. Georgia, 31 U.S. 515 (1832); Montana v. United States, 450 U.S. 544 (1981); Cabazon Band v. California, 480 U.S. 202 (1987)",
    appliesWhen: "State or county asserts jurisdiction, regulatory authority, or law enforcement authority within Indian country or over tribal members in tribal matters",
    warningOrLimit: "Worcester doctrine — state law has no force in Indian country. Cite preemption and assert exclusive tribal/federal jurisdiction.",
    templateLanguageSnippet: "Pursuant to Worcester v. Georgia, 31 U.S. 515 (1832), and the laws of the United States, the State of [State] has no authority to regulate or impose its laws within the sovereign territory of the [Tribe]. Any purported state action is without legal effect.",
    reviewRequired: true,
  },
  {
    issueType: "court_order",
    authorityName: "Tribal Court Jurisdiction and Sovereign Immunity",
    federalAuthority: "25 U.S.C. § 1301; 28 U.S.C. § 1360",
    stateAuthority: null,
    tribalAuthority: "Tribal Court Code",
    uscReference: "25 U.S.C. § 1301",
    cfrReference: "25 C.F.R. Part 11",
    caseLawReference: "Santa Clara Pueblo v. Martinez, 436 U.S. 49 (1978); Kiowa Tribe v. Manufacturing Technologies, 523 U.S. 751 (1998)",
    appliesWhen: "State or county court issues order affecting tribal member rights, tribal land, or matters within tribal court jurisdiction",
    warningOrLimit: "Tribal sovereign immunity bars unconsented suit. Challenge state court jurisdiction. File tribal court action for exclusive jurisdiction.",
    templateLanguageSnippet: "The [Tribe] asserts tribal sovereign immunity from suit in [State] courts as recognized in Kiowa Tribe v. Manufacturing Technologies, Inc., 523 U.S. 751 (1998). This matter falls within the exclusive jurisdiction of [Tribe] Tribal Court.",
    reviewRequired: true,
  },
  {
    issueType: "identity_verification",
    authorityName: "Tribal Enrollment Authority — Exclusive Sovereign Right",
    federalAuthority: null,
    stateAuthority: null,
    tribalAuthority: "Tribal Enrollment Ordinance; Tribal Constitution",
    uscReference: null,
    cfrReference: "25 C.F.R. Part 76",
    caseLawReference: "Santa Clara Pueblo v. Martinez, 436 U.S. 49 (1978)",
    appliesWhen: "External entity challenges tribal membership determination or tribal enrollment",
    warningOrLimit: "Tribal enrollment is an internal matter exclusively within sovereign authority. Courts will not review tribal membership decisions under Santa Clara Pueblo.",
    templateLanguageSnippet: "Pursuant to Santa Clara Pueblo v. Martinez, 436 U.S. 49 (1978), the [Tribe]'s determination of membership and citizenship is an exclusively internal sovereign matter not subject to external review.",
    reviewRequired: true,
  },
  {
    issueType: "trust_declaration",
    authorityName: "Trust Land Status — Federal Trust Responsibility",
    federalAuthority: "25 U.S.C. § 5108; Indian Reorganization Act, 25 U.S.C. § 5101",
    stateAuthority: null,
    tribalAuthority: "Tribal Trust Code",
    uscReference: "25 U.S.C. §§ 5101, 5108",
    cfrReference: "25 C.F.R. Part 151",
    caseLawReference: "United States v. Mitchell, 463 U.S. 206 (1983)",
    appliesWhen: "Land is being placed into or is confirmed to be held in trust by the United States",
    warningOrLimit: "BIA approval required for all trust land transactions. Maintain chain of title documentation. Record trust instruments with BIA Realty.",
    templateLanguageSnippet: "The United States holds the above-referenced land in trust for the benefit of the [Tribe/Individual] pursuant to 25 U.S.C. § 5108 and the Federal Trust Responsibility established in United States v. Mitchell, 463 U.S. 206 (1983).",
    reviewRequired: true,
  },
  {
    issueType: "zoning",
    authorityName: "State Zoning Inapplicable in Indian Country",
    federalAuthority: "25 U.S.C. § 1301; 18 U.S.C. § 1151",
    stateAuthority: null,
    tribalAuthority: "Tribal Land Use Ordinance",
    uscReference: "18 U.S.C. § 1151",
    cfrReference: null,
    caseLawReference: "Cabazon Band v. California, 480 U.S. 202 (1987); Montana v. United States, 450 U.S. 544 (1981)",
    appliesWhen: "State or county applies zoning, building codes, or land use regulations to land within Indian country",
    warningOrLimit: "State zoning laws generally inapplicable to Indian country. Challenge jurisdiction immediately. Tribal land use ordinance controls.",
    templateLanguageSnippet: "State and county zoning regulations do not apply within Indian country as defined by 18 U.S.C. § 1151. The [Tribe]'s land use ordinance exclusively governs the use of tribal lands.",
    reviewRequired: true,
  },
];

// ── Core California Agencies ──────────────────────────────────────────────────

const CALIFORNIA_AGENCIES = [
  {
    agencyName: "California Department of Child Support Services",
    agencyType: "child_support",
    governmentLevel: "state",
    stateCode: "CA",
    website: "https://www.cdcss.ca.gov",
    oversightAgency: "California Health and Human Services Agency",
    confidenceScore: 0.95,
  },
  {
    agencyName: "California Department of Social Services",
    agencyType: "social_services",
    governmentLevel: "state",
    stateCode: "CA",
    website: "https://www.cdss.ca.gov",
    oversightAgency: "California Health and Human Services Agency",
    confidenceScore: 0.95,
  },
  {
    agencyName: "Bureau of Indian Affairs — Pacific Region",
    agencyType: "federal_indian_affairs",
    governmentLevel: "federal",
    stateCode: "CA",
    city: "Sacramento",
    physicalAddress: "2800 Cottage Way, Sacramento, CA 95825",
    website: "https://www.bia.gov/regional-offices/pacific",
    parentAgency: "Bureau of Indian Affairs",
    oversightAgency: "Department of the Interior",
    confidenceScore: 0.98,
  },
  {
    agencyName: "California Department of Tax and Fee Administration",
    agencyType: "tax_authority",
    governmentLevel: "state",
    stateCode: "CA",
    website: "https://www.cdtfa.ca.gov",
    oversightAgency: "California Government Operations Agency",
    confidenceScore: 0.95,
  },
  {
    agencyName: "California State Board of Equalization",
    agencyType: "tax_authority",
    governmentLevel: "state",
    stateCode: "CA",
    city: "Sacramento",
    website: "https://www.boe.ca.gov",
    confidenceScore: 0.95,
  },
  {
    agencyName: "California Courts — Superior Court General",
    agencyType: "state_court",
    governmentLevel: "state",
    stateCode: "CA",
    website: "https://www.courts.ca.gov",
    oversightAgency: "Judicial Council of California",
    confidenceScore: 0.9,
  },
  {
    agencyName: "U.S. District Court — Eastern District of California",
    agencyType: "federal_court",
    governmentLevel: "federal",
    stateCode: "CA",
    city: "Sacramento",
    physicalAddress: "501 I Street, Sacramento, CA 95814",
    website: "https://www.caed.uscourts.gov",
    parentAgency: "Federal Judiciary",
    confidenceScore: 0.98,
  },
  {
    agencyName: "California Department of Justice — Tribal Liaison",
    agencyType: "state_law_enforcement",
    governmentLevel: "state",
    stateCode: "CA",
    website: "https://oag.ca.gov/tribal",
    oversightAgency: "California Department of Justice",
    confidenceScore: 0.9,
  },
  {
    agencyName: "Los Angeles County Assessor",
    agencyType: "county_assessor",
    governmentLevel: "county",
    stateCode: "CA",
    county: "Los Angeles",
    city: "Los Angeles",
    website: "https://assessor.lacounty.gov",
    parentAgency: "Los Angeles County",
    confidenceScore: 0.95,
  },
  {
    agencyName: "Los Angeles County Department of Children and Family Services",
    agencyType: "child_welfare",
    governmentLevel: "county",
    stateCode: "CA",
    county: "Los Angeles",
    city: "Los Angeles",
    website: "https://dcfs.lacounty.gov",
    parentAgency: "Los Angeles County",
    oversightAgency: "California Department of Social Services",
    confidenceScore: 0.95,
  },
  {
    agencyName: "Oakland County Board of Review",
    agencyType: "tax_appeal",
    governmentLevel: "county",
    stateCode: "MI",
    county: "Oakland",
    city: "Pontiac",
    website: "https://www.oakgov.com/treasurer/board-of-review",
    parentAgency: "Oakland County",
    oversightAgency: "Michigan Tax Tribunal",
    confidenceScore: 0.9,
  },
  {
    agencyName: "Michigan Tax Tribunal",
    agencyType: "tax_appeal",
    governmentLevel: "state",
    stateCode: "MI",
    city: "Lansing",
    website: "https://www.michigan.gov/taxtrib",
    confidenceScore: 0.95,
  },
  {
    agencyName: "Bureau of Indian Affairs — Midwest Region",
    agencyType: "federal_indian_affairs",
    governmentLevel: "federal",
    stateCode: "MI",
    city: "Minneapolis",
    website: "https://www.bia.gov/regional-offices/midwest",
    parentAgency: "Bureau of Indian Affairs",
    oversightAgency: "Department of the Interior",
    confidenceScore: 0.98,
  },
];

// ── Core Jurisdictions ────────────────────────────────────────────────────────

const JURISDICTIONS = [
  { stateCode: "CA", stateName: "California", county: "Los Angeles", fipsCode: "06037", tribalLandFlag: false, jurisdictionFlags: ["icwa_mandatory"] },
  { stateCode: "CA", stateName: "California", county: "San Diego", fipsCode: "06073", tribalLandFlag: false, jurisdictionFlags: ["icwa_mandatory"] },
  { stateCode: "CA", stateName: "California", county: "Sacramento", fipsCode: "06067", tribalLandFlag: false, jurisdictionFlags: ["icwa_mandatory"] },
  { stateCode: "CA", stateName: "California", county: "Riverside", fipsCode: "06065", tribalLandFlag: false, jurisdictionFlags: ["icwa_mandatory", "indian_country_nearby"] },
  { stateCode: "CA", stateName: "California", county: "San Bernardino", fipsCode: "06071", tribalLandFlag: false, jurisdictionFlags: ["icwa_mandatory", "indian_country_nearby"] },
  { stateCode: "MI", stateName: "Michigan", county: "Oakland", fipsCode: "26125", tribalLandFlag: false, jurisdictionFlags: [] },
  { stateCode: "MI", stateName: "Michigan", county: "Wayne", fipsCode: "26163", tribalLandFlag: false, jurisdictionFlags: [] },
  { stateCode: "AZ", stateName: "Arizona", county: "Maricopa", fipsCode: "04013", tribalLandFlag: false, jurisdictionFlags: ["indian_country_nearby"] },
  { stateCode: "NM", stateName: "New Mexico", county: "Bernalillo", fipsCode: "35001", tribalLandFlag: false, jurisdictionFlags: ["indian_country_nearby"] },
  { stateCode: "OK", stateName: "Oklahoma", county: "Tulsa", fipsCode: "40143", tribalLandFlag: false, jurisdictionFlags: ["mcgirt_jurisdiction"] },
  { stateCode: "WA", stateName: "Washington", county: "King", fipsCode: "53033", tribalLandFlag: false, jurisdictionFlags: ["icwa_mandatory"] },
  { stateCode: "MT", stateName: "Montana", county: "Big Horn", fipsCode: "30003", tribalLandFlag: true, jurisdictionFlags: ["indian_country", "treaty_area"] },
  { stateCode: "SD", stateName: "South Dakota", county: "Shannon", fipsCode: "46113", tribalLandFlag: true, jurisdictionFlags: ["indian_country", "treaty_area"] },
  { stateCode: "MN", stateName: "Minnesota", county: "Beltrami", fipsCode: "27007", tribalLandFlag: true, jurisdictionFlags: ["indian_country"] },
];

// ── Runner ─────────────────────────────────────────────────────────────────────

async function seed() {
  console.log("[seed] Starting authority directory seed...");

  // Seed matter routing rules
  console.log("[seed] Seeding matter routing rules...");
  for (const rule of MATTER_ROUTING_RULES) {
    try {
      await db.execute(sql`
        INSERT INTO authority_matter_routing (
          matter_type, matter_label, primary_entity_type, oversight_entity_type,
          required_notice_template, escalation_template, legal_flag_group,
          primary_recipient_note, oversight_recipient_note, escalation_path, tribal_law_applicable
        ) VALUES (
          ${rule.matterType},
          ${rule.matterLabel},
          ${rule.primaryEntityType},
          ${rule.oversightEntityType ?? null},
          ${rule.requiredNoticeTemplate ?? null},
          ${rule.escalationTemplate ?? null},
          ${JSON.stringify(rule.legalFlagGroup)}::text[],
          ${rule.primaryRecipientNote ?? null},
          ${rule.oversightRecipientNote ?? null},
          ${rule.escalationPath ?? null},
          ${rule.tribalLawApplicable ?? null}
        )
        ON CONFLICT (matter_type) DO UPDATE SET
          matter_label = EXCLUDED.matter_label,
          primary_entity_type = EXCLUDED.primary_entity_type,
          oversight_entity_type = EXCLUDED.oversight_entity_type,
          required_notice_template = EXCLUDED.required_notice_template,
          escalation_template = EXCLUDED.escalation_template,
          legal_flag_group = EXCLUDED.legal_flag_group,
          primary_recipient_note = EXCLUDED.primary_recipient_note,
          oversight_recipient_note = EXCLUDED.oversight_recipient_note,
          escalation_path = EXCLUDED.escalation_path,
          tribal_law_applicable = EXCLUDED.tribal_law_applicable,
          updated_at = NOW()
      `);
      console.log(`[seed]   ✓ routing: ${rule.matterType}`);
    } catch (e) {
      console.warn(`[seed]   ⚠ routing ${rule.matterType}: ${e}`);
    }
  }

  // Seed legal authority map
  console.log("[seed] Seeding legal authority map...");
  for (const map of LEGAL_AUTHORITY_MAP) {
    try {
      await db.execute(sql`
        INSERT INTO authority_legal_map (
          issue_type, authority_name, federal_authority, state_authority, tribal_authority,
          usc_reference, cfr_reference, case_law_reference, applies_when, warning_or_limit,
          template_language_snippet, review_required
        ) VALUES (
          ${map.issueType}, ${map.authorityName}, ${map.federalAuthority ?? null},
          ${map.stateAuthority ?? null}, ${map.tribalAuthority ?? null},
          ${map.uscReference ?? null}, ${map.cfrReference ?? null},
          ${map.caseLawReference ?? null}, ${map.appliesWhen ?? null},
          ${map.warningOrLimit ?? null}, ${map.templateLanguageSnippet ?? null},
          ${map.reviewRequired}
        )
      `);
      console.log(`[seed]   ✓ legal-map: ${map.issueType}`);
    } catch (e) {
      console.warn(`[seed]   ⚠ legal-map ${map.issueType}: ${e}`);
    }
  }

  // Seed agencies
  console.log("[seed] Seeding core agencies...");
  for (const agency of CALIFORNIA_AGENCIES) {
    try {
      await db.execute(sql`
        INSERT INTO authority_agencies (
          agency_name, agency_type, government_level, state_code, county, city,
          physical_address, website, parent_agency, oversight_agency, confidence_score
        ) VALUES (
          ${agency.agencyName}, ${agency.agencyType}, ${agency.governmentLevel},
          ${agency.stateCode ?? null}, ${(agency as Record<string, unknown>).county as string ?? null},
          ${(agency as Record<string, unknown>).city as string ?? null},
          ${(agency as Record<string, unknown>).physicalAddress as string ?? null},
          ${agency.website ?? null},
          ${(agency as Record<string, unknown>).parentAgency as string ?? null},
          ${(agency as Record<string, unknown>).oversightAgency as string ?? null},
          ${agency.confidenceScore}
        )
        ON CONFLICT DO NOTHING
      `);
      console.log(`[seed]   ✓ agency: ${agency.agencyName}`);
    } catch (e) {
      console.warn(`[seed]   ⚠ agency ${agency.agencyName}: ${e}`);
    }
  }

  // Seed jurisdictions
  console.log("[seed] Seeding core jurisdictions...");
  for (const jur of JURISDICTIONS) {
    try {
      const flagsLiteral = `{${jur.jurisdictionFlags.map(f => `"${f}"`).join(",")}}`;
      await db.execute(
        sql.raw(`
          INSERT INTO authority_jurisdiction (
            state_code, state_name, county, fips_code, tribal_land_flag, jurisdiction_flags
          ) VALUES (
            '${jur.stateCode.replace(/'/g, "''")}',
            '${jur.stateName.replace(/'/g, "''")}',
            ${jur.county ? `'${jur.county.replace(/'/g, "''")}'` : "NULL"},
            ${jur.fipsCode ? `'${jur.fipsCode}'` : "NULL"},
            ${jur.tribalLandFlag},
            '${flagsLiteral}'::text[]
          )
          ON CONFLICT DO NOTHING
        `)
      );
      console.log(`[seed]   ✓ jurisdiction: ${jur.stateCode}/${jur.county}`);
    } catch (e) {
      console.warn(`[seed]   ⚠ jurisdiction ${jur.stateCode}/${jur.county}: ${e}`);
    }
  }

  console.log("[seed] Authority directory seed complete.");
  process.exit(0);
}

seed().catch((err) => {
  console.error("[seed] Fatal:", err);
  process.exit(1);
});
