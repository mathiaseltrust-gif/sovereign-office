import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { BookOpen, Search, AlertCircle, ShieldCheck, CheckCircle2 } from "lucide-react";
import { api, MatterRoutingRule, ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { SessionExpiredBanner } from "@/App";

export default function MattersPage() {
  const [search, setSearch] = useState("");
  const [filterTribal, setFilterTribal] = useState<"" | "yes" | "no">("");

  const { data, isLoading, error } = useQuery({
    queryKey: ["matters"],
    queryFn: () => api.getMatters(),
  });

  const rules = data?.rules ?? [];
  const is401 = (error as ApiError)?.status === 401;

  const filtered = useMemo(() => {
    return rules.filter((r) => {
      if (filterTribal === "yes" && !r.tribalLawApplicable) return false;
      if (filterTribal === "no" && r.tribalLawApplicable) return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          r.matterType.toLowerCase().includes(q) ||
          r.matterLabel.toLowerCase().includes(q) ||
          (r.primaryEntityType ?? "").toLowerCase().includes(q) ||
          (r.oversightEntityType ?? "").toLowerCase().includes(q) ||
          (r.requiredNoticeTemplate ?? "").toLowerCase().includes(q) ||
          (r.escalationPath ?? "").toLowerCase().includes(q) ||
          r.legalFlagGroup.some((f) => f.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [rules, search, filterTribal]);

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <BookOpen className="h-5 w-5 text-primary" />
          <h1 className="text-xl font-semibold text-foreground">Matter Type Reference</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          All configured matter types with primary entity, oversight routing, notice templates, legal flag group, and tribal law applicability.
        </p>
      </div>

      {/* Filters */}
      <div className="bg-card border border-card-border rounded-lg p-4 mb-5">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              type="search"
              placeholder="Search by matter code, label, entity type, template, flag group…"
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="shrink-0">
            <select
              className="w-full sm:w-52 text-sm rounded-md border border-input bg-background px-3 py-2 text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              value={filterTribal}
              onChange={(e) => setFilterTribal(e.target.value as "" | "yes" | "no")}
            >
              <option value="">All — Tribal Law</option>
              <option value="yes">Tribal Law Applies</option>
              <option value="no">No Tribal Law</option>
            </select>
          </div>
        </div>
      </div>

      {/* Stats */}
      {!isLoading && !error && (
        <p className="text-xs text-muted-foreground mb-3">
          {filtered.length} of {rules.length} matter type{rules.length !== 1 ? "s" : ""}
        </p>
      )}

      {/* Table */}
      {is401 ? (
        <SessionExpiredBanner />
      ) : isLoading ? (
        <div className="space-y-1">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-10 rounded bg-muted animate-pulse" />
          ))}
        </div>
      ) : error ? (
        <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 flex items-center gap-2 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          Failed to load matter types. {(error as Error).message}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <BookOpen className="mx-auto h-8 w-8 mb-2 opacity-40" />
          <p className="text-sm">No matter types match your filters.</p>
        </div>
      ) : (
        <div className="rounded-lg border border-card-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-muted/60 border-b border-border">
                  <th className="text-left px-3 py-2.5 font-semibold text-foreground whitespace-nowrap">Matter Type</th>
                  <th className="text-left px-3 py-2.5 font-semibold text-foreground whitespace-nowrap">Label</th>
                  <th className="text-left px-3 py-2.5 font-semibold text-foreground whitespace-nowrap">Primary Entity Type</th>
                  <th className="text-left px-3 py-2.5 font-semibold text-foreground whitespace-nowrap">Oversight Entity</th>
                  <th className="text-left px-3 py-2.5 font-semibold text-foreground whitespace-nowrap">Notice Template</th>
                  <th className="text-left px-3 py-2.5 font-semibold text-foreground whitespace-nowrap">Legal Flag Group</th>
                  <th className="text-left px-3 py-2.5 font-semibold text-foreground whitespace-nowrap">Tribal Law</th>
                  <th className="text-left px-3 py-2.5 font-semibold text-foreground whitespace-nowrap">Escalation</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((r) => (
                  <MatterRow key={r.id} rule={r} />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function MatterRow({ rule }: { rule: MatterRoutingRule }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <>
      <tr
        className={cn(
          "cursor-pointer transition-colors hover:bg-muted/40",
          expanded && "bg-muted/20"
        )}
        onClick={() => setExpanded(!expanded)}
      >
        <td className="px-3 py-2.5">
          <code className="font-mono font-semibold bg-muted px-1.5 py-0.5 rounded text-xs text-foreground whitespace-nowrap">
            {rule.matterType}
          </code>
        </td>
        <td className="px-3 py-2.5 font-medium text-foreground whitespace-nowrap">{rule.matterLabel}</td>
        <td className="px-3 py-2.5 text-muted-foreground max-w-[160px] truncate">{rule.primaryEntityType}</td>
        <td className="px-3 py-2.5 text-muted-foreground max-w-[140px] truncate">
          {rule.oversightEntityType ?? <span className="italic opacity-60">—</span>}
        </td>
        <td className="px-3 py-2.5 whitespace-nowrap">
          {rule.requiredNoticeTemplate ? (
            <code className="font-mono text-xs bg-muted px-1 py-0.5 rounded text-foreground">
              {rule.requiredNoticeTemplate}
            </code>
          ) : (
            <span className="italic text-muted-foreground opacity-60">—</span>
          )}
        </td>
        <td className="px-3 py-2.5 max-w-[180px]">
          {rule.legalFlagGroup.length > 0 ? (
            <div className="flex flex-wrap gap-0.5">
              {rule.legalFlagGroup.slice(0, 2).map((f, i) => (
                <span key={i} className="px-1 py-0.5 rounded border border-border bg-muted text-muted-foreground text-xs truncate max-w-[80px]" title={f}>
                  {f}
                </span>
              ))}
              {rule.legalFlagGroup.length > 2 && (
                <span className="text-muted-foreground text-xs">+{rule.legalFlagGroup.length - 2}</span>
              )}
            </div>
          ) : (
            <span className="italic text-muted-foreground opacity-60">—</span>
          )}
        </td>
        <td className="px-3 py-2.5 whitespace-nowrap">
          {rule.tribalLawApplicable ? (
            <span className="inline-flex items-center gap-1 text-amber-800 font-medium">
              <ShieldCheck className="h-3.5 w-3.5" /> Yes
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-muted-foreground">
              <CheckCircle2 className="h-3 w-3" /> No
            </span>
          )}
        </td>
        <td className="px-3 py-2.5 text-muted-foreground max-w-[180px] truncate">
          {rule.escalationPath ?? <span className="italic opacity-60">—</span>}
        </td>
      </tr>
      {expanded && (
        <tr className="bg-muted/10">
          <td colSpan={8} className="px-4 py-3 border-t border-border">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              {rule.primaryRecipientNote && (
                <div>
                  <p className="font-medium text-foreground mb-0.5">Primary Recipient Note</p>
                  <p className="text-muted-foreground">{rule.primaryRecipientNote}</p>
                </div>
              )}
              {rule.oversightRecipientNote && (
                <div>
                  <p className="font-medium text-foreground mb-0.5">Oversight Recipient Note</p>
                  <p className="text-muted-foreground">{rule.oversightRecipientNote}</p>
                </div>
              )}
              {rule.tribalLawApplicable && (
                <div>
                  <p className="font-medium text-foreground mb-0.5">Tribal Law Basis</p>
                  <p className="text-muted-foreground">{rule.tribalLawApplicable}</p>
                </div>
              )}
              {rule.escalationPath && (
                <div>
                  <p className="font-medium text-foreground mb-0.5">Escalation Path</p>
                  <p className="text-muted-foreground">{rule.escalationPath}</p>
                </div>
              )}
              {rule.escalationTemplate && (
                <div>
                  <p className="font-medium text-foreground mb-0.5">Escalation Template</p>
                  <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono">{rule.escalationTemplate}</code>
                </div>
              )}
              {rule.legalFlagGroup.length > 0 && (
                <div className="sm:col-span-2">
                  <p className="font-medium text-foreground mb-1">Full Legal Flag Group</p>
                  <div className="flex flex-wrap gap-1">
                    {rule.legalFlagGroup.map((f, i) => (
                      <span key={i} className="px-1.5 py-0.5 rounded border bg-muted text-muted-foreground text-xs">{f}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
