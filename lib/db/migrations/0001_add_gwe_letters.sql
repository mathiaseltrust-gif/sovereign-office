CREATE TABLE "gwe_letters" (
	"id" serial PRIMARY KEY NOT NULL,
	"recipient_name" text NOT NULL,
	"letter_date" text NOT NULL,
	"program_name" text NOT NULL,
	"exclusion_basis" text NOT NULL,
	"amount" text NOT NULL,
	"issuing_officer" text NOT NULL,
	"storage_key" text,
	"generated_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
