import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { setAuthTokenGetter } from "@workspace/api-client-react";

export type Role = "trustee" | "officer" | "member" | "sovereign_admin" | "elder" | "medical_provider" | "visitor_media";

export interface User {
  id: number | string;
  email: string;
  roles: string[];
  name: string;
}

export type AuthMode = "dev" | "token";

interface AuthContextType {
  user: User | null;
  activeRole: Role;
  mode: AuthMode | null;
  switchRole: (role: Role) => void;
  loginWithToken: (token: string) => boolean;
  loginWithDevRole: (role: Role) => void;
  logout: () => void;
}

const DEV_USERS: Record<Role, User> = {
  trustee: { id: 1, email: "cjt@sovereign.local", roles: ["trustee"], name: "Chief Justice & Trustee" },
  officer: { id: 2, email: "officer@sovereign.local", roles: ["officer"], name: "Duty Officer" },
  member: { id: 3, email: "member@sovereign.local", roles: ["member"], name: "Citizen Member" },
  sovereign_admin: { id: 4, email: "admin@sovereign.local", roles: ["sovereign_admin", "trustee"], name: "System Administrator" },
  elder: { id: 5, email: "elder@sovereign.local", roles: ["elder"], name: "Tribal Elder" },
  medical_provider: { id: 6, email: "provider@sovereign.local", roles: ["medical_provider"], name: "Medical Provider" },
  visitor_media: { id: 7, email: "visitor@sovereign.local", roles: ["visitor_media"], name: "Visitor / Media" },
};

const LS_KEY = "sovereign_auth_v2";

function makeToken(user: User) {
  return btoa(JSON.stringify(user));
}

let _currentTokenGetter: (() => string) | null = null;

export function getCurrentBearerToken(): string | null {
  return _currentTokenGetter ? _currentTokenGetter() : null;
}

function roleFromStrings(roles: string[]): Role {
  const priority: Record<string, number> = {
    chief_justice: 100, sovereign_admin: 90, trustee: 80, officer: 70,
    elder: 50, medical_provider: 50, member: 30, visitor_media: 0,
  };
  const best = roles.map((r) => ({ r, p: priority[r] ?? -1 })).sort((a, b) => b.p - a.p)[0];
  if (!best || best.p < 0) return "member";
  if (best.r === "chief_justice" || best.r === "sovereign_admin") return "sovereign_admin";
  const valid: Role[] = ["trustee", "officer", "member", "sovereign_admin", "elder", "medical_provider", "visitor_media"];
  if (valid.includes(best.r as Role)) return best.r as Role;
  return "member";
}

interface StoredSession { user: User; mode: AuthMode; activeRole: Role; }

function loadSession(): StoredSession | null {
  try { const r = localStorage.getItem(LS_KEY); return r ? JSON.parse(r) : null; } catch { return null; }
}
function saveSession(s: StoredSession) { localStorage.setItem(LS_KEY, JSON.stringify(s)); }
function clearSession() { localStorage.removeItem(LS_KEY); }

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const saved = loadSession();
  const [user, setUser] = useState<User | null>(saved?.user ?? null);
  const [mode, setMode] = useState<AuthMode | null>(saved?.mode ?? null);
  const [activeRole, setActiveRole] = useState<Role>(saved?.activeRole ?? "trustee");

  useEffect(() => {
    if (user) {
      const token = makeToken(user);
      const getter = () => token;
      _currentTokenGetter = getter;
      setAuthTokenGetter(getter);
    } else {
      _currentTokenGetter = null;
      setAuthTokenGetter(null);
    }
  }, [user]);

  const loginWithToken = useCallback((rawToken: string): boolean => {
    try {
      const decoded = atob(rawToken.trim());
      const parsed = JSON.parse(decoded) as Partial<User>;
      if (!parsed.id || !parsed.email || !Array.isArray(parsed.roles)) return false;
      const u: User = { id: parsed.id, email: parsed.email, name: parsed.name ?? parsed.email, roles: parsed.roles };
      const role = roleFromStrings(u.roles);
      setUser(u); setMode("token"); setActiveRole(role);
      saveSession({ user: u, mode: "token", activeRole: role });
      return true;
    } catch { return false; }
  }, []);

  const loginWithDevRole = useCallback((role: Role) => {
    const u = DEV_USERS[role];
    setUser(u); setMode("dev"); setActiveRole(role);
    saveSession({ user: u, mode: "dev", activeRole: role });
  }, []);

  const logout = useCallback(() => {
    clearSession();
    setUser(null); setMode(null); setActiveRole("trustee");
    setAuthTokenGetter(null);
  }, []);

  const switchRole = useCallback((role: Role) => {
    if (mode !== "dev") return;
    const u = DEV_USERS[role];
    setUser(u); setActiveRole(role);
    saveSession({ user: u, mode: "dev", activeRole: role });
  }, [mode]);

  return (
    <AuthContext.Provider value={{ user, activeRole, mode, switchRole, loginWithToken, loginWithDevRole, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

export function useIsAdmin() { const { activeRole } = useAuth(); return activeRole === "sovereign_admin"; }
export function useIsTrustee() { const { activeRole } = useAuth(); return activeRole === "trustee" || activeRole === "sovereign_admin"; }
export function useIsOfficer() { const { activeRole } = useAuth(); return ["officer", "trustee", "sovereign_admin"].includes(activeRole); }

export function roleLandingPath(role: Role): string {
  switch (role) {
    case "trustee": return "/dashboard/trustee";
    case "officer": return "/dashboard/officer";
    case "member": return "/dashboard/member";
    case "sovereign_admin": return "/dashboard/admin";
    case "elder": return "/dashboard/elder";
    case "medical_provider": return "/dashboard/medical-provider";
    case "visitor_media": return "/dashboard/visitor";
  }
}
