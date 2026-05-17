import { renderBaseTemplate, type Severity } from "./base";
import type { MailerCategory } from "../mailer";

interface CategoryConfig {
  label: string;
  defaultSeverity: Severity;
  intro: string;
  callToAction: string;
}

const CATEGORY_CONFIGS: Record<MailerCategory, CategoryConfig> = {
  family_governance: {
    label: "Family Governance",
    defaultSeverity: "info",
    intro: "You have a family governance notification that requires your attention.",
    callToAction: "View in Dashboard",
  },
  welfare_update: {
    label: "Welfare Update",
    defaultSeverity: "info",
    intro: "A welfare update has been issued and requires your attention.",
    callToAction: "View Update",
  },
  trust_instrument: {
    label: "Trust Instrument",
    defaultSeverity: "info",
    intro: "A trust instrument notification has been issued.",
    callToAction: "View Trust Instrument",
  },
  recorder_filing: {
    label: "Recorder Filing",
    defaultSeverity: "info",
    intro: "A recorder filing notification has been posted.",
    callToAction: "Review Filing",
  },
  court_hearing: {
    label: "Court / Calendar",
    defaultSeverity: "info",
    intro: "A court or calendar event notification has been issued.",
    callToAction: "View Details",
  },
  tribal_announcement: {
    label: "Tribal Announcement",
    defaultSeverity: "info",
    intro: "An official tribal announcement has been issued.",
    callToAction: "Read Announcement",
  },
  tro_alert: {
    label: "TRO Alert",
    defaultSeverity: "critical",
    intro: "An urgent TRO alert has been raised and requires your immediate attention.",
    callToAction: "Act Now",
  },
  red_flag_alert: {
    label: "Red Flag Alert",
    defaultSeverity: "emergency",
    intro: "A critical red flag alert has been raised. Immediate action is required.",
    callToAction: "Respond Immediately",
  },
  task_assigned: {
    label: "Task Assigned",
    defaultSeverity: "info",
    intro: "A new task has been assigned to you.",
    callToAction: "View Task",
  },
  complaint_update: {
    label: "Complaint Update",
    defaultSeverity: "warning",
    intro: "There is an update on a complaint that requires your attention.",
    callToAction: "View Complaint",
  },
  password_set: {
    label: "Account Security",
    defaultSeverity: "warning",
    intro: "An administrator has set a password for your account.",
    callToAction: "Sign In to Your Account",
  },
  direct_message: {
    label: "Direct Message",
    defaultSeverity: "info",
    intro: "You have received a new direct message.",
    callToAction: "Read & Reply",
  },
  enrollment_granted: {
    label: "Membership",
    defaultSeverity: "info",
    intro: "Your tribal membership access has been granted. Welcome.",
    callToAction: "Get Started",
  },
  lineage_review: {
    label: "Lineage Review",
    defaultSeverity: "warning",
    intro: "A lineage claim has been submitted and is awaiting your review.",
    callToAction: "Review Claim",
  },
  lineage_approved: {
    label: "Lineage Approved",
    defaultSeverity: "info",
    intro: "Your lineage claim has been reviewed and approved.",
    callToAction: "View Your Status",
  },
  lineage_rejected: {
    label: "Lineage Claim Update",
    defaultSeverity: "warning",
    intro: "We have an update regarding your lineage claim.",
    callToAction: "View Details",
  },
};

const FALLBACK_CONFIG: CategoryConfig = {
  label: "Notification",
  defaultSeverity: "info",
  intro: "You have a new notification.",
  callToAction: "View in Dashboard",
};

export function generateHtmlEmail(
  category: MailerCategory,
  severity: string | undefined,
  recipientName: string,
  title: string,
  message: string,
): string {
  const config = CATEGORY_CONFIGS[category] ?? FALLBACK_CONFIG;
  const resolvedSeverity = isValidSeverity(severity) ? severity : config.defaultSeverity;

  return renderBaseTemplate({
    severity: resolvedSeverity,
    categoryLabel: config.label,
    recipientName,
    title,
    intro: config.intro,
    bodyText: message,
    callToAction: config.callToAction,
  });
}

function isValidSeverity(s: string | undefined): s is Severity {
  return s === "info" || s === "warning" || s === "critical" || s === "emergency";
}
