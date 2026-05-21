import { logger } from "../lib/logger";

export type WelfareAct = "ICWA" | "SNYDER" | "IHCIA" | "ISDEAA" | "TRIBAL_CODE" | "TRIBAL_WELFARE" | "TRIBAL_PROTECTIVE_ORDER" | "EMERGENCY_WELFARE" | "TRO_WELFARE";

export type InstrumentType =
  | "icwa_notice"
  | "icwa_transfer_request"
  | "icwa_jurisdiction_declaration"
  | "tribal_family_placement_preference"
  | "tribal_welfare_certification"
  | "tribal_medical_necessity_certification"
  | "tribal_protective_order"
  | "emergency_welfare_order"
  | "tro_supporting_declaration";

export interface WelfareInstrumentRequest {
  welfareAct: WelfareAct;
  instrumentType: InstrumentType;
  caseDetails: Record<string, string>;
  child?: Record<string, string>;
  parties: Record<string, string>;
  landStatus?: Record<string, string>;
  emergency: boolean;
  requestedRelief: string[];
  doctrineContext?: string[];
}

export interface WelfareInstrument {
  instrumentType: InstrumentType;
  welfareAct: WelfareAct;
  title: string;
  troSensitive: boolean;
  emergencyOrder: boolean;
  doctrinesApplied: string[];
  federalStatutes: string[];
  sovereigntyProtections: string[];
  tribalJurisdiction: string[];
  federalSupremacy: string[];
  provisions: string[];
  troDeclaration?: string;
  content: string;
}

const ICWA_STATUTES = [
  "Indian Child Welfare Act of 1978 (ICWA), 25 U.S.C. §§ 1901–1963",
  "25 U.S.C. § 1911 — Tribal court jurisdiction over Indian child custody proceedings",
  "25 U.S.C. § 1912 — Pending court proceedings; notice; intervention",
  "25 U.S.C. § 1915 — Placement of Indian children; preferences",
  "25 U.S.C. § 1920 — Return of custody",
  "25 C.F.R. Part 23 — Indian Child Welfare Act",
  "Brackeen v. Haaland, 599 U.S. 255 (2023) — ICWA upheld as constitutional",
  "Mississippi Band of Choctaw Indians v. Holyfield, 490 U.S. 30 (1989) — Exclusive tribal court jurisdiction",
];

const SNYDER_STATUTES = [
  "Snyder Act of 1921, 25 U.S.C. § 13 — Federal authority for Indian welfare, health, and education",
  "25 U.S.C. § 13 — BIA appropriation for benefit, care, and assistance of Indians",
];

const IHCIA_STATUTES = [
  "Indian Health Care Improvement Act (IHCIA), 25 U.S.C. §§ 1601–1685",
  "25 U.S.C. § 1621 — Indian Health Service: establishment of standards and treatment",
  "25 U.S.C. § 1680c — Contract health services for medical emergencies",
  "25 U.S.C. § 1621h — Mental health prevention and treatment services",
];

const ISDEAA_STATUTES = [
  "Indian Self-Determination and Education Assistance Act (ISDEAA), 25 U.S.C. §§ 5301–5423",
  "25 U.S.C. § 5321 — Self-determination contracts with tribal organizations",
  "25 U.S.C. § 5325 — Contract funding and indirect costs",
];

const INDIAN_CANONS = [
  "Indian Canons of Construction: Ambiguities in federal Indian law must be resolved in favor of Indians. Montana v. Blackfeet Tribe, 471 U.S. 759, 766 (1985).",
  "Indian Canons of Construction: Treaties, agreements, and statutes are to be construed liberally in favor of the Indians. Winters v. United States, 207 U.S. 564 (1908).",
  "Indian Canons of Construction: Statutes are to be interpreted in favor of tribal sovereignty and in accordance with the intent of Congress to protect Indian interests. Bryan v. Itasca County, 426 U.S. 373 (1976).",
];

const FEDERAL_SUPREMACY = [
  "FEDERAL PREEMPTION: Federal Indian law expressly preempts any state or local law that would impair the rights of Indian tribes, individual Indians, or Indian children under this instrument. McClanahan v. Arizona State Tax Comm'n, 411 U.S. 164 (1973).",
  "WORCESTER DOCTRINE: Pursuant to Worcester v. Georgia, 31 U.S. 515 (1832), state laws have no force within Indian Country with respect to Indian tribes and their members on trust land.",
  "FEDERAL TRUST RESPONSIBILITY: The United States holds a trust responsibility to Indian tribes and their members that requires protection of Indian rights, including child welfare rights and health care rights.",
];

