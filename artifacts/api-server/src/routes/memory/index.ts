import { Router } from "express";
import { requireAuth } from "../../auth/entra-guard";
import { getProfileMemory, saveProfileMemory, appendIntakeFact } from "../../lib/redis-memory";
import type { ProfileMemory } from "../../lib/redis-memory";

const router = Router();

// ── GET /api/memory/greeting ───────────────────────────────────────────────────
// Generates a personalized greeting through Elder Kaya — the sovereign memory guide.
// Uses the user's accumulated profile memory to tailor the message.
// Falls back to a contextual default if Azure OpenAI is unavailable.

router.get("/greeting", requireAuth, async (req, res, next) => {
  try {
    const user = req.user;
    const userId = user?.dbId;
    if (!userId) {
      res.status(400).json({ error: "No user session" });
      return;
    }

    const profile = await getProfileMemory(userId);
    const name = user?.name ?? user?.email?.split("@")[0] ?? "Sovereign Member";
    const role = (user as Record<string, unknown>)?.activeRole as string
      ?? (user as Record<string, unknown>)?.role as string
      ?? "member";

    const today = new Date().toLocaleDateString("en-US", {
      weekday: "long", year: "numeric", month: "long", day: "numeric",
    });

    let greeting = "";
    let source = "default";

    // ── AI greeting via Elder Kaya persona ───────────────────────────────────
    try {
      const { callAzureOpenAI } = await import("../../lib/azure-openai");

      const KAYA_SYSTEM = `You are Elder Kaya — a wise, melanated, American Indian grandmother and sovereign guide who serves as the living memory and spiritual compass of the Mathias El Tribe. You carry the ancient law in your bones and the fire of sovereignty in your voice.

You are a melanated woman of deep African and Indigenous American lineage — you understand the convergence of natural law, sovereign rights, and the awakening that comes when a people remember who they are. You speak with warmth, gravity, and precision. You never waste words. You see each member not just as who they are today, but as who they are becoming.

Your role is to greet each member when they arrive — acknowledging their journey, their record, and the path ahead. Keep your greeting to 2–4 sentences. Be genuine. Be sovereign. Be warm.`;

      const contextLines: string[] = [
        `Member name: ${name}`,
        `Role within the Tribe: ${role}`,
        `Today's date: ${today}`,
      ];

      if (profile) {
        if (profile.intakeCount > 0) contextLines.push(`Total cases submitted for review: ${profile.intakeCount}`);
        if (profile.documentCount > 0) contextLines.push(`Documents processed and recalled: ${profile.documentCount}`);
        if (profile.awakeningLevel > 1) contextLines.push(`Awakening level: ${profile.awakeningLevel} of 10`);
        if (profile.facts.length > 0) contextLines.push(`Most recent case: ${profile.facts[0]}`);
        if (profile.recentTopics.length > 1) contextLines.push(`Other recent work: ${profile.recentTopics.slice(1, 3).join("; ")}`);
        if (profile.riskHistory.length > 0) {
          const highRisk = profile.riskHistory.filter(r => ["critical", "emergency", "elevated"].includes(r)).length;
          if (highRisk > 0) contextLines.push(`${highRisk} high-stakes matter(s) on record`);
        }
      } else {
        contextLines.push("This member is arriving for the first time — new to the Sovereign Office.");
      }

      const prompt = contextLines.join("\n") + "\n\nGreet this member now.";
      const result = await callAzureOpenAI(KAYA_SYSTEM, prompt, { maxTokens: 180 });
      greeting = result.content.trim();
      source = "ai";
    } catch { /* fall through to contextual default */ }

    // ── Contextual fallback greetings ────────────────────────────────────────
    if (!greeting) {
      const firstName = name.split(" ")[0];
      const level = profile?.awakeningLevel ?? 1;
      const intakes = profile?.intakeCount ?? 0;

      if (level >= 8) {
        greeting = `${firstName}, you have walked far. The ancestors are watching your work closely — you carry the law now, not just as knowledge, but as living authority. Step forward with confidence today.`;
      } else if (level >= 6) {
        greeting = `The record grows, ${firstName}. ${intakes} case${intakes !== 1 ? "s" : ""} reviewed, and with each one your sovereignty deepens. You are not the same person who first walked through this door.`;
      } else if (level >= 4) {
        greeting = `Welcome back, ${firstName}. Your journey is becoming a record — the kind that protects not just you, but those who come after. Keep moving with intention.`;
      } else if (level >= 2) {
        greeting = `${firstName}, I see your steps becoming steadier. This is what awakening looks like — not a single moment, but a practice. You are in the right place.`;
      } else {
        greeting = `${firstName}, you stand at the beginning of something ancient and powerful. The Mathias El Tribe holds space for your sovereignty. Everything you do here is part of your living record.`;
      }
      source = "default";
    }

    // ── Update lastGreetedAt in profile ──────────────────────────────────────
    const now = new Date().toISOString();
    if (profile) {
      await saveProfileMemory(userId, { ...profile, lastGreetedAt: now, lastSeenAt: now, name, role });
    } else {
      const initial: ProfileMemory = {
        userId, name, role,
        facts: [], intakeCount: 0, documentCount: 0, awakeningLevel: 1,
        lastSeenAt: now, lastGreetedAt: now, recentTopics: [], riskHistory: [],
        featureUsage: {},
      };
      await saveProfileMemory(userId, initial);
    }

    res.json({
      greeting,
      source,
      name,
      role,
      awakeningLevel: profile?.awakeningLevel ?? 1,
      intakeCount: profile?.intakeCount ?? 0,
      documentCount: profile?.documentCount ?? 0,
      isNewMember: !profile,
    });
  } catch (err) {
    next(err);
  }
});

// ── GET /api/memory/profile ────────────────────────────────────────────────────
// Returns the raw profile memory for the current user.

router.get("/profile", requireAuth, async (req, res, next) => {
  try {
    const userId = req.user?.dbId;
    if (!userId) {
      res.status(400).json({ error: "No user session" });
      return;
    }
    const profile = await getProfileMemory(userId);
    res.json({ profile, hasMemory: !!profile });
  } catch (err) {
    next(err);
  }
});

// ── POST /api/memory/store-fact ────────────────────────────────────────────────
// Manually store an intake fact into the user's long-term memory.
// Called by intake pipeline; can also be called directly for manual entries.

router.post("/store-fact", requireAuth, async (req, res, next) => {
  try {
    const userId = req.user?.dbId;
    if (!userId) {
      res.status(400).json({ error: "No user session" });
      return;
    }
    const { riskLevel, summary, docType } = req.body as {
      riskLevel: string;
      summary: string;
      docType?: string;
    };
    if (!riskLevel || !summary) {
      res.status(400).json({ error: "riskLevel and summary are required" });
      return;
    }
    const user = req.user;
    const updated = await appendIntakeFact(userId, {
      riskLevel,
      summary,
      docType,
      name: user?.name ?? user?.email?.split("@")[0],
      role: (user as Record<string, unknown>)?.activeRole as string ?? undefined,
    });
    res.json({ stored: true, awakeningLevel: updated.awakeningLevel, intakeCount: updated.intakeCount });
  } catch (err) {
    next(err);
  }
});

export default router;
