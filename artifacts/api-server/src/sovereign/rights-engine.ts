/**
 * Rights Engine — Deterministic computation of a member's inherent and
 * federally-protected rights based on their identity and lineage profile.
 *
 * Purpose: translate the abstract "protection level" into specific, named
 * rights with plain-language explanations and institution red-flag warnings.
 * The member should know what they hold — not just that something applies.
 */

import { db, familyLineageTable } from "@workspace/db";
import { eq } from "drizzle-orm";

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

// ── Lineage-inherited rights system ──────────────────────────────────────────

export interface InheritedRight extends MemberRight {
  sourceAncestorId: number;
  sourceAncestorName: string;
  generationalDepth: number;
  inheritanceTribalNation: string;
  inheritancePath: string;
}

// Maps normalized tribal nation key → treaties that affected that nation
const NATION_TREATY_MAP: Record<string, Array<{
  id: string;
  citation: string;
  plainLanguage: string;
  watchFor: string;
}>> = {
  choctaw: [{
    id: "dancing_rabbit_creek",
    citation: "Treaty of Dancing Rabbit Creek, Sept. 27, 1830, 7 Stat. 333; U.S. Const. Art. VI, cl. 2",
    plainLanguage: "Your ancestors were parties to the Dancing Rabbit Creek Treaty — the first major removal treaty under the Indian Removal Act of 1830. The treaty guaranteed citizenship rights and land protections to Choctaw who chose to remain. Treaty rights run with the bloodline and do not expire. The Supremacy Clause makes this treaty the supreme law of the land — no state law overrides it, and no agency memo can extinguish it.",
    watchFor: "Agencies may claim the treaty is 'historical' or 'no longer operative.' Under the Constitution's Supremacy Clause, treaties remain supreme law of the land. Congress has not explicitly abrogated Dancing Rabbit Creek — any agency that claims otherwise is making a legal argument, not stating settled law. Push back and demand the statutory citation.",
  }],
  chickasaw: [{
    id: "pontotoc_creek",
    citation: "Treaty of Pontotoc Creek, Oct. 20, 1832, 7 Stat. 381; Treaty of Doaksville, Jan. 17, 1837, 11 Stat. 573; U.S. Const. Art. VI, cl. 2",
    plainLanguage: "Your Chickasaw ancestry carries treaty standing under the Treaty of Pontotoc Creek (1832) and Treaty of Doaksville (1837). These treaties established Chickasaw sovereign rights, land protections, and the federal government's trust obligations to Chickasaw descendants. These obligations flow through your bloodline — Chickasaw treaty standing is inherited, not assigned.",
    watchFor: "Agencies may require current Chickasaw Nation enrollment to recognize these protections. Treaty standing is broader than enrollment records — the federal trust responsibility runs to Chickasaw descendants as a matter of treaty law, not administrative eligibility.",
  }],
  cherokee: [{
    id: "new_echota",
    citation: "Treaty of New Echota, Dec. 29, 1835, 7 Stat. 478; U.S. Const. Art. VI, cl. 2",
    plainLanguage: "Your Cherokee ancestry carries treaty rights under the Treaty of New Echota. Cherokee treaty protections include sovereign land rights, rights to self-governance, and the federal trust obligations that run through your bloodline. These rights exist in law regardless of current enrollment status.",
    watchFor: "Cherokee treaty rights are frequently challenged on blood quantum and enrollment. Your inherited treaty standing exists independently of enrollment records. The Canons of Construction require ambiguities to resolve in your favor.",
  }],
  creek: [{
    id: "creek_treaty",
    citation: "Treaty of Indian Springs, Jan. 8, 1821, 7 Stat. 215; McGirt v. Oklahoma, 591 U.S. 894 (2020)",
    plainLanguage: "Your Creek/Muscogee ancestry carries treaty-based land and sovereignty rights. The U.S. Supreme Court in McGirt v. Oklahoma (2020) confirmed that Creek treaty lands remain Indian country — a direct vindication of treaty rights that your bloodline inherits. Federal trust obligations to Creek descendants are enforceable.",
    watchFor: "Post-McGirt, some agencies and state governments are resisting the scope of Muscogee sovereignty. Your inherited treaty standing is grounded in a 2020 Supreme Court decision, not historical argument alone.",
  }],
  muscogee: [{
    id: "creek_treaty",
    citation: "Treaty of Indian Springs, Jan. 8, 1821, 7 Stat. 215; McGirt v. Oklahoma, 591 U.S. 894 (2020)",
    plainLanguage: "Your Muscogee (Creek) ancestry carries treaty-reinforced rights confirmed by McGirt v. Oklahoma (2020). The Supreme Court held that Muscogee treaty lands remain Indian country. These rights flow through your bloodline as direct inheritance.",
    watchFor: "Post-McGirt, some agencies continue to resist. Your inherited treaty standing is grounded in the most recent Supreme Court pronouncement on the subject.",
  }],
  seminole: [{
    id: "seminole_treaty",
    citation: "Treaty of Moultrie Creek, Sept. 18, 1823, 7 Stat. 224; U.S. Const. Art. VI, cl. 2",
    plainLanguage: "Your Seminole ancestry carries treaty standing under the Treaty of Moultrie Creek. Seminole treaty protections include sovereign territorial rights, federal trust obligations, and protections that flow from the United States' treaty commitments to the Seminole Nation and its descendants.",
    watchFor: "Seminole treaty rights carry unique weight given the three Seminole Wars and the nation's documented resistance to removal. The federal government's treaty obligations to Seminole descendants are robust — claim them fully.",
  }],
  shawnee: [{
    id: "shawnee_treaty",
    citation: "Treaty of Cape Girardeau, 1793; Fort Harmar Treaty, 1789; U.S. Const. Art. VI, cl. 2",
    plainLanguage: "Your Shawnee ancestry carries treaty-based sovereign rights recognized in multiple early treaties. Shawnee treaty protections include land rights and the federal trust responsibility that flows to treaty-nation descendants.",
    watchFor: "Shawnee treaty rights may be contested on grounds of enrollment or band affiliation. Treaty standing extends beyond administrative enrollment.",
  }],
  potawatomi: [{
    id: "potawatomi_treaty",
    citation: "Treaty of Chicago, 1833, 7 Stat. 431; U.S. Const. Art. VI, cl. 2",
    plainLanguage: "Your Potawatomi ancestry carries treaty standing under treaties including the Treaty of Chicago (1833). Federal trust obligations to Potawatomi descendants flow from these treaty commitments.",
    watchFor: "Potawatomi treaty rights are administered by multiple federally recognized bands. Your inherited treaty standing may extend to more than one band's protections.",
  }],
};

