import { db } from "@workspace/db";
import {
  usersTable,
  profilesTable,
  identityNarrativesTable,
  familyLineageTable,
} from "@workspace/db";
import { eq } from "drizzle-orm";
import { computeDelegatedAuthorities } from "./delegated-authority";
import { logger } from "../lib/logger";

export type ElderStatus = "community" | "family" | "tribal" | null;

export interface OrgAffiliation {
  org: string;
  role: string;
  active: boolean;
}

export interface VisibilityRules {
  canViewLineage: boolean;
  canViewMedical: boolean;
  canViewTrustAssets: boolean;
  canViewCourtDocuments: boolean;
  canViewFamilyGovernance: boolean;
  canViewMemberList: boolean;
  canViewAlbum: boolean;
  expandedLineageDepth: number;
}

export interface SovereignIdentityGatewayPayload {
  identity: {
    userId: number;
    email: string;
    name: string;
    legalName: string;
    preferredName: string;
    tribalName: string;
    title: string;
    familyGroup: string;
    displayName: string;
    courtCaption: string;
    role: string;
    identityTags: string[];
    tribalEnrollmentNumber: string | null;
    tribalIdNumber: string | null;
  };
  lineageSummary: string;
  ancestorChain: string[];
  tribalNations: string[];
  membershipVerified: boolean;
  entraVerified: boolean;
  lineageVerified: boolean;
  delegatedAuthorities: ReturnType<typeof computeDelegatedAuthorities>;
  protectionLevel: "standard" | "elevated" | "critical";
  benefitEligibility: {
    icwa: boolean;
    tribalWelfare: boolean;
    trustBeneficiary: boolean;
    membershipBenefits: boolean;
    ancestralLandRights: boolean;
  };
  orgAffiliations: OrgAffiliation[];
  elderStatus: ElderStatus;
  isElder: boolean;
  elderAuthorities: string[];
  profilePhoto: string | null;
  visibilityRules: VisibilityRules;
  generationalPosition: number;
  generationalDepth: number;
  icwaEligible: boolean;
  welfareEligible: boolean;
  trustInheritance: boolean;
}

function resolveElderStatus(
  identityTags: string[],
  generationalPosition: number,
): { isElder: boolean; elderStatus: ElderStatus; elderAuthorities: string[] } {
  const tags = identityTags.map((t) => t.toLowerCase());
  const hasTribalElder = tags.some((t) => t.includes("tribal elder"));
  const hasCommunityElder = tags.some((t) => t.includes("community elder") || t === "elder");
  const hasFamilyElder = tags.some((t) => t.includes("family elder") || t.includes("grandparent"));
  const isElderByPosition = generationalPosition >= 2;

  const isElder = hasTribalElder || hasCommunityElder || hasFamilyElder || isElderByPosition;

  let elderStatus: ElderStatus = null;
  if (hasTribalElder) elderStatus = "tribal";
  else if (hasCommunityElder || isElderByPosition) elderStatus = "community";
  else if (hasFamilyElder) elderStatus = "family";

  const elderAuthorities: string[] = [];
  if (isElder) {
    elderAuthorities.push("Cultural Authority — authorized to represent tribal cultural interests");
    elderAuthorities.push("Advisory Authority — recognized advisor to the Sovereign Office");
    elderAuthorities.push("Family Governance Authority — presides over family governance matters");
    elderAuthorities.push("Lineage Correction Authority — may submit corrections to lineage records");
    elderAuthorities.push("Ceremonial Authority — recognized for ceremonial and cultural matters");
  }

  return { isElder, elderStatus, elderAuthorities };
}

function resolveOrgAffiliations(role: string, identityTags: string[]): OrgAffiliation[] {
  const r = role.toLowerCase().replace(/[- ]/g, "_");
  const tags = identityTags.map((t) => t.toLowerCase());
  const affiliations: OrgAffiliation[] = [];

  if (r === "trustee" || r === "sovereign_admin" || r === "admin") {
    affiliations.push(
      { org: "Supreme Court", role: "Chief Justice", active: true },
      { org: "Tribal Trust", role: "Trustee", active: true },
      { org: "Charitable Trust", role: "Director", active: true },
      { org: "NIAC", role: "Director", active: true },
      { org: "Indian Economic Enterprises", role: "Director", active: true },
      { org: "Medical Center", role: "Director", active: true },
    );
  } else if (r === "officer") {
    affiliations.push(
      { org: "Supreme Court", role: "Officer", active: true },
      { org: "Tribal Trust", role: "Officer", active: true },
    );
  } else {
    affiliations.push({ org: "Mathias El Tribe", role: "Member", active: true });
  }

  if (r === "medical_provider" || tags.includes("medical provider")) {
    affiliations.push({ org: "Medical Center", role: "Provider", active: true });
  }
  if (tags.includes("elder") || tags.includes("community elder") || tags.includes("tribal elder")) {
    affiliations.push({ org: "Elder Advisory Council", role: "Elder", active: true });
  }
  if (tags.includes("niac") || tags.includes("niac officer")) {
    affiliations.push({ org: "NIAC", role: "Officer", active: true });
  }

  return affiliations;
}

