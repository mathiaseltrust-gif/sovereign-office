import { Router } from "express";
import { createHmac } from "crypto";
import { db } from "@workspace/db";
import { usersTable, familyLineageTable, profilesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "../../lib/logger";

const router = Router();

const SESSION_SECRET = () => process.env.SESSION_SECRET ?? "dev-secret-change-me";

export function signSessionJwt(payload: object): string {
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

router.post("/refresh", async (req, res) => {
  const authHeader = req.headers.authorization ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) {
    res.status(401).json({ error: "No token provided." });
    return;
  }

  const payload = verifySessionJwt(token);
  if (!payload || payload.type !== "session") {
    res.status(401).json({ error: "Invalid or expired session token." });
    return;
  }

  try {
    const userId = Number(payload.sub);
    if (!userId) {
      res.status(401).json({ error: "Invalid session." });
      return;
    }

    const [dbUser] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
    if (!dbUser) {
      res.status(401).json({ error: "User not found." });
      return;
    }

    const lineageNode = dbUser.entraId
      ? await db.select({ id: familyLineageTable.id, membershipStatus: familyLineageTable.membershipStatus })
          .from(familyLineageTable)
          .where(eq(familyLineageTable.entraObjectId, dbUser.entraId))
          .limit(1)
          .then(r => r[0] ?? null)
      : null;

    const lineagePending = lineageNode !== null && lineageNode.membershipStatus === "pending";

    const freshToken = signSessionJwt({
      sub: String(dbUser.id),
      email: dbUser.email,
      name: dbUser.name,
      role: dbUser.role,
      type: "session",
      lineagePending,
    });

    logger.info({ userId: dbUser.id }, "Session token refreshed");
    res.json({
      sessionToken: freshToken,
      user: { id: dbUser.id, email: dbUser.email, name: dbUser.name, role: dbUser.role },
      expiresAt: Math.floor(Date.now() / 1000) + 60 * 60 * 8,
    });
  } catch (err) {
    logger.error({ err }, "Session /refresh error");
    res.status(500).json({ error: "Failed to refresh session." });
  }
});

router.get("/me", async (req, res) => {
  const authHeader = req.headers.authorization ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) {
    res.status(401).json({ error: "No token provided." });
    return;
  }

  const payload = verifySessionJwt(token);
  if (!payload || payload.type !== "session") {
    res.status(401).json({ error: "Invalid or expired session token." });
    return;
  }

  try {
    const userId = Number(payload.sub);
    if (!userId) {
      res.status(401).json({ error: "Invalid session." });
      return;
    }

    const [dbUser] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
    if (!dbUser) {
      res.status(404).json({ error: "User not found." });
      return;
    }

    res.json({
      id: dbUser.id,
      email: dbUser.email,
      name: dbUser.name,
      role: dbUser.role,
      entraId: dbUser.entraId,
      trustPrivileges: dbUser.trustPrivileges,
    });
  } catch (err) {
    logger.error({ err }, "Session /me error");
    res.status(500).json({ error: "Failed to load user." });
  }
});

export default router;
