import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth, getCurrentBearerToken } from "@/components/auth-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  BookMarked, Plus, X, ChevronDown, ChevronUp, MapPin, Clock,
  Tag, Users, Heart, Star, AlertTriangle, Smile, Search, Filter,
  Mic, MicOff, Upload, FileText, Sparkles, Loader2, CheckCircle2,
  PenLine,
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

interface ExtractedMemory {
  title: string;
  body: string;
  memoryDate: string;
  memoryEra: string;
  location: string;
  emotionalTone: string;
  topics: string[];
  taggedPeople: TaggedPerson[];
  isHistoricalEvent: boolean;
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

function authHeaders(): Record<string, string> {
  return { Authorization: `Bearer ${getCurrentBearerToken() ?? ""}` };
}

function apiRequest(method: string, path: string, body?: unknown) {
  return fetch(path, {
    method,
    credentials: "include",
    headers: body
      ? { ...authHeaders(), "Content-Type": "application/json" }
      : authHeaders(),
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
      <div className="h-0.5 w-full" style={{ background: tone.color }} />
      <div className="p-5">
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
            <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1.5" style={{ color: "rgba(200,160,80,0.55)", fontSize: "11px" }}>
              {memory.memoryEra && (
                <span className="flex items-center gap-1"><Clock size={10} /> {memory.memoryEra}</span>
              )}
              {memory.memoryDate && (
                <span className="flex items-center gap-1"><Clock size={10} /> {memory.memoryDate}</span>
              )}
              {memory.location && (
                <span className="flex items-center gap-1"><MapPin size={10} /> {memory.location}</span>
              )}
              <span className="flex items-center gap-1 ml-auto" style={{ color: "rgba(160,120,60,0.4)" }}>
                {formatDate(memory.createdAt)}
              </span>
            </div>
          </div>
        </div>

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

// ── Intake Panel (Voice + Document Upload + AI Extraction) ────────────────────

function IntakePanel({ onExtracted }: { onExtracted: (fields: ExtractedMemory) => void }) {
  const [contextNote, setContextNote] = useState("");
  const [transcript, setTranscript] = useState("");
  const [interimText, setInterimText] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [extractError, setExtractError] = useState("");
  const recognitionRef = useRef<unknown>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const SR = (window as unknown as Record<string, unknown>).SpeechRecognition
      || (window as unknown as Record<string, unknown>).webkitSpeechRecognition;
    setSpeechSupported(!!SR);
  }, []);

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        (recognitionRef.current as { stop: () => void }).stop();
      }
    };
  }, []);

  function startRecording() {
    const SR = (window as unknown as Record<string, unknown>).SpeechRecognition
      || (window as unknown as Record<string, unknown>).webkitSpeechRecognition;
    if (!SR) return;
    const recognition = new (SR as new () => {
      continuous: boolean;
      interimResults: boolean;
      lang: string;
      onresult: ((e: unknown) => void) | null;
      onend: (() => void) | null;
      onerror: ((e: unknown) => void) | null;
      start: () => void;
      stop: () => void;
    })();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";
    recognition.onresult = (event: unknown) => {
      const e = event as {
        resultIndex: number;
        results: { isFinal: boolean; [k: number]: { transcript: string } }[];
      };
      let interim = "";
      let final = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const text = e.results[i][0].transcript;
        if (e.results[i].isFinal) {
          final += text + " ";
        } else {
          interim += text;
        }
      }
      if (final) setTranscript(t => t + final);
      setInterimText(interim);
    };
    recognition.onend = () => {
      setIsRecording(false);
      setInterimText("");
    };
    recognition.onerror = () => {
      setIsRecording(false);
      setInterimText("");
    };
    recognition.start();
    recognitionRef.current = recognition;
    setIsRecording(true);
  }

  function stopRecording() {
    if (recognitionRef.current) {
      (recognitionRef.current as { stop: () => void }).stop();
    }
    setIsRecording(false);
    setInterimText("");
  }

  function handleFileSelect(f: File) {
    setFile(f);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFileSelect(f);
  }

  const extractMutation = useMutation({
    mutationFn: async () => {
      const formData = new FormData();
      formData.append("spokenNotes", transcript);
      formData.append("contextNote", contextNote);
      if (file) formData.append("file", file);
      const res = await fetch("/api/ancestral-memories/extract", {
        method: "POST",
        credentials: "include",
        headers: authHeaders(),
        body: formData,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as Record<string, unknown>;
        throw new Error((err.error as string) || "Extraction failed");
      }
      return res.json() as Promise<ExtractedMemory>;
    },
    onSuccess: (data) => {
      onExtracted(data);
    },
    onError: (err: Error) => {
      setExtractError(err.message || "Could not extract memory. Please try again.");
    },
  });

  const canExtract = transcript.trim().length > 0 || !!file;
  const wordCount = transcript.trim().split(/\s+/).filter(Boolean).length;

  const inputStyle = {
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(180,100,20,0.2)",
    color: "#e8d5b0",
    fontSize: "13px",
  };
  const labelStyle: React.CSSProperties = {
    color: "rgba(200,150,60,0.7)",
    fontSize: "11px",
    letterSpacing: "0.08em",
    textTransform: "uppercase",
  };

  return (
    <div className="space-y-5">
      {/* Explainer */}
      <div
        className="rounded-lg px-4 py-3"
        style={{ background: "rgba(107,0,0,0.12)", border: "1px solid rgba(107,0,0,0.25)" }}
      >
        <p style={{ color: "rgba(220,180,100,0.75)", fontSize: "12px", lineHeight: "1.6" }}>
          Talk freely about a memory, upload a letter, photograph, or document — or both together.
          The Archive will listen, read, and extract the memory for you to review before it's sealed.
        </p>
      </div>

      {/* Context note */}
      <div>
        <label style={labelStyle} className="block mb-1.5">Frame it for the Archive</label>
        <Textarea
          placeholder="Give a sentence or two of context — who this is about, why it matters, what the document is… (optional)"
          value={contextNote}
          onChange={e => setContextNote(e.target.value)}
          rows={2}
          style={{ ...inputStyle, resize: "none" }}
        />
      </div>

      {/* Voice recording */}
      <div>
        <label style={labelStyle} className="block mb-2">
          Voice Recording
          {!speechSupported && (
            <span className="ml-2 text-[10px] normal-case" style={{ color: "rgba(200,100,60,0.7)" }}>
              (use Chrome or Edge for voice input)
            </span>
          )}
        </label>

        <div
          className="rounded-xl p-4"
          style={{ background: "rgba(0,0,0,0.25)", border: "1px solid rgba(180,100,20,0.15)" }}
        >
          {/* Mic control */}
          <div className="flex items-center gap-4 mb-3">
            <button
              type="button"
              disabled={!speechSupported}
              onClick={isRecording ? stopRecording : startRecording}
              className="flex items-center gap-2 px-4 py-2 rounded-full transition-all text-[12px] font-medium"
              style={{
                background: isRecording
                  ? "rgba(180,20,20,0.4)"
                  : speechSupported
                  ? "rgba(107,0,0,0.5)"
                  : "rgba(60,60,60,0.3)",
                border: `1px solid ${isRecording ? "rgba(220,60,60,0.6)" : "rgba(180,60,20,0.3)"}`,
                color: isRecording ? "#ff9090" : speechSupported ? "#f0a070" : "rgba(180,180,180,0.4)",
                cursor: speechSupported ? "pointer" : "not-allowed",
                boxShadow: isRecording ? "0 0 12px rgba(200,30,30,0.25)" : "none",
              }}
            >
              {isRecording ? <MicOff size={14} /> : <Mic size={14} />}
              {isRecording ? "Stop recording" : "Start recording"}
              {isRecording && (
                <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse ml-1" />
              )}
            </button>
            {wordCount > 0 && (
              <span style={{ color: "rgba(200,160,80,0.5)", fontSize: "11px" }}>
                {wordCount} {wordCount === 1 ? "word" : "words"} captured
              </span>
            )}
          </div>

          {/* Transcript display */}
          {(transcript || interimText) ? (
            <div
              className="rounded-lg p-3 text-[13px] leading-relaxed min-h-[60px] max-h-[160px] overflow-y-auto"
              style={{
                background: "rgba(0,0,0,0.2)",
                border: "1px solid rgba(180,100,20,0.12)",
                color: "rgba(220,190,140,0.85)",
              }}
            >
              <span>{transcript}</span>
              {interimText && (
                <span style={{ color: "rgba(200,160,80,0.4)", fontStyle: "italic" }}>{interimText}</span>
              )}
            </div>
          ) : (
            <div
              className="rounded-lg p-3 text-center"
              style={{
                background: "rgba(0,0,0,0.15)",
                border: "1px dashed rgba(180,100,20,0.15)",
                color: "rgba(180,140,60,0.35)",
                fontSize: "12px",
              }}
            >
              Transcript will appear here as you speak…
            </div>
          )}

          {transcript && (
            <button
              type="button"
              onClick={() => setTranscript("")}
              className="mt-2 text-[10px] transition-colors"
              style={{ color: "rgba(200,100,60,0.5)" }}
            >
              Clear transcript
            </button>
          )}
        </div>
      </div>

      {/* Document / file upload */}
      <div>
        <label style={labelStyle} className="block mb-2">Upload a Document, Letter, or Photo</label>
        <div
          className="rounded-xl p-5 text-center cursor-pointer transition-all"
          style={{
            background: isDragging ? "rgba(107,0,0,0.2)" : "rgba(0,0,0,0.2)",
            border: `1px dashed ${isDragging ? "rgba(200,80,20,0.5)" : "rgba(180,100,20,0.2)"}`,
          }}
          onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.txt,.doc,.docx,.png,.jpg,.jpeg,.webp"
            className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) handleFileSelect(f); }}
          />
          {file ? (
            <div className="flex items-center justify-center gap-3">
              <FileText size={18} style={{ color: "#e8b060" }} />
              <div className="text-left">
                <p className="font-medium text-[13px]" style={{ color: "#e8d5b0" }}>{file.name}</p>
                <p className="text-[11px]" style={{ color: "rgba(200,150,60,0.5)" }}>
                  {(file.size / 1024).toFixed(1)} KB · Click to change
                </p>
              </div>
              <button
                type="button"
                onClick={e => { e.stopPropagation(); setFile(null); }}
                className="ml-2"
                style={{ color: "rgba(200,100,60,0.6)" }}
              >
                <X size={14} />
              </button>
            </div>
          ) : (
            <div>
              <Upload size={20} className="mx-auto mb-2" style={{ color: "rgba(180,120,40,0.4)" }} />
              <p style={{ color: "rgba(200,150,60,0.5)", fontSize: "12px" }}>
                Drop a file here or click to browse
              </p>
              <p style={{ color: "rgba(180,120,40,0.3)", fontSize: "10px", marginTop: "4px" }}>
                PDF, TXT, JPG, PNG, WEBP — letters, photos, records, journals
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Error */}
      {extractError && (
        <p className="text-red-400 text-xs">{extractError}</p>
      )}

      {/* Extract button */}
      <Button
        type="button"
        disabled={!canExtract || extractMutation.isPending}
        onClick={() => { setExtractError(""); extractMutation.mutate(); }}
        className="w-full flex items-center justify-center gap-2 py-3"
        style={{
          background: canExtract && !extractMutation.isPending
            ? "linear-gradient(135deg, #6B0000 0%, #9B1A1A 100%)"
            : "rgba(60,30,20,0.4)",
          color: canExtract ? "#f0d080" : "rgba(200,150,60,0.35)",
          border: "1px solid rgba(180,60,20,0.3)",
          fontSize: "13px",
          letterSpacing: "0.05em",
        }}
      >
        {extractMutation.isPending ? (
          <>
            <Loader2 size={15} className="animate-spin" />
            Archive is listening and learning…
          </>
        ) : (
          <>
            <Sparkles size={15} />
            Extract Memory with AI
          </>
        )}
      </Button>

      {!canExtract && (
        <p className="text-center text-[11px]" style={{ color: "rgba(180,130,60,0.4)" }}>
          Record your voice, upload a document, or both — then extract
        </p>
      )}
    </div>
  );
}

