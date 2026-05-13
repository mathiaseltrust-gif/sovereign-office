/**
 * One-time seed: clean McCaster / Chief Mathias El lineage
 * Run from workspace root:
 *   cd lib/db && /home/runner/workspace/scripts/node_modules/.bin/tsx src/seeds/seed-mccaster.ts
 */
import { db } from "../index.js";
import { familyLineageTable } from "../schema/family-lineage.js";
import { eq, and, isNull } from "drizzle-orm";

type InsertRow = typeof familyLineageTable.$inferInsert;

interface PersonDef {
  key: string;
  fullName: string;
  firstName?: string;
  lastName?: string;
  gender?: "male" | "female";
  birthYear?: number;
  deathYear?: number;
  isDeceased?: boolean;
  generationalPosition: number;
  notes?: string;
  nameVariants?: string[];
}

const PEOPLE: PersonDef[] = [
  // GEN 0 — Root
  {
    key: "mathew",
    fullName: "Mathew-Allen McCaster",
    firstName: "Mathew-Allen", lastName: "McCaster",
    gender: "male", birthYear: 1985, isDeceased: false,
    generationalPosition: 0,
    nameVariants: ["Chief Mathias El", "Mathias El"],
    notes: "Root anchor. Alias: Chief Mathias El.",
  },
  // GEN 1 — Parents
  {
    key: "milledge_jr",
    fullName: "Milledge McCaster Jr",
    firstName: "Milledge", lastName: "McCaster",
    gender: "male", birthYear: 1954, deathYear: 1989, isDeceased: true,
    generationalPosition: 1,
    notes: "Father of Mathew-Allen McCaster.",
  },
  {
    key: "pamela",
    fullName: "Pamela Denise McCaster",
    firstName: "Pamela", lastName: "McCaster",
    gender: "female", birthYear: 1961, isDeceased: false,
    generationalPosition: 1,
    nameVariants: ["Pamela D McCaster"],
    notes: "Mother of Mathew-Allen McCaster.",
  },
  // GEN 2 — Paternal grandparents
  {
    key: "milledge_sr",
    fullName: "Milledge McCaster Sr",
    firstName: "Milledge", lastName: "McCaster",
    gender: "male", birthYear: 1932, deathYear: 2013, isDeceased: true,
    generationalPosition: 2,
    notes: "Paternal grandfather.",
  },
  {
    key: "mattie_watson",
    fullName: "Mattie Beatrice Watson McCaster",
    firstName: "Mattie", lastName: "McCaster",
    gender: "female", birthYear: 1935, deathYear: 2021, isDeceased: true,
    generationalPosition: 2,
    nameVariants: ["M Watson McCaster", "Mattie Watson McCaster"],
    notes: "Paternal grandmother. Spouse of Milledge McCaster Sr.",
  },
  // GEN 2 — Maternal grandmother
  {
    key: "cornella",
    fullName: "Cornella Morant Ruff",
    firstName: "Cornella", lastName: "Ruff",
    gender: "female", birthYear: 1940, deathYear: 2013, isDeceased: true,
    generationalPosition: 2,
    notes: "Maternal grandmother. Mother of Pamela Denise McCaster.",
  },
  // GEN 3 — Paternal great-grandparents
  {
    key: "ned",
    fullName: "Ned McCaster",
    firstName: "Ned", lastName: "McCaster",
    gender: "male", birthYear: 1876, deathYear: 1943, isDeceased: true,
    generationalPosition: 3,
    notes: "Great-grandfather (paternal). Birth year approximate c.1876.",
  },
  {
    key: "ben_watson",
    fullName: "Ben C. Watson",
    firstName: "Ben", lastName: "Watson",
    gender: "male", birthYear: 1900, deathYear: 1977, isDeceased: true,
    generationalPosition: 3,
    notes: "Great-grandfather (paternal). Father of Mattie Beatrice Watson McCaster.",
  },
  {
    key: "rosa_jemison",
    fullName: "Rosa Jemison Watson",
    firstName: "Rosa", lastName: "Watson",
    gender: "female", birthYear: 1902, deathYear: 1968, isDeceased: true,
    generationalPosition: 3,
    nameVariants: ["Rosa Jemison"],
    notes: "Spouse of Ben C. Watson. Mother of Mattie Beatrice Watson McCaster.",
  },
  // GEN 3 — Maternal great-grandparents
  {
    key: "richard_morant",
    fullName: "Richard Henry Morant",
    firstName: "Richard", lastName: "Morant",
    gender: "male", birthYear: 1918, deathYear: 1987, isDeceased: true,
    generationalPosition: 3,
    notes: "Maternal great-grandfather. Father of Cornella Morant Ruff.",
  },
  {
    key: "johnnie_allen",
    fullName: "Johnnie Mae Allen",
    firstName: "Johnnie", lastName: "Allen",
    gender: "female", birthYear: 1917, deathYear: 1978, isDeceased: true,
    generationalPosition: 3,
    notes: "Maternal great-grandmother. Mother of Cornella Morant Ruff.",
  },
  // GEN 4 — Watson line
  {
    key: "henry_watson",
    fullName: "Henry Watson",
    firstName: "Henry", lastName: "Watson",
    gender: "male", birthYear: 1874, deathYear: 1940, isDeceased: true,
    generationalPosition: 4,
    notes: "2x great-grandfather (Watson line). Father of Ben C. Watson.",
  },
  {
    key: "dorrey_watson",
    fullName: "Dorrey Watson",
    firstName: "Dorrey", lastName: "Watson",
    gender: "female", birthYear: 1881, deathYear: 1961, isDeceased: true,
    generationalPosition: 4,
    notes: "2x great-grandmother (Watson line). Mother of Ben C. Watson.",
  },
  // GEN 4 — Morant line
  {
    key: "andrew_morant",
    fullName: "Andrew Moses Morant",
    firstName: "Andrew", lastName: "Morant",
    gender: "male", birthYear: 1885, deathYear: 1956, isDeceased: true,
    generationalPosition: 4,
    notes: "2x great-grandfather (Morant line). Father of Richard Henry Morant.",
  },
  {
    key: "mary_morant",
    fullName: "Mary Catriene Degen Morant",
    firstName: "Mary", lastName: "Morant",
    gender: "female", birthYear: 1880, deathYear: 1943, isDeceased: true,
    generationalPosition: 4,
    notes: "2x great-grandmother (Morant line). Mother of Richard Henry Morant.",
  },
  // GEN 4 — Allen line
  {
    key: "john_allen",
    fullName: "John Allen",
    firstName: "John", lastName: "Allen",
    gender: "male", birthYear: 1894, isDeceased: true,
    generationalPosition: 4,
    notes: "2x great-grandfather (Allen line). Father of Johnnie Mae Allen. Deceased before 1930.",
  },
  {
    key: "rosa_allen",
    fullName: "Rosa Leach Allen",
    firstName: "Rosa", lastName: "Allen",
    gender: "female", birthYear: 1896, deathYear: 1983, isDeceased: true,
    generationalPosition: 4,
    notes: "2x great-grandmother (Allen line). Mother of Johnnie Mae Allen.",
  },
  // GEN 5 — Jemison line (earliest recorded)
  {
    key: "charlie_jemison",
    fullName: "Charlie Jemison",
    firstName: "Charlie", lastName: "Jemison",
    gender: "male", birthYear: 1850, deathYear: 1917, isDeceased: true,
    generationalPosition: 5,
    notes: "3x great-grandfather (Jemison line). Father of Rosa Jemison Watson.",
  },
  {
    key: "mattie_jemison",
    fullName: "Mattie Bryant Jemison",
    firstName: "Mattie", lastName: "Jemison",
    gender: "female", birthYear: 1872, deathYear: 1940, isDeceased: true,
    generationalPosition: 5,
    notes: "3x great-grandmother (Jemison line). Mother of Rosa Jemison Watson.",
  },
];

