import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const messageThreadsTable = pgTable("message_threads", {
  id: serial("id").primaryKey(),
  participantAId: integer("participant_a_id").notNull(),
  participantBId: integer("participant_b_id").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  lastMessageAt: timestamp("last_message_at").defaultNow().notNull(),
});

export const directMessagesTable = pgTable("direct_messages", {
  id: serial("id").primaryKey(),
  threadId: integer("thread_id").notNull(),
  senderId: integer("sender_id").notNull(),
  recipientId: integer("recipient_id").notNull(),
  content: text("content").notNull(),
  readAt: timestamp("read_at"),
  editedAt: timestamp("edited_at"),
  deletedAt: timestamp("deleted_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertMessageThreadSchema = createInsertSchema(messageThreadsTable).omit({ id: true, createdAt: true, lastMessageAt: true });
export const insertDirectMessageSchema = createInsertSchema(directMessagesTable).omit({ id: true, createdAt: true });

export type MessageThread = typeof messageThreadsTable.$inferSelect;
export type DirectMessage = typeof directMessagesTable.$inferSelect;
export type InsertMessageThread = z.infer<typeof insertMessageThreadSchema>;
export type InsertDirectMessage = z.infer<typeof insertDirectMessageSchema>;
