import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useAuth, getCurrentBearerToken } from "@/components/auth-provider";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Send, BookOpen, MessageCircle, Loader2, Feather,
  Brain, Trash2, ChevronDown, ChevronUp, Plus, X,
  ClipboardList, Briefcase, FileText, User, Shield,
  AlertTriangle, CheckCircle2, ArrowRight, ChevronRight,
} from "lucide-react";

/* ─── Types ─────────────────────────────────────────────────── */
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

interface IntakeAgentReport {
  summary: string;
  riskLevel: "low" | "moderate" | "elevated" | "critical" | "emergency";
  intakeFlags: {
    indianStatusViolation: boolean;
    redFlag: boolean;
    troRecommended: boolean;
    nfrRecommended: boolean;
    violations: string[];
    doctrinesTriggered: string[];
    canonicalPosture: string;
    redBannerMessage: string | null;
  };
  doctrinesApplied: string[];
  recommendedActions: string[];
  recommendedInstruments: string[];
  factSummary: string;
  officerNotes: string;
  nfrRecommended: boolean;
  troRecommended: boolean;
  aiConfidence: number;
}

type IntakeType = "business" | "filing" | "profile";

interface IntakeOption {
  key: IntakeType;
  icon: React.ReactNode;
  label: string;
  sublabel: string;
  description: string;
  kayaOpening: string;
  placeholder: string;
  caseType: string;
}

const INTAKE_OPTIONS: IntakeOption[] = [
  {
    key: "business",
    icon: <Briefcase className="w-5 h-5" />,
    label: "Business Intake",
    sublabel: "Formation, contracts, operations",
    description: "Starting a business, reviewing a contract, protecting business assets, or navigating a commercial dispute under sovereign jurisdiction.",
    kayaOpening: "I can help you work through your business matter. To give you the right guidance, I'll need to understand what you're facing — whether it's formation, a contract you're concerned about, a dispute, or something else. You don't have to have it all figured out. Just tell me what's going on in your own words, and I'll help us identify what we need and how we can assist.",
    placeholder: "Describe your business situation — what you're trying to do, what's happening, or what concerns you…",
    caseType: "business",
  },
  {
    key: "filing",
    icon: <FileText className="w-5 h-5" />,
    label: "Filing Intake",
    sublabel: "Documents, instruments, legal filings",
    description: "A legal document you've received, a situation requiring a sovereign instrument (ICWA notice, NFR, TRO, affidavit, cease & desist), or a filing that needs review.",
    kayaOpening: "I can walk you through what needs to be filed and why. Before we get into the specifics, I need to understand the situation — what document or event triggered this, who the other parties are, and what outcome you're looking for. Share what you have, and I'll identify what instruments apply and what we need from you to proceed.",
    placeholder: "Describe the situation — what document you received, what happened, or what you need filed…",
    caseType: "legal",
  },
  {
    key: "profile",
    icon: <User className="w-5 h-5" />,
    label: "Personal Profile",
    sublabel: "Identity, lineage, membership records",
    description: "Updating your identity record, establishing lineage documentation, verifying membership standing, or recording land and property status.",
    kayaOpening: "Your record is the foundation of everything we do for you. I can help you identify what's complete, what's missing, and what we need to strengthen your standing. To start, tell me what's on your mind — whether it's updating something specific, getting your identity documented, or something you're not sure about yet. I'll guide us through it.",
    placeholder: "Tell me what you'd like to update or establish in your record — identity, lineage, land, membership…",
    caseType: "identity",
  },
];

const INSTRUMENT_TO_DOC: Record<string, string> = {
  ICWA_NOTICE: "icwa_notice", ICWA: "icwa_notice",
  NFR: "nfr_notice", NFR_NOTICE: "nfr_notice", FEDERAL_REVIEW: "nfr_notice",
  TRO: "court_document", TRO_GENERAL: "court_document",
  GWE: "gwe_letter", GWE_LETTER: "gwe_letter",
  WELFARE: "welfare_letter", WELFARE_LETTER: "welfare_letter",
  AFFIDAVIT: "tribal_affidavit", TRIBAL_AFFIDAVIT: "tribal_affidavit",
  CEASE: "cease_and_desist", CEASE_AND_DESIST: "cease_and_desist",
  TRUST: "trust_instrument", TRUST_INSTRUMENT: "trust_instrument",
  RESOLUTION: "tribal_resolution", TRIBAL_RESOLUTION: "tribal_resolution",
  IDENTITY: "identity_declaration", IDENTITY_DECLARATION: "identity_declaration",
};

