import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

const SOVEREIGN_LS_KEY = "sovereign_auth_v3";

function tryParseSsoToken(token: string): { id: string; email: string; name: string; roles: string[] } | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const payload = JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/"))) as {
      sub?: string; email?: string; name?: string; role?: string; exp?: number;
    };
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null;
    if (!payload.email) return null;
    return {
      id: payload.sub ?? "",
      email: payload.email,
      name: payload.name ?? payload.email,
      roles: payload.role ? [payload.role] : ["member"],
    };
  } catch { return null; }
}

export function getSovereignSession(): { id: string; email: string; name: string; roles: string[] } | null {
  // 1. URL sso_token
  const params = new URLSearchParams(window.location.search);
  const ssoToken = params.get("sso_token");
  if (ssoToken) {
    const user = tryParseSsoToken(ssoToken);
    if (user) {
      localStorage.setItem("community_auth_user", JSON.stringify(user));
      const url = new URL(window.location.href);
      url.searchParams.delete("sso_token");
      window.history.replaceState({}, "", url.toString());
      return user;
    }
  }
  // 2. Sovereign localStorage (same browser)
  try {
    const raw = localStorage.getItem(SOVEREIGN_LS_KEY);
    if (raw) {
      const s = JSON.parse(raw) as { user?: { id?: number | string; email?: string; name?: string; roles?: string[] } };
      if (s.user?.email) return { id: String(s.user.id ?? ""), email: s.user.email, name: s.user.name ?? s.user.email, roles: s.user.roles ?? ["member"] };
    }
  } catch { /* ignore */ }
  // 3. Local community session
  try {
    const raw = localStorage.getItem("community_auth_user");
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return null;
}
