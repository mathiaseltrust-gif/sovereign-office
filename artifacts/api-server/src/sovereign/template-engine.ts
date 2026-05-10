import { db } from "@workspace/db";
import { templatesTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { logger } from "../lib/logger";
import type { PdfBuildInput, RecorderMetadata } from "../lib/pdf-builder";

export interface TemplateVariable {
  key: string;
  value: string;
}

export interface RenderedTemplate {
  title: string;
  content: string;
  pdfInput: PdfBuildInput;
}

const BUILT_IN_TEMPLATES: Record<string, Omit<PdfBuildInput, "recorderMetadata">> = {
  trust_deed: {
    title: "DEED OF TRUST — INDIAN TRUST LAND",
    parties: {
      Grantor: "[GRANTOR FULL NAME]",
      Grantee: "[GRANTEE FULL NAME]",
      Trustee: "Sovereign Office of the Chief Justice & Trustee",
      Beneficiary: "[BENEFICIARY NAME / TRIBE]",
    },
    land: {
      description: "[INSERT FULL LEGAL DESCRIPTION OF TRUST LAND HERE]",
      classification: "Indian Trust Land",
    },
    provisions: [
      "CONVEYANCE: The Grantor hereby conveys and warrants to the Grantee, subject to all conditions and restrictions of this instrument, the real property described herein.",
      "TRUST LAND RESTRICTION: This conveyance is subject to all restrictions on alienation imposed by federal law on Indian trust land, including 25 U.S.C. § 177.",
    ],
    trusteeNotes: "Review with tribal legal counsel prior to execution. Secretary of Interior approval may be required.",
  },
  allotment_lease: {
    title: "LEASE OF INDIVIDUAL INDIAN ALLOTMENT",
    parties: {
      Lessor: "[ALLOTTEE FULL NAME]",
      Lessee: "[LESSEE FULL NAME]",
      "BIA Approving Officer": "Bureau of Indian Affairs, [Agency Name]",
    },
    land: {
      description: "[INSERT ALLOTMENT LEGAL DESCRIPTION]",
      classification: "Individual Indian Allotment",
    },
    provisions: [
      "LEASE TERM: This lease shall commence on [START DATE] and expire on [END DATE], unless earlier terminated pursuant to the provisions herein.",
      "RENTAL RATE: Lessee shall pay to Lessor, through the Bureau of Indian Affairs, the sum of $[AMOUNT] per [PERIOD].",
      "BIA APPROVAL: This lease is subject to approval by the Bureau of Indian Affairs pursuant to 25 U.S.C. § 415 and 25 C.F.R. Part 162.",
    ],
    trusteeNotes: "BIA approval required per 25 U.S.C. § 415.",
  },
  trust_transfer: {
    title: "TRUST LAND TRANSFER INSTRUMENT",
    parties: {
      Transferor: "[TRANSFEROR NAME / TRIBE]",
      Transferee: "[TRANSFEREE NAME / TRIBE]",
      Trustee: "United States of America, by and through the Secretary of the Interior",
    },
    land: {
      description: "[INSERT TRUST LAND LEGAL DESCRIPTION]",
      classification: "Federal Trust Land",
    },
    provisions: [
      "SECRETARIAL APPROVAL: This transfer is conditioned upon approval of the Secretary of the Interior pursuant to 25 U.S.C. § 177 and applicable regulations.",
      "TITLE STATUS: Title shall remain in trust upon completion of this transfer. No state real property transfer tax applies.",
    ],
    trusteeNotes: "File with BIA Land Records Office. Obtain Title Status Report prior to execution.",
  },
  nfr: {
    title: "NOTICE OF FAULT AND REMEDIES",
    parties: {
      "Issuing Authority": "Sovereign Office of the Chief Justice & Trustee",
      Respondent: "[RESPONDENT FULL NAME]",
      "Affected Party": "[TRIBE / INDIVIDUAL ALLOTTEE]",
    },
    land: {
      description: "[INSERT DESCRIPTION OF AFFECTED TRUST LAND]",
      classification: "Indian Trust Land",
    },
    provisions: [
      "NOTICE OF FAULT: You are hereby notified that your actions, described herein, constitute a violation of federal Indian law, tribal law, and/or the terms of the trust described herein.",
      "REMEDY REQUIRED: You are required to cure the fault described herein within [NUMBER] days of service of this notice.",
      "CONSEQUENCE OF NON-COMPLIANCE: Failure to comply with the terms of this notice may result in further legal action under tribal and federal law.",
    ],
    trusteeNotes: "Serve via certified mail, return receipt requested. File proof of service.",
  },

  medical_protection_decree: {
    title: "JURISDICTIONAL DECREE OF MEDICAL PROTECTION & HEALING ENFORCEMENT",
    parties: {
      "Issuing Court": "Mathias El Tribe Supreme Court, Office of the Chief Justice & Trustee",
      "In Conjunction With": "Mathias El Tribe Medical Center",
      "Patient / Beneficiary": "[PATIENT FULL NAME]",
      "Date of Birth": "[DOB]",
      "Member ID": "[MEMBER ID]",
    },
    land: {
      description: "This Decree is jurisdictional in nature and applies to tribal members and their medical welfare within the jurisdiction of the Mathias El Tribe Supreme Court, consistent with Williams v. Lee (358 U.S. 217, 1959) and McGirt v. Oklahoma (591 U.S. 894, 2020).",
      classification: "Sovereign Tribal Jurisdiction — Medical Authority",
    },
    provisions: [
      "I. AUTHORITY: By the inherent sovereignty of the Mathias El Tribe, and under the jurisdiction of the Mathias El Tribe Supreme Court, all determinations of the Mathias El Tribe Medical Center are hereby elevated as Judicial Decrees of this Court, self-executing and enforceable without external validation. This Decree shall be interpreted in accordance with the Indian Canons of Construction, which require liberal construction in favor of tribes.",
      "II. STATUTORY & PROCEDURAL AUTHORITY: This Decree is supported by: Treaty Supremacy (U.S. Const. art. VI, cl. 2); Non-Intercourse Act (25 U.S.C. § 177); Indian Health Care Improvement Act (25 U.S.C. § 1601 et seq.); Indian Self-Determination and Education Assistance Act (25 U.S.C. § 5304(e)); Title VI Civil Rights Act (42 U.S.C. § 2000d); VAWA Full Faith & Credit (18 U.S.C. § 2265); Williams v. Lee (358 U.S. 217, 1959); McGirt v. Oklahoma (591 U.S. 894, 2020); Passamaquoddy v. Morton (528 F.2d 370, 1st Cir. 1975); Loper Bright v. Raimondo (603 U.S. ___, 2024).",
      "III. STATUTORY SUPPORT & EXTERNAL RECOGNITION: This Decree shall be honored by state and federal agencies pursuant to: 25 U.S.C. § 1621e (prohibiting states and insurers from denying tribal health claims); 25 U.S.C. § 1647b (parity in coverage — tribal determinations treated equally with federal provider determinations); 42 U.S.C. § 2000d (refusal to honor this Decree constitutes unlawful discrimination in federally funded programs); 42 C.F.R. § 136.11 (tribal facilities are federally recognized providers of health services); 45 C.F.R. § 1355.30 (effective Oct. 1, 2025 — binds California EDD and SSA to respect tribal determinations).",
      "IV. MEDICAL FINDINGS: [INSERT MEDICAL FINDINGS — describe diagnosed conditions, symptoms, neurological risks, and medical necessity as determined by the Tribal Medical Center. All findings are final, sovereign, and require no external validation.]",
      "V. DECREE OF ENFORCEMENT: IT IS HEREBY DECREED: (1) Protective Healing Enforcement is in effect — the patient shall abstain from all labor and external work obligations, effective immediately and indefinitely, until lifted by tribal medical authority. (2) This Decree is jurisdictional and shall be recognized as binding under the federal trust responsibility, treaty law, and tribal judicial enforcement. (3) All employers, insurers, and governmental agencies — including SSA and the California Employment Development Department — are directed to honor this Decree under their obligations under federal law. (4) Any challenge or interference with this Decree shall constitute contempt of this Court and a violation of tribal sovereignty.",
      "VI. HEALING DIRECTIVES: Immediate cessation of work and protective rest. Diagnostic imaging (X-ray, MRI) as indicated. Emergency protective care: ice/heat modulation, anti-inflammatory measures, posture support. Therapeutic intervention once stabilized (physical therapy, neuromuscular rehabilitation). Nutritional reinforcement: protein, omega-3, hydration, magnesium, vitamin D. Spiritual and sovereign rest in alignment with tribal law and protective authority.",
      "VII. FINANCIAL RECOVERY & REIMBURSEMENT: All payments for services certified herein shall be made directly to the Mathias El Tribe Medical Center or to the patient-beneficiary, as elected, pursuant to 25 U.S.C. § 1621e and CMS reimbursement regulations. Any refusal, delay, or reduction in payment constitutes unlawful discrimination under Title VI (42 U.S.C. § 2000d) and a breach of the federal trust responsibility. Tribal medical determinations shall be treated with full parity to federal employee health benefit programs, Medicare, and Medicaid (25 U.S.C. § 1647b).",
      "VIII. INTERPRETIVE FINALITY — CHEVRON LIMITATION: Federal agencies are not entitled to judicial deference in interpreting statutes affecting tribal rights (Loper Bright v. Raimondo, 603 U.S. ___, 2024). Statutory text must be read according to its plain meaning, consistent with congressional intent and treaty supremacy. All ambiguities shall be resolved under the Indian Canons of Construction in favor of the Tribe.",
      "IX. DUE PROCESS & PROCEDURAL COMPLIANCE: This Decree is governed by the Mathias El Tribal Code, Title 4: Sovereignty, Jurisdiction, and Due Process Act (SJDPA). All affected parties are provided notice and opportunity to be heard. Jurisdiction meets the standards required for recognition and enforcement under comity principles (Wilson v. Marchington, 127 F.3d 805, 9th Cir. 1997; Rincon Mushroom Corp. v. Mazzetti, 2022 U.S. Dist. LEXIS 67044).",
      "X. RESERVATION OF RIGHTS: This Jurisdictional Decree is final, self-executing, and requires no external validation. All rights are reserved under tribal, treaty, and constitutional law. Nothing herein shall be construed as a waiver of the sovereign immunity of the United States, the Mathias El Tribe, or tribal government.",
    ],
    trusteeNotes: "Issue under seal of the Supreme Court and Medical Center. Serve on all relevant parties via certified mail. File with tribal court records. Provide to EDD, SSA, employer, and insurer simultaneously. Cite MET-SC-2025-007A as precedential protective continuance.",
  },

  disability_enforcement_notice: {
    title: "NOTICE OF TRIBAL MEDICAL DECREE — COMPLIANCE REQUIRED",
    parties: {
      "Issuing Authority": "Sovereign Office of the Chief Justice & Trustee, Mathias El Tribe Supreme Court",
      "Directed To": "[AGENCY / EMPLOYER / INSURER FULL NAME]",
      "Re: Patient / Beneficiary": "[PATIENT FULL NAME]",
      "Member ID": "[MEMBER ID]",
      "Decree Reference": "[CASE NO. — e.g. MET-SC-2025-007A]",
    },
    land: {
      description: "This Notice pertains to the medical and disability rights of a tribal member of the Mathias El Tribe and is issued under the sovereign and federal authority of the Mathias El Tribe Supreme Court.",
      classification: "Sovereign Tribal Medical Authority",
    },
    provisions: [
      "NOTICE OF BINDING DECREE: You are hereby placed on formal notice that the Mathias El Tribe Supreme Court has issued a Jurisdictional Decree of Medical Protection & Healing Enforcement (Case No. [CASE NO.]) establishing a protected medical leave and disability determination for the above-named tribal member. This Decree is self-executing and requires no external validation for recognition or enforcement.",
      "YOUR LEGAL OBLIGATION — TITLE VI: Your agency / organization is a recipient of federal financial assistance and is bound by Title VI of the Civil Rights Act (42 U.S.C. § 2000d). Refusal to honor this Decree constitutes unlawful discrimination on the basis of national origin (Indian tribal membership). You are required to honor this Decree on the same terms as a determination by any licensed provider.",
      "YOUR LEGAL OBLIGATION — IHCIA § 1621e: Pursuant to 25 U.S.C. § 1621e, you are expressly prohibited from denying or limiting claims submitted by tribal health entities. Payment obligations for services documented herein must comply with federal Social Security Act standards.",
      "YOUR LEGAL OBLIGATION — IHCIA § 1647b (PARITY): Pursuant to 25 U.S.C. § 1647b, the tribal medical determination contained in this Decree must be treated with full parity to determinations made by licensed federal health providers, Medicare, and Medicaid. No reduction, limitation, or discrimination may be applied on the basis of tribal origin.",
      "YOUR LEGAL OBLIGATION — 42 C.F.R. § 136.11: Federal regulations confirm that tribal facilities under contract with the Indian Health Service are legitimate providers of federally recognized health services. Determinations by the Mathias El Tribe Medical Center carry the same federal recognition as IHS facility determinations.",
      "YOUR LEGAL OBLIGATION — 45 C.F.R. § 1355.30: As a program funded under the Social Security Act, you are bound by 45 C.F.R. § 1355.30 (effective Oct. 1, 2025) to administer benefits without discrimination and to respect tribal medical determinations.",
      "LOPER BRIGHT NOTICE — NO DEFERENCE: Pursuant to Loper Bright Enterprises v. Raimondo (603 U.S. ___, 2024), your agency is not entitled to reinterpret the statutes referenced herein in ways that diminish tribal rights. The plain meaning of these statutes compels compliance with this Decree.",
      "REQUIRED ACTION: You are directed to: (1) Accept and process the disability / medical leave claim for [PATIENT FULL NAME] effective [EFFECTIVE DATE]; (2) Issue payment / benefits at the applicable rate without reduction; (3) Confirm compliance in writing within [NUMBER] days of receipt of this Notice.",
      "CONSEQUENCE OF NON-COMPLIANCE: Failure to comply with this Notice constitutes: (a) Contempt of the Mathias El Tribe Supreme Court; (b) Unlawful discrimination under Title VI (42 U.S.C. § 2000d); (c) Violation of the federal trust responsibility; (d) Actionable breach of 25 U.S.C. §§ 1621e and 1647b. This matter will be referred to the Bureau of Indian Affairs, the Department of Justice Civil Rights Division, and tribal legal counsel for enforcement.",
    ],
    trusteeNotes: "Serve via certified mail, return receipt requested, to: agency benefits office, legal/compliance department, and claims processing center simultaneously. Attach a copy of the full Jurisdictional Decree (MET-SC-2025-007A or applicable case number). Retain proof of service in tribal court records.",
  },

  sovereign_restoration_declaration: {
    title: "SOVEREIGN RESTORATION DOCTRINE — FORMAL DECLARATION",
    parties: {
      "Issuing Authority": "Chief Mathias El, Mathias El Tribe Supreme Court",
      "Office": "Office of the Chief Justice & Trustee",
      "Doctrine Reference": "SRD-2025 — Sovereign Restoration Doctrine",
    },
    land: {
      description: "This declaration pertains to the territorial, identity, and jurisdictional sovereignty of the Mathias El Tribe and all affiliated tribal members whose identity and lineage were subject to administrative erasure through racial reclassification laws and territorial usurpation policies.",
      classification: "Sovereign Tribal Territory — All Lands Under Tribal Jurisdiction",
    },
    provisions: [
      "I. FOUNDATIONAL UNDERSTANDING: Two coordinated systems were used to dismantle Indigenous nations: (1) Territorial Usurpation and (2) Identity Usurpation. These systems operated together. One removed the land. The other removed the people on paper. This doctrine is the counter-system to both.",
      "II. TERRITORIAL USURPATION — DOCUMENTED PATTERN: State authority was unlawfully extended over sovereign Indigenous nations through: forced treaties; removal policies; state laws overriding tribal jurisdiction; squatter invasions; nullification of treaty protections. The pattern was: (1) Declare Indigenous land 'vacant' or 'unused'; (2) Extend state law over sovereign territory without consent; (3) Apply pressure to force unequal treaties; (4) Remove the Nation; (5) Open land to settlement. This constitutes usurpation — the illegal taking of authority, land, and jurisdiction.",
      "III. IDENTITY USURPATION — PAPER GENOCIDE: After territorial usurpation came administrative erasure: the 1924 Virginia Racial Integrity Act; state laws eliminating 'Indian' as a legal category; reclassification of Indigenous families as 'Colored,' 'Negro,' or 'Mixed'; enforcement of the one-drop rule; destruction of tribal identity in state records; collapse of multiple Indigenous nations into the 'Black' category. This was paper genocide — the administrative destruction of a people's legal identity — severing families from tribal lineage and their ability to assert treaty rights, land claims, and sovereign status.",
      "IV. THE HISTORICAL LINK: Many people labeled 'Black' today descend from Indigenous nations whose identity was erased by law. This is supported by: census records; racial integrity laws; tribal rolls; removal treaties; colonial descriptions; state reclassification practices. The oral history 'We were here first' reflects truth — identity was overwritten, not lost.",
      "V. SOVEREIGN RESTORATION — THE COUNTER-SYSTEM: This office operates the following restoration components: (1) Identity Engine — restores tribal lineage outside state racial categories; (2) Intake Red-Flag Filter — detects jurisdictional conflicts and usurpation patterns; (3) Welfare Authority Engine — asserts sovereign authority over tribal member wellbeing; (4) Doctrine Overlays — integrates treaties, federal Indian law, tribal law, and historical doctrine; (5) Recorder-Aware Workflows — prevents modern forms of identity erasure and ensures accurate sovereign records; (6) Governance Tools — calendar, notifications, and operational workflows; (7) Safety Net Logic — protects tribal citizens from state overreach and improper jurisdiction.",
      "VI. DOCTRINE SUMMARY: My people's identity, jurisdiction, and sovereignty were not lost. They were overwritten. This system restores what was taken. This is the purpose and legal foundation of the Sovereign Restoration Doctrine. All ambiguities shall be resolved under the Indian Canons of Construction in favor of the Tribe. Any state action, administrative record, or agency determination that relies on a racially reclassified identity for this tribal member is hereby challenged as a product of paper genocide and subject to sovereign remediation.",
      "VII. RESERVATION OF RIGHTS: All rights are reserved under tribal, treaty, and constitutional law. Nothing in this declaration constitutes a waiver of sovereign immunity. This declaration is self-executing and requires no external validation.",
    ],
    trusteeNotes: "File with tribal court records and identity restoration archive. Serve on relevant agencies holding incorrect racial classification records. Cite alongside lineage documentation, census records, and tribal enrollment verification. Reference SRD-2025 and MET-SC-2025 series for enforcement.",
  },

  inherent_sovereignty_declaration: {
    title: "DECLARATION OF INHERENT SOVEREIGNTY & SELF-GOVERNMENT",
    parties: {
      "Declarant": "[FULL NAME — CHIEF / TRUSTEE / TRIBAL MEMBER]",
      "Nation": "Mathias El Tribe",
      "Issuing Office": "Office of the Chief Justice & Trustee, Mathias El Tribe Supreme Court",
      "Declaration Reference": "SD-2025 — Sovereignty Declaration",
    },
    land: {
      description: "This declaration asserts the inherent, pre-constitutional, and unconditional sovereignty of the Mathias El Tribe and its members over all matters of governance, identity, and jurisdiction. It is a standing declaration operative in all courts, agencies, and proceedings.",
      classification: "Sovereign Tribal Jurisdiction — Inherent Authority",
    },
    provisions: [
      "I. SOURCE OF SOVEREIGNTY: My right to self-government does not come from the United States. It is inherent to me, my people, and my Nation. I existed before the United States, and my Nation existed before the United States. Because of that, my political identity is not created by any federal statute, agency, or program. No external government has the authority to grant me what I already am.",
      "II. CONTINUITY OF GOVERNANCE: If the United States were ever unable to function, or if its institutions failed to operate, that would not change who I am or how I govern. Their administrative structure may rise or fall, but my inherent sovereignty does not depend on their stability, their funding, or their existence. There is no clause in the Constitution, no statute, and no treaty that says my right to self-government ends if the United States ceases to operate. No such language exists because the right is not theirs to give, and therefore it is not theirs to take.",
      "III. LEGAL FOUNDATION: This declaration is grounded in: Worcester v. Georgia, 31 U.S. 515 (1832) — state laws have no force over tribal sovereignty; United States v. Wheeler, 435 U.S. 313 (1978) — tribes are separate sovereigns; United States v. Lara, 541 U.S. 193 (2004) — tribal sovereignty is inherent, not delegated by states; Santa Clara Pueblo v. Martinez, 436 U.S. 49 (1978) — tribal political identity is internal and exclusive; Morton v. Mancari, 417 U.S. 535 (1974) — Indian identity is political, not racial; Cherokee Nation v. Georgia, 30 U.S. 1 (1831) — tribes are domestic dependent nations under federal protection, not state authority.",
      "IV. UNCONDITIONAL NATURE: My governance continues because it comes from me and from my people. It comes from our ancestors, our land, our responsibilities, and our identity. It is not borrowed. It is not conditional. It is not temporary. With or without the United States, I govern myself. With or without federal administration, my sovereignty remains intact.",
      "V. STANDING DECLARATION: My right to self-government is inherent, enduring, and self-executing. This is my standing declaration. It is operative in all proceedings, administrative processes, and legal matters involving this Nation and its members. Any agency, court, or party that refuses to recognize this inherent sovereignty acts in violation of federal Indian law, the Indian Commerce Clause (U.S. Const. Art. I, § 8, cl. 3), and the federal trust responsibility.",
      "VI. RESERVATION OF RIGHTS: Nothing in this declaration shall be construed as a waiver of sovereign immunity. All rights are reserved under tribal, treaty, and constitutional law. This declaration is self-executing and requires no external validation for legal effect.",
    ],
    trusteeNotes: "This declaration may be filed in any court, administrative proceeding, or agency process as a standing assertion of inherent sovereignty. It does not require counter-signature by any external authority. Attach to all filings, petitions, and correspondence with state and federal agencies. Update the 'Declarant' field with the specific member's name for individualized filings.",
  },

  state_prohibition_notice: {
    title: "NOTICE OF STATE JURISDICTIONAL PROHIBITIONS — CEASE AND DESIST",
    parties: {
      "Issuing Authority": "Sovereign Office of the Chief Justice & Trustee, Mathias El Tribe",
      "Directed To": "[AGENCY / OFFICIAL / ENTITY FULL NAME AND TITLE]",
      "Re: Tribal Member": "[MEMBER FULL NAME]",
      "Member ID": "[MEMBER ID]",
      "Doctrine Reference": "SPD-2025 — State Prohibitions Doctrine",
    },
    land: {
      description: "This Notice pertains to actions taken by the above-named state agency or official that violate the jurisdictional boundaries of the Mathias El Tribe. The conduct described herein falls within one or more of the sovereign prohibitions established under federal constitutional law, federal statutes, and controlling Supreme Court precedent.",
      classification: "Sovereign Tribal Jurisdiction",
    },
    provisions: [
      "NOTICE: You are hereby placed on formal notice that the actions taken by your agency constitute a violation of established federal Indian law. The following prohibitions apply to your conduct:",
      "PROHIBITION I — YOU CANNOT REPRESENT THIS TRIBAL COMMUNITY: States have no authority over tribal political communities. Worcester v. Georgia, 31 U.S. 515 (1832); United States v. Wheeler, 435 U.S. 313 (1978); Santa Clara Pueblo v. Martinez, 436 U.S. 49 (1978). Authority: U.S. Const. Art. I, § 8, cl. 3; 25 U.S.C. §§ 2, 5123.",
      "PROHIBITION II — YOU CANNOT CLASSIFY THIS MEMBER AS A RACIAL GROUP: 'Indian' is a political, not racial, classification. Morton v. Mancari, 417 U.S. 535 (1974); United States v. Antelope, 430 U.S. 641 (1977); Rice v. Cayetano, 528 U.S. 495 (2000). Any state record, database, or administrative determination that classifies this tribal member racially rather than politically is void.",
      "PROHIBITION III — YOU CANNOT LEGISLATE FOR OR GOVERN THIS TRIBAL COMMUNITY: Worcester v. Georgia; Williams v. Lee, 358 U.S. 217 (1959); McClanahan v. Arizona Tax Comm'n, 411 U.S. 164 (1973). Authority: 25 U.S.C. § 5123; 18 U.S.C. § 1151; Supremacy Clause.",
      "PROHIBITION IV — YOU CANNOT TAX TRIBAL GOVERNMENTS OR TRIBAL LANDS: McClanahan; Oklahoma Tax Comm'n v. Chickasaw Nation, 515 U.S. 450 (1995); County of Yakima v. Yakima Nation, 502 U.S. 251 (1992). Authority: 25 U.S.C. §§ 5108, 465; federal trust responsibility.",
      "PROHIBITION V — YOU CANNOT TAX TRIBAL CITIZENS ON TRIBAL LAND: McClanahan; Washington v. Confederated Tribes of Colville, 447 U.S. 134 (1980); Moe v. Confederated Salish & Kootenai Tribes, 425 U.S. 463 (1976).",
      "PROHIBITION VI — YOU CANNOT POLITICALLY INCORPORATE THIS NATION: Worcester v. Georgia; United States v. Lara, 541 U.S. 193 (2004); Santa Clara Pueblo v. Martinez. Tribal sovereignty is inherent and not delegated by states.",
      "PROHIBITION VII — YOU CANNOT OVERRIDE THE FEDERAL TRUST RESPONSIBILITY: Seminole Nation v. United States, 316 U.S. 286 (1942); United States v. Mitchell II, 463 U.S. 206 (1983); Cherokee Nation v. Georgia, 30 U.S. 1 (1831). Authority: 25 U.S.C. §§ 13, 5101; Supremacy Clause.",
      "MASTER PROHIBITION: A state cannot represent, classify, govern, tax, politically incorporate, or racially categorize an Indigenous political community. Indigenous identity is political, not racial, and therefore outside state political jurisdiction. Your conduct falls within the prohibited categories above.",
      "REQUIRED ACTION: Immediately cease the prohibited conduct. Issue a written confirmation of compliance within [NUMBER] days. Correct any administrative records containing racial misclassification of this tribal member. Recognize the political tribal status of [MEMBER FULL NAME] in all future proceedings.",
      "CONSEQUENCE OF NON-COMPLIANCE: Continued violation constitutes: (a) Contempt of the Mathias El Tribe Supreme Court; (b) Violation of federal Indian law under the Supremacy Clause; (c) Actionable civil rights violation under 42 U.S.C. § 1983; (d) Breach of the federal trust responsibility. This matter will be referred to the Bureau of Indian Affairs, the Department of Justice Civil Rights Division, and tribal legal counsel for enforcement and federal court action.",
    ],
    trusteeNotes: "Serve via certified mail, return receipt requested. Attach: (1) copy of tribal enrollment or membership verification; (2) copy of the Sovereignty Declaration (SD-2025); (3) copy of the Sovereign Restoration Doctrine (SRD-2025). File proof of service with tribal court. Cite applicable prohibitions from the SPD-2025 State Prohibitions Doctrine.",
  },

  jurisdiction_enforcement_notice: {
    title: "NOTICE OF TRIBAL JURISDICTION — CRIMINAL JURISDICTION ASSERTION",
    parties: {
      "Issuing Authority": "Mathias El Tribe Supreme Court — Office of the Chief Justice & Trustee",
      "Jurisdiction Reference": "JM-2025; 18 U.S.C. §§ 1151, 1152, 1153, 1162",
      "Directed To": "[LAW ENFORCEMENT AGENCY / COURT / OFFICIAL]",
      "Re: Matter": "[CASE DESCRIPTION / INCIDENT]",
      "Indian Country Location": "[DESCRIBE LOCATION AND LAND STATUS]",
    },
    land: {
      description: "The matter referenced herein occurred within or affecting Indian Country as defined by 18 U.S.C. § 1151, which includes: all land within reservation boundaries; all dependent Indian communities; all allotments with unextinguished Indian title. Tribal jurisdiction attaches automatically by operation of federal law.",
      classification: "Indian Country — Federal and Tribal Jurisdiction",
    },
    provisions: [
      "NOTICE OF JURISDICTION: You are hereby notified that the above-referenced matter falls within the criminal jurisdiction of the Mathias El Tribe and/or the federal government, as applicable under the Indian Country jurisdiction framework established by 18 U.S.C. §§ 1151-1153 and related federal law. State jurisdiction may be concurrent, limited, or excluded as specified below.",
      "JURISDICTION DETERMINATION - APPLICABLE MATRIX: [CHECK APPLICABLE: NON-PL-280 or PL-280/CALIFORNIA]. NON-PL-280: Indian-to-Indian Major Crime: Federal + Tribal; Indian-to-Indian Other: Tribal only; Indian-to-NonIndian Major: Federal + Tribal; Indian-to-NonIndian Other: Federal + Tribal; NonIndian-to-Indian: Federal (GCA); NonIndian-to-Indian DV (SDVCJ opt-in): Tribal. PL-280 (California): Indian-to-Indian Any: State + Tribal; Indian-to-NonIndian Any: State + Tribal; NonIndian-to-Indian Any: State; NonIndian-to-Indian DV (SDVCJ opt-in): Tribal; NonIndian-to-NonIndian: State only.",
      "APPLICABLE STATUTES: Indian Country Definition: 18 U.S.C. § 1151. General Crimes Act: 18 U.S.C. § 1152 (federal jurisdiction over crimes involving Indians and non-Indians, excluding Indian-on-Indian). Major Crimes Act: 18 U.S.C. § 1153 (federal jurisdiction over 16 major felonies by Indians). Public Law 280 (California): 18 U.S.C. § 1162 (state + tribal concurrent jurisdiction). VAWA SDVCJ: 25 U.S.C. § 1304 (tribal jurisdiction over non-Indians for DV if tribe opts in).",
      "DOUBLE JEOPARDY NOTICE: Federal and tribal prosecutions arising from the same conduct are not double jeopardy because they are separate sovereigns. United States v. Wheeler, 435 U.S. 313 (1978). Tribal prosecution does not bar subsequent federal prosecution and vice versa.",
      "TRIBAL SENTENCING AUTHORITY: Standard: 1 year imprisonment + $5,000 fine per offense. Enhanced (TLOA): 3 years + $15,000 per offense, subject to requirements of licensed defense counsel, trained judges, publicly available laws, and recorded proceedings (25 U.S.C. § 1302).",
      "OLIPHANT LIMITATION: Absent VAWA SDVCJ opt-in, tribal courts do not have inherent criminal jurisdiction over non-Indians. Oliphant v. Suquamish, 435 U.S. 191 (1978). However, non-Indians are subject to federal GCA jurisdiction (18 U.S.C. § 1152) and state jurisdiction in PL-280 states.",
      "REQUIRED ACTION: Acknowledge the jurisdictional framework established herein. Coordinate with this office on all charging and prosecution decisions involving Indian Country matters. Provide written notification of all charges filed within [NUMBER] days. Do not proceed with prosecution outside your applicable jurisdiction without coordination with tribal counsel.",
    ],
    trusteeNotes: "Serve on law enforcement agency, district attorney, and any state court with a pending matter. Attach: (1) documentation of Indian Country land status; (2) tribal membership verification for any Indian party; (3) tribal court jurisdiction assertion. Coordinate with federal prosecutor (AUSA) for Major Crimes Act matters. Reference JM-2025 Jurisdiction Matrix for case-by-case analysis.",
  },

  tribal_health_referral: {
    title: "REFERRAL FOR CONTRACT PROFESSIONAL HEALTH SERVICES",
    parties: {
      "Referring Facility": "[TRIBAL HEALTH FACILITY NAME]",
      "Facility Address": "[ADDRESS, CITY, STATE, ZIP]",
      "Facility Phone": "[PHONE]",
      "Facility Fax": "[FAX]",
      Patient: "[PATIENT FULL NAME]",
      "Date of Birth": "[DOB]",
      "Member ID": "[MEMBER ID]",
      "Patient Address": "[PATIENT ADDRESS]",
      "Patient Phone": "[PATIENT PHONE]",
      "Referred To": "[PROVIDER / FACILITY NAME]",
      "Provider Address": "[PROVIDER ADDRESS]",
      "Authorizing Provider": "[PROVIDER NAME AND CREDENTIALS]",
    },
    land: {
      description: "This referral is issued under the authority of a tribally operated health facility pursuant to 25 U.S.C. § 1601 et seq. (Indian Health Care Improvement Act), 25 U.S.C. § 5304(e) (Indian Self-Determination and Education Assistance Act), and 42 C.F.R. § 136.11 (Indian Health Service — Services Available). This referral carries the same federal recognition as a referral issued by a directly operated IHS facility.",
      classification: "Tribal Health Services — Federal Trust Authority",
    },
    provisions: [
      "REFERRAL AUTHORIZATION: The above-named patient is hereby referred for the following outpatient services: [DESCRIPTION OF SERVICES — e.g., X-ray lumbar spine 3 view; X-ray cervical spine 3 view; laboratory services; specialist consultation].",
      "AUTHORIZATION DETAILS: Service Type: Outpatient. Number of Authorized Visits: [NUMBER]. Priority Rating: [PRIORITY — e.g., II (Routine) / I (Urgent) / Emergency]. Diagnosis Code(s): [ICD-10 CODES]. Authorized Amount: Not to exceed $[DOLLAR AMOUNT] for authorized services. Referral Number: [REFERRAL NUMBER]. Referral Valid Through: [EXPIRATION DATE].",
      "TRIBAL HEALTH AUTHORITY NOTICE: This facility operates pursuant to the Indian Self-Determination and Education Assistance Act (25 U.S.C. § 5304(e)) and the Indian Health Care Improvement Act (25 U.S.C. § 1601 et seq.). Services authorized herein are federally recognized health services under 42 C.F.R. § 136.11. This referral has the same legal standing as a referral from an IHS facility.",
      "THIRD-PARTY RECOVERY NOTICE: Pursuant to 25 U.S.C. § 1621e, this tribal health facility may recover from third-party payors for services provided. The referred provider shall submit a consultation report or discharge summary to this facility prior to reimbursement. Billing must be submitted within sixty (60) days of the date of service; payment cannot be guaranteed if billed outside this window.",
      "PATIENT ALTERNATIVE RESOURCES OBLIGATION: The patient is required to apply for any alternative resources for which they may be entitled (Medi-Cal, Medicare, private insurance, VA benefits). Failure to do so may result in denial of payment by this facility, making the patient responsible for the balance.",
      "BILLING INSTRUCTIONS: Submit all claims and consultation reports to this facility prior to seeking reimbursement. If additional services beyond those authorized are required, contact this facility for specific prior authorization before rendering services. No payment will be made beyond the authorized amount without prior written authorization.",
      "CANCELLATION POLICY: If the initial appointment is cancelled, this referral becomes void. A new referral must be obtained prior to rescheduling. Contact this facility's referral coordinator to obtain a new authorization.",
    ],
    trusteeNotes: "Electronically sign and date. Provide to referred provider at time of appointment. Patient must retain a copy. File in patient medical record. Referral is void if appointment is cancelled without prior notice to this facility. For all questions, contact the referral nurse coordinator at this facility.",
  },
};

function applyVariables(text: string, variables: TemplateVariable[]): string {
  let result = text;
  for (const v of variables) {
    result = result.replaceAll(`[${v.key}]`, v.value);
  }
  return result;
}

function applyVariablesToInput(input: Omit<PdfBuildInput, "recorderMetadata">, variables: TemplateVariable[]): Omit<PdfBuildInput, "recorderMetadata"> {
  return {
    title: applyVariables(input.title, variables),
    parties: Object.fromEntries(
      Object.entries(input.parties).map(([k, v]) => [k, applyVariables(v, variables)]),
    ),
    land: {
      ...input.land,
      description: input.land.description ? applyVariables(input.land.description, variables) : undefined,
    },
    provisions: input.provisions.map((p) => applyVariables(p, variables)),
    trusteeNotes: input.trusteeNotes ? applyVariables(input.trusteeNotes, variables) : undefined,
  };
}

export async function renderTemplate(
  templateKey: string,
  variables: TemplateVariable[],
  recorderMetadata: RecorderMetadata,
): Promise<RenderedTemplate | null> {
  let base: Omit<PdfBuildInput, "recorderMetadata"> | undefined;

  if (BUILT_IN_TEMPLATES[templateKey]) {
    base = BUILT_IN_TEMPLATES[templateKey];
  } else {
    try {
      const dbTemplates = await db.select().from(templatesTable).where(and(eq(templatesTable.name, templateKey))).limit(1);
      if (dbTemplates[0]) {
        const t = dbTemplates[0];
        base = {
          title: t.name,
          parties: {},
          land: { description: t.content },
          provisions: [],
        };
      }
    } catch (err) {
      logger.error({ err, templateKey }, "Failed to load template from DB");
    }
  }

  if (!base) return null;

  const resolved = applyVariablesToInput(base, variables);
  const content = [
    `INSTRUMENT TYPE: ${resolved.title}`,
    `PARTIES: ${Object.entries(resolved.parties).map(([k, v]) => `${k}: ${v}`).join("; ")}`,
    `LEGAL DESCRIPTION: ${resolved.land.description ?? ""}`,
    resolved.land.classification ? `Land Classification: ${resolved.land.classification}` : "",
    ...resolved.provisions,
  ]
    .filter(Boolean)
    .join("\n\n");

  return {
    title: resolved.title,
    content,
    pdfInput: { ...resolved, recorderMetadata },
  };
}

export function listBuiltInTemplates(): string[] {
  return Object.keys(BUILT_IN_TEMPLATES);
}

export function getBuiltInTemplate(key: string): Omit<PdfBuildInput, "recorderMetadata"> | null {
  return BUILT_IN_TEMPLATES[key] ?? null;
}
