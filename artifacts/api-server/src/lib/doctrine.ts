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
  overlappingProtections: string[];
  tribalGovernmentalTriggers: string[];
}

const WORCESTER_DOCTRINE = "Worcester v. Georgia, 31 U.S. 515 (1832) — State laws have no force within Indian territory";
const SNYDER_ACT = "Snyder Act of 1921 (25 U.S.C. § 13) — Federal authority and appropriations for Indian affairs";
const INDIAN_REORGANIZATION_ACT = "Indian Reorganization Act of 1934 (25 U.S.C. § 5101) — Tribal sovereignty restoration";
const INDIAN_LAND_CONSOLIDATION_ACT = "Indian Land Consolidation Act of 1983 (25 U.S.C. § 2201) — Trust land consolidation rules";
const NCAI_SOVEREIGNTY = "National Congress of American Indians Sovereignty Guardrail — Tribal self-governance protected";
const FEDERAL_TRUST_RESPONSIBILITY = "Federal Trust Responsibility — United States holds trust responsibility to tribal nations";
const NON_INTERCOURSE_ACT = "Non-Intercourse Act, 25 U.S.C. § 177 — No purchase or grant of lands from any Indian nation valid unless by treaty; all encumbrances without federal approval void ab initio";
const INDIAN_COUNTRY_JURISDICTION = "Indian Country Jurisdiction, 18 U.S.C. § 1151 — Indian Country includes reservations, dependent Indian communities, and allotments; federal and tribal law govern";
const FEDERAL_SUPREMACY_PREEMPTION = "Federal Supremacy and Preemption — U.S. Const. Art. VI; federal Indian law preempts state and county action affecting tribal governmental operations and protected Indian interests";
const TRIBAL_GOVERNMENTAL_FACILITY_DOCTRINE =
  "Tribal Governmental Facility Protection Doctrine — Properties functioning as tribal governmental facilities (Office of Chief Justice & Trustee, tribal administration centers, tribal court archives, records repositories, charitable trust offices, tribal medical/community facilities, and protected operational sites) simultaneously invoke overlapping layers of federal Indian law protection including: Non-Intercourse Act (25 U.S.C. § 177), Indian Country jurisdiction (18 U.S.C. § 1151), Federal Trust Responsibility, Snyder Act, tribal governmental function protections, trust and fiduciary protections, judicial and governmental record protections, charitable and beneficiary-interest protections, cultural and ceremonial protections, public welfare continuity protections, federal supremacy and preemption principles, and protective-order enforcement mechanisms. Protection does not depend on BIA recognition status, CDIB possession, administrative roster placement, or isolated administrative classifications — it derives from the totality of protected tribal interests implicated.";

