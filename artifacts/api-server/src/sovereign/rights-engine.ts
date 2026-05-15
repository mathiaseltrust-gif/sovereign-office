/**
 * Rights Engine — Deterministic computation of a member's inherent and
 * federally-protected rights based on their identity and lineage profile.
 *
 * Purpose: translate the abstract "protection level" into specific, named
 * rights with plain-language explanations and institution red-flag warnings.
 * The member should know what they hold — not just that something applies.
 */

export interface MemberRight {
  id: string;
  name: string;
  category: "inherent" | "federal" | "land" | "icwa" | "trust" | "welfare" | "treaty";
  citation: string;
  plainLanguage: string;
  watchFor: string;
  status: "active" | "applicable" | "verify";
}

export interface IdentityMarker {
  type: "membership" | "lineage" | "enrollment" | "cdib" | "court_caption" | "tribal_id" | "protection_level";
  label: string;
  value: string;
  legalSignificance: string;
}

export interface LandStatusMarker {
  type: "trust" | "allotment" | "indian_country" | "reservation" | "restricted_fee" | "fee" | "apn" | "bia_ltro";
  label: string;
  value: string;
  jurisdictionNote: string;
}

export interface MemberRightsProfile {
  rights: MemberRight[];
  identityMarkers: IdentityMarker[];
  landStatusMarkers: LandStatusMarker[];
  protectionSummary: string;
  rightsSummaryForKaya: string;
}

// ── Inherent sovereign rights — always apply to tribal members ──────────────

const INHERENT_SOVEREIGNTY: MemberRight = {
  id: "inherent_sovereignty",
  name: "Inherent Sovereignty",
  category: "inherent",
  citation: "Worcester v. Georgia, 31 U.S. 515 (1832); U.S. Constitution, Art. VI",
  plainLanguage:
    "You carry inherent sovereign rights as a member of the Mathias El Tribe. These rights were here before any state law was written. No state law, county ordinance, or local rule can override your tribal standing. Tribal nations are distinct political communities with the right to self-governance.",
  watchFor:
    "Institutions may claim state law applies to you. They may ask for state-issued ID as the only form of validation. They may ignore your tribal court orders. Push back — Worcester doctrine is controlling federal law.",
  status: "active",
};

const SELF_EXECUTING_RIGHTS: MemberRight = {
  id: "self_executing",
  name: "Self-Executing Federal Rights",
  category: "inherent",
  citation: "Supremacy Clause, U.S. Const. Art. VI, cl. 2; McGirt v. Oklahoma, 591 U.S. 894 (2020)",
  plainLanguage:
    "Key federal Indian law rights are self-executing — they apply automatically without any agency approval, enrollment confirmation, or administrative processing. No agency can issue a memo that extinguishes a self-executing right. Your status and protections exist in law regardless of whether any institution has acknowledged them.",
  watchFor:
    "Agencies may claim they cannot help you until you are on their approved list, or until enrollment is 'confirmed.' That is an administrative convenience argument, not a legal requirement. Post-Loper Bright (2024), these arguments are legally vulnerable.",
  status: "active",
};

const CANONS_OF_CONSTRUCTION: MemberRight = {
  id: "canons_of_construction",
  name: "Indian Canons of Construction",
  category: "inherent",
  citation: "Montana v. Blackfeet Tribe, 471 U.S. 759 (1985); Oneida County v. Oneida Indian Nation, 470 U.S. 226 (1985)",
  plainLanguage:
    "When any law, treaty, or statute is ambiguous — meaning it could go either way — it must be read in favor of the tribe and the tribal member. Courts and agencies cannot flip a coin or use ambiguity as an excuse to deny rights. The tie always goes to the Indian.",
  watchFor:
    "Look for situations where an agency says a statute 'doesn't clearly cover' your situation, or that your status is 'ambiguous.' Under the Canons of Construction, that ambiguity resolves in your favor, not theirs.",
  status: "active",
};

