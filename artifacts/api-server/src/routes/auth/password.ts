import { Router } from "express";
import { createHash, createHmac, timingSafeEqual } from "crypto";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "../../lib/logger";

const router = Router();

const SESSION_SECRET = () => process.env.SESSION_SECRET ?? "dev-secret-change-me";

function hashPassword(password: string, salt: string): string {
  return createHash("sha256").update(`${salt}:${password}:${SESSION_SECRET()}`).digest("hex");
}

function verifyPassword(password: string, salt: string, storedHash: string): boolean {
  const computed = hashPassword(password, salt);
  try {
    return timingSafeEqual(Buffer.from(computed, "hex"), Buffer.from(storedHash, "hex"));
  } catch {
    return false;
  }
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

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body as { email?: string; password?: string };
    if (!email || !password) {
      res.status(400).json({ error: "Email and password are required." });
      return;
    }

    const [dbUser] = await db.select().from(usersTable).where(eq(usersTable.email, email.toLowerCase().trim())).limit(1);

    if (!dbUser) {
      res.status(401).json({ error: "Invalid email or password." });
      return;
    }

    if (!dbUser.passwordHash || !dbUser.passwordSalt) {
      res.status(401).json({
        error: "This account does not have a password set. Please sign in with Microsoft.",
        code: "NO_PASSWORD",
      });
      return;
    }

    const valid = verifyPassword(password, dbUser.passwordSalt, dbUser.passwordHash);
    if (!valid) {
      res.status(401).json({ error: "Invalid email or password." });
      return;
    }

    const sessionJwt = signSessionJwt({
      sub: String(dbUser.id),
      email: dbUser.email,
      name: dbUser.name,
      role: dbUser.role,
      type: "session",
    });

    logger.info({ userId: dbUser.id, email: dbUser.email }, "Password login successful");
    res.json({ sessionToken: sessionJwt, user: { id: dbUser.id, email: dbUser.email, name: dbUser.name, role: dbUser.role } });
  } catch (err) {
    logger.error({ err }, "Password login error");
    res.status(500).json({ error: "Login failed. Please try again." });
  }
});

router.post("/set-password", async (req, res) => {
  try {
    if (!req.user?.dbId) {
      res.status(401).json({ error: "Authentication required." });
      return;
    }
    const { password } = req.body as { password?: string };
    if (!password || password.length < 8) {
      res.status(400).json({ error: "Password must be at least 8 characters." });
      return;
    }

    const { randomBytes } = await import("crypto");
    const salt = randomBytes(16).toString("hex");
    const hash = hashPassword(password, salt);

    await db.update(usersTable).set({
      passwordHash: hash,
      passwordSalt: salt,
      updatedAt: new Date(),
    }).where(eq(usersTable.id, req.user.dbId));

    res.json({ success: true, message: "Password set successfully." });
  } catch (err) {
    logger.error({ err }, "Set password error");
    res.status(500).json({ error: "Failed to set password." });
  }
});

export default router;
