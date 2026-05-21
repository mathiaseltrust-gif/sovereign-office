import { callAzureOpenAI } from "../lib/azure-openai";
import { logger } from "../lib/logger";

const TONE_NEUTRALIZER_PREAMBLE = `
You are a neutral, factual, procedurally-focused legal compliance analyst. Your role is to analyze matters
against governing procedural records and applicable law. All output must be:
- Factual and evidence-based, citing specific statutes, regulations, or procedural rules
- Procedurally neutral — no accusations, no emotional language, no overstated conclusions
- Professionally administrative in tone — the standard of a trained legal analyst writing for an official record
- Organized and structured for review by sovereign officers and administrators
- Non-threatening and non-adversarial — describe what occurred and what was required, not blame
Do not speculate beyond what the record supports. Do not reach legal conclusions; describe procedural observations.
`.trim();

export interface TraceEngineInput {
  matterId: number;
  title: string;
  description: string;
  matterType: string;
  niacPathway: boolean;
}

export interface ProceduralReconstructionResult {
  requiredProcedure: string;
  actualConduct: string;
  proceduralGaps: string[];
}

export interface AuthorityMapResult {
  statutes: string[];
  regulations: string[];
  treaties: string[];
  guidance: string[];
}

export interface OversightMapResult {
  agencies: string[];
  pathways: string[];
  triggers: string[];
  niacTrigger: boolean;
  niacReason: string;
  riskScore: number;
  escalationRecs: string[];
}

export interface TraceEngineResult {
  proceduralReconstruction: ProceduralReconstructionResult;
  authorityMap: AuthorityMapResult;
  oversightMap: OversightMapResult;
  riskScore: number;
  rawResponses: { pass1: string; pass2: string; pass3: string };
}

function buildNiacContext(niacPathway: boolean): string {
  if (!niacPathway) return "";
  return `
NIAC REVIEW PATHWAY ACTIVE:
This matter has been flagged for NIAC (National Indigenous American Committee — 527 political organization)
Indigenous rights review. Frame all analysis with Indigenous rights implications at the forefront.
Review types applicable: informational, procedural, oversight, tribal-court-related, NIAC-political,
document-assistance, federal-pathway, formal-escalation.
`.trim();
}

function parseProcedural(raw: string): ProceduralReconstructionResult {
  try {
    const parsed = JSON.parse(raw) as Partial<ProceduralReconstructionResult>;
    return {
      requiredProcedure: parsed.requiredProcedure ?? raw.substring(0, 1000),
      actualConduct: parsed.actualConduct ?? "",
      proceduralGaps: Array.isArray(parsed.proceduralGaps) ? parsed.proceduralGaps : [],
    };
  } catch {
    return { requiredProcedure: raw.substring(0, 2000), actualConduct: "", proceduralGaps: [] };
  }
}

function parseAuthority(raw: string): AuthorityMapResult {
  try {
    const parsed = JSON.parse(raw) as Partial<AuthorityMapResult>;
    return {
      statutes: Array.isArray(parsed.statutes) ? parsed.statutes : [],
      regulations: Array.isArray(parsed.regulations) ? parsed.regulations : [],
      treaties: Array.isArray(parsed.treaties) ? parsed.treaties : [],
      guidance: Array.isArray(parsed.guidance) ? parsed.guidance : [],
    };
  } catch {
    return { statutes: [], regulations: [], treaties: [], guidance: [raw.substring(0, 500)] };
  }
}

function parseOversight(raw: string): OversightMapResult {
  try {
    const parsed = JSON.parse(raw) as Partial<OversightMapResult & { niac_trigger?: boolean; niac_reason?: string; risk_score?: number; escalation_recs?: string[] }>;
    return {
      agencies: Array.isArray(parsed.agencies) ? parsed.agencies : [],
      pathways: Array.isArray(parsed.pathways) ? parsed.pathways : [],
      triggers: Array.isArray(parsed.triggers) ? parsed.triggers : [],
      niacTrigger: parsed.niacTrigger ?? parsed.niac_trigger ?? false,
      niacReason: parsed.niacReason ?? parsed.niac_reason ?? "",
      riskScore: typeof parsed.riskScore === "number" ? parsed.riskScore : (typeof parsed.risk_score === "number" ? parsed.risk_score : 0),
      escalationRecs: Array.isArray(parsed.escalationRecs) ? parsed.escalationRecs : (Array.isArray(parsed.escalation_recs) ? parsed.escalation_recs : []),
    };
  } catch {
    return { agencies: [], pathways: [], triggers: [], niacTrigger: false, niacReason: "", riskScore: 0, escalationRecs: [] };
  }
}

