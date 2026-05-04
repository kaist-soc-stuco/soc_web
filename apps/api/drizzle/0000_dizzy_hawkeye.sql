CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sso_user_id" text NOT NULL,
	"permission" integer DEFAULT 0 NOT NULL,
	"user_email" text,
	"user_mobile" text,
	"privacy_consent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_sso_user_id_unique" UNIQUE("sso_user_id")
);
