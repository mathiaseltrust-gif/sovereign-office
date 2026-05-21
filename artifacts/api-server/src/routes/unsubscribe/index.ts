import { Router } from "express";
import { db } from "@workspace/db";
import { profilesTable, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { verifyUnsubscribeToken } from "../../services/mailer";
import { logger } from "../../lib/logger";

const router = Router();

router.get("/unsubscribe", async (req, res, next) => {
  try {
    const token = req.query.token as string | undefined;

    if (!token) {
      res.status(400).send("Missing unsubscribe token.");
      return;
    }

    const email = verifyUnsubscribeToken(token);
    if (!email) {
      res.status(400).send("Invalid or tampered unsubscribe token.");
      return;
    }

    const userResults = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(eq(usersTable.email, email))
      .limit(1);

    if (!userResults[0]) {
      res.status(404).send("No account found for this unsubscribe link.");
      return;
    }

    const userId = userResults[0].id;

    const profileResults = await db
      .select({ notificationPreferences: profilesTable.notificationPreferences })
      .from(profilesTable)
      .where(eq(profilesTable.userId, userId))
      .limit(1);

    const existing = (profileResults[0]?.notificationPreferences ?? {}) as Record<string, unknown>;
    const updated = { ...existing, email: false };

    if (profileResults[0]) {
      await db
        .update(profilesTable)
        .set({ notificationPreferences: updated, updatedAt: new Date() })
        .where(eq(profilesTable.userId, userId));
    } else {
      await db
        .insert(profilesTable)
        .values({ userId, notificationPreferences: updated });
    }

    logger.info({ userId, email }, "User unsubscribed from notification emails");

    res.status(200).send(
      "You have been successfully unsubscribed from notification emails. You can re-enable them at any time from your profile settings.",
    );
  } catch (err) {
    next(err);
  }
});

export default router;
