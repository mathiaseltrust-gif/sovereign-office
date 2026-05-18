import { pgTable, serial, text, boolean, real, timestamp, varchar, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const authorityAgenciesTable = pgTable("authority_agencies", {
  id: serial("id").primaryKey(),
  agencyName: text("agency_name").notNull(),
  agencyType: text("agency_type").notNull(),
  governmentLevel: varchar("government_level", { length: 30 }).notNull(),
  stateCode: varchar("state_code", { length: 5 }),
  county: text("county"),
  city: text("city"),
  mailingAddress: text("mailing_address"),
  physicalAddress: text("physical_address"),
  parentAgency: text("parent_agency"),
  oversightAgency: text("oversight_agency"),
  contactEmail: text("contact_email"),
  phone: text("phone"),
  website: text("website"),
  sourceUrl: text("source_url"),
  lastVerifiedDate: timestamp("last_verified_date", { withTimezone: true }),
  confidenceScore: real("confidence_score").notNull().default(0.8),
  lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => [
  index("auth_ag_state_idx").on(t.stateCode),
  index("auth_ag_state_county_idx").on(t.stateCode, t.county),
  index("auth_ag_level_idx").on(t.governmentLevel),
  index("auth_ag_type_idx").on(t.agencyType),
]);

export const insertAuthorityAgencySchema = createInsertSchema(authorityAgenciesTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertAuthorityAgency = z.infer<typeof insertAuthorityAgencySchema>;
export type AuthorityAgency = typeof authorityAgenciesTable.$inferSelect;
