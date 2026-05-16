import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { getCurrentBearerToken } from "@/components/auth-provider";
import {
  ArrowLeft, PlusCircle, Flame, Scale, AlertTriangle, BookOpen,
  MapPin, Users, FileText, Layers, Shield, Eye, X, ChevronDown, ChevronUp,
} from "lucide-react";

/* ─────────── types ─────────── */
interface Ancestor {
  id: number; fullName: string; firstName: string | null; lastName: string | null;
  birthYear: number | null; deathYear: number | null; tribalNation: string | null;
  photoUrl: string | null; notes: string | null; generationalPosition: number | null;
}
interface UserEvent {
  id: number; ancestorId: number; eventType: string; year: number | null;
  endYear: number | null; title: string; description: string | null;
  location: string | null; sourceType: string; sourceNote: string | null; createdAt: string;
}
interface HistoricalEvent {
  year: number; endYear?: number; title: string; description: string;
  category: "treaty" | "removal" | "racial_classification" | "federal_law" | "census" | "territory" | "pattern";
  citation?: string; significance?: "critical" | "high" | "moderate";
}
interface TimelineData { ancestor: Ancestor; userEvents: UserEvent[]; historicalEvents: HistoricalEvent[]; }

/* ─────────── helpers ─────────── */
const API = (path: string) => `/api${path}`;
async function apiFetch(path: string, opts: RequestInit = {}) {
  const token = await getCurrentBearerToken();
  const res = await fetch(API(path), {
    ...opts,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...opts.headers },
  });
  if (!res.ok) throw new Error(`${res.status}`);
  return res.json();
}

/* ─────────── styling maps ─────────── */
const CAT_META: Record<string, { label: string; color: string; bg: string; border: string; icon: typeof Scale }> = {
  treaty:               { label: "Treaty in Effect",          color: "text-blue-300",   bg: "bg-blue-950/60",   border: "border-blue-700/50",   icon: Scale },
  removal:              { label: "Removal / Displacement",    color: "text-red-300",    bg: "bg-red-950/60",    border: "border-red-700/50",    icon: AlertTriangle },
  racial_classification:{ label: "Racial Classification",     color: "text-orange-300", bg: "bg-orange-950/60", border: "border-orange-700/50", icon: Eye },
  federal_law:          { label: "Federal Indian Law",        color: "text-indigo-300", bg: "bg-indigo-950/60", border: "border-indigo-700/50", icon: BookOpen },
  census:               { label: "Census / Record Label",     color: "text-yellow-300", bg: "bg-yellow-950/60", border: "border-yellow-700/50", icon: FileText },
  territory:            { label: "Territory / Local",         color: "text-teal-300",   bg: "bg-teal-950/60",   border: "border-teal-700/50",   icon: MapPin },
  pattern:              { label: "Pattern of Interference",   color: "text-rose-200",   bg: "bg-rose-950/80",   border: "border-rose-600/60",   icon: Layers },
};
const SRC_META: Record<string, { label: string; color: string; bg: string; border: string }> = {
  life_event:  { label: "Life Event",          color: "text-amber-200",  bg: "bg-amber-950/50",  border: "border-amber-700/50" },
  birth:       { label: "Birth",               color: "text-amber-200",  bg: "bg-amber-950/50",  border: "border-amber-700/50" },
  death:       { label: "Death",               color: "text-amber-200",  bg: "bg-amber-950/50",  border: "border-amber-700/50" },
  marriage:    { label: "Marriage / Union",     color: "text-pink-300",   bg: "bg-pink-950/50",   border: "border-pink-700/50" },
  migration:   { label: "Migration",            color: "text-cyan-300",   bg: "bg-cyan-950/50",   border: "border-cyan-700/50" },
  land_record: { label: "Land / Property",      color: "text-yellow-300", bg: "bg-yellow-950/50", border: "border-yellow-700/50" },
  oral_history:{ label: "Oral History",         color: "text-purple-300", bg: "bg-purple-950/50", border: "border-purple-700/50" },
  document:    { label: "Document",             color: "text-sky-300",    bg: "bg-sky-950/50",    border: "border-sky-700/50" },
  territory:   { label: "Place & Territory",    color: "text-teal-300",   bg: "bg-teal-950/50",   border: "border-teal-700/50" },
  continuity:  { label: "Continuity Evidence",  color: "text-green-300",  bg: "bg-green-950/50",  border: "border-green-700/50" },
  restoration: { label: "Restoration / Rights", color: "text-emerald-300",bg: "bg-emerald-950/50",border: "border-emerald-700/50" },
  other:       { label: "Other",                color: "text-slate-300",  bg: "bg-slate-900/50",  border: "border-slate-700/50" },
};
const SIG_BADGE: Record<string, string> = {
  critical: "bg-rose-900/80 text-rose-200 border-rose-600",
  high:     "bg-amber-900/60 text-amber-200 border-amber-600",
  moderate: "bg-slate-800 text-slate-300 border-slate-600",
};

