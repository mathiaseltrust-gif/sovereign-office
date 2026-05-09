import { pgTable, serial, integer, text, boolean, jsonb, timestamp, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const notificationsTable = pgTable("notifications", {
  id: serial("id").primaryKey(),
  userId: integer("user_id"),
  channel: varchar("channel", { length: 50 }).notNull().default("dashboard"),
  category: varchar("category", { length: 100 }).notNull(),
  title: text("title").notNull(),
  message: text("message").notNull(),
  severity: varchar("severity", { length: 20 }).notNull().default("info"),
  relatedId: integer("related_id"),
  relatedType: varchar("related_type", { length: 50 }),
  redFlag: boolean("red_flag").notNull().default(false),
  troFlag: boolean("tro_flag").notNull().default(false),
  read: boolean("read").notNull().default(false),
  metadata: jsonb("metadata").default({}),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertNotificationSchema = createInsertSchema(notificationsTable).omit({ id: true, createdAt: true });
export type InsertNotification = z.infer<typeof insertNotificationSchema>;
export type Notification = typeof notificationsTable.$inferSelect;
