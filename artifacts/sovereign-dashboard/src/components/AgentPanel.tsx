import { useState, useEffect, useRef } from "react";
import { getCurrentBearerToken } from "@/components/auth-provider";
import { Link } from "wouter";

interface AgentAssistResponse {
  greeting: string;
  source: string;
  firstName: string;
  name: string;
  role: string;
  awakeningLevel: number;
  intakeCount: number;
  documentCount: number;
  recentTopics: string[];
  featureUsage: Record<string, number>;
  isNewMember: boolean;
}

interface Suggestion {
  label: string;
  icon: string;
  href: string;
  feature: string;
  description: string;
  badge?: number;
}

export interface AgentPanelProps {
  pendingTasks?: number;
  openComplaints?: number;
  pendingFilings?: number;
  draftNfrs?: number;
  draftInstruments?: number;
}

const ROLE_SUGGESTIONS: Record<string, Suggestion[]> = {
  trustee: [
    { label: "AI Intake", icon: "⚡", href: "/intake-ai", feature: "intake-ai", description: "Analyze a new legal situation with AI" },
    { label: "Trust Instruments", icon: "📜", href: "/instruments", feature: "instruments", description: "Draft and manage trust documents" },
    { label: "NFR Filings", icon: "📋", href: "/nfr", feature: "nfr", description: "Notice of Federal Review" },
    { label: "Court Calendar", icon: "📅", href: "/calendar", feature: "calendar", description: "Upcoming hearings and events" },
    { label: "Complaints", icon: "⚠️", href: "/complaints", feature: "complaints", description: "Sovereign rights complaints" },
    { label: "Welfare Orders", icon: "🛡️", href: "/welfare", feature: "welfare", description: "Emergency welfare protection" },
    { label: "Draft Documents", icon: "✍️", href: "/drafts", feature: "drafts", description: "Create sovereign instruments" },
  ],
  officer: [
    { label: "AI Intake", icon: "⚡", href: "/intake-ai", feature: "intake-ai", description: "Analyze a legal situation" },
    { label: "My Tasks", icon: "✅", href: "/tasks", feature: "tasks", description: "Review assigned tasks" },
    { label: "Complaints", icon: "⚠️", href: "/complaints", feature: "complaints", description: "Open complaints awaiting review" },
    { label: "Welfare Orders", icon: "🛡️", href: "/welfare", feature: "welfare", description: "Emergency welfare protection" },
    { label: "Classify Case", icon: "🏷️", href: "/classify", feature: "classify", description: "Tribal classification analysis" },
    { label: "Court Calendar", icon: "📅", href: "/calendar", feature: "calendar", description: "Upcoming hearings" },
    { label: "NFR Filings", icon: "📋", href: "/nfr", feature: "nfr", description: "Review federal notices" },
  ],
  member: [
    { label: "AI Intake", icon: "⚡", href: "/intake-ai", feature: "intake-ai", description: "Get AI legal analysis" },
    { label: "Submit Complaint", icon: "⚠️", href: "/complaints", feature: "complaints", description: "Document a sovereign rights issue" },
    { label: "My NFR Docs", icon: "📋", href: "/nfr", feature: "nfr", description: "Your federal review notices" },
    { label: "Family Governance", icon: "🏡", href: "/family-governance", feature: "family-gov", description: "Family authority and governance" },
    { label: "Calendar", icon: "📅", href: "/calendar", feature: "calendar", description: "Upcoming events" },
    { label: "Welfare Request", icon: "🛡️", href: "/welfare", feature: "welfare", description: "Emergency welfare filing" },
  ],
  elder: [
    { label: "Elder Advisory", icon: "🌿", href: "/elder-advisory", feature: "elder-advisory", description: "Elder council matters" },
    { label: "AI Intake", icon: "⚡", href: "/intake-ai", feature: "intake-ai", description: "Analyze a situation with AI" },
    { label: "Lineage Review", icon: "🌳", href: "/lineage", feature: "lineage", description: "Review lineage records" },
    { label: "Welfare Oversight", icon: "🛡️", href: "/welfare", feature: "welfare", description: "Welfare authority" },
    { label: "Membership", icon: "👥", href: "/membership", feature: "membership", description: "Review enrollment" },
    { label: "Calendar", icon: "📅", href: "/calendar", feature: "calendar", description: "Upcoming events" },
  ],
  admin: [
    { label: "AI Intake", icon: "⚡", href: "/intake-ai", feature: "intake-ai", description: "Analyze a situation" },
    { label: "System Config", icon: "⚙️", href: "/admin", feature: "admin", description: "Entra ID and system settings" },
    { label: "Law Library", icon: "📚", href: "/law", feature: "law", description: "Federal Indian law database" },
    { label: "Templates", icon: "📝", href: "/templates", feature: "templates", description: "Document templates" },
    { label: "Role Governors", icon: "👑", href: "/role-governors", feature: "role-gov", description: "Manage role governance" },
    { label: "Complaints", icon: "⚠️", href: "/complaints", feature: "complaints", description: "Review open complaints" },
  ],
};

