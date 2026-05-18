export interface AuthUser {
  id: number;
  name: string;
  email: string;
  role: string;
}

export interface AuthState {
  token: string;
  user: AuthUser;
}

function buildDevToken(user: AuthUser): string {
  const payload = { sub: String(user.id), name: user.name, email: user.email, role: user.role };
  return "dev." + btoa(JSON.stringify(payload));
}

export function getAuthState(): AuthState | null {
  try {
    const raw = localStorage.getItem("sovereign_auth_v3");
    if (raw) {
      const parsed = JSON.parse(raw) as AuthState;
      if (parsed.token && parsed.user) return parsed;
    }
  } catch {
    // fall through
  }

  try {
    const userRaw = localStorage.getItem("sovereign_user");
    if (userRaw) {
      const user = JSON.parse(userRaw) as AuthUser;
      return { token: buildDevToken(user), user };
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
