import { useState, useRef, useEffect } from "react";
import { Sparkles, Send, X, ChevronDown, ChevronUp, Mic, MicOff } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface AIQueryResult {
  message: string;
  exposureFilters: string[];
  activeEras: string[];
  yearRange: [number, number] | null;
}

interface AtlasAIQueryProps {
  onApplyFilters: (result: AIQueryResult) => void;
  onClear: () => void;
  activeMessage: string | null;
  isAuthenticated: boolean;
  ancestorCount: number;
}

const PRESET_QUERIES: { label: string; query: string }[] = [
  {
    label: "Racial reclassification",
    query: "Show ancestors who may have been racially reclassified or had their Native identity erased",
  },
  {
    label: "Removal era",
    query: "Show ancestors who lived during the Indian Removal era",
  },
  {
    label: "Boarding schools",
    query: "Show ancestors alive when federal boarding schools were operating",
  },
  {
    label: "Urban relocation",
    query: "Show ancestors affected by the federal urban relocation program",
  },
  {
    label: "Allotment era",
    query: "Show ancestors alive during the Dawes Act allotment period",
  },
  {
    label: "Termination era",
    query: "Show ancestors alive during federal termination policy",
  },
  {
    label: "Land displacement",
    query: "Show ancestors who may have experienced land seizure or forced removal",
  },
  {
    label: "Ancestors in census records",
    query: "Show ancestors who may appear in federal census records",
  },
];

// Web Speech API type shim — only available in Chrome/Edge/Safari
interface SpeechRecognitionEvent extends Event {
  results: { [index: number]: { [index: number]: { transcript: string } } };
}
interface SpeechRecognitionInstance extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  onresult: ((e: SpeechRecognitionEvent) => void) | null;
  onerror: ((e: Event) => void) | null;
  onend: (() => void) | null;
}

