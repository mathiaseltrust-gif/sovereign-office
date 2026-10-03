import { timingSafeEqual } from "crypto";
import type { Request, Response, NextFunction } from "express";
import { logger } from "../lib/logger";

export type ServiceCapability =
  | "m365:intake:submit"
  | "m365:facts:extract";

export interface ServicePrincipal {
  id: "m365-service";
  kind: "service";
  capabilities: ServiceCapability[];
}

declare global {
  namespace Express {
    interface Request {
      isServiceAccount?: boolean;
      servicePrincipal?: ServicePrincipal;
    }
  }
}

function safeEqualSecret(provided: string, expected: string): boolean {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function hasServiceCapability(req: Request, capability: ServiceCapability): boolean {
  return req.servicePrincipal?.capabilities.includes(capability) ?? false;
}

export function serviceKeyMiddleware(req: Request, _res: Response, next: NextFunction): void {
  const serviceKey = process.env.M365_SERVICE_KEY;
  if (!serviceKey) {
    next();
    return;
  }

  const apiKeyHeader = req.headers["x-api-key"] as string | undefined;
  if (!apiKeyHeader) {
    next();
    return;
  }

  if (!safeEqualSecret(apiKeyHeader, serviceKey)) {
    logger.warn({ ip: req.ip, path: req.path }, "Invalid M365 service key attempt");
    next();
    return;
  }

  // A machine integration is deliberately NOT a human Office user and receives
  // no Office role. It gets only the capabilities explicitly listed here.
  req.servicePrincipal = {
    id: "m365-service",
    kind: "service",
    capabilities: ["m365:intake:submit", "m365:facts:extract"],
  };
  req.isServiceAccount = true;

  logger.debug(
    { path: req.path, servicePrincipal: req.servicePrincipal.id },
    "M365 service principal authenticated",
  );
  next();
}

export function requireServiceCapabilityOrAuth(capability: ServiceCapability) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (req.user || hasServiceCapability(req, capability)) {
      next();
      return;
    }
    res.status(401).json({
      error: "Authentication required for this operation.",
    });
  };
}

/**
 * Compatibility guard for older routes. New machine-access routes should use
 * requireServiceCapabilityOrAuth() with an explicit capability.
 */
export function requireServiceKeyOrAuth(req: Request, res: Response, next: NextFunction): void {
  if (req.user || req.servicePrincipal) {
    next();
    return;
  }
  res.status(401).json({
    error: "Authentication required. Provide a Bearer session token or authorized service credential.",
  });
}
