import { callAzureOpenAI, getAzureOpenAIClient } from "../lib/azure-openai";
import { queryLawDb } from "./law-db";
import { logger } from "../lib/logger";
import type { UnifiedIdentity } from "./identity-engine";
import type { DelegatedAuthorities } from "./delegated-authority";

export type DraftingTier = "azure_openai" | "rule_based" | "legal_logic" | "hard_sovereign";

export type DocumentKind =
  | "welfare_instrument"
  | "trust_instrument"
  | "court_document"
  | "medical_note"
  | "nfr"
  | "tro_declaration"
  | "icwa_notice"
  | "tribal_id"
  | "verification_letter"
  | "jurisdictional_statement"
  | "trust_deed"
  | "sovereign_declaration"
  | "trust_land_status_report"
  | "trust_land_decision_letter"
  | "trust_land_instrument"
  | "trust_land_intake_form"
  | "trust_land_probate_summary"
  | "encumbrance_review"
  | "notice_of_title_defect"
  | "certification";

export interface DraftingInput {
  identity: UnifiedIdentity;
  lineageSummary: string;
  membershipVerified: boolean;
  delegatedAuthorities: DelegatedAuthorities;
  jurisdiction: "tribal" | "county" | "state" | "federal";
  documentType: DocumentKind;
  userNotes?: string;
  researchDatabaseContent?: string;
  doctrineDatabase?: string[];
  lawDatabase?: string[];
  profilePhotoUrl?: string;
}

export interface DraftingOutput {
  draftDocumentText: string;
  recommendedTemplate: string;
  jurisdictionalFraming: string;
  sovereigntyProtections: string[];
  citations: { type: "federal" | "tribal" | "doctrine"; citation: string; title: string }[];
  photoInclusionRules: string;
  nextStepRecommendations: string[];
  tier: DraftingTier;
  tierReason: string;
  aiConfidence: number;
}

const DRAFTING_SYSTEM_PROMPT = `You are the Sovereign AI Drafting Engine for the Mathias El Tribe — Sovereign Office of the Chief Justice & Trustee.

Your function is to produce a legally precise, recorder-compliant draft document for tribal members, officers, and the Chief Justice. Apply:
- Federal Indian law (ICWA, IRA, ISDEAA, VAWA tribal, Snyder Act, IHCIA)
- Indian Canons of Construction (ambiguity → tribal member's favor)
- Worcester v. Georgia (1832), McClanahan (1973), Brackeen v. Haaland (2023)
- Federal Trust Responsibility doctrine

ALWAYS:
- Use the identity's legal name and court caption exactly as provided
- Include jurisdiction framing matching the stated jurisdiction level
- Cite at minimum 3 federal statutes or doctrines
- Recommend the most protective template available
- Flag any sovereignty protections that apply

Respond ONLY with valid JSON matching this structure:
{
  "draftDocumentText": "Full formatted draft text of the document",
  "recommendedTemplate": "Template code string",
  "jurisdictionalFraming": "1–2 sentence framing of jurisdiction",
  "sovereigntyProtections": ["array of applicable protections"],
  "citations": [{"type": "federal"|"tribal"|"doctrine", "citation": "string", "title": "string"}],
  "photoInclusionRules": "string — whether/how photo applies to this document type",
  "nextStepRecommendations": ["ordered action steps for this document"]
}`;

