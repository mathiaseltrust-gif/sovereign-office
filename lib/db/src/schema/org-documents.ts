import { pgTable, serial, varchar, text, integer, timestamp } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const orgProfilesTable = pgTable("org_profiles", {
  id: serial("id").primaryKey(),
  orgId: varchar("org_id", { length: 100 }).notNull().unique(),
  ein: text("ein"),
  legalName: text("legal_name"),
  exemptType: text("exempt_type"),
  notes: text("notes"),
  updatedBy: integer("updated_by").references(() => usersTable.id, { onDelete: "set null" }),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const orgDocumentsTable = pgTable("org_documents", {
  id: serial("id").primaryKey(),
  orgId: varchar("org_id", { length: 100 }).notNull(),
  docType: varchar("doc_type", { length: 100 }).notNull().default("general"),
  label: text("label").notNull(),
  filename: text("filename").notNull(),
  fileKey: text("file_key"),
  description: text("description"),
  uploadedBy: integer("uploaded_by").references(() => usersTable.id, { onDelete: "set null" }),
  uploadedAt: timestamp("uploaded_at").defaultNow().notNull(),
});

export type OrgProfile = typeof orgProfilesTable.$inferSelect;
export type OrgDocument = typeof orgDocumentsTable.$inferSelect;
