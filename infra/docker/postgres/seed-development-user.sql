INSERT INTO users (sso_user_id, sso_subject, privacy_consent_at)
VALUES
  ('development-admin', 'development-admin', NOW()),
  ('development-user-1', 'development-user-1', NOW()),
  ('development-user-2', 'development-user-2', NOW())
ON CONFLICT (sso_user_id) DO UPDATE
SET sso_subject = EXCLUDED.sso_subject,
    privacy_consent_at = COALESCE(users.privacy_consent_at, EXCLUDED.privacy_consent_at),
    updated_at = NOW();

DELETE FROM permission_grants
USING users
WHERE permission_grants.user_id = users.id
  AND users.sso_user_id IN ('development-user-1', 'development-user-2');

INSERT INTO permission_grants (
  user_id,
  permission_definition_id,
  scope,
  scope_id,
  granted_by_user_id
)
SELECT
  development_admin.id,
  definition.id,
  'GLOBAL',
  NULL,
  development_admin.id
FROM users AS development_admin
CROSS JOIN permission_definitions AS definition
WHERE development_admin.sso_user_id = 'development-admin'
  AND definition.is_active = true
  AND NOT EXISTS (
    SELECT 1
    FROM permission_grants AS existing
    WHERE existing.user_id = development_admin.id
      AND existing.permission_definition_id = definition.id
      AND existing.scope = 'GLOBAL'
      AND existing.scope_id IS NULL
      AND existing.revoked_at IS NULL
  );
