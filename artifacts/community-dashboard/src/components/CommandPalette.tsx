import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import { Search, X, ArrowRight, Clock, Loader2, ExternalLink } from "lucide-react";

interface SiteFunction {
  path: string;
  label: string;
  section: string;
  keywords: string[];
  external?: boolean;
}

interface SearchRecord {
  entityType: string;
  entityId: string;
  content: string;
  metadata: unknown;
  score: number;
}

const SITE_FUNCTIONS: SiteFunction[] = [
  { path: "/", label: "Dashboard", section: "Community", keywords: ["home", "dashboard", "overview"] },
  { path: "/directory", label: "Family Directory", section: "Community", keywords: ["directory", "family", "members", "people"] },
  { path: "/forum", label: "Community Forum", section: "Community", keywords: ["forum", "discussion", "posts", "messages"] },
  { path: "/announcements", label: "Announcements", section: "Community", keywords: ["announcements", "news", "updates", "broadcast"] },
  { path: "/university", label: "SDU University", section: "Community", keywords: ["university", "sdu", "self-determination", "learning", "courses"] },
  { path: "/profile", label: "My Profile", section: "Community", keywords: ["profile", "identity", "my account", "settings"] },
  { path: "/admin", label: "Admin", section: "Community", keywords: ["admin", "administration", "manage", "settings"] },
  { path: "/photos", label: "Photo Manager", section: "Community", keywords: ["photos", "images", "gallery", "media"] },
  { path: "https://office.mathiaseltribe.org", label: "Chief Justice & Trustee Office", section: "Ecosystem", keywords: ["sovereign", "office", "official"], external: true },
  { path: "https://office.mathiaseltribe.org/family-tree", label: "Family Tree", section: "Ecosystem", keywords: ["family tree", "lineage", "ancestors"], external: true },
  { path: "https://office.mathiaseltribe.org/ancestral-affiliations", label: "Tribal Heritage", section: "Ecosystem", keywords: ["heritage", "tribal", "affiliations"], external: true },
];

const ENTITY_PATHS: Record<string, (id: string) => string> = {
  member: () => `/directory`,
  profile: () => `/directory`,
  document: () => `/`,
};

const ENTITY_LANE_LABELS: Record<string, string> = {
  member: "Members",
  profile: "Members",
  document: "Documents",
};

const LS_RECENT_KEY = "sovereign_recent_pages_v1";
const LS_RECENT_PREFIX = "community:";

function getRecentPages(): string[] {
  try { return JSON.parse(localStorage.getItem(LS_RECENT_KEY) ?? "[]").filter((p: string) => p.startsWith(LS_RECENT_PREFIX)).map((p: string) => p.slice(LS_RECENT_PREFIX.length)); }
  catch { return []; }
}

function getSearchToken(): string | null {
  try {
    const raw = localStorage.getItem("sovereign_auth_v3");
    if (raw) { const s = JSON.parse(raw); if (s?.sessionToken) return s.sessionToken; }
    return localStorage.getItem("community_auth_token");
  } catch { return null; }
}

function searchFns(q: string): SiteFunction[] {
  const lower = q.toLowerCase();
  if (!lower) return SITE_FUNCTIONS;
  return SITE_FUNCTIONS.filter(f =>
    f.label.toLowerCase().includes(lower) ||
    f.section.toLowerCase().includes(lower) ||
    f.keywords.some(k => k.includes(lower))
  );
}

function recordPath(r: SearchRecord): string {
  const fn = ENTITY_PATHS[r.entityType];
  return fn ? fn(r.entityId) : `/`;
}

function recordDate(r: SearchRecord): string | null {
  const m = r.metadata as Record<string, unknown> | null;
  if (!m) return null;
  const raw = m.date ?? m.createdAt ?? m.updatedAt;
  if (!raw) return null;
  try { return new Date(raw as string).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }); }
  catch { return null; }
}

