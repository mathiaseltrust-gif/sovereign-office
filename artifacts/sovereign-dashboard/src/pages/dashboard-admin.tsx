import { useListInstruments, useListFilings, useListNfrs, useListTasks, useListComplaints } from "@workspace/api-client-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth, getCurrentBearerToken } from "@/components/auth-provider";
import { AgentPanel } from "@/components/AgentPanel";

type AlertChannelStatus = "ok" | "failing" | "unknown" | "unconfigured";

interface ChannelInfo {
  channel: "slack" | "email";
  status: AlertChannelStatus;
  lastRun: string | null;
  lastRunConclusion: string | null;
  lastSuccessfulRun: string | null;
  workflowName: string | null;
  runUrl: string | null;
}

interface AlertChannelsResponse {
  channels: ChannelInfo[];
  checkedAt?: string;
  configuredAt?: null;
}

const STATUS_DOT: Record<AlertChannelStatus, string> = {
  ok: "bg-green-500",
  failing: "bg-red-500",
  unknown: "bg-amber-400",
  unconfigured: "bg-slate-300",
};

const STATUS_LABEL: Record<AlertChannelStatus, string> = {
  ok: "OK",
  failing: "Failing",
  unknown: "Unknown",
  unconfigured: "Not configured",
};

const CHANNEL_LABEL: Record<"slack" | "email", string> = {
  slack: "Slack",
  email: "Email",
};

