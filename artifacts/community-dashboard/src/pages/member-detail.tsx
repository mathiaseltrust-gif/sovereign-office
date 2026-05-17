import React, { useState } from "react";
import { useParams, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

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

function FamilyMiniTree({ member }: { member: FamilyPerson & { parents?: FamilyPerson[] | null; spouses?: FamilyPerson[] | null; children?: FamilyPerson[] | null } }) {
  const parents = member.parents ?? [];
  const spouses = member.spouses ?? [];
  const children = member.children ?? [];
  const hasAny = parents.length > 0 || spouses.length > 0 || children.length > 0;

  if (!hasAny) return (
    <div className="p-8 text-center text-muted-foreground text-sm">No family connections recorded in the directory.</div>
  );

  return (
    <div className="p-4 select-none overflow-x-auto">
      <div className="flex flex-col items-center gap-0 min-w-fit mx-auto">

        {/* Parents row */}
        {parents.length > 0 && (
          <>
            <div className="flex gap-3 flex-wrap justify-center">
              {parents.map(p => <TreeNode key={p.id} person={p} />)}
            </div>
            <div className="flex flex-col items-center">
              <div className="w-px h-4 bg-border mt-1" />
              <div className="w-2 h-2 rounded-full border-2 border-border bg-background" />
              <div className="w-px h-3 bg-border" />
            </div>
          </>
        )}

        {/* Member + spouses row */}
        <div className="flex items-center gap-2 flex-wrap justify-center">
          <TreeNode person={member} isMain />
          {spouses.map((s, i) => (
            <React.Fragment key={s.id}>
              <span className="text-muted-foreground text-sm font-light select-none">⁓</span>
              <TreeNode person={s} />
            </React.Fragment>
          ))}
        </div>

        {/* Children row */}
        {children.length > 0 && (
          <>
            <div className="flex flex-col items-center">
              <div className="w-px h-3 bg-border mt-1" />
              <div className="w-2 h-2 rounded-full border-2 border-border bg-background" />
              <div className="w-px h-4 bg-border" />
            </div>
            <div className="flex gap-3 flex-wrap justify-center">
              {children.map(c => <TreeNode key={c.id} person={c} />)}
            </div>
          </>
        )}

      </div>
    </div>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function MemberDetail() {
  const params = useParams();
  const id = params.id ? parseInt(params.id, 10) : 0;
  const [familyView, setFamilyView] = useState<"list" | "tree">("list");

  const { data: member, isLoading, error } = useGetCommunityMember(id, {
    query: {
      enabled: !!id,
      queryKey: getGetCommunityMemberQueryKey(id)
    }
  });

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
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Network className="h-5 w-5 text-primary" /> Family Connections
                </CardTitle>
                <div className="flex rounded-md overflow-hidden border border-border text-[10px] font-semibold shrink-0">
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
