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

  const redFlag = violations.length > 0 || troRecommended;

  let redBannerMessage: string | null = null;
  if (violations.length > 0) {
    redBannerMessage = `RED FLAG — Indian Status / Jurisdiction Violation Detected: ${violations.join("; ")}. Federal Indian law applies. Indian Canons of Construction mandate resolution in favor of Indian interests.`;
  } else if (troRecommended && !indianStatusViolation) {
    redBannerMessage = "WARNING — Imminent harm indicators detected. TRO posture recommended.";
  }

  let canonicalPosture = "Standard intake — no violations detected. Continue processing.";
  if (indianStatusViolation && troRecommended) {
    canonicalPosture = "EMERGENCY — Indian status violation with imminent harm. Apply full ICWA protections. Generate TRO-supporting declaration immediately.";
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
