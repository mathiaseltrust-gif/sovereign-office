import { pgTable, serial, text, timestamp, integer } from "drizzle-orm/pg-core";

export const gweLettersTable = pgTable("gwe_letters", {
  id: serial("id").primaryKey(),
  recipientName: text("recipient_name").notNull(),
  letterDate: text("letter_date").notNull(),
  programName: text("program_name").notNull(),
  exclusionBasis: text("exclusion_basis").notNull(),
  amount: text("amount").notNull(),
  issuingOfficer: text("issuing_officer").notNull(),
  storageKey: text("storage_key"),
  generatedBy: text("generated_by"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
