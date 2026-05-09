import { db } from "@workspace/db";
import { recorderRulesTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { logger } from "../lib/logger";

export interface RecorderRule {
  margins?: { top: number; bottom: number; left: number; right: number };
  requireCaption?: boolean;
  requireNotarization?: boolean;
  maxPageSize?: string;
  additionalNotes?: string;
}

export interface RecorderFormatSpec {
  marginTop: number;
  marginBottom: number;
  marginLeft: number;
  marginRight: number;
  titleFontSizeMin: number;
  titleFontSizeMax: number;
  bodyFontSizeMin: number;
  bodyFontSizeMax: number;
  lineSpacingMin: number;
  lineSpacingMax: number;
  fontFamily: string;
  requireReturnAddress: boolean;
  requireApn: boolean;
  requireTitleBlock: boolean;
  requireSignatureBlock: boolean;
  requireNotaryBlock: boolean;
  requirePageNumbers: boolean;
  requireTribalSeal: boolean;
}

export const DEFAULT_RECORDER_SPEC: RecorderFormatSpec = {
  marginTop: 2.5,
  marginBottom: 0.5,
  marginLeft: 0.5,
  marginRight: 0.5,
  titleFontSizeMin: 14,
  titleFontSizeMax: 16,
  bodyFontSizeMin: 11,
  bodyFontSizeMax: 12,
  lineSpacingMin: 1.15,
  lineSpacingMax: 1.25,
  fontFamily: "Times New Roman",
  requireReturnAddress: true,
  requireApn: true,
  requireTitleBlock: true,
  requireSignatureBlock: true,
  requireNotaryBlock: false,
  requirePageNumbers: true,
  requireTribalSeal: false,
};

const REQUIRED_LEGAL_PROVISIONS = [
  "TRUST STATUS",
  "INDIAN LAND PROTECTION",
  "FEDERAL PREEMPTION",
  "TRIBAL JURISDICTION",
  "NON-WAIVER OF SOVEREIGNTY",
  "WORCESTER",
  "SNYDER ACT",
  "PROTECTED STATUS",
];

const APN_PATTERN = /^\d{3}-\d{3}-\d{2,3}(-\d+)?$|^\d{4}-\d{3}-\d{3}(-\d+)?$|^[A-Z0-9]{2,}-[A-Z0-9-]+$/;

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export function validateRecorderDocument(
  content: string,
  metadata: {
    apn?: string;
    returnAddress?: string;
    hasSignatureBlock?: boolean;
    hasNotaryBlock?: boolean;
    hasPageNumbers?: boolean;
    documentType?: string;
  },
  spec: RecorderFormatSpec = DEFAULT_RECORDER_SPEC,
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (spec.requireReturnAddress && !metadata.returnAddress) {
    errors.push("Missing required recorder return address block (top-left of first page within 2.5-inch margin)");
  }

  if (spec.requireApn) {
    if (!metadata.apn && !content.includes("APN:")) {
      errors.push("Missing required Assessor's Parcel Number (APN) block");
    } else if (metadata.apn && !APN_PATTERN.test(metadata.apn)) {
      warnings.push(`APN format '${metadata.apn}' may not match county recorder standard format (e.g., 123-456-78)`);
    }
  }

  if (spec.requireTitleBlock) {
    const hasTitle = content.includes("TRUST INSTRUMENT") || content.includes("NOTICE AFFECTING REAL PROPERTY") || content.includes("INSTRUMENT TYPE:");
    if (!hasTitle) {
      errors.push("Missing required title block. Document must contain 'TRUST INSTRUMENT' or 'NOTICE AFFECTING REAL PROPERTY'");
    }
  }

  if (spec.requireSignatureBlock && !metadata.hasSignatureBlock) {
    errors.push("Missing required signature block (must be positioned 1.5 inches above bottom margin)");
  }

  if (spec.requireNotaryBlock && !metadata.hasNotaryBlock) {
    errors.push("Missing required notary acknowledgment block for this document type/state");
  }

  if (spec.requirePageNumbers && !metadata.hasPageNumbers) {
    warnings.push("Page numbering is required; ensure bottom-center page numbers are present");
  }

  const missingProvisions = REQUIRED_LEGAL_PROVISIONS.filter(
    (p) => !content.toUpperCase().includes(p),
  );
  if (missingProvisions.length > 0) {
    errors.push(`Missing required legal provisions: ${missingProvisions.join(", ")}`);
  }

  if (!content.includes("LEGAL DESCRIPTION") && !content.includes("PARTIES")) {
    errors.push("Missing legal description and parties sections");
  } else if (!content.includes("LEGAL DESCRIPTION")) {
    errors.push("Missing legal description of land");
  } else if (!content.includes("PARTIES")) {
    warnings.push("Parties section not found — ensure grantor/grantee are identified");
  }

  return { valid: errors.length === 0, errors, warnings };
}

export function validateMargins(spec: RecorderFormatSpec = DEFAULT_RECORDER_SPEC): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (spec.marginTop < 2.5) {
    errors.push(`Top margin ${spec.marginTop}" is less than required 2.5 inches for recorder documents`);
  }
  if (spec.marginLeft < 0.5) {
    errors.push(`Left margin ${spec.marginLeft}" is less than required 0.5 inches`);
  }
  if (spec.marginRight < 0.5) {
    errors.push(`Right margin ${spec.marginRight}" is less than required 0.5 inches`);
  }
  if (spec.marginBottom < 0.5) {
    errors.push(`Bottom margin ${spec.marginBottom}" is less than required 0.5 inches`);
  }
  if (spec.bodyFontSizeMin < 11) {
    errors.push(`Body font size ${spec.bodyFontSizeMin}pt is below required minimum of 11pt`);
  }
  if (spec.bodyFontSizeMax > 12) {
    warnings.push(`Body font size ${spec.bodyFontSizeMax}pt exceeds recommended maximum of 12pt`);
  }
  if (spec.lineSpacingMin < 1.15) {
    errors.push(`Line spacing ${spec.lineSpacingMin} is below required minimum of 1.15`);
  }
  if (spec.lineSpacingMax > 1.25) {
    warnings.push(`Line spacing ${spec.lineSpacingMax} exceeds recommended maximum of 1.25`);
  }

  return { valid: errors.length === 0, errors, warnings };
}

export async function getRecorderRules(state: string, county?: string) {
  try {
    const conditions = county
      ? and(eq(recorderRulesTable.state, state), eq(recorderRulesTable.county, county))
      : eq(recorderRulesTable.state, state);

    const rules = await db.select().from(recorderRulesTable).where(conditions).limit(1);
    return rules[0] ?? null;
  } catch (err) {
    logger.error({ err, state, county }, "Failed to fetch recorder rules");
    return null;
  }
}

export async function storeRecorderRules(
  state: string,
  county: string | null,
  rules: object,
  statutes: string[],
  indianLandClassifications: string[],
) {
  return db
    .insert(recorderRulesTable)
    .values({
      state,
      county: county ?? undefined,
      rules,
      statutes,
      indianLandClassifications,
    })
    .returning();
}

export function applyRulesToTemplate(template: string, rules: RecorderRule): string {
  let result = template;

  if (rules.requireCaption && !result.includes("CAPTION:")) {
    result = "CAPTION: [DOCUMENT CAPTION]\n\n" + result;
  }

  if (rules.additionalNotes) {
    result += `\n\nRECORDER NOTE: ${rules.additionalNotes}`;
  }

  return result;
}
