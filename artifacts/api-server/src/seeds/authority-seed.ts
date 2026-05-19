/**
 * Authority Directory — Seed Data
 *
 * Populates:
 *   - matter_type_routing: routing rules for every supported matter type
 *   - legal_authority_map: federal/tribal legal authority for key issue types
 *   - agency_directory: core California agencies (supplemented by live data ingestion)
 *   - jurisdiction_directory: core California jurisdictions
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
    matterType: "utility_shutoff",
    matterLabel: "Utility Shutoff — Water, Gas, Electric, or Telecom",
    primaryEntityType: "state_utility_regulator",
    oversightEntityType: "state_public_utilities_commission",
    requiredNoticeTemplate: "utility_dispute_notice",
    escalationTemplate: "jurisdictional_enforcement_notice",
    legalFlagGroup: ["utility_rights", "life_safety", "tribal_land"],
    primaryRecipientNote: "File complaint with State PUC; assert tribal immunity if on tribal land",
    oversightRecipientNote: "Notify CA PUC, CPUC General Order 96-B, and tribal energy office",
    escalationPath: "state_puc → administrative_law_judge → federal_FCC_or_FERC",
    tribalLawApplicable: "Tribal utility codes; FCC tribal broadband; FERC jurisdiction over interstate gas",
  },
  {
    matterType: "recorder_refusal",
    matterLabel: "County Recorder Refusal to Record Tribal Document",
    primaryEntityType: "county_recorder",
    oversightEntityType: "state_attorney_general",
    requiredNoticeTemplate: "recorder_refusal_response",
    escalationTemplate: "jurisdictional_enforcement_notice",
    legalFlagGroup: ["trust_land", "federal_approval_required", "recording_rights"],
    primaryRecipientNote: "Issue formal demand to county recorder citing state recording statutes and federal law",
    oversightRecipientNote: "Notify State AG tribal affairs unit and BIA Realty",
    escalationPath: "county_recorder → state_AG → federal_court",
    tribalLawApplicable: "25 U.S.C. § 177; Gov. Code § 27201 et seq. (CA); 25 C.F.R. Part 150",
  },
  {
    matterType: "health_plan_denial",
    matterLabel: "Medi-Cal / Medicare / Indian Health Service Denial",
    primaryEntityType: "health_plan_or_managed_care",
    oversightEntityType: "cms_or_dhcs",
    requiredNoticeTemplate: "health_appeal_notice",
    escalationTemplate: "ihs_referral_demand",
    legalFlagGroup: ["health_rights", "indian_health_service", "medi_cal"],
    primaryRecipientNote: "File administrative appeal with health plan; assert IHS priority right if eligible",
    oversightRecipientNote: "Notify CMS, DHCS, and IHS Area Office as applicable",
    escalationPath: "health_plan_appeal → state_DMHC → CMS → federal_court",
    tribalLawApplicable: "25 U.S.C. §§ 1601–1683 (Indian Health Care Improvement Act); 42 C.F.R. Part 136",
  },
  {
    matterType: "agency_denial",
    matterLabel: "Government Agency Benefits or Services Denial",
    primaryEntityType: "denying_agency",
    oversightEntityType: "federal_or_state_oversight_body",
    requiredNoticeTemplate: "agency_appeal_notice",
    escalationTemplate: "jurisdictional_enforcement_notice",
    legalFlagGroup: ["due_process", "federal_trust", "equal_access"],
    primaryRecipientNote: "File formal administrative appeal within denial notice deadline",
    oversightRecipientNote: "Notify oversight body and BIA if federal benefit is involved",
    escalationPath: "internal_appeal → administrative_law_judge → federal_circuit_court",
    tribalLawApplicable: "5 U.S.C. § 706 (APA); 25 U.S.C. § 5301 (tribal self-determination)",
  },
  {
    matterType: "code_enforcement",
    matterLabel: "Code Enforcement Action on Indian or Tribal Land",
    primaryEntityType: "tribal_government",
    oversightEntityType: "federal_bia",
    requiredNoticeTemplate: "jurisdictional_statement",
    escalationTemplate: "state_prohibition_notice",
    legalFlagGroup: ["tribal_sovereignty", "Indian_country", "state_law_inapplicable"],
    primaryRecipientNote: "Assert tribal jurisdiction — county/city code enforcement does not apply in Indian country",
    oversightRecipientNote: "Notify BIA and tribal council; request federal intervention if needed",
    escalationPath: "tribal_council → BIA → federal_court",
    tribalLawApplicable: "Worcester v. Georgia; 25 U.S.C. § 1301; 18 U.S.C. § 1151 (Indian country definition)",
  },
  {
    matterType: "property_classification",
    matterLabel: "Property Classification Dispute / Private Contractor Under State Authority",
    primaryEntityType: "county_assessor",
    oversightEntityType: "state_board_of_equalization",
    requiredNoticeTemplate: "board_of_review_petition",
    escalationTemplate: "nfr",
    legalFlagGroup: ["trust_land", "property_rights", "state_authority_limits"],
    primaryRecipientNote: "Challenge classification with county assessor citing federal trust status and governing case law",
    oversightRecipientNote: "Notify State Board of Equalization and BIA if trust land is involved",
    escalationPath: "county_assessor → county_board_of_review → state_tax_tribunal → federal_court",
    tribalLawApplicable: "25 U.S.C. § 5108; Bryan v. Itasca County, 426 U.S. 373 (1976)",
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
    issueType: "utility_shutoff",
    authorityName: "Utility Rights on Tribal and Indian Land",
    federalAuthority: "FCC Tribal Broadband Order; FERC jurisdiction; 25 U.S.C. § 5601",
    stateAuthority: "CA Public Utilities Code § 779.1 (CPUC); CPUC General Order 96-B",
    tribalAuthority: "Tribal Utility Authority Code",
    uscReference: "25 U.S.C. § 5601",
    cfrReference: "47 C.F.R. § 54.400 (FCC); 18 C.F.R. § 38 (FERC)",
    caseLawReference: "Pacific Gas & Electric Co. v. State Energy Resources Conservation and Development Comm'n, 461 U.S. 190 (1983)",
    appliesWhen: "Utility shutoff threatened or executed on tribal land or for tribal members asserting immunity",
    warningOrLimit: "Life-safety shutoffs require 48-hour notice minimum. Tribal land may have separate rate authority. File CPUC complaint within 90 days.",
    templateLanguageSnippet: "Pursuant to California Public Utilities Code § 779.1 and CPUC General Order 96-B, we dispute the above-referenced disconnection and demand immediate restoration of service pending resolution of this complaint.",
    reviewRequired: true,
  },
  {
    issueType: "recorder_refusal",
    authorityName: "Recording Rights — Tribal Documents and Trust Land Instruments",
    federalAuthority: "25 U.S.C. § 177; 25 C.F.R. Part 150",
    stateAuthority: "Cal. Gov. Code § 27201 (mandatory recording); Cal. Gov. Code § 27361 (fees)",
    tribalAuthority: "Tribal Recording Ordinance",
    uscReference: "25 U.S.C. §§ 177, 5108",
    cfrReference: "25 C.F.R. Part 150",
    caseLawReference: "United States v. Candelaria, 271 U.S. 432 (1926)",
    appliesWhen: "County recorder refuses to record a tribal deed, trust patent, or Indian land instrument",
    warningOrLimit: "County recorder has a ministerial duty to record properly tendered documents. Refusal may violate Gov. Code § 27201. BIA recording available as alternative.",
    templateLanguageSnippet: "Pursuant to California Government Code § 27201, the County Recorder has a ministerial duty to record the tendered instrument. Refusal to record is contrary to law. We demand immediate recording or a written statement of deficiency within 5 business days.",
    reviewRequired: true,
  },
  {
    issueType: "health_plan_denial",
    authorityName: "Indian Health Care Improvement Act — IHS Priority Rights",
    federalAuthority: "25 U.S.C. §§ 1601–1683 (IHCIA); 42 U.S.C. § 1396 (Medicaid)",
    stateAuthority: "Cal. Welf. & Inst. Code § 14005 (Medi-Cal); DMHC oversight",
    tribalAuthority: "Tribal Health Program Operating Agreement",
    uscReference: "25 U.S.C. § 1623",
    cfrReference: "42 C.F.R. Part 136 (IHS); 42 C.F.R. Part 438 (managed care)",
    caseLawReference: "Ramah Navajo Chapter v. Lujan, 112 F.3d 1455 (10th Cir. 1997)",
    appliesWhen: "Medi-Cal, Medicare, IHS, or managed care plan denies benefits to an Indian or AI/AN individual",
    warningOrLimit: "AI/AN individuals have priority rights to IHS services regardless of other coverage. Medi-Cal cannot make IHS the payer of last resort in violation of 25 U.S.C. § 1623.",
    templateLanguageSnippet: "The above-referenced beneficiary is an American Indian/Alaska Native individual entitled to health services under the Indian Health Care Improvement Act, 25 U.S.C. §§ 1601–1683. Pursuant to 25 U.S.C. § 1623, Medicaid/Medi-Cal may not reduce Indian health benefits.",
    reviewRequired: true,
  },
  {
    issueType: "agency_denial",
    authorityName: "Administrative Procedures Act — Agency Action Review",
    federalAuthority: "5 U.S.C. § 706 (APA); 25 U.S.C. § 5301 (Indian Self-Determination Act)",
    stateAuthority: "Cal. Gov. Code § 11500 et seq. (APA); Cal. Welf. & Inst. Code § 10950 (fair hearing)",
    tribalAuthority: "Tribal administrative codes",
    uscReference: "5 U.S.C. §§ 701–706",
    cfrReference: null,
    caseLawReference: "Loper Bright Enterprises v. Raimondo, 603 U.S. 369 (2024) (overruling Chevron deference); Chevron U.S.A. Inc. v. NRDC, 467 U.S. 837 (1984) (overruled)",
    appliesWhen: "Federal or state agency denies benefits, permit, or program participation",
    warningOrLimit: "Administrative exhaustion required before judicial review. Strict deadlines apply — typically 30–90 days from denial. File administrative appeal immediately.",
    templateLanguageSnippet: "Pursuant to 5 U.S.C. § 706, we appeal the above-referenced agency action as arbitrary, capricious, and contrary to law. We request a fair hearing and the opportunity to present evidence within [deadline] days.",
    reviewRequired: true,
  },
  {
    issueType: "code_enforcement",
    authorityName: "State Code Enforcement Inapplicable in Indian Country",
    federalAuthority: "18 U.S.C. § 1151 (Indian country); 25 U.S.C. § 1301",
    stateAuthority: null,
    tribalAuthority: "Tribal Building and Safety Code",
    uscReference: "18 U.S.C. § 1151",
    cfrReference: null,
    caseLawReference: "Worcester v. Georgia, 31 U.S. 515 (1832); Cabazon Band v. California, 480 U.S. 202 (1987)",
    appliesWhen: "State or county code enforcement action initiated against structure on tribal or Indian land",
    warningOrLimit: "State and county building and safety codes generally do not apply in Indian country. Challenge jurisdiction immediately. Tribal building code controls.",
    templateLanguageSnippet: "The above-referenced property is located within Indian country as defined by 18 U.S.C. § 1151. State and county code enforcement jurisdiction does not extend to Indian country pursuant to Worcester v. Georgia, 31 U.S. 515 (1832).",
    reviewRequired: true,
  },
  {
    issueType: "property_classification",
    authorityName: "Property Classification — Bryan v. Itasca County and Trust Land Exemptions",
    federalAuthority: "25 U.S.C. § 5108; Bryan v. Itasca County, 426 U.S. 373 (1976)",
    stateAuthority: "Cal. Rev. & Tax. Code § 217.1 (tribal property exemption); Cal. Const. Art. XIII § 3(f)",
    tribalAuthority: "Tribal Tax and Property Code",
    uscReference: "25 U.S.C. § 5108",
    cfrReference: "25 C.F.R. Part 162 (leasehold interests)",
    caseLawReference: "Bryan v. Itasca County, 426 U.S. 373 (1976); Cass County v. Leech Lake Band, 524 U.S. 103 (1998)",
    appliesWhen: "County assessor classifies tribal or trust property as taxable, or private contractor assertion under state authority over tribal land",
    warningOrLimit: "Trust land exempt from state and county property taxation. Bryan v. Itasca County bars state taxation on reservations absent express congressional authorization.",
    templateLanguageSnippet: "Pursuant to Bryan v. Itasca County, 426 U.S. 373 (1976), and 25 U.S.C. § 5108, the above-referenced property held in trust is exempt from state and county taxation. The current classification is improper and must be corrected.",
    reviewRequired: true,
  },
  {
    issueType: "tax_assessment",
    authorityName: "IRS — Federal Tax Obligations and Tribal Exemptions",
    federalAuthority: "26 U.S.C. § 7871 (tribal governments treated as states); 26 U.S.C. § 139E (general welfare exclusion)",
    stateAuthority: "Cal. Rev. & Tax. Code § 17131.8 (CA general welfare exclusion)",
    tribalAuthority: "Tribal Tax Ordinance",
    uscReference: "26 U.S.C. §§ 7871, 139E",
    cfrReference: "26 C.F.R. § 1.61-1 (gross income); Rev. Rul. 2009-22 (general welfare)",
    caseLawReference: "Squire v. Capoeman, 351 U.S. 1 (1956); Chickasaw Nation v. United States, 534 U.S. 84 (2001)",
    appliesWhen: "IRS or state FTB asserts income or property tax obligation against tribal member income derived from Indian country",
    warningOrLimit: "Income derived by tribal members from activities on their own reservation is generally exempt from federal income tax. Trust allotment income exempt under Squire v. Capoeman.",
    templateLanguageSnippet: "Pursuant to Squire v. Capoeman, 351 U.S. 1 (1956), income derived by an enrolled member of a federally recognized Indian tribe from trust allotment land is exempt from federal income taxation.",
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
        INSERT INTO matter_type_routing (
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
        INSERT INTO legal_authority_map (
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
        INSERT INTO agency_directory (
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
          INSERT INTO jurisdiction_directory (
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
