import { Router } from "express";
import { requireAuth } from "../../auth/entra-guard";
import { processIntake } from "../../sovereign/intake-pipeline";
import { appendIntakeFact } from "../../lib/redis-memory";

const router = Router();

router.post("/", requireAuth, async (req, res, next) => {
  try {
    const { text, context } = req.body as {
      text: string;
      context?: {
        caseType?: string;
        actorType?: string;
        landStatus?: string;
        actionType?: string;
        childInvolved?: boolean;
        tribe?: string;
        court?: string;
        role?: string;
      };
    };

    if (!text || typeof text !== "string") {
      res.status(400).json({ error: "text field is required" });
      return;
    }

    const user = req.user;
    const userId = user?.dbId;

    const { report, meta } = await processIntake({ text, userId, context });

    // Fire-and-forget: persist this intake into the user's long-term memory
    if (userId) {
      const r = report as unknown as Record<string, unknown>;
      const riskLevel = (r.riskLevel as string)
        ?? (r.tier as string)
        ?? "standard";
      const summary = (r.summary as string)
        ?? (r.factSummary as string)
        ?? text.substring(0, 80);
      const docType = context?.caseType;
      const name = user?.name ?? user?.email?.split("@")[0];
      const role = (user as Record<string, unknown>)?.activeRole as string ?? undefined;
      appendIntakeFact(userId, { riskLevel, summary, docType, name, role }).catch(() => {});
    }

    res.status(200).json({ ...report, _meta: meta });
  } catch (err) {
    next(err);
  }
});

router.get("/status", requireAuth, async (_req, res) => {
  const { callAzureOpenAI } = await import("../../lib/azure-openai");
  const azureConfigured = !!process.env.AZURE_OPENAI_API_KEY && !!process.env.AZURE_OPENAI_ENDPOINT && !!process.env.AZURE_OPENAI_DEPLOYMENT;
  const entraConfigured = !!process.env.AZURE_ENTRA_TENANT_ID && !!process.env.AZURE_ENTRA_CLIENT_ID;

  let azureDeploymentReachable = false;
  let azureError: string | null = null;
  if (azureConfigured) {
    try {
      await callAzureOpenAI("You are a health check.", "Respond with OK.", { maxTokens: 3, timeoutMs: 8000 });
      azureDeploymentReachable = true;
    } catch (e) {
      azureError = (e as Error).message.substring(0, 120);
    }
  }

  res.json({
    tiers: [
      {
        tier: 1,
        name: "Azure OpenAI",
        status: azureDeploymentReachable ? "ready" : azureConfigured ? "deployment_not_found" : "not_configured",
        model: process.env.AZURE_OPENAI_DEPLOYMENT ?? null,
        endpoint: process.env.AZURE_OPENAI_ENDPOINT ?? null,
        error: azureError,
        action: !azureDeploymentReachable
          ? "In Azure Portal → tribal-openai-service → Model deployments → Deploy model → Choose gpt-4o (2024-11-20) → Set deployment name to 'tribal-gpt4o'"
          : null,
      },
      {
        tier: 2,
        name: "Rule-Based AI Intake Agent",
        status: "ready",
        description: "Pattern-matching intake filter with 10 violation categories",
      },
      {
        tier: 3,
        name: "Legal-Logic + Delegated Authority Engine",
        status: "ready",
        description: "Law-DB cross-referencing + authority computation",
      },
      {
        tier: 4,
        name: "Hard Sovereign Defaults",
        status: "ready",
        description: "ICWA, Trust, Tribal Medical Authority — always active fallback",
      },
    ],
    entra: {
      configured: entraConfigured,
      tenantId: process.env.AZURE_ENTRA_TENANT_ID ? `${process.env.AZURE_ENTRA_TENANT_ID.substring(0, 8)}…` : null,
      clientId: process.env.AZURE_ENTRA_CLIENT_ID ? `${process.env.AZURE_ENTRA_CLIENT_ID.substring(0, 8)}…` : null,
      jwtValidation: entraConfigured ? "active" : "disabled",
    },
    sovereignty: "PRESERVED — fallback chain ensures zero downtime",
  });
});

// ── extract-fields: pull structured reference data from document text ──────────
router.post("/extract-fields", requireAuth, async (req, res, next) => {
  try {
    const { text } = req.body as { text: string };
    if (!text || typeof text !== "string") {
      res.status(400).json({ error: "text field is required" });
      return;
    }
    const truncated = text.substring(0, 8000);

    // AI extraction path
    try {
      const { callAzureOpenAI } = await import("../../lib/azure-openai");
      const system = `You are a legal document reference extractor for a sovereign tribal legal office. Extract structured reference fields from legal and government documents. Respond ONLY with valid JSON — no explanation, no markdown. Use null for fields not found in the text. JSON shape: { "documentType", "caseNumber", "docketNumber", "propertyNumber", "propertyAddress", "receiptNumber", "court", "judge", "parties": { "plaintiffs":[], "defendants":[], "petitioners":[], "respondents":[], "agencies":[] }, "dates":[], "amounts":[], "allegations":[] }`;
      const prompt = `Extract reference fields from this legal document and return JSON only:\n\n${truncated}`;

      const raw = await callAzureOpenAI(system, prompt, { maxTokens: 1000 });
      const jsonMatch = raw.content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        res.json({ source: "ai", ...parsed });
        return;
      }
    } catch { /* fall through to regex */ }

    // Regex fallback
    const caseMatch = truncated.match(/(?:Case\s*(?:No\.?|Number|#)\s*|Cause\s*(?:No\.?|Number|#)\s*)([A-Z0-9\-:\/]+)/i);
    const docketMatch = truncated.match(/Docket\s*(?:No\.?|Number|#)\s*([A-Z0-9\-:\/]+)/i);
    const propertyAddrMatch = truncated.match(/(?:property\s+address|premises\s+(?:at|located)|located\s+at|situate[d]?\s+at)[:\s]+([^\n\r]{10,100})/i);
    const apnMatch = truncated.match(/(?:APN|Assessor.{0,15}Parcel|Parcel\s*(?:No\.?|Number)|Property\s*(?:No\.?|Number))[:\s#]*([A-Z0-9\-\.]+)/i);
    const receiptMatch = truncated.match(/(?:Receipt\s*(?:No\.?|Number|#)|Reference\s*(?:No\.?|#)|Account\s*(?:No\.?|Number|#))[:\s]*([A-Z0-9\-]+)/i);
    const amounts = (truncated.match(/\$[\d,]+(?:\.\d{2})?/g) ?? []).slice(0, 8);
    const dates = (truncated.match(/\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4}\b|\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/g) ?? []).slice(0, 8);

    const plaintiffMatch = truncated.match(/(?:Plaintiff|Petitioner)[:\s,]+([A-Z][A-Za-z\s,\.]+?)(?:\n|vs?\.|defendant|respondent)/i);
    const defendantMatch = truncated.match(/(?:Defendant|Respondent)[:\s,]+([A-Z][A-Za-z\s,\.]+?)(?:\n|,|\.|and)/i);

    res.json({
      source: "regex",
      caseNumber: caseMatch?.[1] ?? null,
      docketNumber: docketMatch?.[1] ?? null,
      propertyAddress: propertyAddrMatch?.[1]?.trim() ?? null,
      propertyNumber: apnMatch?.[1] ?? null,
      receiptNumber: receiptMatch?.[1] ?? null,
      parties: {
        plaintiffs: plaintiffMatch?.[1] ? [plaintiffMatch[1].trim()] : [],
        defendants: defendantMatch?.[1] ? [defendantMatch[1].trim()] : [],
      },
      amounts,
      dates,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
