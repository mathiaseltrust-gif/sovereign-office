import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("[migrate] DATABASE_URL is required");
  process.exit(1);
}

const migrationsFolder = path.resolve(__dirname, "../migrations");

console.log("[migrate] Connecting to database...");
const db = drizzle(databaseUrl);

console.log(`[migrate] Applying migrations from ${migrationsFolder}...`);
await migrate(db, { migrationsFolder });

console.log("[migrate] All migrations applied successfully.");
process.exit(0);
