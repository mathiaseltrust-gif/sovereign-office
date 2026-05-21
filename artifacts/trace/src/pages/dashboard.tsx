import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import {
  LayoutDashboard, FilePlus2, AlertTriangle, Flag, Clock,
  ChevronRight, Loader2, AlertCircle, Shield,
} from "lucide-react";
import { api, TraceMatter, ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";
import { SessionExpiredBanner } from "@/App";

const STATUS_LABELS: Record<string, { label: string; cls: string }> = {
  pending:   { label: "Pending",   cls: "bg-gray-100 text-gray-700 border-gray-200" },
  analyzing: { label: "Analyzing", cls: "bg-blue-50 text-blue-700 border-blue-200" },
  reviewed:  { label: "Reviewed",  cls: "bg-green-50 text-green-700 border-green-200" },
  escalated: { label: "Escalated", cls: "bg-amber-50 text-amber-700 border-amber-200" },
  monitoring:{ label: "Monitoring",cls: "bg-purple-50 text-purple-700 border-purple-200" },
  closed:    { label: "Closed",    cls: "bg-slate-100 text-slate-500 border-slate-200" },
};

const RISK_LABELS: Record<string, { label: string; cls: string }> = {
  low:      { label: "Low",      cls: "bg-green-50 text-green-700 border-green-200" },
  medium:   { label: "Medium",   cls: "bg-yellow-50 text-yellow-700 border-yellow-200" },
  high:     { label: "High",     cls: "bg-orange-50 text-orange-700 border-orange-200" },
  critical: { label: "Critical", cls: "bg-red-50 text-red-700 border-red-200" },
};

const MATTER_TYPE_LABELS: Record<string, string> = {
  apa_review:         "APA Review",
  cfr_review:         "CFR Review",
  niac_review:        "NIAC Review",
  indigenous_rights:  "Indigenous Rights",
  oversight_trigger:  "Oversight Trigger",
  general:            "General",
};

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_LABELS[status] ?? { label: status, cls: "bg-gray-100 text-gray-600 border-gray-200" };
  return <span className={cn("text-xs px-2 py-0.5 rounded border font-medium", s.cls)}>{s.label}</span>;
}

function RiskBadge({ risk }: { risk: string }) {
  const r = RISK_LABELS[risk] ?? { label: risk, cls: "bg-gray-100 text-gray-600 border-gray-200" };
  return <span className={cn("text-xs px-2 py-0.5 rounded border font-medium", r.cls)}>{r.label}</span>;
}

function StatCard({ label, value, icon: Icon, cls }: { label: string; value: number; icon: React.ElementType; cls: string }) {
  return (
    <div className={cn("rounded-lg border p-4", cls)}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium opacity-70 mb-1">{label}</p>
          <p className="text-2xl font-bold">{value}</p>
        </div>
        <Icon className="h-5 w-5 opacity-50" />
      </div>
    </div>
  );
}

const FILTER_TABS = [
  { key: "",          label: "All" },
  { key: "pending",   label: "Pending" },
  { key: "analyzing", label: "Analyzing" },
  { key: "reviewed",  label: "Reviewed" },
  { key: "escalated", label: "Escalated" },
  { key: "monitoring",label: "Monitoring" },
  { key: "closed",    label: "Closed" },
];

