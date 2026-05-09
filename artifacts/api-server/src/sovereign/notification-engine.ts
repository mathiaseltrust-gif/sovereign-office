import { db } from "@workspace/db";
import { notificationsTable } from "@workspace/db";
import type { InsertNotification } from "@workspace/db";
import { logger } from "../lib/logger";

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
  | "complaint_update";

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

export async function createNotification(input: NotificationInput): Promise<void> {
  try {
    const record: InsertNotification = {
      userId: input.userId ?? null,
      channel: input.channel ?? "dashboard",
      category: input.category,
      title: input.title,
      message: input.message,
      severity: input.severity ?? "info",
      relatedId: input.relatedId ?? null,
      relatedType: input.relatedType ?? null,
      redFlag: input.redFlag ?? false,
      troFlag: input.troFlag ?? false,
      read: false,
      metadata: input.metadata ?? {},
    };
    await db.insert(notificationsTable).values(record);
    logger.info({ category: input.category, severity: input.severity, redFlag: input.redFlag }, "Notification created");
  } catch (err) {
    logger.error({ err }, "Failed to create notification");
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
    relatedId: opts.relatedId ?? null,
    relatedType: opts.relatedType ?? null,
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
