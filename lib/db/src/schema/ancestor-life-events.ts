import { pgTable, serial, integer, text, varchar, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// ── ancestor_life_events ──────────────────────────────────────────────────────
// Structured life-event records extracted from GEDCOM imports or entered manually.
// Supports Atlas location priority ordering and Ancestor Record views.
//
// Atlas location priority (highest → lowest):
//   residence → census → birth → marriage → death → burial → unknown
//
// event_type values: birth | christening | residence | marriage | death |
//   burial | census | migration | removal | classification | other

export const ancestorLifeEventsTable = pgTable("ancestor_life_events", {
  id: serial("id").primaryKey(),
  personId: integer("ancestor_id").notNull(),
  eventType: varchar("event_type", { length: 50 }).notNull(),
  eventDate: varchar("event_date", { length: 100 }),
  eventYear: integer("event_year"),
  eventPlace: text("event_place"),
  eventPlaceConfidence: varchar("event_place_confidence", { length: 20 }).default("documented"),
  eventSource: varchar("event_source", { length: 500 }),
  eventNote: text("event_note"),
  atlasVisible: boolean("atlas_visible").default(true),
  sourceType: varchar("source_type", { length: 50 }).default("gedcom"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ── ancestor_media ────────────────────────────────────────────────────────────
// Media/photo references for ancestors, primarily from GEDCOM OBJE records.
// is_profile_photo=true when OBJE.TITL contains portrait/profile keywords.

export const ancestorMediaTable = pgTable("ancestor_media", {
  id: serial("id").primaryKey(),
  personId: integer("person_id").notNull(),
  mediaFileRef: text("media_file_ref"),
  mediaType: varchar("media_type", { length: 100 }),
  mediaTitle: text("media_title"),
  mediaCaption: text("media_caption"),
  isProfilePhoto: boolean("is_profile_photo").default(false),
  uploadedFileUrl: text("uploaded_file_url"),
  sourceSystem: varchar("source_system", { length: 100 }).default("gedcom"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertAncestorLifeEventSchema = createInsertSchema(ancestorLifeEventsTable).omit({ id: true, createdAt: true });
export const insertAncestorMediaSchema = createInsertSchema(ancestorMediaTable).omit({ id: true, createdAt: true });

export type AncestorLifeEvent = typeof ancestorLifeEventsTable.$inferSelect;
export type AncestorMedia = typeof ancestorMediaTable.$inferSelect;
export type InsertAncestorLifeEvent = z.infer<typeof insertAncestorLifeEventSchema>;
export type InsertAncestorMedia = z.infer<typeof insertAncestorMediaSchema>;
