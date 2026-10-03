import { pgTable, serial, integer, varchar, text, bigint, jsonb, timestamp, uniqueIndex, index, boolean } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const documentRegistryTable = pgTable("document_registry", {
  id: serial("id").primaryKey(),
  documentRef: varchar("document_ref", { length: 80 }).notNull().unique(),
  title: text("title"),
  originalFilename: text("original_filename").notNull(),
  mimeType: varchar("mime_type", { length: 150 }),
  sizeBytes: bigint("size_bytes", { mode: "number" }),
  sha256: varchar("sha256", { length: 64 }),
  storageProvider: varchar("storage_provider", { length: 60 }).notNull().default("office_object_storage"),
  storageKey: text("storage_key"),
  externalId: text("external_id"),
  sourceChannel: varchar("source_channel", { length: 60 }).notNull().default("manual_upload"),
  sourceUri: text("source_uri"),
  classification: varchar("classification", { length: 100 }),
  verificationState: varchar("verification_state", { length: 40 }).notNull().default("unverified"),
  sensitivityLevel: varchar("sensitivity_level", { length: 40 }).notNull().default("internal"),
  metadata: jsonb("metadata").notNull().default({}),
  createdBy: integer("created_by").references(() => usersTable.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  shaIdx: index("document_registry_sha_idx").on(table.sha256),
  storageIdx: index("document_registry_storage_idx").on(table.storageProvider),
}));

export const documentAssociationsTable = pgTable("document_associations", {
  id: serial("id").primaryKey(),
  documentId: integer("document_id").notNull().references(() => documentRegistryTable.id, { onDelete: "cascade" }),
  entityType: varchar("entity_type", { length: 60 }).notNull(),
  entityId: varchar("entity_id", { length: 160 }).notNull(),
  relationshipType: varchar("relationship_type", { length: 80 }).notNull(),
  confidence: varchar("confidence", { length: 30 }).notNull().default("medium"),
  resolutionMethod: varchar("resolution_method", { length: 80 }).notNull().default("manual"),
  status: varchar("status", { length: 30 }).notNull().default("active"),
  metadata: jsonb("metadata").notNull().default({}),
  verifiedBy: integer("verified_by").references(() => usersTable.id, { onDelete: "set null" }),
  verifiedAt: timestamp("verified_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  uniqueAssociation: uniqueIndex("document_association_unique").on(
    table.documentId,
    table.entityType,
    table.entityId,
    table.relationshipType,
  ),
  entityIdx: index("document_association_entity_idx").on(table.entityType, table.entityId),
  documentIdx: index("document_association_document_idx").on(table.documentId),
}));

export const entityAliasesTable = pgTable("entity_aliases", {
  id: serial("id").primaryKey(),
  entityType: varchar("entity_type", { length: 60 }).notNull(),
  entityId: varchar("entity_id", { length: 160 }).notNull(),
  aliasType: varchar("alias_type", { length: 80 }).notNull(),
  aliasValue: text("alias_value").notNull(),
  normalizedValue: text("normalized_value").notNull(),
  verified: boolean("verified").notNull().default(false),
  source: varchar("source", { length: 120 }).notNull().default("manual"),
  createdBy: integer("created_by").references(() => usersTable.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  uniqueAlias: uniqueIndex("entity_alias_unique").on(
    table.entityType,
    table.entityId,
    table.aliasType,
    table.normalizedValue,
  ),
  lookupIdx: index("entity_alias_lookup_idx").on(
    table.entityType,
    table.aliasType,
    table.normalizedValue,
  ),
}));

export const documentListenerEventsTable = pgTable("document_listener_events", {
  id: serial("id").primaryKey(),
  documentId: integer("document_id").notNull().references(() => documentRegistryTable.id, { onDelete: "cascade" }),
  listenerName: varchar("listener_name", { length: 120 }).notNull(),
  eventType: varchar("event_type", { length: 120 }).notNull(),
  actionState: varchar("action_state", { length: 40 }).notNull().default("observed"),
  payload: jsonb("payload").notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  documentIdx: index("document_listener_event_document_idx").on(table.documentId),
  eventIdx: index("document_listener_event_type_idx").on(table.eventType),
}));

export type DocumentRegistryRecord = typeof documentRegistryTable.$inferSelect;
export type DocumentAssociation = typeof documentAssociationsTable.$inferSelect;
export type DocumentListenerEvent = typeof documentListenerEventsTable.$inferSelect;

export type EntityAlias = typeof entityAliasesTable.$inferSelect;
