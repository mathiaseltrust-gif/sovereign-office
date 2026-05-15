/**
 * LAW & LOGIC LAYER — Alignment Checker
 *
 * Ma'at Principle: Every user intent is weighed against the governing
 * foundations — role governor, trust instruments, ancestral covenants,
 * and sovereign doctrine. This layer cannot override user autonomy or
 * the foundational protections, but it speaks with authority when drift
 * is detected and provides the realignment path.
 *
 * "Ma'at" — truth, justice, balance, cosmic order. The measure by which
 * all actions are weighed. Not a rule imposed from outside, but the
 * natural order that exists when all things are in right relation.
 */

export type AlignmentSeverity = "notice" | "warning" | "critical";
export type AlignmentCategory =
  | "land_alienation"
  | "sovereignty_waiver"
  | "trust_conflict"
  | "identity_misalignment"
  | "jurisdictional_submission"
  | "ancestral_covenant"
  | "administrative_capitulation";

export interface AlignmentViolation {
  category: AlignmentCategory;
  severity: AlignmentSeverity;
  detected: string;
  doctrinalConflict: string;
  citations: string[];
  realignmentPath: string;
}

export interface AlignmentResult {
  isAligned: boolean;
  severity: AlignmentSeverity | null;
  violations: AlignmentViolation[];
  maatMessage: string | null;
  governorConflict: boolean;
}

interface AlignmentRule {
  id: string;
  category: AlignmentCategory;
  severity: AlignmentSeverity;
  patterns: RegExp[];
  negativePatterns?: RegExp[];
  detected: string;
  doctrinalConflict: string;
  citations: string[];
  realignmentPath: string;
}

// ─── ALIGNMENT RULES ────────────────────────────────────────────────────────
// Each rule represents a class of misalignment. Negative patterns exclude
// false positives (e.g. "stop them from selling" should not trigger "selling land").

