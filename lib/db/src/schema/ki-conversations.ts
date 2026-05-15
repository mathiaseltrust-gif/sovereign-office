import { pgTable, serial, integer, text, boolean, timestamp } from "drizzle-orm/pg-core";

export const kiConversationsTable = pgTable("ki_conversations", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  role: text("role").notNull(),
  content: text("content").notNull(),
  isDiary: boolean("is_diary").default(false).notNull(),
  mood: text("mood"),
  sessionId: text("session_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export type KiConversation = typeof kiConversationsTable.$inferSelect;
export type NewKiConversation = typeof kiConversationsTable.$inferInsert;
