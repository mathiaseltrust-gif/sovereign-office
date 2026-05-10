import { Router } from "express";
import { requireAuth } from "../../auth/entra-guard";
import { runAiEngine } from "../../sovereign/ai-engine";
import { logger } from "../../lib/logger";

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

    const userId = req.user?.dbId;

    logger.info({ userId, textLen: text.length }, "AI intake engine request received");

    const report = await runAiEngine({
      text,
      userId,
      context,
    });

    res.status(200).json({
      ...report,
      _meta: {
        tier: report.tier,
        tierReason: report.tierReason,
        azureAvailable: report.azureAvailable,
      },
    });
  } catch (err) {
    next(err);
  }
});

router.get("/status", requireAuth, async (_req, res) => {
  const { getAzureOpenAIClient } = await import("../../lib/azure-openai");
  const azureConfigured = !!process.env.AZURE_OPENAI_API_KEY && !!process.env.AZURE_OPENAI_ENDPOINT && !!process.env.AZURE_OPENAI_DEPLOYMENT;
  const azureClientReady = !!getAzureOpenAIClient();
  const entraConfigured = !!process.env.AZURE_ENTRA_TENANT_ID && !!process.env.AZURE_ENTRA_CLIENT_ID;

  res.json({
    tiers: [
      {
        tier: 1,
        name: "Azure OpenAI",
        status: azureClientReady ? "ready" : azureConfigured ? "initializing" : "not_configured",
        model: process.env.AZURE_OPENAI_DEPLOYMENT ?? null,
        endpoint: process.env.AZURE_OPENAI_ENDPOINT ?? null,
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

export default router;
