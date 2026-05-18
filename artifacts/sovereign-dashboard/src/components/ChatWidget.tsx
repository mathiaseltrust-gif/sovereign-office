import { useState, useRef, useEffect, useCallback } from "react";
import { useAuth, getCurrentBearerToken } from "./auth-provider";
import type { Role } from "./auth-provider";
import { useLocation } from "wouter";


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
  isLetter?: boolean;
  letterTitle?: string;
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

const COMPANION_OPEN_COUNT_KEY = "companion_open_count";

function getCompanionOpenCount(): number {
  try { return parseInt(localStorage.getItem(COMPANION_OPEN_COUNT_KEY) ?? "0", 10) || 0; } catch { return 0; }
}
function incrementCompanionOpenCount(): number {
  try {
    const next = getCompanionOpenCount() + 1;
    localStorage.setItem(COMPANION_OPEN_COUNT_KEY, String(next));
    return next;
  } catch { return 1; }
}

type QuickPrompt = { label: string; message: string };

const ROLE_QUICK_PROMPTS: Record<string, QuickPrompt[]> = {
  sovereign_admin: [
    { label: "Governance Readiness", message: "What governance matters need my attention as Chief Justice?" },
    { label: "Pending Review", message: "What filings or instruments are pending my review?" },
    { label: "Draft a Notice", message: "Help me draft a sovereign notice or official tribal correspondence." },
    { label: "Enforce Fiduciary Duty", message: "How do I enforce the federal trust responsibility on a specific matter?" },
    { label: "Jurisdictional Standing", message: "Advise me on jurisdictional standing for a matter before the office." },
    { label: "Constitutional Guidance", message: "What does our sovereign authority provide for in this situation?" },
  ],
  trustee: [
    { label: "Fiduciary Obligations", message: "What are my fiduciary obligations as Trustee?" },
    { label: "Trust Instruments", message: "What trust instruments need my attention?" },
    { label: "Protect a Beneficiary", message: "How do I protect a beneficiary's rights in a specific matter?" },
    { label: "Draft a Trust Notice", message: "Help me draft a formal trust notice or beneficiary correspondence." },
    { label: "Enforce Trust Terms", message: "How do I enforce the terms of a trust instrument?" },
  ],
  officer: [
    { label: "Open Intake Case", message: "Help me open a new intake case and gather the right information." },
    { label: "Review a Document", message: "Help me review a document for waiver, consent, or jurisdictional language." },
    { label: "Rights Enforcement", message: "What rights enforcement steps apply in this situation?" },
    { label: "Draft Agency Notice", message: "Help me draft a notice to an outside agency or institution." },
    { label: "Compliance Check", message: "Run a compliance check — what legal standards apply here?" },
  ],
  elder: [
    { label: "Document My Lineage", message: "Help me document my lineage for the tribal record." },
    { label: "Ancestral Protections", message: "What ancestral and treaty protections apply to my family?" },
    { label: "My Trust Status", message: "Help me understand my trust status and the rights that flow from it." },
    { label: "Memory Stewardship", message: "What knowledge from my lineage should I add to the Ancestral Memory Bank?" },
    { label: "Elder Guidance", message: "As an elder, how can I guide younger members in understanding their rights?" },
  ],
  medical_provider: [
    { label: "IHS Eligibility", message: "What are the IHS eligibility standards for Indian patients?" },
    { label: "IHCIA Coverage", message: "What does IHCIA cover for tribal members I serve?" },
    { label: "Federal Health Benefits", message: "What federal health benefits apply to members of this Tribe?" },
    { label: "Patient Rights", message: "What rights do my Indian patients have that I should be protecting?" },
  ],
  member: [
    { label: "Who Am I?", message: "Help me understand who I am as a member of the Mathias El Tribe and what that means." },
    { label: "My Rights", message: "What rights do I have as a tribal beneficiary under federal law?" },
    { label: "Trust Responsibility", message: "What is the federal trust responsibility and how does it protect me?" },
    { label: "What Can I Do Here?", message: "Walk me through everything I can do in this Sovereign Office." },
    { label: "Enforce My Status", message: "How do I assert and enforce my status as a beneficiary?" },
    { label: "Protect My Family", message: "How does my tribal membership protect my family?" },
  ],
};

