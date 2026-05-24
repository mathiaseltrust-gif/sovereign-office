-- =============================================================================
-- Migration 0021: Add kinship_to_tribe to profiles
--
-- The kinship_to_tribe column was added to the profiles schema after migration
-- 0018 was written, leaving the DB and schema out of sync.
-- This caused column "kinship_to_tribe" does not exist errors on every
-- /api/identity/rights call, breaking profile loading across all dashboards.
--
-- Fully idempotent. No data dropped, truncated, or reset.
-- =============================================================================

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS kinship_to_tribe TEXT;
