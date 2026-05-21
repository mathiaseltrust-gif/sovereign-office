import { pgTable, serial, integer, text, varchar, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const traceDraftsTable = pgTable("trace_drafts", {
  id: serial("id").primaryKey(),
  matterId: integer("matter_id").notNull(),
  draftType: varchar("draft_type", { length: 50 }).notNull().default("summary"),
  content: text("content").notNull(),
  approved: boolean("approved").notNull().default(false),
  approvedBy: integer("approved_by"),
  approvedAt: timestamp("approved_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertTraceDraftSchema = createInsertSchema(traceDraftsTable).omit({
  id: true,
  createdAt: true,
});

export type TraceDraft = typeof traceDraftsTable.$inferSelect;
export type InsertTraceDraft = z.infer<typeof insertTraceDraftSchema>;
