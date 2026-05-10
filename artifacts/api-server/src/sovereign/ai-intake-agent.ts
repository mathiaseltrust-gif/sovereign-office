import { runIntakeFilter, type IntakeFilterResult } from "./intake-filter";
import { queryLawDb, ensureLawDbSeeded } from "./law-db";
import { logger } from "../lib/logger";

export interface IntakeAgentInput {
  text: string;
  context?: {
    caseType?: string;
    actorType?: string;
    landStatus?: string;
    actionType?: string;
    childInvolved?: boolean;
    tribe?: string;
    court?: string;
  };
}

export interface LawReference {
  type: "federal" | "tribal" | "doctrine";
  title: string;
  citation: string;
  excerpt: string;
  relevanceReason: string;
}

export interface IntakeAgentReport {
  summary: string;
  riskLevel: "low" | "moderate" | "elevated" | "critical" | "emergency";
  intakeFlags: IntakeFilterResult;
  doctrinesApplied: string[];
  lawRefs: LawReference[];
  recommendedActions: string[];
  recommendedInstruments: string[];
  factSummary: string;
  officerNotes: string;
  nfrRecommended: boolean;
  troRecommended: boolean;
  aiConfidence: number;
  processedAt: string;
}

const RISK_TAGS: Record<string, string[]> = {
  icwa: ["icwa", "child-welfare", "tribal-jurisdiction", "placement", "tro"],
  trust_land: ["trust-land", "ira", "federal-trust", "alienation"],
  state_overreach: ["state-preemption", "tribal-sovereignty", "federal-preemption"],
  indian_status: ["canons-of-construction", "statutory-interpretation", "indian-favor"],
  welfare: ["welfare", "emergency", "health", "snyder"],
  protection: ["protection-order", "domestic-violence", "full-faith-credit"],
  jurisdiction: ["tribal-jurisdiction", "state-jurisdiction", "indian-country"],
};

function detectTagsFromText(text: string, context?: IntakeAgentInput["context"]): string[] {
  const tags = new Set<string>();
  const lower = text.toLowerCase();

  if (/icwa|indian child|custody|placement|foster|adoption|removal|welfare act/.test(lower)) {
    RISK_TAGS.icwa.forEach(t => tags.add(t));
  }
  if (/trust land|allotment|fee land|trust status|indian country|restricted land/.test(lower)) {
    RISK_TAGS.trust_land.forEach(t => tags.add(t));
  }
  if (/state court|county|state law|state jurisdiction|local government|zoning|tax/.test(lower)) {
    RISK_TAGS.state_overreach.forEach(t => tags.add(t));
  }
  if (/indian status|not indian|blood quantum|degree of blood|recognized/.test(lower)) {
    RISK_TAGS.indian_status.forEach(t => tags.add(t));
  }
  if (/welfare|health|medical|snyder|benefit|assistance|food|housing/.test(lower)) {
    RISK_TAGS.welfare.forEach(t => tags.add(t));
  }
  if (/protective order|protection order|domestic|vawa|restraining/.test(lower)) {
    RISK_TAGS.protection.forEach(t => tags.add(t));
  }
  if (/jurisdiction|authority|sovereignty|sovereign|tribal court|federal court/.test(lower)) {
    RISK_TAGS.jurisdiction.forEach(t => tags.add(t));
  }

  if (context?.childInvolved) {
    RISK_TAGS.icwa.forEach(t => tags.add(t));
  }
  if (context?.landStatus === "trust") {
    RISK_TAGS.trust_land.forEach(t => tags.add(t));
  }

  return Array.from(tags);
}

function scoreRisk(flags: IntakeFilterResult): number {
  let score = 0;
  if (flags.indianStatusViolation) score += 40;
  if (flags.troRecommended) score += 30;
  if (flags.nfrRecommended) score += 20;
  if (flags.redFlag) score += 10;
  score += Math.min(flags.violations.length * 5, 20);
  return Math.min(score, 100);
}

function riskLevelFromScore(score: number, flags: IntakeFilterResult): IntakeAgentReport["riskLevel"] {
  if (flags.indianStatusViolation && flags.troRecommended) return "emergency";
  if (flags.indianStatusViolation) return "critical";
  if (flags.troRecommended) return "elevated";
  if (flags.nfrRecommended) return "moderate";
  if (score > 0) return "moderate";
  return "low";
}

