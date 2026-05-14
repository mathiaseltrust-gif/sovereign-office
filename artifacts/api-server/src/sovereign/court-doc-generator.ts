import { db } from "@workspace/db";
import { courtDocumentsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { runIntakeFilter } from "./intake-filter";
import { queryLawDb } from "./law-db";
import { getTemplate, listTemplates, LEGACY_TEMPLATE_MAP, type LegacyTemplate } from "../legacy/court-docs/templates";
import { logger } from "../lib/logger";
import { getGovernorByRole, getActiveGovernor, getSessionGovernor, normalizeRoleKey, logGovernorActivation } from "./role-governor";

export interface GenerateCourtDocInput {
  templateId: string;
  vars?: Record<string, string>;
  parties?: Record<string, string>;
  caseDetails?: Record<string, string>;
  userId?: number;
  userRole?: string;
  userEmail?: string;
  runIntakeAnalysis?: boolean;
}

export interface GenerateCourtDocResult {
  id: number;
  templateId: string;
  templateName: string;
  documentType: string;
  title: string;
  content: string;
  troSensitive: boolean;
  emergencyOrder: boolean;
  intakeFlags: ReturnType<typeof runIntakeFilter> | null;
  doctrinesApplied: string[];
  lawRefs: Array<{ citation: string; title: string }>;
  signatureBlock: string;
  dbRecord: unknown;
  governorRoleKey?: string;
  governorDisplayName?: string;
}

function resolveTemplateId(raw: string): string {
  const upper = raw.toUpperCase();
  if (getTemplate(upper)) return upper;
  const mapped = LEGACY_TEMPLATE_MAP[raw.toLowerCase()];
  if (mapped) return mapped;
  return upper;
}

export async function generateCourtDocument(input: GenerateCourtDocInput): Promise<GenerateCourtDocResult> {
  const resolvedId = resolveTemplateId(input.templateId);
  const template = getTemplate(resolvedId);
  if (!template) {
    throw new Error(`Unknown court document template: ${input.templateId} (resolved: ${resolvedId}). Available: ${listTemplates().map(t => t.id).join(", ")}`);
  }

  let governorRoleKey: string | undefined;
  let governorDisplayName: string | undefined;
  let governorId: number | undefined;
  let governorHeader = "";
  let governorSignature = "";
  let governorAuthorityCitation = "";

  try {
    let governor = null;
    if (input.userId) {
      governor = await getSessionGovernor(input.userId);
    }
    if (!governor) {
      const roleKey = input.userRole ? normalizeRoleKey(input.userRole) : null;
      governor = roleKey ? await getGovernorByRole(roleKey) : null;
    }
    if (!governor) {
      governor = await getActiveGovernor();
    }
    if (governor) {
      governorRoleKey = governor.roleKey;
      governorDisplayName = governor.displayName;
      governorId = governor.id;
      governorHeader = governor.documentHeaderTemplate;
      governorSignature = governor.signatureBlockTemplate;
      governorAuthorityCitation = governor.authorityCitation ?? "";
      logger.info({ governorRoleKey: governor.roleKey }, "Court doc generator: governor context injected");
    }
  } catch {
    logger.warn("Court doc generator: governor lookup failed — continuing without");
  }

  const vars: Record<string, string> = {
    issuedDate: new Date().toLocaleDateString(),
    issuedTime: new Date().toLocaleTimeString(),
    ...(input.caseDetails ?? {}),
    ...(input.vars ?? {}),
  };

  const allPartyText = Object.entries(input.parties ?? {}).map(([k, v]) => `${k}: ${v}`).join(", ");
  const rawContent = template.buildContent({ ...vars, ...buildPartyVars(input.parties ?? {}) });

  function substituteGovernorTokens(template: string, v: Record<string, string>): string {
    const signerName =
      v["name"] ?? v["petitionerName"] ?? v["signerName"] ?? v["respondentName"] ?? "Authorized Signatory";
    return template
      .replace(/\[NAME\]/g, signerName)
      .replace(/\[DATE\]/g, v["issuedDate"] ?? new Date().toLocaleDateString());
  }

  const resolvedGovernorHeader = governorHeader ? substituteGovernorTokens(governorHeader, vars) : "";
  const resolvedGovernorSignature = governorSignature ? substituteGovernorTokens(governorSignature, vars) : "";

  const authorityFooter = governorAuthorityCitation
    ? `\n\nGOVERNING AUTHORITY\n${governorAuthorityCitation}`
    : "";
  const content = resolvedGovernorHeader
    ? `${resolvedGovernorHeader}\n${rawContent}${authorityFooter}`
    : `${rawContent}${authorityFooter}`;
  const templateSignatureBlock = template.buildSignatureBlock(vars);
  const signatureBlock = resolvedGovernorSignature || templateSignatureBlock;

  let intakeFlags: ReturnType<typeof runIntakeFilter> | null = null;
  let doctrinesApplied = [...template.defaultDoctrines];
  let lawRefs: Array<{ citation: string; title: string }> = [];

  if (input.runIntakeAnalysis !== false) {
    const analysisText = [content, allPartyText, JSON.stringify(input.caseDetails ?? {})].join(" ");
    intakeFlags = runIntakeFilter(analysisText);

    const tags = detectDocTags(template, intakeFlags);
    const lawData = await queryLawDb(tags);

    lawRefs = [
      ...lawData.federalLaws.slice(0, 5).map(f => ({ citation: f.citation, title: f.title })),
      ...lawData.doctrines.slice(0, 4).map(d => ({ citation: d.citation, title: d.caseName })),
    ];

    if (intakeFlags.doctrinesTriggered.length > 0) {
      doctrinesApplied = [...new Set([...doctrinesApplied, ...intakeFlags.doctrinesTriggered])];
    }
  }

  const title = buildTitle(template, vars, input.parties ?? {});
  const troSensitive = template.troSensitive || (intakeFlags?.troRecommended ?? false);
  const emergencyOrder = vars.emergency === "true" || vars.emergencyOrder === "true";

  const auditEntry = {
    ts: new Date().toISOString(),
    action: "generated",
    detail: `Generated ${template.id} (${template.documentType}) from template ${template.name}`,
    userId: input.userId ?? null,
    intakeFlags: intakeFlags ? {
      redFlag: intakeFlags.redFlag,
      violations: intakeFlags.violations,
      troRecommended: intakeFlags.troRecommended,
      indianStatusViolation: intakeFlags.indianStatusViolation,
    } : null,
    troSensitive,
    emergencyOrder,
  };

  const [dbRecord] = await db.insert(courtDocumentsTable).values({
    templateId: template.id,
    templateName: template.name,
    documentType: template.documentType,
    title,
    caseNumber: vars.caseNumber ?? input.caseDetails?.caseNumber ?? null,
    court: vars.court ?? input.caseDetails?.court ?? null,
    parties: input.parties ?? {},
    caseDetails: input.caseDetails ?? {},
    content,
    status: "draft",
    troSensitive,
    emergencyOrder,
    intakeFlags: intakeFlags ?? {},
    doctrinesApplied,
    lawRefs,
    signatureBlock,
    recorderMetadata: {
      recorderRequired: template.recorderRequired,
      documentType: template.documentType,
      category: template.category,
    },
    generatedBy: typeof input.userId === "number" ? input.userId : null,
    auditLog: [auditEntry],
  }).returning();

  logger.info({ id: dbRecord.id, templateId: template.id, troSensitive, emergencyOrder }, "Court document generated");

  if (governorId) {
    await logGovernorActivation({
      governorId,
      roleKey: governorRoleKey!,
      eventType: "generation",
      documentId: dbRecord.id,
      documentType: template.documentType,
      actingUserId: input.userId,
      actingUserEmail: input.userEmail,
    });
  }

  return {
    id: dbRecord.id,
    templateId: template.id,
    templateName: template.name,
    documentType: template.documentType,
    title,
    content,
    troSensitive,
    emergencyOrder,
    intakeFlags,
    doctrinesApplied,
    lawRefs,
    signatureBlock,
    dbRecord,
    governorRoleKey,
    governorDisplayName,
  };
}

function buildTitle(template: LegacyTemplate, vars: Record<string, string>, parties: Record<string, string>): string {
  const caseNum = vars.caseNumber ? ` — ${vars.caseNumber}` : "";
  const childName = vars.childName ?? parties["Child"] ?? parties["Subject"] ?? "";
  if (template.documentType === "tro") return `TRO${childName ? ` — ${childName}` : ""}${caseNum}`;
  if (template.documentType === "icwa_notice") return `ICWA Notice${childName ? ` — ${childName}` : ""}${caseNum}`;
  if (template.documentType === "protective_order") return `Protective Order${caseNum}`;
  if (template.documentType === "trust_deed") return `Trust Deed Declaration${caseNum}`;
  if (template.documentType === "nfr") return `Notice of Federal Review${caseNum}`;
  if (template.documentType === "emergency_welfare") return `Emergency Welfare Declaration${caseNum}`;
  return `${template.name}${caseNum}`;
}

function buildPartyVars(parties: Record<string, string>): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(parties)) {
    result[key.toLowerCase().replace(/\s+/g, "")] = value;
    if (key.toLowerCase().includes("petitioner") || key.toLowerCase().includes("protected")) result.petitioner = value;
    if (key.toLowerCase().includes("respondent") || key.toLowerCase().includes("agency")) result.respondent = value;
    if (key.toLowerCase().includes("child")) result.childName = value;
    if (key.toLowerCase().includes("tribe")) result.tribe = value;
    if (key.toLowerCase().includes("beneficiary")) result.beneficiary = value;
  }
  return result;
}

