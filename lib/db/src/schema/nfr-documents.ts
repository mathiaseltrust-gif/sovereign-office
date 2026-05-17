import { pgTable, serial, integer, text, jsonb, varchar, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const nfrDocumentsTable = pgTable("nfr_documents", {
  id: serial("id").primaryKey(),
  classificationId: integer("classification_id").notNull(),
  doctrineApplied: jsonb("doctrine_applied").default({}),
  content: text("content").notNull(),
  pdfUrl: text("pdf_url"),
  status: varchar("status", { length: 50 }).notNull().default("draft"),
  tribalRef: varchar("tribal_ref", { length: 50 }),
  certifiedMailNumber: text("certified_mail_number"),
  sentAt: timestamp("sent_at", { withTimezone: true }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertNfrDocumentSchema = createInsertSchema(nfrDocumentsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertNfrDocument = z.infer<typeof insertNfrDocumentSchema>;
export type NfrDocument = typeof nfrDocumentsTable.$inferSelect;
