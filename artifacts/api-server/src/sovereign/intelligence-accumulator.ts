/**
 * STATUS & IDENTITY INTELLIGENCE ACCUMULATOR
 *
 * Runs in the background after every interaction. Extracts status, identity,
 * and tribal-law signals from member messages, builds a living intelligence
 * picture, and produces a priority-ordered action queue grounded in the specific
 * federal statutes, treaty provisions, and case law that govern tribal nations.
 *
 * The system is not just reacting — it is watching, learning the situation,
 * and knowing what must happen, under which law, and when.
 */

import { db } from "@workspace/db";
import { kiConversationsTable } from "@workspace/db";
import { and, eq, desc } from "drizzle-orm";
import { logger } from "../lib/logger";

// ─── TYPES ────────────────────────────────────────────────────────────────────

export type SignalType =
  | "IDENTITY_CHALLENGED"
  | "PROCEEDING_WITHOUT_STATUS_ASSERTION"
  | "DEBT_COLLECTION_ACTIVE"
  | "CREDIT_REPORTING_ACTIVE"
  | "UNAUTHORIZED_LAND_ENCUMBRANCE"
  | "STATE_JURISDICTION_CLAIMED"
  | "NOTICES_SENT_NO_RESPONSE"
  | "STATUS_NOT_ON_RECORD"
  | "ICWA_PROCEEDING_DETECTED"
  | "ADMINISTRATIVE_CAPITULATION_RISK"
  | "FEDERAL_PROGRAM_ACCESS_DENIED"
  | "TREATY_RIGHT_NOT_INVOKED"
  | "TRUST_RESPONSIBILITY_BREACH"
  | "TRIBAL_COURT_JURISDICTION_NOT_INVOKED";

export type ActionPriority = "IMMEDIATE" | "THIS_WEEK" | "THIS_MONTH";
export type ActionStatus = "pending" | "suggested" | "taken" | "dismissed";

export type ActionCode =
  | "GENERATE_STATUS_AFFIRMATION"
  | "FILE_ENROLLMENT_VERIFICATION"
  | "SEND_DEBT_VALIDATION_DEMAND"
  | "FILE_CREDIT_DISPUTE"
  | "ISSUE_NFR"
  | "FILE_JURISDICTIONAL_STATEMENT"
  | "ESTABLISH_ADMINISTRATIVE_RECORD"
  | "FILE_ICWA_NOTICE"
  | "ASSERT_SOVEREIGN_IDENTITY"
  | "ISSUE_CEASE_DESIST"
  | "INVOKE_FEDERAL_PROGRAM_RIGHTS"
  | "ASSERT_TREATY_RIGHTS"
  | "FILE_TRUST_RESPONSIBILITY_COMPLAINT";

export interface ActionItem {
  action: ActionCode;
  label: string;
  priority: ActionPriority;
  rationale: string;
  lawCitations: string[];
  triggeredBy: SignalType[];
  deadline?: string;
  status: ActionStatus;
  detectedAt: string;
  lastSeenAt: string;
  occurrenceCount: number;
}

export interface StatusSignal {
  type: SignalType;
  detectedAt: string;
  lastSeenAt: string;
  occurrenceCount: number;
  context: string;
}

export interface MemberIntelligencePicture {
  userId: number;
  updatedAt: string;
  signals: StatusSignal[];
  actionQueue: ActionItem[];
  summaryForCompanion: string;
}

// ─── SIGNAL EXTRACTION RULES ─────────────────────────────────────────────────

interface SignalRule {
  type: SignalType;
  patterns: RegExp[];
  negativePatterns: RegExp[];
}

