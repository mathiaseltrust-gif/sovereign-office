import type { Request, Response, NextFunction } from "express";
import { hasRole, type Role } from "../sovereign/authority";

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
