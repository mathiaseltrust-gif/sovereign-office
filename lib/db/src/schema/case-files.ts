import { pgTable, serial, integer, text, varchar, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * Case Files — central case registry
 *
 * Every document or matter produced by the system (NFR, court order, sovereign
 * pipeline record, trust filing, protective order, authority intake) gets a
 * corresponding row here. The caseNumber is an auto-generated tribal sequence
 * ref (e.g. NFR-2026-0001, COURT-2026-0003, FED-2026-0001) that uniquely
 * identifies the matter across the entire platform.
 *
 * Jurisdiction types drive the prefix:
 *   federal  → FED-{YEAR}-{SEQ}
 *   state    → STATE-{YEAR}-{SEQ}
 *   private  → CIV-{YEAR}-{SEQ}
 *   court    → COURT-{YEAR}-{SEQ}
 *   nfr      → NFR-{YEAR}-{SEQ}
 *   trust    → INST-{YEAR}-{SEQ} / FILING-{YEAR}-{SEQ}
 *   icwa     → ICWA-{YEAR}-{SEQ}
 *   sovereign → SOV-{YEAR}-{SEQ}
 *   intake   → INT-{YEAR}-{SEQ}
 *   general  → CASE-{YEAR}-{SEQ}
 */
export const caseFilesTable = pgTable("case_files", {
  id:                   serial("id").primaryKey(),
  caseNumber:           varchar("case_number", { length: 60 }).notNull().unique(),
  caseType:             varchar("case_type", { length: 40 }).notNull().default("general"),
  jurisdictionLevel:    varchar("jurisdiction_level", { length: 20 }).notNull().default("federal"),
  matterType:           varchar("matter_type", { length: 80 }),
  title:                text("title").notNull(),
  status:               varchar("status", { length: 30 }).notNull().default("open"),
  linkedDocumentType:   varchar("linked_document_type", { length: 60 }),
  linkedDocumentId:     integer("linked_document_id"),
  linkedDocumentRef:    varchar("linked_document_ref", { length: 60 }),
  assignedOfficerId:    integer("assigned_officer_id"),
  openedAt:             timestamp("opened_at").notNull().defaultNow(),
  closedAt:             timestamp("closed_at"),
  notes:                text("notes"),
  metadata:             jsonb("metadata").default({}),
  createdAt:            timestamp("created_at").notNull().defaultNow(),
  updatedAt:            timestamp("updated_at").notNull().defaultNow(),
});

export const insertCaseFileSchema = createInsertSchema(caseFilesTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type CaseFile = typeof caseFilesTable.$inferSelect;
export type InsertCaseFile = z.infer<typeof insertCaseFileSchema>;