function buildRecommendedActions(flags: IntakeFilterResult, riskLevel: IntakeAgentReport["riskLevel"]): string[] {
  const actions: string[] = [];

  if (riskLevel === "emergency") {
    actions.push("IMMEDIATE: Generate TRO-supporting declaration for immediate filing");
    actions.push("IMMEDIATE: Notify Chief Justice & Trustee for emergency review");
    actions.push("IMMEDIATE: File ICWA Notice with tribe and Bureau of Indian Affairs");
    actions.push("IMMEDIATE: Request stay of all state court proceedings");
  }
  if (riskLevel === "critical" || riskLevel === "emergency") {
    actions.push("Generate Notice of Federal Review (NFR) documenting all violations");
    actions.push("Apply Indian Canons of Construction to all interpretations");
    actions.push("Review all state court filings for ICWA compliance");
    actions.push("Escalate to Chief Justice & Trustee within 24 hours");
  }
  if (flags.nfrRecommended) {
    actions.push("Issue Notice of Federal Review citing applicable federal statutes");
    actions.push("Document violations in audit log with doctrine references");
    actions.push("Schedule officer review within 48 hours");
  }
  if (flags.troRecommended) {
    actions.push("Prepare TRO declaration under emergency welfare authority");
    actions.push("Identify imminent harm factors for court declaration");
  }
  if (flags.violations.some(v => v.includes("ICWA"))) {
    actions.push("Generate ICWA Notice of Proceeding (25 U.S.C. § 1912(a))");
    actions.push("Verify tribal enrollment status of Indian child");
    actions.push("Apply ICWA placement preferences (25 U.S.C. § 1915)");
  }
  if (flags.violations.some(v => v.includes("trust land") || v.includes("land"))) {
    actions.push("File Trust Deed Declaration in county recorder chain of title");
    actions.push("Issue Jurisdictional Statement to relevant agencies");
    actions.push("Notify Bureau of Indian Affairs of trust land status violation");
  }
  if (actions.length === 0) {
    actions.push("Standard intake processing — no immediate escalation required");
    actions.push("File for officer review within standard 5-day processing window");
  }
  return actions;
}

function buildRecommendedInstruments(flags: IntakeFilterResult, riskLevel: IntakeAgentReport["riskLevel"]): string[] {
  const instruments: string[] = [];
  if (flags.troRecommended) instruments.push("TRO_ICWA", "TRO_GENERAL");
  if (flags.violations.some(v => v.includes("ICWA"))) instruments.push("ICWA_NOTICE");
  if (flags.nfrRecommended) instruments.push("NFR");
  if (riskLevel === "emergency") instruments.push("EMERGENCY_WELFARE");
  if (flags.violations.some(v => v.includes("land"))) instruments.push("TRUST_DEED", "JURISDICTIONAL_STATEMENT");
  if (flags.violations.some(v => v.includes("overreach"))) instruments.push("JURISDICTIONAL_STATEMENT");
  return [...new Set(instruments)];
}

function buildFactSummary(text: string, flags: IntakeFilterResult, lawRefs: LawReference[]): string {
  const lines: string[] = ["FACT SUMMARY — AI INTAKE AGENT ANALYSIS"];
  lines.push("");
  lines.push(`INTAKE TEXT (excerpt): ${text.substring(0, 300)}${text.length > 300 ? "..." : ""}`);
  lines.push("");
  lines.push(`VIOLATIONS DETECTED: ${flags.violations.length > 0 ? flags.violations.join("; ") : "None"}`);
  if (flags.doctrinesTriggered.length > 0) {
    lines.push("");
    lines.push("DOCTRINES TRIGGERED:");
    flags.doctrinesTriggered.forEach(d => lines.push(`  • ${d}`));
  }
  if (lawRefs.length > 0) {
    lines.push("");
    lines.push("APPLICABLE LAW IDENTIFIED:");
    lawRefs.slice(0, 5).forEach(r => lines.push(`  • ${r.citation}: ${r.relevanceReason}`));
  }
  lines.push("");
  lines.push(`CANONICAL POSTURE: ${flags.canonicalPosture}`);
  return lines.join("\n");
}

