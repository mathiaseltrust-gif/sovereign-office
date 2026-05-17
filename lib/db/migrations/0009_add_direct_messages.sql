CREATE TABLE IF NOT EXISTS "message_threads" (
  "id" serial PRIMARY KEY NOT NULL,
  "participant_a_id" integer NOT NULL,
  "participant_b_id" integer NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "last_message_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "direct_messages" (
  "id" serial PRIMARY KEY NOT NULL,
  "thread_id" integer NOT NULL,
  "sender_id" integer NOT NULL,
  "recipient_id" integer NOT NULL,
  "content" text NOT NULL,
  "read_at" timestamp,
  "edited_at" timestamp,
  "deleted_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL
);