const NEW_MEMBER_PROMPTS: QuickPrompt[] = [
  { label: "Who am I here?", message: "Tell me who I am as a member of the Mathias El Tribe and what that means for my life." },
  { label: "Trust responsibility", message: "What is the federal trust responsibility — what does it protect me from, and how do I use it?" },
  { label: "What can I do here?", message: "Walk me through everything I can do in this Sovereign Office — from my rights to my documents to my family tree." },
  { label: "How do I enforce my rights?", message: "How do I assert and enforce my rights as a tribal beneficiary? Where do I start?" },
  { label: "My family's protection", message: "How does tribal membership protect my family — my children, my land, my health, my future?" },
];

function getQuickPrompts(role: Role, isNew: boolean): QuickPrompt[] {
  if (isNew) return NEW_MEMBER_PROMPTS;
  return ROLE_QUICK_PROMPTS[role] ?? ROLE_QUICK_PROMPTS.member;
}

const ROLE_WELCOME_TEXT: Record<string, { subtitle: string; prompt: string }> = {
  sovereign_admin: {
    subtitle: "Chief Justice & Trustee — Sovereign Authority",
    prompt: "Your office. Your authority. What needs your attention?",
  },
  trustee: {
    subtitle: "Trustee — Fiduciary Authority",
    prompt: "I hold your record. What trust matter can I help you govern?",
  },
  officer: {
    subtitle: "Duty Officer — Intake & Enforcement",
    prompt: "Ready to work. Open a case, review a document, or draft a notice.",
  },
  elder: {
    subtitle: "Elder — Ancestral Memory & Guidance",
    prompt: "Your lineage is held here. What knowledge or protection do you need?",
  },
  medical_provider: {
    subtitle: "Medical Provider — Indian Health Services",
    prompt: "Ask me about IHS, IHCIA, and the health rights of the members you serve.",
  },
  member: {
    subtitle: "Tribal Member — Beneficiary Rights & Self-Determination",
    prompt: "I'm here to help you understand who you are, what you're owed, and how to exercise it.",
  },
};

type LetterDraftState = "idle" | "form" | "loading";

const INTENT_MESSAGES: Record<string, string> = {
  ICWA_GUIDE: "What are my rights under ICWA?",
  TRUST_LAND: "What protections does trust land have?",
  ANALYZE_SITUATION: "I need help analyzing my specific legal situation.",
  EMERGENCY: "I have an emergency situation that needs immediate attention.",
  AI_ESCALATE: "I need a detailed AI legal analysis of my question.",
};

// ─── RELAY MODE: Companion acts as messenger to another member ─────────────────
const RELAY_PATTERNS = [
  /(?:talk\s+to|message|send\s+a\s+message\s+to|relay\s+to)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+(?:through|via)\s+(?:you|companion|the\s+companion)/i,
  /open\s+(?:a\s+)?relay\s+(?:with|to)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/i,
  /(?:relay|forward)\s+(?:my\s+)?message\s+to\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/i,
];

function detectRelayIntent(text: string): string | null {
  for (const pat of RELAY_PATTERNS) {
    const m = pat.exec(text);
    if (m) return m[1].trim();
  }
  return null;
}

interface RelayTarget { id: number; name: string }

