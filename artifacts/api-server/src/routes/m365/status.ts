import { Router } from "express";
import { requireAuth } from "../../auth/entra-guard";
import { getAzureOpenAIClient } from "../../lib/azure-openai";

const router = Router();

router.get("/status", requireAuth, (_req, res) => {
  const serviceKeyConfigured = !!(process.env.SERVICE_KEY || process.env.M365_SERVICE_KEY);
  const azureConfigured =
    !!process.env.AZURE_OPENAI_API_KEY &&
    !!process.env.AZURE_OPENAI_ENDPOINT &&
    !!process.env.AZURE_OPENAI_DEPLOYMENT;
  const entraConfigured =
    !!process.env.AZURE_ENTRA_TENANT_ID && !!process.env.AZURE_ENTRA_CLIENT_ID;
  const azureClient = getAzureOpenAIClient();

  const baseUrl = process.env.REPLIT_DEV_DOMAIN
    ? `https://${process.env.REPLIT_DEV_DOMAIN}`
    : "https://your-deployed-domain.replit.app";

  res.json({
    serviceKeyConfigured,
    azureConfigured,
    entraConfigured,
    azureClientReady: !!azureClient,
    endpoints: {
      factExtraction: `${baseUrl}/api/facts/extract`,
      webhook: `${baseUrl}/api/m365/webhook`,
      drafts: `${baseUrl}/api/drafts/create`,
      identityGateway: `${baseUrl}/api/identity/gateway`,
      microsoftLogin: `${baseUrl}/api/auth/microsoft/login`,
    },
    authentication: {
      method: "X-Api-Key header",
      headerName: "X-Api-Key",
      note: "Set M365_SERVICE_KEY environment variable, then use that value as the X-Api-Key header in Power Automate HTTP actions.",
    },
    powerAutomateFlow: [
      { step: 1, trigger: "SharePoint — When a file is created in library" },
      { step: 2, action: "SharePoint — Get file content" },
      { step: 3, action: "HTTP — POST /api/m365/webhook", body: '{ "mode": "full_intake", "base64Content": "@{base64(body(\'Get_file_content\'))}", "filename": "@{triggerOutputs()?[\'body/Name\']}" }', headers: { "X-Api-Key": "<M365_SERVICE_KEY>", "Content-Type": "application/json" } },
      { step: 4, action: "Parse JSON — extract facts and draftText from response" },
      { step: 5, action: "Word — Create document from draftText" },
      { step: 6, action: "SharePoint — Update file with metadata (caseType, urgencyLevel, parties)" },
    ],
  });
});

export default router;
