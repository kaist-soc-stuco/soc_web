UPDATE "roadmap_course"
SET "course_code" = 'MAS10009',
    "legacy_course_code" = COALESCE(NULLIF("legacy_course_code", ''), 'MAS109'),
    "updated_at" = NOW()
WHERE "course_code" = 'MAS109'
  AND NOT EXISTS (
    SELECT 1
    FROM "roadmap_course" AS existing
    WHERE existing."course_code" = 'MAS10009'
  );--> statement-breakpoint

UPDATE "roadmap_course"
SET "legacy_course_code" = COALESCE(NULLIF("legacy_course_code", ''), 'MAS109'),
    "updated_at" = NOW()
WHERE "course_code" = 'MAS10009';--> statement-breakpoint

UPDATE "roadmap_offering"
SET "course_code" = 'MAS10009'
WHERE "course_code" = 'MAS109';