function detectDocTags(template: LegacyTemplate, flags: ReturnType<typeof runIntakeFilter>): string[] {
  const tags = new Set<string>();
  if (template.category === "ICWA" || template.documentType === "icwa_notice") {
    ["icwa", "child-welfare", "tribal-jurisdiction", "tro"].forEach(t => tags.add(t));
  }
  if (template.category === "Trust Land" || template.documentType === "trust_deed") {
    ["trust-land", "federal-trust", "alienation"].forEach(t => tags.add(t));
  }
  if (template.troSensitive || flags.troRecommended) {
    ["tro", "imminent-harm", "emergency", "protective-order"].forEach(t => tags.add(t));
  }
  if (flags.violations.some(v => v.toLowerCase().includes("overreach"))) {
    ["state-preemption", "tribal-sovereignty", "federal-preemption"].forEach(t => tags.add(t));
  }
  if (flags.indianStatusViolation) {
    ["canons-of-construction", "indian-favor"].forEach(t => tags.add(t));
  }
  return Array.from(tags);
}

export async function getCourtDocument(id: number) {
  const rows = await db.select().from(courtDocumentsTable).where(eq(courtDocumentsTable.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function listCourtDocuments() {
  return db.select().from(courtDocumentsTable).orderBy(courtDocumentsTable.createdAt);
}

export { listTemplates };