function buildOfficerNotes(flags: IntakeFilterResult, riskLevel: IntakeAgentReport["riskLevel"], instruments: string[]): string {
  const lines: string[] = [];
  if (riskLevel === "emergency") {
    lines.push("⚑ EMERGENCY — Do not delay. Immediate TRO and ICWA filing required. Chief Justice must be notified immediately.");
  } else if (riskLevel === "critical") {
    lines.push("⚐ CRITICAL — Federal Indian law violations detected. NFR required. Escalate to supervising officer within 24 hours.");
  } else if (riskLevel === "elevated") {
    lines.push("▲ ELEVATED — TRO indicators present. Prepare declaration. Schedule urgent review.");
  } else if (riskLevel === "moderate") {
    lines.push("▪ MODERATE — Federal Indian law concerns identified. Schedule officer review within 48 hours.");
  } else {
    lines.push("✓ LOW — Standard intake. No immediate escalation needed. Process normally.");
  }
  if (instruments.length > 0) {
    lines.push(`Recommended instruments: ${instruments.join(", ")}`);
  }
  if (flags.redBannerMessage) {
    lines.push(`Alert: ${flags.redBannerMessage}`);
  }
  return lines.join("\n");
}

export async function runAiIntakeAgent(input: IntakeAgentInput): Promise<IntakeAgentReport> {
  await ensureLawDbSeeded();
  const processedAt = new Date().toISOString();

  const intakeFlags = runIntakeFilter(input.text);
  const tags = detectTagsFromText(input.text, input.context);
  const lawData = await queryLawDb(tags);

  const lawRefs: LawReference[] = [];
  for (const f of lawData.federalLaws.slice(0, 6)) {
    lawRefs.push({
      type: "federal",
      title: f.title,
      citation: f.citation,
      excerpt: f.body.substring(0, 200) + "...",
      relevanceReason: `Applicable federal statute — tags: ${f.tags.filter(t => tags.includes(t)).join(", ")}`,
    });
  }
  for (const t of lawData.tribalLaws.slice(0, 3)) {
    lawRefs.push({
      type: "tribal",
      title: t.title,
      citation: t.citation,
      excerpt: t.body.substring(0, 200) + "...",
      relevanceReason: `Applicable tribal law — tags: ${t.tags.filter(tg => tags.includes(tg)).join(", ")}`,
    });
  }
  for (const d of lawData.doctrines.slice(0, 5)) {
    lawRefs.push({
      type: "doctrine",
      title: d.caseName,
      citation: d.citation,
      excerpt: d.summary.substring(0, 200) + "...",
      relevanceReason: `Controlling doctrine — tags: ${d.tags.filter(t => tags.includes(t)).join(", ")}`,
    });
  }

  const doctrinesApplied = [
    ...intakeFlags.doctrinesTriggered,
    ...lawData.doctrines.slice(0, 4).map(d => `${d.caseName} — ${d.citation}: ${d.summary.substring(0, 80)}`),
  ];

  const riskScore = scoreRisk(intakeFlags);
  const riskLevel = riskLevelFromScore(riskScore, intakeFlags);
  const recommendedActions = buildRecommendedActions(intakeFlags, riskLevel);
  const recommendedInstruments = buildRecommendedInstruments(intakeFlags, riskLevel);
  const factSummary = buildFactSummary(input.text, intakeFlags, lawRefs);
  const officerNotes = buildOfficerNotes(intakeFlags, riskLevel, recommendedInstruments);

  const summary = `AI Intake Analysis — Risk: ${riskLevel.toUpperCase()}. ${
    intakeFlags.violations.length > 0
      ? `${intakeFlags.violations.length} violation(s) detected: ${intakeFlags.violations.join("; ")}.`
      : "No violations detected."
  } ${intakeFlags.troRecommended ? "TRO recommended. " : ""}${intakeFlags.nfrRecommended ? "NFR recommended. " : ""}${
    lawRefs.length
  } relevant law references identified. ${recommendedActions.length} action(s) recommended.`;

  const aiConfidence = Math.min(
    60 + (intakeFlags.violations.length * 8) + (lawRefs.length * 2) + (tags.length * 1),
    97,
  );

  logger.info(
    { riskLevel, violations: intakeFlags.violations.length, lawRefs: lawRefs.length, troRecommended: intakeFlags.troRecommended, nfrRecommended: intakeFlags.nfrRecommended },
    "AI intake agent analysis complete",
  );

  return {
    summary,
    riskLevel,
    intakeFlags,
    doctrinesApplied,
    lawRefs,
    recommendedActions,
    recommendedInstruments,
    factSummary,
    officerNotes,
    nfrRecommended: intakeFlags.nfrRecommended,
    troRecommended: intakeFlags.troRecommended,
    aiConfidence,
    processedAt,
  };
}