function pageLabelFor(path: string): string {
  const fn = SITE_FUNCTIONS.find(f => f.path === path);
  if (fn) return fn.label;
  return path.replace(/^\//, "").replace(/-/g, " ").replace(/\b\w/g, l => l.toUpperCase()) || "Dashboard";
}

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
}

export function CommandPalette({ open, onClose }: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [activeIdx, setActiveIdx] = useState(0);
  const [records, setRecords] = useState<SearchRecord[]>([]);
  const [recordsLoading, setRecordsLoading] = useState(false);
  const [recentPages, setRecentPages] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [, navigate] = useLocation();

  const functions = searchFns(query);

  type Item =
    | { kind: "recent"; path: string }
    | { kind: "fn"; fn: SiteFunction }
    | { kind: "record"; record: SearchRecord };

  const allItems: Item[] = [];
  if (!query.trim()) recentPages.slice(0, 5).forEach(path => allItems.push({ kind: "recent", path }));
  functions.forEach(fn => allItems.push({ kind: "fn", fn }));
  records.slice(0, 6).forEach(record => allItems.push({ kind: "record", record }));

  useEffect(() => {
    if (open) {
      setQuery(""); setRecords([]); setActiveIdx(0);
      setRecentPages(getRecentPages());
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query.trim()) { setRecords([]); return; }
    debounceRef.current = setTimeout(async () => {
      setRecordsLoading(true);
      try {
        const token = getSearchToken();
        const res = await fetch(`/api/search?${new URLSearchParams({ q: query })}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          credentials: "include",
        });
        if (res.ok) { const data = await res.json(); setRecords(data.results ?? []); }
      } catch { setRecords([]); } finally { setRecordsLoading(false); }
    }, 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, open]);

  useEffect(() => { setActiveIdx(0); }, [query]);

  const handleSelect = useCallback((item: Item) => {
    if (item.kind === "fn") {
      if (item.fn.external) window.location.href = item.fn.path;
      else navigate(item.fn.path);
    } else if (item.kind === "record") {
      navigate(recordPath(item.record));
    } else {
      navigate(item.path);
    }
    onClose();
  }, [navigate, onClose]);

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") { onClose(); return; }
    if (e.key === "ArrowDown") { e.preventDefault(); setActiveIdx(i => Math.min(i + 1, allItems.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActiveIdx(i => Math.max(i - 1, 0)); }
    else if (e.key === "Enter") { e.preventDefault(); if (allItems[activeIdx]) handleSelect(allItems[activeIdx]); }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh]">
      <div className="absolute inset-0 bg-black/55 backdrop-blur-sm" onMouseDown={() => onClose()} />
      <div className="relative w-full max-w-xl mx-4 rounded-xl shadow-2xl overflow-hidden"
        style={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }}>
        <div className="flex items-center gap-2.5 px-4 py-3 border-b" style={{ borderColor: "hsl(var(--border))" }}>
          <Search className="w-4 h-4 text-muted-foreground shrink-0" />
          <input ref={inputRef} value={query} onChange={e => setQuery(e.target.value)} onKeyDown={onKeyDown}
            placeholder="Search community, members, announcements…"
            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none" />
          {recordsLoading && <Loader2 className="w-3.5 h-3.5 text-muted-foreground animate-spin shrink-0" />}
          {query && !recordsLoading && (
            <button onClick={() => setQuery("")} className="text-muted-foreground hover:text-foreground transition-colors">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
          <kbd className="hidden sm:inline-flex items-center text-[10px] text-muted-foreground bg-muted border border-border rounded px-1.5 py-0.5 font-mono shrink-0">ESC</kbd>
        </div>

        <div className="max-h-[420px] overflow-y-auto py-1.5">
          {allItems.length === 0 && query.trim() && !recordsLoading && (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              No results for <span className="font-medium text-foreground">"{query}"</span>
            </div>
          )}

          {!query.trim() && recentPages.length > 0 && (
            <>
              <p className="px-4 pt-1.5 pb-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Recent</p>
              {allItems.filter(i => i.kind === "recent").map((item, idx) => {
                if (item.kind !== "recent") return null;
                const isActive = activeIdx === idx;
                return (
                  <button key={`rec-${item.path}`}
                    className={["w-full flex items-center gap-3 px-4 py-2 text-sm text-left transition-colors",
                      isActive ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-accent/60"].join(" ")}
                    onMouseEnter={() => setActiveIdx(idx)} onClick={() => handleSelect(item)}>
                    <Clock className="w-3.5 h-3.5 shrink-0 opacity-60" />
                    <span>{pageLabelFor(item.path)}</span>
                    <span className="ml-auto text-[10px] opacity-50 font-mono">{item.path}</span>
                  </button>
                );
              })}
            </>
          )}

          {functions.length > 0 && (
            <>
              <p className="px-4 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                {query.trim() ? "Pages & Features" : "All Features"}
              </p>
              {functions.map((fn) => {
                const offset = allItems.findIndex(it => it.kind === "fn" && it.fn.path === fn.path);
                const isActive = activeIdx === offset;
                return (
                  <button key={`fn-${fn.path}`}
                    className={["w-full flex items-center gap-3 px-4 py-2 text-sm text-left transition-colors",
                      isActive ? "bg-accent text-accent-foreground" : "text-foreground hover:bg-accent/60"].join(" ")}
                    onMouseEnter={() => setActiveIdx(offset)} onClick={() => handleSelect({ kind: "fn", fn })}>
                    <div className="flex-1 min-w-0">
                      <span className="font-medium truncate block">{fn.label}</span>
                      <span className="text-[11px] text-muted-foreground truncate block">{fn.section}</span>
                    </div>
                    {fn.external ? <ExternalLink className="w-3 h-3 text-muted-foreground/40 shrink-0" /> :
                      <ArrowRight className="w-3 h-3 text-muted-foreground/40 shrink-0" />}
                  </button>
                );
              })}
            </>
          )}

          {records.length > 0 && (() => {
            const grouped = new Map<string, SearchRecord[]>();
            for (const r of records.slice(0, 20)) {
              if (!grouped.has(r.entityType)) grouped.set(r.entityType, []);
              grouped.get(r.entityType)!.push(r);
            }
            return [...grouped.entries()].map(([entityType, laneRecs]) => (
              <div key={`lane-${entityType}`}>
                <p className="px-4 pt-2 pb-0.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                  {ENTITY_LANE_LABELS[entityType] ?? entityType.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase())}
                </p>
                {laneRecs.slice(0, 3).map(r => {
                  const offset = allItems.findIndex(it => it.kind === "record" && it.record.entityId === r.entityId && it.record.entityType === r.entityType);
                  const isActive = activeIdx === offset;
                  const date = recordDate(r);
                  return (
                    <button key={`rec-${r.entityType}-${r.entityId}`}
                      className={["w-full flex items-center gap-3 px-4 py-1.5 text-sm text-left transition-colors",
                        isActive ? "bg-accent text-accent-foreground" : "text-foreground hover:bg-accent/60"].join(" ")}
                      onMouseEnter={() => setActiveIdx(offset)} onClick={() => handleSelect({ kind: "record", record: r })}>
                      <div className="flex-1 min-w-0">
                        <span className="truncate text-sm block">{r.content.substring(0, 80)}</span>
                        {date && <span className="text-[10px] text-muted-foreground">{date}</span>}
                      </div>
                      <ArrowRight className="w-3 h-3 text-muted-foreground/40 shrink-0" />
                    </button>
                  );
                })}
              </div>
            ));
          })()}
        </div>

        <div className="flex items-center gap-3 px-4 py-2 border-t text-[10px] text-muted-foreground" style={{ borderColor: "hsl(var(--border))" }}>
          <span><kbd className="font-mono">↑↓</kbd> navigate</span>
          <span><kbd className="font-mono">↵</kbd> select</span>
          <span><kbd className="font-mono">esc</kbd> close</span>
          <span className="ml-auto"><kbd className="font-mono">⌘K</kbd> anywhere</span>
        </div>
      </div>
    </div>
  );
}
