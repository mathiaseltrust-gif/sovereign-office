import { db } from "@workspace/db";
import { notificationsTable, usersTable, profilesTable } from "@workspace/db";
import type { InsertNotification } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { logger } from "../lib/logger";
import { sendNotificationEmail } from "../services/mailer";

export type NotificationCategory =
  | "family_governance"
  | "welfare_update"
  | "trust_instrument"
  | "recorder_filing"
  | "court_hearing"
  | "tribal_announcement"
  | "tro_alert"
  | "red_flag_alert"
  | "task_assigned"
  | "complaint_update"
  | "direct_message"
  | "enrollment_granted"
  | "lineage_review"
  | "lineage_approved"
  | "lineage_rejected";

export type NotificationSeverity = "info" | "warning" | "critical" | "emergency";

export interface NotificationInput {
  userId?: number;
  channel?: string;
  category: NotificationCategory;
  title: string;
  message: string;
  severity?: NotificationSeverity;
  relatedId?: number;
  relatedType?: string;
  redFlag?: boolean;
  troFlag?: boolean;
  metadata?: Record<string, unknown>;
}

async function getUserEmailPreference(userId: number): Promise<{ email: string; name: string; emailOptIn: boolean } | null> {
  try {
    const [row] = await db
      .select({
        email: usersTable.email,
        name: usersTable.name,
        notificationPreferences: profilesTable.notificationPreferences,
      })
      .from(usersTable)
      .leftJoin(profilesTable, eq(profilesTable.userId, usersTable.id))
      .where(eq(usersTable.id, userId))
      .limit(1);
    if (!row) return null;
    const prefs = (row.notificationPreferences ?? {}) as Record<string, unknown>;
    const emailOptIn = typeof prefs.email === "boolean" ? prefs.email : false;
    return { email: row.email, name: row.name, emailOptIn };
  } catch (err) {
    logger.error({ err, userId }, "Failed to fetch user email preferences");
    return null;
  }
}

export async function createNotification(input: NotificationInput): Promise<typeof notificationsTable.$inferSelect | null> {
  try {
    const record: InsertNotification = {
      userId: input.userId ?? null,
      channel: input.channel ?? "dashboard",
      category: input.category,
      title: input.title,
      message: input.message,
      severity: input.severity ?? "info",
      relatedId: input.relatedId ?? undefined,
      relatedType: input.relatedType ?? undefined,
      redFlag: input.redFlag ?? false,
      troFlag: input.troFlag ?? false,
      read: false,
      metadata: input.metadata ?? {},
    };
    const [inserted] = await db.insert(notificationsTable).values(record).returning();
    logger.info({ category: input.category, severity: input.severity, redFlag: input.redFlag }, "Notification created");

    // Email delivery — wrapped so failures never interrupt the notification write
    try {
      if (input.userId != null) {
        const userInfo = await getUserEmailPreference(input.userId);
        if (userInfo?.emailOptIn) {
          await sendNotificationEmail({
            to: userInfo.email,
            name: userInfo.name,
            category: input.category,
            severity: input.severity,
            title: input.title,
            message: input.message,
            metadata: input.metadata,
          });
        }
      } else {
        // Broadcast: DB-side filter for opted-in users, concurrent sends
        const optedInUsers = await db
          .select({ id: usersTable.id, email: usersTable.email, name: usersTable.name })
          .from(usersTable)
          .innerJoin(profilesTable, eq(profilesTable.userId, usersTable.id))
          .where(sql`${profilesTable.notificationPreferences}->>'email' = 'true'`);

        await Promise.all(
          optedInUsers.map((u) =>
            sendNotificationEmail({
              to: u.email,
              name: u.name,
              category: input.category,
              severity: input.severity,
              title: input.title,
              message: input.message,
              metadata: input.metadata,
            }),
          ),
        );
      }
    } catch (emailErr) {
      logger.error({ emailErr }, "Email delivery error — notification was saved but email was not sent");
    }

    return inserted ?? null;
  } catch (err) {
    logger.error({ err }, "Failed to create notification");
    return null;
  }
}

export async function createBroadcastNotification(input: Omit<NotificationInput, "userId">): Promise<void> {
  await createNotification({ ...input, userId: undefined });
}

export async function notifyWelfareGenerated(opts: {
  userId?: number;
  instrumentId: number;
  instrumentType: string;
  welfareAct: string;
  troSensitive: boolean;
  emergency: boolean;
}): Promise<void> {
  const isCritical = opts.troSensitive || opts.emergency;
  await createNotification({
    userId: opts.userId,
    category: "welfare_update",
    title: isCritical
      ? `🚨 ${opts.emergency ? "EMERGENCY" : "TRO-SENSITIVE"} Welfare Instrument Generated`
      : "Welfare Instrument Generated",
    message: `${opts.instrumentType.replace(/_/g, " ").toUpperCase()} under ${opts.welfareAct} — ID #${opts.instrumentId}`,
    severity: opts.emergency ? "emergency" : opts.troSensitive ? "critical" : "info",
    relatedId: opts.instrumentId,
    relatedType: "welfare_instrument",
    troFlag: opts.troSensitive,
    redFlag: opts.emergency,
  });
}

export async function notifyTroGenerated(opts: {
  userId?: number;
  instrumentId: number;
  caseNumber?: string;
}): Promise<void> {
  await createNotification({
    userId: opts.userId,
    category: "tro_alert",
    title: "TRO-Supporting Declaration Generated — Immediate Action Required",
    message: `TRO declaration #${opts.instrumentId} ready${opts.caseNumber ? ` for case ${opts.caseNumber}` : ""}. Review and issue immediately.`,
    severity: "emergency",
    relatedId: opts.instrumentId,
    relatedType: "welfare_instrument",
    troFlag: true,
    redFlag: true,
  });
}

export async function notifyRedFlag(opts: {
  userId?: number;
  violations: string[];
  relatedId?: number;
  relatedType?: string;
}): Promise<void> {
  await createNotification({
    userId: opts.userId,
    category: "red_flag_alert",
    title: "RED FLAG — Indian Status / Jurisdiction Violation Detected",
    message: opts.violations.join("; "),
    severity: "critical",
    relatedId: opts.relatedId ?? undefined,
    relatedType: opts.relatedType ?? undefined,
    redFlag: true,
  });
}

export async function notifyComplaintFiled(opts: {
  complaintId: number;
  officerId?: number;
  classification: { actorType: string; landStatus: string; actionType: string };
  redFlag?: boolean;
}): Promise<void> {
  await createNotification({
    userId: opts.officerId,
    category: "complaint_update",
    title: `New Complaint #${opts.complaintId} Filed`,
    message: `Actor: ${opts.classification.actorType} · Land: ${opts.classification.landStatus} · Action: ${opts.classification.actionType}`,
    severity: opts.redFlag ? "critical" : "info",
    relatedId: opts.complaintId,
    relatedType: "complaint",
    redFlag: opts.redFlag ?? false,
  });
}

export async function notifyCalendarEvent(opts: {
  title: string;
  eventId: number;
  eventDate: Date;
  emergency?: boolean;
}): Promise<void> {
  await createBroadcastNotification({
    category: "court_hearing",
    title: opts.emergency ? `EMERGENCY EVENT: ${opts.title}` : `Calendar: ${opts.title}`,
    message: `Scheduled for ${opts.eventDate.toLocaleDateString()}`,
    severity: opts.emergency ? "emergency" : "info",
    relatedId: opts.eventId,
    relatedType: "calendar_event",
    redFlag: opts.emergency ?? false,
  });
}
