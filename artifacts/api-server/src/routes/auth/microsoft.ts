import { Router } from "express";
import { createHmac } from "crypto";
import { db } from "@workspace/db";
import { usersTable, familyLineageTable, profilesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "../../lib/logger";

const router = Router();

const TENANT_ID = () => process.env.AZURE_ENTRA_TENANT_ID ?? "";
const CLIENT_ID = () => process.env.AZURE_ENTRA_CLIENT_ID ?? "";
const CLIENT_SECRET = () => process.env.AZURE_ENTRA_CLIENT_SECRET ?? "";
const SESSION_SECRET = () => process.env.SESSION_SECRET ?? "dev-secret-change-me";

const SOVEREIGN_DASHBOARD_URL = () =>
  (process.env.SOVEREIGN_DASHBOARD_URL ?? "").replace(/\/+$/, "") ||
  "/sovereign-dashboard";

function redirectUri(): string {
  if (process.env.MICROSOFT_REDIRECT_URI) return process.env.MICROSOFT_REDIRECT_URI;
  return "http://localhost:5173/api/auth/microsoft/callback";
}

function signSessionJwt(payload: object): string {
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const body = Buffer.from(JSON.stringify({
    ...payload,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 60 * 60 * 8,
  })).toString("base64url");
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

// /login — standard confidential-client auth code flow (no PKCE needed when client_secret is present)
router.get("/login", (req, res) => {
  if (!TENANT_ID() || !CLIENT_ID()) {
    res.status(503).json({ error: "Microsoft authentication is not configured on this server." });
    return;
  }

  const params = new URLSearchParams({
    client_id: CLIENT_ID(),
    response_type: "code",
    redirect_uri: redirectUri(),
    response_mode: "query",
    scope: "openid profile email User.Read",
    prompt: "select_account",
  });

  const authUrl = `https://login.microsoftonline.com/${TENANT_ID()}/oauth2/v2.0/authorize?${params}`;
  logger.info({ redirect_uri: redirectUri() }, "Microsoft login initiated");
  res.json({ authUrl });
});

// /callback — exchange code for token using client_secret (no PKCE)
router.get("/callback", async (req, res) => {
  try {
    const { code, error, error_description } = req.query as Record<string, string>;

    if (error) {
      logger.warn({ error, error_description }, "Microsoft OAuth error returned");
      res.redirect(`${SOVEREIGN_DASHBOARD_URL()}/?auth_error=${encodeURIComponent(error_description ?? error)}`);
      return;
    }

    if (!code) {
      res.redirect(`${SOVEREIGN_DASHBOARD_URL()}/?auth_error=no_code`);
      return;
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
          redirect_uri: redirectUri(),
          grant_type: "authorization_code",
        }).toString(),
      }
    );

    if (!tokenRes.ok) {
      const errBody = await tokenRes.text();
      logger.error({ status: tokenRes.status, body: errBody }, "Token exchange failed");
      res.redirect(`${SOVEREIGN_DASHBOARD_URL()}/?auth_error=token_exchange_failed`);
      return;
    }

    const tokenData = await tokenRes.json() as { access_token: string; id_token: string; expires_in: number };

    const idTokenParts = tokenData.id_token?.split(".");
    if (!idTokenParts || idTokenParts.length < 2) {
      res.redirect(`${SOVEREIGN_DASHBOARD_URL()}/?auth_error=invalid_id_token`);
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

    const [lineageNode, profileRow] = await Promise.all([
      db
        .select({ id: familyLineageTable.id, membershipStatus: familyLineageTable.membershipStatus })
        .from(familyLineageTable)
        .where(eq(familyLineageTable.entraObjectId, entraId))
        .limit(1)
        .then(r => r[0] ?? null),
      db
        .select({ lineageVerified: profilesTable.lineageVerified })
        .from(profilesTable)
        .where(eq(profilesTable.userId, dbUser.id))
        .limit(1)
        .then(r => r[0] ?? null),
    ]);

    const lineageVerified = profileRow?.lineageVerified === true;
    const lineageLinked = lineageNode !== null;
    const lineagePending = lineageLinked && lineageNode.membershipStatus === "pending";
    const firstLogin = !lineageLinked && !lineageVerified;

    const sessionJwt = signSessionJwt({
      sub: String(dbUser.id),
      email: dbUser.email,
      name: dbUser.name,
      role: dbUser.role,
      entraId,
      type: "session",
      firstLogin,
      lineagePending,
    });

    const encoded = encodeURIComponent(sessionJwt);
    const dashboardUrl = SOVEREIGN_DASHBOARD_URL();
    logger.info({ email, dashboardUrl }, "Microsoft login successful — redirecting to dashboard");
    res.redirect(`${dashboardUrl}/?session_token=${encoded}`);
  } catch (err) {
    logger.error({ err }, "Microsoft OAuth callback error");
    res.redirect(`${SOVEREIGN_DASHBOARD_URL()}/?auth_error=server_error`);
  }
});

// /exchange — client-side callback: frontend posts {code, redirectUri} here
router.post("/exchange", async (req, res) => {
  try {
    const { code, redirectUri } = req.body as { code?: string; redirectUri?: string };

    if (!code) {
      res.status(400).json({ error: "code is required" });
      return;
    }

    const usedRedirectUri = redirectUri ?? redirectUri_();

    const tokenRes = await fetch(
      `https://login.microsoftonline.com/${TENANT_ID()}/oauth2/v2.0/token`,
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: CLIENT_ID(),
          client_secret: CLIENT_SECRET(),
          code,
          redirect_uri: usedRedirectUri,
          grant_type: "authorization_code",
        }).toString(),
      }
    );

    if (!tokenRes.ok) {
      const errBody = await tokenRes.text();
      logger.error({ status: tokenRes.status, body: errBody }, "Token exchange failed (exchange endpoint)");
      res.status(401).json({ error: "Token exchange with Microsoft failed. Check redirect URI and client secret." });
      return;
    }

    const tokenData = await tokenRes.json() as { access_token: string; id_token: string };

    const idTokenParts = tokenData.id_token?.split(".");
    if (!idTokenParts || idTokenParts.length < 2) {
      res.status(401).json({ error: "Invalid ID token from Microsoft." });
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
      logger.info({ email, entraId }, "New user auto-provisioned from Microsoft exchange");
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

    logger.info({ email }, "Microsoft exchange succeeded");
    res.json({
      sessionToken: sessionJwt,
      user: {
        id: dbUser.id,
        email: dbUser.email,
        name: dbUser.name,
        role: dbUser.role,
        roles: [dbUser.role],
      },
    });
  } catch (err) {
    logger.error({ err }, "Microsoft exchange error");
    res.status(500).json({ error: "Server error during token exchange." });
  }
});

function redirectUri_() { return redirectUri(); }

export default router;
