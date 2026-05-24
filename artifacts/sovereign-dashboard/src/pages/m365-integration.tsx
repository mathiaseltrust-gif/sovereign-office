import { useState, useEffect, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useAuth, getCurrentBearerToken } from "@/components/auth-provider";
import {
  CheckCircle2, XCircle, ChevronDown, ChevronUp,
  ExternalLink, Link2, Link2Off, Loader2, AlertTriangle,
} from "lucide-react";

const API_BASE = `${import.meta.env.BASE_URL.replace(/\/$/, "").replace(/\/sovereign-dashboard$/, "")}/api`;
const BASE_PATH = import.meta.env.BASE_URL.replace(/\/$/, "");

interface M365Status {
  serviceKeyConfigured: boolean;
  azureConfigured: boolean;
  entraConfigured: boolean;
  azureClientReady: boolean;
}

// ── Microsoft 365 app tiles ──────────────────────────────────────────────────
const M365_APPS = [
  {
    id: "sharepoint",
    label: "SharePoint",
    sublabel: "Document library",
    href: "https://www.office.com/launch/sharepoint",
    color: "#038387",
    icon: (
      <svg viewBox="0 0 32 32" fill="none" className="w-7 h-7">
        <rect x="2" y="2" width="28" height="28" rx="5" fill="#038387" />
        <circle cx="12" cy="16" r="7" fill="white" fillOpacity=".9" />
        <circle cx="20" cy="16" r="7" fill="white" fillOpacity=".5" />
        <circle cx="16" cy="16" r="5" fill="white" fillOpacity=".85" />
      </svg>
    ),
  },
  {
    id: "word",
    label: "Word",
    sublabel: "Document drafting",
    href: "https://www.office.com/launch/word",
    color: "#185ABD",
    icon: (
      <svg viewBox="0 0 32 32" fill="none" className="w-7 h-7">
        <rect x="2" y="2" width="28" height="28" rx="5" fill="#185ABD" />
        <text x="7" y="23" fill="white" fontSize="17" fontWeight="bold" fontFamily="Arial">W</text>
      </svg>
    ),
  },
  {
    id: "outlook",
    label: "Outlook",
    sublabel: "Tribal email",
    href: "https://outlook.office.com",
    color: "#0078D4",
    icon: (
      <svg viewBox="0 0 32 32" fill="none" className="w-7 h-7">
        <rect x="2" y="2" width="28" height="28" rx="5" fill="#0078D4" />
        <text x="7" y="23" fill="white" fontSize="17" fontWeight="bold" fontFamily="Arial">O</text>
      </svg>
    ),
  },
  {
    id: "teams",
    label: "Teams",
    sublabel: "Meetings & chat",
    href: "https://teams.microsoft.com",
    color: "#6264A7",
    icon: (
      <svg viewBox="0 0 32 32" fill="none" className="w-7 h-7">
        <rect x="2" y="2" width="28" height="28" rx="5" fill="#6264A7" />
        <text x="7" y="23" fill="white" fontSize="17" fontWeight="bold" fontFamily="Arial">T</text>
      </svg>
    ),
  },
  {
    id: "onedrive",
    label: "OneDrive",
    sublabel: "Secure file storage",
    href: "https://onedrive.live.com",
    color: "#0078D4",
    icon: (
      <svg viewBox="0 0 32 32" fill="none" className="w-7 h-7">
        <rect x="2" y="2" width="28" height="28" rx="5" fill="#0078D4" />
        <path d="M7 20 Q10 13 17 15 Q19 10 25 13 Q28 14 27 20Z" fill="white" fillOpacity=".9" />
      </svg>
    ),
  },
  {
    id: "office",
    label: "Office Home",
    sublabel: "All apps",
    href: "https://www.office.com",
    color: "#D83B01",
    icon: (
      <svg viewBox="0 0 32 32" fill="none" className="w-7 h-7">
        <rect x="2" y="2" width="28" height="28" rx="5" fill="#D83B01" />
        <text x="7" y="23" fill="white" fontSize="17" fontWeight="bold" fontFamily="Arial">M</text>
      </svg>
    ),
  },
];

