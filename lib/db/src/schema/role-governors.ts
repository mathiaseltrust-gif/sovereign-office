import { pgTable, serial, varchar, text, boolean, integer, timestamp } from "drizzle-orm/pg-core";

export const roleGovernorsTable = pgTable("role_governors", {
  id: serial("id").primaryKey(),
  roleKey: varchar("role_key", { length: 64 }).notNull().unique(),
  displayName: varchar("display_name", { length: 128 }).notNull(),
  postureStatement: text("posture_statement").notNull().default(""),
  jurisdictionalScope: text("jurisdictional_scope").notNull().default(""),
  toneDirectives: text("tone_directives").notNull().default(""),
  authorityCitation: text("authority_citation").notNull().default(""),
  signatureBlockTemplate: text("signature_block_template").notNull().default(""),
  documentHeaderTemplate: text("document_header_template").notNull().default(""),
  isActive: boolean("is_active").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const governorActivationLogTable = pgTable("governor_activation_log", {
  id: serial("id").primaryKey(),
  governorId: integer("governor_id").notNull(),
  roleKey: varchar("role_key", { length: 64 }).notNull(),
  eventType: varchar("event_type", { length: 32 }).notNull().default("activation"),
  documentId: integer("document_id"),
  documentType: varchar("document_type", { length: 128 }),
  actingUserId: integer("acting_user_id"),
  actingUserEmail: varchar("acting_user_email", { length: 255 }),
  activatedAt: timestamp("activated_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const userGovernorSessionsTable = pgTable("user_governor_sessions", {
  userId: integer("user_id").primaryKey().notNull(),
  governorId: integer("governor_id")
    .notNull()
    .references(() => roleGovernorsTable.id, { onDelete: "cascade" }),
  activatedAt: timestamp("activated_at", { withTimezone: true }).defaultNow().notNull(),
});

export type RoleGovernor = typeof roleGovernorsTable.$inferSelect;
export type InsertRoleGovernor = typeof roleGovernorsTable.$inferInsert;
export type GovernorActivationLog = typeof governorActivationLogTable.$inferSelect;
export type InsertGovernorActivationLog = typeof governorActivationLogTable.$inferInsert;
export type UserGovernorSession = typeof userGovernorSessionsTable.$inferSelect;
