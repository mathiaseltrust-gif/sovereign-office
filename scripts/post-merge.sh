#!/bin/bash
set -e
pnpm install --frozen-lockfile

# Apply schema changes to the dev database non-interactively.
# Pipe 'n' to decline any truncation prompt drizzle-kit may raise.
echo "n" | pnpm --filter db push 2>&1 || true

# Generate a SQL migration file for any schema changes introduced by this task.
# The generated file lands in lib/db/migrations/ and is committed with the task
# so that production picks it up on the next deploy (via migrate.mjs at container
# startup).  Running generate AFTER push means the dev DB is already in sync —
# generate just captures the diff as a portable SQL file for production.
echo "Generating migration SQL for production..."
pnpm --filter db generate 2>&1 || true

# Required environment secrets for email delivery (set via Replit Secrets):
#   RESEND_API_KEY    — API key from resend.com dashboard
#   RESEND_FROM_EMAIL — Verified sender address (e.g. noreply@yourdomain.com)
# If these are absent, email delivery is silently skipped and in-app notifications still work.
