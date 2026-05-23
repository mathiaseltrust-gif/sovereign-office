import fs from "node:fs";
import path from "node:path";
import pg from "pg";

const { Client } = pg;

const file = process.argv[2];
if (!file) throw new Error("GEDCOM file path required");
if (!file.includes("private_import")) throw new Error("Refusing to read outside private_import");

const text = fs.readFileSync(path.resolve(file), "utf8");
const lines = text.split(/\r?\n/);

const families: Array<{ husband?: string; wife?: string; children: string[] }> = [];
let current: { husband?: string; wife?: string; children: string[] } | null = null;

for (const line of lines) {
  if (/^0 @.*@ FAM/.test(line)) {
    if (current) families.push(current);
    current = { children: [] };
    continue;
  }

  if (!current) continue;

  const husb = line.match(/^1 HUSB @(.+)@/);
  if (husb) current.husband = `@${husb[1]}@`;

  const wife = line.match(/^1 WIFE @(.+)@/);
  if (wife) current.wife = `@${wife[1]}@`;

  const child = line.match(/^1 CHIL @(.+)@/);
  if (child) current.children.push(`@${child[1]}@`);
}

if (current) families.push(current);

const client = new Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

let inserted = 0;

for (const fam of families) {
  for (const childGedcomId of fam.children) {
    if (fam.husband) {
      const res = await client.query(
        `
        INSERT INTO ancestor_relationships (
          ancestor_id,
          related_ancestor_id,
          relationship_type,
          source
        )
        SELECT child.id, parent.id, 'father', 'gedcom_fam'
        FROM ancestors child
        JOIN ancestors parent ON parent.gedcom_id = $1
        WHERE child.gedcom_id = $2
        `,
        [fam.husband, childGedcomId]
      );
      inserted += res.rowCount ?? 0;
    }

    if (fam.wife) {
      const res = await client.query(
        `
        INSERT INTO ancestor_relationships (
          ancestor_id,
          related_ancestor_id,
          relationship_type,
          source
        )
        SELECT child.id, parent.id, 'mother', 'gedcom_fam'
        FROM ancestors child
        JOIN ancestors parent ON parent.gedcom_id = $1
        WHERE child.gedcom_id = $2
        `,
        [fam.wife, childGedcomId]
      );
      inserted += res.rowCount ?? 0;
    }
  }
}

await client.end();

console.log(JSON.stringify({
  status: "ok",
  familiesParsed: families.length,
  relationshipsInserted: inserted
}, null, 2));