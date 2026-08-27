-- Older MODERATOR roles combined user and content administration. Preserve
-- both capabilities after splitting them into MANAGE_USERS and
-- MODERATE_CONTENT. This also repairs databases that already ran 0008.
INSERT INTO "role_group_permission" ("role_group_id", "permission_id")
SELECT "role_group_id", 256
FROM "role_group_permission"
WHERE "permission_id" = 512
ON CONFLICT DO NOTHING;
