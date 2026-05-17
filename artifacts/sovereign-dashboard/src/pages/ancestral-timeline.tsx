import { useState, useEffect } from "react";
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
  Gavel, TrendingDown, Fingerprint, Building2, ShieldAlert, HandHeart,
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

/* ─────────── Rights analysis data ─────────── */
interface Era {
  name: string; years: string; start: number; end: number;
  trustRightsInForce: string;
  violations: { type: "land" | "identity" | "trust" | "governance"; event: string; legalBasis: string; canon: string; }[];
  continuingImpact: string;
}

const ALL_ERAS: Era[] = [
  {
    name: "Treaty & Sovereign Recognition Era",
    years: "1778–1830", start: 1778, end: 1830,
    trustRightsInForce: "Federal treaties with Indigenous nations were recognized as supreme law under Article VI of the Constitution. Tribal sovereignty was acknowledged by the federal government through nation-to-nation treaty-making. No authority existed to unilaterally extinguish treaty rights.",
    violations: [
      { type: "land", event: "Systematic land cessions obtained through coercive negotiation, often with unrepresentative signatories", legalBasis: "Marshall Trilogy (1823–1832) established discovery doctrine over tribal consent", canon: "Ambiguities in treaties must be resolved in favor of the Indians — Jones v. Meehan (1899)" },
      { type: "governance", event: "State governments began asserting jurisdiction over tribal lands in violation of federal treaty supremacy", legalBasis: "Worcester v. Georgia (1832) later ruled this unconstitutional — but enforcement failed", canon: "Tribal rights are not diminished by implication — Minnesota v. Mille Lacs Band (1999)" },
    ],
    continuingImpact: "Treaties signed in this era carry legal force today under the Supremacy Clause. Rights promised then — hunting, fishing, territory — have never been lawfully extinguished and remain active claims.",
  },
  {
    name: "Forced Removal Era",
    years: "1830–1861", start: 1830, end: 1861,
    trustRightsInForce: "The Indian Removal Act of 1830 authorized removal but did not extinguish treaty rights. The federal trust responsibility — the duty to protect Indigenous peoples and their property — was implicitly in force through prior treaties.",
    violations: [
      { type: "land", event: "Forced removal from ancestral homelands under military threat; treaty provisions for land equivalency rarely honored", legalBasis: "Indian Removal Act (1830) — used to coerce treaty 'negotiations' that were not voluntary", canon: "Treaties are to be construed as the Indians understood them — Washington v. Washington Passenger Fishing Vessel Assn. (1979)" },
      { type: "identity", event: "Census records during and after removal reclassified displaced Indigenous peoples as 'Free Colored,' 'Mulatto,' or 'White' when tribal structures were disrupted", legalBasis: "No federal law authorized these reclassifications — they were administrative acts of erasure", canon: "Statutes passed for the benefit of Indians are to be construed liberally — Montana v. Blackfeet Tribe (1985)" },
      { type: "trust", event: "Federal agents responsible for managing removal funds and annuities committed widespread fraud; trust responsibility was systematically breached", legalBasis: "Seminole Nation v. United States (1942): the government owes the highest fiduciary duty to Indigenous peoples", canon: "The trust responsibility requires the government to act in the Indians' best interest — United States v. Mitchell (1983)" },
    ],
    continuingImpact: "Reclassifications made during removal are precisely why records show ancestors as 'non-Indian.' These are not identity — they are evidence of interruption and administrative harm.",
  },
  {
    name: "Allotment & Assimilation Era",
    years: "1887–1934", start: 1887, end: 1934,
    trustRightsInForce: "Despite trust obligations, the Dawes General Allotment Act was enacted to fragment communal tribal lands. Federal courts had recognized tribal status as a political classification, not racial — yet assimilation policy operated on racial erasure.",
    violations: [
      { type: "land", event: "Approximately 90 million acres of tribal land taken through allotment, surplus land sales, and fee-patent conversions", legalBasis: "Dawes Act (1887); Burke Act (1906) — enabled rapid transfer of allotted lands out of trust", canon: "Rights reserved to Indians in a treaty or statute are not to be diminished by implication" },
      { type: "identity", event: "Dawes Rolls created racial and political classifications that permanently tied Indigenous identity to federal enrollment lists, erasing peoples not on the rolls", legalBasis: "No constitutional authority authorized making the Rolls the sole legal definition of Indigenous identity", canon: "Treaties are construed as the Indians understood them — federal enrollment was not the Indian understanding of tribal membership" },
      { type: "trust", event: "Allotment funds held in trust were mismanaged across generations — a breach not resolved until Cobell v. Salazar (2009) settlement of $3.4 billion", legalBasis: "United States v. Mitchell I & II (1980, 1983) confirmed full fiduciary duty over Individual Indian Money accounts", canon: "The government owes the highest fiduciary obligations to Indigenous peoples — Seminole Nation v. United States (1942)" },
      { type: "governance", event: "Indian boarding schools operated to eliminate language, ceremony, and governance structures — a direct attack on tribal self-governance", legalBasis: "No statutory authority existed to compel cultural erasure — these were executive branch policy actions without tribal consent", canon: "Tribal self-governance rights are inherent, not granted — United States v. Wheeler (1978)" },
    ],
    continuingImpact: "The Dawes Rolls-as-identity framework still restricts tribal membership claims today. Cobell confirmed the trust breaches were real. Boarding school records are being used in present-day healing and sovereignty proceedings.",
  },
  {
    name: "Termination Era",
    years: "1953–1968", start: 1953, end: 1968,
    trustRightsInForce: "House Concurrent Resolution 108 (1953) declared a policy of 'terminating' the federal-tribal relationship for specific tribes — but no act of Congress could unilaterally extinguish treaty rights, which are supreme law.",
    violations: [
      { type: "trust", event: "Over 100 tribal nations were 'terminated' — their federal recognition withdrawn, trust lands sold, jurisdiction transferred to states", legalBasis: "Menominee Tribe v. United States (1968): termination did not extinguish treaty-guaranteed hunting and fishing rights", canon: "Treaty rights survive termination unless Congress expressly abrogates them — Menominee Tribe (1968)" },
      { type: "identity", event: "Terminated peoples became state subjects without tribal legal protection, and were recorded in state systems as 'non-Indian'", legalBasis: "Indian Civil Rights Act (1968) later recognized the constitutional violations inherent in termination policy", canon: "Ambiguities in acts of Congress purporting to diminish tribal status are resolved in favor of the tribe" },
      { type: "governance", event: "Public Law 280 transferred criminal and civil jurisdiction over tribal lands in certain states to state governments without tribal consent", legalBasis: "P.L. 280 (1953) — tribal consent was not required despite treaty provisions protecting self-governance", canon: "Tribal sovereignty is not divested except by clear and unambiguous act of Congress — Montana v. United States (1981)" },
    ],
    continuingImpact: "Many families whose ancestors were in terminated nations lost their records and standing during this era. Restoration legislation (1970s–present) has reversed terminations for many nations. Peoples administratively erased during termination retain inherent rights.",
  },
  {
    name: "Self-Determination Era",
    years: "1975–Present", start: 1975, end: 2100,
    trustRightsInForce: "Indian Self-Determination and Education Assistance Act (1975) reversed termination policy. NAGPRA (1990), VAWA tribal provisions, ICWA (1978), and Tribal Law and Order Act (2010) have expanded tribal jurisdictional authority. The trust responsibility is codified and enforceable.",
    violations: [
      { type: "trust", event: "Despite policy reversal, trust asset mismanagement continued — Cobell settlement (2009) covered 1887–2009 period, with many claims still outstanding", legalBasis: "United States v. Navajo Nation (2003, 2009) — courts affirmed trust duty but narrowed remedies", canon: "Trust responsibility requires active protection, not mere non-interference — Mitchell II (1983)" },
      { type: "identity", event: "Blood quantum requirements and enrollment caps imposed by federal policy continue to fracture tribal membership based on racial metrics, not political or cultural standing", legalBasis: "Morton v. Mancari (1974): Indian identity is a political, not racial, classification — but blood quantum contradicts this", canon: "Statutes benefiting Indians are construed liberally; those limiting Indigenous rights are construed narrowly" },
    ],
    continuingImpact: "This is the era in which present-day members exercise rights. Every historical violation documented in prior eras forms the chain of standing for present-day claims. The trust responsibility runs forward — what was owed then is still owed.",
  },
];

