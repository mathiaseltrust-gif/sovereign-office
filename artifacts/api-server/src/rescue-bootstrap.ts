import { drizzle } from "drizzle-orm/node-postgres";
import { sql } from "drizzle-orm";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("[rescue-bootstrap] DATABASE_URL is required");
  process.exit(1);
}

const db = drizzle(databaseUrl);

const bootstrapStatements = [
  `CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    entra_id VARCHAR(255),
    email VARCHAR(255) NOT NULL UNIQUE,
    name TEXT NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'member',
    entra_required BOOLEAN NOT NULL DEFAULT false,
    trust_privileges BOOLEAN NOT NULL DEFAULT false,
    password_hash VARCHAR(255),
    password_salt VARCHAR(64),
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
  )`,
  `CREATE TABLE IF NOT EXISTS profile_vault (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL UNIQUE,
    date_of_birth TEXT,
    address TEXT,
    preferred_contact TEXT,
    contact_email TEXT,
    ssn TEXT,
    id_document_type TEXT,
    id_document_url_front TEXT,
    id_document_url_back TEXT,
    id_document_uploaded_at TIMESTAMP,
    id_jurisdiction_code TEXT,
    id_scan_requested_at TIMESTAMP,
    id_scan_requested_by INTEGER,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
  )`,
  `CREATE TABLE IF NOT EXISTS family_lineage (
    id SERIAL PRIMARY KEY,
    user_id INTEGER,
    first_name VARCHAR(200),
    last_name VARCHAR(200),
    full_name VARCHAR(400) NOT NULL,
    birth_year INTEGER,
    death_year INTEGER,
    gender VARCHAR(50),
    tribal_nation VARCHAR(255),
    tribal_enrollment_number VARCHAR(100),
    tribal_id_number VARCHAR(10),
    notes TEXT,
    parent_ids JSONB DEFAULT '[]'::jsonb,
    children_ids JSONB DEFAULT '[]'::jsonb,
    spouse_ids JSONB DEFAULT '[]'::jsonb,
    sibling_ids JSONB DEFAULT '[]'::jsonb,
    lineage_tags JSONB DEFAULT '[]'::jsonb,
    source_type VARCHAR(50) NOT NULL DEFAULT 'manual',
    generational_position INTEGER DEFAULT 0,
    is_deceased BOOLEAN DEFAULT false,
    is_ancestor BOOLEAN DEFAULT true,
    icwa_eligible BOOLEAN,
    welfare_eligible BOOLEAN,
    trust_beneficiary BOOLEAN,
    linked_profile_user_id INTEGER,
    photo_filename VARCHAR(500),
    photo_url TEXT,
    protection_level VARCHAR(50) DEFAULT 'pending',
    membership_status VARCHAR(50) DEFAULT 'pending',
    name_variants JSONB DEFAULT '[]'::jsonb,
    contact_email VARCHAR(255),
    entra_object_id VARCHAR(255),
    pending_review BOOLEAN DEFAULT false,
    added_by_member_id INTEGER,
    supporting_document_name VARCHAR(500),
    visibility VARCHAR(50) NOT NULL DEFAULT 'private',
    birth_place TEXT,
    birth_date VARCHAR(100),
    death_place TEXT,
    death_date VARCHAR(100),
    burial_place TEXT,
    location_lat DOUBLE PRECISION,
    location_lng DOUBLE PRECISION,
    location_address TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
  )`,
  `CREATE TABLE IF NOT EXISTS family_units (
    id SERIAL PRIMARY KEY,
    gedcom_fam_id VARCHAR(100),
    husband_id INTEGER,
    wife_id INTEGER,
    spouse_ids JSONB DEFAULT '[]'::jsonb,
    child_ids JSONB DEFAULT '[]'::jsonb,
    relationship_type VARCHAR(50) NOT NULL DEFAULT 'biological',
    source_type VARCHAR(50) NOT NULL DEFAULT 'manual',
    notes TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
  )`,
  `CREATE TABLE IF NOT EXISTS ancestral_records (
    id SERIAL PRIMARY KEY,
    lineage_id INTEGER NOT NULL,
    user_id INTEGER,
    record_type VARCHAR(100) NOT NULL DEFAULT 'genealogical',
    record_date VARCHAR(100),
    record_source VARCHAR(500),
    jurisdiction VARCHAR(255),
    tribal_nation VARCHAR(255),
    document_content TEXT,
    verification_status VARCHAR(50) NOT NULL DEFAULT 'unverified',
    icwa_relevant BOOLEAN DEFAULT false,
    trust_relevant BOOLEAN DEFAULT false,
    welfare_relevant BOOLEAN DEFAULT false,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
  )`,
];

for (const statement of bootstrapStatements) {
  try {
    await db.execute(sql.raw(statement));
  } catch (err) {
    console.error("[rescue-bootstrap] Failed statement:", statement);
    console.error(err);
    process.exit(1);
  }
}

console.log("[rescue-bootstrap] Core startup tables verified");
process.exit(0);
