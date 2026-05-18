import { pgTable, serial, text, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const authorityLegalMapTable = pgTable("legal_authority_map", {
  id: serial("id").primaryKey(),
  issueType: text("issue_type").notNull(),
  authorityName: text("authority_name").notNull(),
  federalAuthority: text("federal_authority"),
  stateAuthority: text("state_authority"),
  tribalAuthority: text("tribal_authority"),
  cfrReference: text("cfr_reference"),
  uscReference: text("usc_reference"),
  caseLawReference: text("case_law_reference"),
  appliesWhen: text("applies_when"),
  warningOrLimit: text("warning_or_limit"),
  templateLanguageSnippet: text("template_language_snippet"),
  reviewRequired: boolean("review_required").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertAuthorityLegalMapSchema = createInsertSchema(authorityLegalMapTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertAuthorityLegalMap = z.infer<typeof insertAuthorityLegalMapSchema>;
export type AuthorityLegalMap = typeof authorityLegalMapTable.$inferSelect;
