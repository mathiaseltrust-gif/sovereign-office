import { pgTable, serial, text, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";

export const welfareInstrumentsTable = pgTable("welfare_instruments", {
  id: serial("id").primaryKey(),
  welfareAct: text("welfare_act").notNull(),
  instrumentType: text("instrument_type").notNull(),
  status: text("status").notNull().default("draft"),
  troSensitive: boolean("tro_sensitive").notNull().default(false),
  emergencyOrder: boolean("emergency_order").notNull().default(false),
  caseDetails: jsonb("case_details").$type<Record<string, string>>(),
  childInfo: jsonb("child_info").$type<Record<string, string>>(),
  parties: jsonb("parties").$type<Record<string, string>>(),
  landStatus: jsonb("land_status").$type<Record<string, string>>(),
  requestedRelief: jsonb("requested_relief").$type<string[]>(),
  doctrineContext: jsonb("doctrine_context").$type<string[]>(),
  doctrinesApplied: jsonb("doctrines_applied").$type<string[]>(),
  content: text("content"),
  pdfUrl: text("pdf_url"),
  generatedBy: text("generated_by"),
  issuedBy: text("issued_by"),
  auditLog: jsonb("audit_log").$type<Array<{ ts: string; action: string; userId: string; detail?: string }>>(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
