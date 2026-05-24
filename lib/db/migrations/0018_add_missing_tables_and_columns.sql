-- =============================================================================
-- Migration 0018: Add missing tables and columns
--
-- Fixes six data-load issues caused by schema objects that existed in the
-- Drizzle schema files but had no corresponding migration SQL:
--
--   1. profiles   — 14 columns added after migration 0000 with no migration
--   2. family_lineage — 11 columns added after migration 0000 with no migration
--   3. org_profiles   — table never created
--   4. org_documents  — table never created
--   5. medical_notes  — table never created
--
-- Every statement is fully idempotent (IF NOT EXISTS / ADD COLUMN IF NOT EXISTS).
-- No data is dropped, truncated, renamed, or reset.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. profiles — missing columns
-- -----------------------------------------------------------------------------

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS apn TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS mailing_address TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS land_status VARCHAR(50);
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS legal_description TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS has_recorded_instrument BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS signature_url TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS tribal_land_code TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS doc_numbers JSONB DEFAULT '[]'::jsonb;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS land_restriction_basis JSONB DEFAULT '[]'::jsonb;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS land_classification TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS self_executing BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS signature_consent BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS chief_statement TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS chief_statement_ref TEXT;


-- -----------------------------------------------------------------------------
-- 2. family_lineage — missing columns
-- -----------------------------------------------------------------------------

ALTER TABLE family_lineage ADD COLUMN IF NOT EXISTS photo_url TEXT;
ALTER TABLE family_lineage ADD COLUMN IF NOT EXISTS sibling_ids JSONB DEFAULT '[]'::jsonb;
ALTER TABLE family_lineage ADD COLUMN IF NOT EXISTS tribal_id_number VARCHAR(10);
ALTER TABLE family_lineage ADD COLUMN IF NOT EXISTS contact_email VARCHAR(255);
ALTER TABLE family_lineage ADD COLUMN IF NOT EXISTS visibility VARCHAR(50) NOT NULL DEFAULT 'private';
ALTER TABLE family_lineage ADD COLUMN IF NOT EXISTS birth_place TEXT;
ALTER TABLE family_lineage ADD COLUMN IF NOT EXISTS birth_date VARCHAR(100);
ALTER TABLE family_lineage ADD COLUMN IF NOT EXISTS death_place TEXT;
ALTER TABLE family_lineage ADD COLUMN IF NOT EXISTS death_date VARCHAR(100);
ALTER TABLE family_lineage ADD COLUMN IF NOT EXISTS burial_place TEXT;
ALTER TABLE family_lineage ADD COLUMN IF NOT EXISTS location_address TEXT;


-- -----------------------------------------------------------------------------
-- 3. org_profiles — create table
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS org_profiles (
  id          SERIAL PRIMARY KEY,
  org_id      VARCHAR(100) NOT NULL UNIQUE,
  ein         TEXT,
  legal_name  TEXT,
  exempt_type TEXT,
  notes       TEXT,
  updated_by  INTEGER REFERENCES users(id) ON DELETE SET NULL,
  updated_at  TIMESTAMP NOT NULL DEFAULT NOW()
);


-- -----------------------------------------------------------------------------
-- 4. org_documents — create table
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS org_documents (
  id           SERIAL PRIMARY KEY,
  org_id       VARCHAR(100) NOT NULL,
  doc_type     VARCHAR(100) NOT NULL DEFAULT 'general',
  label        TEXT NOT NULL,
  filename     TEXT NOT NULL,
  file_key     TEXT,
  description  TEXT,
  uploaded_by  INTEGER REFERENCES users(id) ON DELETE SET NULL,
  uploaded_at  TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_org_documents_org_id ON org_documents(org_id);


-- -----------------------------------------------------------------------------
-- 5. medical_notes — create table
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS medical_notes (
  id               SERIAL PRIMARY KEY,
  user_id          INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  note_type        VARCHAR(50) NOT NULL DEFAULT 'general',
  patient_name     TEXT,
  for_dependent    BOOLEAN NOT NULL DEFAULT false,
  dependent_name   TEXT,
  protection_level VARCHAR(20) NOT NULL DEFAULT 'standard',
  note_text        TEXT NOT NULL,
  meta             JSONB,
  created_at       TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_medical_notes_user_id ON medical_notes(user_id);
