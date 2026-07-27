CREATE TYPE "public"."fee_status" AS ENUM('UNKNOWN', 'UNPAID', 'PAID');--> statement-breakpoint
CREATE TYPE "public"."permission_change_action" AS ENUM('GRANT', 'REVOKE');--> statement-breakpoint
CREATE TYPE "public"."permission_change_request_status" AS ENUM('PENDING', 'APPROVED', 'ACTIVATED', 'REJECTED', 'CANCELLED', 'EXPIRED');--> statement-breakpoint
CREATE TYPE "public"."permission_grant_scope" AS ENUM('GLOBAL', 'BOARD', 'EVENT', 'SURVEY');--> statement-breakpoint
CREATE TABLE "authorization_backfill_progress" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_key" text NOT NULL,
	"last_processed_user_id" uuid,
	"batch_size" integer DEFAULT 500 NOT NULL,
	"completed_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "authorization_backfill_progress_job_key_unique" UNIQUE("job_key")
);
--> statement-breakpoint
CREATE TABLE "authorization_bootstrap_state" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"fingerprint" text NOT NULL,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "authorization_bootstrap_state_fingerprint_unique" UNIQUE("fingerprint")
);
--> statement-breakpoint
CREATE TABLE "permission_audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_user_id" uuid,
	"action" text NOT NULL,
	"record_id" uuid NOT NULL,
	"changed_field_names" text NOT NULL,
	"correlation_id" text NOT NULL,
	"reason_code" text,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "permission_change_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"target_user_id" uuid NOT NULL,
	"action" "permission_change_action" NOT NULL,
	"requested_reason_code" text NOT NULL,
	"permission_definition_id" uuid NOT NULL,
	"scope" "permission_grant_scope" NOT NULL,
	"scope_id" text,
	"request_hash" text NOT NULL,
	"status" "permission_change_request_status" DEFAULT 'PENDING' NOT NULL,
	"requester_user_id" uuid NOT NULL,
	"approver_user_id" uuid,
	"approval_reason_code" text,
	"activator_user_id" uuid,
	"activation_reason_code" text,
	"requested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"approved_at" timestamp with time zone,
	"activated_at" timestamp with time zone,
	"rejected_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	"expires_at" timestamp with time zone DEFAULT now() + interval '24 hours' NOT NULL,
	CONSTRAINT "permission_change_requests_scope_id_check" CHECK (("permission_change_requests"."scope" = 'GLOBAL' AND "permission_change_requests"."scope_id" IS NULL) OR ("permission_change_requests"."scope" <> 'GLOBAL' AND "permission_change_requests"."scope_id" IS NOT NULL)),
	CONSTRAINT "permission_change_requests_actor_separation_check" CHECK (("permission_change_requests"."approver_user_id" IS NULL OR ("permission_change_requests"."approver_user_id" <> "permission_change_requests"."requester_user_id" AND "permission_change_requests"."approver_user_id" <> "permission_change_requests"."target_user_id")) AND ("permission_change_requests"."activator_user_id" IS NULL OR "permission_change_requests"."activator_user_id" <> "permission_change_requests"."requester_user_id"))
);
--> statement-breakpoint
CREATE TABLE "permission_definitions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"description" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "permission_grants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"permission_definition_id" uuid NOT NULL,
	"scope" "permission_grant_scope" NOT NULL,
	"scope_id" text,
	"granted_by_user_id" uuid NOT NULL,
	"activated_from" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"revoked_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "permission_grants_scope_id_check" CHECK (("permission_grants"."scope" = 'GLOBAL' AND "permission_grants"."scope_id" IS NULL) OR ("permission_grants"."scope" <> 'GLOBAL' AND "permission_grants"."scope_id" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "student_council_role_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"kaist_uid_snapshot" text NOT NULL,
	"year" integer NOT NULL,
	"role_key" text NOT NULL,
	"source_fingerprint" text NOT NULL,
	"captured_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "sso_subject" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "kaist_uid" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "student_or_employee_number" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "name_kr" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "name_en" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "major_mask" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "fee_status" "fee_status" DEFAULT 'UNKNOWN' NOT NULL;--> statement-breakpoint
