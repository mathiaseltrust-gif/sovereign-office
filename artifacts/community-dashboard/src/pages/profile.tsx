import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { getSovereignSession } from "@/lib/utils";
import { Loader2, Bell, Mail, Shield, User, Lock, ExternalLink } from "lucide-react";

const EMAIL_NOTIFICATION_TOGGLES = [
  { key: "emailOnFamilyGovernance", label: "Family Governance" },
  { key: "emailOnWelfareUpdate", label: "Welfare Updates" },
  { key: "emailOnTrustInstrument", label: "Trust Instruments" },
  { key: "emailOnRecorderFiling", label: "Recorder Filings" },
  { key: "emailOnCourtHearing", label: "Court & Calendar Events" },
  { key: "emailOnTribalAnnouncement", label: "Tribal Announcements" },
  { key: "emailOnTaskAssigned", label: "Task Assignments" },
  { key: "emailOnComplaintUpdate", label: "Complaint Updates" },
  { key: "emailOnDirectMessage", label: "Direct Messages" },
  { key: "emailOnLineageReview", label: "Lineage Review" },
  { key: "emailOnLineageApproved", label: "Lineage Approved" },
  { key: "emailOnLineageRejected", label: "Lineage Updates" },
  { key: "emailOnEnrollmentGranted", label: "Enrollment Granted" },
];

function getCommunityAuthToken(): string | null {
  try {
    const raw = localStorage.getItem("sovereign_auth_v3");
    if (raw) {
      const s = JSON.parse(raw) as { sessionToken?: string };
      if (s.sessionToken) return s.sessionToken;
    }
  } catch { /* ignore */ }
  return null;
}

