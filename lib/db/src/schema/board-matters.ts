import { pgTable, serial, text, integer, varchar, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const boardMattersTable = pgTable("board_matters", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  summary: text("summary"),
  matterType: varchar("matter_type", { length: 80 }).notNull().default("governance"),
  sourceType: varchar("source_type", { length: 80 }),
  sourceId: varchar("source_id", { length: 120 }),
  orgId: varchar("org_id", { length: 100 }).notNull().default("board_of_trustees"),
  status: varchar("status", { length: 50 }).notNull().default("new"),
  priority: varchar("priority", { length: 30 }).notNull().default("normal"),
  assignedTo: integer("assigned_to").references(() => usersTable.id, { onDelete: "set null" }),
  responsibleOffice: text("responsible_office"),
  dueDate: timestamp("due_date"),
  boardAction: text("board_action"),
  responseRequired: boolean("response_required").notNull().default(false),
  evidenceRequired: boolean("evidence_required").notNull().default(false),
  closureNotes: text("closure_notes"),
  linkedTaskId: integer("linked_task_id"),
  linkedCalendarEventId: integer("linked_calendar_event_id"),
  createdBy: integer("created_by").references(() => usersTable.id, { onDelete: "set null" }),
  closedBy: integer("closed_by").references(() => usersTable.id, { onDelete: "set null" }),
  closedAt: timestamp("closed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertBoardMatterSchema = createInsertSchema(boardMattersTable).omit({
  id: true,
  linkedTaskId: true,
  linkedCalendarEventId: true,
  closedBy: true,
  closedAt: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertBoardMatter = z.infer<typeof insertBoardMatterSchema>;
export type BoardMatter = typeof boardMattersTable.$inferSelect;
