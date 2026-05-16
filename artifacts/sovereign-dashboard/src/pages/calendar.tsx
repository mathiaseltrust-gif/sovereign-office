import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { getCurrentBearerToken } from "@/components/auth-provider";
import { Plus, X, CalendarHeart, Sparkles, ChevronDown, ChevronUp } from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface CalendarEvent {
  id: number;
  title: string;
  description?: string | null;
  date: string;
  type: string;
  relatedId?: number | null;
  relatedType?: string | null;
}

interface ImportantDate {
  id: number;
  personName: string;
  relation: string | null;
  dateType: string;
  month: number;
  day: number;
  year: number | null;
  customLabel: string | null;
  notes: string | null;
  createdAt: string;
}

interface DateSuggestion {
  sourceKey: string;
  type: string;
  personName: string;
  relation: string | null;
  year: number | null;
  month: number | null;
  day: number | null;
  partial: boolean;
  source: string;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const EVENT_TYPES = [
  { value: "hearing",        label: "Hearing",           color: "bg-blue-600 text-white" },
  { value: "filing",         label: "Filing Deadline",   color: "bg-orange-500 text-white" },
  { value: "nfr_deadline",   label: "NFR Deadline",      color: "bg-red-600 text-white" },
  { value: "task_due",       label: "Task Due",          color: "bg-purple-500 text-white" },
  { value: "meeting",        label: "Meeting",           color: "bg-green-600 text-white" },
  { value: "reminder",       label: "Reminder",          color: "bg-amber-500 text-white" },
  { value: "general",        label: "General",           color: "bg-slate-500 text-white" },
  { value: "important_date", label: "Important Date",    color: "bg-rose-500 text-white" },
];

const DATE_TYPES = [
  { value: "birthday",    label: "Birthday",            emoji: "🎂" },
  { value: "wedding",     label: "Wedding Anniversary", emoji: "💍" },
  { value: "adoption",    label: "Adoption Day",        emoji: "🤝" },
  { value: "anniversary", label: "Anniversary",         emoji: "🌹" },
  { value: "memorial",    label: "Memorial Day",        emoji: "🕯️" },
  { value: "custom",      label: "Custom",              emoji: "⭐" },
];

const MONTHS_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const WEEKDAYS = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
const MONTH_OPTIONS = MONTHS.map((m, i) => ({ value: String(i + 1), label: m }));

function typeColor(type: string): string {
  return EVENT_TYPES.find(t => t.value === type)?.color ?? "bg-slate-400 text-white";
}
function typeLabel(type: string): string {
  return EVENT_TYPES.find(t => t.value === type)?.label ?? type.replace(/_/g, " ");
}

function authHeaders() {
  return { Authorization: `Bearer ${getCurrentBearerToken() ?? ""}` };
}

function toLocalDate(dateStr: string): Date {
  const d = new Date(dateStr);
  return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

// ── API ───────────────────────────────────────────────────────────────────────

async function fetchEvents(): Promise<CalendarEvent[]> {
  const r = await fetch("/api/calendar", { headers: authHeaders() });
  if (!r.ok) throw new Error("Failed to load events");
  return r.json();
}
async function createEvent(data: { title: string; description?: string; date: string; type: string }): Promise<CalendarEvent> {
  const r = await fetch("/api/calendar", { method: "POST", headers: { ...authHeaders(), "Content-Type": "application/json" }, body: JSON.stringify(data) });
  if (!r.ok) throw new Error("Failed to create event");
  return r.json();
}
async function deleteEvent(id: number): Promise<void> {
  const r = await fetch(`/api/calendar/${id}`, { method: "DELETE", headers: authHeaders() });
  if (!r.ok) throw new Error("Failed to delete event");
}
async function fetchImportantDates(): Promise<ImportantDate[]> {
  const r = await fetch("/api/calendar/important-dates", { headers: authHeaders() });
  if (!r.ok) throw new Error("Failed to load important dates");
  return r.json();
}
async function createImportantDate(data: Record<string, unknown>): Promise<ImportantDate> {
  const r = await fetch("/api/calendar/important-dates", { method: "POST", headers: { ...authHeaders(), "Content-Type": "application/json" }, body: JSON.stringify(data) });
  if (!r.ok) throw new Error("Failed to save important date");
  return r.json();
}
async function deleteImportantDate(id: number): Promise<void> {
  const r = await fetch(`/api/calendar/important-dates/${id}`, { method: "DELETE", headers: authHeaders() });
  if (!r.ok) throw new Error("Failed to delete important date");
}
async function fetchSuggestedDates(): Promise<DateSuggestion[]> {
  const r = await fetch("/api/calendar/suggested-dates", { headers: authHeaders() });
  if (!r.ok) throw new Error("Failed to load suggested dates");
  return r.json();
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function daysUntil(month: number, day: number): number {
  const today = new Date();
  const todayOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  let next = new Date(today.getFullYear(), month - 1, day);
  if (next < todayOnly) next = new Date(today.getFullYear() + 1, month - 1, day);
  return Math.round((next.getTime() - todayOnly.getTime()) / 86400000);
}

function formatNextOccurrence(month: number, day: number): string {
  const today = new Date();
  let next = new Date(today.getFullYear(), month - 1, day);
  if (next < new Date(today.getFullYear(), today.getMonth(), today.getDate())) {
    next = new Date(today.getFullYear() + 1, month - 1, day);
  }
  return `${MONTHS_SHORT[next.getMonth()]} ${next.getDate()}, ${next.getFullYear()}`;
}

// ── Date Suggestions Panel ────────────────────────────────────────────────────

const SUGGESTION_TYPE_META: Record<string, { emoji: string; label: string; dateType: string }> = {
  birthday: { emoji: "🎂", label: "Birthday", dateType: "birthday" },
  memorial: { emoji: "🕯️", label: "Memorial Day", dateType: "memorial" },
};

function DateSuggestionsPanel() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(true);
  const [dismissed, setDismissed] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem("cal_dismissed_suggestions") ?? "[]"); } catch { return []; }
  });
  const [partialInputs, setPartialInputs] = useState<Record<string, { month: string; day: string }>>({});

  const { data: suggestions = [], isLoading } = useQuery({
    queryKey: ["suggested-dates"],
    queryFn: fetchSuggestedDates,
    staleTime: 60_000,
  });

  const addMutation = useMutation({
    mutationFn: createImportantDate,
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["important-dates"] });
      qc.invalidateQueries({ queryKey: ["calendar"] });
      qc.invalidateQueries({ queryKey: ["suggested-dates"] });
      const key = (vars as Record<string, unknown>).sourceKey as string | undefined;
      if (key) dismiss(key);
    },
  });

  function dismiss(sourceKey: string) {
    setDismissed(prev => {
      const next = [...prev, sourceKey];
      try { localStorage.setItem("cal_dismissed_suggestions", JSON.stringify(next)); } catch { /* noop */ }
      return next;
    });
  }

  function handleAdd(s: DateSuggestion, month: number, day: number) {
    const meta = SUGGESTION_TYPE_META[s.type] ?? { emoji: "⭐", label: "Important Date", dateType: "custom" };
    addMutation.mutate({
      personName: s.personName,
      relation: s.relation ?? undefined,
      dateType: meta.dateType,
      month,
      day,
      year: s.year ?? undefined,
      sourceKey: s.sourceKey,
    });
  }

  const visible = suggestions.filter(s => !dismissed.includes(s.sourceKey));

  if (isLoading) return null;
  if (visible.length === 0) return null;

  return (
    <Card className="border-amber-200 dark:border-amber-900 bg-amber-50/40 dark:bg-amber-950/20">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles size={14} className="text-amber-500" />
            <CardTitle className="text-xs uppercase tracking-widest">Suggested Dates</CardTitle>
            <span className="ml-1 inline-flex items-center justify-center w-4 h-4 rounded-full bg-amber-500 text-white text-[9px] font-bold leading-none">
              {visible.length}
            </span>
          </div>
          <button onClick={() => setOpen(o => !o)} className="text-muted-foreground hover:text-foreground transition-colors">
            {open ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>
        </div>
        {open && (
          <p className="text-[10px] text-amber-700 dark:text-amber-400 mt-1 leading-relaxed">
            We found these dates in your profile and family tree. Add them to your calendar so they appear as recurring reminders.
          </p>
        )}
      </CardHeader>

      {open && (
        <CardContent className="space-y-3 pt-0">
          {visible.map(s => {
            const meta = SUGGESTION_TYPE_META[s.type] ?? { emoji: "⭐", label: "Important Date", dateType: "custom" };
            const inputs = partialInputs[s.sourceKey] ?? { month: "", day: "" };
            const isPending = addMutation.isPending && (addMutation.variables as Record<string, unknown>)?.sourceKey === s.sourceKey;

            return (
              <div key={s.sourceKey} className="rounded-lg border border-amber-200/70 dark:border-amber-800/50 bg-white dark:bg-amber-950/10 p-3 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-base leading-none">{meta.emoji}</span>
                      <span className="text-xs font-semibold truncate">{s.personName}</span>
                      {s.relation && s.relation !== "Self" && (
                        <Badge variant="outline" className="text-[9px] px-1 h-4 capitalize">{s.relation}</Badge>
                      )}
                      <Badge className="text-[9px] px-1 h-4 bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300 border-0">
                        {meta.label}
                      </Badge>
                    </div>
                    {s.year && (
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        {s.type === "memorial" ? "Passed" : "Born"} {s.year}
                        {s.source === "profile_vault" ? " · from your profile" : " · from your family tree"}
                      </p>
                    )}
                  </div>
                  <button onClick={() => dismiss(s.sourceKey)} className="text-muted-foreground hover:text-foreground shrink-0 mt-0.5" title="Skip this suggestion">
                    <X size={11} />
                  </button>
                </div>

                {s.partial ? (
                  <div className="space-y-2">
                    <p className="text-[10px] text-muted-foreground">Enter the month and day to add to your calendar:</p>
                    <div className="flex gap-1.5 items-end">
                      <div className="flex-1">
                        <Select
                          value={inputs.month}
                          onValueChange={v => setPartialInputs(p => ({ ...p, [s.sourceKey]: { ...inputs, month: v } }))}
                        >
                          <SelectTrigger className="h-7 text-[10px]"><SelectValue placeholder="Month" /></SelectTrigger>
                          <SelectContent>
                            {MONTH_OPTIONS.map(m => <SelectItem key={m.value} value={m.value} className="text-xs">{m.label}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="w-16">
                        <Input
                          type="number" min={1} max={31}
                          value={inputs.day}
                          onChange={e => setPartialInputs(p => ({ ...p, [s.sourceKey]: { ...inputs, day: e.target.value } }))}
                          placeholder="Day"
                          className="h-7 text-[10px]"
                        />
                      </div>
                      <Button
                        size="sm"
                        className="h-7 text-[10px] px-2 bg-amber-600 hover:bg-amber-700 text-white shrink-0"
                        disabled={!inputs.month || !inputs.day || isPending}
                        onClick={() => {
                          const mo = parseInt(inputs.month, 10);
                          const dy = parseInt(inputs.day, 10);
                          if (!isNaN(mo) && !isNaN(dy)) handleAdd(s, mo, dy);
                        }}
                      >
                        {isPending ? "Adding…" : "Add"}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button
                    size="sm"
                    className="w-full h-7 text-[10px] bg-amber-600 hover:bg-amber-700 text-white"
                    disabled={isPending}
                    onClick={() => handleAdd(s, s.month!, s.day!)}
                  >
                    {isPending ? "Adding to calendar…" : `Add ${meta.label} to Calendar`}
                  </Button>
                )}
              </div>
            );
          })}
        </CardContent>
      )}
    </Card>
  );
}

// ── Important Dates Panel ─────────────────────────────────────────────────────

function ImportantDatesPanel() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ personName: "", relation: "", dateType: "birthday", month: "", day: "", year: "", customLabel: "", notes: "" });
  const [formError, setFormError] = useState("");

  const { data: importantDates = [], isLoading } = useQuery({ queryKey: ["important-dates"], queryFn: fetchImportantDates });

  const createMutation = useMutation({
    mutationFn: createImportantDate,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["important-dates"] });
      qc.invalidateQueries({ queryKey: ["calendar"] });
      setShowForm(false);
      setForm({ personName: "", relation: "", dateType: "birthday", month: "", day: "", year: "", customLabel: "", notes: "" });
      setFormError("");
    },
    onError: () => setFormError("Could not save. Please check your entries."),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteImportantDate,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["important-dates"] });
      qc.invalidateQueries({ queryKey: ["calendar"] });
    },
  });

  function handleSave() {
    if (!form.personName.trim()) { setFormError("Name is required."); return; }
    if (!form.month || !form.day) { setFormError("Month and day are required."); return; }
    const month = Number(form.month);
    const day = Number(form.day);
    if (isNaN(month) || isNaN(day) || month < 1 || month > 12 || day < 1 || day > 31) {
      setFormError("Invalid month or day."); return;
    }
    setFormError("");
    createMutation.mutate({
      personName: form.personName.trim(),
      relation: form.relation.trim() || undefined,
      dateType: form.dateType,
      month,
      day,
      year: form.year ? Number(form.year) : undefined,
      customLabel: form.dateType === "custom" ? form.customLabel.trim() || undefined : undefined,
      notes: form.notes.trim() || undefined,
    });
  }

  const sortedDates = useMemo(
    () => [...importantDates].sort((a, b) => daysUntil(a.month, a.day) - daysUntil(b.month, b.day)),
    [importantDates],
  );

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CalendarHeart size={14} className="text-rose-500" />
            <CardTitle className="text-xs uppercase tracking-widest">Important Dates</CardTitle>
          </div>
          <button
            onClick={() => { setShowForm(s => !s); setFormError(""); }}
            className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
          >
            {showForm ? <X size={12} /> : <Plus size={12} />}
            {showForm ? "Cancel" : "Add Date"}
          </button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">

        {/* ── Add form ── */}
        {showForm && (
          <div className="rounded-lg border border-rose-200 dark:border-rose-900 bg-rose-50/40 dark:bg-rose-950/20 p-3 space-y-2.5">
            <div>
              <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Person's Name *</label>
              <Input
                value={form.personName}
                onChange={e => setForm(f => ({ ...f, personName: e.target.value }))}
                placeholder="e.g. Mom, Marcus, Aaliyah"
                className="mt-1 text-xs h-8"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Relation</label>
                <Input
                  value={form.relation}
                  onChange={e => setForm(f => ({ ...f, relation: e.target.value }))}
                  placeholder="e.g. spouse, son"
                  className="mt-1 text-xs h-8"
                />
              </div>
              <div>
                <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Type *</label>
                <Select value={form.dateType} onValueChange={v => setForm(f => ({ ...f, dateType: v }))}>
                  <SelectTrigger className="mt-1 text-xs h-8"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {DATE_TYPES.map(t => (
                      <SelectItem key={t.value} value={t.value}>{t.emoji} {t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {form.dateType === "custom" && (
              <div>
                <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Custom Label</label>
                <Input
                  value={form.customLabel}
                  onChange={e => setForm(f => ({ ...f, customLabel: e.target.value }))}
                  placeholder="e.g. Sobriety Day, Graduation"
                  className="mt-1 text-xs h-8"
                />
              </div>
            )}

            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Month *</label>
                <Select value={form.month} onValueChange={v => setForm(f => ({ ...f, month: v }))}>
                  <SelectTrigger className="mt-1 text-xs h-8"><SelectValue placeholder="Month" /></SelectTrigger>
                  <SelectContent>
                    {MONTH_OPTIONS.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Day *</label>
                <Input
                  type="number" min={1} max={31}
                  value={form.day}
                  onChange={e => setForm(f => ({ ...f, day: e.target.value }))}
                  placeholder="1–31"
                  className="mt-1 text-xs h-8"
                />
              </div>
              <div>
                <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Year</label>
                <Input
                  type="number" min={1900} max={new Date().getFullYear()}
                  value={form.year}
                  onChange={e => setForm(f => ({ ...f, year: e.target.value }))}
                  placeholder="optional"
                  className="mt-1 text-xs h-8"
                />
              </div>
            </div>

            <div>
              <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Notes</label>
              <Input
                value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="Optional note"
                className="mt-1 text-xs h-8"
              />
            </div>

            {formError && <p className="text-xs text-destructive">{formError}</p>}

            <Button
              size="sm"
              className="w-full text-xs h-8 bg-rose-600 hover:bg-rose-700 text-white"
              onClick={handleSave}
              disabled={createMutation.isPending}
            >
              {createMutation.isPending ? "Saving to calendar…" : "Save Important Date"}
            </Button>
          </div>
        )}

        {/* ── Saved list ── */}
        {isLoading ? (
          <div className="space-y-2">{[...Array(2)].map((_, i) => <Skeleton key={i} className="h-10" />)}</div>
        ) : sortedDates.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-3">
            No important dates yet — add birthdays, anniversaries, and more.
          </p>
        ) : (
          <div className="space-y-2">
            {sortedDates.map(d => {
              const dt = DATE_TYPES.find(t => t.value === d.dateType);
              const days = daysUntil(d.month, d.day);
              const isToday = days === 0;
              const isSoon = days <= 14;
              return (
                <div
                  key={d.id}
                  className={`flex items-center gap-2.5 p-2 rounded-md border transition-colors ${isToday ? "bg-rose-50 dark:bg-rose-950/30 border-rose-300 dark:border-rose-800" : "hover:bg-muted/30"}`}
                >
                  {/* Countdown badge */}
                  <div className={`text-center w-10 shrink-0 rounded py-1 ${isToday ? "bg-rose-500 text-white" : isSoon ? "bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300" : "bg-muted text-muted-foreground"}`}>
                    <div className="text-base leading-none">{dt?.emoji ?? "⭐"}</div>
                    <div className="text-[9px] mt-0.5 font-medium">
                      {isToday ? "Today!" : `${days}d`}
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">
                      {d.personName}
                      {d.relation && <span className="text-muted-foreground font-normal"> · {d.relation}</span>}
                    </p>
                    <p className="text-[10px] text-muted-foreground truncate">
                      {d.dateType === "custom" && d.customLabel ? d.customLabel : (dt?.label ?? d.dateType)}
                      {" — "}{formatNextOccurrence(d.month, d.day)}
                      {d.year ? ` (since ${d.year})` : ""}
                    </p>
                  </div>
                  <button
                    onClick={() => { if (confirm(`Remove ${d.personName}'s date?`)) deleteMutation.mutate(d.id); }}
                    className="text-muted-foreground/40 hover:text-destructive transition-colors shrink-0"
                  >
                    <X size={12} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Main Calendar Page ────────────────────────────────────────────────────────

export default function CalendarPage() {
  const qc = useQueryClient();
  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [selectedDay, setSelectedDay] = useState<number | null>(today.getDate());
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", date: "", type: "general" });
  const [formError, setFormError] = useState("");

  const { data: events = [], isLoading } = useQuery({ queryKey: ["calendar"], queryFn: fetchEvents });

  const createMutation = useMutation({
    mutationFn: createEvent,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["calendar"] });
      setShowForm(false);
      setForm({ title: "", description: "", date: "", type: "general" });
      setFormError("");
    },
    onError: (e: Error) => setFormError(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteEvent,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["calendar"] }),
  });

  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstDayOfWeek = new Date(viewYear, viewMonth, 1).getDay();

  const eventsByDay = useMemo(() => {
    const map: Record<number, CalendarEvent[]> = {};
    for (const e of events) {
      const d = toLocalDate(e.date);
      if (d.getFullYear() === viewYear && d.getMonth() === viewMonth) {
        const day = d.getDate();
        if (!map[day]) map[day] = [];
        map[day]!.push(e);
      }
    }
    return map;
  }, [events, viewYear, viewMonth]);

  const selectedDayEvents = selectedDay ? (eventsByDay[selectedDay] ?? []) : [];

  const upcomingEvents = useMemo(() => {
    const todayOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    return [...events]
      .filter(e => toLocalDate(e.date) >= todayOnly)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .slice(0, 7);
  }, [events]);

  function prevMonth() {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); } else setViewMonth(m => m - 1);
    setSelectedDay(null);
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); } else setViewMonth(m => m + 1);
    setSelectedDay(null);
  }
  function goToday() { setViewYear(today.getFullYear()); setViewMonth(today.getMonth()); setSelectedDay(today.getDate()); }

  function handleAddEvent(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim() || !form.date) { setFormError("Title and date are required."); return; }
    createMutation.mutate({ title: form.title.trim(), description: form.description.trim() || undefined, date: form.date, type: form.type });
  }

  function openAddForm(day?: number) {
    const dateStr = day ? `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}` : "";
    setForm(f => ({ ...f, date: dateStr }));
    setShowForm(true);
    setFormError("");
  }

  const todayKey = `${today.getFullYear()}-${today.getMonth()}-${today.getDate()}`;

  return (
    <div data-testid="page-calendar">
      <div className="mb-6 flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-serif font-bold text-foreground">Calendar</h1>
          <p className="text-muted-foreground mt-1">Schedule events, set deadlines, track important dates</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={goToday}>Today</Button>
          <Button size="sm" onClick={() => openAddForm()}>+ Add Event</Button>
        </div>
      </div>

      {showForm && (
        <Card className="mb-6 border-primary/30 bg-primary/5">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm uppercase tracking-widest">New Calendar Event</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAddEvent} className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Title *</label>
                  <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Event title" className="mt-1 text-sm" required />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Date *</label>
                  <Input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} className="mt-1 text-sm" required />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Event Type</label>
                  <Select value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v }))}>
                    <SelectTrigger className="mt-1 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {EVENT_TYPES.filter(t => t.value !== "important_date").map(t => (
                        <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Description</label>
                  <Input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Optional details" className="mt-1 text-sm" />
                </div>
              </div>
              {formError && <p className="text-xs text-destructive">{formError}</p>}
              <div className="flex gap-2 pt-1">
                <Button type="submit" size="sm" disabled={createMutation.isPending}>
                  {createMutation.isPending ? "Saving…" : "Save Event"}
                </Button>
                <Button type="button" size="sm" variant="outline" onClick={() => { setShowForm(false); setFormError(""); }}>Cancel</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ── Left: calendar grid + selected day ── */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <Button variant="ghost" size="sm" onClick={prevMonth}>‹</Button>
                <CardTitle className="text-base font-serif">{MONTHS[viewMonth]} {viewYear}</CardTitle>
                <Button variant="ghost" size="sm" onClick={nextMonth}>›</Button>
              </div>
            </CardHeader>
            <CardContent className="p-0 pb-4">
              {isLoading ? (
                <div className="p-4 space-y-2">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
              ) : (
                <>
                  <div className="grid grid-cols-7 border-b">
                    {WEEKDAYS.map(d => (
                      <div key={d} className="text-center py-2 text-xs font-medium text-muted-foreground">{d}</div>
                    ))}
                  </div>
                  <div className="grid grid-cols-7">
                    {Array.from({ length: firstDayOfWeek }).map((_, i) => (
                      <div key={`empty-${i}`} className="border-b border-r min-h-[72px] bg-muted/20" />
                    ))}
                    {Array.from({ length: daysInMonth }).map((_, i) => {
                      const day = i + 1;
                      const dayKey = `${viewYear}-${viewMonth}-${day}`;
                      const isToday = dayKey === todayKey;
                      const isSelected = selectedDay === day;
                      const dayEvents = eventsByDay[day] ?? [];
                      const regularEvents = dayEvents.filter(e => e.type !== "important_date");
                      const importantEvents = dayEvents.filter(e => e.type === "important_date");
                      const col = (firstDayOfWeek + i) % 7;
                      const isLastCol = col === 6;
                      return (
                        <div
                          key={day}
                          onClick={() => setSelectedDay(day)}
                          className={`min-h-[72px] border-b p-1 cursor-pointer transition-colors ${!isLastCol ? "border-r" : ""} ${isSelected ? "bg-primary/10" : "hover:bg-muted/40"}`}
                        >
                          <div className={`text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full mb-1 ${isToday ? "bg-primary text-primary-foreground" : "text-foreground"}`}>
                            {day}
                          </div>
                          {/* Important date rose dots */}
                          {importantEvents.length > 0 && (
                            <div className="flex gap-0.5 mb-0.5 flex-wrap">
                              {importantEvents.slice(0, 3).map(e => (
                                <span key={e.id} title={e.title} className="w-2 h-2 rounded-full bg-rose-400 inline-block" />
                              ))}
                            </div>
                          )}
                          <div className="space-y-0.5">
                            {regularEvents.slice(0, 2).map(e => (
                              <div key={e.id} className={`text-[10px] px-1 py-0.5 rounded truncate ${typeColor(e.type)}`}>
                                {e.title}
                              </div>
                            ))}
                            {dayEvents.length > 2 && (
                              <div className="text-[10px] text-muted-foreground px-1">+{dayEvents.length - Math.min(regularEvents.length, 2)} more</div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="flex items-center gap-3 px-3 pt-3 text-[10px] text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-rose-400 inline-block" /> Important dates (recurring)
                    </span>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {selectedDay && (
            <Card className="mt-4">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm uppercase tracking-widest">
                    {MONTHS[viewMonth]} {selectedDay}, {viewYear}
                  </CardTitle>
                  <Button size="sm" variant="outline" className="text-xs" onClick={() => openAddForm(selectedDay)}>
                    + Add to this day
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {selectedDayEvents.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">No events on this day.</p>
                ) : (
                  <div className="space-y-2">
                    {selectedDayEvents.map(e => (
                      <div
                        key={e.id}
                        className={`flex items-start justify-between gap-3 p-3 rounded-md border ${e.type === "important_date" ? "bg-rose-50/50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-800" : "bg-background"}`}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <Badge className={`${typeColor(e.type)} text-xs`}>{typeLabel(e.type)}</Badge>
                            <span className="text-sm font-medium">{e.title}</span>
                          </div>
                          {e.description && <p className="text-xs text-muted-foreground">{e.description}</p>}
                          {e.type === "important_date" && (
                            <p className="text-[10px] text-rose-500 mt-0.5">Recurring annually</p>
                          )}
                        </div>
                        {e.type !== "important_date" && (
                          <button
                            onClick={() => { if (confirm("Delete this event?")) deleteMutation.mutate(e.id); }}
                            className="text-xs text-muted-foreground hover:text-destructive shrink-0 mt-0.5"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* ── Right sidebar ── */}
        <div className="space-y-4">
          {/* Upcoming Events */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-xs uppercase tracking-widest">Upcoming Events</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-2">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
              ) : upcomingEvents.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">No upcoming events.</p>
              ) : (
                <div className="space-y-2">
                  {upcomingEvents.map(e => {
                    const d = toLocalDate(e.date);
                    const isEventToday = d.toDateString() === today.toDateString();
                    const isImportant = e.type === "important_date";
                    return (
                      <div
                        key={e.id}
                        onClick={() => { setViewYear(d.getFullYear()); setViewMonth(d.getMonth()); setSelectedDay(d.getDate()); }}
                        className={`flex gap-3 p-2 rounded-md border cursor-pointer hover:bg-muted/40 transition-colors ${isImportant ? "border-rose-200 dark:border-rose-900" : ""}`}
                      >
                        <div className={`text-center w-10 shrink-0 rounded-md py-1 ${isEventToday ? "bg-primary text-primary-foreground" : isImportant ? "bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300" : "bg-muted"}`}>
                          <div className="text-sm font-bold leading-none">{d.getDate()}</div>
                          <div className="text-[10px] mt-0.5">{MONTHS_SHORT[d.getMonth()]}</div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium truncate">{e.title}</p>
                          <Badge className={`${typeColor(e.type)} text-[10px] mt-1`}>{typeLabel(e.type)}</Badge>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Suggested Dates — auto-extracted from profile + family tree */}
          <DateSuggestionsPanel />

          {/* Important Dates panel */}
          <ImportantDatesPanel />

          {/* Event type legend */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-xs uppercase tracking-widest">Event Types</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-1.5">
                {EVENT_TYPES.map(t => (
                  <div key={t.value} className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full inline-block ${t.color.split(" ")[0]}`} />
                    <span className="text-xs text-muted-foreground">{t.label}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