export function ChatWidget() {
  const { user, activeRole } = useAuth();
  const [, navigate] = useLocation();
  const [open, setOpen] = useState(false);
  const [isNewMember, setIsNewMember] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [hasRedFlag, setHasRedFlag] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [dmUnreadCount, setDmUnreadCount] = useState(0);
  const [relayMode, setRelayMode] = useState<RelayTarget | null>(null);
  const relayThreadIdRef = useRef<number | null>(null);
  const relayLastMsgIdRef = useRef<number>(0);
  const relayPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const dmWsRef = useRef<WebSocket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const [letterDraftState, setLetterDraftState] = useState<LetterDraftState>("idle");
  const [letterPurpose, setLetterPurpose] = useState("");
  const [letterRecipient, setLetterRecipient] = useState("");
  const [copiedLetterId, setCopiedLetterId] = useState<string | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (open) {
      scrollToBottom();
      setUnreadCount(0);
      setDmUnreadCount(0);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open, messages]);

  // ── Subscribe to /api/messages/ws for DM unread badge ────────────────────
  useEffect(() => {
    if (!user) return;
    const token = getCurrentBearerToken();
    if (!token) return;

    const base = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";
    const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
    const host = window.location.host;
    const wsUrl = `${proto}//${host}${base}/api/messages/ws?authorization=Bearer%20${encodeURIComponent(token)}`;

    let ws: WebSocket;
    let closed = false;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    const connect = () => {
      if (closed) return;
      ws = new WebSocket(wsUrl);
      dmWsRef.current = ws;

      const myDbId = user?.dbId;
      ws.onmessage = (evt) => {
        try {
          const event = JSON.parse(evt.data as string) as { type?: string; message?: { senderId?: number } };
          if (event.type === "new_message" && event.message?.senderId !== undefined) {
            // Only count messages from others, not our own sends
            if (myDbId === undefined || event.message.senderId !== myDbId) {
              setDmUnreadCount(n => n + 1);
            }
          } else if (event.type === "message_read") {
            setDmUnreadCount(n => Math.max(0, n - 1));
          }
        } catch { /* ignore */ }
      };

      ws.onclose = () => {
        if (!closed) {
          retryTimer = setTimeout(connect, 5000);
        }
      };

      ws.onerror = () => { ws.close(); };
    };

    connect();

    return () => {
      closed = true;
      if (retryTimer) clearTimeout(retryTimer);
      ws?.close();
      dmWsRef.current = null;
    };
  }, [user]);

  // ── Relay mode: poll thread for inbound replies every 5s ──────────────────
  useEffect(() => {
    if (!relayMode || !user) {
      if (relayPollRef.current) { clearInterval(relayPollRef.current); relayPollRef.current = null; }
      if (!relayMode) { relayThreadIdRef.current = null; relayLastMsgIdRef.current = 0; }
      return;
    }
    const poll = async () => {
      const threadId = relayThreadIdRef.current;
      if (!threadId) return;
      const token = getCurrentBearerToken();
      if (!token) return;
      try {
        const res = await fetch(`/api/messages/threads/${threadId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) return;
        const msgs = await res.json() as Array<{ id: number; senderId: number; content: string; createdAt: string }>;
        const myId = user ? undefined : null;
        void myId;
        for (const m of msgs) {
          if (m.id > relayLastMsgIdRef.current && m.senderId === relayMode.id) {
            relayLastMsgIdRef.current = m.id;
            addMessage({
              role: "assistant",
              content: `**${relayMode.name}** replied: "${m.content}"`,
              tier: "funnel",
              tierLabel: "Sovereign Office Messenger",
            });
          } else if (m.id > relayLastMsgIdRef.current) {
            relayLastMsgIdRef.current = m.id;
          }
        }
      } catch { /* ignore poll errors */ }
    };
    relayPollRef.current = setInterval(poll, 5000);
    return () => {
      if (relayPollRef.current) { clearInterval(relayPollRef.current); relayPollRef.current = null; }
    };
  }, [relayMode, user]);

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
    setLoading(true);

    // ── Relay exit: check BEFORE relay send so "end relay" is never forwarded ─
    if (relayMode && /end\s+relay|exit\s+relay|stop\s+relay|normal\s+mode/i.test(trimmed)) {
      addMessage({ role: "user", content: trimmed });
      addMessage({ role: "assistant", content: `Relay mode ended. You are now back in the Sovereign Office Companion.`, tier: "funnel", tierLabel: "Sovereign Office" });
      setRelayMode(null);
      setLoading(false);
      return;
    }

    // ── Relay mode: deliver message to another member via DM API ──────────────
    if (relayMode && user) {
      addMessage({ role: "user", content: trimmed });
      try {
        const res = await fetch("/api/messages", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${getCurrentBearerToken() ?? ""}` },
          body: JSON.stringify({ recipientId: relayMode.id, content: trimmed }),
        });
        if (res.ok) {
          const data = await res.json() as { message: { id: number }; thread: { id: number } };
          if (data.thread?.id && !relayThreadIdRef.current) {
            relayThreadIdRef.current = data.thread.id;
            if (data.message?.id) relayLastMsgIdRef.current = data.message.id;
          }
          addMessage({
            role: "assistant",
            content: `✓ Message sent to **${relayMode.name}**: "${trimmed}"\n\nYou are still in relay mode. Type another message or click "End Relay" when done.`,
            tier: "funnel",
            tierLabel: "Sovereign Office Messenger",
          });
        } else {
          addMessage({ role: "assistant", content: `Unable to send message to ${relayMode.name}. Please try again.`, tier: "hard_default", tierLabel: "Sovereign Office" });
        }
      } catch {
        addMessage({ role: "assistant", content: "Connection error. Please try again.", tier: "hard_default", tierLabel: "Sovereign Office" });
      } finally {
        setLoading(false);
      }
      return;
    }

    // ── Detect relay intent: "relay to [Name] through companion" ──────────────
    const relayTarget = user ? detectRelayIntent(trimmed) : null;
    if (relayTarget) {
      addMessage({ role: "user", content: trimmed });
      try {
        const membersRes = await fetch("/api/messages/members-with-accounts", {
          headers: { Authorization: `Bearer ${getCurrentBearerToken() ?? ""}` },
        });
        if (membersRes.ok) {
          const members = await membersRes.json() as { id: number; name: string }[];
          const found = members.find(m => m.name.toLowerCase().includes(relayTarget.toLowerCase()));
          if (found) {
            setRelayMode(found);
            addMessage({
              role: "assistant",
              content: `Relay mode activated — I will forward your messages directly to **${found.name}** via the community messaging system.\n\nType your message now. Say "end relay" when you're done.`,
              tier: "funnel",
              tierLabel: "Sovereign Office Messenger",
            });
            setLoading(false);
            return;
          }
        }
        addMessage({
          role: "assistant",
          content: `I couldn't find a member named "${relayTarget}" with an active account. Please visit the Family Directory to verify their name.`,
          tier: "funnel",
          tierLabel: "Sovereign Office Messenger",
        });
        setLoading(false);
        return;
      } catch {
        addMessage({ role: "assistant", content: "Connection error finding member. Please try again.", tier: "hard_default", tierLabel: "Sovereign Office" });
        setLoading(false);
        return;
      }
    }

    addMessage({ role: "user", content: trimmed });

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(user ? { Authorization: `Bearer ${getCurrentBearerToken() ?? ""}` } : {}),
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
      const count = incrementCompanionOpenCount();
      setIsNewMember(count <= 3);
      setTimeout(() => sendMessage("hello"), 200);
    }
  };

  const draftLetter = async () => {
    if (!letterPurpose.trim()) return;
    setLetterDraftState("loading");
    try {
      const res = await fetch("/api/ki/draft-letter", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(user ? { Authorization: `Bearer ${getCurrentBearerToken() ?? ""}` } : {}),
        },
        body: JSON.stringify({ purpose: letterPurpose.trim(), recipient: letterRecipient.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to generate letter");
      addMessage({
        role: "assistant",
        content: data.letterText,
        tier: "azure_openai",
        tierLabel: "Sovereign Office",
        isLetter: true,
        letterTitle: `Letter — ${data.purpose.substring(0, 50)}${data.purpose.length > 50 ? "…" : ""}`,
      });
      setLetterDraftState("idle");
      setLetterPurpose("");
      setLetterRecipient("");
    } catch {
      addMessage({
        role: "assistant",
        content: "Unable to generate the letter. Please try again or use the Drafts tool for complex documents.",
        tier: "hard_default",
        tierLabel: "Sovereign Office",
      });
      setLetterDraftState("idle");
    }
  };

  const renderInline = (text: string, key: string | number) => {
    const parts: React.ReactNode[] = [];
    const boldRe = /\*\*(.+?)\*\*/g;
    let last = 0;
    let m: RegExpExecArray | null;
    while ((m = boldRe.exec(text)) !== null) {
      if (m.index > last) parts.push(text.slice(last, m.index));
      parts.push(<strong key={`b-${m.index}`} style={{ fontWeight: 700 }}>{m[1]}</strong>);
      last = m.index + m[0].length;
    }
    if (last < text.length) parts.push(text.slice(last));
    return <span key={key}>{parts}</span>;
  };

  const formatContent = (content: string) => {
    const lines = content.split("\n");
    const nodes: React.ReactNode[] = [];
    let listItems: string[] = [];

    const flushList = (i: number) => {
      if (listItems.length) {
        nodes.push(
          <ul key={`ul-${i}`} style={{ margin: "4px 0 4px 0", paddingLeft: 0, listStyle: "none" }}>
            {listItems.map((item, li) => (
              <li key={li} style={{ display: "flex", gap: 6, marginBottom: 3 }}>
                <span style={{ color: "#b5a057", flexShrink: 0, fontWeight: 700 }}>•</span>
                <span>{renderInline(item, li)}</span>
              </li>
            ))}
          </ul>
        );
        listItems = [];
      }
    };

    lines.forEach((line, i) => {
      if (line.startsWith("• ") || line.startsWith("- ") || line.startsWith("* ")) {
        listItems.push(line.slice(2));
        return;
      }
      const numberedMatch = line.match(/^(\d+)\.\s+(.+)$/);
      if (numberedMatch) {
        listItems.push(`${numberedMatch[1]}. ${numberedMatch[2]}`);
        return;
      }
      flushList(i);
      if (/^#{1,3}\s/.test(line)) {
        const text = line.replace(/^#+\s/, "");
        nodes.push(
          <div key={i} style={{ fontWeight: 700, marginTop: i > 0 ? 12 : 4, marginBottom: 3, color: "#1a1a2e", fontSize: 14 }}>
            {renderInline(text, i)}
          </div>
        );
        return;
      }
      if (/^[A-Z][A-Z\s/()&–-]{3,}:/.test(line) && line.length < 80) {
        nodes.push(
          <div key={i} style={{ fontWeight: 700, marginTop: i > 0 ? 10 : 4, marginBottom: 2, color: "#1a1a2e" }}>
            {renderInline(line, i)}
          </div>
        );
        return;
      }
      if (line === "") {
        nodes.push(<div key={i} style={{ height: 6 }} />);
        return;
      }
      nodes.push(<div key={i}>{renderInline(line, i)}</div>);
    });
    flushList(lines.length);
    return nodes;
  };

  const toggle = () => {
    if (!open) {
      openWithGreeting();
    } else {
      setOpen(false);
    }
  };

  return (
    <>
      {/* Retractable Companion Tab — anchored at bottom-right, always visible */}
      <div
        style={{
          position: "fixed",
          bottom: 0,
          right: 24,
          width: 340,
          maxWidth: "calc(100vw - 32px)",
          zIndex: 9997,
          display: "flex",
          flexDirection: "column",
          fontFamily: "'Georgia', serif",
        }}
      >
        {/* Expanded Chat Panel — slides above the tab */}
        {open && (
          <div
            ref={panelRef}
            style={{
              background: "#fff",
              borderRadius: "14px 14px 0 0",
              boxShadow: "0 -4px 32px rgba(0,0,0,0.18), 0 2px 8px rgba(0,0,0,0.10)",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
              fontSize: 14,
              height: 520,
              maxHeight: "calc(100vh - 72px)",
            }}
          >
            {/* Panel inner header (info only, no toggle — tab bar is the toggle) */}
            <div
              style={{
                background: hasRedFlag ? "#7f1d1d" : "#1a3a2a",
                color: "#fff",
                padding: "10px 14px",
                display: "flex",
                alignItems: "center",
                gap: 10,
                flexShrink: 0,
              }}
            >
              <img
                src={`${import.meta.env.BASE_URL}tribal-seal.png`}
                alt="Seal"
                style={{ width: 24, height: 24, objectFit: "contain", flexShrink: 0 }}
              />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 13, letterSpacing: 0.3 }}>
                  Sovereign Office Companion
                </div>
                <div style={{ fontSize: 10, opacity: 0.75, marginTop: 1 }}>
                  {(ROLE_WELCOME_TEXT[activeRole] ?? ROLE_WELCOME_TEXT.member).subtitle}
                </div>
              </div>
              {hasRedFlag && (
                <span style={{ background: "#dc2626", color: "#fff", fontSize: 9, fontWeight: 700, padding: "2px 5px", borderRadius: 4, letterSpacing: 0.5 }}>
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
                <img
                  src={`${import.meta.env.BASE_URL}tribal-seal.png`}
                  alt="Sovereign Office"
                  style={{ width: 56, height: 56, objectFit: "contain", marginBottom: 8 }}
                />
                {isNewMember ? (
                  <>
                    <div style={{ fontWeight: 700, marginBottom: 6, color: "#1a3a2a", fontSize: 14 }}>
                      Welcome to Your Sovereign Office
                    </div>
                    <div style={{ fontSize: 12, lineHeight: 1.6, marginBottom: 4, color: "#374151", padding: "0 8px" }}>
                      I am COMPANION — your personal guide through this office. I'm here to help you understand who you are, what you're owed, and how to exercise your rights and freedoms as a member of this Tribe.
                    </div>
                    <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 14, fontStyle: "italic" }}>
                      You are not here to be saved. You are here to govern yourself.
                    </div>
                  </>
                ) : (
                  <>
                    <div style={{ fontWeight: 600, marginBottom: 4, color: "#374151" }}>
                      {(ROLE_WELCOME_TEXT[activeRole] ?? ROLE_WELCOME_TEXT.member).prompt}
                    </div>
                    <div style={{ fontSize: 12, lineHeight: 1.5, marginBottom: 14, color: "#6b7280" }}>
                      Your record is held. I remember what you've shared. Speak freely.
                    </div>
                  </>
                )}
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, justifyContent: "center" }}>
                  {getQuickPrompts(activeRole, isNewMember).map(p => (
                    <button
                      key={p.label}
                      onClick={() => sendMessage(p.message)}
                      style={{
                        background: isNewMember ? "#2d4a1a" : "#1a3a2a",
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
                  {user && (
                    <button
                      onClick={() => setLetterDraftState("form")}
                      style={{
                        background: "#7c2d12",
                        color: "#fef3c7",
                        border: "none",
                        borderRadius: 16,
                        padding: "5px 12px",
                        fontSize: 12,
                        cursor: "pointer",
                        fontFamily: "'Georgia', serif",
                      }}
                    >
                      ✉ Draft a Letter
                    </button>
                  )}
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
                        background: msg.isLetter ? "#7c2d12" : (TIER_COLORS[msg.tier ?? "hard_default"] ?? "#374151"),
                        color: "#fff",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 13,
                        flexShrink: 0,
                        marginBottom: 2,
                      }}
                    >
                      {msg.isLetter ? "✉" : (TIER_ICONS[msg.tier ?? "hard_default"] ?? "○")}
                    </div>
                  )}

                  <div
                    style={{
                      maxWidth: "82%",
                      background: msg.role === "user" ? "#1a3a2a" : (msg.isLetter ? "#fffbf0" : "#fff"),
                      color: msg.role === "user" ? "#f0e8d0" : "#1a1a2e",
                      borderRadius: msg.role === "user" ? "14px 14px 4px 14px" : "14px 14px 14px 4px",
                      padding: "10px 13px",
                      lineHeight: 1.6,
                      boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
                      fontSize: 13.5,
                      border: msg.role === "assistant" ? (msg.isLetter ? "1px solid #d97706" : "1px solid #e5e7eb") : "none",
                    }}
                  >
                    {/* Letter header badge */}
                    {msg.isLetter && msg.letterTitle && (
                      <div style={{
                        fontSize: 10,
                        fontWeight: 700,
                        color: "#7c2d12",
                        letterSpacing: 0.8,
                        textTransform: "uppercase",
                        marginBottom: 8,
                        paddingBottom: 6,
                        borderBottom: "1px solid #fde68a",
                        display: "flex",
                        alignItems: "center",
                        gap: 4,
                      }}>
                        <span>✉</span>
                        <span>Tribal Letter Draft</span>
                      </div>
                    )}

                    {msg.role === "assistant" ? formatContent(msg.content) : msg.content}

                    {/* Copy button for letters */}
                    {msg.isLetter && (
                      <div style={{ marginTop: 10, display: "flex", gap: 6 }}>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(msg.content).then(() => {
                              setCopiedLetterId(msg.id);
                              setTimeout(() => setCopiedLetterId(null), 2000);
                            });
                          }}
                          style={{
                            background: copiedLetterId === msg.id ? "#166534" : "#1a3a2a",
                            color: "#f0e8d0",
                            border: "none",
                            borderRadius: 6,
                            padding: "4px 10px",
                            fontSize: 11,
                            cursor: "pointer",
                            fontFamily: "'Georgia', serif",
                            fontWeight: 600,
                          }}
                        >
                          {copiedLetterId === msg.id ? "✓ Copied" : "Copy Letter"}
                        </button>
                        <button
                          onClick={() => {
                            const blob = new Blob([msg.content], { type: "text/plain" });
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement("a");
                            a.href = url;
                            a.download = `tribal-letter-${Date.now()}.txt`;
                            a.click();
                            URL.revokeObjectURL(url);
                          }}
                          style={{
                            background: "#fff",
                            color: "#374151",
                            border: "1px solid #d1d5db",
                            borderRadius: 6,
                            padding: "4px 10px",
                            fontSize: 11,
                            cursor: "pointer",
                            fontFamily: "'Georgia', serif",
                          }}
                        >
                          Download
                        </button>
                      </div>
                    )}

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
                          background: action.href ? "#1e3a5f" : "#fff",
                          border: action.href ? "1px solid #2d5a9b" : "1px solid #d1d5db",
                          borderRadius: 999,
                          padding: "5px 14px",
                          fontSize: 11.5,
                          cursor: "pointer",
                          color: action.href ? "#e8f0fb" : "#374151",
                          fontFamily: "'Georgia', serif",
                          transition: "all 0.15s",
                          fontWeight: 500,
                          letterSpacing: 0.1,
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 4,
                        }}
                        onMouseOver={e => {
                          const btn = e.currentTarget as HTMLButtonElement;
                          btn.style.opacity = "0.82";
                        }}
                        onMouseOut={e => {
                          const btn = e.currentTarget as HTMLButtonElement;
                          btn.style.opacity = "1";
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
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    overflow: "hidden",
                  }}
                >
                  <img
                    src={`${import.meta.env.BASE_URL}tribal-seal.png`}
                    alt="Seal"
                    style={{ width: 24, height: 24, objectFit: "contain" }}
                  />
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

          {/* Letter Draft Form — slides in above input */}
          {letterDraftState !== "idle" && (
            <div style={{
              padding: "10px 12px",
              borderTop: "1px solid #fde68a",
              background: "#fffbf0",
              flexShrink: 0,
            }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: "#7c2d12", letterSpacing: 0.5, textTransform: "uppercase" }}>
                  ✉ Draft a Letter
                </span>
                <button
                  onClick={() => { setLetterDraftState("idle"); setLetterPurpose(""); setLetterRecipient(""); }}
                  style={{ background: "none", border: "none", cursor: "pointer", color: "#9ca3af", fontSize: 14 }}
                >✕</button>
              </div>
              <textarea
                value={letterPurpose}
                onChange={e => setLetterPurpose(e.target.value)}
                placeholder="What should this letter accomplish? (e.g. Notify county of tribal jurisdiction over my property, Request federal welfare benefits, Respond to eviction notice)"
                rows={3}
                disabled={letterDraftState === "loading"}
                style={{
                  width: "100%",
                  resize: "none",
                  border: "1px solid #d97706",
                  borderRadius: 6,
                  padding: "7px 9px",
                  fontSize: 12,
                  fontFamily: "'Georgia', serif",
                  outline: "none",
                  lineHeight: 1.5,
                  background: "#fff",
                  color: "#1a1a2e",
                  boxSizing: "border-box",
                  marginBottom: 6,
                }}
              />
              <input
                value={letterRecipient}
                onChange={e => setLetterRecipient(e.target.value)}
                placeholder="Addressed to (optional — e.g. County Assessor, Housing Authority)"
                disabled={letterDraftState === "loading"}
                style={{
                  width: "100%",
                  border: "1px solid #d1d5db",
                  borderRadius: 6,
                  padding: "6px 9px",
                  fontSize: 12,
                  fontFamily: "'Georgia', serif",
                  outline: "none",
                  background: "#fff",
                  color: "#1a1a2e",
                  boxSizing: "border-box",
                  marginBottom: 8,
                }}
              />
              <button
                onClick={draftLetter}
                disabled={!letterPurpose.trim() || letterDraftState === "loading"}
                style={{
                  width: "100%",
                  background: !letterPurpose.trim() || letterDraftState === "loading" ? "#9ca3af" : "#7c2d12",
                  color: "#fff",
                  border: "none",
                  borderRadius: 6,
                  padding: "7px 12px",
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: !letterPurpose.trim() || letterDraftState === "loading" ? "not-allowed" : "pointer",
                  fontFamily: "'Georgia', serif",
                  letterSpacing: 0.3,
                }}
              >
                {letterDraftState === "loading" ? "Drafting letter…" : "Generate Letter"}
              </button>
            </div>
          )}

          {/* Relay mode banner with explicit End Relay button */}
          {relayMode && (
            <div style={{ padding: "6px 12px", background: "#fef3c7", borderTop: "1px solid #fcd34d", display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
              <span style={{ fontSize: 12, color: "#92400e", flex: 1 }}>
                Relaying to <strong>{relayMode.name}</strong> — replies appear above
              </span>
              <button
                onClick={() => {
                  addMessage({ role: "assistant", content: "Relay mode ended. You are back in the Sovereign Office Companion.", tier: "funnel", tierLabel: "Sovereign Office" });
                  setRelayMode(null);
                }}
                style={{ fontSize: 11, padding: "3px 8px", background: "#92400e", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer", whiteSpace: "nowrap" }}
              >
                End Relay
              </button>
            </div>
          )}

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
                placeholder={activeRole === "sovereign_admin" ? "Govern, enforce, review, advise…" : activeRole === "trustee" ? "Trust matters, instruments, beneficiaries…" : activeRole === "officer" ? "Cases, documents, enforcement, notices…" : "Ask about your rights, status, family, documents…"}
                rows={1}
                disabled={loading || letterDraftState === "loading"}
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
              {user && letterDraftState === "idle" && (
                <button
                  onClick={() => setLetterDraftState("form")}
                  title="Draft a Letter"
                  style={{
                    background: "#7c2d12",
                    color: "#fef3c7",
                    border: "none",
                    borderRadius: 8,
                    width: 36,
                    height: 36,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 15,
                    flexShrink: 0,
                  }}
                >
                  ✉
                </button>
              )}
              <button
                onClick={() => sendMessage(input)}
                disabled={loading || !input.trim() || letterDraftState === "loading"}
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

        {/* ── Tab Bar — always visible, click to expand/collapse ── */}
        <button
          onClick={toggle}
          aria-label={open ? "Collapse Companion" : "Expand Sovereign Office Companion"}
          style={{
            width: "100%",
            height: 46,
            background: hasRedFlag ? "#7f1d1d" : (open ? "#162f21" : "#1a3a2a"),
            color: "#fff",
            border: "none",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "0 14px",
            borderRadius: open ? "0" : "10px 10px 0 0",
            boxShadow: open ? "none" : "0 -3px 14px rgba(0,0,0,0.22)",
            borderTop: open ? "1px solid rgba(255,255,255,0.12)" : "none",
            flexShrink: 0,
            transition: "background 0.15s",
          }}
        >
          <img
            src={`${import.meta.env.BASE_URL}tribal-seal.png`}
            alt="Companion"
            style={{ width: 22, height: 22, objectFit: "contain", borderRadius: "50%", flexShrink: 0 }}
          />
          <span style={{ flex: 1, textAlign: "left", fontWeight: 600, fontSize: 13, letterSpacing: 0.2, fontFamily: "'Georgia', serif", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            Sovereign Office Companion
          </span>
          {!open && (unreadCount > 0 || dmUnreadCount > 0) && (
            <span style={{ background: "#dc2626", color: "#fff", fontSize: 10, fontWeight: 700, borderRadius: "50%", minWidth: 18, height: 18, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 3px", flexShrink: 0 }}>
              {unreadCount + dmUnreadCount}
            </span>
          )}
          {hasRedFlag && (
            <span style={{ background: "#dc2626", color: "#fff", fontSize: 9, fontWeight: 700, padding: "2px 5px", borderRadius: 3, letterSpacing: 0.5, flexShrink: 0 }}>
              ⚑
            </span>
          )}
          <span style={{ fontSize: 11, opacity: 0.6, flexShrink: 0, marginLeft: 2 }}>
            {open ? "▼" : "▲"}
          </span>
        </button>
      </div>

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
