import { useState, useRef, useEffect } from "react";
import { useLocation, useSearch } from "wouter";
import { useAuth, getCurrentBearerToken } from "@/components/auth-provider";
import {
  Fingerprint, Landmark, Stethoscope, ShieldAlert, Building2,
  ArrowLeft, CheckCircle, FileText, Upload, Loader2, AlertCircle,
} from "lucide-react";

const API = import.meta.env.VITE_API_BASE_URL ?? "";

// ─── Intake type config ───────────────────────────────────────────────────────

type IntakeType = "identity-lineage" | "housing-land" | "healthcare" | "welfare" | "business";

interface IntakeConfig {
  icon: React.ElementType;
  title: string;
  intakeLabel: string;
  subtitle: string;
  opening: string;
  questions: string[];
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
    opening: "It's good to have you here, Family.\n\nI'm Companion. This is a protected conversation for your identity and lineage record. I'll ask you a few focused questions — one at a time — so we can build the right documentation for you.",
    questions: [
      "What is your full legal name as you'd like it recorded in the tribal registry?",
      "Do you have a preferred name or ceremonial name you'd like noted?",
      "What is your tribal nation affiliation and how are you connected to the Mathias El Tribe lineage?",
      "Are you currently enrolled with any tribe, or has your enrollment or identity ever been denied or disputed?",
      "Can you describe any documentation you have — membership cards, family records, birth certificates, or other identity documents?",
      "Are there any other family members whose lineage records we should also note here?",
    ],
    nextPath: "/profile",
    nextLabel: "View My Profile",
  },
  "housing-land": {
    icon: Landmark,
    title: "Housing & Land Protection Intake",
    intakeLabel: "Housing & Land Protection Intake",
    subtitle: "Guided intake for land status, housing concerns, and property protections.",
    opening: "Welcome, Family.\n\nI'm Companion. I'll guide you through a few focused questions about your housing and land situation so this office can identify the right protections and actions for you.",
    questions: [
      "Can you tell me the address or a description of the property you're concerned about?",
      "What is your connection to this property — are you the owner, occupant, heir, or something else?",
      "Do you know the current land status — trust land, fee simple, restricted, or unknown?",
      "Are there any active threats — foreclosure, eviction, tax liens, or code enforcement actions?",
      "Who is the mortgage servicer or lender, if applicable?",
      "Do you have any deed, title, or other property documents you can reference or upload?",
    ],
    nextPath: "/land",
    nextLabel: "View Land Records",
  },
  "healthcare": {
    icon: Stethoscope,
    title: "Healthcare & Benefits Intake",
    intakeLabel: "Healthcare & Benefits Intake",
    subtitle: "Guided intake for IHS eligibility, benefit access, and healthcare rights.",
    opening: "Welcome, Family.\n\nI'm Companion. Your Indian health rights are protected under federal law. I'll walk you through a few questions — one at a time — to document your situation and identify what this office can do for you.",
    questions: [
      "Do you currently receive services through an Indian Health Service (IHS) facility or Urban Indian Health Program?",
      "What is the name of the facility or program, if applicable?",
      "Have you experienced any denial of services, benefit interruptions, or managed care interference?",
      "What specific services were denied or interrupted?",
      "Do you have documentation of your eligibility or any denial notices?",
      "Is this an urgent or ongoing healthcare emergency?",
    ],
    nextPath: "/welfare",
    nextLabel: "Open Welfare Instrument",
    hasFileUpload: true,
  },
  "welfare": {
    icon: ShieldAlert,
    title: "Welfare & Protection Intake",
    intakeLabel: "Welfare & Protection Intake",
    subtitle: "Private, protected conversation for welfare matters, family protection, and emergency concerns.",
    opening: "Welcome, Family.\n\nI'm Companion. This is a protected and private space. What you share here is held in confidence. I'll ask you a few focused questions — one at a time. You are not alone in this.",
    questions: [
      "What kind of situation are you facing today — family, housing, benefits, discrimination, agency misconduct, or an emergency?",
      "Who is affected — yourself, your children, or other family members?",
      "How urgent is this situation?",
      "Are there any agencies or entities involved?",
      "Are there any active court proceedings or legal orders in place?",
      "What do you need most urgently from this office?",
    ],
    nextPath: "/welfare",
    nextLabel: "Generate Welfare Instrument",
  },
  "business": {
    icon: Building2,
    title: "Sovereign Business Formation",
    intakeLabel: "Sovereign Business Formation",
    subtitle: "Companion explores your business idea before we begin the formal formation process.",
    opening: "Welcome, Family.\n\nI'm Companion. Before we begin formal business formation under inherent tribal authority, I'd like to understand your idea. I'll ask you a few focused questions — one at a time.",
    questions: [
      "What kind of business are you thinking about building, and what does it do?",
      "What name are you considering for the business?",
      "Who are your intended customers or the community you'll serve?",
      "Do you have any existing business activity, revenue, or partnerships already in place?",
      "What is your vision for this business in 2–3 years?",
      "Do you have any questions about the sovereign business formation process?",
    ],
    nextPath: "/business-canvas/new",
    nextLabel: "Begin Formal Formation",
  },
};

