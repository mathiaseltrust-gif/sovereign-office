import { pgTable, serial, integer, varchar, jsonb, timestamp, uniqueIndex, index } from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { familyLineageTable } from "./family-lineage";

export const householdAuthorityTable = pgTable("household_authority", {
  id: serial("id").primaryKey(),
  ownerUserId: integer("owner_user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  headLineageId: integer("head_lineage_id").notNull().references(() => familyLineageTable.id, { onDelete: "cascade" }),
  memberLineageId: integer("member_lineage_id").notNull().references(() => familyLineageTable.id, { onDelete: "cascade" }),
  relationshipType: varchar("relationship_type", { length: 50 }).notNull(),
  parentageType: varchar("parentage_type", { length: 50 }),
  status: varchar("status", { length: 30 }).notNull().default("active"),
  metadata: jsonb("metadata").notNull().default({}),
  createdBy: integer("created_by").references(() => usersTable.id, { onDelete: "set null" }),
  approvedBy: integer("approved_by").references(() => usersTable.id, { onDelete: "set null" }),
  approvedAt: timestamp("approved_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  ownerMemberUnique: uniqueIndex("household_authority_owner_member_unique").on(table.ownerUserId, table.memberLineageId),
  ownerIdx: index("household_authority_owner_idx").on(table.ownerUserId, table.status),
  memberIdx: index("household_authority_member_idx").on(table.memberLineageId, table.status),
}));

export type HouseholdAuthority = typeof householdAuthorityTable.$inferSelect;
