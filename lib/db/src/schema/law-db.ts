import { pgTable, serial, text, jsonb, timestamp, varchar } from "drizzle-orm/pg-core";

export const tribalLawTable = pgTable("tribal_law", {
  id: serial("id").primaryKey(),
  title: varchar("title", { length: 255 }).notNull(),
  citation: varchar("citation", { length: 255 }).notNull(),
  body: text("body").notNull(),
  tags: jsonb("tags").default([]),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const federalIndianLawTable = pgTable("federal_indian_law", {
  id: serial("id").primaryKey(),
  title: varchar("title", { length: 255 }).notNull(),
  citation: varchar("citation", { length: 255 }).notNull(),
  body: text("body").notNull(),
  tags: jsonb("tags").default([]),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const doctrineSourcesTable = pgTable("doctrine_sources", {
  id: serial("id").primaryKey(),
  caseName: varchar("case_name", { length: 255 }).notNull(),
  citation: varchar("citation", { length: 255 }).notNull(),
  summary: text("summary").notNull(),
  tags: jsonb("tags").default([]),
});

export type TribalLaw = typeof tribalLawTable.$inferSelect;
export type FederalIndianLaw = typeof federalIndianLawTable.$inferSelect;
export type DoctrineSource = typeof doctrineSourcesTable.$inferSelect;
