CREATE TABLE IF NOT EXISTS "family_lineage" (
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
  "tribal_id_number" varchar(10),
  "notes" text,
  "parent_ids" jsonb DEFAULT '[]'::jsonb,
  "children_ids" jsonb DEFAULT '[]'::jsonb,
  "spouse_ids" jsonb DEFAULT '[]'::jsonb,
  "sibling_ids" jsonb DEFAULT '[]'::jsonb,
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
  "photo_url" text,
  "protection_level" varchar(50) DEFAULT 'pending',
  "membership_status" varchar(50) DEFAULT 'pending',
  "name_variants" jsonb DEFAULT '[]'::jsonb,
  "contact_email" varchar(255),
  "entra_object_id" varchar(255),
  "pending_review" boolean DEFAULT false,
  "added_by_member_id" integer,
  "supporting_document_name" varchar(500),
  "visibility" varchar(50) DEFAULT 'private' NOT NULL,
  "birth_place" text,
  "birth_date" varchar(100),
  "death_place" text,
  "death_date" varchar(100),
  "burial_place" text,
  "location_lat" double precision,
  "location_lng" double precision,
  "location_address" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ancestral_records" (
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
CREATE TABLE IF NOT EXISTS "identity_narratives" (
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
CREATE TABLE IF NOT EXISTS "family_units" (
  "id" serial PRIMARY KEY NOT NULL,
  "gedcom_fam_id" varchar(100),
  "husband_id" integer,
  "wife_id" integer,
  "spouse_ids" jsonb DEFAULT '[]'::jsonb,
  "child_ids" jsonb DEFAULT '[]'::jsonb,
  "relationship_type" varchar(50) DEFAULT 'biological' NOT NULL,
  "source_type" varchar(50) DEFAULT 'manual' NOT NULL,
  "notes" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "family_lineage" ADD CONSTRAINT "family_lineage_added_by_member_id_users_id_fk" FOREIGN KEY ("added_by_member_id") REFERENCES "users"("id") ON DELETE SET NULL;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "family_units" ADD CONSTRAINT "family_units_husband_id_family_lineage_id_fk" FOREIGN KEY ("husband_id") REFERENCES "family_lineage"("id") ON DELETE SET NULL;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "family_units" ADD CONSTRAINT "family_units_wife_id_family_lineage_id_fk" FOREIGN KEY ("wife_id") REFERENCES "family_lineage"("id") ON DELETE SET NULL;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
