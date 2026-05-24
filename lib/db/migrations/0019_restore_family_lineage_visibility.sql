-- Migration 0019 — restore family_lineage visibility
-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 0018 added the `visibility` column with DEFAULT 'private'.
-- That caused all pre-existing records (GEDCOM imports, manually entered nodes
-- that have addedByMemberId = NULL, etc.) to become invisible to non-admin
-- users because the nodes.ts WHERE clause only surfaces records where:
--   sourceType = 'manual'  OR  addedByMemberId = currentUser  OR  visibility = 'tribal'
--
-- Since the column is brand-new, no member has yet had the opportunity to
-- intentionally mark a record 'private'. Setting all existing 'private' rows
-- to 'tribal' restores full family-tree visibility without data loss.
-- Future new records will continue to use the explicit value the member chooses.
-- ─────────────────────────────────────────────────────────────────────────────

UPDATE family_lineage
SET    visibility = 'tribal'
WHERE  visibility = 'private';
