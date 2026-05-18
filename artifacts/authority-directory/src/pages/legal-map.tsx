import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Scale, Search, ChevronDown, ChevronRight, Calendar, AlertCircle, Globe } from "lucide-react";
import { api, LegalAuthority } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

const TYPE_COLORS: Record<string, string> = {
  federal_statute: "bg-blue-100 text-blue-800 border-blue-200",
  treaty: "bg-amber-100 text-amber-800 border-amber-200",
  executive_order: "bg-purple-100 text-purple-800 border-purple-200",
  doctrine: "bg-teal-100 text-teal-800 border-teal-200",
  regulation: "bg-indigo-100 text-indigo-800 border-indigo-200",
  case_law: "bg-rose-100 text-rose-800 border-rose-200",
  tribal_code: "bg-orange-100 text-orange-800 border-orange-200",
  policy: "bg-green-100 text-green-800 border-green-200",
};

function AuthorityRow({ authority }: { authority: LegalAuthority }) {
  const [expanded, setExpanded] = useState(false);
  const typeColor = TYPE_COLORS[authority.authorityType] ?? "bg-muted text-muted-foreground border-muted";

  return (
    <div className="bg-card border border-card-border rounded-lg overflow-hidden shadow-xs">
      <button
        className="w-full text-left px-4 py-3 flex items-start gap-3 hover:bg-muted/30 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <code className="text-xs font-mono font-semibold bg-muted px-1.5 py-0.5 rounded text-foreground shrink-0">
              {authority.citation}
            </code>
            <span className="font-medium text-sm text-foreground">{authority.title}</span>
          </div>
          <div className="flex flex-wrap gap-1.5 mt-1">
            <span className={cn("text-xs px-1.5 py-0.5 rounded border font-medium shrink-0", typeColor)}>
              {authority.authorityType.replace(/_/g, " ")}
            </span>
            {authority.doctrineCategory && (
              <span className="text-xs px-1.5 py-0.5 rounded border bg-muted text-muted-foreground">
                {authority.doctrineCategory}
              </span>
            )}
            {authority.jurisdiction && (
              <span className="text-xs flex items-center gap-1 text-muted-foreground">
                <Globe className="h-3 w-3" /> {authority.jurisdiction}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {authority.effectiveDate && (
            <div className="hidden sm:flex items-center gap-1 text-xs text-muted-foreground">
              <Calendar className="h-3.5 w-3.5" />
              {new Date(authority.effectiveDate).getFullYear()}
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
          {/* Summary */}
          {authority.summary && (
            <p className="text-sm text-foreground leading-relaxed">{authority.summary}</p>
          )}

          {/* Sovereignty Basis */}
          {authority.sovereigntyBasis && (
            <div className="border-l-2 border-primary/40 pl-3 py-0.5">
              <p className="text-xs font-medium text-foreground mb-0.5">Sovereignty Basis</p>
              <p className="text-xs text-muted-foreground">{authority.sovereigntyBasis}</p>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Effective Date */}
            {authority.effectiveDate && (
              <div>
                <p className="text-xs font-medium text-foreground mb-1">Effective Date</p>
                <p className="text-xs text-muted-foreground">
                  {new Date(authority.effectiveDate).toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </p>
              </div>
            )}

            {/* Jurisdiction */}
            {authority.jurisdiction && (
              <div>
                <p className="text-xs font-medium text-foreground mb-1">Jurisdiction</p>
                <p className="text-xs text-muted-foreground">{authority.jurisdiction}</p>
              </div>
            )}
          </div>

          {/* Applicable Matter Types */}
          {authority.applicableMatterTypes?.length > 0 && (
            <div>
              <p className="text-xs font-medium text-foreground mb-1.5">Applicable Matter Types</p>
              <div className="flex flex-wrap gap-1">
                {authority.applicableMatterTypes.map((m, i) => (
                  <Badge key={i} variant="secondary" className="text-xs font-mono">{m}</Badge>
                ))}
              </div>
            </div>
          )}

          {/* Notes */}
          {authority.notes && (
            <p className="text-xs text-muted-foreground italic border-l-2 border-accent/40 pl-2.5 py-0.5">
              {authority.notes}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export default function LegalMapPage() {
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("");
  const [filterDoctrine, setFilterDoctrine] = useState("");

  const { data: authorities, isLoading, error } = useQuery({
    queryKey: ["legal-map"],
    queryFn: () => api.getLegalMap(),
  });

  const authorityTypes = useMemo(() => {
    if (!authorities) return [];
    return [...new Set(authorities.map((a) => a.authorityType))].sort();
  }, [authorities]);

  const doctrineCategories = useMemo(() => {
    if (!authorities) return [];
    return [...new Set(authorities.map((a) => a.doctrineCategory).filter(Boolean))].sort() as string[];
  }, [authorities]);

  const filtered = useMemo(() => {
    if (!authorities) return [];
    return authorities.filter((a) => {
      if (filterType && a.authorityType !== filterType) return false;
      if (filterDoctrine && a.doctrineCategory !== filterDoctrine) return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          a.citation.toLowerCase().includes(q) ||
          a.title.toLowerCase().includes(q) ||
          a.summary?.toLowerCase().includes(q) ||
          a.doctrineCategory?.toLowerCase().includes(q) ||
          a.sovereigntyBasis?.toLowerCase().includes(q) ||
          a.applicableMatterTypes.some((m) => m.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [authorities, search, filterType, filterDoctrine]);

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <Scale className="h-5 w-5 text-primary" />
          <h1 className="text-xl font-semibold text-foreground">Legal Authority Map</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Browse applicable federal statutes, treaties, doctrines, and tribal codes with their sovereignty basis and matter-type applicability.
        </p>
      </div>

      {/* Filters */}
      <div className="bg-card border border-card-border rounded-lg p-4 mb-5 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-foreground mb-1">Authority Type</label>
            <select
              className="w-full text-sm rounded-md border border-input bg-background px-3 py-2 text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
            >
              <option value="">All Types</option>
              {authorityTypes.map((t) => (
                <option key={t} value={t}>{t.replace(/_/g, " ")}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-foreground mb-1">Doctrine Category</label>
            <select
              className="w-full text-sm rounded-md border border-input bg-background px-3 py-2 text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              value={filterDoctrine}
              onChange={(e) => setFilterDoctrine(e.target.value)}
            >
              <option value="">All Doctrines</option>
              {doctrineCategories.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            type="search"
            placeholder="Search by citation, title, doctrine, or matter type…"
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Stats */}
      {authorities && (
        <div className="flex flex-wrap gap-4 mb-4 text-xs text-muted-foreground">
          <span>{filtered.length} of {authorities.length} authorities</span>
          {filterType && <span>· Type: {filterType.replace(/_/g, " ")}</span>}
          {filterDoctrine && <span>· Doctrine: {filterDoctrine}</span>}
        </div>
      )}

      {/* List */}
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-14 rounded-lg bg-muted animate-pulse" />
          ))}
        </div>
      ) : error ? (
        <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 flex items-center gap-2 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          Failed to load legal authorities.
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Scale className="mx-auto h-8 w-8 mb-2 opacity-40" />
          <p className="text-sm">No authorities match your filters.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((a) => (
            <AuthorityRow key={a.id} authority={a} />
          ))}
        </div>
      )}
    </div>
  );
}
