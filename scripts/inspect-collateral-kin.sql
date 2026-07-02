-- Collateral kin inspection: father/mother siblings through shared parent_ids.
-- Known current linked profile node has been id 12 in production.

WITH self AS (
  SELECT id, full_name, parent_ids
  FROM family_lineage
  WHERE linked_profile_user_id = 1 OR id = 12
  ORDER BY CASE WHEN linked_profile_user_id = 1 THEN 0 ELSE 1 END
  LIMIT 1
), parents AS (
  SELECT p.id, p.full_name, p.parent_ids,
         row_number() OVER () AS parent_order
  FROM self s
  JOIN family_lineage p ON p.id IN (
    SELECT jsonb_array_elements_text(s.parent_ids)::int
  )
), parent_siblings AS (
  SELECT
    p.id AS parent_id,
    p.full_name AS parent_name,
    sib.id AS relative_id,
    sib.full_name AS relative_name,
    CASE
      WHEN p.parent_order = 1 THEN 'paternal_parent_sibling'
      WHEN p.parent_order = 2 THEN 'maternal_parent_sibling'
      ELSE 'parent_sibling'
    END AS collateral_category,
    sib.gender
  FROM parents p
  JOIN family_lineage sib ON sib.id <> p.id
  WHERE p.parent_ids IS NOT NULL
    AND p.parent_ids <> '[]'::jsonb
    AND sib.parent_ids = p.parent_ids
)
SELECT * FROM parent_siblings ORDER BY parent_id, relative_name;
