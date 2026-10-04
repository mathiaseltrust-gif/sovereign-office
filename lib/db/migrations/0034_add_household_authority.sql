CREATE TABLE IF NOT EXISTS "household_authority" (
  "id" serial PRIMARY KEY NOT NULL,
  "owner_user_id" integer NOT NULL,
  "head_lineage_id" integer NOT NULL,
  "member_lineage_id" integer NOT NULL,
  "relationship_type" varchar(50) NOT NULL,
  "parentage_type" varchar(50),
  "status" varchar(30) DEFAULT 'active' NOT NULL,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_by" integer,
  "approved_by" integer,
  "approved_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "household_authority_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action,
  CONSTRAINT "household_authority_head_lineage_id_family_lineage_id_fk" FOREIGN KEY ("head_lineage_id") REFERENCES "public"."family_lineage"("id") ON DELETE cascade ON UPDATE no action,
  CONSTRAINT "household_authority_member_lineage_id_family_lineage_id_fk" FOREIGN KEY ("member_lineage_id") REFERENCES "public"."family_lineage"("id") ON DELETE cascade ON UPDATE no action,
  CONSTRAINT "household_authority_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action,
  CONSTRAINT "household_authority_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "household_authority_owner_member_unique" ON "household_authority" USING btree ("owner_user_id","member_lineage_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "household_authority_owner_idx" ON "household_authority" USING btree ("owner_user_id","status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "household_authority_member_idx" ON "household_authority" USING btree ("member_lineage_id","status");
