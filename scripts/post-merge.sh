#!/bin/bash
set -e
pnpm install --frozen-lockfile
pnpm --filter db push

# Required environment secrets for email delivery (set via Replit Secrets):
#   RESEND_API_KEY    — API key from resend.com dashboard
#   RESEND_FROM_EMAIL — Verified sender address (e.g. noreply@yourdomain.com)
# If these are absent, email delivery is silently skipped and in-app notifications still work.
