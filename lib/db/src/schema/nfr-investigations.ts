import { pgTable, serial, integer, text, jsonb, varchar, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const nfrInvestigationsTable = pgTable("nfr_investigations", {
  id: serial("id").primaryKey(),
  signalType: varchar("signal_type", { length: 80 }).notNull(),
  triggeringEventType: varchar("triggering_event_type", { length: 80 }).notNull(),
  triggeringEventId: integer("triggering_event_id"),
  affectedUserId: integer("affected_user_id"),
  affectedParcelId: integer("affected_parcel_id"),
  affectedInstrumentId: integer("affected_instrument_id"),
  affectedMatter: text("affected_matter"),
  triggeringEntity: text("triggering_entity"),
  evidenceSource: text("evidence_source"),
  implicatedLaws: jsonb("implicated_laws").default([]),
  protectionCategory: varchar("protection_category", { length: 60 }),
  urgencyScore: integer("urgency_score").default(5),
  recommendedReviewLevel: varchar("recommended_review_level", { length: 30 }).default("TRUSTEE"),
  assignedReviewerId: integer("assigned_reviewer_id"),
  status: varchar("status", { length: 30 }).notNull().default("open"),
  internalActions: jsonb("internal_actions").default([]),
  externalActions: jsonb("external_actions").default([]),
  requiredFollowthrough: jsonb("required_followthrough").default([]),
  nfrId: integer("nfr_id"),
  summary: text("summary"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertNfrInvestigationSchema = createInsertSchema(nfrInvestigationsTable).omit({
  id: true, createdAt: true, updatedAt: true,
});
export type InsertNfrInvestigation = z.infer<typeof insertNfrInvestigationSchema>;
export type NfrInvestigation = typeof nfrInvestigationsTable.$inferSelect;
