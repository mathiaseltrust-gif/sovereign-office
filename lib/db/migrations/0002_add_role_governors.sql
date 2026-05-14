CREATE TABLE "role_governors" (
  "id" serial PRIMARY KEY NOT NULL,
  "role_key" varchar(64) NOT NULL UNIQUE,
  "display_name" varchar(128) NOT NULL,
  "posture_statement" text NOT NULL DEFAULT '',
  "jurisdictional_scope" text NOT NULL DEFAULT '',
  "tone_directives" text NOT NULL DEFAULT '',
  "authority_citation" text NOT NULL DEFAULT '',
  "signature_block_template" text NOT NULL DEFAULT '',
  "document_header_template" text NOT NULL DEFAULT '',
  "is_active" boolean NOT NULL DEFAULT false,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE "governor_activation_log" (
  "id" serial PRIMARY KEY NOT NULL,
  "governor_id" integer NOT NULL,
  "role_key" varchar(64) NOT NULL,
  "document_id" integer,
  "document_type" varchar(128),
  "acting_user_id" integer,
  "acting_user_email" varchar(255),
  "activated_at" timestamp DEFAULT now() NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);
