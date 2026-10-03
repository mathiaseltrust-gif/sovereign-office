-- Ensure the currently curated direct ancestor chain is durable beyond the
-- great-grandparent level.
--
-- Historical production deployments seeded the family tree only when the root
-- anchor was absent. Once the root existed, later additions to the curated
-- lineage seed (2x/3x great-grandparents) could never be inserted. This
-- migration makes those known direct ancestors and their parent-child edges
-- durable without deleting or merging any existing lineage records.

WITH desired_people (
  full_name, first_name, last_name, gender, birth_year, death_year,
  generational_position, is_deceased, membership_status, source_type,
  protection_level, notes
) AS (
  VALUES
    ('Ned McCaster', 'Ned', 'McCaster', 'male', 1876, NULL::integer, 3, true, 'pending', 'gedcom', 'ancestor', 'born Mitchells Station, Alabama'),
    ('Ben C. Watson', 'Ben', 'Watson', 'male', 1900, 1977, 3, true, 'confirmed', 'manual', 'standard', 'Great-grandfather (paternal). Father of Mattie Beatrice Watson McCaster.'),
    ('Rosa Jemison Watson', 'Rosa', 'Watson', 'female', 1902, 1968, 3, true, 'confirmed', 'manual', 'standard', 'Spouse of Ben C. Watson. Mother of Mattie Beatrice Watson McCaster.'),
    ('Richard Henry Morant', 'Richard', 'Morant', 'male', 1918, 1987, 3, true, 'confirmed', 'manual', 'standard', 'Maternal great-grandfather. Father of Cornelia Morant Ruff.'),
    ('Johnnie Mae Allen', 'Johnnie', 'Allen', 'female', 1917, 1978, 3, true, 'confirmed', 'manual', 'standard', 'Maternal great-grandmother. Mother of Cornelia Morant Ruff.'),

    ('Jesse McCaster', 'Jesse', 'McCaster', 'male', 1848, 1910, 4, true, 'pending', 'csv', 'ancestor', 'Elder patriarch, Mitchell County'),
    ('Henry Watson', 'Henry', 'Watson', 'male', 1874, 1940, 4, true, 'confirmed', 'manual', 'standard', '2x great-grandfather (Watson line). Father of Ben C. Watson.'),
    ('Dorrey Watson', 'Dorrey', 'Watson', 'female', 1881, 1961, 4, true, 'confirmed', 'manual', 'standard', '2x great-grandmother (Watson line). Mother of Ben C. Watson.'),
    ('Andrew Moses Morant', 'Andrew', 'Morant', 'male', 1885, 1956, 4, true, 'confirmed', 'manual', 'standard', '2x great-grandfather (Morant line). Father of Richard Henry Morant.'),
    ('Mary Catriene Degen Morant', 'Mary', 'Morant', 'female', 1880, 1943, 4, true, 'confirmed', 'manual', 'standard', '2x great-grandmother (Morant line). Mother of Richard Henry Morant.'),
    ('John Allen', 'John', 'Allen', 'male', 1894, NULL::integer, 4, true, 'confirmed', 'manual', 'standard', '2x great-grandfather (Allen line). Father of Johnnie Mae Allen. Deceased before 1930.'),
    ('Rosa Leach Allen', 'Rosa', 'Allen', 'female', 1896, 1983, 4, true, 'confirmed', 'manual', 'standard', '2x great-grandmother (Allen line). Mother of Johnnie Mae Allen.'),

    ('Charlie Jemison', 'Charlie', 'Jemison', 'male', 1850, 1917, 5, true, 'confirmed', 'manual', 'standard', '3x great-grandfather (Jemison line). Father of Rosa Jemison Watson.'),
    ('Mattie Bryant Jemison', 'Mattie', 'Jemison', 'female', 1872, 1940, 5, true, 'confirmed', 'manual', 'standard', '3x great-grandmother (Jemison line). Mother of Rosa Jemison Watson.')
)
INSERT INTO family_lineage (
  full_name, first_name, last_name, gender, birth_year, death_year,
  is_deceased, is_ancestor, generational_position,
  parent_ids, children_ids, spouse_ids, sibling_ids,
  lineage_tags, source_type, protection_level, membership_status,
  pending_review, visibility, notes
)
SELECT
  d.full_name, d.first_name, d.last_name, d.gender, d.birth_year, d.death_year,
  d.is_deceased, true, d.generational_position,
  '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, '[]'::jsonb,
  '["mccaster-lineage","chief-mathias-el"]'::jsonb,
  d.source_type, d.protection_level, d.membership_status,
  false, 'public', d.notes
