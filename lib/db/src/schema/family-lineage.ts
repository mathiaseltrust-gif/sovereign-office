import { pgTable, serial, integer, text, jsonb, varchar, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const familyLineageTable = pgTable("family_lineage", {
  id: serial("id").primaryKey(),
  userId: integer("user_id"),
  firstName: varchar("first_name", { length: 200 }),
  lastName: varchar("last_name", { length: 200 }),
  fullName: varchar("full_name", { length: 400 }).notNull(),
  birthYear: integer("birth_year"),
  deathYear: integer("death_year"),
  gender: varchar("gender", { length: 50 }),
  tribalNation: varchar("tribal_nation", { length: 255 }),
  tribalEnrollmentNumber: varchar("tribal_enrollment_number", { length: 100 }),
  tribalIdNumber: varchar("tribal_id_number", { length: 10 }),
  notes: text("notes"),
  parentIds: jsonb("parent_ids").default([]),
  childrenIds: jsonb("children_ids").default([]),
  spouseIds: jsonb("spouse_ids").default([]),
  lineageTags: jsonb("lineage_tags").default([]),
  sourceType: varchar("source_type", { length: 50 }).notNull().default("manual"),
  generationalPosition: integer("generational_position").default(0),
  isDeceased: boolean("is_deceased").default(false),
  isAncestor: boolean("is_ancestor").default(true),
  icwaEligible: boolean("icwa_eligible"),
  welfareEligible: boolean("welfare_eligible"),
  trustBeneficiary: boolean("trust_beneficiary"),
  linkedProfileUserId: integer("linked_profile_user_id"),
  photoFilename: varchar("photo_filename", { length: 500 }),
  photoUrl: text("photo_url"),
  protectionLevel: varchar("protection_level", { length: 50 }).default("pending"),
  membershipStatus: varchar("membership_status", { length: 50 }).default("pending"),
  nameVariants: jsonb("name_variants").default([]),
  entraObjectId: varchar("entra_object_id", { length: 255 }),
  pendingReview: boolean("pending_review").default(false),
  addedByMemberId: integer("added_by_member_id").references(() => usersTable.id, { onDelete: "set null" }),
  supportingDocumentName: varchar("supporting_document_name", { length: 500 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const ancestralRecordsTable = pgTable("ancestral_records", {
  id: serial("id").primaryKey(),
  lineageId: integer("lineage_id").notNull(),
  userId: integer("user_id"),
  recordType: varchar("record_type", { length: 100 }).notNull().default("genealogical"),
  recordDate: varchar("record_date", { length: 100 }),
  recordSource: varchar("record_source", { length: 500 }),
  jurisdiction: varchar("jurisdiction", { length: 255 }),
  tribalNation: varchar("tribal_nation", { length: 255 }),
  documentContent: text("document_content"),
  verificationStatus: varchar("verification_status", { length: 50 }).notNull().default("unverified"),
  icwaRelevant: boolean("icwa_relevant").default(false),
  trustRelevant: boolean("trust_relevant").default(false),
  welfareRelevant: boolean("welfare_relevant").default(false),
  metadata: jsonb("metadata").default({}),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const identityNarrativesTable = pgTable("identity_narratives", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  lineageId: integer("lineage_id"),
  narrativeType: varchar("narrative_type", { length: 100 }).notNull().default("lineage"),
  title: varchar("title", { length: 500 }),
  content: text("content"),
  lineageTags: jsonb("lineage_tags").default([]),
  ancestorChain: jsonb("ancestor_chain").default([]),
  familyGroup: varchar("family_group", { length: 255 }),
  generationalDepth: integer("generational_depth").default(0),
  generationalPosition: integer("generational_position").default(0),
  protectionLevel: varchar("protection_level", { length: 50 }).notNull().default("standard"),
  benefitEligibility: jsonb("benefit_eligibility").default({}),
  icwaEligible: boolean("icwa_eligible").default(false),
  welfareEligible: boolean("welfare_eligible").default(false),
  trustInheritance: boolean("trust_inheritance").default(false),
  membershipVerified: boolean("membership_verified").default(false),
  identityTags: jsonb("identity_tags").default([]),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertFamilyLineageSchema = createInsertSchema(familyLineageTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertAncestralRecordSchema = createInsertSchema(ancestralRecordsTable).omit({ id: true, createdAt: true });
export const insertIdentityNarrativeSchema = createInsertSchema(identityNarrativesTable).omit({ id: true, createdAt: true, updatedAt: true });

export type FamilyLineage = typeof familyLineageTable.$inferSelect;
export type AncestralRecord = typeof ancestralRecordsTable.$inferSelect;
export type IdentityNarrative = typeof identityNarrativesTable.$inferSelect;
export type InsertFamilyLineage = z.infer<typeof insertFamilyLineageSchema>;
export type InsertAncestralRecord = z.infer<typeof insertAncestralRecordSchema>;
export type InsertIdentityNarrative = z.infer<typeof insertIdentityNarrativeSchema>;
