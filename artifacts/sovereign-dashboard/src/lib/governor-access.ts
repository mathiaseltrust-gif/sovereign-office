import type { Role } from "../components/auth-provider";

export function canManageGovernors(role: Role | null | undefined): boolean {
  return role === "sovereign_admin";
}