// child → { parents, spouses }
const RELATIONSHIPS: Record<string, { parents?: string[]; spouses?: string[] }> = {
  mathew:         { parents: ["milledge_jr", "pamela"] },
  milledge_jr:    { parents: ["milledge_sr", "mattie_watson"] },
  pamela:         { parents: ["cornella"] },
  milledge_sr:    { parents: ["ned"], spouses: ["mattie_watson"] },
  mattie_watson:  { parents: ["ben_watson", "rosa_jemison"], spouses: ["milledge_sr"] },
  cornella:       { parents: ["richard_morant", "johnnie_allen"] },
  ben_watson:     { parents: ["henry_watson", "dorrey_watson"], spouses: ["rosa_jemison"] },
  rosa_jemison:   { parents: ["charlie_jemison", "mattie_jemison"], spouses: ["ben_watson"] },
  richard_morant: { parents: ["andrew_morant", "mary_morant"] },
  johnnie_allen:  { parents: ["john_allen", "rosa_allen"] },
};

async function findOrCreate(p: PersonDef): Promise<number> {
  const conditions = p.birthYear
    ? and(eq(familyLineageTable.fullName, p.fullName), eq(familyLineageTable.birthYear, p.birthYear))
    : and(eq(familyLineageTable.fullName, p.fullName), isNull(familyLineageTable.birthYear));

  const existing = await db.select({ id: familyLineageTable.id })
    .from(familyLineageTable).where(conditions).limit(1);

  if (existing.length > 0) {
    console.log(`  ↩  Exists: ${p.fullName} (${p.birthYear ?? "?"}) → id=${existing[0].id}`);
    return existing[0].id;
  }

  const row: InsertRow = {
    fullName: p.fullName, firstName: p.firstName, lastName: p.lastName,
    gender: p.gender, birthYear: p.birthYear, deathYear: p.deathYear,
    isDeceased: p.isDeceased ?? false,
    isAncestor: p.key !== "mathew",
    generationalPosition: p.generationalPosition,
    notes: p.notes, nameVariants: p.nameVariants ?? [],
    sourceType: "manual", protectionLevel: "standard",
    membershipStatus: "confirmed",
    lineageTags: ["mccaster-lineage", "chief-mathias-el"],
    parentIds: [], childrenIds: [], spouseIds: [],
  };

  const [ins] = await db.insert(familyLineageTable).values(row).returning({ id: familyLineageTable.id });
  console.log(`  ✅ Created: ${p.fullName} (${p.birthYear ?? "?"}) → id=${ins.id}`);
  return ins.id;
}

