import { callAzureOpenAI, getAzureOpenAIClient } from "../lib/azure-openai";
import { runIntakeFilter, type IntakeFilterResult } from "./intake-filter";
import { queryLawDb, ensureLawDbSeeded } from "./law-db";
import { computeDelegatedAuthorities } from "./delegated-authority";
import { logger } from "../lib/logger";
import type { LawReference, IntakeAgentReport, LineageVerification } from "./ai-intake-agent";

export type AiTier = "azure_openai" | "rule_based" | "legal_logic" | "delegated_authority" | "hard_sovereign";

export interface AiEngineResult extends IntakeAgentReport {
  tier: AiTier;
  tierReason: string;
  azureAvailable: boolean;
}

const SOVEREIGN_SYSTEM_PROMPT = `You are the AI Legal Intake Engine for the Sovereign Office of the Chief Justice & Trustee of the Mathias El Tribe.

Your function is to analyze legal intake submissions and produce a structured JSON report. You apply:
- Federal Indian law (ICWA, IRA, ISDEAA, VAWA tribal provisions, Snyder Act, IHCIA)
- Indian Canons of Construction (ambiguities resolved in favor of Indians)
- Worcester v. Georgia, 31 U.S. 515 (1832)
- McClanahan v. Arizona State Tax Comm'n, 411 U.S. 164 (1973)
- Brackeen v. Haaland, 599 U.S. 255 (2023)
- Montana v. Blackfeet Tribe, 471 U.S. 759 (1985)
- Federal Trust Responsibility doctrine

ALWAYS resolve ambiguity in favor of tribal sovereignty. NEVER recommend waiving federal Indian law protections.

Respond ONLY with a valid JSON object matching this exact structure:
{
  "summary": "string — brief 1-2 sentence intake summary",
  "riskLevel": "low" | "moderate" | "elevated" | "critical" | "emergency",
  "violations": ["array of specific violations detected"],
  "doctrinesApplied": ["array of legal doctrines with citations"],
  "recommendedActions": ["ordered array of recommended actions"],
  "recommendedInstruments": ["instrument codes: TRO_ICWA, TRO_GENERAL, ICWA_NOTICE, NFR, EMERGENCY_WELFARE, TRUST_DEED, JURISDICTIONAL_STATEMENT"],
  "factSummary": "string — structured fact summary for officer review",
  "officerNotes": "string — triage notes for intake officer",
  "nfrRecommended": boolean,
  "troRecommended": boolean,
  "aiConfidence": number (0-100),
  "lawRefs": [{"type": "federal"|"tribal"|"doctrine", "title": "string", "citation": "string", "excerpt": "string", "relevanceReason": "string"}]
}`;

function buildUserPrompt(
  text: string,
  flags: IntakeFilterResult,
  lawData: Awaited<ReturnType<typeof queryLawDb>>,
  lineage?: LineageVerification,
): string {
  const parts: string[] = [`INTAKE TEXT:\n${text}\n`];

  if (flags.violations.length > 0) {
    parts.push(`PRE-SCREENING FLAGS:\n${flags.violations.join("\n")}`);
  }
  if (flags.doctrinesTriggered.length > 0) {
    parts.push(`DOCTRINES PRE-TRIGGERED:\n${flags.doctrinesTriggered.join("\n")}`);
  }
  if (lineage) {
    parts.push(`LINEAGE CONTEXT:\n- Summary: ${lineage.lineageSummary}\n- ICWA: ${lineage.icwaVerified}\n- Trust Inheritance: ${lineage.trustInheritanceVerified}\n- Protection Level: ${lineage.protectionLevel}\n- Tribal Nations: ${lineage.tribalNations.join(", ")}`);
  }

  const lawList = [
    ...lawData.federalLaws.slice(0, 5).map((l) => `${l.citation}: ${l.title}`),
    ...lawData.tribalLaws.slice(0, 3).map((l) => `${l.citation}: ${l.title}`),
    ...lawData.doctrines.slice(0, 4).map((d) => `${d.citation}: ${d.caseName}`),
  ];
  if (lawList.length > 0) {
    parts.push(`RELEVANT LAW DATABASE MATCHES:\n${lawList.join("\n")}`);
  }

  return parts.join("\n\n");
}