const LEFT_SOURCES  = ["life_event","birth","death","marriage","migration","land_record","oral_history","document","territory","continuity","restoration","other"];
const BOTTOM_SOURCES = ["continuity","restoration"];

/* ─────────── HistoricalEventCard ─────────── */
function HistoricalEventCard({ ev }: { ev: HistoricalEvent }) {
  const [open, setOpen] = useState(false);
  const meta = CAT_META[ev.category] ?? CAT_META.federal_law;
  const Icon = meta.icon;
  return (
    <div className={`rounded-lg border p-3 ${meta.bg} ${meta.border} text-sm`}>
      <div className="flex items-start gap-2 cursor-pointer" onClick={() => setOpen(v => !v)}>
        <Icon className={`w-3.5 h-3.5 mt-0.5 flex-shrink-0 ${meta.color}`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`font-medium ${meta.color} leading-snug`}>{ev.title}</span>
            {ev.significance && (
              <Badge className={`text-[10px] px-1.5 py-0 border ${SIG_BADGE[ev.significance]}`}>
                {ev.significance}
              </Badge>
            )}
          </div>
          <span className="text-slate-400 text-xs">{ev.year}{ev.endYear && ev.endYear !== ev.year ? `–${ev.endYear}` : ""}</span>
        </div>
        {open ? <ChevronUp className="w-3 h-3 text-slate-500 flex-shrink-0 mt-0.5" /> : <ChevronDown className="w-3 h-3 text-slate-500 flex-shrink-0 mt-0.5" />}
      </div>
      {open && (
        <div className="mt-2 pl-5 space-y-1.5">
          <p className="text-slate-300 text-xs leading-relaxed">{ev.description}</p>
          {ev.citation && <p className="text-slate-500 text-[11px] italic">{ev.citation}</p>}
        </div>
      )}
    </div>
  );
}

/* ─────────── UserEventCard ─────────── */
function UserEventCard({ ev, onDelete }: { ev: UserEvent; onDelete: () => void }) {
  const [open, setOpen] = useState(false);
  const meta = SRC_META[ev.sourceType] ?? SRC_META.other;
  return (
    <div className={`rounded-lg border p-3 ${meta.bg} ${meta.border} text-sm`}>
      <div className="flex items-start gap-2 cursor-pointer" onClick={() => setOpen(v => !v)}>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`font-medium ${meta.color} leading-snug`}>{ev.title}</span>
            <Badge className="text-[10px] px-1.5 py-0 bg-slate-800 border-slate-600 text-slate-300">{meta.label}</Badge>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
            {ev.year && <span>{ev.year}{ev.endYear && ev.endYear !== ev.year ? `–${ev.endYear}` : ""}</span>}
            {ev.location && <span>· {ev.location}</span>}
          </div>
        </div>
        <div className="flex items-center gap-1">
          {open ? <ChevronUp className="w-3 h-3 text-slate-500" /> : <ChevronDown className="w-3 h-3 text-slate-500" />}
          <button
            onClick={e => { e.stopPropagation(); onDelete(); }}
            className="text-slate-600 hover:text-rose-400 transition-colors p-0.5"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      </div>
      {open && ev.description && (
        <div className="mt-2 space-y-1">
          <p className="text-slate-300 text-xs leading-relaxed">{ev.description}</p>
          {ev.sourceNote && <p className="text-slate-500 text-[11px] italic">Source: {ev.sourceNote}</p>}
        </div>
      )}
    </div>
  );
}

