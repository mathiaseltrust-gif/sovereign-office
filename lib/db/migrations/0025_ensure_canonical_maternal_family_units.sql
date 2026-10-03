-- Ensure the verified maternal branch has one durable representation in both
-- family_lineage relationship arrays and GEDCOM-style family_units.
--
-- Canonical chain:
--   Pamela Denise McCaster (1961) <- Cornelia Morant Ruff (1940)
--   Cornelia Morant Ruff (1940) <- Richard Henry Morant (1918) + Johnnie Mae Allen (1917)
--
-- Idempotent: re-running preserves existing unrelated relationships and family units.

DO $$
DECLARE
  pamela_id integer;
  cornelia_id integer;
  richard_id integer;
  johnnie_id integer;
BEGIN
  -- Pamela
  SELECT id INTO pamela_id
  FROM family_lineage
  WHERE lower(trim(full_name)) = 'pamela denise mccaster'
    AND (birth_year = 1961 OR birth_year IS NULL)
  ORDER BY
    CASE WHEN birth_year = 1961 THEN 0 ELSE 1 END,
    CASE WHEN coalesce(source_type, '') = 'archived' THEN 1 ELSE 0 END,
    id
  LIMIT 1;

  IF pamela_id IS NULL THEN
    INSERT INTO family_lineage (
      full_name, first_name, last_name, gender, birth_year,
      is_deceased, is_ancestor, generational_position,
      parent_ids, children_ids, spouse_ids, sibling_ids,
      name_variants, source_type, protection_level, membership_status,
      pending_review, visibility, notes
    ) VALUES (
      'Pamela Denise McCaster', 'Pamela', 'McCaster', 'female', 1961,
      false, true, 1,
      '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, '[]'::jsonb,
      '["Pamela D McCaster"]'::jsonb, 'verified_lineage', 'ancestor', 'confirmed',
      false, 'public', 'Mother of Mathew-Allen McCaster.'
    )
    RETURNING id INTO pamela_id;
  END IF;

  -- Cornelia / historical Cornella spelling
  SELECT id INTO cornelia_id
  FROM family_lineage
  WHERE lower(trim(full_name)) IN ('cornelia morant ruff', 'cornella morant ruff')
    AND (birth_year = 1940 OR birth_year IS NULL)
  ORDER BY
    CASE WHEN birth_year = 1940 THEN 0 ELSE 1 END,
    CASE WHEN coalesce(source_type, '') = 'archived' THEN 1 ELSE 0 END,
    id
  LIMIT 1;

  IF cornelia_id IS NULL THEN
    INSERT INTO family_lineage (
      full_name, first_name, last_name, gender, birth_year, death_year,
      is_deceased, is_ancestor, generational_position,
      parent_ids, children_ids, spouse_ids, sibling_ids,
      name_variants, source_type, protection_level, membership_status,
      pending_review, visibility, notes
    ) VALUES (
      'Cornelia Morant Ruff', 'Cornelia', 'Ruff', 'female', 1940, 2013,
      true, true, 2,
      '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, '[]'::jsonb,
      '["Cornella Morant Ruff"]'::jsonb, 'verified_lineage', 'ancestor', 'confirmed',
      false, 'public', 'Maternal grandmother. Mother of Pamela Denise McCaster.'
    )
    RETURNING id INTO cornelia_id;
  END IF;

  UPDATE family_lineage
  SET full_name = 'Cornelia Morant Ruff',
      first_name = 'Cornelia',
      last_name = 'Ruff',
      gender = 'female',
      birth_year = coalesce(birth_year, 1940),
      death_year = coalesce(death_year, 2013),
      is_deceased = true,
      is_ancestor = true,
      generational_position = coalesce(generational_position, 2),
      name_variants = (
        SELECT coalesce(jsonb_agg(DISTINCT v), '[]'::jsonb)
        FROM jsonb_array_elements_text(
          coalesce(name_variants, '[]'::jsonb)
          || '["Cornelia Morant Ruff","Cornella Morant Ruff"]'::jsonb
        ) AS x(v)
      ),
      pending_review = false,
      membership_status = CASE WHEN membership_status = 'rejected' THEN 'confirmed' ELSE coalesce(membership_status, 'confirmed') END,
      source_type = CASE WHEN coalesce(source_type, '') = 'archived' THEN 'verified_lineage' ELSE source_type END,
      updated_at = now()
  WHERE id = cornelia_id;

  -- Richard
  SELECT id INTO richard_id
  FROM family_lineage
  WHERE lower(trim(full_name)) = 'richard henry morant'
    AND (birth_year = 1918 OR birth_year IS NULL)
  ORDER BY
    CASE WHEN birth_year = 1918 THEN 0 ELSE 1 END,
    CASE WHEN coalesce(source_type, '') = 'archived' THEN 1 ELSE 0 END,
    id
  LIMIT 1;

  IF richard_id IS NULL THEN
    INSERT INTO family_lineage (
      full_name, first_name, last_name, gender, birth_year, death_year,
      is_deceased, is_ancestor, generational_position,
      parent_ids, children_ids, spouse_ids, sibling_ids,
      name_variants, source_type, protection_level, membership_status,
      pending_review, visibility, notes
    ) VALUES (
      'Richard Henry Morant', 'Richard', 'Morant', 'male', 1918, 1987,
      true, true, 3,
      '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, '[]'::jsonb,
      '[]'::jsonb, 'verified_lineage', 'ancestor', 'confirmed',
      false, 'public', 'Maternal great-grandfather. Father of Cornelia Morant Ruff.'
    )
    RETURNING id INTO richard_id;
  END IF;

  -- Johnnie
  SELECT id INTO johnnie_id
  FROM family_lineage
  WHERE lower(trim(full_name)) = 'johnnie mae allen'
    AND (birth_year = 1917 OR birth_year IS NULL)
  ORDER BY
    CASE WHEN birth_year = 1917 THEN 0 ELSE 1 END,
    CASE WHEN coalesce(source_type, '') = 'archived' THEN 1 ELSE 0 END,
    id
  LIMIT 1;

  IF johnnie_id IS NULL THEN
    INSERT INTO family_lineage (
      full_name, first_name, last_name, gender, birth_year, death_year,
      is_deceased, is_ancestor, generational_position,
      parent_ids, children_ids, spouse_ids, sibling_ids,
      name_variants, source_type, protection_level, membership_status,
      pending_review, visibility, notes
    ) VALUES (
      'Johnnie Mae Allen', 'Johnnie', 'Allen', 'female', 1917, 1978,
      true, true, 3,
      '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, '[]'::jsonb,
      '[]'::jsonb, 'verified_lineage', 'ancestor', 'confirmed',
      false, 'public', 'Maternal great-grandmother. Mother of Cornelia Morant Ruff.'
    )
    RETURNING id INTO johnnie_id;
  END IF;

  -- Canonical relationship arrays.
  UPDATE family_lineage
  SET parent_ids = CASE
        WHEN coalesce(parent_ids, '[]'::jsonb) @> jsonb_build_array(cornelia_id)
          THEN coalesce(parent_ids, '[]'::jsonb)
        ELSE coalesce(parent_ids, '[]'::jsonb) || jsonb_build_array(cornelia_id)
      END,
      updated_at = now()
  WHERE id = pamela_id;

  UPDATE family_lineage
  SET children_ids = CASE
        WHEN coalesce(children_ids, '[]'::jsonb) @> jsonb_build_array(pamela_id)
          THEN coalesce(children_ids, '[]'::jsonb)
        ELSE coalesce(children_ids, '[]'::jsonb) || jsonb_build_array(pamela_id)
      END,
      parent_ids = (
        SELECT coalesce(jsonb_agg(DISTINCT p), '[]'::jsonb)
        FROM (
          SELECT value::integer AS p
          FROM jsonb_array_elements_text(
            coalesce(parent_ids, '[]'::jsonb)
            || jsonb_build_array(richard_id)
            || jsonb_build_array(johnnie_id)
          ) x(value)
        ) q
      ),
      updated_at = now()
  WHERE id = cornelia_id;

  UPDATE family_lineage
  SET children_ids = CASE
        WHEN coalesce(children_ids, '[]'::jsonb) @> jsonb_build_array(cornelia_id)
          THEN coalesce(children_ids, '[]'::jsonb)
        ELSE coalesce(children_ids, '[]'::jsonb) || jsonb_build_array(cornelia_id)
      END,
      spouse_ids = CASE
        WHEN coalesce(spouse_ids, '[]'::jsonb) @> jsonb_build_array(johnnie_id)
          THEN coalesce(spouse_ids, '[]'::jsonb)
        ELSE coalesce(spouse_ids, '[]'::jsonb) || jsonb_build_array(johnnie_id)
      END,
      updated_at = now()
  WHERE id = richard_id;

  UPDATE family_lineage
  SET children_ids = CASE
        WHEN coalesce(children_ids, '[]'::jsonb) @> jsonb_build_array(cornelia_id)
          THEN coalesce(children_ids, '[]'::jsonb)
        ELSE coalesce(children_ids, '[]'::jsonb) || jsonb_build_array(cornelia_id)
      END,
      spouse_ids = CASE
        WHEN coalesce(spouse_ids, '[]'::jsonb) @> jsonb_build_array(richard_id)
          THEN coalesce(spouse_ids, '[]'::jsonb)
        ELSE coalesce(spouse_ids, '[]'::jsonb) || jsonb_build_array(richard_id)
      END,
      updated_at = now()
  WHERE id = johnnie_id;

  -- Ensure a birth-family unit exists for Pamela with Cornelia as her known parent.
  IF NOT EXISTS (
    SELECT 1
    FROM family_units fu
    WHERE coalesce(fu.child_ids, '[]'::jsonb) @> jsonb_build_array(pamela_id)
      AND (
        fu.wife_id = cornelia_id
        OR fu.husband_id = cornelia_id
        OR coalesce(fu.spouse_ids, '[]'::jsonb) @> jsonb_build_array(cornelia_id)
      )
  ) THEN
    INSERT INTO family_units (
      wife_id, spouse_ids, child_ids, relationship_type, source_type, notes
    ) VALUES (
      cornelia_id, '[]'::jsonb, jsonb_build_array(pamela_id),
      'biological', 'verified_lineage',
      'Canonical maternal birth-family link for Pamela Denise McCaster.'
    );
  END IF;

  -- Ensure Cornelia's birth-family unit exists with Richard + Johnnie.
  IF NOT EXISTS (
    SELECT 1
    FROM family_units fu
    WHERE coalesce(fu.child_ids, '[]'::jsonb) @> jsonb_build_array(cornelia_id)
      AND (
        (fu.husband_id = richard_id AND fu.wife_id = johnnie_id)
        OR (fu.husband_id = johnnie_id AND fu.wife_id = richard_id)
        OR (
          coalesce(fu.spouse_ids, '[]'::jsonb) @> jsonb_build_array(richard_id)
          AND coalesce(fu.spouse_ids, '[]'::jsonb) @> jsonb_build_array(johnnie_id)
        )
      )
  ) THEN
    INSERT INTO family_units (
      husband_id, wife_id, spouse_ids, child_ids, relationship_type, source_type, notes
    ) VALUES (
      richard_id, johnnie_id, '[]'::jsonb, jsonb_build_array(cornelia_id),
      'biological', 'verified_lineage',
      'Canonical birth-family link for Cornelia Morant Ruff.'
    );
  END IF;

  RAISE NOTICE 'canonical maternal family units ensured: Pamela %, Cornelia %, Richard %, Johnnie %',
    pamela_id, cornelia_id, richard_id, johnnie_id;
END $$;
