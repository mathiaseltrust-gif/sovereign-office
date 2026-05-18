import { pgTable, serial, integer, text, varchar, timestamp, boolean, jsonb } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const medicalNotesTable = pgTable("medical_notes", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  noteType: varchar("note_type", { length: 50 }).notNull().default("general"),
  patientName: text("patient_name"),
  forDependent: boolean("for_dependent").notNull().default(false),
  dependentName: text("dependent_name"),
  protectionLevel: varchar("protection_level", { length: 20 }).notNull().default("standard"),
  noteText: text("note_text").notNull(),
  meta: jsonb("meta"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type MedicalNote = typeof medicalNotesTable.$inferSelect;
export type InsertMedicalNote = typeof medicalNotesTable.$inferInsert;
