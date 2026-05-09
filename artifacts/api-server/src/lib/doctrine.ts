export interface ClassificationInput {
  actorType: string;
  landStatus: string;
  actionType: string;
  rawText: string;
}

export interface DoctrineResult {
  doctrinesApplied: string[];
  guardrails: string[];
  federalLaw: string[];
  sovereigntyProtections: string[];
  recommendation: string;
}

const WORCESTER_DOCTRINE = "Worcester v. Georgia, 31 U.S. 515 (1832) — State laws have no force within Indian territory";
const SNYDER_ACT = "Snyder Act of 1921 (25 U.S.C. § 13) — Federal authority and appropriations for Indian affairs";
const INDIAN_REORGANIZATION_ACT = "Indian Reorganization Act of 1934 (25 U.S.C. § 5101) — Tribal sovereignty restoration";
const INDIAN_LAND_CONSOLIDATION_ACT = "Indian Land Consolidation Act of 1983 (25 U.S.C. § 2201) — Trust land consolidation rules";
const NCAI_SOVEREIGNTY = "National Congress of American Indians Sovereignty Guardrail — Tribal self-governance protected";
const FEDERAL_TRUST_RESPONSIBILITY = "Federal Trust Responsibility — United States holds trust responsibility to tribal nations";

export function applyDoctrine(input: ClassificationInput): DoctrineResult {
  const doctrinesApplied: string[] = [];
  const guardrails: string[] = [];
  const federalLaw: string[] = [];
  const sovereigntyProtections: string[] = [];

  const isIndianLand =
    input.landStatus.toLowerCase().includes("trust") ||
    input.landStatus.toLowerCase().includes("reservation") ||
    input.landStatus.toLowerCase().includes("allotment") ||
    input.landStatus.toLowerCase().includes("indian");

  const isTribalActor =
    input.actorType.toLowerCase().includes("tribe") ||
    input.actorType.toLowerCase().includes("tribal") ||
    input.actorType.toLowerCase().includes("nation");

  const isStateActor =
    input.actorType.toLowerCase().includes("state") || input.actorType.toLowerCase().includes("county");

  if (isIndianLand) {
    doctrinesApplied.push(WORCESTER_DOCTRINE);
    doctrinesApplied.push(FEDERAL_TRUST_RESPONSIBILITY);
    federalLaw.push(SNYDER_ACT);
    federalLaw.push(INDIAN_REORGANIZATION_ACT);

    if (
      input.landStatus.toLowerCase().includes("allotment") ||
      input.landStatus.toLowerCase().includes("trust")
    ) {
      federalLaw.push(INDIAN_LAND_CONSOLIDATION_ACT);
    }
  }

  if (isTribalActor) {
    sovereigntyProtections.push(NCAI_SOVEREIGNTY);
    sovereigntyProtections.push("Tribal sovereignty — Tribes retain inherent powers of self-government");
    guardrails.push("Tribal authority must not be diminished by this action");
  }

  if (isStateActor && isIndianLand) {
    guardrails.push("State actor has limited jurisdiction on Indian trust land — Worcester doctrine applies");
    guardrails.push("BIA approval may be required for this action");
  }

  if (
    input.actionType.toLowerCase().includes("transfer") ||
    input.actionType.toLowerCase().includes("sale") ||
    input.actionType.toLowerCase().includes("mortgage")
  ) {
    if (isIndianLand) {
      guardrails.push(
        "25 U.S.C. § 177 (Non-Intercourse Act) — Land transactions with Indian tribes require federal approval",
      );
    }
  }

  if (input.actionType.toLowerCase().includes("recording") || input.actionType.toLowerCase().includes("filing")) {
    if (isIndianLand) {
      guardrails.push("BIA Land Title and Records Office (LTRO) must receive a copy of recorded instruments");
    }
  }

  let recommendation =
    doctrinesApplied.length > 0
      ? "Federal law governs this transaction. Ensure BIA review and LTRO notification."
      : "Standard state recorder procedures apply. Verify county-specific formatting requirements.";

  if (isTribalActor && isIndianLand) {
    recommendation = "Full tribal and federal sovereignty protections apply. Obtain tribal council authorization and BIA approval.";
  }

  return { doctrinesApplied, guardrails, federalLaw, sovereigntyProtections, recommendation };
}

export function classifyText(text: string): {
  actorType: string;
  landStatus: string;
  actionType: string;
} {
  const lower = text.toLowerCase();

  let actorType = "unknown";
  if (lower.includes("tribe") || lower.includes("tribal") || lower.includes("nation")) actorType = "tribal";
  else if (lower.includes("federal") || lower.includes("bia") || lower.includes("bureau of indian")) actorType = "federal";
  else if (lower.includes("state") || lower.includes("county")) actorType = "state";
  else if (lower.includes("allottee") || lower.includes("individual indian")) actorType = "individual_indian";
  else if (lower.includes("corporation") || lower.includes("company") || lower.includes("llc")) actorType = "corporate";
  else if (lower.includes("individual") || lower.includes("person") || lower.includes("owner")) actorType = "individual";

  let landStatus = "fee_land";
  if (lower.includes("allotment") || lower.includes("allotted")) landStatus = "indian_allotment";
  else if (lower.includes("trust") && (lower.includes("tribal") || lower.includes("tribe"))) landStatus = "tribal_trust_land";
  else if (lower.includes("trust")) landStatus = "individual_indian_trust";
  else if (lower.includes("reservation")) landStatus = "indian_reservation";
  else if (lower.includes("pueblo")) landStatus = "pueblo_land_grant";
  else if (lower.includes("restricted")) landStatus = "restricted_indian_fee";
  else if (lower.includes("indian country")) landStatus = "indian_country";

  let actionType = "general";
  if (lower.includes("transfer") || lower.includes("convey")) actionType = "transfer";
  else if (lower.includes("sale") || lower.includes("sell") || lower.includes("purchase")) actionType = "sale";
  else if (lower.includes("lease") || lower.includes("leasing")) actionType = "lease";
  else if (lower.includes("mortgage") || lower.includes("lien") || lower.includes("encumbrance")) actionType = "mortgage";
  else if (lower.includes("recording") || lower.includes("record") || lower.includes("filing") || lower.includes("file")) actionType = "recording";
  else if (lower.includes("complaint") || lower.includes("grievance")) actionType = "complaint";
  else if (lower.includes("probate") || lower.includes("inheritance") || lower.includes("estate")) actionType = "probate";

  return { actorType, landStatus, actionType };
}
