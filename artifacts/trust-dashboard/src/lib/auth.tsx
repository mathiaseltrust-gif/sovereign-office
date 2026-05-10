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
  sovereign_admin: 4,
  trustee: 3,
  officer: 2,
  member: 1,
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
