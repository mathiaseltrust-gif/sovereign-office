import { pgTable, serial, integer, text, boolean, timestamp } from "drizzle-orm/pg-core";

export const historicalExposureEventsTable = pgTable("historical_exposure_events", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  shortName: text("short_name"),
  category: text("category"),
  yearStart: integer("year_start"),
  yearEnd: integer("year_end"),
  affectedStates: text("affected_states").array(),
  impactTypes: text("impact_types").array(),
  description: text("description"),
  legalCitation: text("legal_citation"),
  sourceUrl: text("source_url"),
  significance: text("significance"),
  isCustom: boolean("is_custom").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export type HistoricalExposureEvent = typeof historicalExposureEventsTable.$inferSelect;
export type InsertHistoricalExposureEvent = typeof historicalExposureEventsTable.$inferInsert;
