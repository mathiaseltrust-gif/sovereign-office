import { Router } from "express";
import { requireServiceKeyOrAuth } from "../../auth/service-key";
import { callAzureOpenAI, getAzureOpenAIClient } from "../../lib/azure-openai";
import { logger } from "../../lib/logger";

const router = Router();

export interface ExtractedFacts {
  parties: { role: string; name: string; description?: string }[];
  dates: { label: string; date: string }[];
  claims: string[];
  jurisdiction: { type: string; court?: string; tribe?: string; state?: string };
  relief: string[];
  statutes: string[];
  caseType: string;
  urgencyLevel: "routine" | "urgent" | "emergency";
  childInvolved: boolean;
  icwaApplicable: boolean;
  tribalLandInvolved: boolean;
  summary: string;
  keyFacts: string[];
  recommendedDocumentType: string;
  confidence: "high" | "medium" | "low";
}

const FACT_EXTRACTION_SYSTEM = `You are a sovereign tribal legal AI for the Office of the Chief Justice and Trustee of the Mathias El Tribe.

Extract structured legal facts from the provided document text. Return a JSON object with the following fields:
- parties: array of {role, name, description} (plaintiff, defendant, petitioner, respondent, trustee, beneficiary, etc.)
- dates: array of {label, date} (filing date, incident date, hearing date, etc.)
- claims: array of claim strings
- jurisdiction: {type ("tribal"|"federal"|"state"|"county"), court, tribe, state}
- relief: array of relief sought
- statutes: array of statutes cited
- caseType: single string (e.g. "ICWA custody", "trust land dispute", "welfare claim", "NFR", etc.)
- urgencyLevel: "routine"|"urgent"|"emergency"
- childInvolved: boolean
- icwaApplicable: boolean
- tribalLandInvolved: boolean
- summary: one-paragraph plain-English summary
- keyFacts: array of 3–7 key facts as strings
- recommendedDocumentType: one of (welfare_instrument|trust_instrument|court_document|medical_note|nfr|tro_declaration|icwa_notice|tribal_id|verification_letter|jurisdictional_statement|trust_deed|sovereign_declaration|certification)
- confidence: "high"|"medium"|"low"

Return only valid JSON, no markdown, no explanation.`;

router.post("/extract", requireServiceKeyOrAuth, async (req, res, next) => {
  try {
    const body = req.body as {
      text?: string;
      base64Content?: string;
      filename?: string;
      context?: {
        caseType?: string;
        tribe?: string;
        court?: string;
      };
    };

    let documentText = body.text ?? "";

    if (!documentText && body.base64Content) {
      try {
        documentText = Buffer.from(body.base64Content, "base64").toString("utf8");
      } catch {
        res.status(400).json({ error: "Invalid base64Content — could not decode to text." });
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
      { chars: documentText.length, filename: body.filename, isService: req.isServiceAccount },
      "M365 fact extraction request",
    );

    const client = getAzureOpenAIClient();

    if (!client) {
      const fallback: ExtractedFacts = {
        parties: [], dates: [], claims: [], jurisdiction: { type: "tribal" },
        relief: [], statutes: [], caseType: "Unknown", urgencyLevel: "routine",
        childInvolved: false, icwaApplicable: false, tribalLandInvolved: false,
        summary: "Azure OpenAI is not configured. Manual review required.",
        keyFacts: ["Document received — AI extraction unavailable"],
        recommendedDocumentType: "court_document",
        confidence: "low",
      };
      res.json({ facts: fallback, tier: "rule_based", azureAvailable: false });
      return;
    }

    const contextNote = body.context
      ? `\n\nContext hint: ${JSON.stringify(body.context)}`
      : "";

    const result = await callAzureOpenAI(
      FACT_EXTRACTION_SYSTEM,
      `Extract legal facts from this document:\n\n${documentText}${contextNote}`,
      { maxTokens: 2000, temperature: 0.1 },
    );

    let facts: ExtractedFacts;
    try {
      facts = JSON.parse(result.content) as ExtractedFacts;
    } catch {
      logger.warn("Fact extraction returned non-JSON; wrapping as summary");
      facts = {
        parties: [], dates: [], claims: [], jurisdiction: { type: "tribal" },
        relief: [], statutes: [], caseType: "Unknown", urgencyLevel: "routine",
        childInvolved: false, icwaApplicable: false, tribalLandInvolved: false,
        summary: result.content.slice(0, 500),
        keyFacts: [result.content.slice(0, 200)],
        recommendedDocumentType: "court_document",
        confidence: "low",
      };
    }

    res.json({
      facts,
      tier: "azure_openai",
      azureAvailable: true,
      usage: result.usage,
      filename: body.filename,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
