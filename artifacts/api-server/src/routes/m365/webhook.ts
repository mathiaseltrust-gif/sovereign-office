import { Router } from "express";
import { requireServiceKeyOrAuth } from "../../auth/service-key";
import { callAzureOpenAI, getAzureOpenAIClient } from "../../lib/azure-openai";
import { logger } from "../../lib/logger";
import type { ExtractedFacts } from "./facts";

const router = Router();

export type WebhookMode = "facts_only" | "draft" | "full_intake";

export interface M365WebhookInput {
  mode: WebhookMode;
  text?: string;
  base64Content?: string;
  filename?: string;
  documentType?: string;
  jurisdiction?: "tribal" | "county" | "state" | "federal";
  context?: { caseType?: string; tribe?: string; court?: string };
  userNotes?: string;
  memberEmail?: string;
  memberName?: string;
}

export interface M365WebhookResult {
  mode: WebhookMode;
  facts?: ExtractedFacts;
  draftText?: string;
  draftTitle?: string;
  sovereigntyProtections?: string[];
  citations?: { type: string; citation: string; title: string }[];
  jurisdiction?: string;
  tier: string;
  azureAvailable: boolean;
  processingMs: number;
}

const DRAFT_SYSTEM = `You are a sovereign tribal legal drafting AI for the Office of the Chief Justice and Trustee of the Mathias El Tribe.

Given extracted facts and context, draft a professional legal document. The document must:
- Assert tribal sovereignty under the Indian Reorganization Act, ISDA, and applicable federal trust law
- Use proper legal caption format
- Reference relevant Indian law doctrines and federal statutes
- Be formatted for direct use in Microsoft Word

Return JSON with:
- title: document title string
- body: full document text (use \\n for newlines, formatted for Word)
- sovereigntyProtections: array of sovereignty clauses applied
- citations: array of {type, citation, title}
- jurisdiction: jurisdictional framing paragraph

Return only valid JSON, no markdown wrapper.`;

router.post("/webhook", requireServiceKeyOrAuth, async (req, res, next) => {
  const start = Date.now();
  try {
    const body = req.body as M365WebhookInput;
    const mode = body.mode ?? "facts_only";

    let documentText = body.text ?? "";
    if (!documentText && body.base64Content) {
      try {
        documentText = Buffer.from(body.base64Content, "base64").toString("utf8");
      } catch {
        res.status(400).json({ error: "Invalid base64Content." });
        return;
      }
    }

    if (!documentText.trim()) {
      res.status(400).json({ error: "Provide either text or base64Content." });
      return;
    }

    if (documentText.length > 80_000) {
      documentText = documentText.slice(0, 80_000);
    }

    logger.info(
      { mode, chars: documentText.length, filename: body.filename, isService: req.isServiceAccount },
      "M365 webhook request",
    );

    const client = getAzureOpenAIClient();
    const azureAvailable = !!client;

    const result: M365WebhookResult = {
      mode,
      tier: azureAvailable ? "azure_openai" : "rule_based",
      azureAvailable,
      processingMs: 0,
    };

    if (mode === "facts_only" || mode === "draft" || mode === "full_intake") {
      if (azureAvailable) {
        const contextNote = body.context ? `\n\nContext: ${JSON.stringify(body.context)}` : "";
        const memberNote = body.memberName ? `\n\nMember: ${body.memberName} (${body.memberEmail ?? "unknown"})` : "";

        const factResult = await callAzureOpenAI(
          `You are a sovereign tribal legal AI. Extract structured facts from this document and return valid JSON only. Fields: parties, dates, claims, jurisdiction, relief, statutes, caseType, urgencyLevel (routine|urgent|emergency), childInvolved (bool), icwaApplicable (bool), tribalLandInvolved (bool), summary, keyFacts (array), recommendedDocumentType, confidence (high|medium|low).`,
          `Document:\n\n${documentText}${contextNote}${memberNote}`,
          { maxTokens: 1500, temperature: 0.1 },
        );

        try {
          result.facts = JSON.parse(factResult.content) as ExtractedFacts;
        } catch {
          result.facts = {
            parties: [], dates: [], claims: [], jurisdiction: { type: "tribal" },
            relief: [], statutes: [], caseType: "Unknown", urgencyLevel: "routine",
            childInvolved: false, icwaApplicable: false, tribalLandInvolved: false,
            summary: factResult.content.slice(0, 300),
            keyFacts: [],
            recommendedDocumentType: body.documentType ?? "court_document",
            confidence: "low",
          };
        }

        if (mode === "draft" || mode === "full_intake") {
          const factsStr = JSON.stringify(result.facts, null, 2);
          const draftResult = await callAzureOpenAI(
            DRAFT_SYSTEM,
            `Document type: ${body.documentType ?? result.facts.recommendedDocumentType}\nJurisdiction: ${body.jurisdiction ?? "tribal"}\nExtracted facts:\n${factsStr}\n\nAdditional notes: ${body.userNotes ?? "none"}`,
            { maxTokens: 3000, temperature: 0.2 },
          );

          try {
            const draft = JSON.parse(draftResult.content) as {
              title?: string; body?: string;
              sovereigntyProtections?: string[];
              citations?: { type: string; citation: string; title: string }[];
              jurisdiction?: string;
            };
            result.draftText = draft.body;
            result.draftTitle = draft.title;
            result.sovereigntyProtections = draft.sovereigntyProtections;
            result.citations = draft.citations;
            result.jurisdiction = draft.jurisdiction;
          } catch {
            result.draftText = draftResult.content;
          }
        }
      } else {
        result.facts = {
          parties: [], dates: [], claims: [], jurisdiction: { type: "tribal" },
          relief: [], statutes: [], caseType: "Unknown", urgencyLevel: "routine",
          childInvolved: false, icwaApplicable: false, tribalLandInvolved: false,
          summary: "Azure OpenAI unavailable. Manual review required.",
          keyFacts: ["Document received — AI unavailable"],
          recommendedDocumentType: body.documentType ?? "court_document",
          confidence: "low",
        };
      }
    }

    result.processingMs = Date.now() - start;
    res.json(result);
  } catch (err) {
    next(err);
  }
});

export default router;
