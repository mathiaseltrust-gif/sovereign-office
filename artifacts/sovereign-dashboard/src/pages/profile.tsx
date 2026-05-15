import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useAuth, getCurrentBearerToken } from "@/components/auth-provider";
import { DelegationPanel } from "@/components/DelegationPanel";
import { Link } from "wouter";
import {
  Mic, MicOff, CheckCircle2, XCircle, Loader2, Bot,
  CalendarDays, FileText, Shield, Archive, Bell, Scale,
  ClipboardList, Search, Users, Building2, Gavel, Layers,
  Printer, Workflow, ChevronRight, AlertTriangle, Wifi,
} from "lucide-react";

/* ── types ── */
interface ProfileData {
  user: Record<string, any>;
  profile: Record<string, any> | null;
  identity: Record<string, any> | null;
  tasks: any[];
  calendarEvents: any[];
  aiPreferences: any[];
  recommendations: string[];
}

/* ── voice input hook ── */
function useVoiceMic(onTranscript: (t: string) => void) {
  const [listening, setListening] = useState(false);
  const recRef = useRef<any>(null);
  const supported = typeof window !== "undefined" &&
    ("SpeechRecognition" in window || "webkitSpeechRecognition" in window);

  const start = useCallback(() => {
    const SR = (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition;
    if (!SR) return;
    const rec = new SR();
    rec.continuous = false;
    rec.interimResults = false;
    rec.lang = "en-US";
    rec.onresult = (e: any) => {
      const t = e.results[0]?.[0]?.transcript ?? "";
      if (t) onTranscript(t);
      setListening(false);
    };
    rec.onerror = () => setListening(false);
    rec.onend = () => setListening(false);
    rec.start();
    recRef.current = rec;
    setListening(true);
  }, [onTranscript]);

  const stop = useCallback(() => {
    recRef.current?.stop();
    setListening(false);
  }, []);

  return { supported, listening, start, stop };
}

/* ── voice mic button ── */
function VoiceMicBtn({ onTranscript }: { onTranscript: (t: string) => void }) {
  const { supported, listening, start, stop } = useVoiceMic(onTranscript);
  if (!supported) return null;
  return (
    <button
      type="button"
      onClick={listening ? stop : start}
      title={listening ? "Stop listening" : "Speak your answer"}
      className={`ml-1.5 p-1.5 rounded-full transition-all shrink-0 ${
        listening
          ? "bg-red-100 text-red-600 animate-pulse ring-2 ring-red-300"
          : "text-muted-foreground hover:text-primary hover:bg-muted"
      }`}
    >
      {listening ? <MicOff className="h-3.5 w-3.5" /> : <Mic className="h-3.5 w-3.5" />}
    </button>
  );
}

/* ── ai-guided intake field ── */
interface IntakeFieldProps {
  question: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  multiline?: boolean;
}
function IntakeField({ question, label, value, onChange, placeholder, multiline }: IntakeFieldProps) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-start gap-1.5 text-[11px] text-primary/70 italic leading-snug">
        <Bot className="h-3 w-3 mt-0.5 shrink-0 text-primary/50" />
        <span>{question}</span>
      </div>
      <div className="flex items-start gap-1">
        <Label className="sr-only">{label}</Label>
        {multiline ? (
          <Textarea
            className="text-sm min-h-[72px] resize-none"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder ?? label}
          />
        ) : (
          <Input
            className="text-sm h-9"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder ?? label}
          />
        )}
        <VoiceMicBtn onTranscript={(t) => onChange(value ? `${value} ${t}` : t)} />
      </div>
    </div>
  );
}

