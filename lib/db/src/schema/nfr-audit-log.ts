import { pgTable, serial, integer, text, jsonb, varchar, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const nfrAuditLogTable = pgTable("nfr_audit_log", {
  id: serial("id").primaryKey(),
  userId: integer("user_id"),
  action: varchar("action", { length: 80 }).notNull(),
  resourceType: varchar("resource_type", { length: 60 }).notNull(),
  resourceId: integer("resource_id"),
  resourceRef: varchar("resource_ref", { length: 100 }),
  beforeValue: jsonb("before_value"),
  afterValue: jsonb("after_value"),
  metadata: jsonb("metadata").default({}),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertNfrAuditLogSchema = createInsertSchema(nfrAuditLogTable).omit({
  id: true, createdAt: true,
});
export type InsertNfrAuditLog = z.infer<typeof insertNfrAuditLogSchema>;
export type NfrAuditLog = typeof nfrAuditLogTable.$inferSelect;
