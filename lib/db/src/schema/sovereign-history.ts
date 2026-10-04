import { pgTable, serial, integer, varchar, text, jsonb, timestamp, uniqueIndex, index } from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { documentRegistryTable } from "./document-associations";

/**
 * Chronological institutional history.
 *
 * An event records what the Office says happened and its evidentiary posture.
 * It is intentionally separate from entity/document records so one event can
 * appear in several contexts without duplication.
 */
export const sovereignHistoryEventsTable = pgTable("sovereign_history_events", {
  id: serial("id").primaryKey(),
  eventRef: varchar("event_ref", { length: 80 }).notNull().unique(),
  title: text("title").notNull(),
  summary: text("summary"),
  eventType: varchar("event_type", { length: 80 }).notNull().default("historical_event"),
  occurredAt: timestamp("occurred_at", { withTimezone: true }),
  occurredEndAt: timestamp("occurred_end_at", { withTimezone: true }),
  dateLabel: text("date_label"),
  datePrecision: varchar("date_precision", { length: 30 }).notNull().default("exact"),
  recordStatus: varchar("record_status", { length: 30 }).notNull().default("asserted"),
  sourceType: varchar("source_type", { length: 60 }).notNull().default("manual"),
  sourceSummary: text("source_summary"),
  sensitivityLevel: varchar("sensitivity_level", { length: 40 }).notNull().default("internal"),
  metadata: jsonb("metadata").notNull().default({}),
  createdBy: integer("created_by").references(() => usersTable.id, { onDelete: "set null" }),
  verifiedBy: integer("verified_by").references(() => usersTable.id, { onDelete: "set null" }),
  verifiedAt: timestamp("verified_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  occurredIdx: index("sovereign_history_events_occurred_idx").on(table.occurredAt),
  statusIdx: index("sovereign_history_events_status_idx").on(table.recordStatus),
}));

export const sovereignHistoryEventEntitiesTable = pgTable("sovereign_history_event_entities", {
  id: serial("id").primaryKey(),
  eventId: integer("event_id").notNull().references(() => sovereignHistoryEventsTable.id, { onDelete: "cascade" }),
  entityType: varchar("entity_type", { length: 60 }).notNull(),
  entityId: varchar("entity_id", { length: 160 }).notNull(),
  relationshipType: varchar("relationship_type", { length: 80 }).notNull().default("subject"),
  metadata: jsonb("metadata").notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  uniqueEntityLink: uniqueIndex("sovereign_history_event_entity_unique").on(
    table.eventId,
    table.entityType,
    table.entityId,
    table.relationshipType,
  ),
  entityIdx: index("sovereign_history_event_entity_idx").on(table.entityType, table.entityId),
}));

export const sovereignHistoryEventDocumentsTable = pgTable("sovereign_history_event_documents", {
  id: serial("id").primaryKey(),
  eventId: integer("event_id").notNull().references(() => sovereignHistoryEventsTable.id, { onDelete: "cascade" }),
  documentId: integer("document_id").notNull().references(() => documentRegistryTable.id, { onDelete: "cascade" }),
  relationshipType: varchar("relationship_type", { length: 80 }).notNull().default("supporting_evidence"),
  createdBy: integer("created_by").references(() => usersTable.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  uniqueDocumentLink: uniqueIndex("sovereign_history_event_document_unique").on(
    table.eventId,
    table.documentId,
    table.relationshipType,
  ),
  eventIdx: index("sovereign_history_event_document_event_idx").on(table.eventId),
  documentIdx: index("sovereign_history_event_document_document_idx").on(table.documentId),
}));

export type SovereignHistoryEvent = typeof sovereignHistoryEventsTable.$inferSelect;
export type SovereignHistoryEventEntity = typeof sovereignHistoryEventEntitiesTable.$inferSelect;
export type SovereignHistoryEventDocument = typeof sovereignHistoryEventDocumentsTable.$inferSelect;