function buildVisibilityRules(
  role: string,
  isElder: boolean,
  identityTags: string[],
): VisibilityRules {
  const r = role.toLowerCase().replace(/[- ]/g, "_");
  const isAdmin = r === "sovereign_admin" || r === "admin";
  const isTrustee = r === "trustee" || isAdmin;
  const isOfficer = r === "officer" || isTrustee;
  const isVisitorMedia = r === "visitor_media" || r === "visitor" || r === "media";
  const isMedicalProvider = r === "medical_provider" || identityTags.some((t) => t.toLowerCase().includes("medical provider"));

  if (isVisitorMedia) {
    return {
      canViewLineage: false,
      canViewMedical: false,
      canViewTrustAssets: false,
      canViewCourtDocuments: false,
      canViewFamilyGovernance: false,
      canViewMemberList: false,
      canViewAlbum: false,
      expandedLineageDepth: 0,
    };
  }

  return {
    canViewLineage: true,
    canViewMedical: isOfficer || isMedicalProvider,
    canViewTrustAssets: isTrustee,
    canViewCourtDocuments: isOfficer,
    canViewFamilyGovernance: true,
    canViewMemberList: isOfficer,
    canViewAlbum: isElder || isTrustee,
    expandedLineageDepth: isElder ? 10 : isTrustee ? 8 : isOfficer ? 5 : 3,
  };
}

