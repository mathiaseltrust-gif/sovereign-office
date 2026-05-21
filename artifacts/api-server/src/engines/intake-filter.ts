import { logger } from "../lib/logger";

export interface IntakeFilterResult {
  indianStatusViolation: boolean;
  redFlag: boolean;
  troRecommended: boolean;
  nfrRecommended: boolean;
  violations: string[];
  doctrinesTriggered: string[];
  canonicalPosture: string;
  redBannerMessage: string | null;
}

const NARROWING_PATTERNS = [
  /not\s+(a\s+)?(federally\s+)?recognized\s+(indian|tribe|tribal)/i,
  /no\s+longer\s+(an?\s+)?indian/i,
  /lost\s+(their\s+)?indian\s+status/i,
  /not\s+eligible\s+for\s+indian\s+benefits/i,
  /doesn[''']t\s+qualify\s+as\s+indian/i,
  /isn[''']t\s+(a\s+)?real\s+(indian|tribe)/i,
  /mixed[\s-]blood/i,
  /degree\s+of\s+indian\s+blood/i,
  /insufficient\s+indian\s+blood/i,
];

const TRIBAL_STATUS_DENIAL_PATTERNS = [
  /tribe\s+is\s+not\s+recognized/i,
  /not\s+a\s+valid\s+tribe/i,
  /dissolved\s+tribe/i,
  /terminated\s+tribe/i,
  /no\s+tribal\s+jurisdiction/i,
  /tribe\s+has\s+no\s+authority/i,
  /tribal\s+government\s+is\s+invalid/i,
];

const LAND_MISCLASSIFICATION_PATTERNS = [
  /trust\s+land\s+is\s+(now\s+)?fee/i,
  /no\s+longer\s+(in\s+)?trust/i,
  /fee\s+(land|status)\s+(despite|although)/i,
  /removed\s+from\s+trust/i,
  /not\s+indian\s+country/i,
  /state\s+jurisdiction\s+over\s+trust/i,
];

const ICWA_VIOLATION_PATTERNS = [
  /icwa\s+does\s+not\s+apply/i,
  /not\s+an\s+icwa\s+case/i,
  /child\s+is\s+not\s+(an?\s+)?indian\s+child/i,
  /deny\s+icwa\s+transfer/i,
  /no\s+icwa\s+notice/i,
  /without\s+icwa\s+notice/i,
  /bypass\s+icwa/i,
  /circumvent\s+icwa/i,
  /ignore\s+icwa/i,
  /removed?\s+(native|indian|tribal)\s+child/i,
  /took\s+(the\s+)?(native|indian|tribal)\s+child/i,
  /failed\s+to\s+(provide|give|send)\s+icwa/i,
  /no\s+notice\s+to\s+(the\s+)?tribe/i,
];

const STATE_OVERREACH_PATTERNS = [
  /state\s+court\s+has\s+jurisdiction\s+over\s+indian/i,
  /county\s+ordinance\s+applies\s+to\s+(tribe|tribal|indian)/i,
  /state\s+law\s+governs\s+this\s+tribe/i,
  /local\s+government\s+controls\s+reservation/i,
  /zoning\s+applies\s+to\s+trust\s+land/i,
  /tax\s+(the\s+)?tribe/i,
  /state\s+tax\s+on\s+indian\s+income/i,
];

const IMMINENT_HARM_PATTERNS = [
  /removal\s+of\s+(child|children|indian\s+child)/i,
  /immediate\s+removal/i,
  /emergency\s+removal/i,
  /placed\s+in\s+foster\s+care/i,
  /custody\s+hearing\s+(today|tomorrow|tonight|this\s+week)/i,
  /threatened\s+with\s+removal/i,
  /at\s+risk\s+of\s+removal/i,
  /court\s+order\s+for\s+removal/i,
  /denied\s+(medical|health)\s+(care|services|treatment)/i,
  /medical\s+emergency/i,
];

