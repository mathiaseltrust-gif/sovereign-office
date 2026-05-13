import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useAuth, getCurrentBearerToken } from "@/components/auth-provider";
import { DelegationPanel } from "@/components/DelegationPanel";

interface ProfileData {
  user: Record<string, any>;
  profile: Record<string, any> | null;
  identity: Record<string, any> | null;
  tasks: any[];
  calendarEvents: any[];
  aiPreferences: any[];
  recommendations: string[];
}

const NOTIFICATION_CHANNELS = [
  { key: "familyGovernance", label: "Family Governance" },
  { key: "welfareUpdates", label: "Welfare Updates" },
  { key: "trustInstruments", label: "Trust Instruments" },
  { key: "recorderFilings", label: "Recorder Filings" },
  { key: "courtHearings", label: "Court Hearings" },
  { key: "tribalAnnouncements", label: "Tribal Announcements" },
  { key: "email", label: "Email Notifications" },
  { key: "push", label: "Push Notifications" },
];

const PROFILE_QUESTIONS = [
  { key: "legalName", label: "Legal Name", question: "What is your full legal name as it should appear in court documents and official filings?" },
  { key: "tribalName", label: "Tribal Name", question: "Do you have a tribal or ceremonial name you would like on file?" },
  { key: "familyGroup", label: "Family Group", question: "What family or clan group are you part of within the Mathias El Tribe?" },
  { key: "bio", label: "Bio", question: "Can you describe your role and connection to the tribe in a few sentences?" },
  { key: "preferredJurisdiction", label: "Preferred Jurisdiction", question: "Which tribal court district or jurisdiction do you primarily work within?" },
];