const TRIBAL_JURISDICTION = [
  "TRIBAL COURT JURISDICTION: Pursuant to 25 U.S.C. § 1911 and applicable tribal law, this matter falls within the exclusive or concurrent jurisdiction of the Tribal Court.",
  "SOVEREIGN AUTHORITY: This instrument is issued under the sovereign authority of the tribal nation and the Sovereign Office of the Chief Justice & Trustee.",
  "MONTOYA TRIBAL AUTHORITY: Under the inherent sovereign powers of the tribe, tribal authorities retain jurisdiction over all matters affecting tribal members and tribal children on and off the reservation.",
];

const STATE_PREEMPTION = [
  "NOTICE TO STATE AGENCIES: State agencies, including state child protective services and state courts, are on notice that federal Indian law governs this matter. State jurisdiction, if any, is subject to and limited by ICWA, 25 U.S.C. §§ 1901–1963.",
  "ICWA SUPREMACY: The Indian Child Welfare Act establishes minimum federal standards for the removal of Indian children from their families and for adoptive or foster care placements. These standards preempt any contrary state law or procedure.",
];

function getTroTriggers(req: WelfareInstrumentRequest): string[] {
  const triggers: string[] = [];
  const reliefLower = req.requestedRelief.map((r) => r.toLowerCase()).join(" ");
  const caseLower = JSON.stringify(req.caseDetails).toLowerCase();

  if (reliefLower.includes("removal") || caseLower.includes("removal") || caseLower.includes("removed"))
    triggers.push("removal of a child");
  if (reliefLower.includes("medical") || caseLower.includes("medical care") || caseLower.includes("denied medical"))
    triggers.push("denial of medical care");
  if (caseLower.includes("state agency") || caseLower.includes("dcfs") || caseLower.includes("cps") || caseLower.includes("state interference"))
    triggers.push("interference by state agencies");
  if (caseLower.includes("jurisdiction") || reliefLower.includes("jurisdiction"))
    triggers.push("refusal to recognize tribal jurisdiction");
  if (reliefLower.includes("transfer") || caseLower.includes("transfer denied"))
    triggers.push("denial of ICWA transfer");
  if (reliefLower.includes("placement") || caseLower.includes("placement preference"))
    triggers.push("denial of tribal placement preferences");

  return triggers;
}

function selectStatutes(act: WelfareAct): string[] {
  switch (act) {
    case "ICWA": return ICWA_STATUTES;
    case "SNYDER": return SNYDER_STATUTES;
    case "IHCIA": return IHCIA_STATUTES;
    case "ISDEAA": return ISDEAA_STATUTES;
    case "TRIBAL_CODE":
    case "TRIBAL_WELFARE":
    case "TRIBAL_PROTECTIVE_ORDER":
    case "EMERGENCY_WELFARE":
    case "TRO_WELFARE":
      return [...SNYDER_STATUTES, ...ICWA_STATUTES.slice(0, 3)];
    default: return SNYDER_STATUTES;
  }
}

function buildTitle(type: InstrumentType, act: WelfareAct): string {
  const titles: Record<InstrumentType, string> = {
    icwa_notice: "ICWA NOTICE OF PROCEEDING — INDIAN CHILD WELFARE ACT",
    icwa_transfer_request: "ICWA TRANSFER REQUEST — PETITION TO TRANSFER TO TRIBAL COURT",
    icwa_jurisdiction_declaration: "DECLARATION OF TRIBAL COURT JURISDICTION — INDIAN CHILD WELFARE ACT",
    tribal_family_placement_preference: "TRIBAL FAMILY PLACEMENT PREFERENCE DECLARATION",
    tribal_welfare_certification: "TRIBAL WELFARE CERTIFICATION",
    tribal_medical_necessity_certification: "TRIBAL MEDICAL NECESSITY CERTIFICATION",
    tribal_protective_order: "TRIBAL PROTECTIVE ORDER",
    emergency_welfare_order: "EMERGENCY WELFARE ORDER",
    tro_supporting_declaration: "TRO-SUPPORTING DECLARATION — EMERGENCY RELIEF",
  };
  return titles[type] ?? `${act} WELFARE INSTRUMENT`;
}