FROM desired_people d
WHERE NOT EXISTS (
  SELECT 1
  FROM family_lineage f
  WHERE lower(trim(f.full_name)) = lower(trim(d.full_name))
    AND f.birth_year IS NOT DISTINCT FROM d.birth_year
);
--> statement-breakpoint

-- Normalize only lifecycle fields required for these curated records to be
-- returned by the active family-tree projection. Existing names, notes, sources,
-- and unrelated relationships are otherwise preserved.
WITH desired_people (
  full_name, birth_year, gender, generational_position,
  membership_status, source_type
) AS (
  VALUES
    ('Ned McCaster', 1876, 'male', 3, 'pending', 'gedcom'),
    ('Ben C. Watson', 1900, 'male', 3, 'confirmed', 'manual'),
    ('Rosa Jemison Watson', 1902, 'female', 3, 'confirmed', 'manual'),
    ('Richard Henry Morant', 1918, 'male', 3, 'confirmed', 'manual'),
    ('Johnnie Mae Allen', 1917, 'female', 3, 'confirmed', 'manual'),
    ('Jesse McCaster', 1848, 'male', 4, 'pending', 'csv'),
    ('Henry Watson', 1874, 'male', 4, 'confirmed', 'manual'),
    ('Dorrey Watson', 1881, 'female', 4, 'confirmed', 'manual'),
    ('Andrew Moses Morant', 1885, 'male', 4, 'confirmed', 'manual'),
    ('Mary Catriene Degen Morant', 1880, 'female', 4, 'confirmed', 'manual'),
    ('John Allen', 1894, 'male', 4, 'confirmed', 'manual'),
    ('Rosa Leach Allen', 1896, 'female', 4, 'confirmed', 'manual'),
    ('Charlie Jemison', 1850, 'male', 5, 'confirmed', 'manual'),
    ('Mattie Bryant Jemison', 1872, 'female', 5, 'confirmed', 'manual')
)
UPDATE family_lineage f
SET
  gender = coalesce(f.gender, d.gender),
  generational_position = coalesce(f.generational_position, d.generational_position),
  is_ancestor = true,
  pending_review = false,
  membership_status = CASE
    WHEN coalesce(f.membership_status, '') = 'rejected' THEN d.membership_status
    ELSE coalesce(nullif(f.membership_status, ''), d.membership_status)
  END,
  source_type = CASE
    WHEN coalesce(f.source_type, '') = 'archived' THEN d.source_type
    ELSE coalesce(nullif(f.source_type, ''), d.source_type)
  END,
  updated_at = now()
FROM desired_people d
WHERE lower(trim(f.full_name)) = lower(trim(d.full_name))
  AND f.birth_year IS NOT DISTINCT FROM d.birth_year;
--> statement-breakpoint

