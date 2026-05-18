import { Router } from "express";
import { db } from "@workspace/db";
import { profilesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth } from "../../auth/entra-guard";
import { logger } from "../../lib/logger";

const router = Router();

const VALID_INTAKE_TYPES = [
  "identity-lineage",
  "housing-land",
  "healthcare",
  "welfare",
  "business",
] as const;
type ValidIntakeType = typeof VALID_INTAKE_TYPES[number];

type AnswerItem = { question: string; answer: string };

function isBlankAnswer(answer: string): boolean {
  return /^(no|n\/a|none|not\s+applicable|i\s+don|don't\s+have|no\s+preference|skip)/i.test(answer.trim());
}

function extractIdentityLineageFields(answers: AnswerItem[]) {
  const updates: Record<string, string> = {};

  const legalName = answers[0]?.answer?.trim();
  if (legalName) updates.legalName = legalName;

  const preferredName = answers[1]?.answer?.trim();
  if (preferredName && !isBlankAnswer(preferredName)) {
    updates.preferredName = preferredName;
  }

  const tribalAffiliation = answers[2]?.answer?.trim();
  if (tribalAffiliation) updates.tribalName = tribalAffiliation;

  return updates;
}

function extractHousingLandFields(answers: AnswerItem[]) {
  const updates: Record<string, string> = {};

  const address = answers[0]?.answer?.trim();
  if (address) updates.mailingAddress = address;

  const landStatusRaw = answers[2]?.answer?.toLowerCase() ?? "";
  if (landStatusRaw.includes("trust")) updates.landStatus = "trust";
  else if (landStatusRaw.includes("allot")) updates.landStatus = "allotment";
  else if (landStatusRaw.includes("fee simple") || landStatusRaw.includes("fee-simple")) updates.landStatus = "fee";
  else if (landStatusRaw.includes("restrict")) updates.landStatus = "restricted";

  return updates;
}

function extractProfileFields(intakeType: ValidIntakeType, answers: AnswerItem[]): Record<string, string> {
  if (intakeType === "identity-lineage") return extractIdentityLineageFields(answers);
  if (intakeType === "housing-land") return extractHousingLandFields(answers);
  return {};
}

router.post("/submit", requireAuth, async (req, res, next) => {
  try {
    const dbId = req.user?.dbId;
    if (!dbId) {
      res.status(400).json({ error: "User must be registered in the system to submit intake" });
      return;
    }

    const { intakeType: rawIntakeType, answers } = req.body as {
      intakeType?: string;
      answers?: AnswerItem[];
    };

    if (!rawIntakeType || !Array.isArray(answers) || answers.length === 0) {
      res.status(400).json({ error: "intakeType and answers are required" });
      return;
    }

    if (!(VALID_INTAKE_TYPES as readonly string[]).includes(rawIntakeType)) {
      res.status(400).json({
        error: `Invalid intakeType. Must be one of: ${VALID_INTAKE_TYPES.join(", ")}`,
      });
      return;
    }

    const intakeType = rawIntakeType as ValidIntakeType;
    const profileUpdates = extractProfileFields(intakeType, answers);

    const existing = await db
      .select()
      .from(profilesTable)
      .where(eq(profilesTable.userId, dbId))
      .limit(1);

    const existingAiPrefs = (existing[0]?.aiPreferences as Record<string, unknown>) ?? {};
    const existingHistory = Array.isArray(existingAiPrefs.intakeHistory)
      ? (existingAiPrefs.intakeHistory as unknown[])
      : [];

    const updatedAiPrefs: Record<string, unknown> = {
      ...existingAiPrefs,
      intakeHistory: [
        ...existingHistory,
        {
          intakeType,
          answers,
          completedAt: new Date().toISOString(),
        },
      ].slice(-10),
    };

    const updates: Record<string, unknown> = {
      ...profileUpdates,
      aiPreferences: updatedAiPrefs,
      updatedAt: new Date(),
    };

    let profile;
    if (existing[0]) {
      const [updated] = await db
        .update(profilesTable)
        .set(updates)
        .where(eq(profilesTable.userId, dbId))
        .returning();
      profile = updated;
    } else {
      const [created] = await db
        .insert(profilesTable)
        .values({ userId: dbId, ...updates })
        .returning();
      profile = created;
    }

    logger.info(
      { dbId, intakeType, fieldsUpdated: Object.keys(profileUpdates) },
      "Intake submitted — profile updated"
    );

    res.status(200).json({
      success: true,
      intakeType,
      profileFieldsUpdated: Object.keys(profileUpdates),
      profile: {
        legalName: profile?.legalName ?? null,
        preferredName: profile?.preferredName ?? null,
        tribalName: profile?.tribalName ?? null,
        mailingAddress: profile?.mailingAddress ?? null,
        landStatus: profile?.landStatus ?? null,
      },
    });
  } catch (err) {
    next(err);
  }
});

export default router;
