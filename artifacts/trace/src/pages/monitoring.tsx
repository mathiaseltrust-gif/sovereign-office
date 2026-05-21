import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Activity, ChevronRight, Loader2, AlertCircle, Clock, Flag } from "lucide-react";
import { api, TraceMatter, ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";
import { SessionExpiredBanner } from "@/App";

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

export default function MonitoringPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["trace-monitoring"],
    queryFn: () => api.getMatters({ status: "monitoring" }),
  });

  const is401 = (error as ApiError)?.status === 401;
  const matters = data?.matters ?? [];

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center gap-2 mb-1">
        <Activity className="h-5 w-5 text-primary" />
        <h1 className="text-xl font-semibold text-foreground">Long-Term Monitoring</h1>
      </div>
      <p className="text-sm text-muted-foreground mb-6">
        Matters in ongoing long-term monitoring status — under continued observation for procedural compliance.
      </p>

      {is401 ? (
        <SessionExpiredBanner />
      ) : isLoading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin mr-2" />
          Loading monitoring queue…
        </div>
      ) : error ? (
        <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 flex items-center gap-2 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          Failed to load monitoring matters.
        </div>
      ) : matters.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Activity className="mx-auto h-10 w-10 mb-3 opacity-30" />
          <p className="text-sm">No matters in long-term monitoring.</p>
          <p className="text-xs mt-1">
            Set a matter's status to "monitoring" to track it here.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {matters.map((m) => (
            <MonitoringCard key={m.id} matter={m} />
          ))}
        </div>
      )}
    </div>
  );
}

function MonitoringCard({ matter: m }: { matter: TraceMatter }) {
  const risk = RISK_LABELS[m.riskLevel] ?? { label: m.riskLevel, cls: "bg-gray-100 text-gray-600 border-gray-200" };
  const isOverdue = m.deadlineAt && new Date(m.deadlineAt) < new Date();

  return (
    <Link href={`/matters/${m.id}`}>
      <div className="bg-card border border-card-border rounded-lg p-4 cursor-pointer hover:bg-muted/20 transition-colors">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <h3 className="text-sm font-semibold text-foreground truncate">{m.title}</h3>
              {m.niacPathway && (
                <span className="inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded border border-purple-300 bg-purple-50 text-purple-700 font-medium shrink-0">
                  <Flag className="h-3 w-3" /> NIAC
                </span>
              )}
            </div>
            <div className="flex items-center gap-3 flex-wrap text-xs text-muted-foreground">
              <span>{MATTER_TYPE_LABELS[m.matterType] ?? m.matterType}</span>
              <span>·</span>
              <span>Created {new Date(m.createdAt).toLocaleDateString()}</span>
              {m.deadlineAt && (
                <>
                  <span>·</span>
                  <span className={cn("flex items-center gap-1", isOverdue && "text-red-600 font-medium")}>
                    <Clock className="h-3 w-3" />
                    {isOverdue ? "Overdue: " : "Deadline: "}
                    {new Date(m.deadlineAt).toLocaleDateString()}
                  </span>
                </>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className={cn("text-xs px-2 py-0.5 rounded border font-medium", risk.cls)}>{risk.label}</span>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </div>
        </div>
        <p className="text-xs text-muted-foreground mt-2 line-clamp-2">{m.description}</p>
      </div>
    </Link>
  );
}
