import { pgTable, serial, integer, text, varchar, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const traceMattersTable = pgTable("trace_matters", {
  id: serial("id").primaryKey(),
  createdBy: integer("created_by").notNull(),
  assignedTo: integer("assigned_to"),
  title: text("title").notNull(),
  description: text("description").notNull(),
  sourceType: varchar("source_type", { length: 50 }).notNull().default("manual"),
  sourceRef: text("source_ref"),
  matterType: varchar("matter_type", { length: 80 }).notNull().default("general"),
  niacReviewType: varchar("niac_review_type", { length: 80 }),
  status: varchar("status", { length: 50 }).notNull().default("pending"),
  riskLevel: varchar("risk_level", { length: 20 }).notNull().default("low"),
  niacPathway: boolean("niac_pathway").notNull().default(false),
  intakeLinkId: integer("intake_link_id"),
  deadlineAt: timestamp("deadline_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertTraceMatterSchema = createInsertSchema(traceMattersTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type TraceMatter = typeof traceMattersTable.$inferSelect;
export type InsertTraceMatter = z.infer<typeof insertTraceMatterSchema>;
