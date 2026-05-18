const COMMUNITY_TOKEN_KEY = "community_auth_token";
const SOVEREIGN_LS_KEY = "sovereign_auth_v3";

/**
 * Reads an authentication token from localStorage — checks the Community
 * Dashboard key first, then the Sovereign Dashboard key.
 *
 * The Sovereign Dashboard stores its session as:
 *   { sessionToken, user: { id, email, name, ... }, mode, activeRole, ... }
 *
 * In dev/token mode sessionToken may be null; we fall back to the same
 * base64 dev-token the sovereign dashboard synthesises internally.
 *
 * Returns null only when no valid token can be found at all.
 */
export function getAtlasBearerToken(): string | null {
  // 1. Community dashboard token
  try {
    const tok = localStorage.getItem(COMMUNITY_TOKEN_KEY);
    if (tok && tok.length > 10) return tok;
  } catch { /* SSR / sandboxed iframe */ }

  // 2. Sovereign dashboard session
  try {
    const raw = localStorage.getItem(SOVEREIGN_LS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as {
        token?: string;
        accessToken?: string;
        sessionToken?: string | null;
        user?: { id?: number; email?: string; name?: string; roles?: string[]; role?: string };
      };

      // Prefer an explicit session token (any of the three field names used historically)
      const explicit = parsed.sessionToken ?? parsed.token ?? parsed.accessToken;
      if (explicit && explicit.length > 10) return explicit;

      // Dev / token mode: sessionToken is null but user object is present.
      // Synthesise the same base64 dev token the sovereign dashboard uses.
      if (parsed.user && (parsed.user.id !== undefined || parsed.user.email)) {
        const devPayload = btoa(JSON.stringify(parsed.user));
        if (devPayload.length > 10) return devPayload;
      }
    }
  } catch { /* ignore */ }

  return null;
}

export function isAtlasAuthenticated(): boolean {
  return getAtlasBearerToken() !== null;
}

export function authHeaders(): HeadersInit {
  const tok = getAtlasBearerToken();
  if (!tok) return {};
  return { Authorization: `Bearer ${tok}` };
}
