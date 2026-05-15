import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth, getCurrentBearerToken } from "@/components/auth-provider";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Send, BookOpen, MessageCircle, Loader2, Feather,
  Brain, Trash2, ChevronDown, ChevronUp, Plus, X,
} from "lucide-react";

interface KayaMessage {
  id: number;
  role: "user" | "assistant" | "diary" | "knowledge";
  content: string;
  isDiary: boolean;
  mood?: string | null;
  category?: string | null;
  createdAt: string;
}

interface KnowledgeEntry {
  id: number;
  content: string;
  category?: string | null;
  createdAt: string;
}

const MOODS = ["reflective", "grateful", "concerned", "determined", "hopeful", "processing"];
const KNOWLEDGE_CATEGORIES = ["law", "process", "protocol", "personal", "general"];

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}
function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

const CARD_BG = "linear-gradient(160deg, #1a0404 0%, #0d0202 100%)";
const CARD_BORDER = "1px solid rgba(255,255,255,0.07)";
const MSG_USER = { background: "rgba(107,0,0,0.6)", border: "1px solid rgba(255,255,255,0.08)" };
const MSG_AI = { background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.06)" };
const MSG_KNOWLEDGE = { background: "rgba(40,20,0,0.6)", border: "1px solid rgba(180,120,30,0.2)" };
const HEADER_BG = { background: "rgba(0,0,0,0.4)", borderBottom: "1px solid rgba(255,255,255,0.07)" };
const INPUT_BG = { borderTop: "1px solid rgba(255,255,255,0.06)", background: "rgba(0,0,0,0.25)" };

interface KayaChatProps {
  memberPhoto?: string | null;
  memberName?: string;
  pendingTasks?: number;
  unreadNotifications?: number;
  pendingFilings?: number;
}

const QUICK_PROMPTS = [
  { label: "What's my status?", text: "Can you give me a quick summary of my sovereign standing and what I should focus on today?" },
  { label: "Know your rights", text: "Remind me of the key federal Indian law rights that protect my sovereign standing." },
  { label: "Red flag check", text: "What are the most common identity denial or misclassification red flags I should watch for?" },
  { label: "Lineage & standing", text: "Can you walk me through what makes my lineage and tribal standing legally valid?" },
  { label: "Trust responsibility", text: "Explain the federal trust responsibility and how it applies to my situation." },
  { label: "ICWA protections", text: "What protections does ICWA give me and my family?" },
];