/* ─────────── AddEventForm ─────────── */
function AddEventForm({ ancestorId, onDone }: { ancestorId: number; onDone: () => void }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [form, setForm] = useState({
    sourceType: "life_event", eventType: "life_event", year: "", endYear: "",
    title: "", description: "", location: "", sourceNote: "",
  });

  const mut = useMutation({
    mutationFn: async () =>
      apiFetch(`/ancestral-timeline/${ancestorId}/events`, {
        method: "POST",
        body: JSON.stringify({
          eventType: form.eventType || form.sourceType,
          year: form.year || null,
          endYear: form.endYear || null,
          title: form.title,
          description: form.description || null,
          location: form.location || null,
          sourceType: form.sourceType,
          sourceNote: form.sourceNote || null,
        }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ancestral-timeline", ancestorId] });
      toast({ title: "Event recorded", description: `"${form.title}" added to the timeline.` });
      onDone();
    },
    onError: () => toast({ title: "Error", description: "Could not save event.", variant: "destructive" }),
  });

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs text-slate-300 mb-1 block">Event Category *</Label>
          <Select value={form.sourceType} onValueChange={v => setForm(f => ({ ...f, sourceType: v, eventType: v }))}>
            <SelectTrigger className="bg-slate-900 border-slate-600 text-slate-200 h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(SRC_META).map(([k, v]) => (
                <SelectItem key={k} value={k} className="text-xs">{v.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs text-slate-300 mb-1 block">Year</Label>
          <Input value={form.year} onChange={set("year")} placeholder="e.g. 1842" className="bg-slate-900 border-slate-600 text-slate-200 h-8 text-xs" />
        </div>
      </div>
      <div>
        <Label className="text-xs text-slate-300 mb-1 block">Title *</Label>
        <Input value={form.title} onChange={set("title")} placeholder="Brief description of the event" className="bg-slate-900 border-slate-600 text-slate-200 h-8 text-xs" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs text-slate-300 mb-1 block">End Year (if span)</Label>
          <Input value={form.endYear} onChange={set("endYear")} placeholder="optional" className="bg-slate-900 border-slate-600 text-slate-200 h-8 text-xs" />
        </div>
        <div>
          <Label className="text-xs text-slate-300 mb-1 block">Location</Label>
          <Input value={form.location} onChange={set("location")} placeholder="County, State" className="bg-slate-900 border-slate-600 text-slate-200 h-8 text-xs" />
        </div>
      </div>
      <div>
        <Label className="text-xs text-slate-300 mb-1 block">Details</Label>
        <Textarea value={form.description} onChange={set("description")} placeholder="What happened? What was its significance?" className="bg-slate-900 border-slate-600 text-slate-200 text-xs min-h-[72px] resize-none" />
      </div>
      <div>
        <Label className="text-xs text-slate-300 mb-1 block">Source / Citation</Label>
        <Input value={form.sourceNote} onChange={set("sourceNote")} placeholder="Document name, oral account, census record, etc." className="bg-slate-900 border-slate-600 text-slate-200 h-8 text-xs" />
      </div>
      <div className="flex gap-2">
        <Button size="sm" onClick={() => mut.mutate()} disabled={!form.title || mut.isPending} className="bg-amber-700 hover:bg-amber-600 text-white text-xs h-7">
          {mut.isPending ? "Saving…" : "Add to Timeline"}
        </Button>
        <Button size="sm" variant="ghost" onClick={onDone} className="text-xs h-7 text-slate-400">Cancel</Button>
      </div>
    </div>
  );
}

/* ─────────── Section heading ─────────── */
function SectionHeading({ icon: Icon, label, color, count }: { icon: typeof Scale; label: string; color: string; count?: number }) {
  return (
    <div className={`flex items-center gap-2 mb-3 pb-2 border-b border-slate-700/50`}>
      <Icon className={`w-4 h-4 ${color}`} />
      <span className={`text-sm font-semibold tracking-wide ${color}`}>{label}</span>
      {count !== undefined && <Badge className="ml-auto text-[10px] px-1.5 bg-slate-800 border-slate-700 text-slate-400">{count}</Badge>}
    </div>
  );
}

/* ─────────── EventGroup ─────────── */
function EventGroup<T>({ items, renderItem, emptyMsg }: { items: T[]; renderItem: (item: T, i: number) => React.ReactNode; emptyMsg: string }) {
  return items.length === 0
    ? <p className="text-xs text-slate-600 italic py-2">{emptyMsg}</p>
    : <div className="space-y-2">{items.map(renderItem)}</div>;
}

/* ─────────── Main page ─────────── */
export default function AncestralTimelinePage() {
  const { id } = useParams<{ id: string }>();
  const ancestorId = parseInt(id ?? "0", 10);
  const { toast } = useToast();
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);

  const { data, isLoading } = useQuery<TimelineData>({
    queryKey: ["ancestral-timeline", ancestorId],
    queryFn: () => apiFetch(`/ancestral-timeline/${ancestorId}`),
    enabled: !isNaN(ancestorId) && ancestorId > 0,
  });

  const deleteMut = useMutation({
    mutationFn: (eventId: number) =>
      apiFetch(`/ancestral-timeline/${ancestorId}/events/${eventId}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ancestral-timeline", ancestorId] });
      toast({ title: "Event removed" });
    },
  });

  if (isLoading) return (
    <div className="space-y-4">
      {[1,2,3].map(i => <Skeleton key={i} className="h-24 w-full" />)}
    </div>
  );
  if (!data) return (
    <div className="text-muted-foreground text-sm py-8 text-center">
      Ancestor not found or unable to load timeline.
    </div>
  );

  const { ancestor, userEvents, historicalEvents } = data;
  const lifespan = ancestor.birthYear || ancestor.deathYear
    ? `${ancestor.birthYear ?? "?"}–${ancestor.deathYear ?? "Living"}`
    : null;

  /* ── partition user events by sourceType ── */
  const evBy = (types: string[]) => userEvents.filter(e => types.includes(e.sourceType));
  const lifeEvents   = evBy(["life_event","birth","death","marriage","migration","other"]);
  const placeEvents  = evBy(["territory"]);
  const landEvents   = evBy(["land_record"]);
  const oralEvents   = evBy(["oral_history","document"]);
  const contEvents   = evBy(["continuity"]);
  const restEvents   = evBy(["restoration"]);

  /* ── partition historical events by category ── */
  const hBy = (cats: string[]) => historicalEvents.filter(e => cats.includes(e.category))
    .sort((a, b) => a.year - b.year);

  const treaties    = hBy(["treaty"]);
  const removals    = hBy(["removal"]);
  const racial      = hBy(["racial_classification"]);
  const fedLaw      = hBy(["federal_law"]);
  const census      = hBy(["census"]);
  const territory   = hBy(["territory"]);
  const patterns    = hBy(["pattern"]);

  const totalUserEvents = userEvents.length;
  const totalHistorical = historicalEvents.length;

  return (
    <div className="space-y-6 pb-12">

      {/* ── Back nav ── */}
      <div className="flex items-center gap-3">
        <Link to={`/ancestors/${ancestorId}`} className="text-sm text-muted-foreground hover:underline flex items-center gap-1">
          <ArrowLeft className="w-3 h-3" /> Back to Memorial
        </Link>
        <span className="text-slate-700">·</span>
        <Link to="/ancestors" className="text-sm text-muted-foreground hover:underline">All Ancestors</Link>
      </div>

      {/* ── Hero banner ── */}
      <div
        className="rounded-2xl overflow-hidden shadow-xl"
        style={{ background: "linear-gradient(135deg, #080c1a 0%, #0d1433 40%, #0a0f1e 100%)", border: "1px solid #1e2a4a" }}
      >
        <div className="p-6">
          <div className="flex items-start gap-5">
            {ancestor.photoUrl ? (
              <div className="w-20 h-24 rounded-xl overflow-hidden flex-shrink-0 border border-indigo-700/40">
                <img src={ancestor.photoUrl} alt={ancestor.fullName} className="w-full h-full object-cover" />
              </div>
            ) : (
              <div className="w-20 h-24 rounded-xl bg-indigo-900/30 flex items-center justify-center flex-shrink-0 border border-indigo-800/40">
                <Flame className="w-7 h-7 text-indigo-400/60" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium tracking-[0.2em] text-indigo-400/70 uppercase mb-1">Ancestral Continuity Timeline</p>
              <h1 className="text-2xl font-serif font-bold text-indigo-100 leading-tight">{ancestor.fullName}</h1>
              {lifespan && <p className="text-indigo-300/60 text-sm mt-1">{lifespan}</p>}
              {ancestor.tribalNation && <p className="text-indigo-200/40 text-sm">{ancestor.tribalNation}</p>}
              <p className="text-xs text-indigo-300/50 mt-3 max-w-xl leading-relaxed">
                This timeline places {ancestor.firstName ?? "this ancestor"} beside the laws, treaties, removals, and racial classifications that acted upon them during their lifetime. Identity loss in records is not proof of nonexistence — it is evidence of interruption.
              </p>
            </div>
            <div className="text-right flex-shrink-0 space-y-1">
              <div className="text-indigo-300/60 text-xs">{totalHistorical} historical events</div>
              <div className="text-indigo-300/60 text-xs">{totalUserEvents} recorded events</div>
              <Button
                size="sm"
                onClick={() => setShowForm(v => !v)}
                className="mt-2 bg-indigo-800/60 hover:bg-indigo-700 text-indigo-100 border border-indigo-600/50 text-xs h-7"
                variant="outline"
              >
                <PlusCircle className="w-3 h-3 mr-1" />
                Add Event
              </Button>
            </div>
          </div>
        </div>

        {/* Add event form */}
        {showForm && (
          <div className="border-t border-indigo-900/60 bg-slate-900/80 p-5">
            <p className="text-xs font-semibold text-indigo-300 mb-4 tracking-wide uppercase">Record a Life Event, Oral History, or Document</p>
            <AddEventForm ancestorId={ancestorId} onDone={() => setShowForm(false)} />
          </div>
        )}
      </div>

      {/* ── Interpretive note ── */}
      <div className="rounded-xl border border-rose-800/30 bg-rose-950/20 p-4">
        <div className="flex items-start gap-3">
          <Layers className="w-4 h-4 text-rose-400 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-xs font-semibold text-rose-300 mb-1">Foundational Interpretive Principle</p>
            <p className="text-xs text-rose-200/70 leading-relaxed">
              This system does not treat identity loss as proof of nonexistence. Misclassification, displacement, name changes, census relabeling, and jurisdictional shifts are flagged as possible evidence of <em>interruption</em>, not extinction. Each gap in the record is itself documentation of a harm that occurred.
            </p>
          </div>
        </div>
      </div>

      {/* ── Main two-column timeline ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* ── LEFT: Ancestor's Life ── */}
        <div className="space-y-5">
          <div className="flex items-center gap-2 pb-2 border-b border-amber-800/30">
            <div className="w-2 h-2 rounded-full bg-amber-500"></div>
            <h2 className="text-sm font-bold text-amber-300 tracking-wide uppercase">The Ancestor's Record</h2>
            <span className="text-xs text-amber-700 ml-1">What they lived</span>
          </div>

          {/* Life Events */}
          <div className="rounded-xl border border-amber-800/30 bg-amber-950/20 p-4">
            <SectionHeading icon={Flame} label="Life Events" color="text-amber-300" count={lifeEvents.length} />
            <EventGroup
              items={lifeEvents}
              renderItem={(ev, i) => <UserEventCard key={ev.id} ev={ev} onDelete={() => deleteMut.mutate(ev.id)} />}
              emptyMsg="No life events recorded yet. Add births, deaths, marriages, migrations, and key moments."
            />
          </div>

          {/* Place & Territory */}
          <div className="rounded-xl border border-teal-800/30 bg-teal-950/20 p-4">
            <SectionHeading icon={MapPin} label="Place & Territory" color="text-teal-300" count={placeEvents.length} />
            <EventGroup
              items={placeEvents}
              renderItem={(ev, i) => <UserEventCard key={ev.id} ev={ev} onDelete={() => deleteMut.mutate(ev.id)} />}
              emptyMsg="No place or territory records yet. Add counties, homesteads, territories, and known locations."
            />
          </div>

          {/* Land & Property */}
          <div className="rounded-xl border border-yellow-800/30 bg-yellow-950/20 p-4">
            <SectionHeading icon={FileText} label="Land & Property Records" color="text-yellow-300" count={landEvents.length} />
            <EventGroup
              items={landEvents}
              renderItem={(ev, i) => <UserEventCard key={ev.id} ev={ev} onDelete={() => deleteMut.mutate(ev.id)} />}
              emptyMsg="No land records yet. Add deeds, tax records, allotment documents, or inheritance records."
            />
          </div>

          {/* Oral History */}
          <div className="rounded-xl border border-purple-800/30 bg-purple-950/20 p-4">
            <SectionHeading icon={Users} label="Family Oral History" color="text-purple-300" count={oralEvents.length} />
            <EventGroup
              items={oralEvents}
              renderItem={(ev, i) => <UserEventCard key={ev.id} ev={ev} onDelete={() => deleteMut.mutate(ev.id)} />}
              emptyMsg="No oral history or documents recorded yet. Add stories, photographs, letters, or family accounts."
            />
          </div>
        </div>

        {/* ── RIGHT: The World Acting ── */}
        <div className="space-y-5">
          <div className="flex items-center gap-2 pb-2 border-b border-indigo-800/30">
            <div className="w-2 h-2 rounded-full bg-indigo-500"></div>
            <h2 className="text-sm font-bold text-indigo-300 tracking-wide uppercase">The World Acting on Them</h2>
            <span className="text-xs text-indigo-700 ml-1">Laws, removals, and classifications</span>
          </div>

          {/* Treaties */}
          <div className="rounded-xl border border-blue-800/30 bg-blue-950/20 p-4">
            <SectionHeading icon={Scale} label="Treaties in Effect" color="text-blue-300" count={treaties.length} />
            <EventGroup
              items={treaties}
              renderItem={(ev, i) => <HistoricalEventCard key={i} ev={ev} />}
              emptyMsg="No treaties matched this ancestor's lifetime."
            />
          </div>

          {/* Removal */}
          <div className="rounded-xl border border-red-800/30 bg-red-950/20 p-4">
            <SectionHeading icon={AlertTriangle} label="Removal & Displacement Events" color="text-red-300" count={removals.length} />
            <EventGroup
              items={removals}
              renderItem={(ev, i) => <HistoricalEventCard key={i} ev={ev} />}
              emptyMsg="No removal events matched this ancestor's lifetime."
            />
          </div>

          {/* Racial Classification */}
          <div className="rounded-xl border border-orange-800/30 bg-orange-950/20 p-4">
            <SectionHeading icon={Eye} label="Racial Classification Events" color="text-orange-300" count={racial.length} />
            <EventGroup
              items={racial}
              renderItem={(ev, i) => <HistoricalEventCard key={i} ev={ev} />}
              emptyMsg="No racial classification events matched this ancestor's lifetime."
            />
          </div>

          {/* Federal Law */}
          <div className="rounded-xl border border-indigo-800/30 bg-indigo-950/20 p-4">
            <SectionHeading icon={BookOpen} label="Federal Indian Law Context" color="text-indigo-300" count={fedLaw.length} />
            <EventGroup
              items={fedLaw}
              renderItem={(ev, i) => <HistoricalEventCard key={i} ev={ev} />}
              emptyMsg="No federal Indian law events matched this ancestor's lifetime."
            />
          </div>

          {/* Census */}
          <div className="rounded-xl border border-yellow-800/30 bg-yellow-950/20 p-4">
            <SectionHeading icon={FileText} label="Census & Record Labels" color="text-yellow-300" count={census.length} />
            <EventGroup
              items={census}
              renderItem={(ev, i) => <HistoricalEventCard key={i} ev={ev} />}
              emptyMsg="No census events matched this ancestor's lifetime."
            />
          </div>

          {/* Territory */}
          {territory.length > 0 && (
            <div className="rounded-xl border border-teal-800/30 bg-teal-950/20 p-4">
              <SectionHeading icon={MapPin} label="Territory & Local Context" color="text-teal-300" count={territory.length} />
              <EventGroup
                items={territory}
                renderItem={(ev, i) => <HistoricalEventCard key={i} ev={ev} />}
                emptyMsg=""
              />
            </div>
          )}
        </div>
      </div>

      {/* ── Bottom: Pattern Recognition Layer ── */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 pb-2 border-b border-rose-800/30">
          <div className="w-2 h-2 rounded-full bg-rose-500"></div>
          <h2 className="text-sm font-bold text-rose-300 tracking-wide uppercase">Pattern Recognition Layer</h2>
          <span className="text-xs text-rose-700 ml-1">Repeated harms and continuity evidence</span>
        </div>

        {/* Pattern of Interference */}
        <div className="rounded-xl border border-rose-800/40 bg-rose-950/25 p-4">
          <SectionHeading icon={Layers} label="Pattern of Interference" color="text-rose-300" count={patterns.length} />
          <p className="text-xs text-rose-200/60 mb-3 leading-relaxed">
            These are documented patterns of administrative harm — misclassification, land loss, displacement, denial of status, and identity erasure — that occurred during or adjacent to this ancestor's lifetime. They are presented as evidence of what the law did, not evidence of who this ancestor was.
          </p>
          <EventGroup
            items={patterns}
            renderItem={(ev, i) => <HistoricalEventCard key={i} ev={ev} />}
            emptyMsg="No pattern events matched this ancestor's lifetime."
          />
        </div>

        {/* Continuity Evidence */}
        <div className="rounded-xl border border-green-800/40 bg-green-950/20 p-4">
          <SectionHeading icon={Shield} label="Continuity Evidence" color="text-green-300" count={contEvents.length} />
          <p className="text-xs text-green-200/60 mb-3 leading-relaxed">
            Evidence that identity persisted despite displacement, reclassification, or administrative gaps. Add DNA findings, oral accounts of self-identification, community recognition, photographs, land ties, or other documentation showing continuity across the interruption.
          </p>
          <EventGroup
            items={contEvents}
            renderItem={(ev, i) => <UserEventCard key={ev.id} ev={ev} onDelete={() => deleteMut.mutate(ev.id)} />}
            emptyMsg="No continuity evidence recorded yet. Add community recognition, oral identification, DNA records, or other evidence."
          />
        </div>

        {/* Restoration / Present Rights */}
        <div className="rounded-xl border border-emerald-800/40 bg-emerald-950/20 p-4">
          <SectionHeading icon={Scale} label="Restoration & Present Rights" color="text-emerald-300" count={restEvents.length} />
          <p className="text-xs text-emerald-200/60 mb-3 leading-relaxed">
            Present-day rights, tribal court records, member status, treaty remedies, and federal provisions that apply to this lineage today. Connect the ancestor's documented life to present-day self-determination standing.
          </p>
          <EventGroup
            items={restEvents}
            renderItem={(ev, i) => <UserEventCard key={ev.id} ev={ev} onDelete={() => deleteMut.mutate(ev.id)} />}
            emptyMsg="No restoration or rights records yet. Add present-day status, tribunal acknowledgments, or applicable treaty remedies."
          />
        </div>
      </div>

      {/* ── Footer principle ── */}
      <div
        className="rounded-xl p-5 text-center"
        style={{ background: "linear-gradient(135deg, #080c1a 0%, #0d1433 100%)", border: "1px solid #1e2a4a" }}
      >
        <p className="text-xs text-indigo-300/60 leading-relaxed max-w-2xl mx-auto italic">
          "This timeline exists to restore context. Our ancestors did not disappear — many were displaced, renamed, reclassified, absorbed, hidden, or administratively misread. By placing each ancestor beside the laws and events of their time, the member can see the living pattern of continuity and the source of present-day self-determination."
        </p>
        <p className="text-[11px] text-indigo-400/40 mt-2">— Mathias El Tribe · Office of the Chief Justice & Trustee</p>
      </div>

    </div>
  );
}
