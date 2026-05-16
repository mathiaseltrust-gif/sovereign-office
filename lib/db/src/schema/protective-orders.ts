import { pgTable, serial, text, varchar, jsonb, timestamp, date, boolean } from "drizzle-orm/pg-core";

export const protectiveOrdersTable = pgTable("protective_orders", {
  id: serial("id").primaryKey(),
  caseNumber: varchar("case_number", { length: 100 }).notNull(),
  title: varchar("title", { length: 500 }).notNull(),
  documentType: varchar("document_type", { length: 100 }).notNull().default("final_judgment"),
  court: varchar("court", { length: 255 }).notNull().default("Mathias El Tribe Supreme Court"),
  issuer: varchar("issuer", { length: 255 }).notNull().default("Chief Mathias El"),
  issuedDate: date("issued_date").notNull(),
  expiresDate: date("expires_date"),
  retroactiveTo: date("retroactive_to"),
  status: varchar("status", { length: 50 }).notNull().default("active"),
  supplementalTo: varchar("supplemental_to", { length: 100 }),
  summary: text("summary").notNull(),
  scope: text("scope").notNull(),
  coverageRoles: jsonb("coverage_roles").notNull().default([]),
  coveredPersonCategories: jsonb("covered_person_categories").notNull().default([]),
  legalBases: jsonb("legal_bases").notNull().default([]),
  keyOrders: jsonb("key_orders").notNull().default([]),
  enforcementMechanisms: jsonb("enforcement_mechanisms").notNull().default([]),
  namedRespondents: jsonb("named_respondents").notNull().default([]),
  fullFaithAndCredit: boolean("full_faith_and_credit").notNull().default(true),
  selfExecuting: boolean("self_executing").notNull().default(true),
  sovereignImmunityReserved: boolean("sovereign_immunity_reserved").notNull().default(true),
  validatedCitations: jsonb("validated_citations").notNull().default([]),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type ProtectiveOrder = typeof protectiveOrdersTable.$inferSelect;