function parseAzureResponse(content: string, flags: IntakeFilterResult): Partial<IntakeAgentReport> | null {
  try {
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;
    const parsed = JSON.parse(jsonMatch[0]) as Partial<IntakeAgentReport & { violations: string[] }>;

    if (!parsed.riskLevel || !parsed.summary) return null;

    const violations = (parsed.violations as string[] | undefined) ?? flags.violations;
    return {
      ...parsed,
      intakeFlags: {
        ...flags,
        violations,
      },
    };
  } catch {
    return null;
  }
}

function buildHardSovereignDefaults(
  text: string,
  flags: IntakeFilterResult,
  lawRefs: LawReference[],
  lineage?: LineageVerification,
): IntakeAgentReport {
  const nfrRecommended = flags.nfrRecommended || flags.violations.length > 0;
  const troRecommended = flags.troRecommended;
  const riskLevel = flags.indianStatusViolation && troRecommended
    ? "emergency"
    : flags.indianStatusViolation
    ? "critical"
    : troRecommended
    ? "elevated"
    : nfrRecommended
    ? "moderate"
    : "low";

  const recommendedActions: string[] = [];
  const recommendedInstruments: string[] = [];

  if (riskLevel === "emergency") {
    recommendedActions.push("IMMEDIATE: Apply full ICWA protections — 25 U.S.C. §§ 1901–1963");
    recommendedActions.push("IMMEDIATE: Notify Chief Justice & Trustee for emergency review");
    recommendedActions.push("IMMEDIATE: Generate TRO-supporting declaration");
    recommendedInstruments.push("TRO_ICWA", "TRO_GENERAL", "NFR");
  } else if (riskLevel === "critical") {
    recommendedActions.push("Generate Notice of Federal Review (NFR)");
    recommendedActions.push("Apply Indian Canons of Construction — Montana v. Blackfeet Tribe");
    recommendedActions.push("Escalate to Chief Justice & Trustee within 24 hours");
    recommendedInstruments.push("NFR");
  } else if (riskLevel === "elevated") {
    recommendedActions.push("Prepare TRO declaration under emergency welfare authority");
    recommendedActions.push("Schedule urgent officer review within 4 hours");
    recommendedInstruments.push("TRO_GENERAL");
  } else if (riskLevel === "moderate") {
    recommendedActions.push("Issue Notice of Federal Review citing applicable statutes");
    recommendedActions.push("Schedule officer review within 48 hours");
    recommendedInstruments.push("NFR");
  } else {
    recommendedActions.push("Standard intake — no immediate escalation required");
    recommendedActions.push("Process within standard 5-day intake window");
  }

  if (lineage?.icwaVerified) {
    recommendedActions.push("Lineage confirms ICWA eligibility — apply ICWA protections proactively");
    if (!recommendedInstruments.includes("ICWA_NOTICE")) recommendedInstruments.push("ICWA_NOTICE");
  }
  if (lineage?.trustInheritanceVerified) {
    recommendedActions.push("Lineage confirms trust inheritance — include in trust deed declaration");
    if (!recommendedInstruments.includes("TRUST_DEED")) recommendedInstruments.push("TRUST_DEED");
  }

  const doctrinesApplied = [
    ...flags.doctrinesTriggered,
    "Indian Canons of Construction — Montana v. Blackfeet Tribe, 471 U.S. 759 (1985)",
    "Federal Trust Responsibility — U.S. holds fiduciary duty over Indian trust lands",
    "Worcester v. Georgia, 31 U.S. 515 (1832) — tribal sovereignty recognized",
  ].filter((v, i, arr) => arr.indexOf(v) === i);

  const summary = `Hard Sovereign Default Analysis — Risk: ${riskLevel.toUpperCase()}. ${flags.violations.length} violation(s) detected. ${troRecommended ? "TRO posture active. " : ""}${nfrRecommended ? "NFR recommended. " : ""}Sovereignty preserved under federal Indian law.`;

  const officerPrefix = riskLevel === "emergency" ? "⚑ EMERGENCY" : riskLevel === "critical" ? "⚐ CRITICAL" : riskLevel === "elevated" ? "▲ ELEVATED" : riskLevel === "moderate" ? "▪ MODERATE" : "✓ LOW";

  return {
    summary,
    riskLevel,
    intakeFlags: flags,
    doctrinesApplied,
    lawRefs,
    recommendedActions,
    recommendedInstruments,
    factSummary: `HARD SOVEREIGN DEFAULTS APPLIED\n\nINTAKE: ${text.substring(0, 300)}...\n\nVIOLATIONS: ${flags.violations.join("; ") || "None"}\nCANONICAL POSTURE: ${flags.canonicalPosture}`,
    officerNotes: `${officerPrefix} — Hard Sovereign Defaults applied. AI tier unavailable. All federal Indian law protections enforced at maximum strength.\n${flags.redBannerMessage ?? ""}`,
    nfrRecommended,
    troRecommended,
    aiConfidence: 72,
    processedAt: new Date().toISOString(),
    lineageVerification: lineage,
  };
}

