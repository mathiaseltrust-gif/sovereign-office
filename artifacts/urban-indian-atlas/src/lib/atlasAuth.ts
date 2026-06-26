function readJsonToken(key: string): string | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    return (
      parsed?.sessionToken ||
      parsed?.token ||
      parsed?.accessToken ||
      parsed?.authToken ||
      null
    );
  } catch {
    return null;
  }
}

export function getAtlasBearerToken(): string | null {
  return (
    readJsonToken("sovereign_auth_v3") ||
    localStorage.getItem("trust_auth_token") ||
    localStorage.getItem("community_auth_token") ||
    localStorage.getItem("sovereign_auth_token") ||
    localStorage.getItem("auth_token")
  );
}

export function authHeaders(): HeadersInit {
  const token = getAtlasBearerToken();

  return token
    ? {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      }
    : {
        "Content-Type": "application/json",
      };
}

export function isAtlasAuthenticated(): boolean {
  return Boolean(getAtlasBearerToken());
}
