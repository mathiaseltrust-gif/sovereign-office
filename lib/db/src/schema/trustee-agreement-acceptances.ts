import { pgTable, serial, text, integer, varchar, timestamp, boolean, index, uniqueIndex } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const trusteeAgreementAcceptancesTable = pgTable("trustee_agreement_acceptances", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  entraId: varchar("entra_id", { length: 255 }).notNull(),
  agreementKey: varchar("agreement_key", { length: 100 }).notNull(),
  agreementVersion: varchar("agreement_version", { length: 50 }).notNull(),
  contentHash: varchar("content_hash", { length: 64 }).notNull(),
  agreementText: text("agreement_text").notNull(),
  signedName: text("signed_name").notNull(),
  signedEmail: varchar("signed_email", { length: 255 }).notNull(),
  roleAtSigning: varchar("role_at_signing", { length: 80 }).notNull(),
  signatureMethod: varchar("signature_method", { length: 100 }).notNull(),
  signatureReceipt: varchar("signature_receipt", { length: 128 }).notNull(),
  acknowledgedDuties: boolean("acknowledged_duties").notNull().default(false),
  acknowledgedRemoval: boolean("acknowledged_removal").notNull().default(false),
  acknowledgedElectronicSignature: boolean("acknowledged_electronic_signature").notNull().default(false),
  userAgent: text("user_agent"),
  signedAt: timestamp("signed_at").defaultNow().notNull(),
  revokedAt: timestamp("revoked_at"),
  revocationReason: text("revocation_reason"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  currentAcceptanceUnique: uniqueIndex("trustee_agreement_acceptance_unique").on(table.userId, table.agreementKey, table.agreementVersion, table.contentHash),
  userIdx: index("trustee_agreement_acceptance_user_idx").on(table.userId),
  versionIdx: index("trustee_agreement_acceptance_version_idx").on(table.agreementVersion),
}));

export type TrusteeAgreementAcceptance = typeof trusteeAgreementAcceptancesTable.$inferSelect;
