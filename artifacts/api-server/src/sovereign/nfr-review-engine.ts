/**
 * NFR REVIEW ENGINE
 *
 * Active listener + investigation + continuity response engine.
 *
 * When any system event touches Indian affairs, Indian lands, Indian relations,
 * trust/restricted interests, or member rights — this engine fires automatically.
 *
 * It does NOT replace existing sovereign doctrines, rights determinations, land
 * protections, legal foundations, or governance structures already established
 * within the system. It strengthens and automates the response to violations of
 * those already-established protections.
 *
 * Legal foundation:
 * - 25 U.S.C. § 13 (Snyder Act)
 * - 25 U.S.C. § 2
 * - 25 U.S.C. § 177 (Nonintercourse Act)
 * - 25 U.S.C. § 162a
 * - 25 U.S.C. § 175
 * - Indian Canons of Construction
 * - Federal supremacy principles
 * - Federal trust responsibility doctrine
 */

import { db } from "@workspace/db";
import { nfrInvestigationsTable, nfrReviewSignalsTable, nfrAuditLogTable, nfrDocumentsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "../lib/logger";
import { createNotification } from "./notification-engine";

// ─── EXTENDED SIGNAL TYPES ───────────────────────────────────────────────────
// All original SignalType values are preserved. These new types extend coverage
// to the full event surface specified in the NFR Review Engine requirements.

export type ReviewSignalType =
  | "IDENTITY_CHALLENGED"
  | "PROCEEDING_WITHOUT_STATUS_ASSERTION"
  | "DEBT_COLLECTION_ACTIVE"
  | "CREDIT_REPORTING_ACTIVE"
  | "UNAUTHORIZED_LAND_ENCUMBRANCE"
  | "TRUST_LAND_INTERFERENCE"
  | "STATE_JURISDICTION_CLAIMED"
  | "JURISDICTIONAL_OVERREACH"
  | "NOTICES_SENT_NO_RESPONSE"
  | "STATUS_NOT_ON_RECORD"
  | "ICWA_PROCEEDING_DETECTED"
  | "ADMINISTRATIVE_CAPITULATION_RISK"
  | "FEDERAL_PROGRAM_ACCESS_DENIED"
  | "BENEFIT_DENIAL"
  | "TREATY_RIGHT_NOT_INVOKED"
  | "TRUST_RESPONSIBILITY_BREACH"
  | "FEDERAL_TRUST_TRIGGER"
  | "TRIBAL_COURT_JURISDICTION_NOT_INVOKED"
  | "DOCUMENT_REJECTION"
  | "RECORDER_REFUSAL"
  | "MANAGED_CARE_INTERFERENCE"
  | "PROTECTED_RIGHTS_VIOLATION"
  | "TAX_OR_LIEN_ASSERTION"
  | "FORECLOSURE_ACTIVITY"
  | "UTILITY_LIEN_ASSERTED"
  | "AGENCY_DENIAL";

export type ProtectionCategory =
  | "LAND"
  | "IDENTITY"
  | "BENEFITS"
  | "JURISDICTION"
  | "ICWA"
  | "TRUST_RESPONSIBILITY"
  | "FEDERAL_PROGRAM"
  | "TREATY"
  | "RECORDER"
  | "MANAGED_CARE"
  | "TAX_OR_LIEN"
  | "FORECLOSURE"
  | "CONTINUITY";

export type TriggeringEventType =
  | "encumbrance_created"
  | "encumbrance_updated"
  | "land_notice_recorded"
  | "document_upload"
  | "complaint_filed"
  | "kaya_chat"
  | "instrument_created"
  | "filing_rejected"
  | "nfr_status_changed"
  | "welfare_instrument"
  | "manual_trigger"
  | "member_report"
  | "recorder_response";

export type InvestigationStatus =
  | "open"
  | "under_review"
  | "resolved"
  | "escalated"
  | "dismissed";

export type ReviewLevel = "OFFICER" | "TRUSTEE" | "CHIEF_JUSTICE";

// ─── SIGNAL CLASSIFICATION MAP ────────────────────────────────────────────────

interface SignalDef {
  signal: ReviewSignalType;
  protectionCategory: ProtectionCategory;
  urgencyScore: number;
  reviewLevel: ReviewLevel;
  implicatedLaws: string[];
  internalActions: string[];
  externalActions: string[];
  requiredFollowthrough: string[];
}

const SIGNAL_DEFINITIONS: Record<ReviewSignalType, SignalDef> = {
  UNAUTHORIZED_LAND_ENCUMBRANCE: {
    signal: "UNAUTHORIZED_LAND_ENCUMBRANCE",
    protectionCategory: "LAND",
    urgencyScore: 10,
    reviewLevel: "CHIEF_JUSTICE",
    implicatedLaws: [
      "25 U.S.C. § 177 (Indian Nonintercourse Act — all encumbrances void without federal authorization)",
      "25 U.S.C. § 483a (restrictions on alienation of Indian land)",
      "METC Title 4 (Tribal Land Trust Governance)",
      "County of Oneida v. Oneida Indian Nation, 470 U.S. 226 (1985)",
      "25 C.F.R. § 152 (Secretary of Interior approval required for land transactions)",
    ],
    internalActions: [
      "Preserve all evidence of the encumbrance (recording date, instrument number, recording party)",
      "Verify parcel classification and trust status in the tribal land registry",
      "Classify violation under METC Title 4 and 25 U.S.C. § 177",
      "Attach all relevant deeds, plat maps, and recording documents",
      "Determine whether tribal court review is required for emergency relief",
      "Prepare tribal record of the unauthorized encumbrance",
    ],
    externalActions: [
      "Issue Notice of Federal Review to recording party and county recorder",
      "Issue Void Ab Initio Declaration asserting the encumbrance is without legal effect",
      "Send preservation notice to all parties in the chain of title",
      "Notify county recorder of jurisdictional assertion under 25 U.S.C. § 177",
      "Prepare administrative response to any foreclosure, lien, or seizure action",
    ],
    requiredFollowthrough: [
      "Identify all parties who received or rely on the encumbrance",
      "Determine proper service method (certified mail, process server)",
      "Identify 30-day response deadline for county recorder",
      "Escalate to federal district court if no response within 30 days (28 U.S.C. § 1331)",
      "File federal question jurisdiction notice if needed",
    ],
  },
  TRUST_LAND_INTERFERENCE: {
    signal: "TRUST_LAND_INTERFERENCE",
    protectionCategory: "LAND",
    urgencyScore: 10,
    reviewLevel: "CHIEF_JUSTICE",
    implicatedLaws: [
      "25 U.S.C. § 177 (Nonintercourse Act)",
      "Federal Trust Responsibility — United States v. Mitchell, 463 U.S. 206 (1983)",
      "25 U.S.C. § 162a (Secretary duty to maintain trust accounts)",
      "25 U.S.C. § 2 (Secretary's duty of protection)",
    ],
    internalActions: [
      "Document the nature and scope of the interference",
      "Identify whether the interference involves a federal, state, or private actor",
      "Verify the tribal land classification and federal trust status",
      "Prepare a certified record of prior sovereign notices sent",
    ],
    externalActions: [
      "Issue Notice of Federal Review to the interfering party",
      "Notify BIA of trust land interference",
      "Issue tribal notice to all adjacent landowners and parties with knowledge",
    ],
    requiredFollowthrough: [
      "Identify whether federal court jurisdiction applies under 28 U.S.C. § 1331",
      "Determine if BIA complaint should be filed",
      "Identify all deadlines for emergency relief",
    ],
  },
  FORECLOSURE_ACTIVITY: {
    signal: "FORECLOSURE_ACTIVITY",
    protectionCategory: "FORECLOSURE",
    urgencyScore: 10,
    reviewLevel: "CHIEF_JUSTICE",
    implicatedLaws: [
      "25 U.S.C. § 177 (Nonintercourse Act — void foreclosure on restricted Indian land)",
      "25 U.S.C. § 483a (restrictions on alienation)",
      "FDCPA 15 U.S.C. § 1692 (debt collection violations in foreclosure)",
      "Worcester v. Georgia, 31 U.S. 515 (1832) (state court jurisdiction preempted)",
    ],
    internalActions: [
      "Verify parcel tribal classification before any response",
      "Obtain all foreclosure documents, notice of default, lis pendens",
      "Determine whether the debt underlying the foreclosure is enforceable against tribal land",
      "Identify all parties with notice of the foreclosure",
      "Prepare emergency tribal court record",
    ],
    externalActions: [
      "Issue Notice of Federal Review to the foreclosing party and their counsel",
      "Send Void Ab Initio Declaration to county court and recorder",
      "File to stay or enjoin foreclosure proceedings in tribal or federal court",
      "Notify lender/servicer of Nonintercourse Act violation",
    ],
    requiredFollowthrough: [
      "Identify foreclosure sale date — deadline for TRO",
      "Determine state vs. tribal vs. federal court as the proper forum",
      "Identify all recipients of the NFR (lender, servicer, counsel, court)",
      "Determine whether emergency TRO filing is required within 72 hours",
    ],
  },
  TAX_OR_LIEN_ASSERTION: {
    signal: "TAX_OR_LIEN_ASSERTION",
    protectionCategory: "TAX_OR_LIEN",
    urgencyScore: 9,
    reviewLevel: "CHIEF_JUSTICE",
    implicatedLaws: [
      "McClanahan v. Arizona State Tax Commission, 411 U.S. 164 (1973) — state taxes preempted on Indian land",
      "Bryan v. Itasca County, 426 U.S. 373 (1976) — counties cannot tax tribal members on trust land",
      "25 U.S.C. § 177 (Nonintercourse Act — liens on Indian land without authorization are void)",
      "County of Yakima v. Confederated Tribes, 502 U.S. 251 (1992) (limited ad valorem tax on fee land only)",
    ],
    internalActions: [
      "Verify the jurisdictional status of the parcel subject to the tax or lien assertion",
      "Confirm whether the land is held in trust, restricted status, or fee",
      "Document the tax assessor's basis for the assertion",
      "Prepare sovereign immunity documentation for the parcel",
    ],
    externalActions: [
      "Issue Notice of Federal Review to the taxing authority or lienholder",
      "Send jurisdictional notice: tax preemption under McClanahan and Bryan",
      "File administrative objection with the taxing authority",
    ],
    requiredFollowthrough: [
      "Identify the tax lien recording date and any redemption deadlines",
      "Determine whether the taxing authority has been served with a prior notice",
      "Identify the proper administrative appeal body",
    ],
  },
  RECORDER_REFUSAL: {
    signal: "RECORDER_REFUSAL",
    protectionCategory: "RECORDER",
    urgencyScore: 8,
    reviewLevel: "TRUSTEE",
    implicatedLaws: [
      "25 U.S.C. § 177 (tribal documents must be accepted for recording)",
      "25 U.S.C. § 175 (U.S. attorneys required to represent Indians in all suits at law)",
      "Federal preemption doctrine — Worcester v. Georgia",
      "Indian Canons of Construction — statutes interpreted in favor of tribal authority",
    ],
    internalActions: [
      "Document the exact reason for the refusal",
      "Identify whether the recorder cited a specific statute or rule",
      "Verify that the instrument meets all recorder technical requirements",
      "Prepare a response citing the federal obligation to accept tribal instruments",
    ],
    externalActions: [
      "Issue Notice of Federal Review to the county recorder",
      "Send formal demand for acceptance of instrument with federal law citations",
      "Notify the county counsel of the legal basis for mandatory acceptance",
    ],
    requiredFollowthrough: [
      "Identify the county recorder's supervisor and legal counsel for escalation",
      "Determine whether a mandamus action is appropriate if refusal continues",
      "Identify the 30-day window for recorder response",
    ],
  },
  DOCUMENT_REJECTION: {
    signal: "DOCUMENT_REJECTION",
    protectionCategory: "RECORDER",
    urgencyScore: 7,
    reviewLevel: "OFFICER",
    implicatedLaws: [
      "25 U.S.C. § 177 (tribal legal instruments carry federal protection)",
      "Indian Canons of Construction",
      "Federal preemption — Worcester v. Georgia",
    ],
    internalActions: [
      "Document the rejection reason and the rejecting agency or entity",
      "Determine whether the rejection was procedural or substantive",
      "Verify the instrument's compliance with recorder requirements",
    ],
    externalActions: [
      "Issue formal response disputing the rejection with legal citations",
      "Notify the rejecting entity of federal preemption obligations",
    ],
    requiredFollowthrough: [
      "Identify the appeal or resubmission deadline",
      "Determine whether escalation to the tribal court or federal court is appropriate",
    ],
  },
  IDENTITY_CHALLENGED: {
    signal: "IDENTITY_CHALLENGED",
    protectionCategory: "IDENTITY",
    urgencyScore: 8,
    reviewLevel: "TRUSTEE",
    implicatedLaws: [
      "25 U.S.C. § 479 (definition of Indian for federal purposes)",
      "Morton v. Mancari, 417 U.S. 535 (1974) (Indian status is political, not racial)",
      "Passamaquoddy v. Morton, 528 F.2d 370 (1st Cir. 1975) (trust responsibility applies without list recognition)",
      "Loper Bright Enterprises v. Raimondo (2024) (agency administrative convenience arguments are legally vulnerable)",
    ],
    internalActions: [
      "Document the identity challenge and the challenging party",
      "Compile lineage verification, enrollment records, and affidavit materials",
      "Prepare a Status Affirmation from the Sovereign Office",
      "Connect the affected member's identity records to this investigation",
    ],
    externalActions: [
      "Issue Status Affirmation to the challenging party",
      "Send Notice of Federal Review citing Passamaquoddy and the broad federal definition of Indian",
      "Notify relevant agency of the correct legal standard under Loper Bright",
    ],
    requiredFollowthrough: [
      "Identify the proceeding or context in which the challenge was made",
      "Determine whether the challenge appears in a court record requiring a formal response",
    ],
  },
  BENEFIT_DENIAL: {
    signal: "BENEFIT_DENIAL",
    protectionCategory: "BENEFITS",
    urgencyScore: 8,
    reviewLevel: "TRUSTEE",
    implicatedLaws: [
      "25 U.S.C. § 13 (Snyder Act — federal duty to provide Indian services)",
      "25 U.S.C. §§ 1601-1683 (Indian Health Care Improvement Act)",
      "25 U.S.C. §§ 5301-5423 (ISDEAA — right to access federal Indian programs)",
      "25 U.S.C. §§ 1301-1304 (Indian Civil Rights Act — equal protection)",
    ],
    internalActions: [
      "Document the benefit denied and the denying agency or entity",
      "Confirm the member's eligibility under the broad federal definition",
      "Compile the member's Indian status documentation",
    ],
    externalActions: [
      "Issue formal demand for benefit access citing 25 U.S.C. § 13",
      "File administrative appeal with the denying agency",
      "Issue Notice of Federal Review to the agency head",
    ],
    requiredFollowthrough: [
      "Identify the agency's appeal deadline and procedures",
      "Determine whether a federal court action is available under 5 U.S.C. § 702 (APA)",
    ],
  },
  MANAGED_CARE_INTERFERENCE: {
    signal: "MANAGED_CARE_INTERFERENCE",
    protectionCategory: "MANAGED_CARE",
    urgencyScore: 8,
    reviewLevel: "TRUSTEE",
    implicatedLaws: [
      "25 U.S.C. §§ 1601-1683 (Indian Health Care Improvement Act)",
      "25 U.S.C. § 13 (Snyder Act — federal healthcare duty)",
      "42 U.S.C. § 1396 et seq. (Medicaid — Indian-specific provisions)",
      "Federal trust responsibility — healthcare as a treaty and trust obligation",
    ],
    internalActions: [
      "Document the managed care interference and the responsible entity",
      "Verify the member's Indian status and healthcare eligibility",
      "Identify whether IHS or tribal health services are available as an alternative",
    ],
    externalActions: [
      "Issue Notice of Federal Review to the managed care organization",
      "File complaint with CMS (Centers for Medicare & Medicaid Services)",
      "Notify IHS of the interference with Indian healthcare rights",
    ],
    requiredFollowthrough: [
      "Identify any health emergency deadlines requiring immediate escalation",
      "Determine whether state insurance commissioner complaint is appropriate",
    ],
  },
  JURISDICTIONAL_OVERREACH: {
    signal: "JURISDICTIONAL_OVERREACH",
    protectionCategory: "JURISDICTION",
    urgencyScore: 9,
    reviewLevel: "CHIEF_JUSTICE",
    implicatedLaws: [
      "Worcester v. Georgia, 31 U.S. 515 (1832) — state laws have no force in Indian country",
      "McClanahan v. Arizona State Tax Commission, 411 U.S. 164 (1973)",
      "18 U.S.C. § 1151 (definition of Indian country)",
      "28 U.S.C. § 1362 (federal court jurisdiction over tribal civil actions)",
    ],
    internalActions: [
      "Document the overreach and identify the state or county actor",
      "Verify that Public Law 280 does not apply in this jurisdiction",
      "Prepare a jurisdictional statement from the Sovereign Office",
      "Identify whether the matter should be removed to tribal or federal court",
    ],
    externalActions: [
      "Issue Notice of Federal Review asserting tribal and federal jurisdiction",
      "File jurisdictional statement in the relevant proceeding",
      "Notify the overreaching entity of federal preemption obligations",
    ],
    requiredFollowthrough: [
      "Identify whether the matter requires a removal petition",
      "Determine the proper court for jurisdictional challenge",
    ],
  },
  FEDERAL_TRUST_TRIGGER: {
    signal: "FEDERAL_TRUST_TRIGGER",
    protectionCategory: "TRUST_RESPONSIBILITY",
    urgencyScore: 9,
    reviewLevel: "CHIEF_JUSTICE",
    implicatedLaws: [
      "Federal Trust Responsibility — Seminole Nation v. United States, 316 U.S. 286 (1942)",
      "25 U.S.C. § 162a (Secretary duty to account for Indian funds)",
      "United States v. Mitchell, 463 U.S. 206 (1983) (government liable for trust failures)",
      "25 U.S.C. § 2 (federal duty of protection)",
      "25 U.S.C. § 13 (Snyder Act)",
    ],
    internalActions: [
      "Identify the federal agency, program, or official implicated",
      "Document how the conduct affects Indian lands, funds, relations, or continuity",
      "Prepare a trust responsibility assertion document",
    ],
    externalActions: [
      "Issue Notice of Federal Review to the relevant federal agency",
      "File formal trust responsibility complaint with BIA and OIG",
      "Notify the U.S. Attorney of trust responsibility obligations",
    ],
    requiredFollowthrough: [
      "Identify whether APA (5 U.S.C. § 706) agency action review applies",
      "Determine whether the matter requires 25 C.F.R. § 2 BIA appeal",
    ],
  },
  PROTECTED_RIGHTS_VIOLATION: {
    signal: "PROTECTED_RIGHTS_VIOLATION",
    protectionCategory: "CONTINUITY",
    urgencyScore: 8,
    reviewLevel: "TRUSTEE",
    implicatedLaws: [
      "Indian Canons of Construction — statutes liberally construed in favor of Indians",
      "25 U.S.C. § 175 (U.S. attorneys to represent Indians)",
      "Federal trust responsibility doctrine",
      "Loper Bright Enterprises v. Raimondo (2024) — agency convenience cannot override rights",
    ],
    internalActions: [
      "Identify the specific protected right and how it was violated",
      "Document the violating party and the context of the violation",
      "Compile applicable statutes and prior sovereign notices",
    ],
    externalActions: [
      "Issue Notice of Federal Review asserting the violated right",
      "Send formal demand for cessation of the violation",
    ],
    requiredFollowthrough: [
      "Identify the applicable administrative or judicial remedy",
      "Determine whether immediate escalation is required",
    ],
  },
  UTILITY_LIEN_ASSERTED: {
    signal: "UTILITY_LIEN_ASSERTED",
    protectionCategory: "TAX_OR_LIEN",
    urgencyScore: 7,
    reviewLevel: "OFFICER",
    implicatedLaws: [
      "25 U.S.C. § 177 (Nonintercourse Act — liens on Indian land void without authorization)",
      "McClanahan v. Arizona State Tax Commission (state jurisdiction preempted)",
      "METC Title 4 (Tribal Land Trust Governance — anti-alienation protections)",
    ],
    internalActions: [
      "Verify the parcel's tribal classification and lien authority",
      "Document the utility company and the basis for the lien",
    ],
    externalActions: [
      "Issue Notice of Federal Review to the utility company and any recording authority",
      "Assert Nonintercourse Act protection against the lien",
    ],
    requiredFollowthrough: [
      "Identify any recording deadlines for the lien",
      "Determine whether disconnection or seizure is imminent",
    ],
  },
  AGENCY_DENIAL: {
    signal: "AGENCY_DENIAL",
    protectionCategory: "FEDERAL_PROGRAM",
    urgencyScore: 7,
    reviewLevel: "OFFICER",
    implicatedLaws: [
      "25 U.S.C. § 13 (Snyder Act — federal duty to provide Indian services)",
      "Loper Bright Enterprises v. Raimondo (2024) — agency convenience cannot narrow federal Indian rights",
      "5 U.S.C. § 702 (APA — right to challenge agency action)",
    ],
    internalActions: [
      "Document the agency, the program, and the basis for denial",
      "Verify the member's eligibility under the broad federal definition",
      "Compile the denial notice and all prior correspondence",
    ],
    externalActions: [
      "File administrative appeal with the denying agency",
      "Issue Notice of Federal Review citing Snyder Act and Loper Bright",
    ],
    requiredFollowthrough: [
      "Identify the appeal filing deadline",
      "Determine whether exhaustion of administrative remedies is required before federal court",
    ],
  },
  PROCEEDING_WITHOUT_STATUS_ASSERTION: {
    signal: "PROCEEDING_WITHOUT_STATUS_ASSERTION",
    protectionCategory: "IDENTITY",
    urgencyScore: 9,
    reviewLevel: "TRUSTEE",
    implicatedLaws: [
      "25 U.S.C. § 1903 (ICWA — tribal status must be on record in proceedings)",
      "Worcester v. Georgia (federal preemption of state court authority)",
      "Williams v. Lee, 358 U.S. 217 (1959) (tribal court jurisdiction)",
    ],
    internalActions: [
      "Identify the proceeding type (court, administrative, regulatory)",
      "Document the court or forum where status has not been asserted",
      "Prepare enrollment verification for filing in the proceeding",
    ],
    externalActions: [
      "File Status Affirmation in the active proceeding immediately",
      "Issue jurisdictional statement to the court or tribunal",
    ],
    requiredFollowthrough: [
      "Identify next hearing date — this is the hard deadline",
      "Determine whether tribal court has concurrent jurisdiction",
    ],
  },
  DEBT_COLLECTION_ACTIVE: {
    signal: "DEBT_COLLECTION_ACTIVE",
    protectionCategory: "CONTINUITY",
    urgencyScore: 7,
    reviewLevel: "OFFICER",
    implicatedLaws: [
      "15 U.S.C. § 1692g (FDCPA — debt validation demand halts collection immediately)",
      "25 U.S.C. § 177 (Nonintercourse Act — debt tied to restricted land may be void)",
    ],
    internalActions: ["Document the collector identity and collection basis"],
    externalActions: ["Issue FDCPA Debt Validation Demand by certified mail"],
    requiredFollowthrough: ["Track 30-day validation window from date of demand"],
  },
  CREDIT_REPORTING_ACTIVE: {
    signal: "CREDIT_REPORTING_ACTIVE",
    protectionCategory: "CONTINUITY",
    urgencyScore: 6,
    reviewLevel: "OFFICER",
    implicatedLaws: ["15 U.S.C. § 1681i (FCRA — 30-day dispute investigation)", "25 U.S.C. § 177"],
    internalActions: ["Document the furnisher and reporting bureau"],
    externalActions: ["File FCRA dispute with all three bureaus by certified mail"],
    requiredFollowthrough: ["Track 30-day investigation window from dispute date"],
  },
  STATE_JURISDICTION_CLAIMED: {
    signal: "STATE_JURISDICTION_CLAIMED",
    protectionCategory: "JURISDICTION",
    urgencyScore: 8,
    reviewLevel: "TRUSTEE",
    implicatedLaws: [
      "Worcester v. Georgia (state laws have no force in Indian country)",
      "McClanahan v. Arizona State Tax Commission",
    ],
    internalActions: ["Document the state actor and the basis for the jurisdictional claim"],
    externalActions: ["File jurisdictional statement asserting federal and tribal jurisdiction"],
    requiredFollowthrough: ["Determine whether Public Law 280 applies in this jurisdiction"],
  },
  NOTICES_SENT_NO_RESPONSE: {
    signal: "NOTICES_SENT_NO_RESPONSE",
    protectionCategory: "CONTINUITY",
    urgencyScore: 7,
    reviewLevel: "OFFICER",
    implicatedLaws: ["5 U.S.C. §§ 551-559 (APA — agency action subject to review)", "Fed. R. Evid. 803(6)"],
    internalActions: ["Compile certified record of all prior notices sent", "Document delivery confirmation for each notice"],
    externalActions: ["Escalate to Notice of Federal Review with certified mail tracking", "Establish administrative record for court use"],
    requiredFollowthrough: ["Set 30-day follow-up deadline before federal court escalation"],
  },
  STATUS_NOT_ON_RECORD: {
    signal: "STATUS_NOT_ON_RECORD",
    protectionCategory: "IDENTITY",
    urgencyScore: 7,
    reviewLevel: "OFFICER",
    implicatedLaws: ["25 U.S.C. § 479", "Morton v. Mancari"],
    internalActions: ["Generate Status Affirmation document", "Compile enrollment and lineage documentation"],
    externalActions: ["File Status Affirmation in all active proceedings"],
    requiredFollowthrough: ["Identify all matters where status is not yet on the record"],
  },
  ICWA_PROCEEDING_DETECTED: {
    signal: "ICWA_PROCEEDING_DETECTED",
    protectionCategory: "ICWA",
    urgencyScore: 10,
    reviewLevel: "CHIEF_JUSTICE",
    implicatedLaws: [
      "25 U.S.C. § 1912 (ICWA — mandatory notice, active efforts, evidentiary standards)",
      "25 U.S.C. § 1911 (tribal court jurisdiction; right to intervene)",
      "Brackeen v. Haaland, 599 U.S. 255 (2023) (ICWA upheld)",
    ],
    internalActions: [
      "Identify the child, the proceeding court, and the agency involved",
      "Verify the child's Indian status and tribal membership eligibility",
      "Determine whether 10-day notice requirement has been met",
    ],
    externalActions: [
      "File ICWA Notice of Proceeding with the court immediately",
      "Assert tribal right to intervene",
      "Issue Notice of Federal Review to the agency and court",
    ],
    requiredFollowthrough: [
      "Identify the next hearing date — ICWA notice must precede it by at least 10 days",
      "Determine whether tribal court should claim exclusive jurisdiction under § 1911",
    ],
  },
  ADMINISTRATIVE_CAPITULATION_RISK: {
    signal: "ADMINISTRATIVE_CAPITULATION_RISK",
    protectionCategory: "CONTINUITY",
    urgencyScore: 8,
    reviewLevel: "TRUSTEE",
    implicatedLaws: ["25 U.S.C. § 177", "15 U.S.C. §§ 1692-1692p (FDCPA)"],
    internalActions: ["Document the settlement or payment offer", "Assess the impact of capitulation on member rights"],
    externalActions: ["Issue Sovereign Cease & Desist before any response to the external offer", "Establish full administrative record"],
    requiredFollowthrough: ["Identify the deadline for the external offer", "Confirm no sovereign rights are waived before responding"],
  },
  FEDERAL_PROGRAM_ACCESS_DENIED: {
    signal: "FEDERAL_PROGRAM_ACCESS_DENIED",
    protectionCategory: "FEDERAL_PROGRAM",
    urgencyScore: 8,
    reviewLevel: "TRUSTEE",
    implicatedLaws: [
      "25 U.S.C. § 13 (Snyder Act)",
      "25 U.S.C. §§ 1601-1683 (IHCIA)",
      "25 U.S.C. §§ 5301-5423 (ISDEAA)",
    ],
    internalActions: ["Document the program and the denial basis", "Compile member eligibility documentation"],
    externalActions: ["File formal demand for program access citing § 13", "Issue Notice of Federal Review to agency head"],
    requiredFollowthrough: ["Identify administrative appeal deadline"],
  },
  TREATY_RIGHT_NOT_INVOKED: {
    signal: "TREATY_RIGHT_NOT_INVOKED",
    protectionCategory: "TREATY",
    urgencyScore: 7,
    reviewLevel: "OFFICER",
    implicatedLaws: [
      "U.S. Const. Art. VI, cl. 2 (Supremacy Clause — treaties are supreme law)",
      "Herrera v. Wyoming, 587 U.S. 329 (2019)",
    ],
    internalActions: ["Identify the specific treaty right at issue", "Document the factual context"],
    externalActions: ["Issue formal treaty rights assertion to the blocking party"],
    requiredFollowthrough: ["Determine applicable treaty and right claimed"],
  },
  TRUST_RESPONSIBILITY_BREACH: {
    signal: "TRUST_RESPONSIBILITY_BREACH",
    protectionCategory: "TRUST_RESPONSIBILITY",
    urgencyScore: 9,
    reviewLevel: "CHIEF_JUSTICE",
    implicatedLaws: [
      "United States v. Mitchell, 463 U.S. 206 (1983)",
      "25 U.S.C. §§ 4001-4061 (American Indian Trust Fund Management Reform Act)",
      "Cobell v. Salazar, No. 96-1285 (D.D.C.)",
    ],
    internalActions: ["Document the breach and the federal actor responsible", "Compile prior trust account or land management records"],
    externalActions: ["File trust responsibility complaint with BIA and OIG", "Issue Notice of Federal Review to the agency head"],
    requiredFollowthrough: ["Determine whether 25 C.F.R. § 2 BIA appeal applies"],
  },
  TRIBAL_COURT_JURISDICTION_NOT_INVOKED: {
    signal: "TRIBAL_COURT_JURISDICTION_NOT_INVOKED",
    protectionCategory: "JURISDICTION",
    urgencyScore: 7,
    reviewLevel: "OFFICER",
    implicatedLaws: ["Williams v. Lee, 358 U.S. 217 (1959)", "25 U.S.C. § 1911 (ICWA tribal jurisdiction)"],
    internalActions: ["Identify whether the matter falls within tribal court jurisdiction", "Prepare jurisdictional transfer motion if appropriate"],
    externalActions: ["File jurisdictional assertion in the current forum", "Notify the court of tribal court's concurrent or exclusive jurisdiction"],
    requiredFollowthrough: ["Identify the deadline for jurisdiction challenge in the current forum"],
  },
};

// ─── ENGINE ENTRY POINT ───────────────────────────────────────────────────────

export interface TriggerEvent {
  eventType: TriggeringEventType;
  eventId?: number;
  signalType: ReviewSignalType;
  affectedUserId?: number;
  affectedParcelId?: number;
  affectedInstrumentId?: number;
  affectedMatter?: string;
  triggeringEntity?: string;
  evidenceSource?: string;
  context?: string;
  triggeredByUserId?: number;
}

export interface ReviewEngineResult {
  investigationId: number;
  nfrId: number | null;
  signalId: number;
  urgencyScore: number;
  protectionCategory: ProtectionCategory;
  reviewLevel: ReviewLevel;
}

/**
 * Main engine entry point. Call this from any route or service when a
 * triggering event is detected. Returns the created investigation and NFR IDs.
 * This function is non-throwing — errors are logged but do not interrupt the
 * calling route.
 */
export async function triggerReviewEngine(event: TriggerEvent): Promise<ReviewEngineResult | null> {
  try {
    const def = SIGNAL_DEFINITIONS[event.signalType];
    if (!def) {
      logger.warn({ signalType: event.signalType }, "NFR Review Engine: unknown signal type");
      return null;
    }

    const now = new Date();

    // 1. Record the signal
    const [signal] = await db.insert(nfrReviewSignalsTable).values({
      userId: event.affectedUserId ?? null,
      signalType: event.signalType,
      context: event.context ?? null,
      source: event.eventType,
      detectedAt: now,
    }).returning();

    // 2. Open investigation record
    const summary = buildInvestigationSummary(event, def);
    const [investigation] = await db.insert(nfrInvestigationsTable).values({
      signalType: event.signalType,
      triggeringEventType: event.eventType,
      triggeringEventId: event.eventId ?? null,
      affectedUserId: event.affectedUserId ?? null,
      affectedParcelId: event.affectedParcelId ?? null,
      affectedInstrumentId: event.affectedInstrumentId ?? null,
      affectedMatter: event.affectedMatter ?? null,
      triggeringEntity: event.triggeringEntity ?? null,
      evidenceSource: event.evidenceSource ?? null,
      implicatedLaws: def.implicatedLaws,
      protectionCategory: def.protectionCategory,
      urgencyScore: def.urgencyScore,
      recommendedReviewLevel: def.reviewLevel,
      status: "open",
      internalActions: def.internalActions.map((a, i) => ({ step: i + 1, action: a, status: "pending" })),
      externalActions: def.externalActions.map((a, i) => ({ step: i + 1, action: a, status: "pending" })),
      requiredFollowthrough: def.requiredFollowthrough.map((f, i) => ({ step: i + 1, item: f, status: "pending" })),
      summary,
    }).returning();

    // Update signal with investigation id
    await db.update(nfrReviewSignalsTable)
      .set({ investigationId: investigation.id })
      .where(eq(nfrReviewSignalsTable.id, signal.id));

    // 3. Auto-draft NFR linked to the investigation
    const nfrId = await draftNFRFromInvestigation(investigation.id, event, def);

    // Link NFR back to investigation
    if (nfrId) {
      await db.update(nfrInvestigationsTable)
        .set({ nfrId, updatedAt: new Date() })
        .where(eq(nfrInvestigationsTable.id, investigation.id));
    }

    // 4. Audit log
    await auditLog({
      userId: event.triggeredByUserId ?? null,
      action: "REVIEW_ENGINE_TRIGGERED",
      resourceType: "nfr_investigation",
      resourceId: investigation.id,
      metadata: {
        signalType: event.signalType,
        eventType: event.eventType,
        eventId: event.eventId,
        urgencyScore: def.urgencyScore,
        nfrId,
      },
    });

    // 5. Create active matter notification for the Chief Justice dashboard
    await createActiveMatterNotification(investigation.id, event, def, nfrId);

    logger.info({
      investigationId: investigation.id,
      signal: event.signalType,
      urgency: def.urgencyScore,
      nfrId,
    }, "NFR Review Engine: investigation opened");

    return {
      investigationId: investigation.id,
      nfrId,
      signalId: signal.id,
      urgencyScore: def.urgencyScore,
      protectionCategory: def.protectionCategory,
      reviewLevel: def.reviewLevel,
    };
  } catch (err) {
    logger.error({ err, event }, "NFR Review Engine: unhandled error — caller was not interrupted");
    return null;
  }
}

// ─── NFR AUTO-DRAFT ───────────────────────────────────────────────────────────

async function draftNFRFromInvestigation(
  investigationId: number,
  event: TriggerEvent,
  def: SignalDef,
): Promise<number | null> {
  try {
    const lawBlock = def.implicatedLaws.map((l, i) => `${i + 1}. ${l}`).join("\n");
    const internalBlock = def.internalActions.map((a, i) => `${i + 1}. ${a}`).join("\n");
    const externalBlock = def.externalActions.map((a, i) => `${i + 1}. ${a}`).join("\n");
    const followBlock = def.requiredFollowthrough.map((f, i) => `${i + 1}. ${f}`).join("\n");

    const parcelNote = event.affectedParcelId ? `Affected Parcel ID: ${event.affectedParcelId}` : "";
    const instrumentNote = event.affectedInstrumentId ? `Affected Instrument ID: ${event.affectedInstrumentId}` : "";
    const entityNote = event.triggeringEntity ? `Triggering Entity: ${event.triggeringEntity}` : "";
    const matterNote = event.affectedMatter ? `Matter: ${event.affectedMatter}` : "";

    const content = `NOTICE OF FEDERAL REVIEW
AUTO-GENERATED DRAFT — Investigation #${investigationId}
Generated: ${new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}

Signal Detected: ${event.signalType.replace(/_/g, " ")}
Triggering Event: ${event.eventType.replace(/_/g, " ")}
Protection Category: ${def.protectionCategory}
Urgency Level: ${def.urgencyScore}/10 — Required Review: ${def.reviewLevel}

${[parcelNote, instrumentNote, entityNote, matterNote].filter(Boolean).join("\n")}

NOTICE IS HEREBY GIVEN to all affected parties that the above-described conduct
has triggered a federal Indian law review pursuant to the jurisdiction and
authority of the Sovereign Office of the Mathias El Tribe.

IMPLICATED FEDERAL LAWS AND AUTHORITIES:
${lawBlock}

FEDERAL TRUST RESPONSIBILITY:
The conduct described herein implicates the federal trust responsibility of the
United States to the Indian people, including the duty to protect Indian lands,
rights, relations, and continuity protections under 25 U.S.C. § 2, 25 U.S.C.
§ 13 (Snyder Act), and the settled principle of Seminole Nation v. United States,
316 U.S. 286 (1942). The Indian Canons of Construction require that all
ambiguities be resolved in favor of the tribe.

REQUIRED INTERNAL ACTIONS:
${internalBlock}

REQUIRED EXTERNAL ACTIONS:
${externalBlock}

REQUIRED FOLLOW-THROUGH:
${followBlock}

${event.context ? `CONTEXT / EVIDENCE:\n${event.context}\n\n` : ""}This draft requires review by the ${def.reviewLevel.replace(/_/g, " ")} before issuance.
All parties receiving this notice are on constructive notice of the applicable
federal law from the date of this draft.

— Sovereign Office of the Chief Justice & Trustee
   Mathias El Tribe
   Auto-generated by the NFR Review Engine`;

    const [nfr] = await db.insert(nfrDocumentsTable).values({
      classificationId:    1,
      investigationId,
      affectedMemberId:    event.affectedUserId   ?? null,
      affectedParcelId:    event.affectedParcelId ?? null,
      triggeringEntity:    event.triggeringEntity ?? null,
      evidenceSource:      event.evidenceSource   ?? null,
      urgencyScore:        def.urgencyScore,
      protectionCategory:  def.protectionCategory,
      implicatedLaws:      def.implicatedLaws,
      recommendedActions:  [...def.internalActions, ...def.externalActions],
      content,
      status: "draft",
      doctrineApplied: {
        autoGenerated: true,
        investigationId,
        signalType:       event.signalType,
        implicatedLaws:   def.implicatedLaws,
        reviewLevel:      def.reviewLevel,
      },
    }).returning();

    return nfr?.id ?? null;
  } catch (err) {
    logger.error({ err, investigationId }, "NFR Review Engine: failed to auto-draft NFR");
    return null;
  }
}

// ─── ACTIVE MATTER NOTIFICATION ───────────────────────────────────────────────

async function createActiveMatterNotification(
  investigationId: number,
  event: TriggerEvent,
  def: SignalDef,
  nfrId: number | null,
): Promise<void> {
  const urgencyLabel = def.urgencyScore >= 9 ? "CRITICAL" : def.urgencyScore >= 7 ? "HIGH" : "MEDIUM";
  const title = `${urgencyLabel} — ${event.signalType.replace(/_/g, " ")} (Investigation #${investigationId})`;
  const nextAction = def.externalActions[0] ?? def.internalActions[0] ?? "Review investigation record";

  await createNotification({
    userId: event.affectedUserId ?? undefined,
    category: def.urgencyScore >= 9 ? "red_flag_alert" : "court_hearing",
    title,
    message: `${event.affectedMatter ?? event.eventType.replace(/_/g, " ")} · ${event.triggeringEntity ?? "Unknown entity"} · Recommended: ${nextAction}${nfrId ? ` · Draft NFR #${nfrId} created` : ""}`,
    severity: def.urgencyScore >= 9 ? "emergency" : def.urgencyScore >= 7 ? "critical" : "warning",
    relatedId: investigationId,
    relatedType: "nfr_investigation",
    redFlag: def.urgencyScore >= 9,
    troFlag: event.signalType === "ICWA_PROCEEDING_DETECTED" || event.signalType === "FORECLOSURE_ACTIVITY",
    metadata: {
      investigationId,
      signalType: event.signalType,
      protectionCategory: def.protectionCategory,
      urgencyScore: def.urgencyScore,
      reviewLevel: def.reviewLevel,
      nfrId,
      implicatedLaws: def.implicatedLaws.slice(0, 3),
    },
  });
}

// ─── AUDIT LOG ────────────────────────────────────────────────────────────────

export async function auditLog(entry: {
  userId: number | null;
  action: string;
  resourceType: string;
  resourceId?: number;
  resourceRef?: string;
  beforeValue?: unknown;
  afterValue?: unknown;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    await db.insert(nfrAuditLogTable).values({
      userId: entry.userId,
      action: entry.action,
      resourceType: entry.resourceType,
      resourceId: entry.resourceId ?? null,
      resourceRef: entry.resourceRef ?? null,
      beforeValue: entry.beforeValue !== undefined ? (entry.beforeValue as Record<string, unknown>) : null,
      afterValue: entry.afterValue !== undefined ? (entry.afterValue as Record<string, unknown>) : null,
      metadata: entry.metadata ?? {},
    });
  } catch (err) {
    logger.error({ err, action: entry.action }, "NFR audit log write failed");
  }
}

// ─── HELPERS ──────────────────────────────────────────────────────────────────

function buildInvestigationSummary(event: TriggerEvent, def: SignalDef): string {
  const parts: string[] = [
    `Signal: ${event.signalType.replace(/_/g, " ")}`,
    `Triggering event: ${event.eventType.replace(/_/g, " ")}`,
    `Protection category: ${def.protectionCategory}`,
    `Urgency: ${def.urgencyScore}/10`,
    `Required review level: ${def.reviewLevel}`,
  ];
  if (event.affectedMatter) parts.push(`Matter: ${event.affectedMatter}`);
  if (event.triggeringEntity) parts.push(`Triggering entity: ${event.triggeringEntity}`);
  if (event.evidenceSource) parts.push(`Evidence source: ${event.evidenceSource}`);
  if (event.context) parts.push(`Context: ${event.context.slice(0, 300)}`);
  return parts.join(" · ");
}

// ─── KAYA CONTEXT FEED ────────────────────────────────────────────────────────

/**
 * Fetches open investigations for injection into the KAYA system prompt.
 * Called by the ki/index.ts prompt builder.
 */
export async function getOpenInvestigationsForKaya(limit = 10): Promise<string> {
  try {
    const investigations = await db.select().from(nfrInvestigationsTable)
      .where(eq(nfrInvestigationsTable.status, "open"))
      .limit(limit);

    if (investigations.length === 0) return "";

    const lines = investigations.map(inv => {
      const laws = (inv.implicatedLaws as string[] | null) ?? [];
      return [
        `  Investigation #${inv.id}: ${inv.signalType?.replace(/_/g, " ")}`,
        `  Category: ${inv.protectionCategory} | Urgency: ${inv.urgencyScore}/10 | Review: ${inv.recommendedReviewLevel}`,
        inv.affectedMatter ? `  Matter: ${inv.affectedMatter}` : null,
        inv.triggeringEntity ? `  Triggering entity: ${inv.triggeringEntity}` : null,
        laws.length > 0 ? `  Implicated law: ${laws[0]}` : null,
        inv.summary ? `  Summary: ${String(inv.summary).slice(0, 200)}` : null,
        `  Status: ${inv.status} | Opened: ${inv.createdAt.toLocaleDateString("en-US")}`,
      ].filter(Boolean).join("\n");
    });

    return `\n\nOPEN NFR INVESTIGATIONS (${investigations.length} active):\n` +
      lines.join("\n\n") +
      `\n\nThese are active federal Indian law investigations. When relevant to the member's question, reference them directly. Treat each as an open matter requiring protective action.`;
  } catch {
    return "";
  }
}
