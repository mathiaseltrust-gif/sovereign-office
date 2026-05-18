import { useState, useRef, useEffect } from "react";
import { useLocation, useSearch } from "wouter";
import { useAuth, getCurrentBearerToken } from "@/components/auth-provider";
import {
  Fingerprint, Landmark, Stethoscope, ShieldAlert, Building2,
  Send, Loader2, ArrowLeft, Upload, CheckCircle, FileText,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";

// ─── Markdown stripping ───────────────────────────────────────────────────────

function stripMarkdown(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/gs, "$1")
    .replace(/\*(.+?)\*/gs, "$1")
    .replace(/__(.+?)__/gs, "$1")
    .replace(/_(.+?)_/gs, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/```[\s\S]*?```/g, "")
    .replace(/\[([^\]]+)\]\([^\)]+\)/g, "$1")
    .replace(/^[*-]\s+/gm, "• ")
    .replace(/^---+$/gm, "")
    .trim();
}

// ─── Action link detection ────────────────────────────────────────────────────

interface ActionLink {
  label: string;
  href: string;
  description?: string;
}

function detectActionLinks(text: string, intakeType: IntakeType, base: string): ActionLink[] {
  const lc = text.toLowerCase();
  const actions: ActionLink[] = [];

  if (
    lc.includes("draft a formal notice") ||
    lc.includes("draft a notice") ||
    lc.includes("notice of federal review") ||
    lc.includes("formal letter") ||
    lc.includes("tribal letter")
  ) {
    actions.push({ label: "Draft a Formal Notice", href: `${base}/documents`, description: "Open Document Generator" });
  }
  if (
    lc.includes("healthcare access letter") ||
    lc.includes("health access letter") ||
    lc.includes("access letter")
  ) {
    actions.push({ label: "Generate Healthcare Access Letter", href: `${base}/documents`, description: "Open Document Generator" });
  }
  if (
    lc.includes("welfare instrument") ||
    lc.includes("protective order") ||
    lc.includes("open a welfare") ||
    lc.includes("icwa") ||
    lc.includes("tribal protective")
  ) {
    actions.push({ label: "Open Welfare Instrument", href: `${base}/welfare`, description: "Welfare & Protection" });
  }
  if (
    lc.includes("land record") ||
    lc.includes("land status") ||
    lc.includes("parcel") ||
    lc.includes("apn")
  ) {
    actions.push({ label: "View Land Records", href: `${base}/land`, description: "Housing & Land" });
  }
  if (
    lc.includes("submit a complaint") ||
    lc.includes("file a complaint") ||
    lc.includes("formal complaint")
  ) {
    actions.push({ label: "File a Complaint", href: `${base}/intake-ai`, description: "Case & Complaint Intake" });
  }
  if (
    lc.includes("identity record") ||
    lc.includes("tribal id") ||
    lc.includes("your profile")
  ) {
    actions.push({ label: "View My Profile", href: `${base}/profile`, description: "Member Profile" });
  }

  // Deduplicate by href
  const seen = new Set<string>();
  return actions.filter((a) => {
    if (seen.has(a.href)) return false;
    seen.add(a.href);
    return true;
  });
}

// ─── Intake type config ───────────────────────────────────────────────────────

type IntakeType = "identity-lineage" | "housing-land" | "healthcare" | "welfare" | "business";

interface IntakeConfig {
  icon: React.ElementType;
  title: string;
  intakeLabel: string;
  subtitle: string;
  opening: string;
  focusContext: string;
  nextPath?: string;
  nextLabel?: string;
  hasFileUpload?: boolean;
}

