CREATE TABLE IF NOT EXISTS "board_matters" (
  "id" serial PRIMARY KEY NOT NULL,
  "title" text NOT NULL,
  "summary" text,
  "matter_type" varchar(80) DEFAULT 'governance' NOT NULL,
  "source_type" varchar(80),
  "source_id" varchar(120),
  "org_id" varchar(100) DEFAULT 'board_of_trustees' NOT NULL,
  "status" varchar(50) DEFAULT 'new' NOT NULL,
  "priority" varchar(30) DEFAULT 'normal' NOT NULL,
  "assigned_to" integer,
  "responsible_office" text,
  "due_date" timestamp,
  "board_action" text,
  "response_required" boolean DEFAULT false NOT NULL,
  "evidence_required" boolean DEFAULT false NOT NULL,
  "closure_notes" text,
  "linked_task_id" integer,
  "linked_calendar_event_id" integer,
  "created_by" integer,
  "closed_by" integer,
  "closed_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "board_matters_assigned_to_users_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action,
  CONSTRAINT "board_matters_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action,
  CONSTRAINT "board_matters_closed_by_users_id_fk" FOREIGN KEY ("closed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "board_matters_status_idx" ON "board_matters" USING btree ("status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "board_matters_due_date_idx" ON "board_matters" USING btree ("due_date");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "board_matters_org_id_idx" ON "board_matters" USING btree ("org_id");