export default function ProfilePage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [data, setData] = useState<ProfileData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);

  const [legalName, setLegalName] = useState("");
  const [preferredName, setPreferredName] = useState("");
  const [tribalName, setTribalName] = useState("");
  const [nickname, setNickname] = useState("");
  const [title, setTitle] = useState("");
  const [familyGroup, setFamilyGroup] = useState("");
  const [bio, setBio] = useState("");
  const [preferredJurisdiction, setPreferredJurisdiction] = useState("");
  const [notifPrefs, setNotifPrefs] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      try {
        const r = await fetch("/api/user/profile", { headers: { Authorization: `Bearer ${getCurrentBearerToken() ?? ""}` } });
        if (r.ok) {
          const d: ProfileData = await r.json();
          setData(d);
          const p = d.profile ?? {};
          setLegalName(p.legalName ?? "");
          setPreferredName(p.preferredName ?? "");
          setTribalName(p.tribalName ?? "");
          setNickname(p.nickname ?? "");
          setTitle(p.title ?? "");
          setFamilyGroup(p.familyGroup ?? "");
          setBio(p.bio ?? "");
          setPreferredJurisdiction(p.preferredJurisdiction ?? "");
          setNotifPrefs((p.notificationPreferences as Record<string, boolean>) ?? {});
        }
      } catch {
        toast({ title: "Error", description: "Could not load profile.", variant: "destructive" });
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const r = await fetch("/api/user/profile", {
        method: "PUT",
        headers: { Authorization: `Bearer ${getCurrentBearerToken() ?? ""}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          legalName: legalName || undefined,
          preferredName: preferredName || undefined,
          tribalName: tribalName || undefined,
          nickname: nickname || undefined,
          title: title || undefined,
          familyGroup: familyGroup || undefined,
          bio: bio || undefined,
          preferredJurisdiction: preferredJurisdiction || undefined,
          notificationPreferences: notifPrefs,
        }),
      });
      if (r.ok) {
        toast({ title: "Profile Saved", description: "Your identity has been updated." });
      } else {
        const err = await r.json().catch(() => ({}));
        toast({ title: "Save Failed", description: err.error ?? "Please ensure you are registered in the system.", variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "Network error. Try again.", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const autoTags: { label: string; type: "jurisdiction" | "welfare" | "role" }[] = [];
  const profile = data?.profile ?? {};
  if (Array.isArray(profile.jurisdictionTags)) {
    profile.jurisdictionTags.forEach((t: string) => autoTags.push({ label: t, type: "jurisdiction" }));
  }
  if (Array.isArray(profile.welfareTags)) {
    profile.welfareTags.forEach((t: string) => autoTags.push({ label: t, type: "welfare" }));
  }
  if (user?.roles) {
    user.roles.forEach((r: string) => autoTags.push({ label: r.replace(/_/g, " "), type: "role" }));
  }

  const missingFields = PROFILE_QUESTIONS.filter(q => {
    const val = { legalName, tribalName, familyGroup, bio, preferredJurisdiction }[q.key as keyof typeof profile];
    return !val || String(val).trim() === "";
  });

  const completionPct = Math.round(((PROFILE_QUESTIONS.length - missingFields.length) / PROFILE_QUESTIONS.length) * 100);

  const handleAskAI = () => {
    const nextMissing = missingFields[0];
    const prompt = nextMissing
      ? nextMissing.question
      : "Can you review my profile and tell me what else I should add to ensure my documents are complete?";
    const chatBtn = document.querySelector("[data-chat-toggle]") as HTMLButtonElement | null;
    if (chatBtn) {
      chatBtn.click();
      setTimeout(() => {
        const textarea = document.querySelector("[data-chat-input]") as HTMLTextAreaElement | null;
        const sendBtn = document.querySelector("[data-chat-send]") as HTMLButtonElement | null;
        if (textarea && sendBtn) {
          textarea.value = prompt;
          textarea.dispatchEvent(new Event("input", { bubbles: true }));
          setTimeout(() => sendBtn.click(), 100);
        }
      }, 400);
    }
  };

  if (isLoading) return <div className="space-y-4">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-16" />)}</div>;

  return (
    <div data-testid="page-profile" className="space-y-8">
      <div className="mb-6">
        <h1 className="text-3xl font-serif font-bold text-foreground">Profile & Identity</h1>
        <p className="text-muted-foreground mt-1">
          Unified identity used across welfare instruments, trust filings, ICWA notices, TRO declarations, and court captions.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Left: Identity Names */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm uppercase tracking-widest">Identity Names</CardTitle>
            <p className="text-xs text-muted-foreground">Legal name is used in PDFs and court captions. Preferred and tribal name appear in the dashboard.</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Legal Name <span className="text-xs text-muted-foreground">(court caption)</span></Label>
              <Input className="mt-1" value={legalName} onChange={(e) => setLegalName(e.target.value)} placeholder="Full legal name" />
            </div>
            <div>
              <Label>Preferred Name <span className="text-xs text-muted-foreground">(dashboard display)</span></Label>
              <Input className="mt-1" value={preferredName} onChange={(e) => setPreferredName(e.target.value)} placeholder="How you prefer to be addressed" />
            </div>
            <div>
              <Label>Tribal Name <span className="text-xs text-muted-foreground">(shown in tribal contexts)</span></Label>
              <Input className="mt-1" value={tribalName} onChange={(e) => setTribalName(e.target.value)} placeholder="Tribal or ceremonial name" />
            </div>
            <div>
              <Label>Nickname</Label>
              <Input className="mt-1" value={nickname} onChange={(e) => setNickname(e.target.value)} placeholder="Informal name" />
            </div>
            <div>
              <Label>Title <span className="text-xs text-muted-foreground">(prefixed to name in captions)</span></Label>
              <Input className="mt-1" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Chief Justice, Honorable, Trustee" />
            </div>
            <div>
              <Label>Family Group</Label>
              <Input className="mt-1" value={familyGroup} onChange={(e) => setFamilyGroup(e.target.value)} placeholder="Family or clan group" />
            </div>
          </CardContent>
        </Card>

        {/* Right: Context, AI intake, and auto-detected tags */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm uppercase tracking-widest">Context & Background</CardTitle>
              <p className="text-xs text-muted-foreground">Used to personalize documents, route welfare instruments, and pre-fill court filings.</p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Bio</Label>
                <Input className="mt-1" value={bio} onChange={(e) => setBio(e.target.value)} placeholder="Brief role or background description" />
              </div>
              <div>
                <Label>Preferred Jurisdiction</Label>
                <Input className="mt-1" value={preferredJurisdiction} onChange={(e) => setPreferredJurisdiction(e.target.value)} placeholder="e.g. Tribal Court, District 1" />
              </div>
            </CardContent>
          </Card>

          {/* AI Profile Assistant */}
          <Card className={completionPct < 100 ? "border-amber-200 bg-amber-50/40" : "border-green-200 bg-green-50/40"}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm uppercase tracking-widest">
                  {completionPct < 100 ? "Profile Intake" : "Profile Complete"}
                </CardTitle>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${completionPct < 100 ? "bg-amber-100 text-amber-800" : "bg-green-100 text-green-800"}`}>
                  {completionPct}%
                </span>
              </div>
              {/* Completion bar */}
              <div className="w-full h-1.5 bg-muted rounded-full mt-1">
                <div
                  className={`h-1.5 rounded-full transition-all ${completionPct < 100 ? "bg-amber-400" : "bg-green-500"}`}
                  style={{ width: `${completionPct}%` }}
                />
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {missingFields.length > 0 ? (
                <>
                  <p className="text-xs text-muted-foreground">
                    The following information helps generate accurate documents. You can type it above or let the assistant gather it from you conversationally.
                  </p>
                  <div className="space-y-1">
                    {missingFields.map(f => (
                      <div key={f.key} className="flex items-center gap-2 text-xs text-amber-700">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
                        {f.label} not on file
                      </div>
                    ))}
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full border-amber-300 text-amber-800 hover:bg-amber-100 mt-1"
                    onClick={handleAskAI}
                  >
                    Let the assistant ask me
                  </Button>
                </>
              ) : (
                <p className="text-xs text-green-700">All required profile fields are filled in. Your documents will be fully personalized.</p>
              )}

              {/* Auto-detected tags */}
              {autoTags.length > 0 && (
                <div className="pt-2 border-t">
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2">Detected from your activity</p>
                  <div className="flex flex-wrap gap-1">
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
                  <p className="text-[10px] text-muted-foreground mt-1.5">These are set automatically based on your filings, complaints, and role.</p>
                </div>
              )}

              {/* Resolved Identity */}
              {data?.identity && (
                <div className="pt-2 border-t">
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2">Resolved Identity</p>
                  <div className="space-y-1.5">
                    {(data.identity as any).displayName && (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground w-16 shrink-0">Display</span>
                        <Badge variant="secondary" className="text-xs">{(data.identity as any).displayName}</Badge>
                      </div>
                    )}
                    {(data.identity as any).courtCaption && (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground w-16 shrink-0">Caption</span>
                        <Badge variant="outline" className="text-xs">{(data.identity as any).courtCaption}</Badge>
                      </div>
                    )}
                    {(data.identity as any).role && (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground w-16 shrink-0">Role</span>
                        <Badge className="text-xs">{(data.identity as any).role}</Badge>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Notification Preferences */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm uppercase tracking-widest">Notification Preferences</CardTitle>
          <p className="text-xs text-muted-foreground">Red flag and TRO alerts are always delivered regardless of these settings.</p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {NOTIFICATION_CHANNELS.map((ch) => (
              <label key={ch.key} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  className="w-4 h-4"
                  checked={notifPrefs[ch.key] ?? true}
                  onChange={(e) => setNotifPrefs((prev) => ({ ...prev, [ch.key]: e.target.checked }))}
                />
                <span className="text-sm">{ch.label}</span>
              </label>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center gap-3 flex-wrap">
        <Button onClick={handleSave} disabled={isSaving}>
          {isSaving ? "Saving..." : "Save Identity & Preferences"}
        </Button>
        <p className="text-xs text-muted-foreground">
          Identity propagates to PDFs, court captions, welfare instruments, and ICWA notices automatically.
        </p>
      </div>

      {/* Delegation of Authority — shown for officer, trustee, admin, chief_justice, elder roles */}
      {user?.roles && user.roles.some((r: string) =>
        ["officer", "trustee", "admin", "sovereign_admin", "chief_justice", "elder"].includes(r)
      ) && (
        <DelegationPanel />
      )}

      {/* AI Recommendations */}
      {data?.recommendations && data.recommendations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm uppercase tracking-widest">AI Recommendations</CardTitle>
            <p className="text-xs text-muted-foreground">Based on your current profile and activity.</p>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {data.recommendations.map((r, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                  <span className="mt-1 w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
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
