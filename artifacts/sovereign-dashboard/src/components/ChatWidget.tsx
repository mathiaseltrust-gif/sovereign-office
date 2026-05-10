import { useState, useRef, useEffect, useCallback } from "react";
import { useAuth } from "./auth-provider";
import { useLocation } from "wouter";

const makeToken = (user: { id: number; email: string; roles: string[]; name: string }) =>
  btoa(JSON.stringify(user));

interface ChatLawRef {
  title: string;
  citation: string;
  type: "federal" | "tribal" | "doctrine";
}

interface ChatAction {
  label: string;
  href?: string;
  intent?: string;
}

interface ChatIntakeReport {
  riskLevel: string;
  violations: string[];
  troRecommended: boolean;
  nfrRecommended: boolean;
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  tier?: string;
  tierLabel?: string;
  redFlag?: boolean;
  redFlagMessage?: string;
  lawRefs?: ChatLawRef[];
  actions?: ChatAction[];
  intakeReport?: ChatIntakeReport;
  azureTokensUsed?: number;
  timestamp: Date;
}

const TIER_COLORS: Record<string, string> = {
  funnel: "#1a6b3c",
  intake_filter: "#b45309",
  law_db: "#1d4ed8",
  azure_openai: "#7c3aed",
  hard_default: "#374151",
};

const TIER_ICONS: Record<string, string> = {
  funnel: "⚖",
  intake_filter: "⚑",
  law_db: "§",
  azure_openai: "✦",
  hard_default: "○",
};

const QUICK_PROMPTS = [
  { label: "File a Complaint", message: "How do I file a complaint?" },
  { label: "ICWA Rights", message: "What are my rights under ICWA?" },
  { label: "Trust Land", message: "What protections does trust land have?" },
  { label: "Jurisdiction", message: "Who has jurisdiction over Indian Country?" },
  { label: "Welfare Help", message: "What welfare benefits am I entitled to?" },
  { label: "My Documents", message: "What documents can I get from the office?" },
];

const INTENT_MESSAGES: Record<string, string> = {
  ICWA_GUIDE: "What are my rights under ICWA?",
  TRUST_LAND: "What protections does trust land have?",
  ANALYZE_SITUATION: "I need help analyzing my specific legal situation.",
  EMERGENCY: "I have an emergency situation that needs immediate attention.",
  AI_ESCALATE: "I need a detailed AI legal analysis of my question.",
};

