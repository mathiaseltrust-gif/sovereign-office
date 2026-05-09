import { pgTable, serial, integer, text, jsonb, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const profilesTable = pgTable("profiles", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  bio: text("bio"),
  preferredJurisdiction: text("preferred_jurisdiction"),
  aiPreferences: jsonb("ai_preferences").default({}),
  searchHistory: jsonb("search_history").default([]),
  legalName: text("legal_name"),
  preferredName: text("preferred_name"),
  tribalName: text("tribal_name"),
  nickname: text("nickname"),
  title: text("title"),
  familyGroup: text("family_group"),
  jurisdictionTags: jsonb("jurisdiction_tags").default([]),
  welfareTags: jsonb("welfare_tags").default([]),
  notificationPreferences: jsonb("notification_preferences").default({}),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertProfileSchema = createInsertSchema(profilesTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertProfile = z.infer<typeof insertProfileSchema>;
export type Profile = typeof profilesTable.$inferSelect;