export default function ProfilePage() {
  const { toast } = useToast();
  const session = getSovereignSession();

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [notifPrefs, setNotifPrefs] = useState<Record<string, boolean>>({});
  const [apiAvailable, setApiAvailable] = useState(false);

  const initials = session?.name?.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2) ?? "?";

  useEffect(() => {
    (async () => {
      setIsLoading(true);
      const token = getCommunityAuthToken();
      if (!token) {
        setApiAvailable(false);
        setIsLoading(false);
        return;
      }
      try {
        const r = await fetch("/api/user/profile", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (r.ok) {
          const d = await r.json();
          const prefs = (d.profile?.notificationPreferences ?? {}) as Record<string, boolean>;
          setNotifPrefs(prefs);
          setApiAvailable(true);
        } else {
          setApiAvailable(false);
        }
      } catch {
        setApiAvailable(false);
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const handleSave = async () => {
    const token = getCommunityAuthToken();
    if (!token) return;
    setIsSaving(true);
    try {
      const r = await fetch("/api/user/profile", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ notificationPreferences: notifPrefs }),
      });
      if (r.ok) {
        toast({ title: "Preferences saved", description: "Your notification settings have been updated." });
      } else {
        toast({ title: "Save failed", description: "Please try again.", variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "Network error.", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const masterEmailOn = notifPrefs.email ?? false;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">My Profile</h1>
        <p className="text-sm text-muted-foreground mt-1">Your membership record and notification preferences.</p>
      </div>

      <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
        <div className="bg-primary/5 px-6 py-6 flex items-center gap-5 border-b border-border">
          <div className="w-14 h-14 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
            <span className="text-lg font-bold text-primary-foreground">{initials}</span>
          </div>
          <div>
            <p className="text-base font-bold text-foreground">{session?.name ?? "Community Member"}</p>
            <p className="text-sm text-muted-foreground">{session?.email}</p>
            <div className="flex flex-wrap gap-1 mt-1">
              {(session?.roles ?? []).map((r) => (
                <span key={r} className="px-2 py-0.5 bg-primary/10 text-primary text-[10px] font-medium rounded-full capitalize">
                  {r.replace(/_/g, " ")}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="divide-y divide-border">
          <div className="flex items-center gap-4 px-6 py-3">
            <Mail className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            <div>
              <p className="text-xs text-muted-foreground">Email</p>
              <p className="text-sm font-medium text-foreground">{session?.email ?? "—"}</p>
            </div>
          </div>
          <div className="flex items-center gap-4 px-6 py-3">
            <User className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            <div>
              <p className="text-xs text-muted-foreground">Member ID</p>
              <p className="text-sm font-medium text-foreground font-mono">{session?.id ?? "—"}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
        <div className="flex items-center gap-3 px-5 py-4 border-b border-border">
          <Bell className="w-4 h-4 text-primary" />
          <div>
            <h2 className="text-sm font-semibold text-foreground">Email Notification Preferences</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Choose which events trigger an email to your inbox.</p>
          </div>
        </div>

        {isLoading ? (
          <div className="px-5 py-6 flex items-center gap-2 text-muted-foreground text-sm">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading preferences…
          </div>
        ) : !apiAvailable ? (
          <div className="px-5 py-6 space-y-3">
            <div className="rounded-lg border border-border bg-muted/30 px-4 py-3 flex items-start gap-3">
              <ExternalLink className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-foreground">Sign in via the Sovereign Office Dashboard to manage notification preferences</p>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  Full notification settings are available when you access this platform through the Sovereign Office Dashboard. Your session token is required to save preferences securely.
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="px-5 py-5 space-y-5">
            <label className="flex items-center justify-between gap-3 cursor-pointer">
              <div className="flex items-center gap-2.5">
                <Mail className="h-4 w-4 text-primary shrink-0" />
                <div>
                  <p className="text-sm font-medium text-foreground">Receive notification emails</p>
                  <p className="text-xs text-muted-foreground">Master switch — turn off to stop all non-critical emails.</p>
                </div>
              </div>
              <input
                type="checkbox"
                className="w-4 h-4 accent-primary shrink-0"
                checked={masterEmailOn}
                onChange={(e) => setNotifPrefs((p) => ({ ...p, email: e.target.checked }))}
              />
            </label>

            <div className="rounded-lg border border-border bg-muted/30 px-3 py-2.5 flex items-start gap-2">
              <Lock className="h-3.5 w-3.5 text-amber-600 shrink-0 mt-0.5" />
              <p className="text-xs text-muted-foreground leading-relaxed">
                <strong className="text-foreground">TRO alerts and red-flag alerts</strong> are always delivered by email — they cannot be turned off.
              </p>
            </div>

            {masterEmailOn && (
              <div className="space-y-1 pt-1">
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-3">Per-category settings</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {EMAIL_NOTIFICATION_TOGGLES.map((toggle) => (
                    <label key={toggle.key} className="flex items-center gap-2.5 cursor-pointer rounded-md px-2.5 py-2 hover:bg-muted/50 transition-colors">
                      <input
                        type="checkbox"
                        className="w-3.5 h-3.5 accent-primary shrink-0"
                        checked={notifPrefs[toggle.key] !== false}
                        onChange={(e) => setNotifPrefs((p) => ({ ...p, [toggle.key]: e.target.checked }))}
                      />
                      <span className="text-sm text-foreground">{toggle.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            <div className="flex items-center gap-3 pt-2 border-t border-border">
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-60"
              >
                {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
                Save Preferences
              </button>
              <p className="text-xs text-muted-foreground">Changes take effect on the next notification.</p>
            </div>
          </div>
        )}
      </div>

      <div className="bg-card border border-border rounded-xl shadow-sm">
        <div className="flex items-center gap-3 px-5 py-4 border-b border-border">
          <Shield className="w-4 h-4 text-primary" />
          <h2 className="text-sm font-semibold text-foreground">Tribal Standing</h2>
        </div>
        <div className="px-5 py-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-2 h-2 rounded-full bg-green-500" />
            <p className="text-sm font-medium text-foreground">Active Member — Mathias El Tribe</p>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Your membership is recognized under the sovereign authority of the Mathias El Tribe. For changes to your membership record, contact the Office of the Chief Justice & Trustee.
          </p>
        </div>
      </div>

      <div className="text-center pt-2">
        <p className="text-xs text-muted-foreground">
          Mathias El Tribe — A Sovereign Nation Exercising Inherent Authority Under Tribal, Federal, and International Law.
        </p>
      </div>
    </div>
  );
}
