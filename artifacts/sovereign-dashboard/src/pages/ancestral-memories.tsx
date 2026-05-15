import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/components/auth-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  BookMarked, Plus, X, ChevronDown, ChevronUp, MapPin, Clock,
  Tag, Users, Heart, Star, AlertTriangle, Smile, Search, Filter,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface TaggedPerson {
  name: string;
  relation: string;
}

interface Memory {
  id: number;
  authorMemberId: number | null;
  title: string;
  body: string;
  memoryDate: string | null;
  memoryEra: string | null;
  taggedMemberIds: number[];
  taggedAncestorIds: number[];
  taggedPeopleNames: TaggedPerson[];
  topics: string[];
  location: string | null;
  emotionalTone: string;
  visibility: string;
  isHistoricalEvent: boolean;
  isVerified: boolean;
  createdAt: string;
  updatedAt: string;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const ERAS = ["Childhood", "Young Adult", "Adult", "Elder Years", "Pre-1900s", "1900–1950", "1950–1980", "1980–2000", "2000s–Present", "Historical"];
const TOPICS = ["Family", "Business", "Sovereignty", "Culture", "Health", "Education", "Land", "Spirituality", "Justice", "Resistance", "Love", "Loss"];
const TONES = [
  { value: "joy",       label: "Joy",       icon: Smile,         color: "#d4a017" },
  { value: "pride",     label: "Pride",     icon: Star,          color: "#7a3db8" },
  { value: "gratitude", label: "Gratitude", icon: Heart,         color: "#c0392b" },
  { value: "grief",     label: "Grief",     icon: Users,         color: "#4a6080" },
  { value: "warning",   label: "Warning",   icon: AlertTriangle, color: "#c0392b" },
  { value: "neutral",   label: "Neutral",   icon: BookMarked,    color: "#6b7280" },
] as const;

const CARD_BG = "linear-gradient(160deg, #130a02 0%, #0a0500 100%)";
const BORDER = "1px solid rgba(180,100,20,0.18)";
const RED_DEEP = "#6B0000";

// ── Helpers ───────────────────────────────────────────────────────────────────

function toneInfo(tone: string) {
  return TONES.find(t => t.value === tone) ?? TONES[5];
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

function apiRequest(method: string, path: string, body?: unknown) {
  return fetch(path, {
    method,
    credentials: "include",
    headers: body ? { "Content-Type": "application/json" } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
}

// ── Memory Card ───────────────────────────────────────────────────────────────

function MemoryCard({ memory, onDelete, canDelete }: {
  memory: Memory;
  onDelete: (id: number) => void;
  canDelete: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const tone = toneInfo(memory.emotionalTone);
  const ToneIcon = tone.icon;

  return (
    <div
      className="rounded-xl overflow-hidden transition-all"
      style={{ background: CARD_BG, border: BORDER }}
    >
      {/* Top accent bar — tone color */}
      <div className="h-0.5 w-full" style={{ background: tone.color }} />

      <div className="p-5">
        {/* Header row */}
        <div className="flex items-start gap-3">
          <div
            className="w-9 h-9 rounded-full flex-shrink-0 flex items-center justify-center mt-0.5"
            style={{ background: `${tone.color}22`, border: `1px solid ${tone.color}44` }}
          >
            <ToneIcon size={16} style={{ color: tone.color }} />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-start gap-2 justify-between">
              <h3
                className="font-semibold leading-snug"
                style={{ color: "#e8d5b0", fontSize: "15px" }}
              >
                {memory.isHistoricalEvent && (
                  <span
                    className="inline-block text-[9px] uppercase tracking-widest px-1.5 py-0.5 rounded mr-2 align-middle"
                    style={{ background: "rgba(107,0,0,0.4)", color: "#f0a070", border: "1px solid rgba(180,60,20,0.3)" }}
                  >
                    Historical
                  </span>
                )}
                {memory.title}
              </h3>
              {canDelete && (
                <button
                  onClick={() => onDelete(memory.id)}
                  className="text-red-900/60 hover:text-red-500/80 transition-colors flex-shrink-0 mt-0.5"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Meta row */}
            <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1.5" style={{ color: "rgba(200,160,80,0.55)", fontSize: "11px" }}>
              {memory.memoryEra && (
                <span className="flex items-center gap-1">
                  <Clock size={10} /> {memory.memoryEra}
                </span>
              )}
              {memory.memoryDate && (
                <span className="flex items-center gap-1">
                  <Clock size={10} /> {memory.memoryDate}
                </span>
              )}
              {memory.location && (
                <span className="flex items-center gap-1">
                  <MapPin size={10} /> {memory.location}
                </span>
              )}
              <span className="flex items-center gap-1 ml-auto" style={{ color: "rgba(160,120,60,0.4)" }}>
                {formatDate(memory.createdAt)}
              </span>
            </div>
          </div>
        </div>

        {/* Body preview / expanded */}
        <div className="mt-3 pl-12">
          <p
            className="leading-relaxed"
            style={{
              color: "rgba(220,190,140,0.8)",
              fontSize: "13px",
              lineHeight: "1.7",
              display: expanded ? "block" : "-webkit-box",
              WebkitLineClamp: expanded ? undefined : 3,
              WebkitBoxOrient: "vertical" as const,
              overflow: expanded ? "visible" : "hidden",
            }}
          >
            {memory.body}
          </p>

          {memory.body.length > 200 && (
            <button
              onClick={() => setExpanded(e => !e)}
              className="flex items-center gap-1 mt-2 text-[11px] transition-colors"
              style={{ color: "rgba(200,150,60,0.7)" }}
            >
              {expanded ? <><ChevronUp size={12} /> Show less</> : <><ChevronDown size={12} /> Read full memory</>}
            </button>
          )}

          {/* Tagged people */}
          {(memory.taggedPeopleNames as TaggedPerson[])?.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-3">
              {(memory.taggedPeopleNames as TaggedPerson[]).map((p, i) => (
                <span
                  key={i}
                  className="text-[10px] px-2 py-0.5 rounded-full"
                  style={{ background: "rgba(107,0,0,0.3)", color: "#f0a080", border: "1px solid rgba(180,60,20,0.2)" }}
                >
                  {p.name}{p.relation ? ` · ${p.relation}` : ""}
                </span>
              ))}
            </div>
          )}

          {/* Topics */}
          {(memory.topics as string[])?.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {(memory.topics as string[]).map(t => (
                <span
                  key={t}
                  className="text-[10px] px-2 py-0.5 rounded-full"
                  style={{ background: "rgba(180,130,20,0.12)", color: "rgba(200,160,60,0.7)", border: "1px solid rgba(180,130,20,0.18)" }}
                >
                  # {t}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Create Form ───────────────────────────────────────────────────────────────

function CreateMemoryForm({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    title: "",
    body: "",
    memoryDate: "",
    memoryEra: "",
    location: "",
    emotionalTone: "neutral",
    visibility: "tribe",
    isHistoricalEvent: false,
    topics: [] as string[],
    taggedPeopleNames: [] as TaggedPerson[],
  });
  const [personName, setPersonName] = useState("");
  const [personRelation, setPersonRelation] = useState("");
  const [error, setError] = useState("");

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/ancestral-memories", form);
      if (!res.ok) throw new Error("Failed to save");
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ancestral-memories"] });
      onCreated();
      onClose();
    },
    onError: () => setError("Could not save memory. Please try again."),
  });

  function toggleTopic(t: string) {
    setForm(f => ({
      ...f,
      topics: f.topics.includes(t) ? f.topics.filter(x => x !== t) : [...f.topics, t],
    }));
  }

  function addPerson() {
    if (!personName.trim()) return;
    setForm(f => ({
      ...f,
      taggedPeopleNames: [...f.taggedPeopleNames, { name: personName.trim(), relation: personRelation.trim() }],
    }));
    setPersonName("");
    setPersonRelation("");
  }

  function removePerson(i: number) {
    setForm(f => ({ ...f, taggedPeopleNames: f.taggedPeopleNames.filter((_, idx) => idx !== i) }));
  }

  const inputStyle = {
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(180,100,20,0.2)",
    color: "#e8d5b0",
    fontSize: "13px",
  };

  const labelStyle = { color: "rgba(200,150,60,0.7)", fontSize: "11px", letterSpacing: "0.08em", textTransform: "uppercase" as const };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.75)" }}
    >
      <div
        className="w-full max-w-2xl rounded-2xl overflow-hidden flex flex-col max-h-[90vh]"
        style={{ background: "linear-gradient(160deg, #1a0a02 0%, #0d0500 100%)", border: "1px solid rgba(180,100,20,0.25)" }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-6 py-4 flex-shrink-0"
          style={{ background: "linear-gradient(135deg, #6B0000 0%, #9B1A1A 60%, #7A0808 100%)", borderBottom: "1px solid rgba(0,0,0,0.25)" }}
        >
          <div className="flex items-center gap-3">
            <BookMarked size={18} style={{ color: "#e8b060" }} />
            <div>
              <p className="font-semibold" style={{ color: "#f0d080", letterSpacing: "0.05em", fontSize: "14px" }}>Add Memory to the Archive</p>
              <p className="text-[10px] mt-0.5" style={{ color: "rgba(255,200,140,0.55)" }}>This memory becomes part of the living tribal record</p>
            </div>
          </div>
          <button onClick={onClose} style={{ color: "rgba(255,200,140,0.6)" }}>
            <X size={18} />
          </button>
        </div>

        {/* Form body */}
        <div className="overflow-y-auto flex-1 p-6 space-y-5">
          {/* Title */}
          <div>
            <label style={labelStyle} className="block mb-1.5">Memory Title *</label>
            <Input
              placeholder="e.g. My cousin always believed in my business ideas"
              value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              style={inputStyle}
            />
          </div>

          {/* Body */}
          <div>
            <label style={labelStyle} className="block mb-1.5">The Memory *</label>
            <Textarea
              placeholder="Tell the story in full. Speak it as you'd speak it to the next generation..."
              value={form.body}
              onChange={e => setForm(f => ({ ...f, body: e.target.value }))}
              rows={6}
              style={{ ...inputStyle, resize: "vertical" }}
            />
          </div>

          {/* Date / Era / Location */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label style={labelStyle} className="block mb-1.5">When</label>
              <Input
                placeholder="e.g. Summer 1987"
                value={form.memoryDate}
                onChange={e => setForm(f => ({ ...f, memoryDate: e.target.value }))}
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle} className="block mb-1.5">Era</label>
              <select
                value={form.memoryEra}
                onChange={e => setForm(f => ({ ...f, memoryEra: e.target.value }))}
                className="w-full rounded-md px-3 py-2"
                style={inputStyle}
              >
                <option value="">Select era…</option>
                {ERAS.map(e => <option key={e} value={e}>{e}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle} className="block mb-1.5">Location</label>
              <Input
                placeholder="e.g. Detroit, MI"
                value={form.location}
                onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
                style={inputStyle}
              />
            </div>
          </div>

          {/* Emotional tone */}
          <div>
            <label style={labelStyle} className="block mb-2">Emotional Tone</label>
            <div className="flex flex-wrap gap-2">
              {TONES.map(t => {
                const Icon = t.icon;
                const selected = form.emotionalTone === t.value;
                return (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => setForm(f => ({ ...f, emotionalTone: t.value }))}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] transition-all"
                    style={{
                      background: selected ? `${t.color}30` : "rgba(255,255,255,0.04)",
                      border: `1px solid ${selected ? t.color + "88" : "rgba(180,100,20,0.18)"}`,
                      color: selected ? t.color : "rgba(200,160,80,0.6)",
                    }}
                  >
                    <Icon size={11} /> {t.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Topics */}
          <div>
            <label style={labelStyle} className="block mb-2">Topics</label>
            <div className="flex flex-wrap gap-2">
              {TOPICS.map(t => {
                const selected = form.topics.includes(t);
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => toggleTopic(t)}
                    className="px-3 py-1 rounded-full text-[11px] transition-all"
                    style={{
                      background: selected ? "rgba(180,130,20,0.25)" : "rgba(255,255,255,0.04)",
                      border: `1px solid ${selected ? "rgba(200,160,40,0.5)" : "rgba(180,100,20,0.18)"}`,
                      color: selected ? "#d4b060" : "rgba(180,130,60,0.6)",
                    }}
                  >
                    # {t}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Tag people */}
          <div>
            <label style={labelStyle} className="block mb-2">People in this Memory</label>
            <div className="flex gap-2 mb-2">
              <Input
                placeholder="Name"
                value={personName}
                onChange={e => setPersonName(e.target.value)}
                style={{ ...inputStyle, flex: 2 }}
                onKeyDown={e => e.key === "Enter" && addPerson()}
              />
              <Input
                placeholder="Relation (e.g. cousin)"
                value={personRelation}
                onChange={e => setPersonRelation(e.target.value)}
                style={{ ...inputStyle, flex: 2 }}
                onKeyDown={e => e.key === "Enter" && addPerson()}
              />
              <button
                type="button"
                onClick={addPerson}
                className="px-3 rounded-md flex-shrink-0 transition-colors"
                style={{ background: "rgba(107,0,0,0.5)", border: "1px solid rgba(180,60,20,0.3)", color: "#f0a070" }}
              >
                <Plus size={14} />
              </button>
            </div>
            {form.taggedPeopleNames.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {form.taggedPeopleNames.map((p, i) => (
                  <span
                    key={i}
                    className="flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full"
                    style={{ background: "rgba(107,0,0,0.3)", color: "#f0a080", border: "1px solid rgba(180,60,20,0.2)" }}
                  >
                    {p.name}{p.relation ? ` · ${p.relation}` : ""}
                    <button onClick={() => removePerson(i)} className="ml-0.5 opacity-60 hover:opacity-100"><X size={10} /></button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Visibility / Historical */}
          <div className="flex gap-4 items-center">
            <div className="flex-1">
              <label style={labelStyle} className="block mb-1.5">Visibility</label>
              <select
                value={form.visibility}
                onChange={e => setForm(f => ({ ...f, visibility: e.target.value }))}
                className="w-full rounded-md px-3 py-2"
                style={inputStyle}
              >
                <option value="tribe">Tribe-wide</option>
                <option value="family">Family only</option>
                <option value="private">Private (just me)</option>
              </select>
            </div>
            <label className="flex items-center gap-2 cursor-pointer mt-4" style={{ color: "rgba(200,160,80,0.7)", fontSize: "12px" }}>
              <input
                type="checkbox"
                checked={form.isHistoricalEvent}
                onChange={e => setForm(f => ({ ...f, isHistoricalEvent: e.target.checked }))}
                className="accent-red-700"
              />
              Mark as Historical Event
            </label>
          </div>

          {error && (
            <p className="text-red-400 text-xs">{error}</p>
          )}
        </div>

        {/* Footer */}
        <div
          className="px-6 py-4 flex items-center justify-end gap-3 flex-shrink-0"
          style={{ borderTop: "1px solid rgba(180,100,20,0.15)" }}
        >
          <Button
            variant="ghost"
            onClick={onClose}
            style={{ color: "rgba(200,150,60,0.6)", fontSize: "13px" }}
          >
            Cancel
          </Button>
          <Button
            onClick={() => mutation.mutate()}
            disabled={!form.title.trim() || !form.body.trim() || mutation.isPending}
            style={{
              background: "linear-gradient(135deg, #6B0000 0%, #9B1A1A 100%)",
              color: "#f0d080",
              border: "1px solid rgba(180,60,20,0.3)",
              fontSize: "13px",
              letterSpacing: "0.05em",
            }}
          >
            {mutation.isPending ? "Saving…" : "Seal in the Archive"}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function AncestralMemoriesPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [filterEra, setFilterEra] = useState("");
  const [filterTopic, setFilterTopic] = useState("");
  const [filterTone, setFilterTone] = useState("");
  const [search, setSearch] = useState("");

  const { data: memories = [], isLoading } = useQuery<Memory[]>({
    queryKey: ["ancestral-memories", filterEra],
    queryFn: async () => {
      const params = new URLSearchParams({ limit: "100" });
      if (filterEra) params.set("era", filterEra);
      const res = await fetch(`/api/ancestral-memories?${params}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load memories");
      return res.json();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("DELETE", `/api/ancestral-memories/${id}`);
      if (!res.ok) throw new Error("Failed to delete");
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ancestral-memories"] }),
  });

  const u = user as unknown as Record<string, unknown> | null;
  const isChief = u?.isChief === true;
  const role = (u?.activeRole ?? u?.role) as string;
  const canDeleteAny = isChief || role === "trustee" || role === "sovereign_admin";

  const displayed = memories.filter(m => {
    if (filterTopic && !(m.topics as string[]).includes(filterTopic)) return false;
    if (filterTone && m.emotionalTone !== filterTone) return false;
    if (search) {
      const q = search.toLowerCase();
      const inTitle = m.title.toLowerCase().includes(q);
      const inBody = m.body.toLowerCase().includes(q);
      const inPeople = (m.taggedPeopleNames as TaggedPerson[]).some(p => p.name.toLowerCase().includes(q));
      if (!inTitle && !inBody && !inPeople) return false;
    }
    return true;
  });

  return (
    <div className="min-h-screen py-8 px-4 sm:px-6" style={{ background: "#0a0400" }}>
      <div className="max-w-4xl mx-auto">

        {/* ── Page Header ─────────────────────────────────────────────── */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center"
                style={{ background: `${RED_DEEP}33`, border: `1px solid ${RED_DEEP}66` }}
              >
                <BookMarked size={20} style={{ color: "#e8b060" }} />
              </div>
              <h1
                className="font-semibold"
                style={{ color: "#f0d080", fontSize: "22px", letterSpacing: "0.04em" }}
              >
                Ancestral Memory Bank
              </h1>
            </div>
            <p className="ml-13 pl-13" style={{ color: "rgba(200,160,80,0.5)", fontSize: "13px", paddingLeft: "52px" }}>
              Living archive of tribal memory — stories, people, and moments sealed in the record across time.
            </p>
          </div>
          <Button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2"
            style={{
              background: "linear-gradient(135deg, #6B0000 0%, #9B1A1A 100%)",
              color: "#f0d080",
              border: "1px solid rgba(180,60,20,0.3)",
              fontSize: "13px",
            }}
          >
            <Plus size={15} /> Add Memory
          </Button>
        </div>

        {/* ── Stats bar ───────────────────────────────────────────────── */}
        <div
          className="flex gap-6 px-5 py-3 rounded-xl mb-6"
          style={{ background: "rgba(107,0,0,0.12)", border: "1px solid rgba(107,0,0,0.25)" }}
        >
          <div>
            <p className="text-[10px] uppercase tracking-widest mb-0.5" style={{ color: "rgba(200,150,60,0.5)" }}>Total Memories</p>
            <p className="text-xl font-semibold" style={{ color: "#e8b060" }}>{memories.length}</p>
          </div>
          <div className="w-px" style={{ background: "rgba(180,100,20,0.2)" }} />
          <div>
            <p className="text-[10px] uppercase tracking-widest mb-0.5" style={{ color: "rgba(200,150,60,0.5)" }}>Historical Events</p>
            <p className="text-xl font-semibold" style={{ color: "#e8b060" }}>{memories.filter(m => m.isHistoricalEvent).length}</p>
          </div>
          <div className="w-px" style={{ background: "rgba(180,100,20,0.2)" }} />
          <div>
            <p className="text-[10px] uppercase tracking-widest mb-0.5" style={{ color: "rgba(200,150,60,0.5)" }}>People Remembered</p>
            <p className="text-xl font-semibold" style={{ color: "#e8b060" }}>
              {memories.reduce((acc, m) => acc + (m.taggedPeopleNames as TaggedPerson[]).length, 0)}
            </p>
          </div>
          <div className="w-px" style={{ background: "rgba(180,100,20,0.2)" }} />
          <div>
            <p className="text-[10px] uppercase tracking-widest mb-0.5" style={{ color: "rgba(200,150,60,0.5)" }}>Showing</p>
            <p className="text-xl font-semibold" style={{ color: "#e8b060" }}>{displayed.length}</p>
          </div>
        </div>

        {/* ── Filters ─────────────────────────────────────────────────── */}
        <div
          className="rounded-xl p-4 mb-6 space-y-3"
          style={{ background: CARD_BG, border: BORDER }}
        >
          {/* Search */}
          <div className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "rgba(180,120,40,0.5)" }} />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search memories, names, stories…"
              className="w-full pl-8 pr-4 py-2 rounded-lg text-sm"
              style={{
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(180,100,20,0.2)",
                color: "#e8d5b0",
                outline: "none",
                fontSize: "13px",
              }}
            />
          </div>

          <div className="flex flex-wrap gap-2">
            {/* Era filter */}
            <select
              value={filterEra}
              onChange={e => setFilterEra(e.target.value)}
              className="rounded-lg px-3 py-1.5 text-[12px]"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(180,100,20,0.2)", color: "rgba(200,160,80,0.8)" }}
            >
              <option value="">All eras</option>
              {ERAS.map(e => <option key={e} value={e}>{e}</option>)}
            </select>

            {/* Topic filter */}
            <select
              value={filterTopic}
              onChange={e => setFilterTopic(e.target.value)}
              className="rounded-lg px-3 py-1.5 text-[12px]"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(180,100,20,0.2)", color: "rgba(200,160,80,0.8)" }}
            >
              <option value="">All topics</option>
              {TOPICS.map(t => <option key={t} value={t}>{t}</option>)}
            </select>

            {/* Tone filter */}
            <select
              value={filterTone}
              onChange={e => setFilterTone(e.target.value)}
              className="rounded-lg px-3 py-1.5 text-[12px]"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(180,100,20,0.2)", color: "rgba(200,160,80,0.8)" }}
            >
              <option value="">All tones</option>
              {TONES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>

            {(filterEra || filterTopic || filterTone || search) && (
              <button
                onClick={() => { setFilterEra(""); setFilterTopic(""); setFilterTone(""); setSearch(""); }}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-[12px] transition-colors"
                style={{ background: "rgba(107,0,0,0.3)", color: "#f0a070", border: "1px solid rgba(180,60,20,0.25)" }}
              >
                <X size={11} /> Clear filters
              </button>
            )}
          </div>
        </div>

        {/* ── Memory Feed ─────────────────────────────────────────────── */}
        {isLoading ? (
          <div className="text-center py-16" style={{ color: "rgba(200,160,80,0.4)" }}>
            <BookMarked size={32} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm">Loading the archive…</p>
          </div>
        ) : displayed.length === 0 ? (
          <div
            className="text-center py-16 rounded-xl"
            style={{ background: CARD_BG, border: BORDER }}
          >
            <BookMarked size={40} className="mx-auto mb-4" style={{ color: "rgba(180,100,30,0.3)" }} />
            <p className="font-medium mb-2" style={{ color: "rgba(200,160,80,0.6)", fontSize: "15px" }}>
              {memories.length === 0 ? "The archive awaits its first memory" : "No memories match your filters"}
            </p>
            <p className="text-sm mb-6" style={{ color: "rgba(180,130,60,0.4)" }}>
              {memories.length === 0
                ? "Every story matters. Every name deserves to be remembered."
                : "Try adjusting your search or clearing filters."}
            </p>
            {memories.length === 0 && (
              <Button
                onClick={() => setShowCreate(true)}
                style={{
                  background: "linear-gradient(135deg, #6B0000 0%, #9B1A1A 100%)",
                  color: "#f0d080",
                  border: "1px solid rgba(180,60,20,0.3)",
                  fontSize: "13px",
                }}
              >
                <Plus size={14} className="mr-2" /> Seal the first memory
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {displayed.map(m => (
              <MemoryCard
                key={m.id}
                memory={m}
                canDelete={canDeleteAny || m.authorMemberId === (u?.dbId as number | undefined)}
                onDelete={id => { if (confirm("Remove this memory from the archive?")) deleteMutation.mutate(id); }}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── Create Modal ─────────────────────────────────────────────────── */}
      {showCreate && (
        <CreateMemoryForm
          onClose={() => setShowCreate(false)}
          onCreated={() => {}}
        />
      )}
    </div>
  );
}
