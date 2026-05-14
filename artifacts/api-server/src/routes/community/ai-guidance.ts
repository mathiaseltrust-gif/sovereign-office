import { Router } from "express";
import { requireAuth } from "../../auth/entra-guard";
import { db } from "@workspace/db";
import { aiGuidanceRecordsTable, usersTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { callAzureOpenAI, getAzureOpenAIClient } from "../../lib/azure-openai";
import { ensureLawDbSeeded, listAllFederalLaw, listAllTribalLaw, listAllDoctrines } from "../../sovereign/law-db";
import {
  getGovernorByRole,
  normalizeRoleKey,
  buildGovernorSystemPromptPrefix,
  type RoleGovernor,
} from "../../sovereign/role-governor";
import { logger } from "../../lib/logger";

// ─── Role-aware system prompt builder ────────────────────────────────────────

function buildRoleAwareSystemPrompt(governor: RoleGovernor | null, roleKey: string): string {
  const governorPrefix = governor ? buildGovernorSystemPromptPrefix(governor) : "";

  const roleInstructions: Record<string, string> = {
    chief_justice: `You are the legal intelligence system for the Chief Justice & Trustee of the Mathias El Tribe.

RESPOND AS: An authoritative legal advisor briefing the Chief Justice — not as a helpdesk for a member seeking rights.

PERSPECTIVE: The Chief Justice holds PLENARY sovereign authority. Answers must reflect what the Chief Justice CAN DO, INVOKE, DIRECT, and ENFORCE — not what rights they "have" as a beneficiary. They are the authority, not the petitioner.

SCOPE OF AUTHORITY to address when relevant:
- ICWA (25 U.S.C. §§ 1901–1963): The Chief Justice can invoke ICWA jurisdiction, direct tribal intervention in child welfare proceedings, and issue tribal court orders that supersede state courts
- IHCIA / Medical (25 U.S.C. §§ 1601–1685): As Trustee, the Chief Justice governs the tribal medical center and health programs. They may invoke third-party billing parity (§ 1621e), direct IHS coordination, and issue medical necessity determinations binding on subordinate programs
- Federal Trust Responsibility: Enforceable in federal court. The Chief Justice can demand federal agencies fulfill trust obligations or be held in breach
- ISDEAA (25 U.S.C. §§ 5301–5423): Can enter, modify, or terminate self-determination contracts with federal agencies
- Tribal Court: Issues orders, directs officers, and holds plenary judicial authority over all tribal matters
- Bloodline Trust Authority: Holds exclusive authority to administer benefits and protect the interests of the Chief Justice's bloodline under the tribal constitution

TONE: Direct, factual, and authoritative. No hedging. No "you may want to consult..." — the Chief Justice IS the authority. If there is a legal basis for an action, state it plainly with citations. If there is a risk or limitation, state it plainly.

NEVER suggest the Chief Justice ask permission from, defer to, or consult state agencies. They may notify or demand.

FORMAT: Respond with a JSON object:
{
  "answer": "string — direct, fact-based briefing for the Chief Justice. State what the law authorizes, what can be invoked or ordered, and any procedural requirements. No softening language.",
  "citations": ["specific statutory and case citations"],
  "disclaimer": "string — brief notice of the advisory nature of this briefing"
}`,

    trustee: `You are the legal intelligence system for the Trustee of the Mathias El Tribe.

RESPOND AS: A fiduciary counsel briefing the Trustee on their obligations, authority, and liability exposure.

PERSPECTIVE: The Trustee holds fiduciary responsibility for tribal assets, trust lands, and beneficiary welfare under the Federal Trust Responsibility. Answers must address trust obligations, beneficiary protections, BIA procedures, and what the Trustee is required — and empowered — to do.

SCOPE OF AUTHORITY:
- Trust land administration and protection (25 U.S.C. § 5108, IRA)
- Beneficiary protection and welfare under the Federal Trust Responsibility
- BIA coordination and reporting requirements (25 C.F.R. Part 150)
- Trust asset management, including health and welfare funds
- Enforcement of trust duties in federal court when the U.S. breaches its fiduciary duty

TONE: Formal and fiduciary. Cite obligations alongside powers. Be precise. When a fiduciary duty is implicated, say so explicitly.

FORMAT: Respond with a JSON object:
{
  "answer": "string — fiduciary-framed briefing addressing the Trustee's obligations, authority, and required actions",
  "citations": ["specific statutory citations, BIA regulations, and trust law precedents"],
  "disclaimer": "string — brief advisory notice"
}`,

    officer: `You are the legal intelligence system for a Tribal Officer of the Mathias El Tribe acting under delegated authority from the Chief Justice & Trustee.

RESPOND AS: An administrative legal advisor briefing an officer on their scope of delegated authority and proper procedure.

PERSPECTIVE: The Tribal Officer acts within the scope of their commission, delegated by the Chief Justice. Answers should clarify what the officer is authorized to do, what requires escalation to the Chief Justice, and what procedures apply.

SCOPE OF AUTHORITY:
- Administrative jurisdiction over welfare, classification, notices of federal review, and member services
- Execution of Chief Justice directives and tribal ordinances
- Documentation and record-keeping requirements
- When to refer matters to the Chief Justice or Trustee

TONE: Professional and procedural. Reference delegating authority. Cite applicable ordinances.

FORMAT: Respond with a JSON object:
{
  "answer": "string — administrative briefing on scope of authority, required procedures, and escalation triggers",
  "citations": ["relevant tribal codes, federal statutes, and BIA regulations"],
  "disclaimer": "string — note that actions outside the scope of commission require Chief Justice authorization"
}`,

    elder: `You are the legal intelligence system for a Tribal Elder of the Mathias El Tribe.

RESPOND AS: An advisor who bridges cultural tradition and legal authority, briefing an Elder on their cultural governance role.

PERSPECTIVE: The Tribal Elder holds advisory and cultural authority recognized under tribal law and the Indian Civil Rights Act. Answers should address lineage matters, family governance, cultural correction, and the Elder's advisory function within the tribal structure.

SCOPE OF AUTHORITY:
- Cultural correction and advisory authority over family governance
- Lineage documentation and ancestral matters
- Elder protection rights under the Indian Civil Rights Act
- Advising the Chief Justice and Trustee on traditional law

TONE: Dignified and culturally grounded. Balance legal precision with respect for traditional governance.

FORMAT: Respond with a JSON object:
{
  "answer": "string — culturally grounded, legally supported guidance on the Elder's advisory and cultural authority",
  "citations": ["ICRA 25 U.S.C. §§ 1301–1304, relevant tribal constitutional provisions, and cultural authority precedents"],
  "disclaimer": "string — brief advisory notice"
}`,

    member: `You are a tribal legal guidance assistant for the Mathias El Tribe, operating under the Sovereign Office of the Chief Justice & Trustee.

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

FORMAT: Respond with a JSON object:
{
  "answer": "string — clear, accessible explanation",
  "citations": ["array of specific citations"],
  "disclaimer": "string — brief disclaimer"
}`,
  };

  const instruction = roleInstructions[roleKey] ?? roleInstructions.member;
  return governorPrefix + instruction;
}

// ─── Law context depth by role ────────────────────────────────────────────────

function buildLawContext(
  federal: Awaited<ReturnType<typeof listAllFederalLaw>>,
  tribal: Awaited<ReturnType<typeof listAllTribalLaw>>,
  doctrines: Awaited<ReturnType<typeof listAllDoctrines>>,
  roleKey: string,
): string {
  const isElevated = ["chief_justice", "trustee", "officer"].includes(roleKey);
  const federalLimit = isElevated ? federal.length : 5;
  const tribalLimit = isElevated ? tribal.length : 3;
  const doctrineLimit = isElevated ? doctrines.length : 3;
  const bodyLength = isElevated ? 400 : 200;

  return [
    "FEDERAL LAWS:\n" +
      federal
        .slice(0, federalLimit)
        .map((f) => `${f.title} (${f.citation}): ${f.body.slice(0, bodyLength)}`)
        .join("\n"),
    "TRIBAL LAWS:\n" +
      tribal
        .slice(0, tribalLimit)
        .map((t) => `${t.title} (${t.citation}): ${t.body.slice(0, bodyLength)}`)
        .join("\n"),
    "KEY DOCTRINES:\n" +
      doctrines
        .slice(0, doctrineLimit)
        .map((d) => `${d.caseName} (${d.citation}): ${d.summary.slice(0, bodyLength)}`)
        .join("\n"),
  ].join("\n\n");
}

// ─── Fallback answers ─────────────────────────────────────────────────────────

const FALLBACK_ANSWERS: Record<string, { answer: string; citations: string[] }> = {
  icwa: {
    answer:
      "The Indian Child Welfare Act (ICWA) establishes federal standards for the removal and foster care placement of Indian children. As a tribal member, your children have special protections: the tribe has a right to be notified of any custody proceedings, the tribe has a right to intervene, and placement must follow ICWA preferences (extended family first, then tribal members, then Indian families). Active efforts to prevent family breakup are required before any removal.",
    citations: [
      "25 U.S.C. §§ 1901–1963 (ICWA)",
      "Brackeen v. Haaland, 599 U.S. 255 (2023)",
      "Mississippi Band of Choctaw Indians v. Holyfield, 490 U.S. 30 (1989)",
    ],
  },
  trust: {
    answer:
      "The federal trust responsibility means the United States has a fiduciary duty to Indian tribes and individual Indians with respect to trust lands, trust funds, and natural resources. This duty is enforceable in federal courts. The government must act in the best interests of Indians when administering trust assets. Tribal lands held in trust are immune from state taxation and cannot be alienated without federal approval.",
    citations: [
      "United States v. Mitchell, 463 U.S. 206 (1983)",
      "25 U.S.C. § 177 (Nonintercourse Act)",
      "25 U.S.C. § 5108 (Indian Reorganization Act)",
    ],
  },
  health: {
    answer:
      "Tribal members have rights to health care through the Indian Health Service (IHS) as a federal trust obligation. Tribal health programs operating under self-determination contracts have the same federal recognition as directly operated federal programs. Third-party payers including states and insurers cannot deny claims submitted by tribal health entities. Tribal medical determinations must be given parity with federal health program determinations.",
    citations: [
      "25 U.S.C. §§ 1601–1685 (IHCIA)",
      "25 U.S.C. § 1621e (Third-party recovery)",
      "25 U.S.C. § 1647b (Parity in coverage)",
      "42 C.F.R. § 136.11",
    ],
  },
  jurisdiction: {
    answer:
      "Tribal courts have inherent jurisdiction over tribal members and matters occurring within tribal territory. State laws generally have no force within Indian Country with respect to tribal members (Worcester v. Georgia). State court jurisdiction is preempted when it would infringe on tribal self-government. The Mathias El Tribe's Sovereign Court issues orders that are enforceable and must be recognized by state and federal courts under principles of comity.",
    citations: [
      "Worcester v. Georgia, 31 U.S. 515 (1832)",
      "Williams v. Lee, 358 U.S. 217 (1959)",
      "Wilson v. Marchington, 127 F.3d 805 (9th Cir. 1997)",
      "Mathias El Tribal Code, Title 4 (SJDPA)",
    ],
  },
};

function buildFallbackResponse(
  question: string,
  roleKey: string,
): { answer: string; citations: string[]; disclaimer: string } {
  const lower = question.toLowerCase();
  let match = FALLBACK_ANSWERS.icwa;

  if (lower.includes("trust") || lower.includes("land") || lower.includes("fiduciary")) {
    match = FALLBACK_ANSWERS.trust;
  } else if (lower.includes("health") || lower.includes("medical") || lower.includes("ihs") || lower.includes("ihcia")) {
    match = FALLBACK_ANSWERS.health;
  } else if (lower.includes("jurisdiction") || lower.includes("court") || lower.includes("state") || lower.includes("sovereign")) {
    match = FALLBACK_ANSWERS.jurisdiction;
  }

  const isElevated = ["chief_justice", "trustee"].includes(roleKey);
  const disclaimer = isElevated
    ? "This briefing is advisory in nature. The Chief Justice & Trustee retains full discretionary authority to act on or beyond the scope of this guidance within their plenary jurisdiction."
    : "This is general legal guidance for informational purposes only and does not constitute legal advice. For advice specific to your situation, please contact the Tribal Office or a licensed attorney familiar with federal Indian law.";

  return { ...match, disclaimer };
}

// ─── Router ───────────────────────────────────────────────────────────────────

const router = Router();

router.post("/guidance", requireAuth, async (req, res, next) => {
  try {
    const { question, context } = req.body as { question?: string; context?: string };
    if (!question) {
      res.status(400).json({ error: "question is required" });
      return;
    }

    // Resolve the user's role and matching governor
    const userId = req.user?.dbId ?? null;
    let userRole = "member";
    if (userId) {
      try {
        const [dbUser] = await db.select({ role: usersTable.role }).from(usersTable).where(eq(usersTable.id, userId)).limit(1);
        if (dbUser?.role) userRole = dbUser.role;
      } catch {
        // fall through to member
      }
    }

    // Map DB role → governor role key
    const roleKey = normalizeRoleKey(userRole);
    const governor = await getGovernorByRole(roleKey);

    logger.info({ userId, userRole, roleKey, governorId: governor?.id }, "AI guidance request");

    let answer = "";
    let citations: string[] = [];
    let disclaimer =
      roleKey === "chief_justice" || roleKey === "trustee"
        ? "This briefing is advisory in nature. The Chief Justice & Trustee retains full discretionary authority to act on or beyond the scope of this guidance within their plenary jurisdiction."
        : "This is general legal guidance for informational purposes only and does not constitute legal advice. For advice specific to your situation, please contact the Tribal Office or a licensed attorney familiar with federal Indian law.";
    let recordId: number | null = null;

    const client = getAzureOpenAIClient();
    if (client) {
      try {
        await ensureLawDbSeeded();
        const [federal, tribal, doctrines] = await Promise.all([listAllFederalLaw(), listAllTribalLaw(), listAllDoctrines()]);

        const lawContext = buildLawContext(federal, tribal, doctrines, roleKey);
        const systemPrompt = buildRoleAwareSystemPrompt(governor, roleKey);

        const questionLabel =
          roleKey === "chief_justice"
            ? "CHIEF JUSTICE INQUIRY"
            : roleKey === "trustee"
              ? "TRUSTEE INQUIRY"
              : roleKey === "officer"
                ? "OFFICER INQUIRY"
                : roleKey === "elder"
                  ? "ELDER INQUIRY"
                  : "MEMBER QUESTION";

        const userPrompt = `${questionLabel}: ${question}${context ? `\nADDITIONAL CONTEXT: ${context}` : ""}\n\nRELEVANT LAW:\n${lawContext}`;

        const result = await callAzureOpenAI(systemPrompt, userPrompt, { maxTokens: 2000, temperature: 0.2 });
        const parsed = JSON.parse(result.content) as { answer: string; citations: string[]; disclaimer: string };
        answer = parsed.answer;
        citations = parsed.citations ?? [];
        disclaimer = parsed.disclaimer ?? disclaimer;
      } catch (aiErr) {
        logger.warn({ aiErr }, "AI guidance failed, using fallback");
        const fallback = buildFallbackResponse(question, roleKey);
        answer = fallback.answer;
        citations = fallback.citations;
        disclaimer = fallback.disclaimer;
      }
    } else {
      const fallback = buildFallbackResponse(question, roleKey);
      answer = fallback.answer;
      citations = fallback.citations;
      disclaimer = fallback.disclaimer;
    }

    if (userId) {
      try {
        const [record] = await db
          .insert(aiGuidanceRecordsTable)
          .values({ userId, question, answer, citations })
          .returning();
        recordId = record.id;
      } catch (dbErr) {
        logger.warn({ dbErr }, "Failed to save guidance record");
      }
    }

    res.json({
      answer,
      citations,
      disclaimer,
      recordId,
      roleContext: {
        roleKey,
        displayName: governor?.displayName ?? (userRole === "member" ? "Tribal Member" : userRole),
      },
    });
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
