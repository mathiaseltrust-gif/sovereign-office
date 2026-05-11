import { Router } from "express";
import { createHash, createHmac, randomBytes } from "crypto";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "../../lib/logger";

const router = Router();

const TENANT_ID = () => process.env.AZURE_ENTRA_TENANT_ID ?? "";
const CLIENT_ID = () => process.env.AZURE_ENTRA_CLIENT_ID ?? "";
const CLIENT_SECRET = () => process.env.AZURE_ENTRA_CLIENT_SECRET ?? "";
const SESSION_SECRET = () => process.env.SESSION_SECRET ?? "dev-secret-change-me";

// URL of the Sovereign Office Dashboard where users land after login.
// In Replit dev this is the path-based route (/sovereign-dashboard).
// In Docker/Azure set SOVEREIGN_DASHBOARD_URL to the full origin, e.g.:
//   https://sovereign.yourdomain.com
const SOVEREIGN_DASHBOARD_URL = () =>
  (process.env.SOVEREIGN_DASHBOARD_URL ?? "").replace(/\/+$/, "") ||
  "/sovereign-dashboard";

function redirectUri(req: import("express").Request): string {
  const host = req.headers["x-forwarded-host"] ?? req.headers.host ?? "localhost";
  const proto = req.headers["x-forwarded-proto"] ?? (req.secure ? "https" : "http");
  return `${proto}://${host}/api/auth/microsoft/callback`;
}

function signSessionJwt(payload: object): string {
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const body = Buffer.from(JSON.stringify({ ...payload, iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 60 * 60 * 8 })).toString("base64url");
  const sig = createHmac("sha256", SESSION_SECRET()).update(`${header}.${body}`).digest("base64url");
  return `${header}.${body}.${sig}`;
}

export function verifySessionJwt(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const [header, body, sig] = parts;
    const expected = createHmac("sha256", SESSION_SECRET()).update(`${header}.${body}`).digest("base64url");
    if (sig !== expected) return null;
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as Record<string, unknown>;
    if (typeof payload.exp === "number" && payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

router.get("/login", (req, res) => {
  if (!TENANT_ID() || !CLIENT_ID()) {
    res.status(503).json({ error: "Microsoft authentication is not configured on this server." });
    return;
  }
  const state = randomBytes(16).toString("hex");
  const codeVerifier = randomBytes(32).toString("base64url");
  const codeChallenge = createHash("sha256").update(codeVerifier).digest("base64url");

  const statePayload = signSessionJwt({ state, codeVerifier, type: "oauth_state" });

  const params = new URLSearchParams({
    client_id: CLIENT_ID(),
    response_type: "code",
    redirect_uri: redirectUri(req),
    response_mode: "query",
    scope: "openid profile email User.Read",
    state,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
  });

  const authUrl = `https://login.microsoftonline.com/${TENANT_ID()}/oauth2/v2.0/authorize?${params}`;

  res.json({ authUrl, stateCookie: statePayload });
});

router.get("/callback", async (req, res) => {
  try {
    const { code, state: returnedState, error, error_description } = req.query as Record<string, string>;

    if (error) {
      logger.warn({ error, error_description }, "Microsoft OAuth error");
      res.redirect(`${SOVEREIGN_DASHBOARD_URL()}/?auth_error=${encodeURIComponent(error_description ?? error)}`);
      return;
    }

    const stateCookie = req.headers["x-oauth-state"] as string | undefined
      ?? (req.query.state_cookie as string | undefined);

    const cookieHeader = req.headers.cookie ?? "";
    const cookieMatch = cookieHeader.match(/oauth_state=([^;]+)/);
    const rawStateCookie = cookieMatch ? decodeURIComponent(cookieMatch[1]) : stateCookie ?? "";

    let codeVerifier = "";
    if (rawStateCookie) {
      const statePayload = verifySessionJwt(rawStateCookie);
      if (statePayload?.state !== returnedState) {
        res.status(400).json({ error: "OAuth state mismatch — possible CSRF attack." });
        return;
      }
      codeVerifier = statePayload.codeVerifier as string;
    }

    const tokenRes = await fetch(
      `https://login.microsoftonline.com/${TENANT_ID()}/oauth2/v2.0/token`,
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: CLIENT_ID(),
          client_secret: CLIENT_SECRET(),
          code,
          redirect_uri: redirectUri(req),
          grant_type: "authorization_code",
          ...(codeVerifier ? { code_verifier: codeVerifier } : {}),
        }).toString(),
      }
    );

    if (!tokenRes.ok) {
      const errBody = await tokenRes.text();
      logger.error({ status: tokenRes.status, body: errBody }, "Token exchange failed");
      res.status(502).json({ error: "Token exchange with Microsoft failed." });
      return;
    }

    const tokenData = await tokenRes.json() as { access_token: string; id_token: string; expires_in: number };

    const idTokenParts = tokenData.id_token?.split(".");
    if (!idTokenParts || idTokenParts.length < 2) {
      res.status(502).json({ error: "Invalid ID token from Microsoft." });
      return;
    }
    const idPayload = JSON.parse(Buffer.from(idTokenParts[1], "base64url").toString("utf8")) as {
      oid: string; email?: string; preferred_username?: string; name?: string; roles?: string[];
    };

    const email = idPayload.email ?? idPayload.preferred_username ?? "";
    const name = idPayload.name ?? email;
    const entraId = idPayload.oid;

    let dbUser = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1).then(r => r[0] ?? null);

    if (!dbUser) {
      const [created] = await db.insert(usersTable).values({
        email, name, role: "member", entraId, entraRequired: true,
      }).returning();
      dbUser = created;
      logger.info({ email, entraId }, "New user auto-provisioned from Microsoft login");
    } else if (!dbUser.entraId) {
      await db.update(usersTable).set({ entraId, updatedAt: new Date() }).where(eq(usersTable.id, dbUser.id));
      dbUser = { ...dbUser, entraId };
    }

    const sessionJwt = signSessionJwt({
      sub: String(dbUser.id),
      email: dbUser.email,
      name: dbUser.name,
      role: dbUser.role,
      entraId,
      type: "session",
    });

    const encoded = encodeURIComponent(sessionJwt);
    res.redirect(`${SOVEREIGN_DASHBOARD_URL()}/?session_token=${encoded}`);
  } catch (err) {
    logger.error({ err }, "Microsoft OAuth callback error");
    res.redirect(`${SOVEREIGN_DASHBOARD_URL()}/?auth_error=server_error`);
  }
});

export default router;
