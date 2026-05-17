import { db } from "@workspace/db";
import { notificationsTable, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "./logger";

export interface NotifyOptions {
  userId: number;
  category: string;
  title: string;
  message: string;
  severity?: "info" | "warning" | "critical";
  relatedId?: number;
  relatedType?: string;
  metadata?: Record<string, unknown>;
}

export async function createNotification(opts: NotifyOptions): Promise<void> {
  try {
    await db.insert(notificationsTable).values({
      userId: opts.userId,
      channel: "dashboard",
      category: opts.category,
      title: opts.title,
      message: opts.message,
      severity: opts.severity ?? "info",
      relatedId: opts.relatedId,
      relatedType: opts.relatedType,
      metadata: opts.metadata ?? {},
    });
  } catch (err) {
    logger.warn({ err, userId: opts.userId }, "Failed to create notification");
  }
}

export async function notifyNewDirectMessage(opts: {
  senderId: number;
  senderName: string;
  recipientId: number;
  messageId: number;
  threadId: number;
  preview: string;
}): Promise<void> {
  const title = `New message from ${opts.senderName}`;
  const message = opts.preview.length > 120 ? opts.preview.slice(0, 120) + "…" : opts.preview;

  await createNotification({
    userId: opts.recipientId,
    category: "direct_message",
    title,
    message,
    severity: "info",
    relatedId: opts.messageId,
    relatedType: "direct_message",
    metadata: {
      senderId: opts.senderId,
      senderName: opts.senderName,
      threadId: opts.threadId,
      emailQueued: true,
    },
  });

  // Email stub — pick up any notification with metadata.emailQueued === true
  // in a background job or dedicated email worker. No live mailer configured yet,
  // so we log the intent so it is visible and traceable.
  try {
    const [recipient] = await db
      .select({ email: usersTable.email, name: usersTable.name })
      .from(usersTable)
      .where(eq(usersTable.id, opts.recipientId))
      .limit(1);

    if (recipient?.email) {
      logger.info(
        {
          to: recipient.email,
          subject: title,
          body: `You have a new message from ${opts.senderName}: "${message}"`,
          channel: "email_queue",
        },
        "Direct message email notification queued (no mailer configured — log only)",
      );
    }
  } catch (err) {
    logger.warn({ err }, "Could not look up recipient email for DM notification");
  }
}
