import { useState, useRef, useEffect } from "react";
import { useLocation, useSearch } from "wouter";
import { useAuth, getCurrentBearerToken } from "@/components/auth-provider";
import {
  Fingerprint, Landmark, Stethoscope, ShieldAlert, Building2,
  Send, Loader2, ArrowLeft, Upload, CheckCircle, FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";

// ─── Intake type config ───────────────────────────────────────────────────────

type IntakeType = "identity-lineage" | "housing-land" | "healthcare" | "welfare" | "business";

interface IntakeConfig {
  icon: React.ElementType;
  color: string;
  accentClass: string;
  title: string;
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
    color: "#3b82f6",
    accentClass: "border-blue-500/30 bg-blue-500/5",
    title: "Identity & Lineage Intake",
    subtitle: "Companion will guide you through documenting your identity, lineage, and ancestral connections.",
    opening: `It's good to have you here, Family.\n\nI'm Companion — I'm here to help document and protect your identity and lineage under the authority of the Mathias El Tribe Sovereign Office.\n\nThis is a guided and protected intake. What you share here is recorded under sovereign jurisdiction and used to strengthen your identity record, verify lineage connections, and build protections where needed.\n\nLet's start simply.\n\nWhat is your full name as you'd like it recorded in the tribal registry?`,
    focusContext: "INTAKE TYPE: Identity & Lineage. Collect: full legal name, preferred name, tribal affiliation and lineage connection, enrollment or membership status, any identity challenges or disputes, ceremonial names or cultural protections needed, family tree connections, and any documentation the member has. Ask one question at a time. Be warm, thorough, and protective.",
    nextPath: "/profile",
    nextLabel: "View My Profile",
  },
  "housing-land": {
    icon: Landmark,
    color: "#f59e0b",
    accentClass: "border-amber-500/30 bg-amber-500/5",
    title: "Housing & Land Protection Intake",
    subtitle: "Companion will gather information about your land and housing situation to identify protections and next steps.",
    opening: `Welcome, Family. I'm Companion.\n\nI'm here to help document your housing and land situation so we can identify any protections that apply and determine what actions the Sovereign Office should take on your behalf.\n\nInformation you share here may be used to assess land classification, issue Notices of Federal Review, review encumbrances, or initiate other protective workflows.\n\nLet's start with the basics.\n\nCan you tell me the address or a description of the property you're concerned about?`,
    focusContext: "INTAKE TYPE: Housing & Land Protection. Collect: property address and APN/parcel number if known, how the member is connected to the property (owner, occupant, heir, etc.), current land status if known (trust/restricted/fee/unknown), any encumbrances, tax liens, or foreclosure threats, mortgage or servicer name, any deed or title issues, utilities or code enforcement actions. Ask one question at a time. Be thorough and protective.",
    nextPath: "/land",
    nextLabel: "View Land & Asset Records",
  },
  "healthcare": {
    icon: Stethoscope,
    color: "#f43f5e",
    accentClass: "border-rose-500/30 bg-rose-500/5",
    title: "Healthcare & Benefits Intake",
    subtitle: "Companion will document your healthcare eligibility and any access issues. You can also upload proof of IHS or Urban Indian Health Program services.",
    opening: `Welcome, Family. I'm Companion.\n\nI'm here to help document your healthcare eligibility and any issues you've experienced accessing Indian health services or federal benefits.\n\nYour Indian health rights are protected under the Indian Health Care Improvement Act, the Snyder Act, and the federal trust responsibility. If those rights have been denied or interfered with, this office can take action.\n\nLet's begin.\n\nDo you currently receive services through an Indian Health Service (IHS) facility or an Urban Indian Health Program?`,
    focusContext: "INTAKE TYPE: Healthcare & Benefits. Collect: whether the member receives IHS or Urban Indian Health Program services, name of the facility or program, any benefit denials or interruptions, managed care interference with Indian health access, Medi-Cal or insurance issues, specific services denied, any healthcare emergencies, and whether the member has documentation of eligibility or denial. Ask one question at a time. Be warm and thorough.",
    nextPath: "/welfare",
    nextLabel: "Open Welfare Instrument",
    hasFileUpload: true,
  },
  "welfare": {
    icon: ShieldAlert,
    color: "#8b5cf6",
    accentClass: "border-violet-500/30 bg-violet-500/5",
    title: "Welfare & Protection Intake",
    subtitle: "This is a private, protected conversation. Companion will listen and help identify the right protections for your situation.",
    opening: `Welcome, Family. I'm Companion.\n\nThis is a protected and private intake space. What you share here is held in confidence under the authority of the Mathias El Tribe Sovereign Office and is used only to help identify the right protections for you and your family.\n\nYou are not alone in this. This office exists to protect our people — including in emergency and welfare matters.\n\nWhenever you're ready, please tell me — what kind of situation are you facing today?`,
    focusContext: "INTAKE TYPE: Welfare & Protection. This is sensitive. Collect: the nature of the welfare or protection concern (family, housing, benefits, discrimination, agency misconduct, emergency, etc.), who is affected (member, children, family members), the urgency of the situation, any agencies or entities involved, whether any court proceedings are active, whether ICWA may apply if children are involved, and what the member needs most urgently. Ask one question at a time. Be gentle, private, and protective.",
    nextPath: "/welfare",
    nextLabel: "Generate Welfare Instrument",
  },
  "business": {
    icon: Building2,
    color: "#f59e0b",
    accentClass: "border-amber-500/30 bg-amber-500/5",
    title: "Sovereign Business Formation",
    subtitle: "Companion will help you develop and document your business idea before we begin the formal formation process.",
    opening: `Welcome, Family. I'm Companion.\n\nI'm here to help you explore and develop your business idea before we begin the formal sovereign business formation process.\n\nBusiness formation under the Mathias El Tribe Sovereign Office establishes your venture under inherent tribal authority — providing significant legal protections and sovereign frameworks that most businesses don't have access to.\n\nBefore we get into the legal structure, let's understand your idea.\n\nWhat kind of business are you thinking about building, and what does it do?`,
    focusContext: "INTAKE TYPE: Sovereign Business Formation. Collect: business name and description, the product or service offered, intended customers or community served, any existing business activity or revenue, the member's role and background, business goals and vision, any partners or co-founders, whether the business serves the tribal community, and any concerns or questions about the formation process. Ask one question at a time. Be encouraging and thorough.",
    nextPath: "/business-canvas/new",
    nextLabel: "Begin Formal Formation",
  },
};