// ── Federal protections — statute-based ──────────────────────────────────────

const FEDERAL_TRUST_RESPONSIBILITY: MemberRight = {
  id: "federal_trust",
  name: "Federal Trust Responsibility",
  category: "trust",
  citation: "25 U.S.C. § 162a; Seminole Nation v. United States, 316 U.S. 286 (1942)",
  plainLanguage:
    "The United States holds a legally enforceable fiduciary duty — a trust responsibility — to tribal nations and their members. This means the federal government must act in your interest, not against it. Federal agencies have an affirmative obligation to protect your rights and lands. This is not a favor — it is a legal duty enforceable in federal court.",
  watchFor:
    "Federal agencies sometimes act in ways that conflict with your interests — denying benefits, imposing fees, approving state actions against your land. When they do, that is potentially a breach of the trust responsibility.",
  status: "active",
};

const ICWA_BASE: MemberRight = {
  id: "icwa_base",
  name: "Indian Child Welfare Act (ICWA) Protections",
  category: "icwa",
  citation: "25 U.S.C. §§ 1901–1963; Brackeen v. Haaland, 599 U.S. 255 (2023)",
  plainLanguage:
    "ICWA gives tribal nations — and tribal parents — extensive rights whenever a state court attempts to remove an Indian child. This includes the right to intervene in any state court proceeding, the right to have your tribal court's jurisdiction asserted, minimum procedural protections that far exceed what non-Indian children receive, and requirements for active efforts (not just reasonable efforts) before any removal.",
  watchFor:
    "State child welfare agencies frequently fail to provide required ICWA notice. They may claim your child is 'not Indian enough,' use the foster home exception, or try to classify the proceeding in a way that avoids ICWA. Always assert ICWA at the first appearance.",
  status: "applicable",
};

const SNYDER_ACT: MemberRight = {
  id: "snyder_act",
  name: "Snyder Act — Federal Indian Services",
  category: "welfare",
  citation: "25 U.S.C. § 13 (Snyder Act of 1921)",
  plainLanguage:
    "The Snyder Act directs the federal government to provide for the 'general support and civilization' of Indians — including education, health, welfare, and economic development. This is a permanent congressional authorization that funds Indian programs. Your eligibility for federal Indian services flows from this act.",
  watchFor:
    "Agencies may impose state-level eligibility requirements that conflict with your federal Indian status. IHS, BIA, and other agencies cannot deny services on the basis of state criteria alone.",
  status: "applicable",
};

const IRA_RIGHTS: MemberRight = {
  id: "ira_rights",
  name: "Indian Reorganization Act — Tribal Self-Governance",
  category: "federal",
  citation: "25 U.S.C. §§ 5101–5144 (Indian Reorganization Act of 1934)",
  plainLanguage:
    "The IRA restored the right of tribes to adopt constitutions, establish governments, and acquire lands in trust. It ended the forced allotment and assimilation policy. Your tribe's governance structure has legal standing under federal law, and tribal decisions under that structure carry federal recognition.",
  watchFor:
    "State agencies may refuse to recognize tribal court orders or tribal government decisions. They do not have the legal authority to ignore them — tribal court orders carry Full Faith and Credit.",
  status: "active",
};

const URBAN_INDIAN_STATUS: MemberRight = {
  id: "urban_indian",
  name: "Urban Indian Status — Rights Preserved Off-Reservation",
  category: "federal",
  citation: "25 U.S.C. §§ 1651–1660i (Indian Health Care Improvement Act, Urban Indian provisions); Morton v. Ruiz, 415 U.S. 199 (1974)",
  plainLanguage:
    "Leaving a reservation does not extinguish your Indian status, treaty rights, or federal protections. If you live in an urban area, you are still an Indian for federal law purposes. The IHCIA defines 'Indian' broadly to include all persons of Indian descent who are members of the Indian community. Your tribal membership travels with you.",
  watchFor:
    "Urban agencies may tell you that you are only eligible for state programs because you don't live 'on the reservation.' That is incorrect. Your federal Indian status does not depend on your geographic location.",
  status: "active",
};

