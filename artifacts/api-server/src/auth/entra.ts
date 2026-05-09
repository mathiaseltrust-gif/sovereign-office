import type { Request, Response, NextFunction } from "express";
import { logger } from "../lib/logger";

export interface EntraUser {
  id: string;
  email: string;
  roles: string[];
  entraId?: string;
}

function parseEntraToken(authHeader: string): EntraUser | null {
  try {
    const token = authHeader.replace(/^Bearer\s+/i, "").trim();
    const payload = Buffer.from(token, "base64").toString("utf8");
    const parsed = JSON.parse(payload) as Partial<EntraUser>;

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

export function entraMiddleware(req: Request, _res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization ?? "";

  if (authHeader) {
    const user = parseEntraToken(authHeader);
    if (user) {
      req.user = user;
      logger.debug({ userId: user.id, roles: user.roles }, "Entra user authenticated");
    } else {
      logger.warn("Invalid Entra token provided");
    }
  }

  next();
}

export function buildTestToken(user: EntraUser): string {
  return Buffer.from(JSON.stringify(user)).toString("base64");
}