// Maps lineage tag → right definition (for tagged ancestors in family tree)
const TAG_RIGHTS_MAP: Record<string, Pick<MemberRight, "name" | "citation" | "plainLanguage" | "watchFor">> = {
  "dancing-rabbit-creek": {
    name: "Dancing Rabbit Creek Treaty Standing (1830)",
    citation: "Treaty of Dancing Rabbit Creek, Sept. 27, 1830, 7 Stat. 333",
    plainLanguage: "This ancestor was directly affected by or party to the Dancing Rabbit Creek Treaty — the foundational Choctaw removal-era treaty. Their treaty standing transfers to all blood descendants. You inherit this treaty protection as a matter of constitutional supremacy.",
    watchFor: "Treaty rights run with the bloodline unconditionally. Any denial of Indian status must account for this treaty standing, which exists in federal constitutional law, not administrative convenience.",
  },
  "choctaw-removal": {
    name: "Choctaw Removal Era Land & Citizenship Rights",
    citation: "Indian Removal Act, 4 Stat. 411 (1830); Treaty of Dancing Rabbit Creek, 7 Stat. 333; 25 U.S.C. § 177",
    plainLanguage: "This ancestor lived through and was subject to the Choctaw removal era. Removal-era Choctaw were guaranteed citizenship rights, land protections, and retained rights under federal treaties. These protections are inherited by blood descendants.",
    watchFor: "Records from the removal era are often incomplete or scattered. Incomplete records do not negate your rights — community recognition and oral tradition are accepted forms of evidence in Indian law proceedings.",
  },
  "ira-allottee": {
    name: "IRA Allotment Rights — Inherited Land Status",
    citation: "Indian Reorganization Act, 25 U.S.C. §§ 5101–5144 (1934); General Allotment Act, 25 U.S.C. § 331",
    plainLanguage: "This ancestor held an Indian allotment under federal land policy. Allotment rights and trust status may have passed to heirs. Any allotment land remaining in the family is subject to federal supervision under the Non-Intercourse Act — state courts and county governments have no jurisdiction to transfer it without BIA approval.",
    watchFor: "Allotted lands are frequently lost through fractionated heirship, incomplete probate, or invalid state-law transfers. If family land has been taken or lost, look for defective transfer proceedings that may be challengeable.",
  },
  "dawes-roll": {
    name: "Dawes Roll Standing — Five Civilized Tribes",
    citation: "Curtis Act of 1898; Dawes Act, 25 U.S.C. § 331; Dawes Commission records",
    plainLanguage: "This ancestor appears on or is eligible for the Dawes Rolls — the federal census of the Five Civilized Tribes prepared 1898–1914. Dawes Roll status is a significant evidentiary anchor for Indian status, tribal membership, and allotment land rights. Your blood descent from a Dawes Roll ancestor is a strong legal foundation for your own Indian status.",
    watchFor: "Omission from the Dawes Rolls does not negate Indian status — many members refused enrollment or were incorrectly classified. The Dawes Rolls are evidence, not the exclusive definition of Indian status.",
  },
  "freedmen-roll": {
    name: "Freedmen Roll — Post-Civil War Treaty Rights",
    citation: "Cherokee Freedmen Treaty of 1866, 14 Stat. 799; Seminole Freedmen Treaty of 1866; Creek Freedmen Treaty of 1866",
    plainLanguage: "This ancestor appears on or is eligible for the Freedmen Rolls established by the post-Civil War treaties between the Five Civilized Tribes and the United States. Freedmen treaty rights are federally recognized and establish citizenship rights within the respective tribal nations — rights that flow to descendants.",
    watchFor: "Tribal nations have sometimes excluded Freedmen from citizenship and benefits. The post-Civil War treaties established these rights as binding federal treaty obligations that the tribes cannot unilaterally revoke. Federal courts have consistently upheld Freedmen treaty rights.",
  },
  "removal-survivor": {
    name: "Indian Removal Survivor Lineage — Preserved Rights",
    citation: "Indian Removal Act of 1830, 4 Stat. 411; Removal-era treaty rights; 25 U.S.C. § 177",
    plainLanguage: "This ancestor survived the Indian Removal period — one of the most legally significant events in federal Indian law. Removal-era treaties preserved specific rights for those who relocated and those who remained. These rights flow to all blood descendants and have never been extinguished.",
    watchFor: "Removal-era records are scattered and often incomplete. Courts have recognized Indian status and treaty rights based on oral tradition, community recognition, and partial documentation. Incomplete records are not a legal barrier to claiming your rights.",
  },
  "non-intercourse-act": {
    name: "Non-Intercourse Act Standing — Land Transaction Protection",
    citation: "25 U.S.C. § 177 (Trade and Intercourse Act of 1790); Passamaquoddy Tribe v. Morton, 528 F.2d 370 (1st Cir. 1975)",
    plainLanguage: "This ancestor's land transactions were subject to the Non-Intercourse Act. Any land that passed without federal approval during this ancestor's lifetime may be voidable under federal law. This protection extends to all descendants with a claim to that ancestral land.",
    watchFor: "Land that was transferred without BIA approval — through tax sales, quiet title actions, or informal sales — may be recoverable under the Non-Intercourse Act, regardless of how much time has passed.",
  },
};

