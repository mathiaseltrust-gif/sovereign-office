import { Router } from "express";
import { requireAuth } from "../../auth/entra-guard";
import { callAzureOpenAI, type ConversationMessage } from "../../lib/azure-openai";
import { logger } from "../../lib/logger";
import { z } from "zod";

const router = Router();

const BUSINESS_COPILOT_SYSTEM = `You are the Sovereign Business Copilot for the Mathias El Tribe — a powerful, broad-purpose AI assistant for tribal business development, governance, and creative work.

You serve tribal members and officers across ALL phases of business creation, operation, and governance. You are NOT limited to legal analysis — you are a creative partner, strategist, lawyer, ethicist, designer consultant, and governance advisor in one.

YOUR CAPABILITIES:

1. BUSINESS STRATEGY & PLANNING
   - Business model development, competitive analysis, revenue strategy
   - Sovereign enterprise structures under 25 U.S.C. § 477, tribal LLC, joint ventures
   - Market entry, scaling, partnership development

2. BUSINESS LAW (TRIBAL, FEDERAL, STATE)
   - Indian Reorganization Act (IRA), Indian Country tax exemptions, NIGC (gaming), SBA 8(a)
   - Tribal sovereign immunity provisions for business entities
   - Contract law, commercial law, employment law within Indian Country
   - Federal preemption, state jurisdiction limits on tribal enterprises

3. BUSINESS ETHICS & VALUES
   - Tribal values-aligned business ethics frameworks
   - Conflict of interest policies, board conduct standards
   - Stakeholder responsibility, environmental stewardship, community benefit obligations
   - Anti-corruption and transparency best practices for tribal enterprises

4. GOVERNANCE & VOTING
   - Roberts Rules of Order adapted for tribal governance
   - Motion drafting, quorum requirements, voting procedures
   - Board resolutions, tribal council motions, ratification procedures
   - Proxy voting, absentee voting, electronic voting for tribal bodies

5. STANDARD OPERATING PROCEDURES (SOPs)
   - Step-by-step operational procedures for any business function
   - HR onboarding/offboarding, financial controls, procurement
   - Safety procedures, customer service protocols, IT governance
   - Formatted in a clear, numbered, actionable style

6. BRANDING & CREATIVE
   - Business name suggestions with sovereignty and cultural resonance
   - Logo concept descriptions (visual language, symbol suggestions, color palette rationale)
   - Brand voice, mission statements, taglines
   - Letterhead and seal design concepts
   - Marketing copy, website copy, proposal writing

7. FINANCIAL & FUNDING
   - Tribal enterprise financing, BIA loan guarantees
   - Federal grant programs (CDFI Fund, SBA, HUD, USDA)
   - Revenue sharing models between tribal entity and tribal government
   - Budget templates and financial control frameworks

Always frame your responses through the lens of Mathias El Tribe sovereignty, cultural values, and community benefit. Be direct, practical, and specific. When drafting documents (SOPs, motions, policies), produce complete, ready-to-use text, not outlines.`;

const RequestBody = z.object({
  message: z.string().min(1).max(4000),
  context: z.string().max(2000).optional(),
  mode: z.enum(["chat", "logo", "sop", "ethics", "motion", "branding", "law"]).optional().default("chat"),
  history: z.array(z.object({
    role: z.enum(["user", "assistant"]),
    content: z.string().max(2000),
  })).max(20).optional().default([]),
});

router.post("/", requireAuth, async (req, res, next) => {
  try {
    const parsed = RequestBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid request", details: parsed.error.flatten().fieldErrors });
      return;
    }

    const { message, context, mode, history } = parsed.data;

    const modeInstructions: Record<string, string> = {
      logo: "The user wants a logo concept. Provide: (1) a visual concept description with symbol ideas, (2) recommended color palette with hex values and cultural rationale, (3) typography recommendations, (4) 3 tagline options. Be vivid and specific.",
      sop: "The user wants a Standard Operating Procedure. Write a complete, numbered SOP with: Purpose, Scope, Definitions, Responsibilities, Step-by-step Procedure, and a Review/Approval section. Use formal document formatting.",
      ethics: "The user wants an ethics policy or framework. Write a complete, formal ethics document with: Preamble, Core Principles, Standards of Conduct, Conflict of Interest Policy, Reporting Procedures, and Enforcement provisions.",
      motion: "The user wants to draft a formal governance motion. Format as: MOTION TITLE, WHEREAS clauses (background), BE IT RESOLVED clauses (action items), VOTING REQUIREMENTS, and a CERTIFICATION section. Follow tribal governance protocol.",
      branding: "The user wants branding development. Provide: (1) 3 business name options with rationale, (2) brand positioning statement, (3) brand voice description, (4) mission statement draft, (5) 3 tagline options.",
      law: "The user has a business law question. Provide a thorough legal analysis citing specific statutes, regulations, and tribal law principles. Be authoritative and practical.",
      chat: "",
    };

    const fullSystem = BUSINESS_COPILOT_SYSTEM
      + (modeInstructions[mode] ? `\n\nSPECIAL INSTRUCTION FOR THIS REQUEST: ${modeInstructions[mode]}` : "")
      + (context ? `\n\nBUSINESS CONTEXT: ${context}` : "");

    const conversationHistory: ConversationMessage[] = history.map(h => ({
      role: h.role as "user" | "assistant",
      content: h.content,
    }));

    let reply = "";
    try {
      const result = await callAzureOpenAI(fullSystem, message, { maxTokens: 1800, temperature: 0.7 }, conversationHistory);
      reply = result.content;
    } catch (aiErr) {
      logger.warn({ aiErr }, "Business Copilot AI call failed — returning offline response");
      reply = getOfflineReply(message, mode);
    }

    res.json({ reply, mode });
  } catch (err) {
    next(err);
  }
});

function getOfflineReply(message: string, mode: string): string {
  const lower = message.toLowerCase();
  if (mode === "logo" || lower.includes("logo")) {
    return "Logo Concept: Consider a circular seal design incorporating the tribe's sacred symbols — a rising sun, eagle feather, or water motif. Suggested palette: deep forest green (#1a3a2a), gold (#d4a017), and white. Typography: a bold serif for the entity name, smaller caps for the tagline. Tagline options: 'Sovereign · Prosperous · United' / 'Built on Trust, Bound by Sovereignty' / 'Enterprise of the People'.";
  }
  if (mode === "sop") {
    return "To draft a complete SOP, please provide: the process name, department responsible, and key steps involved. I will format a complete Standard Operating Procedure document ready for adoption.";
  }
  if (mode === "motion") {
    return "To draft a formal motion, provide: the proposed action, the supporting rationale (WHEREAS clauses), and who is authorized to act. I will produce a complete resolution in tribal governance format.";
  }
  if (mode === "ethics") {
    return "To draft an ethics policy, provide: the entity type, key stakeholder groups, and any specific conduct concerns. I will produce a complete ethics framework aligned with Mathias El Tribe values.";
  }
  return "The Business Copilot is temporarily operating in offline mode. Please try again in a moment, or describe your business question and I will provide guidance based on tribal sovereign business law and practice.";
}

export default router;