function getAncestorEras(birthYear: number | null, deathYear: number | null): Era[] {
  const birth = birthYear ?? 1800;
  const death = deathYear ?? new Date().getFullYear();
  return ALL_ERAS.filter(e => e.end > birth && e.start < death);
}

const VIOLATION_META: Record<string, { label: string; icon: typeof Gavel; color: string; bg: string; border: string; }> = {
  land:       { label: "Land & Territory",       icon: TrendingDown,  color: "text-amber-300",   bg: "bg-amber-950/40",   border: "border-amber-700/40" },
  identity:   { label: "Identity & Classification", icon: Fingerprint, color: "text-orange-300",  bg: "bg-orange-950/40",  border: "border-orange-700/40" },
  trust:      { label: "Trust Responsibility",   icon: Shield,        color: "text-red-300",     bg: "bg-red-950/40",     border: "border-red-700/40" },
  governance: { label: "Self-Governance",        icon: Building2,     color: "text-violet-300",  bg: "bg-violet-950/40",  border: "border-violet-700/40" },
};

/* ─────────── RightsAnalysisPanel ─────────── */
type ConsentState = "idle" | "accepted" | "declined";

function RightsAnalysisConsentGate({
  ancestor,
  onAccept,
  onDecline,
}: {
  ancestor: Ancestor;
  onAccept: () => void;
  onDecline: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const firstName = ancestor.firstName ?? "this ancestor";

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 pb-2 border-b border-violet-800/40">
        <div className="w-2 h-2 rounded-full bg-violet-500"></div>
        <h2 className="text-sm font-bold text-violet-300 tracking-wide uppercase">Rights Violation Analysis</h2>
        <span className="text-xs text-violet-700 ml-1">Federal trust, canons of construction, and temporal legal record</span>
      </div>

      {/* Consent card */}
      <div className="rounded-xl border border-violet-700/40 bg-gradient-to-b from-slate-900/80 to-violet-950/30 overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-3 p-5 border-b border-violet-800/30">
          <div className="w-10 h-10 rounded-full bg-violet-900/60 border border-violet-700/50 flex items-center justify-center flex-shrink-0">
            <HandHeart className="w-5 h-5 text-violet-300" />
          </div>
          <div>
            <p className="text-sm font-semibold text-violet-100">Before You Continue</p>
            <p className="text-xs text-violet-400/70">This section contains heavy historical content. Take a moment.</p>
          </div>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          <p className="text-sm text-slate-200/80 leading-relaxed">
            The Rights Violation Analysis for <span className="text-violet-200 font-medium">{firstName}</span> documents
            the specific laws and government actions that affected Indigenous peoples — including your ancestor — during each era they lived through.
          </p>
          <p className="text-sm text-slate-300/70 leading-relaxed">
            This includes accounts of <span className="text-amber-300/90">forced removal</span>,{" "}
            <span className="text-amber-300/90">identity erasure</span>,{" "}
            <span className="text-amber-300/90">broken treaties</span>, and{" "}
            <span className="text-amber-300/90">loss of land and rights</span> — named
            precisely, tied to specific laws, and connected to your family's lineage.
          </p>
          <p className="text-sm text-slate-300/60 leading-relaxed">
            Some members find this section clarifying and empowering. Others find it heavy — especially when seeing it
            connected to a specific ancestor they know personally. Both responses are valid, and both are understandable.
          </p>

          {/* What it is / why it exists — expandable */}
          <button
            className="flex items-center gap-2 text-xs text-violet-400/70 hover:text-violet-300 transition-colors"
            onClick={() => setExpanded(v => !v)}
          >
            {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            {expanded ? "Show less" : "Why does this section exist?"}
          </button>

          {expanded && (
            <div className="rounded-lg bg-violet-950/40 border border-violet-800/20 p-4 space-y-2.5 text-xs text-violet-200/60 leading-relaxed">
              <p>
                This analysis exists to name what happened — not as grievance for its own sake, but as documentation.
                When you can see the exact legal mechanism by which a right was diminished or an identity was erased,
                you can also see how to name it, challenge it, and reclaim it.
              </p>
              <p>
                Each era is mapped to the laws in force at the time. The Indian Canons of Construction —
                interpretive rules that courts are required to apply in favor of Indigenous peoples —
                are shown alongside each documented violation, so you can see the legal counter-argument
                that already exists in federal law.
              </p>
              <p>
                This is your history. It belongs to you. The purpose of putting it here is to restore context —
                not to define you by what was taken, but to equip you with the full picture of what is owed.
              </p>
            </div>
          )}

          {/* Grounding reminder */}
          <div className="rounded-lg bg-slate-800/40 border border-slate-700/30 p-3 flex items-start gap-2.5">
            <Shield className="w-3.5 h-3.5 text-green-400 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-slate-400/80 leading-relaxed">
              You do not have to read this today. Your choice will be remembered for{" "}
              <span className="text-slate-300">{firstName}</span>.
              You can always come back to this section when you feel ready.
            </p>
          </div>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-3 pt-1">
            <Button
              className="flex-1 bg-violet-700 hover:bg-violet-600 text-white text-sm"
              onClick={onAccept}
            >
              <Eye className="w-4 h-4 mr-2" />
              I'm ready to see this
            </Button>
            <Button
              variant="outline"
              className="flex-1 border-slate-600/50 text-slate-400 hover:text-slate-200 hover:border-slate-500 text-sm"
              onClick={onDecline}
            >
              Not right now
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function RightsAnalysisFull({ ancestor, historicalEvents }: { ancestor: Ancestor; historicalEvents: HistoricalEvent[] }) {
  const [openEraIdx, setOpenEraIdx] = useState<number | null>(null);
  const [openViolation, setOpenViolation] = useState<string | null>(null);

  const eras = getAncestorEras(ancestor.birthYear, ancestor.deathYear);
  const firstName = ancestor.firstName ?? "this ancestor";

  const violationsByType: Record<string, { era: string; event: string; legalBasis: string; canon: string; }[]> = {};
  eras.forEach(era => {
    era.violations.forEach(v => {
      if (!violationsByType[v.type]) violationsByType[v.type] = [];
      violationsByType[v.type].push({ era: era.name, event: v.event, legalBasis: v.legalBasis, canon: v.canon });
    });
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 pb-2 border-b border-violet-800/40">
        <div className="w-2 h-2 rounded-full bg-violet-500"></div>
        <h2 className="text-sm font-bold text-violet-300 tracking-wide uppercase">Rights Violation Analysis</h2>
        <span className="text-xs text-violet-700 ml-1">Federal trust, canons of construction, and temporal legal record</span>
      </div>

      {/* Framing statement */}
      <div className="rounded-xl border border-violet-800/30 bg-violet-950/20 p-4">
        <div className="flex items-start gap-3">
          <Gavel className="w-4 h-4 text-violet-400 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-xs font-semibold text-violet-300 mb-1">COMPANION Rights Analysis — How to Read This Section</p>
            <p className="text-xs text-violet-200/70 leading-relaxed">
              This analysis takes <span className="text-violet-200">{ancestor.fullName}</span>'s birth-to-death window and applies the law <em>as it existed at each point in time</em>.
              The Indian Canons of Construction — the interpretive rules courts use to resolve ambiguity in favor of Indigenous peoples — are applied to each documented violation.
              The purpose is not historical grievance for its own sake: it is to equip members to see the precise legal mechanism by which each generation's rights were diminished,
              so that pattern cannot repeat. What was owed then is still owed now.
            </p>
          </div>
        </div>
      </div>

      {/* Era-by-era temporal pockets */}
      {eras.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-6">Add birth or death years to generate a temporal rights analysis.</p>
      ) : (
        <div className="space-y-3">
          <p className="text-xs text-violet-300/60 font-medium tracking-wide uppercase">Temporal Pockets — Eras {firstName} Lived Through</p>
          {eras.map((era, idx) => {
            const isOpen = openEraIdx === idx;
            return (
              <div key={era.name} className="rounded-xl border border-violet-800/30 bg-slate-900/60 overflow-hidden">
                <button
                  className="w-full flex items-center justify-between p-4 text-left hover:bg-violet-950/20 transition-colors"
                  onClick={() => setOpenEraIdx(isOpen ? null : idx)}
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 w-6 h-6 rounded-full bg-violet-900/60 border border-violet-700/50 flex items-center justify-center flex-shrink-0">
                      <span className="text-[10px] font-bold text-violet-400">{idx + 1}</span>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-violet-200">{era.name}</p>
                      <p className="text-xs text-violet-400/60">{era.years} · {era.violations.length} documented violation{era.violations.length !== 1 ? "s" : ""}</p>
                    </div>
                  </div>
                  {isOpen ? <ChevronUp className="w-4 h-4 text-violet-500 flex-shrink-0" /> : <ChevronDown className="w-4 h-4 text-violet-500 flex-shrink-0" />}
                </button>

                {isOpen && (
                  <div className="border-t border-violet-900/40 p-4 space-y-4">
                    <div className="rounded-lg bg-violet-950/30 border border-violet-800/20 p-3">
                      <p className="text-[10px] font-semibold text-violet-400 uppercase tracking-wider mb-1.5">Rights in Force During This Era</p>
                      <p className="text-xs text-violet-200/70 leading-relaxed">{era.trustRightsInForce}</p>
                    </div>
                    <div className="space-y-3">
                      {era.violations.map((v, vi) => {
                        const meta = VIOLATION_META[v.type];
                        const Icon = meta.icon;
                        return (
                          <div key={vi} className={`rounded-lg border ${meta.border} ${meta.bg} p-3`}>
                            <div className="flex items-center gap-2 mb-2">
                              <Icon className={`w-3 h-3 ${meta.color}`} />
                              <span className={`text-[10px] font-bold uppercase tracking-wider ${meta.color}`}>{meta.label} Violation</span>
                            </div>
                            <p className="text-xs text-slate-200/80 leading-relaxed mb-2">{v.event}</p>
                            <div className="space-y-1.5">
                              <div className="flex gap-2">
                                <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider mt-0.5 flex-shrink-0">Legal Basis</span>
                                <p className="text-[10px] text-slate-400/80 leading-relaxed">{v.legalBasis}</p>
                              </div>
                              <div className="flex gap-2 bg-black/20 rounded p-2">
                                <Scale className="w-3 h-3 text-violet-400 mt-0.5 flex-shrink-0" />
                                <p className="text-[10px] text-violet-300/80 leading-relaxed italic">{v.canon}</p>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <div className="rounded-lg bg-green-950/20 border border-green-800/20 p-3">
                      <p className="text-[10px] font-semibold text-green-400 uppercase tracking-wider mb-1.5">Continuing Impact on Present-Day Rights</p>
                      <p className="text-xs text-green-200/70 leading-relaxed">{era.continuingImpact}</p>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Violation category summary */}
      {Object.keys(violationsByType).length > 0 && (
        <div className="space-y-3 pt-2">
          <p className="text-xs text-violet-300/60 font-medium tracking-wide uppercase">Violation Summary — Across {firstName}'s Lifetime</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {(Object.entries(violationsByType) as [string, typeof violationsByType[string]][]).map(([type, items]) => {
              const meta = VIOLATION_META[type];
              const Icon = meta.icon;
              const key = `sum-${type}`;
              const isOpen = openViolation === key;
              return (
                <div key={type} className={`rounded-xl border ${meta.border} ${meta.bg} overflow-hidden`}>
                  <button
                    className="w-full flex items-center justify-between p-3 text-left"
                    onClick={() => setOpenViolation(isOpen ? null : key)}
                  >
                    <div className="flex items-center gap-2">
                      <Icon className={`w-4 h-4 ${meta.color}`} />
                      <span className={`text-xs font-semibold ${meta.color}`}>{meta.label}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className={`text-[10px] px-1.5 ${meta.bg} border ${meta.border} ${meta.color}`}>{items.length}</Badge>
                      {isOpen ? <ChevronUp className="w-3 h-3 text-slate-500" /> : <ChevronDown className="w-3 h-3 text-slate-500" />}
                    </div>
                  </button>
                  {isOpen && (
                    <div className="border-t border-slate-800/40 p-3 space-y-2">
                      {items.map((item, i) => (
                        <div key={i} className="text-xs space-y-1">
                          <p className="text-[9px] font-bold text-slate-500 uppercase">{item.era}</p>
                          <p className="text-slate-300/80 leading-relaxed">{item.event}</p>
                          <p className="text-violet-400/70 italic text-[10px] leading-relaxed">"{item.canon}"</p>
                          {i < items.length - 1 && <div className="border-t border-slate-800/30 pt-1 mt-1" />}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Indian Canons of Construction */}
      <div className="rounded-xl border border-slate-700/40 bg-slate-900/60 p-4">
        <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-3">Indian Canons of Construction — Applied Throughout This Analysis</p>
        <div className="space-y-2">
          {[
            { canon: "Ambiguities in treaties are resolved in favor of the Indians.", cite: "Jones v. Meehan, 175 U.S. 1 (1899)" },
            { canon: "Treaties are to be construed as the Indians understood them at the time of signing.", cite: "Washington v. Washington Passenger Fishing Vessel Assn., 443 U.S. 658 (1979)" },
            { canon: "Tribal rights are not diminished by implication — Congress must express any diminishment clearly and unambiguously.", cite: "Minnesota v. Mille Lacs Band, 526 U.S. 172 (1999)" },
            { canon: "The federal government owes a trust responsibility and the highest fiduciary duties to Indigenous peoples.", cite: "Seminole Nation v. United States, 316 U.S. 286 (1942)" },
            { canon: "Statutes passed for the benefit of Indians are to be construed liberally; those limiting Indigenous rights are construed narrowly.", cite: "Montana v. Blackfeet Tribe, 471 U.S. 759 (1985)" },
            { canon: "Indian status is a political classification based on tribal membership — not a racial classification.", cite: "Morton v. Mancari, 417 U.S. 535 (1974)" },
          ].map((c, i) => (
            <div key={i} className="flex gap-3 py-2 border-b border-slate-800/40 last:border-0">
              <Scale className="w-3 h-3 text-violet-500 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-xs text-slate-300/80 leading-relaxed italic">"{c.canon}"</p>
                <p className="text-[10px] text-slate-500 mt-0.5">{c.cite}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function RightsAnalysisPanel({ ancestor, historicalEvents }: { ancestor: Ancestor; historicalEvents: HistoricalEvent[] }) {
  const storageKey = `rights-analysis-consent-${ancestor.id}`;
  const [consent, setConsent] = useState<ConsentState>("idle");

  useEffect(() => {
    const stored = localStorage.getItem(storageKey);
    if (stored === "accepted") setConsent("accepted");
    else if (stored === "declined") setConsent("declined");
    else setConsent("idle");
  }, [storageKey]);

  function accept() {
    localStorage.setItem(storageKey, "accepted");
    setConsent("accepted");
  }
  function decline() {
    localStorage.setItem(storageKey, "declined");
    setConsent("declined");
  }
  function revisit() {
    localStorage.removeItem(storageKey);
    setConsent("idle");
  }

  if (consent === "accepted") {
    return <RightsAnalysisFull ancestor={ancestor} historicalEvents={historicalEvents} />;
  }

  if (consent === "declined") {
    return (
      <div className="rounded-xl border border-slate-700/30 bg-slate-900/40 p-5 flex items-center gap-4">
        <div className="w-9 h-9 rounded-full bg-slate-800 border border-slate-700/50 flex items-center justify-center flex-shrink-0">
          <ShieldAlert className="w-4 h-4 text-slate-500" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm text-slate-400 font-medium">Rights Violation Analysis — skipped for now</p>
          <p className="text-xs text-slate-500/70 mt-0.5 leading-relaxed">
            Take your time. This section will be here whenever you are ready to return to it.
          </p>
        </div>
        <button
          className="text-xs text-violet-400/70 hover:text-violet-300 underline underline-offset-2 transition-colors flex-shrink-0"
          onClick={revisit}
        >
          I'm ready now
        </button>
      </div>
    );
  }

  return (
    <RightsAnalysisConsentGate
      ancestor={ancestor}
      onAccept={accept}
      onDecline={decline}
    />
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
              <p className="text-[10px] font-medium tracking-[0.22em] text-indigo-400/60 uppercase mb-0.5">Urban Indian Continuity Atlas</p>
              <p className="text-[10px] text-indigo-400/40 tracking-wide mb-2 italic">Mapping identity, reclassification, migration, and survival across generations.</p>
              <h1 className="text-2xl font-serif font-bold text-indigo-100 leading-tight">{ancestor.fullName}</h1>
              {lifespan && <p className="text-indigo-300/60 text-sm mt-1">{lifespan}</p>}
              {ancestor.tribalNation && <p className="text-indigo-200/40 text-sm">{ancestor.tribalNation}</p>}
              <p className="text-xs text-indigo-300/50 mt-3 max-w-xl leading-relaxed">
                This atlas places {ancestor.firstName ?? "this ancestor"} beside the laws, treaties, removals, and racial classifications that acted upon them during their lifetime. Identity loss in records is not proof of nonexistence — it is evidence of interruption.
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

      {/* ── Rights Violation Analysis ── */}
      <RightsAnalysisPanel ancestor={ancestor} historicalEvents={historicalEvents} />

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
