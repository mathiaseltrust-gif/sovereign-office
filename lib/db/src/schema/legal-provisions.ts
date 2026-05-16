import { pgTable, serial, text, varchar, timestamp, jsonb } from "drizzle-orm/pg-core";

export const legalProvisionsTable = pgTable("legal_provisions", {
  id: serial("id").primaryKey(),
  title: varchar("title", { length: 255 }).notNull(),
  category: varchar("category", { length: 100 }).notNull(),
  purpose: text("purpose").notNull().default(""),
  content: text("content").notNull(),
  keyStatutes: jsonb("key_statutes").default([]).$type<string[]>(),
  companionCategories: jsonb("companion_categories").default([]).$type<string[]>(),
  status: varchar("status", { length: 20 }).notNull().default("active"),
  issuedAt: timestamp("issued_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type LegalProvision = typeof legalProvisionsTable.$inferSelect;
export type NewLegalProvision = typeof legalProvisionsTable.$inferInsert;
