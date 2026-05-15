import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useAuth, getCurrentBearerToken } from "@/components/auth-provider";
import { DelegationPanel } from "@/components/DelegationPanel";
import { KayaChat } from "@/components/ki-chat";
import { DocumentIntakePanel } from "@/components/DocumentIntakePanel";
import { Link } from "wouter";
import {
  Mic, MicOff, CheckCircle2, XCircle, Loader2, Bot,
  CalendarDays, FileText, Shield, Archive, Bell, Scale,
  ClipboardList, Search, Users, Building2, Gavel, Layers,
  Printer, Workflow, ChevronRight, AlertTriangle, Wifi,
  User, Upload, Camera, Lock, Eye, EyeOff, ShieldCheck, MapPin,
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
    key: "mailingAddress",
    label: "Mailing Address",
    question: "What is your mailing address? This will appear on official documents, trust instruments, and filings.",
    placeholder: "Street, City, State, ZIP",
  },
  {
    key: "apn",
    label: "APN (Assessor's Parcel Number)",
    question: "What is the Assessor's Parcel Number for your primary land? This is used in trust instruments, LEN confirmations, and land status filings.",
    placeholder: "e.g. 123-456-789-000",
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

  /* photo state */
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);

  /* vault state — we never store actual values client-side after save */
  const [vaultHas, setVaultHas] = useState({ dob: false, address: false, email: false, ssn: false });
  const [vaultFields, setVaultFields] = useState({ dateOfBirth: "", address: "", preferredContact: "email", contactEmail: "", ssn: "" });
  const [isSavingVault, setIsSavingVault] = useState(false);
  const [vaultRevealFields, setVaultRevealFields] = useState({ dateOfBirth: false, address: false, contactEmail: false, ssn: false });

  /* field state */
  const [fields, setFields] = useState({
    legalName: "",
    preferredName: "",
    tribalName: "",
    nickname: "",
    title: "",
    familyGroup: "",
    mailingAddress: "",
    apn: "",
    bio: "",
    preferredJurisdiction: "",
  });
  const [landStatus, setLandStatus] = useState("");
  const [hasRecordedInstrument, setHasRecordedInstrument] = useState(false);
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
            mailingAddress: p.mailingAddress ?? "",
            apn: p.apn ?? "",
            bio: p.bio ?? "",
            preferredJurisdiction: p.preferredJurisdiction ?? "",
          });
          setLandStatus(p.landStatus ?? "");
          setHasRecordedInstrument(p.hasRecordedInstrument ?? false);
          setNotifPrefs((p.notificationPreferences as Record<string, boolean>) ?? {});
          if ((d.identity as any)?.profilePhoto) {
            setPhotoUrl((d.identity as any).profilePhoto);
          }
        }

        /* load vault presence (never returns actual values) */
        const vr = await fetch("/api/user/vault", {
          headers: { Authorization: `Bearer ${getCurrentBearerToken() ?? ""}` },
        });
        if (vr.ok) {
          const vd = await vr.json();
          setVaultHas({ dob: vd.hasDob, address: vd.hasAddress, email: vd.hasEmail, ssn: vd.hasSsn });
          if (vd.preferredContact) {
            setVaultFields((prev) => ({ ...prev, preferredContact: vd.preferredContact }));
          }
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

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) {
      toast({ title: "File too large", description: "Please choose a photo under 8 MB.", variant: "destructive" });
      return;
    }
    setIsUploadingPhoto(true);
    try {
      const formData = new FormData();
      formData.append("photo", file);
      const r = await fetch("/api/identity/photo", {
        method: "POST",
        headers: { Authorization: `Bearer ${getCurrentBearerToken() ?? ""}` },
        body: formData,
      });
      if (r.ok) {
        const reader = new FileReader();
        reader.onload = (ev) => setPhotoUrl(ev.target?.result as string);
        reader.readAsDataURL(file);
        toast({ title: "Photo saved", description: "Your profile photo has been updated in the database." });
      } else {
        const err = await r.json().catch(() => ({}));
        toast({ title: "Upload failed", description: err.error ?? "Please try again.", variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "Network error uploading photo.", variant: "destructive" });
    } finally {
      setIsUploadingPhoto(false);
      if (photoInputRef.current) photoInputRef.current.value = "";
    }
  };

  const handleVaultSave = async () => {
    if (!vaultFields.contactEmail && !vaultHas.email) {
      toast({ title: "Email required", description: "A contact email address is required in the vault.", variant: "destructive" });
      return;
    }
    setIsSavingVault(true);
    try {
      const body: Record<string, string> = {
        preferredContact: vaultFields.preferredContact,
      };
      if (vaultFields.dateOfBirth.trim()) body.dateOfBirth = vaultFields.dateOfBirth.trim();
      if (vaultFields.address.trim()) body.address = vaultFields.address.trim();
      if (vaultFields.contactEmail.trim()) body.contactEmail = vaultFields.contactEmail.trim();
      if (vaultFields.ssn.trim()) body.ssn = vaultFields.ssn.trim();

      const r = await fetch("/api/user/vault", {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${getCurrentBearerToken() ?? ""}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });
      if (r.ok) {
        const vd = await r.json();
        setVaultHas({ dob: vd.hasDob, address: vd.hasAddress, email: vd.hasEmail, ssn: vd.hasSsn });
        setVaultFields((prev) => ({ ...prev, dateOfBirth: "", address: "", contactEmail: "", ssn: "" }));
        setVaultRevealFields({ dateOfBirth: false, address: false, contactEmail: false, ssn: false });
        toast({ title: "Vault saved", description: "Your personal information has been securely stored." });
      } else {
        const err = await r.json().catch(() => ({}));
        toast({ title: "Save failed", description: err.error ?? "Please try again.", variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "Network error saving vault.", variant: "destructive" });
    } finally {
      setIsSavingVault(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const r = await fetch("/api/user/profile", {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${getCurrentBearerToken() ?? ""}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ ...fields, landStatus, hasRecordedInstrument, notificationPreferences: notifPrefs }),
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

      {/* ── Tribal Court Seals — top of office (trustee only) ── */}
      {isChief && (
        <div className="flex items-center justify-center gap-8 pb-5 mb-2 border-b border-border">
          <img
            src={`${import.meta.env.BASE_URL}supreme-court-seal-color.png`}
            alt="The Mathias El Tribe Supreme Court"
            className="w-28 h-28 object-contain drop-shadow-md"
          />
          <div className="text-center">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-0.5">Mathias El Tribe</p>
            <h2 className="font-serif text-lg font-bold text-primary leading-tight">Supreme Court</h2>
            <p className="text-[10px] text-muted-foreground mt-0.5">Office of the Chief Justice &amp; Trustee</p>
          </div>
          <img
            src={`${import.meta.env.BASE_URL}chief-justice-seal.png`}
            alt="Chief Mathias El — Office of the Chief Justice and Trustee"
            className="w-20 h-20 object-contain drop-shadow-md"
          />
        </div>
      )}

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

      {/* ── Profile Photo ── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm uppercase tracking-widest flex items-center gap-2">
            <Camera className="h-4 w-4 text-primary" />
            Profile Photo
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Stored in the database alongside your identity record. Used on your Tribal ID card and official documents.
          </p>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-6">
            {/* Photo preview */}
            <div
              className="relative w-24 h-24 rounded-full border-2 border-border overflow-hidden bg-muted flex items-center justify-center cursor-pointer group shrink-0"
              onClick={() => photoInputRef.current?.click()}
              title="Click to change photo"
            >
              {photoUrl ? (
                <img
                  src={photoUrl}
                  alt="Profile"
                  className="w-full h-full object-cover"
                />
              ) : (
                <User className="h-10 w-10 text-muted-foreground" />
              )}
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-full">
                {isUploadingPhoto
                  ? <Loader2 className="h-5 w-5 text-white animate-spin" />
                  : <Upload className="h-5 w-5 text-white" />
                }
              </div>
            </div>

            {/* Instructions + button */}
            <div className="space-y-2">
              <p className="text-sm text-foreground font-medium">
                {photoUrl ? "Photo on file" : "No photo uploaded yet"}
              </p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Click the photo or the button below to upload. Accepted formats: JPG, PNG, WebP. Max 8 MB.
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isUploadingPhoto}
                onClick={() => photoInputRef.current?.click()}
                className="h-8 text-xs"
              >
                {isUploadingPhoto ? (
                  <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> Uploading…</>
                ) : (
                  <><Upload className="h-3.5 w-3.5 mr-1.5" /> {photoUrl ? "Change Photo" : "Upload Photo"}</>
                )}
              </Button>
            </div>
          </div>

          {/* Hidden file input */}
          <input
            ref={photoInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={handlePhotoChange}
          />
        </CardContent>
      </Card>

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

      {/* ── Land & Property ── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm uppercase tracking-widest flex items-center gap-2">
            <MapPin className="h-4 w-4 text-primary" />
            Land &amp; Property Status
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-0.5">
            Used in trust instruments, LEN confirmations, BIA land status filings, and recorded documents.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wider">Land Status</Label>
              <Select value={landStatus || "__none__"} onValueChange={v => setLandStatus(v === "__none__" ? "" : v)}>
                <SelectTrigger className="text-sm">
                  <SelectValue placeholder="Select land status…" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Not specified</SelectItem>
                  <SelectItem value="trust">Indian Trust Land (25 U.S.C. § 5108)</SelectItem>
                  <SelectItem value="allotment">Allotment (restricted fee)</SelectItem>
                  <SelectItem value="fee">Fee Simple</SelectItem>
                  <SelectItem value="restricted">Restricted Indian Land</SelectItem>
                  <SelectItem value="none">No land interest on file</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-[10px] text-muted-foreground">Classification auto-populates trust instruments and LEN documents.</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="apn-field" className="text-xs font-semibold uppercase tracking-wider">APN (Assessor's Parcel Number)</Label>
              <Input
                id="apn-field"
                value={fields.apn}
                onChange={e => setFields(f => ({ ...f, apn: e.target.value }))}
                placeholder="e.g. 123-456-789-000"
                className="text-sm font-mono"
              />
              <p className="text-[10px] text-muted-foreground">Auto-fills trust deeds, recorder filings, and property instruments.</p>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="mailing-address-field" className="text-xs font-semibold uppercase tracking-wider">Mailing Address</Label>
            <Input
              id="mailing-address-field"
              value={fields.mailingAddress}
              onChange={e => setFields(f => ({ ...f, mailingAddress: e.target.value }))}
              placeholder="Street, City, State, ZIP"
              className="text-sm"
            />
            <p className="text-[10px] text-muted-foreground">Appears on court filings, trust instruments, and official correspondence.</p>
          </div>
          <label className="flex items-center gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              className="w-4 h-4 accent-primary"
              checked={hasRecordedInstrument}
              onChange={e => setHasRecordedInstrument(e.target.checked)}
            />
            <div>
              <span className="text-sm font-medium">Recorded instrument on file</span>
              <p className="text-[10px] text-muted-foreground mt-0.5">Check if a deed, allotment, or trust document has been recorded with the county recorder or BIA.</p>
            </div>
          </label>
        </CardContent>
      </Card>

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

      {/* ── Personal Information Vault ── */}
      <Card className="border-2 border-[#1C2B4B]/20 bg-gradient-to-br from-slate-50 to-blue-50/30">
        <CardHeader className="pb-3">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-[#1C2B4B]/10 shrink-0 mt-0.5">
              <Lock className="h-4 w-4 text-[#1C2B4B]" />
            </div>
            <div className="flex-1">
              <CardTitle className="text-sm uppercase tracking-widest flex items-center gap-2">
                Personal Information Vault
                <ShieldCheck className="h-4 w-4 text-green-600" />
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                All information stored here is <strong>encrypted and confidential</strong>. It is only accessed for administrative processes, emergency situations, or official document generation. Fields are never displayed in cleartext — even while typing.
              </p>
            </div>
          </div>

          {/* Status indicators */}
          <div className="flex flex-wrap gap-2 mt-3">
            {[
              { label: "Date of Birth", has: vaultHas.dob },
              { label: "Address", has: vaultHas.address },
              { label: "Contact Email", has: vaultHas.email },
              { label: "SSN", has: vaultHas.ssn },
            ].map(({ label, has }) => (
              <span
                key={label}
                className={`inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full border ${
                  has
                    ? "bg-green-50 text-green-700 border-green-200"
                    : "bg-amber-50 text-amber-700 border-amber-200"
                }`}
              >
                {has ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                {label}
              </span>
            ))}
          </div>
        </CardHeader>

        <CardContent className="space-y-5">
          {/* Notice */}
          <div className="flex items-start gap-2.5 p-3 rounded-lg bg-[#1C2B4B]/6 border border-[#1C2B4B]/15">
            <Shield className="h-4 w-4 text-[#1C2B4B] shrink-0 mt-0.5" />
            <p className="text-[11px] text-[#1C2B4B]/80 leading-relaxed">
              To update a field, type the new value and click <strong>Save Vault</strong>. Leaving a field blank keeps the existing stored value. What you type is hidden for your protection.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

            {/* Date of Birth */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                Date of Birth
                {vaultHas.dob && <CheckCircle2 className="h-3 w-3 text-green-500" />}
              </Label>
              <p className="text-[10px] text-muted-foreground">Enter MM/DD/YYYY — stored encrypted, never shown.</p>
              <div className="relative">
                <Input
                  type={vaultRevealFields.dateOfBirth ? "text" : "password"}
                  placeholder={vaultHas.dob ? "•••••••••• (on file — type to update)" : "MM/DD/YYYY"}
                  value={vaultFields.dateOfBirth}
                  onChange={(e) => setVaultFields((p) => ({ ...p, dateOfBirth: e.target.value }))}
                  className="text-sm h-9 pr-9 font-mono"
                  autoComplete="off"
                />
                <button
                  type="button"
                  onClick={() => setVaultRevealFields((p) => ({ ...p, dateOfBirth: !p.dateOfBirth }))}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  title={vaultRevealFields.dateOfBirth ? "Hide" : "Reveal while typing"}
                >
                  {vaultRevealFields.dateOfBirth ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </button>
              </div>
            </div>

            {/* Preferred Contact Method */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-foreground">Preferred Contact Method</Label>
              <p className="text-[10px] text-muted-foreground">How should officials reach you in administrative matters?</p>
              <select
                value={vaultFields.preferredContact}
                onChange={(e) => setVaultFields((p) => ({ ...p, preferredContact: e.target.value }))}
                className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="email">Email</option>
                <option value="phone">Phone</option>
                <option value="mail">Postal Mail</option>
                <option value="in-person">In Person</option>
              </select>
            </div>

            {/* Contact Email */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                Contact Email <span className="text-red-500">*</span>
                {vaultHas.email && <CheckCircle2 className="h-3 w-3 text-green-500" />}
              </Label>
              <p className="text-[10px] text-muted-foreground">Required. Used for official correspondence only.</p>
              <div className="relative">
                <Input
                  type={vaultRevealFields.contactEmail ? "text" : "password"}
                  placeholder={vaultHas.email ? "•••••••••• (on file — type to update)" : "you@example.com"}
                  value={vaultFields.contactEmail}
                  onChange={(e) => setVaultFields((p) => ({ ...p, contactEmail: e.target.value }))}
                  className="text-sm h-9 pr-9 font-mono"
                  autoComplete="off"
                />
                <button
                  type="button"
                  onClick={() => setVaultRevealFields((p) => ({ ...p, contactEmail: !p.contactEmail }))}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  title={vaultRevealFields.contactEmail ? "Hide" : "Reveal while typing"}
                >
                  {vaultRevealFields.contactEmail ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </button>
              </div>
            </div>

            {/* SSN */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                Social Security Number
                {vaultHas.ssn && <CheckCircle2 className="h-3 w-3 text-green-500" />}
              </Label>
              <p className="text-[10px] text-muted-foreground">Optional. Stored encrypted. Used only in certified administrative situations.</p>
              <div className="relative">
                <Input
                  type={vaultRevealFields.ssn ? "text" : "password"}
                  placeholder={vaultHas.ssn ? "••••••••• (on file — type to update)" : "9 digits, no dashes"}
                  value={vaultFields.ssn}
                  onChange={(e) => setVaultFields((p) => ({ ...p, ssn: e.target.value }))}
                  className="text-sm h-9 pr-9 font-mono"
                  autoComplete="off"
                  maxLength={11}
                />
                <button
                  type="button"
                  onClick={() => setVaultRevealFields((p) => ({ ...p, ssn: !p.ssn }))}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  title={vaultRevealFields.ssn ? "Hide" : "Reveal while typing"}
                >
                  {vaultRevealFields.ssn ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </button>
              </div>
            </div>

            {/* Address — full width */}
            <div className="md:col-span-2 space-y-1.5">
              <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                Mailing / Home Address
                {vaultHas.address && <CheckCircle2 className="h-3 w-3 text-green-500" />}
              </Label>
              <p className="text-[10px] text-muted-foreground">Full address including city, state, and ZIP. Stored encrypted — hidden while typing.</p>
              <div className="relative">
                <Input
                  type={vaultRevealFields.address ? "text" : "password"}
                  placeholder={vaultHas.address ? "•••••••••• (on file — type to update)" : "Street, City, State, ZIP"}
                  value={vaultFields.address}
                  onChange={(e) => setVaultFields((p) => ({ ...p, address: e.target.value }))}
                  className="text-sm h-9 pr-9 font-mono"
                  autoComplete="off"
                />
                <button
                  type="button"
                  onClick={() => setVaultRevealFields((p) => ({ ...p, address: !p.address }))}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  title={vaultRevealFields.address ? "Hide" : "Reveal while typing"}
                >
                  {vaultRevealFields.address ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </button>
              </div>
            </div>

          </div>

          {/* Save vault */}
          <div className="flex items-center gap-3 pt-1 border-t border-[#1C2B4B]/10">
            <Button
              onClick={handleVaultSave}
              disabled={isSavingVault}
              className="bg-[#1C2B4B] hover:bg-[#2a3d6e] text-white min-w-[140px]"
            >
              {isSavingVault
                ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Saving…</>
                : <><Lock className="h-4 w-4 mr-2" /> Save Vault</>
              }
            </Button>
            <p className="text-[10px] text-muted-foreground">
              Data is encrypted at rest. Access is logged and restricted to authorized administrative processes only.
            </p>
          </div>
        </CardContent>
      </Card>

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

      {/* ── Document Review — sovereign intake + Kaya findings ── */}
      <DocumentIntakePanel />

      {/* ── Kaya — Personal Sovereign Companion ── */}
      <KayaChat />
    </div>
  );
}
