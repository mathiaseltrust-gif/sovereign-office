import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { getCurrentBearerToken } from "@/components/auth-provider";

const EVENT_TYPES = [
  { value: "hearing", label: "Hearing", color: "bg-blue-600 text-white" },
  { value: "filing", label: "Filing Deadline", color: "bg-orange-500 text-white" },
  { value: "nfr_deadline", label: "NFR Deadline", color: "bg-red-600 text-white" },
  { value: "task_due", label: "Task Due", color: "bg-purple-500 text-white" },
  { value: "meeting", label: "Meeting", color: "bg-green-600 text-white" },
  { value: "reminder", label: "Reminder", color: "bg-amber-500 text-white" },
  { value: "general", label: "General", color: "bg-slate-500 text-white" },
];

function typeColor(type: string): string {
  return EVENT_TYPES.find(t => t.value === type)?.color ?? "bg-slate-400 text-white";
}

function typeLabel(type: string): string {
  return EVENT_TYPES.find(t => t.value === type)?.label ?? type.replace(/_/g, " ");
}

interface CalendarEvent {
  id: number;
  title: string;
  description?: string | null;
  date: string;
  type: string;
}

function authHeaders() {
  return { Authorization: `Bearer ${getCurrentBearerToken() ?? ""}` };
}

async function fetchEvents(): Promise<CalendarEvent[]> {
  const r = await fetch("/api/calendar", { headers: authHeaders() });
  if (!r.ok) throw new Error("Failed to load events");
  return r.json();
}

async function createEvent(data: { title: string; description?: string; date: string; type: string }): Promise<CalendarEvent> {
  const r = await fetch("/api/calendar", {
    method: "POST",
    headers: { ...authHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!r.ok) throw new Error("Failed to create event");
  return r.json();
}

async function deleteEvent(id: number): Promise<void> {
  const r = await fetch(`/api/calendar/${id}`, { method: "DELETE", headers: authHeaders() });
  if (!r.ok) throw new Error("Failed to delete event");
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];

function toLocalDate(dateStr: string): Date {
  const d = new Date(dateStr);
  return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

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
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["calendar"] }); setShowForm(false); setForm({ title: "", description: "", date: "", type: "general" }); setFormError(""); },
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
    return [...events]
      .filter(e => toLocalDate(e.date) >= new Date(today.getFullYear(), today.getMonth(), today.getDate()))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .slice(0, 5);
  }, [events]);

  function prevMonth() {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
    setSelectedDay(null);
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
    setSelectedDay(null);
  }
  function goToday() { setViewYear(today.getFullYear()); setViewMonth(today.getMonth()); setSelectedDay(today.getDate()); }

  function handleAddEvent(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim() || !form.date) { setFormError("Title and date are required."); return; }
    createMutation.mutate({ title: form.title.trim(), description: form.description.trim() || undefined, date: form.date, type: form.type });
  }

  function openAddForm(day?: number) {
    const dateStr = day
      ? `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`
      : "";
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
          <p className="text-muted-foreground mt-1">Schedule events, set deadlines, manage hearings</p>
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
                  <Input
                    value={form.title}
                    onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                    placeholder="Event title"
                    className="mt-1 text-sm"
                    required
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Date *</label>
                  <Input
                    type="date"
                    value={form.date}
                    onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                    className="mt-1 text-sm"
                    required
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Event Type</label>
                  <select
                    value={form.type}
                    onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
                    className="mt-1 w-full border rounded-md px-3 py-2 text-sm bg-background"
                  >
                    {EVENT_TYPES.map(t => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Description</label>
                  <Input
                    value={form.description}
                    onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                    placeholder="Optional details"
                    className="mt-1 text-sm"
                  />
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
                          <div className="space-y-0.5">
                            {dayEvents.slice(0, 2).map(e => (
                              <div key={e.id} className={`text-[10px] px-1 py-0.5 rounded truncate ${typeColor(e.type)}`}>
                                {e.title}
                              </div>
                            ))}
                            {dayEvents.length > 2 && (
                              <div className="text-[10px] text-muted-foreground px-1">+{dayEvents.length - 2} more</div>
                            )}
                          </div>
                        </div>
                      );
                    })}
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
                      <div key={e.id} className="flex items-start justify-between gap-3 p-3 rounded-md border bg-background">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <Badge className={`${typeColor(e.type)} text-xs`}>{typeLabel(e.type)}</Badge>
                            <span className="text-sm font-medium">{e.title}</span>
                          </div>
                          {e.description && <p className="text-xs text-muted-foreground">{e.description}</p>}
                        </div>
                        <button
                          onClick={() => { if (confirm("Delete this event?")) deleteMutation.mutate(e.id); }}
                          className="text-xs text-muted-foreground hover:text-destructive shrink-0 mt-0.5"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-4">
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
                    return (
                      <div
                        key={e.id}
                        onClick={() => { setViewYear(d.getFullYear()); setViewMonth(d.getMonth()); setSelectedDay(d.getDate()); }}
                        className="flex gap-3 p-2 rounded-md border cursor-pointer hover:bg-muted/40 transition-colors"
                      >
                        <div className={`text-center w-10 shrink-0 rounded-md py-1 ${isEventToday ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                          <div className="text-sm font-bold leading-none">{d.getDate()}</div>
                          <div className="text-[10px] mt-0.5">{MONTHS[d.getMonth()]?.slice(0, 3)}</div>
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
