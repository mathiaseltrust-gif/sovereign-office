import { Router } from "express";
import { requireAuth, requireAdmin, requireRegisteredUser } from "../../auth/entra-guard";
import { generateHtmlEmail, EMAIL_PREVIEW_CATEGORIES } from "../../services/email-templates";
import type { MailerCategory } from "../../services/mailer";

const router = Router();

const VALID_CATEGORIES = EMAIL_PREVIEW_CATEGORIES;

const VALID_SEVERITIES = ["info", "warning", "critical", "emergency"] as const;

router.post(
  "/",
  requireAuth,
  requireRegisteredUser,
  requireAdmin,
  (req, res) => {
    const {
      category,
      severity,
      recipientName = "Sample Recipient",
      title = "Sample Notification Title",
      message = "This is a sample notification message body used to preview the email template design.",
    } = req.body as {
      category?: string;
      severity?: string;
      recipientName?: string;
      title?: string;
      message?: string;
    };

    if (!category || !VALID_CATEGORIES.includes(category as MailerCategory)) {
      res.status(400).json({
        error: "A valid category is required.",
        validCategories: VALID_CATEGORIES,
      });
      return;
    }

    const resolvedSeverity =
      severity && VALID_SEVERITIES.includes(severity as (typeof VALID_SEVERITIES)[number])
        ? severity
        : undefined;

    const html = generateHtmlEmail(
      category as MailerCategory,
      resolvedSeverity,
      recipientName,
      title,
      message,
    );

    res.json({ html });
  },
);

router.get("/categories", requireAuth, requireRegisteredUser, requireAdmin, (_req, res) => {
  res.json({ categories: VALID_CATEGORIES, severities: VALID_SEVERITIES });
});

export default router;
