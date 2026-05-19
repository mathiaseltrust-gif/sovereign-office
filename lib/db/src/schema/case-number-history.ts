import { pgTable, serial, integer, varchar, text, timestamp } from "drizzle-orm/pg-core";

/**
 * Case Number History — reclassification audit trail
 *
 * When a case is renumbered (e.g. MET-SC-2025-007 → SOV-2026-0002) a row is
 * inserted here before the case_files row is updated.  Every former number is
 * preserved so:
 *   • Documents printed under the old number still resolve to the current case.
 *   • Reprints / amendments can render "formerly known as [old number]".
 *   • A full audit trail is available for court filings and archive records.
 */
export const caseNumberHistoryTable = pgTable("case_number_history", {
  id:                serial("id").primaryKey(),
  caseFileId:        integer("case_file_id").notNull(),
  formerCaseNumber:  varchar("former_case_number", { length: 60 }).notNull(),
  newCaseNumber:     varchar("new_case_number", { length: 60 }).notNull(),
  reclassifiedAt:    timestamp("reclassified_at").notNull().defaultNow(),
  reclassifiedById:  integer("reclassified_by_id"),
  reason:            text("reason"),
  amendmentType:     varchar("amendment_type", { length: 60 }).default("reclassification"),
  notes:             text("notes"),
  createdAt:         timestamp("created_at").notNull().defaultNow(),
});

export type CaseNumberHistory = typeof caseNumberHistoryTable.$inferSelect;
