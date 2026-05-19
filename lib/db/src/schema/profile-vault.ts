import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";

export const profileVaultTable = pgTable("profile_vault", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().unique(),
  dateOfBirth: text("date_of_birth"),
  address: text("address"),
  preferredContact: text("preferred_contact"),
  contactEmail: text("contact_email"),
  ssn: text("ssn"),
  idDocumentType: text("id_document_type"),
  idDocumentUrlFront: text("id_document_url_front"),
  idDocumentUrlBack: text("id_document_url_back"),
  idDocumentUploadedAt: timestamp("id_document_uploaded_at"),
  idJurisdictionCode: text("id_jurisdiction_code"),
  idScanRequestedAt: timestamp("id_scan_requested_at"),
  idScanRequestedBy: integer("id_scan_requested_by"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type ProfileVault = typeof profileVaultTable.$inferSelect;
