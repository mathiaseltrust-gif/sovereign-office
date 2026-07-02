-- Align the known land record with the existing Office/Profile fields.
-- Safe: updates only existing land_parcels row id=1.
-- Keeps existing land code MET-TL-BC-001. Does not invent a new land numbering system.

BEGIN;

UPDATE land_parcels
SET
  tract_number = 'MET-TL-BC-001',
  parcel_id = '514-364-11-00-1',
  legal_description = 'Known as the Office of the Chief Justice and Trustee. Lot 52 of Tract 5958 PH2; parcel number 514-364-11-6; ATN 514-364-11-00-1; prior APN 514-300-03.',
  acreage = 0.22,
  classification = 'tribal_government_land',
  status = 'active',
  county = 'Kern',
  state = 'CA',
  owner_type = 'tribal_government',
  lat = COALESCE(lat, 35.3733),
  lng = COALESCE(lng, -119.0187),
  notes = 'Office of the Chief Justice and Trustee; tribal government land; existing land code MET-TL-BC-001. Recorded documents: 224020175, 223043047, 223085433. Restrictions and self-executing protections apply.',
  internal_tribal_status = 'tribal_government_land',
  federal_admin_status = COALESCE(NULLIF(federal_admin_status, ''), 'federal_indian_law'),
  jurisdictional_status = 'exclusive_tribal',
  beneficiary_stewardship_type = 'governmental_use',
  protection_restriction_status = 'court_order_protected',
  tribal_code_ref = 'MET-TL-BC-001',
  protected_status_basis = 'Tribal government land known as the Office of the Chief Justice and Trustee; held for the benefit of the Mathias El Tribe under exclusive tribal jurisdiction.',
  restriction_basis = 'Restricted land status; recorded instrument on file; ancestral land rights verified by lineage; self-executing protections are inherent and perpetual.',
  enforcement_authority = 'METC Title 4 Authority; Office of the Chief Justice and Trustee; Mathias El Tribe Supreme Court.',
  federal_law_cross_ref = '25 U.S.C. 177; 18 U.S.C. 1151; 28 U.S.C. 1738; Treaty and tribal court protections asserted.',
  stewardship_purpose = 'Tribal government seat, court, archive, trust administration, land and asset protection, household and member stewardship registry.',
  cultural_significance = 'Tribal government land and protected continuity site.',
  historical_occupancy = 'Associated with Mathias El Tribe trust land record, recorded instruments, and protected governmental use.',
  tribal_ref = 'MET-TL-BC-001',
  atlas_node_type = 'tribal_government_land_node',
  coordinate_source = COALESCE(NULLIF(coordinate_source, ''), 'atlas_seeded_coordinate'),
  updated_at = now()
WHERE id = 1;

COMMIT;

SELECT
  id,
  tract_number,
  parcel_id,
  legal_description,
  acreage,
  classification,
  internal_tribal_status,
  jurisdictional_status,
  tribal_code_ref,
  tribal_ref,
  lat,
  lng,
  coordinate_source
FROM land_parcels
WHERE id = 1;
