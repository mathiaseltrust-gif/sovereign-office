import { createHmac, timingSafeEqual } from "crypto";
import { Resend } from "resend";
import { logger } from "../lib/logger";
import type { NotificationCategory } from "../sovereign/notification-engine";
import { generateHtmlEmail } from "./email-templates";

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const RESEND_FROM_EMAIL = process.env.RESEND_FROM_EMAIL;

const emailEnabled = Boolean(RESEND_API_KEY && RESEND_FROM_EMAIL);

if (!emailEnabled) {
  logger.warn(
    {
      missingApiKey: !RESEND_API_KEY,
      missingFromEmail: !RESEND_FROM_EMAIL,
    },
    "Email delivery is disabled. Set both RESEND_API_KEY and RESEND_FROM_EMAIL environment secrets to enable.",
  );
}

if (!process.env.SESSION_SECRET && process.env.NODE_ENV === "production") {
  logger.error(
    "SESSION_SECRET is not set in production — unsubscribe tokens will use a predictable fallback key. Set SESSION_SECRET immediately.",
  );
}

if (!process.env.APP_URL && !process.env.REPLIT_DEV_DOMAIN) {
  logger.warn(
    "APP_URL and REPLIT_DEV_DOMAIN are both unset — unsubscribe links in emails will have no base URL and will be broken. Set APP_URL to the public root of the API server.",
  );
}

const resend = emailEnabled ? new Resend(RESEND_API_KEY!) : null;

export type MailerCategory = NotificationCategory | "password_set";

const SESSION_SECRET = () => process.env.SESSION_SECRET ?? "dev-secret-change-me";

