import { pgTable, serial, text, jsonb, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const recorderRulesTable = pgTable("recorder_rules", {
  id: serial("id").primaryKey(),
  state: text("state").notNull(),
  county: text("county"),
  rules: jsonb("rules").notNull().default({}),
  statutes: jsonb("statutes").notNull().default([]),
  indianLandClassifications: jsonb("indian_land_classifications").notNull().default([]),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertRecorderRuleSchema = createInsertSchema(recorderRulesTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertRecorderRule = z.infer<typeof insertRecorderRuleSchema>;
export type RecorderRule = typeof recorderRulesTable.$inferSelect;
