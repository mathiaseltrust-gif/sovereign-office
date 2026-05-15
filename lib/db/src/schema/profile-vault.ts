import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";

export const profileVaultTable = pgTable("profile_vault", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().unique(),
  dateOfBirth: text("date_of_birth"),
  address: text("address"),
  preferredContact: text("preferred_contact"),
  contactEmail: text("contact_email"),
  ssn: text("ssn"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type ProfileVault = typeof profileVaultTable.$inferSelect;
