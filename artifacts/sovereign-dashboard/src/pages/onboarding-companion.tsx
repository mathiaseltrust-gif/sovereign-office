import { useState, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth, getCurrentBearerToken } from "@/components/auth-provider";
import { Send, ArrowRight, Loader2 } from "lucide-react";

type Message = { role: "user" | "assistant"; content: string };

const WELCOME_PARAGRAPHS = [
  "Welcome to Companion.",
  "It's good to see you here.",
  "Companion is part of a living system built to help preserve our history, strengthen continuity, organize knowledge, and support our people moving forward with greater awareness and direction.",
  "A lot is changing around us. History is still unfolding in real time. Because of that, understanding who we are, where we come from, and how we protect and preserve that legacy matters now more than ever.",
  "That's why Companion exists.",
  "As you move through the platform, Companion will guide you naturally through the system — helping you explore tools, organize information, document history, learn, build, and navigate the platform with greater ease.",
  "You can ask Companion questions at any time.",
  "Whether you're trying to understand a process, locate tools or records, build documentation, organize family or ancestral information, learn about protections and continuity, or simply figure out where to begin — Companion is designed to help guide you there.",
  "Over time, Companion may softly ask questions about your background, interests, family history, goals, or the areas you're exploring. This helps personalize your experience and allows the system to better assist you as it grows alongside you.",
  "Nothing here is intended to feel forced, rushed, or transactional.",
  "We are building continuity. We are preserving memory. We are organizing knowledge. We are protecting identity, history, and legacy for the generations still to come.",
  "We're glad you're here, Family.\n\nWelcome to Companion.",
];

const INITIAL_COMPANION_MESSAGE =
  `It's good to see you here, Family.\n\nI'm Companion — an intelligent guide built into this platform to help you navigate, understand, and make the most of what's here.\n\nThis system was built to help preserve history, organize knowledge, protect identity and legacy, and support our people moving forward. That's a meaningful mission — and I'm here to help make it feel accessible.\n\nBefore we explore the platform together, I'd like to get to know you a little.\n\nTo start simply: what would you like me to call you?`;

