import { pgTable, serial, text, varchar, jsonb, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const classificationsTable = pgTable("classifications", {
  id: serial("id").primaryKey(),
  actorType: varchar("actor_type", { length: 100 }).notNull(),
  landStatus: varchar("land_status", { length: 100 }).notNull(),
  actionType: varchar("action_type", { length: 100 }).notNull(),
  rawText: text("raw_text").notNull(),
  sourceType: varchar("source_type", { length: 50 }).notNull().default("text"),
  doctrineApplied: jsonb("doctrine_applied").default({}),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertClassificationSchema = createInsertSchema(classificationsTable).omit({
  id: true,
  createdAt: true,
});
export type InsertClassification = z.infer<typeof insertClassificationSchema>;
export type Classification = typeof classificationsTable.$inferSelect;
