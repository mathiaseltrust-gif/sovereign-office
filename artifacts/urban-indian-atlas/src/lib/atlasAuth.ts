const COMMUNITY_TOKEN_KEY = "community_auth_token";
const SOVEREIGN_LS_KEY = "sovereign_auth_v3";

/**
 * Reads an authentication token from localStorage — checks the Community
 * Dashboard key first, then the Sovereign Dashboard key. Returns null if no
 * valid token is found (user is not signed in to any dashboard in this browser
 * session).
 *
 * Atlas Mode ancestor data is user-scoped and requires authentication.  The
 * token is obtained by signing into the Community or Sovereign Dashboard
 * (same browser session) and is sent as a Bearer token on ancestor requests.
 */
export function getAtlasBearerToken(): string | null {
  try {
    const tok = localStorage.getItem(COMMUNITY_TOKEN_KEY);
    if (tok && tok.length > 10) return tok;
  } catch { /* ignore – SSR or sandboxed iframe */ }

  try {
    const raw = localStorage.getItem(SOVEREIGN_LS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as { token?: string; accessToken?: string };
      const tok = parsed.token ?? parsed.accessToken;
      if (tok && tok.length > 10) return tok;
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
