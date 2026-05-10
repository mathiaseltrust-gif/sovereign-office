import { db } from "@workspace/db";
import { usersTable, profilesTable, identityNarrativesTable, familyLineageTable } from "@workspace/db";
import { eq } from "drizzle-orm";

export interface UnifiedIdentity {
  userId: number;
  email: string;
  name: string;
  role: string;
  legalName: string;
  preferredName: string;
  tribalName: string;
  nickname: string;
  title: string;
  familyGroup: string;
  displayName: string;
  courtCaption: string;
  jurisdictionTags: string[];
  welfareTags: string[];
  notificationPreferences: NotificationPreferences;
  lineageSummary: string;
  ancestorChain: string[];
  identityTags: string[];
  generationalPosition: number;
  generationalDepth: number;
  protectionLevel: "standard" | "elevated" | "critical";
  benefitEligibility: BenefitEligibility;
  icwaEligible: boolean;
  welfareEligible: boolean;
  trustInheritance: boolean;
  membershipVerified: boolean;
}

export interface BenefitEligibility {
  icwa: boolean;
  tribalWelfare: boolean;
  trustBeneficiary: boolean;
  membershipBenefits: boolean;
  ancestralLandRights: boolean;
}

export interface NotificationPreferences {
  familyGovernance: boolean;
  welfareUpdates: boolean;
  trustInstruments: boolean;
  recorderFilings: boolean;
  courtHearings: boolean;
  tribalAnnouncements: boolean;
  email: boolean;
  push: boolean;
}

const DEFAULT_NOTIFICATION_PREFS: NotificationPreferences = {
  familyGovernance: true,
  welfareUpdates: true,
  trustInstruments: true,
  recorderFilings: true,
  courtHearings: true,
  tribalAnnouncements: true,
  email: false,
  push: false,
};

const DEFAULT_BENEFIT_ELIGIBILITY: BenefitEligibility = {
  icwa: false,
  tribalWelfare: false,
  trustBeneficiary: false,
  membershipBenefits: false,
  ancestralLandRights: false,
};

export async function resolveIdentity(dbId: number): Promise<UnifiedIdentity | null> {
  const userRows = await db.select().from(usersTable).where(eq(usersTable.id, dbId)).limit(1);
  if (!userRows[0]) return null;

  const user = userRows[0];
  const profileRows = await db.select().from(profilesTable).where(eq(profilesTable.userId, dbId)).limit(1);
  const profile = profileRows[0] ?? null;

  const legalName = profile?.legalName ?? user.name;
  const preferredName = profile?.preferredName ?? user.name;
  const tribalName = profile?.tribalName ?? "";
  const nickname = profile?.nickname ?? "";
  const title = profile?.title ?? "";
  const familyGroup = profile?.familyGroup ?? "";

  const displayName = tribalName || preferredName || user.name;
  const courtCaption = title ? `${title} ${legalName}` : legalName;

  const notificationPreferences: NotificationPreferences = {
    ...DEFAULT_NOTIFICATION_PREFS,
    ...((profile?.notificationPreferences as Partial<NotificationPreferences>) ?? {}),
  };

  const narrativeRows = await db
    .select()
    .from(identityNarrativesTable)
    .where(eq(identityNarrativesTable.userId, dbId))
    .limit(1);
  const narrative = narrativeRows[0] ?? null;

  const lineageRows = await db
    .select()
    .from(familyLineageTable)
    .where(eq(familyLineageTable.userId, dbId));

  const tribalNations = [...new Set(lineageRows.flatMap((l) => l.tribalNation ? [l.tribalNation] : []))];
  const icwaEligible = narrative?.icwaEligible ?? lineageRows.some((l) => l.icwaEligible) ?? false;
  const welfareEligible = narrative?.welfareEligible ?? lineageRows.some((l) => l.welfareEligible) ?? false;
  const trustInheritance = narrative?.trustInheritance ?? lineageRows.some((l) => l.trustBeneficiary) ?? false;
  const membershipVerified = narrative?.membershipVerified ?? false;

  const ancestorChain = narrative
    ? (Array.isArray(narrative.ancestorChain) ? narrative.ancestorChain as string[] : [])
    : lineageRows.filter((l) => l.isDeceased).map((l) => l.fullName);

  const narrativeTags = narrative ? (Array.isArray(narrative.identityTags) ? narrative.identityTags as string[] : []) : [];
  const welfareTags = (profile?.welfareTags as string[]) ?? [];
  const allTags = [...new Set([...narrativeTags, ...welfareTags])];

  const lineageParts: string[] = [];
  if (lineageRows.length > 0) lineageParts.push(`${lineageRows.length} lineage record(s) documented.`);
  if (tribalNations.length > 0) lineageParts.push(`Tribal: ${tribalNations.join(", ")}.`);
  if (icwaEligible) lineageParts.push("ICWA eligible.");
  if (trustInheritance) lineageParts.push("Trust beneficiary.");

  const protectionLevel = narrative?.protectionLevel as "standard" | "elevated" | "critical" ?? "standard";
  const benefitEligibility: BenefitEligibility = {
    ...DEFAULT_BENEFIT_ELIGIBILITY,
    ...((narrative?.benefitEligibility as Partial<BenefitEligibility>) ?? {}),
    icwa: icwaEligible,
    tribalWelfare: welfareEligible,
    trustBeneficiary: trustInheritance,
    membershipBenefits: membershipVerified,
    ancestralLandRights: icwaEligible && trustInheritance,
  };

  return {
    userId: dbId,
    email: user.email,
    name: user.name,
    role: user.role,
    legalName,
    preferredName,
    tribalName,
    nickname,
    title,
    familyGroup: familyGroup || narrative?.familyGroup || "",
    displayName,
    courtCaption,
    jurisdictionTags: (profile?.jurisdictionTags as string[]) ?? [],
    welfareTags: (profile?.welfareTags as string[]) ?? [],
    notificationPreferences,
    lineageSummary: lineageParts.join(" ") || "No lineage on record.",
    ancestorChain,
    identityTags: allTags,
    generationalPosition: narrative?.generationalPosition ?? 0,
    generationalDepth: narrative?.generationalDepth ?? 0,
    protectionLevel,
    benefitEligibility,
    icwaEligible,
    welfareEligible,
    trustInheritance,
    membershipVerified,
  };
}

export function buildIdentityFromToken(tokenUser: { id: string | number; email: string; name: string; roles: string[] }): UnifiedIdentity {
  const name = tokenUser.name ?? tokenUser.email;
  return {
    userId: Number(tokenUser.id) || 0,
    email: tokenUser.email,
    name,
    role: tokenUser.roles?.[0] ?? "member",
    legalName: name,
    preferredName: name,
    tribalName: "",
    nickname: "",
    title: "",
    familyGroup: "",
    displayName: name,
    courtCaption: name,
    jurisdictionTags: [],
    welfareTags: [],
    notificationPreferences: DEFAULT_NOTIFICATION_PREFS,
    lineageSummary: "No lineage on record.",
    ancestorChain: [],
    identityTags: [],
    generationalPosition: 0,
    generationalDepth: 0,
    protectionLevel: "standard",
    benefitEligibility: DEFAULT_BENEFIT_ELIGIBILITY,
    icwaEligible: false,
    welfareEligible: false,
    trustInheritance: false,
    membershipVerified: false,
  };
}
