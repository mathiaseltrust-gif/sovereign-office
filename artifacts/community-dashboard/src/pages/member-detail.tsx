import React, { useState, useMemo, lazy, Suspense } from "react";
const MapPickerModal = lazy(() =>
  import("@/components/map-picker-modal").then((m) => ({ default: m.MapPickerModal }))
);
import { geocodeText } from "@/lib/geocode";
import { hierarchy, tree } from "d3-hierarchy";
import { useParams, Link } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { 
  useGetCommunityMember, 
  getGetCommunityMemberQueryKey 
} from "@workspace/api-client-react";
import { 
  ArrowLeft, 
  Calendar, 
  Shield, 
  FileText, 
  Users, 
  Network,
  Info,
  Fingerprint,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  BookOpen,
  Eye,
  MapPin,
  Layers,
  Globe2,
  ExternalLink,
  CheckCircle2,
  X,
  Pencil,
  Save,
  Camera,
  Landmark,
  TreePine,
  ScrollText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { getSovereignSession, COMMUNITY_TOKEN_KEY } from "@/lib/utils";

// ─── Ancestor Location Editor ──────────────────────────────────────────────────

function getCommunityToken(): string | null {
  try {
    const raw = localStorage.getItem("sovereign_auth_v3");
    if (raw) {
      const s = JSON.parse(raw) as { sessionToken?: string };
      if (s.sessionToken) return s.sessionToken;
    }
  } catch { /* ignore */ }
  try {
    const t = localStorage.getItem(COMMUNITY_TOKEN_KEY);
    if (t) return t;
  } catch { /* ignore */ }
  return null;
}

interface AncestorLocationEditorProps {
  memberId: number;
  isDeceased: boolean;
  isAncestor: boolean;
  currentLat: number | null;
  currentLng: number | null;
  currentAddress: string | null;
  tribalNation?: string | null;
  locationText?: string | null;
  onSaved: (lat: number | null, lng: number | null, address: string | null) => void;
}

function AncestorLocationEditor({ memberId, isDeceased, isAncestor, currentLat, currentLng, currentAddress, tribalNation, locationText, onSaved }: AncestorLocationEditorProps) {
  const { toast } = useToast();
  const [showMapPicker, setShowMapPicker] = useState(false);
  const [saving, setSaving] = useState(false);

  if (!isDeceased && !isAncestor) return null;

  const hasCoords = currentLat != null && currentLng != null;

  // Infer a starting coordinate for the map picker when no verified coords are
  // stored yet. First try the tribal nation keyword; if that yields nothing,
  // fall back to the most recent ancestral timeline location text.
  // Track which source produced the coordinate so we can show the user why
  // the map opened at that position.
  const { inferredCoord, inferredFromTimeline } = (() => {
    if (hasCoords) return { inferredCoord: null as [number, number] | null, inferredFromTimeline: false };
    if (tribalNation) {
      const coord = geocodeText(tribalNation);
      if (coord) return { inferredCoord: coord, inferredFromTimeline: false };
    }
    if (locationText) {
      const coord = geocodeText(locationText);
      if (coord) return { inferredCoord: coord, inferredFromTimeline: true };
    }
    return { inferredCoord: null as [number, number] | null, inferredFromTimeline: false };
  })();

  const handleMapConfirm = async (lat: number, lng: number, address: string) => {
    const token = getCommunityToken();
    if (!token) {
      toast({ title: "Not authenticated", description: "You must be signed in to update ancestor locations.", variant: "destructive" });
      return;
    }
    setSaving(true);
    setShowMapPicker(false);
    try {
      const r = await fetch(`/api/ancestors/${memberId}/location`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ lat, lng, address: address || null }),
      });
      if (!r.ok) {
        const err = await r.json().catch(() => ({})) as { error?: string };
        throw new Error(err.error ?? "Failed to save location");
      }
      onSaved(lat, lng, address || null);
      toast({ title: "Location saved", description: address ? `Saved: ${address}` : "Verified coordinates stored for this ancestor." });
    } catch (e) {
      toast({ title: "Save failed", description: (e as Error).message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleClear = async () => {
    const token = getCommunityToken();
    if (!token) return;
    setSaving(true);
    try {
      const r = await fetch(`/api/ancestors/${memberId}/location`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ lat: null, lng: null }),
      });
      if (!r.ok) {
        const err = await r.json().catch(() => ({})) as { error?: string };
        throw new Error(err.error ?? "Failed to clear location");
      }
      onSaved(null, null, null);
      toast({ title: "Location cleared", description: "Verified coordinates removed. The Atlas will use inferred placement." });
    } catch (e) {
      toast({ title: "Failed to clear", description: (e as Error).message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      {showMapPicker && (
        <Suspense fallback={null}>
          <MapPickerModal
            initialLat={currentLat}
            initialLng={currentLng}
            initialAddress={currentAddress}
            initialInferredCoord={inferredCoord}
            inferredFromText={inferredFromTimeline ? (locationText ?? null) : null}
            onConfirm={handleMapConfirm}
            onCancel={() => setShowMapPicker(false)}
          />
        </Suspense>
      )}
    <Card className="overflow-hidden">
      <CardHeader className="bg-emerald-50 dark:bg-emerald-950/20 border-b border-emerald-200 dark:border-emerald-800/30 pb-3 pt-4 px-5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            <CardTitle className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">Verified Ancestor Location</CardTitle>
            {hasCoords && (
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700 px-1.5 py-0.5 rounded-full">
                <CheckCircle2 className="w-2.5 h-2.5" /> Set
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            <Button
              size="sm"
              variant="ghost"
              className="h-7 text-xs gap-1 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/30"
              onClick={() => setShowMapPicker(true)}
              disabled={saving}
            >
              <Pencil className="w-3 h-3" />
              {hasCoords ? "Edit on Map" : "Add Location"}
            </Button>
            {hasCoords && (
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-xs gap-1 text-destructive hover:bg-destructive/10"
                onClick={handleClear}
                disabled={saving}
              >
                <X className="w-3 h-3" /> Clear
              </Button>
            )}
          </div>
        </div>
        {hasCoords ? (
          <div className="mt-1 space-y-0.5">
            {currentAddress && (
              <p className="text-xs font-medium text-foreground">{currentAddress}</p>
            )}
            <p className="text-[10px] font-mono text-muted-foreground">
              {currentLat?.toFixed(5)}, {currentLng?.toFixed(5)} — solid green pin on the Atlas
            </p>
          </div>
        ) : (
          <div className="mt-1 space-y-1">
            <p className="text-xs text-muted-foreground">
              Pick a place on the map or search by name. The county and city will be recorded alongside the exact coordinates.
            </p>
            {inferredFromTimeline && locationText && (
              <p className="text-[10px] text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/40 rounded px-2 py-1">
                Map pre-filled from timeline event: <span className="font-medium">{locationText}</span>
              </p>
            )}
          </div>
        )}
      </CardHeader>
      {saving && (
        <CardContent className="p-3">
          <p className="text-xs text-muted-foreground animate-pulse">Saving location…</p>
        </CardContent>
      )}
    </Card>
    </>
  );
}

// ─── Exposure Panel ────────────────────────────────────────────────────────────

type ExposureMatch = {
  event_id: number; title: string; short_name: string; category: string;
  year_start: number; year_end: number | null; significance: string;
  description: string; legal_citation: string; impact_types: string[];
  location_match: boolean;
};

// ─── Tribal Affiliation Panel ──────────────────────────────────────────────────

interface AffiliationMatch {
  tribalNation: string;
  confidence: "confirmed" | "high" | "moderate" | "inferred";
  basis: string;
  activeEra: string;
  removalImpact: string | null;
  treaties: string[];
  survivingCommunity: string | null;
}

interface TribalAffiliationResult {
  ancestorId: number;
  fullName: string;
  detectedState: string | null;
  detectedRegion: string | null;
  lifespan: { birth: number | null; death: number | null; estimated: boolean };
  era: string;
  affiliations: AffiliationMatch[];
  removalContext: { event: string; year: number | string; federalBasis: string; impact: string; affectedNations: string[] }[];
  reasoning: string[];
  logicSummary: string;
  recommendations: string[];
  confidence: "confirmed" | "high" | "moderate" | "inferred";
  dataSignals: string[];
}

const CONF_STYLES: Record<string, { bg: string; border: string; text: string; dot: string; label: string }> = {
  confirmed: { bg: "bg-emerald-50 dark:bg-emerald-950/30", border: "border-emerald-300 dark:border-emerald-700", text: "text-emerald-800 dark:text-emerald-300", dot: "bg-emerald-500", label: "Confirmed" },
  high:      { bg: "bg-sky-50 dark:bg-sky-950/30",     border: "border-sky-300 dark:border-sky-700",     text: "text-sky-800 dark:text-sky-300",     dot: "bg-sky-500",     label: "High" },
  moderate:  { bg: "bg-amber-50 dark:bg-amber-950/30", border: "border-amber-300 dark:border-amber-700", text: "text-amber-800 dark:text-amber-300", dot: "bg-amber-400",   label: "Moderate" },
  inferred:  { bg: "bg-muted/40",                      border: "border-border",                          text: "text-muted-foreground",              dot: "bg-gray-400",    label: "Inferred" },
};

function TribalAffiliationPanel({ memberId, isAncestor, isDeceased, birthYear, deathYear }: {
  memberId: number;
  isAncestor?: boolean | null;
  isDeceased?: boolean | null;
  birthYear?: number | null;
  deathYear?: number | null;
}) {
  const [expanded, setExpanded] = useState(false);
  const [showReasoning, setShowReasoning] = useState(false);

  const eligible = isAncestor || isDeceased || !!deathYear || (!!birthYear && (new Date().getFullYear() - (birthYear ?? 9999)) > 80);
  const { data, isLoading } = useQuery<TribalAffiliationResult>({
    queryKey: ["tribal-affiliation", memberId],
    queryFn: async () => {
      const res = await fetch(`/api/ancestors/${memberId}/affiliation-public`);
      if (!res.ok) throw new Error("Not available");
      return res.json() as Promise<TribalAffiliationResult>;
    },
    enabled: eligible,
    retry: false,
  });

  if (!eligible) return null;
  if (!isLoading && !data) return null;
  if (!isLoading && data && data.affiliations.length === 0 && !data.detectedState) return null;

  const topConf = data?.confidence ?? "inferred";
  const confStyle = CONF_STYLES[topConf] ?? CONF_STYLES.inferred;

  return (
    <Card className="overflow-hidden">
      <button onClick={() => setExpanded(x => !x)} className="w-full text-left">
        <CardHeader className="bg-teal-50 dark:bg-teal-950/20 border-b border-teal-200 dark:border-teal-800/30 pb-3 pt-4 px-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 flex-wrap">
              <Landmark className="h-4 w-4 text-teal-600 dark:text-teal-400" />
              <CardTitle className="text-sm font-semibold text-teal-800 dark:text-teal-300">Territory-Based Tribal Affiliation</CardTitle>
              {isLoading && <span className="text-xs text-muted-foreground">Analyzing…</span>}
              {!isLoading && data && data.affiliations.length > 0 && (
                <span className="text-[10px] font-semibold bg-teal-100 dark:bg-teal-900/40 text-teal-700 dark:text-teal-300 border border-teal-300 dark:border-teal-700 px-1.5 py-0.5 rounded-full">
                  {data.affiliations.length} nation{data.affiliations.length !== 1 ? "s" : ""}
                </span>
              )}
              {!isLoading && data && (
                <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full border ${confStyle.bg} ${confStyle.border} ${confStyle.text}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${confStyle.dot}`} />
                  {confStyle.label}
                </span>
              )}
            </div>
            {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
          </div>
          {!expanded && (
            <p className="text-xs text-muted-foreground mt-1">
              Geo-temporal inference: which tribal nations historically occupied this ancestor's documented territory during their lifetime.
            </p>
          )}
        </CardHeader>
      </button>

      {expanded && (
        <CardContent className="p-4 space-y-4">
          {isLoading && (
            <div className="space-y-2">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          )}

          {!isLoading && data && (
            <>
              {/* Location + Era Summary */}
              {(data.detectedState || data.era) && (
                <div className="flex flex-wrap gap-2 text-xs">
                  {data.detectedState && (
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-muted/50 border border-border text-foreground/80">
                      <MapPin className="w-3 h-3 text-teal-500" />
                      {data.detectedState.replace(/\b\w/g, c => c.toUpperCase())}
                    </span>
                  )}
                  {data.era && (
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-muted/50 border border-border text-foreground/80">
                      <Calendar className="w-3 h-3 text-teal-500" />
                      {data.era}
                    </span>
                  )}
                  {data.dataSignals.some(s => s.toLowerCase().includes("descendant")) && (
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-violet-50 dark:bg-violet-950/30 border border-violet-200 dark:border-violet-700 text-violet-700 dark:text-violet-300">
                      <TreePine className="w-3 h-3" />
                      Descendant lineage confirmed
                    </span>
                  )}
                </div>
              )}

              {/* Logic Summary */}
              {data.logicSummary && (
                <p className="text-xs text-foreground/80 leading-relaxed bg-muted/30 border border-border rounded-lg px-3 py-2">
                  {data.logicSummary}
                </p>
              )}

              {/* Affiliations */}
              {data.affiliations.length > 0 && (
                <div className="space-y-2">
                  {data.affiliations.map((aff, i) => {
                    const cs = CONF_STYLES[aff.confidence] ?? CONF_STYLES.inferred;
                    return (
                      <div key={i} className={`rounded-lg border p-3 ${cs.bg} ${cs.border}`}>
                        <div className="flex items-start justify-between gap-2 flex-wrap">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <Shield className={`h-3.5 w-3.5 shrink-0 ${cs.text}`} />
                            <span className={`text-xs font-semibold ${cs.text}`}>{aff.tribalNation}</span>
                            <span className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full border ${cs.bg} ${cs.border}`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${cs.dot}`} />
                              <span className="text-muted-foreground capitalize">{aff.confidence}</span>
                            </span>
                          </div>
                          <span className="text-[10px] text-muted-foreground shrink-0">{aff.activeEra}</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">{aff.basis}</p>
                        {aff.treaties.length > 0 && (
                          <div className="mt-1.5 flex flex-wrap gap-1">
                            {aff.treaties.map((t, ti) => (
                              <span key={ti} className="inline-flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded bg-background/60 border border-border/60 text-muted-foreground">
                                <ScrollText className="w-2.5 h-2.5" /> {t}
                              </span>
                            ))}
                          </div>
                        )}
                        {aff.survivingCommunity && (
                          <p className="text-[10px] text-teal-700 dark:text-teal-400 mt-1.5 font-medium">
                            Today: {aff.survivingCommunity}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Removal context */}
              {data.removalContext.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Federal Removal History (overlapping this lifespan)</p>
                  {data.removalContext.slice(0, 3).map((rc, i) => (
                    <div key={i} className="rounded-md border border-red-200 dark:border-red-800/40 bg-red-50 dark:bg-red-950/20 px-3 py-2">
                      <p className="text-xs font-semibold text-red-700 dark:text-red-300">{rc.event} <span className="font-normal text-muted-foreground">({rc.year})</span></p>
                      <p className="text-[10px] text-muted-foreground mt-0.5 leading-relaxed line-clamp-3">{rc.impact}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* Collapsible reasoning */}
              {data.reasoning.length > 0 && (
                <div>
                  <button
                    onClick={() => setShowReasoning(x => !x)}
                    className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
                  >
                    {showReasoning ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    {showReasoning ? "Hide" : "Show"} analysis reasoning
                  </button>
                  {showReasoning && (
                    <ol className="mt-2 space-y-1.5 list-decimal list-inside">
                      {data.reasoning.map((r, i) => (
                        <li key={i} className="text-[10px] text-muted-foreground leading-relaxed">{r}</li>
                      ))}
                    </ol>
                  )}
                </div>
              )}

              {/* Data signals */}
              {data.dataSignals.length > 0 && (
                <div className="border-t border-border pt-2 flex flex-wrap gap-1">
                  {data.dataSignals.map((sig, i) => (
                    <span key={i} className="text-[9px] bg-muted/40 border border-border px-1.5 py-0.5 rounded text-muted-foreground/70">{sig}</span>
                  ))}
                </div>
              )}

              <p className="text-[10px] text-muted-foreground/60 pt-1">
                Territorial affiliation is determined by geographic and temporal overlap with documented tribal territories and treaty records. This is a research tool — consult BIA records, Dawes Rolls, and census archives for confirmation.
              </p>
            </>
          )}
        </CardContent>
      )}
    </Card>
  );
}

// ─── Historical Exposure Panel ─────────────────────────────────────────────────

const EXP_CAT: Record<string, { color: string; bg: string; border: string; icon: React.ComponentType<{ className?: string }> }> = {
  federal_law:          { color: "text-indigo-600 dark:text-indigo-300", bg: "bg-indigo-50 dark:bg-indigo-950/50", border: "border-indigo-200 dark:border-indigo-700/40", icon: BookOpen },
  racial_classification:{ color: "text-orange-600 dark:text-orange-300", bg: "bg-orange-50 dark:bg-orange-950/50", border: "border-orange-200 dark:border-orange-700/40", icon: Eye },
  removal:              { color: "text-red-600 dark:text-red-300",    bg: "bg-red-50 dark:bg-red-950/50",    border: "border-red-200 dark:border-red-700/40",    icon: AlertTriangle },
  census:               { color: "text-yellow-700 dark:text-yellow-300", bg: "bg-yellow-50 dark:bg-yellow-950/50", border: "border-yellow-200 dark:border-yellow-700/40", icon: FileText },
  allotment:            { color: "text-amber-700 dark:text-amber-300", bg: "bg-amber-50 dark:bg-amber-950/50", border: "border-amber-200 dark:border-amber-700/40", icon: MapPin },
  boarding_school:      { color: "text-rose-600 dark:text-rose-300",  bg: "bg-rose-50 dark:bg-rose-950/50",  border: "border-rose-200 dark:border-rose-700/40",  icon: Shield },
  territory:            { color: "text-teal-600 dark:text-teal-300",  bg: "bg-teal-50 dark:bg-teal-950/50",  border: "border-teal-200 dark:border-teal-700/40",  icon: MapPin },
};
const EXP_FALLBACK = { color: "text-muted-foreground", bg: "bg-muted/30", border: "border-border", icon: Layers };

const SIG_DOT: Record<string, string> = { critical: "bg-red-500", high: "bg-amber-400", moderate: "bg-gray-400" };

function ExposurePanel({ memberId, birthYear, deathYear }: { memberId: number; birthYear?: number | null; deathYear?: number | null }) {
  const [expanded, setExpanded] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const hasYears = birthYear != null || deathYear != null;

  const { data, isLoading } = useQuery<ExposureMatch[]>({
    queryKey: ["community-exposure", memberId],
    queryFn: async () => {
      const res = await fetch(`/api/ancestry/exposure/matches/${memberId}`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: hasYears,
  });

  if (!hasYears) return null;
  const matches = data ?? [];
  if (!isLoading && matches.length === 0) return null;

  const critical = matches.filter(m => m.significance === "critical");
  const visible = showAll ? matches : matches.slice(0, 4);

  return (
    <Card className="overflow-hidden">
      <button
        onClick={() => setExpanded(x => !x)}
        className="w-full text-left"
      >
        <CardHeader className="bg-amber-50 dark:bg-amber-950/20 border-b border-amber-200 dark:border-amber-800/30 pb-3 pt-4 px-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Fingerprint className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              <CardTitle className="text-sm font-semibold text-amber-800 dark:text-amber-300">Historical Exposure Analysis</CardTitle>
              {isLoading && <span className="text-xs text-muted-foreground">Loading…</span>}
              {!isLoading && matches.length > 0 && (
                <span className="text-[10px] font-semibold bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-700 px-1.5 py-0.5 rounded-full">
                  {matches.length} events
                </span>
              )}
              {!isLoading && critical.length > 0 && (
                <span className="text-[10px] font-semibold bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 border border-red-300 dark:border-red-700 px-1.5 py-0.5 rounded-full">
                  {critical.length} critical
                </span>
              )}
            </div>
            {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
          </div>
          {!expanded && (
            <p className="text-xs text-muted-foreground mt-1">
              Historical laws and events this ancestor may have lived through based on their documented lifespan.
            </p>
          )}
        </CardHeader>
      </button>

      {expanded && (
        <CardContent className="p-4 space-y-2">
          {isLoading && (
            <div className="space-y-2">
              <Skeleton className="h-14 w-full" />
              <Skeleton className="h-14 w-full" />
              <Skeleton className="h-14 w-full" />
            </div>
          )}
          {!isLoading && visible.map(ev => {
            const m = EXP_CAT[ev.category] ?? EXP_FALLBACK;
            const Icon = m.icon;
            return (
              <div key={ev.event_id} className={`rounded-lg border p-3 ${m.bg} ${m.border}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <Icon className={`h-3.5 w-3.5 shrink-0 ${m.color}`} />
                    <span className={`text-xs font-semibold ${m.color}`}>{ev.short_name || ev.title}</span>
                    <span className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full border ${SIG_DOT[ev.significance] ? "" : ""}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${SIG_DOT[ev.significance] ?? "bg-gray-400"}`} />
                      <span className="text-muted-foreground capitalize">{ev.significance}</span>
                    </span>
                  </div>
                  <span className="text-[10px] text-muted-foreground shrink-0">
                    {ev.year_start}{ev.year_end && ev.year_end !== ev.year_start ? `–${ev.year_end}` : ""}
                  </span>
                </div>
                {ev.description && (
                  <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed line-clamp-3">{ev.description}</p>
                )}
                {ev.legal_citation && (
                  <p className="text-[10px] text-muted-foreground/50 font-mono mt-1">{ev.legal_citation}</p>
                )}
              </div>
            );
          })}
          {!isLoading && matches.length > 4 && (
            <button
              onClick={() => setShowAll(x => !x)}
              className="w-full text-xs text-muted-foreground hover:text-foreground py-1.5 border border-dashed border-border rounded-lg transition-colors"
            >
              {showAll ? `Show fewer` : `Show ${matches.length - 4} more events`}
            </button>
          )}
          <p className="text-[10px] text-muted-foreground/60 pt-1">
            Exposure is determined by temporal overlap between documented lifespan and historical event date ranges. This is a research tool — consult archival records for confirmation.
          </p>
        </CardContent>
      )}
    </Card>
  );
}

const SEAL_URL = `${import.meta.env.BASE_URL}tribal-seal.png`;

// ─── Tribal ID Card ────────────────────────────────────────────────────────────

function TribalIdCard({ member, locationAddress }: { member: {
  fullName?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  membershipStatus?: string | null;
  tribalNation?: string | null;
  tribalEnrollmentNumber?: string | null;
  birthYear?: number | null;
  icwaEligible?: boolean | null;
  trustBeneficiary?: boolean | null;
  isAncestor?: boolean | null;
  photoFilename?: string | null;
  photoUrl?: string | null;
}; locationAddress?: string | null }) {
  const memberSince = member.birthYear ? `${member.birthYear}` : "—";
  const idNumber = member.tribalEnrollmentNumber || "—";
  const initials = `${member.firstName?.charAt(0) ?? ""}${member.lastName?.charAt(0) ?? ""}`;

  return (
    <Card className="overflow-hidden border-2 border-primary/30 shadow-lg">
      {/* Card header — red band matching seal colors */}
      <div className="bg-[#8B0000] px-5 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img src={SEAL_URL} alt="Mathias El Tribe Seal" className="h-12 w-12 object-contain drop-shadow-md" />
          <div>
            <p className="text-yellow-300 font-bold text-xs tracking-widest uppercase">Mathias El Tribe</p>
            <p className="text-yellow-100/80 text-[10px] tracking-wider uppercase">Official Membership Card</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-yellow-300/70 text-[9px] uppercase tracking-widest">Office of the Chief Justice and Trustee</p>
          <p className="text-yellow-300/70 text-[9px] uppercase tracking-widest">Chief Justice & Trustee</p>
        </div>
      </div>

      {/* Card body */}
      <CardContent className="p-5 bg-gradient-to-br from-card to-muted/30">
        <div className="flex gap-5 items-start">
          {/* Photo */}
          <Avatar className="h-20 w-20 border-2 border-primary/40 shadow shrink-0 rounded-md">
            <AvatarImage src={member.photoUrl || (member.photoFilename ? `/assets/${member.photoFilename}` : "")} className="object-cover" />
            <AvatarFallback className="text-2xl font-bold text-primary bg-primary/10 rounded-md">
              {initials}
            </AvatarFallback>
          </Avatar>

          {/* Info */}
          <div className="flex-1 min-w-0 space-y-2">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Full Legal Name</p>
              <p className="font-bold text-lg leading-tight text-foreground">{member.fullName ?? "—"}</p>
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
              <div>
                <p className="font-semibold uppercase tracking-wider text-muted-foreground text-[9px]">Member ID</p>
                <p className="font-mono font-semibold text-foreground">{idNumber}</p>
              </div>
              <div>
                <p className="font-semibold uppercase tracking-wider text-muted-foreground text-[9px]">Birth Year</p>
                <p className="font-semibold text-foreground">{memberSince}</p>
              </div>
              <div>
                <p className="font-semibold uppercase tracking-wider text-muted-foreground text-[9px]">Tribal Nation</p>
                <p className="font-semibold text-foreground">{member.tribalNation ?? "Mathias El Tribe"}</p>
              </div>
              <div>
                <p className="font-semibold uppercase tracking-wider text-muted-foreground text-[9px]">Status</p>
                <p className="font-semibold text-foreground">{member.membershipStatus ?? "—"}</p>
              </div>
              {locationAddress && (
                <div className="col-span-2">
                  <p className="font-semibold uppercase tracking-wider text-muted-foreground text-[9px]">Verified Location</p>
                  <p className="font-semibold text-foreground flex items-center gap-1">
                    <MapPin className="w-3 h-3 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    {locationAddress}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Privileges row */}
        <div className="mt-4 pt-3 border-t border-primary/10 flex flex-wrap gap-1.5">
          {member.icwaEligible && (
            <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
              ICWA Eligible
            </span>
          )}
          {member.trustBeneficiary && (
            <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300 border border-green-200 dark:border-green-800">
              Trust Beneficiary
            </span>
          )}
          {member.isAncestor && (
            <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
              Ancestor
            </span>
          )}
        </div>

        {/* Card footer bar */}
        <div className="mt-4 pt-3 border-t border-primary/10 flex items-center justify-between">
          <p className="text-[9px] text-muted-foreground uppercase tracking-widest">
            Issued under inherent sovereign authority
          </p>
          <img src={SEAL_URL} alt="" className="h-6 w-6 object-contain opacity-30" />
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Helpers ────────────────────────────────────────────────────────────────────

const CURRENT_YEAR = new Date().getFullYear();
const DECEASED_AGE_THRESHOLD = 95;

function likelyDeceased(birthYear?: number | null): boolean {
  return !!birthYear && (CURRENT_YEAR - birthYear) > DECEASED_AGE_THRESHOLD;
}

/** Parse GEDCOM-enriched notes for birth / death / residence place lines */
function parseGedcomPlaces(notes: string | null | undefined): { label: string; place: string }[] {
  if (!notes) return [];
  const results: { label: string; place: string }[] = [];
  const seen = new Set<string>();
  for (const line of notes.split("\n")) {
    const trimmed = line.trim();
    const birthM = trimmed.match(/^Birth place:\s*(.+)/i);
    const deathM = trimmed.match(/^Death place:\s*(.+)/i);
    const resiM  = trimmed.match(/^Residence place:\s*(.+)/i);
    if (birthM) {
      const p = birthM[1].trim();
      if (p && !seen.has(`b:${p}`)) { results.push({ label: "Birth Place", place: p }); seen.add(`b:${p}`); }
    }
    if (deathM) {
      const p = deathM[1].trim();
      if (p && !seen.has(`d:${p}`)) { results.push({ label: "Death Place", place: p }); seen.add(`d:${p}`); }
    }
    if (resiM) {
      const p = resiM[1].trim();
      if (p && !seen.has(`r:${p}`)) { results.push({ label: "Residence", place: p }); seen.add(`r:${p}`); }
    }
  }
  return results;
}

// ─── Mini Family Tree ──────────────────────────────────────────────────────────

type FamilyPerson = { id: number; fullName?: string | null; firstName?: string | null; lastName?: string | null; birthYear?: number | null; photoFilename?: string | null; photoUrl?: string | null };

function TreeNode({ person, isMain = false }: { person: FamilyPerson; isMain?: boolean }) {
  const initials = `${person.firstName?.charAt(0) ?? ""}${person.lastName?.charAt(0) ?? ""}`;
  const isAncestor = !isMain && likelyDeceased(person.birthYear);
  const cardClass = `flex flex-col items-center gap-1 px-2 py-2 rounded-lg border text-center cursor-pointer transition-colors w-[90px] shrink-0 ${
    isMain
      ? "bg-primary/10 border-primary/40 shadow-sm"
      : isAncestor
        ? "bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800 hover:bg-amber-100 dark:hover:bg-amber-950/40"
        : "bg-muted/40 border-border hover:bg-muted/60 hover:border-primary/30"
  }`;
  const inner = (
    <>
      <Avatar className="h-8 w-8">
        <AvatarImage src={person.photoUrl || (person.photoFilename ? `/assets/${person.photoFilename}` : "")} className="object-cover" />
        <AvatarFallback className={`text-xs font-bold ${isMain ? "bg-primary/20 text-primary" : isAncestor ? "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400" : "bg-muted text-muted-foreground"}`}>{initials}</AvatarFallback>
      </Avatar>
      <span className="text-[10px] font-medium leading-tight line-clamp-2">{person.fullName ?? "—"}</span>
      {person.birthYear && <span className="text-[9px] text-muted-foreground">b. {person.birthYear}</span>}
      {isAncestor && <span className="text-[8px] text-amber-600 dark:text-amber-400 font-semibold">Atlas ↗</span>}
    </>
  );
  if (isAncestor) {
    return (
      <a href={`/atlas/?mode=atlas&person=${person.id}`} target="_blank" rel="noopener noreferrer" className={cardClass}>
        {inner}
      </a>
    );
  }
  return <Link href={`/directory/${person.id}`}><div className={cardClass}>{inner}</div></Link>;
}

// Base URL prefix for the community dashboard (e.g. "/community-dashboard")
const APP_BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

// Node dimensions and spacing
const MT_NW = 88, MT_NH = 64, MT_HGAP = 14, MT_VGAP = 54, MT_PAD = 20;

/** Compute centered x-positions for a flat row of N nodes using d3-hierarchy. */
function d3RowCenters(count: number): number[] {
  if (count === 0) return [];
  type D = { id: number; ch?: { id: number }[] };
  const root = hierarchy<D>(
    { id: -1, ch: Array.from({ length: count }, (_, i) => ({ id: i })) },
    d => d.ch ?? null,
  );
  tree<D>().nodeSize([MT_NW + MT_HGAP, MT_NH + MT_VGAP])(root);
  const xs = (root.children ?? []).map(c => c.x ?? 0);
  const mid = (Math.min(...xs) + Math.max(...xs)) / 2;
  return xs.map(x => x - mid); // center around 0
}

function FamilyMiniTree({ member }: { member: FamilyPerson & { parents?: FamilyPerson[] | null; spouses?: FamilyPerson[] | null; children?: FamilyPerson[] | null; siblings?: FamilyPerson[] | null } }) {
  const parents  = member.parents  ?? [];
  const spouses  = member.spouses  ?? [];
  const children = member.children ?? [];
  const siblings = member.siblings ?? [];
  const hasAny   = parents.length > 0 || spouses.length > 0 || children.length > 0 || siblings.length > 0;

  const parentCx  = useMemo(() => d3RowCenters(parents.length),  [parents.length]);
  const childCx   = useMemo(() => d3RowCenters(children.length), [children.length]);
  // Spouses extend to the right of member; member center = 0
  const spouseCx  = spouses.map((_, i) => (MT_NW + 20) * (i + 1));
  // Siblings extend to the left of member
  const siblingCx = siblings.map((_, i) => -((MT_NW + 20) * (i + 1)));

  const hasParents  = parents.length  > 0;
  const hasChildren = children.length > 0;

  const parentRowY = 0;
  const memberRowY = hasParents  ? MT_NH + MT_VGAP : 0;
  const childRowY  = memberRowY + MT_NH + MT_VGAP;

  // SVG bounds: collect all node centers and compute required width
  const allLeft  = [...parentCx, ...childCx, 0, ...siblingCx].map(x => x - MT_NW / 2);
  const allRight = [...parentCx, ...childCx, 0, ...spouseCx].map(x => x + MT_NW / 2);
  const minRelX  = Math.min(...allLeft)  - MT_PAD;
  const maxRelX  = Math.max(...allRight) + MT_PAD;
  const svgW     = Math.max(maxRelX - minRelX, MT_NW + MT_PAD * 2);
  const svgH     = (hasChildren ? childRowY + MT_NH : memberRowY + MT_NH) + MT_PAD;
  const cx       = -minRelX; // SVG x-coordinate for member center

  // Cubic bezier path between two center points
  const bezier = (x1: number, y1: number, x2: number, y2: number) => {
    const my = (y1 + y2) / 2;
    return `M${x1.toFixed(1)},${y1.toFixed(1)} C${x1.toFixed(1)},${my.toFixed(1)} ${x2.toFixed(1)},${my.toFixed(1)} ${x2.toFixed(1)},${y2.toFixed(1)}`;
  };

  const nodeRect = (nx: number, ny: number, isMain: boolean, isPat?: boolean) => {
    if (isMain)  return <rect x={nx} y={ny} width={MT_NW} height={MT_NH} rx={8} fill="hsl(var(--primary) / 0.10)" stroke="hsl(var(--primary))" strokeWidth={2} />;
    if (isPat)   return <rect x={nx} y={ny} width={MT_NW} height={MT_NH} rx={8} fill="rgb(255 251 235 / 0.8)" stroke="#d97706" strokeWidth={1.5} />;
    return <rect x={nx} y={ny} width={MT_NW} height={MT_NH} rx={8} fill="rgb(240 249 255 / 0.8)" stroke="#7dd3fc" strokeWidth={1.5} />;
  };

  const nodeLabel = (nx: number, ny: number, person: FamilyPerson, isMain: boolean) => {
    const initials = `${person.firstName?.charAt(0) ?? ""}${person.lastName?.charAt(0) ?? ""}`;
    return (
      <>
        <text x={nx + MT_NW / 2} y={ny + 18} textAnchor="middle" fontSize={14} fontWeight="700"
          fill={isMain ? "hsl(var(--primary))" : "#374151"} opacity={isMain ? 0.85 : 0.65}>{initials}</text>
        <foreignObject x={nx + 2} y={ny + 22} width={MT_NW - 4} height={MT_NH - 24}>
          <div style={{ fontSize: 9, textAlign: "center", lineHeight: 1.25, padding: "0 2px", overflow: "hidden" }}>
            <div style={{ fontWeight: isMain ? 700 : 600, marginBottom: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{person.fullName ?? "—"}</div>
            {person.birthYear && <div style={{ opacity: 0.55 }}>b. {person.birthYear}</div>}
          </div>
        </foreignObject>
      </>
    );
  };

  if (!hasAny) return (
    <div className="p-8 text-center text-muted-foreground text-sm">No family connections recorded in the directory.</div>
  );

  return (
    <div className="p-3 overflow-x-auto select-none">
      <svg width={svgW} height={svgH} viewBox={`0 0 ${svgW} ${svgH}`} style={{ display: "block", maxWidth: "100%" }}>

        {/* Parent → Member edges (amber, cubic bezier) */}
        {parents.map((_, i) => (
          <path key={`pe-${i}`}
            d={bezier(cx + parentCx[i], parentRowY + MT_NH, cx, memberRowY)}
            fill="none" stroke="#b45309" strokeWidth={1.5} opacity={0.45} />
        ))}

        {/* Member → Children edges (slate, cubic bezier) */}
        {children.map((_, i) => (
          <path key={`ce-${i}`}
            d={bezier(cx, memberRowY + MT_NH, cx + childCx[i], childRowY)}
            fill="none" stroke="#64748b" strokeWidth={1.5} opacity={0.4} />
        ))}

        {/* Sibling dashed connector */}
        {siblings.length > 0 && (
          <line x1={cx - MT_NW / 2} y1={memberRowY + MT_NH / 2}
            x2={cx + siblingCx[siblings.length - 1] - MT_NW / 2} y2={memberRowY + MT_NH / 2}
            stroke="#a855f7" strokeWidth={1.2} strokeDasharray="4 3" opacity={0.45} />
        )}

        {/* Spouse dashed connector */}
        {spouses.length > 0 && (
          <line x1={cx + MT_NW / 2} y1={memberRowY + MT_NH / 2}
            x2={cx + spouseCx[spouses.length - 1] + MT_NW / 2} y2={memberRowY + MT_NH / 2}
            stroke="#94a3b8" strokeWidth={1.2} strokeDasharray="4 3" opacity={0.5} />
        )}

        {/* Parent nodes */}
        {parents.map((p, i) => {
          const nx = cx + parentCx[i] - MT_NW / 2;
          const ny = parentRowY;
          return (
            <g key={`p-${p.id}`} style={{ cursor: "pointer" }} onClick={() => { window.location.href = `${APP_BASE}/directory/${p.id}`; }}>
              {nodeRect(nx, ny, false, true)}
              {nodeLabel(nx, ny, p, false)}
            </g>
          );
        })}

        {/* Member node */}
        {(() => {
          const nx = cx - MT_NW / 2;
          const ny = memberRowY;
          return (
            <g key="member">
              {nodeRect(nx, ny, true)}
              {nodeLabel(nx, ny, member, true)}
            </g>
          );
        })()}

        {/* Spouse nodes */}
        {spouses.map((s, i) => {
          const nx = cx + spouseCx[i] - MT_NW / 2;
          const ny = memberRowY;
          return (
            <g key={`s-${s.id}`} style={{ cursor: "pointer" }} onClick={() => { window.location.href = `${APP_BASE}/directory/${s.id}`; }}>
              {nodeRect(nx, ny, false, false)}
              {nodeLabel(nx, ny, s, false)}
            </g>
          );
        })}

        {/* Sibling nodes */}
        {siblings.map((s, i) => {
          const nx = cx + siblingCx[i] - MT_NW / 2;
          const ny = memberRowY;
          return (
            <g key={`sib-${s.id}`} style={{ cursor: "pointer" }} onClick={() => { window.location.href = `${APP_BASE}/directory/${s.id}`; }}>
              <rect x={nx} y={ny} width={MT_NW} height={MT_NH} rx={8} fill="rgb(250 245 255 / 0.8)" stroke="#a855f7" strokeWidth={1.5} />
              {nodeLabel(nx, ny, s, false)}
            </g>
          );
        })}

        {/* Children nodes */}
        {children.map((c, i) => {
          const nx = cx + childCx[i] - MT_NW / 2;
          const ny = childRowY;
          return (
            <g key={`c-${c.id}`} style={{ cursor: "pointer" }} onClick={() => { window.location.href = `${APP_BASE}/directory/${c.id}`; }}>
              {nodeRect(nx, ny, false, false)}
              {nodeLabel(nx, ny, c, false)}
            </g>
          );
        })}

      </svg>
    </div>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function MemberDetail() {
  const params = useParams();
  const id = params.id ? parseInt(params.id, 10) : 0;
  const [familyView, setFamilyView] = useState<"list" | "tree">("list");
  const [locationLat, setLocationLat] = useState<number | null>(null);
  const [locationLng, setLocationLng] = useState<number | null>(null);
  const [locationAddress, setLocationAddress] = useState<string | null>(null);
  const [locationInitialized, setLocationInitialized] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const [editForm, setEditForm] = useState({
    birthDate: "",
    birthYear: "",
    birthPlace: "",
    deathDate: "",
    deathYear: "",
    deathPlace: "",
    burialPlace: "",
    locationAddress: "",
    photoUrl: "",
    notes: "",
  });
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: member, isLoading, error } = useGetCommunityMember(id, {
    query: {
      enabled: !!id,
      queryKey: getGetCommunityMemberQueryKey(id)
    }
  });

  // Initialize (or reinitialize when navigating to a different member) local location state
  React.useEffect(() => {
    setLocationInitialized(false);
  }, [id]);

  React.useEffect(() => {
    if (member && !locationInitialized) {
      const m = member as typeof member & { locationLat?: number | null; locationLng?: number | null; locationAddress?: string | null };
      setLocationLat(m.locationLat ?? null);
      setLocationLng(m.locationLng ?? null);
      setLocationAddress(m.locationAddress ?? null);
      setLocationInitialized(true);
    }
  }, [member, locationInitialized]);

  // Sync edit form when member data loads
  React.useEffect(() => {
    if (member) {
      const m = member as typeof member & {
        birthDate?: string | null;
        birthYear?: number | null;
        birthPlace?: string | null;
        deathDate?: string | null;
        deathYear?: number | null;
        deathPlace?: string | null;
        burialPlace?: string | null;
        locationAddress?: string | null;
        photoUrl?: string | null;
        notes?: string | null;
      };
      setEditForm({
        birthDate: m.birthDate ?? "",
        birthYear: m.birthYear != null ? String(m.birthYear) : "",
        birthPlace: m.birthPlace ?? "",
        deathDate: m.deathDate ?? "",
        deathYear: m.deathYear != null ? String(m.deathYear) : "",
        deathPlace: m.deathPlace ?? "",
        burialPlace: m.burialPlace ?? "",
        locationAddress: m.locationAddress ?? "",
        photoUrl: m.photoUrl ?? "",
        notes: m.notes ?? "",
      });
    }
  }, [member?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSaveProfile = async () => {
    const token = getCommunityToken();
    if (!token) {
      toast({ title: "Not authenticated", description: "Sign in as an officer to update profiles.", variant: "destructive" });
      return;
    }
    setEditSaving(true);
    try {
      const birthYear = editForm.birthYear.trim() ? Number(editForm.birthYear) : null;
      const deathYear = editForm.deathYear.trim() ? Number(editForm.deathYear) : null;
      if (birthYear !== null && !Number.isFinite(birthYear)) throw new Error("Birth year must be a valid number");
      if (deathYear !== null && !Number.isFinite(deathYear)) throw new Error("Death year must be a valid number");

      const m = member as typeof member & { _profileSource?: string | null };
      const isLineageProfile = m._profileSource === "lineage";
      const url = isLineageProfile ? `/api/lineage/nodes/${id}` : `/api/community/directory/${id}`;
      const payload = isLineageProfile
        ? {
            birthDate: editForm.birthDate || null,
            birthYear,
            birthPlace: editForm.birthPlace || null,
            deathDate: editForm.deathDate || null,
            deathYear,
            deathPlace: editForm.deathPlace || null,
            burialPlace: editForm.burialPlace || null,
            notes: editForm.notes || null,
          }
        : {
            birthPlace: editForm.birthPlace || null,
            locationAddress: editForm.locationAddress || null,
            photoUrl: editForm.photoUrl || null,
            notes: editForm.notes || null,
          };

      const r = await fetch(url, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      if (!r.ok) {
        const err = await r.json().catch(() => ({})) as { error?: string };
        throw new Error(err.error ?? "Failed to save profile");
      }
      queryClient.invalidateQueries({ queryKey: getGetCommunityMemberQueryKey(id) });
      setEditOpen(false);
      toast({ title: "Profile updated", description: "Biographical details saved successfully." });
    } catch (e) {
      toast({ title: "Save failed", description: (e as Error).message, variant: "destructive" });
    } finally {
      setEditSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-32" />
        <Card>
          <CardContent className="p-8">
            <div className="flex flex-col md:flex-row gap-8">
              <Skeleton className="h-32 w-32 rounded-full" />
              <div className="space-y-4 flex-1">
                <Skeleton className="h-10 w-2/3" />
                <Skeleton className="h-6 w-1/3" />
                <div className="flex gap-2">
                  <Skeleton className="h-6 w-24" />
                  <Skeleton className="h-6 w-24" />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error || !member) {
    return (
      <div className="text-center py-20">
        <h2 className="text-2xl font-bold text-destructive">Member Not Found</h2>
        <p className="text-muted-foreground mt-2 mb-6">The family member you're looking for doesn't exist or you don't have access.</p>
        <Link href="/directory">
          <Button variant="outline"><ArrowLeft className="mr-2 h-4 w-4" /> Back to Directory</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <Link href="/directory">
          <Button variant="ghost" size="sm" className="mb-4 -ml-3 text-muted-foreground">
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Directory
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Profile Card */}
        <Card className="lg:col-span-2 overflow-hidden border-primary/20">
          {/* Banner with seal watermark */}
          <div className="h-32 bg-gradient-to-r from-[#8B0000]/80 to-primary/40 relative overflow-hidden flex items-center px-6 gap-4">
            <img
              src={SEAL_URL}
              alt=""
              className="absolute right-4 top-1/2 -translate-y-1/2 h-28 w-28 object-contain opacity-15 pointer-events-none select-none"
            />
            <img
              src={SEAL_URL}
              alt="Mathias El Tribe"
              className="h-12 w-12 object-contain drop-shadow-md shrink-0"
            />
            <div>
              <p className="text-yellow-200 font-bold text-xs tracking-widest uppercase">Mathias El Tribe</p>
              <p className="text-yellow-100/70 text-[10px] tracking-wider uppercase">Member Profile</p>
            </div>
          </div>

          <CardContent className="p-6 pt-0 relative">
            <div className="flex flex-col sm:flex-row gap-6 items-start sm:items-end -mt-12 mb-6">
              <Avatar className="h-24 w-24 border-4 border-card shadow-lg bg-card">
                <AvatarImage src={member.photoUrl || (member.photoFilename ? `/assets/${member.photoFilename}` : "")} />
                <AvatarFallback className="text-3xl font-bold text-primary bg-primary/10">
                  {member.firstName?.charAt(0) || ""}{member.lastName?.charAt(0) || ""}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 space-y-1 mt-4 sm:mt-0 sm:pt-14">
                <h1 className="text-3xl font-bold">{member.fullName}</h1>
                <div className="text-muted-foreground flex flex-wrap gap-x-4 gap-y-2 text-sm mt-1">
                  {member.birthYear && (
                    <span className="flex items-center gap-1">
                      <Calendar className="h-4 w-4" />
                      {member.birthYear}{member.deathYear ? ` – ${member.deathYear}` : (member.isDeceased || (2026 - (member.birthYear ?? 9999)) > 95) ? ' (Deceased)' : ' (Living)'}
                    </span>
                  )}
                  {member.tribalNation && (
                    <span className="flex items-center gap-1">
                      <Shield className="h-4 w-4" />
                      {member.tribalNation}
                    </span>
                  )}
                  {member.tribalEnrollmentNumber && (
                    <span className="flex items-center gap-1 font-mono">
                      <FileText className="h-4 w-4" />
                      ID: {member.tribalEnrollmentNumber}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 mb-8">
              {member.membershipStatus && (
                <Badge variant="default" className="text-sm px-3 py-1">
                  {member.membershipStatus}
                </Badge>
              )}
              {member.isAncestor && (
                <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800 text-sm px-3 py-1">
                  Ancestor
                </Badge>
              )}
              {member.icwaEligible && (
                <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-800 text-sm px-3 py-1">
                  ICWA Eligible
                </Badge>
              )}
              {member.trustBeneficiary && (
                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 dark:bg-green-950/30 dark:text-green-400 dark:border-green-800 text-sm px-3 py-1">
                  Trust Beneficiary
                </Badge>
              )}
              {member.pendingReview && (
                <Badge variant="secondary" className="bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/30 dark:text-orange-400 dark:border-orange-800 text-sm px-3 py-1">
                  Pending Review
                </Badge>
              )}
            </div>

            {/* ── Edit Profile Details (officer panel) ─────────────────── */}
            {getSovereignSession() && (
              <div className="mt-4">
                {!editOpen ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2 text-xs border-primary/30 text-primary hover:bg-primary/5"
                    onClick={() => setEditOpen(true)}
                  >
                    <Pencil className="h-3.5 w-3.5" /> Edit Profile Details
                  </Button>
                ) : (
                  <div className="border border-primary/20 rounded-lg p-4 space-y-3 bg-muted/30">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-sm font-semibold flex items-center gap-2 text-primary">
                        <Pencil className="h-4 w-4" /> Edit Biographical Details
                      </p>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditOpen(false)}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs font-medium text-muted-foreground mb-1 block">Birth Date</label>
                        <Input
                          placeholder="e.g. 2 Sep 1988"
                          value={editForm.birthDate}
                          onChange={(e) => setEditForm({ ...editForm, birthDate: e.target.value })}
                        />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-muted-foreground mb-1 block">Birth Year</label>
                        <Input
                          type="number"
                          inputMode="numeric"
                          placeholder="e.g. 1988"
                          value={editForm.birthYear}
                          onChange={(e) => setEditForm({ ...editForm, birthYear: e.target.value })}
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="text-xs font-medium text-muted-foreground mb-1 block">Birth Place</label>
                        <Input
                          placeholder="e.g. Orange, California"
                          value={editForm.birthPlace}
                          onChange={(e) => setEditForm({ ...editForm, birthPlace: e.target.value })}
                        />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-muted-foreground mb-1 block">Death Date</label>
                        <Input
                          placeholder="e.g. 14 Jan 2020"
                          value={editForm.deathDate}
                          onChange={(e) => setEditForm({ ...editForm, deathDate: e.target.value })}
                        />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-muted-foreground mb-1 block">Death Year</label>
                        <Input
                          type="number"
                          inputMode="numeric"
                          placeholder="e.g. 2020"
                          value={editForm.deathYear}
                          onChange={(e) => setEditForm({ ...editForm, deathYear: e.target.value })}
                        />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-muted-foreground mb-1 block">Death Place</label>
                        <Input
                          placeholder="e.g. Bakersfield, California"
                          value={editForm.deathPlace}
                          onChange={(e) => setEditForm({ ...editForm, deathPlace: e.target.value })}
                        />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-muted-foreground mb-1 block">Burial Place</label>
                        <Input
                          placeholder="e.g. Greenlawn Cemetery"
                          value={editForm.burialPlace}
                          onChange={(e) => setEditForm({ ...editForm, burialPlace: e.target.value })}
                        />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-muted-foreground mb-1 block">Current Address / Location</label>
                        <Input
                          placeholder="e.g. Bakersfield, California"
                          value={editForm.locationAddress}
                          onChange={(e) => setEditForm({ ...editForm, locationAddress: e.target.value })}
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="text-xs font-medium text-muted-foreground mb-1 block flex items-center gap-1.5">
                          <Camera className="h-3.5 w-3.5" /> Photo URL
                        </label>
                        <Input
                          placeholder="https://... paste a direct image link"
                          value={editForm.photoUrl}
                          onChange={(e) => setEditForm({ ...editForm, photoUrl: e.target.value })}
                        />
                        {editForm.photoUrl && (
                          <div className="mt-2 flex items-center gap-3">
                            <img
                              src={editForm.photoUrl}
                              alt="Preview"
                              className="h-14 w-14 rounded-full object-cover border-2 border-primary/30"
                              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                            />
                            <p className="text-xs text-muted-foreground">Photo preview</p>
                          </div>
                        )}
                      </div>
                      <div className="sm:col-span-2">
                        <label className="text-xs font-medium text-muted-foreground mb-1 block">Notes</label>
                        <Textarea
                          placeholder="Narrative biographical notes only. Use the structured fields above for birth, death, burial, or residence facts."
                          rows={3}
                          value={editForm.notes}
                          onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                        />
                        <p className="mt-1 text-[11px] text-muted-foreground">
                          Notes are narrative only; structured facts are saved through the dedicated fields above.
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2 pt-1">
                      <Button size="sm" className="gap-2" onClick={handleSaveProfile} disabled={editSaving}>
                        <Save className="h-3.5 w-3.5" />
                        {editSaving ? "Saving…" : "Save Changes"}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setEditOpen(false)}>Cancel</Button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {member.notes && (
              <div className="mt-8 space-y-3">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <Info className="h-5 w-5 text-primary" /> Biographical Notes
                </h3>
                <div className="bg-muted/50 rounded-lg p-4 text-sm leading-relaxed whitespace-pre-wrap text-foreground/90 border">
                  {member.notes}
                </div>
              </div>
            )}

            {/* ── Known Locations ─────────────────────────────────────────── */}
            {(() => {
              type LifeEventRow = { eventType: string; eventDate: string | null; eventYear: number | null; eventPlace: string | null; eventNote: string | null };
              const m = member as typeof member & {
                locationAddress?: string | null;
                birthPlace?: string | null;
                deathPlace?: string | null;
                burialPlace?: string | null;
                lifeEvents?: LifeEventRow[];
              };

              // Build deduplicated location list from dedicated columns + structured life events
              const entries: { label: string; place: string; year?: number | null; icon: "pin" | "globe" | "birth" | "death" | "burial" | "resi" }[] = [];
              const seen = new Set<string>();
              const add = (label: string, place: string | null | undefined, icon: typeof entries[0]["icon"], year?: number | null) => {
                if (!place) return;
                const key = `${label}:${place}`;
                if (seen.has(key)) return;
                seen.add(key);
                entries.push({ label, place, icon, year });
              };

              add("Birth Place", m.birthPlace, "birth");
              add("Death Place", m.deathPlace, "death");
              add("Burial Place", m.burialPlace, "burial");

              // Structured life events from ancestor_life_events table (GEDCOM RESI/CENS/etc.)
              const rawEvents = m.lifeEvents ?? [];
              // Sort residences/census by year for chronological display
              const resiEvents = rawEvents
                .filter(e => e.eventType === "residence" || e.eventType === "census")
                .sort((a, b) => (a.eventYear ?? 0) - (b.eventYear ?? 0));
              for (const ev of resiEvents) {
                const label = ev.eventType === "census"
                  ? `Census${ev.eventYear ? ` (${ev.eventYear})` : ""}`
                  : `Residence${ev.eventYear ? ` (${ev.eventYear})` : ""}`;
                add(label, ev.eventPlace, "resi", ev.eventYear);
              }

              // Fall back to locationAddress as "Last Known Address" if nothing else
              if (entries.length === 0 && m.locationAddress) {
                add("Last Known Address", m.locationAddress, "pin");
              } else if (m.locationAddress) {
                // Only show locationAddress if it differs from already-listed places
                add("Last Known Address", m.locationAddress, "pin");
              }

              if (entries.length === 0) return null;

              const iconEl = (icon: typeof entries[0]["icon"]) => {
                if (icon === "birth")  return <span className="text-[10px] font-bold text-emerald-600 mt-0.5 shrink-0 w-4 text-center">B</span>;
                if (icon === "death")  return <span className="text-[10px] font-bold text-rose-600 mt-0.5 shrink-0 w-4 text-center">D</span>;
                if (icon === "burial") return <span className="text-[10px] font-bold text-stone-500 mt-0.5 shrink-0 w-4 text-center">✝</span>;
                if (icon === "resi")   return <Globe2 className="h-4 w-4 text-amber-500/70 mt-0.5 shrink-0" />;
                return <MapPin className="h-4 w-4 text-primary/60 mt-0.5 shrink-0" />;
              };

              return (
                <div className="mt-6 space-y-3">
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    <MapPin className="h-5 w-5 text-primary" /> Known Locations
                  </h3>
                  <div className="bg-muted/30 rounded-lg border divide-y divide-border/60">
                    {entries.map((pl, i) => (
                      <div key={i} className="flex items-start gap-3 px-4 py-3">
                        {iconEl(pl.icon)}
                        <div>
                          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-0.5">{pl.label}</p>
                          <p className="text-sm text-foreground/90">{pl.place}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                  {(member.isDeceased || member.isAncestor) && (
                    <a
                      href={`/atlas/?mode=atlas&person=${member.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs text-primary/70 hover:text-primary transition-colors"
                    >
                      <Globe2 className="h-3.5 w-3.5" />
                      View full location history in Ancestral Atlas
                      <ExternalLink className="h-3 w-3 opacity-60" />
                    </a>
                  )}
                </div>
              );
            })()}
          </CardContent>
        </Card>

        {/* Right column */}
        <div className="space-y-6">
          {/* Tribal ID Card */}
          <TribalIdCard member={member} locationAddress={locationAddress} />

          {/* Family Connections */}
          <Card>
            <CardHeader className="bg-muted/30 border-b pb-3 pt-4">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Network className="h-5 w-5 text-primary" /> Family Connections
                </CardTitle>
                <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
                  {/* "View in Atlas" — shown for deceased or ancestor records */}
                  {(member.isDeceased || member.isAncestor) && (
                    <a
                      href={`/atlas/?mode=atlas&person=${member.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-primary/30 bg-primary/5 text-[10px] font-semibold text-primary/80 hover:bg-primary/10 hover:text-primary transition-colors"
                      data-testid="view-in-atlas-tree"
                    >
                      <Globe2 className="w-3 h-3" />
                      View in Atlas
                      <ExternalLink className="w-2.5 h-2.5 opacity-70" />
                    </a>
                  )}
                  <div className="flex rounded-md overflow-hidden border border-border text-[10px] font-semibold">
                    {(["list", "tree"] as const).map(v => (
                      <button
                        key={v}
                        onClick={() => setFamilyView(v)}
                        className={`px-2.5 py-1 capitalize transition-colors ${familyView === v ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:bg-muted"}`}
                      >
                        {v}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">

              {familyView === "tree" && (
                <FamilyMiniTree member={member} />
              )}

              {familyView === "list" && (
                <>
                  {(member as typeof member & { siblings?: typeof member.parents }).siblings && (member as typeof member & { siblings?: typeof member.parents }).siblings!.length > 0 && (
                    <div className="p-4 border-b">
                      <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
                        <span className="inline-block w-2 h-2 rounded-full bg-purple-400" />
                        Siblings
                      </h4>
                      <div className="space-y-3">
                        {(member as typeof member & { siblings?: typeof member.parents }).siblings!.map(sibling => {
                          const isAnc = likelyDeceased(sibling.birthYear);
                          const card = (
                            <div className="flex items-center gap-3 p-2 rounded-md hover:bg-muted cursor-pointer transition-colors group">
                              <Avatar className="h-8 w-8">
                                <AvatarImage src={sibling.photoUrl || (sibling.photoFilename ? `/assets/${sibling.photoFilename}` : "")} />
                                <AvatarFallback className="text-xs bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300">{sibling.firstName?.charAt(0) || ""}{sibling.lastName?.charAt(0) || ""}</AvatarFallback>
                              </Avatar>
                              <div className="flex flex-col flex-1">
                                <span className="text-sm font-medium group-hover:text-primary transition-colors">{sibling.fullName}</span>
                                <span className="text-xs text-muted-foreground">{sibling.birthYear ? `b. ${sibling.birthYear}` : ''}</span>
                              </div>
                              {isAnc && <Globe2 className="h-3.5 w-3.5 text-amber-500/70 shrink-0" />}
                            </div>
                          );
                          return isAnc
                            ? <a key={sibling.id} href={`/atlas/?mode=atlas&person=${sibling.id}`} target="_blank" rel="noopener noreferrer">{card}</a>
                            : <Link key={sibling.id} href={`/directory/${sibling.id}`}>{card}</Link>;
                        })}
                      </div>
                    </div>
                  )}

                  {member.parents && member.parents.length > 0 && (
                    <div className="p-4 border-b">
                      <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Parents</h4>
                      <div className="space-y-3">
                        {member.parents.map(parent => {
                          const isAnc = likelyDeceased(parent.birthYear);
                          const card = (
                            <div className="flex items-center gap-3 p-2 rounded-md hover:bg-muted cursor-pointer transition-colors group">
                              <Avatar className="h-8 w-8">
                                <AvatarImage src={parent.photoUrl || (parent.photoFilename ? `/assets/${parent.photoFilename}` : "")} />
                                <AvatarFallback className="text-xs bg-primary/10">{parent.firstName?.charAt(0) || ""}{parent.lastName?.charAt(0) || ""}</AvatarFallback>
                              </Avatar>
                              <div className="flex flex-col flex-1">
                                <span className="text-sm font-medium group-hover:text-primary transition-colors">{parent.fullName}</span>
                                <span className="text-xs text-muted-foreground">{parent.birthYear ? `b. ${parent.birthYear}` : ''}</span>
                              </div>
                              {isAnc && <Globe2 className="h-3.5 w-3.5 text-amber-500/70 shrink-0" />}
                            </div>
                          );
                          return isAnc
                            ? <a key={parent.id} href={`/atlas/?mode=atlas&person=${parent.id}`} target="_blank" rel="noopener noreferrer">{card}</a>
                            : <Link key={parent.id} href={`/directory/${parent.id}`}>{card}</Link>;
                        })}
                      </div>
                    </div>
                  )}

                  {member.spouses && member.spouses.length > 0 && (
                    <div className="p-4 border-b">
                      <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Spouses</h4>
                      <div className="space-y-3">
                        {member.spouses.map(spouse => (
                          <Link key={spouse.id} href={`/directory/${spouse.id}`}>
                            <div className="flex items-center gap-3 p-2 rounded-md hover:bg-muted cursor-pointer transition-colors group">
                              <Avatar className="h-8 w-8">
                                <AvatarImage src={spouse.photoUrl || (spouse.photoFilename ? `/assets/${spouse.photoFilename}` : "")} />
                                <AvatarFallback className="text-xs bg-primary/10">{spouse.firstName?.charAt(0) || ""}{spouse.lastName?.charAt(0) || ""}</AvatarFallback>
                              </Avatar>
                              <div className="flex flex-col">
                                <span className="text-sm font-medium group-hover:text-primary transition-colors">{spouse.fullName}</span>
                                <span className="text-xs text-muted-foreground">{spouse.birthYear ? `b. ${spouse.birthYear}` : ''}</span>
                              </div>
                            </div>
                          </Link>
                        ))}
                      </div>
                    </div>
                  )}

                  {member.children && member.children.length > 0 && (
                    <div className="p-4">
                      <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Children</h4>
                      <div className="space-y-3">
                        {member.children.map(child => {
                          const isAnc = likelyDeceased(child.birthYear);
                          const card = (
                            <div className="flex items-center gap-3 p-2 rounded-md hover:bg-muted cursor-pointer transition-colors group">
                              <Avatar className="h-8 w-8">
                                <AvatarImage src={child.photoUrl || (child.photoFilename ? `/assets/${child.photoFilename}` : "")} />
                                <AvatarFallback className="text-xs bg-primary/10">{child.firstName?.charAt(0) || ""}{child.lastName?.charAt(0) || ""}</AvatarFallback>
                              </Avatar>
                              <div className="flex flex-col flex-1">
                                <span className="text-sm font-medium group-hover:text-primary transition-colors">{child.fullName}</span>
                                <span className="text-xs text-muted-foreground">{child.birthYear ? `b. ${child.birthYear}` : ''}</span>
                              </div>
                              {isAnc && <Globe2 className="h-3.5 w-3.5 text-amber-500/70 shrink-0" />}
                            </div>
                          );
                          return isAnc
                            ? <a key={child.id} href={`/atlas/?mode=atlas&person=${child.id}`} target="_blank" rel="noopener noreferrer">{card}</a>
                            : <Link key={child.id} href={`/directory/${child.id}`}>{card}</Link>;
                        })}
                      </div>
                    </div>
                  )}

                  {(!member.parents?.length && !member.children?.length && !member.spouses?.length && !(member as typeof member & { siblings?: unknown[] }).siblings?.length) && (
                    <div className="p-8 text-center text-muted-foreground text-sm">
                      No family connections recorded in the directory.
                    </div>
                  )}
                </>
              )}

            </CardContent>
          </Card>

          {/* Ancestor Location Editor — only for deceased / ancestor records */}
          {(member.isDeceased || member.isAncestor) && (
            <AncestorLocationEditor
              memberId={id}
              isDeceased={!!member.isDeceased}
              isAncestor={!!member.isAncestor}
              currentLat={locationLat}
              currentLng={locationLng}
              currentAddress={locationAddress}
              tribalNation={member.tribalNation}
              locationText={member.ancestralLocationText}
              onSaved={(lat, lng, address) => {
                setLocationLat(lat);
                setLocationLng(lng);
                setLocationAddress(address);
              }}
            />
          )}

          {/* Lineage Tags */}
          {member.lineageTags && member.lineageTags.length > 0 && (
            <Card>
              <CardHeader className="bg-muted/30 border-b pb-4">
                <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Lineage Tags</CardTitle>
              </CardHeader>
              <CardContent className="p-4">
                <div className="flex flex-wrap gap-2">
                  {member.lineageTags.map(tag => (
                    <Badge key={tag} variant="secondary" className="bg-secondary/50 font-normal">
                      {tag}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Territory-Based Tribal Affiliation — shown for ancestors / deceased members */}
      {(member.isAncestor || member.isDeceased || member.deathYear || (member.birthYear && (new Date().getFullYear() - (member.birthYear ?? 9999)) > 80)) && (
        <TribalAffiliationPanel
          memberId={id}
          isAncestor={member.isAncestor}
          isDeceased={member.isDeceased}
          birthYear={member.birthYear}
          deathYear={member.deathYear}
        />
      )}

      {/* Historical Exposure Analysis — shown for ancestors and deceased members with known years */}
      {(member.isAncestor || member.isDeceased || member.deathYear) && (
        <ExposurePanel
          memberId={id}
          birthYear={member.birthYear}
          deathYear={member.deathYear}
        />
      )}
    </div>
  );
}
