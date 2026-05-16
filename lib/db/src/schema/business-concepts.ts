import { pgTable, serial, integer, text, jsonb, varchar, timestamp } from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { familyLineageTable } from "./family-lineage";

export const businessConceptsTable = pgTable("business_concepts", {
  id: serial("id").primaryKey(),
  ownerId: integer("owner_id").references(() => usersTable.id, { onDelete: "set null" }),
  title: text("title").notNull(),
  description: text("description").notNull().default(""),
  structure: varchar("structure", { length: 100 }).default(""),
  status: varchar("status", { length: 50 }).notNull().default("draft"),
  aiSummary: text("ai_summary"),
  suggestedStructures: jsonb("suggested_structures").default([]),
  protections: jsonb("protections").default([]),
  agenciesToContact: jsonb("agencies_to_contact").default([]),
  planOutline: jsonb("plan_outline").default({}),
  modelCanvas: jsonb("model_canvas").default({}),
  provisions: jsonb("provisions").default([]),
  whatNextSteps: jsonb("what_next_steps").default([]),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const businessBoardMembersTable = pgTable("business_board_members", {
  id: serial("id").primaryKey(),
  conceptId: integer("concept_id").notNull().references(() => businessConceptsTable.id, { onDelete: "cascade" }),
  directoryMemberId: integer("directory_member_id").references(() => familyLineageTable.id, { onDelete: "set null" }),
  memberName: text("member_name").notNull(),
  memberRole: text("member_role").notNull(),
  startDate: text("start_date"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const businessVotesTable = pgTable("business_votes", {
  id: serial("id").primaryKey(),
  conceptId: integer("concept_id").references(() => businessConceptsTable.id, { onDelete: "set null" }),
  createdBy: integer("created_by").references(() => usersTable.id, { onDelete: "set null" }),
  title: text("title").notNull(),
  description: text("description").notNull().default(""),
  motionType: varchar("motion_type", { length: 60 }).notNull().default("procedural"),
  status: varchar("status", { length: 30 }).notNull().default("open"),
  yesCount: integer("yes_count").notNull().default(0),
  noCount: integer("no_count").notNull().default(0),
  abstainCount: integer("abstain_count").notNull().default(0),
  voteRecords: jsonb("vote_records").default([]),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  closedAt: timestamp("closed_at"),
});

export const businessDocumentsTable = pgTable("business_documents", {
  id: serial("id").primaryKey(),
  conceptId: integer("concept_id").notNull().references(() => businessConceptsTable.id, { onDelete: "cascade" }),
  filename: text("filename").notNull(),
  uploadedAt: timestamp("uploaded_at").defaultNow().notNull(),
  uploadedBy: text("uploaded_by"),
  fileKey: text("file_key"),
});

export type BusinessConcept = typeof businessConceptsTable.$inferSelect;
export type InsertBusinessConcept = typeof businessConceptsTable.$inferInsert;
export type BusinessBoardMember = typeof businessBoardMembersTable.$inferSelect;
export type BusinessDocument = typeof businessDocumentsTable.$inferSelect;
