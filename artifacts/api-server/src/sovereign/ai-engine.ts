import { callAzureOpenAI, getAzureOpenAIClient } from "../lib/azure-openai";
import { runIntakeFilter, type IntakeFilterResult } from "./intake-filter";
import { queryLawDb, ensureLawDbSeeded } from "./law-db";
import { computeDelegatedAuthorities } from "./delegated-authority";
import { logger } from "../lib/logger";
import type { LawReference, IntakeAgentReport, LineageVerification, ExtractedIntakeData, IntakeRecap, IntakeOption, IntakeForm } from "./ai-intake-agent";

const INSTRUMENT_OPTIONS: Record<string, IntakeOption> = {
  TRO_ICWA: { label: "Issue ICWA TRO", action: "generate_tro_icwa", endpoint: "/api/court/welfare", description: "Generate a Temporary Restraining Order under the Indian Child Welfare Act" },
  TRO_GENERAL: { label: "Issue TRO", action: "generate_tro", endpoint: "/api/court/welfare", description: "Generate a general Temporary Restraining Order under sovereign emergency authority" },
  ICWA_NOTICE: { label: "File ICWA Notice", action: "file_icwa_notice", endpoint: "/api/court/nfr", description: "File mandatory ICWA Notice of Proceeding — 25 U.S.C. § 1912" },
  NFR: { label: "Notice of Federal Review", action: "generate_nfr", endpoint: "/api/court/nfr", description: "Generate and file Notice of Federal Review with applicable statute citations" },
  EMERGENCY_WELFARE: { label: "Emergency Welfare Order", action: "emergency_welfare", endpoint: "/api/court/welfare", description: "Issue an emergency welfare protection order under ICWA and sovereign authority" },
  TRUST_DEED: { label: "Trust Deed Declaration", action: "trust_deed", endpoint: "/api/trust/instruments", description: "Generate a trust deed or declaration of trust land status" },
  JURISDICTIONAL_STATEMENT: { label: "Jurisdictional Statement", action: "jurisdictional_statement", endpoint: "/api/court/documents", description: "File a statement of exclusive tribal jurisdiction" },
};

const INSTRUMENT_FORMS: Record<string, IntakeForm> = {
  TRO_ICWA: { form_code: "TRO-ICWA-001", form_name: "ICWA Temporary Restraining Order", form_type: "Emergency Court Order", recommended: true },
  TRO_GENERAL: { form_code: "TRO-GEN-001", form_name: "General Temporary Restraining Order", form_type: "Emergency Court Order", recommended: true },
  ICWA_NOTICE: { form_code: "ICWA-NOT-001", form_name: "ICWA Notice of Proceedings (25 U.S.C. § 1912)", form_type: "Mandatory Federal Notice", recommended: true },
  NFR: { form_code: "NFR-001", form_name: "Notice of Federal Review", form_type: "Federal Sovereignty Notice", recommended: true },
  EMERGENCY_WELFARE: { form_code: "WELFARE-EMG-001", form_name: "Emergency Tribal Welfare Order", form_type: "Sovereign Protection Order", recommended: true },
  TRUST_DEED: { form_code: "TRUST-DEED-001", form_name: "Trust Deed Declaration", form_type: "Trust Instrument", recommended: false },
  JURISDICTIONAL_STATEMENT: { form_code: "JXST-001", form_name: "Statement of Tribal Jurisdiction", form_type: "Jurisdictional Filing", recommended: false },
};

function extractParties(text: string): { names: string[]; agencies: string[] } {
  const agencyPatterns = /\b(BIA|Bureau of Indian Affairs|HHS|Department of Health|State Court|County Court|Child Protective Services|CPS|DCFS|DHS|Social Services|State of \w+|County of \w+|City of \w+|Tribal Council|Tribal Court)\b/gi;
  const agencies = Array.from(new Set(Array.from(text.matchAll(agencyPatterns)).map(m => m[0])));
  const namePattern = /\b([A-Z][a-z]+ [A-Z][a-z]+(?:\s[A-Z][a-z]+)?)\b/g;
  const allNames = Array.from(new Set(Array.from(text.matchAll(namePattern)).map(m => m[0])));
  const stopWords = new Set(["Indian Child", "Child Welfare", "Indian Country", "United States", "Federal Court", "State Court", "Tribal Court", "Supreme Court", "Indian Law"]);
  const names = allNames.filter(n => !stopWords.has(n) && n.split(" ").every(w => w[0] === w[0].toUpperCase())).slice(0, 10);
  return { names, agencies: agencies.slice(0, 8) };
}

function extractState(text: string): string {
  const statePattern = /\b(Alabama|Alaska|Arizona|Arkansas|California|Colorado|Connecticut|Delaware|Florida|Georgia|Hawaii|Idaho|Illinois|Indiana|Iowa|Kansas|Kentucky|Louisiana|Maine|Maryland|Massachusetts|Michigan|Minnesota|Mississippi|Missouri|Montana|Nebraska|Nevada|New Hampshire|New Jersey|New Mexico|New York|North Carolina|North Dakota|Ohio|Oklahoma|Oregon|Pennsylvania|Rhode Island|South Carolina|South Dakota|Tennessee|Texas|Utah|Vermont|Virginia|Washington|West Virginia|Wisconsin|Wyoming)\b/i;
  const match = text.match(statePattern);
  return match ? match[0] : "Unknown";
}

