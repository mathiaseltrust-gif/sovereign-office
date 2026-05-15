import { pgTable, serial, integer, text, varchar, timestamp } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const journalEntriesTable = pgTable("journal_entries", {
  id: serial("id").primaryKey(),
  entryNumber: varchar("entry_number", { length: 20 }).notNull().unique(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  title: varchar("title", { length: 300 }),
  content: text("content").notNull(),
  mood: varchar("mood", { length: 50 }),
  tags: text("tags").array().default([]),
  kiConversationId: integer("ki_conversation_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type JournalEntry = typeof journalEntriesTable.$inferSelect;
export type InsertJournalEntry = typeof journalEntriesTable.$inferInsert;