// ── ADMINISTRATIVE PROCESS / DEBT / CREDIT BUREAU VIOLATIONS ──────────────────
// Detects unauthorized commercial and creditor actions against a sovereign member,
// including credit bureau reporting, mortgage collection on restricted land,
// forced closure / foreclosure, and failure to validate debt.
const ADMIN_PROCESS_PATTERNS = [
  // Credit bureau / credit reporting
  /place[sd]?\s+(something|things?|item[s]?|account[s]?|charge[s]?|lien[s]?|debt[s]?)?\s*(on|to)?\s*(my|our|the)?\s*(personal\s+)?credit/i,
  /report(ed|ing|s)?\s+to\s+(a\s+)?(credit\s+(bureau|agenc|reporting)|equifax|experian|transunion)/i,
  /credit\s+(bureau|report|file|record)\s+(reporting|posting|listing|adding|placing)/i,
  /(negative|derogatory|adverse)\s+(mark|entry|item|account|report)\s+on\s+(my|our|the)?\s*credit/i,
  /put\s+(something|a\s+charge|an?\s+(account|debt|lien))\s+on\s+(my|our|the)?\s*(person|credit)/i,
  /posting\s+on\s+(my|our|the)?\s*(person|personal|credit)/i,
];

const DEBT_COLLECTION_PATTERNS = [
  // Unauthorized debt collection against sovereign member
  /(carrington|mortgage\s+company|servicer|creditor|debt\s+collector|collection\s+agenc)\s+(is\s+)?(attempting|trying|has|sent|reported|placed)/i,
  /force\s*(d|ful)?\s*(clos(e|ure|ing)|foreclos(e|ure|ing)|sell|auction)/i,
  /foreclos(e|ure|ing)\s+(on\s+)?(restricted|trust|indian|tribal|protected)\s+land/i,
  /attempting\s+to\s+(foreclose|force\s+clos|sell)\s+(the|our|my|this)\s+(land|property|home)/i,
  /collect(ion|ing)?\s+(on|against)\s+(restricted|trust|protected|indian|tribal)\s+(land|property|status)/i,
  /debt\s+(collector|collection|agenc)\s+(disregard|ignor|violat|overrid)/i,
  /did\s+not\s+validate\s+(the\s+)?debt/i,
  /failure\s+to\s+validate\s+(the\s+)?debt/i,
  /no\s+debt\s+validation/i,
  /sent\s+(multiple\s+)?(notices?|orders?|letters?)\s+(and\s+)?(no\s+response|ignored|disregarded)/i,
];

const UNAUTHORIZED_LIEN_PATTERNS = [
  /lien\s+(placed|filed|recorded|attached)\s+(on|against)\s+(restricted|trust|protected|indian|tribal)\s+(land|property)/i,
  /unauthorized\s+(lien|encumbrance|charge)\s+on\s+(indian|trust|restricted|sovereign|tribal)/i,
  /cloud\s+(on|over)\s+(the\s+)?(title|land|property)/i,
  /encumber(ed|ing)?\s+(trust|restricted|indian|tribal)\s+land/i,
];

