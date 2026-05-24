ALTER TABLE "profile_vault" ADD COLUMN IF NOT EXISTS "id_document_type" text;
ALTER TABLE "profile_vault" ADD COLUMN IF NOT EXISTS "id_document_url_front" text;
ALTER TABLE "profile_vault" ADD COLUMN IF NOT EXISTS "id_document_url_back" text;
ALTER TABLE "profile_vault" ADD COLUMN IF NOT EXISTS "id_document_uploaded_at" timestamp;
ALTER TABLE "profile_vault" ADD COLUMN IF NOT EXISTS "id_jurisdiction_code" text;
ALTER TABLE "profile_vault" ADD COLUMN IF NOT EXISTS "id_scan_requested_at" timestamp;
ALTER TABLE "profile_vault" ADD COLUMN IF NOT EXISTS "id_scan_requested_by" integer;