function buildDraftingPrompt(input: DraftingInput, lawContext: string): string {
  const { identity, jurisdiction, documentType, userNotes } = input;

  return [
    `DOCUMENT TYPE: ${documentType.replace(/_/g, " ").toUpperCase()}`,
    `JURISDICTION: ${jurisdiction.toUpperCase()}`,
    `IDENTITY:`,
    `  Legal Name: ${identity.legalName}`,
    `  Court Caption: ${identity.courtCaption}`,
    `  Tribal Name: ${identity.tribalName || "None on file"}`,
    `  Title: ${identity.title || "None"}`,
    `  Family Group: ${identity.familyGroup || "None on file"}`,
    `  Protection Level: ${identity.protectionLevel.toUpperCase()}`,
    `  ICWA Eligible: ${identity.icwaEligible}`,
    `  Trust Inheritance: ${identity.trustInheritance}`,
    `  Membership Verified: ${input.membershipVerified}`,
    `  Identity Tags: ${identity.identityTags.join(", ") || "None"}`,
    `LINEAGE SUMMARY: ${input.lineageSummary}`,
    userNotes ? `USER NOTES / CONTEXT:\n${userNotes}` : "",
    input.researchDatabaseContent ? `RESEARCH CONTENT:\n${input.researchDatabaseContent}` : "",
    input.doctrineDatabase?.length ? `DOCTRINES: ${input.doctrineDatabase.join("; ")}` : "",
    lawContext ? `LAW DATABASE:\n${lawContext}` : "",
  ].filter(Boolean).join("\n\n");
}

