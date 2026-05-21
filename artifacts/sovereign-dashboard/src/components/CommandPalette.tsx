import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import { Search, X, ArrowRight, Clock, ExternalLink, Loader2 } from "lucide-react";
import { useAuth, getCurrentBearerToken } from "@/components/auth-provider";
import { searchFunctions, type SiteFunction } from "@/lib/site-functions";

interface SearchRecord {
  entityType: string;
  entityId: string;
  content: string;
  metadata: unknown;
  score: number;
}

const ENTITY_LABELS: Record<string, string> = {
  nfr: "NFR",
  task: "Task",
  classification: "Classification",
  complaint: "Complaint",
  calendar_event: "Calendar",
  member: "Member",
  profile: "Member",
  case: "Case",
  intake: "Intake",
  document: "Document",
  trust_instrument: "Trust",
  filing: "Filing",
};

const ENTITY_LANE_LABELS: Record<string, string> = {
  member: "Members",
  profile: "Members",
  case: "Cases",
  intake: "Intakes",
  document: "Documents",
  task: "Tasks",
  calendar_event: "Calendar",
  complaint: "Complaints",
  nfr: "NFR Documents",
  classification: "Classifications",
  trust_instrument: "Trust Instruments",
  filing: "Filings",
};

const ENTITY_PATHS: Record<string, (id: string) => string> = {
  nfr: () => `/nfr`,
  task: () => `/tasks`,
  complaint: () => `/complaints`,
  calendar_event: () => `/calendar`,
  profile: () => `/membership`,
  classification: () => `/classify`,
  case: () => `/investigations`,
  intake: () => `/sovereign-pipeline`,
  member: () => `/membership`,
  document: () => `/documents`,
  trust_instrument: () => `/instruments`,
  filing: () => `/filings`,
};

function recordPath(r: SearchRecord): string {
  const fn = ENTITY_PATHS[r.entityType];
  return fn ? fn(r.entityId) : `/search`;
}

function recordDate(r: SearchRecord): string | null {
  const m = r.metadata as Record<string, unknown> | null;
  if (!m) return null;
  const raw = m.date ?? m.createdAt ?? m.updatedAt;
  if (!raw) return null;
  try {
    return new Date(raw as string).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  } catch { return null; }
}

const LANE_ORDER = ["member", "profile", "case", "intake", "document", "task", "calendar_event", "complaint", "nfr", "classification", "trust_instrument", "filing"];

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
}

