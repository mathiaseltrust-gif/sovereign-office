import { pgTable, serial, integer, text, timestamp, jsonb } from "drizzle-orm/pg-core";

export const delegationsTable = pgTable("delegations", {
  id: serial("id").primaryKey(),
  delegatorId: integer("delegator_id").notNull(),
  delegateeId: integer("delegatee_id").notNull(),
  scopes: jsonb("scopes").notNull().default([]),
  reason: text("reason"),
  note: text("note"),
  expiresAt: timestamp("expires_at"),
  revokedAt: timestamp("revoked_at"),
  revokedReason: text("revoked_reason"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type Delegation = typeof delegationsTable.$inferSelect;
export type InsertDelegation = typeof delegationsTable.$inferInsert;