function buildProvisions(req: WelfareInstrumentRequest, troTriggers: string[]): string[] {
  const provisions: string[] = [];

  switch (req.instrumentType) {
    case "icwa_notice":
      provisions.push(
        "ICWA NOTICE: Pursuant to 25 U.S.C. § 1912(a), this notice is provided to the relevant Indian tribe(s), the Bureau of Indian Affairs, and all parties to this proceeding. The subject child is or may be an Indian child as defined by the Indian Child Welfare Act, 25 U.S.C. § 1903(4).",
        "TRIBE IDENTIFICATION: The tribal affiliation of the child must be verified through the tribe's enrollment records. Contact the tribal enrollment office prior to any further state court action.",
        "STAY OF PROCEEDINGS: All state court proceedings are subject to mandatory stay pending ICWA compliance pursuant to 25 U.S.C. § 1912.",
        "RIGHT TO INTERVENE: The Indian tribe has an absolute right to intervene in this proceeding pursuant to 25 U.S.C. § 1911(c).",
      );
      break;

    case "icwa_transfer_request":
      provisions.push(
        "PETITION TO TRANSFER: The tribe hereby petitions for transfer of this proceeding to Tribal Court pursuant to 25 U.S.C. § 1911(b). Transfer is the presumptive right of the tribe unless good cause is shown.",
        "GOOD CAUSE STANDARD: The burden of establishing good cause to deny transfer rests on the party opposing transfer. Convenience of the parties or witnesses does not constitute good cause. 25 C.F.R. § 23.118.",
        "TRIBAL COURT CERTIFICATION: The Tribal Court is prepared to accept jurisdiction of this matter and has full authority to adjudicate Indian child custody proceedings.",
        "OBJECTION PERIOD: Any objection to transfer must be filed within the time prescribed by applicable law. Failure to object timely constitutes waiver.",
      );
      break;

    case "icwa_jurisdiction_declaration":
      provisions.push(
        "DECLARATION OF EXCLUSIVE JURISDICTION: Pursuant to 25 U.S.C. § 1911(a), the Tribal Court has exclusive jurisdiction over any child custody proceeding involving an Indian child who resides or is domiciled within the reservation.",
        "DOMICILE DETERMINATION: The domicile of an Indian child is determined under federal law, not state law. Mississippi Band of Choctaw Indians v. Holyfield, 490 U.S. 30 (1989). The child's domicile is deemed to be on the reservation for purposes of tribal jurisdiction.",
        "STATE COURT DIVESTED: Any pending state court proceeding involving this Indian child must be transferred to Tribal Court forthwith.",
      );
      break;

    case "tribal_family_placement_preference":
      provisions.push(
        "PLACEMENT PREFERENCE: Pursuant to 25 U.S.C. § 1915, the following order of placement preference applies: (1) a member of the child's extended family; (2) other members of the Indian child's tribe; (3) other Indian families; (4) other placements only if the tribe approves a deviation from this preference.",
        "ACTIVE EFFORTS REQUIRED: Active efforts must be made to provide remedial services and rehabilitative programs designed to prevent the breakup of the Indian family. 25 U.S.C. § 1912(d). Mere reasonable efforts are insufficient.",
        "TRIBAL STANDARDS PREVAIL: The tribe's own placement standards shall govern where they are at least as stringent as federal ICWA standards.",
        "QUALIFIED EXPERT WITNESS: Expert testimony regarding tribal culture and child-rearing practices must be provided by a qualified expert witness with knowledge of Indian tribal culture. 25 U.S.C. § 1912(e)-(f).",
      );
      break;

    case "tribal_welfare_certification":
      provisions.push(
        "TRIBAL CERTIFICATION: The Sovereign Office of the Chief Justice & Trustee hereby certifies that the tribal member(s) identified herein are enrolled members of the tribe and are entitled to all welfare, health, and educational benefits provided under federal law and tribal code.",
        "FEDERAL BENEFITS ENTITLEMENT: Pursuant to the Snyder Act, 25 U.S.C. § 13, and applicable federal programs, the enrolled tribal member is entitled to receive BIA-administered welfare benefits.",
        "TRIBAL WELFARE CODE: This certification is issued pursuant to tribal welfare code provisions and is entitled to full faith and credit by all federal and state agencies.",
      );
      break;

    case "tribal_medical_necessity_certification":
      provisions.push(
        "MEDICAL NECESSITY CERTIFICATION: The Sovereign Office certifies that the medical services described herein are necessary for the health, safety, and welfare of the enrolled tribal member identified in this instrument.",
        "IHCIA AUTHORITY: Pursuant to the Indian Health Care Improvement Act, 25 U.S.C. § 1621, the Indian Health Service and tribal health programs are authorized to provide and certify the medical services described herein.",
        "CONTRACT HEALTH SERVICES: Where IHS direct care is unavailable, Contract Health Services (CHS) must be authorized pursuant to 25 U.S.C. § 1680c.",
        "STATE MEDICAID COMPLIANCE: State Medicaid programs must recognize this certification and provide coverage to eligible Indian tribal members without discrimination.",
      );
      break;

    case "tribal_protective_order":
      provisions.push(
        "PROTECTIVE ORDER: The Tribal Court, acting under its inherent sovereign authority and pursuant to tribal law, hereby issues this protective order for the protection of the Indian child and family identified herein.",
        "ENFORCEMENT: This tribal court protective order is entitled to full faith and credit in all state and federal courts pursuant to 18 U.S.C. § 2265 and applicable federal law.",
        "VIOLATIONS: Violation of this order may constitute contempt of the Tribal Court and may be referred to federal authorities for prosecution under applicable federal law.",
        "DURATION: This order shall remain in effect until further order of the Tribal Court.",
      );
      break;

    case "emergency_welfare_order":
      provisions.push(
        "EMERGENCY ORDER: THIS IS AN EMERGENCY ORDER. Immediate compliance is required. The Sovereign Office of the Chief Justice & Trustee, acting under emergency welfare authority, hereby orders immediate protective action for the Indian child and family identified herein.",
        "EMERGENCY AUTHORITY: This order is issued pursuant to tribal emergency authority and 25 U.S.C. § 1922, which permits emergency removal from a parent or Indian custodian only to prevent imminent physical damage or harm to the child.",
        "TRIBAL NOTIFICATION: The tribe has been notified of this emergency and has authorized this emergency order. All parties must immediately contact the Tribal Court for further proceedings.",
        "RETURN TO TRIBE: The child shall be returned to tribal custody or to an ICWA-compliant placement as quickly as possible and in no event later than the time required by applicable law.",
      );
      break;

    case "tro_supporting_declaration":
      provisions.push(
        "TRO DECLARATION: This declaration is submitted in support of an application for a Temporary Restraining Order (TRO) and/or Preliminary Injunction to protect Indian children and families from irreparable harm.",
        "IRREPARABLE HARM: The removal of an Indian child from the tribe and from Indian culture constitutes irreparable harm that cannot be remedied by money damages. The loss of Indian child's connection to tribal culture, language, and community is a harm recognized by Congress in enacting ICWA. 25 U.S.C. § 1901.",
        "LIKELIHOOD OF SUCCESS: The tribe is likely to succeed on the merits of its ICWA claim given the mandatory nature of ICWA's requirements and the failure of the opposing party to comply therewith.",
        "BALANCE OF EQUITIES: The balance of equities tips sharply in favor of the tribe. The harm to the Indian child from continued separation from tribal culture far outweighs any inconvenience to the opposing party.",
        "PUBLIC INTEREST: The public interest is served by enforcement of ICWA and the protection of Indian children and families.",
      );
      break;
  }

  if (req.requestedRelief.length > 0) {
    provisions.push(`REQUESTED RELIEF: The following specific relief is requested: ${req.requestedRelief.join("; ")}.`);
  }

  if (troTriggers.length > 0 && req.emergency) {
    provisions.push(
      `EMERGENCY TRO TRIGGER FACTORS: This instrument is marked TRO-sensitive based on the following trigger factors identified in this matter: ${troTriggers.join("; ")}. Immediate judicial relief may be necessary.`,
    );
  }

  return provisions;
}