export async function resolveSovereignIdentityGateway(
  dbId: number,
  tokenUser: { email: string; name: string; roles: string[] },
): Promise<SovereignIdentityGatewayPayload> {
  const role = tokenUser.roles?.[0] ?? "member";

  if (!dbId) {
    const authorities = computeDelegatedAuthorities(role, {
      hasLineage: false, hasChildren: false,
      icwaEligible: false, lineageVerified: false, membershipVerified: false,
    });
    const { isElder, elderStatus, elderAuthorities } = resolveElderStatus([], 0);
    const visibilityRules = buildVisibilityRules(role, isElder, []);
    return {
      identity: {
        userId: 0, email: tokenUser.email, name: tokenUser.name,
        legalName: tokenUser.name, preferredName: tokenUser.name,
        tribalName: "", title: "", familyGroup: "",
        displayName: tokenUser.name, courtCaption: tokenUser.name,
        role, identityTags: [],
        tribalEnrollmentNumber: null, tribalIdNumber: null,
      },
      lineageSummary: "No lineage records on file.",
      ancestorChain: [], tribalNations: [],
      membershipVerified: false, entraVerified: false, lineageVerified: false,
      delegatedAuthorities: authorities,
      protectionLevel: "standard",
      benefitEligibility: { icwa: false, tribalWelfare: false, trustBeneficiary: false, membershipBenefits: false, ancestralLandRights: false },
      orgAffiliations: resolveOrgAffiliations(role, []),
      elderStatus, isElder, elderAuthorities,
      profilePhoto: null, visibilityRules,
      generationalPosition: 0, generationalDepth: 0,
      icwaEligible: false, welfareEligible: false, trustInheritance: false,
    };
  }

  try {
    const [[user], [profile], narrative, lineageRows, [linkedNode]] = await Promise.all([
      db.select().from(usersTable).where(eq(usersTable.id, dbId)).limit(1),
      db.select().from(profilesTable).where(eq(profilesTable.userId, dbId)).limit(1),
      db.select().from(identityNarrativesTable).where(eq(identityNarrativesTable.userId, dbId)).limit(1).then((r) => r[0] ?? null),
      db.select().from(familyLineageTable).where(eq(familyLineageTable.userId, dbId)),
      db.select({
        tribalEnrollmentNumber: familyLineageTable.tribalEnrollmentNumber,
        tribalIdNumber: familyLineageTable.tribalIdNumber,
        photoUrl: familyLineageTable.photoUrl,
        photoFilename: familyLineageTable.photoFilename,
      }).from(familyLineageTable).where(eq(familyLineageTable.linkedProfileUserId, dbId)).limit(1),
    ]);

    const legalName = profile?.legalName ?? user?.name ?? tokenUser.name;
    const preferredName = profile?.preferredName ?? user?.name ?? tokenUser.name;
    const tribalName = profile?.tribalName ?? "";
    const title = profile?.title ?? "";
    const familyGroup = profile?.familyGroup ?? narrative?.familyGroup ?? "";
    const displayName = tribalName || preferredName || legalName;
    const courtCaption = title ? `${title} ${legalName}` : legalName;

    const icwaEligible = narrative?.icwaEligible ?? lineageRows.some((l) => l.icwaEligible) ?? false;
    const welfareEligible = narrative?.welfareEligible ?? lineageRows.some((l) => l.welfareEligible) ?? false;
    const trustInheritance = narrative?.trustInheritance ?? lineageRows.some((l) => l.trustBeneficiary) ?? false;
    const entraVerified = !!(user?.entraId);
    const lineageVerified = lineageRows.length > 0;
    const identityTags: string[] = [
      ...((narrative?.identityTags as string[]) ?? []),
      ...((profile?.welfareTags as string[]) ?? []),
    ].filter((v, i, a) => a.indexOf(v) === i);

    const hasFamilyGroup = identityTags.some((t) => t.toLowerCase().includes("family") || t.toLowerCase().includes("tribal")) || !!familyGroup;
    const membershipVerified = lineageVerified && hasFamilyGroup;

    const protectionLevel: "standard" | "elevated" | "critical" =
      (narrative?.protectionLevel as "standard" | "elevated" | "critical") ??
      (icwaEligible && trustInheritance ? "critical" : icwaEligible ? "elevated" : "standard");

    const tribalNations = [...new Set(lineageRows.flatMap((l) => l.tribalNation ? [l.tribalNation] : []))];
    const ancestorChain = narrative
      ? (Array.isArray(narrative.ancestorChain) ? narrative.ancestorChain as string[] : [])
      : lineageRows.filter((l) => l.isDeceased).map((l) => l.fullName);

    const generationalPosition = narrative?.generationalPosition ?? 0;
    const generationalDepth = narrative?.generationalDepth ?? 0;

    const hasChildren = lineageRows.some((l) => (Array.isArray(l.childrenIds) ? l.childrenIds : []).length > 0);
    const dbRole = user?.role ?? role;
    const authorities = computeDelegatedAuthorities(dbRole, {
      hasLineage: lineageVerified, hasChildren, icwaEligible,
      lineageVerified, membershipVerified,
    });

    const { isElder, elderStatus, elderAuthorities } = resolveElderStatus(identityTags, generationalPosition);
    const orgAffiliations = resolveOrgAffiliations(dbRole, identityTags);
    const visibilityRules = buildVisibilityRules(dbRole, isElder, identityTags);

    const lineageParts: string[] = [];
    if (lineageRows.length > 0) lineageParts.push(`${lineageRows.length} lineage record(s) documented.`);
    if (tribalNations.length > 0) lineageParts.push(`Tribal: ${tribalNations.join(", ")}.`);
    if (icwaEligible) lineageParts.push("ICWA eligible.");
    if (trustInheritance) lineageParts.push("Trust beneficiary.");

    logger.info({ dbId, membershipVerified, isElder, elderStatus, protectionLevel }, "SIG gateway resolved");

    return {
      identity: {
        userId: dbId, email: user?.email ?? tokenUser.email, name: user?.name ?? tokenUser.name,
        legalName, preferredName, tribalName, title, familyGroup,
        displayName, courtCaption, role: dbRole, identityTags,
        tribalEnrollmentNumber: linkedNode?.tribalEnrollmentNumber ?? null,
        tribalIdNumber: linkedNode?.tribalIdNumber ?? null,
      },
      lineageSummary: lineageParts.join(" ") || "No lineage on record.",
      ancestorChain, tribalNations, membershipVerified, entraVerified, lineageVerified,
      delegatedAuthorities: authorities,
      protectionLevel,
      benefitEligibility: {
        icwa: icwaEligible, tribalWelfare: welfareEligible, trustBeneficiary: trustInheritance,
        membershipBenefits: membershipVerified, ancestralLandRights: icwaEligible && trustInheritance,
        ...((narrative?.benefitEligibility as Record<string, boolean>) ?? {}),
      },
      orgAffiliations, elderStatus, isElder, elderAuthorities,
      profilePhoto: linkedNode?.photoUrl ?? (profile as any)?.profilePhoto ?? null,
      visibilityRules,
      generationalPosition, generationalDepth,
      icwaEligible, welfareEligible, trustInheritance,
    };
  } catch (err) {
    logger.error({ err: (err as Error).message }, "SIG gateway DB error");
    const authorities = computeDelegatedAuthorities(role, { hasLineage: false, hasChildren: false, icwaEligible: false, lineageVerified: false, membershipVerified: false });
    const { isElder, elderStatus, elderAuthorities } = resolveElderStatus([], 0);
    return {
      identity: { userId: dbId, email: tokenUser.email, name: tokenUser.name, legalName: tokenUser.name, preferredName: tokenUser.name, tribalName: "", title: "", familyGroup: "", displayName: tokenUser.name, courtCaption: tokenUser.name, role, identityTags: [], tribalEnrollmentNumber: null, tribalIdNumber: null },
      lineageSummary: "Identity gateway error — contact system administrator.",
      ancestorChain: [], tribalNations: [], membershipVerified: false, entraVerified: false, lineageVerified: false,
      delegatedAuthorities: authorities, protectionLevel: "standard",
      benefitEligibility: { icwa: false, tribalWelfare: false, trustBeneficiary: false, membershipBenefits: false, ancestralLandRights: false },
      orgAffiliations: [], elderStatus, isElder, elderAuthorities, profilePhoto: null,
      visibilityRules: buildVisibilityRules(role, false, []),
      generationalPosition: 0, generationalDepth: 0,
      icwaEligible: false, welfareEligible: false, trustInheritance: false,
    };
  }
}
