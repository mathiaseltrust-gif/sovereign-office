import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { BookOpen, Search, ChevronDown, ChevronRight, Scale, Clock, AlertCircle } from "lucide-react";
import { api, MatterType } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

const CATEGORY_COLORS: Record<string, string> = {
  child_welfare: "bg-rose-100 text-rose-800 border-rose-200",
  healthcare: "bg-teal-100 text-teal-800 border-teal-200",
  land: "bg-amber-100 text-amber-800 border-amber-200",
  self_determination: "bg-blue-100 text-blue-800 border-blue-200",
  education: "bg-purple-100 text-purple-800 border-purple-200",
  sovereignty: "bg-orange-100 text-orange-800 border-orange-200",
  economic: "bg-emerald-100 text-emerald-800 border-emerald-200",
  cultural: "bg-pink-100 text-pink-800 border-pink-200",
  legal: "bg-indigo-100 text-indigo-800 border-indigo-200",
  environmental: "bg-green-100 text-green-800 border-green-200",
};

const IMPACT_COLORS: Record<string, string> = {
  critical: "text-red-600",
  high: "text-orange-600",
  medium: "text-amber-600",
  low: "text-emerald-600",
  routine: "text-blue-600",
};

function MatterRow({ matter }: { matter: MatterType }) {
  const [expanded, setExpanded] = useState(false);
  const catColor = CATEGORY_COLORS[matter.category] ?? "bg-muted text-muted-foreground border-muted";
  const impactColor = IMPACT_COLORS[matter.sovereigntyImpact ?? "routine"] ?? "text-muted-foreground";

  return (
    <div className="bg-card border border-card-border rounded-lg overflow-hidden shadow-xs">
      <button
        className="w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-muted/30 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex-1 min-w-0 flex flex-wrap items-center gap-2">
          <code className="text-xs font-mono font-semibold bg-muted px-1.5 py-0.5 rounded text-foreground shrink-0">
            {matter.code}
          </code>
          <span className="font-medium text-sm text-foreground">{matter.label}</span>
          <span className={cn("text-xs px-1.5 py-0.5 rounded border font-medium shrink-0", catColor)}>
            {matter.category.replace(/_/g, " ")}
          </span>
          {matter.sovereigntyImpact && (
            <span className={cn("text-xs font-medium shrink-0", impactColor)}>
              {matter.sovereigntyImpact} impact
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {matter.timelineDays && (
            <div className="hidden sm:flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="h-3.5 w-3.5" />
              {matter.timelineDays}d
            </div>
          )}
          {expanded ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-4 pt-2 border-t border-border space-y-3">
          {/* Description */}
          {matter.description && (
            <p className="text-sm text-foreground leading-relaxed">{matter.description}</p>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Primary Authority */}
            {matter.primaryAuthority && (
              <div>
                <p className="text-xs font-medium text-foreground mb-1 flex items-center gap-1">
                  <Scale className="h-3.5 w-3.5 text-primary" /> Primary Authority
                </p>
                <p className="text-xs text-muted-foreground">{matter.primaryAuthority}</p>
              </div>
            )}

            {/* Timeline */}
            {matter.timelineDays && (
              <div>
                <p className="text-xs font-medium text-foreground mb-1 flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5 text-muted-foreground" /> Standard Timeline
                </p>
                <p className="text-xs text-muted-foreground">{matter.timelineDays} calendar days</p>
              </div>
            )}
          </div>

          {/* Federal Statutes */}
          {matter.federalStatutes?.length > 0 && (
            <div>
              <p className="text-xs font-medium text-foreground mb-1.5">Federal Statutes</p>
              <div className="flex flex-wrap gap-1">
                {matter.federalStatutes.map((s, i) => (
                  <Badge key={i} variant="outline" className="text-xs font-mono">{s}</Badge>
                ))}
              </div>
            </div>
          )}

          {/* Tribal Rights */}
          {matter.tribalRights?.length > 0 && (
            <div>
              <p className="text-xs font-medium text-foreground mb-1.5">Tribal Rights Implicated</p>
              <div className="flex flex-wrap gap-1">
                {matter.tribalRights.map((r, i) => (
                  <Badge key={i} variant="secondary" className="text-xs">{r}</Badge>
                ))}
              </div>
            </div>
          )}

          {/* Routing Agencies */}
          {matter.routingAgencies?.length > 0 && (
            <div>
              <p className="text-xs font-medium text-foreground mb-1.5">Routing Agencies</p>
              <div className="flex flex-wrap gap-1">
                {matter.routingAgencies.map((a, i) => (
                  <Badge key={i} variant="outline" className="text-xs">{a}</Badge>
                ))}
              </div>
            </div>
          )}

          {/* Document Requirements */}
          {matter.documentRequirements?.length > 0 && (
            <div>
              <p className="text-xs font-medium text-foreground mb-1.5">Required Documents</p>
              <ul className="space-y-0.5">
                {matter.documentRequirements.map((d, i) => (
                  <li key={i} className="text-xs text-muted-foreground flex items-start gap-1.5">
                    <span className="text-primary mt-0.5 shrink-0">·</span>
                    {d}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function MattersPage() {
  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [filterImpact, setFilterImpact] = useState("");

  const { data: matters, isLoading, error } = useQuery({
    queryKey: ["matters"],
    queryFn: () => api.getMatters(),
  });

  const categories = useMemo(() => {
    if (!matters) return [];
    return [...new Set(matters.map((m) => m.category))].sort();
  }, [matters]);

  const impacts = useMemo(() => {
    if (!matters) return [];
    return [...new Set(matters.map((m) => m.sovereigntyImpact).filter(Boolean))].sort() as string[];
  }, [matters]);

  const filtered = useMemo(() => {
    if (!matters) return [];
    return matters.filter((m) => {
      if (filterCategory && m.category !== filterCategory) return false;
      if (filterImpact && m.sovereigntyImpact !== filterImpact) return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          m.code.toLowerCase().includes(q) ||
          m.label.toLowerCase().includes(q) ||
          m.description?.toLowerCase().includes(q) ||
          m.federalStatutes.some((s) => s.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [matters, search, filterCategory, filterImpact]);

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <BookOpen className="h-5 w-5 text-primary" />
          <h1 className="text-xl font-semibold text-foreground">Matter Type Reference</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Browse all matter types, applicable statutes, tribal rights, and routing requirements.
        </p>
      </div>

      {/* Filters */}
      <div className="bg-card border border-card-border rounded-lg p-4 mb-5 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-foreground mb-1">Category</label>
            <select
              className="w-full text-sm rounded-md border border-input bg-background px-3 py-2 text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
            >
              <option value="">All Categories</option>
              {categories.map((c) => (
                <option key={c} value={c}>{c.replace(/_/g, " ")}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-foreground mb-1">Sovereignty Impact</label>
            <select
              className="w-full text-sm rounded-md border border-input bg-background px-3 py-2 text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              value={filterImpact}
              onChange={(e) => setFilterImpact(e.target.value)}
            >
              <option value="">All Impact Levels</option>
              {impacts.map((i) => (
                <option key={i} value={i}>{i}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            type="search"
            placeholder="Search by code, label, description, or statute…"
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Stats bar */}
      {matters && (
        <div className="flex gap-4 mb-4 text-xs text-muted-foreground">
          <span>{filtered.length} of {matters.length} matter types</span>
          {filterCategory && <span>· Category: {filterCategory.replace(/_/g, " ")}</span>}
          {filterImpact && <span>· Impact: {filterImpact}</span>}
        </div>
      )}

      {/* List */}
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-12 rounded-lg bg-muted animate-pulse" />
          ))}
        </div>
      ) : error ? (
        <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 flex items-center gap-2 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          Failed to load matter types.
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <BookOpen className="mx-auto h-8 w-8 mb-2 opacity-40" />
          <p className="text-sm">No matter types match your filters.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((m) => (
            <MatterRow key={m.id} matter={m} />
          ))}
        </div>
      )}
    </div>
  );
}