function buildTroDeclaration(req: WelfareInstrumentRequest, troTriggers: string[]): string {
  const childName = req.child?.name ?? "the Indian child";
  const childAge = req.child?.age ? `, age ${req.child.age},` : "";
  const tribe = req.parties?.tribe ?? req.parties?.["Tribe"] ?? "the enrolled Indian tribe";

  return [
    `TRO-SUPPORTING DECLARATION`,
    ``,
    `I, the undersigned authorized officer of the Sovereign Office of the Chief Justice & Trustee, declare as follows:`,
    ``,
    `1. CHILD IDENTIFICATION: ${childName}${childAge} is an Indian child as defined by the Indian Child Welfare Act, 25 U.S.C. § 1903(4), and is an enrolled member or eligible for enrollment in ${tribe}.`,
    ``,
    `2. TRO-SENSITIVE FACTORS: This matter involves the following factors warranting emergency judicial relief: ${troTriggers.join("; ")}.`,
    ``,
    `3. FEDERAL LAW VIOLATION: The actions described in this matter constitute a violation of the Indian Child Welfare Act and federal Indian law. Continued non-compliance will cause irreparable harm to ${childName} and the tribe.`,
    ``,
    `4. DOCTRINE SUPPORT: The following federal doctrines support issuance of emergency relief: Worcester v. Georgia (state interference with tribal sovereignty); ICWA federal preemption (state agency must comply with ICWA); Federal Trust Responsibility (United States must protect Indian interests).`,
    ``,
    `5. EMERGENCY REQUEST: Based on the foregoing, the Sovereign Office respectfully requests that the Court issue a TRO immediately restraining any further action in violation of ICWA and federal Indian law pending full hearing on this matter.`,
    ``,
    `Executed under penalty of perjury under the laws of the United States.`,
  ].join("\n");
}