export default function OnboardingCompanionPage() {
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [phase, setPhase] = useState<"welcome" | "chat">("welcome");
  const [messages, setMessages] = useState<Message[]>([
    { role: "assistant", content: INITIAL_COMPANION_MESSAGE },
  ]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [completing, setCompleting] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const base = (import.meta.env.BASE_URL as string).replace(/\/$/, "");
  const apiBase = base.replace(/\/sovereign-dashboard$/, "");

  useEffect(() => {
    if (phase === "chat") {
      setTimeout(() => {
        bottomRef.current?.scrollIntoView({ behavior: "smooth" });
        inputRef.current?.focus();
      }, 100);
    }
  }, [phase]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function sendMessage(text?: string) {
    const userMsg = (text ?? input).trim();
    if (!userMsg || sending) return;
    setInput("");
    const newMessages: Message[] = [...messages, { role: "user", content: userMsg }];
    setMessages(newMessages);
    setSending(true);
    try {
      const token = getCurrentBearerToken();
      const history = newMessages.slice(0, -1);
      const res = await fetch(`${apiBase}/api/kaya/onboarding/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ message: userMsg, history }),
      });
      if (!res.ok) throw new Error("Response failed");
      const data = (await res.json()) as { reply: string };
      setMessages((prev) => [...prev, { role: "assistant", content: data.reply }]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "I'm here with you. Please try again in a moment." },
      ]);
    } finally {
      setSending(false);
    }
  }

  async function completeOnboarding() {
    setCompleting(true);
    try {
      const token = getCurrentBearerToken();
      await fetch(`${apiBase}/api/kaya/onboarding/complete`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      await queryClient.invalidateQueries({ queryKey: ["companion-onboarding-status"] });
      navigate("/");
    } catch {
      setCompleting(false);
    }
  }

  if (phase === "welcome") {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex flex-col items-center justify-center p-6 bg-gradient-to-b from-background to-muted/20">
        <div className="w-full max-w-2xl space-y-8">
          <div className="text-center space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-[10px] font-semibold tracking-widest uppercase">
              Companion · Orientation
            </div>
            <h1 className="text-3xl font-bold text-foreground">
              Welcome, {user?.name?.split(" ")[0] ?? "Family"}.
            </h1>
          </div>

          <div className="bg-card border border-card-border rounded-2xl shadow-sm overflow-hidden">
            <div className="h-1 w-full bg-gradient-to-r from-primary/40 via-primary to-primary/40" />
            <div className="p-8 space-y-4">
              {WELCOME_PARAGRAPHS.map((para, i) => (
                <p
                  key={i}
                  className={`text-sm leading-relaxed whitespace-pre-line ${
                    i === 0
                      ? "text-xl font-bold text-foreground"
                      : i === 4
                      ? "text-base font-semibold text-foreground"
                      : i === WELCOME_PARAGRAPHS.length - 1
                      ? "font-semibold text-foreground pt-2"
                      : "text-muted-foreground"
                  }`}
                >
                  {para}
                </p>
              ))}
            </div>
          </div>

          <div className="flex flex-col items-center gap-3">
            <button
              onClick={() => setPhase("chat")}
              className="flex items-center gap-2 px-7 py-3 bg-primary text-primary-foreground font-semibold rounded-xl hover:opacity-90 transition-opacity text-sm shadow-sm"
            >
              Begin conversation <ArrowRight className="w-4 h-4" />
            </button>
            <button
              onClick={completeOnboarding}
              disabled={completing}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Skip and explore the platform →
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col" style={{ height: "calc(100vh - 4rem)" }}>
      <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-card/80 backdrop-blur-sm shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center shrink-0">
            <span className="text-[10px] font-bold text-primary">C</span>
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground leading-none">Companion</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">Onboarding &amp; Orientation</p>
          </div>
        </div>
        <button
          onClick={completeOnboarding}
          disabled={completing}
          className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-primary border border-primary/30 rounded-lg hover:bg-primary/5 transition-colors disabled:opacity-60"
        >
          {completing ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <ArrowRight className="w-3.5 h-3.5" />
          )}
          I'm ready to explore the platform
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-6 space-y-5">
        {messages.map((msg, i) => (
          <div key={i} className={`flex items-end gap-2 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            {msg.role === "assistant" && (
              <div className="w-6 h-6 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center shrink-0 mb-0.5">
                <span className="text-[9px] font-bold text-primary">C</span>
              </div>
            )}
            <div
              className={`max-w-[72%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap shadow-sm ${
                msg.role === "user"
                  ? "bg-primary text-primary-foreground rounded-br-sm"
                  : "bg-card border border-card-border text-card-foreground rounded-bl-sm"
              }`}
            >
              {msg.content}
            </div>
          </div>
        ))}

        {sending && (
          <div className="flex items-end gap-2 justify-start">
            <div className="w-6 h-6 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center shrink-0">
              <span className="text-[9px] font-bold text-primary">C</span>
            </div>
            <div className="bg-card border border-card-border rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm">
              <div className="flex gap-1.5 items-center h-4">
                <div className="w-1.5 h-1.5 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: "0ms" }} />
                <div className="w-1.5 h-1.5 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: "160ms" }} />
                <div className="w-1.5 h-1.5 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: "320ms" }} />
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="px-5 py-4 border-t border-border bg-card/80 backdrop-blur-sm shrink-0">
        <div className="flex gap-3 items-end">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
              }
            }}
            placeholder="Share something about yourself, or ask Companion a question…"
            rows={2}
            className="flex-1 resize-none rounded-xl border border-input bg-background px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 placeholder:text-muted-foreground/50 leading-relaxed"
          />
          <button
            onClick={() => sendMessage()}
            disabled={!input.trim() || sending}
            className="p-3 bg-primary text-primary-foreground rounded-xl hover:opacity-90 transition-opacity disabled:opacity-40 shrink-0"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
        <p className="text-[10px] text-muted-foreground/40 mt-2 text-center">
          Enter to send · Shift+Enter for new line
        </p>
      </div>
    </div>
  );
}
