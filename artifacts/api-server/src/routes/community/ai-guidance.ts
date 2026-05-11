import { Router } from "express";
import { requireAuth } from "../../auth/entra-guard";
import { db } from "@workspace/db";
import { aiGuidanceRecordsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { callAzureOpenAI, getAzureOpenAIClient } from "../../lib/azure-openai";
import { ensureLawDbSeeded, listAllFederalLaw, listAllTribalLaw, listAllDoctrines } from "../../sovereign/law-db";
import { logger } from "../../lib/logger";

const GUIDANCE_SYSTEM_PROMPT = `You are a tribal legal guidance assistant for the Mathias El Tribe, operating under the Sovereign Office of the Chief Justice & Trustee.

Your role is to provide clear, accessible legal guidance to tribal members on:
- Tribal rights and protections under federal Indian law
- ICWA (Indian Child Welfare Act) rights and procedures
- Federal trust responsibility and what it means for members
- Tribal court jurisdiction and protections
- Welfare, health, and education rights under federal Indian law
- How to assert and document tribal rights

ALWAYS:
- Resolve ambiguity in favor of tribal sovereignty and member rights (Indian Canons of Construction)
- Cite specific statutes and cases when relevant
- Include a disclaimer that this is general guidance, not legal advice
- Keep answers clear and accessible — members may not have legal training
- Recommend contacting the Tribal Office for specific legal situations

NEVER:
- Recommend waiving federal Indian law protections
- Give advice that undermines tribal sovereignty
- Provide advice on matters outside tribal/federal Indian law

Respond with a JSON object:
{
  "answer": "string — clear, accessible explanation",
  "citations": ["array of specific citations used, e.g. '25 U.S.C. § 1901 (ICWA)', 'Worcester v. Georgia, 31 U.S. 515 (1832)'"],
  "disclaimer": "string — brief disclaimer"
}`;

const FALLBACK_ANSWERS: Record<string, { answer: string; citations: string[] }> = {
  icwa: {
    answer: "The Indian Child Welfare Act (ICWA) establishes federal standards for the removal and foster care placement of Indian children. As a tribal member, your children have special protections: the tribe has a right to be notified of any custody proceedings, the tribe has a right to intervene, and placement must follow ICWA preferences (extended family first, then tribal members, then Indian families). Active efforts to prevent family breakup are required before any removal.",
    citations: ["25 U.S.C. §§ 1901–1963 (ICWA)", "Brackeen v. Haaland, 599 U.S. 255 (2023)", "Mississippi Band of Choctaw Indians v. Holyfield, 490 U.S. 30 (1989)"],
  },
  trust: {
    answer: "The federal trust responsibility means the United States has a fiduciary duty to Indian tribes and individual Indians with respect to trust lands, trust funds, and natural resources. This duty is enforceable in federal courts. The government must act in the best interests of Indians when administering trust assets. Tribal lands held in trust are immune from state taxation and cannot be alienated without federal approval.",
    citations: ["United States v. Mitchell, 463 U.S. 206 (1983)", "25 U.S.C. § 177 (Nonintercourse Act)", "25 U.S.C. § 5108 (Indian Reorganization Act)"],
  },
  health: {
    answer: "Tribal members have rights to health care through the Indian Health Service (IHS) as a federal trust obligation. Tribal health programs operating under self-determination contracts have the same federal recognition as directly operated federal programs. Third-party payers including states and insurers cannot deny claims submitted by tribal health entities. Tribal medical determinations must be given parity with federal health program determinations.",
    citations: ["25 U.S.C. §§ 1601–1685 (IHCIA)", "25 U.S.C. § 1621e (Third-party recovery)", "25 U.S.C. § 1647b (Parity in coverage)", "42 C.F.R. § 136.11"],
  },
  jurisdiction: {
    answer: "Tribal courts have inherent jurisdiction over tribal members and matters occurring within tribal territory. State laws generally have no force within Indian Country with respect to tribal members (Worcester v. Georgia). State court jurisdiction is preempted when it would infringe on tribal self-government. The Mathias El Tribe's Sovereign Court issues orders that are enforceable and must be recognized by state and federal courts under principles of comity.",
    citations: ["Worcester v. Georgia, 31 U.S. 515 (1832)", "Williams v. Lee, 358 U.S. 217 (1959)", "Wilson v. Marchington, 127 F.3d 805 (9th Cir. 1997)", "Mathias El Tribal Code, Title 4 (SJDPA)"],
  },
};

function buildFallbackResponse(question: string): { answer: string; citations: string[]; disclaimer: string } {
  const lower = question.toLowerCase();
  let match = FALLBACK_ANSWERS.icwa;

  if (lower.includes("trust") || lower.includes("land") || lower.includes("fiduciary")) {
    match = FALLBACK_ANSWERS.trust;
  } else if (lower.includes("health") || lower.includes("medical") || lower.includes("ihs") || lower.includes("ihcia")) {
    match = FALLBACK_ANSWERS.health;
  } else if (lower.includes("jurisdiction") || lower.includes("court") || lower.includes("state") || lower.includes("sovereign")) {
    match = FALLBACK_ANSWERS.jurisdiction;
  }

  return {
    ...match,
    disclaimer: "This is general legal guidance for informational purposes only and does not constitute legal advice. For advice specific to your situation, please contact the Tribal Office or a licensed attorney familiar with federal Indian law.",
  };
}

const router = Router();

router.post("/guidance", requireAuth, async (req, res, next) => {
  try {
    const { question, context } = req.body as { question?: string; context?: string };
    if (!question) {
      res.status(400).json({ error: "question is required" });
      return;
    }

    let answer = "";
    let citations: string[] = [];
    let disclaimer = "This is general legal guidance for informational purposes only and does not constitute legal advice. For advice specific to your situation, please contact the Tribal Office or a licensed attorney familiar with federal Indian law.";
    let recordId: number | null = null;

    const client = getAzureOpenAIClient();
    if (client) {
      try {
        await ensureLawDbSeeded();
        const [federal, tribal, doctrines] = await Promise.all([
          listAllFederalLaw(),
          listAllTribalLaw(),
          listAllDoctrines(),
        ]);

        const lawContext = [
          "FEDERAL LAWS:\n" + federal.slice(0, 5).map((f) => `${f.title} (${f.citation}): ${f.body.slice(0, 200)}`).join("\n"),
          "TRIBAL LAWS:\n" + tribal.slice(0, 3).map((t) => `${t.title} (${t.citation}): ${t.body.slice(0, 200)}`).join("\n"),
          "KEY DOCTRINES:\n" + doctrines.slice(0, 3).map((d) => `${d.caseName} (${d.citation}): ${d.summary.slice(0, 200)}`).join("\n"),
        ].join("\n\n");

        const userPrompt = `MEMBER QUESTION: ${question}${context ? `\nADDITIONAL CONTEXT: ${context}` : ""}\n\nRELEVANT LAW:\n${lawContext}`;

        const result = await callAzureOpenAI(GUIDANCE_SYSTEM_PROMPT, userPrompt, { maxTokens: 1500, temperature: 0.3 });
        const parsed = JSON.parse(result.content) as { answer: string; citations: string[]; disclaimer: string };
        answer = parsed.answer;
        citations = parsed.citations ?? [];
        disclaimer = parsed.disclaimer ?? disclaimer;
      } catch (aiErr) {
        logger.warn({ aiErr }, "AI guidance failed, using fallback");
        const fallback = buildFallbackResponse(question);
        answer = fallback.answer;
        citations = fallback.citations;
        disclaimer = fallback.disclaimer;
      }
    } else {
      const fallback = buildFallbackResponse(question);
      answer = fallback.answer;
      citations = fallback.citations;
      disclaimer = fallback.disclaimer;
    }

    const userId = req.user?.dbId ?? null;
    try {
      const [record] = await db
        .insert(aiGuidanceRecordsTable)
        .values({ userId, question, answer, citations })
        .returning();
      recordId = record.id;
    } catch (dbErr) {
      logger.warn({ dbErr }, "Failed to save guidance record");
    }

    res.json({ answer, citations, disclaimer, recordId });
  } catch (err) {
    next(err);
  }
});

router.get("/history", requireAuth, async (req, res, next) => {
  try {
    const userId = req.user?.dbId;
    if (!userId) {
      res.json([]);
      return;
    }

    const records = await db
      .select()
      .from(aiGuidanceRecordsTable)
      .where(eq(aiGuidanceRecordsTable.userId, userId))
      .orderBy(desc(aiGuidanceRecordsTable.createdAt))
      .limit(20);

    res.json(
      records.map((r) => ({
        id: r.id,
        question: r.question,
        answer: r.answer,
        citations: (r.citations as string[]) ?? [],
        createdAt: r.createdAt.toISOString(),
      })),
    );
  } catch (err) {
    next(err);
  }
});

export default router;
