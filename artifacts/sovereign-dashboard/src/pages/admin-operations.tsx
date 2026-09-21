import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Redirect } from "wouter";
import {
  Activity,
  Bot,
  CheckCircle2,
  CircleHelp,
  Database,
  LockKeyhole,
  RefreshCw,
  Server,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getCurrentBearerToken, useIsTrustee } from "@/components/auth-provider";
import { useToast } from "@/hooks/use-toast";

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

interface OperationsStatus {
  overall: "ok" | "degraded";
  checkedAt: string;
  uptimeSeconds: number;
  environment: string;
  services: ServiceCheck[];
  integrations: IntegrationCheck[];
  operator: {
    mode: string;
    safeCommands: string[];
    writeCommandsEnabled: boolean;
    note: string;
  };
}

function StatusIcon({ status }: { status: CheckStatus }) {
  if (status === "ok") return <CheckCircle2 className="h-4 w-4 text-emerald-500" />;
  if (status === "error") return <XCircle className="h-4 w-4 text-destructive" />;
  return <CircleHelp className="h-4 w-4 text-amber-500" />;
}

function StatusPill({ status }: { status: CheckStatus | "degraded" }) {
  const className =
    status === "ok"
      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
      : status === "error" || status === "degraded"
        ? "border-destructive/30 bg-destructive/10 text-destructive"
        : "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400";

  return (
    <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${className}`}>
      {status}
    </span>
  );
}

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

export default function AdminOperationsPage() {
  const isTrustee = useIsTrustee();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [running, setRunning] = useState(false);

  const base = (import.meta.env.BASE_URL as string).replace(/\/$/, "");
  const apiBase = base.replace(/\/sovereign-dashboard$/, "");
  const queryKey = ["admin-operations-status"];

  const { data, isLoading, isError, refetch } = useQuery<OperationsStatus>({
    queryKey,
    queryFn: async () => {
      const res = await fetch(`${apiBase}/api/admin/operations/status`, {
        headers: { Authorization: `Bearer ${getCurrentBearerToken() ?? ""}` },
      });
      if (!res.ok) throw new Error("Could not load operations status");
      return res.json() as Promise<OperationsStatus>;
    },
    enabled: isTrustee,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  if (!isTrustee) {
    return <Redirect to="/dashboard" />;
  }

  const runSystemCheck = async () => {
    setRunning(true);
    try {
      const res = await fetch(`${apiBase}/api/admin/operations/check`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${getCurrentBearerToken() ?? ""}`,
          "Content-Type": "application/json",
        },
      });
      if (!res.ok) throw new Error("System check failed");
      const result = await res.json() as OperationsStatus;
      queryClient.setQueryData(queryKey, result);
      toast({
        title: result.overall === "ok" ? "System check passed" : "System check completed",
        description: result.overall === "ok"
          ? "All internal Office services responded successfully."
          : "One or more services require attention.",
      });
    } catch (error) {
      toast({
        title: "System check failed",
        description: error instanceof Error ? error.message : "Unable to run the system check.",
        variant: "destructive",
      });
    } finally {
      setRunning(false);
    }
  };

  const healthyServices = data?.services.filter((service) => service.status === "ok").length ?? 0;
  const configuredIntegrations = data?.integrations.filter((item) => item.status === "ok").length ?? 0;

  return (
    <div className="space-y-6" data-testid="page-office-operations">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Activity className="h-6 w-6 text-primary" />
            <h1 className="text-3xl font-serif font-bold">Sovereign Office Operations</h1>
          </div>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            Internal operational view for service health, core integrations, and controlled operator commands.
            This first phase is intentionally read-only.
          </p>
        </div>
        <Button onClick={runSystemCheck} disabled={running || isLoading} className="gap-2">
          <RefreshCw className={`h-4 w-4 ${running ? "animate-spin" : ""}`} />
          {running ? "Running checks…" : "Run system check"}
        </Button>
      </div>

      {isError && (
        <Card className="border-destructive/40">
          <CardContent className="flex items-center justify-between gap-4 pt-6">
            <div>
              <p className="font-medium text-destructive">Operations status could not be loaded.</p>
              <p className="text-sm text-muted-foreground">The API may be unavailable or the current account may not have operations access.</p>
            </div>
            <Button variant="outline" onClick={() => refetch()}>Retry</Button>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center justify-between text-sm font-medium">
              Overall
              <ShieldCheck className="h-4 w-4 text-muted-foreground" />
            </CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-between">
            <StatusPill status={data?.overall ?? "degraded"} />
            <span className="text-xs text-muted-foreground">{data?.environment ?? "checking"}</span>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center justify-between text-sm font-medium">
              Internal Services
              <Server className="h-4 w-4 text-muted-foreground" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{data ? `${healthyServices}/${data.services.length}` : "—"}</p>
            <p className="text-xs text-muted-foreground">responding normally</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center justify-between text-sm font-medium">
              Integrations
              <Database className="h-4 w-4 text-muted-foreground" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{data ? `${configuredIntegrations}/${data.integrations.length}` : "—"}</p>
            <p className="text-xs text-muted-foreground">configured and available</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center justify-between text-sm font-medium">
              API Uptime
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{data ? formatUptime(data.uptimeSeconds) : "—"}</p>
            <p className="text-xs text-muted-foreground">
              {data ? `checked ${new Date(data.checkedAt).toLocaleTimeString()}` : "waiting for status"}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Server className="h-4 w-4" />
              Office Services
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {isLoading && <p className="text-sm text-muted-foreground">Checking internal services…</p>}
            {data?.services.map((service) => (
              <div key={service.id} className="flex items-center justify-between gap-4 rounded-lg border p-3">
                <div className="flex min-w-0 items-center gap-3">
                  <StatusIcon status={service.status} />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{service.label}</p>
                    <p className="text-xs text-muted-foreground">
                      {service.detail}
                      {service.latencyMs !== null ? ` · ${service.latencyMs} ms` : ""}
                    </p>
                  </div>
                </div>
                <StatusPill status={service.status} />
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Bot className="h-4 w-4" />
              Core Integrations
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {isLoading && <p className="text-sm text-muted-foreground">Checking integration configuration…</p>}
            {data?.integrations.map((integration) => (
              <div key={integration.id} className="flex items-center justify-between gap-4 rounded-lg border p-3">
                <div className="flex min-w-0 items-center gap-3">
                  <StatusIcon status={integration.status} />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{integration.label}</p>
                    <p className="text-xs text-muted-foreground">{integration.detail}</p>
                  </div>
                </div>
                <StatusPill status={integration.status} />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card className="border-primary/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <LockKeyhole className="h-4 w-4" />
            Operator Control Boundary
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            The Office Operations interface currently permits inspection and the safe command
            <span className="font-mono text-foreground"> system_check</span>. Restart, deployment, configuration changes,
            and other write operations remain disabled until approval controls and an operations audit trail are enabled.
          </p>
          <div className="flex flex-wrap gap-2 text-xs">
            <span className="rounded border bg-muted px-2 py-1">Mode: {data?.operator.mode ?? "read-only"}</span>
            <span className="rounded border bg-muted px-2 py-1">
              Write commands: {data?.operator.writeCommandsEnabled ? "enabled" : "disabled"}
            </span>
          </div>
          {data?.operator.note && <p className="text-xs text-muted-foreground">{data.operator.note}</p>}
        </CardContent>
      </Card>
    </div>
  );
}
