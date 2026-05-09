import type { Request, Response, NextFunction } from "express";
import { logger } from "../lib/logger";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

export interface EntraUser {
  id: string;
  email: string;
  roles: string[];
  entraId?: string;
  dbId?: number;
}

function parseEntraToken(authHeader: string): { id: string; email: string; roles: string[]; entraId?: string } | null {
  try {
    const token = authHeader.replace(/^Bearer\s+/i, "").trim();
    const payload = Buffer.from(token, "base64").toString("utf8");
    const parsed = JSON.parse(payload) as { id?: string; email?: string; roles?: string[]; entraId?: string };

    if (!parsed.id || !parsed.email) return null;

    return {
      id: parsed.id,
      email: parsed.email,
      roles: Array.isArray(parsed.roles) ? parsed.roles : [],
      entraId: parsed.entraId,
    };
  } catch {
    return null;
  }
}

export async function entraMiddleware(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization ?? "";

  if (authHeader) {
    const parsed = parseEntraToken(authHeader);
    if (parsed) {
      try {
        const dbUsers = await db
          .select()
          .from(usersTable)
          .where(eq(usersTable.email, parsed.email))
          .limit(1);
        const dbUser = dbUsers[0];

        if (dbUser) {
          req.user = {
            id: String(dbUser.id),
            email: dbUser.email,
            roles: [dbUser.role],
            entraId: dbUser.entraId ?? parsed.entraId ?? undefined,
            dbId: dbUser.id,
          };
          logger.debug({ userId: dbUser.id, role: dbUser.role }, "DB-authoritative user resolved");
        } else {
          req.user = {
            id: parsed.id,
            email: parsed.email,
            roles: parsed.roles,
            entraId: parsed.entraId,
          };
          logger.debug({ email: parsed.email }, "Token user not in DB — using token roles");
        }
      } catch (err) {
        logger.warn({ err }, "DB lookup failed; falling back to token roles");
        req.user = {
          id: parsed.id,
          email: parsed.email,
          roles: parsed.roles,
          entraId: parsed.entraId,
        };
      }
    } else {
      logger.warn("Invalid Entra token provided");
    }
  }

  next();
}

export function buildTestToken(user: { id: string; email: string; roles: string[] }): string {
  return Buffer.from(JSON.stringify(user)).toString("base64");
}