const NON_INTERCOURSE_ACT: MemberRight = {
  id: "non_intercourse",
  name: "Non-Intercourse Act — Land Transaction Protection",
  category: "land",
  citation: "25 U.S.C. § 177 (Trade and Intercourse Act of 1790)",
  plainLanguage:
    "No sale, lease, mortgage, or other transfer of Indian land is legally valid without explicit federal approval. This has been federal law since 1790. Any land transaction involving tribal or individual Indian land that was not federally approved may be voidable — meaning it can be challenged and potentially reversed.",
  watchFor:
    "Parties may try to obtain a quit-claim deed, a tax sale, or a foreclosure on Indian land without federal approval. Any such transfer without BIA approval is legally defective under the Non-Intercourse Act.",
  status: "applicable",
};

const WORCESTER_JURISDICTION: MemberRight = {
  id: "worcester_jurisdiction",
  name: "Exclusive Tribal Jurisdiction — State Law Limitation",
  category: "federal",
  citation: "Worcester v. Georgia, 31 U.S. 515 (1832); McClanahan v. Arizona State Tax Comm'n, 411 U.S. 164 (1973)",
  plainLanguage:
    "State laws generally have no force within Indian territory. This is not a technicality — it is foundational constitutional law. States cannot tax tribal income on reservation, apply state criminal law to Indians for on-reservation conduct, or impose state regulatory schemes on tribal self-governance.",
  watchFor:
    "State tax agencies may try to collect income tax on tribally-derived income. Local zoning boards may try to regulate tribal land use. Law enforcement may claim state arrest authority on tribal lands. All of these are jurisdictionally suspect.",
  status: "active",
};

const LOPER_BRIGHT_PROTECTION: MemberRight = {
  id: "loper_bright",
  name: "Post-Loper Bright Agency Accountability (2024)",
  category: "federal",
  citation: "Loper Bright Enterprises v. Raimondo, 603 U.S. ___ (2024)",
  plainLanguage:
    "Since 2024, federal agencies can no longer rely solely on their own interpretation of ambiguous laws to deny your rights. Courts now review agency interpretations independently. This means any agency that has been using broad interpretations of statutes to reduce or deny Indian rights is legally vulnerable to challenge.",
  watchFor:
    "Agencies may try to use prior administrative interpretations to deny services or narrow your rights. Post-Loper Bright, that is no longer legally insulated from challenge. If an agency cites its own policy manual to deny you a federal right, that denial is now challengeable.",
  status: "active",
};

// ── Land-specific rights ─────────────────────────────────────────────────────

const TRUST_LAND_PROTECTION: MemberRight = {
  id: "trust_land",
  name: "Trust Land Protection — Federal Supervision",
  category: "land",
  citation: "25 U.S.C. §§ 5108–5110; Indian Land Consolidation Act, 25 U.S.C. § 2201",
  plainLanguage:
    "Land held in trust by the United States for a tribe or individual Indian cannot be taxed by the state, cannot be alienated without federal approval, and is immune from most state-law judgments and liens. The federal government has an affirmative duty to prevent loss of trust land.",
  watchFor:
    "County assessors may attempt to assess property taxes on trust land. Creditors may try to attach liens. Courts may issue orders affecting trust land. All of these require BIA involvement and in many cases federal court jurisdiction.",
  status: "applicable",
};