// ── App Tile ─────────────────────────────────────────────────────────────────
function AppTile({ app }: { app: typeof M365_APPS[0] }) {
  return (
    <a
      href={app.href}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex flex-col items-center gap-2 p-4 rounded-xl border border-border bg-card hover:border-primary/40 hover:bg-accent/30 transition-all cursor-pointer"
    >
      {app.icon}
      <div className="text-center">
        <p className="text-sm font-semibold leading-tight">{app.label}</p>
        <p className="text-[10px] text-muted-foreground">{app.sublabel}</p>
      </div>
      <ExternalLink className="h-3 w-3 text-muted-foreground/40 group-hover:text-muted-foreground transition-colors" />
    </a>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────
export default function M365IntegrationPage() {
  const { user, mode, loginWithSessionToken } = useAuth();
  const { toast } = useToast();

  const [status, setStatus] = useState<M365Status | null>(null);
  const [statusOpen, setStatusOpen] = useState(false);
  const [linking, setLinking] = useState(false);
  const [msConfig, setMsConfig] = useState<{ configured: boolean; redirectUri: string; clientId: string | null } | null>(null);
  const [uriCopied, setUriCopied] = useState(false);

  const isMicrosoftLinked = mode === "microsoft";
  const activeCount = status
    ? [status.serviceKeyConfigured, status.azureConfigured, status.entraConfigured, status.azureClientReady].filter(Boolean).length
    : null;

  useEffect(() => {
    if (!user) return;
    fetch(`${API_BASE}/m365/status`, {
      headers: { Authorization: `Bearer ${getCurrentBearerToken() ?? ""}` },
    })
      .then(r => r.ok ? r.json() as Promise<M365Status> : null)
      .then(d => setStatus(d))
      .catch(() => {});
  }, [user]);

  useEffect(() => {
    fetch(`${API_BASE}/auth/microsoft/config`)
      .then(r => r.ok ? r.json() : null)
      .then(d => setMsConfig(d))
      .catch(() => {});
  }, []);

  const handleLinkMicrosoft = useCallback(async () => {
    setLinking(true);
    try {
      const callbackUrl = `${window.location.origin}${BASE_PATH}/microsoft/callback`.replace(/([^:])\/\/+/g, "$1/");
      const res = await fetch(`${API_BASE}/auth/microsoft/login?redirectUri=${encodeURIComponent(callbackUrl)}`);
      if (!res.ok) throw new Error("unavailable");
      const { authUrl } = await res.json() as { authUrl: string };
      const popup = window.open(authUrl, "msauth", "width=520,height=640,left=200,top=100");

      const onMsg = (ev: MessageEvent) => {
        if (ev.origin !== window.location.origin) return;
        if (ev.data?.type === "OAUTH_SUCCESS") {
          // Apply the new Microsoft session — this sets mode → "microsoft"
          // so isMicrosoftLinked flips to true without a page reload.
          const { sessionToken, user: msUser } = ev.data as {
            sessionToken: string;
            user: { id: number; email: string; name: string; roles: string[] };
          };
          loginWithSessionToken(sessionToken, {
            id: msUser.id,
            dbId: msUser.id,
            email: msUser.email,
            name: msUser.name,
            roles: msUser.roles,
          });
          toast({ title: "Microsoft account linked", description: `Signed in as ${msUser.email}` });
        } else if (ev.data?.type === "OAUTH_ERROR") {
          toast({ title: "Sign-in failed", description: ev.data.error, variant: "destructive" });
        }
        window.removeEventListener("message", onMsg);
        setLinking(false);
      };
      window.addEventListener("message", onMsg);

      const poll = setInterval(() => {
        if (popup?.closed) { clearInterval(poll); setLinking(false); window.removeEventListener("message", onMsg); }
      }, 800);
    } catch {
      toast({ title: "Microsoft sign-in unavailable", description: "Azure Entra ID may not be configured yet.", variant: "destructive" });
      setLinking(false);
    }
  }, [toast, loginWithSessionToken]);

  return (
    <div className="max-w-2xl mx-auto space-y-5 pb-10" data-testid="page-m365">

      {/* ── Header row ── */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-[#0078d4]/10 flex items-center justify-center shrink-0">
          {/* Microsoft logo mark */}
          <svg width="18" height="18" viewBox="0 0 21 21" fill="none">
            <rect x="1" y="1" width="9" height="9" fill="#F25022" />
            <rect x="11" y="1" width="9" height="9" fill="#7FBA00" />
            <rect x="1" y="11" width="9" height="9" fill="#00A4EF" />
            <rect x="11" y="11" width="9" height="9" fill="#FFB900" />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-serif font-bold leading-tight">Microsoft 365</h1>
          <p className="text-xs text-muted-foreground">Sovereign workspace</p>
        </div>

        {/* Account connection badge */}
        {isMicrosoftLinked ? (
          <div className="flex items-center gap-1.5 text-xs text-green-700 font-medium bg-green-50 border border-green-200 rounded-full px-3 py-1 shrink-0">
            <Link2 className="h-3 w-3" />
            Account linked
          </div>
        ) : (
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs gap-1.5 shrink-0"
            onClick={handleLinkMicrosoft}
            disabled={linking}
          >
            {linking ? <Loader2 className="h-3 w-3 animate-spin" /> : <Link2Off className="h-3 w-3" />}
            {linking ? "Opening…" : "Link Microsoft account"}
          </Button>
        )}
      </div>

      {/* ── Microsoft account banner (non-Microsoft users) ── */}
      {!isMicrosoftLinked && (
        <div className="flex items-start gap-3 rounded-lg border border-[#0078d4]/30 bg-[#0078d4]/5 px-4 py-3">
          <Link2Off className="h-4 w-4 text-[#0078d4] shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-[#0078d4]">Link your Microsoft account</p>
            <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
              Members with an organisational Microsoft account can sign in directly with Microsoft SSO —
              linking it here connects your Sovereign session to your Microsoft workspace.
            </p>
          </div>
          <Button
            size="sm"
            className="h-8 text-xs shrink-0 bg-[#0078d4] hover:bg-[#006cbf] text-white gap-1.5"
            onClick={handleLinkMicrosoft}
            disabled={linking}
          >
            {linking ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
            {linking ? "Opening…" : "Sign in with Microsoft"}
          </Button>
        </div>
      )}

      {/* ── App launchpad ── */}
      <div>
        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-3">Quick Access</p>
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
          {M365_APPS.map(app => <AppTile key={app.id} app={app} />)}
        </div>
      </div>

      {/* ── Microsoft Login Setup ── */}
      {msConfig && (
        <div className={`rounded-lg border p-4 space-y-3 ${msConfig.configured ? "border-green-200 bg-green-50/50" : "border-amber-200 bg-amber-50/60"}`}>
          <div className="flex items-center gap-2">
            {msConfig.configured
              ? <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
              : <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />}
            <p className={`text-sm font-semibold ${msConfig.configured ? "text-green-800" : "text-amber-800"}`}>
              {msConfig.configured ? "Azure Entra ID configured" : "Microsoft SSO — action required"}
            </p>
          </div>

          {!msConfig.configured && (
            <p className="text-xs text-amber-700 leading-relaxed">
              To enable "Sign in with Microsoft", register this exact Redirect URI in your{" "}
              <strong>Azure Portal App Registration → Authentication → Redirect URIs</strong>:
            </p>
          )}

          {msConfig.configured && (
            <p className="text-xs text-green-700 leading-relaxed">
              Azure Entra ID is active. Verify the Redirect URI below matches your App Registration:
            </p>
          )}

          <div className="flex items-center gap-2">
            <code className={`flex-1 rounded px-3 py-2 text-xs font-mono break-all border ${msConfig.configured ? "bg-green-100 border-green-300 text-green-900" : "bg-amber-100 border-amber-300 text-amber-900"}`}>
              {`${window.location.origin}${BASE_PATH}/microsoft/callback`.replace(/([^:])\/\/+/g, "$1/")}
            </code>
            <Button
              size="sm"
              variant="outline"
              className="shrink-0 h-8 text-xs"
              onClick={() => {
                const uri = `${window.location.origin}${BASE_PATH}/microsoft/callback`.replace(/([^:])\/\/+/g, "$1/");
                navigator.clipboard.writeText(uri).then(() => {
                  setUriCopied(true);
                  setTimeout(() => setUriCopied(false), 2000);
                });
              }}
            >
              {uriCopied ? "Copied!" : "Copy"}
            </Button>
          </div>

          {!msConfig.configured && (
            <a
              href="https://portal.azure.com/#view/Microsoft_AAD_RegisteredApps/ApplicationsListBlade"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs text-[#0078d4] hover:underline"
            >
              <ExternalLink className="h-3 w-3" />
              Open Azure Portal → App Registrations
            </a>
          )}
        </div>
      )}

      {/* ── Compact service status strip ── */}
      <div className="border rounded-lg overflow-hidden">
        <button
          onClick={() => setStatusOpen(v => !v)}
          className="flex items-center gap-2 w-full px-4 py-2.5 text-left hover:bg-muted/30 transition-colors"
        >
          {/* Dot indicators */}
          <div className="flex gap-1 items-center">
            {status ? (
              [status.serviceKeyConfigured, status.azureConfigured, status.entraConfigured, status.azureClientReady].map((ok, i) => (
                <span
                  key={i}
                  className={`w-2 h-2 rounded-full ${ok ? "bg-green-500" : "bg-muted-foreground/30"}`}
                  title={["Service Key", "Azure OpenAI", "Entra ID", "AI Engine"][i]}
                />
              ))
            ) : (
              [...Array(4)].map((_, i) => (
                <span key={i} className="w-2 h-2 rounded-full bg-muted-foreground/20 animate-pulse" />
              ))
            )}
          </div>
          <span className="text-xs text-muted-foreground">
            {activeCount !== null ? `${activeCount} of 4 backend services active` : "Checking services…"}
          </span>
          {statusOpen
            ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground ml-auto" />
            : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground ml-auto" />}
        </button>

        {statusOpen && status && (
          <div className="border-t divide-y divide-border">
            {[
              { ok: status.serviceKeyConfigured, label: "M365 Service Key", desc: "Authenticates Power Automate flows" },
              { ok: status.azureConfigured, label: "Azure OpenAI", desc: "AI document analysis and drafting" },
              { ok: status.entraConfigured, label: "Azure Entra ID", desc: "Microsoft account sign-in (SSO)" },
              { ok: status.azureClientReady, label: "AI Engine", desc: "End-to-end sovereign AI pipeline" },
            ].map(row => (
              <div key={row.label} className="flex items-center gap-3 px-4 py-2.5">
                {row.ok
                  ? <CheckCircle2 className="h-3.5 w-3.5 text-green-600 shrink-0" />
                  : <XCircle className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0" />}
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium">{row.label}</p>
                  <p className="text-[10px] text-muted-foreground">{row.desc}</p>
                </div>
                <Badge
                  variant={row.ok ? "default" : "secondary"}
                  className={`text-[9px] uppercase tracking-wider shrink-0 ${row.ok ? "bg-green-700 text-white" : ""}`}
                >
                  {row.ok ? "Active" : "Not configured"}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
