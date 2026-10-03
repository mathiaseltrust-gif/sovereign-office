CREATE TABLE IF NOT EXISTS "document_registry" (
  "id" serial PRIMARY KEY NOT NULL,
  "document_ref" varchar(80) NOT NULL,
  "title" text,
  "original_filename" text NOT NULL,
  "mime_type" varchar(150),
  "size_bytes" bigint,
  "sha256" varchar(64),
  "storage_provider" varchar(60) DEFAULT 'office_object_storage' NOT NULL,
  "storage_key" text,
  "external_id" text,
  "source_channel" varchar(60) DEFAULT 'manual_upload' NOT NULL,
  "source_uri" text,
  "classification" varchar(100),
  "verification_state" varchar(40) DEFAULT 'unverified' NOT NULL,
  "sensitivity_level" varchar(40) DEFAULT 'internal' NOT NULL,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_by" integer,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "document_registry_document_ref_unique" UNIQUE("document_ref"),
  CONSTRAINT "document_registry_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "document_registry_sha_idx" ON "document_registry" USING btree ("sha256");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "document_registry_storage_idx" ON "document_registry" USING btree ("storage_provider");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "document_associations" (
  "id" serial PRIMARY KEY NOT NULL,
  "document_id" integer NOT NULL,
  "entity_type" varchar(60) NOT NULL,
  "entity_id" varchar(160) NOT NULL,
  "relationship_type" varchar(80) NOT NULL,
  "confidence" varchar(30) DEFAULT 'medium' NOT NULL,
  "resolution_method" varchar(80) DEFAULT 'manual' NOT NULL,
  "status" varchar(30) DEFAULT 'active' NOT NULL,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "verified_by" integer,
  "verified_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "document_associations_document_id_document_registry_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."document_registry"("id") ON DELETE cascade ON UPDATE no action,
  CONSTRAINT "document_associations_verified_by_users_id_fk" FOREIGN KEY ("verified_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "document_association_unique" ON "document_associations" USING btree ("document_id","entity_type","entity_id","relationship_type");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "document_association_entity_idx" ON "document_associations" USING btree ("entity_type","entity_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "document_association_document_idx" ON "document_associations" USING btree ("document_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "document_listener_events" (
  "id" serial PRIMARY KEY NOT NULL,
  "document_id" integer NOT NULL,
  "listener_name" varchar(120) NOT NULL,
  "event_type" varchar(120) NOT NULL,
  "action_state" varchar(40) DEFAULT 'observed' NOT NULL,
  "payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "document_listener_events_document_id_document_registry_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."document_registry"("id") ON DELETE cascade ON UPDATE no action
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "document_listener_event_document_idx" ON "document_listener_events" USING btree ("document_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "document_listener_event_type_idx" ON "document_listener_events" USING btree ("event_type");
