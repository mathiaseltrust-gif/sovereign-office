import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const authorityMatterRoutingTable = pgTable("authority_matter_routing", {
  id: serial("id").primaryKey(),
  matterType: text("matter_type").notNull().unique(),
  matterLabel: text("matter_label").notNull(),
  primaryEntityType: text("primary_entity_type").notNull(),
  oversightEntityType: text("oversight_entity_type"),
  requiredNoticeTemplate: text("required_notice_template"),
  escalationTemplate: text("escalation_template"),
  legalFlagGroup: text("legal_flag_group").array().notNull().default([]),
  primaryRecipientNote: text("primary_recipient_note"),
  oversightRecipientNote: text("oversight_recipient_note"),
  escalationPath: text("escalation_path"),
  tribalLawApplicable: text("tribal_law_applicable"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertAuthorityMatterRoutingSchema = createInsertSchema(authorityMatterRoutingTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertAuthorityMatterRouting = z.infer<typeof insertAuthorityMatterRoutingSchema>;
export type AuthorityMatterRouting = typeof authorityMatterRoutingTable.$inferSelect;