export function runIntakeFilter(text: string): IntakeFilterResult {
  const violations: string[] = [];
  const doctrinesTriggered: string[] = [];
  let indianStatusViolation = false;
  let troRecommended = false;
  let nfrRecommended = false;

  for (const pattern of NARROWING_PATTERNS) {
    if (pattern.test(text)) {
      indianStatusViolation = true;
      violations.push("Narrowing or misuse of 'Indian' status detected");
      doctrinesTriggered.push("Indian Canons of Construction — ambiguities must be resolved in favor of Indians (Montana v. Blackfeet Tribe, 471 U.S. 759 (1985))");
      doctrinesTriggered.push("Carpenter v. Murphy, 587 U.S. 827 (2019) — Indian status broadly construed");
      break;
    }
  }

  for (const pattern of TRIBAL_STATUS_DENIAL_PATTERNS) {
    if (pattern.test(text)) {
      indianStatusViolation = true;
      violations.push("Denial or challenge to tribal status detected");
      doctrinesTriggered.push("Worcester v. Georgia, 31 U.S. 515 (1832) — State laws have no force over recognized tribes");
      doctrinesTriggered.push("Federal recognition doctrine — federally recognized tribes hold sovereign status");
      nfrRecommended = true;
      break;
    }
  }

  for (const pattern of LAND_MISCLASSIFICATION_PATTERNS) {
    if (pattern.test(text)) {
      indianStatusViolation = true;
      violations.push("Misclassification of Indian trust land status detected");
      doctrinesTriggered.push("Indian Land Consolidation Act (25 U.S.C. § 2201) — trust land status is federally protected");
      doctrinesTriggered.push("Federal Trust Responsibility — U.S. holds fiduciary duty over Indian trust lands");
      nfrRecommended = true;
      break;
    }
  }

  for (const pattern of ICWA_VIOLATION_PATTERNS) {
    if (pattern.test(text)) {
      indianStatusViolation = true;
      violations.push("Potential ICWA violation detected");
      doctrinesTriggered.push("Indian Child Welfare Act, 25 U.S.C. §§ 1901–1963 — mandatory federal floor for Indian child proceedings");
      doctrinesTriggered.push("Brackeen v. Haaland, 599 U.S. 255 (2023) — ICWA upheld as constitutional");
      troRecommended = true;
      nfrRecommended = true;
      break;
    }
  }

  for (const pattern of STATE_OVERREACH_PATTERNS) {
    if (pattern.test(text)) {
      violations.push("State or county jurisdictional overreach over Indian land or tribe detected");
      doctrinesTriggered.push("FEDERAL PREEMPTION — McClanahan v. Arizona State Tax Comm'n, 411 U.S. 164 (1973)");
      doctrinesTriggered.push("Worcester v. Georgia — state laws of no force within Indian territory");
      nfrRecommended = true;
      break;
    }
  }

  for (const pattern of IMMINENT_HARM_PATTERNS) {
    if (pattern.test(text)) {
      troRecommended = true;
      break;
    }
  }

  // ── ADMINISTRATIVE PROCESS: credit bureau / debt collection / forced closure ──
  let adminProcessViolation = false;

  for (const pattern of ADMIN_PROCESS_PATTERNS) {
    if (pattern.test(text)) {
      adminProcessViolation = true;
      violations.push("Unauthorized credit bureau reporting against a sovereign member — potential FCRA violation (15 U.S.C. § 1681s-2) and FDCPA violation (15 U.S.C. § 1692)");
      doctrinesTriggered.push("Fair Credit Reporting Act (FCRA), 15 U.S.C. § 1681 — member has right to dispute and demand removal of inaccurate/unauthorized reporting");
      doctrinesTriggered.push("Fair Debt Collection Practices Act (FDCPA), 15 U.S.C. § 1692g — creditor must validate debt within 30 days of written demand");
      doctrinesTriggered.push("Sovereign status as an identifiable Indian — commercial creditor obligations do not override protected status under federal Indian law");
      nfrRecommended = true;
      break;
    }
  }

  for (const pattern of DEBT_COLLECTION_PATTERNS) {
    if (pattern.test(text)) {
      adminProcessViolation = true;
      violations.push("Unauthorized debt collection / forced closure attempt against a sovereign member on restricted or protected land");
      doctrinesTriggered.push("Nonintercourse Act, 25 U.S.C. § 177 — no encumbrance or transfer of Indian land is valid without federal approval; unauthorized mortgage action is void");
      doctrinesTriggered.push("Federal Trust Responsibility — U.S. holds fiduciary duty to protect restricted Indian land from unauthorized commercial action");
      doctrinesTriggered.push("FDCPA, 15 U.S.C. § 1692 — debt must be validated in writing; collection must cease during validation period");
      nfrRecommended = true;
      break;
    }
  }

  for (const pattern of UNAUTHORIZED_LIEN_PATTERNS) {
    if (pattern.test(text)) {
      adminProcessViolation = true;
      violations.push("Unauthorized lien or encumbrance placed on Indian/restricted land — void under Nonintercourse Act");
      doctrinesTriggered.push("Nonintercourse Act, 25 U.S.C. § 177 — all unauthorized encumbrances on Indian land are void ab initio");
      doctrinesTriggered.push("Indian Land Consolidation Act (25 U.S.C. § 2201) — trust land status is federally protected from commercial encumbrance");
      nfrRecommended = true;
      break;
    }
  }

  // If admin process + restricted land context — escalate posture
  const landContextPresent = /restricted\s+land|trust\s+land|indian\s+land|tribal\s+land|protected\s+(land|status)|indian\s+country/i.test(text);
  if (adminProcessViolation && landContextPresent) {
    violations.push("Administrative process invoked on restricted/protected land without federal authorization — void under federal Indian law");
    doctrinesTriggered.push("Worcester v. Georgia, 31 U.S. 515 (1832) — state and commercial actors have no force over protected Indian land");
    troRecommended = true;
  }

  const redFlag = violations.length > 0 || troRecommended;

  let redBannerMessage: string | null = null;
  if (adminProcessViolation) {
    redBannerMessage = `ADMINISTRATIVE PROCESS VIOLATION — Unauthorized creditor/credit bureau action detected against a sovereign member. FDCPA debt validation demand required. Credit bureau dispute notice recommended. ${landContextPresent ? "Nonintercourse Act (25 U.S.C. § 177) applies — commercial action on restricted land is void." : ""} Generate Cease & Desist and Credit Dispute Notice immediately.`;
  } else if (violations.length > 0) {
    redBannerMessage = `RED FLAG — Indian Status / Jurisdiction Violation Detected: ${violations.join("; ")}. Federal Indian law applies. Indian Canons of Construction mandate resolution in favor of Indian interests.`;
  } else if (troRecommended && !indianStatusViolation) {
    redBannerMessage = "WARNING — Imminent harm indicators detected. TRO posture recommended.";
  }

  let canonicalPosture = "Standard intake — no violations detected. Continue processing.";
  if (indianStatusViolation && troRecommended) {
    canonicalPosture = "EMERGENCY — Indian status violation with imminent harm. Apply full ICWA protections. Generate TRO-supporting declaration immediately.";
  } else if (adminProcessViolation && landContextPresent) {
    canonicalPosture = "CRITICAL — Unauthorized administrative/creditor process on restricted land. Debt is void under Nonintercourse Act. Issue FDCPA validation demand + Credit Bureau Dispute Notice + Cease & Desist to creditor. Escalate to Chief Justice & Trustee.";
  } else if (adminProcessViolation) {
    canonicalPosture = "ELEVATED — Unauthorized administrative process against sovereign member. Issue FDCPA debt validation demand and Credit Bureau Dispute Notice. NFR posture recommended.";
  } else if (indianStatusViolation && nfrRecommended) {
    canonicalPosture = "CRITICAL — Indian status or jurisdiction violation. Apply Indian Canons of Construction. Generate NFR document. Escalate to Chief Justice & Trustee.";
  } else if (troRecommended) {
    canonicalPosture = "URGENT — Imminent harm indicators present. TRO posture recommended. Alert Intake Officer immediately.";
  } else if (nfrRecommended) {
    canonicalPosture = "ELEVATED — Federal Indian law violations detected. NFR posture recommended. Review under Worcester doctrine.";
  }

  if (violations.length > 0) {
    logger.warn({ violations, doctrinesTriggered, troRecommended, nfrRecommended }, "Intake red-flag filter triggered");
  }

  return {
    indianStatusViolation,
    redFlag,
    troRecommended,
    nfrRecommended,
    violations,
    doctrinesTriggered,
    canonicalPosture,
    redBannerMessage,
  };
}