-- Curated parent-child edges from the repository's current lineage source.
WITH edge_specs (child_name, child_year, parent_name, parent_year) AS (
  VALUES
    ('Ned McCaster', 1876, 'Jesse McCaster', 1848),
    ('Ben C. Watson', 1900, 'Henry Watson', 1874),
    ('Ben C. Watson', 1900, 'Dorrey Watson', 1881),
    ('Rosa Jemison Watson', 1902, 'Charlie Jemison', 1850),
    ('Rosa Jemison Watson', 1902, 'Mattie Bryant Jemison', 1872),
    ('Richard Henry Morant', 1918, 'Andrew Moses Morant', 1885),
    ('Richard Henry Morant', 1918, 'Mary Catriene Degen Morant', 1880),
    ('Johnnie Mae Allen', 1917, 'John Allen', 1894),
    ('Johnnie Mae Allen', 1917, 'Rosa Leach Allen', 1896)
),
resolved_edges AS (
  SELECT child.id AS child_id, parent.id AS parent_id
  FROM edge_specs e
  CROSS JOIN LATERAL (
    SELECT id
    FROM family_lineage
    WHERE lower(trim(full_name)) = lower(trim(e.child_name))
      AND birth_year IS NOT DISTINCT FROM e.child_year
    ORDER BY
      CASE WHEN coalesce(source_type,'')='archived' THEN 1 ELSE 0 END,
      CASE WHEN coalesce(membership_status,'')='rejected' THEN 1 ELSE 0 END,
      id
    LIMIT 1
  ) child
  CROSS JOIN LATERAL (
    SELECT id
    FROM family_lineage
    WHERE lower(trim(full_name)) = lower(trim(e.parent_name))
      AND birth_year IS NOT DISTINCT FROM e.parent_year
    ORDER BY
      CASE WHEN coalesce(source_type,'')='archived' THEN 1 ELSE 0 END,
      CASE WHEN coalesce(membership_status,'')='rejected' THEN 1 ELSE 0 END,
      id
    LIMIT 1
  ) parent
),
parents_by_child AS (
  SELECT child_id, jsonb_agg(DISTINCT parent_id) AS parent_ids_to_add
  FROM resolved_edges
  GROUP BY child_id
)
UPDATE family_lineage child
SET
  parent_ids = (
    SELECT coalesce(jsonb_agg(DISTINCT id_value), '[]'::jsonb)
    FROM (
      SELECT value::integer AS id_value
      FROM jsonb_array_elements_text(coalesce(child.parent_ids, '[]'::jsonb))
      UNION ALL
      SELECT value::integer AS id_value
      FROM jsonb_array_elements_text(p.parent_ids_to_add)
    ) ids
  ),
  updated_at = now()
FROM parents_by_child p
WHERE child.id = p.child_id;
--> statement-breakpoint

WITH edge_specs (child_name, child_year, parent_name, parent_year) AS (
  VALUES
    ('Ned McCaster', 1876, 'Jesse McCaster', 1848),
    ('Ben C. Watson', 1900, 'Henry Watson', 1874),
    ('Ben C. Watson', 1900, 'Dorrey Watson', 1881),
    ('Rosa Jemison Watson', 1902, 'Charlie Jemison', 1850),
    ('Rosa Jemison Watson', 1902, 'Mattie Bryant Jemison', 1872),
    ('Richard Henry Morant', 1918, 'Andrew Moses Morant', 1885),
    ('Richard Henry Morant', 1918, 'Mary Catriene Degen Morant', 1880),
    ('Johnnie Mae Allen', 1917, 'John Allen', 1894),
    ('Johnnie Mae Allen', 1917, 'Rosa Leach Allen', 1896)
),
resolved_edges AS (
  SELECT child.id AS child_id, parent.id AS parent_id
  FROM edge_specs e
  CROSS JOIN LATERAL (
    SELECT id
    FROM family_lineage
    WHERE lower(trim(full_name)) = lower(trim(e.child_name))
      AND birth_year IS NOT DISTINCT FROM e.child_year
    ORDER BY
      CASE WHEN coalesce(source_type,'')='archived' THEN 1 ELSE 0 END,
      CASE WHEN coalesce(membership_status,'')='rejected' THEN 1 ELSE 0 END,
      id
    LIMIT 1
  ) child
  CROSS JOIN LATERAL (
    SELECT id
    FROM family_lineage
    WHERE lower(trim(full_name)) = lower(trim(e.parent_name))
      AND birth_year IS NOT DISTINCT FROM e.parent_year
    ORDER BY
      CASE WHEN coalesce(source_type,'')='archived' THEN 1 ELSE 0 END,
      CASE WHEN coalesce(membership_status,'')='rejected' THEN 1 ELSE 0 END,
      id
    LIMIT 1
  ) parent
),
children_by_parent AS (
  SELECT parent_id, jsonb_agg(DISTINCT child_id) AS child_ids_to_add
  FROM resolved_edges
  GROUP BY parent_id
)
UPDATE family_lineage parent
SET
  children_ids = (
    SELECT coalesce(jsonb_agg(DISTINCT id_value), '[]'::jsonb)
    FROM (
      SELECT value::integer AS id_value
      FROM jsonb_array_elements_text(coalesce(parent.children_ids, '[]'::jsonb))
      UNION ALL
      SELECT value::integer AS id_value
      FROM jsonb_array_elements_text(c.child_ids_to_add)
    ) ids
  ),
  updated_at = now()
