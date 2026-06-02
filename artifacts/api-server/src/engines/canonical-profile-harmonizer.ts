import { db } from "@workspace/db";
import {
  usersTable,
  profilesTable,
  familyLineageTable,
  traceMattersTable,
  nfrReviewSignalsTable,
} from "@workspace/db";
import { eq, and, or, desc, sql } from "drizzle-orm";

export type ProtectionStatus = "critical" | "elevated" | "protected" | "watch" | "none";
export type RecommendedPathway =
  | "nfr_review"
  | "trace_review"
  | "land_protection_review"
  | "trust_placement_review"
  | "household_protection_review"
  | "lineage_atlas_review"
  | "companion_guidance"
  | "no_action";

export interface CanonicalProfileHarmonizerInput {
  userId: number;
  includeRecentMatters?: boolean;
  includeRecentSignals?: boolean;
}

export interface CanonicalProfileContext {
  identity: {
    userId: number;
    email: string | null;
    name: string | null;
    role: string | null;
    legalName: string | null;
    preferredName: string | null;
    tribalName: string | null;
    membershipVerified: boolean;
    entraVerified: boolean;
    lineageVerified: boolean;
  };
  lineage: {
    linkedNodeId: number | null;
    fullName: string | null;
    tribalNation: string | null;
    generationalPosition: number | null;
    protectionLevel: string | null;
    membershipStatus: string | null;
  };
  household: {
    address: string | null;
    mailingAddress: string | null;
    inheritedLandStatus: string | null;
    inheritedTribalLandCode: string | null;
    isIndianCountry: boolean;
    ihsEligible: boolean;
    urbanIndianEligible: boolean;
    protections: string[];
  };
  land: {
    apn: string | null;
    landStatus: string | null;
    landClassification: string | null;
    tribalLandCode: string | null;
    landType: string;
    stewardshipStatus: string;
    jurisdictionBasis: string[];
  };
  governance: {
    traceAccess: boolean;
    roleGovernorKey: string | null;
    reviewLevel: "OFFICER" | "TRUSTEE" | "CHIEF_JUSTICE" | "NONE";
  };
  protection: {
    protectionStatus: ProtectionStatus;
    protectionReasons: string[];
    triggerFlags: {
      triggerNFR: boolean;
      triggerTraceReview: boolean;
      triggerLandProtection: boolean;
      triggerHouseholdProtection: boolean;
      triggerCompanionGuidance: boolean;
      triggerGovernanceReview: boolean;
      triggerTrustPlacementReview: boolean;
    };
    recommendedPathways: RecommendedPathway[];
  };
  trace: {
    activeMatterCount: number;
    recentMatters: unknown[];
  };
  nfr: {
    recentSignalCount: number;
    recentSignals: unknown[];
  };
}

const INDIAN_COUNTRY_STATUSES = new Set([
  "trust",
  "allotment",
  "tribal_government_land",
  "tribal_trust_stewardship",
  "protected_tribal_land",
  "sacred_cultural_land",
  "restricted_fee",
  "restricted_indian_trust_land",
]);

const TRUST_PLACEMENT_CANDIDATE_STATUSES = new Set([
  "fee",
  "fee_simple",
  "fee_simple_member_land",
  "mortgaged_home",
  "rental_household",
  "household_residence",
  "stewardship_location",
  "ancestral_location",
  "disputed_land",
  "unknown",
]);

function normalizeText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeStatus(value: unknown): string | null {
  return normalizeText(value)?.toLowerCase().replace(/\s+/g, "_") ?? null;
}

