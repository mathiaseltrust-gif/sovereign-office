import fs from "node:fs";
import path from "node:path";
import { db, gedcomImportBatchesTable, gedcomStagingTable } from "@workspace/db";
import { parseGedcom, resolveRelationships } from "../artifacts/api-server/src/lib/gedcom-parser";

function usage(): never {
  console.error("Usage: pnpm --filter @workspace/scripts import-gedcom:staging -- private_import/file.ged");
  process.exit(1);
}

function assertPrivateImportPath(inputPath: string): void {
  const normalized = path.normalize(inputPath);
  const parts = normalized.split(path.sep);
  if (!parts.includes("private_import")) {
    throw new Error("Refusing to import outside private_import/. Move the GEDCOM file under private_import/ first.");
  }
  if (!normalized.toLowerCase().endsWith(".ged") && !normalized.toLowerCase().endsWith(".gedcom") && !normalized.toLowerCase().endsWith(".zip")) {
    throw new Error("Expected a .ged, .gedcom, or .zip GEDCOM export file.");
  }
}

function asJsonArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

async function main(): Promise<void> {
  const fileArg = process.argv[2];
  if (!fileArg) usage();

  assertPrivateImportPath(fileArg);

  const fullPath = path.resolve(fileArg);
  if (!fs.existsSync(fullPath)) {
    throw new Error(`GEDCOM file not found: ${fullPath}`);
  }

  const filename = path.basename(fullPath);
  const buffer = fs.readFileSync(fullPath);
  const parsed = parseGedcom(buffer);
  const relationships = resolveRelationships(parsed);

  const batch = { id: Number(process.env.GEDCOM_BATCH_ID || 1) };
  console.log(JSON.stringify({
    status: "using-existing-batch",
    batchId: batch.id
  }, null, 2));

  const chunkSize = 1;
  let staged = 0;

  for (let i = 0; i < parsed.individuals.length; i += chunkSize) {
    const chunk = parsed.individuals.slice(i, i + chunkSize);
    const rows = chunk.map((indi) => {
      const rel = relationships.get(indi.gedcomId);
      return {
        batchId: batch.id,
        gedcomId: indi.gedcomId,
        fullName: indi.fullName || "Unknown",
        givenName: indi.givenName || null,
        surname: indi.surname || null,
        birthDate: indi.birthDate,
        birthYear: indi.birthYear,
        birthPlace: indi.birthPlace,
        deathDate: indi.deathDate,
        deathYear: indi.deathYear,
        deathPlace: indi.deathPlace,
        gender: indi.gender,
        fatherGedcomId: rel?.fatherId ?? null,
        motherGedcomId: rel?.motherId ?? null,
        spouseGedcomIds: asJsonArray(rel?.spouseIds),
        childrenGedcomIds: asJsonArray(rel?.childrenIds),
        censusLabels: indi.censusLabels ?? [],
        sourceRecords: indi.sources ?? [],
        notes: indi.notes?.join("\n") || null,
        confidenceScore: 1,
        matchType: "new",
        matchedAncestorId: null,
        matchedAncestorName: null,
        duplicateGroupId: null,
        status: "pending",
        lifeEvents: indi.lifeEvents ?? [],
        mediaRefs: indi.mediaRefs ?? [],
      };
    });

    await db.insert(gedcomStagingTable).values(rows);
    staged += rows.length;
  }

  console.log(JSON.stringify({
    status: "ok",
    mode: "local-only-staging",
    batchId: batch.id,
    filename,
    encoding: parsed.encoding,
    individualsParsed: parsed.individuals.length,
    familiesParsed: parsed.families.length,
    relationshipRecords: relationships.size,
    stagedRows: staged,
    parseErrors: parsed.errors.length,
  }, null, 2));
}

main().catch((err) => {
  console.error(JSON.stringify({
    status: "error",
    message: err instanceof Error ? err.message : String(err),
  }, null, 2));
  process.exit(1);
});
