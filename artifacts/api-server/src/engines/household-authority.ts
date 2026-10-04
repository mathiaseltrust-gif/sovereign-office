import { eq, and } from "drizzle-orm";
import { db, familyLineageTable, householdAuthorityTable } from "@workspace/db";

const ELEVATED = new Set(["trustee", "officer", "sovereign_admin", "admin", "chief_justice", "chief_justice_trustee"]);

export function hasHouseholdElevatedRole(roles: string[]) {
  return roles.some((role) => ELEVATED.has(role));
}

export async function getLinkedHouseholdHead(userId: number) {
  const [head] = await db
    .select()
    .from(familyLineageTable)
    .where(eq(familyLineageTable.linkedProfileUserId, userId))
    .limit(1);
  return head ?? null;
}

export async function canManageHouseholdPerson(input: {
  userId: number;
  roles: string[];
  lineageId: number;
}) {
  if (hasHouseholdElevatedRole(input.roles)) return true;

  const [node] = await db
    .select({
      id: familyLineageTable.id,
      linkedProfileUserId: familyLineageTable.linkedProfileUserId,
      addedByMemberId: familyLineageTable.addedByMemberId,
    })
    .from(familyLineageTable)
    .where(eq(familyLineageTable.id, input.lineageId))
    .limit(1);

  if (!node) return false;
  if (node.linkedProfileUserId === input.userId || node.addedByMemberId === input.userId) return true;

  const [scope] = await db
    .select({ id: householdAuthorityTable.id })
    .from(householdAuthorityTable)
    .where(and(
      eq(householdAuthorityTable.ownerUserId, input.userId),
      eq(householdAuthorityTable.memberLineageId, input.lineageId),
      eq(householdAuthorityTable.status, "active"),
    ))
    .limit(1);

  return !!scope;
}
