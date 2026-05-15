CREATE TABLE IF NOT EXISTS "profile_vault" (
  "id" serial PRIMARY KEY NOT NULL,
  "user_id" integer NOT NULL UNIQUE,
  "date_of_birth" text,
  "address" text,
  "preferred_contact" text,
  "contact_email" text,
  "ssn" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
