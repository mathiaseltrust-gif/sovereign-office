import { db } from "@workspace/db";
import { familyLineageTable, profilesTable } from "@workspace/db";
import { eq, or } from "drizzle-orm";

export interface AuthOnboardingState {
  firstLogin: boolean;
  lineagePending: boolean;
}

export async function resolveAuthOnboardingState(
  userId: number,
  entraId?: string | null,
): Promise<AuthOnboardingState> {
  const lineageWhere = entraId
    ? or(
        eq(familyLineageTable.linkedProfileUserId, userId),
        eq(familyLineageTable.entraObjectId, entraId),
      )
    : eq(familyLineageTable.linkedProfileUserId, userId);

  const [lineageNode, profileRow] = await Promise.all([
    db
      .select({
        id: familyLineageTable.id,
        membershipStatus: familyLineageTable.membershipStatus,
      })
      .from(familyLineageTable)
      .where(lineageWhere)
      .limit(1)
      .then((rows) => rows[0] ?? null),
    db
      .select({ lineageVerified: profilesTable.lineageVerified })
      .from(profilesTable)
      .where(eq(profilesTable.userId, userId))
      .limit(1)
      .then((rows) => rows[0] ?? null),
  ]);

  const lineageVerified = profileRow?.lineageVerified === true;
  const lineageLinked = lineageNode !== null;
  const lineagePending =
    lineageLinked && lineageNode.membershipStatus === "pending";

  return {
    firstLogin: !lineageLinked && !lineageVerified,
    lineagePending,
  };
}