const LTRO_RECORDING: MemberRight = {
  id: "ltro_recording",
  name: "BIA Land Title and Records Office (LTRO) Recording",
  category: "land",
  citation: "25 C.F.R. Part 150; 25 U.S.C. § 2216",
  plainLanguage:
    "Documents affecting Indian trust land must be recorded with the BIA's Land Title and Records Office (LTRO), not just with the county recorder. Recording only with the county does not provide constructive notice as to trust land. Your instruments should be recorded in both places to create a complete chain of title.",
  watchFor:
    "County recorders may record documents affecting trust land without notifying BIA. Title companies may issue title reports based solely on county records, missing the trust land designation and the federal chain. Always demand LTRO confirmation.",
  status: "applicable",
};

// ── Compute rights from gateway payload ─────────────────────────────────────

export interface RightsInputProfile {
  protectionLevel: "standard" | "elevated" | "critical";
  icwaEligible: boolean;
  trustInheritance: boolean;
  welfareEligible: boolean;
  membershipVerified: boolean;
  lineageVerified: boolean;
  benefitEligibility: {
    icwa: boolean;
    tribalWelfare: boolean;
    trustBeneficiary: boolean;
    membershipBenefits: boolean;
    ancestralLandRights: boolean;
  };
  identity: {
    legalName: string;
    tribalName: string;
    courtCaption: string;
    tribalEnrollmentNumber: string | null;
    tribalIdNumber: string | null;
    identityTags: string[];
    role: string;
    title: string;
  };
  lineageSummary: string;
  ancestorChain: string[];
  tribalNations: string[];
  elderStatus: string | null;
  isElder: boolean;
  profile?: {
    apn?: string | null;
    landStatus?: string | null;
    hasRecordedInstrument?: boolean;
  } | null;
}

