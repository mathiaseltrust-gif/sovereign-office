import { db } from "@workspace/db";
import { calendarEventsTable } from "@workspace/db";
import { notifyCalendarEvent } from "./notification-engine";
import { logger } from "../lib/logger";

export interface CalendarEventInput {
  title: string;
  description?: string;
  date: Date;
  type: string;
  relatedId?: number;
  relatedType?: string;
  zoomLink?: string;
  attachedDocuments?: string[];
  roleVisibility?: string[];
  familyGroupVisibility?: string[];
  emergency?: boolean;
}

export async function broadcastCalendarEvent(input: CalendarEventInput): Promise<number> {
  const description = [
    input.description,
    input.zoomLink ? `Zoom: ${input.zoomLink}` : null,
    input.attachedDocuments?.length ? `Documents: ${input.attachedDocuments.join(", ")}` : null,
    input.roleVisibility?.length ? `Visible to: ${input.roleVisibility.join(", ")}` : null,
    input.familyGroupVisibility?.length ? `Family groups: ${input.familyGroupVisibility.join(", ")}` : null,
    input.emergency ? "⚠️ EMERGENCY EVENT" : null,
  ].filter(Boolean).join(" | ");

  const [created] = await db
    .insert(calendarEventsTable)
    .values({
      title: input.title,
      description: description || input.description,
      date: input.date,
      type: input.type,
      relatedId: input.relatedId,
      relatedType: input.relatedType,
    })
    .returning();

  await notifyCalendarEvent({
    title: input.title,
    eventId: created.id,
    eventDate: input.date,
    emergency: input.emergency ?? false,
  });

  logger.info({ eventId: created.id, type: input.type, emergency: input.emergency }, "Calendar event broadcast");
  return created.id;
}

export async function scheduleWelfareHearing(opts: {
  instrumentId: number;
  instrumentTitle: string;
  date: Date;
  court?: string;
  zoomLink?: string;
  emergency?: boolean;
}): Promise<number> {
  return broadcastCalendarEvent({
    title: `Welfare Hearing: ${opts.instrumentTitle}`,
    description: `Hearing for welfare instrument #${opts.instrumentId}${opts.court ? ` — ${opts.court}` : ""}`,
    date: opts.date,
    type: "welfare_hearing",
    relatedId: opts.instrumentId,
    relatedType: "welfare_instrument",
    zoomLink: opts.zoomLink,
    roleVisibility: ["trustee", "officer"],
    emergency: opts.emergency ?? false,
  });
}

export async function scheduleTroHearing(opts: {
  instrumentId: number;
  date: Date;
  caseNumber?: string;
  zoomLink?: string;
}): Promise<number> {
  return broadcastCalendarEvent({
    title: `TRO HEARING — Case ${opts.caseNumber ?? `#${opts.instrumentId}`}`,
    description: `Emergency TRO hearing for instrument #${opts.instrumentId}`,
    date: opts.date,
    type: "tro_hearing",
    relatedId: opts.instrumentId,
    relatedType: "welfare_instrument",
    zoomLink: opts.zoomLink,
    roleVisibility: ["trustee", "admin"],
    emergency: true,
  });
}

export async function scheduleNfrReview(opts: {
  nfrId: number;
  dueDate: Date;
}): Promise<number> {
  return broadcastCalendarEvent({
    title: `NFR Review Deadline — Document #${opts.nfrId}`,
    description: `NFR document #${opts.nfrId} must be reviewed before this date`,
    date: opts.dueDate,
    type: "nfr_review",
    relatedId: opts.nfrId,
    relatedType: "nfr_document",
    roleVisibility: ["trustee", "officer"],
  });
}

export async function scheduleRecorderDeadline(opts: {
  filingId: number;
  title: string;
  dueDate: Date;
}): Promise<number> {
  return broadcastCalendarEvent({
    title: `Recorder Deadline: ${opts.title}`,
    description: `Filing #${opts.filingId} recorder submission deadline`,
    date: opts.dueDate,
    type: "recorder_deadline",
    relatedId: opts.filingId,
    relatedType: "trust_filing",
    roleVisibility: ["trustee", "officer"],
  });
}

export async function scheduleFamilyMeeting(opts: {
  title: string;
  date: Date;
  description?: string;
  familyGroup?: string;
  zoomLink?: string;
}): Promise<number> {
  return broadcastCalendarEvent({
    title: opts.title,
    description: opts.description,
    date: opts.date,
    type: "family_governance",
    zoomLink: opts.zoomLink,
    familyGroupVisibility: opts.familyGroup ? [opts.familyGroup] : [],
    roleVisibility: ["member", "officer", "trustee"],
  });
}
