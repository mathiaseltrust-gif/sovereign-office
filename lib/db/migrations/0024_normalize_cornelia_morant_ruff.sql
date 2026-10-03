-- Canonicalize the maternal-grandmother identity used by the active family tree.
-- Treat "Cornella Morant Ruff" as an alternate spelling of "Cornelia Morant Ruff",
-- preserve relationship arrays, and collapse any active duplicate into the record
-- already referenced by Pamela Denise McCaster when possible.

DO $$
DECLARE
  canonical_id integer;
  pamela_id integer;
  richard_id integer;
  johnnie_id integer;
  dup record;
BEGIN
  SELECT f.id
    INTO canonical_id
  FROM family_lineage f
  WHERE lower(trim(f.full_name)) IN ('cornelia morant ruff', 'cornella morant ruff')
    AND f.birth_year = 1940
    AND coalesce(f.source_type, '') <> 'archived'
  ORDER BY
    CASE WHEN EXISTS (
      SELECT 1
      FROM family_lineage p
      WHERE lower(trim(p.full_name)) = 'pamela denise mccaster'
        AND p.birth_year = 1961
        AND coalesce(p.parent_ids, '[]'::jsonb) @> jsonb_build_array(f.id)
    ) THEN 0 ELSE 1 END,
    f.id
  LIMIT 1;

  IF canonical_id IS NULL THEN
    RAISE NOTICE 'maternal identity normalization skipped: no Cornelia/Cornella 1940 record found';
    RETURN;
  END IF;

  UPDATE family_lineage
  SET
    full_name = 'Cornelia Morant Ruff',
    first_name = 'Cornelia',
    gender = 'female',
    name_variants = (
      SELECT coalesce(jsonb_agg(DISTINCT value), '[]'::jsonb)
      FROM jsonb_array_elements_text(
        coalesce(name_variants, '[]'::jsonb)
        || '["Cornelia Morant Ruff","Cornella Morant Ruff"]'::jsonb
      ) AS variants(value)
    ),
    updated_at = now()
  WHERE id = canonical_id;

  FOR dup IN
    SELECT *
    FROM family_lineage
    WHERE lower(trim(full_name)) IN ('cornelia morant ruff', 'cornella morant ruff')
      AND birth_year = 1940
      AND coalesce(source_type, '') <> 'archived'
      AND id <> canonical_id
    ORDER BY id
  LOOP
    -- Preserve relationship metadata carried only by the duplicate row.
    UPDATE family_lineage
    SET
      parent_ids = (
        SELECT coalesce(jsonb_agg(DISTINCT value_num), '[]'::jsonb)
        FROM (
          SELECT value::integer AS value_num
          FROM jsonb_array_elements_text(
            coalesce(parent_ids, '[]'::jsonb) || coalesce(dup.parent_ids, '[]'::jsonb)
          ) AS x(value)
        ) q
      ),
      children_ids = (
        SELECT coalesce(jsonb_agg(DISTINCT value_num), '[]'::jsonb)
        FROM (
          SELECT value::integer AS value_num
          FROM jsonb_array_elements_text(
            coalesce(children_ids, '[]'::jsonb) || coalesce(dup.children_ids, '[]'::jsonb)
          ) AS x(value)
        ) q
      ),
      spouse_ids = (
        SELECT coalesce(jsonb_agg(DISTINCT value_num), '[]'::jsonb)
        FROM (
          SELECT value::integer AS value_num
          FROM jsonb_array_elements_text(
            coalesce(spouse_ids, '[]'::jsonb) || coalesce(dup.spouse_ids, '[]'::jsonb)
          ) AS x(value)
        ) q
      ),
      sibling_ids = (
        SELECT coalesce(jsonb_agg(DISTINCT value_num), '[]'::jsonb)
        FROM (
          SELECT value::integer AS value_num
          FROM jsonb_array_elements_text(
            coalesce(sibling_ids, '[]'::jsonb) || coalesce(dup.sibling_ids, '[]'::jsonb)
          ) AS x(value)
        ) q
      ),
      linked_profile_user_id = coalesce(linked_profile_user_id, dup.linked_profile_user_id),
      photo_filename = coalesce(photo_filename, dup.photo_filename),
      photo_url = coalesce(photo_url, dup.photo_url),
      birth_place = coalesce(birth_place, dup.birth_place),
      birth_date = coalesce(birth_date, dup.birth_date),
      death_place = coalesce(death_place, dup.death_place),
      death_date = coalesce(death_date, dup.death_date),
      burial_place = coalesce(burial_place, dup.burial_place),
      updated_at = now()
    WHERE id = canonical_id;

    -- Replace duplicate ids wherever relationship arrays reference them.
    UPDATE family_lineage
    SET parent_ids = (
      SELECT coalesce(jsonb_agg(DISTINCT CASE WHEN value::integer = dup.id THEN canonical_id ELSE value::integer END), '[]'::jsonb)
      FROM jsonb_array_elements_text(coalesce(parent_ids, '[]'::jsonb)) AS x(value)
    )
    WHERE coalesce(parent_ids, '[]'::jsonb) @> jsonb_build_array(dup.id);

    UPDATE family_lineage
    SET children_ids = (
      SELECT coalesce(jsonb_agg(DISTINCT CASE WHEN value::integer = dup.id THEN canonical_id ELSE value::integer END), '[]'::jsonb)
      FROM jsonb_array_elements_text(coalesce(children_ids, '[]'::jsonb)) AS x(value)
    )
    WHERE coalesce(children_ids, '[]'::jsonb) @> jsonb_build_array(dup.id);

    UPDATE family_lineage
    SET spouse_ids = (
      SELECT coalesce(jsonb_agg(DISTINCT CASE WHEN value::integer = dup.id THEN canonical_id ELSE value::integer END), '[]'::jsonb)
      FROM jsonb_array_elements_text(coalesce(spouse_ids, '[]'::jsonb)) AS x(value)
    )
    WHERE coalesce(spouse_ids, '[]'::jsonb) @> jsonb_build_array(dup.id);

    UPDATE family_lineage
    SET sibling_ids = (
      SELECT coalesce(jsonb_agg(DISTINCT CASE WHEN value::integer = dup.id THEN canonical_id ELSE value::integer END), '[]'::jsonb)
      FROM jsonb_array_elements_text(coalesce(sibling_ids, '[]'::jsonb)) AS x(value)
    )
    WHERE coalesce(sibling_ids, '[]'::jsonb) @> jsonb_build_array(dup.id);

    UPDATE family_units SET husband_id = canonical_id, updated_at = now() WHERE husband_id = dup.id;
    UPDATE family_units SET wife_id = canonical_id, updated_at = now() WHERE wife_id = dup.id;

    UPDATE family_units
    SET spouse_ids = (
      SELECT coalesce(jsonb_agg(DISTINCT CASE WHEN value::integer = dup.id THEN canonical_id ELSE value::integer END), '[]'::jsonb)
      FROM jsonb_array_elements_text(coalesce(spouse_ids, '[]'::jsonb)) AS x(value)
    ),
    updated_at = now()
    WHERE coalesce(spouse_ids, '[]'::jsonb) @> jsonb_build_array(dup.id);

    UPDATE family_units
    SET child_ids = (
      SELECT coalesce(jsonb_agg(DISTINCT CASE WHEN value::integer = dup.id THEN canonical_id ELSE value::integer END), '[]'::jsonb)
      FROM jsonb_array_elements_text(coalesce(child_ids, '[]'::jsonb)) AS x(value)
    ),
    updated_at = now()
    WHERE coalesce(child_ids, '[]'::jsonb) @> jsonb_build_array(dup.id);

    UPDATE ancestral_records SET lineage_id = canonical_id WHERE lineage_id = dup.id;
    UPDATE identity_narratives SET lineage_id = canonical_id WHERE lineage_id = dup.id;

    UPDATE family_lineage
    SET
      source_type = 'archived',
      gender = 'female',
      notes = concat_ws(E'\n', nullif(notes, ''), 'Merged into canonical Cornelia Morant Ruff lineage record.'),
      updated_at = now()
    WHERE id = dup.id;
  END LOOP;

  -- Reassert the canonical maternal chain from the verified lineage sources.
  SELECT min(id) INTO pamela_id
  FROM family_lineage
  WHERE lower(trim(full_name)) = 'pamela denise mccaster'
    AND birth_year = 1961
    AND coalesce(source_type, '') <> 'archived';

  SELECT min(id) INTO richard_id
  FROM family_lineage
  WHERE lower(trim(full_name)) = 'richard henry morant'
    AND birth_year = 1918
    AND coalesce(source_type, '') <> 'archived';

  SELECT min(id) INTO johnnie_id
  FROM family_lineage
  WHERE lower(trim(full_name)) = 'johnnie mae allen'
    AND birth_year = 1917
    AND coalesce(source_type, '') <> 'archived';

  IF pamela_id IS NOT NULL THEN
    UPDATE family_lineage
    SET parent_ids = CASE
      WHEN coalesce(parent_ids, '[]'::jsonb) @> jsonb_build_array(canonical_id)
        THEN coalesce(parent_ids, '[]'::jsonb)
      ELSE coalesce(parent_ids, '[]'::jsonb) || jsonb_build_array(canonical_id)
    END,
    updated_at = now()
    WHERE id = pamela_id;

    UPDATE family_lineage
    SET children_ids = CASE
      WHEN coalesce(children_ids, '[]'::jsonb) @> jsonb_build_array(pamela_id)
        THEN coalesce(children_ids, '[]'::jsonb)
      ELSE coalesce(children_ids, '[]'::jsonb) || jsonb_build_array(pamela_id)
    END,
    updated_at = now()
    WHERE id = canonical_id;
  END IF;

  IF richard_id IS NOT NULL THEN
    UPDATE family_lineage
    SET parent_ids = CASE
      WHEN coalesce(parent_ids, '[]'::jsonb) @> jsonb_build_array(richard_id)
        THEN coalesce(parent_ids, '[]'::jsonb)
      ELSE coalesce(parent_ids, '[]'::jsonb) || jsonb_build_array(richard_id)
    END,
    updated_at = now()
    WHERE id = canonical_id;

    UPDATE family_lineage
    SET children_ids = CASE
      WHEN coalesce(children_ids, '[]'::jsonb) @> jsonb_build_array(canonical_id)
        THEN coalesce(children_ids, '[]'::jsonb)
      ELSE coalesce(children_ids, '[]'::jsonb) || jsonb_build_array(canonical_id)
    END,
    updated_at = now()
    WHERE id = richard_id;
  END IF;

  IF johnnie_id IS NOT NULL THEN
    UPDATE family_lineage
    SET parent_ids = CASE
      WHEN coalesce(parent_ids, '[]'::jsonb) @> jsonb_build_array(johnnie_id)
        THEN coalesce(parent_ids, '[]'::jsonb)
      ELSE coalesce(parent_ids, '[]'::jsonb) || jsonb_build_array(johnnie_id)
    END,
    updated_at = now()
    WHERE id = canonical_id;

    UPDATE family_lineage
    SET children_ids = CASE
      WHEN coalesce(children_ids, '[]'::jsonb) @> jsonb_build_array(canonical_id)
        THEN coalesce(children_ids, '[]'::jsonb)
      ELSE coalesce(children_ids, '[]'::jsonb) || jsonb_build_array(canonical_id)
    END,
    updated_at = now()
    WHERE id = johnnie_id;
  END IF;

  RAISE NOTICE 'maternal identity normalized to Cornelia Morant Ruff id %', canonical_id;
END $$;
