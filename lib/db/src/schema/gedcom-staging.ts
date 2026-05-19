import { pgTable, serial, integer, text, jsonb, varchar, boolean, timestamp, real } from "drizzle-orm/pg-core";

export const gedcomImportBatchesTable = pgTable("gedcom_import_batches", {
  id: serial("id").primaryKey(),
  filename: varchar("filename", { length: 500 }).notNull(),
  importedBy: integer("imported_by"),
  recordCount: integer("record_count").default(0),
  approvedCount: integer("approved_count").default(0),
  rejectedCount: integer("rejected_count").default(0),
  pendingCount: integer("pending_count").default(0),
  status: varchar("status", { length: 50 }).notNull().default("pending"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const gedcomStagingTable = pgTable("gedcom_staging", {
  id: serial("id").primaryKey(),
  batchId: integer("batch_id").references(() => gedcomImportBatchesTable.id, { onDelete: "cascade" }),
  gedcomId: varchar("gedcom_id", { length: 100 }),
  fullName: varchar("full_name", { length: 400 }).notNull(),
  givenName: varchar("given_name", { length: 200 }),
  surname: varchar("surname", { length: 200 }),
  birthDate: varchar("birth_date", { length: 100 }),
  birthYear: integer("birth_year"),
  birthPlace: varchar("birth_place", { length: 500 }),
  deathDate: varchar("death_date", { length: 100 }),
  deathYear: integer("death_year"),
  deathPlace: varchar("death_place", { length: 500 }),
  gender: varchar("gender", { length: 50 }),
  fatherGedcomId: varchar("father_gedcom_id", { length: 100 }),
  motherGedcomId: varchar("mother_gedcom_id", { length: 100 }),
  spouseGedcomIds: jsonb("spouse_gedcom_ids").default([]),
  childrenGedcomIds: jsonb("children_gedcom_ids").default([]),
  censusLabels: jsonb("census_labels").default([]),
  sourceRecords: jsonb("source_records").default([]),
  notes: text("notes"),
  confidenceScore: real("confidence_score").default(1.0),
  matchType: varchar("match_type", { length: 50 }).default("new"),
  matchedAncestorId: integer("matched_ancestor_id"),
  matchedAncestorName: varchar("matched_ancestor_name", { length: 400 }),
  duplicateGroupId: varchar("duplicate_group_id", { length: 100 }),
  status: varchar("status", { length: 50 }).notNull().default("pending"),
  lifeEvents: jsonb("life_events").default([]),
  mediaRefs: jsonb("media_refs").default([]),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type GedcomImportBatch = typeof gedcomImportBatchesTable.$inferSelect;
export type GedcomStaging = typeof gedcomStagingTable.$inferSelect;
