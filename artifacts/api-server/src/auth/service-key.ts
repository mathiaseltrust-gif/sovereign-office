import { timingSafeEqual } from "crypto";
import type { Request, Response, NextFunction } from "express";
import { logger } from "../lib/logger";

export type ServiceCapability =
  | "m365:intake:submit"
  | "m365:facts:extract"
  | "github:intake:preview";

export interface ServicePrincipal {
  id: "m365-service" | "github-intake-service";
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
  const apiKeyHeader = req.headers["x-api-key"] as string | undefined;
  if (!apiKeyHeader) {
    next();
    return;
  }

  const candidates: Array<{
    secret: string | undefined;
    principal: ServicePrincipal;
  }> = [
    {
      secret: process.env.M365_SERVICE_KEY,
      principal: {
        id: "m365-service",
        kind: "service",
        capabilities: ["m365:intake:submit", "m365:facts:extract"],
      },
    },
    {
      secret: process.env.GITHUB_INTAKE_SERVICE_KEY,
      principal: {
        id: "github-intake-service",
        kind: "service",
        capabilities: ["github:intake:preview"],
      },
    },
  ];

  const matched = candidates.find(({ secret }) =>
    !!secret && safeEqualSecret(apiKeyHeader, secret),
  );

  if (!matched) {
    logger.warn({ ip: req.ip, path: req.path }, "Invalid service credential attempt");
    next();
    return;
  }

  // A machine integration is deliberately NOT a human Office user and receives
  // no Office role. It gets only the capabilities explicitly listed here.
  req.servicePrincipal = matched.principal;
  req.isServiceAccount = true;

  logger.debug(
    { path: req.path, servicePrincipal: req.servicePrincipal.id },
    "Machine service principal authenticated",
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
