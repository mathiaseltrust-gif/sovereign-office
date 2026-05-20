import {
  pgTable, serial, integer, varchar, text, numeric, boolean, jsonb,
  date, timestamp,
} from "drizzle-orm/pg-core";

export const landParcelsTable = pgTable("land_parcels", {
  id: serial("id").primaryKey(),
  tractNumber: varchar("tract_number", { length: 100 }),
  parcelId: varchar("parcel_id", { length: 100 }),
  legalDescription: text("legal_description"),
  acreage: numeric("acreage"),
  classification: varchar("classification", { length: 100 }),
  status: varchar("status", { length: 50 }).notNull().default("active"),
  county: varchar("county", { length: 100 }),
  state: varchar("state", { length: 50 }),
  plssDescription: varchar("plss_description", { length: 255 }),
  ownerType: varchar("owner_type", { length: 100 }),
  acquiredDate: varchar("acquired_date", { length: 50 }),
  acquisitionSource: varchar("acquisition_source", { length: 255 }),
  biaTractNumber: varchar("bia_tract_number", { length: 100 }),
  lat: varchar("lat", { length: 30 }),
  lng: varchar("lng", { length: 30 }),
  notes: text("notes"),
  internalTribalStatus: varchar("internal_tribal_status", { length: 100 }),
  federalAdminStatus: varchar("federal_admin_status", { length: 100 }),
  jurisdictionalStatus: varchar("jurisdictional_status", { length: 100 }),
  beneficiaryStewardshipType: varchar("beneficiary_stewardship_type", { length: 100 }),
  protectionRestrictionStatus: varchar("protection_restriction_status", { length: 100 }),
  tribalCodeRef: varchar("tribal_code_ref", { length: 100 }),
  tribalCourtOrderNum: varchar("tribal_court_order_num", { length: 100 }),
  protectedStatusBasis: text("protected_status_basis"),
  restrictionBasis: text("restriction_basis"),
  enforcementAuthority: varchar("enforcement_authority", { length: 255 }),
  federalLawCrossRef: varchar("federal_law_cross_ref", { length: 255 }),
  stewardshipPurpose: varchar("stewardship_purpose", { length: 255 }),
  culturalSignificance: text("cultural_significance"),
  historicalOccupancy: text("historical_occupancy"),
  tribalRef: varchar("tribal_ref", { length: 100 }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const landAssetsTable = pgTable("land_assets", {
  id: serial("id").primaryKey(),
  parcelId: integer("parcel_id").references(() => landParcelsTable.id, { onDelete: "cascade" }),
  assetType: varchar("asset_type", { length: 100 }),
  name: varchar("name", { length: 255 }),
  description: text("description"),
  estimatedValue: numeric("estimated_value"),
  conditionRating: varchar("condition_rating", { length: 50 }),
  yearBuilt: integer("year_built"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const landDeedsTable = pgTable("land_deeds", {
  id: serial("id").primaryKey(),
  parcelId: integer("parcel_id").references(() => landParcelsTable.id, { onDelete: "cascade" }),
  deedType: text("deed_type"),
  grantor: text("grantor"),
  grantee: text("grantee"),
  recordingDate: date("recording_date"),
  recordingNumber: text("recording_number"),
  recordingJurisdiction: text("recording_jurisdiction"),
  instrumentDate: date("instrument_date"),
  consideration: numeric("consideration"),
  exemptionBasis: text("exemption_basis"),
  sovereignImmunityClaim: boolean("sovereign_immunity_claim").default(false),
  conservationEasement: boolean("conservation_easement").default(false),
  communityLandUse: text("community_land_use"),
  tribalCodeRef: text("tribal_code_ref"),
  federalLawRef: text("federal_law_ref"),
  fileKey: text("file_key"),
  fileName: text("file_name"),
  fileUrl: text("file_url"),
  notes: text("notes"),
  status: text("status").default("active"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const landLeasesTable = pgTable("land_leases", {
  id: serial("id").primaryKey(),
  parcelId: integer("parcel_id").references(() => landParcelsTable.id, { onDelete: "cascade" }),
  leaseType: varchar("lease_type", { length: 100 }),
  lesseeName: varchar("lessee_name", { length: 255 }),
  lesseeContact: jsonb("lessee_contact"),
  startDate: date("start_date"),
  endDate: date("end_date"),
  annualRent: numeric("annual_rent"),
  paymentFrequency: varchar("payment_frequency", { length: 50 }),
  status: varchar("status", { length: 50 }).default("active"),
  biaLeaseNumber: varchar("bia_lease_number", { length: 100 }),
  description: text("description"),
  tribalRef: varchar("tribal_ref", { length: 100 }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const landEncumbrancesTable = pgTable("land_encumbrances", {
  id: serial("id").primaryKey(),
  parcelId: integer("parcel_id").references(() => landParcelsTable.id, { onDelete: "cascade" }),
  encumbranceType: varchar("encumbrance_type", { length: 100 }),
  title: varchar("title", { length: 255 }),
  description: text("description"),
  source: varchar("source", { length: 255 }),
  dateIdentified: varchar("date_identified", { length: 50 }),
  status: varchar("status", { length: 50 }).default("active"),
  federalLawImplicated: varchar("federal_law_implicated", { length: 255 }),
  tribalCodeRef: varchar("tribal_code_ref", { length: 100 }),
  voidAbInitio: boolean("void_ab_initio").default(false),
  resolutionNotes: text("resolution_notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const landNoticesTable = pgTable("land_notices", {
  id: serial("id").primaryKey(),
  parcelId: integer("parcel_id").references(() => landParcelsTable.id, { onDelete: "cascade" }),
  noticeType: varchar("notice_type", { length: 100 }),
  title: varchar("title", { length: 255 }),
  content: text("content"),
  issuedDate: varchar("issued_date", { length: 50 }),
  effectiveDate: varchar("effective_date", { length: 50 }),
  servedTo: varchar("served_to", { length: 255 }),
  serviceMethod: varchar("service_method", { length: 100 }),
  status: varchar("status", { length: 50 }).default("draft"),
  tribalCodeRef: varchar("tribal_code_ref", { length: 100 }),
  federalLawRef: varchar("federal_law_ref", { length: 255 }),
  courtOrderRef: varchar("court_order_ref", { length: 100 }),
  enforcementAction: text("enforcement_action"),
  tribalRef: varchar("tribal_ref", { length: 100 }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const landTaxComplianceTable = pgTable("land_tax_compliance", {
  id: serial("id").primaryKey(),
  parcelId: integer("parcel_id").references(() => landParcelsTable.id, { onDelete: "cascade" }),
  complianceType: text("compliance_type"),
  jurisdiction: text("jurisdiction"),
  taxYear: integer("tax_year"),
  deadlineDate: date("deadline_date"),
  amountAssessed: numeric("amount_assessed"),
  amountPaid: numeric("amount_paid"),
  paymentDate: date("payment_date"),
  status: text("status").default("pending"),
  sovereignImmunityClaimed: boolean("sovereign_immunity_claimed").default(false),
  immunityClaimDate: date("immunity_claim_date"),
  immunityBasis: text("immunity_basis"),
  exemptionType: text("exemption_type"),
  exemptionFiledDate: date("exemption_filed_date"),
  exemptionStatus: text("exemption_status"),
  appealFiled: boolean("appeal_filed").default(false),
  appealDate: date("appeal_date"),
  appealBasis: text("appeal_basis"),
  tribalCodeRef: text("tribal_code_ref"),
  federalLawRef: text("federal_law_ref"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const landMemberAssignmentsTable = pgTable("land_member_assignments", {
  id: serial("id").primaryKey(),
  parcelId: integer("parcel_id").references(() => landParcelsTable.id, { onDelete: "cascade" }),
  memberId: text("member_id"),
  memberName: text("member_name"),
  memberEmail: text("member_email"),
  assignmentRole: text("assignment_role"),
  familyName: text("family_name"),
  stewardFamily: text("steward_family"),
  assignedDate: date("assigned_date"),
  endDate: date("end_date"),
  status: text("status").default("active"),
  responsibilities: text("responsibilities"),
  culturalConnection: text("cultural_connection"),
  tribalCodeRef: text("tribal_code_ref"),
  authorizedBy: text("authorized_by"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const landAcquisitionPipelineTable = pgTable("land_acquisition_pipeline", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }),
  description: text("description"),
  acreage: numeric("acreage"),
  county: varchar("county", { length: 100 }),
  state: varchar("state", { length: 50 }),
  estimatedCost: numeric("estimated_cost"),
  acquisitionType: varchar("acquisition_type", { length: 100 }),
  stage: varchar("stage", { length: 100 }).default("prospecting"),
  biaCaseNumber: varchar("bia_case_number", { length: 100 }),
  priority: varchar("priority", { length: 50 }).default("normal"),
  targetDate: varchar("target_date", { length: 50 }),
  notes: text("notes"),
  stewardshipPurpose: varchar("stewardship_purpose", { length: 255 }),
  culturalNotes: text("cultural_notes"),
  tribalCodeRef: varchar("tribal_code_ref", { length: 100 }),
  jurisdictionalStatus: varchar("jurisdictional_status", { length: 100 }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export type LandParcel = typeof landParcelsTable.$inferSelect;
export type InsertLandParcel = typeof landParcelsTable.$inferInsert;
export type LandAsset = typeof landAssetsTable.$inferSelect;
export type InsertLandAsset = typeof landAssetsTable.$inferInsert;
export type LandDeed = typeof landDeedsTable.$inferSelect;
export type InsertLandDeed = typeof landDeedsTable.$inferInsert;
export type LandLease = typeof landLeasesTable.$inferSelect;
export type InsertLandLease = typeof landLeasesTable.$inferInsert;
export type LandEncumbrance = typeof landEncumbrancesTable.$inferSelect;
export type InsertLandEncumbrance = typeof landEncumbrancesTable.$inferInsert;
export type LandNotice = typeof landNoticesTable.$inferSelect;
export type InsertLandNotice = typeof landNoticesTable.$inferInsert;
export type LandTaxCompliance = typeof landTaxComplianceTable.$inferSelect;
export type InsertLandTaxCompliance = typeof landTaxComplianceTable.$inferInsert;
export type LandMemberAssignment = typeof landMemberAssignmentsTable.$inferSelect;
export type InsertLandMemberAssignment = typeof landMemberAssignmentsTable.$inferInsert;
export type LandAcquisitionPipeline = typeof landAcquisitionPipelineTable.$inferSelect;
export type InsertLandAcquisitionPipeline = typeof landAcquisitionPipelineTable.$inferInsert;
