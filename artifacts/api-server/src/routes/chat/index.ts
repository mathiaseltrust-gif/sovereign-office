import { Router } from "express";
import { requireAuth } from "../../auth/entra-guard";
import { routeChat } from "../../sovereign/chat-router";
import { logger } from "../../lib/logger";
import {
  getHistory,
  appendMessages,
  clearHistory,
  isRedisAvailable,
} from "../../lib/redis-memory";

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
    const userId = user?.dbId;
    const userName = user?.name ?? user?.email?.split("@")[0] ?? undefined;

    const conversationHistory = userId ? await getHistory(userId) : [];

    logger.info(
      { userId, msgLen: message.length, hasDoc: !!uploadedDocumentText, historyLen: conversationHistory.length },
      "Chat request received",
    );

    const trimmedMessage = message.trim();

    const response = await routeChat({
      message: trimmedMessage,
      userName,
      userId,
      uploadedDocumentText,
      conversationHistory,
    });

    logger.info(
      { tier: response.tier, redFlag: response.redFlag, tokens: response.azureTokensUsed },
      "Chat response dispatched",
    );

    if (userId && response.tier === "azure_openai") {
      const now = Date.now();
      await appendMessages(userId, [
        { role: "user", content: trimmedMessage, timestamp: now },
        { role: "assistant", content: response.reply, timestamp: now },
      ]);
    }

    res.json(response);
  } catch (err) {
    next(err);
  }
});

router.delete("/history", requireAuth, async (req, res, next) => {
  try {
    const userId = req.user?.dbId;
    if (!userId) {
      res.status(400).json({ error: "No user session" });
      return;
    }
    await clearHistory(userId);
    res.json({ cleared: true });
  } catch (err) {
    next(err);
  }
});

router.get("/status", requireAuth, async (_req, res) => {
  const azureConfigured =
    !!process.env.AZURE_OPENAI_API_KEY &&
    !!process.env.AZURE_OPENAI_ENDPOINT &&
    !!process.env.AZURE_OPENAI_DEPLOYMENT;

  const redisConfigured = !!process.env.REDIS_CONNECTION_STRING;
  const redisLive = redisConfigured ? await isRedisAvailable() : false;

  res.json({
    status: "ready",
    memory: {
      enabled: redisLive,
      configured: redisConfigured,
      description: redisLive
        ? "Conversation memory active — AI remembers your previous messages within a 4-hour session"
        : "No memory configured — each message is treated independently",
    },
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
