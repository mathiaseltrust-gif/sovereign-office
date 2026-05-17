CREATE TABLE IF NOT EXISTS "email_digest_queue" (
  "id" serial PRIMARY KEY NOT NULL,
  "user_id" integer NOT NULL,
  "email" text NOT NULL,
  "name" text NOT NULL,
  "category" text NOT NULL,
  "severity" text,
  "title" text NOT NULL,
  "message" text NOT NULL,
  "metadata" jsonb DEFAULT '{}',
  "frequency" text NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "processed_at" timestamp
);
