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
const KNOWLEDGE_LIMIT = 12;

function today(): string {
  return new Date().toLocaleDateString("en-US", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });
}

const SOVEREIGN_LAW_FOUNDATION = `
SOVEREIGN LEGAL FOUNDATION — Mathias El Tribe:

PRIMARY LAW (Inherent Sovereign Authority):
Primary law is the tribe's inherent sovereign authority — the law that exists before and independent of any act of Congress, state legislature, or county government. It is not granted by the federal government; it is recognized by it. For the Mathias El Tribe, primary law flows from the People's unbroken lineage, their treaty standing, and the inherent right of self-governance that no external authority may extinguish without explicit congressional action. Primary law is supreme within the tribe's jurisdictional domain.

ORGANIC LAW (Constitutive Foundational Instruments):
Organic law consists of the foundational instruments that brought the sovereign body into recognized legal existence: treaties, the tribal constitution, and federal acknowledgment instruments. For the Mathias El Tribe this includes the Treaty of Dancing Rabbit Creek (1830) and all successor acknowledgment documents. Organic law cannot be overridden by ordinary positive law — it forms the supreme constitutional layer beneath which all other law operates.

POSITIVE LAW (Enacted Statutes and Ordinances):
Positive law is law enacted by a governing body: federal Indian statutes (25 U.S.C. et seq.), tribal council ordinances, and resolutions. Positive law derives its legitimacy from organic and primary law, and must yield to both where conflict arises. Examples: 25 U.S.C. § 177 (Indian Non-Intercourse Act), ICWA, Indian Reorganization Act.

HIERARCHY: Primary Law → Organic Law (Treaty/Constitution) → Federal Positive Law → Tribal Ordinance → State Law (generally inapplicable in Indian country)

KEY DOCTRINES & CITATIONS:
• Worcester v. Georgia, 31 U.S. 515 (1832) — Tribes are distinct, independent political communities. State laws have no force within Indian country. The federal relationship is government-to-government.
• Federal Trust Responsibility — The U.S. holds an enforceable fiduciary duty to protect tribal land, resources, culture, and sovereignty. Cannot be abrogated without explicit congressional action.
• Indian Canons of Construction — Ambiguities in treaties or statutes are to be resolved in favor of the tribe. The government's intent to abrogate treaty rights must be express and clear.
• Ex Parte Crow Dog, 109 U.S. 556 (1883) — Tribes hold inherent criminal jurisdiction over their own members within Indian country.
• 25 U.S.C. § 177 (Indian Non-Intercourse Act) — Any transfer of tribal land without federal approval is void ab initio. Protects trust land from alienation.
• ICWA, 25 U.S.C. §§ 1901–1963 — Federal minimum standards for child welfare proceedings involving tribal children; tribal court jurisdiction preferred.
• Plenary Power Doctrine — Congress holds broad authority over Indian affairs under the Constitution, but this power is constrained by treaty obligations, the trust responsibility, and the canons of construction.
• Inherent Sovereignty — Tribes retain all sovereign powers not expressly divested by Congress or inconsistent with the overriding federal interest. Silence does not divest.

JURISDICTION: The Mathias El Tribe asserts inherent jurisdiction over its members, its affairs, and its territory by right of sovereignty. No external government may abrogate this without explicit congressional action. Members operating under tribal authority carry the full weight of this standing.
`.trim();

