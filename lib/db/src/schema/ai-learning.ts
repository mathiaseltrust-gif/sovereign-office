import { pgTable, serial, integer, text, jsonb, varchar, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const aiLearningTable = pgTable("ai_learning", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  category: varchar("category", { length: 100 }).notNull(),
  key: text("key").notNull(),
  value: jsonb("value").notNull().default({}),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertAiLearningSchema = createInsertSchema(aiLearningTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertAiLearning = z.infer<typeof insertAiLearningSchema>;
export type AiLearning = typeof aiLearningTable.$inferSelect;
