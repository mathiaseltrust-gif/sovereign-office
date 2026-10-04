CREATE TABLE IF NOT EXISTS "sovereign_history_events" (
  "id" serial PRIMARY KEY NOT NULL,
  "event_ref" varchar(80) NOT NULL,
  "title" text NOT NULL,
  "summary" text,
  "event_type" varchar(80) DEFAULT 'historical_event' NOT NULL,
  "occurred_at" timestamp with time zone,
  "occurred_end_at" timestamp with time zone,
  "date_label" text,
  "date_precision" varchar(30) DEFAULT 'exact' NOT NULL,
  "record_status" varchar(30) DEFAULT 'asserted' NOT NULL,
  "source_type" varchar(60) DEFAULT 'manual' NOT NULL,
  "source_summary" text,
  "sensitivity_level" varchar(40) DEFAULT 'internal' NOT NULL,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_by" integer,
  "verified_by" integer,
  "verified_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "sovereign_history_events_event_ref_unique" UNIQUE("event_ref"),
  CONSTRAINT "sovereign_history_events_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action,
  CONSTRAINT "sovereign_history_events_verified_by_users_id_fk" FOREIGN KEY ("verified_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sovereign_history_events_occurred_idx" ON "sovereign_history_events" USING btree ("occurred_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sovereign_history_events_status_idx" ON "sovereign_history_events" USING btree ("record_status");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sovereign_history_event_entities" (
  "id" serial PRIMARY KEY NOT NULL,
  "event_id" integer NOT NULL,
  "entity_type" varchar(60) NOT NULL,
  "entity_id" varchar(160) NOT NULL,
  "relationship_type" varchar(80) DEFAULT 'subject' NOT NULL,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "sovereign_history_event_entities_event_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."sovereign_history_events"("id") ON DELETE cascade ON UPDATE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "sovereign_history_event_entity_unique" ON "sovereign_history_event_entities" USING btree ("event_id","entity_type","entity_id","relationship_type");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sovereign_history_event_entity_idx" ON "sovereign_history_event_entities" USING btree ("entity_type","entity_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sovereign_history_event_documents" (
  "id" serial PRIMARY KEY NOT NULL,
  "event_id" integer NOT NULL,
  "document_id" integer NOT NULL,
  "relationship_type" varchar(80) DEFAULT 'supporting_evidence' NOT NULL,
  "created_by" integer,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "sovereign_history_event_documents_event_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."sovereign_history_events"("id") ON DELETE cascade ON UPDATE no action,
  CONSTRAINT "sovereign_history_event_documents_document_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."document_registry"("id") ON DELETE cascade ON UPDATE no action,
  CONSTRAINT "sovereign_history_event_documents_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "sovereign_history_event_document_unique" ON "sovereign_history_event_documents" USING btree ("event_id","document_id","relationship_type");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sovereign_history_event_document_event_idx" ON "sovereign_history_event_documents" USING btree ("event_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sovereign_history_event_document_document_idx" ON "sovereign_history_event_documents" USING btree ("document_id");
