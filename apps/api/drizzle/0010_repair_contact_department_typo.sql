-- Repair stored names as well as references in each member's history.
DO $$
DECLARE
  typo_id uuid;
  canonical_id uuid;
BEGIN
  SELECT id INTO typo_id FROM executive_contact_department WHERE name_ko = '전산관리부부';
  SELECT id INTO canonical_id FROM executive_contact_department WHERE name_ko = '전산관리부';
  IF typo_id IS NOT NULL AND canonical_id IS NULL THEN
    UPDATE executive_contact_department SET name_ko = '전산관리부', updated_at = now() WHERE id = typo_id;
    canonical_id := typo_id;
  END IF;

  UPDATE executive_contact c
  SET department_ko = CASE WHEN department_ko = '전산관리부부' THEN '전산관리부' ELSE department_ko END,
      role_ko = CASE WHEN role_ko = '전산관리부부장' THEN '전산관리부장' ELSE role_ko END,
      activities = (
        SELECT COALESCE(jsonb_agg(
          a
          || CASE WHEN a->>'departmentKo' = '전산관리부부' THEN jsonb_build_object('departmentKo', '전산관리부') ELSE '{}'::jsonb END
          || CASE WHEN a->>'roleKo' = '전산관리부부장' THEN jsonb_build_object('roleKo', '전산관리부장') ELSE '{}'::jsonb END
          || CASE WHEN typo_id IS NOT NULL AND a->>'departmentId' = typo_id::text
               THEN jsonb_build_object('departmentId', canonical_id::text, 'departmentKo', '전산관리부') ELSE '{}'::jsonb END
          ORDER BY position), '[]'::jsonb)
        FROM jsonb_array_elements(c.activities) WITH ORDINALITY AS history(a, position)
      ),
      updated_at = now()
  WHERE department_ko = '전산관리부부' OR role_ko = '전산관리부부장'
     OR EXISTS (SELECT 1 FROM jsonb_array_elements(c.activities) a
       WHERE a->>'departmentKo' = '전산관리부부' OR a->>'roleKo' = '전산관리부부장'
          OR (typo_id IS NOT NULL AND a->>'departmentId' = typo_id::text));

  IF typo_id IS NOT NULL AND typo_id <> canonical_id THEN
    DELETE FROM executive_contact_department WHERE id = typo_id;
  END IF;
END $$;
