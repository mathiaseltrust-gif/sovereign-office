import { Router } from "express";
import { execFile, execFileSync } from "child_process";
import { promisify } from "util";
import { existsSync } from "fs";
import path from "path";
import { requireAuth, requireAdmin, requireRegisteredUser } from "../../auth/entra-guard";

const execFileAsync = promisify(execFile);
const router = Router();

/**
 * Resolve the backup script location.
 *
 * In a Docker container the repo's `scripts/` directory is NOT copied into
 * the runtime image, so we also honour an explicit BACKUP_SCRIPT env var that
 * operators can set to an absolute host path bind-mounted into the container.
 *
 * Resolution order:
 *   1. BACKUP_SCRIPT env var (explicit override)
 *   2. ../../scripts/backup.sh relative to CWD  (works when API runs on the
 *      host directly — e.g. `pnpm dev` from the repo root)
 */
function resolveScriptPath(): string | null {
  if (process.env.BACKUP_SCRIPT) {
    return process.env.BACKUP_SCRIPT;
  }
  const candidate = path.resolve(process.cwd(), "../../scripts/backup.sh");
  return existsSync(candidate) ? candidate : null;
}

function commandExists(cmd: string): boolean {
  try {
    execFileSync("which", [cmd], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

/**
 * POST /api/admin/backup
 *
 * Triggers a manual pg_dump and uploads the result to Azure Blob Storage.
 * Requires admin role.
 *
 * IMPORTANT — deployment boundary:
 *   This endpoint delegates to scripts/backup.sh on the host and therefore
 *   requires both `pg_dump` and `az` (Azure CLI) to be present in the same
 *   environment as the running Node process.
 *
 *   When the API is deployed as a Docker container (the normal production
 *   setup) the scripts/ directory and these binaries are NOT inside the image.
 *   In that case the endpoint returns HTTP 503 with a clear explanation.
 *
 *   To enable this endpoint inside a container you have two options:
 *     a) Bind-mount the script into the container and set the BACKUP_SCRIPT
 *        env var to its path inside the container, OR
 *     b) Rely on the host cron job (scripts/setup-backup-cron.sh) for all
 *        automated and manual backups — this is the recommended approach.
 *
 * Required environment variables (same as scripts/backup.sh):
 *   DATABASE_URL, AZURE_STORAGE_ACCOUNT, AZURE_STORAGE_KEY, AZURE_BACKUP_CONTAINER
 *
 * Optional:
 *   BACKUP_SCRIPT  — absolute path to the backup shell script
 */
router.post("/", requireAuth, requireRegisteredUser, requireAdmin, async (req, res, next) => {
  const scriptPath = resolveScriptPath();

  if (!scriptPath) {
    res.status(503).json({
      error:
        "Backup script not available in this environment. " +
        "When running inside a Docker container the scripts/ directory is not included in the image. " +
        "Use the host cron job (scripts/setup-backup-cron.sh) for automated backups, " +
        "or set the BACKUP_SCRIPT env var to the absolute path of a bind-mounted backup.sh.",
      hint: "See DEPLOY.md § 12 for full setup instructions.",
    });
    return;
  }

  const missingBinaries: string[] = [];
  if (!commandExists("pg_dump")) missingBinaries.push("pg_dump (install postgresql-client)");
  if (!commandExists("az")) missingBinaries.push("az (install azure-cli)");

  if (missingBinaries.length > 0) {
    res.status(503).json({
      error: "Required binaries are missing from this environment.",
      missing: missingBinaries,
      hint: "Run scripts/setup-backup-cron.sh on the host to install dependencies, or use the cron-based backup instead.",
    });
    return;
  }

  const requiredVars = [
    "DATABASE_URL",
    "AZURE_STORAGE_ACCOUNT",
    "AZURE_STORAGE_KEY",
    "AZURE_BACKUP_CONTAINER",
  ];

  const missingVars = requiredVars.filter((v) => !process.env[v]);
  if (missingVars.length > 0) {
    res.status(503).json({
      error: "Backup not configured — missing environment variables.",
      missing: missingVars,
    });
    return;
  }

  const triggeredBy = (req.user as { email?: string } | undefined)?.email ?? "unknown";
  const startedAt = new Date().toISOString();

  console.log(`[backup] manual backup triggered by ${triggeredBy} at ${startedAt}`);

  try {
    const { stdout, stderr } = await execFileAsync("bash", [scriptPath], {
      timeout: 10 * 60 * 1000,
      env: process.env,
    });

    res.json({
      success: true,
      triggeredBy,
      startedAt,
      completedAt: new Date().toISOString(),
      output: stdout || stderr,
    });
  } catch (err: unknown) {
    const execError = err as { stdout?: string; stderr?: string; message?: string };
    console.error("[backup] manual backup failed:", execError.stderr ?? execError.message);
    next(
      Object.assign(new Error("Backup script failed"), {
        status: 500,
        detail: execError.stderr ?? execError.message,
      }),
    );
  }
});

/**
 * GET /api/admin/backup/status
 *
 * Returns backup configuration and environment availability.
 * No secrets are exposed — only which variables are set.
 */
router.get("/status", requireAuth, requireRegisteredUser, requireAdmin, (_req, res) => {
  const vars = [
    "DATABASE_URL",
    "AZURE_STORAGE_ACCOUNT",
    "AZURE_STORAGE_KEY",
    "AZURE_BACKUP_CONTAINER",
  ];

  const configured = Object.fromEntries(vars.map((v) => [v, !!process.env[v]]));
  const allConfigured = Object.values(configured).every(Boolean);
  const scriptPath = resolveScriptPath();

  res.json({
    backupConfigured: allConfigured,
    scriptAvailable: scriptPath !== null,
    scriptPath: scriptPath ?? null,
    binariesAvailable: {
      pg_dump: commandExists("pg_dump"),
      az: commandExists("az"),
    },
    retentionDays: Number(process.env.BACKUP_RETENTION_DAYS ?? 30),
    container: process.env.AZURE_BACKUP_CONTAINER ?? null,
    storageAccount: process.env.AZURE_STORAGE_ACCOUNT ?? null,
    variables: configured,
    note:
      "The manual backup endpoint requires pg_dump, az, and scripts/backup.sh to be present " +
      "in the same environment as the API process. In a Docker container these are not available " +
      "by default. See DEPLOY.md § 12 for details.",
  });
});

export default router;
