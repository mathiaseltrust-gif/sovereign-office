import { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { setAuthTokenGetter, setUnauthorizedHandler, setRefreshHandler } from "@workspace/api-client-react";

export type Role = "trustee" | "officer" | "member" | "sovereign_admin" | "elder" | "medical_provider" | "visitor_media";

export interface User {
  id: number | string;
  email: string;
  roles: string[];
  name: string;
}

export type AuthMode = "dev" | "token" | "microsoft" | "password";

interface AuthContextType {
  user: User | null;
  activeRole: Role;
  mode: AuthMode | null;
  sessionToken: string | null;
  switchRole: (role: Role) => void;
  loginWithToken: (token: string) => boolean;
  loginWithSessionToken: (sessionToken: string, user: User) => void;
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

const LS_KEY = "sovereign_auth_v3";

function makeDevToken(user: User) {
  return btoa(JSON.stringify(user));
}

let _currentTokenGetter: (() => string) | null = null;

export function getCurrentBearerToken(): string | null {
  return _currentTokenGetter ? _currentTokenGetter() : null;
}

function roleFromStrings(roles: string[]): Role {
  const priority: Record<string, number> = {
    chief_justice: 110, admin: 100, sovereign_admin: 90,
    trustee: 80, officer: 70,
    elder: 50, medical_provider: 50,
    member: 30, visitor_media: 10, guest: 5,
  };
  const ROLE_MAP: Record<string, Role> = {
    chief_justice: "sovereign_admin",
    admin: "sovereign_admin",
    sovereign_admin: "sovereign_admin",
    trustee: "trustee",
    officer: "officer",
    elder: "elder",
    medical_provider: "medical_provider",
    member: "member",
    visitor_media: "visitor_media",
    guest: "visitor_media",
  };
  const best = roles.map((r) => ({ r, p: priority[r] ?? -1 })).sort((a, b) => b.p - a.p)[0];
  if (!best) return "member";
  return ROLE_MAP[best.r] ?? "member";
}

function parseJwtExpiry(token: string): number | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const payload = JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/"))) as { exp?: number };
    return typeof payload.exp === "number" ? payload.exp : null;
  } catch {
    return null;
  }
}

interface StoredSession {
  user: User;
  mode: AuthMode;
  activeRole: Role;
  sessionToken?: string;
  tokenExpiry?: number;
}

function loadSession(): StoredSession | null {
  try { const r = localStorage.getItem(LS_KEY); return r ? JSON.parse(r) : null; } catch { return null; }
}
function saveSession(s: StoredSession) { localStorage.setItem(LS_KEY, JSON.stringify(s)); }
function clearSession() { localStorage.removeItem(LS_KEY); }

