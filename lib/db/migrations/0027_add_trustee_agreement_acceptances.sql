CREATE TABLE IF NOT EXISTS "trustee_agreement_acceptances" (
  "id" serial PRIMARY KEY NOT NULL,
  "user_id" integer NOT NULL,
  "entra_id" varchar(255) NOT NULL,
  "agreement_key" varchar(100) NOT NULL,
  "agreement_version" varchar(50) NOT NULL,
  "content_hash" varchar(64) NOT NULL,
  "agreement_text" text NOT NULL,
  "signed_name" text NOT NULL,
  "signed_email" varchar(255) NOT NULL,
  "role_at_signing" varchar(80) NOT NULL,
  "signature_method" varchar(100) NOT NULL,
  "signature_receipt" varchar(128) NOT NULL,
  "acknowledged_duties" boolean DEFAULT false NOT NULL,
  "acknowledged_removal" boolean DEFAULT false NOT NULL,
  "acknowledged_electronic_signature" boolean DEFAULT false NOT NULL,
  "user_agent" text,
  "signed_at" timestamp DEFAULT now() NOT NULL,
  "revoked_at" timestamp,
  "revocation_reason" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "trustee_agreement_acceptances_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "trustee_agreement_acceptance_unique" ON "trustee_agreement_acceptances" USING btree ("user_id","agreement_key","agreement_version","content_hash");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "trustee_agreement_acceptance_user_idx" ON "trustee_agreement_acceptances" USING btree ("user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "trustee_agreement_acceptance_version_idx" ON "trustee_agreement_acceptances" USING btree ("agreement_version");
