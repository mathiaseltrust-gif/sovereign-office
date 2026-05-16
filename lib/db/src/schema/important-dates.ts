import { pgTable, serial, integer, text, varchar, timestamp } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const importantDatesTable = pgTable("important_dates", {
  id: serial("id").primaryKey(),
  personName: varchar("person_name", { length: 200 }).notNull(),
  relation: varchar("relation", { length: 100 }),
  dateType: varchar("date_type", { length: 50 }).notNull().default("birthday"),
  month: integer("month").notNull(),
  day: integer("day").notNull(),
  year: integer("year"),
  customLabel: varchar("custom_label", { length: 200 }),
  notes: text("notes"),
  addedByUserId: integer("added_by_user_id").references(() => usersTable.id, { onDelete: "set null" }),
  sourceKey: varchar("source_key", { length: 300 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type ImportantDate = typeof importantDatesTable.$inferSelect;
export type InsertImportantDate = typeof importantDatesTable.$inferInsert;