FROM children_by_parent c
WHERE parent.id = c.parent_id;
--> statement-breakpoint

-- Durable family-unit roles for two-parent branches used by Fan/Pedigree.
DO $$
DECLARE
  child_id integer;
  father_id integer;
  mother_id integer;
BEGIN
  -- Ben C. Watson <- Henry Watson + Dorrey Watson
  SELECT id INTO child_id FROM family_lineage WHERE lower(trim(full_name))='ben c. watson' AND birth_year=1900 ORDER BY id LIMIT 1;
  SELECT id INTO father_id FROM family_lineage WHERE lower(trim(full_name))='henry watson' AND birth_year=1874 ORDER BY id LIMIT 1;
  SELECT id INTO mother_id FROM family_lineage WHERE lower(trim(full_name))='dorrey watson' AND birth_year=1881 ORDER BY id LIMIT 1;
  IF child_id IS NOT NULL AND father_id IS NOT NULL AND mother_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM family_units WHERE coalesce(child_ids,'[]'::jsonb) @> jsonb_build_array(child_id)
      AND husband_id=father_id AND wife_id=mother_id
  ) THEN
    INSERT INTO family_units (husband_id,wife_id,spouse_ids,child_ids,relationship_type,source_type,notes)
    VALUES (father_id,mother_id,'[]'::jsonb,jsonb_build_array(child_id),'biological','verified_lineage','Curated birth-family link for Ben C. Watson.');
  END IF;

  -- Rosa Jemison Watson <- Charlie Jemison + Mattie Bryant Jemison
  SELECT id INTO child_id FROM family_lineage WHERE lower(trim(full_name))='rosa jemison watson' AND birth_year=1902 ORDER BY id LIMIT 1;
  SELECT id INTO father_id FROM family_lineage WHERE lower(trim(full_name))='charlie jemison' AND birth_year=1850 ORDER BY id LIMIT 1;
  SELECT id INTO mother_id FROM family_lineage WHERE lower(trim(full_name))='mattie bryant jemison' AND birth_year=1872 ORDER BY id LIMIT 1;
  IF child_id IS NOT NULL AND father_id IS NOT NULL AND mother_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM family_units WHERE coalesce(child_ids,'[]'::jsonb) @> jsonb_build_array(child_id)
      AND husband_id=father_id AND wife_id=mother_id
  ) THEN
    INSERT INTO family_units (husband_id,wife_id,spouse_ids,child_ids,relationship_type,source_type,notes)
    VALUES (father_id,mother_id,'[]'::jsonb,jsonb_build_array(child_id),'biological','verified_lineage','Curated birth-family link for Rosa Jemison Watson.');
  END IF;

  -- Richard Henry Morant <- Andrew Moses Morant + Mary Catriene Degen Morant
  SELECT id INTO child_id FROM family_lineage WHERE lower(trim(full_name))='richard henry morant' AND birth_year=1918 ORDER BY id LIMIT 1;
  SELECT id INTO father_id FROM family_lineage WHERE lower(trim(full_name))='andrew moses morant' AND birth_year=1885 ORDER BY id LIMIT 1;
  SELECT id INTO mother_id FROM family_lineage WHERE lower(trim(full_name))='mary catriene degen morant' AND birth_year=1880 ORDER BY id LIMIT 1;
  IF child_id IS NOT NULL AND father_id IS NOT NULL AND mother_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM family_units WHERE coalesce(child_ids,'[]'::jsonb) @> jsonb_build_array(child_id)
      AND husband_id=father_id AND wife_id=mother_id
  ) THEN
    INSERT INTO family_units (husband_id,wife_id,spouse_ids,child_ids,relationship_type,source_type,notes)
    VALUES (father_id,mother_id,'[]'::jsonb,jsonb_build_array(child_id),'biological','verified_lineage','Curated birth-family link for Richard Henry Morant.');
  END IF;

  -- Johnnie Mae Allen <- John Allen + Rosa Leach Allen
  SELECT id INTO child_id FROM family_lineage WHERE lower(trim(full_name))='johnnie mae allen' AND birth_year=1917 ORDER BY id LIMIT 1;
  SELECT id INTO father_id FROM family_lineage WHERE lower(trim(full_name))='john allen' AND birth_year=1894 ORDER BY id LIMIT 1;
  SELECT id INTO mother_id FROM family_lineage WHERE lower(trim(full_name))='rosa leach allen' AND birth_year=1896 ORDER BY id LIMIT 1;
  IF child_id IS NOT NULL AND father_id IS NOT NULL AND mother_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM family_units WHERE coalesce(child_ids,'[]'::jsonb) @> jsonb_build_array(child_id)
      AND husband_id=father_id AND wife_id=mother_id
  ) THEN
    INSERT INTO family_units (husband_id,wife_id,spouse_ids,child_ids,relationship_type,source_type,notes)
    VALUES (father_id,mother_id,'[]'::jsonb,jsonb_build_array(child_id),'biological','verified_lineage','Curated birth-family link for Johnnie Mae Allen.');
  END IF;