export function CommandPalette({ open, onClose }: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [activeIdx, setActiveIdx] = useState(0);
  const [records, setRecords] = useState<SearchRecord[]>([]);
  const [recordsLoading, setRecordsLoading] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { activeRole } = useAuth();
  const [, navigate] = useLocation();

  const functions = searchFunctions(query, activeRole);

  const allItems: Array<
    | { kind: "fn"; fn: SiteFunction }
    | { kind: "record"; record: SearchRecord }
    | { kind: "recent"; term: string }
  > = [];

  if (!query.trim()) {
    recentSearches.slice(0, 5).forEach((term) =>
      allItems.push({ kind: "recent", term }),
    );
  }
  functions.forEach((fn) => allItems.push({ kind: "fn", fn }));
  records.slice(0, 6).forEach((record) => allItems.push({ kind: "record", record }));

  useEffect(() => {
    if (open) {
      setQuery("");
      setRecords([]);
      setActiveIdx(0);
      setTimeout(() => inputRef.current?.focus(), 30);
      loadRecentSearches();
    }
  }, [open]);

  async function loadRecentSearches() {
    try {
      const token = await getCurrentBearerToken();
      const res = await fetch(`/api/user/profile`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        credentials: "include",
      });
      if (res.ok) {
        const data = await res.json();
        const history = data?.profile?.searchHistory;
        if (Array.isArray(history)) setRecentSearches(history.slice(0, 8));
      }
    } catch {
      // non-fatal
    }
  }

  useEffect(() => {
    if (!open) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query.trim()) {
      setRecords([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setRecordsLoading(true);
      try {
        const token = await getCurrentBearerToken();
        const params = new URLSearchParams({ q: query });
        const res = await fetch(
          `/api/search?${params}`,
          {
            headers: token ? { Authorization: `Bearer ${token}` } : {},
            credentials: "include",
          },
        );
        if (res.ok) {
          const data = await res.json();
          setRecords(data.results ?? []);
        }
      } catch {
        setRecords([]);
      } finally {
        setRecordsLoading(false);
      }
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, open]);

  useEffect(() => {
    setActiveIdx(0);
  }, [query]);

  function handleSelect(item: typeof allItems[number]) {
    if (item.kind === "fn") {
      if (item.fn.external) {
        window.location.href = item.fn.path;
      } else {
        navigate(item.fn.path);
      }
      onClose();
    } else if (item.kind === "record") {
      navigate(recordPath(item.record));
      onClose();
    } else if (item.kind === "recent") {
      setQuery(item.term);
    }
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") { onClose(); return; }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => Math.min(i + 1, allItems.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (allItems[activeIdx]) handleSelect(allItems[activeIdx]);
    }
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh]"
    >
      {/* Backdrop — click closes the palette */}
      <div
        className="absolute inset-0 bg-black/55 backdrop-blur-sm"
        onMouseDown={() => onClose()}
      />

      {/* Palette */}
      <div
        className="relative w-full max-w-xl mx-4 rounded-xl shadow-2xl overflow-hidden"
        style={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }}
      >
        {/* Input row */}
        <div className="flex items-center gap-2.5 px-4 py-3 border-b" style={{ borderColor: "hsl(var(--border))" }}>
          <Search className="w-4 h-4 text-muted-foreground shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Search pages, records, members, cases…"
            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
          />
          {recordsLoading && <Loader2 className="w-3.5 h-3.5 text-muted-foreground animate-spin shrink-0" />}
          {query && !recordsLoading && (
            <button
              onClick={() => setQuery("")}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
          <kbd className="hidden sm:inline-flex items-center text-[10px] text-muted-foreground bg-muted border border-border rounded px-1.5 py-0.5 font-mono shrink-0">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div className="max-h-[420px] overflow-y-auto py-1.5">
          {allItems.length === 0 && query.trim() && !recordsLoading && (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              No results for <span className="font-medium text-foreground">"{query}"</span>
            </div>
          )}

          {/* Recent searches section */}
          {!query.trim() && recentSearches.length > 0 && (
            <>
              <p className="px-4 pt-1.5 pb-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                Recent
              </p>
              {allItems
                .filter((i) => i.kind === "recent")
                .map((item, idx) => {
                  if (item.kind !== "recent") return null;
                  const isActive = activeIdx === idx;
                  return (
                    <button
                      key={`recent-${item.term}`}
                      className={[
                        "w-full flex items-center gap-3 px-4 py-2 text-sm text-left transition-colors",
                        isActive ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-accent/60",
                      ].join(" ")}
                      onMouseEnter={() => setActiveIdx(idx)}
                      onClick={() => handleSelect(item)}
                    >
                      <Clock className="w-3.5 h-3.5 shrink-0 opacity-60" />
                      <span>{item.term}</span>
                    </button>
                  );
                })}
            </>
          )}

          {/* Site functions */}
          {functions.length > 0 && (
            <>
              <p className="px-4 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                {query.trim() ? "Pages & Features" : "All Features"}
              </p>
              {functions.map((fn, i) => {
                const offset = allItems.findIndex((it) => it.kind === "fn" && it.fn.path === fn.path && it.fn.label === fn.label);
                const isActive = activeIdx === offset;
                const Icon = fn.icon;
                return (
                  <button
                    key={`fn-${fn.path}-${fn.label}`}
                    className={[
                      "w-full flex items-center gap-3 px-4 py-2 text-sm text-left transition-colors",
                      isActive ? "bg-accent text-accent-foreground" : "text-foreground hover:bg-accent/60",
                    ].join(" ")}
                    onMouseEnter={() => setActiveIdx(offset)}
                    onClick={() => handleSelect({ kind: "fn", fn })}
                  >
                    <Icon className="w-4 h-4 shrink-0 text-muted-foreground" />
                    <div className="flex-1 min-w-0">
                      <span className="font-medium truncate block">{fn.label}</span>
                      <span className="text-[11px] text-muted-foreground truncate block">{fn.section}</span>
                    </div>
                    {fn.external ? (
                      <ExternalLink className="w-3 h-3 text-muted-foreground/40 shrink-0" />
                    ) : (
                      <ArrowRight className="w-3 h-3 text-muted-foreground/40 shrink-0 opacity-0 group-hover:opacity-100" />
                    )}
                  </button>
                );
              })}
            </>
          )}

          {/* Live record results — grouped by entity type (lane grouping) */}
          {records.length > 0 && (() => {
            const grouped = new Map<string, SearchRecord[]>();
            for (const r of records.slice(0, 20)) {
              const k = r.entityType;
              if (!grouped.has(k)) grouped.set(k, []);
              grouped.get(k)!.push(r);
            }
            const orderedTypes = [
              ...LANE_ORDER.filter(t => grouped.has(t)),
              ...[...grouped.keys()].filter(t => !LANE_ORDER.includes(t)),
            ];
            return orderedTypes.map(entityType => {
              const laneRecords = (grouped.get(entityType) ?? []).slice(0, 3);
              const laneLabel = ENTITY_LANE_LABELS[entityType] ?? entityType.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase());
              return (
                <div key={`lane-${entityType}`}>
                  <p className="px-4 pt-2 pb-0.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                    {laneLabel}
                  </p>
                  {laneRecords.map((r) => {
                    const offset = allItems.findIndex(
                      (it) => it.kind === "record" && it.record.entityId === r.entityId && it.record.entityType === r.entityType,
                    );
                    const isActive = activeIdx === offset;
                    const date = recordDate(r);
                    return (
                      <button
                        key={`rec-${r.entityType}-${r.entityId}`}
                        className={[
                          "w-full flex items-center gap-3 px-4 py-1.5 text-sm text-left transition-colors",
                          isActive ? "bg-accent text-accent-foreground" : "text-foreground hover:bg-accent/60",
                        ].join(" ")}
                        onMouseEnter={() => setActiveIdx(offset)}
                        onClick={() => handleSelect({ kind: "record", record: r })}
                      >
                        <div className="flex-1 min-w-0">
                          <span className="truncate text-sm block">{r.content.substring(0, 80)}</span>
                          {date && (
                            <span className="text-[10px] text-muted-foreground">{date}</span>
                          )}
                        </div>
                        <ArrowRight className="w-3 h-3 text-muted-foreground/40 shrink-0" />
                      </button>
                    );
                  })}
                </div>
              );
            });
          })()}
        </div>

        {/* Footer hint */}
        <div
          className="flex items-center gap-3 px-4 py-2 border-t text-[10px] text-muted-foreground"
          style={{ borderColor: "hsl(var(--border))" }}
        >
          <span><kbd className="font-mono">↑↓</kbd> navigate</span>
          <span><kbd className="font-mono">↵</kbd> select</span>
          <span><kbd className="font-mono">esc</kbd> close</span>
          <span className="ml-auto">
            <kbd className="font-mono">⌘K</kbd> anywhere
          </span>
        </div>
      </div>
    </div>
  );
}
