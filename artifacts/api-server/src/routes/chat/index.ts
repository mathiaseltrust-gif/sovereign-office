import { Router } from "express";
import { requireAuth } from "../../auth/entra-guard";
import { routeChat } from "../../sovereign/chat-router";
import { logger } from "../../lib/logger";

const router = Router();

router.post("/", requireAuth, async (req, res, next) => {
  try {
    const { message, uploadedDocumentText } = req.body as {
      message: string;
      uploadedDocumentText?: string;
    };

    if (!message || typeof message !== "string" || message.trim().length === 0) {
      res.status(400).json({ error: "message field is required" });
      return;
    }

    if (message.length > 4000) {
      res.status(400).json({ error: "message too long (max 4000 chars)" });
      return;
    }

    const user = req.user;
    const userName = user?.name ?? user?.email?.split("@")[0] ?? undefined;

    logger.info(
      { userId: user?.dbId, msgLen: message.length, hasDoc: !!uploadedDocumentText },
      "Chat request received",
    );

    const response = await routeChat({
      message: message.trim(),
      userName,
      userId: user?.dbId,
      uploadedDocumentText,
    });

    logger.info(
      { tier: response.tier, redFlag: response.redFlag, tokens: response.azureTokensUsed },
      "Chat response dispatched",
    );

    res.json(response);
  } catch (err) {
    next(err);
  }
});

router.get("/status", requireAuth, (_req, res) => {
  const azureConfigured =
    !!process.env.AZURE_OPENAI_API_KEY &&
    !!process.env.AZURE_OPENAI_ENDPOINT &&
    !!process.env.AZURE_OPENAI_DEPLOYMENT;

  res.json({
    status: "ready",
    tiers: [
      { tier: 1, name: "Funnel Engine", description: "10 pre-built guided response funnels for common tribal questions", cost: "zero" },
      { tier: 2, name: "Intake Filter + Law DB", description: "Federal Indian law pattern matching + 77-entry law database", cost: "zero" },
      { tier: 3, name: "Azure OpenAI", description: "Full AI legal analysis — only for complex, new law, or document review queries", cost: "minimal (~$0.01/call)", available: azureConfigured },
      { tier: 4, name: "Hard Sovereign Default", description: "Always-on fallback — zero downtime guarantee", cost: "zero" },
    ],
    escalationTriggers: [
      "New legislation or recent court rulings",
      "Uploaded document analysis",
      "Message > 350 characters",
      "Explicit AI analysis request",
      "Is this legal / interpret this / analyze this",
    ],
    estimatedAnnualCost: "< $10 at typical tribal member usage (< 5% of queries reach Azure OpenAI)",
  });
});

export default router;