// ─── Message type ─────────────────────────────────────────────────────────────

type Message =
  | { role: "assistant"; content: string }
  | { role: "user"; content: string };

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

  // stepIndex: which question in config.questions we're on
  // -1 means we're still on the opening message
  const [stepIndex, setStepIndex] = useState(-1);
  const [messages, setMessages] = useState<Message[]>([
    { role: "assistant", content: config.opening },
  ]);
  const [input, setInput] = useState("");
  const [finished, setFinished] = useState(false);
  const [answersCollected, setAnswersCollected] = useState<{ question: string; answer: string }[]>([]);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [savedFields, setSavedFields] = useState<string[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Reset when intake type changes
  useEffect(() => {
    const cfg = INTAKE_CONFIGS[intakeType] ?? INTAKE_CONFIGS["identity-lineage"];
    setMessages([{ role: "assistant", content: cfg.opening }]);
    setInput("");
    setFinished(false);
    setStepIndex(-1);
    setAnswersCollected([]);
    setSaveStatus("idle");
    setSavedFields([]);
  }, [intakeType]);

  // Auto-ask first question after opening
  useEffect(() => {
    if (stepIndex === -1 && messages.length === 1) {
      const timer = setTimeout(() => {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: config.questions[0] },
        ]);
        setStepIndex(0);
      }, 700);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [stepIndex, messages.length, config.questions]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  function handleSend() {
    const userMsg = input.trim();
    if (!userMsg || finished) return;
    setInput("");

    const currentQuestion = stepIndex >= 0 ? config.questions[stepIndex] : "";
    const newAnswers = [...answersCollected, { question: currentQuestion, answer: userMsg }];
    setAnswersCollected(newAnswers);

    const updatedMessages: Message[] = [...messages, { role: "user", content: userMsg }];
    setMessages(updatedMessages);

    const nextStep = stepIndex + 1;
    if (nextStep < config.questions.length) {
      // Ask next question after a brief pause
      setTimeout(() => {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: config.questions[nextStep] },
        ]);
        setStepIndex(nextStep);
      }, 500);
    } else {
      // All questions answered — show summary
      const summary = newAnswers
        .filter((a) => a.question)
        .map((a) => `• ${a.question}\n  ${a.answer}`)
        .join("\n\n");
      setTimeout(async () => {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: `Thank you — I've recorded your answers.\n\nHere's a summary of what we captured:\n\n${summary}\n\nThis intake is complete. Use the button below to continue.`,
          },
        ]);
        sessionStorage.setItem(
          `intake_completed_${intakeType}`,
          JSON.stringify({ completedAt: new Date().toISOString(), summary })
        );
        sessionStorage.setItem(
          "intake_companion_context",
          JSON.stringify({ intakeType, summary, completedAt: new Date().toISOString() })
        );
        setFinished(true);

        // Persist to profile via API
        setSaveStatus("saving");
        try {
          const token = getCurrentBearerToken();
          const res = await fetch(`${API}/api/intake/submit`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            body: JSON.stringify({ intakeType, answers: newAnswers }),
          });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const data = await res.json() as { profileFieldsUpdated?: string[] };
          setSavedFields(data.profileFieldsUpdated ?? []);
          setSaveStatus("saved");
        } catch {
          setSaveStatus("error");
        }
      }, 500);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  const totalSteps = config.questions.length;
  const progress = finished ? totalSteps : Math.max(0, stepIndex);

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

        {/* Step progress */}
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-muted-foreground">
            {finished ? "Complete" : stepIndex < 0 ? "Starting…" : `Step ${Math.min(progress + 1, totalSteps)} of ${totalSteps}`}
          </span>
          <div className="flex gap-0.5">
            {config.questions.map((_, i) => (
              <div
                key={i}
                className="w-1.5 h-1.5 rounded-full transition-colors"
                style={{
                  background: i < progress || finished
                    ? "hsl(var(--primary))"
                    : i === stepIndex && !finished
                    ? "hsl(var(--primary) / 0.5)"
                    : "hsl(var(--border))",
                }}
              />
            ))}
          </div>
        </div>
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
            <div
              className={`max-w-[78%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap shadow-sm ${
                msg.role === "user"
                  ? "bg-primary text-primary-foreground rounded-br-sm"
                  : "bg-card border border-border text-card-foreground rounded-bl-sm"
              }`}
            >
              {msg.content}
            </div>
          </div>
        ))}

        {/* Completion card */}
        {finished && (
          <div className="bg-card border border-border rounded-2xl p-5 space-y-3 shadow-sm">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-500" />
              <p className="text-sm font-semibold text-foreground">Intake complete.</p>
            </div>

            {/* Save status indicator */}
            {saveStatus === "saving" && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
                <span>Saving to your profile…</span>
              </div>
            )}
            {saveStatus === "saved" && (
              <div className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 space-y-1">
                <div className="flex items-center gap-1.5">
                  <CheckCircle className="w-3.5 h-3.5 text-green-600 shrink-0" />
                  <p className="text-xs font-semibold text-green-800">Record saved to your profile.</p>
                </div>
                {savedFields.length > 0 && (
                  <p className="text-[10px] text-green-700 leading-snug pl-5">
                    Updated: {savedFields.map((f) => {
                      if (f === "legalName") return "legal name";
                      if (f === "preferredName") return "preferred name";
                      if (f === "tribalName") return "tribal affiliation";
                      if (f === "mailingAddress") return "property address";
                      if (f === "landStatus") return "land status";
                      return f;
                    }).join(", ")}
                  </p>
                )}
              </div>
            )}
            {saveStatus === "error" && (
              <div className="flex items-center gap-2 text-xs text-amber-700 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>Could not save to your profile automatically. Your answers are still recorded locally.</span>
              </div>
            )}
            {saveStatus === "idle" && (
              <p className="text-xs text-muted-foreground leading-relaxed">
                Your information has been captured and will be reviewed by the Office of the Chief Justice and Trustee.
              </p>
            )}

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
                className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground border border-border rounded-lg px-3 py-1.5 hover:bg-muted/50 transition-colors"
                onClick={() => navigate(`${base}/hub`)}
              >
                Return to Hub
              </button>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input area — hidden once finished */}
      {!finished && (
        <div className="px-5 py-4 border-t border-border bg-card/80 backdrop-blur-sm shrink-0">
          <div className="flex gap-3 items-end">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Your answer…"
              rows={2}
              spellCheck={false}
              autoCorrect="off"
              autoCapitalize="off"
              disabled={stepIndex < 0}
              className="flex-1 resize-none rounded-xl border border-input bg-background px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 placeholder:text-muted-foreground/50 leading-relaxed disabled:opacity-40"
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || stepIndex < 0}
              className="p-3 bg-primary text-primary-foreground rounded-xl hover:opacity-90 transition-opacity disabled:opacity-40 shrink-0"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
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
