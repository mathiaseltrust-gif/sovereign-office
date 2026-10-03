import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const migrationsDir = resolve("lib/db/migrations");
const journalPath = resolve(migrationsDir, "meta/_journal.json");

const sqlTags = readdirSync(migrationsDir)
  .filter((name) => /^\d{4}_.+\.sql$/.test(name))
  .map((name) => name.replace(/\.sql$/, ""))
  .sort();

const journal = JSON.parse(readFileSync(journalPath, "utf8"));
const journalTags = (journal.entries ?? []).map((entry) => String(entry.tag));
const journalSet = new Set(journalTags);

const missing = sqlTags.filter((tag) => !journalSet.has(tag));
const orphaned = journalTags.filter((tag) => /^\d{4}_/.test(tag) && !sqlTags.includes(tag));

const duplicateIdx = [];
const idxSeen = new Set();
for (const entry of journal.entries ?? []) {
  if (idxSeen.has(entry.idx)) duplicateIdx.push(entry.idx);
  idxSeen.add(entry.idx);
}

if (missing.length || orphaned.length || duplicateIdx.length) {
  console.error("Migration journal consistency check failed.");
  if (missing.length) console.error("SQL files missing from journal:", missing.join(", "));
  if (orphaned.length) console.error("Journal entries missing SQL files:", orphaned.join(", "));
  if (duplicateIdx.length) console.error("Duplicate journal indexes:", duplicateIdx.join(", "));
  process.exit(1);
}

console.log(`Migration journal verified: ${sqlTags.length} SQL migrations are registered.`);