const DOC_LABELS: Record<string, string> = {
  icwa_notice: "ICWA Notice", nfr_notice: "Federal Review Notice",
  court_document: "Court Document", gwe_letter: "GWE Letter",
  welfare_letter: "Welfare Letter", tribal_affidavit: "Tribal Affidavit",
  cease_and_desist: "Cease & Desist", trust_instrument: "Trust Instrument",
  tribal_resolution: "Tribal Resolution", identity_declaration: "Identity Declaration",
};

const RISK_BADGE: Record<string, string> = {
  low: "border-green-700/50 text-green-400",
  moderate: "border-yellow-700/50 text-yellow-400",
  elevated: "border-orange-700/50 text-orange-400",
  critical: "border-red-600/60 text-red-400",
  emergency: "border-red-500/70 text-red-300",
};

/* ─── Style constants ────────────────────────────────────────── */
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
const INTAKE_BG = { background: "rgba(0,20,40,0.4)", border: "1px solid rgba(30,80,160,0.2)" };
const INTAKE_RESULT_BG = { background: "rgba(10,30,10,0.5)", border: "1px solid rgba(30,120,30,0.25)" };
const INTAKE_WARN_BG = { background: "rgba(40,10,0,0.6)", border: "1px solid rgba(180,40,10,0.3)" };

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

