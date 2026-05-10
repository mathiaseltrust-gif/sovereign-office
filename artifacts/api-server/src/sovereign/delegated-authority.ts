export type MedicalAuthority = "none" | "self" | "self_and_dependents";
export type LineageAccess = "none" | "read_only" | "limited" | "full";
export type OrgAccessLevel = "none" | "member" | "officer" | "director" | "trustee" | "full";

export interface OrgAccess {
  medicalCenter: OrgAccessLevel;
  supremeCourt: OrgAccessLevel;
  tribalTrust: OrgAccessLevel;
  charitableTrust: OrgAccessLevel;
  niac: OrgAccessLevel;
  iee: OrgAccessLevel;
}

export interface DelegatedAuthorities {
  medicalNotes: MedicalAuthority;
  welfareActions: boolean;
  familyDocuments: boolean;
  trustFilings: boolean;
  familyGovernance: boolean;
  lineageAccess: LineageAccess;
  allAuthorities: boolean;
  memberType: "minor" | "adult" | "adult_with_dependents" | "officer" | "trustee" | "chief_justice";
  orgAccess: OrgAccess;
}

export interface DelegationContext {
  hasLineage: boolean;
  hasChildren: boolean;
  icwaEligible: boolean;
  lineageVerified: boolean;
  membershipVerified: boolean;
}

export function computeDelegatedAuthorities(
  role: string,
  ctx: DelegationContext
): DelegatedAuthorities {
  const r = role.toLowerCase().replace(/[- ]/g, "_");

  const fullOrgAccess: OrgAccess = {
    medicalCenter: "full",
    supremeCourt: "full",
    tribalTrust: "full",
    charitableTrust: "full",
    niac: "full",
    iee: "full",
  };

  const officerOrgAccess: OrgAccess = {
    medicalCenter: "officer",
    supremeCourt: "officer",
    tribalTrust: "officer",
    charitableTrust: "officer",
    niac: "member",
    iee: "member",
  };

  const memberOrgAccess: OrgAccess = {
    medicalCenter: "member",
    supremeCourt: "member",
    tribalTrust: "member",
    charitableTrust: "member",
    niac: "member",
    iee: "member",
  };

  if (r === "sovereign_admin" || r === "admin") {
    return {
      medicalNotes: "self_and_dependents",
      welfareActions: true,
      familyDocuments: true,
      trustFilings: true,
      familyGovernance: true,
      lineageAccess: "full",
      allAuthorities: true,
      memberType: "chief_justice",
      orgAccess: fullOrgAccess,
    };
  }

  if (r === "trustee") {
    return {
      medicalNotes: "self_and_dependents",
      welfareActions: true,
      familyDocuments: true,
      trustFilings: true,
      familyGovernance: true,
      lineageAccess: "full",
      allAuthorities: true,
      memberType: "trustee",
      orgAccess: fullOrgAccess,
    };
  }

  if (r === "officer") {
    return {
      medicalNotes: "self",
      welfareActions: true,
      familyDocuments: false,
      trustFilings: false,
      familyGovernance: false,
      lineageAccess: "limited",
      allAuthorities: false,
      memberType: "officer",
      orgAccess: officerOrgAccess,
    };
  }

  if (ctx.hasChildren) {
    return {
      medicalNotes: "self_and_dependents",
      welfareActions: false,
      familyDocuments: true,
      trustFilings: false,
      familyGovernance: true,
      lineageAccess: "full",
      allAuthorities: false,
      memberType: "adult_with_dependents",
      orgAccess: memberOrgAccess,
    };
  }

  return {
    medicalNotes: "self",
    welfareActions: false,
    familyDocuments: true,
    trustFilings: false,
    familyGovernance: true,
    lineageAccess: "full",
    allAuthorities: false,
    memberType: "adult",
    orgAccess: memberOrgAccess,
  };
}

export function buildWhatNextInstructions(
  authorities: DelegatedAuthorities,
  ctx: {
    membershipVerified: boolean;
    protectionLevel: string;
    icwaEligible: boolean;
    welfareEligible: boolean;
    trustInheritance: boolean;
    familyGroup: string;
  }
): { immediate: string[]; next: string[]; protected: string[] } {
  const immediate: string[] = [];
  const next: string[] = [];
  const protectedItems: string[] = [];

  if (!ctx.membershipVerified) {
    immediate.push("Complete membership verification — upload lineage records in Family Tree & Lineage");
    immediate.push("Link at least one ancestor to your identity profile to confirm family group membership");
  } else {
    immediate.push(`Membership confirmed — ${ctx.familyGroup || "family group"} identity verified`);
  }

  if (ctx.icwaEligible) {
    immediate.push("ICWA protections are active on your account — any child welfare proceeding must trigger ICWA Notice");
    protectedItems.push("Indian Child Welfare Act (25 U.S.C. § 1901 et seq.) — applies to all child placement proceedings");
  }

  if (ctx.welfareEligible) {
    next.push("You are eligible for tribal welfare assistance — submit a welfare instrument request through Welfare Instruments");
    if (authorities.welfareActions) {
      next.push("You have authority to generate welfare instruments on behalf of members");
    }
  }

  if (ctx.trustInheritance) {
    next.push("Trust inheritance claim supported by lineage — file a Trust Instrument to document beneficiary status");
    protectedItems.push("Trust land status protected under Indian Reorganization Act (25 U.S.C. § 5108)");
  }

  if (authorities.medicalNotes === "self_and_dependents") {
    next.push("You can generate medical notes for yourself and dependents at Mathias El Tribe Medical Center");
  } else if (authorities.medicalNotes === "self") {
    next.push("You can generate medical notes for yourself at Mathias El Tribe Medical Center");
  }

  if (authorities.familyDocuments) {
    next.push("You are authorized to generate and file family governance documents");
  }

  if (authorities.familyGovernance) {
    next.push("You have access to family governance tools — use Trust Instruments and Filings for family matters");
  }

  if (ctx.protectionLevel === "critical") {
    protectedItems.push("CRITICAL protection level — all federal Indian law protections apply at maximum strength");
    protectedItems.push("Notify the Chief Justice & Trustee before any state court proceedings");
  } else if (ctx.protectionLevel === "elevated") {
    protectedItems.push("ELEVATED protection level — ICWA and federal trust protections apply");
  }

  if (authorities.allAuthorities) {
    next.push("Full authority granted — you may act on all matters within the Office's jurisdiction");
    next.push("Review pending complaints, NFR documents, and member welfare requests");
  }

  return { immediate, next, protected: protectedItems };
}

export function checkMedicalNoteAuthority(
  authorities: DelegatedAuthorities,
  forDependent: boolean
): { allowed: boolean; reason: string } {
  if (authorities.allAuthorities) return { allowed: true, reason: "Full authority" };

  if (authorities.medicalNotes === "none") {
    return { allowed: false, reason: "No medical note authority — membership verification or lineage confirmation required" };
  }

  if (forDependent && authorities.medicalNotes !== "self_and_dependents") {
    return {
      allowed: false,
      reason: "Notes for dependents require adult_with_dependents authority — confirm children in your family lineage records",
    };
  }

  return { allowed: true, reason: `Authorized: ${authorities.medicalNotes}` };
}