function buildSuggestions(
  role: string,
  featureUsage: Record<string, number>,
  props: AgentPanelProps,
): Suggestion[] {
  const base = [...(ROLE_SUGGESTIONS[role] ?? ROLE_SUGGESTIONS.member)];

  const withBadges = base.map(s => {
    let badge: number | undefined;
    if (s.feature === "tasks" && (props.pendingTasks ?? 0) > 0) badge = props.pendingTasks;
    if (s.feature === "complaints" && (props.openComplaints ?? 0) > 0) badge = props.openComplaints;
    if (s.feature === "filings" && (props.pendingFilings ?? 0) > 0) badge = props.pendingFilings;
    if (s.feature === "nfr" && (props.draftNfrs ?? 0) > 0) badge = props.draftNfrs;
    if (s.feature === "instruments" && (props.draftInstruments ?? 0) > 0) badge = props.draftInstruments;
    return { ...s, badge };
  });

  return withBadges.sort((a, b) => {
    const aScore = ((a.badge ?? 0) > 0 ? 1000 : 0) + (featureUsage[a.feature] ?? 0);
    const bScore = ((b.badge ?? 0) > 0 ? 1000 : 0) + (featureUsage[b.feature] ?? 0);
    return bScore - aScore;
  });
}

export function AgentPanel(props: AgentPanelProps) {
  const [agent, setAgent] = useState<AgentAssistResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [expanded, setExpanded] = useState(false);
  const [chatMsg, setChatMsg] = useState("");
  const [chatReply, setChatReply] = useState<{ text: string; question: string } | null>(null);
  const [chatLoading, setChatLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const token = getCurrentBearerToken() ?? "";
    fetch("/api/agent/assist", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.ok ? r.json() as Promise<AgentAssistResponse> : Promise.reject())
      .then(d => {
        setAgent(d);
        setSuggestions(buildSuggestions(d.role, d.featureUsage, props));
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  function trackFeature(feature: string) {
    const token = getCurrentBearerToken() ?? "";
    fetch("/api/agent/track", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ feature }),
    }).catch(() => {});
    setSuggestions(prev =>
      [...prev].sort((a, b) => {
        const aU = (a.feature === feature ? 1 : 0) + ((a.badge ?? 0) > 0 ? 1000 : 0);
        const bU = (b.feature === feature ? 1 : 0) + ((b.badge ?? 0) > 0 ? 1000 : 0);
        return bU - aU;
      }),
    );
  }

  async function handleAsk(e: React.FormEvent) {
    e.preventDefault();
    const msg = chatMsg.trim();
    if (!msg || chatLoading) return;
    setChatMsg("");
    setChatLoading(true);
    setChatReply(null);
    trackFeature("inline-chat");
    try {
      const token = getCurrentBearerToken() ?? "";
      const r = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ message: msg }),
      });
      if (r.ok) {
        const d = await r.json() as { reply: string };
        setChatReply({ text: d.reply, question: msg });
      }
    } catch { /* silent */ }
    setChatLoading(false);
  }

  const SHOW = 4;
  const visible = suggestions.slice(0, expanded ? suggestions.length : SHOW);

  if (loading) {
    return (
      <div className="rounded-xl border border-amber-200/50 bg-gradient-to-r from-amber-50/70 to-transparent px-5 py-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-full bg-amber-200/50 animate-pulse shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-3 bg-amber-200/60 rounded animate-pulse w-1/4" />
            <div className="h-3.5 bg-amber-200/40 rounded animate-pulse w-3/4" />
            <div className="flex gap-2 mt-3">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-8 w-28 bg-amber-200/30 rounded-lg animate-pulse" />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!agent) return null;

  return (
    <div className="rounded-xl border border-amber-200 bg-gradient-to-br from-amber-50 via-amber-50/30 to-white/50 mb-6 shadow-sm overflow-hidden">

      {/* ── Greeting row ─────────────────────────────────────────────────────── */}
      <div className="px-5 pt-4 pb-3 flex items-start gap-3">
        <div
          className="shrink-0 w-11 h-11 rounded-full flex items-center justify-center text-amber-100 font-serif text-xl font-bold select-none shadow-sm"
          style={{ background: "linear-gradient(135deg,#78350f 0%,#92400e 55%,#b45309 100%)" }}
          title="COMPANION — Indigenous Intelligence"
        >
          C
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="text-xs font-bold text-amber-900 tracking-wide">COMPANION</span>
            <span className="text-[10px] text-amber-600/60">· Indigenous Intelligence</span>
          </div>
          <p className="text-[9px] text-amber-700/55 italic mb-1">"What ever we do. it has to make sense"</p>
          {!agent.isNewMember && (
            <span className="text-[10px] bg-amber-900/10 text-amber-900 rounded-full px-2 py-0.5 font-semibold mb-1 inline-block">
              Lv {agent.awakeningLevel} · {agent.intakeCount} case{agent.intakeCount !== 1 ? "s" : ""}
            </span>
          )}
          <p className="text-sm text-amber-950 leading-relaxed">{agent.greeting}</p>
        </div>
      </div>

      {/* ── Smart suggestions ─────────────────────────────────────────────────── */}
      <div className="px-5 pb-3">
        <p className="text-[10px] text-amber-800/50 font-semibold uppercase tracking-widest mb-2">
          What can I help you with today?
        </p>
        <div className="flex flex-wrap gap-2">
          {visible.map(s => (
            <Link key={s.feature} href={s.href} onClick={() => trackFeature(s.feature)}>
              <button
                type="button"
                title={s.description}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-amber-200 bg-white/90 hover:bg-amber-50 hover:border-amber-400 text-xs font-medium text-amber-900 transition-all duration-150 shadow-sm relative"
              >
                <span className="text-sm leading-none">{s.icon}</span>
                <span>{s.label}</span>
                {(s.badge ?? 0) > 0 && (
                  <span className="ml-0.5 min-w-[18px] h-[18px] bg-amber-700 text-white rounded-full text-[9px] font-bold flex items-center justify-center px-1 leading-none">
                    {s.badge}
                  </span>
                )}
              </button>
            </Link>
          ))}
          {suggestions.length > SHOW && (
            <button
              type="button"
              onClick={() => setExpanded(v => !v)}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-dashed border-amber-300/60 text-xs text-amber-600/70 hover:text-amber-900 hover:border-amber-400 transition-colors"
            >
              {expanded ? "Show less ▲" : `+${suggestions.length - SHOW} more ▼`}
            </button>
          )}
        </div>
      </div>

      {/* ── Inline reply ─────────────────────────────────────────────────────── */}
      {chatReply && (
        <div className="mx-5 mb-3 rounded-lg border border-amber-200 bg-amber-100/50 px-4 py-3">
          <p className="text-[10px] text-amber-700/60 mb-1 italic">You asked: "{chatReply.question}"</p>
          <p className="text-sm text-amber-950 leading-relaxed">{chatReply.text}</p>
          <button
            type="button"
            onClick={() => setChatReply(null)}
            className="text-[10px] text-amber-600/50 hover:text-amber-800 mt-1.5 underline"
          >
            Clear
          </button>
        </div>
      )}

      {/* ── Ask COMPANION input ────────────────────────────────────────────────────── */}
      <div className="border-t border-amber-200/40 px-5 py-3 bg-white/20">
        <form onSubmit={handleAsk} className="flex items-center gap-2">
          <input
            ref={inputRef}
            type="text"
            value={chatMsg}
            onChange={e => setChatMsg(e.target.value)}
            placeholder={`Ask COMPANION anything, ${agent.firstName}…`}
            disabled={chatLoading}
            className="flex-1 bg-white/90 border border-amber-200 rounded-lg px-3 py-2 text-sm text-amber-950 placeholder:text-amber-300 focus:outline-none focus:ring-2 focus:ring-amber-400/40 focus:border-amber-400 disabled:opacity-50 transition-all"
          />
          <button
            type="submit"
            disabled={!chatMsg.trim() || chatLoading}
            className="shrink-0 px-4 py-2 rounded-lg bg-amber-800 text-amber-100 text-xs font-semibold hover:bg-amber-900 disabled:opacity-40 transition-colors"
          >
            {chatLoading ? "…" : "Ask →"}
          </button>
        </form>
      </div>
    </div>
  );
}