export function computeMemberRights(input: RightsInputProfile): MemberRightsProfile {
  const rights: MemberRight[] = [];

  // ── Inherent rights — always active ────────────────────────────────────────
  rights.push(INHERENT_SOVEREIGNTY);
  rights.push(SELF_EXECUTING_RIGHTS);
  rights.push(CANONS_OF_CONSTRUCTION);
  rights.push(WORCESTER_JURISDICTION);
  rights.push(LOPER_BRIGHT_PROTECTION);

  // ── Federal protections — always applicable ─────────────────────────────────
  rights.push(FEDERAL_TRUST_RESPONSIBILITY);
  rights.push(IRA_RIGHTS);
  rights.push(SNYDER_ACT);
  rights.push(URBAN_INDIAN_STATUS);
  rights.push(NON_INTERCOURSE_ACT);

  // ── ICWA — if eligible ──────────────────────────────────────────────────────
  if (input.icwaEligible || input.benefitEligibility.icwa) {
    rights.push({ ...ICWA_BASE, status: "active" });
  } else {
    rights.push({ ...ICWA_BASE, status: "applicable" });
  }

  // ── Trust/land — if applicable ──────────────────────────────────────────────
  if (input.benefitEligibility.trustBeneficiary || input.trustInheritance || input.benefitEligibility.ancestralLandRights) {
    rights.push({ ...TRUST_LAND_PROTECTION, status: "active" });
    rights.push({ ...LTRO_RECORDING, status: "active" });
  } else if (input.profile?.apn || input.profile?.landStatus) {
    rights.push({ ...TRUST_LAND_PROTECTION, status: "verify" });
    rights.push({ ...LTRO_RECORDING, status: "verify" });
  }

  // ── Identity markers ────────────────────────────────────────────────────────
  const identityMarkers: IdentityMarker[] = [];

  if (input.membershipVerified) {
    identityMarkers.push({
      type: "membership",
      label: "Tribal Membership",
      value: "Verified",
      legalSignificance: "Establishes standing for all federal Indian law protections. Membership is the threshold for ICWA, trust benefits, and federal Indian status.",
    });
  }

  if (input.lineageVerified && input.lineageSummary) {
    identityMarkers.push({
      type: "lineage",
      label: "Verified Lineage",
      value: input.lineageSummary,
      legalSignificance: "Lineage documentation supports ICWA eligibility, trust inheritance, and ancestral land rights. It is the evidentiary foundation of Indian status in federal proceedings.",
    });
  }

  if (input.identity.tribalEnrollmentNumber) {
    identityMarkers.push({
      type: "enrollment",
      label: "Tribal Enrollment Number",
      value: input.identity.tribalEnrollmentNumber,
      legalSignificance: "Enrollment number is primary evidence of tribal membership for federal agencies and courts. Required for IHS services, BIA programs, and ICWA proceedings.",
    });
  }

  if (input.identity.tribalIdNumber) {
    identityMarkers.push({
      type: "tribal_id",
      label: "Tribal ID Number",
      value: input.identity.tribalIdNumber,
      legalSignificance: "Tribal-issued identification establishes identity for sovereign transactions, court captions, and tribal programs.",
    });
  }

  if (input.identity.courtCaption) {
    identityMarkers.push({
      type: "court_caption",
      label: "Court Caption",
      value: input.identity.courtCaption,
      legalSignificance: "The official court caption is used in all legal filings, instruments, and government correspondence. It establishes sovereign identity on the record.",
    });
  }

  identityMarkers.push({
    type: "protection_level",
    label: "Protection Level",
    value: input.protectionLevel.toUpperCase(),
    legalSignificance:
      input.protectionLevel === "critical"
        ? "Critical protection status — federal trust land and inherent sovereignty protections apply at full strength under 25 U.S.C. § 177 and Worcester v. Georgia."
        : input.protectionLevel === "elevated"
        ? "Elevated protection status — federal trust responsibility and welfare protections apply. ICWA eligibility confirmed."
        : "Standard protection status — all inherent tribal rights and applicable federal Indian law protections apply.",
  });

  // ── Land status markers ─────────────────────────────────────────────────────
  const landStatusMarkers: LandStatusMarker[] = [];

  if (input.profile?.apn) {
    landStatusMarkers.push({
      type: "apn",
      label: "Assessor's Parcel Number",
      value: input.profile.apn,
      jurisdictionNote: "APN identifies the parcel for recording and government purposes. If this land has Indian status, a trust deed declaration should accompany all county recordings.",
    });
  }

  if (input.profile?.landStatus && input.profile.landStatus !== "fee_land") {
    const ls = input.profile.landStatus;
    landStatusMarkers.push({
      type: ls.includes("trust") ? "trust" : ls.includes("allotment") ? "allotment" : ls.includes("reservation") ? "reservation" : ls.includes("restricted") ? "restricted_fee" : "trust",
      label: "Land Status",
      value: ls.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase()),
      jurisdictionNote:
        ls.includes("trust")
          ? "Trust land: state property tax does not apply; state court jurisdiction is limited; BIA approval required for transfers."
          : ls.includes("allotment")
          ? "Indian allotment: subject to federal supervision; inheritance requires BIA probate; transfer requires federal approval under 25 U.S.C. § 177."
          : ls.includes("reservation")
          ? "Reservation land: exclusive tribal and federal jurisdiction; state law generally has no force here under Worcester doctrine."
          : "Indian land with restricted status — consult BIA field office for current jurisdiction and transfer restrictions.",
    });
  }

  if (input.profile?.hasRecordedInstrument) {
    landStatusMarkers.push({
      type: "bia_ltro",
      label: "Recorded Instrument on File",
      value: "Yes",
      jurisdictionNote: "Ensure instrument is also recorded with BIA LTRO if land has any Indian status. County recording alone is insufficient for trust land instruments.",
    });
  }

  if (input.benefitEligibility.ancestralLandRights) {
    landStatusMarkers.push({
      type: "indian_country",
      label: "Ancestral Land Rights",
      value: "Verified via lineage",
      jurisdictionNote: "Ancestral land rights flow from lineage and tribal membership. These rights are recognized under federal Indian law and the tribe's sovereign authority.",
    });
  }

  // ── Protection summary ──────────────────────────────────────────────────────
  const activeCount = rights.filter(r => r.status === "active").length;
  const icwaActive = rights.some(r => r.id === "icwa_base" && r.status === "active");
  const trustActive = rights.some(r => r.id === "trust_land" && r.status === "active");

  const protectionSummary =
    `You hold ${rights.length} rights and protections as a member of the Mathias El Tribe — ${activeCount} are confirmed active. ` +
    (icwaActive ? "Your ICWA protections are active. " : "") +
    (trustActive ? "Your trust land protections are active. " : "") +
    `All inherent sovereign rights apply and cannot be extinguished by any state or local authority.`;

  // ── Rights summary for Kaya system prompt ──────────────────────────────────
  const activeRights = rights.filter(r => r.status === "active").map(r => `• ${r.name} (${r.citation})`).join("\n");
  const applicableRights = rights.filter(r => r.status === "applicable").map(r => `• ${r.name}`).join("\n");
  const landMarkers = landStatusMarkers.length > 0
    ? "\n\nLAND STATUS:\n" + landStatusMarkers.map(m => `• ${m.label}: ${m.value} — ${m.jurisdictionNote}`).join("\n")
    : "";
  const idMarkers = identityMarkers.length > 0
    ? "\n\nIDENTITY EARMARKS:\n" + identityMarkers.map(m => `• ${m.label}: ${m.value} — ${m.legalSignificance}`).join("\n")
    : "";

  const rightsSummaryForKaya = `MEMBER RIGHTS & PROTECTIONS PROFILE:\n\nActive Rights:\n${activeRights}\n\nApplicable Protections:\n${applicableRights}${landMarkers}${idMarkers}\n\n${protectionSummary}`;

  return { rights, identityMarkers, landStatusMarkers, protectionSummary, rightsSummaryForKaya };
}

