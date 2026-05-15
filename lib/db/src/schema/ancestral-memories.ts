import { pgTable, serial, integer, text, jsonb, varchar, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const ancestralMemoriesTable = pgTable("ancestral_memories", {
  id: serial("id").primaryKey(),

  authorMemberId: integer("author_member_id").references(() => usersTable.id, { onDelete: "set null" }),

  title: varchar("title", { length: 500 }).notNull(),
  body: text("body").notNull(),

  memoryDate: varchar("memory_date", { length: 200 }),
  memoryEra: varchar("memory_era", { length: 100 }),

  taggedMemberIds: jsonb("tagged_member_ids").default([]),
  taggedAncestorIds: jsonb("tagged_ancestor_ids").default([]),
  taggedPeopleNames: jsonb("tagged_people_names").default([]),

  topics: jsonb("topics").default([]),

  location: varchar("location", { length: 300 }),

  emotionalTone: varchar("emotional_tone", { length: 50 }).default("neutral"),

  visibility: varchar("visibility", { length: 30 }).notNull().default("tribe"),

  isHistoricalEvent: boolean("is_historical_event").default(false),

  isVerified: boolean("is_verified").default(false),
  verifiedByMemberId: integer("verified_by_member_id"),

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertAncestralMemorySchema = createInsertSchema(ancestralMemoriesTable, {
  title: z.string().min(1).max(500),
  body: z.string().min(1),
  visibility: z.enum(["tribe", "family", "private"]),
  emotionalTone: z.enum(["joy", "grief", "pride", "gratitude", "warning", "neutral"]).optional(),
});

export type AncestralMemory = typeof ancestralMemoriesTable.$inferSelect;
export type InsertAncestralMemory = typeof ancestralMemoriesTable.$inferInsert;
