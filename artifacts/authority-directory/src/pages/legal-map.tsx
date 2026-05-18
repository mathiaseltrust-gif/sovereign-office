import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Scale, Search, AlertCircle, AlertTriangle } from "lucide-react";
import { api, LegalMapEntry, ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { SessionExpiredBanner } from "@/App";

export default function LegalMapPage() {
  const [search, setSearch] = useState("");
  const [filterIssue, setFilterIssue] = useState("");
  const [filterWarningOnly, setFilterWarningOnly] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ["legal-map", search, filterIssue],
    queryFn: () =>
      api.getLegalMap({
        q: search.trim() || undefined,
        issueType: filterIssue || undefined,
      }),
    placeholderData: (prev) => prev,
  });

  const maps = data?.maps ?? [];
  const is401 = (error as ApiError)?.status === 401;

  const issueTypes = useMemo(() => {
    return [...new Set(maps.map((m) => m.issueType))].sort();
  }, [maps]);

  const filtered = useMemo(() => {
    let result = maps;
    if (filterIssue) result = result.filter((m) => m.issueType === filterIssue);
    if (filterWarningOnly) result = result.filter((m) => !!m.warningOrLimit);
    return result;
  }, [maps, filterIssue, filterWarningOnly]);

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <Scale className="h-5 w-5 text-primary" />
          <h1 className="text-xl font-semibold text-foreground">Legal Authority Map</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Federal statutes, CFR regulations, and case law mapped to issue types. Rows with active warnings are highlighted.
        </p>
      </div>

      {/* Filters */}
      <div className="bg-card border border-card-border rounded-lg p-4 mb-5">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              type="search"
              placeholder="Search authority name, USC/CFR reference, issue type…"
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="shrink-0">
            <select
              className="w-full sm:w-48 text-sm rounded-md border border-input bg-background px-3 py-2 text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              value={filterIssue}
              onChange={(e) => setFilterIssue(e.target.value)}
            >
              <option value="">All Issue Types</option>
              {issueTypes.map((t) => (
                <option key={t} value={t}>{t.replace(/_/g, " ")}</option>
              ))}
            </select>
          </div>
          <label className="flex items-center gap-2 text-xs text-foreground shrink-0 cursor-pointer">
            <input
              type="checkbox"
              checked={filterWarningOnly}
              onChange={(e) => setFilterWarningOnly(e.target.checked)}
              className="rounded border-input"
            />
            Warnings only
          </label>
        </div>
      </div>

      {/* Stats */}
      {!isLoading && !error && (
        <p className="text-xs text-muted-foreground mb-3">
          {filtered.length} of {maps.length} authorit{maps.length !== 1 ? "ies" : "y"}
          {filterWarningOnly && <> · Showing warnings only</>}
        </p>
      )}

      {/* Table */}
      {is401 ? (
        <SessionExpiredBanner />
      ) : isLoading ? (
        <div className="space-y-1">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-10 rounded bg-muted animate-pulse" />
          ))}
        </div>
      ) : error ? (
        <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 flex items-center gap-2 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          Failed to load legal authorities. {(error as Error).message}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Scale className="mx-auto h-8 w-8 mb-2 opacity-40" />
          <p className="text-sm">No authorities match your filters.</p>
        </div>
      ) : (
        <div className="rounded-lg border border-card-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-muted/60 border-b border-border">
                  <th className="text-left px-3 py-2.5 font-semibold text-foreground whitespace-nowrap">Issue Type</th>
                  <th className="text-left px-3 py-2.5 font-semibold text-foreground whitespace-nowrap">Authority Name</th>
                  <th className="text-left px-3 py-2.5 font-semibold text-foreground whitespace-nowrap">USC Reference</th>
                  <th className="text-left px-3 py-2.5 font-semibold text-foreground whitespace-nowrap">CFR Reference</th>
                  <th className="text-left px-3 py-2.5 font-semibold text-foreground whitespace-nowrap">Case Law</th>
                  <th className="text-left px-3 py-2.5 font-semibold text-foreground whitespace-nowrap">Applies When</th>
                  <th className="text-left px-3 py-2.5 font-semibold text-foreground whitespace-nowrap">Warning / Limit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((entry) => (
                  <LegalMapRow key={entry.id} entry={entry} />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function LegalMapRow({ entry }: { entry: LegalMapEntry }) {
  const [expanded, setExpanded] = useState(false);
  const hasWarning = !!entry.warningOrLimit;

  return (
    <>
      <tr
        className={cn(
          "cursor-pointer transition-colors hover:bg-muted/40",
          hasWarning && "bg-amber-50/60 hover:bg-amber-50",
          expanded && "bg-muted/20"
        )}
        onClick={() => setExpanded(!expanded)}
      >
        <td className="px-3 py-2.5 whitespace-nowrap">
          <code className="font-mono font-semibold bg-muted px-1.5 py-0.5 rounded text-xs text-foreground">
            {entry.issueType.replace(/_/g, " ")}
          </code>
        </td>
        <td className="px-3 py-2.5 font-medium text-foreground max-w-[200px]">
          <div className="flex items-start gap-1">
            {hasWarning && (
              <AlertTriangle className="h-3.5 w-3.5 text-amber-600 shrink-0 mt-0.5" />
            )}
            <span className="truncate">{entry.authorityName}</span>
          </div>
        </td>
        <td className="px-3 py-2.5 whitespace-nowrap">
          {entry.uscReference ? (
            <code className="font-mono bg-blue-50 text-blue-800 border border-blue-200 px-1.5 py-0.5 rounded text-xs">
              {entry.uscReference}
            </code>
          ) : (
            <span className="text-muted-foreground italic opacity-60">—</span>
          )}
        </td>
        <td className="px-3 py-2.5 whitespace-nowrap">
          {entry.cfrReference ? (
            <code className="font-mono bg-purple-50 text-purple-800 border border-purple-200 px-1.5 py-0.5 rounded text-xs">
              {entry.cfrReference}
            </code>
          ) : (
            <span className="text-muted-foreground italic opacity-60">—</span>
          )}
        </td>
        <td className="px-3 py-2.5 max-w-[160px] truncate text-muted-foreground">
          {entry.caseLawReference ?? <span className="italic opacity-60">—</span>}
        </td>
        <td className="px-3 py-2.5 max-w-[200px] truncate text-muted-foreground">
          {entry.appliesWhen ?? <span className="italic opacity-60">—</span>}
        </td>
        <td className="px-3 py-2.5 max-w-[220px]">
          {entry.warningOrLimit ? (
            <span className="text-amber-800 font-medium line-clamp-2">{entry.warningOrLimit}</span>
          ) : (
            <span className="text-muted-foreground italic opacity-60">—</span>
          )}
        </td>
      </tr>
      {expanded && (
        <tr className={cn(hasWarning ? "bg-amber-50/40" : "bg-muted/10")}>
          <td colSpan={7} className="px-4 py-3 border-t border-border">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              {entry.federalAuthority && (
                <div>
                  <p className="font-medium text-foreground mb-0.5">Federal Authority</p>
                  <p className="text-muted-foreground">{entry.federalAuthority}</p>
                </div>
              )}
              {entry.stateAuthority && (
                <div>
                  <p className="font-medium text-foreground mb-0.5">State Authority</p>
                  <p className="text-muted-foreground">{entry.stateAuthority}</p>
                </div>
              )}
              {entry.tribalAuthority && (
                <div>
                  <p className="font-medium text-foreground mb-0.5">Tribal Authority</p>
                  <p className="text-muted-foreground">{entry.tribalAuthority}</p>
                </div>
              )}
              {entry.appliesWhen && (
                <div>
                  <p className="font-medium text-foreground mb-0.5">Applies When</p>
                  <p className="text-muted-foreground">{entry.appliesWhen}</p>
                </div>
              )}
              {entry.warningOrLimit && (
                <div className="sm:col-span-2 bg-amber-50 border border-amber-200 rounded px-3 py-2">
                  <p className="font-medium text-amber-900 mb-0.5 flex items-center gap-1">
                    <AlertTriangle className="h-3.5 w-3.5" /> Warning / Limit
                  </p>
                  <p className="text-amber-800">{entry.warningOrLimit}</p>
                </div>
              )}
              {entry.templateLanguageSnippet && (
                <div className="sm:col-span-2">
                  <p className="font-medium text-foreground mb-1">Template Language Snippet</p>
                  <pre className="bg-muted rounded p-2 text-muted-foreground whitespace-pre-wrap font-mono text-xs leading-relaxed">
                    {entry.templateLanguageSnippet}
                  </pre>
                </div>
              )}
              {entry.reviewRequired && (
                <div className="sm:col-span-2 text-amber-700 font-medium flex items-center gap-1">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  Review required before using this authority in any official action.
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
