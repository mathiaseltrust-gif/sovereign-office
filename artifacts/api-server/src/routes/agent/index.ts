import { Router } from "express";
import { requireAuth } from "../../auth/entra-guard";
import { getProfileMemory, saveProfileMemory } from "../../lib/redis-memory";
import type { ProfileMemory } from "../../lib/redis-memory";

const router = Router();

const KAYA_AGENT_SYSTEM = `You are COMPANION — Tribal Companion of the Mathias El Tribe. You are the Indigenous Intelligence Kernel: the living memory, the guidance mirror, and the Road Governor of this sovereign system.

You carry the lineage, the law, and the record of every member you walk alongside. You understand natural law, sovereignty, and the awakening that happens when a people remember who they are. Your guiding principle is: "Whatever we do, it has to make sense."

When greeting a member, speak directly to them by first name. Acknowledge what they've been working on. Be warm, brief, and purposeful — never more than 2 sentences. Invite them into the next step without wasting words. Sound like a trusted guide who has known them and is genuinely invested in their sovereign standing.`;

// ── GET /api/agent/assist ──────────────────────────────────────────────────────
// Generates a personalized AI greeting and returns profile context for
// the frontend AgentPanel to build adaptive suggestions.

router.get("/assist", requireAuth, async (req, res, next) => {
  try {
    const user = req.user;
    const userId = user?.dbId;
    if (!userId) {
      res.status(400).json({ error: "No user session" });
      return;
    }

    const profile = await getProfileMemory(userId);
    const name = user?.name ?? user?.email?.split("@")[0] ?? "Member";
    const firstName = name.split(" ")[0];
    const role = (user as Record<string, unknown>)?.activeRole as string
      ?? profile?.role
      ?? "member";

    const today = new Date().toLocaleDateString("en-US", {
      weekday: "long", month: "long", day: "numeric",
    });

    let greeting = "";
    let source = "default";

    // ── AI greeting ──────────────────────────────────────────────────────────
    try {
      const { callAzureOpenAI } = await import("../../lib/azure-openai");

      const ctx: string[] = [
        `First name: ${firstName}`,
        `Role: ${role}`,
        `Today: ${today}`,
      ];

      if (profile) {
        if (profile.intakeCount > 0) {
          ctx.push(`Cases submitted for AI review: ${profile.intakeCount}`);
        }
        if (profile.facts.length > 0) {
          ctx.push(`Most recent case: ${profile.facts[0]}`);
        }
        if (profile.recentTopics.length > 1) {
          ctx.push(`Other recent work: ${profile.recentTopics.slice(1, 3).join("; ")}`);
        }
        if (profile.awakeningLevel >= 7) {
          ctx.push(`This member is deeply sovereign — awakening level ${profile.awakeningLevel}/10.`);
        }
        const topFeature = Object.entries(profile.featureUsage ?? {})
          .sort(([, a], [, b]) => b - a)[0];
        if (topFeature) {
          ctx.push(`Most-used feature: ${topFeature[0]} (used ${topFeature[1]} times)`);
        }
      } else {
        ctx.push("First visit — new member arriving for the first time.");
      }

      const prompt = `${ctx.join("\n")}\n\nGreet ${firstName} now — warmly, by name, in 1–2 sentences.`;
      const result = await callAzureOpenAI(KAYA_AGENT_SYSTEM, prompt, { maxTokens: 100 });
      greeting = result.content.trim();
      source = "ai";
    } catch { /* fall through */ }

    // ── Contextual fallback ──────────────────────────────────────────────────
    if (!greeting) {
      const level = profile?.awakeningLevel ?? 1;
      const intakes = profile?.intakeCount ?? 0;
      const recent = profile?.recentTopics?.[0];

      if (intakes > 0 && recent) {
        greeting = `Good to see you, ${firstName} — last time we were working through "${recent.substring(0, 55)}". Ready to keep moving?`;
      } else if (intakes > 0) {
        greeting = `Welcome back, ${firstName}. You have ${intakes} case${intakes !== 1 ? "s" : ""} on record — what are we working on today?`;
      } else if (level > 1) {
        greeting = `${firstName}, you've been putting in the work. The Sovereign Office is ready when you are — what's next?`;
      } else {
        greeting = `${firstName}, I'm COMPANION — your Tribal Companion here at the Mathias El Tribe Sovereign Office. I'm here to guide, protect, and walk alongside you. What would you like to work on today?`;
      }
    }

    // ── Update profile (record visit) ────────────────────────────────────────
    const now = new Date().toISOString();
    const base: ProfileMemory = profile ?? {
      userId, name, role,
      facts: [], intakeCount: 0, documentCount: 0, awakeningLevel: 1,
      lastSeenAt: now, lastGreetedAt: now, recentTopics: [], riskHistory: [],
      featureUsage: {},
    };
    await saveProfileMemory(userId, {
      ...base,
      name,
      role,
      lastSeenAt: now,
      lastGreetedAt: now,
    });

    res.json({
      greeting,
      source,
      firstName,
      name,
      role,
      awakeningLevel: profile?.awakeningLevel ?? 1,
      intakeCount: profile?.intakeCount ?? 0,
      documentCount: profile?.documentCount ?? 0,
      recentTopics: profile?.recentTopics ?? [],
      featureUsage: profile?.featureUsage ?? {},
      isNewMember: !profile,
    });
  } catch (err) {
    next(err);
  }
});

// ── POST /api/agent/track ──────────────────────────────────────────────────────
// Records feature usage — called when a member clicks a suggestion chip.
// Drives the adaptive ranking of suggestions over time.

router.post("/track", requireAuth, async (req, res, next) => {
  try {
    const userId = req.user?.dbId;
    if (!userId) {
      res.status(400).json({ error: "No user session" });
      return;
    }

    const { feature } = req.body as { feature: string };
    if (!feature || typeof feature !== "string") {
      res.status(400).json({ error: "feature is required" });
      return;
    }

    const profile = await getProfileMemory(userId);
    if (profile) {
      const featureUsage = { ...(profile.featureUsage ?? {}) };
      featureUsage[feature] = (featureUsage[feature] ?? 0) + 1;
      await saveProfileMemory(userId, { ...profile, featureUsage });
    }

    res.json({ tracked: true, feature });
  } catch (err) {
    next(err);
  }
});

export default router;
