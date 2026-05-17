import { pgTable, serial, text, integer, timestamp, doublePrecision } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const atlasEventsTable = pgTable("atlas_events", {
  id: serial("id").primaryKey(),
  eventId: text("event_id").notNull().unique(),
  title: text("title").notNull(),
  shortTitle: text("short_title"),
  year: integer("year").notNull(),
  dateStart: text("date_start"),
  dateEnd: text("date_end"),
  era: text("era").notNull(),
  eventType: text("event_type").notNull(),
  policyArea: text("policy_area").notNull(),
  description: text("description").notNull(),
  plainLanguageSummary: text("plain_language_summary").notNull(),
  severityLevel: text("severity_level").notNull().default("moderate"),
  status: text("status").notNull().default("active"),
  identityImpact: text("identity_impact"),
  reclassificationImpact: text("reclassification_impact"),
  continuityImpact: text("continuity_impact"),
  continuitySurvivalNote: text("continuity_survival_note"),
  familyImpact: text("family_impact"),
  urbanizationImpact: text("urbanization_impact"),
  healthAccessImpact: text("health_access_impact"),
  publicSchoolImpact: text("public_school_impact"),
  landImpact: text("land_impact"),
  jurisdictionImpact: text("jurisdiction_impact"),
  housingImpact: text("housing_impact"),
  laborMigrationImpact: text("labor_migration_impact"),
  modernEffect: text("modern_effect"),
  ancestorRelevanceNote: text("ancestor_relevance_note"),
  affectedPeople: text("affected_people"),
  affectedRegions: text("affected_regions").array().notNull().default([]),
  statesAffected: text("states_affected").array().notNull().default([]),
  coordinateLat: doublePrecision("coordinate_lat"),
  coordinateLng: doublePrecision("coordinate_lng"),
  sourceTitle: text("source_title").notNull().default(""),
  sourceUrl: text("source_url").notNull().default(""),
  sourceType: text("source_type"),
  citation: text("citation"),
  publicLawNumber: text("public_law_number"),
  tags: text("tags").array().notNull().default([]),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertAtlasEventSchema = createInsertSchema(atlasEventsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertAtlasEvent = z.infer<typeof insertAtlasEventSchema>;
export type AtlasEvent = typeof atlasEventsTable.$inferSelect;
