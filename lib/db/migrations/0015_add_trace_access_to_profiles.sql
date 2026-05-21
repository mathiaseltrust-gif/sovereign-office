-- Add trace_access flag to profiles table
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS trace_access BOOLEAN NOT NULL DEFAULT false;