const REFRESH_THRESHOLD_SECS = 10 * 60;
const POLL_INTERVAL_MS = 5 * 60 * 1000;

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const saved = loadSession();
  const [user, setUser] = useState<User | null>(saved?.user ?? null);
  const [mode, setMode] = useState<AuthMode | null>(saved?.mode ?? null);
  const [activeRole, setActiveRole] = useState<Role>(saved?.activeRole ?? "member");
  const [sessionToken, setSessionToken] = useState<string | null>(saved?.sessionToken ?? null);
  const [tokenExpiry, setTokenExpiry] = useState<number | null>(saved?.tokenExpiry ?? null);

  const sessionTokenRef = useRef<string | null>(saved?.sessionToken ?? null);
  const modeRef = useRef<AuthMode | null>(saved?.mode ?? null);
  const refreshPromiseRef = useRef<Promise<string | null> | null>(null);

  useEffect(() => {
    sessionTokenRef.current = sessionToken;
  }, [sessionToken]);

  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  const applyNewToken = useCallback((newToken: string, newUser: User) => {
    const expiry = parseJwtExpiry(newToken) ?? Math.floor(Date.now() / 1000) + 60 * 60 * 8;
    const role = roleFromStrings(newUser.roles);
    sessionTokenRef.current = newToken;
    setSessionToken(newToken);
    setTokenExpiry(expiry);
    setUser(newUser);
    setActiveRole(role);
    const currentMode = modeRef.current ?? "password";
    saveSession({ user: newUser, mode: currentMode, activeRole: role, sessionToken: newToken, tokenExpiry: expiry });
    const getter = () => newToken;
    _currentTokenGetter = getter;
    setAuthTokenGetter(getter);
  }, []);

  const silentRefresh = useCallback((): Promise<string | null> => {
    const token = sessionTokenRef.current;
    if (!token || modeRef.current === "dev" || modeRef.current === "token") {
      return Promise.resolve(null);
    }

    if (refreshPromiseRef.current) {
      return refreshPromiseRef.current;
    }

    const promise = (async (): Promise<string | null> => {
      try {
        const base = (import.meta.env.BASE_URL as string).replace(/\/$/, "");
        const apiBase = base.replace(/\/sovereign-dashboard$/, "");
        const res = await fetch(`${apiBase}/api/auth/refresh`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) return null;
        const data = await res.json() as { sessionToken: string; user: { id: number; email: string; name: string; role: string } };
        const newUser: User = {
          id: data.user.id,
          email: data.user.email,
          name: data.user.name,
          roles: [data.user.role],
        };
        applyNewToken(data.sessionToken, newUser);
        return data.sessionToken;
      } catch {
        return null;
      } finally {
        refreshPromiseRef.current = null;
      }
    })();

    refreshPromiseRef.current = promise;
    return promise;
  }, [applyNewToken]);

  const shouldRefresh = useCallback((expiry: number | null): boolean => {
    if (!expiry) return false;
    const now = Math.floor(Date.now() / 1000);
    return expiry - now < REFRESH_THRESHOLD_SECS;
  }, []);

  useEffect(() => {
    if (user) {
      const token = sessionToken ?? makeDevToken(user);
      const getter = () => token;
      _currentTokenGetter = getter;
      setAuthTokenGetter(getter);
    } else {
      _currentTokenGetter = null;
      setAuthTokenGetter(null);
    }
  }, [user, sessionToken]);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      clearSession();
      const base = (import.meta.env.BASE_URL as string).replace(/\/$/, "");
      const currentPath = window.location.pathname + window.location.search;
      const appPath = base ? currentPath.replace(new RegExp(`^${base}`), "") : currentPath;
      const next = appPath && appPath !== "/" ? `&next=${encodeURIComponent(appPath)}` : "";
      window.location.assign(`${base}/login?expired=1${next}`);
    });
    return () => setUnauthorizedHandler(null);
  }, []);

  useEffect(() => {
    setRefreshHandler(async () => {
      return silentRefresh();
    });
    return () => setRefreshHandler(null);
  }, [silentRefresh]);

  useEffect(() => {
    const handleFocus = () => {
      if (shouldRefresh(tokenExpiry) && sessionTokenRef.current && modeRef.current !== "dev" && modeRef.current !== "token") {
        void silentRefresh();
      }
    };
    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, [silentRefresh, shouldRefresh, tokenExpiry]);

  useEffect(() => {
    if (!sessionToken || mode === "dev" || mode === "token") return;
    const interval = setInterval(() => {
      if (shouldRefresh(tokenExpiry)) {
        void silentRefresh();
      }
    }, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [sessionToken, mode, tokenExpiry, silentRefresh, shouldRefresh]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const st = params.get("session_token");
    const authError = params.get("auth_error");

    if (st) {
      let redirectNext: string | null = null;
      try {
        const parts = st.split(".");
        if (parts.length === 3) {
          const payload = JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/"))) as {
            sub?: string; email?: string; name?: string; role?: string; exp?: number;
          };
          if (payload.email) {
            const u: User = {
              id: payload.sub ?? payload.email,
              email: payload.email,
              name: payload.name ?? payload.email,
              roles: [payload.role ?? "member"],
            };
            const role = roleFromStrings(u.roles);
            const expiry = typeof payload.exp === "number" ? payload.exp : null;
            setUser(u);
            setMode("microsoft");
            setActiveRole(role);
            setSessionToken(st);
            setTokenExpiry(expiry);
            saveSession({ user: u, mode: "microsoft", activeRole: role, sessionToken: st, tokenExpiry: expiry ?? undefined });
            redirectNext = sessionStorage.getItem("oauth_next");
            sessionStorage.removeItem("oauth_next");
          }
        }
      } catch { /* ignore malformed token */ }
      const clean = new URL(window.location.href);
      clean.searchParams.delete("session_token");
      clean.searchParams.delete("auth_error");
      if (redirectNext && redirectNext.startsWith("/")) {
        const base = (import.meta.env.BASE_URL as string).replace(/\/$/, "");
        window.location.replace(base + redirectNext);
      } else {
        window.history.replaceState({}, "", clean.toString());
      }
    } else if (authError) {
      const clean = new URL(window.location.href);
      clean.searchParams.delete("auth_error");
      window.history.replaceState({}, "", clean.toString());
    }
  }, []);

  const loginWithSessionToken = useCallback((st: string, u: User) => {
    const role = roleFromStrings(u.roles);
    const expiry = parseJwtExpiry(st) ?? undefined;
    setUser(u);
    setMode("password");
    setActiveRole(role);
    setSessionToken(st);
    setTokenExpiry(expiry ?? null);
    saveSession({ user: u, mode: "password", activeRole: role, sessionToken: st, tokenExpiry: expiry });
  }, []);

  const loginWithToken = useCallback((rawToken: string): boolean => {
    try {
      const decoded = atob(rawToken.trim());
      const parsed = JSON.parse(decoded) as Partial<User>;
      if (!parsed.id || !parsed.email || !Array.isArray(parsed.roles)) return false;
      const u: User = { id: parsed.id, email: parsed.email, name: parsed.name ?? parsed.email, roles: parsed.roles };
      const role = roleFromStrings(u.roles);
      setUser(u); setMode("token"); setActiveRole(role); setSessionToken(null); setTokenExpiry(null);
      saveSession({ user: u, mode: "token", activeRole: role });
      return true;
    } catch { return false; }
  }, []);

  const loginWithDevRole = useCallback((role: Role) => {
    const u = DEV_USERS[role];
    setUser(u); setMode("dev"); setActiveRole(role); setSessionToken(null); setTokenExpiry(null);
    saveSession({ user: u, mode: "dev", activeRole: role });
  }, []);

  const logout = useCallback(() => {
    sessionTokenRef.current = null;
    modeRef.current = null;
    refreshPromiseRef.current = null;
    clearSession();
    setUser(null); setMode(null); setActiveRole("member"); setSessionToken(null); setTokenExpiry(null);
    setAuthTokenGetter(null);
  }, []);

  const switchRole = useCallback((role: Role) => {
    if (mode !== "dev") return;
    const u = DEV_USERS[role];
    setUser(u); setActiveRole(role);
    saveSession({ user: u, mode: "dev", activeRole: role });
  }, [mode]);

  return (
    <AuthContext.Provider value={{ user, activeRole, mode, sessionToken, switchRole, loginWithToken, loginWithSessionToken, loginWithDevRole, logout }}>
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
