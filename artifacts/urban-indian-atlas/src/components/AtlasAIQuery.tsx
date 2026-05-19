import { useState } from "react";
import { Sparkles, Send, X, ChevronDown, ChevronUp } from "lucide-react";
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
          Describe what you want to see — ancestors during a specific era, policy event, or
          reclassification risk.
        </p>
      )}

      <div className="flex gap-1.5">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submitQuery(query)}
          placeholder={placeholder}
          className="flex-1 text-xs bg-background/60 border border-border/60 rounded-md px-2.5 py-1.5 outline-none focus:border-amber-400/70 placeholder:text-muted-foreground/40 min-w-0 transition-colors"
          disabled={loading}
        />
        <Button
          size="sm"
          variant="outline"
          className="h-7 w-7 p-0 flex-none border-amber-300/60 text-amber-600 hover:bg-amber-50 hover:text-amber-800 hover:border-amber-400/60 transition-colors"
          onClick={() => submitQuery(query)}
          disabled={loading || !query.trim()}
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
                disabled={loading}
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
