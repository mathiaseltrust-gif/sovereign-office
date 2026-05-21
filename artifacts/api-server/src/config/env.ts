import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.string().transform(Number),
  DATABASE_URL: z.string().url(),
  REDIS_CONNECTION_STRING: z.string(),
  SESSION_SECRET: z.string().min(16),
  SERVICE_KEY: z.string(),
  AZURE_ENTRA_TENANT_ID: z.string(),
  AZURE_ENTRA_CLIENT_ID: z.string(),
  AZURE_ENTRA_CLIENT_SECRET: z.string(),
  AZURE_OPENAI_ENDPOINT: z.string().url(),
  AZURE_OPENAI_API_KEY: z.string(),
  AZURE_OPENAI_DEPLOYMENT: z.string(),
  DEFAULT_OBJECT_STORAGE_BUCKET_ID: z.string(),
  PRIVATE_OBJECT_DIR: z.string(),
  PUBLIC_OBJECT_SEARCH_PATHS: z.string(),
  APP_URL: z.string().default("https://office.mathiaseltribe.org"),
  DASHBOARD_URL: z.string().optional(),
  SOVEREIGN_DASHBOARD_URL: z.string().optional(),
  MICROSOFT_REDIRECT_URI: z.string().optional(),
  GITHUB_TOKEN: z.string().optional(),
  GITHUB_REPO: z.string().optional(),
  AZURE_STORAGE_ACCOUNT: z.string().optional(),
  AZURE_BACKUP_CONTAINER: z.string().optional(),
  BACKUP_RETENTION_DAYS: z.coerce.number().default(30),
  BACKUP_SCRIPT: z.string().optional(),
  M365_SERVICE_KEY: z.string().optional(),
  RESEND_API_KEY: z.string().optional(),
  RESEND_FROM_EMAIL: z.string().email().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  LOG_LEVEL: z.enum(["trace", "debug", "info", "warn", "error"]).default("info"),
  REPLIT_DEV_DOMAIN: z.string().optional(),
  REPLIT_DOMAINS: z.string().optional(),
  REPLIT_DEPLOYMENT: z.string().optional(),
  REPL_IDENTITY: z.string().optional(),
  REPLIT_CONNECTORS_HOSTNAME: z.string().optional(),
  WEB_REPL_RENEWAL: z.string().optional(),
});

function parseEnv() {
  const result = schema.safeParse(process.env);
  if (!result.success) {
    const missing = result.error.issues
      .filter(i => i.code === "invalid_type" && i.received === "undefined")
      .map(i => i.path.join("."));
    const invalid = result.error.issues
      .filter(i => i.code !== "invalid_type" || i.received !== "undefined")
      .map(i => `${i.path.join(".")}: ${i.message}`);
    if (missing.length > 0) {
      console.error(`[config] Missing required environment variables:\n  ${missing.join("\n  ")}`);
    }
    if (invalid.length > 0) {
      console.error(`[config] Invalid environment variables:\n  ${invalid.join("\n  ")}`);
    }
    if (missing.length > 0) {
      throw new Error(`Server cannot start: missing required env vars: ${missing.join(", ")}`);
    }
  }
  return result.data!;
}

export const env = parseEnv();
export type Env = z.infer<typeof schema>;
