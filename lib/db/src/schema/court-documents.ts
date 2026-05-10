import { pgTable, serial, integer, text, jsonb, varchar, timestamp, boolean } from "drizzle-orm/pg-core";

export const courtDocumentsTable = pgTable("court_documents", {
  id: serial("id").primaryKey(),
  templateId: varchar("template_id", { length: 100 }).notNull(),
  templateName: varchar("template_name", { length: 255 }).notNull(),
  documentType: varchar("document_type", { length: 100 }).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  caseNumber: varchar("case_number", { length: 100 }),
  court: varchar("court", { length: 255 }),
  parties: jsonb("parties").default({}),
  caseDetails: jsonb("case_details").default({}),
  content: text("content").notNull(),
  pdfUrl: text("pdf_url"),
  status: varchar("status", { length: 50 }).notNull().default("draft"),
  troSensitive: boolean("tro_sensitive").notNull().default(false),
  emergencyOrder: boolean("emergency_order").notNull().default(false),
  intakeFlags: jsonb("intake_flags").default({}),
  doctrinesApplied: jsonb("doctrines_applied").default([]),
  lawRefs: jsonb("law_refs").default([]),
  signatureBlock: text("signature_block"),
  recorderMetadata: jsonb("recorder_metadata").default({}),
  generatedBy: integer("generated_by"),
  auditLog: jsonb("audit_log").default([]),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type CourtDocument = typeof courtDocumentsTable.$inferSelect;
