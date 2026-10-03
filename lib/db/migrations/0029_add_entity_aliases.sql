CREATE TABLE IF NOT EXISTS "entity_aliases" (
  "id" serial PRIMARY KEY NOT NULL,
  "entity_type" varchar(60) NOT NULL,
  "entity_id" varchar(160) NOT NULL,
  "alias_type" varchar(80) NOT NULL,
  "alias_value" text NOT NULL,
  "normalized_value" text NOT NULL,
  "verified" boolean DEFAULT false NOT NULL,
  "source" varchar(120) DEFAULT 'manual' NOT NULL,
  "created_by" integer,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "entity_aliases_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "entity_alias_unique" ON "entity_aliases" USING btree ("entity_type","entity_id","alias_type","normalized_value");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "entity_alias_lookup_idx" ON "entity_aliases" USING btree ("entity_type","alias_type","normalized_value");
