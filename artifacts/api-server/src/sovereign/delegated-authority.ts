export type MedicalAuthority = "none" | "self" | "self_and_dependents" | "clinical_provider";
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
  memberType: "minor" | "adult" | "adult_with_dependents" | "officer" | "trustee" | "chief_justice" | "elder" | "medical_provider" | "visitor_media";
  orgAccess: OrgAccess;
  elderAuthority: boolean;
  clinicalAuthority: boolean;
  canGenerateTribalId: boolean;
  canApproveInstruments: boolean;
  canViewTrustAssets: boolean;
  canIssueTrustDirectives: boolean;
}

export interface DelegationContext {
  hasLineage: boolean;
  hasChildren: boolean;
  icwaEligible: boolean;
  lineageVerified: boolean;
  membershipVerified: boolean;
  isElder?: boolean;
}

const FULL_ORG: OrgAccess = {
  medicalCenter: "full", supremeCourt: "full", tribalTrust: "full",
  charitableTrust: "full", niac: "full", iee: "full",
};
const OFFICER_ORG: OrgAccess = {
  medicalCenter: "officer", supremeCourt: "officer", tribalTrust: "officer",
  charitableTrust: "officer", niac: "member", iee: "member",
};
const MEMBER_ORG: OrgAccess = {
  medicalCenter: "member", supremeCourt: "member", tribalTrust: "member",
  charitableTrust: "member", niac: "member", iee: "member",
};
const VISITOR_ORG: OrgAccess = {
  medicalCenter: "none", supremeCourt: "none", tribalTrust: "none",
  charitableTrust: "member", niac: "member", iee: "member",
};