function ruleBased(input: DraftingInput): DraftingOutput {
  const { identity, documentType, jurisdiction } = input;
  const isIcwa = identity.icwaEligible;
  const isTrust = identity.trustInheritance;

  const templates: Record<DocumentKind, string> = {
    welfare_instrument: "WELFARE_ICWA_INSTRUMENT",
    trust_instrument: "TRUST_DEED_SOVEREIGNTY",
    court_document: "COURT_DOCUMENT_GENERAL",
    medical_note: "MEDICAL_NOTE_TRIBAL",
    nfr: "NFR_FEDERAL_REVIEW",
    tro_declaration: "TRO_EMERGENCY_DECLARATION",
    icwa_notice: "ICWA_NOTICE_25USC1912",
    tribal_id: "TRIBAL_IDENTITY_DOCUMENT",
    verification_letter: "VERIFICATION_LETTER_SOVEREIGN",
    jurisdictional_statement: "JURISDICTIONAL_STATEMENT",
    trust_deed: "TRUST_DEED_BIA",
    sovereign_declaration: "SOVEREIGN_RESTORATION_DECLARATION",
    trust_land_status_report: "TRUST_LAND_STATUS_REPORT_TSR",
    trust_land_decision_letter: "TRUST_LAND_DECISION_LETTER",
    trust_land_instrument: "TRUST_LAND_INSTRUMENT_RECORDER",
    trust_land_intake_form: "TRUST_LAND_INTAKE_FORM",
    trust_land_probate_summary: "TRUST_LAND_PROBATE_SUMMARY_AIPRA",
    encumbrance_review: "ENCUMBRANCE_REVIEW_TRUST_LAND",
    notice_of_title_defect: "NOTICE_OF_TITLE_DEFECT",
    certification: "CERTIFICATION_CHIEF_JUSTICE_TRUSTEE",
  };

  const jurisFraming: Record<string, string> = {
    tribal: "This document is issued under the inherent sovereign authority of the Mathias El Tribe and the Federal Trust Responsibility.",
    federal: "This document invokes federal Indian law jurisdiction under 25 U.S.C. and the Federal Trust Responsibility.",
    state: "This document asserts preemption of state authority under Worcester v. Georgia and applicable federal Indian law.",
    county: "This document places the county on notice of tribal jurisdiction and federal preemption of local authority.",
  };

  const protections: string[] = [
    "Worcester v. Georgia, 31 U.S. 515 (1832) — tribal sovereignty recognized",
    "Federal Trust Responsibility — U.S. fiduciary duty to protect Indian interests",
    "Indian Canons of Construction — ambiguity resolved in favor of tribal member",
  ];
  if (isIcwa) protections.push("ICWA, 25 U.S.C. §§ 1901–1963 — child welfare protections active");
  if (isTrust) protections.push("Indian Reorganization Act, 25 U.S.C. § 5108 — trust land protections active");

  const citations = [
    { type: "doctrine" as const, citation: "31 U.S. 515 (1832)", title: "Worcester v. Georgia" },
    { type: "federal" as const, citation: "25 U.S.C. § 5108", title: "Indian Reorganization Act — Trust Land" },
    { type: "federal" as const, citation: "25 U.S.C. §§ 1901–1963", title: "Indian Child Welfare Act" },
    { type: "doctrine" as const, citation: "471 U.S. 759 (1985)", title: "Montana v. Blackfeet Tribe — Indian Canons" },
    { type: "federal" as const, citation: "25 U.S.C. § 13", title: "Snyder Act — General Welfare Authority" },
  ];

  const draftText = [
    `SOVEREIGN OFFICE OF THE CHIEF JUSTICE & TRUSTEE`,
    `MATHIAS EL TRIBE — SEAT OF THE TRIBAL GOVERNMENT`,
    ``,
    `Document Type: ${documentType.replace(/_/g, " ").toUpperCase()}`,
    `Issued To: ${identity.courtCaption}`,
    `Jurisdiction: ${jurisdiction.toUpperCase()}`,
    `Date: ${new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}`,
    ``,
    `JURISDICTIONAL FRAMING`,
    jurisFraming[jurisdiction] ?? jurisFraming.tribal,
    ``,
    `IDENTITY ON RECORD`,
    `Legal Name: ${identity.legalName}`,
    identity.tribalName ? `Tribal Name: ${identity.tribalName}` : "",
    `Family Group: ${identity.familyGroup || "On file with the Office"}`,
    `Protection Level: ${identity.protectionLevel.toUpperCase()}`,
    `Membership Verified: ${input.membershipVerified ? "YES" : "PENDING"}`,
    ``,
    `LINEAGE SUMMARY`,
    input.lineageSummary,
    ``,
    input.userNotes ? `NOTES FROM REQUESTING PARTY\n${input.userNotes}\n` : "",
    `SOVEREIGNTY PROTECTIONS APPLIED`,
    protections.map((p, i) => `${i + 1}. ${p}`).join("\n"),
    ``,
    `CITATIONS`,
    citations.map((c) => `${c.citation} — ${c.title}`).join("\n"),
    ``,
    `_______________________________________________`,
    `Chief Justice & Trustee — Mathias El Tribe`,
    `Sovereign Office of the Chief Justice & Trustee`,
    `Mathias El Tribe Identity Gateway — Verified`,
  ].filter((l) => l !== undefined).join("\n");

  return {
    draftDocumentText: draftText,
    recommendedTemplate: templates[documentType] ?? "SOVEREIGN_GENERAL",
    jurisdictionalFraming: jurisFraming[jurisdiction] ?? jurisFraming.tribal,
    sovereigntyProtections: protections,
    citations,
    photoInclusionRules: ["tribal_id", "verification_letter"].includes(documentType)
      ? "Photo inclusion authorized for identity documents — attach member photo with consent on file."
      : "Photo not applicable to this document type.",
    nextStepRecommendations: [
      "Review draft for accuracy — confirm legal name and court caption match your identity record",
      "Have the Chief Justice & Trustee review and sign this document",
      "File with the appropriate recorder or court of jurisdiction",
      input.membershipVerified ? "Membership verified — proceed to issuance" : "Complete membership verification before final issuance",
    ],
    tier: "rule_based",
    tierReason: "Rule-based sovereign drafting engine — all federal Indian law protections applied",
    aiConfidence: 78,
  };
}

function hardSovereignDraft(input: DraftingInput): DraftingOutput {
  const base = ruleBased(input);
  return {
    ...base,
    tier: "hard_sovereign",
    tierReason: "Hard Sovereign Defaults — AI and rule engine unavailable. Maximum protection posture applied.",
    aiConfidence: 65,
    sovereigntyProtections: [
      ...base.sovereigntyProtections,
      "HARD SOVEREIGN DEFAULT — all federal Indian law protections applied at maximum strength",
    ],
  };
}

