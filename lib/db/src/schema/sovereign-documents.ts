import { pgTable, serial, text, varchar, jsonb, timestamp, date, boolean, integer } from "drizzle-orm/pg-core";

export const sovereignDocumentsTable = pgTable("sovereign_documents", {
  id: serial("id").primaryKey(),
  title: varchar("title", { length: 500 }).notNull(),
  documentType: varchar("document_type", { length: 100 }).notNull(),
  caseNumber: varchar("case_number", { length: 100 }),
  relatedCaseNumber: varchar("related_case_number", { length: 100 }),
  originalFilename: varchar("original_filename", { length: 500 }),
  extractedText: text("extracted_text"),
  summary: text("summary"),
  issuer: varchar("issuer", { length: 255 }),
  issuedDate: date("issued_date"),
  status: varchar("status", { length: 50 }).notNull().default("active"),
  tags: jsonb("tags").notNull().default([]),
  validatedCitations: jsonb("validated_citations").notNull().default([]),
  sduIndexed: boolean("sdu_indexed").notNull().default(false),
  uploadedBy: integer("uploaded_by"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type SovereignDocument = typeof sovereignDocumentsTable.$inferSelect;
