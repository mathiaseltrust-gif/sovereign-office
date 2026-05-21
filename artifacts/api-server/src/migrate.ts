/**
 * Schema migration runner.
 *
 * Uses drizzle-orm's migrate() helper to apply every SQL file under
 * lib/db/migrations/ (copied to /app/migrations in the production image).
 * Applied migrations are tracked in a __drizzle_migrations table so the
 * runner is fully idempotent — re-running it on an already-migrated DB is safe.
 *
 * New migrations are generated automatically by `scripts/post-merge.sh`
 * via `drizzle-kit generate` whenever a task that changes the schema merges.
 * The generated .sql file is committed with that task and picked up here on
 * the next production deploy.
 *
 * Path resolution:
 *   Production container:  /app/dist/migrate.mjs  →  ../migrations  →  /app/migrations
 *   (The Dockerfile copies lib/db/migrations → /app/migrations)
 */
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import path from "path";
import { fileURLToPath } from "url";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("[migrate] DATABASE_URL is required");
  process.exit(1);
}

// Resolve migrations folder relative to this compiled file so the path works
// regardless of the working directory the process is started from.
// Production container: /app/dist/migrate.mjs → ../migrations → /app/migrations
const migrationsFolder = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../migrations",
);

console.log(`[migrate] Applying migrations from: ${migrationsFolder}`);

const db = drizzle(databaseUrl);

try {
  await migrate(db, { migrationsFolder });
  console.log("[migrate] All migrations applied successfully.");
} catch (err) {
  console.error("[migrate] Migration failed:", err);
  process.exit(1);
}

process.exit(0);