export function KayaChat({ memberPhoto, memberName, pendingTasks, unreadNotifications, pendingFilings }: KayaChatProps = {}) {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const bottomRef = useRef<HTMLDivElement>(null);

  const [input, setInput] = useState("");
  const [inputMode, setInputMode] = useState<"chat" | "journal" | "memory">("chat");
  const [selectedMood, setSelectedMood] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [tab, setTab] = useState<"chat" | "memory" | "journal">("chat");
  const [collapsed, setCollapsed] = useState(false);

  const [pendingSaveMessage, setPendingSaveMessage] = useState<{ id: number; content: string } | null>(null);

  const authHeader = { Authorization: `Bearer ${getCurrentBearerToken() ?? ""}` };

  const { data: historyData, isLoading: historyLoading } = useQuery({
    queryKey: ["kaya-history", user?.id],
    queryFn: async () => {
      const r = await fetch("/api/kaya/history", { headers: authHeader });
      if (!r.ok) throw new Error("Failed to load conversation");
      return r.json() as Promise<{ messages: KayaMessage[] }>;
    },
    enabled: !!user,
    staleTime: 30_000,
  });

  const { data: diaryData, isLoading: diaryLoading } = useQuery({
    queryKey: ["kaya-diary", user?.id],
    queryFn: async () => {
      const r = await fetch("/api/kaya/diary", { headers: authHeader });
      if (!r.ok) throw new Error("Failed to load journal");
      return r.json() as Promise<{ entries: KayaMessage[] }>;
    },
    enabled: !!user && tab === "journal",
    staleTime: 30_000,
  });

  const { data: knowledgeData, isLoading: knowledgeLoading } = useQuery({
    queryKey: ["kaya-knowledge", user?.id],
    queryFn: async () => {
      const r = await fetch("/api/kaya/knowledge", { headers: authHeader });
      if (!r.ok) throw new Error("Failed to load memory");
      return r.json() as Promise<{ entries: KnowledgeEntry[] }>;
    },
    enabled: !!user,
    staleTime: 30_000,
  });

  const chatMutation = useMutation({
    mutationFn: async (message: string) => {
      const r = await fetch("/api/kaya/chat", {
        method: "POST",
        headers: { ...authHeader, "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });
      if (!r.ok) {
        const e = await r.json().catch(() => ({}));
        throw new Error((e as any).error ?? "Kaya is unavailable right now");
      }
      return r.json() as Promise<{ reply: string }>;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["kaya-history", user?.id] }),
    onError: (e) => toast({ title: "Kaya error", description: (e as Error).message, variant: "destructive" }),
  });

  const diaryMutation = useMutation({
    mutationFn: async ({ content, mood }: { content: string; mood?: string }) => {
      const r = await fetch("/api/kaya/diary", {
        method: "POST",
        headers: { ...authHeader, "Content-Type": "application/json" },
        body: JSON.stringify({ content, mood }),
      });
      if (!r.ok) throw new Error("Failed to save journal entry");
      return r.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["kaya-diary", user?.id] });
      toast({ title: "Journal entry saved", description: "Kaya will carry this forward." });
    },
    onError: (e) => toast({ title: "Save failed", description: (e as Error).message, variant: "destructive" }),
  });

  const knowledgeMutation = useMutation({
    mutationFn: async ({ content, category }: { content: string; category?: string }) => {
      const r = await fetch("/api/kaya/knowledge", {
        method: "POST",
        headers: { ...authHeader, "Content-Type": "application/json" },
        body: JSON.stringify({ content, category }),
      });
      if (!r.ok) throw new Error("Failed to save to memory");
      return r.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["kaya-knowledge", user?.id] });
      setPendingSaveMessage(null);
      toast({ title: "Saved to Kaya's memory", description: "She'll carry this knowledge in every conversation." });
    },
    onError: (e) => toast({ title: "Memory save failed", description: (e as Error).message, variant: "destructive" }),
  });

  const deleteKnowledgeMutation = useMutation({
    mutationFn: async (id: number) => {
      const r = await fetch(`/api/kaya/knowledge/${id}`, {
        method: "DELETE",
        headers: authHeader,
      });
      if (!r.ok) throw new Error("Failed to delete");
      return r.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["kaya-knowledge", user?.id] });
      toast({ title: "Removed from memory" });
    },
  });

  useEffect(() => {
    if (tab === "chat" && !collapsed) {
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 80);
    }
  }, [historyData?.messages, chatMutation.isPending, tab, collapsed]);

  function handleSend() {
    const text = input.trim();
    if (!text) return;
    setInput("");
    if (inputMode === "journal") {
      diaryMutation.mutate({ content: text, mood: selectedMood ?? undefined });
      setSelectedMood(null);
    } else if (inputMode === "memory") {
      knowledgeMutation.mutate({ content: text, category: selectedCategory ?? undefined });
      setSelectedCategory(null);
    } else {
      chatMutation.mutate(text);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleSend();
  }

  const messages = historyData?.messages ?? [];
  const diaryEntries = diaryData?.entries ?? [];
  const knowledgeEntries = knowledgeData?.entries ?? [];
  const isWorking = chatMutation.isPending || diaryMutation.isPending || knowledgeMutation.isPending;
  const firstName = (user?.name ?? "").split(/[\s,]+/)[0] || "you";

  const tabBtn = (key: typeof tab, icon: React.ReactNode, label: string) => (
    <button
      onClick={() => setTab(key)}
      className={`flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-medium transition-all ${
        tab === key ? "bg-red-900/60 text-white" : "text-white/40 hover:text-white/70"
      }`}
    >
      {icon}{label}
    </button>
  );

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{ background: CARD_BG, border: CARD_BORDER }}
    >
      {/* ── Header ── */}
      <div className="flex items-center justify-between px-4 py-3" style={HEADER_BG}>
        <div className="flex items-center gap-2.5">
          {/* Kaya icon */}
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
            style={{ background: "linear-gradient(135deg, #6B0000 0%, #9B1A1A 100%)", border: "1px solid rgba(255,255,255,0.15)" }}
          >
            <Feather className="w-4 h-4 text-amber-300" />
          </div>
          <div>
            <p className="text-sm font-bold text-white leading-none">Kaya</p>
            <p className="text-[9px] tracking-[0.2em] text-white/45 uppercase mt-0.5">
              Your Sovereign Companion · {knowledgeEntries.length} memories
            </p>
          </div>
          {/* Member context badges */}
          {(pendingTasks ?? 0) > 0 && (
            <span className="text-[9px] px-1.5 py-0.5 rounded-full text-amber-300/80 font-semibold" style={{ background: "rgba(180,120,10,0.2)", border: "1px solid rgba(180,120,10,0.25)" }}>
              {pendingTasks} task{pendingTasks !== 1 ? "s" : ""}
            </span>
          )}
          {(unreadNotifications ?? 0) > 0 && (
            <span className="text-[9px] px-1.5 py-0.5 rounded-full text-orange-300/80 font-semibold" style={{ background: "rgba(200,80,10,0.2)", border: "1px solid rgba(200,80,10,0.25)" }}>
              {unreadNotifications} unread
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          {/* Member photo avatar */}
          {memberPhoto && (
            <div className="w-7 h-7 rounded-full overflow-hidden border border-white/20 flex-shrink-0" title={memberName ?? "Member"}>
              <img src={memberPhoto} alt={memberName ?? "Member"} className="w-full h-full object-cover" />
            </div>
          )}
          {!collapsed && (
            <>
              {tabBtn("chat", <MessageCircle className="w-3 h-3" />, "Chat")}
              {tabBtn("memory", <Brain className="w-3 h-3" />, "Memory")}
              {tabBtn("journal", <BookOpen className="w-3 h-3" />, "Journal")}
            </>
          )}
          <button
            onClick={() => setCollapsed(c => !c)}
            className="ml-1 text-white/30 hover:text-white/70 transition-colors p-1"
            title={collapsed ? "Expand Kaya" : "Collapse Kaya"}
          >
            {collapsed ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {collapsed && (
        <div className="px-4 py-2 text-[11px] text-white/25 italic">
          Kaya is ready — expand to chat, add to memory, or journal.
        </div>
      )}

      {!collapsed && (
        <>
          {/* ── Chat Tab ── */}
          {tab === "chat" && (
            <>
              <div className="overflow-y-auto px-4 py-3 space-y-3" style={{ minHeight: 240, maxHeight: 380 }}>
                {historyLoading ? (
                  <div className="flex items-center justify-center h-24">
                    <Loader2 className="w-5 h-5 text-white/30 animate-spin" />
                  </div>
                ) : messages.length === 0 ? (
                  <div className="py-5 space-y-4">
                    {/* Greeting + member photo */}
                    <div className="flex items-center gap-3">
                      {memberPhoto ? (
                        <div className="w-10 h-10 rounded-full overflow-hidden border border-white/20 shrink-0">
                          <img src={memberPhoto} alt={memberName ?? "Member"} className="w-full h-full object-cover" />
                        </div>
                      ) : (
                        <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0" style={{ background: "rgba(100,20,20,0.5)", border: "1px solid rgba(255,255,255,0.1)" }}>
                          <Feather className="w-4 h-4 text-amber-300/60" />
                        </div>
                      )}
                      <div>
                        <p className="text-white/70 text-sm font-medium leading-snug">
                          Good to see you{memberName ? `, ${memberName.split(" ")[0]}` : ""}.
                        </p>
                        <p className="text-white/30 text-[11px]">
                          What's on your mind today?
                        </p>
                      </div>
                    </div>
                    {/* Contextual status strip */}
                    {((pendingTasks ?? 0) > 0 || (unreadNotifications ?? 0) > 0 || (pendingFilings ?? 0) > 0) && (
                      <div className="flex flex-wrap gap-1.5 px-1">
                        {(pendingTasks ?? 0) > 0 && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full text-amber-300/70" style={{ background: "rgba(180,120,10,0.15)", border: "1px solid rgba(180,120,10,0.2)" }}>
                            {pendingTasks} pending task{pendingTasks !== 1 ? "s" : ""}
                          </span>
                        )}
                        {(unreadNotifications ?? 0) > 0 && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full text-orange-300/70" style={{ background: "rgba(200,80,10,0.15)", border: "1px solid rgba(200,80,10,0.2)" }}>
                            {unreadNotifications} unread notification{unreadNotifications !== 1 ? "s" : ""}
                          </span>
                        )}
                        {(pendingFilings ?? 0) > 0 && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full text-blue-300/70" style={{ background: "rgba(30,80,180,0.15)", border: "1px solid rgba(30,80,180,0.2)" }}>
                            {pendingFilings} filing{pendingFilings !== 1 ? "s" : ""} pending
                          </span>
                        )}
                      </div>
                    )}
                    {/* Quick prompt chips */}
                    <div>
                      <p className="text-white/20 text-[10px] uppercase tracking-widest mb-2 px-1">Ask me about</p>
                      <div className="flex flex-wrap gap-1.5">
                        {QUICK_PROMPTS.map((p) => (
                          <button
                            key={p.label}
                            onClick={() => { setInput(p.text); }}
                            className="text-[11px] px-2.5 py-1 rounded-full text-white/55 hover:text-white/90 transition-all"
                            style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}
                          >
                            {p.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  messages.map((msg) => (
                    <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"} group`}>
                      <div className="relative max-w-[84%]">
                        <div
                          className="rounded-xl px-3.5 py-2.5"
                          style={msg.role === "user" ? MSG_USER : MSG_AI}
                        >
                          {msg.role === "assistant" && (
                            <p className="text-[9px] tracking-[0.18em] text-amber-400/70 uppercase font-semibold mb-1">Kaya</p>
                          )}
                          <p className="text-sm text-white/88 leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                          <p className="text-[9px] text-white/25 mt-1 text-right">{formatTime(msg.createdAt)}</p>
                        </div>
                        {msg.role === "user" && (
                          <button
                            onClick={() => setPendingSaveMessage({ id: msg.id, content: msg.content })}
                            className="absolute -bottom-4 right-0 opacity-0 group-hover:opacity-100 transition-opacity text-[9px] text-amber-500/60 hover:text-amber-400 flex items-center gap-1 whitespace-nowrap"
                          >
                            <Brain className="w-2.5 h-2.5" /> save to memory
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                )}

                {chatMutation.isPending && (
                  <div className="flex justify-start">
                    <div className="rounded-xl px-3.5 py-2.5" style={MSG_AI}>
                      <p className="text-[9px] tracking-[0.18em] text-amber-400/70 uppercase font-semibold mb-1">Kaya</p>
                      <div className="flex gap-1 items-center py-1">
                        {[0, 1, 2].map(i => (
                          <span key={i} className="w-1.5 h-1.5 rounded-full bg-white/30 animate-bounce"
                            style={{ animationDelay: `${i * 150}ms` }} />
                        ))}
                      </div>
                    </div>
                  </div>
                )}
                <div ref={bottomRef} />
              </div>

              {/* Pending save to memory banner */}
              {pendingSaveMessage && (
                <div className="mx-4 mb-2 rounded-lg px-3 py-2 flex items-start gap-2" style={MSG_KNOWLEDGE}>
                  <Brain className="w-3.5 h-3.5 text-amber-400/70 flex-shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] text-amber-400/70 font-semibold mb-0.5">Save this to Kaya's memory?</p>
                    <p className="text-[11px] text-white/60 truncate">{pendingSaveMessage.content.substring(0, 80)}…</p>
                    <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                      {KNOWLEDGE_CATEGORIES.map(cat => (
                        <button
                          key={cat}
                          onClick={() => setSelectedCategory(c => c === cat ? null : cat)}
                          className={`text-[9px] px-1.5 py-0.5 rounded-full border capitalize transition-all ${
                            selectedCategory === cat
                              ? "border-amber-600/60 bg-amber-900/30 text-amber-300"
                              : "border-white/10 text-white/30 hover:text-white/50"
                          }`}
                        >
                          {cat}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="flex gap-1.5 flex-shrink-0">
                    <button
                      onClick={() => knowledgeMutation.mutate({
                        content: pendingSaveMessage.content,
                        category: selectedCategory ?? undefined,
                      })}
                      disabled={knowledgeMutation.isPending}
                      className="text-[10px] px-2 py-0.5 rounded bg-amber-900/40 text-amber-300 hover:bg-amber-900/60 transition-colors"
                    >
                      Save
                    </button>
                    <button onClick={() => { setPendingSaveMessage(null); setSelectedCategory(null); }}>
                      <X className="w-3.5 h-3.5 text-white/30 hover:text-white/60" />
                    </button>
                  </div>
                </div>
              )}

              {/* Input area */}
              <div className="px-4 py-3 space-y-2" style={INPUT_BG}>
                <div className="flex items-center gap-2 flex-wrap">
                  {[
                    { key: "chat" as const, label: "Talk to Kaya" },
                    { key: "journal" as const, label: "Journal entry" },
                    { key: "memory" as const, label: "Teach Kaya" },
                  ].map(({ key, label }) => (
                    <button
                      key={key}
                      onClick={() => setInputMode(key)}
                      className={`flex items-center gap-1 text-[10px] px-2.5 py-0.5 rounded-full border transition-all ${
                        inputMode === key
                          ? "border-amber-600/60 bg-amber-900/30 text-amber-300"
                          : "border-white/10 text-white/30 hover:text-white/50"
                      }`}
                    >
                      {key === "memory" && <Brain className="w-2.5 h-2.5" />}
                      {key === "journal" && <BookOpen className="w-2.5 h-2.5" />}
                      {label}
                    </button>
                  ))}
                </div>

                {inputMode === "journal" && (
                  <div className="flex flex-wrap gap-1">
                    {MOODS.map(mood => (
                      <button key={mood}
                        onClick={() => setSelectedMood(m => m === mood ? null : mood)}
                        className={`text-[10px] px-2 py-0.5 rounded-full border transition-all capitalize ${
                          selectedMood === mood
                            ? "border-red-700/60 bg-red-900/30 text-white/80"
                            : "border-white/8 text-white/25 hover:text-white/45"
                        }`}
                      >{mood}</button>
                    ))}
                  </div>
                )}

                {inputMode === "memory" && (
                  <div className="flex flex-wrap gap-1">
                    {KNOWLEDGE_CATEGORIES.map(cat => (
                      <button key={cat}
                        onClick={() => setSelectedCategory(c => c === cat ? null : cat)}
                        className={`text-[10px] px-2 py-0.5 rounded-full border transition-all capitalize ${
                          selectedCategory === cat
                            ? "border-amber-600/60 bg-amber-900/30 text-amber-300"
                            : "border-white/8 text-white/25 hover:text-white/45"
                        }`}
                      >{cat}</button>
                    ))}
                  </div>
                )}

                <div className="flex gap-2">
                  <Textarea
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={
                      inputMode === "journal"
                        ? "Write your reflection… Kaya carries this forward."
                        : inputMode === "memory"
                        ? "Share knowledge for Kaya to remember across all sessions…"
                        : "Ask Kaya about law, sovereignty, or anything on your mind…"
                    }
                    className="flex-1 resize-none text-sm text-white/85 placeholder:text-white/20 rounded-lg min-h-[72px] max-h-[140px]"
                    style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
                    disabled={isWorking}
                  />
                  <Button
                    onClick={handleSend}
                    disabled={!input.trim() || isWorking}
                    className="self-end h-9 w-9 p-0 rounded-lg flex-shrink-0"
                    style={{ background: inputMode === "memory" ? "linear-gradient(135deg, #5a3a00 0%, #8a6020 100%)" : "linear-gradient(135deg, #6B0000 0%, #9B1A1A 100%)", border: "none" }}
                  >
                    {isWorking
                      ? <Loader2 className="w-4 h-4 animate-spin text-white" />
                      : inputMode === "memory"
                      ? <Brain className="w-4 h-4 text-amber-200" />
                      : <Send className="w-4 h-4 text-white" />}
                  </Button>
                </div>
                <p className="text-[9px] text-white/18 text-right">
                  Ctrl+Enter to send ·{" "}
                  {inputMode === "memory" ? "Kaya will retain this across all conversations" : "Kaya carries your conversations and memory forward"}
                </p>
              </div>
            </>
          )}

          {/* ── Memory Tab ── */}
          {tab === "memory" && (
            <div className="flex flex-col" style={{ minHeight: 280 }}>
              <div className="px-4 pt-3 pb-2 space-y-2" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                <p className="text-[11px] text-white/40 leading-relaxed">
                  Teach Kaya facts, context, and knowledge you want her to carry in every conversation —
                  law distinctions, tribal process, personal context, anything she should always know.
                </p>
                <div className="flex gap-1.5 flex-wrap">
                  {KNOWLEDGE_CATEGORIES.map(cat => (
                    <button key={cat}
                      onClick={() => setSelectedCategory(c => c === cat ? null : cat)}
                      className={`text-[10px] px-2 py-0.5 rounded-full border transition-all capitalize ${
                        selectedCategory === cat
                          ? "border-amber-600/60 bg-amber-900/30 text-amber-300"
                          : "border-white/10 text-white/25 hover:text-white/45"
                      }`}
                    >{cat}</button>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Textarea
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="e.g., 'The difference between positive law and organic law is…' or 'Our tribal enrollment process requires…'"
                    className="flex-1 resize-none text-sm text-white/85 placeholder:text-white/20 rounded-lg min-h-[64px] max-h-[120px]"
                    style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
                    disabled={knowledgeMutation.isPending}
                  />
                  <Button
                    onClick={() => {
                      const text = input.trim();
                      if (!text) return;
                      setInput("");
                      knowledgeMutation.mutate({ content: text, category: selectedCategory ?? undefined });
                      setSelectedCategory(null);
                    }}
                    disabled={!input.trim() || knowledgeMutation.isPending}
                    className="self-end h-9 w-9 p-0 rounded-lg flex-shrink-0"
                    style={{ background: "linear-gradient(135deg, #5a3a00 0%, #8a6020 100%)", border: "none" }}
                  >
                    {knowledgeMutation.isPending
                      ? <Loader2 className="w-4 h-4 animate-spin text-amber-200" />
                      : <Plus className="w-4 h-4 text-amber-200" />}
                  </Button>
                </div>
              </div>

              <div className="overflow-y-auto px-4 py-3 space-y-2.5 flex-1" style={{ maxHeight: 320 }}>
                {knowledgeLoading ? (
                  <div className="flex items-center justify-center h-20">
                    <Loader2 className="w-5 h-5 text-white/30 animate-spin" />
                  </div>
                ) : knowledgeEntries.length === 0 ? (
                  <div className="text-center py-8">
                    <Brain className="w-7 h-7 text-white/12 mx-auto mb-2" />
                    <p className="text-white/30 text-sm">No memories saved yet.</p>
                    <p className="text-white/18 text-[11px] mt-1">
                      Add knowledge above — Kaya will carry it in every conversation.
                    </p>
                  </div>
                ) : (
                  knowledgeEntries.map(entry => (
                    <div key={entry.id} className="rounded-lg px-3 py-2.5 group" style={MSG_KNOWLEDGE}>
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-1.5">
                          {entry.category && (
                            <Badge
                              className="text-[9px] px-1.5 py-0 h-4 capitalize"
                              style={{ background: "rgba(120,80,0,0.5)", color: "rgba(255,200,80,0.8)", border: "none" }}
                            >
                              {entry.category}
                            </Badge>
                          )}
                          <p className="text-[9px] text-white/30">{formatDate(entry.createdAt)}</p>
                        </div>
                        <button
                          onClick={() => deleteKnowledgeMutation.mutate(entry.id)}
                          className="opacity-0 group-hover:opacity-100 transition-opacity text-white/25 hover:text-red-400"
                          title="Remove from memory"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <p className="text-sm text-white/72 leading-relaxed whitespace-pre-wrap">{entry.content}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* ── Journal Tab ── */}
          {tab === "journal" && (
            <div className="overflow-y-auto px-4 py-4 space-y-3" style={{ minHeight: 240, maxHeight: 500 }}>
              {diaryLoading ? (
                <div className="flex items-center justify-center h-24">
                  <Loader2 className="w-5 h-5 text-white/30 animate-spin" />
                </div>
              ) : diaryEntries.length === 0 ? (
                <div className="text-center py-10">
                  <BookOpen className="w-7 h-7 text-white/15 mx-auto mb-2" />
                  <p className="text-white/35 text-sm">Your journal is empty.</p>
                  <p className="text-white/20 text-[11px] mt-1">
                    Go to Chat and choose "Journal entry" to write your first reflection.
                  </p>
                </div>
              ) : (
                diaryEntries.map(entry => (
                  <div key={entry.id} className="rounded-lg px-3.5 py-3"
                    style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}>
                    <div className="flex items-center justify-between mb-1.5">
                      <p className="text-[9px] tracking-[0.15em] text-white/35 uppercase">{formatDate(entry.createdAt)}</p>
                      {entry.mood && (
                        <Badge className="text-[9px] px-1.5 py-0 h-4 capitalize"
                          style={{ background: "rgba(107,0,0,0.5)", color: "rgba(255,255,255,0.6)", border: "none" }}>
                          {entry.mood}
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-white/75 leading-relaxed whitespace-pre-wrap">{entry.content}</p>
                  </div>
                ))
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