export function computeDelegatedAuthorities(
  role: string,
  ctx: DelegationContext,
): DelegatedAuthorities {
  const r = role.toLowerCase().replace(/[- ]/g, "_");

  if (r === "sovereign_admin" || r === "admin") {
    return {
      medicalNotes: "clinical_provider", welfareActions: true, familyDocuments: true,
      trustFilings: true, familyGovernance: true, lineageAccess: "full", allAuthorities: true,
      memberType: "chief_justice", orgAccess: FULL_ORG, elderAuthority: true,
      clinicalAuthority: true, canGenerateTribalId: true, canApproveInstruments: true,
      canViewTrustAssets: true, canIssueTrustDirectives: true,
    };
  }

  if (r === "chief_justice") {
    return {
      medicalNotes: "clinical_provider", welfareActions: true, familyDocuments: true,
      trustFilings: true, familyGovernance: true, lineageAccess: "full", allAuthorities: true,
      memberType: "chief_justice", orgAccess: FULL_ORG, elderAuthority: true,
      clinicalAuthority: true, canGenerateTribalId: true, canApproveInstruments: true,
      canViewTrustAssets: true, canIssueTrustDirectives: true,
    };
  }

  if (r === "trustee") {
    return {
      medicalNotes: "self_and_dependents", welfareActions: true, familyDocuments: true,
      trustFilings: true, familyGovernance: true, lineageAccess: "full", allAuthorities: true,
      memberType: "trustee", orgAccess: FULL_ORG, elderAuthority: false,
      clinicalAuthority: false, canGenerateTribalId: true, canApproveInstruments: true,
      canViewTrustAssets: true, canIssueTrustDirectives: true,
    };
  }

  if (r === "officer") {
    return {
      medicalNotes: "self", welfareActions: true, familyDocuments: false,
      trustFilings: false, familyGovernance: false, lineageAccess: "limited", allAuthorities: false,
      memberType: "officer", orgAccess: OFFICER_ORG, elderAuthority: false,
      clinicalAuthority: false, canGenerateTribalId: true, canApproveInstruments: false,
      canViewTrustAssets: false, canIssueTrustDirectives: false,
    };
  }

  if (r === "medical_provider") {
    return {
      medicalNotes: "clinical_provider", welfareActions: false, familyDocuments: false,
      trustFilings: false, familyGovernance: false, lineageAccess: "read_only", allAuthorities: false,
      memberType: "medical_provider",
      orgAccess: { ...MEMBER_ORG, medicalCenter: "officer" },
      elderAuthority: false, clinicalAuthority: true,
      canGenerateTribalId: false, canApproveInstruments: false,
      canViewTrustAssets: false, canIssueTrustDirectives: false,
    };
  }

  if (r === "visitor_media" || r === "visitor" || r === "media") {
    return {
      medicalNotes: "none", welfareActions: false, familyDocuments: false,
      trustFilings: false, familyGovernance: false, lineageAccess: "none", allAuthorities: false,
      memberType: "visitor_media", orgAccess: VISITOR_ORG, elderAuthority: false,
      clinicalAuthority: false, canGenerateTribalId: false, canApproveInstruments: false,
      canViewTrustAssets: false, canIssueTrustDirectives: false,
    };
  }

  const isElder = r === "elder" || ctx.isElder === true;

  if (isElder) {
    return {
      medicalNotes: "self_and_dependents", welfareActions: false, familyDocuments: true,
      trustFilings: false, familyGovernance: true, lineageAccess: "full", allAuthorities: false,
      memberType: "elder", orgAccess: MEMBER_ORG, elderAuthority: true,
      clinicalAuthority: false, canGenerateTribalId: false, canApproveInstruments: false,
      canViewTrustAssets: false, canIssueTrustDirectives: false,
    };
  }

  if (ctx.hasChildren) {
    return {
      medicalNotes: "self_and_dependents", welfareActions: false, familyDocuments: true,
      trustFilings: false, familyGovernance: true, lineageAccess: "full", allAuthorities: false,
      memberType: "adult_with_dependents", orgAccess: MEMBER_ORG, elderAuthority: false,
      clinicalAuthority: false, canGenerateTribalId: false, canApproveInstruments: false,
      canViewTrustAssets: false, canIssueTrustDirectives: false,
    };
  }

  return {
    medicalNotes: "self", welfareActions: false, familyDocuments: true,
    trustFilings: false, familyGovernance: true, lineageAccess: "full", allAuthorities: false,
    memberType: "adult", orgAccess: MEMBER_ORG, elderAuthority: false,
    clinicalAuthority: false, canGenerateTribalId: false, canApproveInstruments: false,
    canViewTrustAssets: false, canIssueTrustDirectives: false,
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
    isElder?: boolean;
  },
): { immediate: string[]; next: string[]; protected: string[] } {
  const immediate: string[] = [];
  const next: string[] = [];
  const protectedItems: string[] = [];

  if (authorities.memberType === "visitor_media") {
    immediate.push("Your request has been submitted.");
    next.push("Processing time varies — you will be contacted if your request is approved.");
    next.push("Submit a Public Statement Request or Press Access Request using the portal.");
    protectedItems.push("Visitor/Media access is restricted to public information only.");
    return { immediate, next, protected: protectedItems };
  }

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

  if (authorities.clinicalAuthority) {
    next.push("You are authorized to create clinical notes and dependent notes as a verified Tribal Medical Provider");
    next.push("Access patient history and tribal medical authority rules at the Medical Center");
    next.push("Use Medical Provider Dashboard for credential verification and medical tasks");
    protectedItems.push("Tribal Medical Jurisdiction — Indian Health Service authority (25 U.S.C. § 1601 et seq.)");
  } else if (authorities.medicalNotes === "self_and_dependents") {
    next.push("You can generate medical notes for yourself and dependents at Mathias El Tribe Medical Center");
  } else if (authorities.medicalNotes === "self") {
    next.push("You can generate medical notes for yourself at Mathias El Tribe Medical Center");
  }

  if (ctx.isElder || authorities.memberType === "elder") {
    immediate.push("Elder status recognized — cultural and advisory authorities are active");
    next.push("Access Elder Protections and Cultural Authority tools");
    next.push("Review family lineage and provide lineage corrections through Elder Advisory role");
    next.push("Participate in Elder Advisory Council — submit input on governance matters");
    protectedItems.push("Elder Authority — recognized under tribal custom and federal Indian law");
    protectedItems.push("Cultural Authority — tribal cultural interests representation authorized");
  }

  if (authorities.elderAuthority && !(ctx.isElder || authorities.memberType === "elder")) {
    next.push("Elder advisory authorities are active — review pending lineage corrections");
  }

  if (authorities.canGenerateTribalId) {
    next.push("Generate your Tribal ID document — includes QR code and lineage summary");
  }

  if (authorities.canApproveInstruments) {
    next.push("Review and approve pending trust instruments in the instrument queue");
    next.push("Review trust disbursement requests and trust land transfers");
  }

  if (authorities.canViewTrustAssets) {
    next.push("View Trust Asset Dashboard — assets, beneficiaries, risk flags, and disbursements");
  }

  if (authorities.canIssueTrustDirectives) {
    next.push("Issue trust directives from the Trustee Asset Dashboard");
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
  forDependent: boolean,
): { allowed: boolean; reason: string } {
  if (authorities.allAuthorities || authorities.clinicalAuthority) return { allowed: true, reason: "Full / Clinical authority" };

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
