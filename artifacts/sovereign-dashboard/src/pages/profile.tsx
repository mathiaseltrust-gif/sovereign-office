import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/components/auth-provider";

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
  { key: "push", label: "Push Notifications (stub)" },
];

export default function ProfilePage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [data, setData] = useState<ProfileData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const [legalName, setLegalName] = useState("");
  const [preferredName, setPreferredName] = useState("");
  const [tribalName, setTribalName] = useState("");
  const [nickname, setNickname] = useState("");
  const [title, setTitle] = useState("");
  const [familyGroup, setFamilyGroup] = useState("");
  const [bio, setBio] = useState("");
  const [preferredJurisdiction, setPreferredJurisdiction] = useState("");
  const [jurisdictionTags, setJurisdictionTags] = useState("");
  const [welfareTags, setWelfareTags] = useState("");
  const [notifPrefs, setNotifPrefs] = useState<Record<string, boolean>>({});

  const token = btoa(JSON.stringify(user));

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      try {
        const r = await fetch("/api/user/profile", { headers: { Authorization: `Bearer ${token}` } });
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
          setJurisdictionTags(Array.isArray(p.jurisdictionTags) ? p.jurisdictionTags.join(", ") : "");
          setWelfareTags(Array.isArray(p.welfareTags) ? p.welfareTags.join(", ") : "");
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
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          legalName: legalName || undefined,
          preferredName: preferredName || undefined,
          tribalName: tribalName || undefined,
          nickname: nickname || undefined,
          title: title || undefined,
          familyGroup: familyGroup || undefined,
          bio: bio || undefined,
          preferredJurisdiction: preferredJurisdiction || undefined,
          jurisdictionTags: jurisdictionTags ? jurisdictionTags.split(",").map((t) => t.trim()).filter(Boolean) : [],
          welfareTags: welfareTags ? welfareTags.split(",").map((t) => t.trim()).filter(Boolean) : [],
          notificationPreferences: notifPrefs,
        }),
      });
      if (r.ok) {
        toast({ title: "Profile Updated", description: "Your identity and preferences have been saved." });
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

  if (isLoading) return <div className="space-y-4">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-16" />)}</div>;

  return (
    <div data-testid="page-profile" className="space-y-8">
      <div className="mb-6">
        <h1 className="text-3xl font-serif font-bold text-foreground">Profile &amp; Identity</h1>
        <p className="text-muted-foreground mt-1">
          Unified identity used across welfare instruments, trust filings, ICWA notices, TRO declarations, and court captions.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm uppercase tracking-widest">Identity Names</CardTitle>
            <p className="text-xs text-muted-foreground">Legal name is used in PDFs and court captions. Preferred/tribal name appears in the dashboard.</p>
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
              <Label>Title <span className="text-xs text-muted-foreground">(prefixed to legal name in captions)</span></Label>
              <Input className="mt-1" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Chief Justice, Honorable, Trustee" />
            </div>
            <div>
              <Label>Family Group</Label>
              <Input className="mt-1" value={familyGroup} onChange={(e) => setFamilyGroup(e.target.value)} placeholder="Family or clan group" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm uppercase tracking-widest">Jurisdiction &amp; Welfare Tags</CardTitle>
            <p className="text-xs text-muted-foreground">Used for routing welfare instruments, ICWA notices, and calendar events.</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Bio</Label>
              <Input className="mt-1" value={bio} onChange={(e) => setBio(e.target.value)} placeholder="Brief bio or role description" />
            </div>
            <div>
              <Label>Preferred Jurisdiction</Label>
              <Input className="mt-1" value={preferredJurisdiction} onChange={(e) => setPreferredJurisdiction(e.target.value)} placeholder="e.g. Tribal Court, District 1" />
            </div>
            <div>
              <Label>Jurisdiction Tags <span className="text-xs text-muted-foreground">(comma-separated)</span></Label>
              <Input className="mt-1" value={jurisdictionTags} onChange={(e) => setJurisdictionTags(e.target.value)} placeholder="e.g. ICWA, Trust Land, Montana" />
            </div>
            <div>
              <Label>Welfare Tags <span className="text-xs text-muted-foreground">(comma-separated)</span></Label>
              <Input className="mt-1" value={welfareTags} onChange={(e) => setWelfareTags(e.target.value)} placeholder="e.g. ICWA, Medical, Placement" />
            </div>

            {data?.identity && (
              <div className="pt-2 border-t">
                <p className="text-xs text-muted-foreground uppercase tracking-widest mb-2">Resolved Identity</p>
                <div className="space-y-1">
                  <div className="flex flex-wrap gap-1 items-center">
                    <span className="text-xs text-muted-foreground w-20">Display:</span>
                    <Badge variant="secondary" className="text-xs">{(data.identity as any).displayName ?? "—"}</Badge>
                  </div>
                  <div className="flex flex-wrap gap-1 items-center">
                    <span className="text-xs text-muted-foreground w-20">Caption:</span>
                    <Badge variant="outline" className="text-xs">{(data.identity as any).courtCaption ?? "—"}</Badge>
                  </div>
                  <div className="flex flex-wrap gap-1 items-center">
                    <span className="text-xs text-muted-foreground w-20">Role:</span>
                    <Badge className="text-xs">{(data.identity as any).role ?? "—"}</Badge>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm uppercase tracking-widest">Notification Subscriptions</CardTitle>
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
          {isSaving ? "Saving…" : "Save Identity &amp; Preferences"}
        </Button>
        <p className="text-xs text-muted-foreground">
          Identity data propagates to PDFs, court captions, welfare instruments, and ICWA notices.
        </p>
      </div>

      {data?.recommendations && data.recommendations.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-sm uppercase tracking-widest">AI Recommendations</CardTitle></CardHeader>
          <CardContent>
            <ul className="space-y-1">
              {data.recommendations.map((r, i) => (
                <li key={i} className="text-sm text-muted-foreground">• {r}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
