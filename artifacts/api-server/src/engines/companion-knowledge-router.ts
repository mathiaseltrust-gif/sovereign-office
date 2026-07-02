export type CompanionKnowledgeDomain =
  | "identity"
  | "lineage"
  | "healthcare"
  | "urban_indian_navigation"
  | "trust_responsibility"
  | "land"
  | "court"
  | "document"
  | "member"
  | "household"
  | "benefits"
  | "education"
  | "sdu"
  | "atlas"
  | "governance"
  | "enforcement"
  | "general";

export type CompanionAccessMode =
  | "public_guidance"
  | "member_limited"
  | "officer_review"
  | "trustee_governance"
  | "chief_governance";

export interface CompanionKnowledgeInput {
  message: string;
  userId?: number;
  userRole?: string;
  userTitle?: string;
  matterId?: string;
  uploadedDocumentText?: string;
}

export interface CompanionKnowledgeRoute {
  domains: CompanionKnowledgeDomain[];
  accessMode: CompanionAccessMode;
  posture: string;
  retrievalTargets: string[];
  suggestedEngines: string[];
  reviewRequired: boolean;
  lawLogicRequired: boolean;
  traceRequired: boolean;
  companionInstruction: string;
}

const DOMAIN_PATTERNS: Array<{
  domain: CompanionKnowledgeDomain;
  patterns: RegExp[];
  retrievalTargets: string[];
  engines: string[];
}> = [
  {
    domain: "identity",
    patterns: [/identity/i, /status/i, /profile/i, /tribal id/i, /verification/i, /who am i/i, /my role/i],
    retrievalTargets: ["identity_gateway", "profile_vault", "family_lineage", "verification_registry"],
    engines: ["role_governor", "alignment_checker", "identity_gateway"],
  },
  {
    domain: "lineage",
    patterns: [/lineage/i, /ancestor/i, /ancestry/i, /family tree/i, /knowledge of self/i, /family group/i],
    retrievalTargets: ["family_lineage", "atlas", "knowledge_of_self", "profile"],
    engines: ["identity_gateway", "atlas_engine", "sdu_learning"],
  },
  {
    domain: "healthcare",
    patterns: [/health/i, /medical/i, /medi-cal/i, /managed care/i, /ihs/i, /ihcia/i, /ai\/an/i, /fee-for-service/i],
    retrievalTargets: ["law_db", "healthcare_pathways", "authority_directory", "evidence_vault"],
    engines: ["trust_responsibility_engine", "apa_review", "law_logic_runtime"],
  },
  {
    domain: "urban_indian_navigation",
    patterns: [/urban indian/i, /navigation/i, /resources/i, /benefits/i, /liaison/i, /cms/i, /dhcs/i, /ihs/i],
    retrievalTargets: ["authority_directory", "law_db", "sdu_modules", "atlas"],
    engines: ["trust_responsibility_engine", "companion_context_builder", "sdu_learning"],
  },
  {
    domain: "trust_responsibility",
    patterns: [/trust responsibility/i, /snyder act/i, /federal trust/i, /benefit care assistance/i, /self-determination/i],
    retrievalTargets: ["law_db", "trust_responsibility_vehicles", "authority_directory"],
    engines: ["trust_responsibility_engine", "law_logic_runtime", "companion_context_builder"],
  },
  {
    domain: "land",
    patterns: [/land/i, /property/i, /trust land/i, /restricted/i, /foreclosure/i, /lien/i, /tax/i, /parcel/i, /apn/i],
    retrievalTargets: ["land_records", "atlas", "evidence_vault", "law_db", "case_files"],
    engines: ["continuity_engine", "jurisdictional_coherence_engine", "nfr_review_engine"],
  },
  {
    domain: "court",
    patterns: [/court/i, /case/i, /summons/i, /complaint/i, /motion/i, /service/i, /judge/i, /appearance/i],
    retrievalTargets: ["case_files", "review_queue", "trace_events", "document_forge", "law_db"],
    engines: ["jurisdictional_coherence_engine", "role_governor", "law_logic_runtime"],
  },
  {
    domain: "document",
    patterns: [/document/i, /notice/i, /letter/i, /draft/i, /template/i, /pdf/i, /seal/i, /stamp/i, /tribal id/i],
    retrievalTargets: ["document_forge", "templates", "doc_ref", "pdf_builder", "verification_registry"],
    engines: ["document_gap_listener", "document_forge", "role_governor"],
  },
  {
    domain: "sdu",
    patterns: [/self-determination university/i, /sdu/i, /learn/i, /lesson/i, /module/i, /exercise/i, /training/i],
    retrievalTargets: ["sdu_modules", "learning_tracks", "law_db", "knowledge_of_self"],
    engines: ["sdu_learning", "companion_context_builder", "alignment_checker"],
  },
  {
    domain: "governance",
    patterns: [/governance/i, /trustee/i, /officer/i, /role/i, /authority/i, /capacity/i, /posture/i, /persona/i],
    retrievalTargets: ["role_governor", "governance_roles", "authority", "trace_events"],
    engines: ["role_governor", "law_logic_runtime", "alignment_checker"],
  },
  {
    domain: "enforcement",
    patterns: [/enforce/i, /escalate/i, /violation/i, /default/i, /no response/i, /protective order/i, /full faith/i],
    retrievalTargets: ["escalation_paths", "trace_events", "review_queue", "law_db", "case_files"],
    engines: ["trace_engine", "jurisdictional_coherence_engine", "document_forge"],
  },
];