export function applyDoctrine(input: ClassificationInput): DoctrineResult {
  const doctrinesApplied: string[] = [];
  const guardrails: string[] = [];
  const federalLaw: string[] = [];
  const sovereigntyProtections: string[] = [];
  const overlappingProtections: string[] = [];
  const tribalGovernmentalTriggers: string[] = [];

  const lower = input.rawText.toLowerCase();

  const isIndianLand =
    input.landStatus.toLowerCase().includes("trust") ||
    input.landStatus.toLowerCase().includes("reservation") ||
    input.landStatus.toLowerCase().includes("allotment") ||
    input.landStatus.toLowerCase().includes("indian") ||
    lower.includes("indian country");

  const isTribalActor =
    input.actorType.toLowerCase().includes("tribe") ||
    input.actorType.toLowerCase().includes("tribal") ||
    input.actorType.toLowerCase().includes("nation");

  const isStateActor =
    input.actorType.toLowerCase().includes("state") || input.actorType.toLowerCase().includes("county");

  // ── Tribal governmental facility detection ────────────────────────────────
  const isTribalGovernmentalFacility =
    lower.includes("chief justice") || lower.includes("trustee") ||
    lower.includes("tribal court") || lower.includes("tribal archive") ||
    lower.includes("records repository") || lower.includes("tribal administration") ||
    lower.includes("tribal government") || lower.includes("charitable trust") ||
    lower.includes("tribal medical") || lower.includes("tribal office") ||
    lower.includes("tribal operational") || lower.includes("sovereign office");

  // ── Encroachment action detection ─────────────────────────────────────────
  const isEncroachmentAction =
    input.actionType === "foreclosure" || input.actionType === "taxation" ||
    input.actionType === "seizure" || input.actionType === "trespass" ||
    input.actionType === "forced_transfer" || input.actionType === "eviction" ||
    lower.includes("foreclose") || lower.includes("tax lien") || lower.includes("property tax") ||
    lower.includes("seized") || lower.includes("trespass") || lower.includes("evict") ||
    lower.includes("forced sale") || lower.includes("eminent domain");

  if (isIndianLand) {
    doctrinesApplied.push(WORCESTER_DOCTRINE);
    doctrinesApplied.push(FEDERAL_TRUST_RESPONSIBILITY);
    federalLaw.push(SNYDER_ACT);
    federalLaw.push(INDIAN_REORGANIZATION_ACT);
    federalLaw.push(INDIAN_COUNTRY_JURISDICTION);

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
    guardrails.push("Tribal Council authorization required — this action falls within inherent tribal sovereign authority");
    guardrails.push(FEDERAL_SUPREMACY_PREEMPTION);
  }

  if (
    input.actionType.toLowerCase().includes("transfer") ||
    input.actionType.toLowerCase().includes("sale") ||
    input.actionType.toLowerCase().includes("mortgage")
  ) {
    if (isIndianLand) {
      guardrails.push(NON_INTERCOURSE_ACT);
    }
  }

  if (input.actionType.toLowerCase().includes("recording") || input.actionType.toLowerCase().includes("filing")) {
    if (isIndianLand) {
      guardrails.push("Federal Land Title and Records Office (LTRO) must receive a copy of recorded instruments to complete federal notice of this instrument");
    }
  }

  // ── Tribal governmental facility — multi-layer analysis ───────────────────
  if (isTribalGovernmentalFacility) {
    doctrinesApplied.push(TRIBAL_GOVERNMENTAL_FACILITY_DOCTRINE);
    overlappingProtections.push(NON_INTERCOURSE_ACT);
    overlappingProtections.push(INDIAN_COUNTRY_JURISDICTION);
    overlappingProtections.push(FEDERAL_TRUST_RESPONSIBILITY);
    overlappingProtections.push(SNYDER_ACT);
    overlappingProtections.push(FEDERAL_SUPREMACY_PREEMPTION);
    overlappingProtections.push("Tribal governmental function protections — interference with tribal administration and judicial continuity is federally actionable");
    overlappingProtections.push("Judicial and governmental record protections — tribal court archives and records repositories receive heightened protection");
    overlappingProtections.push("Charitable and beneficiary-interest protections — tribal charitable trust operations are protected from external encroachment");
    overlappingProtections.push("Cultural and ceremonial continuity protections — AIRFA, 42 U.S.C. § 1996");
    overlappingProtections.push("Public welfare and community health continuity protections — Snyder Act, IHCIA");
    overlappingProtections.push("Protective-order enforcement — VAWA full faith and credit, 18 U.S.C. § 2265");
    tribalGovernmentalTriggers.push("TRIBAL_GOVERNMENTAL_FACILITY: Multi-layer federal protection applies — evaluate totality of protected interests");
    guardrails.push("TOTALITY STANDARD: Do not reduce protection to BIA recognition status, CDIB possession, roster placement, or isolated administrative classification. Evaluate ALL overlapping federal Indian law protections simultaneously.");
    guardrails.push("PRESERVATION TRIGGER: Records, archives, and governmental instruments of this facility are protected from seizure, destruction, or unauthorized access under federal law.");
    guardrails.push("GOVERNMENTAL CONTINUITY: Any interference with the operations of this tribal governmental facility implicates federal preemption — county and state actors have no jurisdiction without explicit federal authorization.");
  }

  // ── Encroachment — foreclosure / seizure / taxation / trespass ────────────
  if (isEncroachmentAction && (isIndianLand || isTribalGovernmentalFacility)) {
    guardrails.push(NON_INTERCOURSE_ACT);
    guardrails.push("FORECLOSURE / TAXATION / SEIZURE TRIGGER: State and county foreclosure, taxation, and seizure actions against Indian land and tribal governmental facilities are preempted by federal law absent explicit congressional authorization. McClanahan v. Arizona State Tax Comm'n, 411 U.S. 164 (1973).");
    tribalGovernmentalTriggers.push("ENCROACHMENT_ACTION: Recommend immediate JURISDICTIONAL_STATEMENT and FEDERAL_PREEMPTION_NOTICE");
  }

  let recommendation =
    doctrinesApplied.length > 0
      ? "Federal law governs this transaction under treaty authority and the Non-Intercourse Act. Ensure LTRO notification and obtain Tribal Council authorization."
      : "Standard state recorder procedures apply. Verify county-specific formatting requirements.";

  if (isTribalActor && isIndianLand) {
    recommendation = "Full tribal and federal sovereignty protections apply. Obtain Tribal Council authorization under inherent sovereign authority. No external agency approval required for sovereign acts — authority derives from treaty and statute.";
  }

  if (isTribalGovernmentalFacility) {
    recommendation = "MAXIMUM PROTECTION POSTURE: This site implicates overlapping layers of federal Indian law protection. Issue JURISDICTIONAL_STATEMENT, PRESERVATION_DEMAND, and FEDERAL_PREEMPTION_NOTICE simultaneously. Apply totality analysis — do not limit response to any single doctrine or administrative classification.";
  }

  return { doctrinesApplied, guardrails, federalLaw, sovereigntyProtections, recommendation, overlappingProtections, tribalGovernmentalTriggers };
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
  else if (lower.includes("foreclose") || lower.includes("foreclosure")) actionType = "foreclosure";
  else if (lower.includes("property tax") || lower.includes("tax lien") || lower.includes("taxation")) actionType = "taxation";
  else if (lower.includes("seized") || lower.includes("seizure") || lower.includes("confiscate")) actionType = "seizure";
  else if (lower.includes("trespass") || lower.includes("intrusion") || lower.includes("unauthorized entry")) actionType = "trespass";
  else if (lower.includes("evict") || lower.includes("eviction") || lower.includes("forced removal") || lower.includes("forced sale")) actionType = "forced_transfer";
  else if (lower.includes("protective order") || lower.includes("protection order") || lower.includes("tro")) actionType = "protective_order";
  else if (lower.includes("archive") || lower.includes("records") || lower.includes("repository")) actionType = "records";
  else if (lower.includes("recording") || lower.includes("record") || lower.includes("filing") || lower.includes("file")) actionType = "recording";
  else if (lower.includes("complaint") || lower.includes("grievance")) actionType = "complaint";
  else if (lower.includes("probate") || lower.includes("inheritance") || lower.includes("estate")) actionType = "probate";

  return { actorType, landStatus, actionType };
}