END $$;

--> statement-breakpoint

-- Ensure the intermediate generations that connect the root to the deeper
-- records also exist. These were present in the curated seed before later
-- 2x/3x generations were added, but older production databases can have a
-- partial subset depending on when the original one-time seed first ran.
WITH foundational_people (
  full_name, first_name, last_name, gender, birth_year, death_year,
  generational_position, is_deceased, membership_status, source_type,
  protection_level, notes
) AS (
  VALUES
    ('Milledge McCaster Jr', 'Milledge', 'McCaster', 'male', 1954, 1989, 1, true, 'confirmed', 'manual', 'standard', 'Father of Mathew-Allen McCaster.'),
    ('Pamela Denise McCaster', 'Pamela', 'McCaster', 'female', 1961, NULL::integer, 1, false, 'confirmed', 'manual', 'standard', 'Mother of Mathew-Allen McCaster.'),
    ('Milledge McCaster Sr', 'Milledge', 'McCaster Sr', 'male', 1932, 2013, 2, true, 'pending', 'csv', 'ancestor', 'Son of Ned and Charlotte; b. Bullock County, Alabama'),
    ('Mattie Beatrice Watson McCaster', 'Mattie', 'Watson McCaster', 'female', 1935, 2021, 2, true, 'pending', 'gedcom', 'ancestor', 'Paternal grandmother. Spouse of Milledge McCaster Sr.'),
    ('Cornelia Morant Ruff', 'Cornelia', 'Ruff', 'female', 1940, 2013, 2, true, 'confirmed', 'manual', 'standard', 'Maternal grandmother. Mother of Pamela Denise McCaster.'),
    ('Charlotte Campbell', 'Charlotte', 'Campbell', 'female', 1885, 1951, 3, true, 'pending', 'csv', 'ancestor', 'Wife of Ned McCaster; b. Montgomery, Alabama')
)
INSERT INTO family_lineage (
  full_name, first_name, last_name, gender, birth_year, death_year,
  is_deceased, is_ancestor, generational_position,
  parent_ids, children_ids, spouse_ids, sibling_ids,
  lineage_tags, source_type, protection_level, membership_status,
  pending_review, visibility, notes
)
SELECT
  d.full_name, d.first_name, d.last_name, d.gender, d.birth_year, d.death_year,
  d.is_deceased, true, d.generational_position,
  '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, '[]'::jsonb,
  '["mccaster-lineage","chief-mathias-el"]'::jsonb,
  d.source_type, d.protection_level, d.membership_status,
  false, 'public', d.notes