export function generateWelfareInstrument(req: WelfareInstrumentRequest): WelfareInstrument {
  const troTriggers = getTroTriggers(req);
  const troSensitive = troTriggers.length > 0 || req.instrumentType === "tro_supporting_declaration";
  const emergencyOrder = req.emergency || req.instrumentType === "emergency_welfare_order";

  const federalStatutes = selectStatutes(req.welfareAct);
  const doctrinesApplied = [
    ...INDIAN_CANONS,
    ...FEDERAL_SUPREMACY,
    ...TRIBAL_JURISDICTION,
    ...(req.welfareAct === "ICWA" ? STATE_PREEMPTION : []),
  ];

  const provisions = buildProvisions(req, troTriggers);
  const title = buildTitle(req.instrumentType, req.welfareAct);
  const troDeclaration = troSensitive ? buildTroDeclaration(req, troTriggers) : undefined;

  const contentParts: string[] = [
    `INSTRUMENT: ${title}`,
    `WELFARE ACT: ${req.welfareAct}`,
    `EMERGENCY: ${emergencyOrder ? "YES — EMERGENCY ORDER" : "No"}`,
    `TRO SENSITIVE: ${troSensitive ? "YES — TRO TRIGGERS IDENTIFIED" : "No"}`,
    ``,
    `CASE DETAILS:`,
    ...Object.entries(req.caseDetails).map(([k, v]) => `  ${k}: ${v}`),
    ``,
    `PARTIES:`,
    ...Object.entries(req.parties).map(([k, v]) => `  ${k}: ${v}`),
    req.child ? [`\nCHILD INFORMATION:`, ...Object.entries(req.child).map(([k, v]) => `  ${k}: ${v}`)].join("\n") : "",
    ``,
    `FEDERAL STATUTES INVOKED:`,
    ...federalStatutes.map((s) => `  • ${s}`),
    ``,
    `PROVISIONS:`,
    ...provisions,
    troDeclaration ? `\nTRO DECLARATION:\n${troDeclaration}` : "",
  ].filter((p) => p !== "");

  const content = contentParts.join("\n");

  logger.info(
    { welfareAct: req.welfareAct, instrumentType: req.instrumentType, troSensitive, emergencyOrder },
    "Welfare instrument generated",
  );

  return {
    instrumentType: req.instrumentType,
    welfareAct: req.welfareAct,
    title,
    troSensitive,
    emergencyOrder,
    doctrinesApplied: doctrinesApplied.map((d) => d.split(":")[0] ?? d).slice(0, 10),
    federalStatutes,
    sovereigntyProtections: TRIBAL_JURISDICTION,
    tribalJurisdiction: TRIBAL_JURISDICTION,
    federalSupremacy: FEDERAL_SUPREMACY,
    provisions,
    troDeclaration,
    content,
  };
}