function normalizeRole(role?: string, title?: string): CompanionAccessMode {
  const value = `${role ?? ""} ${title ?? ""}`.toLowerCase();

  if (/chief|justice|trustee|sovereign_admin/.test(value)) return "chief_governance";
  if (/trustee/.test(value)) return "trustee_governance";
  if (/officer|reviewer|admin/.test(value)) return "officer_review";
  if (/member|household|beneficiary/.test(value)) return "member_limited";

  return "public_guidance";
}

function postureFor(accessMode: CompanionAccessMode): string {
  switch (accessMode) {
    case "chief_governance":
      return "governing-office posture: alignment, authority, non-waiver, continuity, and final human review before official action";
    case "trustee_governance":
      return "fiduciary posture: protect trust, beneficiaries, records, land, and continuity without waiver";
    case "officer_review":
      return "review posture: intake, classify, preserve, route, and recommend without final authority unless approved";
    case "member_limited":
      return "member guidance posture: explain rights, gather facts, protect privacy, and route official requests for review";
    default:
      return "public guidance posture: educational information only, no official action or private record access";
  }
}

function unique<T>(items: T[]): T[] {
  return Array.from(new Set(items));
}

export function resolveKnowledgeDomains(input: CompanionKnowledgeInput): CompanionKnowledgeDomain[] {
  const text = `${input.message ?? ""}\n${input.uploadedDocumentText ?? ""}`;
  const domains = DOMAIN_PATTERNS
    .filter(entry => entry.patterns.some(pattern => pattern.test(text)))
    .map(entry => entry.domain);

  return domains.length > 0 ? unique(domains) : ["general"];
}

export function routeCompanionKnowledge(input: CompanionKnowledgeInput): CompanionKnowledgeRoute {
  const domains = resolveKnowledgeDomains(input);
  const accessMode = normalizeRole(input.userRole, input.userTitle);

  const matched = DOMAIN_PATTERNS.filter(entry => domains.includes(entry.domain));
  const retrievalTargets = unique(matched.flatMap(entry => entry.retrievalTargets));
  const suggestedEngines = unique(matched.flatMap(entry => entry.engines));

  const legalOrOfficial = domains.some(domain =>
    ["land", "court", "document", "governance", "enforcement", "trust_responsibility", "healthcare"].includes(domain),
  );

  const reviewRequired = legalOrOfficial || accessMode === "chief_governance" || accessMode === "trustee_governance";

  return {
    domains,
    accessMode,
    posture: postureFor(accessMode),
    retrievalTargets: retrievalTargets.length > 0 ? retrievalTargets : ["law_db", "site_navigation", "sdu_modules"],
    suggestedEngines: suggestedEngines.length > 0 ? suggestedEngines : ["chat_router", "alignment_checker"],
    reviewRequired,
    lawLogicRequired: legalOrOfficial,
    traceRequired: domains.some(domain => ["court", "land", "enforcement", "document"].includes(domain)),
    companionInstruction:
      "Answer as a modular governance companion: distinguish claims from accepted facts, preserve role/capacity/posture, retrieve only permitted context, and route official action through review.",
  };
}

export function buildCompanionContext(input: CompanionKnowledgeInput): CompanionKnowledgeRoute & {
  contextSummary: string;
} {
  const route = routeCompanionKnowledge(input);

  return {
    ...route,
    contextSummary: [
      `Domains: ${route.domains.join(", ")}`,
      `Access mode: ${route.accessMode}`,
      `Posture: ${route.posture}`,
      `Retrieval targets: ${route.retrievalTargets.join(", ")}`,
      `Suggested engines: ${route.suggestedEngines.join(", ")}`,
      `Review required: ${route.reviewRequired ? "yes" : "no"}`,
      `Law & Logic required: ${route.lawLogicRequired ? "yes" : "no"}`,
      `TRACE required: ${route.traceRequired ? "yes" : "no"}`,
    ].join("\n"),
  };
}
