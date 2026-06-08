-- Safe inspection script for Land & Asset Management visibility.
-- Read-only. Does not change data.

SELECT 'land_parcels' AS table_name, COUNT(*) AS row_count FROM land_parcels;

SELECT
  id,
  tract_number,
  parcel_id,
  legal_description,
  classification,
  status,
  county,
  state,
  internal_tribal_status,
  jurisdictional_status,
  owner_type,
  tribal_code_ref,
  tribal_ref,
  created_at,
  updated_at
FROM land_parcels
WHERE parcel_id ILIKE '%514-364-11%'
   OR tract_number ILIKE '%514-364-11%'
   OR parcel_id ILIKE '%514-300-03%'
   OR tract_number ILIKE '%514-300-03%'
   OR legal_description ILIKE '%Tract 5958%'
   OR legal_description ILIKE '%Lot 52%'
ORDER BY created_at DESC;

SELECT
  lp.id AS parcel_db_id,
  lp.parcel_id,
  le.id AS encumbrance_id,
  le.encumbrance_type,
  le.title,
  le.status,
  le.void_ab_initio,
  le.source,
  le.created_at
FROM land_parcels lp
LEFT JOIN land_encumbrances le ON le.parcel_id = lp.id
WHERE lp.parcel_id ILIKE '%514-364-11%'
   OR lp.tract_number ILIKE '%514-364-11%'
   OR lp.parcel_id ILIKE '%514-300-03%'
   OR lp.legal_description ILIKE '%Tract 5958%'
ORDER BY le.created_at DESC NULLS LAST;

SELECT
  lp.id AS parcel_db_id,
  lp.parcel_id,
  ld.id AS deed_id,
  ld.deed_type,
  ld.recording_number,
  ld.recording_date,
  ld.recording_jurisdiction,
  ld.status,
  ld.file_name,
  ld.created_at
FROM land_parcels lp
LEFT JOIN land_deeds ld ON ld.parcel_id = lp.id
WHERE lp.parcel_id ILIKE '%514-364-11%'
   OR lp.tract_number ILIKE '%514-364-11%'
   OR lp.parcel_id ILIKE '%514-300-03%'
   OR lp.legal_description ILIKE '%Tract 5958%'
ORDER BY ld.created_at DESC NULLS LAST;
