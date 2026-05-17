import React, { useState, useMemo } from "react";
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
} from "lucide-react";
import { Button } from "@/components/ui/button";
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
  onSaved: (lat: number | null, lng: number | null) => void;
}

function AncestorLocationEditor({ memberId, isDeceased, isAncestor, currentLat, currentLng, onSaved }: AncestorLocationEditorProps) {
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);
  const [latStr, setLatStr] = useState(currentLat != null ? String(currentLat) : "");
  const [lngStr, setLngStr] = useState(currentLng != null ? String(currentLng) : "");
  const [saving, setSaving] = useState(false);

  if (!isDeceased && !isAncestor) return null;

  const hasCoords = currentLat != null && currentLng != null;

  const handleSave = async () => {
    const token = getCommunityToken();
    if (!token) {
      toast({ title: "Not authenticated", description: "You must be signed in to update ancestor locations.", variant: "destructive" });
      return;
    }
    const lat = latStr.trim() === "" ? null : parseFloat(latStr);
    const lng = lngStr.trim() === "" ? null : parseFloat(lngStr);
    if (lat !== null && (isNaN(lat) || lat < -90 || lat > 90)) {
      toast({ title: "Invalid latitude", description: "Latitude must be between -90 and 90.", variant: "destructive" });
      return;
    }
    if (lng !== null && (isNaN(lng) || lng < -180 || lng > 180)) {
      toast({ title: "Invalid longitude", description: "Longitude must be between -180 and 180.", variant: "destructive" });
      return;
    }
    if ((lat == null) !== (lng == null)) {
      toast({ title: "Both fields required", description: "Enter both latitude and longitude, or leave both blank to clear.", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const r = await fetch(`/api/ancestors/${memberId}/location`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ lat, lng }),
      });
      if (!r.ok) {
        const err = await r.json().catch(() => ({})) as { error?: string };
        throw new Error(err.error ?? "Failed to save location");
      }
      onSaved(lat, lng);
      setEditing(false);
      toast({ title: "Location saved", description: lat != null ? `Verified coordinates stored for this ancestor.` : "Coordinates cleared." });
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
      setLatStr("");
      setLngStr("");
      onSaved(null, null);
      setEditing(false);
      toast({ title: "Location cleared", description: "Verified coordinates removed. The Atlas will use inferred placement." });
    } catch (e) {
      toast({ title: "Failed to clear", description: (e as Error).message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="overflow-hidden">
      <CardHeader className="bg-emerald-50 dark:bg-emerald-950/20 border-b border-emerald-200 dark:border-emerald-800/30 pb-3 pt-4 px-5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            <CardTitle className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">Verified Ancestor Location</CardTitle>
            {hasCoords && !editing && (
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700 px-1.5 py-0.5 rounded-full">
                <CheckCircle2 className="w-2.5 h-2.5" /> Set
              </span>
            )}
          </div>
          {!editing && (
            <Button size="sm" variant="ghost" className="h-7 text-xs gap-1 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/30" onClick={() => { setLatStr(currentLat != null ? String(currentLat) : ""); setLngStr(currentLng != null ? String(currentLng) : ""); setEditing(true); }}>
              <Pencil className="w-3 h-3" />
              {hasCoords ? "Edit" : "Add Location"}
            </Button>
          )}
        </div>
        {!editing && (
          <p className="text-xs text-muted-foreground mt-1">
            {hasCoords
              ? `Lat ${currentLat?.toFixed(5)}, Lng ${currentLng?.toFixed(5)} — shown as a solid green pin on the Atlas.`
              : "Store an exact coordinate from a census address, allotment record, or boarding school assignment. Verified points appear as solid green pins on the Atlas."}
          </p>
        )}
      </CardHeader>

      {editing && (
        <CardContent className="p-4 space-y-3">
          <p className="text-xs text-muted-foreground leading-relaxed">
            Enter decimal latitude and longitude from a verified documentary source (census record, allotment location, boarding school address, etc.). These coordinates will appear as a <strong>solid green pin</strong> on the Atlas, distinct from inferred tribal-nation placements.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-foreground">Latitude</label>
              <input
                type="number"
                step="any"
                min={-90}
                max={90}
                placeholder="e.g. 35.46"
                value={latStr}
                onChange={e => setLatStr(e.target.value)}
                className="w-full h-8 text-sm px-2 rounded-md border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring font-mono"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-foreground">Longitude</label>
              <input
                type="number"
                step="any"
                min={-180}
                max={180}
                placeholder="e.g. -94.97"
                value={lngStr}
                onChange={e => setLngStr(e.target.value)}
                className="w-full h-8 text-sm px-2 rounded-md border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring font-mono"
              />
            </div>
          </div>
          <div className="flex items-center gap-2 pt-1">
            <Button size="sm" className="h-7 text-xs gap-1 bg-emerald-700 hover:bg-emerald-800 text-white" onClick={handleSave} disabled={saving}>
              <CheckCircle2 className="w-3 h-3" />
              {saving ? "Saving…" : "Save Location"}
            </Button>
            {hasCoords && (
              <Button size="sm" variant="ghost" className="h-7 text-xs gap-1 text-destructive hover:bg-destructive/10" onClick={handleClear} disabled={saving}>
                <X className="w-3 h-3" /> Clear
              </Button>
            )}
            <Button size="sm" variant="ghost" className="h-7 text-xs ml-auto text-muted-foreground" onClick={() => setEditing(false)} disabled={saving}>
              Cancel
            </Button>
          </div>
          <p className="text-[10px] text-muted-foreground/60">
            Leave both fields blank and save to remove previously stored coordinates. The Atlas will fall back to record-based or tribal-nation inference.
          </p>
        </CardContent>
      )}
    </Card>
  );
}

// ─── Exposure Panel ────────────────────────────────────────────────────────────

type ExposureMatch = {
  event_id: number; title: string; short_name: string; category: string;
  year_start: number; year_end: number | null; significance: string;
  description: string; legal_citation: string; impact_types: string[];
  location_match: boolean;
};

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

function TribalIdCard({ member }: { member: {
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
} }) {
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
          <p className="text-yellow-300/70 text-[9px] uppercase tracking-widest">Sovereign Office</p>
          <p className="text-yellow-300/70 text-[9px] uppercase tracking-widest">Chief Justice & Trustee</p>
        </div>
      </div>

      {/* Card body */}
      <CardContent className="p-5 bg-gradient-to-br from-card to-muted/30">
        <div className="flex gap-5 items-start">
          {/* Photo */}
          <Avatar className="h-20 w-20 border-2 border-primary/40 shadow shrink-0 rounded-md">
            <AvatarImage src={`/assets/${member.photoFilename || ""}`} className="object-cover" />
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

// ─── Mini Family Tree ──────────────────────────────────────────────────────────

type FamilyPerson = { id: number; fullName?: string | null; firstName?: string | null; lastName?: string | null; birthYear?: number | null; photoFilename?: string | null };

function TreeNode({ person, isMain = false }: { person: FamilyPerson; isMain?: boolean }) {
  const initials = `${person.firstName?.charAt(0) ?? ""}${person.lastName?.charAt(0) ?? ""}`;
  return (
    <Link href={`/directory/${person.id}`}>
      <div className={`flex flex-col items-center gap-1 px-2 py-2 rounded-lg border text-center cursor-pointer transition-colors w-[90px] shrink-0 ${
        isMain ? "bg-primary/10 border-primary/40 shadow-sm" : "bg-muted/40 border-border hover:bg-muted/60 hover:border-primary/30"
      }`}>
        <Avatar className="h-8 w-8">
          <AvatarImage src={`/assets/${person.photoFilename || ""}`} className="object-cover" />
          <AvatarFallback className={`text-xs font-bold ${isMain ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"}`}>{initials}</AvatarFallback>
        </Avatar>
        <span className="text-[10px] font-medium leading-tight line-clamp-2">{person.fullName ?? "—"}</span>
        {person.birthYear && <span className="text-[9px] text-muted-foreground">b. {person.birthYear}</span>}
      </div>
    </Link>
  );
}

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

function FamilyMiniTree({ member }: { member: FamilyPerson & { parents?: FamilyPerson[] | null; spouses?: FamilyPerson[] | null; children?: FamilyPerson[] | null } }) {
  const parents  = member.parents  ?? [];
  const spouses  = member.spouses  ?? [];
  const children = member.children ?? [];
  const hasAny   = parents.length > 0 || spouses.length > 0 || children.length > 0;

  const parentCx  = useMemo(() => d3RowCenters(parents.length),  [parents.length]);
  const childCx   = useMemo(() => d3RowCenters(children.length), [children.length]);
  // Spouses extend to the right of member; member center = 0
  const spouseCx  = spouses.map((_, i) => (MT_NW + 20) * (i + 1));

  const hasParents  = parents.length  > 0;
  const hasChildren = children.length > 0;

  const parentRowY = 0;
  const memberRowY = hasParents  ? MT_NH + MT_VGAP : 0;
  const childRowY  = memberRowY + MT_NH + MT_VGAP;

  // SVG bounds: collect all node centers and compute required width
  const allLeft  = [...parentCx, ...childCx, 0].map(x => x - MT_NW / 2);
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
            <g key={`p-${p.id}`} style={{ cursor: "pointer" }} onClick={() => { window.location.href = `/directory/${p.id}`; }}>
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
            <g key={`s-${s.id}`} style={{ cursor: "pointer" }} onClick={() => { window.location.href = `/directory/${s.id}`; }}>
              {nodeRect(nx, ny, false, false)}
              {nodeLabel(nx, ny, s, false)}
            </g>
          );
        })}

        {/* Children nodes */}
        {children.map((c, i) => {
          const nx = cx + childCx[i] - MT_NW / 2;
          const ny = childRowY;
          return (
            <g key={`c-${c.id}`} style={{ cursor: "pointer" }} onClick={() => { window.location.href = `/directory/${c.id}`; }}>
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
  const [locationInitialized, setLocationInitialized] = useState(false);

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
      const m = member as typeof member & { locationLat?: number | null; locationLng?: number | null };
      setLocationLat(m.locationLat ?? null);
      setLocationLng(m.locationLng ?? null);
      setLocationInitialized(true);
    }
  }, [member, locationInitialized]);

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
                <AvatarImage src={`/assets/${member.photoFilename || ""}`} />
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
                      {member.birthYear} {member.deathYear ? `- ${member.deathYear}` : '(Living)'}
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
          </CardContent>
        </Card>

        {/* Right column */}
        <div className="space-y-6">
          {/* Tribal ID Card */}
          <TribalIdCard member={member} />

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
                      href={`/urban-indian-atlas/?mode=atlas&person=${member.id}`}
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
                  {member.parents && member.parents.length > 0 && (
                    <div className="p-4 border-b">
                      <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Parents</h4>
                      <div className="space-y-3">
                        {member.parents.map(parent => (
                          <Link key={parent.id} href={`/directory/${parent.id}`}>
                            <div className="flex items-center gap-3 p-2 rounded-md hover:bg-muted cursor-pointer transition-colors group">
                              <Avatar className="h-8 w-8">
                                <AvatarImage src={`/assets/${parent.photoFilename || ""}`} />
                                <AvatarFallback className="text-xs bg-primary/10">{parent.firstName?.charAt(0) || ""}{parent.lastName?.charAt(0) || ""}</AvatarFallback>
                              </Avatar>
                              <div className="flex flex-col">
                                <span className="text-sm font-medium group-hover:text-primary transition-colors">{parent.fullName}</span>
                                <span className="text-xs text-muted-foreground">{parent.birthYear ? `b. ${parent.birthYear}` : ''}</span>
                              </div>
                            </div>
                          </Link>
                        ))}
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
                                <AvatarImage src={`/assets/${spouse.photoFilename || ""}`} />
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
                        {member.children.map(child => (
                          <Link key={child.id} href={`/directory/${child.id}`}>
                            <div className="flex items-center gap-3 p-2 rounded-md hover:bg-muted cursor-pointer transition-colors group">
                              <Avatar className="h-8 w-8">
                                <AvatarImage src={`/assets/${child.photoFilename || ""}`} />
                                <AvatarFallback className="text-xs bg-primary/10">{child.firstName?.charAt(0) || ""}{child.lastName?.charAt(0) || ""}</AvatarFallback>
                              </Avatar>
                              <div className="flex flex-col">
                                <span className="text-sm font-medium group-hover:text-primary transition-colors">{child.fullName}</span>
                                <span className="text-xs text-muted-foreground">{child.birthYear ? `b. ${child.birthYear}` : ''}</span>
                              </div>
                            </div>
                          </Link>
                        ))}
                      </div>
                    </div>
                  )}

                  {(!member.parents?.length && !member.children?.length && !member.spouses?.length) && (
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
              onSaved={(lat, lng) => {
                setLocationLat(lat);
                setLocationLng(lng);
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