/* ── smoke check bar ── */
function SmokeCheckBar() {
  const { data, isLoading } = useQuery({
    queryKey: ["smoke-check"],
    queryFn: async () => {
      const token = getCurrentBearerToken() ?? "";
      const h = { Authorization: `Bearer ${token}` };
      const [verifyRes, calRes] = await Promise.allSettled([
        fetch("/api/membership/verify", { headers: h }),
        fetch("/api/calendar", { headers: h }),
      ]);
      const verify = verifyRes.status === "fulfilled" && verifyRes.value.ok
        ? await verifyRes.value.json().catch(() => null)
        : null;
      const calOk = calRes.status === "fulfilled" && calRes.value.ok;
      return {
        entraOk: verify?.entraVerified ?? false,
        memberOk: verify?.membershipVerified ?? false,
        calendarOk: calOk,
        aiOk: verify !== null,
      };
    },
    staleTime: 2 * 60_000,
    retry: false,
  });

  const Dot = ({ ok, label }: { ok: boolean | undefined; label: string }) => (
    <div className="flex items-center gap-1 text-[10px]">
      {isLoading
        ? <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
        : ok
          ? <CheckCircle2 className="h-3 w-3 text-green-500" />
          : <XCircle className="h-3 w-3 text-red-400" />
      }
      <span className={`font-medium uppercase tracking-widest ${ok ? "text-green-700" : "text-red-500"}`}>{label}</span>
    </div>
  );

  return (
    <div className="flex items-center gap-4 flex-wrap px-3 py-2 rounded-lg bg-muted/50 border border-border text-[10px]">
      <Wifi className="h-3 w-3 text-muted-foreground shrink-0" />
      <Dot ok={data?.aiOk} label="AI" />
      <Dot ok={data?.entraOk} label="Entra" />
      <Dot ok={data?.calendarOk} label="Calendar" />
      <Dot ok={data?.memberOk} label="Member Verify" />
      {!isLoading && (!data?.entraOk || !data?.calendarOk) && (
        <span className="text-amber-600 text-[10px]">
          <AlertTriangle className="h-3 w-3 inline mr-0.5" />
          Some services may need attention
        </span>
      )}
    </div>
  );
}

/* ── chief quick links ── */
const CHIEF_LINKS = [
  { label: "Sovereign Pipeline", href: "/sovereign-pipeline", icon: Workflow, color: "text-[#8B0000]" },
  { label: "AI Intake", href: "/intake-ai", icon: Bot, color: "text-purple-700" },
  { label: "My Office", href: "/my-office", icon: Archive, color: "text-[#1C2B4B]" },
  { label: "Court Filings", href: "/filings", icon: Gavel, color: "text-amber-700" },
  { label: "Official Docs", href: "/official-documents", icon: Printer, color: "text-slate-700" },
  { label: "Instruments", href: "/instruments", icon: Scale, color: "text-emerald-700" },
  { label: "Court Docs", href: "/documents", icon: FileText, color: "text-blue-700" },
  { label: "NFR", href: "/nfr", icon: Shield, color: "text-red-700" },
  { label: "Calendar", href: "/calendar", icon: CalendarDays, color: "text-sky-700" },
  { label: "Notifications", href: "/notifications", icon: Bell, color: "text-orange-700" },
  { label: "Tasks", href: "/tasks", icon: ClipboardList, color: "text-teal-700" },
  { label: "Tribal Trust", href: "/tribal-trust", icon: Building2, color: "text-stone-700" },
  { label: "Tribal ID", href: "/tribal-id", icon: Layers, color: "text-indigo-700" },
  { label: "Members", href: "/admin", icon: Users, color: "text-slate-600" },
  { label: "Classify", href: "/classify", icon: Search, color: "text-cyan-700" },
];

