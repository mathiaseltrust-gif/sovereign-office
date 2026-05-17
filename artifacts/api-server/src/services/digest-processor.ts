import { db, pool } from "@workspace/db";
import { emailDigestQueueTable } from "@workspace/db";
import { isNull, inArray, isNotNull, eq, and, desc } from "drizzle-orm";
import { sql } from "drizzle-orm";
import { logger } from "../lib/logger";
import { sendDigestEmail } from "./mailer";

const DAILY_COOLDOWN_MS = 24 * 60 * 60 * 1000;
const WEEKLY_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;
const PROCESSOR_INTERVAL_MS = 60 * 60 * 1000;

const ADVISORY_LOCK_KEY = 1_234_567_890;

async function withAdvisoryLock(fn: () => Promise<void>): Promise<void> {
  const client = await pool.connect();
  try {
    const result = await client.query<{ pg_try_advisory_lock: boolean }>(
      "SELECT pg_try_advisory_lock($1)",
      [ADVISORY_LOCK_KEY],
    );
    const acquired = result.rows[0]?.pg_try_advisory_lock ?? false;
    if (!acquired) {
      logger.debug("Digest processor: advisory lock not acquired — another instance is running");
      return;
    }
    try {
      await fn();
    } finally {
      await client.query("SELECT pg_advisory_unlock($1)", [ADVISORY_LOCK_KEY]);
    }
  } finally {
    client.release();
  }
}

async function processDigests(): Promise<void> {
  await withAdvisoryLock(async () => {
    const now = new Date();

    const pendingItems = await db
      .select()
      .from(emailDigestQueueTable)
      .where(isNull(emailDigestQueueTable.processedAt));

    if (pendingItems.length === 0) return;

    const byUserFreq = new Map<string, typeof pendingItems>();
    for (const item of pendingItems) {
      const key = `${item.userId}:${item.frequency}`;
      if (!byUserFreq.has(key)) byUserFreq.set(key, []);
      byUserFreq.get(key)!.push(item);
    }

    for (const [key, items] of byUserFreq) {
      const [userIdStr, frequency] = key.split(":");
      const userId = Number(userIdStr);
      if (!frequency || isNaN(userId)) continue;

      const cooldown = frequency === "weekly" ? WEEKLY_COOLDOWN_MS : DAILY_COOLDOWN_MS;

      const [lastSent] = await db
        .select({ processedAt: emailDigestQueueTable.processedAt })
        .from(emailDigestQueueTable)
        .where(
          and(
            eq(emailDigestQueueTable.userId, userId),
            eq(emailDigestQueueTable.frequency, frequency),
            isNotNull(emailDigestQueueTable.processedAt),
          ),
        )
        .orderBy(desc(emailDigestQueueTable.processedAt))
        .limit(1);

      if (
        lastSent?.processedAt &&
        now.getTime() - lastSent.processedAt.getTime() < cooldown
      ) {
        continue;
      }

      const firstItem = items[0];
      if (!firstItem) continue;

      try {
        await sendDigestEmail({
          to: firstItem.email,
          name: firstItem.name,
          frequency: frequency as "daily" | "weekly",
          items: items.map((item) => ({
            category: item.category,
            severity: item.severity ?? "info",
            title: item.title,
            message: item.message,
          })),
        });

        const ids = items.map((i) => i.id);
        await db
          .update(emailDigestQueueTable)
          .set({ processedAt: now })
          .where(inArray(emailDigestQueueTable.id, ids));

        logger.info({ userId, frequency, count: ids.length }, "Digest email sent and queue items marked processed");
      } catch (err) {
        logger.error({ err, userId, frequency }, "Digest send failed — items left unprocessed for retry on next run");
      }
    }
  });
}

export function startDigestProcessor(): void {
  setTimeout(() => processDigests(), 5 * 60 * 1000);
  setInterval(() => processDigests(), PROCESSOR_INTERVAL_MS);
  logger.info("Email digest processor started — runs hourly");
}
