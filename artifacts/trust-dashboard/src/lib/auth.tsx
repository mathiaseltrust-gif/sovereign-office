import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import { getAuthUser, setAuthSession, clearAuthSession } from "./api";

interface AuthUser {
  id: string;
  email: string;
  name: string;
  roles: string[];
}

interface AuthContextValue {
  user: AuthUser | null;
  login: (user: AuthUser) => void;
  logout: () => void;
  hasRole: (role: string) => boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const ROLE_HIERARCHY: Record<string, number> = {
  chief_justice: 5,
  sovereign_admin: 5,
  trustee: 4,
  officer: 3,
  medical_provider: 3,
  elder: 3,
  community_elder: 3,
  family_elder: 2,
  grandparent_elder: 2,
  adult_with_dependents: 2,
  niac_role: 2,
  charitable_trust_role: 2,
  iee_role: 2,
  adult: 1,
  minor: 1,
  member: 1,
  visitor_media: 0,
};

export const ELDER_ROLES = new Set([
  "elder",
  "community_elder",
  "family_elder",
  "grandparent_elder",
]);

export const IDENTITY_TAGS: Record<string, string> = {
  elder: "Elder",
  community_elder: "Community Elder",
  family_elder: "Family Elder",
  grandparent_elder: "Grandparent Elder",
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => getAuthUser());

  useEffect(() => {
    setUser(getAuthUser());
  }, []);

  function login(u: AuthUser) {
    setAuthSession(u);
    setUser(u);
  }

  function logout() {
    clearAuthSession();
    setUser(null);
  }

  function hasRole(role: string) {
    if (!user) return false;
    const userLevel = Math.max(0, ...user.roles.map((r) => ROLE_HIERARCHY[r] ?? 0));
    const required = ROLE_HIERARCHY[role] ?? 0;
    return userLevel >= required;
  }

  return (
    <AuthContext.Provider value={{ user, login, logout, hasRole }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
