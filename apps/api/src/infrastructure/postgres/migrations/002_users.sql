CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
	id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
	sso_user_id TEXT NOT NULL UNIQUE,
	user_email TEXT,
	user_mobile TEXT,
	privacy_consent_at TIMESTAMPTZ,
	created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
