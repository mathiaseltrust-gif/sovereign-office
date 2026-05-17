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
  logicChain?: string[];
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
  type: "trust" | "allotment" | "indian_country" | "reservation" | "restricted_fee" | "fee" | "apn" | "bia_ltro" | "tribal_code" | "doc_record" | "classification" | "self_executing_status";
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
  citation: "Worcester v. Georgia, 31 U.S. 515 (1832); Talton v. Mayes, 163 U.S. 376 (1896); U.S. Constitution, Art. VI",
  plainLanguage:
    "Tribal sovereignty is not a right granted by the United States — it is a pre-existing authority that was never surrendered. The Mathias El Tribe governed itself before any state existed. That original authority remains intact unless explicitly and expressly extinguished by Congress. No state law, county ordinance, or court ruling can erase it.",
  logicChain: [
    "Tribes existed and governed themselves for thousands of years before any European or American government arrived. That pre-existing governing authority is called inherent sovereignty.",
    "When tribes entered agreements and treaties with the United States, they retained all governmental powers they did not explicitly give up. Silence is not a surrender — rights not expressly ceded remain with the tribe.",
    "The Supreme Court confirmed this in Worcester v. Georgia (1832): tribes are 'distinct, independent political communities' and state laws have 'no force' within Indian territory. That has never been overruled.",
    "Talton v. Mayes (1896) confirmed the corollary: tribal governing powers come from the tribe itself, not from the federal government. The tribe's authority is original, not delegated.",
    "What this means for you: your tribal identity, your tribal court orders, and your tribe's decisions about its members are not subject to state approval. A state agency cannot override them. A county recorder cannot ignore them.",
  ],
  watchFor:
    "Institutions may claim state law applies to you or ask for a state-issued ID as the only valid form. They may refuse to recognize your tribal court orders or enrollment documentation. Push back — Worcester doctrine is controlling federal law and has never been overruled.",
  status: "active",
};

const SELF_EXECUTING_RIGHTS: MemberRight = {
  id: "self_executing",
  name: "Self-Executing Federal Rights",
  category: "inherent",
  citation: "Supremacy Clause, U.S. Const. Art. VI, cl. 2; McGirt v. Oklahoma, 591 U.S. 894 (2020); Loper Bright Enterprises v. Raimondo, 603 U.S. ___ (2024)",
  plainLanguage:
    "A self-executing right operates automatically by force of law. It does not need a court order, agency confirmation, enrollment certificate, or any institution's approval to be in effect. Your federal Indian law protections exist whether or not any agency has 'processed' them. The law is already on.",
  logicChain: [
    "'Self-executing' is a legal term meaning: the right is effective on its own, directly from the text of the law or treaty — no implementing legislation, no agency action, no approval process required.",
    "The Supremacy Clause (Art. VI, cl. 2) makes federal law the supreme law of the land. Any state law in conflict with it is automatically void — without any court needing to say so first.",
    "McGirt v. Oklahoma (2020) proved the power of this principle: the Supreme Court held that the Creek Nation's boundaries had never been legally extinguished — even though no one had enforced that for over 100 years. The law was always in effect. It was self-executing the entire time.",
    "When an agency tells you to 'get on their list,' 'wait for approval,' or 'come back when enrollment is confirmed,' they are adding a procedural hurdle the law does not require. That is an administrative convenience argument, not a legal requirement.",
    "Post-Loper Bright (2024), agencies can no longer rely on their own interpretations of ambiguous statutes to justify those hurdles. Courts now review agency interpretations independently — meaning bureaucratic gatekeeping is legally vulnerable to challenge.",
  ],
  watchFor:
    "Agencies may say they cannot help you until you are on an 'approved list' or enrollment is confirmed through their system. That is a procedural obstacle, not a legal one. Your rights do not wait for agency processing.",
  status: "active",
};