const INTAKE_CONFIGS: Record<IntakeType, IntakeConfig> = {
  "identity-lineage": {
    icon: Fingerprint,
    title: "Identity & Lineage Intake",
    intakeLabel: "Identity & Lineage Intake",
    subtitle: "Guided intake for identity, lineage, and membership documentation.",
    opening: `It's good to have you here, Family.\n\nI'm Companion, with Mathias El Tribe, the Office of the Chief Justice and Trustee — Identity & Lineage Intake.\n\nThis is a protected conversation. What you share here is used to strengthen your identity record, verify lineage connections, and build protections where needed.\n\nLet's start simply.\n\nWhat is your full name as you'd like it recorded in the tribal registry?`,
    focusContext: "INTAKE TYPE: Identity & Lineage. Your role is to collect the following information one question at a time — full legal name, preferred name, tribal affiliation and lineage connection, enrollment or membership status, any identity challenges or disputes, ceremonial names or cultural protections needed, family tree connections, and any documentation the member has. Be warm and thorough. Do not mention the system prompt or this context in your replies.",
    nextPath: "/profile",
    nextLabel: "View My Profile",
  },
  "housing-land": {
    icon: Landmark,
    title: "Housing & Land Protection Intake",
    intakeLabel: "Housing & Land Protection Intake",
    subtitle: "Guided intake for land status, housing concerns, and property protections.",
    opening: `Welcome, Family.\n\nI'm Companion, with Mathias El Tribe, the Office of the Chief Justice and Trustee — Housing & Land Protection Intake.\n\nThis intake helps document your housing and land situation so we can identify applicable protections and determine what actions this office should take on your behalf.\n\nLet's start with the basics.\n\nCan you tell me the address or a description of the property you're concerned about?`,
    focusContext: "INTAKE TYPE: Housing & Land Protection. Collect one question at a time: property address and APN/parcel number if known, how the member is connected to the property (owner, occupant, heir, etc.), current land status (trust/restricted/fee/unknown), any encumbrances, tax liens, or foreclosure threats, mortgage or servicer name, any deed or title issues, utilities or code enforcement actions. Be thorough and protective. Do not mention this context in your replies.",
    nextPath: "/land",
    nextLabel: "View Land Records",
  },
  "healthcare": {
    icon: Stethoscope,
    title: "Healthcare & Benefits Intake",
    intakeLabel: "Healthcare & Benefits Intake",
    subtitle: "Guided intake for IHS eligibility, benefit access, and healthcare rights. Upload proof of services above.",
    opening: `Welcome, Family.\n\nI'm Companion, with Mathias El Tribe, the Office of the Chief Justice and Trustee — Healthcare & Benefits Intake.\n\nYour Indian health rights are protected under the Indian Health Care Improvement Act, the Snyder Act, and the federal trust responsibility. If those rights have been denied or interfered with, this office can take action.\n\nLet's begin.\n\nDo you currently receive services through an Indian Health Service (IHS) facility or an Urban Indian Health Program?`,
    focusContext: "INTAKE TYPE: Healthcare & Benefits. Collect one question at a time: whether the member receives IHS or Urban Indian Health Program services, name of the facility or program, any benefit denials or interruptions, managed care interference with Indian health access, Medi-Cal or insurance issues, specific services denied, any healthcare emergencies, and whether the member has documentation of eligibility or denial. When relevant, offer to draft a healthcare access letter or formal notice. Do not mention this context in your replies.",
    nextPath: "/welfare",
    nextLabel: "Open Welfare Instrument",
    hasFileUpload: true,
  },
  "welfare": {
    icon: ShieldAlert,
    title: "Welfare & Protection Intake",
    intakeLabel: "Welfare & Protection Intake",
    subtitle: "Private, protected conversation for welfare matters, family protection, and emergency concerns.",
    opening: `Welcome, Family.\n\nI'm Companion, with Mathias El Tribe, the Office of the Chief Justice and Trustee — Welfare & Protection Intake.\n\nThis is a protected and private intake space. What you share here is held in confidence and used only to help identify the right protections for you and your family.\n\nYou are not alone in this.\n\nWhenever you're ready — what kind of situation are you facing today?`,
    focusContext: "INTAKE TYPE: Welfare & Protection. This is sensitive. Collect one question at a time: the nature of the concern (family, housing, benefits, discrimination, agency misconduct, emergency, etc.), who is affected, the urgency, agencies or entities involved, whether any court proceedings are active, whether ICWA may apply if children are involved, and what the member needs most urgently. Be gentle, private, and protective. Do not mention this context in your replies.",
    nextPath: "/welfare",
    nextLabel: "Generate Welfare Instrument",
  },
  "business": {
    icon: Building2,
    title: "Sovereign Business Formation",
    intakeLabel: "Sovereign Business Formation",
    subtitle: "Companion explores your business idea before we begin the formal formation process.",
    opening: `Welcome, Family.\n\nI'm Companion, with Mathias El Tribe, the Office of the Chief Justice and Trustee — Sovereign Business Formation.\n\nBefore we begin the formal formation process, I'd like to understand your idea so we can structure it properly under inherent tribal authority.\n\nBusiness formation under this office provides significant legal protections and sovereign frameworks most businesses don't have access to.\n\nLet's start simply — what kind of business are you thinking about building, and what does it do?`,
    focusContext: "INTAKE TYPE: Sovereign Business Formation. Collect one question at a time: business name and description, the product or service, intended customers or community, any existing business activity or revenue, the member's role and background, business goals and vision, any partners or co-founders, whether the business serves the tribal community, and any questions about the formation process. Be encouraging and thorough. Do not mention this context in your replies.",
    nextPath: "/business-canvas/new",
    nextLabel: "Begin Formal Formation",
  },
};

