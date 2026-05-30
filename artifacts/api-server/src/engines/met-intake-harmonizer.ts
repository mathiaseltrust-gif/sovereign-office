export type MetSeverity = "low" | "moderate" | "elevated" | "critical" | "emergency";

export interface MetProtectedInterest {
  id: string;
  label: string;
  category:
    | "protected_person"
    | "protected_household"
    | "protected_land"
    | "protected_child"
    | "protected_medical"
    | "protected_elder"
    | "protected_record"
    | "tribal_government"
    | "continuity";
  severity: MetSeverity;
  basis: string;
}

export interface MetListenerSignal {
  id: string;
  listenerName: string;
  signalType: string;
  severity: MetSeverity;
  matched: boolean;
  summary: string;
  workflowTrigger: string;
}

export interface MetConflictResolution {
  issue: string;
  resolution: string;
  controllingPrinciple: string;
}

export interface MetIntakeHarmonization {
  registryVersion: string;
  protectedInterests: MetProtectedInterest[];
  listenerSignals: MetListenerSignal[];
  conflictResolutions: MetConflictResolution[];
  harmonizedRiskLevel: MetSeverity;
  harmonizedPosture: string;
  toneDirective: string;
  routingRecommendations: string[];
  documentRecommendations: string[];
  companionGuidance: string;
}

type IntakeLike = {
  indianStatusViolation?: boolean;
  redFlag?: boolean;
  troRecommended?: boolean;
  nfrRecommended?: boolean;
  violations?: string[];
  doctrinesTriggered?: string[];
  canonicalPosture?: string;
  redBannerMessage?: string | null;
};

type DoctrineLike = {
  doctrinesApplied?: string[];
  guardrails?: string[];
  federalLaw?: string[];
  sovereigntyProtections?: string[];
  recommendation?: string;
  overlappingProtections?: string[];
  tribalGovernmentalTriggers?: string[];
};

function includesAny(text: string, patterns: RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(text));
}

function severityRank(level: MetSeverity): number {
  return { low: 1, moderate: 2, elevated: 3, critical: 4, emergency: 5 }[level];
}

function maxSeverity(levels: MetSeverity[]): MetSeverity {
  return levels.reduce<MetSeverity>((current, next) =>
    severityRank(next) > severityRank(current) ? next : current,
  "low");
}

function unique(values: string[]): string[] {
  return values.filter((value, index, array) => value.trim() && array.indexOf(value) === index);
}

