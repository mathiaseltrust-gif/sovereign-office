import { db } from "@workspace/db";
import { usersTable, profilesTable } from "@workspace/db";
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
    familyGroup,
    displayName,
    courtCaption,
    jurisdictionTags: (profile?.jurisdictionTags as string[]) ?? [],
    welfareTags: (profile?.welfareTags as string[]) ?? [],
    notificationPreferences,
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
  };
}
