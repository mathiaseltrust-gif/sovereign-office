export type Role = "chief_justice" | "admin" | "trustee" | "officer" | "elder" | "member" | "guest";

export const ROLE_HIERARCHY: Record<Role, number> = {
  chief_justice: 110,
  admin: 100,
  trustee: 80,
  officer: 60,
  elder: 55,
  member: 40,
  guest: 10,
};

export function canReviewPendingLineage(userRoles: string[]): boolean {
  return hasRole(userRoles, "officer") || userRoles.includes("elder");
}

export function hasRole(userRoles: string[], requiredRole: Role): boolean {
  const requiredLevel = ROLE_HIERARCHY[requiredRole] ?? 0;
  return userRoles.some((r) => {
    const level = ROLE_HIERARCHY[r as Role] ?? 0;
    return level >= requiredLevel;
  });
}

export function isAdmin(userRoles: string[]): boolean {
  return hasRole(userRoles, "admin");
}

export function isTrustee(userRoles: string[]): boolean {
  return hasRole(userRoles, "trustee");
}

export function isOfficer(userRoles: string[]): boolean {
  return hasRole(userRoles, "officer");
}

export function canManageTrust(userRoles: string[]): boolean {
  return isAdmin(userRoles) || isTrustee(userRoles);
}

export function canClassify(userRoles: string[]): boolean {
  return isOfficer(userRoles);
}

export function canViewComplaints(userRoles: string[]): boolean {
  return isOfficer(userRoles);
}