export function generateUnsubscribeToken(email: string): string {
  const payload = Buffer.from(email).toString("base64url");
  const sig = createHmac("sha256", SESSION_SECRET()).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

export function verifyUnsubscribeToken(token: string): string | null {
  try {
    const [payload, sig] = token.split(".");
    if (!payload || !sig) return null;
    const expected = createHmac("sha256", SESSION_SECRET()).update(payload).digest();
    const actual = Buffer.from(sig, "base64url");
    if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;
    return Buffer.from(payload, "base64url").toString("utf8");
  } catch {
    return null;
  }
}

function buildUnsubscribeUrl(email: string): string {
  const token = generateUnsubscribeToken(email);
  const base =
    process.env.APP_URL ??
    (process.env.REPLIT_DEV_DOMAIN ? `https://${process.env.REPLIT_DEV_DOMAIN}` : "");
  return `${base}/api/unsubscribe?token=${encodeURIComponent(token)}`;
}

function appendUnsubscribeFooter(body: string, email: string): string {
  const url = buildUnsubscribeUrl(email);
  return `${body}\n---\nTo stop receiving these emails, unsubscribe here: ${url}\n`;
}

// Extend templates with extra categories used in lineage/messaging flows

interface EmailTemplate {
  subject: (title: string) => string;
  body: (name: string, title: string, message: string, metadata?: Record<string, unknown>) => string;
}

const TEMPLATES: Record<MailerCategory, EmailTemplate> = {
  family_governance: {
    subject: (title) => `[Family Governance] ${title}`,
    body: (name, title, message) =>
      `Hello ${name},\n\nYou have a family governance notification:\n\n${title}\n\n${message}\n\nPlease log in to the dashboard to view details.\n`,
  },
  welfare_update: {
    subject: (title) => `[Welfare Update] ${title}`,
    body: (name, title, message) =>
      `Hello ${name},\n\nA welfare update requires your attention:\n\n${title}\n\n${message}\n\nPlease log in to the dashboard to view details.\n`,
  },
  trust_instrument: {
    subject: (title) => `[Trust Instrument] ${title}`,
    body: (name, title, message) =>
      `Hello ${name},\n\nA trust instrument notification has been issued:\n\n${title}\n\n${message}\n\nPlease log in to the dashboard to view details.\n`,
  },
  recorder_filing: {
    subject: (title) => `[Recorder Filing] ${title}`,
    body: (name, title, message) =>
      `Hello ${name},\n\nA recorder filing notification:\n\n${title}\n\n${message}\n\nPlease log in to the dashboard to review the filing.\n`,
  },
  court_hearing: {
    subject: (title) => `[Court / Calendar] ${title}`,
    body: (name, title, message) =>
      `Hello ${name},\n\nA court or calendar event notification:\n\n${title}\n\n${message}\n\nPlease log in to the dashboard for more information.\n`,
  },
  tribal_announcement: {
    subject: (title) => `[Tribal Announcement] ${title}`,
    body: (name, title, message) =>
      `Hello ${name},\n\nA tribal announcement has been issued:\n\n${title}\n\n${message}\n\nPlease log in to the dashboard for more information.\n`,
  },
  tro_alert: {
    subject: (title) => `[URGENT — TRO Alert] ${title}`,
    body: (name, title, message) =>
      `Hello ${name},\n\nIMPORTANT: A TRO alert requires your immediate attention:\n\n${title}\n\n${message}\n\nPlease log in to the dashboard and act immediately.\n`,
  },
  red_flag_alert: {
    subject: (title) => `[RED FLAG] ${title}`,
    body: (name, title, message) =>
      `Hello ${name},\n\nCRITICAL: A red flag alert has been raised:\n\n${title}\n\n${message}\n\nPlease log in to the dashboard immediately to address this issue.\n`,
  },
  task_assigned: {
    subject: (title) => `[Task Assigned] ${title}`,
    body: (name, title, message) =>
      `Hello ${name},\n\nA task has been assigned to you:\n\n${title}\n\n${message}\n\nPlease log in to the dashboard to view and manage your tasks.\n`,
  },
  complaint_update: {
    subject: (title) => `[Complaint Update] ${title}`,
    body: (name, title, message) =>
      `Hello ${name},\n\nA complaint notification requires your attention:\n\n${title}\n\n${message}\n\nPlease log in to the dashboard for more information.\n`,
  },
  password_set: {
    subject: (_title) => `Your account password has been set`,
    body: (name, _title, message) =>
      `Hello ${name},\n\nAn administrator has set a password for your account.\n\n${message}\n\nIf you did not request this change or believe this was done in error, please contact your administrator immediately.\n`,
  },
  direct_message: {
    subject: (title) => `[Message] ${title}`,
    body: (name, title, message) =>
      `Hello ${name},\n\nYou have a new direct message:\n\n${title}\n\n${message}\n\nPlease log in to the dashboard to read and reply.\n`,
  },
  enrollment_granted: {
    subject: (_title) => `Membership Access Granted`,
    body: (name, _title, message) =>
      `Hello ${name},\n\nYour tribal membership access has been granted.\n\n${message}\n\nPlease log in to the Sovereign Office Dashboard to get started.\n`,
  },
  lineage_review: {
    subject: (title) => `[Lineage Review Required] ${title}`,
    body: (name, title, message) =>
      `Hello ${name},\n\nA lineage claim requires your review:\n\n${title}\n\n${message}\n\nPlease log in to the dashboard to review and take action.\n`,
  },
  lineage_approved: {
    subject: (_title) => `Your Lineage Claim Has Been Approved`,
    body: (name, _title, message) =>
      `Hello ${name},\n\nGood news — your lineage claim has been reviewed and approved.\n\n${message}\n\nPlease log in to the dashboard to view your verified membership status.\n`,
  },
  lineage_rejected: {
    subject: (_title) => `Update on Your Lineage Claim`,
    body: (name, _title, message) =>
      `Hello ${name},\n\nWe have an update regarding your lineage claim.\n\n${message}\n\nPlease log in to the dashboard for more information or to contact an administrator.\n`,
  },
};

const FALLBACK_TEMPLATE: EmailTemplate = {
  subject: (title) => `[Notification] ${title}`,
  body: (name, title, message) =>
    `Hello ${name},\n\nYou have a new notification:\n\n${title}\n\n${message}\n\nPlease log in to the dashboard for more information.\n`,
};

export interface SendNotificationEmailOptions {
  to: string;
  name: string;
  category: MailerCategory;
  severity?: string;
  title: string;
  message: string;
  metadata?: Record<string, unknown>;
}

export interface SendDigestEmailOptions {
  to: string;
  name: string;
  frequency: "daily" | "weekly";
  items: Array<{ category: string; severity: string; title: string; message: string }>;
}

export async function sendDigestEmail(opts: SendDigestEmailOptions): Promise<void> {
  if (!resend) {
    logger.debug({ to: opts.to, frequency: opts.frequency }, "Digest email skipped — RESEND_API_KEY or RESEND_FROM_EMAIL not configured");
    return;
  }

  const freqLabel = opts.frequency === "weekly" ? "Weekly" : "Daily";
  const subject = `Your ${freqLabel.toLowerCase()} notification digest`;

  const lines = opts.items
    .map(
      (item, i) =>
        `${i + 1}. [${item.category.replace(/_/g, " ").toUpperCase()}] ${item.title}\n   ${item.message}`,
    )
    .join("\n\n");

  const unsubUrl = buildUnsubscribeUrl(opts.to);
  const text = `Hello ${opts.name},\n\nHere is your ${freqLabel.toLowerCase()} notification digest (${opts.items.length} item${opts.items.length === 1 ? "" : "s"}):\n\n${lines}\n\n---\nTo stop receiving these emails, unsubscribe here: ${unsubUrl}\n`;

  const result = await resend.emails.send({
    from: RESEND_FROM_EMAIL!,
    to: opts.to,
    subject,
    text,
    html: text.replace(/\n/g, "<br>").replace(/  /g, "&nbsp;&nbsp;"),
  });
  logger.info(
    { to: opts.to, frequency: opts.frequency, count: opts.items.length, id: result.data?.id },
    "Digest notification email sent",
  );
}

export async function sendNotificationEmail(opts: SendNotificationEmailOptions): Promise<void> {
  if (!resend) {
    logger.debug({ to: opts.to, category: opts.category }, "Email skipped — RESEND_API_KEY or RESEND_FROM_EMAIL not configured");
    return;
  }

  const template = TEMPLATES[opts.category] ?? FALLBACK_TEMPLATE;
  const subject = template.subject(opts.title);
  const bodyWithoutFooter = template.body(opts.name, opts.title, opts.message, opts.metadata);
  const text = appendUnsubscribeFooter(bodyWithoutFooter, opts.to);
  const html = generateHtmlEmail(opts.category, opts.severity, opts.name, opts.title, opts.message);

  try {
    const result = await resend.emails.send({
      from: RESEND_FROM_EMAIL!,
      to: opts.to,
      subject,
      text,
      html,
    });
    logger.info({ to: opts.to, category: opts.category, id: result.data?.id }, "Notification email sent");
  } catch (err) {
    logger.error({ err, to: opts.to, category: opts.category }, "Failed to send notification email");
  }
}
