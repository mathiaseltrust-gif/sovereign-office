import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getCurrentBearerToken } from "@/components/auth-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Eye, Scale, AlertTriangle, BookOpen, MapPin, FileText, Layers,
  ShieldAlert, TreePine, Users, Plus, X, Edit2, Trash2, Loader2,
  ChevronDown, ChevronUp, Search, Library, Info,
  ArrowRight, Fingerprint,
} from "lucide-react";

// ── types ─────────────────────────────────────────────────────────────────────

type ExposureEvent = {
  id: number; title: string; short_name: string; category: string;
  year_start: number; year_end: number | null; affected_states: string[];
  impact_types: string[]; description: string; significance: string;
  legal_citation: string; source_url: string; is_custom: boolean;
};

type MatchRow = {
  ancestor_id: number; full_name: string; first_name: string; last_name: string;
  birth_year: number | null; death_year: number | null; tribal_nation: string | null;
  membership_status: string | null; is_ancestor: boolean; is_deceased: boolean;
  event_id: number; title: string; short_name: string; category: string;
  year_start: number; year_end: number | null; affected_states: string[];
  impact_types: string[]; description: string; significance: string;
  legal_citation: string; is_custom: boolean; location_match: boolean;
};

type AncestorGroup = {
  ancestor_id: number; full_name: string; first_name: string; last_name: string;
  birth_year: number | null; death_year: number | null; tribal_nation: string | null;
  events: MatchRow[];
};

type EventGroup = {
  event_id: number; title: string; short_name: string; category: string;
  year_start: number; year_end: number | null; significance: string;
  description: string; legal_citation: string; affected_states: string[];
  ancestors: MatchRow[];
};

type Stats = { ancestorCount: number; eventCount: number; matchedAncestorCount: number };

// ── category metadata ─────────────────────────────────────────────────────────

const CAT_META: Record<string, { label: string; color: string; bg: string; border: string; icon: typeof Scale }> = {
  federal_law:          { label: "Federal Indian Law",       color: "text-indigo-300", bg: "bg-indigo-950/60", border: "border-indigo-700/50", icon: BookOpen },
  racial_classification:{ label: "Racial Classification",    color: "text-orange-300", bg: "bg-orange-950/60", border: "border-orange-700/50", icon: Eye },
  removal:              { label: "Removal / Displacement",   color: "text-red-300",    bg: "bg-red-950/60",    border: "border-red-700/50",    icon: AlertTriangle },
  census:               { label: "Census / Record Label",    color: "text-yellow-300", bg: "bg-yellow-950/60", border: "border-yellow-700/50", icon: FileText },
  allotment:            { label: "Land Allotment",           color: "text-amber-300",  bg: "bg-amber-950/60",  border: "border-amber-700/50",  icon: MapPin },
  boarding_school:      { label: "Boarding School Era",      color: "text-rose-300",   bg: "bg-rose-950/60",   border: "border-rose-700/50",   icon: ShieldAlert },
  territory:            { label: "Territory / Geography",    color: "text-teal-300",   bg: "bg-teal-950/60",   border: "border-teal-700/50",   icon: MapPin },
  treaty:               { label: "Treaty / Political",       color: "text-blue-300",   bg: "bg-blue-950/60",   border: "border-blue-700/50",   icon: Scale },
};
const CAT_FALLBACK = { label: "Historical Event", color: "text-muted-foreground", bg: "bg-muted/40", border: "border-border", icon: Layers };

const SIG_META: Record<string, { label: string; dot: string; badge: string }> = {
  critical: { label: "Critical", dot: "bg-red-500",   badge: "bg-red-900/60 text-red-200 border-red-700/40" },
  high:     { label: "High",     dot: "bg-amber-400", badge: "bg-amber-900/60 text-amber-200 border-amber-700/40" },
  moderate: { label: "Moderate", dot: "bg-gray-500",  badge: "bg-muted/60 text-muted-foreground border-border" },
};

// ── helpers ───────────────────────────────────────────────────────────────────

async function authFetch(url: string, opts: RequestInit = {}) {
  const token = await getCurrentBearerToken();
  return fetch(url, {
    ...opts,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...opts.headers },
  });
}

function catMeta(cat: string) { return CAT_META[cat] ?? CAT_FALLBACK; }
function sigMeta(sig: string) { return SIG_META[sig] ?? SIG_META.moderate; }