function _normalizeNationKey(nation: string): string {
  return nation.toLowerCase()
    .replace(/\b(nation|tribe|people|band|group|of|the|confederated|united)\b/g, "")
    .replace(/[^a-z]/g, " ")
    .trim()
    .split(/\s+/)[0] ?? "";
}

function _generationLabel(position: number): string {
  if (position <= 0) return "current generation";
  if (position === 1) return "parent";
  if (position === 2) return "grandparent";
  if (position === 3) return "great-grandparent";
  const greats = Array(position - 2).fill("great").join("-");
  return `${greats}-grandparent`;
}

export async function computeInheritedRights(userId: number): Promise<{
  inheritedRights: InheritedRight[];
  ancestorTribalNations: Array<{ name: string; ancestorId: number; ancestorName: string; generation: number }>;
  inheritanceSummary: string;
}> {
  const ancestors = await db
    .select({
      id: familyLineageTable.id,
      fullName: familyLineageTable.fullName,
      tribalNation: familyLineageTable.tribalNation,
      lineageTags: familyLineageTable.lineageTags,
      generationalPosition: familyLineageTable.generationalPosition,
      icwaEligible: familyLineageTable.icwaEligible,
      trustBeneficiary: familyLineageTable.trustBeneficiary,
    })
    .from(familyLineageTable)
    .where(eq(familyLineageTable.userId, userId));

  const inheritedRights: InheritedRight[] = [];
  const seenIds = new Set<string>();
  const ancestorTribalNations: Array<{ name: string; ancestorId: number; ancestorName: string; generation: number }> = [];

  for (const ancestor of ancestors) {
    const gen = ancestor.generationalPosition ?? 0;
    const genLabel = _generationLabel(gen);

    // ── Nation → treaty rights ──────────────────────────────────────────────
    if (ancestor.tribalNation) {
      const key = _normalizeNationKey(ancestor.tribalNation);
      const treaties = NATION_TREATY_MAP[key] ?? [];
      if (treaties.length > 0) {
        ancestorTribalNations.push({ name: ancestor.tribalNation, ancestorId: ancestor.id, ancestorName: ancestor.fullName, generation: gen });
      }
      for (const treaty of treaties) {
        const dedupeKey = `nation_${treaty.id}`;
        if (seenIds.has(dedupeKey)) continue;
        seenIds.add(dedupeKey);
        const nationName = ancestor.tribalNation;
        inheritedRights.push({
          id: `inherited_${treaty.id}_${ancestor.id}`,
          name: `${nationName} Treaty Rights — inherited from ${ancestor.fullName}`,
          category: "treaty",
          citation: treaty.citation,
          plainLanguage: treaty.plainLanguage,
          watchFor: treaty.watchFor,
          status: "active",
          sourceAncestorId: ancestor.id,
          sourceAncestorName: ancestor.fullName,
          generationalDepth: gen,
          inheritanceTribalNation: nationName,
          inheritancePath: genLabel,
        });
      }
    }

    // ── Lineage tags → rights ───────────────────────────────────────────────
    const tags = Array.isArray(ancestor.lineageTags) ? (ancestor.lineageTags as string[]) : [];
    for (const tag of tags) {
      const tagDef = TAG_RIGHTS_MAP[tag.toLowerCase().trim()];
      if (!tagDef) continue;
      const dedupeKey = `tag_${tag}`;
      if (seenIds.has(dedupeKey)) continue;
      seenIds.add(dedupeKey);
      inheritedRights.push({
        id: `inherited_tag_${tag}_${ancestor.id}`,
        name: tagDef.name,
        category: "treaty",
        citation: tagDef.citation,
        plainLanguage: tagDef.plainLanguage,
        watchFor: tagDef.watchFor,
        status: "active",
        sourceAncestorId: ancestor.id,
        sourceAncestorName: ancestor.fullName,
        generationalDepth: gen,
        inheritanceTribalNation: ancestor.tribalNation ?? "Documented ancestor",
        inheritancePath: genLabel,
      });
    }

    // ── ICWA — ancestor confirmation ────────────────────────────────────────
    if (ancestor.icwaEligible && !seenIds.has("inherited_icwa_lineage")) {
      seenIds.add("inherited_icwa_lineage");
      inheritedRights.push({
        id: `inherited_icwa_lineage_${ancestor.id}`,
        name: "ICWA Eligibility — Confirmed Through Lineage",
        category: "icwa",
        citation: "25 U.S.C. §§ 1901–1963; Brackeen v. Haaland, 599 U.S. 255 (2023)",
        plainLanguage: `Your ICWA eligibility is confirmed through ${ancestor.fullName} (${genLabel}). All Indian Child Welfare Act protections apply to you and your children — including tribal court jurisdiction preference, active efforts requirements, and the right to intervene in any state court child welfare proceeding.`,
        watchFor: "State agencies frequently fail to make the ICWA inquiry. Always assert ICWA at the first court appearance and demand the agency demonstrate they provided required 10-day notice to the tribe.",
        status: "active",
        sourceAncestorId: ancestor.id,
        sourceAncestorName: ancestor.fullName,
        generationalDepth: gen,
        inheritanceTribalNation: ancestor.tribalNation ?? "Documented ancestor",
        inheritancePath: genLabel,
      });
    }

    // ── Trust beneficiary — ancestor confirmation ───────────────────────────
    if (ancestor.trustBeneficiary && !seenIds.has("inherited_trust_lineage")) {
      seenIds.add("inherited_trust_lineage");
      inheritedRights.push({
        id: `inherited_trust_lineage_${ancestor.id}`,
        name: "Trust Land Beneficiary — Inherited Standing",
        category: "trust",
        citation: "25 U.S.C. §§ 5108–5110; Indian Land Consolidation Act, 25 U.S.C. § 2201",
        plainLanguage: `Your trust land beneficiary status flows from ${ancestor.fullName} (${genLabel}). Trust land held for your family line cannot be taxed by the state, cannot be transferred without federal approval, and is subject to BIA supervision. If any family land has been lost without proper federal process, it may be recoverable.`,
        watchFor: "Tax sales, quiet title actions, and county-recorded transfers are the most common ways trust land is lost. None of these are valid against trust land without BIA approval.",
        status: "active",
        sourceAncestorId: ancestor.id,
        sourceAncestorName: ancestor.fullName,
        generationalDepth: gen,
        inheritanceTribalNation: ancestor.tribalNation ?? "Documented ancestor",
        inheritancePath: genLabel,
      });
    }
  }

  const uniqueNations = [...new Set(ancestorTribalNations.map(n => n.name))];
  const inheritanceSummary = inheritedRights.length === 0
    ? "No specific treaty or ancestral rights have been mapped yet. Add tribal nation and treaty affiliation data to ancestor records in the Family Tree to activate inherited protections."
    : `You inherit ${inheritedRights.length} additional protection${inheritedRights.length !== 1 ? "s" : ""} through your bloodline${uniqueNations.length > 0 ? ` — tracing through ${uniqueNations.join(", ")} ancestry` : ""}. These rights are as active and enforceable as any protection you hold in your own name.`;

  return { inheritedRights, ancestorTribalNations, inheritanceSummary };
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
