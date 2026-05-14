/**
 * Idempotent seed: McCaster / Chief Mathias El family tree
 * Runs automatically on every startup ONLY if the anchor record is missing.
 * Uses findOrCreate by (fullName, birthYear) so it never duplicates.
 */
import { drizzle } from "drizzle-orm/node-postgres";
import { eq, and, isNull } from "drizzle-orm";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("[seed] DATABASE_URL is required");
  process.exit(1);
}

const db = drizzle(databaseUrl);

// --- inline schema (avoids workspace import issues in Docker) ---
import { pgTable, serial, text, integer, boolean, jsonb, timestamp } from "drizzle-orm/pg-core";

const familyLineage = pgTable("family_lineage", {
  id: serial("id").primaryKey(),
  userId: integer("user_id"),
  firstName: text("first_name"),
  lastName: text("last_name"),
  fullName: text("full_name").notNull(),
  birthYear: integer("birth_year"),
  deathYear: integer("death_year"),
  gender: text("gender"),
  tribalNation: text("tribal_nation"),
  tribalEnrollmentNumber: text("tribal_enrollment_number"),
  notes: text("notes"),
  parentIds: jsonb("parent_ids").$type<number[]>().default([]),
  childrenIds: jsonb("children_ids").$type<number[]>().default([]),
  spouseIds: jsonb("spouse_ids").$type<number[]>().default([]),
  lineageTags: jsonb("lineage_tags").$type<string[]>().default([]),
  sourceType: text("source_type"),
  generationalPosition: integer("generational_position"),
  isDeceased: boolean("is_deceased").default(false),
  isAncestor: boolean("is_ancestor").default(false),
  icwaEligible: boolean("icwa_eligible"),
  welfareEligible: boolean("welfare_eligible"),
  trustBeneficiary: boolean("trust_beneficiary"),
  linkedProfileUserId: integer("linked_profile_user_id"),
  photoFilename: text("photo_filename"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  protectionLevel: text("protection_level"),
  membershipStatus: text("membership_status"),
  nameVariants: jsonb("name_variants").$type<string[]>().default([]),
  entraObjectId: text("entra_object_id"),
  pendingReview: boolean("pending_review").default(false),
  addedByMemberId: integer("added_by_member_id"),
  supportingDocumentName: text("supporting_document_name"),
  tribalIdNumber: text("tribal_id_number"),
  photoUrl: text("photo_url"),
});

type InsertRow = typeof familyLineage.$inferInsert;

interface PersonDef {
  key: string;
  fullName: string;
  firstName?: string;
  lastName?: string;
  gender?: "male" | "female";
  birthYear?: number;
  deathYear?: number;
  isDeceased?: boolean;
  isAncestor?: boolean;
  generationalPosition?: number;
  notes?: string;
  nameVariants?: string[];
  membershipStatus?: string;
  tribalEnrollmentNumber?: string;
  tribalIdNumber?: string;
  lineageTags?: string[];
  sourceType?: string;
  protectionLevel?: string;
  pendingReview?: boolean;
}

const PEOPLE: PersonDef[] = [
  // ─── GEN -1 — Children of Mathew Allen ─────────────────────────────────────
  {
    key: "mathew_jacob",
    fullName: "Mathew Jacob McCaster", firstName: "Mathew", lastName: "McCaster",
    gender: "male", birthYear: 2012, isDeceased: false, isAncestor: false,
    generationalPosition: -1, notes: "Relationship: child",
    membershipStatus: "pending", tribalEnrollmentNumber: "SSMEL03", tribalIdNumber: "003",
    sourceType: "member_self", protectionLevel: "pending", pendingReview: true,
  },
  {
    key: "allen_jr",
    fullName: "Allen Joseph McCaster Jr", firstName: "Allen", lastName: "McCaster",
    gender: "male", birthYear: 2019, isDeceased: false, isAncestor: false,
    generationalPosition: -1, notes: "Relationship: child",
    membershipStatus: "pending", tribalEnrollmentNumber: "SSMEL04", tribalIdNumber: "004",
    sourceType: "member_self", protectionLevel: "pending", pendingReview: true,
  },
  // ─── GEN 0 — Root / Anchor ─────────────────────────────────────────────────
  {
    key: "mathew_allen",
    fullName: "Mathew Allen McCaster", firstName: "Mathew Allen", lastName: "McCaster",
    gender: "male", birthYear: 1985, isDeceased: false, isAncestor: false,
    generationalPosition: 0, notes: "Root anchor. Alias: Chief Mathias El.",
    nameVariants: ["Chief Mathias El", "Mathias El", "Mathew Allen McCaster"],
    membershipStatus: "confirmed", tribalEnrollmentNumber: "SSMEL01", tribalIdNumber: "001",
    lineageTags: ["chief-mathias-el", "mccaster-lineage", "choctaw-bloodline"],
    sourceType: "manual", protectionLevel: "standard",
  },
  {
    key: "brenda",
    fullName: "Brenda Carolina Vasquez McCaster", firstName: "Brenda", lastName: "Vasquez McCaster",
    gender: "female", birthYear: 1986, isDeceased: false, isAncestor: true,
    generationalPosition: 0, notes: "Spouse to Mathew Allen McCaster, and mother to Mathew Jr and Allen Jr.",
    membershipStatus: "pending", tribalEnrollmentNumber: "SSMEL02", tribalIdNumber: "002",
    sourceType: "manual", protectionLevel: "pending",
  },
  {
    key: "michael_mccaster",
    fullName: "Michael McCaster",
    gender: "male", birthYear: 1983, isDeceased: false, isAncestor: true,
    generationalPosition: 0,
    membershipStatus: "pending", tribalEnrollmentNumber: "SSMEL05", tribalIdNumber: "005",
    sourceType: "manual", protectionLevel: "standard",
  },
  {
    key: "michael_dalton",
    fullName: "Michael Dalton",
    gender: "male", isDeceased: false, isAncestor: true,
    generationalPosition: 0,
    membershipStatus: "pending", tribalEnrollmentNumber: "SSMEL06", tribalIdNumber: "006",
    sourceType: "manual", protectionLevel: "standard",
  },
  // ─── GEN 1 — Parents ────────────────────────────────────────────────────────
  {
    key: "milledge_jr",
    fullName: "Milledge McCaster Jr", firstName: "Milledge", lastName: "McCaster",
    gender: "male", birthYear: 1954, deathYear: 1989, isDeceased: true, isAncestor: true,
    generationalPosition: 1, notes: "Father of Mathew-Allen McCaster.",
    membershipStatus: "confirmed",
    lineageTags: ["mccaster-lineage", "chief-mathias-el"],
    sourceType: "manual", protectionLevel: "standard",
  },
  {
    key: "pamela",
    fullName: "Pamela Denise McCaster", firstName: "Pamela", lastName: "McCaster",
    gender: "female", birthYear: 1961, isDeceased: false, isAncestor: true,
    generationalPosition: 1, notes: "Mother of Mathew-Allen McCaster.",
    nameVariants: ["Pamela D McCaster"],
    membershipStatus: "confirmed",
    lineageTags: ["mccaster-lineage", "chief-mathias-el"],
    sourceType: "manual", protectionLevel: "standard",
  },
  // ─── GEN 2 — Grandparents ───────────────────────────────────────────────────
  {
    key: "milledge_sr",
    fullName: "Milledge McCaster Sr", firstName: "Milledge", lastName: "McCaster Sr",
    gender: "male", birthYear: 1932, deathYear: 2013, isDeceased: true, isAncestor: true,
    generationalPosition: 2, notes: "Son of Ned and Charlotte; b. Bullock County, Alabama",
    membershipStatus: "pending",
    lineageTags: ["Campbell Family", "McCaster Sr Family", "Pre-1900 Ancestry"],
    sourceType: "csv", protectionLevel: "ancestor",
  },
  {
    key: "mattie_watson",
    fullName: "Mattie Beatrice Watson McCaster", firstName: "Mattie", lastName: "Watson McCaster",
    gender: "female", birthYear: 1935, deathYear: 2021, isDeceased: true, isAncestor: true,
    generationalPosition: 2, notes: "Paternal grandmother. Spouse of Milledge McCaster Sr.",
    nameVariants: ["M Watson McCaster", "Mattie Watson McCaster"],
    membershipStatus: "pending",
    lineageTags: ["McCaster Family", "Watson McCaster Family", "Pre-1900 Ancestry"],
    sourceType: "gedcom", protectionLevel: "ancestor",
  },
  {
    key: "cornella",
    fullName: "Cornella Morant Ruff", firstName: "Cornella", lastName: "Ruff",
    gender: "female", birthYear: 1940, deathYear: 2013, isDeceased: true, isAncestor: true,
    generationalPosition: 2, notes: "Maternal grandmother. Mother of Pamela Denise McCaster.",
    membershipStatus: "confirmed",
    lineageTags: ["mccaster-lineage", "chief-mathias-el"],
    sourceType: "manual", protectionLevel: "standard",
  },
  // ─── GEN 3 — Great-grandparents ─────────────────────────────────────────────
  {
    key: "ned",
    fullName: "Ned McCaster", firstName: "Ned", lastName: "McCaster",
    gender: "male", birthYear: 1876, isDeceased: true, isAncestor: true,
    generationalPosition: 3, notes: "born Mitchells Station, Alabama",
    membershipStatus: "pending",
    lineageTags: ["McCaster Family", "Watson McCaster Family", "Pre-1900 Ancestry"],
    nameVariants: ["Ned McCaster"],
    sourceType: "gedcom", protectionLevel: "ancestor",
  },
  {
    key: "charlotte",
    fullName: "Charlotte Campbell", firstName: "Charlotte", lastName: "Campbell",
    gender: "female", birthYear: 1885, deathYear: 1951, isDeceased: true, isAncestor: true,
    generationalPosition: 3, notes: "Wife of Ned McCaster; b. Montgomery, Alabama",
    membershipStatus: "pending",
    lineageTags: ["Campbell Family", "McCaster Sr Family", "Pre-1900 Ancestry"],
    sourceType: "csv", protectionLevel: "ancestor",
  },
  {
    key: "ben_watson",
    fullName: "Ben C. Watson", firstName: "Ben", lastName: "Watson",
    gender: "male", birthYear: 1900, deathYear: 1977, isDeceased: true, isAncestor: true,
    generationalPosition: 3, notes: "Great-grandfather (paternal). Father of Mattie Beatrice Watson McCaster.",
    membershipStatus: "confirmed",
    lineageTags: ["mccaster-lineage", "chief-mathias-el"],
    sourceType: "manual", protectionLevel: "standard",
  },
  {
    key: "rosa_jemison",
    fullName: "Rosa Jemison Watson", firstName: "Rosa", lastName: "Watson",
    gender: "female", birthYear: 1902, deathYear: 1968, isDeceased: true, isAncestor: true,
    generationalPosition: 3, notes: "Spouse of Ben C. Watson. Mother of Mattie Beatrice Watson McCaster.",
    nameVariants: ["Rosa Jemison"],
    membershipStatus: "confirmed",
    lineageTags: ["mccaster-lineage", "chief-mathias-el"],
    sourceType: "manual", protectionLevel: "standard",
  },
  {
    key: "richard_morant",
    fullName: "Richard Henry Morant", firstName: "Richard", lastName: "Morant",
    gender: "male", birthYear: 1918, deathYear: 1987, isDeceased: true, isAncestor: true,
    generationalPosition: 3, notes: "Maternal great-grandfather. Father of Cornella Morant Ruff.",
    membershipStatus: "confirmed",
    lineageTags: ["mccaster-lineage", "chief-mathias-el"],
    sourceType: "manual", protectionLevel: "standard",
  },
  {
    key: "johnnie_allen",
    fullName: "Johnnie Mae Allen", firstName: "Johnnie", lastName: "Allen",
    gender: "female", birthYear: 1917, deathYear: 1978, isDeceased: true, isAncestor: true,
    generationalPosition: 3, notes: "Maternal great-grandmother. Mother of Cornella Morant Ruff.",
    membershipStatus: "confirmed",
    lineageTags: ["mccaster-lineage", "chief-mathias-el"],
    sourceType: "manual", protectionLevel: "standard",
  },
  // ─── GEN 4 — 2x Great-grandparents ──────────────────────────────────────────
  {
    key: "jesse",
    fullName: "Jesse McCaster", firstName: "Jesse", lastName: "McCaster",
    gender: "male", birthYear: 1848, deathYear: 1910, isDeceased: true, isAncestor: true,
    generationalPosition: 4, notes: "Elder patriarch, Mitchell County",
    membershipStatus: "pending",
    lineageTags: ["McCaster Family", "Beatrice Watson Family", "Pre-1900 Ancestry", "Multi-Generational", "Trustee Lineage"],
    sourceType: "csv", protectionLevel: "ancestor",
  },
  {
    key: "henry_watson",
    fullName: "Henry Watson", firstName: "Henry", lastName: "Watson",
    gender: "male", birthYear: 1874, deathYear: 1940, isDeceased: true, isAncestor: true,
    generationalPosition: 4, notes: "2x great-grandfather (Watson line). Father of Ben C. Watson.",
    membershipStatus: "confirmed",
    lineageTags: ["mccaster-lineage", "chief-mathias-el"],
    sourceType: "manual", protectionLevel: "standard",
  },
  {
    key: "dorrey_watson",
    fullName: "Dorrey Watson", firstName: "Dorrey", lastName: "Watson",
    gender: "female", birthYear: 1881, deathYear: 1961, isDeceased: true, isAncestor: true,
    generationalPosition: 4, notes: "2x great-grandmother (Watson line). Mother of Ben C. Watson.",
    membershipStatus: "confirmed",
    lineageTags: ["mccaster-lineage", "chief-mathias-el"],
    sourceType: "manual", protectionLevel: "standard",
  },
  {
    key: "andrew_morant",
    fullName: "Andrew Moses Morant", firstName: "Andrew", lastName: "Morant",
    gender: "male", birthYear: 1885, deathYear: 1956, isDeceased: true, isAncestor: true,
    generationalPosition: 4, notes: "2x great-grandfather (Morant line). Father of Richard Henry Morant.",
    membershipStatus: "confirmed",
    lineageTags: ["mccaster-lineage", "chief-mathias-el"],
    sourceType: "manual", protectionLevel: "standard",
  },
  {
    key: "mary_morant",
    fullName: "Mary Catriene Degen Morant", firstName: "Mary", lastName: "Morant",
    gender: "female", birthYear: 1880, deathYear: 1943, isDeceased: true, isAncestor: true,
    generationalPosition: 4, notes: "2x great-grandmother (Morant line). Mother of Richard Henry Morant.",
    membershipStatus: "confirmed",
    lineageTags: ["mccaster-lineage", "chief-mathias-el"],
    sourceType: "manual", protectionLevel: "standard",
  },
  {
    key: "john_allen",
    fullName: "John Allen", firstName: "John", lastName: "Allen",
    gender: "male", birthYear: 1894, isDeceased: true, isAncestor: true,
    generationalPosition: 4, notes: "2x great-grandfather (Allen line). Father of Johnnie Mae Allen. Deceased before 1930.",
    membershipStatus: "confirmed",
    lineageTags: ["mccaster-lineage", "chief-mathias-el"],
    sourceType: "manual", protectionLevel: "standard",
  },
  {
    key: "rosa_allen",
    fullName: "Rosa Leach Allen", firstName: "Rosa", lastName: "Allen",
    gender: "female", birthYear: 1896, deathYear: 1983, isDeceased: true, isAncestor: true,
    generationalPosition: 4, notes: "2x great-grandmother (Allen line). Mother of Johnnie Mae Allen.",
    membershipStatus: "confirmed",
    lineageTags: ["mccaster-lineage", "chief-mathias-el"],
    sourceType: "manual", protectionLevel: "standard",
  },
  // ─── GEN 5 — Earliest recorded ──────────────────────────────────────────────
  {
    key: "charlie_jemison",
    fullName: "Charlie Jemison", firstName: "Charlie", lastName: "Jemison",
    gender: "male", birthYear: 1850, deathYear: 1917, isDeceased: true, isAncestor: true,
    generationalPosition: 5, notes: "3x great-grandfather (Jemison line). Father of Rosa Jemison Watson.",
    membershipStatus: "confirmed",
    lineageTags: ["mccaster-lineage", "chief-mathias-el"],
    sourceType: "manual", protectionLevel: "standard",
  },
  {
    key: "mattie_jemison",
    fullName: "Mattie Bryant Jemison", firstName: "Mattie", lastName: "Jemison",
    gender: "female", birthYear: 1872, deathYear: 1940, isDeceased: true, isAncestor: true,
    generationalPosition: 5, notes: "3x great-grandmother (Jemison line). Mother of Rosa Jemison Watson.",
    membershipStatus: "confirmed",
    lineageTags: ["mccaster-lineage", "chief-mathias-el"],
    sourceType: "manual", protectionLevel: "standard",
  },
];

// child-key → { parents: [parent-keys], spouses: [spouse-keys] }
const RELATIONSHIPS: Record<string, { parents?: string[]; spouses?: string[] }> = {
  mathew_allen:   { parents: ["milledge_jr", "pamela"] },
  michael_mccaster: { parents: ["milledge_jr", "pamela"] },
  mathew_jacob:   { parents: ["mathew_allen", "brenda"] },
  allen_jr:       { parents: ["mathew_allen", "brenda"] },
  milledge_jr:    { parents: ["milledge_sr", "mattie_watson"] },
  pamela:         { parents: ["cornella"] },
  milledge_sr:    { parents: ["ned", "charlotte"], spouses: ["mattie_watson"] },
  mattie_watson:  { parents: ["ben_watson", "rosa_jemison"], spouses: ["milledge_sr"] },
  cornella:       { parents: ["richard_morant", "johnnie_allen"] },
  ben_watson:     { parents: ["henry_watson", "dorrey_watson"], spouses: ["rosa_jemison"] },
  rosa_jemison:   { parents: ["charlie_jemison", "mattie_jemison"], spouses: ["ben_watson"] },
  richard_morant: { parents: ["andrew_morant", "mary_morant"] },
  johnnie_allen:  { parents: ["john_allen", "rosa_allen"] },
  ned:            { parents: ["jesse"], spouses: ["charlotte"] },
  charlotte:      { spouses: ["ned"] },
  mathew_allen_brenda_marriage: { spouses: [] }, // handled via brenda entry below
  brenda:         { spouses: ["mathew_allen"] },
};

async function findOrCreate(p: PersonDef): Promise<number> {
  const cond = p.birthYear != null
    ? and(eq(familyLineage.fullName, p.fullName), eq(familyLineage.birthYear, p.birthYear!))
    : and(eq(familyLineage.fullName, p.fullName), isNull(familyLineage.birthYear));

  const existing = await db.select({ id: familyLineage.id }).from(familyLineage).where(cond).limit(1);
  if (existing.length > 0) {
    console.log(`  ↩  Exists: ${p.fullName} (${p.birthYear ?? "?"}) → id=${existing[0].id}`);
    return existing[0].id;
  }

  const row: InsertRow = {
    fullName: p.fullName,
    firstName: p.firstName,
    lastName: p.lastName,
    gender: p.gender,
    birthYear: p.birthYear,
    deathYear: p.deathYear,
    isDeceased: p.isDeceased ?? false,
    isAncestor: p.isAncestor ?? false,
    generationalPosition: p.generationalPosition ?? 0,
    notes: p.notes,
    nameVariants: p.nameVariants ?? [],
    lineageTags: p.lineageTags ?? ["mccaster-lineage"],
    sourceType: p.sourceType ?? "manual",
    protectionLevel: p.protectionLevel ?? "standard",
    membershipStatus: p.membershipStatus ?? "pending",
    tribalEnrollmentNumber: p.tribalEnrollmentNumber,
    tribalIdNumber: p.tribalIdNumber,
    pendingReview: p.pendingReview ?? false,
    parentIds: [],
    childrenIds: [],
    spouseIds: [],
  };

  const [ins] = await db.insert(familyLineage).values(row).returning({ id: familyLineage.id });
  console.log(`  ✅ Created: ${p.fullName} (${p.birthYear ?? "?"}) → id=${ins.id}`);
  return ins.id;
}

async function main() {
  // Check if anchor already exists — if so, skip entirely
  const anchor = await db
    .select({ id: familyLineage.id })
    .from(familyLineage)
    .where(and(eq(familyLineage.fullName, "Mathew Allen McCaster"), eq(familyLineage.birthYear, 1985)))
    .limit(1);

  if (anchor.length > 0) {
    console.log(`[seed] McCaster family tree already seeded (anchor id=${anchor[0].id}). Skipping.`);
    return;
  }

  console.log("\n[seed] Seeding McCaster / Chief Mathias El family tree...\n");

  const idMap: Record<string, number> = {};
  for (const person of PEOPLE) {
    idMap[person.key] = await findOrCreate(person);
  }

  console.log("\n[seed] Wiring relationships...");

  for (const [key, rels] of Object.entries(RELATIONSHIPS)) {
    const personId = idMap[key];
    if (!personId) continue;

    const parentIds = (rels.parents ?? []).map((k) => idMap[k]).filter(Boolean);
    const spouseIds = (rels.spouses ?? []).map((k) => idMap[k]).filter(Boolean);

    const [cur] = await db
      .select({ parentIds: familyLineage.parentIds, spouseIds: familyLineage.spouseIds })
      .from(familyLineage)
      .where(eq(familyLineage.id, personId))
      .limit(1);

    const mergedParents = [...new Set([...((cur?.parentIds as number[]) ?? []), ...parentIds])];
    const mergedSpouses = [...new Set([...((cur?.spouseIds as number[]) ?? []), ...spouseIds])];

    await db
      .update(familyLineage)
      .set({ parentIds: mergedParents, spouseIds: mergedSpouses, updatedAt: new Date() })
      .where(eq(familyLineage.id, personId));

    for (const parentId of parentIds) {
      const [par] = await db
        .select({ childrenIds: familyLineage.childrenIds })
        .from(familyLineage)
        .where(eq(familyLineage.id, parentId))
        .limit(1);
      const kids = (par?.childrenIds as number[]) ?? [];
      if (!kids.includes(personId)) {
        await db
          .update(familyLineage)
          .set({ childrenIds: [...kids, personId], updatedAt: new Date() })
          .where(eq(familyLineage.id, parentId));
      }
    }

    console.log(`  ✓ ${key} (id=${personId}) parents=[${parentIds}] spouses=[${spouseIds}]`);
  }

  console.log(`\n[seed] ✅ Complete. Seeded ${PEOPLE.length} family members.`);
  process.exit(0);
}

main().catch((err) => {
  console.error("[seed] Failed:", err);
  process.exit(1);
});