function ChiefQuickLinks() {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm uppercase tracking-widest">Chief Office — Quick Access</CardTitle>
        <p className="text-xs text-muted-foreground">All tools available to the Office of the Chief Justice.</p>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
          {CHIEF_LINKS.map(({ label, href, icon: Icon, color }) => (
            <Link key={href} href={href}>
              <div className="flex flex-col items-center gap-1.5 p-2.5 rounded-lg border border-border hover:border-primary/40 hover:bg-muted/60 transition-all cursor-pointer group text-center">
                <Icon className={`h-5 w-5 ${color} group-hover:scale-110 transition-transform`} />
                <span className="text-[10px] font-medium text-foreground leading-tight">{label}</span>
              </div>
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

/* ── notification preferences ── */
const NOTIFICATION_CHANNELS = [
  { key: "familyGovernance", label: "Family Governance" },
  { key: "welfareUpdates", label: "Welfare Updates" },
  { key: "trustInstruments", label: "Trust Instruments" },
  { key: "recorderFilings", label: "Recorder Filings" },
  { key: "courtHearings", label: "Court Hearings" },
  { key: "tribalAnnouncements", label: "Tribal Announcements" },
  { key: "email", label: "Email" },
  { key: "push", label: "Push" },
];

/* ── ai intake questions ── */
const INTAKE_QUESTIONS = [
  {
    key: "legalName",
    label: "Legal Name",
    question: "What is your full legal name exactly as it should appear in court documents, trust filings, and official captions?",
    placeholder: "Full legal name",
  },
  {
    key: "preferredName",
    label: "Preferred Name",
    question: "How would you like to be addressed within the dashboard — your preferred or display name?",
    placeholder: "Preferred or display name",
  },
  {
    key: "tribalName",
    label: "Tribal / Ceremonial Name",
    question: "Do you have a tribal or ceremonial name you'd like on file with the court?",
    placeholder: "Tribal or ceremonial name",
  },
  {
    key: "nickname",
    label: "Nickname",
    question: "Do you go by any informal name or nickname within the community?",
    placeholder: "Informal name",
  },
  {
    key: "title",
    label: "Title",
    question: "What is your official title or honorific — for example, Chief Justice, Honorable, Trustee, or Elder?",
    placeholder: "e.g. Chief Justice, Elder",
  },
  {
    key: "familyGroup",
    label: "Family / Clan Group",
    question: "What family or clan group are you part of within the Mathias El Tribe?",
    placeholder: "Family or clan group",
  },
  {
    key: "bio",
    label: "Background",
    question: "Can you briefly describe your role and connection to the tribe? This personalizes your court documents and welfare filings.",
    placeholder: "Brief role or background",
    multiline: true,
  },
  {
    key: "preferredJurisdiction",
    label: "Preferred Jurisdiction",
    question: "Which tribal court district or jurisdiction do you primarily operate within?",
    placeholder: "e.g. Tribal Court, District 1",
  },
];

/* ═══════════════════════════════════════════════════
   Main Page
═══════════════════════════════════════════════════ */
export default function ProfilePage() {
  const { user, activeRole } = useAuth();
  const { toast } = useToast();
  const isChief = activeRole === "trustee";

  const [data, setData] = useState<ProfileData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  /* field state */
  const [fields, setFields] = useState({
    legalName: "",
    preferredName: "",
    tribalName: "",
    nickname: "",
    title: "",
    familyGroup: "",
    bio: "",
    preferredJurisdiction: "",
  });
  const [notifPrefs, setNotifPrefs] = useState<Record<string, boolean>>({});

  /* notifications count */
  const { data: notifications } = useQuery({
    queryKey: ["notifications-count"],
    queryFn: async () => {
      const r = await fetch("/api/notifications", {
        headers: { Authorization: `Bearer ${getCurrentBearerToken() ?? ""}` },
      });
      if (!r.ok) return [];
      return r.json();
    },
    staleTime: 60_000,
  });
  const unreadCount = Array.isArray(notifications)
    ? notifications.filter((n: any) => !n.readAt).length
    : 0;

  useEffect(() => {
    (async () => {
      setIsLoading(true);
      try {
        const r = await fetch("/api/user/profile", {
          headers: { Authorization: `Bearer ${getCurrentBearerToken() ?? ""}` },
        });
        if (r.ok) {
          const d: ProfileData = await r.json();
          setData(d);
          const p = d.profile ?? {};
          setFields({
            legalName: p.legalName ?? "",
            preferredName: p.preferredName ?? "",
            tribalName: p.tribalName ?? "",
            nickname: p.nickname ?? "",
            title: p.title ?? "",
            familyGroup: p.familyGroup ?? "",
            bio: p.bio ?? "",
            preferredJurisdiction: p.preferredJurisdiction ?? "",
          });
          setNotifPrefs((p.notificationPreferences as Record<string, boolean>) ?? {});
        }
      } catch {
        toast({ title: "Error", description: "Could not load profile.", variant: "destructive" });
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const setField = (key: keyof typeof fields) => (val: string) =>
    setFields((prev) => ({ ...prev, [key]: val }));

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const r = await fetch("/api/user/profile", {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${getCurrentBearerToken() ?? ""}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ ...fields, notificationPreferences: notifPrefs }),
      });
      if (r.ok) {
        toast({ title: "Saved", description: "Your identity has been updated." });
      } else {
        const err = await r.json().catch(() => ({}));
        toast({ title: "Save failed", description: err.error ?? "Please try again.", variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "Network error.", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  /* auto-detected tags */
  const profile = data?.profile ?? {};
  const autoTags: { label: string; type: string }[] = [];
  if (Array.isArray(profile.jurisdictionTags))
    profile.jurisdictionTags.forEach((t: string) => autoTags.push({ label: t, type: "jurisdiction" }));
  if (Array.isArray(profile.welfareTags))
    profile.welfareTags.forEach((t: string) => autoTags.push({ label: t, type: "welfare" }));

  /* completion */
  const requiredKeys: (keyof typeof fields)[] = ["legalName", "tribalName", "familyGroup", "bio", "preferredJurisdiction"];
  const missing = requiredKeys.filter((k) => !fields[k]?.trim());
  const completionPct = Math.round(((requiredKeys.length - missing.length) / requiredKeys.length) * 100);

  if (isLoading) {
    return (
      <div className="space-y-4 max-w-4xl">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-5 w-96" />
        <Skeleton className="h-8 w-full" />
        {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-20" />)}
      </div>
    );
  }

  return (
    <div data-testid="page-profile" className="space-y-5 max-w-4xl">

      {/* ── Page title ── */}
      <div>
        <h1 className="text-2xl font-serif font-bold text-foreground">
          {isChief ? "My Office — Profile & Identity" : "Profile & Identity"}
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          {isChief
            ? "Chief Justice & Trustee · Mathias El Tribe Supreme Court"
            : "Unified identity used across welfare instruments, trust filings, and court captions."}
        </p>
      </div>

      {/* ── Smoke check ── */}
      <SmokeCheckBar />

      {/* ── Chief authority banner ── */}
      {isChief && (
        <div className="relative overflow-hidden rounded-xl border-2 border-[#1C2B4B] bg-gradient-to-r from-[#1C2B4B] to-[#2a3d6e] text-white p-4 flex items-center gap-4 shadow-lg">
          <img
            src={`${import.meta.env.BASE_URL}chief-justice-seal.png`}
            alt="Chief Justice Seal"
            className="w-14 h-14 object-contain drop-shadow-xl shrink-0"
          />
          <div className="flex-1 min-w-0">
            <Badge className="bg-green-500 hover:bg-green-500 text-white text-[10px] uppercase tracking-widest px-2 py-0.5 mb-1">
              ● Authority Active
            </Badge>
            <h2 className="font-serif text-sm font-bold leading-tight">Office of the Chief Justice and Trustee</h2>
            <p className="text-xs text-blue-200 mt-0.5">Mathias El Tribe Supreme Court · Sovereign Office</p>
          </div>
          <div className="shrink-0 flex flex-col items-end gap-2">
            <Link href="/my-office">
              <span className="inline-flex items-center gap-1 bg-white/15 hover:bg-white/25 transition-colors text-white text-xs font-semibold px-2.5 py-1.5 rounded-md whitespace-nowrap">
                Document Vault <ChevronRight className="h-3 w-3" />
              </span>
            </Link>
            {unreadCount > 0 && (
              <Link href="/notifications">
                <span className="inline-flex items-center gap-1 bg-orange-500/80 hover:bg-orange-500 transition-colors text-white text-xs font-semibold px-2.5 py-1.5 rounded-md whitespace-nowrap">
                  <Bell className="h-3 w-3" /> {unreadCount} Unread
                </span>
              </Link>
            )}
          </div>
        </div>
      )}

      {/* ── Notifications summary (all roles) ── */}
      {!isChief && unreadCount > 0 && (
        <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-orange-200 bg-orange-50">
          <Bell className="h-4 w-4 text-orange-600 shrink-0" />
          <p className="text-sm text-orange-800 flex-1">
            You have <strong>{unreadCount}</strong> unread notification{unreadCount !== 1 ? "s" : ""}.
          </p>
          <Link href="/notifications">
            <Button size="sm" variant="outline" className="border-orange-300 text-orange-800 hover:bg-orange-100 h-7 text-xs">
              View <ChevronRight className="h-3 w-3 ml-0.5" />
            </Button>
          </Link>
        </div>
      )}

      {/* ── Chief quick links ── */}
      {isChief && <ChiefQuickLinks />}

      {/* ── AI-guided intake form ── */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <CardTitle className="text-sm uppercase tracking-widest flex items-center gap-2">
                <Bot className="h-4 w-4 text-primary" />
                Identity Intake
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                Answer each question below — type or use the microphone to speak your answer.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-24 h-1.5 bg-muted rounded-full">
                <div
                  className={`h-1.5 rounded-full transition-all ${completionPct < 100 ? "bg-amber-400" : "bg-green-500"}`}
                  style={{ width: `${completionPct}%` }}
                />
              </div>
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${completionPct < 100 ? "bg-amber-100 text-amber-800" : "bg-green-100 text-green-800"}`}>
                {completionPct}%
              </span>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5">
            {INTAKE_QUESTIONS.map((q) => (
              <div key={q.key} className={q.multiline ? "md:col-span-2" : ""}>
                <IntakeField
                  question={q.question}
                  label={q.label}
                  value={fields[q.key as keyof typeof fields]}
                  onChange={setField(q.key as keyof typeof fields)}
                  placeholder={q.placeholder}
                  multiline={q.multiline}
                />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* ── Auto-detected tags + resolved identity ── */}
      {(autoTags.length > 0 || data?.identity) && (
        <Card>
          <CardContent className="pt-4 space-y-3">
            {autoTags.length > 0 && (
              <div>
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2">Detected from activity</p>
                <div className="flex flex-wrap gap-1.5">
                  {autoTags.map((tag, i) => (
                    <Badge
                      key={i}
                      variant="secondary"
                      className={`text-[11px] ${
                        tag.type === "jurisdiction" ? "bg-blue-50 text-blue-700 border border-blue-200" :
                        tag.type === "welfare" ? "bg-purple-50 text-purple-700 border border-purple-200" :
                        "bg-green-50 text-green-700 border border-green-200"
                      }`}
                    >
                      {tag.label}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
            {data?.identity && (
              <div className="flex flex-wrap gap-3">
                {(data.identity as any).displayName && (
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-muted-foreground">Display</span>
                    <Badge variant="secondary" className="text-xs">{(data.identity as any).displayName}</Badge>
                  </div>
                )}
                {(data.identity as any).courtCaption && (
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-muted-foreground">Caption</span>
                    <Badge variant="outline" className="text-xs">{(data.identity as any).courtCaption}</Badge>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Notification preferences ── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm uppercase tracking-widest">Notification Preferences</CardTitle>
          <p className="text-xs text-muted-foreground">Red flag and TRO alerts are always delivered.</p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {NOTIFICATION_CHANNELS.map((ch) => (
              <label key={ch.key} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  className="w-4 h-4 accent-primary"
                  checked={notifPrefs[ch.key] ?? true}
                  onChange={(e) => setNotifPrefs((prev) => ({ ...prev, [ch.key]: e.target.checked }))}
                />
                <span className="text-sm">{ch.label}</span>
              </label>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* ── Save ── */}
      <div className="flex items-center gap-3 flex-wrap">
        <Button onClick={handleSave} disabled={isSaving} className="min-w-[140px]">
          {isSaving ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Saving…</> : "Save Identity"}
        </Button>
        <p className="text-xs text-muted-foreground">
          Identity propagates to PDFs, court captions, welfare instruments, and ICWA notices automatically.
        </p>
      </div>

      {/* ── Delegation panel ── */}
      {user?.roles && user.roles.some((r: string) =>
        ["officer", "trustee", "admin", "sovereign_admin", "chief_justice", "elder"].includes(r)
      ) && <DelegationPanel />}

      {/* ── AI recommendations ── */}
      {data?.recommendations && data.recommendations.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm uppercase tracking-widest">AI Recommendations</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {data.recommendations.map((r, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                  <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                  {r}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
