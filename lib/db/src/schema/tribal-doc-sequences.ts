import { pgTable, varchar, integer } from "drizzle-orm/pg-core";

export const tribalDocSequencesTable = pgTable("tribal_doc_sequences", {
  docType: varchar("doc_type", { length: 50 }).primaryKey(),
  prefix: varchar("prefix", { length: 20 }).notNull(),
  lastSeq: integer("last_seq").notNull().default(0),
  year: integer("year").notNull().default(0),
});

export type TribalDocSequence = typeof tribalDocSequencesTable.$inferSelect;
