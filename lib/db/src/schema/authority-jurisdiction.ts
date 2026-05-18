import { pgTable, serial, text, boolean, timestamp, varchar, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const authorityJurisdictionTable = pgTable("jurisdiction_directory", {
  id: serial("id").primaryKey(),
  country: varchar("country", { length: 10 }).notNull().default("US"),
  stateCode: varchar("state_code", { length: 5 }).notNull(),
  stateName: text("state_name").notNull(),
  county: text("county"),
  city: text("city"),
  fipsCode: varchar("fips_code", { length: 10 }),
  tribalLandCode: text("tribal_land_code"),
  parcelOrApnReference: text("parcel_or_apn_reference"),
  tribalLandFlag: boolean("tribal_land_flag").notNull().default(false),
  jurisdictionFlags: text("jurisdiction_flags").array().notNull().default([]),
  lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => [
  index("jur_dir_state_idx").on(t.stateCode),
  index("jur_dir_fips_idx").on(t.fipsCode),
  index("jur_dir_state_county_idx").on(t.stateCode, t.county),
]);

export const insertAuthorityJurisdictionSchema = createInsertSchema(authorityJurisdictionTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertAuthorityJurisdiction = z.infer<typeof insertAuthorityJurisdictionSchema>;
export type AuthorityJurisdiction = typeof authorityJurisdictionTable.$inferSelect;