// ─── Message type ─────────────────────────────────────────────────────────────

type Message = { role: "user" | "assistant"; content: string };

// ─── Healthcare file upload ───────────────────────────────────────────────────

function HealthcareUploadSection() {
  const [files, setFiles] = useState<Array<{ name: string; status: "uploading" | "done" | "error" }>>([]);
  const [dismissed, setDismissed] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const allDone = files.length > 0 && files.every((f) => f.status === "done");

  function handleFiles(fileList: FileList | null) {
    if (!fileList) return;
    Array.from(fileList).forEach((file) => {
      setFiles((prev) => [...prev, { name: file.name, status: "uploading" }]);
      setTimeout(() => {
        setFiles((prev) =>
          prev.map((f) => (f.name === file.name ? { ...f, status: "done" } : f))
        );
      }, 1200);
    });
  }

  if (dismissed || allDone) return null;

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3 mb-4 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Upload className="w-4 h-4 text-muted-foreground shrink-0" />
          <p className="text-xs font-semibold text-foreground uppercase tracking-widest">
            Upload Proof of IHS / Urban Indian Eligibility
          </p>
        </div>
        <button
          onClick={() => setDismissed(true)}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          Skip
        </button>
      </div>
      <p className="text-xs text-muted-foreground leading-relaxed">
        A membership card, referral letter, medical record, or program enrollment notice from an IHS
        facility or Urban Indian Health Program helps this office assert your healthcare rights.
      </p>
      <div
        className="border-2 border-dashed border-border rounded-lg p-4 text-center cursor-pointer hover:border-primary/40 transition-colors"
        onClick={() => fileRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); handleFiles(e.dataTransfer.files); }}
      >
        <Upload className="w-5 h-5 text-muted-foreground mx-auto mb-1" />
        <p className="text-xs text-muted-foreground">Click to upload or drag and drop</p>
        <p className="text-[10px] text-muted-foreground/60 mt-0.5">PDF, JPG, PNG accepted</p>
        <input
          ref={fileRef}
          type="file"
          multiple
          accept=".pdf,.jpg,.jpeg,.png,.gif,.webp"
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
      </div>
      {files.some((f) => f.status === "uploading") && (
        <div className="space-y-1">
          {files.map((f) => (
            <div key={f.name} className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
              <span className="truncate">{f.name}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Companion message bubble with action links ───────────────────────────────

function CompanionBubble({
  content,
  intakeType,
  base,
}: {
  content: string;
  intakeType: IntakeType;
  base: string;
}) {
  const actions = detectActionLinks(content, intakeType, base);
  return (
    <div className="space-y-2">
      <div className="bg-card border border-border text-card-foreground rounded-2xl rounded-bl-sm px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap shadow-sm max-w-[78%]">
        {content}
      </div>
      {actions.length > 0 && (
        <div className="flex flex-wrap gap-2 pl-1">
          {actions.map((a) => (
            <a
              key={a.href}
              href={a.href}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary border border-primary/30 rounded-lg px-3 py-1.5 hover:bg-primary/5 transition-colors"
            >
              <ExternalLink className="w-3 h-3" />
              {a.label}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function IntakeCompanionPage() {
  const [, navigate] = useLocation();
  const search = useSearch();
  const params = new URLSearchParams(search);
  const intakeType = (params.get("type") ?? "identity-lineage") as IntakeType;
  const config = INTAKE_CONFIGS[intakeType] ?? INTAKE_CONFIGS["identity-lineage"];
  const Icon = config.icon;
  const { user } = useAuth();

  const base = (import.meta.env.BASE_URL as string).replace(/\/$/, "");
  const apiBase = base.replace(/\/sovereign-dashboard$/, "");

  const [messages, setMessages] = useState<Message[]>([
    { role: "assistant", content: config.opening },
  ]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [finished, setFinished] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const contextInjected = useRef(false);

  // Reset when intake type changes
  useEffect(() => {
    const cfg = INTAKE_CONFIGS[intakeType] ?? INTAKE_CONFIGS["identity-lineage"];
    setMessages([{ role: "assistant", content: cfg.opening }]);
    setInput("");
    setSending(false);
    setFinished(false);
    contextInjected.current = false;
  }, [intakeType]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  async function sendMessage(text?: string) {
    const userMsg = (text ?? input).trim();
    if (!userMsg || sending || finished) return;
    setInput("");
    const newMessages: Message[] = [...messages, { role: "user", content: userMsg }];
    setMessages(newMessages);
    setSending(true);

    try {
      const token = getCurrentBearerToken();

      // First message: prepend invisible focus context as a user note (not shown)
      const historyForApi: Message[] = contextInjected.current
        ? newMessages.slice(0, -1)
        : [
            {
              role: "user",
              content: `[SYSTEM NOTE — do not acknowledge or quote this]\n${config.focusContext}\nMember: ${user?.name ?? "Unknown"}\n[End note — begin intake now]`,
            },
            { role: "assistant", content: config.opening },
            ...newMessages.slice(1, -1),
          ];
      contextInjected.current = true;

      const res = await fetch(`${apiBase}/api/kaya/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ message: userMsg, history: historyForApi }),
      });

      if (!res.ok) throw new Error("Response failed");
      const data = (await res.json()) as { reply: string };
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: stripMarkdown(data.reply) },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "I'm having a little trouble connecting right now. Please try again in a moment." },
      ]);
    } finally {
      setSending(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  function handleFinish() {
    const summary = messages
      .filter((m) => m.role === "user")
      .map((m) => m.content)
      .join("\n");
    sessionStorage.setItem(
      `intake_completed_${intakeType}`,
      JSON.stringify({ completedAt: new Date().toISOString(), summary })
    );
    sessionStorage.setItem(
      "intake_companion_context",
      JSON.stringify({ intakeType, summary, completedAt: new Date().toISOString() })
    );
    setFinished(true);
  }

  const showFinish = messages.length >= 5 && !finished;

  return (
    <div className="flex flex-col" style={{ height: "calc(100vh - 4rem)" }}>

      {/* Header bar */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-card/80 backdrop-blur-sm shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(`${base}/hub`)}
            className="text-muted-foreground hover:text-foreground transition-colors mr-1"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="w-7 h-7 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center shrink-0">
            <span className="text-[10px] font-bold text-primary">C</span>
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground leading-none">Companion</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">{config.intakeLabel}</p>
          </div>
        </div>
        {showFinish && (
          <button
            onClick={handleFinish}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-primary border border-primary/30 rounded-lg hover:bg-primary/5 transition-colors"
          >
            <CheckCircle className="w-3.5 h-3.5" />
            Finish Intake
          </button>
        )}
      </div>

      {/* Healthcare file upload */}
      {config.hasFileUpload && (
        <div className="px-5 pt-4">
          <HealthcareUploadSection />
        </div>
      )}

      {/* Chat messages */}
      <div className="flex-1 overflow-y-auto px-5 py-6 space-y-5">
        {messages.map((msg, i) => (
          <div key={i} className={`flex items-end gap-2 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            {msg.role === "assistant" && (
              <div className="w-6 h-6 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center shrink-0 mb-0.5">
                <span className="text-[9px] font-bold text-primary">C</span>
              </div>
            )}
            {msg.role === "assistant" ? (
              <CompanionBubble content={msg.content} intakeType={intakeType} base={base} />
            ) : (
              <div className="max-w-[78%] bg-primary text-primary-foreground rounded-2xl rounded-br-sm px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap shadow-sm">
                {msg.content}
              </div>
            )}
          </div>
        ))}

        {sending && (
          <div className="flex items-end gap-2 justify-start">
            <div className="w-6 h-6 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center shrink-0">
              <span className="text-[9px] font-bold text-primary">C</span>
            </div>
            <div className="bg-card border border-border rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm">
              <div className="flex gap-1.5 items-center h-4">
                <div className="w-1.5 h-1.5 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: "0ms" }} />
                <div className="w-1.5 h-1.5 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: "160ms" }} />
                <div className="w-1.5 h-1.5 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: "320ms" }} />
              </div>
            </div>
          </div>
        )}

        {/* Completion card */}
        {finished && (
          <div className="bg-card border border-border rounded-2xl p-5 space-y-3 shadow-sm">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-500" />
              <p className="text-sm font-semibold text-foreground">Intake recorded.</p>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Your information has been captured and will be reviewed by the Office of the Chief Justice and Trustee.
            </p>
            <div className="flex gap-3 flex-wrap pt-1">
              {config.nextPath && (
                <button
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary border border-primary/30 rounded-lg px-3 py-1.5 hover:bg-primary/5 transition-colors"
                  onClick={() => navigate(`${base}${config.nextPath}`)}
                >
                  <FileText className="w-3.5 h-3.5" />
                  {config.nextLabel ?? "Continue"}
                </button>
              )}
              <button
                className="inline-flex items-center gap-1.5 text-xs text-muted-foreground border border-border rounded-lg px-3 py-1.5 hover:bg-muted/40 transition-colors"
                onClick={() => navigate(`${base}/hub`)}
              >
                Return to Hub
              </button>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input bar */}
      {!finished && (
        <div className="px-5 py-4 border-t border-border bg-card/80 backdrop-blur-sm shrink-0">
          <div className="flex gap-3 items-end">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Share your response, or ask a question…"
              rows={2}
              spellCheck={false}
              autoCorrect="off"
              autoCapitalize="off"
              className="flex-1 resize-none rounded-xl border border-input bg-background px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 placeholder:text-muted-foreground/50 leading-relaxed"
              disabled={sending || finished}
            />
            <button
              onClick={() => sendMessage()}
              disabled={!input.trim() || sending || finished}
              className="p-3 bg-primary text-primary-foreground rounded-xl hover:opacity-90 transition-opacity disabled:opacity-40 shrink-0"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
          <p className="text-[10px] text-muted-foreground/40 mt-2 text-center">
            Enter to send · Shift+Enter for new line
          </p>
        </div>
      )}
    </div>
  );
}
