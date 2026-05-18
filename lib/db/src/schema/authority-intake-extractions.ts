import { pgTable, serial, integer, text, boolean, jsonb, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const authorityIntakeExtractionsTable = pgTable("document_intake_extractions", {
  id: serial("id").primaryKey(),
  submittedByUserId: integer("submitted_by_user_id"),
  rawDocumentText: text("raw_document_text"),
  detectedEntityName: text("detected_entity_name"),
  detectedAddress: text("detected_address"),
  detectedDeadline: text("detected_deadline"),
  detectedAccountOrReferenceNumber: text("detected_account_or_reference_number"),
  detectedMatterType: text("detected_matter_type"),
  detectedActionType: text("detected_action_type"),
  detectedState: text("detected_state"),
  detectedCounty: text("detected_county"),
  detectedApn: text("detected_apn"),
  tribalLandFlag: boolean("tribal_land_flag").notNull().default(false),
  icwaFlag: boolean("icwa_flag").notNull().default(false),
  indianLawFlag: boolean("indian_law_flag").notNull().default(false),
  trustLandFlag: boolean("trust_land_flag").notNull().default(false),
  federalReviewFlag: boolean("federal_review_flag").notNull().default(false),
  legalFlags: text("legal_flags").array().notNull().default([]),
  routingRecommendation: jsonb("routing_recommendation").default({}),
  suggestedPendingReview: boolean("suggested_pending_review").notNull().default(true),
  matchedAgencyId: integer("matched_agency_id"),
  extractionSource: text("extraction_source").notNull().default("ai"),
  contextHints: jsonb("context_hints").default({}),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertAuthorityIntakeExtractionSchema = createInsertSchema(authorityIntakeExtractionsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertAuthorityIntakeExtraction = z.infer<typeof insertAuthorityIntakeExtractionSchema>;
export type AuthorityIntakeExtraction = typeof authorityIntakeExtractionsTable.$inferSelect;
