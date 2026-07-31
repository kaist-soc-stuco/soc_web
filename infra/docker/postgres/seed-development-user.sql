INSERT INTO users (sso_user_id, sso_subject, privacy_consent_at)
VALUES ('development-user', 'development-user', NOW())
ON CONFLICT (sso_user_id) DO UPDATE
SET sso_subject = EXCLUDED.sso_subject,
    privacy_consent_at = COALESCE(users.privacy_consent_at, EXCLUDED.privacy_consent_at),
    updated_at = NOW();
INSERT INTO permission_grants (
  user_id,
  permission_definition_id,
  scope,
  scope_id,
  granted_by_user_id
)
SELECT
  development_user.id,
  definition.id,
  'GLOBAL',
  NULL,
  development_user.id
FROM users AS development_user
CROSS JOIN permission_definitions AS definition
WHERE development_user.sso_user_id = 'development-user'
  AND definition.is_active = true
  AND NOT EXISTS (
    SELECT 1
    FROM permission_grants AS existing
    WHERE existing.user_id = development_user.id
      AND existing.permission_definition_id = definition.id
      AND existing.scope = 'GLOBAL'
      AND existing.scope_id IS NULL
      AND existing.revoked_at IS NULL
  );
