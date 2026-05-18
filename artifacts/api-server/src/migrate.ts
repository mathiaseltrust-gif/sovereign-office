/**
 * Schema migration runner.
 * Runs ALTER TABLE ... ADD COLUMN IF NOT EXISTS for every column in the current
 * schema that might be missing from older production databases.
 * Safe to run repeatedly — IF NOT EXISTS makes every statement idempotent.
 */
import { drizzle } from "drizzle-orm/node-postgres";
import { sql } from "drizzle-orm";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("[migrate] DATABASE_URL is required");
  process.exit(1);
}

const db = drizzle(databaseUrl);

const migrations = [
  // family_lineage — columns added after initial deploy
  `ALTER TABLE family_lineage ADD COLUMN IF NOT EXISTS location_address TEXT`,
  `ALTER TABLE family_lineage ADD COLUMN IF NOT EXISTS tribal_id_number VARCHAR(10)`,
  `ALTER TABLE family_lineage ADD COLUMN IF NOT EXISTS photo_url TEXT`,
  `ALTER TABLE family_lineage ADD COLUMN IF NOT EXISTS entra_object_id VARCHAR(255)`,
  `ALTER TABLE family_lineage ADD COLUMN IF NOT EXISTS pending_review BOOLEAN DEFAULT false`,
  `ALTER TABLE family_lineage ADD COLUMN IF NOT EXISTS added_by_member_id INTEGER`,
  `ALTER TABLE family_lineage ADD COLUMN IF NOT EXISTS supporting_document_name VARCHAR(500)`,
  `ALTER TABLE family_lineage ADD COLUMN IF NOT EXISTS name_variants JSONB DEFAULT '[]'`,
  `ALTER TABLE family_lineage ADD COLUMN IF NOT EXISTS protection_level VARCHAR(50) DEFAULT 'pending'`,
  `ALTER TABLE family_lineage ADD COLUMN IF NOT EXISTS membership_status VARCHAR(50) DEFAULT 'pending'`,

  // users — additional profile fields
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS entra_object_id VARCHAR(255)`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS display_name VARCHAR(500)`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_photo_url TEXT`,

  // sovereign_pipeline_records — new table for the 6-engine pipeline
  `CREATE TABLE IF NOT EXISTS sovereign_pipeline_records (
    id SERIAL PRIMARY KEY,
    file_number VARCHAR(32) NOT NULL UNIQUE,
    submitted_by INTEGER,
    input_text TEXT NOT NULL,
    matter_type VARCHAR(64) NOT NULL DEFAULT 'general',
    risk_level VARCHAR(32) NOT NULL DEFAULT 'low',
    intake_result JSONB,
    doctrine_overlay JSONB,
    analyst_approved BOOLEAN,
    analyst_notes TEXT,
    template_key VARCHAR(64),
    template_title VARCHAR(255),
    generated_summary TEXT,
    status VARCHAR(32) NOT NULL DEFAULT 'intake',
    print_count INTEGER NOT NULL DEFAULT 0,
    last_printed_at TIMESTAMP,
    seal_applied BOOLEAN NOT NULL DEFAULT false,
    print_log JSONB NOT NULL DEFAULT '[]',
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
  )`,

  // direct messaging — member-to-member DMs
  `CREATE TABLE IF NOT EXISTS message_threads (
    id SERIAL PRIMARY KEY,
    participant_a_id INTEGER NOT NULL,
    participant_b_id INTEGER NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    last_message_at TIMESTAMP NOT NULL DEFAULT NOW()
  )`,
  `CREATE TABLE IF NOT EXISTS direct_messages (
    id SERIAL PRIMARY KEY,
    thread_id INTEGER NOT NULL,
    sender_id INTEGER NOT NULL,
    recipient_id INTEGER NOT NULL,
    content TEXT NOT NULL,
    read_at TIMESTAMP,
    edited_at TIMESTAMP,
    deleted_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
  )`,

  // NFR Review Engine tables — auto-created if missing
  `CREATE TABLE IF NOT EXISTS nfr_investigations (
    id SERIAL PRIMARY KEY,
    signal_type VARCHAR(80) NOT NULL,
    triggering_event_type VARCHAR(80) NOT NULL,
    triggering_event_id INTEGER,
    affected_user_id INTEGER,
    affected_parcel_id INTEGER,
    affected_instrument_id INTEGER,
    affected_matter TEXT,
    triggering_entity TEXT,
    evidence_source TEXT,
    implicated_laws JSONB DEFAULT '[]',
    protection_category VARCHAR(60),
    urgency_score INTEGER DEFAULT 5,
    recommended_review_level VARCHAR(30) DEFAULT 'TRUSTEE',
    assigned_reviewer_id INTEGER,
    status VARCHAR(30) NOT NULL DEFAULT 'open',
    internal_actions JSONB DEFAULT '[]',
    external_actions JSONB DEFAULT '[]',
    required_followthrough JSONB DEFAULT '[]',
    nfr_id INTEGER,
    summary TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
  )`,
  `CREATE TABLE IF NOT EXISTS nfr_review_signals (
    id SERIAL PRIMARY KEY,
    investigation_id INTEGER,
    user_id INTEGER,
    signal_type VARCHAR(80) NOT NULL,
    context TEXT,
    source VARCHAR(60) NOT NULL DEFAULT 'system',
    detected_at TIMESTAMP NOT NULL DEFAULT NOW(),
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
  )`,
  `CREATE TABLE IF NOT EXISTS nfr_audit_log (
    id SERIAL PRIMARY KEY,
    user_id INTEGER,
    action VARCHAR(80) NOT NULL,
    resource_type VARCHAR(60) NOT NULL,
    resource_id INTEGER,
    resource_ref VARCHAR(100),
    before_value JSONB,
    after_value JSONB,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
  )`,

  // email digest queue — stores pending digest emails for daily/weekly delivery
  `CREATE TABLE IF NOT EXISTS email_digest_queue (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    email TEXT NOT NULL,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    severity TEXT,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    metadata JSONB DEFAULT '{}',
    frequency TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    processed_at TIMESTAMP
  )`,

  // medical_notes — persisted records of generated medical notes
  `CREATE TABLE IF NOT EXISTS medical_notes (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    note_type VARCHAR(50) NOT NULL DEFAULT 'general',
    patient_name TEXT,
    for_dependent BOOLEAN NOT NULL DEFAULT false,
    dependent_name TEXT,
    protection_level VARCHAR(20) NOT NULL DEFAULT 'standard',
    note_text TEXT NOT NULL,
    meta JSONB,
    created_at TIMESTAMP DEFAULT NOW() NOT NULL
  )`,

  // Authority Directory — safe renames for existing authority_* tables to spec names
  `DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'authority_jurisdiction' AND table_schema = 'public')
      AND NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'jurisdiction_directory' AND table_schema = 'public')
    THEN ALTER TABLE authority_jurisdiction RENAME TO jurisdiction_directory; END IF;
  END $$`,
  `DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'authority_agencies' AND table_schema = 'public')
      AND NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'agency_directory' AND table_schema = 'public')
    THEN ALTER TABLE authority_agencies RENAME TO agency_directory; END IF;
  END $$`,
  `DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'authority_matter_routing' AND table_schema = 'public')
      AND NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'matter_type_routing' AND table_schema = 'public')
    THEN ALTER TABLE authority_matter_routing RENAME TO matter_type_routing; END IF;
  END $$`,
  `DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'authority_legal_map' AND table_schema = 'public')
      AND NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'legal_authority_map' AND table_schema = 'public')
    THEN ALTER TABLE authority_legal_map RENAME TO legal_authority_map; END IF;
  END $$`,
  `DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'authority_intake_extractions' AND table_schema = 'public')
      AND NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'document_intake_extractions' AND table_schema = 'public')
    THEN ALTER TABLE authority_intake_extractions RENAME TO document_intake_extractions; END IF;
  END $$`,

  // Authority Directory — jurisdiction reference table
  `CREATE TABLE IF NOT EXISTS jurisdiction_directory (
    id SERIAL PRIMARY KEY,
    country VARCHAR(10) NOT NULL DEFAULT 'US',
    state_code VARCHAR(5) NOT NULL,
    state_name TEXT NOT NULL,
    county TEXT,
    city TEXT,
    fips_code VARCHAR(10),
    tribal_land_code TEXT,
    parcel_or_apn_reference TEXT,
    tribal_land_flag BOOLEAN NOT NULL DEFAULT false,
    jurisdiction_flags TEXT[] NOT NULL DEFAULT '{}',
    last_synced_at TIMESTAMPTZ,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS jur_dir_state_idx ON jurisdiction_directory(state_code)`,
  `CREATE INDEX IF NOT EXISTS jur_dir_fips_idx ON jurisdiction_directory(fips_code)`,
  `CREATE INDEX IF NOT EXISTS jur_dir_state_county_idx ON jurisdiction_directory(state_code, county)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS jur_dir_natural_key_idx ON jurisdiction_directory(state_code, COALESCE(county,''), COALESCE(city,''))`,

  // Authority Directory — agency directory
  `CREATE TABLE IF NOT EXISTS agency_directory (
    id SERIAL PRIMARY KEY,
    agency_name TEXT NOT NULL,
    agency_type TEXT NOT NULL,
    government_level VARCHAR(30) NOT NULL,
    state_code VARCHAR(5),
    county TEXT,
    city TEXT,
    mailing_address TEXT,
    physical_address TEXT,
    parent_agency TEXT,
    oversight_agency TEXT,
    contact_email TEXT,
    phone TEXT,
    website TEXT,
    source_url TEXT,
    last_verified_date TIMESTAMPTZ,
    confidence_score REAL NOT NULL DEFAULT 0.8,
    last_synced_at TIMESTAMPTZ,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS ag_dir_state_idx ON agency_directory(state_code)`,
  `CREATE INDEX IF NOT EXISTS ag_dir_state_county_idx ON agency_directory(state_code, county)`,
  `CREATE INDEX IF NOT EXISTS ag_dir_level_idx ON agency_directory(government_level)`,
  `CREATE INDEX IF NOT EXISTS ag_dir_type_idx ON agency_directory(agency_type)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS ag_dir_natural_key_idx ON agency_directory(agency_name, government_level, COALESCE(state_code,''), COALESCE(county,''))`,

  // Authority Directory — matter type routing rules
  `CREATE TABLE IF NOT EXISTS matter_type_routing (
    id SERIAL PRIMARY KEY,
    matter_type TEXT NOT NULL UNIQUE,
    matter_label TEXT NOT NULL,
    primary_entity_type TEXT NOT NULL,
    oversight_entity_type TEXT,
    required_notice_template TEXT,
    escalation_template TEXT,
    legal_flag_group TEXT[] NOT NULL DEFAULT '{}',
    primary_recipient_note TEXT,
    oversight_recipient_note TEXT,
    escalation_path TEXT,
    tribal_law_applicable TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
  )`,

  // Authority Directory — legal authority mapping
  `CREATE TABLE IF NOT EXISTS legal_authority_map (
    id SERIAL PRIMARY KEY,
    issue_type TEXT NOT NULL,
    authority_name TEXT NOT NULL,
    federal_authority TEXT,
    state_authority TEXT,
    tribal_authority TEXT,
    cfr_reference TEXT,
    usc_reference TEXT,
    case_law_reference TEXT,
    applies_when TEXT,
    warning_or_limit TEXT,
    template_language_snippet TEXT,
    review_required BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
  )`,

  // Authority Directory — AI document intake extractions
  `CREATE TABLE IF NOT EXISTS document_intake_extractions (
    id SERIAL PRIMARY KEY,
    submitted_by_user_id INTEGER,
    raw_document_text TEXT,
    detected_entity_name TEXT,
    detected_address TEXT,
    detected_deadline TEXT,
    detected_account_or_reference_number TEXT,
    detected_matter_type TEXT,
    detected_action_type TEXT,
    detected_state TEXT,
    detected_county TEXT,
    detected_apn TEXT,
    tribal_land_flag BOOLEAN NOT NULL DEFAULT false,
    icwa_flag BOOLEAN NOT NULL DEFAULT false,
    indian_law_flag BOOLEAN NOT NULL DEFAULT false,
    trust_land_flag BOOLEAN NOT NULL DEFAULT false,
    federal_review_flag BOOLEAN NOT NULL DEFAULT false,
    legal_flags TEXT[] NOT NULL DEFAULT '{}',
    routing_recommendation JSONB DEFAULT '{}',
    suggested_pending_review BOOLEAN NOT NULL DEFAULT true,
    matched_agency_id INTEGER,
    extraction_source TEXT NOT NULL DEFAULT 'ai',
    context_hints JSONB DEFAULT '{}',
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
  )`,
];

async function runMigrations() {
  console.log("[migrate] Connecting to database...");

  for (const statement of migrations) {
    const col = statement.match(/ADD COLUMN IF NOT EXISTS (\w+)/)?.[1] ?? statement.slice(0, 60);
    try {
      await db.execute(sql.raw(statement));
      console.log(`[migrate]   ✓ ${col}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[migrate]   ⚠ ${col} skipped: ${msg}`);
    }
  }

  console.log("[migrate] All migrations applied.");
  process.exit(0);
}

runMigrations().catch((err) => {
  console.error("[migrate] Fatal:", err);
  process.exit(1);
});