function AlertChannelsCard() {
  const base = (import.meta.env.BASE_URL as string).replace(/\/$/, "");
  const apiBase = base.replace(/\/sovereign-dashboard$/, "");

  const { data, isLoading } = useQuery<AlertChannelsResponse>({
    queryKey: ["admin-alert-channels"],
    queryFn: async () => {
      const res = await fetch(`${apiBase}/api/admin/alert-channels`, {
        headers: { Authorization: `Bearer ${getCurrentBearerToken() ?? ""}` },
      });
      if (!res.ok) throw new Error("Failed to load alert channel status");
      return res.json() as Promise<AlertChannelsResponse>;
    },
    staleTime: 60_000,
    retry: 1,
  });

  const overallStatus: AlertChannelStatus = (() => {
    if (!data) return "unknown";
    const statuses = data.channels.map((c) => c.status);
    if (statuses.some((s) => s === "failing")) return "failing";
    if (statuses.every((s) => s === "ok")) return "ok";
    if (statuses.every((s) => s === "unconfigured")) return "unconfigured";
    return "unknown";
  })();

  const borderClass =
    overallStatus === "ok"
      ? "border-green-400"
      : overallStatus === "failing"
        ? "border-red-400"
        : "";

  return (
    <Card className={borderClass}>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-semibold uppercase tracking-widest">
          Alert Channels
        </CardTitle>
        {!isLoading && data && (
          <span className="text-xs text-muted-foreground">
            {data.checkedAt
              ? `Checked ${new Date(data.checkedAt).toLocaleString()}`
              : "GitHub not configured"}
          </span>
        )}
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>
        ) : !data ? (
          <p className="text-sm text-muted-foreground">Could not load channel status.</p>
        ) : (
          <div className="space-y-3">
            {data.channels.map((ch) => (
              <div key={ch.channel} className="flex items-center gap-3">
                <span
                  className={`inline-block h-2.5 w-2.5 rounded-full shrink-0 ${STATUS_DOT[ch.status]}`}
                  aria-label={STATUS_LABEL[ch.status]}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{CHANNEL_LABEL[ch.channel]}</span>
                    <Badge
                      variant="outline"
                      className={
                        ch.status === "ok"
                          ? "text-green-700 border-green-400 text-xs"
                          : ch.status === "failing"
                            ? "text-red-700 border-red-400 text-xs"
                            : ch.status === "unconfigured"
                              ? "text-slate-500 border-slate-300 text-xs"
                              : "text-amber-700 border-amber-400 text-xs"
                      }
                    >
                      {STATUS_LABEL[ch.status]}
                    </Badge>
                  </div>
                  {ch.workflowName && (
                    <p className="text-xs text-muted-foreground truncate mt-0.5">
                      {ch.workflowName}
                      {ch.status === "ok" && ch.lastRun && (
                        <> · Last success {new Date(ch.lastRun).toLocaleDateString()}</>
                      )}
                      {ch.status === "failing" && ch.lastSuccessfulRun && (
                        <> · Last success {new Date(ch.lastSuccessfulRun).toLocaleDateString()}</>
                      )}
                      {ch.status === "failing" && !ch.lastSuccessfulRun && ch.lastRun && (
                        <> · Last run {new Date(ch.lastRun).toLocaleDateString()} (failed)</>
                      )}
                      {ch.status === "unknown" && ch.lastRun && (
                        <> · Last run {new Date(ch.lastRun).toLocaleDateString()}</>
                      )}
                    </p>
                  )}
                  {ch.status === "unconfigured" && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Set GITHUB_TOKEN and GITHUB_REPO to enable monitoring.
                    </p>
                  )}
                </div>
                {ch.runUrl && (
                  <a
                    href={ch.runUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-primary hover:underline shrink-0"
                  >
                    View run →
                  </a>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface PendingLineageNode {
  id: number;
  fullName: string;
  lastName: string | null;
  sourceType: string;
  createdAt: string;
}

function PendingLineageReviews() {
  const { } = useAuth();
  const queryClient = useQueryClient();
  const [actionState, setActionState] = useState<Record<number, "loading" | "done" | "error">>({});

  const base = (import.meta.env.BASE_URL as string).replace(/\/$/, "");
  const apiBase = base.replace(/\/sovereign-dashboard$/, "");

  const { data: pendingNodes, isLoading } = useQuery<PendingLineageNode[]>({
    queryKey: ["lineage-pending-reviews"],
    queryFn: async () => {
      const res = await fetch(`${apiBase}/api/lineage/nodes/pending-reviews`, {
        headers: { Authorization: `Bearer ${getCurrentBearerToken() ?? ""}` },
      });
      if (!res.ok) return [];
      return res.json() as Promise<PendingLineageNode[]>;
    },
    staleTime: 30_000,
  });

  async function handleAction(nodeId: number, action: "verify" | "reject") {
    setActionState((s) => ({ ...s, [nodeId]: "loading" }));
    try {
      const res = await fetch(`${apiBase}/api/lineage/nodes/${nodeId}/${action}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getCurrentBearerToken() ?? ""}`,
        },
        body: JSON.stringify(action === "reject" ? { reason: "Could not verify lineage claim at this time." } : {}),
      });
      if (!res.ok) throw new Error("Request failed");
      setActionState((s) => ({ ...s, [nodeId]: "done" }));
      void queryClient.invalidateQueries({ queryKey: ["lineage-pending-reviews"] });
    } catch {
      setActionState((s) => ({ ...s, [nodeId]: "error" }));
    }
  }

  if (isLoading) return <Skeleton className="h-24 w-full" />;
  const items = (pendingNodes ?? []).filter((n) => actionState[n.id] !== "done");

  return (
    <Card className={items.length > 0 ? "border-amber-400" : ""}>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-sm font-semibold uppercase tracking-widest">
          Pending Lineage Reviews
          {items.length > 0 && (
            <Badge variant="outline" className="ml-2 text-amber-600 border-amber-400">{items.length}</Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">No pending lineage claims.</p>
        ) : (
          items.map((node) => (
            <div key={node.id} className="flex items-center justify-between py-2 border-b last:border-0 gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{node.fullName}</p>
                <p className="text-xs text-muted-foreground">
                  Claim #{node.id} · {new Date(node.createdAt).toLocaleDateString()}
                </p>
              </div>
              <div className="flex gap-2 shrink-0">
                <Button
                  size="sm"
                  variant="outline"
                  className="text-green-700 border-green-400 hover:bg-green-50"
                  disabled={actionState[node.id] === "loading"}
                  onClick={() => handleAction(node.id, "verify")}
                >
                  Approve
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="text-destructive border-destructive/40 hover:bg-destructive/5"
                  disabled={actionState[node.id] === "loading"}
                  onClick={() => handleAction(node.id, "reject")}
                >
                  Deny
                </Button>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}

const ADMIN_SECTIONS = [
  { href: "/law", label: "Law Library", description: "Federal Indian Law, Tribal Law, Case Doctrines" },
  { href: "/doctrine", label: "Doctrine Manager", description: "Manage controlling legal doctrines and canons" },
  { href: "/recorder-rules", label: "Recorder Rules", description: "Configure recorder-compliance validation rules" },
  { href: "/welfare-acts", label: "Welfare Acts", description: "Administer welfare act instruments and declarations" },
  { href: "/templates", label: "Templates", description: "Manage trust, court, and NFR document templates" },
  { href: "/role-delegation", label: "Role Delegation", description: "Grant and revoke role-based permissions" },
  { href: "/audit-logs", label: "Audit Logs", description: "System-wide audit trail and event log" },
  { href: "/admin/email-preview", label: "Email Preview", description: "Preview notification email templates before they are sent" },
  { href: "/admin", label: "System Configuration", description: "Entra ID integration, bootstrap, system settings" },
];

export default function AdminDashboard() {
  const { data: instruments, isLoading: loadingI } = useListInstruments();
  const { data: filings, isLoading: loadingF } = useListFilings();
  const { data: nfrs, isLoading: loadingN } = useListNfrs();
  const { data: tasks, isLoading: loadingT } = useListTasks();
  const { data: complaints } = useListComplaints();

  const openTasks = (tasks ?? []).filter((t) => t.status === "pending");
  const openComplaints = (complaints ?? []).filter((c) => c.status === "open");

  return (
    <div data-testid="page-admin-dashboard">
      <AgentPanel
        pendingTasks={openTasks.length}
        openComplaints={openComplaints.length}
        draftNfrs={(nfrs ?? []).filter(n => n.status === "draft").length}
        draftInstruments={(instruments ?? []).filter(i => i.status === "draft").length}
        pendingFilings={(filings ?? []).filter(f => f.filingStatus === "pending").length}
      />
      <div className="mb-8">
        <h1 className="text-3xl font-serif font-bold text-foreground">System Administration</h1>
        <p className="text-muted-foreground mt-1">Office of the Chief Justice and Trustee — sovereign admin configuration</p>
      </div>

      {loadingI || loadingF || loadingN || loadingT ? (
        <div className="grid grid-cols-4 gap-4 mb-8">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24" />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs uppercase tracking-widest text-muted-foreground">Instruments</CardTitle>
            </CardHeader>
            <CardContent><div className="text-3xl font-serif font-bold">{instruments?.length ?? 0}</div></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs uppercase tracking-widest text-muted-foreground">Filings</CardTitle>
            </CardHeader>
            <CardContent><div className="text-3xl font-serif font-bold">{filings?.length ?? 0}</div></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs uppercase tracking-widest text-muted-foreground">Open Tasks</CardTitle>
            </CardHeader>
            <CardContent><div className="text-3xl font-serif font-bold">{openTasks.length}</div></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs uppercase tracking-widest text-muted-foreground">Open Complaints</CardTitle>
            </CardHeader>
            <CardContent><div className="text-3xl font-serif font-bold">{openComplaints.length}</div></CardContent>
          </Card>
        </div>
      )}

      <div className="mb-6">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground mb-3">Administration Modules</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {ADMIN_SECTIONS.map((section) => (
            <Link key={section.href} href={section.href}>
              <Card className="cursor-pointer hover:border-primary transition-colors">
                <CardContent className="flex items-center gap-4 py-4">
                  <div>
                    <div className="font-semibold text-sm text-foreground">{section.label}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">{section.description}</div>
                  </div>
                  <span className="ml-auto text-muted-foreground text-lg">→</span>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>

      <div className="mb-6">
        <AlertChannelsCard />
      </div>

      <div className="mb-6">
        <PendingLineageReviews />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold uppercase tracking-widest">Recent NFR Activity</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {(nfrs ?? []).slice(0, 5).length === 0 ? (
            <p className="text-sm text-muted-foreground">No NFR documents.</p>
          ) : (nfrs ?? []).slice(0, 5).map((n) => (
            <div key={n.id} data-testid={`nfr-row-${n.id}`} className="flex items-center justify-between py-2 border-b last:border-0">
              <span className="text-sm">NFR #{n.id}</span>
              <Badge variant="outline">{n.status}</Badge>
            </div>
          ))}
          <Link href="/nfr" className="text-xs text-primary hover:underline block pt-1">View all NFRs</Link>
        </CardContent>
      </Card>
    </div>
  );
}
