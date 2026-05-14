ALTER TABLE "governor_activation_log"
  ADD COLUMN IF NOT EXISTS "event_type" varchar(32) NOT NULL DEFAULT 'activation';
