import { pgTable, serial, text, boolean, jsonb, timestamp, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const welfareActsTable = pgTable("welfare_acts", {
  id: serial("id").primaryKey(),
  code: varchar("code", { length: 50 }).notNull().unique(),
  label: text("label").notNull(),
  description: text("description"),
  federalStatutes: jsonb("federal_statutes").default([]),
  doctrines: jsonb("doctrines").default([]),
  troEligible: boolean("tro_eligible").notNull().default(false),
  emergencyEligible: boolean("emergency_eligible").notNull().default(false),
  enabled: boolean("enabled").notNull().default(true),
  createdBy: text("created_by"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const welfareProvisionsTable = pgTable("welfare_provisions", {
  id: serial("id").primaryKey(),
  actCode: varchar("act_code", { length: 50 }).notNull(),
  instrumentType: varchar("instrument_type", { length: 100 }).notNull(),
  provisionText: text("provision_text").notNull(),
  sortOrder: serial("sort_order"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertWelfareActSchema = createInsertSchema(welfareActsTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertWelfareProvisionSchema = createInsertSchema(welfareProvisionsTable).omit({ id: true, createdAt: true });
export type InsertWelfareAct = z.infer<typeof insertWelfareActSchema>;
export type InsertWelfareProvision = z.infer<typeof insertWelfareProvisionSchema>;
export type WelfareAct = typeof welfareActsTable.$inferSelect;
export type WelfareProvision = typeof welfareProvisionsTable.$inferSelect;
