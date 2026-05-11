import { pgTable, serial, integer, text, jsonb, timestamp } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const aiGuidanceRecordsTable = pgTable("ai_guidance_records", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => usersTable.id, { onDelete: "set null" }),
  question: text("question").notNull(),
  answer: text("answer").notNull(),
  citations: jsonb("citations").notNull().default([]),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type AiGuidanceRecord = typeof aiGuidanceRecordsTable.$inferSelect;
