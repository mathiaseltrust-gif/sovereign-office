import { pgTable, serial, integer, text, varchar, jsonb, boolean, timestamp } from "drizzle-orm/pg-core";
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
  membershipVerified: boolean("membership_verified").notNull().default(false),
  entraVerified: boolean("entra_verified").notNull().default(false),
  lineageVerified: boolean("lineage_verified").notNull().default(false),
  delegatedAuthorities: jsonb("delegated_authorities").default({}),
  apn: text("apn"),
  mailingAddress: text("mailing_address"),
  landStatus: varchar("land_status", { length: 50 }),
  legalDescription: text("legal_description"),
  hasRecordedInstrument: boolean("has_recorded_instrument").notNull().default(false),
  signatureUrl: text("signature_url"),
  tribalLandCode: text("tribal_land_code"),
  docNumbers: jsonb("doc_numbers").default([]).$type<string[]>(),
  landRestrictionBasis: jsonb("land_restriction_basis").default([]).$type<string[]>(),
  landClassification: text("land_classification"),
  selfExecuting: boolean("self_executing").notNull().default(false),
  signatureConsent: boolean("signature_consent").notNull().default(false),
  kinshipToTribe: text("kinship_to_tribe"),
  chiefStatement: text("chief_statement"),
  chiefStatementRef: text("chief_statement_ref"),
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