// ── Document-level identity/status extraction schema ─────────────────────────
// Used by /api/intake/ai extract-fields?mode=identity-status

export const IDENTITY_STATUS_EXTRACTION_SCHEMA = {
  identityMarkers: {
    namesFound: "string[] — all legal names and aliases found in the document",
    tribalAffiliation: "string | null — any tribal nation or band name mentioned",
    enrollmentNumber: "string | null — enrollment, membership, or roll number",
    cdbNumber: "string | null — Certificate of Degree of Indian Blood number",
    biaNumber: "string | null — BIA agency or case number",
    allotmentNumber: "string | null — any allotment number",
    membershipEvidence: "string | null — direct assertions of tribal membership or Indian status",
    lineageEvidence: "string | null — references to ancestry, descendancy, or lineage",
  },
  landStatusMarkers: {
    apn: "string | null — Assessor's Parcel Number",
    trustStatus: "string | null — one of: individual_trust | tribal_trust | allotment | restricted_fee | fee | indian_country | unknown",
    indianCountryDesignation: "string | null — any explicit reference to Indian country or reservation land",
    biaFieldOffice: "string | null — BIA agency or field office mentioned",
    recordedInstruments: "string[] — any deeds, trust declarations, or land instruments referenced",
    propertyAddress: "string | null — physical address of land in question",
  },
  rightsTriggered: {
    icwaApplies: "boolean — true if child custody, welfare, foster, adoption, or removal is involved",
    trustResponsibility: "boolean — true if federal trust responsibility is implicated",
    worcesterApplies: "boolean — true if state/county authority over Indian land or person is at issue",
    treatyRightsMentioned: "string[] — any treaty rights or provisions cited",
    federalProtectionsCited: "string[] — any federal Indian law citations found in the document",
  },
  sovereignStanding: {
    partyIdentifiedAsIndian: "boolean — is any party identified as an Indian or tribal member",
    jurisdictionAsserted: "string | null — any jurisdiction claimed or asserted",
    courtCaptionFound: "string | null — formal legal caption if present",
    governmentActorInvolved: "string | null — state/county/federal agency party to the matter",
  },
};
