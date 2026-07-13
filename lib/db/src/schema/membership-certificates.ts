import { pgTable, serial, integer, text, varchar, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const membershipCertificatesTable = pgTable("membership_certificates", {
  id: serial("id").primaryKey(),
  certNumber: varchar("cert_number", { length: 50 }).notNull().unique(),
  year: integer("year").notNull(),
  seq: integer("seq").notNull(),
  memberId: integer("member_id").notNull(),
  memberName: varchar("member_name", { length: 400 }).notNull(),
  memberDob: varchar("member_dob", { length: 100 }),
  memberAge: integer("member_age"),
  memberEnrollment: varchar("member_enrollment", { length: 100 }),
  memberAddress: text("member_address"),
  membershipType: varchar("membership_type", { length: 100 }).default("lineal_descendant").notNull(),
  signaturesApplied: jsonb("signatures_applied").default([]),
  storageObjectPath: text("storage_object_path"),
  issuedByUserId: integer("issued_by_user_id"),
  issuedAt: timestamp("issued_at").defaultNow().notNull(),
  status: varchar("status", { length: 50 }).default("active").notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const officeSignaturesTable = pgTable("office_signatures", {
  id: serial("id").primaryKey(),
  slot: varchar("slot", { length: 50 }).notNull().unique(),
  signerName: varchar("signer_name", { length: 400 }).notNull(),
  signerTitle: varchar("signer_title", { length: 400 }).notNull(),
  storageObjectPath: text("storage_object_path"),
  isActive: boolean("is_active").default(true).notNull(),
  uploadedByUserId: integer("uploaded_by_user_id"),
  uploadedAt: timestamp("uploaded_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertMembershipCertificateSchema = createInsertSchema(membershipCertificatesTable).omit({ id: true, createdAt: true });
export const insertOfficeSignatureSchema = createInsertSchema(officeSignaturesTable).omit({ id: true });

export type MembershipCertificate = typeof membershipCertificatesTable.$inferSelect;
export type OfficeSignature = typeof officeSignaturesTable.$inferSelect;
export type InsertMembershipCertificate = z.infer<typeof insertMembershipCertificateSchema>;
export type InsertOfficeSignature = z.infer<typeof insertOfficeSignatureSchema>;
