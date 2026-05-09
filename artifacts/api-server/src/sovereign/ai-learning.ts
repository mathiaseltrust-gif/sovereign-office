import { db } from "@workspace/db";
import { aiLearningTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { logger } from "../lib/logger";

export async function learnPreference(userId: number, category: string, key: string, value: unknown): Promise<void> {
  try {
    const existing = await db
      .select()
      .from(aiLearningTable)
      .where(and(eq(aiLearningTable.userId, userId), eq(aiLearningTable.category, category), eq(aiLearningTable.key, key)))
      .limit(1);

    if (existing.length > 0) {
      await db
        .update(aiLearningTable)
        .set({ value, updatedAt: new Date() })
        .where(and(eq(aiLearningTable.userId, userId), eq(aiLearningTable.category, category), eq(aiLearningTable.key, key)));
    } else {
      await db.insert(aiLearningTable).values({ userId, category, key, value });
    }
  } catch (err) {
    logger.error({ err, userId, category, key }, "Failed to store AI learning entry");
  }
}

export async function getPreferences(userId: number, category?: string) {
  try {
    const conditions = category
      ? and(eq(aiLearningTable.userId, userId), eq(aiLearningTable.category, category))
      : eq(aiLearningTable.userId, userId);

    return await db.select().from(aiLearningTable).where(conditions);
  } catch (err) {
    logger.error({ err, userId, category }, "Failed to fetch AI preferences");
    return [];
  }
}

export async function getRecommendations(userId: number): Promise<string[]> {
  const prefs = await getPreferences(userId);
  const recommendations: string[] = [];

  const draftingPrefs = prefs.filter((p) => p.category === "drafting_style");
  if (draftingPrefs.length > 0) {
    recommendations.push("Apply your saved drafting style to new instruments");
  }

  const recorderPrefs = prefs.filter((p) => p.category === "recorder_formatting");
  if (recorderPrefs.length > 0) {
    recommendations.push("Use your preferred recorder formatting rules");
  }

  const legalPrefs = prefs.filter((p) => p.category === "legal_preferences");
  if (legalPrefs.length > 0) {
    recommendations.push("Apply your trust-land interpretation preferences");
  }

  if (recommendations.length === 0) {
    recommendations.push("Begin using the system to receive personalized recommendations");
  }

  return recommendations;
}
