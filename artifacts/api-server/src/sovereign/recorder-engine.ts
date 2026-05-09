import { db } from "@workspace/db";
import { recorderRulesTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { logger } from "../lib/logger";

export interface RecorderRule {
  margins?: { top: number; bottom: number; left: number; right: number };
  requireCaption?: boolean;
  requireNotariziation?: boolean;
  maxPageSize?: string;
  additionalNotes?: string;
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