function deriveStructuredOutput(
  report: IntakeAgentReport,
  rawText: string,
): Pick<IntakeAgentReport, "extracted" | "recap" | "options" | "forms" | "formData"> {
  const parties = extractParties(rawText);
  const state = extractState(rawText);

  const domainTags: string[] = [];
  if (report.intakeFlags.indianStatusViolation) domainTags.push("ICWA violation", "Indian status challenge");
  if (report.intakeFlags.troRecommended) domainTags.push("emergency protection needed");
  if (report.nfrRecommended) domainTags.push("federal review required");
  const issues = [...new Set([...domainTags, ...report.intakeFlags.violations.slice(0, 5)])];

  const jurisdictionType = report.doctrinesApplied.some(d => /state|county|local/i.test(d))
    ? "federal-tribal concurrent"
    : "exclusive tribal";

  const extracted: ExtractedIntakeData = {
    parties,
    issues,
    timeline: [],
    summary: report.summary,
    jurisdiction: report.intakeFlags.canonicalPosture,
    state,
    form_type: report.recommendedInstruments.includes("TRO_ICWA") || report.recommendedInstruments.includes("TRO_GENERAL")
      ? "Emergency TRO Filing"
      : report.recommendedInstruments.includes("NFR")
      ? "Notice of Federal Review"
      : report.recommendedInstruments.includes("ICWA_NOTICE")
      ? "ICWA Notice Filing"
      : "Legal Intake",
  };

  const facts = report.factSummary
    .split(/\n+/)
    .map(l => l.replace(/^[-•*#\s]+/, "").trim())
    .filter(l => l.length > 10 && !l.startsWith("HARD") && !l.startsWith("INTAKE:") && !l.startsWith("VIOLATIONS:") && !l.startsWith("CANONICAL"))
    .slice(0, 8);

  const recap: IntakeRecap = {
    facts: facts.length > 0 ? facts : [report.summary],
    parties: [...parties.names, ...parties.agencies].slice(0, 6),
    jurisdiction: {
      state,
      type: jurisdictionType,
      description: report.intakeFlags.canonicalPosture,
    },
    legal: report.lawRefs.slice(0, 6).map(ref => ({
      citation: ref.citation,
      title: ref.title,
      relevance: ref.relevanceReason,
    })),
    rules: report.doctrinesApplied.slice(0, 5),
    recommended_action: report.recommendedActions[0] ?? "Standard intake processing",
    protective_summary: report.intakeFlags.indianStatusViolation
      ? `ICWA protections apply — 25 U.S.C. §§ 1901–1963. ${report.intakeFlags.troRecommended ? "Emergency TRO posture active. " : ""}Full Faith and Credit of Tribal Court orders must be recognized.`
      : report.nfrRecommended
      ? "Federal Notice of Review recommended. Tribal sovereignty protections apply under federal trust responsibility doctrine."
      : "Standard sovereign intake — tribal protections apply. All federal Indian law rights preserved.",
  };

  const options: IntakeOption[] = [
    ...report.recommendedInstruments
      .filter(inst => INSTRUMENT_OPTIONS[inst])
      .map(inst => INSTRUMENT_OPTIONS[inst]),
    { label: "Full AI Intake Analysis", action: "full_intake", endpoint: "/api/intake/ai", description: "Run the full 4-tier sovereign AI intake engine on this matter" },
    { label: "File as Complaint", action: "file_complaint", endpoint: "/api/complaints", description: "Open this as a formal court complaint matter" },
  ];

  const forms: IntakeForm[] = [
    ...report.recommendedInstruments
      .filter(inst => INSTRUMENT_FORMS[inst])
      .map(inst => INSTRUMENT_FORMS[inst]),
    { form_code: "INTAKE-LOG-001", form_name: "Intake Log Entry", form_type: "Administrative Record", recommended: false },
  ];

  const formData: Record<string, unknown> = {
    summary: report.summary,
    riskLevel: report.riskLevel,
    submittedAt: report.processedAt,
    parties: parties.names.join("; "),
    agencies: parties.agencies.join("; "),
    state,
    jurisdiction: extracted.jurisdiction,
    icwaApplicable: report.intakeFlags.indianStatusViolation || report.intakeFlags.troRecommended,
    troRecommended: report.troRecommended,
    nfrRecommended: report.nfrRecommended,
    instruments: report.recommendedInstruments.join(", "),
  };

  return { extracted, recap, options, forms, formData };
}

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
        const structured = deriveStructuredOutput(report, input.text);
        return {
          ...report,
          ...structured,
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
    const ruleReportFinal = { ...ruleReport, recommendedActions: combinedActions };
    const ruleStructured = deriveStructuredOutput(ruleReportFinal, input.text);
    return {
      ...ruleReportFinal,
      ...ruleStructured,
      tier: "rule_based",
      tierReason: "Rule-based intake filter + legal-logic module + delegated authority engine",
      azureAvailable,
    };
  } catch (err) {
    logger.error({ err: (err as Error).message }, "AI Engine: Tier 2/3 failed — applying Hard Sovereign Defaults (Tier 4)");
  }

  logger.warn("AI Engine: Hard Sovereign Defaults applied (Tier 4)");
  const hardDefaults = buildHardSovereignDefaults(input.text, flags, lawRefs, lineage);
  const hardStructured = deriveStructuredOutput(hardDefaults, input.text);
  return {
    ...hardDefaults,
    ...hardStructured,
    tier: "hard_sovereign",
    tierReason: "Hard Sovereign Defaults — ICWA, Trust, Tribal Medical Authority enforced. No downtime.",
    azureAvailable,
  };
}
