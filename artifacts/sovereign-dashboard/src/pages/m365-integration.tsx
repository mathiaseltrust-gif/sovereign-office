import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useAuth, getCurrentBearerToken } from "@/components/auth-provider";
import {
  CheckCircle2, XCircle, ChevronDown, ChevronRight,
  Cloud, FileText, Zap, ShieldCheck, Settings, Copy,
} from "lucide-react";

const API_BASE = `${import.meta.env.BASE_URL.replace(/\/$/, "").replace(/\/sovereign-dashboard$/, "")}/api`;

interface M365Status {
  serviceKeyConfigured: boolean;
  azureConfigured: boolean;
  entraConfigured: boolean;
  azureClientReady: boolean;
  endpoints: Record<string, string>;
  authentication: { method: string; headerName: string; note: string };
}

// ── Small connection indicator ───────────────────────────────────────────────
function ServiceRow({ ok, label, detail }: { ok: boolean; label: string; detail?: string }) {
  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-border last:border-0">
      {ok
        ? <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
        : <XCircle className="h-4 w-4 text-destructive shrink-0" />}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">{label}</p>
        {detail && <p className="text-xs text-muted-foreground">{detail}</p>}
      </div>
      <Badge
        variant={ok ? "default" : "secondary"}
        className={`text-[9px] uppercase tracking-wider shrink-0 ${ok ? "bg-green-700 text-white" : ""}`}
      >
        {ok ? "Active" : "Not configured"}
      </Badge>
    </div>
  );
}