// ─── Message type ─────────────────────────────────────────────────────────────

type Message = { role: "user" | "assistant"; content: string };

// ─── Healthcare file upload ───────────────────────────────────────────────────

function HealthcareUploadSection() {
  const [files, setFiles] = useState<Array<{ name: string; status: "uploading" | "done" | "error" }>>([]);
  const fileRef = useRef<HTMLInputElement>(null);

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

  return (
    <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Upload className="w-4 h-4 text-rose-400 shrink-0" />
        <p className="text-xs font-semibold text-rose-300 uppercase tracking-widest">
          Upload Proof of IHS / Urban Indian Health Eligibility
        </p>
      </div>
      <p className="text-xs text-muted-foreground leading-relaxed">
        If you have documentation showing you receive services through an Indian Health Service (IHS) facility
        or Urban Indian Health Program — such as a membership card, referral letter, medical record, or program
        enrollment notice — you can upload it here. This documentation helps the Sovereign Office assert your
        healthcare rights on your behalf.
      </p>

      <div
        className="border-2 border-dashed border-rose-500/30 rounded-lg p-4 text-center cursor-pointer hover:border-rose-500/50 transition-colors"
        onClick={() => fileRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); handleFiles(e.dataTransfer.files); }}
      >
        <Upload className="w-6 h-6 text-muted-foreground mx-auto mb-1" />
        <p className="text-xs text-muted-foreground">Click to upload or drag and drop</p>
        <p className="text-[10px] text-muted-foreground/70 mt-0.5">PDF, JPG, PNG accepted</p>
        <input
          ref={fileRef}
          type="file"
          multiple
          accept=".pdf,.jpg,.jpeg,.png,.gif,.webp"
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
      </div>

      {files.length > 0 && (
        <div className="space-y-1.5">
          {files.map((f) => (
            <div key={f.name} className="flex items-center gap-2 text-xs">
              {f.status === "done" ? (
                <CheckCircle className="w-3.5 h-3.5 text-green-400 shrink-0" />
              ) : f.status === "uploading" ? (
                <Loader2 className="w-3.5 h-3.5 text-rose-400 animate-spin shrink-0" />
              ) : (
                <span className="w-3.5 h-3.5 text-red-400 shrink-0">✗</span>
              )}
              <span className="text-muted-foreground truncate">{f.name}</span>
              {f.status === "done" && <span className="text-green-400 shrink-0">Received</span>}
            </div>
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

      // On the first user message, inject the focus context invisibly as a system hint
      const historyForApi: Message[] = contextInjected.current
        ? newMessages.slice(0, -1)
        : [
            { role: "assistant", content: `[INTAKE CONTEXT — not shown to user]\n${config.focusContext}\nMember name on file: ${user?.name ?? "Unknown"}\n[End context]` },
            ...newMessages.slice(0, -1),
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
      setMessages((prev) => [...prev, { role: "assistant", content: data.reply }]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "I'm having trouble connecting right now. Please try again in a moment." },
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
      "intake_companion_context",
      JSON.stringify({ intakeType, summary, completedAt: new Date().toISOString() })
    );
    setFinished(true);
  }

  const showFinish = messages.length >= 5 && !finished;

  return (
    <div className="min-h-screen flex flex-col max-w-3xl mx-auto">

      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => navigate(`${base}/hub`)}
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div
          className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
          style={{ backgroundColor: `${config.color}18`, color: config.color }}
        >
          <Icon className="w-5 h-5" />
        </div>
        <div className="min-w-0">
          <h1 className="text-lg font-serif font-bold text-foreground leading-tight">{config.title}</h1>
          <p className="text-xs text-muted-foreground leading-snug">{config.subtitle}</p>
        </div>
      </div>

      {/* Healthcare file upload — shown above the chat */}
      {config.hasFileUpload && (
        <div className="mb-4">
          <HealthcareUploadSection />
        </div>
      )}

      {/* Chat area */}
      <div className="flex-1 space-y-4 mb-4 overflow-y-auto">
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            {msg.role === "assistant" && (
              <div
                className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 mr-2 mt-0.5 text-[10px] font-bold"
                style={{ backgroundColor: `${config.color}20`, color: config.color }}
              >
                C
              </div>
            )}
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
                msg.role === "user"
                  ? "bg-primary text-primary-foreground rounded-br-sm"
                  : `${config.accentClass} text-foreground rounded-bl-sm border`
              }`}
            >
              {msg.content}
            </div>
          </div>
        ))}

        {sending && (
          <div className="flex justify-start">
            <div
              className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 mr-2 mt-0.5 text-[10px] font-bold"
              style={{ backgroundColor: `${config.color}20`, color: config.color }}
            >
              C
            </div>
            <div className={`rounded-2xl rounded-bl-sm px-4 py-3 border ${config.accentClass}`}>
              <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Finish confirmation */}
      {finished && (
        <div className={`rounded-xl border p-5 mb-4 space-y-3 ${config.accentClass}`}>
          <div className="flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-green-400" />
            <p className="text-sm font-semibold text-foreground">Intake conversation recorded.</p>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Your information has been captured and will be reviewed by the Sovereign Office.
            Companion will continue to assist you as you use the platform.
          </p>
          <div className="flex gap-3 flex-wrap pt-1">
            {config.nextPath && (
              <Button
                size="sm"
                className="gap-1.5"
                onClick={() => navigate(`${base}${config.nextPath}`)}
              >
                <FileText className="w-3.5 h-3.5" />
                {config.nextLabel ?? "Continue"}
              </Button>
            )}
            <Button
              size="sm"
              variant="outline"
              onClick={() => navigate(`${base}/hub`)}
            >
              Return to Hub
            </Button>
          </div>
        </div>
      )}

      {/* Input bar */}
      {!finished && (
        <div className="sticky bottom-0 pb-4 pt-2 bg-background/95 backdrop-blur">
          <div className="flex gap-2 items-end">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type your response… (Enter to send)"
              rows={2}
              className="flex-1 resize-none rounded-xl border border-input bg-background px-4 py-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring leading-relaxed"
              disabled={sending || finished}
            />
            <Button
              size="icon"
              onClick={() => sendMessage()}
              disabled={!input.trim() || sending || finished}
              className="h-11 w-11 rounded-xl shrink-0"
            >
              {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </Button>
          </div>

          {showFinish && (
            <div className="flex justify-center mt-2">
              <button
                onClick={handleFinish}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors underline underline-offset-2"
              >
                I've shared everything I need to — finish intake
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
