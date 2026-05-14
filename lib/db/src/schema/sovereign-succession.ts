import { pgTable, serial, integer, text, boolean, timestamp } from "drizzle-orm/pg-core";

export const sovereignSuccessionTable = pgTable("sovereign_succession_vault", {
  id: serial("id").primaryKey(),
  createdByUserId: integer("created_by_user_id").notNull(),
  delegateName: text("delegate_name").notNull(),
  delegateNotes: text("delegate_notes"),
  passcodeHash: text("passcode_hash").notNull(),
  instructions: text("instructions"),
  isConfigured: boolean("is_configured").notNull().default(true),
  isActivated: boolean("is_activated").notNull().default(false),
  activatedAt: timestamp("activated_at"),
  activatedByEntry: text("activated_by_entry"),
  revokedAt: timestamp("revoked_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type SovereignSuccessionRecord = typeof sovereignSuccessionTable.$inferSelect;