// ── Admin-only: copyable endpoint block ─────────────────────────────────────
function EndpointRow({ label, value }: { label: string; value: string }) {
  const { toast } = useToast();
  return (
    <div className="mb-3">
      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-1">{label}</p>
      <div className="flex items-center gap-2">
        <code className="flex-1 text-[10px] bg-muted rounded px-2.5 py-1.5 font-mono break-all text-muted-foreground">
          {value}
        </code>
        <Button
          size="sm"
          variant="outline"
          className="shrink-0 h-7 w-7 p-0"
          onClick={() => { navigator.clipboard.writeText(value); toast({ title: "Copied", description: label }); }}
          title="Copy"
        >
          <Copy className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────
export default function M365IntegrationPage() {
  const { user, activeRole } = useAuth();
  const [status, setStatus] = useState<M365Status | null>(null);
  const [loading, setLoading] = useState(true);
  const [adminOpen, setAdminOpen] = useState(false);

  const isAdmin = ["sovereign_admin", "trustee"].includes(activeRole);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    fetch(`${API_BASE}/m365/status`, {
      headers: { Authorization: `Bearer ${getCurrentBearerToken() ?? ""}` },
    })
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json() as Promise<M365Status>; })
      .then(setStatus)
      .catch(() => setStatus(null))
      .finally(() => setLoading(false));
  }, [user]);

  const allConnected = !!(status?.serviceKeyConfigured && status?.azureConfigured && status?.entraConfigured && status?.azureClientReady);

  return (
    <div className="max-w-2xl mx-auto space-y-5" data-testid="page-m365">

      {/* ── Header ── */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-[#0078d4]/10 flex items-center justify-center shrink-0">
          <Cloud className="h-5 w-5 text-[#0078d4]" />
        </div>
        <div>
          <h1 className="text-xl font-serif font-bold leading-tight">Microsoft 365</h1>
          <p className="text-xs text-muted-foreground">Sovereign document integration &amp; AI services</p>
        </div>
        {!loading && (
          <Badge
            className={`ml-auto shrink-0 text-xs px-2.5 py-1 ${allConnected ? "bg-green-700 text-white" : "bg-muted text-muted-foreground"}`}
          >
            {allConnected ? "Connected" : "Partial setup"}
          </Badge>
        )}
      </div>

      {/* ── What this does ── */}
      <Card className="border-[#0078d4]/20">
        <CardContent className="p-4 grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="flex items-start gap-2.5">
            <FileText className="h-4 w-4 text-[#0078d4] shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold">Document Intake</p>
              <p className="text-xs text-muted-foreground mt-0.5">Files uploaded to SharePoint are automatically analyzed and classified by the Sovereign AI.</p>
            </div>
          </div>
          <div className="flex items-start gap-2.5">
            <Zap className="h-4 w-4 text-[#0078d4] shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold">AI Drafting</p>
              <p className="text-xs text-muted-foreground mt-0.5">Legal draft responses are generated using the sovereign AI engine and returned to your Word library.</p>
            </div>
          </div>
          <div className="flex items-start gap-2.5">
            <ShieldCheck className="h-4 w-4 text-[#0078d4] shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold">Sovereign Sign-In</p>
              <p className="text-xs text-muted-foreground mt-0.5">Members sign in with their Microsoft account through Azure Entra ID for secure access.</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Connection status ── */}
      <Card>
        <CardHeader className="pb-1">
          <CardTitle className="text-sm font-semibold">Connection Status</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {loading ? (
            <div className="space-y-2 py-2">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-9 bg-muted/50 rounded animate-pulse" />
              ))}
            </div>
          ) : status ? (
            <>
              <ServiceRow
                ok={status.serviceKeyConfigured}
                label="M365 Service Key"
                detail="Authenticates Power Automate flows to the Sovereign API"
              />
              <ServiceRow
                ok={status.azureConfigured}
                label="Azure OpenAI"
                detail="Powers document analysis, fact extraction, and AI drafting"
              />
              <ServiceRow
                ok={status.entraConfigured}
                label="Azure Entra ID"
                detail="Enables Microsoft account sign-in for tribal members"
              />
              <ServiceRow
                ok={status.azureClientReady}
                label="AI Engine"
                detail="End-to-end sovereign AI processing pipeline ready"
              />
            </>
          ) : (
            <p className="text-sm text-muted-foreground py-4 text-center">
              Could not reach the API — check that the server is running.
            </p>
          )}
        </CardContent>
      </Card>

      {/* ── How to use (user-facing guidance) ── */}
      <Card>
        <CardHeader className="pb-1">
          <CardTitle className="text-sm font-semibold">How It Works</CardTitle>
        </CardHeader>
        <CardContent className="pt-2 space-y-3">
          {[
            { num: 1, title: "Upload a document to SharePoint", body: "Any court document, correspondence, or case file saved to your connected SharePoint library is automatically picked up." },
            { num: 2, title: "AI intake runs automatically", body: "The Sovereign AI analyzes the document, extracts facts, identifies parties, assesses urgency, and determines applicable legal doctrines." },
            { num: 3, title: "A drafted response appears in Word", body: "A legal draft response — formatted for sovereign court use — is returned to your SharePoint library as a Word document, ready for review." },
            { num: 4, title: "Sign in with your Microsoft account", body: "Team members with @mathiaseltribe.org accounts sign in using Microsoft SSO — no separate password required." },
          ].map(s => (
            <div key={s.num} className="flex gap-3 items-start">
              <div className="w-6 h-6 rounded-full bg-[#0078d4]/10 text-[#0078d4] text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                {s.num}
              </div>
              <div>
                <p className="text-sm font-medium">{s.title}</p>
                <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{s.body}</p>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* ── Admin-only technical panel ── */}
      {isAdmin && status && (
        <div className="border rounded-lg overflow-hidden">
          <button
            onClick={() => setAdminOpen(v => !v)}
            className="flex items-center gap-2 w-full px-4 py-3 text-left hover:bg-muted/40 transition-colors"
          >
            <Settings className="h-4 w-4 text-muted-foreground shrink-0" />
            <span className="text-sm font-medium">Technical Configuration</span>
            <Badge variant="outline" className="text-[9px] uppercase tracking-wider ml-1">Admin</Badge>
            {adminOpen
              ? <ChevronDown className="h-4 w-4 text-muted-foreground ml-auto" />
              : <ChevronRight className="h-4 w-4 text-muted-foreground ml-auto" />}
          </button>

          {adminOpen && (
            <div className="border-t px-4 py-4 space-y-4">
              <div>
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-2">Power Automate Endpoints</p>
                <EndpointRow label="Webhook (fact extraction + drafting)" value={status.endpoints?.webhook ?? ""} />
                <EndpointRow label="Fact extraction only" value={status.endpoints?.factExtraction ?? ""} />
                <EndpointRow label="Drafting engine" value={status.endpoints?.drafts ?? ""} />
                <EndpointRow label="Identity gateway" value={status.endpoints?.identityGateway ?? ""} />
              </div>

              <div className="rounded-md bg-amber-50 border border-amber-200 px-3 py-2.5">
                <p className="text-xs font-semibold text-amber-800 mb-1">Authentication</p>
                <p className="text-xs text-amber-700 leading-relaxed">
                  Add header <code className="font-mono bg-amber-100 px-1 rounded text-[10px]">X-Api-Key</code> to every Power Automate HTTP action.
                  The value is the <strong>M365_SERVICE_KEY</strong> (or <strong>SERVICE_KEY</strong>) secret configured in Replit environment variables.
                </p>
              </div>

              <div>
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-2">Power Automate Flow</p>
                <div className="space-y-1.5">
                  {[
                    "Trigger: SharePoint — When a file is created in library",
                    "Action: SharePoint — Get file content",
                    "Action: HTTP POST → /api/m365/webhook  (X-Api-Key header required)",
                    "Action: Parse JSON — extract facts and draftText from response",
                    "Action: Word — Create document from draftText",
                    "Action: SharePoint — Update file with metadata (caseType, urgencyLevel, parties)",
                  ].map((step, i) => (
                    <div key={i} className="flex gap-2.5 items-start text-xs text-muted-foreground">
                      <span className="font-mono text-[9px] bg-muted rounded px-1.5 py-0.5 shrink-0 mt-0.5 font-bold">{i + 1}</span>
                      <span>{step}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