FROM foundational_people d
WHERE NOT EXISTS (
  SELECT 1
  FROM family_lineage f
  WHERE lower(trim(f.full_name)) = lower(trim(d.full_name))
    AND f.birth_year IS NOT DISTINCT FROM d.birth_year
);
--> statement-breakpoint

WITH foundational_people (
  full_name, birth_year, gender, generational_position,
  membership_status, source_type
) AS (
  VALUES
    ('Milledge McCaster Jr', 1954, 'male', 1, 'confirmed', 'manual'),
    ('Pamela Denise McCaster', 1961, 'female', 1, 'confirmed', 'manual'),
    ('Milledge McCaster Sr', 1932, 'male', 2, 'pending', 'csv'),
    ('Mattie Beatrice Watson McCaster', 1935, 'female', 2, 'pending', 'gedcom'),
    ('Cornelia Morant Ruff', 1940, 'female', 2, 'confirmed', 'manual'),
    ('Charlotte Campbell', 1885, 'female', 3, 'pending', 'csv')
)
UPDATE family_lineage f
SET
  gender = coalesce(f.gender, d.gender),
  generational_position = coalesce(f.generational_position, d.generational_position),
  is_ancestor = true,
  pending_review = false,
  membership_status = CASE
    WHEN coalesce(f.membership_status, '') = 'rejected' THEN d.membership_status
    ELSE coalesce(nullif(f.membership_status, ''), d.membership_status)
  END,
  source_type = CASE
    WHEN coalesce(f.source_type, '') = 'archived' THEN d.source_type
    ELSE coalesce(nullif(f.source_type, ''), d.source_type)
  END,
  updated_at = now()
FROM foundational_people d
WHERE lower(trim(f.full_name)) = lower(trim(d.full_name))
  AND f.birth_year IS NOT DISTINCT FROM d.birth_year;
--> statement-breakpoint

WITH edge_specs (child_name, child_year, parent_name, parent_year) AS (
  VALUES
    ('Milledge McCaster Jr', 1954, 'Milledge McCaster Sr', 1932),
    ('Milledge McCaster Jr', 1954, 'Mattie Beatrice Watson McCaster', 1935),
    ('Pamela Denise McCaster', 1961, 'Cornelia Morant Ruff', 1940),
    ('Milledge McCaster Sr', 1932, 'Ned McCaster', 1876),
    ('Milledge McCaster Sr', 1932, 'Charlotte Campbell', 1885),
    ('Mattie Beatrice Watson McCaster', 1935, 'Ben C. Watson', 1900),
    ('Mattie Beatrice Watson McCaster', 1935, 'Rosa Jemison Watson', 1902),
    ('Cornelia Morant Ruff', 1940, 'Richard Henry Morant', 1918),
    ('Cornelia Morant Ruff', 1940, 'Johnnie Mae Allen', 1917)
),
resolved_edges AS (
  SELECT child.id AS child_id, parent.id AS parent_id
  FROM edge_specs e
  CROSS JOIN LATERAL (
    SELECT id
    FROM family_lineage
    WHERE lower(trim(full_name)) = lower(trim(e.child_name))
      AND birth_year IS NOT DISTINCT FROM e.child_year
    ORDER BY
      CASE WHEN coalesce(source_type,'')='archived' THEN 1 ELSE 0 END,
      CASE WHEN coalesce(membership_status,'')='rejected' THEN 1 ELSE 0 END,
      id
    LIMIT 1
  ) child
  CROSS JOIN LATERAL (
    SELECT id
    FROM family_lineage
    WHERE lower(trim(full_name)) = lower(trim(e.parent_name))
      AND birth_year IS NOT DISTINCT FROM e.parent_year
    ORDER BY
      CASE WHEN coalesce(source_type,'')='archived' THEN 1 ELSE 0 END,
      CASE WHEN coalesce(membership_status,'')='rejected' THEN 1 ELSE 0 END,
      id
    LIMIT 1
  ) parent
),
parents_by_child AS (
  SELECT child_id, jsonb_agg(DISTINCT parent_id) AS parent_ids_to_add
  FROM resolved_edges
  GROUP BY child_id
)
UPDATE family_lineage child
SET parent_ids = (
  SELECT coalesce(jsonb_agg(DISTINCT id_value), '[]'::jsonb)
  FROM (
    SELECT value::integer AS id_value
    FROM jsonb_array_elements_text(coalesce(child.parent_ids, '[]'::jsonb))
    UNION ALL
    SELECT value::integer AS id_value
    FROM jsonb_array_elements_text(p.parent_ids_to_add)
  ) ids
),
updated_at = now()
FROM parents_by_child p
WHERE child.id = p.child_id;
--> statement-breakpoint