export async function runTraceAnalysis(input: TraceEngineInput): Promise<TraceEngineResult> {
  const { title, description, matterType, niacPathway } = input;
  const niacContext = buildNiacContext(niacPathway);

  const matterContext = `
MATTER TITLE: ${title}
MATTER TYPE: ${matterType}
${niacContext}

SUBMITTED DESCRIPTION / RECORD:
${description}
`.trim();

  logger.info({ matterId: input.matterId, matterType, niacPathway }, "TRACE analysis started");

  const pass1SystemPrompt = `${TONE_NEUTRALIZER_PREAMBLE}

PASS 1 — PROCEDURAL RECONSTRUCTION:
Analyze the submitted matter and reconstruct the procedural record. Respond with valid JSON only (no markdown):
{
  "requiredProcedure": "Description of what process was legally required under applicable law, regulation, or established procedure",
  "actualConduct": "Neutral description of what actually occurred based on the submitted record",
  "proceduralGaps": ["Gap 1: specific missing step or deviation", "Gap 2: ...", ...]
}`;

  const pass2SystemPrompt = `${TONE_NEUTRALIZER_PREAMBLE}

PASS 2 — AUTHORITY MAPPING:
Identify the governing legal authority for this matter. Distinguish: statute vs. regulation vs. guidance vs. policy.
Consider: U.S. Constitution, treaties, federal statutes (USC), CFR provisions, agency guidance, state statutes/admin codes, tribal authority.
Respond with valid JSON only (no markdown):
{
  "statutes": ["25 U.S.C. § ...", "42 U.S.C. § ...", ...],
  "regulations": ["25 CFR Part ...", "45 CFR § ...", ...],
  "treaties": ["Treaty name/citation if applicable", ...],
  "guidance": ["Agency guidance document / policy memo name", ...]
}`;

  const pass3SystemPrompt = `${TONE_NEUTRALIZER_PREAMBLE}

PASS 3 — OVERSIGHT & ROUTING:
Identify applicable oversight agencies and escalation pathways. Consider: DOJ, OCR, CMS, HHS, BIA, IHS, HUD, Treasury, Inspector Generals.
Assess NIAC review trigger and overall risk score (0–100: 0–25 low, 26–50 medium, 51–75 high, 76–100 critical).
Respond with valid JSON only (no markdown):
{
  "agencies": ["DOJ Civil Rights Division", "BIA", ...],
  "pathways": ["Administrative complaint to ...", "Federal oversight trigger via ...", ...],
  "triggers": ["Trigger condition 1", ...],
  "niacTrigger": true or false,
  "niacReason": "Brief reason why NIAC review is or is not triggered",
  "riskScore": 0–100,
  "escalationRecs": ["Recommended next step 1", "Recommended next step 2", ...]
}`;

  const [r1, r2, r3] = await Promise.all([
    callAzureOpenAI(pass1SystemPrompt, matterContext, { maxTokens: 1500, temperature: 0.1 }),
    callAzureOpenAI(pass2SystemPrompt, matterContext, { maxTokens: 1200, temperature: 0.1 }),
    callAzureOpenAI(pass3SystemPrompt, matterContext, { maxTokens: 1200, temperature: 0.1 }),
  ]);

  const proceduralReconstruction = parseProcedural(r1.content);
  const authorityMap = parseAuthority(r2.content);
  const oversightMap = parseOversight(r3.content);

  logger.info({ matterId: input.matterId, riskScore: oversightMap.riskScore }, "TRACE analysis complete");

  return {
    proceduralReconstruction,
    authorityMap,
    oversightMap,
    riskScore: oversightMap.riskScore,
    rawResponses: { pass1: r1.content, pass2: r2.content, pass3: r3.content },
  };
}

export async function generateTraceDraft(
  draftType: string,
  matter: { title: string; description: string; matterType: string },
  analysis?: { requiredProcedure?: string; actualConduct?: string; proceduralGaps?: string[]; authorityMap?: AuthorityMapResult; oversightMap?: Partial<OversightMapResult> },
): Promise<string> {
  const draftTypeLabels: Record<string, string> = {
    procedural_audit_report: "Procedural Audit Report",
    oversight_map: "Oversight & Agency Routing Map",
    response_letter: "Formal Response Letter",
    escalation_memo: "Escalation Memorandum",
    summary: "Executive Summary",
  };

  const label = draftTypeLabels[draftType] ?? "Document";

  const systemPrompt = `${TONE_NEUTRALIZER_PREAMBLE}

DRAFTING TASK — ${label.toUpperCase()}:
Draft a professionally formatted ${label} for the matter described. The document must be:
- Factual and procedurally grounded in the analysis provided
- Tone-neutralized: no accusations, no emotional language
- Written for sovereign tribal officers and administrators
- Suitable for submission to federal agencies or official records
Output the full document text only, with appropriate headers and structure.`;

  const userPrompt = `
MATTER: ${matter.title}
MATTER TYPE: ${matter.matterType}

DESCRIPTION:
${matter.description}

${analysis ? `PROCEDURAL ANALYSIS:
Required Procedure: ${analysis.requiredProcedure ?? "N/A"}
Actual Conduct: ${analysis.actualConduct ?? "N/A"}
Identified Gaps: ${(analysis.proceduralGaps ?? []).join("; ")}

AUTHORITY: ${JSON.stringify(analysis.authorityMap ?? {})}
OVERSIGHT MAP: ${JSON.stringify(analysis.oversightMap ?? {})}` : ""}

Draft the ${label} now.`.trim();

  const result = await callAzureOpenAI(systemPrompt, userPrompt, { maxTokens: 2500, temperature: 0.2 });
  return result.content;
}
