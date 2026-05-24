-- A: land_parcels — columns added in code after initial migration, missing from production DB
ALTER TABLE land_parcels ADD COLUMN IF NOT EXISTS atlas_node_type VARCHAR(100);
ALTER TABLE land_parcels ADD COLUMN IF NOT EXISTS coordinate_source VARCHAR(100);

-- C: ancestor_life_events — columns declared in schema but missing from migration 0017
ALTER TABLE ancestor_life_events ADD COLUMN IF NOT EXISTS event_place_confidence VARCHAR(20) DEFAULT 'documented';
ALTER TABLE ancestor_life_events ADD COLUMN IF NOT EXISTS event_source VARCHAR(500);
ALTER TABLE ancestor_life_events ADD COLUMN IF NOT EXISTS event_note TEXT;
ALTER TABLE ancestor_life_events ADD COLUMN IF NOT EXISTS atlas_visible BOOLEAN DEFAULT true;
ALTER TABLE ancestor_life_events ADD COLUMN IF NOT EXISTS source_type VARCHAR(50) DEFAULT 'gedcom';