/* ─── Intake Result Panel ────────────────────────────────────── */
function IntakeResultPanel({ report, intakeType, onReset }: {
  report: IntakeAgentReport;
  intakeType: IntakeType;
  onReset: () => void;
}) {
  const [, navigate] = useLocation();
  const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";
  const elevated = ["elevated", "critical", "emergency"].includes(report.riskLevel);
  const docTypes = Array.from(new Set(
    (report.recommendedInstruments ?? [])
      .map((i: string) => INSTRUMENT_TO_DOC[i.toUpperCase().replace(/ /g, "_")] ?? "court_document")
  ));

  function storeAndNavigate(docType: string) {
    sessionStorage.setItem("intake_context", JSON.stringify({
      docType,
      notes: [
        `AI Intake Summary:\n${report.summary}`,
        report.factSummary ? `\nFact Summary:\n${report.factSummary}` : "",
        report.intakeFlags.violations?.length
          ? `\nViolations: ${report.intakeFlags.violations.join("; ")}`
          : "",
      ].join("").trim(),
      riskLevel: report.riskLevel,
    }));
    navigate(`${BASE}/drafts`);
  }

  return (
    <div className="px-4 pb-4 space-y-3">
      {/* Risk header */}
      <div className="flex items-center justify-between pt-1">
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4 text-white/40" />
          <span className="text-[10px] uppercase tracking-widest text-white/40 font-bold">Intake Analysis</span>
        </div>
        <Badge variant="outline" className={`text-[10px] capitalize ${RISK_BADGE[report.riskLevel] ?? RISK_BADGE.moderate}`}>
          {report.riskLevel} risk
        </Badge>
      </div>

      {/* Red flag banner */}
      {report.intakeFlags.redBannerMessage && (
        <div className="rounded-lg px-3 py-2.5 flex items-start gap-2" style={INTAKE_WARN_BG}>
          <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
          <p className="text-[11px] text-red-300/90 leading-snug">{report.intakeFlags.redBannerMessage}</p>
        </div>
      )}

      {/* Summary */}
      <div className="rounded-lg px-3 py-2.5" style={INTAKE_RESULT_BG}>
        <p className="text-[9px] uppercase tracking-widest text-white/35 mb-1">Summary</p>
        <p className="text-[12px] text-white/80 leading-relaxed">{report.summary}</p>
        {report.factSummary && report.factSummary !== report.summary && (
          <p className="text-[11px] text-white/50 mt-1.5 leading-relaxed">{report.factSummary}</p>
        )}
      </div>

      {/* Violations */}
      {(report.intakeFlags.violations ?? []).length > 0 && (
        <div className="rounded-lg px-3 py-2.5" style={INTAKE_WARN_BG}>
          <p className="text-[9px] uppercase tracking-widest text-orange-400/70 mb-1.5">Violations Identified</p>
          <ul className="space-y-1">
            {report.intakeFlags.violations.map((v, i) => (
              <li key={i} className="flex items-start gap-1.5">
                <ChevronRight className="w-3 h-3 text-orange-400/60 shrink-0 mt-0.5" />
                <span className="text-[11px] text-orange-200/80">{v}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Doctrines */}
      {(report.doctrinesApplied ?? []).length > 0 && (
        <div>
          <p className="text-[9px] uppercase tracking-widest text-white/25 mb-1.5">Doctrines Applied</p>
          <div className="flex flex-wrap gap-1">
            {report.doctrinesApplied.map((d, i) => (
              <span key={i} className="text-[9px] px-1.5 py-0.5 rounded text-blue-300/70"
                style={{ background: "rgba(30,60,160,0.2)", border: "1px solid rgba(30,80,180,0.2)" }}>
                {d}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Recommended actions */}
      {(report.recommendedActions ?? []).length > 0 && (
        <div>
          <p className="text-[9px] uppercase tracking-widest text-white/25 mb-1.5">Recommended Actions</p>
          <ul className="space-y-1">
            {report.recommendedActions.map((a, i) => (
              <li key={i} className="flex items-start gap-1.5">
                <CheckCircle2 className="w-3 h-3 text-green-400/60 shrink-0 mt-0.5" />
                <span className="text-[11px] text-white/65">{a}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Action buttons */}
      <div className="space-y-2 pt-1 border-t border-white/8">
        {docTypes.length > 0 && (
          <div>
            <p className="text-[9px] uppercase tracking-widest text-white/25 mb-1.5">Draft Instrument</p>
            <div className="flex flex-wrap gap-1.5">
              {docTypes.map((dt) => (
                <button
                  key={dt}
                  onClick={() => storeAndNavigate(dt)}
                  className="flex items-center gap-1.5 text-[10px] px-2.5 py-1.5 rounded-lg text-white/70 hover:text-white transition-all"
                  style={{ background: "rgba(107,0,0,0.4)", border: "1px solid rgba(255,255,255,0.12)" }}
                >
                  <FileText className="w-3 h-3" />
                  {DOC_LABELS[dt] ?? dt}
                  <ArrowRight className="w-3 h-3" />
                </button>
              ))}
            </div>
          </div>
        )}
        {elevated && (
          <button
            onClick={() => {
              navigate(`${BASE}/sovereign-pipeline`);
            }}
            className="w-full flex items-center justify-center gap-2 text-[11px] px-3 py-2 rounded-lg text-white/80 hover:text-white transition-all"
            style={{ background: "rgba(107,0,0,0.5)", border: "1px solid rgba(180,20,20,0.35)" }}
          >
            <Shield className="w-3.5 h-3.5" />
            Run Sovereign Pipeline
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        )}
        <button
          onClick={onReset}
          className="w-full text-[10px] text-white/25 hover:text-white/45 transition-colors py-1"
        >
          Start a new intake
        </button>
      </div>
    </div>
  );
}

/* ─── Intake Tab ─────────────────────────────────────────────── */
function IntakeTab({ memberName }: { memberName?: string }) {
  const { toast } = useToast();
  const authHeader = { Authorization: `Bearer ${getCurrentBearerToken() ?? ""}` };

  const [phase, setPhase] = useState<"select" | "open" | "describe" | "result">("select");
  const [selected, setSelected] = useState<IntakeOption | null>(null);
  const [description, setDescription] = useState("");
  const [result, setResult] = useState<IntakeAgentReport | null>(null);

  const intakeMutation = useMutation({
    mutationFn: async ({ text, caseType }: { text: string; caseType: string }) => {
      const r = await fetch("/api/intake/analyze", {
        method: "POST",
        headers: { ...authHeader, "Content-Type": "application/json" },
        body: JSON.stringify({ text, context: { caseType } }),
      });
      if (!r.ok) {
        const e = await r.json().catch(() => ({}));
        throw new Error((e as any).error ?? "Intake analysis failed");
      }
      return r.json() as Promise<IntakeAgentReport>;
    },
    onSuccess: (data) => {
      setResult(data);
      setPhase("result");
    },
    onError: (e) => toast({ title: "Intake error", description: (e as Error).message, variant: "destructive" }),
  });

  function handleSelect(opt: IntakeOption) {
    setSelected(opt);
    setPhase("open");
  }

  function handleProceed() {
    setPhase("describe");
  }

  function handleSubmit() {
    if (!description.trim() || !selected) return;
    intakeMutation.mutate({ text: description.trim(), caseType: selected.caseType });
  }

  function handleReset() {
    setPhase("select");
    setSelected(null);
    setDescription("");
    setResult(null);
    intakeMutation.reset();
  }

  /* ── Phase: select type ── */
  if (phase === "select") {
    return (
      <div className="px-4 py-4 space-y-3">
        <div className="mb-1">
          <p className="text-[11px] text-white/50 leading-relaxed">
            I'm here to guide you — not just answer questions, but walk with you through what you need.
            Tell me what kind of matter we're working on{memberName ? `, ${memberName.split(" ")[0]}` : ""}.
          </p>
        </div>
        <div className="space-y-2">
          {INTAKE_OPTIONS.map((opt) => (
            <button
              key={opt.key}
              onClick={() => handleSelect(opt)}
              className="w-full text-left rounded-xl px-3.5 py-3 hover:brightness-110 transition-all group"
              style={INTAKE_BG}
            >
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                  style={{ background: "rgba(30,80,160,0.3)", border: "1px solid rgba(60,120,220,0.2)" }}>
                  <span className="text-blue-300/70">{opt.icon}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-white/80 group-hover:text-white transition-colors">{opt.label}</p>
                    <ChevronRight className="w-4 h-4 text-white/20 group-hover:text-white/50 transition-colors shrink-0" />
                  </div>
                  <p className="text-[10px] text-white/35 mt-0.5">{opt.sublabel}</p>
                  <p className="text-[11px] text-white/45 mt-1 leading-snug">{opt.description}</p>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  /* ── Phase: COMPANION's opening — inform + offer ── */
  if (phase === "open" && selected) {
    return (
      <div className="px-4 py-4 space-y-4">
        {/* COMPANION's message */}
        <div className="rounded-xl px-3.5 py-3" style={MSG_AI}>
          <p className="text-[9px] tracking-[0.18em] text-amber-400/70 uppercase font-semibold mb-1.5">COMPANION</p>
          <p className="text-sm text-white/80 leading-relaxed">{selected.kayaOpening}</p>
        </div>

        {/* What we'll need */}
        <div className="rounded-lg px-3 py-2.5" style={INTAKE_BG}>
          <p className="text-[9px] uppercase tracking-widest text-blue-300/50 mb-1.5">What I'll analyze</p>
          <ul className="space-y-1">
            {[
              "Any rights or protections that apply to your situation",
              "Sovereign law doctrines that may be triggered",
              "Violations or red flags to address",
              "The instruments and actions that will best serve you",
            ].map((item, i) => (
              <li key={i} className="flex items-start gap-1.5">
                <CheckCircle2 className="w-3 h-3 text-blue-400/50 shrink-0 mt-0.5" />
                <span className="text-[11px] text-white/50">{item}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => setPhase("select")}
            className="flex-1 text-[11px] text-white/30 hover:text-white/55 transition-colors py-2"
          >
            ← Choose different type
          </button>
          <button
            onClick={handleProceed}
            className="flex-1 flex items-center justify-center gap-1.5 text-[12px] font-medium text-white/80 hover:text-white rounded-lg py-2 transition-all"
            style={{ background: "rgba(107,0,0,0.5)", border: "1px solid rgba(180,20,20,0.35)" }}
          >
            Ready — let's go
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    );
  }

  /* ── Phase: describe situation ── */
  if (phase === "describe" && selected) {
    return (
      <div className="px-4 py-4 space-y-3">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-blue-300/50">{selected.icon}</span>
          <p className="text-[10px] uppercase tracking-widest text-white/35 font-bold">{selected.label}</p>
        </div>

        <div className="rounded-xl px-3.5 py-3" style={MSG_AI}>
          <p className="text-[9px] tracking-[0.18em] text-amber-400/70 uppercase font-semibold mb-1.5">COMPANION</p>
          <p className="text-sm text-white/80 leading-relaxed">
            Take your time. Describe what's happening — as much or as little as you're ready to share. I'll work with what you give me and let you know if I need anything else.
          </p>
        </div>

        <Textarea
          value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder={selected.placeholder}
          className="w-full resize-none text-sm text-white/85 placeholder:text-white/20 rounded-lg"
          style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", minHeight: 120 }}
          disabled={intakeMutation.isPending}
        />

        <div className="flex gap-2">
          <button
            onClick={() => setPhase("open")}
            className="flex-1 text-[11px] text-white/25 hover:text-white/50 transition-colors py-2"
            disabled={intakeMutation.isPending}
          >
            ← Back
          </button>
          <button
            onClick={handleSubmit}
            disabled={!description.trim() || intakeMutation.isPending}
            className="flex-1 flex items-center justify-center gap-2 text-[12px] font-medium text-white/80 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed rounded-lg py-2 transition-all"
            style={{ background: "rgba(107,0,0,0.5)", border: "1px solid rgba(180,20,20,0.35)" }}
          >
            {intakeMutation.isPending ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                COMPANION is analyzing…
              </>
            ) : (
              <>
                <Shield className="w-3.5 h-3.5" />
                Run Intake Analysis
              </>
            )}
          </button>
        </div>

        {intakeMutation.isPending && (
          <p className="text-[10px] text-white/20 text-center">
            COMPANION is reviewing your situation against sovereign law and protections…
          </p>
        )}
      </div>
    );
  }

  /* ── Phase: result ── */
  if (phase === "result" && result) {
    return <IntakeResultPanel report={result} intakeType={selected!.key} onReset={handleReset} />;
  }

  return null;
}

/* ─── Main KayaChat Component ────────────────────────────────── */
export function KayaChat({ memberPhoto, memberName, pendingTasks, unreadNotifications, pendingFilings }: KayaChatProps = {}) {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const bottomRef = useRef<HTMLDivElement>(null);

  const [input, setInput] = useState("");
  const [inputMode, setInputMode] = useState<"chat" | "journal" | "memory">("chat");
  const [selectedMood, setSelectedMood] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [tab, setTab] = useState<"chat" | "intake" | "memory" | "journal">("chat");
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
        throw new Error((e as any).error ?? "COMPANION is unavailable right now");
      }
      return r.json() as Promise<{ reply: string }>;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["kaya-history", user?.id] }),
    onError: (e) => toast({ title: "COMPANION error", description: (e as Error).message, variant: "destructive" }),
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
      toast({ title: "Journal entry saved", description: "COMPANION will carry this forward." });
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
      toast({ title: "Saved to COMPANION's memory", description: "COMPANION will carry this knowledge in every conversation." });
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
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
            style={{ background: "linear-gradient(135deg, #6B0000 0%, #9B1A1A 100%)", border: "1px solid rgba(255,255,255,0.15)" }}
          >
            <Feather className="w-4 h-4 text-amber-300" />
          </div>
          <div>
            <p className="text-sm font-bold text-white leading-none">COMPANION</p>
            <p className="text-[9px] tracking-[0.2em] text-white/45 uppercase mt-0.5">
              Your Indigenous Companion · {knowledgeEntries.length} memories
            </p>
          </div>
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
          {memberPhoto && (
            <div className="w-7 h-7 rounded-full overflow-hidden border border-white/20 flex-shrink-0" title={memberName ?? "Member"}>
              <img src={memberPhoto} alt={memberName ?? "Member"} className="w-full h-full object-cover" />
            </div>
          )}
          {!collapsed && (
            <>
              {tabBtn("chat", <MessageCircle className="w-3 h-3" />, "Chat")}
              {tabBtn("intake", <ClipboardList className="w-3 h-3" />, "Intake")}
              {tabBtn("memory", <Brain className="w-3 h-3" />, "Memory")}
              {tabBtn("journal", <BookOpen className="w-3 h-3" />, "Journal")}
            </>
          )}
          <button
            onClick={() => setCollapsed(c => !c)}
            className="ml-1 text-white/30 hover:text-white/70 transition-colors p-1"
            title={collapsed ? "Expand COMPANION" : "Collapse COMPANION"}
          >
            {collapsed ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {collapsed && (
        <div className="px-4 py-2 text-[11px] text-white/25 italic">
          COMPANION is ready — expand to chat, start an intake, add to memory, or journal.
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
                    {/* Intake prompt */}
                    <div className="rounded-xl px-3.5 py-3" style={INTAKE_BG}>
                      <p className="text-[10px] text-blue-300/50 uppercase tracking-widest mb-1.5 font-bold">Need to start a matter?</p>
                      <p className="text-[11px] text-white/45 leading-relaxed mb-2">
                        For business, filings, or profile updates — I'll guide you through it step by step.
                      </p>
                      <button
                        onClick={() => setTab("intake")}
                        className="flex items-center gap-1.5 text-[11px] text-blue-300/70 hover:text-blue-200/90 transition-colors"
                      >
                        <ClipboardList className="w-3.5 h-3.5" />
                        Start an intake
                        <ArrowRight className="w-3 h-3" />
                      </button>
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
                            <p className="text-[9px] tracking-[0.18em] text-amber-400/70 uppercase font-semibold mb-1">COMPANION</p>
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
                      <p className="text-[9px] tracking-[0.18em] text-amber-400/70 uppercase font-semibold mb-1">COMPANION</p>
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

              {/* Pending save to memory */}
              {pendingSaveMessage && (
                <div className="mx-4 mb-2 rounded-lg px-3 py-2 flex items-start gap-2" style={MSG_KNOWLEDGE}>
                  <Brain className="w-3.5 h-3.5 text-amber-400/70 flex-shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] text-amber-400/70 font-semibold mb-0.5">Save this to COMPANION's memory?</p>
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
                    { key: "chat" as const, label: "Talk to COMPANION" },
                    { key: "journal" as const, label: "Journal entry" },
                    { key: "memory" as const, label: "Teach COMPANION" },
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
                        ? "Write your reflection… COMPANION carries this forward."
                        : inputMode === "memory"
                        ? "Share knowledge for COMPANION to remember across all sessions…"
                        : "Ask COMPANION about law, sovereignty, or anything on your mind…"
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
                  {inputMode === "memory" ? "COMPANION will retain this across all conversations" : "COMPANION carries your conversations and memory forward"}
                </p>
              </div>
            </>
          )}

          {/* ── Intake Tab ── */}
          {tab === "intake" && (
            <div style={{ minHeight: 280 }}>
              <IntakeTab memberName={memberName} />
            </div>
          )}

          {/* ── Memory Tab ── */}
          {tab === "memory" && (
            <div className="flex flex-col" style={{ minHeight: 280 }}>
              <div className="px-4 pt-3 pb-2 space-y-2" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                <p className="text-[11px] text-white/40 leading-relaxed">
                  Teach COMPANION facts, context, and knowledge you want carried in every conversation —
                  law distinctions, tribal process, personal context, anything COMPANION should always know.
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
                      Add knowledge above — COMPANION will carry it in every conversation.
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
