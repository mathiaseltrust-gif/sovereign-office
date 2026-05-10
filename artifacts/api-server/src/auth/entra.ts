import type { Request, Response, NextFunction } from "express";
import { logger } from "../lib/logger";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { verifyEntraJwt, isRealJwt } from "./entra-jwt";

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

  if (isRealJwt(token)) {
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
