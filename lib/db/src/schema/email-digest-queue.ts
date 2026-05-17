import { pgTable, serial, integer, text, jsonb, timestamp } from "drizzle-orm/pg-core";

export const emailDigestQueueTable = pgTable("email_digest_queue", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  email: text("email").notNull(),
  name: text("name").notNull(),
  category: text("category").notNull(),
  severity: text("severity"),
  title: text("title").notNull(),
  message: text("message").notNull(),
  metadata: jsonb("metadata").default({}),
  frequency: text("frequency").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  processedAt: timestamp("processed_at"),
});

export type EmailDigestQueueItem = typeof emailDigestQueueTable.$inferSelect;
export type InsertEmailDigestQueueItem = typeof emailDigestQueueTable.$inferInsert;
