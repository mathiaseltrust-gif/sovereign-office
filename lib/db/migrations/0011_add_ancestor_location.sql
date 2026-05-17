ALTER TABLE "family_lineage"
  ADD COLUMN IF NOT EXISTS "location_lat" double precision,
  ADD COLUMN IF NOT EXISTS "location_lng" double precision;
