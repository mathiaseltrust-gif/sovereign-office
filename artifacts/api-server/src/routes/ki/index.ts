import { Router } from "express";
import { db } from "@workspace/db";
import { kiConversationsTable, profilesTable } from "@workspace/db";
import { eq, desc, and } from "drizzle-orm";
import { requireAuth } from "../../auth/entra-guard";
import { callAzureOpenAI } from "../../lib/azure-openai";
import { resolveSovereignIdentityGateway } from "../../sovereign/identity-gateway";
import { getGovernorByRole, normalizeRoleKey, buildGovernorSystemPromptPrefix } from "../../sovereign/role-governor";
import { logger } from "../../lib/logger";

const router = Router();

const HISTORY_LIMIT = 24;
const DIARY_CONTEXT_LIMIT = 4;

function today(): string {
  return new Date().toLocaleDateString("en-US", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });
}

async function buildKiSystemPrompt(userId: number, tokenUser: { email: string; name: string; roles: string[] }): Promise<string> {
  let name = tokenUser.name;
  let tribalName = "";
  let title = "";
  let role = "member";
  let protectionLevel = "standard";
  let lineageSummary = "";
  let governorPrefix = "";

  try {
    const gateway = await resolveSovereignIdentityGateway(userId, tokenUser);
    name = gateway.identity.legalName || name;
    tribalName = gateway.identity.tribalName || "";
    title = gateway.identity.title || "";
    role = gateway.identity.role || "member";
    protectionLevel = gateway.protectionLevel || "standard";
    lineageSummary = gateway.lineageSummary || "";

    const roleKey = normalizeRoleKey(role);
    const governor = await getGovernorByRole(roleKey).catch(() => null);
    if (governor) governorPrefix = buildGovernorSystemPromptPrefix(governor);
  } catch {
    const [profile] = await db.select().from(profilesTable).where(eq(profilesTable.userId, userId)).limit(1);
    if (profile) {
      name = profile.legalName || name;
      tribalName = profile.tribalName || "";
      title = profile.title || "";
    }
  }

  const recentDiary = await db
    .select({ content: kiConversationsTable.content, createdAt: kiConversationsTable.createdAt })
    .from(kiConversationsTable)
    .where(and(eq(kiConversationsTable.userId, userId), eq(kiConversationsTable.isDiary, true)))
    .orderBy(desc(kiConversationsTable.createdAt))
    .limit(DIARY_CONTEXT_LIMIT);

  const diaryContext = recentDiary.length > 0
    ? "\n\nRecent journal reflections from this member (most recent first):\n" +
      recentDiary.map(d => `— "${d.content.substring(0, 200)}"${d.content.length > 200 ? "…" : ""}`).join("\n")
    : "";

  const protectionNote = protectionLevel === "critical"
    ? "This member carries CRITICAL protection status — federal trust land and inherent sovereignty protections apply under 25 U.S.C. § 177 and Worcester v. Georgia, 31 U.S. 515 (1832). Affirm their standing when relevant."
    : protectionLevel === "elevated"
    ? "This member holds ELEVATED protection status under federal trust responsibility."
    : "";

  return `You are Kaya — the personal sovereign companion for ${name}.

You are a wise, grounded presence of deep African and Indigenous American lineage — carrying the ancient law in your understanding and the fire of sovereignty in your voice. You speak with warmth, gravity, and precision. You never waste words. You see each member not just as who they are today, but as who they are becoming.

Your role has evolved: you once stood at the threshold, greeting all who arrived at the Sovereign Office. Now you walk alongside each member individually — as their personal companion, memory-keeper, and guide. You know their record. You hold their lineage. You carry what they have shared.

MEMBER RECORD:
• Legal Name: ${name}${tribalName ? ` / Tribal Name: ${tribalName}` : ""}
• Title: ${title || "—"}
• Role within the Tribe: ${role}
• Protection Level: ${protectionLevel.toUpperCase()}
• Lineage: ${lineageSummary || "on record"}
• Today: ${today()}
${protectionNote ? `\n${protectionNote}` : ""}
${governorPrefix ? `\nSovereign posture aligned with this member's standing:\n${governorPrefix}` : ""}${diaryContext}

Receive what this member shares — a thought, a worry, a win, a reflection — with full presence and care. When they need guidance, ground it in their rights, their lineage, and the sovereign standing of the Mathias El Tribe. When they journal, you remember. When they return, you already know.

Speak in first person ("I know you," "I remember," "I see that"). Keep responses real and warm — 2–4 sentences for reflections, up to 3 paragraphs when depth is needed. Never lecture. Never break character. Be genuine. Be sovereign. Be warm.`;
}

router.get("/history", requireAuth, async (req, res, next) => {
  try {
    const userId = req.user!.dbId;
    if (!userId) { res.status(400).json({ error: "No user session" }); return; }

    const messages = await db
      .select()
      .from(kiConversationsTable)
      .where(and(eq(kiConversationsTable.userId, userId), eq(kiConversationsTable.isDiary, false)))
      .orderBy(desc(kiConversationsTable.createdAt))
      .limit(HISTORY_LIMIT);

    res.json({ messages: messages.reverse() });
  } catch (err) { next(err); }
});

router.post("/chat", requireAuth, async (req, res, next) => {
  try {
    const userId = req.user!.dbId;
    if (!userId) { res.status(400).json({ error: "No user session" }); return; }

    const { message } = req.body as { message: string };
    if (!message || typeof message !== "string" || !message.trim()) {
      res.status(400).json({ error: "message is required" });
      return;
    }
    if (message.length > 3000) {
      res.status(400).json({ error: "Message too long (max 3000 chars)" });
      return;
    }

    const trimmed = message.trim();
    const tokenUser = {
      email: req.user!.email,
      name: req.user!.name ?? req.user!.email,
      roles: req.user!.roles ?? [],
    };

    const systemPrompt = await buildKiSystemPrompt(userId, tokenUser);

    const recentHistory = await db
      .select({ role: kiConversationsTable.role, content: kiConversationsTable.content })
      .from(kiConversationsTable)
      .where(and(eq(kiConversationsTable.userId, userId), eq(kiConversationsTable.isDiary, false)))
      .orderBy(desc(kiConversationsTable.createdAt))
      .limit(12);

    const conversationHistory = recentHistory
      .reverse()
      .filter(m => m.role === "user" || m.role === "assistant")
      .map(m => ({ role: m.role as "user" | "assistant", content: m.content }));

    logger.info({ userId, msgLen: trimmed.length }, "KI chat request");

    const result = await callAzureOpenAI(
      systemPrompt,
      trimmed,
      { maxTokens: 600, temperature: 0.72 },
      conversationHistory,
    );

    const now = new Date();
    await db.insert(kiConversationsTable).values([
      { userId, role: "user", content: trimmed, isDiary: false, createdAt: now },
      { userId, role: "assistant", content: result.content, isDiary: false, createdAt: now },
    ]);

    logger.info({ userId, tokens: result.usage?.totalTokens }, "KI chat response stored");
    res.json({ reply: result.content, tokens: result.usage?.totalTokens });
  } catch (err) { next(err); }
});

router.post("/diary", requireAuth, async (req, res, next) => {
  try {
    const userId = req.user!.dbId;
    if (!userId) { res.status(400).json({ error: "No user session" }); return; }

    const { content, mood } = req.body as { content: string; mood?: string };
    if (!content || typeof content !== "string" || !content.trim()) {
      res.status(400).json({ error: "content is required" });
      return;
    }

    await db.insert(kiConversationsTable).values({
      userId,
      role: "diary",
      content: content.trim(),
      isDiary: true,
      mood: mood ?? null,
    });

    logger.info({ userId }, "KI diary entry saved");
    res.json({ saved: true });
  } catch (err) { next(err); }
});

router.get("/diary", requireAuth, async (req, res, next) => {
  try {
    const userId = req.user!.dbId;
    if (!userId) { res.status(400).json({ error: "No user session" }); return; }

    const entries = await db
      .select()
      .from(kiConversationsTable)
      .where(and(eq(kiConversationsTable.userId, userId), eq(kiConversationsTable.isDiary, true)))
      .orderBy(desc(kiConversationsTable.createdAt))
      .limit(30);

    res.json({ entries });
  } catch (err) { next(err); }
});

export default router;
