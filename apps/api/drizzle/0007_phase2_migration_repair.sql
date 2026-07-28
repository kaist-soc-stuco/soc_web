DO $$
BEGIN
  INSERT INTO "permission_definitions" ("key", "description")
  VALUES
    ('PERMISSION_GRANT', 'Request scoped permission grants'),
    ('PERMISSION_REVOKE', 'Request scoped permission revocations'),
    ('PERMISSION_APPROVE', 'Approve scoped permission changes'),
    ('PERMISSION_ACTIVATE', 'Activate approved scoped permission changes'),
    ('PERMISSION_AUDIT', 'Read minimized permission audit events'),
    ('USERS_MANAGE', 'Read administrative user projections'),
    ('FEES_MANAGE', 'Read and update fee status'),
    ('CONTACTS_MANAGE', 'Manage encrypted administrative contacts'),
    ('MAIL_SEND', 'Send provider-gated administrative mail'),
    ('SURVEY_REVIEW', 'Review survey results')
  ON CONFLICT ("key") DO NOTHING;
END $$;--> statement-breakpoint
ALTER TABLE "authorization_backfill_progress" ADD COLUMN IF NOT EXISTS "upper_bound_user_id" uuid;--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'authorization_backfill_progress_upper_bound_user_id_users_id_fk') THEN
    ALTER TABLE "authorization_backfill_progress" ADD CONSTRAINT "authorization_backfill_progress_upper_bound_user_id_users_id_fk" FOREIGN KEY ("upper_bound_user_id") REFERENCES "public"."users"("id");
  END IF;
END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'permission_audit_log_action_technical_identifier_check') THEN ALTER TABLE "permission_audit_log" ADD CONSTRAINT "permission_audit_log_action_technical_identifier_check" CHECK ("action" ~ '^[A-Z][A-Z0-9_]{1,63}$'); END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'permission_audit_log_reason_code_technical_identifier_check') THEN ALTER TABLE "permission_audit_log" ADD CONSTRAINT "permission_audit_log_reason_code_technical_identifier_check" CHECK ("reason_code" IS NULL OR "reason_code" ~ '^[A-Z][A-Z0-9_]{1,63}$'); END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'permission_change_requests_requested_reason_code_technical_identifier_check') THEN ALTER TABLE "permission_change_requests" ADD CONSTRAINT "permission_change_requests_requested_reason_code_technical_identifier_check" CHECK ("requested_reason_code" ~ '^[A-Z][A-Z0-9_]{1,63}$'); END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'permission_change_requests_approval_reason_code_technical_identifier_check') THEN ALTER TABLE "permission_change_requests" ADD CONSTRAINT "permission_change_requests_approval_reason_code_technical_identifier_check" CHECK ("approval_reason_code" IS NULL OR "approval_reason_code" ~ '^[A-Z][A-Z0-9_]{1,63}$'); END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'permission_change_requests_activation_reason_code_technical_identifier_check') THEN ALTER TABLE "permission_change_requests" ADD CONSTRAINT "permission_change_requests_activation_reason_code_technical_identifier_check" CHECK ("activation_reason_code" IS NULL OR "activation_reason_code" ~ '^[A-Z][A-Z0-9_]{1,63}$'); END IF; END $$;--> statement-breakpoint
DROP INDEX IF EXISTS "permission_change_requests_request_hash_unique";--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "permission_change_requests_request_hash_idx" ON "permission_change_requests" USING btree ("request_hash");--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'permission_change_requests_prevent_payload_mutation') THEN
    CREATE OR REPLACE FUNCTION "public"."permission_change_requests_prevent_payload_mutation"() RETURNS trigger LANGUAGE plpgsql AS $fn$
    BEGIN
      IF NEW.target_user_id IS DISTINCT FROM OLD.target_user_id OR NEW.action IS DISTINCT FROM OLD.action OR NEW.requested_reason_code IS DISTINCT FROM OLD.requested_reason_code OR NEW.permission_definition_id IS DISTINCT FROM OLD.permission_definition_id OR NEW.scope IS DISTINCT FROM OLD.scope OR NEW.scope_id IS DISTINCT FROM OLD.scope_id OR NEW.request_hash IS DISTINCT FROM OLD.request_hash OR NEW.requester_user_id IS DISTINCT FROM OLD.requester_user_id OR NEW.requested_at IS DISTINCT FROM OLD.requested_at OR NEW.expires_at IS DISTINCT FROM OLD.expires_at THEN RAISE EXCEPTION 'permission change request payload is immutable'; END IF;
      RETURN NEW;
    END;
    $fn$;
    CREATE TRIGGER "permission_change_requests_prevent_payload_mutation" BEFORE UPDATE ON "permission_change_requests" FOR EACH ROW EXECUTE FUNCTION "public"."permission_change_requests_prevent_payload_mutation"();
  END IF;
END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "permission_audit_log_occurred_at_id_idx" ON "permission_audit_log" USING btree ("occurred_at", "id");
