import { useState, useEffect } from "react";
import { Layout } from "@/components/layout";
import { useAuth } from "@/lib/auth";
import { getRoleConfig } from "@/lib/role-config";
import { getAuthToken } from "@/lib/api";
import { UserCircle, Mail, Shield, Scale, Bell, Lock, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

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

export default function MemberProfile() {
  const { user } = useAuth();
  const { toast } = useToast();
  const roles = user?.roles ?? [];
  const config = getRoleConfig(roles);

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [notifPrefs, setNotifPrefs] = useState<Record<string, boolean | string>>({});

  const initials = user?.name
    ?.split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2) ?? "?";

  useEffect(() => {
    (async () => {
      setIsLoading(true);
      try {
        const token = getAuthToken();
        const r = await fetch("/api/user/profile", {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (r.ok) {
          const d = await r.json();
          const prefs = (d.profile?.notificationPreferences ?? {}) as Record<string, boolean | string>;
          setNotifPrefs(prefs);
        }
      } catch {
        /* ignore */
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const token = getAuthToken();
      const r = await fetch("/api/user/profile", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
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

  const masterEmailOn = notifPrefs.email === true;

  return (
    <Layout>
      <div className="p-6 max-w-3xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">My Profile</h1>
          <p className="text-sm text-muted-foreground mt-1">Your tribal membership record and notification preferences.</p>
        </div>

        <div className="bg-card border border-card-border rounded-xl shadow-sm overflow-hidden">
          <div className="bg-sidebar px-6 py-8 flex items-center gap-5 border-b border-sidebar-border">
            <div className="w-16 h-16 rounded-full bg-sidebar-primary flex items-center justify-center flex-shrink-0">
              <span className="text-xl font-bold text-sidebar-primary-foreground">{initials}</span>
            </div>
            <div>
              <p className="text-lg font-bold text-sidebar-foreground">{user?.name}</p>
              <p className="text-sm text-sidebar-primary font-medium">{config.roleLabel}</p>
              <p className="text-xs text-sidebar-foreground/60 mt-0.5">{config.roleSubtitle}</p>
            </div>
          </div>

          <div className="divide-y divide-card-border">
            <div className="flex items-center gap-4 px-6 py-4">
              <Mail className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">Email</p>
                <p className="text-sm font-medium text-foreground">{user?.email}</p>
              </div>
            </div>
            <div className="flex items-start gap-4 px-6 py-4">
              <Shield className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-xs text-muted-foreground">Access Roles</p>
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  {roles.map((r) => (
                    <span
                      key={r}
                      className="px-2 py-0.5 bg-sidebar-primary/10 text-sidebar-primary text-xs font-medium rounded-full capitalize"
                    >
                      {r.replace(/_/g, " ")}
                    </span>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-4 px-6 py-4">
              <UserCircle className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">Member ID</p>
                <p className="text-sm font-medium text-foreground font-mono">{user?.id}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Notification Preferences */}
        <div className="bg-card border border-card-border rounded-xl shadow-sm overflow-hidden">
          <div className="flex items-center gap-3 px-5 py-4 border-b border-card-border">
            <Bell className="w-4 h-4 text-primary" />
            <div>
              <h2 className="text-sm font-semibold text-card-foreground">Email Notification Preferences</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Choose which events trigger an email to your inbox.</p>
            </div>
          </div>

          {isLoading ? (
            <div className="px-5 py-6 flex items-center gap-2 text-muted-foreground text-sm">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading preferences…
            </div>
          ) : (
            <div className="px-5 py-5 space-y-5">
              {/* Master toggle */}
              <label className="flex items-center justify-between gap-3 cursor-pointer">
                <div>
                  <p className="text-sm font-medium text-foreground">Receive notification emails</p>
                  <p className="text-xs text-muted-foreground">Master switch — turn off to stop all non-critical emails.</p>
                </div>
                <input
                  type="checkbox"
                  className="w-4 h-4 accent-primary shrink-0"
                  checked={masterEmailOn}
                  onChange={(e) => setNotifPrefs((p) => ({ ...p, email: e.target.checked }))}
                />
              </label>

              {/* Always-on notice */}
              <div className="rounded-lg border border-amber-200 bg-amber-50/60 px-3 py-2 flex items-start gap-2">
                <Lock className="h-3.5 w-3.5 text-amber-600 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-800 leading-relaxed">
                  <strong>TRO alerts and red-flag alerts</strong> are always delivered by email — they cannot be turned off.
                </p>
              </div>

              {/* Per-category toggles — shown only when master email is on */}
              {masterEmailOn && (
                <div className="space-y-2">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Per-category settings</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                    {EMAIL_NOTIFICATION_TOGGLES.map((toggle) => (
                      <label key={toggle.key} className="flex items-center gap-2.5 cursor-pointer rounded-md px-2.5 py-2 hover:bg-muted/40 transition-colors">
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

              {/* Delivery frequency — shown only when master email is on */}
              {masterEmailOn && (
                <div className="space-y-2">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Delivery frequency</p>
                  <div className="flex flex-col gap-1">
                    {[
                      { value: "instant", label: "Send immediately", desc: "Each notification emails you right away." },
                      { value: "daily", label: "Daily digest", desc: "All notifications bundled into one email per day." },
                      { value: "weekly", label: "Weekly digest", desc: "One summary email at the start of each week." },
                    ].map(({ value, label, desc }) => (
                      <label key={value} className="flex items-start gap-2.5 cursor-pointer rounded-md px-2.5 py-2 hover:bg-muted/40 transition-colors">
                        <input
                          type="radio"
                          name="trustEmailDeliveryFrequency"
                          className="mt-0.5 accent-primary shrink-0"
                          checked={(notifPrefs.emailDeliveryFrequency ?? "instant") === value}
                          onChange={() => setNotifPrefs((p) => ({ ...p, emailDeliveryFrequency: value }))}
                        />
                        <div>
                          <p className="text-sm font-medium text-foreground leading-tight">{label}</p>
                          <p className="text-xs text-muted-foreground">{desc}</p>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* Email delivery preview — live summary */}
              <div className="rounded-lg border border-blue-100 bg-blue-50/50 px-3 py-3 space-y-2">
                <p className="text-[10px] font-bold text-blue-700 uppercase tracking-widest">Email delivery preview</p>
                {!masterEmailOn ? (
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    No category emails will be sent — master switch is off. Only TRO and red-flag alerts will still be delivered.
                  </p>
                ) : (() => {
                  const enabled = EMAIL_NOTIFICATION_TOGGLES.filter((t) => notifPrefs[t.key] !== false);
                  const freq = notifPrefs.emailDeliveryFrequency ?? "instant";
                  return (
                    <>
                      <div className="flex flex-wrap gap-1">
                        <span className="text-[10px] rounded-full bg-amber-100 border border-amber-200 text-amber-800 px-2 py-0.5 font-medium">TRO alerts</span>
                        <span className="text-[10px] rounded-full bg-amber-100 border border-amber-200 text-amber-800 px-2 py-0.5 font-medium">Red-flag alerts</span>
                        {enabled.length === 0 ? (
                          <span className="text-xs text-muted-foreground self-center ml-1">No optional categories selected.</span>
                        ) : enabled.map((t) => (
                          <span key={t.key} className="text-[10px] rounded-full bg-blue-100 border border-blue-200 text-blue-800 px-2 py-0.5 font-medium">{t.label}</span>
                        ))}
                      </div>
                      <div className="pt-1 border-t border-blue-100 flex items-center gap-1.5">
                        <span className="text-[10px] text-blue-600 font-semibold uppercase tracking-wider">Frequency:</span>
                        <span className="text-[10px] text-blue-700">
                          {freq === "daily" ? "Daily digest" : freq === "weekly" ? "Weekly digest" : "Send immediately"}
                        </span>
                      </div>
                    </>
                  );
                })()}
              </div>

              <div className="flex items-center gap-3 pt-2 border-t border-card-border">
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

        <div className="bg-card border border-card-border rounded-xl shadow-sm">
          <div className="flex items-center gap-3 px-5 py-4 border-b border-card-border">
            <Scale className="w-4 h-4 text-primary" />
            <h2 className="text-sm font-semibold text-card-foreground">Tribal Standing</h2>
          </div>
          <div className="px-5 py-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-2 h-2 rounded-full bg-green-500" />
              <p className="text-sm font-medium text-foreground">Active Member — Mathias El Tribe</p>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Your membership is recognized under the sovereign authority of the Mathias El Tribe. For changes to your membership record,
              contact the Office of the Chief Justice & Trustee.
            </p>
          </div>
        </div>

        <div className="text-center pt-2">
          <p className="text-xs text-muted-foreground leading-relaxed">
            Mathias El Tribe — A Sovereign Nation Exercising Inherent Authority Under Tribal, Federal, and International Law.
          </p>
        </div>
      </div>
    </Layout>
  );
}
