import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth, getCurrentBearerToken } from "@/components/auth-provider";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Send, BookOpen, MessageCircle, Loader2, Sparkles } from "lucide-react";

interface KiMessage {
  id: number;
  role: "user" | "assistant" | "diary";
  content: string;
  isDiary: boolean;
  mood?: string | null;
  createdAt: string;
}

interface DiaryEntry {
  id: number;
  content: string;
  mood?: string | null;
  createdAt: string;
}

const MOODS = ["reflective", "grateful", "concerned", "determined", "hopeful", "processing"];

function formatTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
  });
}

export function KiChat() {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const bottomRef = useRef<HTMLDivElement>(null);

  const [input, setInput] = useState("");
  const [diaryMode, setDiaryMode] = useState(false);
  const [selectedMood, setSelectedMood] = useState<string | null>(null);
  const [view, setView] = useState<"chat" | "diary">("chat");

  const authHeader = { Authorization: `Bearer ${getCurrentBearerToken() ?? ""}` };

  const { data: historyData, isLoading: historyLoading } = useQuery({
    queryKey: ["ki-history", user?.id],
    queryFn: async () => {
      const r = await fetch("/api/ki/history", { headers: authHeader });
      if (!r.ok) throw new Error("Failed to load KI history");
      return r.json() as Promise<{ messages: KiMessage[] }>;
    },
    enabled: !!user,
    staleTime: 30_000,
  });

  const { data: diaryData, isLoading: diaryLoading } = useQuery({
    queryKey: ["ki-diary", user?.id],
    queryFn: async () => {
      const r = await fetch("/api/ki/diary", { headers: authHeader });
      if (!r.ok) throw new Error("Failed to load diary");
      return r.json() as Promise<{ entries: DiaryEntry[] }>;
    },
    enabled: !!user && view === "diary",
    staleTime: 30_000,
  });

  const chatMutation = useMutation({
    mutationFn: async (message: string) => {
      const r = await fetch("/api/ki/chat", {
        method: "POST",
        headers: { ...authHeader, "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });
      if (!r.ok) {
        const e = await r.json().catch(() => ({}));
        throw new Error((e as any).error ?? "KI is unavailable right now");
      }
      return r.json() as Promise<{ reply: string }>;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ki-history", user?.id] });
    },
    onError: (e) => toast({ title: "KI error", description: (e as Error).message, variant: "destructive" }),
  });

  const diaryMutation = useMutation({
    mutationFn: async ({ content, mood }: { content: string; mood?: string }) => {
      const r = await fetch("/api/ki/diary", {
        method: "POST",
        headers: { ...authHeader, "Content-Type": "application/json" },
        body: JSON.stringify({ content, mood }),
      });
      if (!r.ok) throw new Error("Failed to save diary entry");
      return r.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ki-diary", user?.id] });
      toast({ title: "Journal entry saved", description: "KI will remember this." });
    },
    onError: (e) => toast({ title: "Save failed", description: (e as Error).message, variant: "destructive" }),
  });

  useEffect(() => {
    if (view === "chat") {
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 80);
    }
  }, [historyData?.messages, chatMutation.isPending, view]);

  function handleSend() {
    const text = input.trim();
    if (!text) return;
    setInput("");

    if (diaryMode) {
      diaryMutation.mutate({ content: text, mood: selectedMood ?? undefined });
      setSelectedMood(null);
    } else {
      chatMutation.mutate(text);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleSend();
  }

  const messages = historyData?.messages ?? [];
  const diaryEntries = diaryData?.entries ?? [];
  const isWorking = chatMutation.isPending || diaryMutation.isPending;
  const firstName = (user?.name ?? "").split(/[\s,]+/)[0] || "you";

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{ background: "linear-gradient(160deg, #1a0404 0%, #0d0202 100%)", border: "1px solid rgba(255,255,255,0.07)" }}
    >
      {/* ── Header ── */}
      <div
        className="flex items-center justify-between px-4 py-3"
        style={{ background: "rgba(0,0,0,0.4)", borderBottom: "1px solid rgba(255,255,255,0.07)" }}
      >
        <div className="flex items-center gap-2.5">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
            style={{ background: "linear-gradient(135deg, #6B0000 0%, #9B1A1A 100%)", border: "1px solid rgba(255,255,255,0.15)" }}
          >
            <Sparkles className="w-4 h-4 text-amber-300" />
          </div>
          <div>
            <p className="text-sm font-bold text-white leading-none">KI</p>
            <p className="text-[9px] tracking-[0.2em] text-white/45 uppercase mt-0.5">Your Sovereign Companion</p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setView("chat")}
            className={`flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-medium transition-all ${
              view === "chat" ? "bg-red-900/60 text-white" : "text-white/40 hover:text-white/70"
            }`}
          >
            <MessageCircle className="w-3 h-3" />
            Chat
          </button>
          <button
            onClick={() => setView("diary")}
            className={`flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-medium transition-all ${
              view === "diary" ? "bg-red-900/60 text-white" : "text-white/40 hover:text-white/70"
            }`}
          >
            <BookOpen className="w-3 h-3" />
            Journal
          </button>
        </div>
      </div>

      {/* ── Chat View ── */}
      {view === "chat" && (
        <>
          <div className="overflow-y-auto px-4 py-3 space-y-3" style={{ minHeight: 220, maxHeight: 340 }}>
            {historyLoading ? (
              <div className="flex items-center justify-center h-24">
                <Loader2 className="w-5 h-5 text-white/30 animate-spin" />
              </div>
            ) : messages.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-white/40 text-sm">
                  Is there anything you'd like to share today, {firstName}?
                </p>
                <p className="text-white/20 text-[11px] mt-1">
                  I'm here — whether it's a question, a thought, or something on your mind.
                </p>
              </div>
            ) : (
              messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className="max-w-[82%] rounded-xl px-3.5 py-2.5"
                    style={
                      msg.role === "user"
                        ? { background: "rgba(107,0,0,0.6)", border: "1px solid rgba(255,255,255,0.08)" }
                        : { background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.06)" }
                    }
                  >
                    {msg.role === "assistant" && (
                      <p className="text-[9px] tracking-[0.18em] text-amber-400/70 uppercase font-semibold mb-1">KI</p>
                    )}
                    <p className="text-sm text-white/88 leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                    <p className="text-[9px] text-white/25 mt-1 text-right">{formatTime(msg.createdAt)}</p>
                  </div>
                </div>
              ))
            )}

            {chatMutation.isPending && (
              <div className="flex justify-start">
                <div
                  className="rounded-xl px-3.5 py-2.5"
                  style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.06)" }}
                >
                  <p className="text-[9px] tracking-[0.18em] text-amber-400/70 uppercase font-semibold mb-1">KI</p>
                  <div className="flex gap-1 items-center py-1">
                    {[0, 1, 2].map(i => (
                      <span
                        key={i}
                        className="w-1.5 h-1.5 rounded-full bg-white/30 animate-bounce"
                        style={{ animationDelay: `${i * 150}ms` }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* ── Input ── */}
          <div
            className="px-4 py-3 space-y-2"
            style={{ borderTop: "1px solid rgba(255,255,255,0.06)", background: "rgba(0,0,0,0.25)" }}
          >
            {/* Diary mode toggle */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => { setDiaryMode(false); setSelectedMood(null); }}
                className={`text-[10px] px-2.5 py-0.5 rounded-full border transition-all ${
                  !diaryMode
                    ? "border-amber-600/60 bg-amber-900/30 text-amber-300"
                    : "border-white/10 text-white/30 hover:text-white/50"
                }`}
              >
                Chat with KI
              </button>
              <button
                onClick={() => setDiaryMode(true)}
                className={`flex items-center gap-1 text-[10px] px-2.5 py-0.5 rounded-full border transition-all ${
                  diaryMode
                    ? "border-amber-600/60 bg-amber-900/30 text-amber-300"
                    : "border-white/10 text-white/30 hover:text-white/50"
                }`}
              >
                <BookOpen className="w-2.5 h-2.5" />
                Journal entry
              </button>
            </div>

            {/* Mood selector — only in diary mode */}
            {diaryMode && (
              <div className="flex flex-wrap gap-1">
                {MOODS.map(mood => (
                  <button
                    key={mood}
                    onClick={() => setSelectedMood(m => m === mood ? null : mood)}
                    className={`text-[10px] px-2 py-0.5 rounded-full border transition-all capitalize ${
                      selectedMood === mood
                        ? "border-red-700/60 bg-red-900/30 text-white/80"
                        : "border-white/8 text-white/25 hover:text-white/45"
                    }`}
                  >
                    {mood}
                  </button>
                ))}
              </div>
            )}

            <div className="flex gap-2">
              <Textarea
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={
                  diaryMode
                    ? "Write your reflection… (Ctrl+Enter to save)"
                    : "Share something with KI… (Ctrl+Enter to send)"
                }
                className="flex-1 resize-none text-sm text-white/85 placeholder:text-white/20 rounded-lg min-h-[72px] max-h-[140px]"
                style={{
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.08)",
                }}
                disabled={isWorking}
              />
              <Button
                onClick={handleSend}
                disabled={!input.trim() || isWorking}
                className="self-end h-9 w-9 p-0 rounded-lg flex-shrink-0"
                style={{ background: "linear-gradient(135deg, #6B0000 0%, #9B1A1A 100%)", border: "none" }}
              >
                {isWorking ? <Loader2 className="w-4 h-4 animate-spin text-white" /> : <Send className="w-4 h-4 text-white" />}
              </Button>
            </div>
            <p className="text-[9px] text-white/18 text-right">Ctrl+Enter to send · KI remembers your conversations</p>
          </div>
        </>
      )}

      {/* ── Journal View ── */}
      {view === "diary" && (
        <div className="overflow-y-auto px-4 py-4 space-y-3" style={{ minHeight: 220, maxHeight: 500 }}>
          {diaryLoading ? (
            <div className="flex items-center justify-center h-24">
              <Loader2 className="w-5 h-5 text-white/30 animate-spin" />
            </div>
          ) : diaryEntries.length === 0 ? (
            <div className="text-center py-10">
              <BookOpen className="w-7 h-7 text-white/15 mx-auto mb-2" />
              <p className="text-white/35 text-sm">Your journal is empty.</p>
              <p className="text-white/20 text-[11px] mt-1">Switch to Chat and choose "Journal entry" to add your first reflection.</p>
            </div>
          ) : (
            diaryEntries.map((entry) => (
              <div
                key={entry.id}
                className="rounded-lg px-3.5 py-3"
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <p className="text-[9px] tracking-[0.15em] text-white/35 uppercase">{formatDate(entry.createdAt)}</p>
                  {entry.mood && (
                    <Badge
                      className="text-[9px] px-1.5 py-0 h-4 capitalize"
                      style={{ background: "rgba(107,0,0,0.5)", color: "rgba(255,255,255,0.6)", border: "none" }}
                    >
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
    </div>
  );
}
