import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { getCurrentBearerToken } from "@/components/auth-provider";

const API_BASE = `${import.meta.env.BASE_URL.replace(/\/$/, "").replace(/\/sovereign-dashboard$/, "")}/api`;

interface M365Status {
  serviceKeyConfigured: boolean;
  azureConfigured: boolean;
  entraConfigured: boolean;
  azureClientReady: boolean;
  endpoints: Record<string, string>;
  authentication: { method: string; headerName: string; note: string };
  powerAutomateFlow: Array<{
    step: number;
    trigger?: string;
    action?: string;
    body?: string;
    headers?: Record<string, string>;
  }>;
}

function StatusBadge({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-border last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <Badge variant={ok ? "default" : "destructive"} className="text-xs">
        {ok ? "Configured" : "Not configured"}
      </Badge>
    </div>
  );
}

function CopyBlock({ value, label }: { value: string; label: string }) {
  const { toast } = useToast();
  return (
    <div className="mb-3">
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <div className="flex items-center gap-2">
        <code className="flex-1 text-xs bg-muted rounded px-3 py-2 font-mono break-all">{value}</code>
        <Button
          size="sm"
          variant="outline"
          className="shrink-0 h-8 text-xs"
          onClick={() => {
            navigator.clipboard.writeText(value);
            toast({ title: "Copied", description: label });
          }}
        >
          Copy
        </Button>
      </div>
    </div>
  );
}

const POWER_AUTOMATE_STEPS = [
  {
    num: 1,
    icon: "📁",
    title: "Trigger: SharePoint file created",
    desc: 'Add a "When a file is created (properties only)" trigger on your SharePoint document library.',
    code: null,
  },
  {
    num: 2,
    icon: "📄",
    title: "Get file content",
    desc: 'Add "Get file content" action using the File Identifier from step 1.',
    code: null,
  },
  {
    num: 3,
    icon: "🌐",
    title: "HTTP POST — Sovereign AI Webhook",
    desc: 'Add an HTTP action. Method: POST. URI: your webhook URL. Add header X-Api-Key with the service key value.',
    code: JSON.stringify({
      mode: "full_intake",
      base64Content: "@{base64(body('Get_file_content'))}",
      filename: "@{triggerOutputs()?['body/Name']}",
    }, null, 2),
  },
  {
    num: 4,
    icon: "🔍",
    title: "Parse JSON — extract facts + draft",
    desc: 'Add "Parse JSON" action on the HTTP response body. Use the schema: { facts: {...}, draftText: "string", draftTitle: "string" }',
    code: null,
  },
  {
    num: 5,
    icon: "📝",
    title: "Word — Populate document template",
    desc: 'Add a "Populate a Microsoft Word template" action (or create file) using draftText from the parsed response.',
    code: null,
  },
  {
    num: 6,
    icon: "💾",
    title: "SharePoint — Save versioned output",
    desc: 'Save the populated Word doc back to SharePoint with metadata: caseType, urgencyLevel, parties from the facts object.',
    code: null,
  },
];