export async function runAiDraftingEngine(input: DraftingInput): Promise<DraftingOutput> {
  const tags: string[] = ["tribal-sovereignty", "federal-trust"];
  if (input.identity.icwaEligible) tags.push("icwa", "child-welfare");
  if (input.identity.trustInheritance) tags.push("trust-land", "ira");
  if (input.documentType === "medical_note") tags.push("health", "snyder");
  if (input.documentType === "nfr") tags.push("tribal-jurisdiction");
  const trustLandTypes: DocumentKind[] = [
    "trust_land_status_report", "trust_land_decision_letter", "trust_land_instrument",
    "trust_land_intake_form", "trust_land_probate_summary", "encumbrance_review",
    "notice_of_title_defect", "certification",
  ];
  if (trustLandTypes.includes(input.documentType)) {
    tags.push("trust-land", "ira", "non-intercourse", "trust-title", "bia-land-records");
  }

  let lawContext = "";
  try {
    const lawData = await queryLawDb(tags);
    const parts = [
      ...lawData.federalLaws.slice(0, 4).map((l) => `${l.citation}: ${l.title}`),
      ...lawData.tribalLaws.slice(0, 2).map((l) => `${l.citation}: ${l.title}`),
      ...lawData.doctrines.slice(0, 3).map((d) => `${d.citation}: ${d.caseName}`),
    ];
    lawContext = parts.join("\n");
  } catch {
    logger.warn("AI Drafting Engine: law DB query failed — continuing without");
  }

  if (getAzureOpenAIClient()) {
    try {
      logger.info({ documentType: input.documentType }, "AI Drafting Engine: Tier 1 — Azure OpenAI");
      const userPrompt = buildDraftingPrompt(input, lawContext);
      const result = await callAzureOpenAI(DRAFTING_SYSTEM_PROMPT, userPrompt, {
        maxTokens: 3500,
        temperature: 0.1,
        timeoutMs: 25000,
      });
      const jsonMatch = result.content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]) as Partial<DraftingOutput>;
        if (parsed.draftDocumentText && parsed.recommendedTemplate) {
          logger.info("AI Drafting Engine: Azure OpenAI succeeded (Tier 1)");
          return {
            draftDocumentText: parsed.draftDocumentText,
            recommendedTemplate: parsed.recommendedTemplate,
            jurisdictionalFraming: parsed.jurisdictionalFraming ?? "",
            sovereigntyProtections: parsed.sovereigntyProtections ?? [],
            citations: parsed.citations ?? [],
            photoInclusionRules: parsed.photoInclusionRules ?? "",
            nextStepRecommendations: parsed.nextStepRecommendations ?? [],
            tier: "azure_openai",
            tierReason: "Azure OpenAI gpt-4o — sovereign document drafting with law database context",
            aiConfidence: 94,
          };
        }
      }
      logger.warn("AI Drafting Engine: Azure response unparseable — falling to Tier 2");
    } catch (err) {
      logger.warn({ err: (err as Error).message }, "AI Drafting Engine: Azure failed — falling to Tier 2");
    }
  }

  try {
    logger.info("AI Drafting Engine: Tier 2 — rule-based engine");
    return ruleBased(input);
  } catch (err) {
    logger.error({ err: (err as Error).message }, "AI Drafting Engine: Tier 2 failed — Tier 3 legal-logic");
  }

  try {
    logger.info("AI Drafting Engine: Tier 3 — legal-logic fallback");
    const base = ruleBased(input);
    return { ...base, tier: "legal_logic", tierReason: "Legal-logic module — core sovereignty framework applied", aiConfidence: 70 };
  } catch {
    logger.warn("AI Drafting Engine: all tiers failed — hard sovereign defaults");
  }

  return hardSovereignDraft(input);
}
