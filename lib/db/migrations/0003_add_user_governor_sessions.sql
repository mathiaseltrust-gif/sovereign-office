CREATE TABLE IF NOT EXISTS "user_governor_sessions" (
  "user_id" integer PRIMARY KEY NOT NULL,
  "governor_id" integer NOT NULL REFERENCES "role_governors"("id") ON DELETE CASCADE,
  "activated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "user_governor_sessions_governor_id_idx"
  ON "user_governor_sessions" ("governor_id");