export function ChatWidget() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [hasRedFlag, setHasRedFlag] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (open) {
      scrollToBottom();
      setUnreadCount(0);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open, messages]);

  const addMessage = (msg: Omit<ChatMessage, "id" | "timestamp">) => {
    const full: ChatMessage = { ...msg, id: Math.random().toString(36).slice(2), timestamp: new Date() };
    setMessages(prev => [...prev, full]);
    if (!open && msg.role === "assistant") setUnreadCount(n => n + 1);
    return full;
  };

  const sendMessage = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    setInput("");
    addMessage({ role: "user", content: trimmed });
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${makeToken(user)}`,
        },
        body: JSON.stringify({ message: trimmed }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Request failed" }));
        addMessage({
          role: "assistant",
          content: `I encountered an issue processing your request. Please try again or file a complaint directly. (${err.error ?? res.status})`,
          tier: "hard_default",
          tierLabel: "Sovereign Office",
        });
        return;
      }

      const data = await res.json();
      if (data.redFlag) setHasRedFlag(true);
      addMessage({
        role: "assistant",
        content: data.reply,
        tier: data.tier,
        tierLabel: data.tierLabel,
        redFlag: data.redFlag,
        redFlagMessage: data.redFlagMessage,
        lawRefs: data.lawRefs,
        actions: data.actions,
        intakeReport: data.intakeReport,
        azureTokensUsed: data.azureTokensUsed,
      });
    } catch {
      addMessage({
        role: "assistant",
        content: "Unable to reach the Sovereign Office server. Please check your connection and try again.",
        tier: "hard_default",
        tierLabel: "Sovereign Office",
      });
    } finally {
      setLoading(false);
    }
  }, [loading, user]);

  const handleIntent = (intent: string) => {
    const msg = INTENT_MESSAGES[intent];
    if (msg) sendMessage(msg);
  };

  const handleNavigate = (href: string) => {
    navigate(href);
    setOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const openWithGreeting = () => {
    setOpen(true);
    if (messages.length === 0) {
      setTimeout(() => sendMessage("hello"), 200);
    }
  };

  const formatContent = (content: string) => {
    return content.split("\n").map((line, i) => {
      if (line.startsWith("• ")) {
        return (
          <div key={i} style={{ display: "flex", gap: 6, marginBottom: 2 }}>
            <span style={{ color: "#b5a057", flexShrink: 0 }}>•</span>
            <span>{line.slice(2)}</span>
          </div>
        );
      }
      if (/^[A-Z][A-Z\s/()&–-]{3,}:/.test(line) && line.length < 80) {
        return (
          <div key={i} style={{ fontWeight: 700, marginTop: i > 0 ? 10 : 4, marginBottom: 2, color: "#1a1a2e" }}>
            {line}
          </div>
        );
      }
      if (line === "") return <div key={i} style={{ height: 6 }} />;
      return <div key={i}>{line}</div>;
    });
  };

  return (
    <>
      {/* Floating Chat Button */}
      <button
        onClick={openWithGreeting}
        aria-label="Open Sovereign Office Assistant"
        style={{
          position: "fixed",
          bottom: 28,
          right: 28,
          width: 56,
          height: 56,
          borderRadius: "50%",
          background: hasRedFlag ? "#b91c1c" : "#1a3a2a",
          color: "#fff",
          border: "none",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 22,
          boxShadow: hasRedFlag
            ? "0 0 0 3px #fca5a5, 0 4px 20px rgba(185,28,28,0.5)"
            : "0 4px 20px rgba(0,0,0,0.35)",
          zIndex: 9998,
          transition: "all 0.2s ease",
        }}
      >
        {open ? "✕" : "⚖"}
        {unreadCount > 0 && !open && (
          <span
            style={{
              position: "absolute",
              top: -4,
              right: -4,
              background: "#dc2626",
              color: "#fff",
              fontSize: 11,
              fontWeight: 700,
              borderRadius: "50%",
              width: 18,
              height: 18,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              border: "2px solid #fff",
            }}
          >
            {unreadCount}
          </span>
        )}
      </button>

      {/* Chat Panel */}
      {open && (
        <div
          ref={panelRef}
          style={{
            position: "fixed",
            bottom: 96,
            right: 24,
            width: 400,
            maxWidth: "calc(100vw - 48px)",
            height: 560,
            maxHeight: "calc(100vh - 120px)",
            background: "#fff",
            borderRadius: 14,
            boxShadow: "0 12px 48px rgba(0,0,0,0.22), 0 2px 8px rgba(0,0,0,0.12)",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            zIndex: 9997,
            fontFamily: "'Georgia', serif",
            fontSize: 14,
          }}
        >
          {/* Header */}
          <div
            style={{
              background: hasRedFlag ? "#7f1d1d" : "#1a3a2a",
              color: "#fff",
              padding: "12px 16px",
              display: "flex",
              alignItems: "center",
              gap: 10,
              flexShrink: 0,
            }}
          >
            <span style={{ fontSize: 20 }}>⚖</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 14, letterSpacing: 0.3 }}>
                Sovereign Office Assistant
              </div>
              <div style={{ fontSize: 11, opacity: 0.8, marginTop: 1 }}>
                Mathias El Tribe — Office of the Chief Justice & Trustee
              </div>
            </div>
            {hasRedFlag && (
              <span
                style={{
                  background: "#dc2626",
                  color: "#fff",
                  fontSize: 10,
                  fontWeight: 700,
                  padding: "2px 6px",
                  borderRadius: 4,
                  letterSpacing: 0.5,
                }}
              >
                RED FLAG
              </span>
            )}
          </div>

          {/* Messages Area */}
          <div
            style={{
              flex: 1,
              overflowY: "auto",
              padding: "12px 14px",
              display: "flex",
              flexDirection: "column",
              gap: 12,
              background: "#f8f7f4",
            }}
          >
            {messages.length === 0 && !loading && (
              <div style={{ textAlign: "center", color: "#6b7280", padding: "20px 0" }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>⚖</div>
                <div style={{ fontWeight: 600, marginBottom: 4, color: "#374151" }}>
                  Sovereign Office Assistant
                </div>
                <div style={{ fontSize: 13, lineHeight: 1.5, marginBottom: 16 }}>
                  Federal Indian law guidance, document help, complaints, and rights — ask anything.
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, justifyContent: "center" }}>
                  {QUICK_PROMPTS.map(p => (
                    <button
                      key={p.label}
                      onClick={() => sendMessage(p.message)}
                      style={{
                        background: "#1a3a2a",
                        color: "#f0e8d0",
                        border: "none",
                        borderRadius: 16,
                        padding: "5px 12px",
                        fontSize: 12,
                        cursor: "pointer",
                        fontFamily: "'Georgia', serif",
                      }}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map(msg => (
              <div key={msg.id}>
                {/* Red Flag Banner */}
                {msg.role === "assistant" && msg.redFlag && msg.redFlagMessage && (
                  <div
                    style={{
                      background: "#fef2f2",
                      border: "1px solid #fca5a5",
                      borderLeft: "4px solid #dc2626",
                      borderRadius: 6,
                      padding: "8px 12px",
                      marginBottom: 6,
                      fontSize: 12,
                      color: "#7f1d1d",
                      lineHeight: 1.5,
                    }}
                  >
                    <span style={{ fontWeight: 700 }}>⚑ RED FLAG — </span>
                    {msg.redFlagMessage}
                  </div>
                )}

                {/* Message Bubble */}
                <div
                  style={{
                    display: "flex",
                    justifyContent: msg.role === "user" ? "flex-end" : "flex-start",
                    alignItems: "flex-end",
                    gap: 8,
                  }}
                >
                  {msg.role === "assistant" && (
                    <div
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: "50%",
                        background: TIER_COLORS[msg.tier ?? "hard_default"] ?? "#374151",
                        color: "#fff",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 13,
                        flexShrink: 0,
                        marginBottom: 2,
                      }}
                    >
                      {TIER_ICONS[msg.tier ?? "hard_default"] ?? "○"}
                    </div>
                  )}

                  <div
                    style={{
                      maxWidth: "82%",
                      background: msg.role === "user" ? "#1a3a2a" : "#fff",
                      color: msg.role === "user" ? "#f0e8d0" : "#1a1a2e",
                      borderRadius: msg.role === "user" ? "14px 14px 4px 14px" : "14px 14px 14px 4px",
                      padding: "10px 13px",
                      lineHeight: 1.6,
                      boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
                      fontSize: 13.5,
                      border: msg.role === "assistant" ? "1px solid #e5e7eb" : "none",
                    }}
                  >
                    {msg.role === "assistant" ? formatContent(msg.content) : msg.content}

                    {/* Tier Label */}
                    {msg.role === "assistant" && msg.tierLabel && (
                      <div
                        style={{
                          marginTop: 8,
                          fontSize: 10.5,
                          color: TIER_COLORS[msg.tier ?? "hard_default"] ?? "#6b7280",
                          display: "flex",
                          alignItems: "center",
                          gap: 4,
                          opacity: 0.85,
                        }}
                      >
                        <span>{TIER_ICONS[msg.tier ?? "hard_default"]}</span>
                        <span>{msg.tierLabel}</span>
                        {msg.azureTokensUsed && (
                          <span style={{ opacity: 0.6 }}>· {msg.azureTokensUsed} tokens</span>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Law References */}
                {msg.role === "assistant" && msg.lawRefs && msg.lawRefs.length > 0 && (
                  <div style={{ marginTop: 6, marginLeft: 36, display: "flex", flexWrap: "wrap", gap: 4 }}>
                    {msg.lawRefs.slice(0, 4).map((ref, i) => (
                      <span
                        key={i}
                        title={`${ref.title} — ${ref.citation}`}
                        style={{
                          background: ref.type === "federal" ? "#dbeafe" : ref.type === "tribal" ? "#dcfce7" : "#f3e8ff",
                          color: ref.type === "federal" ? "#1e40af" : ref.type === "tribal" ? "#166534" : "#6b21a8",
                          fontSize: 10.5,
                          padding: "2px 8px",
                          borderRadius: 10,
                          fontWeight: 500,
                          cursor: "default",
                          fontFamily: "monospace",
                          border: `1px solid ${ref.type === "federal" ? "#bfdbfe" : ref.type === "tribal" ? "#bbf7d0" : "#e9d5ff"}`,
                        }}
                      >
                        {ref.citation.length > 30 ? ref.citation.slice(0, 30) + "..." : ref.citation}
                      </span>
                    ))}
                  </div>
                )}

                {/* Action Buttons */}
                {msg.role === "assistant" && msg.actions && msg.actions.length > 0 && (
                  <div
                    style={{
                      marginTop: 8,
                      marginLeft: 36,
                      display: "flex",
                      flexWrap: "wrap",
                      gap: 6,
                    }}
                  >
                    {msg.actions.map((action, i) => (
                      <button
                        key={i}
                        onClick={() => action.href ? handleNavigate(action.href) : (action.intent ? handleIntent(action.intent) : undefined)}
                        style={{
                          background: "#fff",
                          border: "1px solid #d1d5db",
                          borderRadius: 6,
                          padding: "4px 11px",
                          fontSize: 12,
                          cursor: "pointer",
                          color: "#374151",
                          fontFamily: "'Georgia', serif",
                          transition: "all 0.15s",
                          fontWeight: 500,
                        }}
                        onMouseOver={e => {
                          (e.target as HTMLButtonElement).style.background = "#f3f4f6";
                          (e.target as HTMLButtonElement).style.borderColor = "#9ca3af";
                        }}
                        onMouseOut={e => {
                          (e.target as HTMLButtonElement).style.background = "#fff";
                          (e.target as HTMLButtonElement).style.borderColor = "#d1d5db";
                        }}
                      >
                        {action.href ? "→ " : ""}{action.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}

            {/* Typing Indicator */}
            {loading && (
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: "50%",
                    background: "#1a3a2a",
                    color: "#fff",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 13,
                  }}
                >
                  ⚖
                </div>
                <div
                  style={{
                    background: "#fff",
                    border: "1px solid #e5e7eb",
                    borderRadius: "14px 14px 14px 4px",
                    padding: "10px 16px",
                    display: "flex",
                    gap: 4,
                    alignItems: "center",
                  }}
                >
                  {[0, 1, 2].map(i => (
                    <span
                      key={i}
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: "50%",
                        background: "#9ca3af",
                        display: "inline-block",
                        animation: `pulse 1.2s ease-in-out ${i * 0.2}s infinite`,
                      }}
                    />
                  ))}
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div
            style={{
              padding: "10px 12px",
              borderTop: "1px solid #e5e7eb",
              background: "#fff",
              flexShrink: 0,
            }}
          >
            <div
              style={{
                display: "flex",
                gap: 8,
                alignItems: "flex-end",
              }}
            >
              <textarea
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask about your rights, ICWA, trust land, welfare, filings..."
                rows={1}
                disabled={loading}
                style={{
                  flex: 1,
                  resize: "none",
                  border: "1px solid #d1d5db",
                  borderRadius: 8,
                  padding: "8px 10px",
                  fontSize: 13,
                  fontFamily: "'Georgia', serif",
                  outline: "none",
                  lineHeight: 1.5,
                  maxHeight: 80,
                  overflowY: "auto",
                  background: loading ? "#f9fafb" : "#fff",
                  color: "#1a1a2e",
                }}
                onInput={e => {
                  const el = e.target as HTMLTextAreaElement;
                  el.style.height = "auto";
                  el.style.height = Math.min(el.scrollHeight, 80) + "px";
                }}
              />
              <button
                onClick={() => sendMessage(input)}
                disabled={loading || !input.trim()}
                style={{
                  background: loading || !input.trim() ? "#9ca3af" : "#1a3a2a",
                  color: "#fff",
                  border: "none",
                  borderRadius: 8,
                  width: 36,
                  height: 36,
                  cursor: loading || !input.trim() ? "not-allowed" : "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 15,
                  flexShrink: 0,
                  transition: "background 0.15s",
                }}
              >
                ↑
              </button>
            </div>
            <div
              style={{
                marginTop: 6,
                fontSize: 10.5,
                color: "#9ca3af",
                textAlign: "center",
              }}
            >
              Most responses use zero AI cost · AI only for complex legal analysis
            </div>
          </div>
        </div>
      )}

      {/* Pulse animation style */}
      <style>{`
        @keyframes pulse {
          0%, 80%, 100% { opacity: 0.3; transform: scale(0.8); }
          40% { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </>
  );
}