const SIGNAL_RULES: SignalRule[] = [
  {
    type: "IDENTITY_CHALLENGED",
    patterns: [
      /they\s+(say|claim|assert|argue|allege|told\s+me).{0,40}(I'?m\s+not|I\s+am\s+not|not\s+really|we'?re\s+not)\s+(Indian|Native|tribal|indigenous|enrolled|member)/i,
      /question(ing)?.{0,20}(my|our).{0,10}(enrollment|status|membership|identity|Indian|tribal)/i,
      /denied?.{0,20}(my|our).{0,10}(Indian|tribal|native|sovereign)\s+status/i,
      /not\s+recogniz(ing|ed).{0,20}(my|our|as)\s+(Indian|tribal|sovereign|member)/i,
      /they\s+(don'?t|do\s+not)\s+recognize\s+(me|us)\s+as\s+(Indian|Native|tribal|member)/i,
      /disputing\s+(my|our)\s+(enrollment|membership|Indian|tribal)\s+status/i,
      /\b(challenged?|questioned?|denied?)\b.{0,20}\b(Indian|Native|tribal|indigenous)\s+(status|identity|blood|lineage)\b/i,
    ],
    negativePatterns: [
      /\b(stop|prevent|document|assert|prove|affirm|record)\b.{0,20}(status|identity|Indian|enrollment)/i,
    ],
  },
  {
    type: "PROCEEDING_WITHOUT_STATUS_ASSERTION",
    patterns: [
      /\b(court\s+)?(hearing|proceeding|case|lawsuit)\b.{0,40}\b(scheduled|set|coming|upcoming|next\s+week|tomorrow|soon)\b/i,
      /they\s+(filed|are\s+filing|have\s+filed).{0,30}against\s+(me|us)/i,
      /\b(lawsuit|legal\s+action|complaint\s+filed)\b.{0,30}\b(against|on)\b/i,
      /\b(foreclos|evict|repossess|garnish).{0,20}\b(my|our|the)\b/i,
      /\b(appear\s+in|go\s+to|attend|have\s+to\s+be\s+in).{0,20}(court|hearing|proceeding)/i,
      /\b(order\s+to\s+show\s+cause|summons?|subpoena)\b/i,
    ],
    negativePatterns: [],
  },
  {
    type: "DEBT_COLLECTION_ACTIVE",
    patterns: [
      /\b(debt\s+collector|collection\s+agenc|servicer|mortgage\s+compan|carrington|creditor)\b.{0,40}\b(calling|sending|reporting|collecting|threaten|contact|harass)\b/i,
      /\b(collect(ing)?|trying\s+to\s+collect).{0,20}(a\s+)?debt\b/i,
      /they\s+(sent|keep\s+sending|are\s+sending).{0,20}\b(letters?|notices?|bills?|demands?)\b/i,
      /\b(collection\s+calls?|collection\s+letters?|debt\s+collection)\b/i,
      /\b(harassing|harassment).{0,20}(calls?|letters?|messages?|contacts?)\b/i,
      /\bowing\s+(money|a\s+debt)\b.{0,30}\b(they|collector|servicer|bank|carrington)\b/i,
    ],
    negativePatterns: [
      /\b(stopped?|ceased?|halted?|validated?)\b.{0,20}(collecting|collection)/i,
      /already\s+sent\s+(the\s+)?(validation|demand)\b/i,
    ],
  },
  {
    type: "CREDIT_REPORTING_ACTIVE",
    patterns: [
      /\b(credit\s+bureau|equifax|experian|transunion)\b.{0,30}\b(report|reporting|placed|item|account|listed)\b/i,
      /\b(placed?|putting|reporting|listed?|showing)\b.{0,20}\b(on|to)\b.{0,10}\b(my|our)\b.{0,10}\b(credit|credit\s+file|credit\s+report|person(al)?\s+credit)\b/i,
      /\b(hurt(ing)?|damag(ing)?|affecting?|impacting?)\b.{0,20}\b(my|our)\b.{0,10}\b(credit|credit\s+score|credit\s+report)\b/i,
      /places?\s+thing\s+on\s+(my|our)\s+person/i,
    ],
    negativePatterns: [],
  },
  {
    type: "UNAUTHORIZED_LAND_ENCUMBRANCE",
    patterns: [
      /\b(mortgage|lien|encumbrance|foreclos)\b.{0,30}\b(on|against)\b.{0,20}\b(the\s+|my\s+|our\s+)?(restricted|trust|Indian|tribal)?\s*(land|property|allotment)\b/i,
      /\bforce\s*(d)?\s*(clos|close|foreclos)\b/i,
      /\b(restrict(ed)?|trust)\s+land\b.{0,30}\b(mortgage|lien|encumbrance|foreclos)\b/i,
      /\b(foreclos|seize)\b.{0,20}\b(restricted|trust|Indian)\b/i,
    ],
    negativePatterns: [
      /\b(stop|prevent|void|invalid|unauthorized|challenge|blocked?)\b.{0,20}(foreclos|lien|mortgage|encumbrance)\b/i,
    ],
  },
  {
    type: "STATE_JURISDICTION_CLAIMED",
    patterns: [
      /\b(state|county)\s+(court|judge|agency|department)\b.{0,30}\b(jurisdiction|authority|power|over|said|order|ruling)\b/i,
      /\b(superior\s+court|district\s+court|municipal\s+court|circuit\s+court)\b.{0,30}\b(over|on|about|for|has|have)\b/i,
      /\b(state|county)\b.{0,20}\b(claim(ing|s)?|assert(ing|s)?|has|have)\b.{0,20}\bjurisdiction\b/i,
      /\b(state|county)\b.{0,20}\b(told|said|ordered|notified)\b.{0,20}\b(me|us)\b/i,
      /\bPublic\s+Law\s+280\b/i,
    ],
    negativePatterns: [
      /\b(object|challenge|deny|contest|remove|transfer|no\s+jurisdiction|federal\s+court)\b/i,
    ],
  },
  {
    type: "NOTICES_SENT_NO_RESPONSE",
    patterns: [
      /\bsent\b.{0,30}\b(notices?|letters?|orders?|demands?)\b.{0,40}\b(no\s+response|ignored|disregarded|no\s+reply|never\s+responded?)\b/i,
      /\b(they|the\s+bank|the\s+servicer|the\s+creditor|carrington)\b.{0,30}\b(ignored|disregarded|didn'?t\s+respond|never\s+responded?)\b/i,
      /\b(multiple|several|many)\b.{0,15}\b(notices?|letters?|requests?)\b.{0,30}\b(no|without)\s+(response|reply|answer)\b/i,
      /sent\s+(multiple\s+)?(notices?\s+and\s+orders?|orders?\s+and\s+notices?)/i,
    ],
    negativePatterns: [],
  },
  {
    type: "STATUS_NOT_ON_RECORD",
    patterns: [
      /nobody\s+knows\s+(I'?m|we'?re|that\s+(I|we)'?re)\s+(Indian|tribal|Native|enrolled)/i,
      /never\s+(filed|asserted|documented|recorded)\s+(my|our)\s+(Indian|tribal|sovereign)\s+status/i,
      /\b(not\s+on\s+record|not\s+documented|not\s+filed)\b.{0,30}\b(status|identity|enrollment|tribal)\b/i,
      /they\s+don'?t\s+(have|know)\s+(my|our)\s+(Indian|tribal|enrollment|status)\s+(on\s+file|documented|recorded)\b/i,
    ],
    negativePatterns: [],
  },
  {
    type: "ICWA_PROCEEDING_DETECTED",
    patterns: [
      /\b(child|children|custody|placement|foster|adoption|removal|welfare)\b.{0,30}\b(court|proceeding|case|hearing|order|CPS|DCFS|DHS)\b/i,
      /\b(CPS|DCFS|DHS|child\s+protective\s+services|social\s+services)\b.{0,30}\b(involved|investigation|case|visit|hearing)\b/i,
      /\b(my|our)\s+(child|children|kids?|son|daughter)\b.{0,30}\b(removed|taken|placed|custody|foster)\b/i,
      /\b(termination\s+of\s+parental\s+rights|TPR)\b/i,
      /\bICWA\b/i,
    ],
    negativePatterns: [],
  },
  {
    type: "ADMINISTRATIVE_CAPITULATION_RISK",
    patterns: [
      /\b(just|maybe|thinking\s+about)\b.{0,20}\b(pay(ing)?|settle|settling|paying\s+it|paying\s+them|pay\s+it\s+off)\b/i,
      /\b(accept|agree\s+to|go\s+along\s+with)\b.{0,30}\b(their|the)\b.{0,20}\b(offer|demand|settlement|terms)\b/i,
      /\b(give\s+(them|up)|surrender|cave|back\s+down)\b.{0,30}\b(rights?|land|status|claim)\b/i,
      /maybe\s+I\s+(should|just)\s+(pay|settle|give|accept|agree)/i,
    ],
    negativePatterns: [
      /\b(don'?t|do\s+not|cannot|must\s+not|should\s+not)\b.{0,20}\b(pay|settle|give|accept|agree)\b/i,
    ],
  },
  {
    type: "FEDERAL_PROGRAM_ACCESS_DENIED",
    patterns: [
      /\b(IHS|Indian\s+Health\s+Service)\b.{0,40}\b(denied?|refused?|not\s+eligible|won'?t\s+see|can'?t\s+get|no\s+access|turned\s+away)\b/i,
      /\b(BIA|Bureau\s+of\s+Indian\s+Affairs)\b.{0,40}\b(denied?|refused?|not\s+eligible|won'?t\s+help|no\s+access)\b/i,
      /\b(HUD\s+184|Section\s+184|Indian\s+loan\s+guarantee)\b.{0,30}\b(denied?|refused?|ineligible|not\s+qualify)\b/i,
      /\b(tribal\s+TANF|Indian\s+TANF|LIHEAP|tribal\s+assistance|Indian\s+housing)\b.{0,30}\b(denied?|refused?|not\s+eligible|no\s+access|cut\s+off)\b/i,
      /denied?\s+(access|services?|benefits?|help)\b.{0,30}\b(because|due|on\s+account\s+of).{0,20}(Indian|tribal|Native|status|enrollment)\b/i,
      /\b(won'?t|will\s+not|refusing\s+to)\s+(treat|see|help|serve|assist)\s+(me|us)\b.{0,30}\b(Indian|tribal|Native|because|enrollment)\b/i,
      /\b(tribal|Indian)\s+(health|medical|housing|financial|education)\s+program\b.{0,30}\b(denied?|unavailable|refused?|cut\s+off|blocked?)\b/i,
    ],
    negativePatterns: [
      /\b(applied?|accessing?|enrolled?|approved?|receiving?)\b/i,
    ],
  },
  {
    type: "TREATY_RIGHT_NOT_INVOKED",
    patterns: [
      /\b(treaty|treaty\s+right|treaty\s+rights?)\b.{0,40}\b(not\s+used|not\s+invoked|not\s+assert|never\s+claimed|forgot|didn'?t\s+know)\b/i,
      /\b(hunting|fishing|water|timber|mineral|grazing|gathering)\s+rights?\b.{0,30}\b(not|never|can'?t|won'?t|blocked?|restricted?|denied?)\b/i,
      /\b(they|state|county|park|ranger|warden)\b.{0,30}\b(stopped?|cited?|arrested?|prevented?|blocked?)\b.{0,30}\b(hunting|fishing|gathering|harvesting)\b/i,
      /\b(treaty\s+of|treaty\s+rights?\s+under|guaranteed\s+by\s+treaty)\b/i,
      /\b(original\s+treaty|ancestral\s+right|reserved\s+right)\b.{0,30}\b(not|never|wasn'?t|hasn'?t)\b/i,
      /\b(subsistence|traditional\s+use|religious\s+site|sacred\s+site)\b.{0,30}\b(blocked?|denied?|can'?t\s+access|prevented?)\b/i,
    ],
    negativePatterns: [
      /\b(assert(ed|ing)?|invok(ed|ing)?|exercis(ed|ing)?|claimed?)\b.{0,20}\b(treaty|right)\b/i,
    ],
  },
  {
    type: "TRUST_RESPONSIBILITY_BREACH",
    patterns: [
      /\b(BIA|federal\s+government|Interior|United\s+States)\b.{0,40}\b(not\s+protecting?|failed?|breach(ed|ing)?|ignoring?|neglect(ed|ing)?)\b.{0,30}\b(trust|land|fund|account|assets?|rights?)\b/i,
      /\b(trust\s+fund|trust\s+account|Individual\s+Indian\s+Money|IIM\s+account)\b.{0,30}\b(missing|wrong|inaccurate|not\s+accounting?|not\s+paying?|short)\b/i,
      /\b(federal)\b.{0,20}\b(failed?|refusing?|won'?t)\b.{0,30}\b(protect|manage|account\s+for|oversee)\b.{0,20}\b(land|trust|assets?|funds?|minerals?|royalt)\b/i,
      /\b(Cobell|accounting\s+for\s+trust|trust\s+mismanagement|trust\s+breach)\b/i,
      /\b(they|BIA|Interior|government)\b.{0,30}\b(lost|mismanaged?|misappropriat|didn'?t\s+pay|underpaid)\b.{0,20}\b(trust\s+funds?|royalt|leases?|IIM)\b/i,
    ],
    negativePatterns: [],
  },
  {
    type: "TRIBAL_COURT_JURISDICTION_NOT_INVOKED",
    patterns: [
      /\b(should\s+be\s+in\s+tribal\s+court|tribal\s+court\s+has\s+jurisdiction)\b/i,
      /\b(going\s+to|went\s+to|filed\s+in)\b.{0,20}\b(state\s+court|county\s+court)\b.{0,20}\b(instead\s+of|rather\s+than|not|without)\b.{0,20}\btribal\b/i,
      /\b(tribal\s+court|tribal\s+jurisdiction)\b.{0,30}\b(not\s+used|not\s+invoked|skipped?|bypassed?|ignored?)\b/i,
      /\b(don'?t\s+know|didn'?t\s+know|never\s+thought)\b.{0,20}\b(tribal\s+court|tribal\s+law|could\s+go\s+to\s+tribe)\b/i,
      /\b(matter|case|dispute|issue)\b.{0,30}\b(tribe|tribal\s+law|tribal\s+court)\b.{0,30}\b(should|could|would)\b/i,
    ],
    negativePatterns: [
      /\b(filed?|went\s+to|using|invoke|tribal\s+court\s+already)\b/i,
    ],
  },
];

// ─── ACTION DEFINITIONS (LAW-ANCHORED) ────────────────────────────────────────

interface ActionDef {
  action: ActionCode;
  label: string;
  priority: ActionPriority;
  rationale: string;
  lawCitations: string[];
  triggeredBy: SignalType[];
}

const ACTION_DEFINITIONS: ActionDef[] = [
  {
    action: "GENERATE_STATUS_AFFIRMATION",
    label: "Generate Sovereign Status Affirmation Document",
    priority: "IMMEDIATE",
    rationale: "Your Indian status has been challenged or has not been placed on record in an active proceeding. A Status Affirmation from the Sovereign Office formally declares tribal membership, enrollment, and all associated federal protections under the Indian Reorganization Act (25 U.S.C. §§ 5101-5129), the federal trust responsibility doctrine, and United States v. Wheeler — placing the challenging party on legal notice of the full scope of inherent tribal sovereignty.",
    lawCitations: [
      "25 U.S.C. §§ 5101-5129 (Indian Reorganization Act — tribal membership and organization)",
      "25 U.S.C. § 479 (definition of 'Indian' for federal purposes)",
      "United States v. Wheeler, 435 U.S. 313 (1978) (inherent tribal sovereignty)",
      "Morton v. Mancari, 417 U.S. 535 (1974) (federal recognition of Indian status is political, not racial)",
      "Federal Trust Responsibility — Seminole Nation v. United States, 316 U.S. 286 (1942)",
    ],
    triggeredBy: ["IDENTITY_CHALLENGED", "STATUS_NOT_ON_RECORD"],
  },
  {
    action: "FILE_ENROLLMENT_VERIFICATION",
    label: "File Tribal Enrollment Verification in Active Proceeding",
    priority: "IMMEDIATE",
    rationale: "An active proceeding is underway and Indian status has not been formally entered into the record. Under the Indian Child Welfare Act (25 U.S.C. § 1903), ICWA protections, FDCPA sovereign status defenses, and federal preemption doctrines (Worcester v. Georgia; McClanahan) cannot be triggered until tribal membership is on the record of that specific proceeding. The tribe's authority to intervene and the federal court's obligation to apply Indian law both depend on status being on record.",
    lawCitations: [
      "25 U.S.C. § 1903 (ICWA — definition of 'Indian child' and tribal jurisdiction)",
      "Worcester v. Georgia, 31 U.S. 515 (1832) (federal preemption of state authority over tribal matters)",
      "McClanahan v. Arizona State Tax Commission, 411 U.S. 164 (1973) (state law preempted in Indian country)",
      "Williams v. Lee, 358 U.S. 217 (1959) (tribal court exclusive jurisdiction over tribal members in Indian country)",
      "25 U.S.C. § 1911 (tribal court jurisdiction in child proceedings)",
    ],
    triggeredBy: ["PROCEEDING_WITHOUT_STATUS_ASSERTION", "IDENTITY_CHALLENGED"],
  },
  {
    action: "SEND_DEBT_VALIDATION_DEMAND",
    label: "Issue FDCPA Debt Validation Demand — Halts All Collection Immediately",
    priority: "IMMEDIATE",
    rationale: "Active debt collection is ongoing. A written Debt Validation Demand under FDCPA § 1692g, sent by certified mail, immediately halts all collection activity. The debt collector has 30 days to provide validation — proof the debt is valid, that they own or are authorized to collect it, and that it is enforceable against you personally. As a tribal member asserting sovereign status, additional grounds for challenge include whether the original creditor had jurisdiction to contract with a tribal member on tribal land, and whether the Nonintercourse Act voids any lien underlying the debt.",
    lawCitations: [
      "15 U.S.C. § 1692g (FDCPA — debt validation rights, 30-day demand window)",
      "15 U.S.C. § 1692e (FDCPA — prohibition on false, deceptive, or misleading representations)",
      "15 U.S.C. § 1692f (FDCPA — prohibition on unfair practices)",
      "25 U.S.C. § 177 (Nonintercourse Act — void any contract encumbering Indian land without federal authorization)",
      "Seminole Tribe of Florida v. Florida, 517 U.S. 44 (1996) (tribal sovereign immunity in commercial matters)",
    ],
    triggeredBy: ["DEBT_COLLECTION_ACTIVE", "UNAUTHORIZED_LAND_ENCUMBRANCE"],
  },
  {
    action: "FILE_CREDIT_DISPUTE",
    label: "File FCRA Dispute with Equifax, Experian, and TransUnion",
    priority: "THIS_WEEK",
    rationale: "Unauthorized or inaccurate credit reporting is active. An FCRA dispute triggers a mandatory 30-day investigation. The bureau must notify the furnisher, who must investigate and remove inaccurate or unauthorized information. Grounds for dispute include: inaccurate reporting of debt tied to restricted land (void under the Nonintercourse Act), reporting of debt against a tribal member whose sovereign status was not recognized in the original transaction, and reporting of debt validation failures. File with all three bureaus — certified mail, return receipt.",
    lawCitations: [
      "15 U.S.C. § 1681i (FCRA — consumer dispute procedures, 30-day investigation requirement)",
      "15 U.S.C. § 1681s-2 (FCRA — furnisher duties upon notice of dispute)",
      "15 U.S.C. § 1681b (FCRA — permissible purposes for credit reporting)",
      "25 U.S.C. § 177 (Nonintercourse Act — underlying debt may be void)",
      "15 U.S.C. § 1681n (FCRA — civil liability for willful noncompliance, $100–$1,000 per violation + punitive damages)",
    ],
    triggeredBy: ["CREDIT_REPORTING_ACTIVE"],
  },
  {
    action: "ISSUE_NFR",
    label: "Issue Notice of Federal Review — Unauthorized Encumbrance on Restricted Indian Land",
    priority: "IMMEDIATE",
    rationale: "A mortgage, lien, or foreclosure action on restricted Indian land is void ab initio under the Nonintercourse Act (25 U.S.C. § 177) without express written authorization from the Secretary of the Interior. This is not a defense — it is a structural fact: no state court, no lender, and no county recorder has the legal power to encumber restricted Indian land. A Notice of Federal Review formally invokes federal jurisdiction, notifies all parties of the void nature of the encumbrance, and creates the administrative record required for federal court intervention.",
    lawCitations: [
      "25 U.S.C. § 177 (Indian Nonintercourse Act — no purchase or encumbrance of Indian land without federal consent)",
      "25 U.S.C. § 483a (restrictions on alienation of Indian land)",
      "Montana v. Blackfeet Tribe, 471 U.S. 759 (1985) (federal statutes must be liberally construed in favor of Indians)",
      "County of Oneida v. Oneida Indian Nation, 470 U.S. 226 (1985) (Nonintercourse Act violations create federal cause of action)",
      "25 C.F.R. § 152 (Secretary of Interior approval requirements for land transactions)",
      "28 U.S.C. § 1331 (federal question jurisdiction over Nonintercourse Act violations)",
    ],
    triggeredBy: ["UNAUTHORIZED_LAND_ENCUMBRANCE", "STATE_JURISDICTION_CLAIMED"],
  },
  {
    action: "FILE_JURISDICTIONAL_STATEMENT",
    label: "File Jurisdictional Statement — Assert Federal and Tribal Jurisdiction Over This Matter",
    priority: "THIS_WEEK",
    rationale: "A state or county actor is claiming or exercising jurisdiction over a tribal member or tribal land. State authority is categorically preempted in Indian country under Worcester v. Georgia. The applicable jurisdictional framework is: (1) federal law is supreme; (2) tribal law governs tribal members on tribal land; (3) state law applies only if expressly granted by Congress (e.g., Public Law 280). Unless Public Law 280 applies in this jurisdiction, the state actor has no lawful authority here. A Jurisdictional Statement from this office formally establishes this record.",
    lawCitations: [
      "Worcester v. Georgia, 31 U.S. 515 (1832) (state laws have no force in Indian country)",
      "McClanahan v. Arizona State Tax Commission, 411 U.S. 164 (1973) (federal preemption of state jurisdiction)",
      "Montana v. United States, 450 U.S. 544 (1981) (tribal regulatory jurisdiction over non-members on tribal land)",
      "18 U.S.C. § 1151 (definition of Indian country — includes allotments and dependent Indian communities)",
      "Public Law 83-280 (1953) (limited state jurisdiction in certain states — does not apply to all tribal lands)",
      "28 U.S.C. § 1362 (federal district court jurisdiction over tribal civil actions)",
    ],
    triggeredBy: ["STATE_JURISDICTION_CLAIMED", "PROCEEDING_WITHOUT_STATUS_ASSERTION"],
  },
  {
    action: "ESTABLISH_ADMINISTRATIVE_RECORD",
    label: "Establish Certified Administrative Record of All Sovereign Notices Sent",
    priority: "THIS_WEEK",
    rationale: "Sovereign notices have been sent and ignored. In federal administrative and judicial proceedings involving Indian rights, the administrative record is the foundational document. A certified, notarized record — with dates, methods (certified mail, return receipt), and content of every notice sent — is required to establish FDCPA violations, Nonintercourse Act claims, and federal trust responsibility breach claims. Courts cannot grant relief based on oral assertions alone. The record must exist in writing before federal court action is viable.",
    lawCitations: [
      "5 U.S.C. §§ 551-559 (Administrative Procedure Act — agency action subject to record review)",
      "15 U.S.C. § 1692k (FDCPA — civil liability requires documented violations)",
      "Fed. R. Evid. 803(6) (business records exception — certified records admissible)",
      "25 U.S.C. § 5110 (right to submit records in federal Indian proceedings)",
      "25 C.F.R. § 2 (BIA appeals procedures — administrative record requirements)",
    ],
    triggeredBy: ["NOTICES_SENT_NO_RESPONSE", "ADMINISTRATIVE_CAPITULATION_RISK"],
  },
  {
    action: "FILE_ICWA_NOTICE",
    label: "File ICWA Notice of Proceeding — Mandatory Federal Filing",
    priority: "IMMEDIATE",
    rationale: "A child welfare, custody, foster placement, or adoption proceeding has been detected involving a tribal member's child. ICWA (25 U.S.C. § 1912) mandates that the court notify the tribe at least 10 days before any hearing that may result in placement. The tribe has an absolute right to intervene. Active efforts (not merely reasonable efforts) must be made to prevent family separation. ICWA creates a higher evidentiary standard than state law: clear and convincing evidence for foster care; beyond a reasonable doubt for TPR. Failure to provide ICWA notice is reversible error — any placement made without it can be vacated.",
    lawCitations: [
      "25 U.S.C. § 1912 (ICWA — notice requirements, active efforts standard, evidentiary standards)",
      "25 U.S.C. § 1911 (ICWA — tribal court exclusive jurisdiction; right to intervene)",
      "25 U.S.C. § 1915 (ICWA — placement preferences: tribal family, tribal member, Indian family)",
      "25 C.F.R. § 23.11 (BIA ICWA regulations — notice requirements and tribal intervention rights)",
      "Brackeen v. Haaland, 599 U.S. 255 (2023) (ICWA upheld as constitutional exercise of congressional plenary power)",
      "Mississippi Band of Choctaw Indians v. Holyfield, 490 U.S. 30 (1989) (tribal court jurisdiction not waivable by parents)",
    ],
    triggeredBy: ["ICWA_PROCEEDING_DETECTED"],
  },
  {
    action: "ASSERT_SOVEREIGN_IDENTITY",
    label: "Assert Sovereign Identity Across All Active Matters Simultaneously",
    priority: "THIS_WEEK",
    rationale: "Multiple active matters exist where sovereign identity has not been formally asserted. The federal trust relationship and all protections flowing from it — land protections under the Nonintercourse Act, ICWA rights, exemption from state jurisdiction under Worcester, access to Indian-specific federal programs under ISDEAA (25 U.S.C. §§ 5301-5423) and IHCIA (25 U.S.C. §§ 1601-1683) — are activated by the formal assertion of status. A comprehensive identity assertion package should be served on all parties simultaneously.",
    lawCitations: [
      "25 U.S.C. §§ 5301-5423 (Indian Self-Determination and Education Assistance Act — right to access and contract for federal services)",
      "25 U.S.C. §§ 1601-1683 (Indian Health Care Improvement Act — right to Indian health services)",
      "25 U.S.C. §§ 4101 et seq. (NAHASDA — Native American Housing Assistance and Self-Determination Act)",
      "Federal trust responsibility — United States v. Mitchell, 463 U.S. 206 (1983) (government liability for trust failures)",
      "Morton v. Mancari, 417 U.S. 535 (1974) (Indian preference programs upheld as political, not racial, classifications)",
    ],
    triggeredBy: ["IDENTITY_CHALLENGED", "STATUS_NOT_ON_RECORD", "PROCEEDING_WITHOUT_STATUS_ASSERTION"],
  },
  {
    action: "ISSUE_CEASE_DESIST",
    label: "Issue Sovereign Cease & Desist — Order All Unauthorized Activity to Halt",
    priority: "IMMEDIATE",
    rationale: "There is risk of capitulation to external pressure without having first fully asserted sovereign protections. A Sovereign Cease & Desist from this office formally orders the external actor to halt all collection, reporting, encumbrance, and jurisdictional overreach pending federal review. It puts them on notice of every federal law violation in play — FDCPA, FCRA, the Nonintercourse Act, and federal preemption — and documents the demand in the administrative record. Capitulation now, before this record is built, waives rights that cannot be recovered.",
    lawCitations: [
      "15 U.S.C. §§ 1692-1692p (FDCPA — full range of prohibited collection conduct)",
      "25 U.S.C. § 177 (Nonintercourse Act — all encumbrances void without federal authorization)",
      "Worcester v. Georgia, 31 U.S. 515 (1832) (preemption of all state and private actors operating in Indian country without federal sanction)",
      "15 U.S.C. § 1681n (FCRA — willful noncompliance; civil liability)",
      "25 U.S.C. § 1911 (tribal authority to assert jurisdiction and intervene)",
    ],
    triggeredBy: ["ADMINISTRATIVE_CAPITULATION_RISK", "DEBT_COLLECTION_ACTIVE", "CREDIT_REPORTING_ACTIVE"],
  },
  {
    action: "INVOKE_FEDERAL_PROGRAM_RIGHTS",
    label: "Invoke Federal Indian Program Rights — Formal Demand for Access",
    priority: "THIS_WEEK",
    rationale: "Access to a federally funded Indian program (Indian Health Service, BIA services, HUD Section 184 loan guarantee, tribal TANF, LIHEAP, or tribal housing) has been denied or obstructed. As an enrolled tribal member, access to these programs is a federal right — not a discretionary benefit. The Indian Health Care Improvement Act, ISDEAA, and NAHASDA collectively create enforceable access rights. Denial of access on the basis of Indian status may also violate the Indian Civil Rights Act (25 U.S.C. §§ 1301-1304). A formal demand, citing the specific statute and program, creates the record for federal complaint and agency appeal.",
    lawCitations: [
      "25 U.S.C. §§ 1601-1683 (Indian Health Care Improvement Act — right to Indian health care services, IHS obligation)",
      "25 U.S.C. §§ 5301-5423 (ISDEAA — tribal right to contract for federal Indian services; cannot be unreasonably denied)",
      "25 U.S.C. §§ 4101 et seq. (NAHASDA — Native American housing assistance rights)",
      "42 U.S.C. § 8621 et seq. (LIHEAP — Low Income Home Energy Assistance, Indian tribal set-aside)",
      "25 U.S.C. §§ 1301-1304 (Indian Civil Rights Act — equal protection and due process rights within Indian country)",
      "25 U.S.C. § 4221 et seq. (Native American Business Development Act — access to tribal economic programs)",
    ],
    triggeredBy: ["FEDERAL_PROGRAM_ACCESS_DENIED"],
  },
  {
    action: "ASSERT_TREATY_RIGHTS",
    label: "Assert Treaty-Reserved Rights — Formal Notice of Federal Protection",
    priority: "THIS_WEEK",
    rationale: "Treaty rights belonging to this tribe — hunting, fishing, gathering, water rights, land use, educational access, or religious site access — appear not to have been invoked in a situation where they apply. Treaties are the supreme law of the land under the Supremacy Clause (U.S. Const. Art. VI, cl. 2). They are not historical documents — they are living, enforceable federal law. Under the reserved rights doctrine, Indians retain all rights not expressly ceded. State game laws, park regulations, and access restrictions do not override treaty guarantees. The treaty must be formally invoked in writing to the appropriate party.",
    lawCitations: [
      "U.S. Const. Art. VI, cl. 2 (Supremacy Clause — treaties are supreme law of the land)",
      "Herrera v. Wyoming, 587 U.S. 329 (2019) (treaty rights survive statehood; state regulation does not abrogate)",
      "Minnesota v. Mille Lacs Band, 526 U.S. 172 (1999) (treaty rights enforceable against state, survive Executive Orders)",
      "Washington v. Washington State Commercial Passenger Fishing Vessel Assn., 443 U.S. 658 (1979) (treaty fishing rights — 50% allocation)",
      "Winters v. United States, 207 U.S. 564 (1908) (reserved water rights doctrine — tribes retain water rights not explicitly ceded)",
      "25 U.S.C. § 177 (Nonintercourse Act — treaty lands cannot be encumbered without federal consent)",
      "42 U.S.C. § 1996 (American Indian Religious Freedom Act — access to sacred sites and religious practices)",
    ],
    triggeredBy: ["TREATY_RIGHT_NOT_INVOKED"],
  },
  {
    action: "FILE_TRUST_RESPONSIBILITY_COMPLAINT",
    label: "File Federal Trust Responsibility Complaint — BIA / OIG / Federal Court",
    priority: "THIS_WEEK",
    rationale: "The federal government — through the BIA, Department of Interior, or a federal contractor — appears to have failed its trust responsibility to this tribal member. The trust responsibility is one of the most fundamental obligations in federal law: the United States, as trustee of Indian lands and assets, must manage those assets with the highest fiduciary duty. Breaches include mismanagement of IIM (Individual Indian Money) accounts, failure to collect or remit royalties, improper land leasing, and failure to protect restricted land. Cobell v. Salazar (2009) established a $3.4 billion settlement for exactly these breaches. A formal complaint filed with BIA, the OIG, and if necessary federal district court, is the mechanism for remedy.",
    lawCitations: [
      "25 U.S.C. §§ 4001-4061 (American Indian Trust Fund Management Reform Act — fiduciary obligations and accounting rights)",
      "United States v. Mitchell, 463 U.S. 206 (1983) (government waives sovereign immunity for trust management failures)",
      "United States v. White Mountain Apache Tribe, 537 U.S. 465 (2003) (trust responsibility extends to all trust property management)",
      "Cobell v. Salazar, No. 96-1285 (D.D.C.) (class action trust fund mismanagement — $3.4B settlement, 2009)",
      "25 U.S.C. § 162a (duty of Secretary of Interior to maintain trust accounts accurately)",
      "Federal Inspector General Act (5 U.S.C. App. 3) — complaint mechanism for federal agency failures",
      "25 C.F.R. § 115 (BIA trust account management regulations and member rights)",
    ],
    triggeredBy: ["TRUST_RESPONSIBILITY_BREACH"],
  },
];

// ─── SIGNAL EXTRACTION ────────────────────────────────────────────────────────

export function extractSignals(text: string): SignalType[] {
  const detected: SignalType[] = [];
  for (const rule of SIGNAL_RULES) {
    const matches = rule.patterns.some(p => p.test(text));
    if (!matches) continue;
    const excluded = rule.negativePatterns.some(np => np.test(text));
    if (excluded) continue;
    detected.push(rule.type);
  }
  return detected;
}

// ─── ACTION QUEUE BUILDER ─────────────────────────────────────────────────────

function buildActionQueue(signals: StatusSignal[]): ActionItem[] {
  const activeSignalTypes = new Set(signals.map(s => s.type));
  const now = new Date().toISOString();
  const queue: ActionItem[] = [];

  for (const def of ACTION_DEFINITIONS) {
    const triggering = def.triggeredBy.filter(t => activeSignalTypes.has(t));
    if (triggering.length === 0) continue;

    const relatedSignals = signals.filter(s => triggering.includes(s.type));
    const earliestDetected = relatedSignals.reduce(
      (min, s) => s.detectedAt < min ? s.detectedAt : min,
      relatedSignals[0]?.detectedAt ?? now,
    );
    const latestSeen = relatedSignals.reduce(
      (max, s) => s.lastSeenAt > max ? s.lastSeenAt : max,
      relatedSignals[0]?.lastSeenAt ?? now,
    );
    const totalOccurrences = relatedSignals.reduce((sum, s) => sum + s.occurrenceCount, 0);

    queue.push({
      action: def.action,
      label: def.label,
      priority: def.priority,
      rationale: def.rationale,
      lawCitations: def.lawCitations,
      triggeredBy: triggering,
      status: "pending",
      detectedAt: earliestDetected,
      lastSeenAt: latestSeen,
      occurrenceCount: totalOccurrences,
    });
  }

  const priorityOrder: Record<ActionPriority, number> = { IMMEDIATE: 0, THIS_WEEK: 1, THIS_MONTH: 2 };
  queue.sort((a, b) => {
    const pd = priorityOrder[a.priority] - priorityOrder[b.priority];
    if (pd !== 0) return pd;
    return b.occurrenceCount - a.occurrenceCount;
  });

  return queue;
}

// ─── COMPANION SUMMARY BUILDER ────────────────────────────────────────────────

function buildSummaryForCompanion(
  picture: Omit<MemberIntelligencePicture, "summaryForCompanion">,
): string {
  if (picture.signals.length === 0) return "";

  const lines: string[] = [
    "═══════════════════════════════════════════════",
    "INTELLIGENCE PICTURE — STATUS, IDENTITY & TRIBAL LAW",
    `(Built from ${picture.signals.length} signal(s) across interactions · Updated ${new Date(picture.updatedAt).toLocaleDateString()})`,
    "═══════════════════════════════════════════════",
    "",
    "ACTIVE SITUATION SIGNALS:",
  ];

  for (const sig of picture.signals) {
    const freq = sig.occurrenceCount > 1 ? ` (mentioned ${sig.occurrenceCount}x)` : "";
    lines.push(`▸ ${sig.type.replace(/_/g, " ")}${freq}`);
    if (sig.context) {
      lines.push(`  Context: "${sig.context.substring(0, 120)}${sig.context.length > 120 ? "…" : ""}"`);
    }
  }

  if (picture.actionQueue.length > 0) {
    lines.push("");
    lines.push("PROACTIVE ACTION QUEUE — GROUNDED IN FEDERAL INDIAN LAW:");
    lines.push("These are the priority-ordered actions this member should take. Surface them proactively.");
    lines.push("");

    const immediate = picture.actionQueue.filter(a => a.priority === "IMMEDIATE");
    const thisWeek = picture.actionQueue.filter(a => a.priority === "THIS_WEEK");
    const thisMonth = picture.actionQueue.filter(a => a.priority === "THIS_MONTH");

    if (immediate.length > 0) {
      lines.push("⚡ IMMEDIATE (today):");
      for (const a of immediate) {
        lines.push(`  • ${a.label}`);
        lines.push(`    Rationale: ${a.rationale.substring(0, 220)}${a.rationale.length > 220 ? "…" : ""}`);
        if (a.lawCitations.length > 0) {
          lines.push(`    Law: ${a.lawCitations.slice(0, 2).join(" | ")}`);
        }
      }
    }
    if (thisWeek.length > 0) {
      lines.push("");
      lines.push("▸ THIS WEEK:");
      for (const a of thisWeek) {
        lines.push(`  • ${a.label}`);
        lines.push(`    Rationale: ${a.rationale.substring(0, 180)}${a.rationale.length > 180 ? "…" : ""}`);
        if (a.lawCitations.length > 0) {
          lines.push(`    Law: ${a.lawCitations.slice(0, 2).join(" | ")}`);
        }
      }
    }
    if (thisMonth.length > 0) {
      lines.push("");
      lines.push("▸ THIS MONTH:");
      for (const a of thisMonth) {
        lines.push(`  • ${a.label}`);
        if (a.lawCitations.length > 0) {
          lines.push(`    Law: ${a.lawCitations[0]}`);
        }
      }
    }

    lines.push("");
    lines.push(
      "COMPANION INSTRUCTION: You carry the law. When the member speaks about any of these situations, " +
      "do not wait to be asked. Name the specific statute, cite the case, and surface the action. " +
      "You are not describing options — you are telling them what the law requires and what they must do. " +
      "Speak with authority. They deserve a counselor who knows the law.",
    );
  }

  lines.push("═══════════════════════════════════════════════");
  return lines.join("\n");
}

// ─── PERSISTENCE ─────────────────────────────────────────────────────────────

const INTEL_CATEGORY = "_intel_picture";

async function loadPicture(userId: number): Promise<MemberIntelligencePicture | null> {
  try {
    const [row] = await db
      .select({ content: kiConversationsTable.content })
      .from(kiConversationsTable)
      .where(and(
        eq(kiConversationsTable.userId, userId),
        eq(kiConversationsTable.role, "knowledge"),
        eq(kiConversationsTable.category, INTEL_CATEGORY),
      ))
      .orderBy(desc(kiConversationsTable.createdAt))
      .limit(1);

    if (!row) return null;
    return JSON.parse(row.content) as MemberIntelligencePicture;
  } catch {
    return null;
  }
}

async function savePicture(picture: MemberIntelligencePicture): Promise<void> {
  await db.insert(kiConversationsTable).values({
    userId: picture.userId,
    role: "knowledge",
    content: JSON.stringify(picture),
    category: INTEL_CATEGORY,
    isDiary: false,
    createdAt: new Date(),
  });
}

// ─── MAIN ACCUMULATOR ─────────────────────────────────────────────────────────

export async function accumulateIntelligence(
  userId: number,
  messageText: string,
): Promise<MemberIntelligencePicture | null> {
  try {
    const newSignalTypes = extractSignals(messageText);
    if (newSignalTypes.length === 0) return null;

    const existing = await loadPicture(userId);
    const now = new Date().toISOString();
    const contextSnippet = messageText.substring(0, 150);

    const signals: StatusSignal[] = existing?.signals ? [...existing.signals] : [];

    for (const type of newSignalTypes) {
      const existingSig = signals.find(s => s.type === type);
      if (existingSig) {
        existingSig.lastSeenAt = now;
        existingSig.occurrenceCount++;
        if (existingSig.context.length < 300) {
          existingSig.context += ` | ${contextSnippet}`;
        }
      } else {
        signals.push({
          type,
          detectedAt: now,
          lastSeenAt: now,
          occurrenceCount: 1,
          context: contextSnippet,
        });
      }
    }

    const actionQueue = buildActionQueue(signals);
    const pictureBase = { userId, updatedAt: now, signals, actionQueue };
    const picture: MemberIntelligencePicture = {
      ...pictureBase,
      summaryForCompanion: buildSummaryForCompanion(pictureBase),
    };

    await savePicture(picture);

    logger.info(
      {
        userId,
        newSignals: newSignalTypes,
        totalSignals: signals.length,
        queueLength: actionQueue.length,
        immediateActions: actionQueue.filter(a => a.priority === "IMMEDIATE").length,
      },
      "Intelligence accumulator: picture updated",
    );

    return picture;
  } catch (err) {
    logger.warn(
      { err: (err as Error).message, userId },
      "Intelligence accumulator: failed to update picture",
    );
    return null;
  }
}

export async function getIntelligencePicture(userId: number): Promise<MemberIntelligencePicture | null> {
  return loadPicture(userId);
}

export async function getCompanionIntelContext(userId: number): Promise<string> {
  const picture = await getIntelligencePicture(userId);
  if (!picture || picture.signals.length === 0) return "";
  return picture.summaryForCompanion;
}
