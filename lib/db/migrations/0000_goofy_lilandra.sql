CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"entra_id" varchar(255),
	"email" varchar(255) NOT NULL,
	"name" text NOT NULL,
	"role" varchar(50) DEFAULT 'member' NOT NULL,
	"entra_required" boolean DEFAULT false NOT NULL,
	"trust_privileges" boolean DEFAULT false NOT NULL,
	"password_hash" varchar(255),
	"password_salt" varchar(64),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "profiles" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"bio" text,
	"preferred_jurisdiction" text,
	"ai_preferences" jsonb DEFAULT '{}'::jsonb,
	"search_history" jsonb DEFAULT '[]'::jsonb,
	"legal_name" text,
	"preferred_name" text,
	"tribal_name" text,
	"nickname" text,
	"title" text,
	"family_group" text,
	"jurisdiction_tags" jsonb DEFAULT '[]'::jsonb,
	"welfare_tags" jsonb DEFAULT '[]'::jsonb,
	"notification_preferences" jsonb DEFAULT '{}'::jsonb,
	"membership_verified" boolean DEFAULT false NOT NULL,
	"entra_verified" boolean DEFAULT false NOT NULL,
	"lineage_verified" boolean DEFAULT false NOT NULL,
	"delegated_authorities" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "complaints" (
	"id" serial PRIMARY KEY NOT NULL,
	"text" text NOT NULL,
	"pdf_path" text,
	"classification" jsonb DEFAULT '{}'::jsonb,
	"officer_id" integer,
	"status" varchar(50) DEFAULT 'open' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "classifications" (
	"id" serial PRIMARY KEY NOT NULL,
	"actor_type" varchar(100) NOT NULL,
	"land_status" varchar(100) NOT NULL,
	"action_type" varchar(100) NOT NULL,
	"raw_text" text NOT NULL,
	"source_type" varchar(50) DEFAULT 'text' NOT NULL,
	"doctrine_applied" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "nfr_documents" (
	"id" serial PRIMARY KEY NOT NULL,
	"classification_id" integer NOT NULL,
	"doctrine_applied" jsonb DEFAULT '{}'::jsonb,
	"content" text NOT NULL,
	"pdf_url" text,
	"status" varchar(50) DEFAULT 'draft' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tasks" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"due_date" timestamp,
	"status" varchar(50) DEFAULT 'pending' NOT NULL,
	"assigned_to" integer,
	"complaint_id" integer,
	"nfr_id" integer,
	"calendar_event_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "calendar_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"date" timestamp NOT NULL,
	"type" varchar(50) DEFAULT 'general' NOT NULL,
	"related_id" integer,
	"related_type" varchar(50),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "search_index" (
	"id" serial PRIMARY KEY NOT NULL,
	"entity_type" varchar(50) NOT NULL,
	"entity_id" text NOT NULL,
	"content" text NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "templates" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"content" text NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"status" varchar(50) DEFAULT 'draft' NOT NULL,
	"jurisdiction" text,
	"created_by" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recorder_rules" (
	"id" serial PRIMARY KEY NOT NULL,
	"state" text NOT NULL,
	"county" text,
	"rules" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"statutes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"indian_land_classifications" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_learning" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"category" varchar(100) NOT NULL,
	"key" text NOT NULL,
	"value" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trust_instruments" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer,
	"title" text NOT NULL,
	"instrument_type" varchar(100) DEFAULT 'trust_instrument' NOT NULL,
	"land_json" jsonb DEFAULT '{}'::jsonb,
	"parties_json" jsonb DEFAULT '[]'::jsonb,
	"provisions_json" jsonb DEFAULT '[]'::jsonb,
	"recorder_metadata" jsonb DEFAULT '{}'::jsonb,
	"trustee_notes" text,
	"content" text NOT NULL,
	"pdf_buffer" "bytea",
	"pdf_url" text,
	"validation_errors" jsonb DEFAULT '[]'::jsonb,
	"status" varchar(50) DEFAULT 'draft' NOT NULL,
	"jurisdiction" varchar(255),
	"state" varchar(50),
	"county" varchar(100),
	"land_classification" varchar(100),
	"tract_number" varchar(100),
	"template_key" varchar(100),
	"version_history" jsonb DEFAULT '[]'::jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trust_filings" (
	"id" serial PRIMARY KEY NOT NULL,
	"instrument_id" integer NOT NULL,
	"county" varchar(100) NOT NULL,
	"state" varchar(50) NOT NULL,
	"filing_status" varchar(50) DEFAULT 'pending' NOT NULL,
	"submitted_at" timestamp,
	"accepted_at" timestamp,
	"rejected_at" timestamp,
	"recorder_response" jsonb DEFAULT '{}'::jsonb,
	"filing_number" varchar(100),
	"document_type" varchar(100),
	"trust_status" varchar(100),
	"land_classification" varchar(100),
	"notes" text,
	"filing_reference" text,
	"instrument_type" varchar(100),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "welfare_instruments" (
	"id" serial PRIMARY KEY NOT NULL,
	"welfare_act" text NOT NULL,
	"instrument_type" text NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"tro_sensitive" boolean DEFAULT false NOT NULL,
	"emergency_order" boolean DEFAULT false NOT NULL,
	"case_details" jsonb,
	"child_info" jsonb,
	"parties" jsonb,
	"land_status" jsonb,
	"requested_relief" jsonb,
	"doctrine_context" jsonb,
	"doctrines_applied" jsonb,
	"content" text,
	"pdf_url" text,
	"generated_by" text,
	"issued_by" text,
	"audit_log" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "welfare_acts" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" varchar(50) NOT NULL,
	"label" text NOT NULL,
	"description" text,
	"federal_statutes" jsonb DEFAULT '[]'::jsonb,
	"doctrines" jsonb DEFAULT '[]'::jsonb,
	"tro_eligible" boolean DEFAULT false NOT NULL,
	"emergency_eligible" boolean DEFAULT false NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "welfare_acts_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "welfare_provisions" (
	"id" serial PRIMARY KEY NOT NULL,
	"act_code" varchar(50) NOT NULL,
	"instrument_type" varchar(100) NOT NULL,
	"provision_text" text NOT NULL,
	"sort_order" serial NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer,
	"channel" varchar(50) DEFAULT 'dashboard' NOT NULL,
	"category" varchar(100) NOT NULL,
	"title" text NOT NULL,
	"message" text NOT NULL,
	"severity" varchar(20) DEFAULT 'info' NOT NULL,
	"related_id" integer,
	"related_type" varchar(50),
	"red_flag" boolean DEFAULT false NOT NULL,
	"tro_flag" boolean DEFAULT false NOT NULL,
	"read" boolean DEFAULT false NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "doctrine_sources" (
	"id" serial PRIMARY KEY NOT NULL,
	"case_name" varchar(255) NOT NULL,
	"citation" varchar(255) NOT NULL,
	"summary" text NOT NULL,
	"tags" jsonb DEFAULT '[]'::jsonb
);
--> statement-breakpoint
CREATE TABLE "federal_indian_law" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" varchar(255) NOT NULL,
	"citation" varchar(255) NOT NULL,
	"body" text NOT NULL,
	"tags" jsonb DEFAULT '[]'::jsonb,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tribal_law" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" varchar(255) NOT NULL,
	"citation" varchar(255) NOT NULL,
	"body" text NOT NULL,
	"tags" jsonb DEFAULT '[]'::jsonb,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "court_documents" (
	"id" serial PRIMARY KEY NOT NULL,
	"template_id" varchar(100) NOT NULL,
	"template_name" varchar(255) NOT NULL,
	"document_type" varchar(100) NOT NULL,
	"title" varchar(255) NOT NULL,
	"case_number" varchar(100),
	"court" varchar(255),
	"parties" jsonb DEFAULT '{}'::jsonb,
	"case_details" jsonb DEFAULT '{}'::jsonb,
	"content" text NOT NULL,
	"pdf_url" text,
	"status" varchar(50) DEFAULT 'draft' NOT NULL,
	"tro_sensitive" boolean DEFAULT false NOT NULL,
	"emergency_order" boolean DEFAULT false NOT NULL,
	"intake_flags" jsonb DEFAULT '{}'::jsonb,
	"doctrines_applied" jsonb DEFAULT '[]'::jsonb,
	"law_refs" jsonb DEFAULT '[]'::jsonb,
	"signature_block" text,
	"recorder_metadata" jsonb DEFAULT '{}'::jsonb,
	"generated_by" integer,
	"audit_log" jsonb DEFAULT '[]'::jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ancestral_records" (
	"id" serial PRIMARY KEY NOT NULL,
	"lineage_id" integer NOT NULL,
	"user_id" integer,
	"record_type" varchar(100) DEFAULT 'genealogical' NOT NULL,
	"record_date" varchar(100),
	"record_source" varchar(500),
	"jurisdiction" varchar(255),
	"tribal_nation" varchar(255),
	"document_content" text,
	"verification_status" varchar(50) DEFAULT 'unverified' NOT NULL,
	"icwa_relevant" boolean DEFAULT false,
	"trust_relevant" boolean DEFAULT false,
	"welfare_relevant" boolean DEFAULT false,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "family_lineage" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer,
	"first_name" varchar(200),
	"last_name" varchar(200),
	"full_name" varchar(400) NOT NULL,
	"birth_year" integer,
	"death_year" integer,
	"gender" varchar(50),
	"tribal_nation" varchar(255),
	"tribal_enrollment_number" varchar(100),
	"notes" text,
	"parent_ids" jsonb DEFAULT '[]'::jsonb,
	"children_ids" jsonb DEFAULT '[]'::jsonb,
	"spouse_ids" jsonb DEFAULT '[]'::jsonb,
	"lineage_tags" jsonb DEFAULT '[]'::jsonb,
	"source_type" varchar(50) DEFAULT 'manual' NOT NULL,
	"generational_position" integer DEFAULT 0,
	"is_deceased" boolean DEFAULT false,
	"is_ancestor" boolean DEFAULT true,
	"icwa_eligible" boolean,
	"welfare_eligible" boolean,
	"trust_beneficiary" boolean,
	"linked_profile_user_id" integer,
	"photo_filename" varchar(500),
	"protection_level" varchar(50) DEFAULT 'pending',
	"membership_status" varchar(50) DEFAULT 'pending',
	"name_variants" jsonb DEFAULT '[]'::jsonb,
	"entra_object_id" varchar(255),
	"pending_review" boolean DEFAULT false,
	"added_by_member_id" integer,
	"supporting_document_name" varchar(500),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "identity_narratives" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"lineage_id" integer,
	"narrative_type" varchar(100) DEFAULT 'lineage' NOT NULL,
	"title" varchar(500),
	"content" text,
	"lineage_tags" jsonb DEFAULT '[]'::jsonb,
	"ancestor_chain" jsonb DEFAULT '[]'::jsonb,
	"family_group" varchar(255),
	"generational_depth" integer DEFAULT 0,
	"generational_position" integer DEFAULT 0,
	"protection_level" varchar(50) DEFAULT 'standard' NOT NULL,
	"benefit_eligibility" jsonb DEFAULT '{}'::jsonb,
	"icwa_eligible" boolean DEFAULT false,
	"welfare_eligible" boolean DEFAULT false,
	"trust_inheritance" boolean DEFAULT false,
	"membership_verified" boolean DEFAULT false,
	"identity_tags" jsonb DEFAULT '[]'::jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "delegations" (
	"id" serial PRIMARY KEY NOT NULL,
	"delegator_id" integer NOT NULL,
	"delegatee_id" integer NOT NULL,
	"scopes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"reason" text,
	"note" text,
	"expires_at" timestamp,
	"revoked_at" timestamp,
	"revoked_reason" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "forum_posts" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" varchar(500) NOT NULL,
	"body" text NOT NULL,
	"category" varchar(100),
	"author_id" integer,
	"author_name" varchar(255),
	"pinned" boolean DEFAULT false NOT NULL,
	"reply_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "forum_replies" (
	"id" serial PRIMARY KEY NOT NULL,
	"post_id" integer NOT NULL,
	"body" text NOT NULL,
	"author_id" integer,
	"author_name" varchar(255),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_guidance_records" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer,
	"question" text NOT NULL,
	"answer" text NOT NULL,
	"citations" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "business_board_members" (
	"id" serial PRIMARY KEY NOT NULL,
	"concept_id" integer NOT NULL,
	"directory_member_id" integer,
	"member_name" text NOT NULL,
	"member_role" text NOT NULL,
	"start_date" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "business_concepts" (
	"id" serial PRIMARY KEY NOT NULL,
	"owner_id" integer,
	"title" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"structure" varchar(100) DEFAULT '',
	"status" varchar(50) DEFAULT 'draft' NOT NULL,
	"ai_summary" text,
	"suggested_structures" jsonb DEFAULT '[]'::jsonb,
	"protections" jsonb DEFAULT '[]'::jsonb,
	"agencies_to_contact" jsonb DEFAULT '[]'::jsonb,
	"plan_outline" jsonb DEFAULT '{}'::jsonb,
	"model_canvas" jsonb DEFAULT '{}'::jsonb,
	"provisions" jsonb DEFAULT '[]'::jsonb,
	"what_next_steps" jsonb DEFAULT '[]'::jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "business_documents" (
	"id" serial PRIMARY KEY NOT NULL,
	"concept_id" integer NOT NULL,
	"filename" text NOT NULL,
	"uploaded_at" timestamp DEFAULT now() NOT NULL,
	"uploaded_by" text,
	"file_key" text
);
--> statement-breakpoint
ALTER TABLE "family_lineage" ADD CONSTRAINT "family_lineage_added_by_member_id_users_id_fk" FOREIGN KEY ("added_by_member_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "forum_posts" ADD CONSTRAINT "forum_posts_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "forum_replies" ADD CONSTRAINT "forum_replies_post_id_forum_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."forum_posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "forum_replies" ADD CONSTRAINT "forum_replies_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_guidance_records" ADD CONSTRAINT "ai_guidance_records_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "business_board_members" ADD CONSTRAINT "business_board_members_concept_id_business_concepts_id_fk" FOREIGN KEY ("concept_id") REFERENCES "public"."business_concepts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "business_board_members" ADD CONSTRAINT "business_board_members_directory_member_id_family_lineage_id_fk" FOREIGN KEY ("directory_member_id") REFERENCES "public"."family_lineage"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "business_concepts" ADD CONSTRAINT "business_concepts_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "business_documents" ADD CONSTRAINT "business_documents_concept_id_business_concepts_id_fk" FOREIGN KEY ("concept_id") REFERENCES "public"."business_concepts"("id") ON DELETE cascade ON UPDATE no action;