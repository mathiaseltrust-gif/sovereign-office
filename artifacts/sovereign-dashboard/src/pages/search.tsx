import { useState } from "react";
import { useSearchEntities, getSearchEntitiesQueryKey } from "@workspace/api-client-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";

const ENTITY_TYPES = ["__all__", "instrument", "filing", "classification", "nfr", "complaint", "task"];
const ACTOR_TYPES = ["__all__", "federal", "state", "tribal", "private"];
const LAND_STATUSES = ["__all__", "trust", "allotment", "fee", "public"];
const ACTION_TYPES = ["__all__", "trespass", "transfer", "lease", "sale", "encroachment"];
const ENTITY_LABELS: Record<string, string> = { __all__: "All types", instrument: "Trust Instruments", filing: "Filings" };
const ACTOR_LABELS: Record<string, string> = { __all__: "Any actor" };
const LAND_LABELS: Record<string, string> = { __all__: "Any status" };
const ACTION_LABELS: Record<string, string> = { __all__: "Any action" };
function toSentinel(v: string) { return v || "__all__"; }
function fromSentinel(v: string) { return v === "__all__" ? "" : v; }

export default function SearchPage() {
  const [query, setQuery] = useState({ q: "", type: "", actorType: "", landStatus: "", actionType: "" });
  const [submitted, setSubmitted] = useState<typeof query | null>(null);

  const params = submitted ? {
    q: submitted.q || undefined,
    type: submitted.type || undefined,
    actorType: submitted.actorType || undefined,
    landStatus: submitted.landStatus || undefined,
    actionType: submitted.actionType || undefined,
  } : undefined;

  const { data: results, isLoading } = useSearchEntities(params!, {
    query: {
      enabled: !!submitted,
      queryKey: getSearchEntitiesQueryKey(params),
    },
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted({ ...query });
  };

  function entityLink(type: string, id: string) {
    switch (type) {
      case "instrument": return `/trust/instruments/${id}`;
      case "filing": return `/trust/filings/${id}`;
      case "classification": return `/nfr`;
      case "nfr": return `/nfr`;
      case "complaint": return `/complaints/${id}`;
      case "task": return `/tasks`;
      default: return "#";
    }
  }

  return (
    <div data-testid="page-search">
      <div className="mb-8">
        <h1 className="text-3xl font-serif font-bold text-foreground">Search</h1>
        <p className="text-muted-foreground mt-1">Cross-entity search across trust instruments, filings, NFRs, complaints, and more</p>
      </div>

      <Card className="mb-6">
        <CardContent className="pt-6">
          <form onSubmit={handleSearch} className="space-y-4">
            <div>
              <Label htmlFor="search-q">Query</Label>
              <Input
                id="search-q"
                data-testid="input-search-q"
                value={query.q}
                onChange={(e) => setQuery({ ...query, q: e.target.value })}
                placeholder="Search text, classification, land status…"
                className="mt-1"
              />
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <Label>Entity Type</Label>
                <Select value={toSentinel(query.type)} onValueChange={(v) => setQuery({ ...query, type: fromSentinel(v) })}>
                  <SelectTrigger data-testid="select-entity-type"><SelectValue placeholder="All types" /></SelectTrigger>
                  <SelectContent>
                    {ENTITY_TYPES.map((t) => <SelectItem key={t} value={t}>{ENTITY_LABELS[t] ?? t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Actor Type</Label>
                <Select value={toSentinel(query.actorType)} onValueChange={(v) => setQuery({ ...query, actorType: fromSentinel(v) })}>
                  <SelectTrigger data-testid="select-actor-type"><SelectValue placeholder="Any actor" /></SelectTrigger>
                  <SelectContent>
                    {ACTOR_TYPES.map((t) => <SelectItem key={t} value={t}>{ACTOR_LABELS[t] ?? t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Land Status</Label>
                <Select value={toSentinel(query.landStatus)} onValueChange={(v) => setQuery({ ...query, landStatus: fromSentinel(v) })}>
                  <SelectTrigger data-testid="select-land-status"><SelectValue placeholder="Any status" /></SelectTrigger>
                  <SelectContent>
                    {LAND_STATUSES.map((t) => <SelectItem key={t} value={t}>{LAND_LABELS[t] ?? t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Action Type</Label>
                <Select value={toSentinel(query.actionType)} onValueChange={(v) => setQuery({ ...query, actionType: fromSentinel(v) })}>
                  <SelectTrigger data-testid="select-action-type"><SelectValue placeholder="Any action" /></SelectTrigger>
                  <SelectContent>
                    {ACTION_TYPES.map((t) => <SelectItem key={t} value={t}>{ACTION_LABELS[t] ?? t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button type="submit" data-testid="button-search" disabled={isLoading}>Search</Button>
          </form>
        </CardContent>
      </Card>

      {submitted && (
        <div>
          {isLoading ? (
            <div className="space-y-3">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-16" />)}</div>
          ) : !results || results.total === 0 ? (
            <p className="text-muted-foreground text-sm">No results found.</p>
          ) : (
            <>
              <p className="text-xs text-muted-foreground mb-3">{results.total} result{results.total !== 1 ? "s" : ""}</p>
              <div className="space-y-3">
                {results.results.map((r, i) => (
                  <Card key={i} data-testid={`search-result-${i}`}>
                    <CardContent className="flex items-center justify-between py-4">
                      <div className="flex-1 min-w-0">
                        <Link href={entityLink(r.entityType ?? "", r.entityId ?? "")}>
                          <p className="text-sm font-medium hover:text-primary cursor-pointer truncate">{r.content?.substring(0, 120)}</p>
                        </Link>
                        <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                          <span>ID: {r.entityId}</span>
                          {r.score != null && <span>· Score: {r.score}</span>}
                        </div>
                      </div>
                      <Badge variant="outline" className="ml-4 shrink-0">{r.entityType}</Badge>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
