import { pgTable, serial, integer, text, jsonb, varchar, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";

export const sovereignPipelineTable = pgTable("sovereign_pipeline_records", {
  id: serial("id").primaryKey(),
  fileNumber: varchar("file_number", { length: 32 }).notNull().unique(),
  submittedBy: integer("submitted_by"),
  inputText: text("input_text").notNull(),
  matterType: varchar("matter_type", { length: 64 }).notNull().default("general"),
  riskLevel: varchar("risk_level", { length: 32 }).notNull().default("low"),
  intakeResult: jsonb("intake_result"),
  doctrineOverlay: jsonb("doctrine_overlay"),
  analystApproved: boolean("analyst_approved"),
  analystNotes: text("analyst_notes"),
  templateKey: varchar("template_key", { length: 64 }),
  templateTitle: varchar("template_title", { length: 255 }),
  generatedSummary: text("generated_summary"),
  status: varchar("status", { length: 32 }).notNull().default("intake"),
  printCount: integer("print_count").notNull().default(0),
  lastPrintedAt: timestamp("last_printed_at"),
  sealApplied: boolean("seal_applied").notNull().default(false),
  printLog: jsonb("print_log").notNull().default([]),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertSovereignPipelineSchema = createInsertSchema(sovereignPipelineTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type SovereignPipelineRecord = typeof sovereignPipelineTable.$inferSelect;
export type InsertSovereignPipelineRecord = typeof sovereignPipelineTable.$inferInsert;
