import { pgTable, serial, integer, text, jsonb, varchar, timestamp } from "drizzle-orm/pg-core";
import { customType } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

const bytea = customType<{ data: Buffer; notNull: false; default: false }>({
  dataType() {
    return "bytea";
  },
  toDriver(val: Buffer) {
    return val;
  },
  fromDriver(val: unknown) {
    if (typeof val === "string") return Buffer.from(val, "hex");
    return val as Buffer;
  },
});

export const trustInstrumentsTable = pgTable("trust_instruments", {
  id: serial("id").primaryKey(),
  userId: integer("user_id"),
  title: text("title").notNull(),
  instrumentType: varchar("instrument_type", { length: 100 }).notNull().default("trust_instrument"),
  landJson: jsonb("land_json").default({}),
  partiesJson: jsonb("parties_json").default([]),
  provisionsJson: jsonb("provisions_json").default([]),
  recorderMetadata: jsonb("recorder_metadata").default({}),
  trusteeNotes: text("trustee_notes"),
  content: text("content").notNull(),
  pdfBuffer: bytea("pdf_buffer"),
  pdfUrl: text("pdf_url"),
  validationErrors: jsonb("validation_errors").default([]),
  status: varchar("status", { length: 50 }).notNull().default("draft"),
  jurisdiction: varchar("jurisdiction", { length: 255 }),
  state: varchar("state", { length: 50 }),
  county: varchar("county", { length: 100 }),
  landClassification: varchar("land_classification", { length: 100 }),
  versionHistory: jsonb("version_history").default([]),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertTrustInstrumentSchema = createInsertSchema(trustInstrumentsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertTrustInstrument = z.infer<typeof insertTrustInstrumentSchema>;
export type TrustInstrument = typeof trustInstrumentsTable.$inferSelect;
