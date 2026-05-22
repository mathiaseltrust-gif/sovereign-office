/**
 * Environment Variable Validation
 *
 * Fails fast when critical production variables are missing and logs clear
 * warnings for optional services that can degrade safely.
 */

import { logger } from "./logger";

const REQUIRED_ENV_VARS = [
  "DATABASE_URL",
  "SESSION_SECRET",
  "SERVICE_KEY",
  "APP_URL",
  "SOVEREIGN_DASHBOARD_URL",
  "AZURE_ENTRA_TENANT_ID",
  "AZURE_ENTRA_CLIENT_ID",
  "AZURE_ENTRA_CLIENT_SECRET",
];

const OPTIONAL_ENV_VARS = [
  "REDIS_CONNECTION_STRING",
  "AZURE_OPENAI_ENDPOINT",
  "AZURE_OPENAI_API_KEY",
  "AZURE_OPENAI_DEPLOYMENT",
];

export function validateEnvironment(): void {
  const missingRequired = REQUIRED_ENV_VARS.filter((name) => !process.env[name]);

  if (missingRequired.length > 0) {
    const message =
      `Missing required environment variables: ${missingRequired.join(", ")}. ` +
      "See .env.example for required configuration.";
    logger.error({ missingRequired }, message);
    throw new Error(message);
  }

  const missingOptional = OPTIONAL_ENV_VARS.filter((name) => !process.env[name]);
  if (missingOptional.length > 0) {
    logger.warn(
      { missingOptional },
      "Optional environment variables are not set; related features may run in degraded mode",
    );
  }

  logger.info("Environment validation passed");
}
