import { getSessionGovernor } from "./role-governor";

export interface AuthorityContext {
  userId: number;
  baseRoles: string[];
  sessionGovernorRoleKey: string | null;
  authorityKeys: string[];
}

const CHIEF_BASE_ROLES = new Set([
  "chief_justice",
  "chief_justice_trustee",
  "sovereign_admin",
]);

/**
 * Session governor posture is server-side state, but it still may not create
 * authority that the authenticated principal does not already possess.
 *
 * In particular, a trustee/Officer/member cannot become Chief merely because a
 * stale or manipulated governor selection exists. Chief governor authority is
 * accepted only when the authenticated base identity already carries an
 * explicit Chief/System role.
 */
export function deriveAuthorityKeys(
  baseRoles: string[],
  sessionGovernorRoleKey?: string | null,
): string[] {
  const keys = new Set(baseRoles);

  if (!sessionGovernorRoleKey) return [...keys];

  const governorKey = String(sessionGovernorRoleKey).trim().toLowerCase();
  if (!governorKey) return [...keys];

  if (governorKey === "chief_justice" || governorKey === "chief_justice_trustee") {
    if (baseRoles.some((role) => CHIEF_BASE_ROLES.has(role))) {
      keys.add(governorKey);
    }
    return [...keys];
  }

  // Lower-scope governors may describe posture for an already-authorized
  // principal, but they do not elevate the base identity hierarchy here.
  if (baseRoles.includes(governorKey)) {
    keys.add(governorKey);
  }

  return [...keys];
}

export async function resolveAuthorityContext(input: {
  userId: number;
  baseRoles: string[];
}): Promise<AuthorityContext> {
  const governor = await getSessionGovernor(input.userId).catch(() => null);
  const sessionGovernorRoleKey = governor?.roleKey ?? null;

  return {
    userId: input.userId,
    baseRoles: [...input.baseRoles],
    sessionGovernorRoleKey,
    authorityKeys: deriveAuthorityKeys(input.baseRoles, sessionGovernorRoleKey),
  };
}