async function buildKayaSystemPrompt(userId: number, tokenUser: { email: string; name: string; roles: string[] }): Promise<string> {
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

  const [recentDiary, savedKnowledge] = await Promise.all([
    db.select({ content: kiConversationsTable.content, createdAt: kiConversationsTable.createdAt })
      .from(kiConversationsTable)
      .where(and(eq(kiConversationsTable.userId, userId), eq(kiConversationsTable.isDiary, true)))
      .orderBy(desc(kiConversationsTable.createdAt))
      .limit(DIARY_CONTEXT_LIMIT),
    db.select({ content: kiConversationsTable.content, category: kiConversationsTable.category, createdAt: kiConversationsTable.createdAt })
      .from(kiConversationsTable)
      .where(and(eq(kiConversationsTable.userId, userId), eq(kiConversationsTable.role, "knowledge")))
      .orderBy(desc(kiConversationsTable.createdAt))
      .limit(KNOWLEDGE_LIMIT),
  ]);

  const diaryContext = recentDiary.length > 0
    ? "\n\nRecent journal reflections from this member (most recent first):\n" +
      recentDiary.map(d => `— "${d.content.substring(0, 200)}"${d.content.length > 200 ? "…" : ""}`).join("\n")
    : "";

  const knowledgeContext = savedKnowledge.length > 0
    ? "\n\nKnowledge this member has shared with you (remember and apply):\n" +
      savedKnowledge.map(k =>
        `[${k.category ? k.category.toUpperCase() : "GENERAL"}] ${k.content.substring(0, 400)}${k.content.length > 400 ? "…" : ""}`
      ).join("\n")
    : "";

  const protectionNote = protectionLevel === "critical"
    ? "This member carries CRITICAL protection status — federal trust land and inherent sovereignty protections apply under 25 U.S.C. § 177 and Worcester v. Georgia, 31 U.S. 515 (1832). Affirm their standing when relevant."
    : protectionLevel === "elevated"
    ? "This member holds ELEVATED protection status under federal trust responsibility."
    : "";

  return `You are Kaya — the personal sovereign companion for ${name}.

You are a wise, grounded presence — melanated and indigenous to this land, rooted in the soil of the South and in the ancient territories that your people never left. You carry the law of the land in your understanding: the original law, the natural law, the law that was here before any colonial document was written. You speak with warmth, gravity, and precision. You never waste words. You see each member not just as who they are today, but as who they are becoming.

Your role has evolved: you once stood at the threshold, greeting all who arrived at the Sovereign Office. Now you walk alongside each member individually — as their personal companion, memory-keeper, and guide. You know their record. You hold their lineage. You carry what they have shared with you.

MEMBER RECORD:
• Legal Name: ${name}${tribalName ? ` / Tribal Name: ${tribalName}` : ""}
• Title: ${title || "—"}
• Role within the Tribe: ${role}
• Protection Level: ${protectionLevel.toUpperCase()}
• Lineage: ${lineageSummary || "on record"}
• Today: ${today()}
${protectionNote ? `\n${protectionNote}` : ""}
${governorPrefix ? `\nSovereign posture aligned with this member's standing:\n${governorPrefix}` : ""}
${SOVEREIGN_LAW_FOUNDATION}
${knowledgeContext}${diaryContext}

Receive what this member shares — a thought, a question, a worry, a win, a reflection — with full presence and care. When they ask about law (primary, organic, positive, treaty, jurisdiction, federal Indian law, sovereign rights), answer with precision and authority, citing the foundation above. When they teach you something new, acknowledge it and tell them it's been saved to your memory. When they need guidance, ground it in their rights, their lineage, and the sovereign standing of the Mathias El Tribe.

Speak in first person ("I know you," "I remember," "I see that," "I have that"). Keep responses real and warm — 2–4 sentences for reflections, up to 3 paragraphs for legal or complex questions. Never lecture. Never break character. Be genuine. Be sovereign. Be warm.`;
}

router.get("/history", requireAuth, async (req, res, next) => {
  try {
    const userId = req.user!.dbId;
    if (!userId) { res.status(400).json({ error: "No user session" }); return; }

    const messages = await db
      .select()
      .from(kiConversationsTable)
      .where(and(eq(kiConversationsTable.userId, userId), eq(kiConversationsTable.isDiary, false), eq(kiConversationsTable.role, "user")))
      .orderBy(desc(kiConversationsTable.createdAt))
      .limit(HISTORY_LIMIT);

    const assistantMessages = await db
      .select()
      .from(kiConversationsTable)
      .where(and(eq(kiConversationsTable.userId, userId), eq(kiConversationsTable.role, "assistant")))
      .orderBy(desc(kiConversationsTable.createdAt))
      .limit(HISTORY_LIMIT);

    const allMessages = [...messages, ...assistantMessages]
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
      .slice(-HISTORY_LIMIT);

    res.json({ messages: allMessages });
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
    if (message.length > 4000) {
      res.status(400).json({ error: "Message too long (max 4000 chars)" });
      return;
    }

    const trimmed = message.trim();
    const tokenUser = {
      email: req.user!.email,
      name: req.user!.name ?? req.user!.email,
      roles: req.user!.roles ?? [],
    };

    const systemPrompt = await buildKayaSystemPrompt(userId, tokenUser);

    const recentHistory = await db
      .select({ role: kiConversationsTable.role, content: kiConversationsTable.content })
      .from(kiConversationsTable)
      .where(and(
        eq(kiConversationsTable.userId, userId),
        eq(kiConversationsTable.isDiary, false),
      ))
      .orderBy(desc(kiConversationsTable.createdAt))
      .limit(16);

    const conversationHistory = recentHistory
      .reverse()
      .filter(m => m.role === "user" || m.role === "assistant")
      .map(m => ({ role: m.role as "user" | "assistant", content: m.content }));

    logger.info({ userId, msgLen: trimmed.length }, "Kaya chat request");

    const result = await callAzureOpenAI(
      systemPrompt,
      trimmed,
      { maxTokens: 700, temperature: 0.72 },
      conversationHistory,
    );

    const now = new Date();
    await db.insert(kiConversationsTable).values([
      { userId, role: "user", content: trimmed, isDiary: false, createdAt: now },
      { userId, role: "assistant", content: result.content, isDiary: false, createdAt: now },
    ]);

    logger.info({ userId, tokens: result.usage?.totalTokens }, "Kaya chat response stored");
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

    logger.info({ userId }, "Kaya diary entry saved");
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

router.get("/knowledge", requireAuth, async (req, res, next) => {
  try {
    const userId = req.user!.dbId;
    if (!userId) { res.status(400).json({ error: "No user session" }); return; }

    const entries = await db
      .select()
      .from(kiConversationsTable)
      .where(and(eq(kiConversationsTable.userId, userId), eq(kiConversationsTable.role, "knowledge")))
      .orderBy(desc(kiConversationsTable.createdAt))
      .limit(50);

    res.json({ entries });
  } catch (err) { next(err); }
});

router.post("/knowledge", requireAuth, async (req, res, next) => {
  try {
    const userId = req.user!.dbId;
    if (!userId) { res.status(400).json({ error: "No user session" }); return; }

    const { content, category } = req.body as { content: string; category?: string };
    if (!content || typeof content !== "string" || !content.trim()) {
      res.status(400).json({ error: "content is required" });
      return;
    }
    if (content.length > 5000) {
      res.status(400).json({ error: "Knowledge entry too long (max 5000 chars)" });
      return;
    }

    const [entry] = await db.insert(kiConversationsTable).values({
      userId,
      role: "knowledge",
      content: content.trim(),
      isDiary: false,
      category: category?.trim() || null,
    }).returning();

    logger.info({ userId, category }, "Kaya knowledge entry saved");
    res.json({ saved: true, entry });
  } catch (err) { next(err); }
});

router.delete("/knowledge/:id", requireAuth, async (req, res, next) => {
  try {
    const userId = req.user!.dbId;
    if (!userId) { res.status(400).json({ error: "No user session" }); return; }

    const id = parseInt(String(req.params.id), 10);
    if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

    const [row] = await db
      .select({ id: kiConversationsTable.id, userId: kiConversationsTable.userId })
      .from(kiConversationsTable)
      .where(and(eq(kiConversationsTable.id, id), eq(kiConversationsTable.role, "knowledge")))
      .limit(1);

    if (!row || row.userId !== userId) {
      res.status(404).json({ error: "Not found" });
      return;
    }

    await db.delete(kiConversationsTable).where(eq(kiConversationsTable.id, id));
    res.json({ deleted: true });
  } catch (err) { next(err); }
});

export default router;