export default function M365IntegrationPage() {
  const [status, setStatus] = useState<M365Status | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API_BASE}/m365/status`, {
      headers: { Authorization: `Bearer ${getCurrentBearerToken()}` },
    })
      .then((r) => r.json() as Promise<M365Status>)
      .then(setStatus)
      .catch(() => setStatus(null))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold font-serif">Microsoft 365 Integration</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Connect Power Automate to your Sovereign backend for document intake, fact extraction, and AI drafting.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="md:col-span-1">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold uppercase tracking-widest">System Status</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-xs text-muted-foreground">Checking…</p>
            ) : status ? (
              <>
                <StatusBadge ok={status.serviceKeyConfigured} label="M365 Service Key" />
                <StatusBadge ok={status.azureConfigured} label="Azure OpenAI" />
                <StatusBadge ok={status.entraConfigured} label="Azure Entra ID" />
                <StatusBadge ok={status.azureClientReady} label="AI Engine Ready" />
              </>
            ) : (
              <p className="text-xs text-destructive">Could not reach the API.</p>
            )}
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold uppercase tracking-widest">Power Automate Endpoints</CardTitle>
          </CardHeader>
          <CardContent>
            {status?.endpoints ? (
              <>
                <CopyBlock value={status.endpoints.webhook ?? ""} label="Webhook (fact extraction + drafting)" />
                <CopyBlock value={status.endpoints.factExtraction ?? ""} label="Fact extraction only" />
                <CopyBlock value={status.endpoints.drafts ?? ""} label="Drafting engine" />
                <CopyBlock value={status.endpoints.identityGateway ?? ""} label="Identity gateway" />
                <div className="mt-3 rounded-md bg-amber-50 border border-amber-200 px-3 py-2">
                  <p className="text-xs text-amber-800 font-medium">Authentication</p>
                  <p className="text-xs text-amber-700 mt-0.5">
                    Add header <code className="font-mono bg-amber-100 px-1 rounded">X-Api-Key</code> to every Power Automate HTTP action.
                    The value is the <strong>M365_SERVICE_KEY</strong> secret set in Replit.
                  </p>
                </div>
              </>
            ) : (
              <p className="text-xs text-muted-foreground">Loading endpoint URLs…</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold uppercase tracking-widest">Architecture</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md bg-muted p-4 font-mono text-xs leading-relaxed overflow-x-auto">
            <pre>{`Staff / Member          Microsoft 365              Replit Sovereign API
────────────────────────────────────────────────────────────────────
Upload document  →  SharePoint Library
                         ↓ Power Automate trigger
                         ↓  POST /api/m365/webhook    ← Fact Engine
                         ↓                            ← AI Drafting Engine
                         ↓                            ← Identity Engine
                  ←  Word doc populated with result
                  ←  SharePoint version saved

Member signs in  →  Sign in with Microsoft (login page)
                         ↓ Azure Entra ID PKCE
                         ↓  /api/auth/microsoft/callback
                  ←  Sovereign dashboard loaded`}</pre>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold uppercase tracking-widest">Power Automate Setup — Step by Step</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {POWER_AUTOMATE_STEPS.map((step) => (
            <div key={step.num} className="flex gap-4">
              <div className="shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary">
                {step.num}
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium">{step.icon} {step.title}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{step.desc}</p>
                {step.code && (
                  <pre className="mt-2 text-xs bg-muted rounded-md p-3 overflow-x-auto font-mono">{step.code}</pre>
                )}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold uppercase tracking-widest">Webhook Request Format</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <CopyBlock
            label="Full intake (facts + draft) — recommended"
            value={JSON.stringify({ mode: "full_intake", base64Content: "<base64 file>", filename: "case-notes.docx", documentType: "court_document", jurisdiction: "tribal", userNotes: "Optional context" }, null, 2)}
          />
          <CopyBlock
            label="Facts only"
            value={JSON.stringify({ mode: "facts_only", text: "Plain document text here…", context: { caseType: "ICWA", tribe: "Mathias El" } }, null, 2)}
          />
          <CopyBlock
            label="Draft only (provide text, get Word-ready doc back)"
            value={JSON.stringify({ mode: "draft", text: "Document text…", documentType: "welfare_instrument", jurisdiction: "federal" }, null, 2)}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold uppercase tracking-widest">Webhook Response Format</CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="text-xs bg-muted rounded-md p-3 overflow-x-auto font-mono">{JSON.stringify({
            mode: "full_intake",
            facts: {
              parties: [{ role: "petitioner", name: "Jane Doe", description: "Tribal member" }],
              caseType: "ICWA custody",
              urgencyLevel: "urgent",
              childInvolved: true,
              icwaApplicable: true,
              tribalLandInvolved: false,
              summary: "Petitioner seeks emergency custody under ICWA…",
              keyFacts: ["Child is an enrolled member", "State court lacks jurisdiction"],
              recommendedDocumentType: "icwa_notice",
              confidence: "high",
            },
            draftTitle: "ICWA Notice of Pending Custody Proceeding",
            draftText: "IN THE SOVEREIGN COURT OF THE MATHIAS EL TRIBE…",
            sovereigntyProtections: ["Indian Child Welfare Act (25 U.S.C. § 1901)", "Tribal sovereignty over child custody matters"],
            tier: "azure_openai",
            processingMs: 1842,
          }, null, 2)}</pre>
        </CardContent>
      </Card>
    </div>
  );
}
