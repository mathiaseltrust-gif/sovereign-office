const LS_KEY = "sovereign_auth_v3";

// Matches the StoredSession shape written by the Sovereign Dashboard auth-provider:
//   { user: { id, email, name, roles }, mode, activeRole, sessionToken?, tokenExpiry?, lineagePending? }
interface StoredSession {
  user?: {
    id?: number | string;
    email?: string;
    name?: string;
    roles?: string[];
  };
  sessionToken?: string;
  mode?: string;
}

export interface AuthUser {
  id: number | string;
  name: string;
  email: string;
  roles: string[];
}

export interface AuthState {
  token: string;
  user: AuthUser;
}

// Build a base64-encoded dev token that the API's parseDevToken() can accept
function buildDevToken(user: AuthUser): string {
  return btoa(JSON.stringify({
    id: user.id,
    email: user.email,
    name: user.name,
    roles: user.roles,
  }));
}

export function getAuthState(): AuthState | null {
  // 1. Prefer real Sovereign session (password / Microsoft login)
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as StoredSession;
      if (parsed.user?.email) {
        const user: AuthUser = {
          id: parsed.user.id ?? parsed.user.email,
          email: parsed.user.email,
          name: parsed.user.name ?? parsed.user.email,
          roles: Array.isArray(parsed.user.roles) ? parsed.user.roles : ["member"],
        };
        // Use real JWT if present (password/Microsoft), else synthesize dev token
        const token = parsed.sessionToken ?? buildDevToken(user);
        return { token, user };
      }
    }
  } catch {
    // fall through
  }

  // 2. Fallback: legacy sovereign_user key (older dev flows)
  try {
    const userRaw = localStorage.getItem("sovereign_user");
    if (userRaw) {
      const u = JSON.parse(userRaw) as Partial<AuthUser>;
      if (u.email) {
        const user: AuthUser = {
          id: u.id ?? u.email,
          email: u.email,
          name: u.name ?? u.email,
          roles: Array.isArray(u.roles) ? u.roles : ["member"],
        };
        return { token: buildDevToken(user), user };
      }
    }
  } catch {
    // fall through
  }

  return null;
}

export function getAuthHeaders(): HeadersInit {
  const auth = getAuthState();
  if (!auth) return {};
  return { Authorization: `Bearer ${auth.token}` };
}