function getSpeechRecognition(): (new () => SpeechRecognitionInstance) | null {
  if (typeof window === "undefined") return null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const w = window as any;
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function AtlasAIQuery({
  onApplyFilters,
  onClear,
  activeMessage,
  isAuthenticated,
  ancestorCount,
}: AtlasAIQueryProps) {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPresets, setShowPresets] = useState(true);
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const speechSupported = useRef(!!getSpeechRecognition());

  // Clean up speech recognition on unmount
  useEffect(() => {
    return () => {
      recognitionRef.current?.stop();
    };
  }, []);

  const startListening = () => {
    const SpeechRecognition = getSpeechRecognition();
    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = "en-US";

    recognition.onresult = (e: SpeechRecognitionEvent) => {
      const transcript = e.results[0][0].transcript;
      setQuery(transcript);
      setListening(false);
      // Auto-submit after voice input
      submitQuery(transcript);
    };

    recognition.onerror = () => {
      setListening(false);
      setError("Voice input failed — try typing instead.");
    };

    recognition.onend = () => {
      setListening(false);
    };

    recognitionRef.current = recognition;
    recognition.start();
    setListening(true);
    setError(null);
  };

  const stopListening = () => {
    recognitionRef.current?.stop();
    setListening(false);
  };

  const submitQuery = async (q: string) => {
    const trimmed = q.trim();
    if (!trimmed || loading) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/atlas/ai-query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: trimmed }),
      });
      if (!res.ok) throw new Error("Query failed");
      const data = (await res.json()) as AIQueryResult;
      onApplyFilters(data);
      setQuery("");
      setShowPresets(false);
    } catch {
      setError("Could not process query — please try again.");
    } finally {
      setLoading(false);
    }
  };

  const placeholder =
    isAuthenticated && ancestorCount > 0
      ? "Ask about your ancestors…"
      : "Ask about a historical era or event…";

  return (
    <div className="space-y-2.5">
      <div className="flex items-center gap-1.5">
        <Sparkles className="w-3.5 h-3.5 text-amber-600" />
        <span className="text-xs font-semibold text-amber-700 dark:text-amber-500 tracking-wide">
          Ask the Atlas
        </span>
        {speechSupported.current && (
          <span className="ml-auto text-[9px] text-muted-foreground/40 flex items-center gap-0.5">
            <Mic className="w-2.5 h-2.5" /> voice enabled
          </span>
        )}
      </div>

      {activeMessage ? (
        <div className="bg-amber-50/70 border border-amber-200/70 rounded-lg px-3 py-2.5 relative">
          <p className="text-[11px] text-amber-900 leading-relaxed pr-5">{activeMessage}</p>
          <button
            onClick={onClear}
            className="absolute top-2 right-2 text-amber-400 hover:text-amber-700 transition-colors"
            title="Clear AI filters and reset map"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ) : (
        <p className="text-[10px] text-muted-foreground/60 leading-snug">
          Type or speak a question — ancestors during a specific era, racial reclassification risk, land displacement, and more.
        </p>
      )}

      {/* Listening indicator */}
      {listening && (
        <div className="flex items-center gap-2 px-2.5 py-1.5 bg-red-50 border border-red-200/60 rounded-md">
          <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
          <span className="text-[11px] text-red-700 font-medium">Listening… speak your question</span>
        </div>
      )}

      <div className="flex gap-1.5">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submitQuery(query)}
          placeholder={listening ? "Listening…" : placeholder}
          className="flex-1 text-xs bg-background/60 border border-border/60 rounded-md px-2.5 py-1.5 outline-none focus:border-amber-400/70 placeholder:text-muted-foreground/40 min-w-0 transition-colors"
          disabled={loading || listening}
        />

        {/* Voice button — shown when speech is supported */}
        {speechSupported.current && (
          <Button
            size="sm"
            variant="outline"
            className={`h-7 w-7 p-0 flex-none transition-colors ${
              listening
                ? "border-red-400 text-red-600 bg-red-50 hover:bg-red-100 animate-pulse"
                : "border-border/60 text-muted-foreground hover:text-amber-700 hover:border-amber-300/60"
            }`}
            onClick={listening ? stopListening : startListening}
            disabled={loading}
            title={listening ? "Stop listening" : "Speak your question"}
          >
            {listening ? <MicOff className="w-3 h-3" /> : <Mic className="w-3 h-3" />}
          </Button>
        )}

        {/* Send button */}
        <Button
          size="sm"
          variant="outline"
          className="h-7 w-7 p-0 flex-none border-amber-300/60 text-amber-600 hover:bg-amber-50 hover:text-amber-800 hover:border-amber-400/60 transition-colors"
          onClick={() => submitQuery(query)}
          disabled={loading || !query.trim() || listening}
          title="Ask the Atlas"
        >
          {loading ? (
            <div className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" />
          ) : (
            <Send className="w-3 h-3" />
          )}
        </Button>
      </div>

      {error && <p className="text-[10px] text-destructive">{error}</p>}

      <div>
        <button
          onClick={() => setShowPresets((v) => !v)}
          className="flex items-center gap-1 text-[10px] text-muted-foreground/50 hover:text-muted-foreground transition-colors mb-1.5"
        >
          {showPresets ? (
            <ChevronUp className="w-2.5 h-2.5" />
          ) : (
            <ChevronDown className="w-2.5 h-2.5" />
          )}
          Quick questions
        </button>
        {showPresets && (
          <div className="flex flex-wrap gap-1">
            {PRESET_QUERIES.map((p) => (
              <button
                key={p.label}
                onClick={() => submitQuery(p.query)}
                disabled={loading || listening}
                className="text-[10px] px-2 py-0.5 rounded-full bg-muted/40 hover:bg-amber-100 hover:text-amber-800 text-muted-foreground border border-border/30 hover:border-amber-300/60 transition-colors disabled:opacity-50"
              >
                {p.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
