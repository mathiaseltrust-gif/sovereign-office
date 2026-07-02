---
name: ancestor_life_events actual columns
description: The real columns in ancestor_life_events — many columns referenced in code do not exist and must be NULL-stubbed
---

## Rule
Only these columns exist in `ancestor_life_events`:
`id, person_id, event_type, event_date, event_year, event_place, event_place_confidence, event_source, event_note, atlas_visible, source_type, created_at`

## Columns that do NOT exist (must be NULL-stubbed in raw SQL):
- `place_normalized` → `NULL::text AS "placeNormalized"`
- `county` → `NULL::text AS county`
- `state` → `NULL::text AS state`
- `country` → `NULL::text AS country`
- `latitude` → `NULL::numeric AS latitude`
- `longitude` → `NULL::numeric AS longitude`
- `source_reference` → `NULL::text AS "sourceReference"`
- `source_confidence` → `NULL::text AS "sourceConfidence"`
- `raw_payload` → `NULL::jsonb AS "rawPayload"`

**Why:** The DB schema never had these columns added, but the code references them in raw SQL causing 500 errors on `/api/family-tree/full` and `/api/atlas/events`.

**How to apply:** Any time you write a raw SQL query against `ancestor_life_events`, only select columns from the real list above. Stub everything else with a typed NULL cast.