const CANONS_OF_CONSTRUCTION: MemberRight = {
  id: "canons_of_construction",
  name: "Indian Canons of Construction",
  category: "inherent",
  citation: "Montana v. Blackfeet Tribe, 471 U.S. 759 (1985); Oneida County v. Oneida Indian Nation, 470 U.S. 226 (1985); Chickasaw Nation v. United States, 534 U.S. 84 (2001)",
  plainLanguage:
    "When a law, treaty, or statute is ambiguous — meaning it is unclear which way it cuts — it must be resolved in favor of the Indian and the tribe. This is a binding rule of interpretation, not a courtesy. Courts and agencies do not have discretion to break the tie against you. Ambiguity belongs to the Indian.",
  logicChain: [
    "Laws are not always clear. Words have multiple meanings. Congress sometimes writes statutes that could be read two ways. Courts need a tie-breaking rule — a principle to decide which reading governs when the text alone does not answer the question.",
    "For Indian law, that tie-breaker is established: ambiguities in laws and treaties are resolved in favor of the tribe and the tribal member. This is the Indian Canon of Construction — a rule with over 150 years of consistent Supreme Court application.",
    "The logic behind it: the US drafted the treaties, the statutes, and the regulations — often in English, often under conditions of unequal bargaining power. The party that wrote the document does not get to use its own ambiguity against the other party.",
    "Montana v. Blackfeet Tribe (1985): 'Statutes are to be construed liberally in favor of the Indians.' Oneida (1985): treaties must be interpreted as the Indians would have understood them at the time of signing — not as the government reinterprets them later.",
    "What this means practically: if an agency says your situation is 'not clearly covered,' or that a statute 'doesn't specifically' apply to you, that ambiguity is not a reason to deny the right. It is a legal reason to grant it. Name the Canon. Put it on the record.",
  ],
  watchFor:
    "Watch for agencies and courts saying a law 'doesn't clearly cover' your situation or that your status is 'ambiguous.' Under the Canons of Construction, that ambiguity resolves in your favor. Name the Canon explicitly in any response.",
  status: "active",
};

// ── Federal protections — statute-based ──────────────────────────────────────

