import { createNotification as engineCreateNotification } from "../sovereign/notification-engine";
import type { NotificationCategory } from "../sovereign/notification-engine";
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
  await engineCreateNotification({
    userId: opts.userId,
    category: opts.category as NotificationCategory,
    title: opts.title,
    message: opts.message,
    severity: opts.severity ?? "info",
    relatedId: opts.relatedId,
    relatedType: opts.relatedType,
    metadata: opts.metadata,
  });
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
    },
  });
}
