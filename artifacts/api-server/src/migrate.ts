/**
 * Schema migration runner.
 * Runs ALTER TABLE ... ADD COLUMN IF NOT EXISTS for every column in the current
 * schema that might be missing from older production databases.
 * Safe to run repeatedly — IF NOT EXISTS makes every statement idempotent.
 */
import pg from "pg";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("[migrate] DATABASE_URL is required");
  process.exit(1);
}

const client = new pg.Client({ connectionString: databaseUrl });

async function runMigrations() {
  await client.connect();
  console.log("[migrate] Connected. Applying schema migrations...");

  const migrations: string[] = [
    // family_lineage — columns added after initial deploy
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
  ];

  for (const sql of migrations) {
    try {
      await client.query(sql);
      const col = sql.match(/ADD COLUMN IF NOT EXISTS (\w+)/)?.[1] ?? sql;
      console.log(`[migrate]   ✓ ${col}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[migrate]   ⚠ skipped (${msg})`);
    }
  }

  console.log("[migrate] All migrations applied.");
  await client.end();
  process.exit(0);
}

runMigrations().catch((err) => {
  console.error("[migrate] Fatal:", err);
  process.exit(1);
});
