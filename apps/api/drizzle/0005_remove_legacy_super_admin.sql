-- Replace the implicit all-access bit with the explicit permission set.
UPDATE "permission"
SET "is_active" = false
WHERE "code" = 'SUPER_ADMIN';
--> statement-breakpoint
DELETE FROM "role_group_permission"
WHERE "permission_id" IN (
  SELECT "permission_id"
  FROM "permission"
  WHERE "code" = 'SUPER_ADMIN'
);
--> statement-breakpoint
INSERT INTO "role_group_permission" ("role_group_id", "permission_id")
SELECT "role_group"."role_group_id", "permission"."permission_id"
FROM "role_group"
CROSS JOIN "permission"
WHERE "role_group"."name_ko" = '최고 관리자'
  AND "permission"."is_active" = true
ON CONFLICT ("role_group_id", "permission_id") DO NOTHING;