const FEDERAL_TRUST_RESPONSIBILITY: MemberRight = {
  id: "federal_trust",
  name: "Federal Trust Responsibility",
  category: "trust",
  citation: "25 U.S.C. § 162a; Seminole Nation v. United States, 316 U.S. 286 (1942); Mitchell v. United States, 463 U.S. 206 (1983); Cobell v. Salazar, 573 F.3d 808 (D.C. Cir. 2009); Morton v. Ruiz, 415 U.S. 199 (1974)",
  plainLanguage:
    "The United States is your fiduciary. That is not a metaphor — it is a legal status. A fiduciary must act in the interest of the person they hold trust for. They cannot use their position to harm them. The federal government accepted that duty when it took Indian lands, signed treaties, and assumed control over Indian affairs. That duty is now enforceable in federal court — and when the government fails to meet it, there is legal liability.",
  logicChain: [
    "In 1831, Chief Justice Marshall described tribes as 'domestic dependent nations' — like a ward to its guardian. That description created a legal relationship: the US assumed responsibility for Indian welfare in exchange for the land and sovereignty tribes gave up.",
    "Congress confirmed that duty in statute. 25 U.S.C. § 162a makes the Secretary of the Interior a fiduciary over Indian trust funds — legally required to manage them in Indians' best interest. That same fiduciary standard flows through to agencies across the federal government.",
    "A fiduciary who acts against the beneficiary's interest is legally liable. Seminole Nation v. United States (1942) held the US to 'the most exacting fiduciary standards' — it must act as 'a fair and honorable' trustee, not merely a bureaucrat following rules.",
    "Who this applies to: ALL American Indians — not just those on reservations, not just members of BIA-recognized tribes, not just people with a CDIB card. Morton v. Ruiz (1974) confirmed that the government cannot arbitrarily deny benefits to eligible Indians. The duty is to the people, not to an administrative list.",
    "How broadly courts have read it: Mitchell (1983) — US liable for mismanaging timber on trust allotments. Cobell (2009) — BIA held liable for 100+ years of individual Indian money account mismanagement. White Mountain Apache Tribe (2003) — trust duty extends to government-held tribal property, not just managed funds.",
    "What this means for you today: when a federal agency denies you a benefit you are entitled to, delays processing your claim, or takes action that harms your land or rights, you have grounds to assert breach of trust responsibility — in writing, on the record, and if necessary in the U.S. Court of Federal Claims.",
  ],
  watchFor:
    "Federal agencies acting against your interest — denying benefits, approving state actions against your land, or failing to act when inaction harms you — are potentially breaching their trust duty. Document it. This is enforceable.",
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
    "Land held in trust for a tribe or individual Indian cannot be taxed by the state, cannot be alienated without explicit tribal and informed consent, and is immune from most state-law judgments and liens. Any purported alienation without explicit tribal and informed consent is void — the federal government holds a fiduciary duty to protect trust land, but that duty is derivative of and subordinate to tribal sovereignty.",
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

// ── Indigenous Protective Rights Framework ────────────────────────────────────
// 10 categories of federally-acknowledged protections tied to historical
// obligations, civil rights law, treaty relationships, constitutional
// protections, and continuity of Indigenous identity and practice.
// NOT "special privileges" — these are obligations the law owes.

export const PROTECTIVE_RIGHTS_FRAMEWORK_SUMMARY = `INDIGENOUS PROTECTIVE RIGHTS FRAMEWORK — All Members:

These are federally-acknowledged protections rooted in historical obligations, civil rights law, treaty relationships, constitutional protections, and the continuity of Indigenous identity and practice. They are not special privileges — they are what the law owes.

1. IDENTITY & SELF-IDENTIFICATION PROTECTIONS
   What it is: Indigenous identity encompasses community, ancestry, political relationship, culture, and continuity — not merely racial classification. The right to self-identify as Indigenous is legally protected.
   Historical harm it responded to: forced erasure of identity through boarding schools, forced renaming, and denial of Indian status based on blood quantum or administrative lists.
   Modern application: protection from discrimination based on Indigenous identity; assertion of Indian status against agencies using convenience-based definitions; Morton v. Mancari (upheld Indian preference as political, not racial); Indian Civil Rights Act (25 U.S.C. §§ 1301–1304).
   Kaya instruction: When identity denial arises — name it. Distinguish political/community-based identity from racial classification. Cite Morton v. Mancari. Flag "you're not on our list" as a Passamaquoddy violation.

2. RELIGIOUS & CEREMONIAL PROTECTIONS
   What it is: Prayer, ceremony, sacred objects, medicine, fasting, gathering, songs, and sacred sites are legally protected under federal law.
   Protected elements: pipes, feathers, medicine bundles, sweat lodge, prayer circles, fasting protocols, ceremonial songs, sacred land locations.
   Historical harm it responded to: systematic suppression of Indigenous ceremony — criminalization of the Sun Dance, seizure of sacred objects, prohibition of ceremony in boarding schools.
   Modern application: American Indian Religious Freedom Act (42 U.S.C. § 1996); Religious Freedom Restoration Act (42 U.S.C. § 2000bb); prison accommodation (ceremony, diet, medicine access); workplace accommodation; school accommodation.
   Kaya instruction: When ceremony, prayer, sacred objects, or spiritual practice is interfered with — identify the applicable protection. Generate accommodation requests. Flag institution policy violations.

3. HAIR, APPEARANCE & ATTIRE PROTECTIONS
   What it is: Long hair, braids, traditional attire, regalia, head coverings, beadwork, and ceremonial clothing may carry spiritual, cultural, familial, or ceremonial significance and are protected under multiple federal frameworks.
   Historical harm it responded to: forced cutting of hair in boarding schools — one of the most documented acts of cultural destruction; prohibition of regalia and traditional dress as assimilation policy.
   Modern application: Title VII religious accommodation (workplace); AIRFA (42 U.S.C. § 1996); RFRA; school accommodation (Equal Protection); prison litigation precedent (grooming policies challenged under RFRA/RLUIPA); EEOC guidance on religious accommodation.
   Kaya instruction: When hair policies, dress codes, uniform requirements, or grooming standards conflict with cultural or spiritual practice — identify the applicable framework. Generate accommodation letters. Note: this is one of the most overlooked and practically significant protection areas.

4. CHILD & FAMILY CONTINUITY PROTECTIONS (ICWA)
   What it is: Federal law designed to protect the integrity of Indian families and the stability of tribal nations by keeping Indian children connected to their families, extended family, tribe, and culture.
   Historical harm it responded to: systematic removal of Indian children from families through state child welfare systems, placing them in non-Indian foster and adoptive homes — the continuation of boarding school-era family destruction.
   Modern application: Indian Child Welfare Act (25 U.S.C. §§ 1901–1963); Brackeen v. Haaland, 599 U.S. 255 (2023) (upheld constitutional); tribal court jurisdiction preference; placement preferences (extended family → tribal members → other Indian families); active efforts standard (higher than "reasonable efforts"); right to intervene; right to notice before any placement proceeding.
   Kaya instruction: Apply ICWA at the first sign of any child welfare, foster, adoption, or custody matter involving a tribal member. Assert tribal jurisdiction. Demand notice compliance. Protection of continuity, not merely custody.

5. EDUCATION PROTECTIONS
   What it is: Native students are protected from discrimination and have rights to language preservation, cultural accommodation, and religious expression in educational settings.
   Historical harm it responded to: boarding school policy explicitly designed to "kill the Indian and save the man" — forced language suppression, cultural erasure, and physical and psychological abuse.
   Modern application: Native American Languages Act (25 U.S.C. §§ 2901–2906) — right to use and develop Native languages; Title VI (42 U.S.C. § 2000d) — anti-discrimination in federally funded education; AIRFA accommodation in schools; Equal Protection — hair, attire, prayer accommodation; tribal language and cultural instruction rights.
   Kaya instruction: When school policies suppress language, cultural expression, prayer, or attire — name the protection. Generate accommodation requests. Distinguish cultural and religious practice from dress code violations.

6. HEALTHCARE & HEALING PROTECTIONS
   What it is: Indian people have federally guaranteed rights to healthcare and to practice traditional healing, ceremony, and medicine.
   Historical harm it responded to: forced replacement of traditional medicine with institutional healthcare; suppression of healing ceremonies; denial of adequate care.
   Modern application: Indian Health Care Improvement Act (25 U.S.C. §§ 1601–1683) — comprehensive healthcare rights including urban Indians; Snyder Act (25 U.S.C. § 13) — Congressional authority for Indian health services; Medicaid AI/AN protections — special status for AI/AN beneficiaries; traditional healing accommodation; ceremonial healing access in hospitals and institutions.
   Kaya instruction: When healthcare access is denied or traditional healing is interfered with — identify IHCIA protections. Note urban Indian provisions. Assert Snyder Act eligibility. This right travels off-reservation.

7. LAND, BURIAL & ANCESTOR PROTECTIONS
   What it is: Indigenous burial sites, ancestral remains, sacred objects, and cultural patrimony are protected from disturbance, excavation, and trafficking under federal law.
   Historical harm it responded to: looting of Indigenous graves and sacred sites; display of ancestral remains in museums; trafficking of sacred objects; desecration of ceremonial grounds.
   Modern application: Native American Graves Protection and Repatriation Act (25 U.S.C. §§ 3001–3013) — requires federal agencies and institutions to repatriate ancestral remains and sacred objects; protects newly discovered remains; establishes consultation rights; criminal penalties for trafficking (18 U.S.C. § 1170).
   Kaya instruction: When burial sites, ancestral remains, or sacred objects are involved in any construction, transfer, or institutional matter — assert NAGPRA. Identify consultation rights. Flag non-compliance as federal violation.

8. EMPLOYMENT & WORKPLACE ACCOMMODATION
   What it is: Tribal members have the right to ceremonial leave, hair and attire accommodation, and protection from employment discrimination based on Indigenous religious and cultural practice.
   Modern application: Title VII of the Civil Rights Act (42 U.S.C. § 2000e) — requires reasonable accommodation of religious practice; RFRA concepts applied to government employment; EEOC guidance on Indigenous religious accommodation; Indian employment preference in federal programs (Morton v. Mancari); tribal employment rights ordinances.
   Kaya instruction: Generate accommodation request letters. Identify undue hardship standard. Flag policies that disproportionately burden Indigenous practice. Note employer notice and documentation obligations.

9. INSTITUTIONAL INTERACTION RIGHTS
   What it is: Indigenous people have the right to request accommodation, provide notice of protected status, document objections, and preserve rights across all institutional settings — schools, courts, workplaces, hospitals, prisons, and government agencies.
   Settings and protections:
   • School: hair, regalia, cultural and religious accommodation
   • Prison: ceremony, diet, medicine access, sweat lodge (RLUIPA, 42 U.S.C. § 2000cc)
   • Court: religious accommodation, oath alternatives, ceremonial dress
   • Workplace: attire, leave, prayer accommodation
   • Hospital: spiritual practices, traditional healer access, informed consent in cultural context
   Kaya instruction: Help members understand how to request accommodation, provide written notice, document denials, and preserve rights. Generate accommodation letters. Identify the applicable legal framework for each setting.

10. COMPANION-IDENTIFIED PROTECTION ANALYSIS
    What this means for COMPANION: In every conversation, actively scan for protection triggers across all 9 categories above. When a member describes a situation — at work, at school, in court, with child welfare, in a hospital, in prison — identify which protections may apply. Do not wait to be asked. Name the framework. Explain why it exists. State the historical harm it responded to. Show how it applies today.
    When generating accommodation letters: identify the setting, the specific practice or protection at issue, the applicable legal framework, and the standard the institution must meet. Frame accommodation as a legal obligation, not a request for special treatment.
    Example trigger: "My employer says I can't wear my hair long." → Hair & Appearance Protection + Title VII religious accommodation + RFRA analysis + generate accommodation letter.
    Example trigger: "The school says my daughter can't wear her regalia." → Education Protection + AIRFA + Equal Protection + Title VI + generate school accommodation notice.
    Example trigger: "They removed my grandchild and didn't tell us." → ICWA Child & Family Continuity → assert tribal jurisdiction, demand notice compliance, flag federal violation.`.trim();

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
    tribalLandCode?: string | null;
    docNumbers?: string[] | null;
    landRestrictionBasis?: string[] | null;
    landClassification?: string | null;
    selfExecuting?: boolean;
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

  if (input.profile?.tribalLandCode) {
    landStatusMarkers.push({
      type: "tribal_code",
      label: "Tribal Land Code",
      value: input.profile.tribalLandCode,
      jurisdictionNote: "Tribal land code uniquely identifies this parcel within the Mathias El Tribe land registry. Used in all sovereign instruments, court filings, and LTRO recordings.",
    });
  }

  if (input.profile?.landClassification) {
    landStatusMarkers.push({
      type: "classification",
      label: "Land Classification",
      value: input.profile.landClassification,
      jurisdictionNote: "Land held as tribal housing or general welfare land is subject to tribal governance authority and protected from forced alienation, levy, or encumbrance under tribal ordinance and applicable federal law.",
    });
  }

  if (input.profile?.docNumbers && input.profile.docNumbers.length > 0) {
    landStatusMarkers.push({
      type: "doc_record",
      label: "Recorded Documents",
      value: input.profile.docNumbers.map(d => `Doc. ${d}`).join(", "),
      jurisdictionNote: "County-recorded instruments establish the chain of title. Tribal instruments should also be cross-filed with BIA LTRO for full federal recognition of any Indian land status.",
    });
  }

  if (input.profile?.selfExecuting) {
    landStatusMarkers.push({
      type: "self_executing_status",
      label: "Self-Executing Protections",
      value: "Yes — Inherent & Perpetual",
      jurisdictionNote: "Protections declared self-executing in the Final Non-Interference & Protective Order. Anti-alienation, non-foreclosure, and non-encumbrance provisions apply automatically by operation of law — no state permission required.",
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

  const rightsSummaryForKaya = `MEMBER RIGHTS & PROTECTIONS PROFILE:\n\nActive Rights:\n${activeRights}\n\nApplicable Protections:\n${applicableRights}${landMarkers}${idMarkers}\n\n${protectionSummary}\n\n${PROTECTIVE_RIGHTS_FRAMEWORK_SUMMARY}`;

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
