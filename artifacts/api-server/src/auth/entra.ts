import type { Request, Response, NextFunction } from "express";
import { logger } from "../lib/logger";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { verifyEntraJwt, isRealJwt } from "./entra-jwt";
import { createHmac } from "crypto";

function verifySessionJwt(token: string): Record<string, unknown> | null {
  const secret = process.env.SESSION_SECRET ?? "dev-secret-change-me";
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const [header, body, sig] = parts;
    const expected = createHmac("sha256", secret).update(`${header}.${body}`).digest("base64url");
    if (sig !== expected) return null;
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as Record<string, unknown>;
    if (typeof payload.exp === "number" && payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

function isSessionJwt(token: string): boolean {
  if (!isRealJwt(token)) return false;
  try {
    const parts = token.split(".");
    const body = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8")) as Record<string, unknown>;
    return body.type === "session";
  } catch {
    return false;
  }
}

export interface EntraUser {
  id: string;
  email: string;
  roles: string[];
  name?: string;
  entraId?: string;
  dbId?: number;
}

function parseDevToken(token: string): { id: string; email: string; roles: string[]; name?: string; entraId?: string } | null {
  try {
    const payload = Buffer.from(token, "base64").toString("utf8");
    const parsed = JSON.parse(payload) as { id?: string; email?: string; roles?: string[]; name?: string; entraId?: string };
    if (!parsed.id || !parsed.email) return null;
    return {
      id: parsed.id,
      email: parsed.email,
      roles: Array.isArray(parsed.roles) ? parsed.roles : [],
      name: parsed.name,
      entraId: parsed.entraId,
    };
  } catch {
    return null;
  }
}

async function resolveDbUser(email: string): Promise<typeof usersTable.$inferSelect | null> {
  try {
    const rows = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);
    return rows[0] ?? null;
  } catch {
    return null;
  }
}

export async function entraMiddleware(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization ?? "";
  if (!authHeader) return next();

  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) return next();

  let parsed: { id: string; email: string; roles: string[]; name?: string; entraId?: string } | null = null;
  let authMethod = "none";

  if (isSessionJwt(token)) {
    const sessionPayload = verifySessionJwt(token);
    if (sessionPayload && sessionPayload.type === "session") {
      const dbUser = await resolveDbUser(sessionPayload.email as string);
      if (dbUser) {
        req.user = {
          id: String(dbUser.id),
          email: dbUser.email,
          roles: [dbUser.role],
          name: dbUser.name ?? (sessionPayload.name as string),
          entraId: dbUser.entraId ?? (sessionPayload.entraId as string | undefined),
          dbId: dbUser.id,
        };
      } else {
        req.user = {
          id: sessionPayload.sub as string,
          email: sessionPayload.email as string,
          roles: [sessionPayload.role as string ?? "member"],
          name: sessionPayload.name as string,
          entraId: sessionPayload.entraId as string | undefined,
        };
      }
      logger.debug({ email: sessionPayload.email }, "Session JWT authenticated");
      return next();
    } else {
      logger.warn("Session JWT present but verification failed");
      return next();
    }
  } else if (isRealJwt(token)) {
    const jwtPayload = await verifyEntraJwt(token);
    if (jwtPayload) {
      parsed = {
        id: jwtPayload.oid,
        email: jwtPayload.email ?? jwtPayload.preferred_username ?? jwtPayload.oid,
        roles: jwtPayload.roles ?? [],
        name: jwtPayload.name,
        entraId: jwtPayload.oid,
      };
      authMethod = "entra_jwt";
    } else {
      logger.warn("JWT token present but Entra verification failed — rejecting token");
      return next();
    }
  } else {
    parsed = parseDevToken(token);
    authMethod = "dev_token";
  }

  if (!parsed) {
    logger.warn("Could not parse auth token");
    return next();
  }

  const dbUser = await resolveDbUser(parsed.email);

  if (dbUser) {
    req.user = {
      id: String(dbUser.id),
      email: dbUser.email,
      roles: [dbUser.role],
      name: dbUser.name ?? parsed.name,
      entraId: dbUser.entraId ?? parsed.entraId,
      dbId: dbUser.id,
    };
    logger.debug({ userId: dbUser.id, role: dbUser.role, method: authMethod }, "DB-authoritative user resolved");
  } else {
    req.user = {
      id: parsed.id,
      email: parsed.email,
      roles: parsed.roles,
      name: parsed.name,
      entraId: parsed.entraId,
    };
    logger.debug({ email: parsed.email, method: authMethod }, "Token user not in DB — using token roles");
  }

  next();
}

export function buildTestToken(user: { id: string; email: string; roles: string[]; name?: string }): string {
  return Buffer.from(JSON.stringify(user)).toString("base64");
}
