import type { Request, Response, NextFunction } from "express";
import { logger } from "../lib/logger";

declare global {
  namespace Express {
    interface Request {
      isServiceAccount?: boolean;
    }
  }
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

  if (apiKeyHeader !== serviceKey) {
    logger.warn({ ip: req.ip, path: req.path }, "Invalid M365 service key attempt");
    next();
    return;
  }

  req.user = {
    id: "m365-service-account",
    email: "power-automate@m365.service",
    roles: ["officer"],
    name: "Microsoft 365 Power Automate",
    dbId: undefined,
  };
  req.isServiceAccount = true;
  logger.debug({ path: req.path }, "M365 service account authenticated via API key");
  next();
}

export function requireServiceKeyOrAuth(req: Request, res: Response, next: NextFunction): void {
  if (req.isServiceAccount || req.user) {
    next();
    return;
  }
  res.status(401).json({
    error: "Authentication required. Provide a Bearer session token or X-Api-Key service key.",
  });
}