WITH edge_specs (child_name, child_year, parent_name, parent_year) AS (
  VALUES
    ('Milledge McCaster Jr', 1954, 'Milledge McCaster Sr', 1932),
    ('Milledge McCaster Jr', 1954, 'Mattie Beatrice Watson McCaster', 1935),
    ('Pamela Denise McCaster', 1961, 'Cornelia Morant Ruff', 1940),
    ('Milledge McCaster Sr', 1932, 'Ned McCaster', 1876),
    ('Milledge McCaster Sr', 1932, 'Charlotte Campbell', 1885),
    ('Mattie Beatrice Watson McCaster', 1935, 'Ben C. Watson', 1900),
    ('Mattie Beatrice Watson McCaster', 1935, 'Rosa Jemison Watson', 1902),
    ('Cornelia Morant Ruff', 1940, 'Richard Henry Morant', 1918),
    ('Cornelia Morant Ruff', 1940, 'Johnnie Mae Allen', 1917)
),
resolved_edges AS (
  SELECT child.id AS child_id, parent.id AS parent_id
  FROM edge_specs e
  CROSS JOIN LATERAL (
    SELECT id
    FROM family_lineage
    WHERE lower(trim(full_name)) = lower(trim(e.child_name))
      AND birth_year IS NOT DISTINCT FROM e.child_year
    ORDER BY
      CASE WHEN coalesce(source_type,'')='archived' THEN 1 ELSE 0 END,
      CASE WHEN coalesce(membership_status,'')='rejected' THEN 1 ELSE 0 END,
      id
    LIMIT 1
  ) child
  CROSS JOIN LATERAL (
    SELECT id
    FROM family_lineage
    WHERE lower(trim(full_name)) = lower(trim(e.parent_name))
      AND birth_year IS NOT DISTINCT FROM e.parent_year
    ORDER BY
      CASE WHEN coalesce(source_type,'')='archived' THEN 1 ELSE 0 END,
      CASE WHEN coalesce(membership_status,'')='rejected' THEN 1 ELSE 0 END,
      id
    LIMIT 1
  ) parent
),
children_by_parent AS (
  SELECT parent_id, jsonb_agg(DISTINCT child_id) AS child_ids_to_add
  FROM resolved_edges
  GROUP BY parent_id
)
UPDATE family_lineage parent
SET children_ids = (
  SELECT coalesce(jsonb_agg(DISTINCT id_value), '[]'::jsonb)
  FROM (
    SELECT value::integer AS id_value
    FROM jsonb_array_elements_text(coalesce(parent.children_ids, '[]'::jsonb))
    UNION ALL
    SELECT value::integer AS id_value
    FROM jsonb_array_elements_text(c.child_ids_to_add)
  ) ids
),
updated_at = now()
FROM children_by_parent c
WHERE parent.id = c.parent_id;