function uniq(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

function classifyLandType(landStatus: string | null, landClassification: string | null, tribalLandCode: string | null): string {
  const value = landStatus ?? landClassification ?? "unknown";
  if (tribalLandCode) return "tribal_coded_land_or_household";
  if (INDIAN_COUNTRY_STATUSES.has(value)) return "tribal_protected_land";
  if (value.includes("mortgage")) return "mortgaged_household";
  if (value.includes("rental") || value.includes("lease")) return "rental_household";
  if (value.includes("ancestor") || value.includes("continuity")) return "ancestral_continuity_location";
  if (value.includes("disputed")) return "disputed_or_review_land";
  if (value.includes("fee")) return "fee_or_member_land";
  return value;
}

function classifyStewardshipStatus(landStatus: string | null, landClassification: string | null): string {
  const value = landStatus ?? landClassification ?? "unknown";
  if (value.includes("trust")) return "trust_or_restricted_stewardship";
  if (value.includes("government")) return "governmental_stewardship";
  if (value.includes("sacred") || value.includes("cultural")) return "cultural_stewardship";
  if (value.includes("ancestor") || value.includes("continuity")) return "ancestral_continuity_stewardship";
  if (value.includes("mortgage") || value.includes("rental") || value.includes("household")) return "household_stewardship_review";
  return "general_stewardship_review";
}

export async function harmonizeCanonicalProfile(input: CanonicalProfileHarmonizerInput): Promise<CanonicalProfileContext> {
  const { userId } = input;

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  const [profile] = await db.select().from(profilesTable).where(eq(profilesTable.userId, userId)).limit(1);
  const [linkedNode] = await db
    .select()
    .from(familyLineageTable)
    .where(eq(familyLineageTable.linkedProfileUserId, userId))
    .limit(1);

  const activeMatters = input.includeRecentMatters === false
    ? []
    : await db
        .select()
        .from(traceMattersTable)
        .where(or(eq(traceMattersTable.createdBy, userId), eq(traceMattersTable.assignedTo, userId)))
        .orderBy(desc(traceMattersTable.createdAt))
        .limit(10);

  const recentSignals = input.includeRecentSignals === false
    ? []
    : await db
        .select()
        .from(nfrReviewSignalsTable)
        .where(eq(nfrReviewSignalsTable.userId, userId))
        .orderBy(desc(nfrReviewSignalsTable.createdAt))
        .limit(10);

  const apn = normalizeText((profile as any)?.apn);
  const mailingAddress = normalizeText((profile as any)?.mailingAddress);
  const landStatus = normalizeStatus((profile as any)?.landStatus);
  const landClassification = normalizeStatus((profile as any)?.landClassification);
  const tribalLandCode = normalizeText((profile as any)?.tribalLandCode);
  const traceAccess = Boolean((profile as any)?.traceAccess);
  const headTribalNation = normalizeText((linkedNode as any)?.tribalNation);

  const isIndianCountry = Boolean((landStatus && INDIAN_COUNTRY_STATUSES.has(landStatus)) || tribalLandCode);
  const ihsEligible = Boolean(headTribalNation && mailingAddress) || Boolean(isIndianCountry && headTribalNation);
  const urbanIndianEligible = Boolean(headTribalNation);

  const jurisdictionBasis: string[] = [];
  const protectionReasons: string[] = [];
  const householdProtections: string[] = [];

  if (tribalLandCode) {
    jurisdictionBasis.push("tribal_land_code_present");
    protectionReasons.push("Tribal land code is present on the profile record.");
  }
  if (apn) {
    jurisdictionBasis.push("apn_associated");
    protectionReasons.push("A parcel/APN is associated with the profile.");
  }
  if (isIndianCountry) {
    jurisdictionBasis.push("indian_country_or_tribal_land_status");
    householdProtections.push("Indian Country Jurisdiction");
    protectionReasons.push("Land or household status indicates Indian Country or tribal land protection.");
  }
  if (ihsEligible) householdProtections.push("IHS Eligible");
  if (urbanIndianEligible) householdProtections.push("Urban Indian Health");
  if (traceAccess) {
    jurisdictionBasis.push("trace_access_enabled");
    protectionReasons.push("TRACE access is enabled for this profile.");
  }
  if (recentSignals.length > 0) {
    jurisdictionBasis.push("active_nfr_signal_history");
    protectionReasons.push("Recent NFR signals exist for this user.");
  }
  if (activeMatters.length > 0) {
    jurisdictionBasis.push("active_trace_matter_history");
    protectionReasons.push("Recent TRACE matters exist for this user.");
  }

  const landType = classifyLandType(landStatus, landClassification, tribalLandCode);
  const stewardshipStatus = classifyStewardshipStatus(landStatus, landClassification);
  const trustPlacementCandidate = TRUST_PLACEMENT_CANDIDATE_STATUSES.has(landStatus ?? "unknown") || landType === "mortgaged_household" || landType === "rental_household";

  let protectionStatus: ProtectionStatus = "none";
  if (isIndianCountry && (tribalLandCode || landStatus?.includes("trust") || landStatus?.includes("restricted"))) {
    protectionStatus = "critical";
  } else if (isIndianCountry || traceAccess) {
    protectionStatus = "elevated";
  } else if (apn || mailingAddress || trustPlacementCandidate) {
    protectionStatus = "watch";
  }

  const triggerNFR = protectionStatus === "critical" || protectionStatus === "elevated" || recentSignals.length > 0;
  const triggerTraceReview = traceAccess || activeMatters.length > 0 || protectionStatus !== "none";
  const triggerLandProtection = Boolean(apn || tribalLandCode || isIndianCountry);
  const triggerHouseholdProtection = Boolean(mailingAddress && (isIndianCountry || headTribalNation || trustPlacementCandidate));
  const triggerCompanionGuidance = protectionStatus !== "none" || trustPlacementCandidate;
  const triggerGovernanceReview = triggerNFR || triggerTraceReview || protectionStatus === "critical";
  const triggerTrustPlacementReview = trustPlacementCandidate && !isIndianCountry;

  const recommendedPathways: RecommendedPathway[] = [];
  if (triggerNFR) recommendedPathways.push("nfr_review");
  if (triggerTraceReview) recommendedPathways.push("trace_review");
  if (triggerLandProtection) recommendedPathways.push("land_protection_review");
  if (triggerHouseholdProtection) recommendedPathways.push("household_protection_review");
  if (triggerTrustPlacementReview) recommendedPathways.push("trust_placement_review");
  if (triggerCompanionGuidance) recommendedPathways.push("companion_guidance");
  if (recommendedPathways.length === 0) recommendedPathways.push("no_action");

  const reviewLevel = protectionStatus === "critical"
    ? "CHIEF_JUSTICE"
    : protectionStatus === "elevated"
      ? "TRUSTEE"
      : protectionStatus === "watch"
        ? "OFFICER"
        : "NONE";

  return {
    identity: {
      userId,
      email: normalizeText((user as any)?.email),
      name: normalizeText((user as any)?.name),
      role: normalizeText((user as any)?.role),
      legalName: normalizeText((profile as any)?.legalName),
      preferredName: normalizeText((profile as any)?.preferredName),
      tribalName: normalizeText((profile as any)?.tribalName),
      membershipVerified: Boolean((profile as any)?.membershipVerified),
      entraVerified: Boolean((profile as any)?.entraVerified),
      lineageVerified: Boolean((profile as any)?.lineageVerified),
    },
    lineage: {
      linkedNodeId: (linkedNode as any)?.id ?? null,
      fullName: normalizeText((linkedNode as any)?.fullName),
      tribalNation: headTribalNation,
      generationalPosition: (linkedNode as any)?.generationalPosition ?? null,
      protectionLevel: normalizeText((linkedNode as any)?.protectionLevel),
      membershipStatus: normalizeText((linkedNode as any)?.membershipStatus),
    },
    household: {
      address: mailingAddress,
      mailingAddress,
      inheritedLandStatus: landStatus,
      inheritedTribalLandCode: tribalLandCode,
      isIndianCountry,
      ihsEligible,
      urbanIndianEligible,
      protections: uniq(householdProtections),
    },
    land: {
      apn,
      landStatus,
      landClassification,
      tribalLandCode,
      landType,
      stewardshipStatus,
      jurisdictionBasis: uniq(jurisdictionBasis),
    },
    governance: {
      traceAccess,
      roleGovernorKey: normalizeText((user as any)?.role),
      reviewLevel,
    },
    protection: {
      protectionStatus,
      protectionReasons: uniq(protectionReasons),
      triggerFlags: {
        triggerNFR,
        triggerTraceReview,
        triggerLandProtection,
        triggerHouseholdProtection,
        triggerCompanionGuidance,
        triggerGovernanceReview,
        triggerTrustPlacementReview,
      },
      recommendedPathways: uniq(recommendedPathways) as RecommendedPathway[],
    },
    trace: {
      activeMatterCount: activeMatters.length,
      recentMatters: activeMatters,
    },
    nfr: {
      recentSignalCount: recentSignals.length,
      recentSignals,
    },
  };
}

export default harmonizeCanonicalProfile;
