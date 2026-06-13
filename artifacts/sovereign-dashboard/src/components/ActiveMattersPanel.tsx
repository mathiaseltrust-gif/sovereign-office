import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";

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
  implicatedLaws: string[] | null;
  internalActions: Array<{ step: number; action: string; status: string }> | null;
  externalActions: Array<{ step: number; action: string; status: string }> | null;
  requiredFollowthrough: Array<{ step: number; item: string; status: string }> | null;
  summary: string | null;
  createdAt: string;
}

function urgencyVariant(score: number | null): "destructive" | "default" | "secondary" | "outline" {
  if (!score) return "outline";
  if (score >= 9) return "destructive";
  if (score >= 7) return "default";
  return "secondary";
}

function urgencyLabel(score: number | null): string {
  if (!score) return "PENDING";
  if (score >= 9) return `CRITICAL (${score}/10)`;
  if (score >= 7) return `HIGH (${score}/10)`;
  return `MEDIUM (${score}/10)`;
}

function signalLabel(s: string): string {
  return s.replace(/_/g, " ");
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
  return map[cat ?? ""] ?? "border-l-muted";
}

export function ActiveMattersPanel() {
  const { data: matters, isLoading, isFetching, refetch } = useQuery<Investigation[]>({
    queryKey: ["active-matters"],
    queryFn: async () => {
      const res = await fetch("/api/court/review-engine/active-matters", {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to load active matters");
      return res.json();
    },
    staleTime: 5 * 60_000,
    gcTime: 15 * 60_000,
    refetchOnWindowFocus: false,
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold uppercase tracking-widest">Active Matters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-16 rounded bg-muted animate-pulse" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const open = matters ?? [];

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-semibold uppercase tracking-widest flex items-center gap-2">
          Active Matters
          {open.length > 0 && (
            <Badge variant="destructive" className="text-[10px] px-1.5 py-0.5">
              {open.length}
            </Badge>
          )}
        </CardTitle>
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
          title="Refresh"
        >
          {isFetching ? "…" : "↺"}
        </button>
      </CardHeader>
      <CardContent className="space-y-3">
        {open.length === 0 ? (
          <p className="text-sm text-muted-foreground">No open investigations.</p>
        ) : (
          open.slice(0, 8).map((m) => (
            <div
              key={m.id}
              className={`border-l-4 pl-3 py-2 rounded-r-sm bg-muted/30 space-y-1 ${categoryColor(m.protectionCategory)}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-foreground truncate">
                    {signalLabel(m.signalType)}
                  </p>
                  {m.affectedMatter && (
                    <p className="text-xs text-muted-foreground truncate">{m.affectedMatter}</p>
                  )}
                  {m.triggeringEntity && (
                    <p className="text-[11px] text-muted-foreground/70 truncate">
                      Entity: {m.triggeringEntity}
                    </p>
                  )}
                </div>
                <Badge variant={urgencyVariant(m.urgencyScore)} className="text-[9px] shrink-0 whitespace-nowrap">
                  {urgencyLabel(m.urgencyScore)}
                </Badge>
              </div>

              {m.implicatedLaws && m.implicatedLaws.length > 0 && (
                <p className="text-[10px] text-muted-foreground italic">
                  {m.implicatedLaws[0]}
                </p>
              )}

              {m.externalActions && m.externalActions.length > 0 && (
                <p className="text-[11px] text-foreground/80 font-medium">
                  → {m.externalActions[0].action}
                </p>
              )}

              <div className="flex items-center justify-between pt-0.5">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-[9px]">{m.protectionCategory ?? "—"}</Badge>
                  <Badge variant="outline" className="text-[9px]">{m.recommendedReviewLevel ?? "TRUSTEE"}</Badge>
                  {m.nfrId && (
                    <Badge variant="secondary" className="text-[9px]">NFR #{m.nfrId}</Badge>
                  )}
                </div>
                <span className="text-[10px] text-muted-foreground">
                  {new Date(m.createdAt).toLocaleDateString()}
                </span>
              </div>
              <div className="pt-1">
                <Link href={`/investigations/${m.id}`}>
                  <span className="text-[10px] text-primary hover:underline cursor-pointer">Open matter →</span>
                </Link>
              </div>
            </div>
          ))
        )}

        {open.length > 0 && (
          <div className="flex items-center justify-between pt-1">
            <Link href="/nfr">
              <Button variant="link" className="text-xs p-0 h-auto text-primary">
                View all NFR documents →
              </Button>
            </Link>
            {open.length > 8 && (
              <span className="text-xs text-muted-foreground">+{open.length - 8} more</span>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
