import fs from "node:fs";
import path from "node:path";
import pg from "pg";
import { parseGedcom, resolveRelationships } from "../artifacts/api-server/src/lib/gedcom-parser";

const { Client } = pg;

const file = process.argv[2];
const batchId = Number(process.env.GEDCOM_BATCH_ID || 1);

if (!file) throw new Error("GEDCOM file path required");

if (!file.includes("private_import")) {
  throw new Error("Refusing to read outside private_import");
}

const client = new Client({
  connectionString: process.env.DATABASE_URL,
});

const parsed = parseGedcom(
  fs.readFileSync(path.resolve(file))
);

const relationships = resolveRelationships(parsed);

await client.connect();

let count = 0;

for (const indi of parsed.individuals) {
  const rel = relationships.get(indi.gedcomId);

  await client.query(
    `insert into gedcom_staging (
      batch_id,
      gedcom_id,
      full_name,
      given_name,
      surname,
      birth_date,
      birth_year,
      birth_place,
      death_date,
      death_year,
      death_place,
      gender,
      father_gedcom_id,
      mother_gedcom_id,
      spouse_gedcom_ids,
      children_gedcom_ids,
      census_labels,
      source_records,
      notes,
      confidence_score,
      match_type,
      status,
      life_events,
      media_refs
    ) values (
      $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,
      $11,$12,$13,$14,
      $15::jsonb,
      $16::jsonb,
      $17::jsonb,
      $18::jsonb,
      $19,$20,$21,$22,
      $23::jsonb,
      $24::jsonb
    )`,
    [
      batchId,
      indi.gedcomId,
      indi.fullName || "Unknown",
      indi.givenName || null,
      indi.surname || null,
      indi.birthDate || null,
      indi.birthYear || null,
      indi.birthPlace || null,
      indi.deathDate || null,
      indi.deathYear || null,
      indi.deathPlace || null,
      indi.gender || null,
      rel?.fatherId || null,
      rel?.motherId || null,
      JSON.stringify(rel?.spouseIds || []),
      JSON.stringify(rel?.childrenIds || []),
      JSON.stringify(indi.censusLabels || []),
      JSON.stringify(indi.sources || []),
      indi.notes?.join("\n") || null,
      1,
      "new",
      "pending",
      JSON.stringify(indi.lifeEvents || []),
      JSON.stringify(indi.mediaRefs || []),
    ]
  );

  count++;
}

await client.end();

console.log(
  JSON.stringify(
    {
      status: "ok",
      batchId,
      stagedRows: count,
      individualsParsed: parsed.individuals.length,
      familiesParsed: parsed.families.length,
      parseErrors: parsed.errors.length,
    },
    null,
    2
  )
);
