import type { Request, Response, NextFunction } from "express";
import { hasRole, type Role } from "../engines/authority";
import { db } from "@workspace/db";
import { usersTable, profilesTable } from "@workspace/db";
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

export function requireAnyRole(roles: Role[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: "Authentication required." });
      return;
    }
    if (!roles.some(r => hasRole(req.user!.roles, r))) {
      res.status(403).json({ error: `Insufficient privileges. Requires one of: ${roles.join(", ")}` });
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

export async function requireTraceAccess(req: Request, res: Response, next: NextFunction): Promise<void> {
  if (!req.user) {
    res.status(401).json({ error: "Authentication required." });
    return;
  }
  const sovereignRoles: Role[] = ["sovereign_admin", "admin", "officer", "chief_justice", "chief_justice_trustee"];
  if (sovereignRoles.some(r => hasRole(req.user!.roles, r))) {
    next();
    return;
  }
  if (!req.user.dbId) {
    res.status(403).json({ error: "Access denied. TRACE portal requires explicit access grant." });
    return;
  }
  try {
    const [profile] = await db
      .select({ traceAccess: profilesTable.traceAccess })
      .from(profilesTable)
      .where(eq(profilesTable.userId, req.user.dbId))
      .limit(1);
    if (profile?.traceAccess) {
      next();
      return;
    }
  } catch {
    // fall through to deny
  }
  res.status(403).json({ error: "Access denied. You do not have TRACE portal access." });
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
