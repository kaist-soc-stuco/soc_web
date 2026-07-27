CREATE TABLE "contact_audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contact_id" uuid NOT NULL,
	"actor_user_id" uuid,
	"actor_system_identity" text,
	"action" text NOT NULL,
	"changed_field_names" text NOT NULL,
	"correlation_id" text NOT NULL,
	"reason_code" text,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "contact_audit_log_actor_identity" CHECK (("contact_audit_log"."actor_user_id" IS NOT NULL) <> ("contact_audit_log"."actor_system_identity" IS NOT NULL)),
	CONSTRAINT "contact_audit_log_system_identity_nonblank" CHECK ("contact_audit_log"."actor_system_identity" IS NULL OR btrim("contact_audit_log"."actor_system_identity") <> ''),
	CONSTRAINT "contact_audit_log_action_identifier" CHECK ("contact_audit_log"."action" ~ '^[A-Z][A-Z0-9_]{1,63}$'),
	CONSTRAINT "contact_audit_log_changed_fields" CHECK ("contact_audit_log"."changed_field_names" ~ '^(name|email|phone|affiliation|note|kaistUid|year|role|retentionDeadlineAt|holdUntil|deletedAt)(,(name|email|phone|affiliation|note|kaistUid|year|role|retentionDeadlineAt|holdUntil|deletedAt))*$'),
	CONSTRAINT "contact_audit_log_correlation_id" CHECK ("contact_audit_log"."correlation_id" ~ '^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$'),
	CONSTRAINT "contact_audit_log_reason_code" CHECK ("contact_audit_log"."reason_code" IS NULL OR "contact_audit_log"."reason_code" ~ '^[A-Z][A-Z0-9_]{1,63}$')
);
--> statement-breakpoint
CREATE TABLE "contacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name_envelope" text NOT NULL,
	"email_envelope" text,
	"phone_envelope" text,
	"affiliation_envelope" text,
	"note_envelope" text,
	"kaist_uid_envelope" text,
	"year_envelope" text,
	"role_envelope" text,
	"created_by_user_id" uuid NOT NULL,
	"updated_by_user_id" uuid NOT NULL,
	"deleted_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"retention_deadline_at" timestamp with time zone NOT NULL,
	"hold_until" timestamp with time zone,
	CONSTRAINT "contacts_name_envelope_shape" CHECK ("contacts"."name_envelope" ~ '^enc:v1:[A-Za-z0-9][A-Za-z0-9._-]{0,63}:[A-Za-z0-9_-]+:[A-Za-z0-9_-]+:[A-Za-z0-9_-]+$'),
	CONSTRAINT "contacts_email_envelope_shape" CHECK ("contacts"."email_envelope" IS NULL OR "contacts"."email_envelope" ~ '^enc:v1:[A-Za-z0-9][A-Za-z0-9._-]{0,63}:[A-Za-z0-9_-]+:[A-Za-z0-9_-]+:[A-Za-z0-9_-]+$'),
	CONSTRAINT "contacts_phone_envelope_shape" CHECK ("contacts"."phone_envelope" IS NULL OR "contacts"."phone_envelope" ~ '^enc:v1:[A-Za-z0-9][A-Za-z0-9._-]{0,63}:[A-Za-z0-9_-]+:[A-Za-z0-9_-]+:[A-Za-z0-9_-]+$'),
	CONSTRAINT "contacts_affiliation_envelope_shape" CHECK ("contacts"."affiliation_envelope" IS NULL OR "contacts"."affiliation_envelope" ~ '^enc:v1:[A-Za-z0-9][A-Za-z0-9._-]{0,63}:[A-Za-z0-9_-]+:[A-Za-z0-9_-]+:[A-Za-z0-9_-]+$'),
	CONSTRAINT "contacts_note_envelope_shape" CHECK ("contacts"."note_envelope" IS NULL OR "contacts"."note_envelope" ~ '^enc:v1:[A-Za-z0-9][A-Za-z0-9._-]{0,63}:[A-Za-z0-9_-]+:[A-Za-z0-9_-]+:[A-Za-z0-9_-]+$'),
	CONSTRAINT "contacts_kaist_uid_envelope_shape" CHECK ("contacts"."kaist_uid_envelope" IS NULL OR "contacts"."kaist_uid_envelope" ~ '^enc:v1:[A-Za-z0-9][A-Za-z0-9._-]{0,63}:[A-Za-z0-9_-]+:[A-Za-z0-9_-]+:[A-Za-z0-9_-]+$'),
	CONSTRAINT "contacts_year_envelope_shape" CHECK ("contacts"."year_envelope" IS NULL OR "contacts"."year_envelope" ~ '^enc:v1:[A-Za-z0-9][A-Za-z0-9._-]{0,63}:[A-Za-z0-9_-]+:[A-Za-z0-9_-]+:[A-Za-z0-9_-]+$'),
	CONSTRAINT "contacts_role_envelope_shape" CHECK ("contacts"."role_envelope" IS NULL OR "contacts"."role_envelope" ~ '^enc:v1:[A-Za-z0-9][A-Za-z0-9._-]{0,63}:[A-Za-z0-9_-]+:[A-Za-z0-9_-]+:[A-Za-z0-9_-]+$'),
	CONSTRAINT "contacts_envelopes_nonblank" CHECK (btrim("contacts"."name_envelope") <> '' AND ("contacts"."email_envelope" IS NULL OR btrim("contacts"."email_envelope") <> '') AND ("contacts"."phone_envelope" IS NULL OR btrim("contacts"."phone_envelope") <> '') AND ("contacts"."affiliation_envelope" IS NULL OR btrim("contacts"."affiliation_envelope") <> '') AND ("contacts"."note_envelope" IS NULL OR btrim("contacts"."note_envelope") <> '') AND ("contacts"."kaist_uid_envelope" IS NULL OR btrim("contacts"."kaist_uid_envelope") <> '') AND ("contacts"."year_envelope" IS NULL OR btrim("contacts"."year_envelope") <> '') AND ("contacts"."role_envelope" IS NULL OR btrim("contacts"."role_envelope") <> '')),
	CONSTRAINT "contacts_deletion_lifecycle" CHECK (("contacts"."deleted_at" IS NULL AND "contacts"."deleted_by_user_id" IS NULL) OR ("contacts"."deleted_at" IS NOT NULL AND "contacts"."deleted_by_user_id" IS NOT NULL AND "contacts"."deleted_at" >= "contacts"."created_at")),
	CONSTRAINT "contacts_retention_lifecycle" CHECK ("contacts"."retention_deadline_at" >= "contacts"."created_at"),
	CONSTRAINT "contacts_hold_lifecycle" CHECK ("contacts"."hold_until" IS NULL OR "contacts"."hold_until" >= "contacts"."created_at")
);
--> statement-breakpoint
ALTER TABLE "contact_audit_log" ADD CONSTRAINT "contact_audit_log_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_updated_by_user_id_users_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_deleted_by_user_id_users_id_fk" FOREIGN KEY ("deleted_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "contacts_created_id_idx" ON "contacts" USING btree ("created_at","id");--> statement-breakpoint
CREATE INDEX "contacts_retention_idx" ON "contacts" USING btree ("retention_deadline_at");