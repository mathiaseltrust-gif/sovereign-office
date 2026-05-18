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