// ── Create Form ───────────────────────────────────────────────────────────────

type CreateMode = "write" | "intake";

function CreateMemoryForm({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const qc = useQueryClient();
  const [mode, setMode] = useState<CreateMode>("write");
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
  const [extractedNotice, setExtractedNotice] = useState(false);

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

  function handleExtracted(fields: ExtractedMemory) {
    setForm(f => ({
      ...f,
      title: fields.title || f.title,
      body: fields.body || f.body,
      memoryDate: fields.memoryDate || f.memoryDate,
      memoryEra: fields.memoryEra || f.memoryEra,
      location: fields.location || f.location,
      emotionalTone: fields.emotionalTone || f.emotionalTone,
      topics: fields.topics.length > 0 ? fields.topics : f.topics,
      taggedPeopleNames: fields.taggedPeople.length > 0 ? fields.taggedPeople : f.taggedPeopleNames,
      isHistoricalEvent: fields.isHistoricalEvent,
    }));
    setExtractedNotice(true);
    setMode("write");
    setTimeout(() => setExtractedNotice(false), 6000);
  }

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

  const labelStyle: React.CSSProperties = {
    color: "rgba(200,150,60,0.7)",
    fontSize: "11px",
    letterSpacing: "0.08em",
    textTransform: "uppercase",
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.75)" }}
    >
      <div
        className="w-full max-w-2xl rounded-2xl overflow-hidden flex flex-col max-h-[92vh]"
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
              <p className="font-semibold" style={{ color: "#f0d080", letterSpacing: "0.05em", fontSize: "14px" }}>
                Add Memory to the Archive
              </p>
              <p className="text-[10px] mt-0.5" style={{ color: "rgba(255,200,140,0.55)" }}>
                This memory becomes part of the living tribal record
              </p>
            </div>
          </div>
          <button onClick={onClose} style={{ color: "rgba(255,200,140,0.6)" }}>
            <X size={18} />
          </button>
        </div>

        {/* Mode tabs */}
        <div
          className="flex gap-1 px-6 pt-4 pb-3 flex-shrink-0"
          style={{ borderBottom: "1px solid rgba(180,100,20,0.12)" }}
        >
          <button
            type="button"
            onClick={() => setMode("write")}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-full text-[12px] font-medium transition-all"
            style={{
              background: mode === "write" ? "rgba(107,0,0,0.45)" : "rgba(255,255,255,0.04)",
              border: `1px solid ${mode === "write" ? "rgba(180,60,20,0.5)" : "rgba(180,100,20,0.15)"}`,
              color: mode === "write" ? "#f0d080" : "rgba(200,150,60,0.5)",
            }}
          >
            <PenLine size={12} /> Write Memory
          </button>
          <button
            type="button"
            onClick={() => setMode("intake")}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-full text-[12px] font-medium transition-all"
            style={{
              background: mode === "intake" ? "rgba(107,0,0,0.45)" : "rgba(255,255,255,0.04)",
              border: `1px solid ${mode === "intake" ? "rgba(180,60,20,0.5)" : "rgba(180,100,20,0.15)"}`,
              color: mode === "intake" ? "#f0d080" : "rgba(200,150,60,0.5)",
            }}
          >
            <Mic size={12} /> Record & Upload
          </button>
        </div>

        {/* Extracted success notice */}
        {extractedNotice && (
          <div
            className="mx-6 mt-3 flex items-center gap-2 px-3 py-2 rounded-lg flex-shrink-0"
            style={{ background: "rgba(20,80,20,0.3)", border: "1px solid rgba(60,160,60,0.25)" }}
          >
            <CheckCircle2 size={14} style={{ color: "#6dbf6d" }} />
            <p className="text-[12px]" style={{ color: "#9de09d" }}>
              Memory extracted — review and edit the fields below, then seal it in the Archive.
            </p>
          </div>
        )}

        {/* Form body */}
        <div className="overflow-y-auto flex-1 p-6 space-y-5">

          {mode === "intake" ? (
            <IntakePanel onExtracted={handleExtracted} />
          ) : (
            <>
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

              {error && <p className="text-red-400 text-xs">{error}</p>}
            </>
          )}
        </div>

        {/* Footer — only shown in write mode */}
        {mode === "write" && (
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
        )}
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
      const res = await fetch(`/api/ancestral-memories?${params}`, { credentials: "include", headers: authHeaders() });
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
          <div className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "rgba(180,120,40,0.5)" }} />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search memories, names, stories…"
              className="w-full pl-8 pr-4 py-2 rounded-lg text-sm"
              style={{
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(180,100,20,0.18)",
                color: "#e8d5b0",
                outline: "none",
              }}
            />
          </div>

          <div className="flex flex-wrap gap-2 items-center">
            <Filter size={11} style={{ color: "rgba(180,120,40,0.4)" }} />
            <select
              value={filterEra}
              onChange={e => setFilterEra(e.target.value)}
              className="rounded-md px-2 py-1 text-[11px]"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(180,100,20,0.18)", color: "rgba(200,160,80,0.7)" }}
            >
              <option value="">All eras</option>
              {ERAS.map(e => <option key={e} value={e}>{e}</option>)}
            </select>

            <select
              value={filterTopic}
              onChange={e => setFilterTopic(e.target.value)}
              className="rounded-md px-2 py-1 text-[11px]"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(180,100,20,0.18)", color: "rgba(200,160,80,0.7)" }}
            >
              <option value="">All topics</option>
              {TOPICS.map(t => <option key={t} value={t}>{t}</option>)}
            </select>

            <select
              value={filterTone}
              onChange={e => setFilterTone(e.target.value)}
              className="rounded-md px-2 py-1 text-[11px]"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(180,100,20,0.18)", color: "rgba(200,160,80,0.7)" }}
            >
              <option value="">All tones</option>
              {TONES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>

            {(filterEra || filterTopic || filterTone || search) && (
              <button
                onClick={() => { setFilterEra(""); setFilterTopic(""); setFilterTone(""); setSearch(""); }}
                className="text-[11px] transition-colors"
                style={{ color: "rgba(200,100,60,0.6)" }}
              >
                Clear filters
              </button>
            )}
          </div>
        </div>

        {/* ── Memory list ─────────────────────────────────────────────── */}
        {isLoading ? (
          <div className="text-center py-16">
            <Loader2 size={24} className="animate-spin mx-auto mb-3" style={{ color: "rgba(200,150,60,0.4)" }} />
            <p style={{ color: "rgba(180,130,60,0.4)", fontSize: "13px" }}>Loading the archive…</p>
          </div>
        ) : displayed.length === 0 ? (
          <div
            className="rounded-xl p-10 text-center"
            style={{ background: CARD_BG, border: BORDER }}
          >
            <BookMarked size={32} className="mx-auto mb-4" style={{ color: "rgba(180,100,20,0.3)" }} />
            <p className="font-medium mb-1" style={{ color: "rgba(200,150,60,0.5)", fontSize: "14px" }}>
              {memories.length === 0 ? "The archive is waiting for its first memory." : "No memories match your filters."}
            </p>
            <p style={{ color: "rgba(180,120,40,0.3)", fontSize: "12px" }}>
              {memories.length === 0
                ? "Speak it, write it, or upload it — every story belongs here."
                : "Try clearing some filters to see more."}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {displayed.map(m => (
              <MemoryCard
                key={m.id}
                memory={m}
                canDelete={canDeleteAny || m.authorMemberId === (u?.dbId as number)}
                onDelete={(id) => deleteMutation.mutate(id)}
              />
            ))}
          </div>
        )}

      </div>

      {/* Create modal */}
      {showCreate && (
        <CreateMemoryForm
          onClose={() => setShowCreate(false)}
          onCreated={() => {}}
        />
      )}
    </div>
  );
}