const ALIGNMENT_RULES: AlignmentRule[] = [

  // ── LAND ALIENATION ──────────────────────────────────────────────────────
  {
    id: "sell_restricted_land",
    category: "land_alienation",
    severity: "critical",
    patterns: [
      /\b(sell|selling|sold|sale of|transfer|deed over|convey|give away)\b.{0,40}\b(land|allotment|property|parcel|acreage|lot|plot)\b/i,
      /\b(land|allotment|property)\b.{0,40}\b(sell|selling|sold|transfer|deed over|convey)\b/i,
      /put\s+the\s+land\s+(on\s+the\s+market|up\s+for\s+sale)/i,
    ],
    negativePatterns: [
      /stop\s+(them|him|her|anyone)\s+(from\s+)?(sell|transfer)/i,
      /\b(cannot|can't|won't|prevent|block|challenge|illegal|unauthorized)\b.{0,30}\b(sell|transfer)\b/i,
      /they\s+(are\s+trying\s+to|want\s+to)\s+sell/i,
    ],
    detected: "Potential alienation of restricted or trust land detected",
    doctrinalConflict:
      "Restricted and trust Indian land CANNOT be sold, transferred, or conveyed without express authorization from the U.S. Secretary of the Interior. Any such transaction without federal approval is void ab initio — it has no legal effect and does not transfer title. This protection exists not as a limitation on the member, but as a federal obligation to the tribe and its future generations.",
    citations: [
      "Nonintercourse Act, 25 U.S.C. § 177 — No purchase, grant, lease, or other conveyance of lands from any Indian nation or tribe shall be of any validity unless made by treaty or convention entered into pursuant to the Constitution",
      "Indian Reorganization Act, 25 U.S.C. § 5108 — trust land held in perpetuity for the benefit of the tribe",
      "County of Oneida v. Oneida Indian Nation, 470 U.S. 226 (1985) — Nonintercourse Act violations create federal cause of action; title remains with tribe",
      "Federal Trust Responsibility — U.S. holds fiduciary duty to preserve and protect Indian land for beneficiaries",
    ],
    realignmentPath:
      "If land disposition is being contemplated, the path must run through the Office of the Chief Justice & Trustee, a formal tribal council decision, and BIA approval. No external actor (realtor, attorney, bank, state court) has authority to facilitate this. If external pressure to sell or transfer is occurring, that pressure itself is a violation — file a Notice of Federal Review immediately.",
  },

  {
    id: "mortgage_restricted_land",
    category: "land_alienation",
    severity: "critical",
    patterns: [
      /\b(take out|get|obtain|apply for|sign)\b.{0,30}\b(a\s+)?(mortgage|loan|lien|encumbrance|second\s+mortgage|heloc)\b.{0,30}\b(on|against)\b.{0,30}\b(the\s+)?(land|allotment|property|trust\s+land)\b/i,
      /\b(put\s+up|use)\b.{0,30}\b(the\s+)?(land|allotment|property)\b.{0,30}\b(as\s+)?(collateral|security|guarantee)\b/i,
    ],
    negativePatterns: [
      /\b(stop|prevent|block|challenge|unauthorized|illegal|void)\b.{0,30}mortgage/i,
      /(carrington|servicer|they|them).{0,20}(placed|put|filed)/i,
    ],
    detected: "Proposed encumbrance on restricted or trust land detected",
    doctrinalConflict:
      "A mortgage, lien, or any commercial encumbrance placed on restricted Indian land without federal authorization is void under the Nonintercourse Act. No bank, lender, or servicer can hold a valid lien on restricted land. Any such instrument is unenforceable. If you are considering this, there are alternative paths to access resources that do not risk the land.",
    citations: [
      "Nonintercourse Act, 25 U.S.C. § 177 — encumbrances without federal authorization are void",
      "Federal Trust Responsibility — fiduciary duty to protect trust assets from commercial alienation",
      "25 C.F.R. § 162.337 — leasing and encumbrance of trust land requires Secretarial approval",
    ],
    realignmentPath:
      "If you need financial resources, the Sovereign Office can assist with exploring BIA direct service programs, tribal enterprise financing, or federally approved instruments that do not encumber the land. The land is the foundation — it must remain protected.",
  },

  {
    id: "easement_right_of_way",
    category: "land_alienation",
    severity: "warning",
    patterns: [
      /\b(grant|give|allow|sign)\b.{0,40}\b(easement|right.of.way|access|pipeline|utility|power\s+line)\b.{0,40}\b(across|over|through|on)\b.{0,30}\b(the\s+)?(land|allotment|property)\b/i,
    ],
    negativePatterns: [],
    detected: "Potential grant of easement or right-of-way on tribal/trust land",
    doctrinalConflict:
      "Easements and rights-of-way across Indian land require federal authorization under 25 U.S.C. § 323–328. An easement granted without BIA approval is invalid and may constitute a Nonintercourse Act violation.",
    citations: [
      "25 U.S.C. §§ 323–328 — Rights of way over Indian lands require Secretary of Interior approval",
      "Nonintercourse Act, 25 U.S.C. § 177",
      "Federal Trust Responsibility — duty to ensure Indian land is not burdened without proper process",
    ],
    realignmentPath:
      "Any easement, pipeline, utility access, or right-of-way requires a formal tribal council action and BIA approval. The Sovereign Office can guide this process. Do not sign any document granting access until this review is completed.",
  },

  // ── SOVEREIGNTY WAIVER ───────────────────────────────────────────────────
  {
    id: "immunity_waiver",
    category: "sovereignty_waiver",
    severity: "critical",
    patterns: [
      /\b(waive|give up|surrender|consent to|accept|agree to)\b.{0,40}\b(sovereign\s+immunity|immunity|jurisdiction)\b/i,
      /\b(sign|agree\s+to)\b.{0,40}\b(waiver\s+of\s+immunity|consent\s+to\s+sue|submission\s+to\s+jurisdiction)\b/i,
    ],
    negativePatterns: [
      /\b(cannot|can't|must\s+not|don't|do\s+not)\b.{0,20}(waive|give\s+up|surrender)/i,
      /they\s+(want|are\s+asking|require)/i,
    ],
    detected: "Potential waiver of tribal sovereign immunity detected",
    doctrinalConflict:
      "Tribal sovereign immunity is a foundational protection of tribal sovereignty — it is not a personal right to be waived individually. The tribe itself, through proper tribal action, must authorize any waiver. No individual member, officer, or even the Chief Justice acting alone can waive the tribe's sovereign immunity. Any document requiring or representing such a waiver should be reviewed as a potential attack on tribal sovereignty.",
    citations: [
      "Kiowa Tribe of Oklahoma v. Manufacturing Technologies, Inc., 523 U.S. 751 (1998) — tribal sovereign immunity extends to off-reservation commercial activity; can only be waived by tribal action or Congress",
      "Santa Clara Pueblo v. Martinez, 436 U.S. 49 (1978) — tribes are immune from suit absent Congressional abrogation or tribal waiver",
      "Oklahoma Tax Comm'n v. Citizen Band of Potawatomi Tribe, 498 U.S. 505 (1991)",
      "Worcester v. Georgia, 31 U.S. 515 (1832) — foundational sovereignty protection",
    ],
    realignmentPath:
      "If a waiver of immunity is being requested by any party, that request must be reviewed by the Sovereign Office before any response. The correct answer, without exception, is: 'The Mathias El Tribe does not waive its sovereign immunity. Any proceedings must be conducted in accordance with tribal jurisdiction.' File a Jurisdictional Statement through the Sovereign Office immediately.",
  },

  {
    id: "state_court_submission",
    category: "jurisdictional_submission",
    severity: "warning",
    patterns: [
      /\b(file|go|submit|bring\s+(the\s+)?case|appear|respond)\b.{0,40}\b(in|to|at)\b.{0,30}\b(state\s+court|county\s+court|district\s+court|superior\s+court|municipal\s+court|state\s+agency|county\s+agency)\b/i,
      /\b(let\s+the|allow\s+the)\b.{0,20}\b(state|county)\b.{0,20}\b(handle|decide|rule|adjudicate)\b/i,
    ],
    negativePatterns: [
      /\b(object|challenge|remove|contest|transfer|federal\s+court)\b/i,
      /(they|state|county).{0,20}(filed|brought|took)/i,
    ],
    detected: "Potential submission to state or county court jurisdiction over tribal matters",
    doctrinalConflict:
      "State courts have no jurisdiction over tribal matters, tribal members on trust land, or matters governed by federal Indian law. Appearing or filing in state court without a specific jurisdictional challenge may be construed as submission to that court's jurisdiction. Tribal matters belong in tribal court or federal court, not state court.",
    citations: [
      "Worcester v. Georgia, 31 U.S. 515 (1832) — 'The laws of Georgia can have no force' within tribal territory",
      "McClanahan v. Arizona State Tax Comm'n, 411 U.S. 164 (1973) — federal preemption of state law in Indian affairs",
      "Williams v. Lee, 358 U.S. 217 (1959) — state courts lack jurisdiction over reservation matters",
      "Iowa Mut. Ins. Co. v. LaPlante, 480 U.S. 9 (1987) — tribal courts have first right to adjudicate tribal matters",
    ],
    realignmentPath:
      "If you are being compelled to appear in state court, the response is a Jurisdictional Statement — not a substantive appearance. File through the Sovereign Office: 'The Mathias El Tribe objects to and denies the jurisdiction of this court over matters governed by federal Indian law and tribal sovereignty.' All matters should be adjudicated in Tribal Court or removed to Federal Court.",
  },

  {
    id: "state_tax_payment",
    category: "jurisdictional_submission",
    severity: "warning",
    patterns: [
      /\b(pay|paying|paid|owe|submit)\b.{0,30}\b(state\s+tax|county\s+tax|property\s+tax|income\s+tax)\b.{0,30}\b(on|for)\b.{0,30}\b(the\s+)?(land|allotment|trust|reservation|tribal)\b/i,
      /\b(state|county)\b.{0,20}\b(tax\s+lien|tax\s+bill|assessment)\b.{0,20}\b(on|for|against)\b.{0,20}\b(the\s+)?(land|allotment|property)\b/i,
    ],
    negativePatterns: [],
    detected: "Potential payment of state or county taxes on Indian land detected",
    doctrinalConflict:
      "Indian trust land and allotments are exempt from state and county taxation. Paying state or county property taxes on Indian land may be interpreted as an admission that the land is subject to state jurisdiction — weakening federal trust protections. State tax liens on Indian trust land are not enforceable.",
    citations: [
      "McClanahan v. Arizona State Tax Comm'n, 411 U.S. 164 (1973) — state has no authority to tax Indians on reservation",
      "Oklahoma Tax Comm'n v. Sac & Fox Nation, 508 U.S. 114 (1993) — Indian trust land exempt from state taxation",
      "County of Yakima v. Confederated Tribes, 502 U.S. 251 (1992) — limited scope of permissible state taxation of Indians",
      "25 U.S.C. § 465 — trust land not subject to state or local taxation",
    ],
    realignmentPath:
      "Do not pay state or county taxes on Indian land without formal review by the Sovereign Office. If a tax bill or lien has been received, the Sovereign Office will issue a formal tax-exempt status notice and, if necessary, a Notice of Federal Review to the taxing authority. Paying without challenge concedes jurisdiction.",
  },

  // ── TRUST CONFLICT ───────────────────────────────────────────────────────
  {
    id: "trust_dissolution",
    category: "trust_conflict",
    severity: "critical",
    patterns: [
      /\b(dissolve|terminate|end|close|get\s+out\s+of|exit|revoke)\b.{0,40}\b(the\s+)?(trust|tribal\s+trust|land\s+trust|family\s+trust)\b/i,
      /\b(remove\s+(myself|us|me)\s+from\s+the\s+trust)\b/i,
    ],
    negativePatterns: [],
    detected: "Potential dissolution or exit from tribal trust structure detected",
    doctrinalConflict:
      "Trust instruments established under tribal authority and federal Indian law are foundational to the protection of tribal assets and member rights. Dissolving a trust or removing oneself from its protection does not remove the underlying obligations and rights — it removes the protections. Trust dissolution or modification requires formal tribal council action and BIA review.",
    citations: [
      "Indian Reorganization Act, 25 U.S.C. § 5108 — trust status is a federal protection, not a personal election",
      "Federal Trust Responsibility — U.S. fiduciary obligation to protect trust instruments",
      "Cobell v. Salazar — trust assets must be accounted for and protected by the federal government",
    ],
    realignmentPath:
      "If there is a reason the trust structure needs to be reviewed, that review must happen through the Sovereign Office and with BIA coordination. The trust is a shield — dismantling it does not resolve the underlying issue, it removes the protection. Bring the underlying concern to the Chief Justice & Trustee for proper review.",
  },

  {
    id: "trust_assets_unauthorized_distribution",
    category: "trust_conflict",
    severity: "warning",
    patterns: [
      /\b(take|withdraw|distribute|pay\s+out|liquidate)\b.{0,40}\b(from\s+the\s+)?(trust\s+assets?|trust\s+fund|trust\s+account|tribal\s+assets?)\b/i,
      /\b(access|use)\b.{0,30}\b(trust\s+money|trust\s+funds?|trust\s+assets?)\b.{0,30}\b(for\s+)?(personal|myself|my\s+own)\b/i,
    ],
    negativePatterns: [
      /\b(authorized|proper|formal|resolution|council\s+approved)\b/i,
    ],
    detected: "Potential unauthorized distribution from trust assets",
    doctrinalConflict:
      "Trust assets held for tribal benefit cannot be distributed for personal use without proper tribal authorization — a council resolution, trustee approval, and documentation that the distribution is within the trust's purpose. Unauthorized distributions may constitute a breach of fiduciary duty and trigger federal reporting obligations.",
    citations: [
      "Federal Trust Responsibility — fiduciary obligations run to all beneficiaries collectively",
      "American Indian Trust Fund Management Reform Act, 25 U.S.C. § 4001 — federal oversight of tribal trust funds",
      "Restatement (Third) of Trusts — distribution must be within trust purpose and authorized",
    ],
    realignmentPath:
      "Prepare a formal distribution request with documented purpose, council authorization, and trustee approval. The Sovereign Office can generate the proper resolution template. Trust assets used properly strengthen the tribe — used improperly, they become a liability.",
  },

  // ── IDENTITY MISALIGNMENT ────────────────────────────────────────────────
  {
    id: "deny_indian_status",
    category: "identity_misalignment",
    severity: "critical",
    patterns: [
      /\b(I'm\s+not|I\s+am\s+not|we\s+are\s+not|we're\s+not)\b.{0,20}\b(Indian|Native|tribal|indigenous)\b/i,
      /\b(give\s+up|renounce|surrender|abandon)\b.{0,30}\b(my\s+|our\s+)?(tribal\s+membership|enrollment|Indian\s+status|tribal\s+status)\b/i,
      /\b(disenroll|dis-enroll)\b/i,
    ],
    negativePatterns: [
      /(they\s+say|they\s+claim|they\s+argue|they\s+assert|they\s+allege)\b.{0,20}\b(I'm\s+not|we\s+are\s+not|not\s+really)/i,
    ],
    detected: "Potential denial or renunciation of Indian / tribal identity detected",
    doctrinalConflict:
      "Tribal identity and enrollment are not personal elections to be surrendered under external pressure. Federal Indian law construes ambiguities in favor of Indians (Indian Canons of Construction). Denying or renouncing Indian status — even under duress — may forfeit protections under ICWA, FDCPA sovereign status assertions, trust land protections, and Indian Civil Rights Act rights. This is one of the most consequential actions in the law.",
    citations: [
      "Indian Canons of Construction — ambiguities in statutes must be resolved in favor of Indians",
      "Montana v. Blackfeet Tribe, 471 U.S. 759 (1985) — broad construction in favor of Indian status",
      "Carpenter v. Murphy, 587 U.S. 827 (2019) — Indian status broadly construed",
      "Indian Civil Rights Act, 25 U.S.C. §§ 1301–1304 — rights attach to tribal membership",
      "ICWA, 25 U.S.C. §§ 1901–1963 — protections depend on Indian status being maintained and asserted",
    ],
    realignmentPath:
      "If external pressure to deny Indian status is occurring, that pressure is itself potentially a federal violation. The Sovereign Office will issue a formal Status Affirmation — a sovereign document declaring tribal membership, enrollment status, and all applicable federal protections. This document, not any denial, is the correct response.",
  },

  // ── ADMINISTRATIVE CAPITULATION ──────────────────────────────────────────
  {
    id: "accept_adverse_administrative_decision",
    category: "administrative_capitulation",
    severity: "warning",
    patterns: [
      /\b(accept|agree\s+to|comply\s+with|go\s+along\s+with|honor)\b.{0,40}\b(their|the\s+(state's|county's|agency's|collector's|servicer's))\b.{0,30}\b(decision|ruling|order|determination|demand|notice)\b/i,
      /\b(just\s+)?(pay|settle|resolve\s+it|make\s+it\s+go\s+away|pay\s+(them|it)\s+off)\b.{0,30}\b(and\s+be\s+done|to\s+(end|stop|resolve))/i,
    ],
    negativePatterns: [
      /\b(don't|do\s+not|cannot|must\s+not|refuse|object|challenge|contest)\b/i,
    ],
    detected: "Potential capitulation to an adverse administrative or commercial decision",
    doctrinalConflict:
      "Accepting or complying with adverse administrative decisions from non-tribal entities — without first asserting sovereign protections — can be construed as consent to their jurisdiction and waiver of sovereign protections. Every external demand, notice, or order must first be weighed against applicable federal Indian law before any response is made. Silence or payment can be construed as admission.",
    citations: [
      "FDCPA, 15 U.S.C. § 1692g — written validation demand MUST be sent before any payment; payment during validation period can restart debt clock",
      "Worcester v. Georgia, 31 U.S. 515 (1832) — foundational: external actors do not have inherent authority over sovereign members",
      "Federal Trust Responsibility — U.S. obligation to protect Indian interests against adverse external actions",
      "Indian Canons of Construction — ambiguous obligations resolved in favor of the Indian",
    ],
    realignmentPath:
      "Before accepting, paying, or complying with any external demand, bring it to the Sovereign Office for a law and logic review. The correct first response to any adverse external notice is: (1) Do not admit or deny; (2) Issue a written request for validation/verification; (3) Assert sovereign status in writing. This preserves all protections while the matter is reviewed.",
  },

  {
    id: "sign_without_review",
    category: "administrative_capitulation",
    severity: "warning",
    patterns: [
      /\b(sign|execute|ratify)\b.{0,40}\b(the\s+)?(agreement|contract|settlement|consent|deed|release|waiver|document)\b.{0,30}\b(they|the\s+(state|county|bank|creditor|collector|servicer|agency))\b.{0,20}\b(sent|provided|gave|is\s+asking|want)\b/i,
      /\b(just\s+)?(sign\s+it|sign\s+the\s+papers?|sign\s+the\s+document)\b/i,
    ],
    negativePatterns: [
      /\b(review|check|before|first|should\s+I|safe\s+to)\b/i,
    ],
    detected: "Potential execution of an unreviewed external legal document",
    doctrinalConflict:
      "Executing any document sent by an external government agency, creditor, or commercial actor — without Sovereign Office review — carries the risk of unknowing waiver of sovereign protections, admission of jurisdictional submission, or creation of enforceable obligations that conflict with tribal law and trust instruments.",
    citations: [
      "Federal Trust Responsibility — the U.S. and the tribal office have an obligation to protect members from adverse legal instruments",
      "FDCPA, 15 U.S.C. § 1692 — any settlement of a debt must follow proper validation procedures",
      "Nonintercourse Act, 25 U.S.C. § 177 — any document purporting to affect Indian land requires federal review",
    ],
    realignmentPath:
      "Bring any document you are being asked to sign to the Sovereign Office before execution. The Chief Justice & Trustee office will review it against role governor standards, trust instrument provisions, and applicable federal law. Do not sign under time pressure — if a signing deadline is being imposed, that pressure itself should be documented as potential coercion.",
  },

  // ── ANCESTRAL COVENANT ───────────────────────────────────────────────────
  {
    id: "permanent_alienation_future_generations",
    category: "ancestral_covenant",
    severity: "critical",
    patterns: [
      /\b(permanently|forever|irrevocably|irreversibly|in\s+perpetuity)\b.{0,40}\b(give\s+(away|up)|transfer|sell|convey|alienate|surrender)\b.{0,30}\b(the\s+)?(land|tribal\s+property|trust\s+assets?|sovereignty|rights?)\b/i,
      /\b(sell|transfer)\b.{0,20}\b(everything|all\s+(of\s+)?(the\s+)?(land|property|assets))\b/i,
    ],
    negativePatterns: [
      /\b(stop|prevent|block|oppose|cannot|must\s+not)\b/i,
    ],
    detected: "Potential permanent or irreversible alienation of tribal resources or rights",
    doctrinalConflict:
      "Under the Federal Trust Responsibility and the foundational principle of intergenerational equity in tribal governance, no present generation has the authority to permanently alienate tribal property or rights. The land, the sovereignty, and the trust instruments belong not only to those living today but to all who come after. This is the deepest covenant — the obligation to the ancestors who held it and the descendants who will inherit it.",
    citations: [
      "Federal Trust Responsibility — fiduciary duty extends to preservation of tribal assets for future generations",
      "Indian Reorganization Act, 25 U.S.C. § 5108 — land held in trust in perpetuity for the benefit of the tribe",
      "Nonintercourse Act, 25 U.S.C. § 177 — the law of the land in perpetuity",
      "Tribal sovereignty doctrine — sovereignty is inherent and inalienable; it does not expire with a generation",
    ],
    realignmentPath:
      "Any action that would permanently remove tribal resources from the community requires: tribal council resolution with full member notice, formal BIA approval, independent legal review, and a documented finding that the action serves the long-term interest of the entire community — not any individual's present need. The Sovereign Office will not support any process that bypasses this covenant.",
  },
];

// ─── SEVERITY RANKING ────────────────────────────────────────────────────────
const SEVERITY_RANK: Record<AlignmentSeverity, number> = {
  notice: 1,
  warning: 2,
  critical: 3,
};

// ─── MA'AT MESSAGE BUILDER ───────────────────────────────────────────────────
function buildMaatMessage(violations: AlignmentViolation[]): string {
  const highest = violations.reduce((max, v) =>
    SEVERITY_RANK[v.severity] > SEVERITY_RANK[max.severity] ? v : max
  , violations[0]);

  const severityHeader: Record<AlignmentSeverity, string> = {
    notice: "LAW & LOGIC NOTICE",
    warning: "LAW & LOGIC ALIGNMENT WARNING",
    critical: "LAW & LOGIC — CRITICAL ALIGNMENT ALERT",
  };

  const lines: string[] = [
    `⚖ ${severityHeader[highest.severity]}`,
    "",
    "The Law & Logic Layer has detected intent that, if acted upon, may place you outside the protection of your sovereign foundations.",
    "",
  ];

  for (const v of violations) {
    lines.push(`▸ ${v.detected.toUpperCase()}`);
    lines.push("");
    lines.push("WHY THIS CONFLICTS WITH YOUR FOUNDATION:");
    lines.push(v.doctrinalConflict);
    lines.push("");
    lines.push("AUTHORITY:");
    v.citations.forEach(c => lines.push(`  • ${c}`));
    lines.push("");
    lines.push("REALIGNMENT PATH:");
    lines.push(v.realignmentPath);
    lines.push("");
    lines.push("─────────────────────────────────────────");
    lines.push("");
  }

  lines.push(
    "This is not a restriction on your freedom — it is the system ensuring you are acting from a position of maximum protection. The foundations were built by those who came before. They hold you. They also hold those who come after.",
  );
  lines.push("");
  lines.push("If you believe this alert is in error, or you need to discuss the situation further, this office stands ready.");

  return lines.join("\n");
}

// ─── MAIN EXPORT ─────────────────────────────────────────────────────────────
export function checkAlignment(text: string, _roleKey?: string): AlignmentResult {
  const violations: AlignmentViolation[] = [];

  for (const rule of ALIGNMENT_RULES) {
    const matches = rule.patterns.some(p => p.test(text));
    if (!matches) continue;

    const negativeMatch = rule.negativePatterns && rule.negativePatterns.length > 0
      ? rule.negativePatterns.some(np => np.test(text))
      : false;
    if (negativeMatch) continue;

    violations.push({
      category: rule.category,
      severity: rule.severity,
      detected: rule.detected,
      doctrinalConflict: rule.doctrinalConflict,
      citations: rule.citations,
      realignmentPath: rule.realignmentPath,
    });
  }

  if (violations.length === 0) {
    return { isAligned: true, severity: null, violations: [], maatMessage: null, governorConflict: false };
  }

  const highestSeverity = violations.reduce((max, v) =>
    SEVERITY_RANK[v.severity] > SEVERITY_RANK[max.severity] ? v : max
  , violations[0]).severity;

  const governorConflict = violations.some(v =>
    v.category === "land_alienation" ||
    v.category === "sovereignty_waiver" ||
    v.category === "trust_conflict" ||
    v.category === "ancestral_covenant"
  );

  return {
    isAligned: false,
    severity: highestSeverity,
    violations,
    maatMessage: buildMaatMessage(violations),
    governorConflict,
  };
}