export default function DashboardPage() {
  const [statusFilter, setStatusFilter] = useState("");
  const [, navigate] = useLocation();

  const { data, isLoading, error } = useQuery({
    queryKey: ["trace-matters", statusFilter],
    queryFn: () => api.getMatters(statusFilter ? { status: statusFilter } : undefined),
  });

  const is401 = (error as ApiError)?.status === 401;
  const matters = data?.matters ?? [];
  const stats = data?.stats ?? { total: 0, pendingAnalysis: 0, criticalRisk: 0, niacFlagged: 0 };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <LayoutDashboard className="h-5 w-5 text-primary" />
            <h1 className="text-xl font-semibold text-foreground">Matter Queue</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Active compliance matters under procedural review
          </p>
        </div>
        <button
          onClick={() => navigate("/matters/new")}
          className="inline-flex items-center gap-2 rounded-md bg-primary text-primary-foreground px-3 py-2 text-sm font-medium hover:opacity-90 transition-opacity"
        >
          <FilePlus2 className="h-4 w-4" />
          New Matter
        </button>
      </div>

      {/* Stats */}
      {!isLoading && !error && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          <StatCard label="Total Matters" value={stats.total} icon={Shield} cls="bg-card border-card-border text-foreground" />
          <StatCard label="Pending Analysis" value={stats.pendingAnalysis} icon={Clock} cls="bg-blue-50 border-blue-200 text-blue-800" />
          <StatCard label="Critical Risk" value={stats.criticalRisk} icon={AlertTriangle} cls="bg-red-50 border-red-200 text-red-800" />
          <StatCard label="NIAC Flagged" value={stats.niacFlagged} icon={Flag} cls="bg-purple-50 border-purple-200 text-purple-800" />
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex gap-1 overflow-x-auto pb-1 mb-4">
        {FILTER_TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setStatusFilter(tab.key)}
            className={cn(
              "whitespace-nowrap px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
              statusFilter === tab.key
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:text-foreground"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {is401 ? (
        <SessionExpiredBanner />
      ) : isLoading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin mr-2" />
          Loading matters…
        </div>
      ) : error ? (
        <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 flex items-center gap-2 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {(error as ApiError)?.status === 403
            ? "Access denied. You do not have TRACE portal access."
            : "Failed to load matters. " + (error as Error).message}
        </div>
      ) : matters.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Shield className="mx-auto h-10 w-10 mb-3 opacity-30" />
          <p className="text-sm">No matters found.</p>
          <p className="text-xs mt-1">
            <button
              onClick={() => navigate("/matters/new")}
              className="text-primary underline"
            >
              Create the first matter
            </button>
          </p>
        </div>
      ) : (
        <div className="rounded-lg border border-card-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-muted/60 border-b border-border">
                  <th className="text-left px-3 py-2.5 font-semibold text-foreground">Title</th>
                  <th className="text-left px-3 py-2.5 font-semibold text-foreground whitespace-nowrap">Matter Type</th>
                  <th className="text-left px-3 py-2.5 font-semibold text-foreground">Risk</th>
                  <th className="text-left px-3 py-2.5 font-semibold text-foreground">Status</th>
                  <th className="text-left px-3 py-2.5 font-semibold text-foreground">Deadline</th>
                  <th className="text-left px-3 py-2.5 font-semibold text-foreground">NIAC</th>
                  <th className="w-6"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {matters.map((m) => (
                  <MatterRow key={m.id} matter={m} onNavigate={() => navigate(`/matters/${m.id}`)} />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function MatterRow({ matter: m, onNavigate }: { matter: TraceMatter; onNavigate: () => void }) {
  return (
    <tr
      className="cursor-pointer hover:bg-muted/40 transition-colors"
      onClick={onNavigate}
      tabIndex={0}
      role="button"
      onKeyDown={(e) => e.key === "Enter" && onNavigate()}
    >
      <td className="px-3 py-2.5 font-medium text-foreground max-w-[240px]">
        <div className="truncate">{m.title}</div>
      </td>
      <td className="px-3 py-2.5 text-muted-foreground whitespace-nowrap">
        {MATTER_TYPE_LABELS[m.matterType] ?? m.matterType}
      </td>
      <td className="px-3 py-2.5">
        <RiskBadge risk={m.riskLevel} />
      </td>
      <td className="px-3 py-2.5">
        <StatusBadge status={m.status} />
      </td>
      <td className="px-3 py-2.5 text-muted-foreground whitespace-nowrap">
        {m.deadlineAt
          ? new Date(m.deadlineAt).toLocaleDateString()
          : <span className="opacity-40">—</span>}
      </td>
      <td className="px-3 py-2.5">
        {m.niacPathway && (
          <span className="inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded border border-purple-300 bg-purple-50 text-purple-700 font-medium">
            <Flag className="h-3 w-3" /> NIAC
          </span>
        )}
      </td>
      <td className="px-3 py-2.5">
        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
      </td>
    </tr>
  );
}