ALTER TABLE "authorization_backfill_progress" ADD CONSTRAINT "authorization_backfill_progress_last_processed_user_id_users_id_fk" FOREIGN KEY ("last_processed_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "permission_audit_log" ADD CONSTRAINT "permission_audit_log_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "permission_change_requests" ADD CONSTRAINT "permission_change_requests_target_user_id_users_id_fk" FOREIGN KEY ("target_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "permission_change_requests" ADD CONSTRAINT "permission_change_requests_permission_definition_id_permission_definitions_id_fk" FOREIGN KEY ("permission_definition_id") REFERENCES "public"."permission_definitions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "permission_change_requests" ADD CONSTRAINT "permission_change_requests_requester_user_id_users_id_fk" FOREIGN KEY ("requester_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "permission_change_requests" ADD CONSTRAINT "permission_change_requests_approver_user_id_users_id_fk" FOREIGN KEY ("approver_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "permission_change_requests" ADD CONSTRAINT "permission_change_requests_activator_user_id_users_id_fk" FOREIGN KEY ("activator_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "permission_grants" ADD CONSTRAINT "permission_grants_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "permission_grants" ADD CONSTRAINT "permission_grants_permission_definition_id_permission_definitions_id_fk" FOREIGN KEY ("permission_definition_id") REFERENCES "public"."permission_definitions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "permission_grants" ADD CONSTRAINT "permission_grants_granted_by_user_id_users_id_fk" FOREIGN KEY ("granted_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "permission_grants" ADD CONSTRAINT "permission_grants_revoked_by_user_id_users_id_fk" FOREIGN KEY ("revoked_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_council_role_snapshots" ADD CONSTRAINT "student_council_role_snapshots_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "permission_audit_log_occurred_at_idx" ON "permission_audit_log" USING btree ("occurred_at");--> statement-breakpoint
CREATE INDEX "permission_change_requests_request_hash_idx" ON "permission_change_requests" USING btree ("request_hash");--> statement-breakpoint
CREATE INDEX "permission_change_requests_pending_idx" ON "permission_change_requests" USING btree ("status","expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "permission_definitions_key_unique" ON "permission_definitions" USING btree ("key");--> statement-breakpoint
CREATE INDEX "permission_grants_effective_lookup_idx" ON "permission_grants" USING btree ("user_id","permission_definition_id","scope","scope_id");--> statement-breakpoint
CREATE UNIQUE INDEX "permission_grants_effective_unique" ON "permission_grants" USING btree ("user_id","permission_definition_id","scope",COALESCE("scope_id", '')) WHERE "permission_grants"."revoked_at" IS NULL;--> statement-breakpoint
CREATE INDEX "student_council_role_snapshots_user_idx" ON "student_council_role_snapshots" USING btree ("user_id","captured_at");--> statement-breakpoint
CREATE INDEX "student_council_role_snapshots_uid_year_idx" ON "student_council_role_snapshots" USING btree ("kaist_uid_snapshot","year");--> statement-breakpoint
CREATE UNIQUE INDEX "users_sso_subject_unique" ON "users" USING btree ("sso_subject");--> statement-breakpoint
CREATE UNIQUE INDEX "users_kaist_uid_unique" ON "users" USING btree ("kaist_uid");
--> statement-breakpoint
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
--> statement-breakpoint
ALTER TABLE "authorization_backfill_progress" ADD COLUMN "upper_bound_user_id" uuid;--> statement-breakpoint
ALTER TABLE "authorization_backfill_progress" ADD CONSTRAINT "authorization_backfill_progress_upper_bound_user_id_users_id_fk" FOREIGN KEY ("upper_bound_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "permission_audit_log"
  ADD CONSTRAINT "permission_audit_log_action_technical_identifier_check"
  CHECK ("action" ~ '^[A-Z][A-Z0-9_]{1,63}$'),
  ADD CONSTRAINT "permission_audit_log_reason_code_technical_identifier_check"
  CHECK ("reason_code" IS NULL OR "reason_code" ~ '^[A-Z][A-Z0-9_]{1,63}$');--> statement-breakpoint
ALTER TABLE "permission_change_requests"
  ADD CONSTRAINT "permission_change_requests_requested_reason_code_technical_identifier_check"
  CHECK ("requested_reason_code" ~ '^[A-Z][A-Z0-9_]{1,63}$'),
  ADD CONSTRAINT "permission_change_requests_approval_reason_code_technical_identifier_check"
  CHECK ("approval_reason_code" IS NULL OR "approval_reason_code" ~ '^[A-Z][A-Z0-9_]{1,63}$'),
  ADD CONSTRAINT "permission_change_requests_activation_reason_code_technical_identifier_check"
  CHECK ("activation_reason_code" IS NULL OR "activation_reason_code" ~ '^[A-Z][A-Z0-9_]{1,63}$');--> statement-breakpoint
CREATE OR REPLACE FUNCTION "public"."permission_change_requests_prevent_payload_mutation"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.target_user_id IS DISTINCT FROM OLD.target_user_id
    OR NEW.action IS DISTINCT FROM OLD.action
    OR NEW.requested_reason_code IS DISTINCT FROM OLD.requested_reason_code
    OR NEW.permission_definition_id IS DISTINCT FROM OLD.permission_definition_id
    OR NEW.scope IS DISTINCT FROM OLD.scope
    OR NEW.scope_id IS DISTINCT FROM OLD.scope_id
    OR NEW.request_hash IS DISTINCT FROM OLD.request_hash
    OR NEW.requester_user_id IS DISTINCT FROM OLD.requester_user_id
    OR NEW.requested_at IS DISTINCT FROM OLD.requested_at
    OR NEW.expires_at IS DISTINCT FROM OLD.expires_at
  THEN
    RAISE EXCEPTION 'permission change request payload is immutable';
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NOT (
      (OLD.status = 'PENDING' AND NEW.status IN ('APPROVED', 'REJECTED', 'CANCELLED', 'EXPIRED'))
      OR (OLD.status = 'APPROVED' AND NEW.status IN ('ACTIVATED', 'EXPIRED'))
    ) THEN
      RAISE EXCEPTION 'invalid permission change request transition';
    END IF;

    IF NEW.status = 'APPROVED' AND (
      NEW.approver_user_id IS NULL
      OR NEW.approval_reason_code IS NULL
      OR NEW.approved_at IS NULL
    ) THEN
      RAISE EXCEPTION 'approval metadata is required';
    END IF;

    IF NEW.status = 'ACTIVATED' AND (
      NEW.approver_user_id IS NULL
      OR NEW.approved_at IS NULL
      OR NEW.activator_user_id IS NULL
      OR NEW.activation_reason_code IS NULL
      OR NEW.activated_at IS NULL
    ) THEN
      RAISE EXCEPTION 'activation metadata is required';
    END IF;
  END IF;

  IF (
    NEW.approver_user_id IS DISTINCT FROM OLD.approver_user_id
    OR NEW.approval_reason_code IS DISTINCT FROM OLD.approval_reason_code
    OR NEW.approved_at IS DISTINCT FROM OLD.approved_at
  ) AND NOT (OLD.status = 'PENDING' AND NEW.status = 'APPROVED') THEN
    RAISE EXCEPTION 'approval metadata is immutable outside approval';
  END IF;

  IF (
    NEW.activator_user_id IS DISTINCT FROM OLD.activator_user_id
    OR NEW.activation_reason_code IS DISTINCT FROM OLD.activation_reason_code
    OR NEW.activated_at IS DISTINCT FROM OLD.activated_at
  ) AND NOT (OLD.status = 'APPROVED' AND NEW.status = 'ACTIVATED') THEN
    RAISE EXCEPTION 'activation metadata is immutable outside activation';
  END IF;
  RETURN NEW;
END;
$$;--> statement-breakpoint
CREATE TRIGGER "permission_change_requests_prevent_payload_mutation"
BEFORE UPDATE ON "permission_change_requests"
FOR EACH ROW EXECUTE FUNCTION "public"."permission_change_requests_prevent_payload_mutation"();--> statement-breakpoint
CREATE INDEX "permission_audit_log_occurred_at_id_idx" ON "permission_audit_log" USING btree ("occurred_at", "id");