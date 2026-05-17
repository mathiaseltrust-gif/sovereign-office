import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";

interface Investigation {
  id: number;
  signalType: string;
  triggeringEventType: string;
  affectedMatter: string | null;
  triggeringEntity: string | null;
  protectionCategory: string | null;
  urgencyScore: number | null;
  recommendedReviewLevel: string | null;
  status: string;
  nfrId: number | null;
  summary: string | null;
  createdAt: string;
  updatedAt: string;
}

const ALL_STATUSES = ["open", "under_review", "escalated", "resolved", "dismissed"];

const ALL_CATEGORIES = [
  "LAND", "FORECLOSURE", "TAX_OR_LIEN", "IDENTITY", "JURISDICTION",
  "ICWA", "TRUST_RESPONSIBILITY", "BENEFITS", "FEDERAL_PROGRAM",
  "TREATY", "RECORDER", "MANAGED_CARE", "CONTINUITY",
];

function statusVariant(status: string): "destructive" | "default" | "secondary" | "outline" {
  if (status === "open") return "destructive";
  if (status === "escalated") return "destructive";
  if (status === "under_review") return "default";
  if (status === "resolved") return "secondary";
  return "outline";
}

function statusLabel(status: string): string {
  return status.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}

function urgencyVariant(score: number | null): "destructive" | "default" | "secondary" | "outline" {
  if (!score) return "outline";
  if (score >= 9) return "destructive";
  if (score >= 7) return "default";
  return "secondary";
}

function urgencyLabel(score: number | null): string {
  if (!score) return "—";
  if (score >= 9) return `Critical (${score})`;
  if (score >= 7) return `High (${score})`;
  return `Med (${score})`;
}

function categoryColor(cat: string | null): string {
  const map: Record<string, string> = {
    LAND: "border-l-amber-500",
    FORECLOSURE: "border-l-red-600",
    TAX_OR_LIEN: "border-l-orange-500",
    IDENTITY: "border-l-blue-500",
    JURISDICTION: "border-l-purple-500",
    ICWA: "border-l-red-500",
    TRUST_RESPONSIBILITY: "border-l-red-700",
    BENEFITS: "border-l-green-500",
    FEDERAL_PROGRAM: "border-l-teal-500",
    TREATY: "border-l-indigo-500",
    RECORDER: "border-l-yellow-500",
    MANAGED_CARE: "border-l-pink-500",
    CONTINUITY: "border-l-cyan-500",
  };
  return map[cat ?? ""] ?? "border-l-muted-foreground/30";
}

export default function InvestigationsListPage() {
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterCategory, setFilterCategory] = useState("all");

  const { data: investigations, isLoading, isError } = useQuery<Investigation[]>({
    queryKey: ["investigations-all"],
    queryFn: async () => {
      const res = await fetch("/api/court/review-engine/investigations", {
        cache: "no-store",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to load investigations");
      return res.json();
    },
    staleTime: 0,
  });

  const filtered = useMemo(() => {
    const list = investigations ?? [];
    const q = search.trim().toLowerCase();
    return list.filter(inv => {
      if (filterStatus !== "all" && inv.status !== filterStatus) return false;
      if (filterCategory !== "all" && inv.protectionCategory !== filterCategory) return false;
      if (q) {
        const haystack = [
          inv.signalType,
          inv.affectedMatter ?? "",
          inv.triggeringEntity ?? "",
          inv.protectionCategory ?? "",
          inv.status,
          inv.summary ?? "",
          String(inv.id),
        ].join(" ").toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [investigations, search, filterStatus, filterCategory]);

  return (
    <div data-testid="page-investigations-list">
      <div className="mb-8">
        <h1 className="text-3xl font-serif font-bold text-foreground">All Investigations</h1>
        <p className="text-muted-foreground mt-1">
          Browse, search, and filter all matters — open and past
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        <Input
          data-testid="input-search"
          placeholder="Search by signal, entity, matter, category…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="max-w-xs"
        />
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger data-testid="select-status" className="w-44">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {ALL_STATUSES.map(s => (
              <SelectItem key={s} value={s}>{statusLabel(s)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterCategory} onValueChange={setFilterCategory}>
          <SelectTrigger data-testid="select-category" className="w-52">
            <SelectValue placeholder="All categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {ALL_CATEGORIES.map(c => (
              <SelectItem key={c} value={c}>{c.replace(/_/g, " ")}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {(search || filterStatus !== "all" || filterCategory !== "all") && (
          <button
            data-testid="button-clear-filters"
            onClick={() => { setSearch(""); setFilterStatus("all"); setFilterCategory("all"); }}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors self-center"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Result count */}
      {!isLoading && !isError && (
        <p className="text-xs text-muted-foreground mb-4">
          {filtered.length} matter{filtered.length !== 1 ? "s" : ""} shown
          {investigations && investigations.length !== filtered.length
            ? ` of ${investigations.length} total`
            : ""}
        </p>
      )}

      {/* List */}
      {isLoading ? (
        <div className="space-y-3">
          {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-20" />)}
        </div>
      ) : isError ? (
        <Card>
          <CardContent className="py-12 text-center text-destructive text-sm">
            Failed to load investigations. Please try again.
          </CardContent>
        </Card>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground text-sm">
            No investigations match the current filters.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map(inv => (
            <Link key={inv.id} href={`/investigations/${inv.id}`}>
              <div
                data-testid={`investigation-row-${inv.id}`}
                className={`border border-border border-l-4 ${categoryColor(inv.protectionCategory)} rounded-r-sm bg-card hover:bg-muted/40 transition-colors cursor-pointer px-4 py-3`}
              >
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  {/* Left: signal + matter */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                      <span className="text-sm font-semibold text-foreground">
                        {inv.signalType.replace(/_/g, " ")}
                      </span>
                      <span className="text-[10px] text-muted-foreground">#{inv.id}</span>
                    </div>
                    {inv.affectedMatter && (
                      <p className="text-xs text-muted-foreground truncate max-w-xl">{inv.affectedMatter}</p>
                    )}
                    {inv.triggeringEntity && (
                      <p className="text-[11px] text-muted-foreground/70 truncate">Entity: {inv.triggeringEntity}</p>
                    )}
                  </div>

                  {/* Right: badges + date */}
                  <div className="flex items-center gap-2 flex-wrap shrink-0">
                    <Badge variant={statusVariant(inv.status)} className="text-[9px]">
                      {statusLabel(inv.status)}
                    </Badge>
                    <Badge variant={urgencyVariant(inv.urgencyScore)} className="text-[9px]">
                      {urgencyLabel(inv.urgencyScore)}
                    </Badge>
                    {inv.protectionCategory && (
                      <Badge variant="outline" className="text-[9px]">
                        {inv.protectionCategory.replace(/_/g, " ")}
                      </Badge>
                    )}
                    <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                      {new Date(inv.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
