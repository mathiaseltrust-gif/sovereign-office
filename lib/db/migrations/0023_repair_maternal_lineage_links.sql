-- Repair the canonical maternal chain for the Chief's lineage.
--
-- This migration is intentionally narrow and idempotent:
--   Mathew Allen McCaster -> Pamela Denise McCaster -> Cornella/Cornelia Morant Ruff
--   Cornella/Cornelia Morant Ruff -> Richard Henry Morant + Johnnie Mae Allen
--
-- It uses exact identity + birth year instead of numeric IDs, preserves any
-- existing unrelated links, and only acts when each named identity resolves to
-- exactly one active lineage record.

DO $$
DECLARE
  pamela_id integer;
  cornella_id integer;
  richard_id integer;
  johnnie_id integer;

  pamela_count integer := 0;
  cornella_count integer := 0;
  richard_count integer := 0;
  johnnie_count integer := 0;
BEGIN
  SELECT count(*), min(id)
    INTO pamela_count, pamela_id
  FROM family_lineage
  WHERE lower(trim(full_name)) = 'pamela denise mccaster'
    AND birth_year = 1961
    AND coalesce(source_type, '') <> 'archived';

  SELECT count(*), min(id)
    INTO cornella_count, cornella_id
  FROM family_lineage
  WHERE lower(trim(full_name)) IN ('cornella morant ruff', 'cornelia morant ruff')
    AND birth_year = 1940
    AND coalesce(source_type, '') <> 'archived';

  SELECT count(*), min(id)
    INTO richard_count, richard_id
  FROM family_lineage
  WHERE lower(trim(full_name)) = 'richard henry morant'
    AND birth_year = 1918
    AND coalesce(source_type, '') <> 'archived';

  SELECT count(*), min(id)
    INTO johnnie_count, johnnie_id
  FROM family_lineage
  WHERE lower(trim(full_name)) = 'johnnie mae allen'
    AND birth_year = 1917
    AND coalesce(source_type, '') <> 'archived';

  IF pamela_count = 1 AND cornella_count = 1 THEN
    UPDATE family_lineage
    SET parent_ids =
      CASE
        WHEN coalesce(parent_ids, '[]'::jsonb) @> jsonb_build_array(cornella_id)
          THEN coalesce(parent_ids, '[]'::jsonb)
        ELSE coalesce(parent_ids, '[]'::jsonb) || jsonb_build_array(cornella_id)
      END,
      updated_at = now()
    WHERE id = pamela_id;

    UPDATE family_lineage
    SET children_ids =
      CASE
        WHEN coalesce(children_ids, '[]'::jsonb) @> jsonb_build_array(pamela_id)
          THEN coalesce(children_ids, '[]'::jsonb)
        ELSE coalesce(children_ids, '[]'::jsonb) || jsonb_build_array(pamela_id)
      END,
      gender = 'female',
      updated_at = now()
    WHERE id = cornella_id;

    RAISE NOTICE 'lineage repair: linked Pamela % to maternal parent Cornella/Cornelia %', pamela_id, cornella_id;
  ELSE
    RAISE NOTICE 'lineage repair skipped Pamela->Cornella/Cornelia (Pamela matches %, Cornella/Cornelia matches %)', pamela_count, cornella_count;
  END IF;

  IF cornella_count = 1 AND richard_count = 1 THEN
    UPDATE family_lineage
    SET parent_ids =
      CASE
        WHEN coalesce(parent_ids, '[]'::jsonb) @> jsonb_build_array(richard_id)
          THEN coalesce(parent_ids, '[]'::jsonb)
        ELSE coalesce(parent_ids, '[]'::jsonb) || jsonb_build_array(richard_id)
      END,
      updated_at = now()
    WHERE id = cornella_id;

    UPDATE family_lineage
    SET children_ids =
      CASE
        WHEN coalesce(children_ids, '[]'::jsonb) @> jsonb_build_array(cornella_id)
          THEN coalesce(children_ids, '[]'::jsonb)
        ELSE coalesce(children_ids, '[]'::jsonb) || jsonb_build_array(cornella_id)
      END,
      updated_at = now()
    WHERE id = richard_id;
  ELSE
    RAISE NOTICE 'lineage repair skipped Cornella/Cornelia->Richard (Cornella/Cornelia matches %, Richard matches %)', cornella_count, richard_count;
  END IF;

  IF cornella_count = 1 AND johnnie_count = 1 THEN
    UPDATE family_lineage
    SET parent_ids =
      CASE
        WHEN coalesce(parent_ids, '[]'::jsonb) @> jsonb_build_array(johnnie_id)
          THEN coalesce(parent_ids, '[]'::jsonb)
        ELSE coalesce(parent_ids, '[]'::jsonb) || jsonb_build_array(johnnie_id)
      END,
      updated_at = now()
    WHERE id = cornella_id;

    UPDATE family_lineage
    SET children_ids =
      CASE
        WHEN coalesce(children_ids, '[]'::jsonb) @> jsonb_build_array(cornella_id)
          THEN coalesce(children_ids, '[]'::jsonb)
        ELSE coalesce(children_ids, '[]'::jsonb) || jsonb_build_array(cornella_id)
      END,
      updated_at = now()
    WHERE id = johnnie_id;
  ELSE
    RAISE NOTICE 'lineage repair skipped Cornella/Cornelia->Johnnie (Cornella/Cornelia matches %, Johnnie matches %)', cornella_count, johnnie_count;
  END IF;
END $$;