export function harmonizeMetIntake(input: {
  text: string;
  matterType: string;
  riskLevel: string;
  intakeResult: IntakeLike;
  doctrineOverlay: DoctrineLike;
}): MetIntakeHarmonization {
  const text = input.text;
  const lower = text.toLowerCase();
  const protectedInterests: MetProtectedInterest[] = [];
  const listenerSignals: MetListenerSignal[] = [];
  const conflictResolutions: MetConflictResolution[] = [];
  const routingRecommendations: string[] = [];
  const documentRecommendations: string[] = [];

  const addInterest = (interest: MetProtectedInterest) => protectedInterests.push(interest);
  const addSignal = (signal: MetListenerSignal) => listenerSignals.push(signal);

  const protectedPerson = includesAny(lower, [
    /member|beneficiary|patient|applicant|claimant|tribal member|individual indian/i,
    /denied\s+(benefits|care|services|access|rights)/i,
  ]);
  if (protectedPerson) {
    addInterest({
      id: "protected_person",
      label: "Protected person / beneficiary interest",
      category: "protected_person",
      severity: input.intakeResult.redFlag ? "elevated" : "moderate",
      basis: "Matter affects an individual member, beneficiary, patient, claimant, or protected Indian status interest.",
    });
  }

  const protectedHousehold = includesAny(lower, [
    /household|family|home|housing|eviction|foreclosure|notice of default|trust home|residence/i,
  ]);
  if (protectedHousehold) {
    addInterest({
      id: "protected_household",
      label: "Protected household / residence continuity",
      category: "protected_household",
      severity: "critical",
      basis: "Matter may affect household stability, housing continuity, family residence, or protected shelter interests.",
    });
  }

  const protectedLand = includesAny(lower, [
    /trust land|restricted land|indian land|tribal land|indian country|allotment|notice of default|foreclosure|lien|encumbrance|recorder|recording rejected/i,
  ]);
  if (protectedLand) {
    addInterest({
      id: "protected_land",
      label: "Protected land / title / recording interest",
      category: "protected_land",
      severity: "critical",
      basis: "Matter implicates trust, restricted, Indian country, title, recording, foreclosure, lien, or encumbrance interests.",
    });
  }

  const protectedChild = includesAny(lower, [
    /icwa|indian child|child custody|foster care|removal of child|custody hearing|no icwa notice/i,
  ]);
  if (protectedChild) {
    addInterest({
      id: "protected_child",
      label: "Protected child / ICWA interest",
      category: "protected_child",
      severity: "emergency",
      basis: "Matter implicates Indian child, ICWA notice, custody, removal, or placement protections.",
    });
  }

  const protectedMedical = includesAny(lower, [
    /medical|healthcare|health care|managed care|m1 status|ai\/an|indian health|ihcia|denied care|treatment|disability|ssa|edd/i,
  ]);
  if (protectedMedical) {
    addInterest({
      id: "protected_medical",
      label: "Protected medical / healthcare continuity",
      category: "protected_medical",
      severity: includesAny(lower, [/emergency|urgent|denied care|loss of care/i]) ? "critical" : "elevated",
      basis: "Matter affects healthcare access, AI/AN status, medical continuity, disability, or benefit administration.",
    });
  }

  const protectedRecord = includesAny(lower, [
    /record|records|archive|court file|filing|seal|certificate|tribal id|document|recorder|indexing/i,
  ]);
  if (protectedRecord) {
    addInterest({
      id: "protected_record",
      label: "Protected record / archive / filing integrity",
      category: "protected_record",
      severity: "elevated",
      basis: "Matter affects official records, filings, seals, archives, indexing, or evidentiary continuity.",
    });
  }

  const tribalGovernment = includesAny(lower, [
    /chief justice|trustee|tribal court|tribal government|sovereign office|tribal administration|charitable trust|tribal medical center/i,
  ]);
  if (tribalGovernment) {
    addInterest({
      id: "tribal_governmental_function",
      label: "Tribal governmental function / institutional continuity",
      category: "tribal_government",
      severity: "critical",
      basis: "Matter implicates tribal governance, court, trustee, medical center, records, or governmental operations.",
    });
  }

  const statusMisclassification = includesAny(lower, [
    /not federally recognized|not recognized|not a valid tribe|not indian|doesn'?t qualify|not eligible for indian|no tribal jurisdiction/i,
  ]);
  addSignal({
    id: "status_misclassification",
    listenerName: "Indian Status / Misclassification Listener",
    signalType: "status_misclassification",
    severity: statusMisclassification ? "critical" : "low",
    matched: statusMisclassification,
    summary: statusMisclassification
      ? "Detected language narrowing or denying Indian, tribal, or jurisdictional status."
      : "No direct status misclassification language detected.",
    workflowTrigger: statusMisclassification ? "status_review" : "none",
  });

  const manufacturedJurisdiction = includesAny(lower, [
    /subject to state jurisdiction|state court has jurisdiction|county ordinance applies|state law governs|local government controls|zoning applies/i,
  ]);
  addSignal({
    id: "manufactured_jurisdiction",
    listenerName: "Manufactured Jurisdiction Listener",
    signalType: "manufactured_jurisdiction",
    severity: manufacturedJurisdiction ? "critical" : "low",
    matched: manufacturedJurisdiction,
    summary: manufacturedJurisdiction
      ? "Detected presumed state/local jurisdiction without threshold federal Indian law analysis."
      : "No direct manufactured jurisdiction assertion detected.",
    workflowTrigger: manufacturedJurisdiction ? "jurisdictional_review" : "none",
  });

  const healthcareInterference = includesAny(lower, [
    /mandatory managed care|managed care|m1 status|ai\/an|indian health|ihcia|denied medical|denied healthcare|health plan/i,
  ]);
  addSignal({
    id: "healthcare_interference",
    listenerName: "Healthcare AI/AN Listener",
    signalType: "healthcare_interference",
    severity: healthcareInterference ? "elevated" : "low",
    matched: healthcareInterference,
    summary: healthcareInterference
      ? "Detected AI/AN healthcare, managed care, or Indian Health Care Improvement Act related interference."
      : "No direct healthcare interference signal detected.",
    workflowTrigger: healthcareInterference ? "healthcare_review" : "none",
  });

  const creditorOrForeclosure = includesAny(lower, [
    /credit bureau|equifax|experian|transunion|debt collector|fdcpa|fcra|notice of default|foreclosure|lien|mortgage|carrington/i,
  ]);
  addSignal({
    id: "creditor_foreclosure_protection",
    listenerName: "Credit / Debt / Foreclosure Listener",
    signalType: "protected_household_land_finance",
    severity: creditorOrForeclosure ? "critical" : "low",
    matched: creditorOrForeclosure,
    summary: creditorOrForeclosure
      ? "Detected credit, debt, lien, foreclosure, or household/land financial threat."
      : "No direct creditor or foreclosure signal detected.",
    workflowTrigger: creditorOrForeclosure ? "foreclosure_or_credit_review" : "none",
  });

  const toneRisk = includesAny(lower, [
    /you must|you are ordered|final warning|threaten|refuse|fraud|invalid|no authority|comply immediately/i,
  ]);
  addSignal({
    id: "tone_alignment",
    listenerName: "Tone Neutralizer / Alignment Listener",
    signalType: "tone_or_posture_risk",
    severity: toneRisk ? "moderate" : "low",
    matched: toneRisk,
    summary: toneRisk
      ? "Detected language that may require tone neutralization, posture control, or non-escalatory reframing."
      : "No major tone risk detected.",
    workflowTrigger: toneRisk ? "tone_neutralization" : "none",
  });

  const matchedSeverities = listenerSignals.filter(s => s.matched).map(s => s.severity);
  const interestSeverities = protectedInterests.map(i => i.severity);
  const inputRisk = (input.riskLevel as MetSeverity) || "low";
  const harmonizedRiskLevel = maxSeverity([inputRisk, ...matchedSeverities, ...interestSeverities]);

  if (statusMisclassification && protectedPerson) {
    conflictResolutions.push({
      issue: "Administrative status denial conflicts with protected person/beneficiary interest.",
      resolution: "Do not allow narrow administrative classifications to defeat protected Indian interests. Route for status review and preserve claims.",
      controllingPrinciple: "Indian Canons of Construction; totality of protected interests; federal trust responsibility.",
    });
  }

  if (manufacturedJurisdiction && (protectedLand || tribalGovernment)) {
    conflictResolutions.push({
      issue: "State/local jurisdiction assertion conflicts with protected land or tribal governmental function.",
      resolution: "Apply federal preemption and jurisdictional coherence review before any state-law framing is accepted.",
      controllingPrinciple: "Worcester doctrine; Non-Intercourse Act; Indian Country jurisdiction; federal supremacy.",
    });
  }

  if (toneRisk) {
    conflictResolutions.push({
      issue: "High-pressure or adversarial language may distort intake posture.",
      resolution: "Neutralize tone while preserving urgency, rights, facts, and non-waiver posture.",
      controllingPrinciple: "Alignment protocol: calm, exact, non-waiver, remedy-oriented communication.",
    });
  }

  if (protectedChild) {
    routingRecommendations.push("Immediate child/ICWA review; officer escalation; emergency protective posture if removal/custody timeline is active.");
    documentRecommendations.push("TRO-supporting declaration", "ICWA notice / transfer demand", "Protective order review");
  }
  if (protectedLand || creditorOrForeclosure) {
    routingRecommendations.push("Land/household protection review; authority directory lookup; federal review posture; case file preservation.");
    documentRecommendations.push("Notice of Federal Review", "Jurisdictional Statement", "Cease and Desist", "FDCPA validation demand", "Credit Bureau Dispute Notice");
  }
  if (protectedMedical || healthcareInterference) {
    routingRecommendations.push("Healthcare AI/AN review; managed care/status review; benefits continuity preservation.");
    documentRecommendations.push("Medical Protection Decree", "Disability Enforcement Notice", "Trust Responsibility Invocation Notice");
  }
  if (statusMisclassification || manufacturedJurisdiction) {
    routingRecommendations.push("Jurisdiction/status coherence review; preserve Indian status and tribal governmental posture.");
    documentRecommendations.push("Sovereign Restoration Declaration", "Notice of Tribal Jurisdiction", "Federal Preemption Notice");
  }

  const toneDirective = toneRisk
    ? "Neutralize tone: remove reactive phrasing, preserve facts, preserve urgency, preserve non-waiver and sovereign posture."
    : "Maintain calm, precise, non-waiver, remedy-oriented posture.";

  const harmonizedPosture = (() => {
    if (harmonizedRiskLevel === "emergency") return "EMERGENCY — Protected person/child/household interest requires immediate officer review and protective routing.";
    if (harmonizedRiskLevel === "critical") return "CRITICAL — Protected interests and jurisdictional/legal risk detected. Preserve rights, open case file, route for review, and prepare official notice.";
    if (harmonizedRiskLevel === "elevated") return "ELEVATED — Protected-interest signals detected. Continue intake with review gate and recommended document preparation.";
    if (harmonizedRiskLevel === "moderate") return "MODERATE — Potential protected-interest issue. Continue intake and preserve signal history.";
    return "STANDARD — No major protected-interest conflict detected. Continue normal intake.";
  })();

  const companionGuidance = [
    harmonizedPosture,
    toneDirective,
    conflictResolutions.length > 0
      ? `Resolve conflicts using: ${conflictResolutions.map(c => c.controllingPrinciple).join(" | ")}`
      : "No conflict override required at this stage.",
  ].join(" ");

  return {
    registryVersion: "MET-HARMONIZER-2026-05-29",
    protectedInterests,
    listenerSignals,
    conflictResolutions,
    harmonizedRiskLevel,
    harmonizedPosture,
    toneDirective,
    routingRecommendations: unique(routingRecommendations),
    documentRecommendations: unique(documentRecommendations),
    companionGuidance,
  };
}
