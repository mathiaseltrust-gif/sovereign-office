import { pgTable, serial, integer, text, jsonb, varchar, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const trustFilingsTable = pgTable("trust_filings", {
  id: serial("id").primaryKey(),
  instrumentId: integer("instrument_id").notNull(),
  county: varchar("county", { length: 100 }).notNull(),
  state: varchar("state", { length: 50 }).notNull(),
  filingStatus: varchar("filing_status", { length: 50 }).notNull().default("pending"),
  submittedAt: timestamp("submitted_at"),
  acceptedAt: timestamp("accepted_at"),
  rejectedAt: timestamp("rejected_at"),
  recorderResponse: jsonb("recorder_response").default({}),
  filingNumber: varchar("filing_number", { length: 100 }),
  documentType: varchar("document_type", { length: 100 }),
  trustStatus: varchar("trust_status", { length: 100 }),
  landClassification: varchar("land_classification", { length: 100 }),
  notes: text("notes"),
  filingReference: text("filing_reference"),
  instrumentType: varchar("instrument_type", { length: 100 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertTrustFilingSchema = createInsertSchema(trustFilingsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertTrustFiling = z.infer<typeof insertTrustFilingSchema>;
export type TrustFiling = typeof trustFilingsTable.$inferSelect;
