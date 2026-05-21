import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Flag, ChevronRight, Loader2, AlertCircle } from "lucide-react";
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

const NIAC_REVIEW_TYPES = [
  "Informational",
  "Procedural",
  "Oversight",
  "Tribal-Court-Related",
  "NIAC-Political",
  "Document-Assistance",
  "Federal-Pathway",
  "Formal-Escalation",
];

const MATTER_TYPE_LABELS: Record<string, string> = {
  apa_review:         "APA Review",
  cfr_review:         "CFR Review",
  niac_review:        "NIAC Review",
  indigenous_rights:  "Indigenous Rights",
  oversight_trigger:  "Oversight Trigger",
  general:            "General",
};

export default function NiacPage() {
  const [statusFilter, setStatusFilter] = useState("");
  const [, navigate] = useLocation();

  const { data, isLoading, error } = useQuery({
    queryKey: ["trace-niac", statusFilter],
    queryFn: () =>
      api.getMatters({ niac: true, ...(statusFilter ? { status: statusFilter } : {}) }),
  });

  const is401 = (error as ApiError)?.status === 401;
  const matters = data?.matters ?? [];

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center gap-2 mb-1">
        <Flag className="h-5 w-5 text-purple-600" />
        <h1 className="text-xl font-semibold text-foreground">NIAC Review Queue</h1>
      </div>
      <p className="text-sm text-muted-foreground mb-4">
        Matters flagged for the National Indigenous American Committee (527 organization) Indigenous rights review pathway.
      </p>

      <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 mb-6">
        <p className="text-xs text-purple-800 font-medium mb-2">NIAC Review Type Classification</p>
        <div className="flex flex-wrap gap-1.5">
          {NIAC_REVIEW_TYPES.map((t) => (
            <span key={t} className="text-xs px-2 py-0.5 rounded border border-purple-200 bg-white text-purple-700">
              {t}
            </span>
          ))}
        </div>
      </div>

      {/* Status filter */}
      <div className="flex gap-1 overflow-x-auto pb-1 mb-4">
        {["", "pending", "analyzing", "reviewed", "escalated", "monitoring"].map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={cn(
              "whitespace-nowrap px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
              statusFilter === s
                ? "bg-purple-600 text-white"
                : "bg-muted text-muted-foreground hover:text-foreground"
            )}
          >
            {s === "" ? "All" : s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      {is401 ? (
        <SessionExpiredBanner />
      ) : isLoading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin mr-2" />
          Loading NIAC matters…
        </div>
      ) : error ? (
        <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 flex items-center gap-2 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          Failed to load NIAC matters.
        </div>
      ) : matters.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Flag className="mx-auto h-10 w-10 mb-3 opacity-30" />
          <p className="text-sm">No NIAC-flagged matters found.</p>
          <p className="text-xs mt-1">
            Flag a matter for NIAC review when creating or editing it.
          </p>
        </div>
      ) : (
        <div className="rounded-lg border border-card-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-purple-50 border-b border-border">
                  <th className="text-left px-3 py-2.5 font-semibold text-purple-900">Title</th>
                  <th className="text-left px-3 py-2.5 font-semibold text-purple-900">Matter Type</th>
                  <th className="text-left px-3 py-2.5 font-semibold text-purple-900">NIAC Type</th>
                  <th className="text-left px-3 py-2.5 font-semibold text-purple-900">Risk</th>
                  <th className="text-left px-3 py-2.5 font-semibold text-purple-900">Status</th>
                  <th className="text-left px-3 py-2.5 font-semibold text-purple-900">Deadline</th>
                  <th className="w-6"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {matters.map((m) => (
                  <NiacMatterRow
                    key={m.id}
                    matter={m}
                    onNavigate={() => navigate(`/matters/${m.id}`)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function NiacMatterRow({ matter: m, onNavigate }: { matter: TraceMatter; onNavigate: () => void }) {
  const risk = RISK_LABELS[m.riskLevel] ?? { label: m.riskLevel, cls: "bg-gray-100 text-gray-600 border-gray-200" };
  const status = STATUS_LABELS[m.status] ?? { label: m.status, cls: "bg-gray-100 text-gray-600 border-gray-200" };

  return (
    <tr
      className="cursor-pointer hover:bg-muted/40 transition-colors"
      onClick={onNavigate}
      tabIndex={0}
      role="button"
      onKeyDown={(e) => e.key === "Enter" && onNavigate()}
    >
      <td className="px-3 py-2.5 font-medium text-foreground max-w-[200px]">
        <div className="truncate">{m.title}</div>
      </td>
      <td className="px-3 py-2.5 text-muted-foreground whitespace-nowrap">
        {MATTER_TYPE_LABELS[m.matterType] ?? m.matterType}
      </td>
      <td className="px-3 py-2.5">
        {m.niacReviewType ? (
          <span className="text-xs px-1.5 py-0.5 rounded border border-purple-200 bg-purple-50 text-purple-700">
            {m.niacReviewType}
          </span>
        ) : (
          <span className="text-xs text-muted-foreground/50 italic">Unclassified</span>
        )}
      </td>
      <td className="px-3 py-2.5">
        <span className={cn("text-xs px-2 py-0.5 rounded border font-medium", risk.cls)}>{risk.label}</span>
      </td>
      <td className="px-3 py-2.5">
        <span className={cn("text-xs px-2 py-0.5 rounded border font-medium", status.cls)}>{status.label}</span>
      </td>
      <td className="px-3 py-2.5 text-muted-foreground">
        {m.deadlineAt ? new Date(m.deadlineAt).toLocaleDateString() : "—"}
      </td>
      <td className="px-3 py-2.5">
        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
      </td>
    </tr>
  );
}
