import { logger } from "../../lib/logger";

export type Severity = "info" | "warning" | "critical" | "emergency";

const SEVERITY_CONFIG: Record<
  Severity,
  { badgeColor: string; badgeBackground: string; badgeLabel: string; borderColor: string }
> = {
  info: {
    badgeColor: "#1D4ED8",
    badgeBackground: "#DBEAFE",
    badgeLabel: "INFO",
    borderColor: "#3B82F6",
  },
  warning: {
    badgeColor: "#92400E",
    badgeBackground: "#FEF3C7",
    badgeLabel: "WARNING",
    borderColor: "#F59E0B",
  },
  critical: {
    badgeColor: "#991B1B",
    badgeBackground: "#FEE2E2",
    badgeLabel: "CRITICAL",
    borderColor: "#EF4444",
  },
  emergency: {
    badgeColor: "#FFFFFF",
    badgeBackground: "#7F1D1D",
    badgeLabel: "EMERGENCY",
    borderColor: "#7F1D1D",
  },
};

export interface BaseTemplateOptions {
  severity: Severity;
  categoryLabel: string;
  recipientName: string;
  title: string;
  intro: string;
  bodyText: string;
  callToAction: string;
  dashboardUrl?: string;
}

let _ctaUrlWarned = false;

export function renderBaseTemplate(opts: BaseTemplateOptions): string {
  const sev = SEVERITY_CONFIG[opts.severity];
  const year = new Date().getFullYear();
  const rawCtaUrl = opts.dashboardUrl ?? process.env.DASHBOARD_URL;
  const ctaUrl = isSafeUrl(rawCtaUrl) ? rawCtaUrl : undefined;
  if (!ctaUrl && !_ctaUrlWarned) {
    _ctaUrlWarned = true;
    if (!rawCtaUrl) {
      logger.warn(
        "[email-templates] DASHBOARD_URL env var is not set — CTA button will be omitted from email notifications.",
      );
    } else {
      logger.warn(
        { url: rawCtaUrl },
        "[email-templates] DASHBOARD_URL is not a valid https URL — CTA button will be omitted from email notifications.",
      );
    }
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escHtml(opts.title)}</title>
</head>
<body style="margin:0;padding:0;background-color:#F3F4F6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background-color:#F3F4F6;padding:32px 16px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" role="presentation" style="max-width:600px;width:100%;">

          <!-- Header / Logo bar -->
          <tr>
            <td style="background-color:#1E293B;border-radius:8px 8px 0 0;padding:24px 32px;">
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                <tr>
                  <td>
                    <span style="font-size:20px;font-weight:700;color:#F8FAFC;letter-spacing:-0.5px;">Sovereign&nbsp;Office</span>
                  </td>
                  <td align="right">
                    <span style="display:inline-block;padding:4px 10px;border-radius:4px;font-size:11px;font-weight:700;letter-spacing:0.08em;background-color:${sev.badgeBackground};color:${sev.badgeColor};">${sev.badgeLabel}</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Category stripe -->
          <tr>
            <td style="background-color:${sev.borderColor};padding:4px 32px;">
              <span style="font-size:11px;font-weight:600;color:#FFFFFF;letter-spacing:0.06em;text-transform:uppercase;">${escHtml(opts.categoryLabel)}</span>
            </td>
          </tr>

          <!-- Body card -->
          <tr>
            <td style="background-color:#FFFFFF;padding:32px;border-left:4px solid ${sev.borderColor};">

              <p style="margin:0 0 8px 0;font-size:13px;color:#6B7280;">Hello ${escHtml(opts.recipientName)},</p>
              <p style="margin:0 0 24px 0;font-size:13px;color:#6B7280;">${escHtml(opts.intro)}</p>

              <!-- Title block -->
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin-bottom:20px;">
                <tr>
                  <td style="background-color:#F8FAFC;border-radius:6px;padding:16px 20px;border-left:3px solid ${sev.borderColor};">
                    <p style="margin:0;font-size:16px;font-weight:700;color:#1E293B;">${escHtml(opts.title)}</p>
                  </td>
                </tr>
              </table>

              <!-- Message body -->
              <p style="margin:0 0 28px 0;font-size:14px;line-height:1.6;color:#374151;">${formatBody(opts.bodyText)}</p>

              <!-- CTA button -->
              ${ctaUrl ? `<table cellpadding="0" cellspacing="0" role="presentation">
                <tr>
                  <td style="border-radius:6px;background-color:${sev.borderColor};">
                    <a href="${ctaUrl}" target="_blank" style="display:inline-block;padding:12px 28px;font-size:14px;font-weight:600;color:#FFFFFF;text-decoration:none;border-radius:6px;">${escHtml(opts.callToAction)}</a>
                  </td>
                </tr>
              </table>` : ""}

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color:#F8FAFC;border-radius:0 0 8px 8px;padding:20px 32px;border-top:1px solid #E5E7EB;">
              <p style="margin:0;font-size:11px;color:#9CA3AF;line-height:1.5;">
                This is an automated notification from the Sovereign Office platform. Do not reply to this email.<br />
                &copy; ${year} Sovereign Office. All rights reserved.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function isSafeUrl(url: string | undefined): url is string {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function escHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatBody(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;")
    .replace(/\n/g, "<br />");
}
