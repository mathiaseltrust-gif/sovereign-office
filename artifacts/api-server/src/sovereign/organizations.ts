export type OrgType = "court" | "trust" | "charitable_trust" | "political" | "enterprise" | "medical" | "education";
export type OrgAccessLevel = "none" | "member" | "officer" | "director" | "trustee" | "full";
export type CourtAccessLevel = "none" | "view" | "file" | "adjudicate";
export type TrustAccessLevel = "none" | "beneficiary" | "officer" | "trustee";

export interface SovereignOrg {
  id: string;
  name: string;
  shortName: string;
  type: OrgType;
  legalStatus: string;
  legalCode?: string;
  jurisdiction: string;
  description: string;
  mission: string;
  navPath: string;
  requiredRole: "member" | "officer" | "trustee" | "admin";
  letterhead: {
    line1: string;
    line2: string;
    line3?: string;
    line4?: string;
  };
  authorities: string[];
  federalStatutes?: string[];
  color: string;
}

export const SOVEREIGN_ORGS: SovereignOrg[] = [
  {
    id: "medical_center",
    name: "Mathias El Tribe Medical Center",
    shortName: "Medical Center",
    type: "medical",
    legalStatus: "Tribal Health Facility",
    jurisdiction: "Mathias El Tribe — Federal Indian Health Service",
    description: "Provides primary care, emergency services, and health record management for enrolled members and their dependents under the Indian Health Care Improvement Act.",
    mission: "Deliver culturally competent, sovereignty-protected health services to all enrolled members.",
    navPath: "/medical-notes",
    requiredRole: "member",
    letterhead: {
      line1: "MATHIAS EL TRIBE MEDICAL CENTER",
      line2: "Office of the Chief Justice & Trustee",
      line3: "Indian Health Care Improvement Act — 25 U.S.C. § 1601 et seq.",
    },
    authorities: ["Medical note generation", "Health record management", "ICWA health documentation", "Dependent care authorization"],
    federalStatutes: ["25 U.S.C. § 1601 et seq. (IHCIA)", "42 U.S.C. § 1396 (Medicaid Indian provisions)"],
    color: "blue",
  },
  {
    id: "supreme_court",
    name: "Mathias El Tribe Supreme Court",
    shortName: "Supreme Court",
    type: "court",
    legalStatus: "Tribal Court of General Jurisdiction",
    jurisdiction: "Mathias El Tribe — Sovereign Tribal Jurisdiction",
    description: "The highest judicial authority of the Mathias El Tribe. Exercises exclusive jurisdiction over all matters arising under tribal law, trust land disputes, ICWA proceedings, and member rights enforcement.",
    mission: "Administer justice under tribal sovereignty and federal Indian law, protecting all enrolled members.",
    navPath: "/supreme-court",
    requiredRole: "member",
    letterhead: {
      line1: "MATHIAS EL TRIBE SUPREME COURT",
      line2: "Office of the Chief Justice & Trustee",
      line3: "Sovereign Tribal Court — Full Faith and Credit",
      line4: "25 U.S.C. § 1302 (Indian Civil Rights Act) applies",
    },
    authorities: ["Court filings", "Motion practice", "ICWA proceedings", "NFR review", "Complaint adjudication", "Sovereign immunity assertion"],
    federalStatutes: ["25 U.S.C. § 1302 (ICRA)", "25 U.S.C. § 1901 (ICWA)", "28 U.S.C. § 1360 (State jurisdiction limits)"],
    color: "red",
  },
  {
    id: "tribal_trust",
    name: "Mathias El Tribe Trust",
    shortName: "Tribal Trust",
    type: "trust",
    legalStatus: "Federal Indian Trust",
    legalCode: "25 U.S.C. § 5108",
    jurisdiction: "Bureau of Indian Affairs — Federal Fiduciary",
    description: "Holds and manages trust assets, land, and financial instruments on behalf of enrolled members. Operates under federal fiduciary duty with BIA oversight.",
    mission: "Preserve, protect, and grow tribal trust assets for the benefit of current and future enrolled members.",
    navPath: "/tribal-trust",
    requiredRole: "member",
    letterhead: {
      line1: "MATHIAS EL TRIBE TRUST",
      line2: "Office of the Chief Justice & Trustee",
      line3: "Indian Reorganization Act — 25 U.S.C. § 5108",
      line4: "Bureau of Indian Affairs Federal Trust Jurisdiction",
    },
    authorities: ["Trust instrument filing", "Beneficiary designation", "Trust land management", "Asset protection", "Inheritance documentation"],
    federalStatutes: ["25 U.S.C. § 5108 (IRA Trust Land)", "25 U.S.C. § 162a (Trust Fund management)", "25 C.F.R. Part 115"],
    color: "amber",
  },
  {
    id: "charitable_trust",
    name: "Mathias El Tribe Charitable Trust",
    shortName: "Charitable Trust",
    type: "charitable_trust",
    legalStatus: "501(c)(3) Non-Profit Organization",
    legalCode: "26 U.S.C. § 501(c)(3)",
    jurisdiction: "IRS Tax-Exempt — Federal & Tribal",
    description: "Tax-exempt charitable organization advancing education, health, housing, and cultural preservation for enrolled members and eligible indigenous families. Accepts tax-deductible donations.",
    mission: "Uplift enrolled members through charitable programs, grants, and services funded by public and institutional donors.",
    navPath: "/charitable-trust",
    requiredRole: "member",
    letterhead: {
      line1: "MATHIAS EL TRIBE CHARITABLE TRUST",
      line2: "A 501(c)(3) Non-Profit Organization",
      line3: "EIN: [FEDERAL TAX ID ON FILE]",
      line4: "Donations are tax-deductible to the extent permitted by law",
    },
    authorities: ["Charitable grant applications", "Program enrollment", "Educational scholarships", "Housing assistance programs", "Cultural preservation grants"],
    federalStatutes: ["26 U.S.C. § 501(c)(3)", "26 U.S.C. § 170 (Charitable deduction)", "Indian Self-Determination Act"],
    color: "green",
  },
  {
    id: "niac",
    name: "National Indigenous American Committee",
    shortName: "NIAC",
    type: "political",
    legalStatus: "Indigenous Political Committee — § 527 Standing",
    legalCode: "26 U.S.C. § 527",
    jurisdiction: "Mathias El Tribe — Self-Determined Political Authority",
    description: "An affiliate of the Mathias El Tribe — also known as the American Indian Party — organized as an indigenous political committee under 26 U.S.C. § 527. NIAC exercises the tribe's inherent political authority through self-determined advocacy, direct policy engagement, and the defense of federal Indian law at local, state, and federal levels.",
    mission: "Advance indigenous sovereignty and federal Indian law through self-determined political action — asserting rights that are inherent, self-executing, and self-evident.",
    navPath: "/niac",
    requiredRole: "member",
    letterhead: {
      line1: "NATIONAL INDIGENOUS AMERICAN COMMITTEE (NIAC)",
      line2: "American Indian Party — Affiliate of the Mathias El Tribe",
      line3: "Paid for by the National Indigenous American Committee",
      line4: "Not authorized by any candidate or candidate's committee",
    },
    authorities: ["Political advocacy", "Indigenous policy engagement", "Federal Indian law defense", "Policy comment filings", "Political communication"],
    federalStatutes: ["26 U.S.C. § 527", "52 U.S.C. § 30101 et seq.", "Indian Self-Determination & Education Assistance Act"],
    color: "purple",
  },
  {
    id: "sdu",
    name: "Self Determination University",
    shortName: "SDU",
    type: "education",
    legalStatus: "Nonprofit Education System — 501(c)(3)",
    legalCode: "25 U.S.C. § 5321 (ISDEAA)",
    jurisdiction: "Mathias El Tribe — Indigenous Education Authority",
    description: "A nonprofit indigenous education system operating under the Indian Self-Determination and Education Assistance Act. SDU provides culturally grounded education, professional development, and sovereignty literacy programs for enrolled members and eligible indigenous communities.",
    mission: "Educate and empower enrolled members through self-determined, culturally competent learning programs rooted in indigenous sovereignty principles.",
    navPath: "/sdu",
    requiredRole: "member",
    letterhead: {
      line1: "SELF DETERMINATION UNIVERSITY (SDU)",
      line2: "Mathias El Tribe — Indigenous Education System",
      line3: "Indian Self-Determination & Education Assistance Act — 25 U.S.C. § 5321",
      line4: "A 501(c)(3) Nonprofit Educational Institution",
    },
    authorities: ["Education program delivery", "Sovereignty literacy curriculum", "Professional certification", "ISDEAA contract administration", "Cultural preservation programs"],
    federalStatutes: ["25 U.S.C. § 5321 (ISDEAA contracts)", "25 U.S.C. § 5322 (self-governance compacts)", "26 U.S.C. § 501(c)(3)", "20 U.S.C. § 7441 (Native language programs)"],
    color: "teal",
  },
  {
    id: "iee",
    name: "Indian Economic Enterprises",
    shortName: "I.E.E.",
    type: "enterprise",
    legalStatus: "Indian Economic Enterprise — SBA Certified",
    legalCode: "25 C.F.R. § 140.3",
    jurisdiction: "SBA — Small Business Administration — Indian Set-Aside",
    description: "Tribal business enterprises majority-owned and controlled by enrolled members. Eligible for SBA Indian set-aside contracts, BIA financing, and federal Indian business preferences.",
    mission: "Build economic self-sufficiency and generational wealth for enrolled members through sovereign business development.",
    navPath: "/iee",
    requiredRole: "member",
    letterhead: {
      line1: "INDIAN ECONOMIC ENTERPRISES (I.E.E.)",
      line2: "Mathias El Tribe — Sovereign Business Division",
      line3: "SBA Indian Set-Aside Eligible — 25 C.F.R. § 140.3",
      line4: "Bureau of Indian Affairs Business Financing Program",
    },
    authorities: ["Enterprise registration", "SBA certification applications", "BIA business financing", "Federal set-aside contracting", "Tribal business governance"],
    federalStatutes: ["25 C.F.R. § 140.3 (IEE definition)", "25 U.S.C. § 1544 (BIA financing)", "15 U.S.C. § 637(e) (Indian set-aside)"],
    color: "orange",
  },
];

export const ORG_BY_ID = Object.fromEntries(SOVEREIGN_ORGS.map((o) => [o.id, o]));

export function getOrgAccess(role: string, orgId: string): OrgAccessLevel {
  const r = role.toLowerCase().replace(/[- ]/g, "_");
  const isAdmin = r === "sovereign_admin" || r === "admin";
  const isTrustee = r === "trustee";
  const isOfficer = r === "officer";

  if (isAdmin || isTrustee) return "full";
  if (isOfficer) {
    if (orgId === "medical_center") return "officer";
    if (orgId === "supreme_court") return "officer";
    if (orgId === "tribal_trust") return "officer";
    if (orgId === "charitable_trust") return "officer";
    if (orgId === "niac") return "member";
    if (orgId === "iee") return "member";
  }
  return "member";
}

export function computeOrgAccess(role: string): Record<string, OrgAccessLevel> {
  return Object.fromEntries(SOVEREIGN_ORGS.map((o) => [o.id, getOrgAccess(role, o.id)]));
}
