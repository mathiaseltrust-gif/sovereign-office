import { pgTable, serial, integer, text, varchar, timestamp, jsonb } from "drizzle-orm/pg-core";

export const ancestralTimelineEventsTable = pgTable("ancestral_timeline_events", {
  id: serial("id").primaryKey(),
  ancestorId: integer("ancestor_id").notNull(),
  eventType: varchar("event_type", { length: 50 }).notNull(),
  year: integer("year"),
  endYear: integer("end_year"),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  location: varchar("location", { length: 255 }),
  sourceType: varchar("source_type", { length: 50 }).notNull().default("life_event"),
  sourceNote: text("source_note"),
  addedByUserId: integer("added_by_user_id").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type AncestralTimelineEvent = typeof ancestralTimelineEventsTable.$inferSelect;
export type NewAncestralTimelineEvent = typeof ancestralTimelineEventsTable.$inferInsert;
