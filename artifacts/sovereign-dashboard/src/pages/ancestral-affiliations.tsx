import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { getCurrentBearerToken } from "@/components/auth-provider";
import {
  ArrowLeft, MapPin, Calendar, Shield, ChevronDown, ChevronRight,
  Loader2, AlertCircle, CheckCircle, Info, ScrollText, Zap, Users, BookOpen,
  Globe, ExternalLink,
} from "lucide-react";

const API = import.meta.env.VITE_API_BASE_URL ?? "";

// ─── Types ────────────────────────────────────────────────────────────────────

interface AffiliationMatch {
  tribalNation: string;
  confidence: "confirmed" | "high" | "moderate" | "inferred";
  basis: string;
  activeEra: string;
  removalImpact: string | null;
  treaties: string[];
  survivingCommunity: string | null;
}

interface RemovalContext {
  event: string;
  year: number | string;
  federalBasis: string;
  impact: string;
  affectedNations: string[];
  originRegion: string;
  destinationRegion: string;
}

interface TribalAffiliationResult {
  ancestorId: number;
  fullName: string;
  detectedState: string | null;
  detectedRegion: string | null;
  lifespan: { birth: number | null; death: number | null; estimated: boolean };
  era: string;
  affiliations: AffiliationMatch[];
  removalContext: RemovalContext[];
  reasoning: string[];
  logicSummary: string;
  recommendations: string[];
  confidence: "confirmed" | "high" | "moderate" | "inferred";
  dataSignals: string[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

const CONFIDENCE_CONFIG: Record<string, { label: string; color: string; bg: string; border: string }> = {
  confirmed: { label: "Confirmed", color: "text-emerald-700", bg: "bg-emerald-50", border: "border-emerald-200" },
  high:      { label: "High",      color: "text-sky-700",     bg: "bg-sky-50",     border: "border-sky-200"     },
  moderate:  { label: "Moderate",  color: "text-amber-700",   bg: "bg-amber-50",   border: "border-amber-200"   },
  inferred:  { label: "Inferred",  color: "text-muted-foreground", bg: "bg-muted", border: "border-border"       },
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function ConfidenceBadge({ confidence }: { confidence: string }) {
  const cfg = CONFIDENCE_CONFIG[confidence] ?? CONFIDENCE_CONFIG.inferred;
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${cfg.color} ${cfg.bg} ${cfg.border}`}>
      {confidence === "confirmed" && <CheckCircle className="w-2.5 h-2.5" />}
      {confidence === "high" && <Shield className="w-2.5 h-2.5" />}
      {confidence === "moderate" && <Info className="w-2.5 h-2.5" />}
      {confidence === "inferred" && <Zap className="w-2.5 h-2.5" />}
      {cfg.label}
    </span>
  );
}

function AffiliationCard({ affil }: { affil: AffiliationMatch }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <button
        className="w-full flex items-start justify-between px-4 py-3 text-left hover:bg-muted/40 transition-colors"
        onClick={() => setExpanded(v => !v)}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold text-foreground">{affil.tribalNation}</p>
            <ConfidenceBadge confidence={affil.confidence} />
          </div>
          <p className="text-xs text-muted-foreground mt-0.5 truncate">{affil.activeEra}</p>
        </div>
        {expanded ? <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" /> : <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />}
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-3 border-t border-border pt-3">
          <p className="text-xs text-muted-foreground leading-relaxed">{affil.basis}</p>

          {affil.removalImpact && (
            <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2">
              <p className="text-[10px] font-semibold text-amber-700 uppercase tracking-wide mb-1 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" /> Removal Impact
              </p>
              <p className="text-xs text-amber-900 leading-relaxed">{affil.removalImpact}</p>
            </div>
          )}

          {affil.treaties.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1 flex items-center gap-1">
                <ScrollText className="w-3 h-3" /> Key Treaties
              </p>
              <div className="space-y-0.5">
                {affil.treaties.map((t, i) => (
                  <p key={i} className="text-xs text-foreground/80">{t}</p>
                ))}
              </div>
            </div>
          )}

          {affil.survivingCommunity && (
            <div className="rounded-lg bg-primary/5 border border-primary/20 px-3 py-2">
              <p className="text-[10px] font-semibold text-primary uppercase tracking-wide mb-1 flex items-center gap-1">
                <Users className="w-3 h-3" /> Today's Surviving Community
              </p>
              <p className="text-xs text-foreground/80 leading-relaxed">{affil.survivingCommunity}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function RemovalCard({ rc }: { rc: RemovalContext }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <button
        className="w-full flex items-start justify-between px-4 py-3 text-left hover:bg-muted/40 transition-colors"
        onClick={() => setExpanded(v => !v)}
      >
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground">{rc.event}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{rc.year} · {rc.originRegion}</p>
        </div>
        {expanded ? <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" /> : <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />}
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-2 border-t border-border pt-3">
          <p className="text-xs text-muted-foreground leading-relaxed">{rc.impact}</p>
          <div className="flex items-start gap-1.5 text-xs text-muted-foreground">
            <Globe className="w-3 h-3 mt-0.5 shrink-0" />
            <span>{rc.originRegion} → {rc.destinationRegion}</span>
          </div>
          <p className="text-[10px] text-muted-foreground border-t border-border pt-2">
            Federal basis: {rc.federalBasis}
          </p>
        </div>
      )}
    </div>
  );
}

function AncestorResultCard({ result }: { result: TribalAffiliationResult }) {
  const [open, setOpen] = useState(false);

  const hasData = result.affiliations.length > 0 || result.removalContext.length > 0;
  const cfg = CONFIDENCE_CONFIG[result.confidence] ?? CONFIDENCE_CONFIG.inferred;

  return (
    <div className={`rounded-2xl border bg-card shadow-sm overflow-hidden transition-all ${open ? "border-primary/30" : "border-border"}`}>
      {/* Header */}
      <button
        className="w-full flex items-start gap-3 px-5 py-4 text-left hover:bg-muted/30 transition-colors"
        onClick={() => setOpen(v => !v)}
      >
        <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${cfg.bg} border ${cfg.border}`}>
          <Users className={`w-4 h-4 ${cfg.color}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-bold text-foreground">{result.fullName}</p>
            <ConfidenceBadge confidence={result.confidence} />
            {!hasData && (
              <span className="text-[10px] text-muted-foreground bg-muted rounded-full px-2 py-0.5">Needs location data</span>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            {[
              result.lifespan.birth || result.lifespan.death
                ? `${result.lifespan.birth ?? "?"}–${result.lifespan.death ?? "?"}`
                : null,
              result.detectedState
                ? result.detectedState.replace(/\b\w/g, c => c.toUpperCase())
                : null,
              result.era,
            ].filter(Boolean).join(" · ")}
          </p>
          {result.affiliations.length > 0 && (
            <p className="text-xs text-primary/80 mt-1 truncate">
              {result.affiliations.map(a => a.tribalNation).join(", ")}
            </p>
          )}
        </div>
        {open ? <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0 mt-1" /> : <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0 mt-1" />}
      </button>

      {open && (
        <div className="border-t border-border px-5 py-4 space-y-5">
          {/* Logic summary */}
          <div className="rounded-xl bg-primary/5 border border-primary/20 px-4 py-3">
            <p className="text-[10px] font-semibold text-primary uppercase tracking-wide mb-1.5 flex items-center gap-1">
              <Zap className="w-3 h-3" /> Logic Summary
            </p>
            <p className="text-xs text-foreground/90 leading-relaxed">{result.logicSummary}</p>
          </div>

          {/* Data signals */}
          {result.dataSignals.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1">
                <Info className="w-3 h-3" /> Data Signals Used
              </p>
              <div className="flex flex-wrap gap-1.5">
                {result.dataSignals.map((s, i) => (
                  <span key={i} className="text-[10px] bg-muted border border-border rounded-full px-2 py-0.5 text-muted-foreground">
                    {s}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Tribal affiliations */}
          {result.affiliations.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1">
                <Shield className="w-3 h-3" /> Tribal Affiliations ({result.affiliations.length})
              </p>
              <div className="space-y-2">
                {result.affiliations.map((a, i) => <AffiliationCard key={i} affil={a} />)}
              </div>
            </div>
          )}

          {/* Removal context */}
          {result.removalContext.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1">
                <AlertCircle className="w-3 h-3 text-amber-500" /> Federal Removal Events ({result.removalContext.length})
              </p>
              <div className="space-y-2">
                {result.removalContext.map((rc, i) => <RemovalCard key={i} rc={rc} />)}
              </div>
            </div>
          )}

          {/* Reasoning chain */}
          {result.reasoning.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1">
                <BookOpen className="w-3 h-3" /> Logic Chain
              </p>
              <ol className="space-y-2">
                {result.reasoning.map((r, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground leading-relaxed">
                    <span className="font-bold text-primary shrink-0 mt-0.5">{i + 1}.</span>
                    <span>{r}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}

          {/* Recommendations */}
          {result.recommendations.length > 0 && (
            <div className="rounded-xl border border-border bg-muted/30 px-4 py-3 space-y-1.5">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1 flex items-center gap-1">
                <ExternalLink className="w-3 h-3" /> Research Recommendations
              </p>
              {result.recommendations.map((r, i) => (
                <p key={i} className="text-xs text-muted-foreground leading-relaxed">• {r}</p>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AncestralAffiliationsPage() {
  const [, navigate] = useLocation();

  const { data: results, isLoading, error } = useQuery<TribalAffiliationResult[]>({
    queryKey: ["ancestral-affiliations"],
    queryFn: async () => {
      const token = getCurrentBearerToken();
      const res = await fetch(`${API}/api/ancestors/affiliations`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json() as Promise<TribalAffiliationResult[]>;
    },
  });

  const confirmedCount = results?.filter(r => r.confidence === "confirmed").length ?? 0;
  const highCount = results?.filter(r => r.confidence === "high").length ?? 0;
  const totalWithAffil = results?.filter(r => r.affiliations.length > 0).length ?? 0;
  const needsData = results?.filter(r => r.affiliations.length === 0).length ?? 0;

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate("/hub")}
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div>
          <h1 className="text-lg font-bold text-foreground">Ancestral Tribal Affiliations</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Logic engine — geographic, temporal, and federal law analysis
          </p>
        </div>
      </div>

      {/* Engine description */}
      <div className="rounded-2xl border border-border bg-card px-5 py-4 space-y-2">
        <p className="text-[10px] font-semibold text-primary uppercase tracking-wide flex items-center gap-1">
          <Zap className="w-3 h-3" /> How this works
        </p>
        <p className="text-xs text-muted-foreground leading-relaxed">
          For each ancestor in your records, the engine reads their location, lifespan, and any tribal nation you've recorded.
          It then cross-references a knowledge base of historical tribal territories — keyed by US state and era — applies the
          relevant federal Indian law events (removal acts, treaties, allotment) that overlapped their lifetime, and produces
          a structured reasoning chain explaining <strong className="text-foreground">which nations, why, and what happened to them.</strong>
        </p>
        <p className="text-xs text-muted-foreground leading-relaxed">
          This is <em>inferential</em> analysis — not a legal determination. All connections require documentary confirmation
          (Dawes Rolls, federal census, church records). The goal is to surface what the historical record <em>suggests</em>
          so you can pursue the right documents.
        </p>
        <div className="flex flex-wrap gap-3 pt-1 text-xs text-muted-foreground">
          <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> Territorial overlap</span>
          <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> Lifespan matching</span>
          <span className="flex items-center gap-1"><ScrollText className="w-3 h-3" /> Treaty cessions</span>
          <span className="flex items-center gap-1"><Globe className="w-3 h-3" /> Removal corridors</span>
        </div>
      </div>

      {/* Stats bar */}
      {results && results.length > 0 && (
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: "Ancestors", value: results.length, icon: Users },
            { label: "With affiliations", value: totalWithAffil, icon: Shield },
            { label: "Confirmed", value: confirmedCount, icon: CheckCircle },
            { label: "Needs data", value: needsData, icon: AlertCircle },
          ].map(({ label, value, icon: Icon }) => (
            <div key={label} className="rounded-xl border border-border bg-card px-3 py-2.5 text-center">
              <Icon className="w-4 h-4 text-primary mx-auto mb-1" />
              <p className="text-base font-bold text-foreground">{value}</p>
              <p className="text-[10px] text-muted-foreground">{label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Note about improving results */}
      {needsData > 0 && (
        <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3">
          <p className="text-xs text-amber-800 leading-relaxed">
            <strong>{needsData} ancestor{needsData === 1 ? "" : "s"}</strong> {needsData === 1 ? "has" : "have"} no location or tribal nation recorded.
            Add a location address or tribal nation name to their record in the{" "}
            <button onClick={() => navigate("/family-tree")} className="underline font-semibold">family tree</button>
            {" "}or{" "}
            <button onClick={() => navigate("/intake-companion?type=identity-lineage")} className="underline font-semibold">lineage intake</button>
            {" "}to unlock analysis.
          </p>
        </div>
      )}

      {/* Results */}
      {isLoading && (
        <div className="flex items-center justify-center gap-2 py-12 text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span className="text-sm">Running affiliation analysis…</span>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 text-red-600 py-4">
          <AlertCircle className="w-4 h-4" />
          <span className="text-sm">Could not load affiliations. Please try again.</span>
        </div>
      )}

      {results && results.length === 0 && (
        <div className="rounded-2xl border border-border bg-card px-5 py-8 text-center space-y-2">
          <Users className="w-8 h-8 text-muted-foreground mx-auto" />
          <p className="text-sm font-semibold text-foreground">No ancestors on record yet</p>
          <p className="text-xs text-muted-foreground">
            Add deceased family members through the lineage intake or family tree — then come back here to run the affiliation analysis.
          </p>
          <button
            onClick={() => navigate("/intake-companion?type=identity-lineage")}
            className="mt-2 text-xs text-primary underline"
          >
            Start lineage intake →
          </button>
        </div>
      )}

      {results && results.length > 0 && (
        <div className="space-y-3">
          {/* Confirmed / high confidence first */}
          {results
            .slice()
            .sort((a, b) => {
              const order = { confirmed: 0, high: 1, moderate: 2, inferred: 3 };
              return (order[a.confidence] ?? 4) - (order[b.confidence] ?? 4);
            })
            .map(r => (
              <AncestorResultCard key={r.ancestorId} result={r} />
            ))}
        </div>
      )}

      {/* High-confidence summary if there are results with strong matches */}
      {(confirmedCount > 0 || highCount > 0) && (
        <div className="rounded-2xl border border-primary/20 bg-primary/5 px-5 py-4">
          <p className="text-xs font-semibold text-primary mb-1">Next step for strong matches</p>
          <p className="text-xs text-muted-foreground leading-relaxed">
            {confirmedCount + highCount} ancestor{confirmedCount + highCount === 1 ? "" : "s"} {confirmedCount + highCount === 1 ? "has" : "have"} confirmed or high-confidence
            tribal affiliations. These records can support a formal membership inquiry, ICWA standing documentation, or federal
            trust benefit eligibility research. Submit the analysis to the Tribal Records Committee for review.
          </p>
        </div>
      )}
    </div>
  );
}
