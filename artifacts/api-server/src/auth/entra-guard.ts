import type { Request, Response, NextFunction } from "express";
import { hasRole, type Role } from "../sovereign/authority";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ error: "Authentication required. Provide a valid Entra ID token." });
    return;
  }
  next();
}

export function requireRole(role: Role) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: "Authentication required." });
      return;
    }
    if (!hasRole(req.user.roles, role)) {
      res.status(403).json({ error: `Insufficient privileges. Required role: ${role}` });
      return;
    }
    next();
  };
}

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  requireRole("admin")(req, res, next);
}

export function requireTrustee(req: Request, res: Response, next: NextFunction): void {
  requireRole("trustee")(req, res, next);
}

export function requireOfficer(req: Request, res: Response, next: NextFunction): void {
  requireRole("officer")(req, res, next);
}

export function requireRegisteredUser(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ error: "Authentication required." });
    return;
  }
  if (!req.user.dbId) {
    res.status(403).json({
      error: "Access denied. Your identity is not registered in this system. Contact an administrator.",
    });
    return;
  }
  next();
}

export async function requireEntraIfRequired(req: Request, res: Response, next: NextFunction): Promise<void> {
  if (!req.user?.dbId) {
    next();
    return;
  }
  try {
    const [dbUser] = await db.select().from(usersTable).where(eq(usersTable.id, req.user.dbId)).limit(1);
    if (dbUser?.entraRequired && !req.headers.authorization) {
      res.status(401).json({ error: "Entra ID authentication is required for your account." });
      return;
    }
    next();
  } catch {
    next();
  }
}