function CatBadge({ category, size = "sm" }: { category: string; size?: "xs" | "sm" }) {
  const m = catMeta(category);
  const Icon = m.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-semibold ${m.bg} ${m.border} ${m.color} ${size === "xs" ? "text-[9px] px-1.5" : ""}`}>
      <Icon className="w-2.5 h-2.5" />{m.label}
    </span>
  );
}

function SigBadge({ significance }: { significance: string }) {
  const m = sigMeta(significance);
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[10px] font-semibold ${m.badge}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${m.dot}`} />
      {m.label}
    </span>
  );
}

function Sel({ value, onChange, options, placeholder }: { value: string; onChange: (v: string) => void; options: { value: string; label: string }[]; placeholder?: string }) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className="text-sm bg-muted/30 border border-border rounded-md px-3 py-1.5 text-foreground focus:outline-none focus:ring-1 focus:ring-amber-500/50"
    >
      {placeholder && <option value="">{placeholder}</option>}
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</label>
      {children}
    </div>
  );
}

function Modal({ title, subtitle, onClose, children }: { title: string; subtitle?: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-background border border-border rounded-xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between p-5 border-b border-border">
          <div>
            <h2 className="text-base font-semibold text-foreground">{title}</h2>
            {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground mt-0.5"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

// ── Ancestor Group Card ───────────────────────────────────────────────────────

function AncestorCard({ group }: { group: AncestorGroup }) {
  const [expanded, setExpanded] = useState(false);
  const critical = group.events.filter(e => e.significance === "critical");
  const high = group.events.filter(e => e.significance === "high");
  const mod = group.events.filter(e => e.significance === "moderate");
  const years = [group.birth_year, group.death_year].filter(Boolean).join(" – ") || "Years unknown";
  const cats = [...new Set(group.events.map(e => e.category))];

  return (
    <div className="bg-background/60 border border-border rounded-xl overflow-hidden hover:border-amber-700/30 transition-colors">
      <button
        onClick={() => setExpanded(x => !x)}
        className="w-full flex items-start justify-between p-4 text-left"
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="font-semibold text-foreground text-sm">{group.full_name}</span>
            <span className="text-xs text-muted-foreground">{years}</span>
            {group.tribal_nation && <span className="text-xs text-amber-400/70 italic truncate">{group.tribal_nation}</span>}
          </div>
          <div className="flex flex-wrap gap-1.5 mt-2">
            {cats.map(c => <CatBadge key={c} category={c} size="xs" />)}
          </div>
          <div className="flex gap-3 mt-2 text-xs">
            {critical.length > 0 && <span className="text-red-400 font-semibold">{critical.length} Critical</span>}
            {high.length > 0 && <span className="text-amber-400 font-medium">{high.length} High</span>}
            {mod.length > 0 && <span className="text-muted-foreground">{mod.length} Moderate</span>}
            <span className="text-muted-foreground ml-auto">{group.events.length} exposure event{group.events.length !== 1 ? "s" : ""}</span>
          </div>
        </div>
        <span className="shrink-0 ml-3 mt-0.5 text-muted-foreground">
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </span>
      </button>

      {expanded && (
        <div className="border-t border-border px-4 pb-4 space-y-3">
          {group.events.map(ev => {
            const m = catMeta(ev.category);
            const Icon = m.icon;
            return (
              <div key={ev.event_id} className={`rounded-lg border p-3 ${m.bg} ${m.border}`}>
                <div className="flex items-start justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Icon className={`w-3.5 h-3.5 shrink-0 ${m.color}`} />
                    <span className={`text-xs font-semibold ${m.color}`}>{ev.short_name || ev.title}</span>
                    <SigBadge significance={ev.significance} />
                    {ev.location_match && (
                      <span className="text-[10px] text-emerald-400 border border-emerald-700/30 bg-emerald-950/30 px-1.5 py-0.5 rounded-full">Location Match</span>
                    )}
                  </div>
                  <span className="text-[10px] text-muted-foreground shrink-0">
                    {ev.year_start}{ev.year_end && ev.year_end !== ev.year_start ? `–${ev.year_end}` : ""}
                  </span>
                </div>
                {ev.description && <p className="text-xs text-muted-foreground mt-2 leading-relaxed">{ev.description}</p>}
                <div className="flex flex-wrap gap-2 mt-2">
                  {(ev.impact_types as unknown as string[]).map((t: string) => (
                    <span key={t} className="text-[10px] bg-muted/30 border border-border px-1.5 py-0.5 rounded text-muted-foreground capitalize">{t.replace(/_/g, " ")}</span>
                  ))}
                </div>
                {ev.legal_citation && (
                  <p className="text-[10px] text-muted-foreground/60 mt-1.5 font-mono">{ev.legal_citation}</p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Event Group Card ──────────────────────────────────────────────────────────

function EventCard({ group }: { group: EventGroup }) {
  const [expanded, setExpanded] = useState(false);
  const m = catMeta(group.category);
  const Icon = m.icon;

  return (
    <div className={`rounded-xl border overflow-hidden ${m.border}`}>
      <button
        onClick={() => setExpanded(x => !x)}
        className={`w-full flex items-start justify-between p-4 text-left ${m.bg}`}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Icon className={`w-4 h-4 shrink-0 ${m.color}`} />
            <span className={`text-sm font-semibold ${m.color}`}>{group.short_name || group.title}</span>
            <SigBadge significance={group.significance} />
          </div>
          <div className="flex items-center gap-4 mt-1.5 text-xs text-muted-foreground">
            <span>{group.year_start}{group.year_end && group.year_end !== group.year_start ? `–${group.year_end}` : ""}</span>
            <span>{group.ancestors.length} ancestor{group.ancestors.length !== 1 ? "s" : ""} potentially affected</span>
          </div>
          {group.description && !expanded && (
            <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2">{group.description}</p>
          )}
        </div>
        <span className="shrink-0 ml-3 mt-0.5 text-muted-foreground">
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </span>
      </button>

      {expanded && (
        <div className="border-t border-border bg-background/60 px-4 pb-4 pt-3 space-y-3">
          {group.description && <p className="text-sm text-muted-foreground leading-relaxed">{group.description}</p>}
          {group.legal_citation && <p className="text-xs text-muted-foreground/60 font-mono">{group.legal_citation}</p>}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Ancestors Temporally Within Scope</p>
            <div className="flex flex-wrap gap-2">
              {group.ancestors.map(a => (
                <div key={a.ancestor_id} className="flex items-center gap-1.5 text-xs bg-muted/30 border border-border rounded-full px-2.5 py-1">
                  <span className="text-foreground font-medium">{a.full_name}</span>
                  {(a.birth_year || a.death_year) && (
                    <span className="text-muted-foreground">
                      {[a.birth_year, a.death_year].filter(Boolean).join("–")}
                    </span>
                  )}
                  {a.location_match && <span className="text-emerald-400">●</span>}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Custom Event Modal ────────────────────────────────────────────────────────

const EMPTY_EVENT = {
  title: "", shortName: "", category: "federal_law", yearStart: "",
  yearEnd: "", affectedStates: "", impactTypes: "", description: "",
  legalCitation: "", sourceUrl: "", significance: "high",
};

function EventFormModal({ event, onClose, onSaved }: {
  event?: ExposureEvent; onClose: () => void; onSaved: () => void;
}) {
  const [form, setForm] = useState(event ? {
    title: event.title, shortName: event.short_name ?? "",
    category: event.category, yearStart: String(event.year_start),
    yearEnd: event.year_end ? String(event.year_end) : "",
    affectedStates: (event.affected_states as unknown as string[]).join(", "),
    impactTypes: (event.impact_types as unknown as string[]).join(", "),
    description: event.description ?? "", legalCitation: event.legal_citation ?? "",
    sourceUrl: event.source_url ?? "", significance: event.significance ?? "high",
  } : { ...EMPTY_EVENT });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  async function save() {
    if (!form.title.trim()) { setErr("Title is required."); return; }
    if (!form.yearStart) { setErr("Start year is required."); return; }
    setErr(null); setSaving(true);
    try {
      const url = event ? `/api/ancestry/exposure/events/${event.id}` : "/api/ancestry/exposure/events";
      const res = await authFetch(url, { method: event ? "PUT" : "POST", body: JSON.stringify(form) });
      if (!res.ok) { setErr(`Save failed (${res.status}): ${await res.text()}`); return; }
      onSaved();
    } catch (e) { setErr(e instanceof Error ? e.message : "Unknown error"); } finally { setSaving(false); }
  }

  return (
    <Modal title={event ? "Edit Custom Event" : "Add Historical Event"} subtitle="Custom events added here are only used locally." onClose={onClose}>
      <div className="space-y-3">
        <Field label="Title"><Input value={form.title} onChange={set("title")} placeholder="e.g. Virginia Racial Integrity Act" /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Short Display Name"><Input value={form.shortName} onChange={set("shortName")} placeholder="Short name for badges" /></Field>
          <Field label="Category">
            <Sel value={form.category} onChange={v => setForm(f => ({ ...f, category: v }))}
              options={Object.entries(CAT_META).map(([k, v]) => ({ value: k, label: v.label }))} />
          </Field>
          <Field label="Start Year"><Input type="number" value={form.yearStart} onChange={set("yearStart")} placeholder="e.g. 1924" /></Field>
          <Field label="End Year (optional)"><Input type="number" value={form.yearEnd} onChange={set("yearEnd")} placeholder="leave blank if ongoing" /></Field>
          <Field label="Significance">
            <Sel value={form.significance} onChange={v => setForm(f => ({ ...f, significance: v }))}
              options={[{ value: "critical", label: "Critical" }, { value: "high", label: "High" }, { value: "moderate", label: "Moderate" }]} />
          </Field>
          <Field label="Affected States (CSV)"><Input value={form.affectedStates} onChange={set("affectedStates")} placeholder="VA, NC, GA  or  ALL" /></Field>
        </div>
        <Field label="Impact Types (CSV)"><Input value={form.impactTypes} onChange={set("impactTypes")} placeholder="racial_classification, land, identity, removal, citizenship, custody" /></Field>
        <Field label="Description"><Textarea value={form.description} onChange={set("description")} className="resize-none h-20" placeholder="What happened and why it matters genealogically…" /></Field>
        <Field label="Legal Citation"><Input value={form.legalCitation} onChange={set("legalCitation")} placeholder="e.g. 24 Stat. 388 (1887)" /></Field>
        <Field label="Source URL (optional)"><Input value={form.sourceUrl} onChange={set("sourceUrl")} placeholder="https://…" /></Field>
      </div>
      {err && <p className="mt-3 text-sm text-red-400 bg-red-900/20 border border-red-700/40 rounded px-3 py-2">{err}</p>}
      <div className="flex justify-end gap-2 mt-4">
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button onClick={save} disabled={saving} className="bg-amber-600 hover:bg-amber-700 text-white">
          {saving && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />}
          {event ? "Save Changes" : "Add Event"}
        </Button>
      </div>
    </Modal>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

const CATEGORY_OPTIONS = [
  { value: "all", label: "All Categories" },
  ...Object.entries(CAT_META).map(([k, v]) => ({ value: k, label: v.label })),
];

const SIGNIFICANCE_OPTIONS = [
  { value: "all", label: "All Significance Levels" },
  { value: "critical", label: "Critical Only" },
  { value: "high", label: "High or Above" },
  { value: "moderate", label: "Moderate" },
];

const IMPACT_OPTIONS = [
  { value: "all", label: "All Impact Types" },
  { value: "racial_classification", label: "Racial Classification" },
  { value: "land", label: "Land / Allotment" },
  { value: "removal", label: "Removal / Displacement" },
  { value: "citizenship", label: "Citizenship" },
  { value: "identity", label: "Identity / Records" },
  { value: "custody", label: "Custody / Children" },
  { value: "classification", label: "Classification" },
  { value: "mobility", label: "Mobility / Movement" },
];

export default function AncestralExposurePage() {
  const qc = useQueryClient();

  // Filters
  const [nameSearch, setNameSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [significance, setSignificance] = useState("all");
  const [impactType, setImpactType] = useState("all");
  const [stateFilter, setStateFilter] = useState("");
  const [locationOnly, setLocationOnly] = useState(false);
  const [view, setView] = useState<"ancestor" | "event" | "library">("ancestor");
  const [addEventModal, setAddEventModal] = useState(false);
  const [editEvent, setEditEvent] = useState<ExposureEvent | null>(null);
  const [deleting, setDeleting] = useState<number | null>(null);

  // Queries
  const statsQ = useQuery<Stats>({
    queryKey: ["exposure-stats"],
    queryFn: async () => {
      const token = await getCurrentBearerToken();
      const res = await fetch("/api/ancestry/exposure/stats", { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error(String(res.status));
      return res.json();
    },
  });

  const matchesQ = useQuery<MatchRow[]>({
    queryKey: ["exposure-matches", category, significance, impactType, stateFilter, nameSearch],
    queryFn: async () => {
      const token = await getCurrentBearerToken();
      const params = new URLSearchParams();
      if (category !== "all") params.set("category", category);
      if (significance !== "all") params.set("significance", significance);
      if (impactType !== "all") params.set("impactType", impactType);
      if (stateFilter.trim()) params.set("state", stateFilter.trim());
      if (nameSearch.trim()) params.set("nameSearch", nameSearch.trim());
      const res = await fetch(`/api/ancestry/exposure/matches?${params}`, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error(String(res.status));
      return res.json();
    },
  });

  const eventsQ = useQuery<ExposureEvent[]>({
    queryKey: ["exposure-events"],
    queryFn: async () => {
      const res = await fetch("/api/ancestry/exposure/events");
      if (!res.ok) throw new Error(String(res.status));
      return res.json();
    },
  });

  function refresh() {
    qc.invalidateQueries({ queryKey: ["exposure-matches"] });
    qc.invalidateQueries({ queryKey: ["exposure-events"] });
    qc.invalidateQueries({ queryKey: ["exposure-stats"] });
  }

  // Client-side filtering for location-only toggle
  const matches = useMemo(() => {
    const rows = matchesQ.data ?? [];
    return locationOnly ? rows.filter(r => r.location_match) : rows;
  }, [matchesQ.data, locationOnly]);

  // Group by ancestor
  const ancestorGroups = useMemo((): AncestorGroup[] => {
    const map = new Map<number, AncestorGroup>();
    for (const row of matches) {
      if (!map.has(row.ancestor_id)) {
        map.set(row.ancestor_id, {
          ancestor_id: row.ancestor_id, full_name: row.full_name,
          first_name: row.first_name, last_name: row.last_name,
          birth_year: row.birth_year, death_year: row.death_year,
          tribal_nation: row.tribal_nation, events: [],
        });
      }
      map.get(row.ancestor_id)!.events.push(row);
    }
    return Array.from(map.values()).sort((a, b) =>
      (a.last_name ?? a.full_name).localeCompare(b.last_name ?? b.full_name)
    );
  }, [matches]);

  // Group by event
  const eventGroups = useMemo((): EventGroup[] => {
    const map = new Map<number, EventGroup>();
    for (const row of matches) {
      if (!map.has(row.event_id)) {
        map.set(row.event_id, {
          event_id: row.event_id, title: row.title, short_name: row.short_name,
          category: row.category, year_start: row.year_start, year_end: row.year_end,
          significance: row.significance, description: row.description,
          legal_citation: row.legal_citation, affected_states: row.affected_states,
          ancestors: [],
        });
      }
      map.get(row.event_id)!.ancestors.push(row);
    }
    return Array.from(map.values()).sort((a, b) => {
      const so = { critical: 0, high: 1, moderate: 2 };
      return (so[a.significance as keyof typeof so] ?? 2) - (so[b.significance as keyof typeof so] ?? 2) || a.year_start - b.year_start;
    });
  }, [matches]);

  const stats = statsQ.data;
  const loading = matchesQ.isLoading;

  async function deleteEvent(id: number) {
    if (!confirm("Delete this custom event?")) return;
    setDeleting(id);
    try {
      await authFetch(`/api/ancestry/exposure/events/${id}`, { method: "DELETE" });
      refresh();
    } finally { setDeleting(null); }
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">

      {/* Header */}
      <div className="space-y-1">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-amber-900/30 border border-amber-700/40">
            <Fingerprint className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">Ancestral Exposure Filter</h1>
            <p className="text-xs text-muted-foreground">Continuity Impact Engine — Temporal & Jurisdictional Analysis</p>
          </div>
        </div>
        <p className="text-sm text-muted-foreground max-w-3xl ml-0 mt-2">
          Identifies which ancestors were alive during historical laws, racial classification acts, census reclassifications, removals, and federal Indian policy events — showing what forces may have acted upon them and disrupted their documented continuity.
        </p>
      </div>

      {/* Stats strip */}
      {stats && (
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-background/60 border border-border rounded-lg px-4 py-3 text-center">
            <p className="text-2xl font-bold text-foreground">{stats.ancestorCount}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Ancestors Documented</p>
          </div>
          <div className="bg-amber-950/30 border border-amber-700/30 rounded-lg px-4 py-3 text-center">
            <p className="text-2xl font-bold text-amber-300">{stats.matchedAncestorCount}</p>
            <p className="text-xs text-muted-foreground mt-0.5">With Exposure Matches</p>
          </div>
          <div className="bg-background/60 border border-border rounded-lg px-4 py-3 text-center">
            <p className="text-2xl font-bold text-foreground">{stats.eventCount}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Events in Historical Library</p>
          </div>
        </div>
      )}

      {/* Filter bar */}
      {(() => {
        const hasFilters = nameSearch || category !== "all" || significance !== "all" || impactType !== "all" || stateFilter || locationOnly;
        const clearAll = () => { setNameSearch(""); setCategory("all"); setSignificance("all"); setImpactType("all"); setStateFilter(""); setLocationOnly(false); };
        return (
          <div className="bg-muted/20 border border-border rounded-xl overflow-hidden">
            {/* Row 1 — name search */}
            <div className="flex items-center gap-2 px-4 py-3 border-b border-border/60">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <input
                  type="text"
                  value={nameSearch}
                  onChange={e => setNameSearch(e.target.value)}
                  placeholder="Search by ancestor name…"
                  className="w-full pl-8 pr-3 py-1.5 text-sm bg-background/60 border border-border rounded-md text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-amber-500/50"
                />
              </div>
              {hasFilters && (
                <button
                  onClick={clearAll}
                  className="shrink-0 text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 px-2 py-1.5 rounded border border-border hover:border-foreground/30 transition-colors"
                >
                  <X className="w-3 h-3" /> Clear filters
                </button>
              )}
            </div>

            {/* Row 2 — narrow filters */}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2.5">
              <Sel value={category} onChange={setCategory} options={CATEGORY_OPTIONS} />
              <Sel value={significance} onChange={setSignificance} options={SIGNIFICANCE_OPTIONS} />
              <Sel value={impactType} onChange={setImpactType} options={IMPACT_OPTIONS} />

              <div className="flex items-center gap-1.5 ml-auto">
                <input
                  type="text"
                  value={stateFilter}
                  onChange={e => setStateFilter(e.target.value)}
                  placeholder="State"
                  maxLength={2}
                  className="w-16 px-2 py-1.5 text-xs bg-muted/30 border border-border rounded-md text-foreground uppercase placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-amber-500/50"
                />
                <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer whitespace-nowrap">
                  <input type="checkbox" checked={locationOnly} onChange={e => setLocationOnly(e.target.checked)} className="accent-amber-500 w-3.5 h-3.5" />
                  Location match
                </label>
              </div>
            </div>
          </div>
        );
      })()}

      {/* View tabs */}
      <div className="flex items-center gap-1 bg-muted/20 border border-border rounded-lg p-1 w-fit">
        {([
          { id: "ancestor" as const, label: "By Ancestor", icon: Users },
          { id: "event"    as const, label: "By Event",    icon: Layers },
          { id: "library"  as const, label: "Event Library", icon: Library },
        ] as const).map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setView(id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${view === id ? "bg-amber-700 text-white" : "text-muted-foreground hover:text-foreground"}`}
          >
            <Icon className="w-3.5 h-3.5" />{label}
          </button>
        ))}
      </div>

      {/* Content */}
      {loading && (
        <div className="flex items-center justify-center py-16 text-muted-foreground gap-3">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span className="text-sm">Analyzing temporal exposure matches…</span>
        </div>
      )}

      {/* BY ANCESTOR VIEW */}
      {!loading && view === "ancestor" && (
        <div className="space-y-3">
          {ancestorGroups.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground border border-border rounded-xl">
              <TreePine className="w-10 h-10 mx-auto mb-3 text-amber-400/30" />
              <p className="font-medium">No exposure matches found</p>
              <p className="text-xs mt-1 max-w-xs mx-auto">
                {stats?.ancestorCount === 0
                  ? "No ancestors are documented in the registry yet. Add ancestors through the Family Tree or Lineage Registry."
                  : "No ancestors match the current filter criteria. Try broadening your filters."}
              </p>
            </div>
          ) : (
            <>
              <p className="text-xs text-muted-foreground">{ancestorGroups.length} ancestor{ancestorGroups.length !== 1 ? "s" : ""} · {matches.length} total exposure match{matches.length !== 1 ? "es" : ""} — click an ancestor to expand their events</p>
              {ancestorGroups.map(g => <AncestorCard key={g.ancestor_id} group={g} />)}
            </>
          )}
        </div>
      )}

      {/* BY EVENT VIEW */}
      {!loading && view === "event" && (
        <div className="space-y-3">
          {eventGroups.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground border border-border rounded-xl">
              <Layers className="w-10 h-10 mx-auto mb-3 text-amber-400/30" />
              <p className="font-medium">No events matched current filters</p>
            </div>
          ) : (
            <>
              <p className="text-xs text-muted-foreground">{eventGroups.length} event{eventGroups.length !== 1 ? "s" : ""} matched — click an event to see affected ancestors</p>
              {eventGroups.map(g => <EventCard key={g.event_id} group={g} />)}
            </>
          )}
        </div>
      )}

      {/* EVENT LIBRARY VIEW */}
      {!loading && view === "library" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">{(eventsQ.data ?? []).length} events in historical library</p>
            <Button onClick={() => setAddEventModal(true)} className="bg-amber-600 hover:bg-amber-700 text-white text-xs h-8">
              <Plus className="w-3.5 h-3.5 mr-1.5" /> Add Custom Event
            </Button>
          </div>

          <div className="space-y-2">
            {(eventsQ.data ?? []).map(ev => {
              const m = catMeta(ev.category);
              const Icon = m.icon;
              return (
                <div key={ev.id} className={`rounded-lg border p-3 ${m.bg} ${m.border}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Icon className={`w-3.5 h-3.5 shrink-0 ${m.color}`} />
                        <span className={`text-sm font-semibold ${m.color}`}>{ev.title}</span>
                        <SigBadge significance={ev.significance} />
                        {ev.is_custom && <span className="text-[10px] text-violet-300 border border-violet-700/30 bg-violet-950/30 px-1.5 py-0.5 rounded-full">Custom</span>}
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1 text-xs text-muted-foreground">
                        <span>{ev.year_start}{ev.year_end && ev.year_end !== ev.year_start ? `–${ev.year_end}` : ""}</span>
                        {(ev.affected_states as unknown as string[]).length > 0 && (
                          <span>{(ev.affected_states as unknown as string[]).join(", ")}</span>
                        )}
                        {(ev.impact_types as unknown as string[]).length > 0 && (
                          <span className="capitalize">{(ev.impact_types as unknown as string[]).slice(0, 3).map((t: string) => t.replace(/_/g, " ")).join(" · ")}</span>
                        )}
                      </div>
                      {ev.description && <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2">{ev.description}</p>}
                      {ev.legal_citation && <p className="text-[10px] text-muted-foreground/50 font-mono mt-1">{ev.legal_citation}</p>}
                    </div>
                    {ev.is_custom && (
                      <div className="flex items-center gap-1 shrink-0">
                        <button onClick={() => setEditEvent(ev)} className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground"><Edit2 className="w-3.5 h-3.5" /></button>
                        <button onClick={() => deleteEvent(ev.id)} disabled={deleting === ev.id} className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-red-400">
                          {deleting === ev.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Context note */}
          <div className="bg-blue-950/20 border border-blue-700/30 rounded-lg p-4 flex gap-3">
            <Info className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
            <div className="text-xs text-blue-200/80 space-y-1">
              <p className="font-semibold text-blue-300">About the Built-in Historical Library</p>
              <p>The 28 built-in events are drawn from federal statutes, state racial classification laws, census bureau historical records, and BIA policy history. They cannot be deleted — only custom events (added by your office) can be removed.</p>
              <p>Sources include: National Archives treaty catalog, Library of Congress Native American law guides, NPS/Library of Virginia records on the Racial Integrity Act, and the Dawes Commission rolls.</p>
            </div>
          </div>
        </div>
      )}

      {/* Modals */}
      {addEventModal && (
        <EventFormModal onClose={() => setAddEventModal(false)} onSaved={() => { setAddEventModal(false); refresh(); }} />
      )}
      {editEvent && (
        <EventFormModal event={editEvent} onClose={() => setEditEvent(null)} onSaved={() => { setEditEvent(null); refresh(); }} />
      )}
    </div>
  );
}