async function main() {
  console.log("\n🌳 Seeding McCaster / Chief Mathias El lineage…\n");

  const idMap: Record<string, number> = {};
  for (const person of PEOPLE) {
    idMap[person.key] = await findOrCreate(person);
  }

  console.log("\n🔗 Wiring relationships…");

  for (const [key, rels] of Object.entries(RELATIONSHIPS)) {
    const personId = idMap[key];
    const parentIds = (rels.parents ?? []).map(k => idMap[k]).filter(Boolean);
    const spouseIds = (rels.spouses ?? []).map(k => idMap[k]).filter(Boolean);

    const [cur] = await db.select({ parentIds: familyLineageTable.parentIds, spouseIds: familyLineageTable.spouseIds })
      .from(familyLineageTable).where(eq(familyLineageTable.id, personId)).limit(1);

    const mergedParents = [...new Set([...((cur?.parentIds as number[]) ?? []), ...parentIds])];
    const mergedSpouses = [...new Set([...((cur?.spouseIds as number[]) ?? []), ...spouseIds])];

    await db.update(familyLineageTable).set({ parentIds: mergedParents, spouseIds: mergedSpouses, updatedAt: new Date() })
      .where(eq(familyLineageTable.id, personId));

    for (const parentId of parentIds) {
      const [par] = await db.select({ childrenIds: familyLineageTable.childrenIds })
        .from(familyLineageTable).where(eq(familyLineageTable.id, parentId)).limit(1);
      const kids = (par?.childrenIds as number[]) ?? [];
      if (!kids.includes(personId)) {
        await db.update(familyLineageTable).set({ childrenIds: [...kids, personId], updatedAt: new Date() })
          .where(eq(familyLineageTable.id, parentId));
      }
    }
    console.log(`  ✓ ${key} (id=${personId}) parents=[${parentIds}] spouses=[${spouseIds}]`);
  }

  console.log("\n✅ Seed complete. Total people:", PEOPLE.length);
  console.log("ID map:", JSON.stringify(idMap, null, 2));
  process.exit(0);
}

main().catch(err => { console.error("Seed failed:", err); process.exit(1); });
