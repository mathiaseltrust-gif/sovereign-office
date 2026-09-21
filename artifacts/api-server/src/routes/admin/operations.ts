import { Router } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { requireAuth, requireAdmin, requireRegisteredUser } from "../../auth/entra-guard";

const router = Router();

type CheckStatus = "ok" | "error" | "unconfigured";

interface ServiceCheck {
  id: string;
  label: string;
  status: CheckStatus;
  httpStatus: number | null;
  latencyMs: number | null;
  detail: string;
}

interface IntegrationCheck {
  id: string;
  label: string;
  status: CheckStatus;
  detail: string;
}

const SERVICES = [
  { id: "sovereign", label: "Sovereign Dashboard", url: "http://sovereign/" },
  { id: "trust", label: "Trust Dashboard", url: "http://trust/" },
  { id: "community", label: "Community Dashboard", url: "http://community/" },
  { id: "atlas", label: "Urban Indian Continuity Atlas", url: "http://atlas/" },
  { id: "authority", label: "Authority Directory", url: "http://authority/" },
  { id: "trace", label: "TRACE", url: "http://trace/" },
] as const;

function configured(...names: string[]): boolean {
  return names.every((name) => Boolean(process.env[name]?.trim()));
}

async function checkDatabase(): Promise<IntegrationCheck> {
  try {
    await db.execute(sql`SELECT 1`);
    return { id: "database", label: "PostgreSQL Database", status: "ok", detail: "Connection accepted" };
  } catch {
    return { id: "database", label: "PostgreSQL Database", status: "error", detail: "Connection failed" };
  }
}

async function checkHttpService(service: (typeof SERVICES)[number]): Promise<ServiceCheck> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  const started = Date.now();

  try {
    const response = await fetch(service.url, {
      method: "GET",
      redirect: "manual",
      signal: controller.signal,
      headers: { "User-Agent": "Sovereign-Office-Operations/1.0" },
    });
    const latencyMs = Date.now() - started;
    const ok = response.status >= 200 && response.status < 400;
    return {
      id: service.id,
      label: service.label,
      status: ok ? "ok" : "error",
      httpStatus: response.status,
      latencyMs,
      detail: ok ? `HTTP ${response.status}` : `Unexpected HTTP ${response.status}`,
    };
  } catch {
    return {
      id: service.id,
      label: service.label,
      status: "error",
      httpStatus: null,
      latencyMs: Date.now() - started,
      detail: "Service did not respond within the internal network",
    };
  } finally {
    clearTimeout(timeout);
  }
}

function integrationChecks(): IntegrationCheck[] {
  const definitions = [
    {
      id: "entra",
      label: "Microsoft Entra ID",
      ok: configured("AZURE_ENTRA_TENANT_ID", "AZURE_ENTRA_CLIENT_ID", "AZURE_ENTRA_CLIENT_SECRET"),
      detail: "Tenant, client ID, and client secret",
    },
    {
      id: "azure-openai",
      label: "Azure OpenAI",
      ok: configured("AZURE_OPENAI_ENDPOINT", "AZURE_OPENAI_API_KEY", "AZURE_OPENAI_DEPLOYMENT"),
      detail: "Endpoint, API key, and deployment",
    },
    {
      id: "m365",
      label: "Microsoft 365 Service",
      ok: configured("M365_SERVICE_KEY"),
      detail: "M365 service key",
    },
    {
      id: "gramps",
      label: "GRAMPS Genealogy",
      ok: configured("GRAMPS_API_URL", "GRAMPS_USERNAME", "GRAMPS_PASSWORD"),
      detail: "GRAMPS endpoint and credentials",
    },
    {
      id: "internal-security",
      label: "Internal Service Security",
      ok: configured("SESSION_SECRET", "SERVICE_KEY"),
      detail: "Session and service keys",
    },
  ];

  return definitions.map((item) => ({
    id: item.id,
    label: item.label,
    status: item.ok ? "ok" : "unconfigured",
    detail: item.ok ? `${item.detail} configured` : `${item.detail} not fully configured`,
  }));
}

async function buildStatus() {
  const [database, services] = await Promise.all([
    checkDatabase(),
    Promise.all(SERVICES.map(checkHttpService)),
  ]);

  const integrations = [database, ...integrationChecks()];
  const serviceFailures = services.filter((service) => service.status !== "ok").length;
  const criticalFailures = integrations.filter((integration) => integration.status === "error").length;

  return {
    overall: serviceFailures === 0 && criticalFailures === 0 ? "ok" : "degraded",
    checkedAt: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
    environment: process.env.NODE_ENV ?? "unknown",
    services,
    integrations,
    operator: {
      mode: "read-only",
      safeCommands: ["system_check"],
      writeCommandsEnabled: false,
      note: "Operational write commands are intentionally disabled until audit logging and approval controls are enabled.",
    },
  };
}

router.get("/status", requireAuth, requireRegisteredUser, requireAdmin, async (_req, res) => {
  res.json(await buildStatus());
});

router.post("/check", requireAuth, requireRegisteredUser, requireAdmin, async (_req, res) => {
  res.json(await buildStatus());
});

export default router;
