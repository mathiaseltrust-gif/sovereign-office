-- Durable repair for the verified maternal branch when historical imports
-- produced duplicate Pamela/Cornelia person rows.
--
-- The visual tree can legitimately be connected to any active duplicate row.
-- Earlier repairs selected a single Pamela/Cornelia record, so a different
-- connected duplicate could still terminate the maternal branch in Fan view.
--
-- This migration is additive and idempotent:
-- - never deletes or merges people;
-- - preserves unrelated parent/child relationships;
-- - links every matching active Pamela row to one canonical Cornelia row;
-- - links every matching active Cornelia/Cornella row to Richard + Johnnie;
-- - ensures reciprocal children links and family-unit representations.

DO $$
DECLARE
  canonical_cornelia_id integer;
  richard_id integer;
  johnnie_id integer;
  pamela_row record;
  cornelia_row record;
BEGIN
  -- Canonical Cornelia.
  SELECT id INTO canonical_cornelia_id
  FROM family_lineage
  WHERE lower(trim(full_name)) IN ('cornelia morant ruff', 'cornella morant ruff')
    AND (birth_year = 1940 OR birth_year IS NULL)
  ORDER BY
    CASE WHEN birth_year = 1940 THEN 0 ELSE 1 END,
    CASE WHEN coalesce(source_type, '') = 'archived' THEN 1 ELSE 0 END,
    CASE WHEN coalesce(membership_status, '') = 'rejected' THEN 1 ELSE 0 END,
    CASE WHEN coalesce(pending_review, false) THEN 1 ELSE 0 END,
    id
  LIMIT 1;

  IF canonical_cornelia_id IS NULL THEN
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
    RETURNING id INTO canonical_cornelia_id;
  END IF;

  -- Richard.
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
      source_type, protection_level, membership_status,
      pending_review, visibility, notes
    ) VALUES (
      'Richard Henry Morant', 'Richard', 'Morant', 'male', 1918, 1987,
      true, true, 3,
      '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, '[]'::jsonb,
      'verified_lineage', 'ancestor', 'confirmed',
      false, 'public', 'Maternal great-grandfather. Father of Cornelia Morant Ruff.'
    )
    RETURNING id INTO richard_id;
  END IF;

  -- Johnnie.
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
      source_type, protection_level, membership_status,
      pending_review, visibility, notes
    ) VALUES (
      'Johnnie Mae Allen', 'Johnnie', 'Allen', 'female', 1917, 1978,
      true, true, 3,
      '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, '[]'::jsonb,
      'verified_lineage', 'ancestor', 'confirmed',
      false, 'public', 'Maternal great-grandmother. Mother of Cornelia Morant Ruff.'
    )
    RETURNING id INTO johnnie_id;
  END IF;

  -- Normalize the selected canonical ancestor records.
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
      pending_review = false,
      membership_status = CASE
        WHEN membership_status = 'rejected' THEN 'confirmed'
        ELSE coalesce(membership_status, 'confirmed')
      END,
      source_type = CASE
        WHEN coalesce(source_type, '') = 'archived' THEN 'verified_lineage'
        ELSE coalesce(nullif(source_type, ''), 'verified_lineage')
      END,
      updated_at = now()
  WHERE id = canonical_cornelia_id;

  UPDATE family_lineage
  SET gender = 'male',
      birth_year = coalesce(birth_year, 1918),
      death_year = coalesce(death_year, 1987),
      is_deceased = true,
      is_ancestor = true,
      generational_position = coalesce(generational_position, 3),
      pending_review = false,
      membership_status = CASE
        WHEN membership_status = 'rejected' THEN 'confirmed'
        ELSE coalesce(membership_status, 'confirmed')
      END,
      source_type = CASE
        WHEN coalesce(source_type, '') = 'archived' THEN 'verified_lineage'
        ELSE coalesce(nullif(source_type, ''), 'verified_lineage')
      END,
      updated_at = now()
  WHERE id = richard_id;

  UPDATE family_lineage
  SET gender = 'female',
      birth_year = coalesce(birth_year, 1917),
      death_year = coalesce(death_year, 1978),
      is_deceased = true,
      is_ancestor = true,
      generational_position = coalesce(generational_position, 3),
      pending_review = false,
      membership_status = CASE
        WHEN membership_status = 'rejected' THEN 'confirmed'
        ELSE coalesce(membership_status, 'confirmed')
      END,
      source_type = CASE
        WHEN coalesce(source_type, '') = 'archived' THEN 'verified_lineage'
        ELSE coalesce(nullif(source_type, ''), 'verified_lineage')
      END,
      updated_at = now()
  WHERE id = johnnie_id;

  -- Repair every active Pamela representation so whichever duplicate the
  -- logged-in person's tree references has the verified maternal parent.
  FOR pamela_row IN
    SELECT id
    FROM family_lineage
    WHERE lower(trim(full_name)) = 'pamela denise mccaster'
      AND (birth_year = 1961 OR birth_year IS NULL)
      AND coalesce(source_type, '') <> 'archived'
      AND coalesce(membership_status, '') <> 'rejected'
  LOOP
    UPDATE family_lineage
    SET gender = 'female',
        birth_year = coalesce(birth_year, 1961),
        is_ancestor = true,
        generational_position = coalesce(generational_position, 1),
        parent_ids = CASE
          WHEN coalesce(parent_ids, '[]'::jsonb) @> jsonb_build_array(canonical_cornelia_id)
            THEN coalesce(parent_ids, '[]'::jsonb)
          ELSE coalesce(parent_ids, '[]'::jsonb) || jsonb_build_array(canonical_cornelia_id)
        END,
        updated_at = now()
    WHERE id = pamela_row.id;

    UPDATE family_lineage
    SET children_ids = CASE
      WHEN coalesce(children_ids, '[]'::jsonb) @> jsonb_build_array(pamela_row.id)
        THEN coalesce(children_ids, '[]'::jsonb)
      ELSE coalesce(children_ids, '[]'::jsonb) || jsonb_build_array(pamela_row.id)
    END,
    updated_at = now()
    WHERE id = canonical_cornelia_id;

    IF NOT EXISTS (
      SELECT 1
      FROM family_units fu
      WHERE coalesce(fu.child_ids, '[]'::jsonb) @> jsonb_build_array(pamela_row.id)
        AND (
          fu.wife_id = canonical_cornelia_id
          OR fu.husband_id = canonical_cornelia_id
          OR coalesce(fu.spouse_ids, '[]'::jsonb) @> jsonb_build_array(canonical_cornelia_id)
        )
    ) THEN
      INSERT INTO family_units (
        wife_id, spouse_ids, child_ids, relationship_type, source_type, notes
      ) VALUES (
        canonical_cornelia_id,
        '[]'::jsonb,
        jsonb_build_array(pamela_row.id),
        'biological',
        'verified_lineage',
        'Durable maternal birth-family link for Pamela Denise McCaster.'
      );
    END IF;
  END LOOP;

  -- Repair every active Cornelia/Cornella representation so a legacy Pamela
  -- relationship pointing at a duplicate still continues to the next generation.
  FOR cornelia_row IN
    SELECT id
    FROM family_lineage
    WHERE lower(trim(full_name)) IN ('cornelia morant ruff', 'cornella morant ruff')
      AND (birth_year = 1940 OR birth_year IS NULL)
      AND coalesce(source_type, '') <> 'archived'
      AND coalesce(membership_status, '') <> 'rejected'
  LOOP
    UPDATE family_lineage
    SET gender = 'female',
        parent_ids = (
          SELECT coalesce(jsonb_agg(DISTINCT parent_id), '[]'::jsonb)
          FROM (
            SELECT value::integer AS parent_id
            FROM jsonb_array_elements_text(
              coalesce(parent_ids, '[]'::jsonb)
              || jsonb_build_array(richard_id)
              || jsonb_build_array(johnnie_id)
            ) AS p(value)
          ) AS parents
        ),
        updated_at = now()
    WHERE id = cornelia_row.id;

    UPDATE family_lineage
    SET children_ids = CASE
      WHEN coalesce(children_ids, '[]'::jsonb) @> jsonb_build_array(cornelia_row.id)
        THEN coalesce(children_ids, '[]'::jsonb)
      ELSE coalesce(children_ids, '[]'::jsonb) || jsonb_build_array(cornelia_row.id)
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
      WHEN coalesce(children_ids, '[]'::jsonb) @> jsonb_build_array(cornelia_row.id)
        THEN coalesce(children_ids, '[]'::jsonb)
      ELSE coalesce(children_ids, '[]'::jsonb) || jsonb_build_array(cornelia_row.id)
    END,
    spouse_ids = CASE
      WHEN coalesce(spouse_ids, '[]'::jsonb) @> jsonb_build_array(richard_id)
        THEN coalesce(spouse_ids, '[]'::jsonb)
      ELSE coalesce(spouse_ids, '[]'::jsonb) || jsonb_build_array(richard_id)
    END,
    updated_at = now()
    WHERE id = johnnie_id;

    IF NOT EXISTS (
      SELECT 1
      FROM family_units fu
      WHERE coalesce(fu.child_ids, '[]'::jsonb) @> jsonb_build_array(cornelia_row.id)
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
        richard_id,
        johnnie_id,
        '[]'::jsonb,
        jsonb_build_array(cornelia_row.id),
        'biological',
        'verified_lineage',
        'Durable birth-family link for Cornelia Morant Ruff.'
      );
    END IF;
  END LOOP;

  RAISE NOTICE 'maternal duplicate-safe lineage repair complete: Cornelia %, Richard %, Johnnie %',
    canonical_cornelia_id, richard_id, johnnie_id;
END $$;