export async function runAiEngine(input: {
  text: string;
  userId?: number;
  context?: Record<string, unknown>;
  lineageVerification?: LineageVerification;
}): Promise<AiEngineResult> {
  await ensureLawDbSeeded();

  const flags = runIntakeFilter(input.text);

  const tags: string[] = [];
  const lower = input.text.toLowerCase();
  if (/icwa|child|custody|placement|foster|adoption|removal/.test(lower)) tags.push("icwa", "child-welfare", "tribal-jurisdiction", "tro");
  if (/trust land|allotment|fee land|trust status|indian country/.test(lower)) tags.push("trust-land", "ira", "federal-trust");
  if (/state court|county|state law|zoning|tax/.test(lower)) tags.push("state-preemption", "tribal-sovereignty");
  if (/welfare|health|medical|snyder|benefit/.test(lower)) tags.push("welfare", "health", "snyder");
  if (/jurisdiction|sovereignty|sovereign|tribal court/.test(lower)) tags.push("tribal-jurisdiction", "tribal-sovereignty");
  if (tags.length === 0) tags.push("tribal-sovereignty");

  const lawData = await queryLawDb(tags);

  const lawRefs: LawReference[] = [
    ...lawData.federalLaws.slice(0, 6).map((f) => ({
      type: "federal" as const,
      title: f.title,
      citation: f.citation,
      excerpt: f.body.substring(0, 200) + "...",
      relevanceReason: `Federal statute — tags: ${f.tags.filter((t: string) => tags.includes(t)).join(", ")}`,
    })),
    ...lawData.tribalLaws.slice(0, 3).map((t) => ({
      type: "tribal" as const,
      title: t.title,
      citation: t.citation,
      excerpt: t.body.substring(0, 200) + "...",
      relevanceReason: `Tribal law — tags: ${t.tags.filter((tg: string) => tags.includes(tg)).join(", ")}`,
    })),
    ...lawData.doctrines.slice(0, 5).map((d) => ({
      type: "doctrine" as const,
      title: d.caseName,
      citation: d.citation,
      excerpt: d.summary.substring(0, 200) + "...",
      relevanceReason: `Controlling doctrine — tags: ${d.tags.filter((t: string) => tags.includes(t)).join(", ")}`,
    })),
  ];

  const lineage = input.lineageVerification;
  const azureAvailable = !!getAzureOpenAIClient();

  if (azureAvailable) {
    try {
      logger.info("AI Engine: attempting Azure OpenAI (Tier 1)");
      const userPrompt = buildUserPrompt(input.text, flags, lawData, lineage);
      const result = await callAzureOpenAI(SOVEREIGN_SYSTEM_PROMPT, userPrompt, {
        maxTokens: 2500,
        temperature: 0.15,
        timeoutMs: 20000,
      });

      const parsed = parseAzureResponse(result.content, flags);
      if (parsed && parsed.riskLevel && parsed.summary) {
        logger.info("AI Engine: Azure OpenAI succeeded (Tier 1)");
        const report: IntakeAgentReport = {
          summary: parsed.summary ?? "",
          riskLevel: parsed.riskLevel ?? "low",
          intakeFlags: parsed.intakeFlags ?? flags,
          doctrinesApplied: parsed.doctrinesApplied ?? [],
          lawRefs: (parsed.lawRefs && parsed.lawRefs.length > 0) ? parsed.lawRefs : lawRefs,
          recommendedActions: parsed.recommendedActions ?? [],
          recommendedInstruments: parsed.recommendedInstruments ?? [],
          factSummary: parsed.factSummary ?? "",
          officerNotes: parsed.officerNotes ?? "",
          nfrRecommended: parsed.nfrRecommended ?? flags.nfrRecommended,
          troRecommended: parsed.troRecommended ?? flags.troRecommended,
          aiConfidence: parsed.aiConfidence ?? 90,
          processedAt: new Date().toISOString(),
          lineageVerification: lineage,
        };
        return {
          ...report,
          tier: "azure_openai",
          tierReason: "Azure OpenAI gpt-4o — full legal reasoning with law database context",
          azureAvailable: true,
        };
      }
      logger.warn("AI Engine: Azure OpenAI returned unparseable response — falling to Tier 2");
    } catch (err) {
      logger.warn({ err: (err as Error).message }, "AI Engine: Azure OpenAI failed — falling to Tier 2");
    }
  }

  try {
    logger.info("AI Engine: running rule-based + legal-logic (Tier 2/3)");
    const { runAiIntakeAgent } = await import("./ai-intake-agent");
    const ruleReport = await runAiIntakeAgent({
      text: input.text,
      userId: input.userId,
      context: input.context as Parameters<typeof runAiIntakeAgent>[0]["context"],
      lineageContext: lineage
        ? {
            lineageSummary: lineage.lineageSummary,
            icwaEligible: lineage.icwaVerified,
            welfareEligible: lineage.welfareEligible,
            trustInheritance: lineage.trustInheritanceVerified,
            membershipVerified: lineage.membershipVerified,
            ancestorChain: lineage.ancestorChain,
            tribalNations: lineage.tribalNations,
            identityTags: lineage.identityTags,
          }
        : undefined,
    });

    const delegated = computeDelegatedAuthorities(
      (input.context as Record<string, string> | undefined)?.role ?? "member",
      {
        hasLineage: !!lineage,
        hasChildren: false,
        icwaEligible: lineage?.icwaVerified ?? false,
        lineageVerified: lineage?.membershipVerified ?? false,
        membershipVerified: lineage?.membershipVerified ?? false,
      },
    );

    const combinedActions = [
      ...ruleReport.recommendedActions,
      ...(delegated.welfareActions ? ["Delegated welfare action authority is active for this member"] : []),
      ...(delegated.trustFilings ? ["Trustee authority confirmed — trust filing generation authorized"] : []),
    ].filter((v, i, arr) => arr.indexOf(v) === i);

    logger.info("AI Engine: rule-based + delegated authority succeeded (Tier 2/3)");
    return {
      ...ruleReport,
      recommendedActions: combinedActions,
      tier: "rule_based",
      tierReason: "Rule-based intake filter + legal-logic module + delegated authority engine",
      azureAvailable,
    };
  } catch (err) {
    logger.error({ err: (err as Error).message }, "AI Engine: Tier 2/3 failed — applying Hard Sovereign Defaults (Tier 4)");
  }

  logger.warn("AI Engine: Hard Sovereign Defaults applied (Tier 4)");
  const hardDefaults = buildHardSovereignDefaults(input.text, flags, lawRefs, lineage);
  return {
    ...hardDefaults,
    tier: "hard_sovereign",
    tierReason: "Hard Sovereign Defaults — ICWA, Trust, Tribal Medical Authority enforced. No downtime.",
    azureAvailable,
  };
}
