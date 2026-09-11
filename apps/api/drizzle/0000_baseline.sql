-- Squashed baseline: schema and migration changes through 0029_remove_user_phone.
-- Fresh PostgreSQL databases apply this file as the single migration baseline.
-- Existing databases that already contain the pre-squash migration history keep
-- their history; the baseline timestamp is intentionally compatible with it.

CREATE TYPE "public"."content_block_status" AS ENUM('DRAFT', 'PUBLISHED');--> statement-breakpoint
CREATE TYPE "public"."content_block_type" AS ENUM('HERO', 'LOGO', 'TOP_BANNER', 'QUICK_LINK', 'ORGANIZATION_CHART', 'PLEDGE');--> statement-breakpoint
CREATE TYPE "public"."site_content_key" AS ENUM('home.hero.title', 'home.hero.description', 'home.hero.cta', 'about.hero.description', 'about.intro.title', 'about.intro.body', 'about.roadmap.title', 'about.roadmap.description', 'footer.description', 'footer.contact');--> statement-breakpoint
CREATE TABLE "permission" (
	"permission_id" serial PRIMARY KEY NOT NULL,
	"code" varchar(50) NOT NULL,
	"bit_value" bigint NOT NULL,
	"name_ko" varchar(100) NOT NULL,
	"name_en" varchar(100),
	"description" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "permission_code_unique" UNIQUE("code"),
	CONSTRAINT "permission_bit_value_unique" UNIQUE("bit_value")
);
--> statement-breakpoint
CREATE TABLE "role_group_permission" (
	"role_group_id" integer NOT NULL,
	"permission_id" integer NOT NULL,
	"granted_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "role_group_permission_role_group_id_permission_id_pk" PRIMARY KEY("role_group_id","permission_id")
);
--> statement-breakpoint
CREATE TABLE "role_group" (
	"role_group_id" serial PRIMARY KEY NOT NULL,
	"name_ko" varchar(100) NOT NULL,
	"description" text,
	"is_system" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "role_group_name_ko_unique" UNIQUE("name_ko")
);
--> statement-breakpoint
CREATE TABLE "user_role_group" (
	"user_role_group_id" serial PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"role_group_id" integer NOT NULL,
	"granted_by" uuid,
	"granted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"valid_from" timestamp with time zone,
	"valid_to" timestamp with time zone,
	"is_active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_sanction" (
	"sanction_id" serial PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"type" varchar(40) DEFAULT 'POSTING_SUSPENDED' NOT NULL,
	"reason" text NOT NULL,
	"issued_by" uuid,
	"starts_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"revoked_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"user_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kaist_uid" varchar(20) NOT NULL,
	"std_no" varchar(20),
	"name_ko" varchar(100) NOT NULL,
	"name_en" varchar(100),
	"email" varchar(255) NOT NULL,
	"privacy_consent_at" timestamp with time zone,
	"dept_ko" varchar(100),
	"dept_en" varchar(100),
	"primary_major" varchar(100),
	"double_major" varchar(100),
	"minor" varchar(100),
	"gender" varchar(20),
	"phone_number" varchar(50),
	"academic_status" varchar(20),
	"identity_code" varchar(10),
	"is_active" boolean DEFAULT true NOT NULL,
	"last_login_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_kaist_uid_unique" UNIQUE("kaist_uid"),
	CONSTRAINT "users_std_no_unique" UNIQUE("std_no"),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "student_fee_payment" (
	"payment_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"amount" integer DEFAULT 0 NOT NULL,
	"payment_type" varchar(40) NOT NULL,
	"payment_method" varchar(30) NOT NULL,
	"effective_start_semester" varchar(7) NOT NULL,
	"coverage_semesters" smallint DEFAULT 6 NOT NULL,
	"paid_at" timestamp with time zone NOT NULL,
	"note" text,
	"recorded_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "student_fee_status" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"coverage_semesters" smallint DEFAULT 6 NOT NULL,
	"paid_amount" integer DEFAULT 0 NOT NULL,
	"status" varchar(20) NOT NULL,
	"paid_at" timestamp with time zone,
	"verified_by" uuid,
	"verified_at" timestamp with time zone,
	"note" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "article_asset" (
	"article_asset_id" serial PRIMARY KEY NOT NULL,
	"article_id" integer NOT NULL,
	"asset_id" integer NOT NULL,
	"usage_type" varchar(20) NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "article_draft" (
	"draft_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_user_id" uuid NOT NULL,
	"board_id" integer NOT NULL,
	"target_article_id" integer,
	"title_ko" varchar(255) DEFAULT '' NOT NULL,
	"title_en" varchar(255),
	"content_ko" text DEFAULT '' NOT NULL,
	"content_en" text,
	"fingerprint" varchar(128) NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"payload" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "article_engagement" (
	"article_id" integer NOT NULL,
	"user_id" uuid NOT NULL,
	"kind" varchar(10) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "article_engagement_article_id_user_id_kind_pk" PRIMARY KEY("article_id","user_id","kind")
);
--> statement-breakpoint
CREATE TABLE "article_view" (
	"article_id" integer NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "article_view_article_id_user_id_pk" PRIMARY KEY("article_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "article" (
	"article_id" serial PRIMARY KEY NOT NULL,
	"board_id" integer NOT NULL,
	"author_user_id" uuid NOT NULL,
	"title_ko" varchar(255) NOT NULL,
	"title_en" varchar(255),
	"content_ko" text NOT NULL,
	"content_en" text,
	"status" varchar(20) DEFAULT 'PUBLISHED' NOT NULL,
	"visibility_scope" varchar(20) DEFAULT 'PUBLIC' NOT NULL,
	"is_pinned" boolean DEFAULT false NOT NULL,
	"pin_order" integer,
	"home_visible" boolean DEFAULT true NOT NULL,
	"home_order" integer,
	"is_secret" boolean DEFAULT false NOT NULL,
	"is_anonymous" boolean DEFAULT false NOT NULL,
	"allow_comment" boolean DEFAULT true NOT NULL,
	"view_count" integer DEFAULT 0 NOT NULL,
	"posted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"hidden_at" timestamp with time zone,
	"hidden_by_user_id" uuid,
	"hidden_reason" varchar(500),
	"event_start_date" timestamp with time zone,
	"event_end_date" timestamp with time zone,
	"event_description_ko" text,
	"event_description_en" text
);
--> statement-breakpoint
CREATE TABLE "asset" (
	"asset_id" serial PRIMARY KEY NOT NULL,
	"storage_key" text NOT NULL,
	"original_filename" text NOT NULL,
	"mime_type" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"checksum" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"uploaded_by" uuid NOT NULL,
	CONSTRAINT "asset_storage_key_unique" UNIQUE("storage_key")
);
--> statement-breakpoint
CREATE TABLE "board" (
	"board_id" serial PRIMARY KEY NOT NULL,
	"code" varchar(20) NOT NULL,
	"name_ko" varchar(20) NOT NULL,
	"name_en" varchar(100),
	"description_ko" varchar(255),
	"description_en" varchar(255),
	"write_permission_id" integer,
	"allow_comment" boolean DEFAULT false NOT NULL,
	"allow_secret" boolean DEFAULT false NOT NULL,
	"allow_like" boolean DEFAULT true NOT NULL,
	"allow_guest_read" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "board_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "comment_engagement" (
	"comment_id" integer NOT NULL,
	"user_id" uuid NOT NULL,
	"kind" varchar(10) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "comment_engagement_comment_id_user_id_kind_pk" PRIMARY KEY("comment_id","user_id","kind")
);
--> statement-breakpoint
CREATE TABLE "comment" (
	"comment_id" serial PRIMARY KEY NOT NULL,
	"article_id" integer NOT NULL,
	"parent_comment_id" integer,
	"author_user_id" uuid NOT NULL,
	"content" text NOT NULL,
	"is_official" boolean DEFAULT false NOT NULL,
	"status" varchar(20) DEFAULT 'PUBLISHED' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"hidden_at" timestamp with time zone,
	"hidden_by_user_id" uuid,
	"hidden_reason" text
);
--> statement-breakpoint
CREATE TABLE "survey_answers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"response_id" uuid NOT NULL,
	"question_id" uuid NOT NULL,
	"content" jsonb NOT NULL,
	"submitted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "survey_questions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"section_id" uuid NOT NULL,
	"title_ko" text NOT NULL,
	"title_en" text,
	"description_ko" text,
	"description_en" text,
	"question_type" text NOT NULL,
	"options" jsonb,
	"config" jsonb,
	"answer_regex" text,
	"is_required" boolean DEFAULT true NOT NULL,
	"edit_deadline_at" timestamp with time zone,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "survey_responses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"survey_id" uuid NOT NULL,
	"user_id" uuid,
	"single_response_user_id" uuid,
	"status" text DEFAULT 'submitted' NOT NULL,
	"submitted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "survey_sections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"survey_id" uuid NOT NULL,
	"title_ko" text NOT NULL,
	"title_en" text,
	"description_ko" text,
	"description_en" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "survey" (
	"survey_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"creator_id" uuid,
	"kind" varchar(20) NOT NULL,
	"title_ko" varchar(255) NOT NULL,
	"title_en" varchar(255),
	"description_ko" text,
	"description_en" text,
	"description_image_url_ko" text,
	"description_image_url_en" text,
	"connected_article_id" integer,
	"fee_requirement_policy" varchar(20) DEFAULT 'NONE' NOT NULL,
	"eligible_soc_affiliations" jsonb DEFAULT '["PRIMARY","DOUBLE","MINOR"]'::jsonb NOT NULL,
	"academic_eligibility" varchar(30) DEFAULT 'ENROLLED_OR_LEAVE' NOT NULL,
	"allow_anonymous" boolean DEFAULT false NOT NULL,
	"allow_multiple_responses" boolean DEFAULT false NOT NULL,
	"allow_response_edit" boolean DEFAULT false NOT NULL,
	"is_korean_only" boolean DEFAULT false NOT NULL,
	"is_published" boolean DEFAULT false NOT NULL,
	"lifecycle_status" varchar(20) DEFAULT 'DRAFT' NOT NULL,
	"previous_version_id" uuid,
	"version_number" integer DEFAULT 1 NOT NULL,
	"show_on_calendar" boolean DEFAULT false NOT NULL,
	"result_visibility" varchar(20) DEFAULT 'PRIVATE' NOT NULL,
	"max_response_count" integer,
	"is_always_open" boolean DEFAULT false NOT NULL,
	"open_at" timestamp with time zone,
	"close_at" timestamp with time zone,
	"spreadsheet_id" varchar(255),
	"spreadsheet_url" text,
	"spreadsheet_sync_status" varchar(20) DEFAULT 'NOT_CONNECTED' NOT NULL,
	"spreadsheet_last_synced_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "survey_lifecycle_status_check" CHECK ("survey"."lifecycle_status" in ('DRAFT', 'PUBLISHED')),
	CONSTRAINT "survey_lifecycle_published_check" CHECK (("survey"."lifecycle_status" = 'PUBLISHED') = "survey"."is_published"),
	CONSTRAINT "survey_version_number_check" CHECK ("survey"."version_number" >= 1),
	CONSTRAINT "survey_kind_check" CHECK ("survey"."kind" in ('SURVEY', 'APPLICATION')),
	CONSTRAINT "survey_academic_eligibility_check" CHECK ("survey"."academic_eligibility" in ('ANY', 'ENROLLED_ONLY', 'ENROLLED_OR_LEAVE')),
	CONSTRAINT "survey_spreadsheet_sync_status_check" CHECK ("survey"."spreadsheet_sync_status" in ('NOT_CONNECTED', 'CONNECTED', 'ERROR')),
	CONSTRAINT "survey_previous_version_check" CHECK ("survey"."previous_version_id" is null or "survey"."previous_version_id" <> "survey"."survey_id")
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"audit_log_id" serial PRIMARY KEY NOT NULL,
	"actor_user_id" uuid,
	"action" varchar(50) NOT NULL,
	"target_type" varchar(50) NOT NULL,
	"target_id" varchar(50),
	"payload" text,
	"ip_address" varchar(45),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "executive_contact" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name_ko" varchar(100) NOT NULL,
	"name_en" varchar(100) NOT NULL,
	"department_ko" varchar(100),
	"department_en" varchar(100),
	"role_ko" varchar(100) NOT NULL,
	"role_en" varchar(100) NOT NULL,
	"avatar_storage_key" varchar(255),
	"gender" varchar(20),
	"cohort" integer,
	"email" varchar(255),
	"phone_number" varchar(50),
	"privacy_consented" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bulk_email_template" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(100) NOT NULL,
	"description" varchar(255) DEFAULT '' NOT NULL,
	"subject" varchar(255) NOT NULL,
	"content" text NOT NULL,
	"content_type" varchar(10) DEFAULT 'html' NOT NULL,
	"recipient_type" varchar(30) DEFAULT 'ALL' NOT NULL,
	"recipient_filters" jsonb,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bulk_email" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"subject" varchar(255) NOT NULL,
	"content" text NOT NULL,
	"content_type" varchar(10) DEFAULT 'html' NOT NULL,
	"recipient_type" varchar(30) DEFAULT 'ALL' NOT NULL,
	"recipient_filters" jsonb,
	"attachment_asset_ids" jsonb,
	"sender_id" uuid,
	"recipient_count" integer NOT NULL,
	"status" varchar(20) NOT NULL,
	"scheduled_at" timestamp with time zone,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"error_message" text,
	"idempotency_key" varchar(128)
);
--> statement-breakpoint
CREATE TABLE "content_block" (
	"content_block_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" "content_block_type" NOT NULL,
	"status" "content_block_status" DEFAULT 'DRAFT' NOT NULL,
	"title_ko" varchar(255) NOT NULL,
	"title_en" varchar(255) DEFAULT '' NOT NULL,
	"body_ko" text,
	"body_en" text,
	"link_url" varchar(2000),
	"image_url" varchar(2000),
	"image_url_en" varchar(2000),
	"pledge_status" varchar(20),
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"published_by" uuid,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "site_content" (
	"key" "site_content_key" PRIMARY KEY NOT NULL,
	"value_ko" text NOT NULL,
	"value_en" text NOT NULL,
	"updated_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "calendar_event" (
	"calendar_event_id" serial PRIMARY KEY NOT NULL,
	"title_ko" varchar(255) NOT NULL,
	"title_en" varchar(255),
	"description_ko" text,
	"description_en" text,
	"start_at" timestamp with time zone NOT NULL,
	"end_at" timestamp with time zone NOT NULL,
	"location" varchar(255),
	"source_uid" varchar(255),
	"source_type" varchar(32) DEFAULT 'MANUAL' NOT NULL,
	"source_year" integer,
	"source_hash" varchar(64),
	"is_read_only" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"is_hidden_by_admin" boolean DEFAULT false NOT NULL,
	"category_override" varchar(20),
	"override_updated_by_user_id" uuid,
	"override_updated_at" timestamp with time zone,
	"created_by_user_id" uuid,
	"google_calendar_id" varchar(255),
	"google_event_id" varchar(255),
	"google_etag" varchar(255),
	"google_sync_status" varchar(20) DEFAULT 'NOT_CONFIGURED' NOT NULL,
	"google_synced_at" timestamp with time zone,
	"google_sync_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "calendar_sync_job" (
	"calendar_sync_job_id" serial PRIMARY KEY NOT NULL,
	"calendar_event_id" integer NOT NULL,
	"target_calendar_id" varchar(255) NOT NULL,
	"operation" varchar(16) NOT NULL,
	"status" varchar(16) DEFAULT 'PENDING' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"available_at" timestamp with time zone DEFAULT now() NOT NULL,
	"locked_at" timestamp with time zone,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notification" (
	"notification_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"actor_user_id" uuid,
	"type" varchar(40) NOT NULL,
	"title_ko" varchar(255) NOT NULL,
	"body_ko" text,
	"link" varchar(500),
	"is_read" boolean DEFAULT false NOT NULL,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "role_group_permission" ADD CONSTRAINT "role_group_permission_role_group_id_role_group_role_group_id_fk" FOREIGN KEY ("role_group_id") REFERENCES "public"."role_group"("role_group_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_group_permission" ADD CONSTRAINT "role_group_permission_permission_id_permission_permission_id_fk" FOREIGN KEY ("permission_id") REFERENCES "public"."permission"("permission_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_role_group" ADD CONSTRAINT "user_role_group_user_id_users_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_role_group" ADD CONSTRAINT "user_role_group_role_group_id_role_group_role_group_id_fk" FOREIGN KEY ("role_group_id") REFERENCES "public"."role_group"("role_group_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_role_group" ADD CONSTRAINT "user_role_group_granted_by_users_user_id_fk" FOREIGN KEY ("granted_by") REFERENCES "public"."users"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_sanction" ADD CONSTRAINT "user_sanction_user_id_users_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_sanction" ADD CONSTRAINT "user_sanction_issued_by_users_user_id_fk" FOREIGN KEY ("issued_by") REFERENCES "public"."users"("user_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_sanction" ADD CONSTRAINT "user_sanction_revoked_by_users_user_id_fk" FOREIGN KEY ("revoked_by") REFERENCES "public"."users"("user_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_fee_payment" ADD CONSTRAINT "student_fee_payment_user_id_users_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_fee_payment" ADD CONSTRAINT "student_fee_payment_recorded_by_users_user_id_fk" FOREIGN KEY ("recorded_by") REFERENCES "public"."users"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_fee_status" ADD CONSTRAINT "student_fee_status_user_id_users_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_fee_status" ADD CONSTRAINT "student_fee_status_verified_by_users_user_id_fk" FOREIGN KEY ("verified_by") REFERENCES "public"."users"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "article_asset" ADD CONSTRAINT "article_asset_article_id_article_article_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."article"("article_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "article_asset" ADD CONSTRAINT "article_asset_asset_id_asset_asset_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."asset"("asset_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "article_draft" ADD CONSTRAINT "article_draft_owner_user_id_users_user_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "article_draft" ADD CONSTRAINT "article_draft_board_id_board_board_id_fk" FOREIGN KEY ("board_id") REFERENCES "public"."board"("board_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "article_draft" ADD CONSTRAINT "article_draft_target_article_id_article_article_id_fk" FOREIGN KEY ("target_article_id") REFERENCES "public"."article"("article_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "article_engagement" ADD CONSTRAINT "article_engagement_article_id_article_article_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."article"("article_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "article_engagement" ADD CONSTRAINT "article_engagement_user_id_users_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "article_view" ADD CONSTRAINT "article_view_article_id_article_article_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."article"("article_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "article_view" ADD CONSTRAINT "article_view_user_id_users_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "article" ADD CONSTRAINT "article_board_id_board_board_id_fk" FOREIGN KEY ("board_id") REFERENCES "public"."board"("board_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "article" ADD CONSTRAINT "article_author_user_id_users_user_id_fk" FOREIGN KEY ("author_user_id") REFERENCES "public"."users"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "article" ADD CONSTRAINT "article_hidden_by_user_id_users_user_id_fk" FOREIGN KEY ("hidden_by_user_id") REFERENCES "public"."users"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asset" ADD CONSTRAINT "asset_uploaded_by_users_user_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "board" ADD CONSTRAINT "board_write_permission_id_permission_permission_id_fk" FOREIGN KEY ("write_permission_id") REFERENCES "public"."permission"("permission_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comment_engagement" ADD CONSTRAINT "comment_engagement_comment_id_comment_comment_id_fk" FOREIGN KEY ("comment_id") REFERENCES "public"."comment"("comment_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comment_engagement" ADD CONSTRAINT "comment_engagement_user_id_users_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comment" ADD CONSTRAINT "comment_article_id_article_article_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."article"("article_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comment" ADD CONSTRAINT "comment_author_user_id_users_user_id_fk" FOREIGN KEY ("author_user_id") REFERENCES "public"."users"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comment" ADD CONSTRAINT "comment_hidden_by_user_id_users_user_id_fk" FOREIGN KEY ("hidden_by_user_id") REFERENCES "public"."users"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comment" ADD CONSTRAINT "comment_parent_comment_id_comment_comment_id_fk" FOREIGN KEY ("parent_comment_id") REFERENCES "public"."comment"("comment_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "survey_answers" ADD CONSTRAINT "survey_answers_response_id_survey_responses_id_fk" FOREIGN KEY ("response_id") REFERENCES "public"."survey_responses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "survey_answers" ADD CONSTRAINT "survey_answers_question_id_survey_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."survey_questions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "survey_questions" ADD CONSTRAINT "survey_questions_section_id_survey_sections_id_fk" FOREIGN KEY ("section_id") REFERENCES "public"."survey_sections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "survey_responses" ADD CONSTRAINT "survey_responses_survey_id_survey_survey_id_fk" FOREIGN KEY ("survey_id") REFERENCES "public"."survey"("survey_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "survey_responses" ADD CONSTRAINT "survey_responses_user_id_users_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "survey_responses" ADD CONSTRAINT "survey_responses_single_response_user_id_users_user_id_fk" FOREIGN KEY ("single_response_user_id") REFERENCES "public"."users"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "survey_sections" ADD CONSTRAINT "survey_sections_survey_id_survey_survey_id_fk" FOREIGN KEY ("survey_id") REFERENCES "public"."survey"("survey_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "survey" ADD CONSTRAINT "survey_creator_id_users_user_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."users"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "survey" ADD CONSTRAINT "survey_connected_article_id_article_article_id_fk" FOREIGN KEY ("connected_article_id") REFERENCES "public"."article"("article_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "survey" ADD CONSTRAINT "survey_previous_version_id_survey_survey_id_fk" FOREIGN KEY ("previous_version_id") REFERENCES "public"."survey"("survey_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_actor_user_id_users_user_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bulk_email_template" ADD CONSTRAINT "bulk_email_template_created_by_users_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("user_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bulk_email" ADD CONSTRAINT "bulk_email_sender_id_users_user_id_fk" FOREIGN KEY ("sender_id") REFERENCES "public"."users"("user_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_block" ADD CONSTRAINT "content_block_created_by_users_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("user_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_block" ADD CONSTRAINT "content_block_updated_by_users_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("user_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_block" ADD CONSTRAINT "content_block_published_by_users_user_id_fk" FOREIGN KEY ("published_by") REFERENCES "public"."users"("user_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "site_content" ADD CONSTRAINT "site_content_updated_by_users_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("user_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_event" ADD CONSTRAINT "calendar_event_override_updated_by_user_id_users_user_id_fk" FOREIGN KEY ("override_updated_by_user_id") REFERENCES "public"."users"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_event" ADD CONSTRAINT "calendar_event_created_by_user_id_users_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_sync_job" ADD CONSTRAINT "calendar_sync_job_calendar_event_id_calendar_event_calendar_event_id_fk" FOREIGN KEY ("calendar_event_id") REFERENCES "public"."calendar_event"("calendar_event_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification" ADD CONSTRAINT "notification_user_id_users_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification" ADD CONSTRAINT "notification_actor_user_id_users_user_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("user_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "user_role_group_user_active_idx" ON "user_role_group" USING btree ("user_id","is_active");--> statement-breakpoint
CREATE INDEX "user_role_group_role_active_idx" ON "user_role_group" USING btree ("role_group_id","is_active");--> statement-breakpoint
CREATE INDEX "user_sanction_active_idx" ON "user_sanction" USING btree ("user_id","type","revoked_at");--> statement-breakpoint
CREATE INDEX "users_active_name_idx" ON "users" USING btree ("is_active","name_ko");--> statement-breakpoint
CREATE INDEX "student_fee_payment_user_paid_idx" ON "student_fee_payment" USING btree ("user_id","paid_at");--> statement-breakpoint
CREATE INDEX "student_fee_payment_semester_idx" ON "student_fee_payment" USING btree ("effective_start_semester");--> statement-breakpoint
CREATE INDEX "student_fee_status_status_updated_idx" ON "student_fee_status" USING btree ("status","updated_at");--> statement-breakpoint
CREATE INDEX "article_asset_article_usage_sort_idx" ON "article_asset" USING btree ("article_id","usage_type","sort_order");--> statement-breakpoint
CREATE INDEX "article_asset_asset_idx" ON "article_asset" USING btree ("asset_id");--> statement-breakpoint
CREATE INDEX "article_draft_owner_updated_idx" ON "article_draft" USING btree ("owner_user_id","updated_at");--> statement-breakpoint
CREATE INDEX "article_draft_board_updated_idx" ON "article_draft" USING btree ("board_id","updated_at");--> statement-breakpoint
CREATE INDEX "article_engagement_user_kind_idx" ON "article_engagement" USING btree ("user_id","kind","updated_at");--> statement-breakpoint
CREATE INDEX "article_view_user_idx" ON "article_view" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "article_board_idx" ON "article" USING btree ("board_id");--> statement-breakpoint
CREATE INDEX "article_board_status_posted_idx" ON "article" USING btree ("board_id","status","posted_at");--> statement-breakpoint
CREATE INDEX "article_status_posted_idx" ON "article" USING btree ("status","posted_at");--> statement-breakpoint
CREATE INDEX "article_author_status_posted_idx" ON "article" USING btree ("author_user_id","status","posted_at");--> statement-breakpoint
CREATE INDEX "article_home_presentation_idx" ON "article" USING btree ("home_visible","home_order","event_start_date");--> statement-breakpoint
CREATE INDEX "asset_created_idx" ON "asset" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "asset_uploaded_by_idx" ON "asset" USING btree ("uploaded_by");--> statement-breakpoint
CREATE INDEX "comment_engagement_user_kind_idx" ON "comment_engagement" USING btree ("user_id","kind","updated_at");--> statement-breakpoint
CREATE INDEX "comment_article_status_created_idx" ON "comment" USING btree ("article_id","status","created_at");--> statement-breakpoint
CREATE INDEX "comment_author_status_created_idx" ON "comment" USING btree ("author_user_id","status","created_at");--> statement-breakpoint
CREATE INDEX "survey_answers_response_idx" ON "survey_answers" USING btree ("response_id");--> statement-breakpoint
CREATE INDEX "survey_answers_question_idx" ON "survey_answers" USING btree ("question_id");--> statement-breakpoint
CREATE INDEX "survey_questions_section_sort_idx" ON "survey_questions" USING btree ("section_id","sort_order");--> statement-breakpoint
CREATE INDEX "survey_responses_survey_status_submitted_idx" ON "survey_responses" USING btree ("survey_id","status","submitted_at");--> statement-breakpoint
CREATE INDEX "survey_responses_survey_user_idx" ON "survey_responses" USING btree ("survey_id","user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "survey_responses_single_response_user_unique_idx" ON "survey_responses" USING btree ("survey_id","single_response_user_id");--> statement-breakpoint
CREATE INDEX "survey_responses_user_created_idx" ON "survey_responses" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "survey_sections_survey_sort_idx" ON "survey_sections" USING btree ("survey_id","sort_order");--> statement-breakpoint
CREATE INDEX "survey_connected_article_published_idx" ON "survey" USING btree ("connected_article_id","is_published");--> statement-breakpoint
CREATE UNIQUE INDEX "survey_connected_article_unique_idx" ON "survey" USING btree ("connected_article_id");--> statement-breakpoint
CREATE INDEX "survey_published_created_idx" ON "survey" USING btree ("is_published","created_at");--> statement-breakpoint
CREATE INDEX "survey_lifecycle_created_idx" ON "survey" USING btree ("lifecycle_status","created_at");--> statement-breakpoint
CREATE INDEX "survey_previous_version_idx" ON "survey" USING btree ("previous_version_id");--> statement-breakpoint
CREATE INDEX "survey_creator_idx" ON "survey" USING btree ("creator_id");--> statement-breakpoint
CREATE INDEX "audit_log_actor_created_idx" ON "audit_log" USING btree ("actor_user_id","created_at");--> statement-breakpoint
CREATE INDEX "audit_log_target_created_idx" ON "audit_log" USING btree ("target_type","target_id","created_at");--> statement-breakpoint
CREATE INDEX "executive_contact_sort_idx" ON "executive_contact" USING btree ("sort_order");--> statement-breakpoint
CREATE INDEX "bulk_email_template_updated_idx" ON "bulk_email_template" USING btree ("updated_at");--> statement-breakpoint
CREATE INDEX "bulk_email_template_creator_idx" ON "bulk_email_template" USING btree ("created_by");--> statement-breakpoint
CREATE INDEX "bulk_email_sent_idx" ON "bulk_email" USING btree ("sent_at");--> statement-breakpoint
CREATE INDEX "bulk_email_sender_sent_idx" ON "bulk_email" USING btree ("sender_id","sent_at");--> statement-breakpoint
CREATE INDEX "bulk_email_scheduled_idx" ON "bulk_email" USING btree ("status","scheduled_at");--> statement-breakpoint
CREATE UNIQUE INDEX "bulk_email_idempotency_unique" ON "bulk_email" USING btree ("sender_id","idempotency_key");--> statement-breakpoint
CREATE INDEX "content_block_status_order_idx" ON "content_block" USING btree ("status","sort_order");--> statement-breakpoint
CREATE INDEX "content_block_type_order_idx" ON "content_block" USING btree ("type","sort_order");--> statement-breakpoint
CREATE INDEX "calendar_event_range_idx" ON "calendar_event" USING btree ("start_at","end_at");--> statement-breakpoint
CREATE INDEX "calendar_event_source_uid_idx" ON "calendar_event" USING btree ("source_uid");--> statement-breakpoint
CREATE INDEX "calendar_event_source_year_idx" ON "calendar_event" USING btree ("source_type","source_year");--> statement-breakpoint
CREATE UNIQUE INDEX "calendar_event_source_identity_idx" ON "calendar_event" USING btree ("source_type","source_uid");--> statement-breakpoint
CREATE UNIQUE INDEX "calendar_event_google_identity_idx" ON "calendar_event" USING btree ("google_calendar_id","google_event_id");--> statement-breakpoint
CREATE INDEX "calendar_sync_job_due_idx" ON "calendar_sync_job" USING btree ("status","available_at");--> statement-breakpoint
CREATE UNIQUE INDEX "calendar_sync_job_target_event_idx" ON "calendar_sync_job" USING btree ("calendar_event_id","target_calendar_id");--> statement-breakpoint
CREATE INDEX "notification_user_created_idx" ON "notification" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "notification_user_unread_idx" ON "notification" USING btree ("user_id","is_read","created_at");
--> statement-breakpoint
ALTER TABLE "survey" ALTER COLUMN "eligible_soc_affiliations" SET DEFAULT '[]'::jsonb;--> statement-breakpoint
ALTER TABLE "survey" ALTER COLUMN "academic_eligibility" SET DEFAULT 'ANY';
--> statement-breakpoint
CREATE TABLE "vote_ballot" (
	"ballot_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vote_id" uuid NOT NULL,
	"ciphertext" text NOT NULL,
	"iv" varchar(32) NOT NULL,
	"auth_tag" varchar(32) NOT NULL,
	"receipt_hash" varchar(64) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vote_item" (
	"item_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vote_id" uuid NOT NULL,
	"title_ko" text NOT NULL,
	"title_en" text,
	"description_ko" text,
	"description_en" text,
	"type" varchar(30) NOT NULL,
	"max_selections" integer DEFAULT 1 NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "vote_item_type_check" CHECK ("vote_item"."type" in ('YES_NO_ABSTAIN', 'SINGLE_CHOICE', 'MULTIPLE_CHOICE')),
	CONSTRAINT "vote_item_max_selection_check" CHECK ("vote_item"."max_selections" >= 1)
);
--> statement-breakpoint
CREATE TABLE "vote_option" (
	"option_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"item_id" uuid NOT NULL,
	"label_ko" varchar(255) NOT NULL,
	"label_en" varchar(255),
	"description_ko" text,
	"description_en" text,
	"image_url" text,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vote_tally" (
	"vote_id" uuid PRIMARY KEY NOT NULL,
	"result" jsonb NOT NULL,
	"total_ballots" integer NOT NULL,
	"tallied_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vote_voter" (
	"vote_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"name_ko" varchar(100) NOT NULL,
	"student_number" varchar(20),
	"email" varchar(255) NOT NULL,
	"primary_major" varchar(100),
	"academic_status" varchar(30),
	"fee_status" varchar(20),
	"status" varchar(20) DEFAULT 'ELIGIBLE' NOT NULL,
	"source" varchar(20) DEFAULT 'FILTER' NOT NULL,
	"has_voted" boolean DEFAULT false NOT NULL,
	"voted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "vote_voter_vote_id_user_id_pk" PRIMARY KEY("vote_id","user_id"),
	CONSTRAINT "vote_voter_status_check" CHECK ("vote_voter"."status" in ('ELIGIBLE', 'EXCLUDED')),
	CONSTRAINT "vote_voter_source_check" CHECK ("vote_voter"."source" in ('FILTER', 'MANUAL', 'IMPORT'))
);
--> statement-breakpoint
CREATE TABLE "vote" (
	"vote_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"creator_id" uuid,
	"title_ko" varchar(255) NOT NULL,
	"title_en" varchar(255),
	"description_ko" text,
	"description_en" text,
	"status" varchar(20) DEFAULT 'DRAFT' NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"academic_statuses" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"fee_payers_only" boolean DEFAULT false NOT NULL,
	"student_number_from" varchar(20),
	"student_number_to" varchar(20),
	"encrypted_ballot_key" text,
	"key_iv" varchar(32),
	"key_tag" varchar(32),
	"voter_snapshot_at" timestamp with time zone,
	"results_published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "vote_status_check" CHECK ("vote"."status" in ('DRAFT', 'PUBLISHED', 'CLOSED', 'TALLIED')),
	CONSTRAINT "vote_schedule_check" CHECK ("vote"."ends_at" > "vote"."starts_at")
);
--> statement-breakpoint
ALTER TABLE "vote_ballot" ADD CONSTRAINT "vote_ballot_vote_id_vote_vote_id_fk" FOREIGN KEY ("vote_id") REFERENCES "public"."vote"("vote_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vote_item" ADD CONSTRAINT "vote_item_vote_id_vote_vote_id_fk" FOREIGN KEY ("vote_id") REFERENCES "public"."vote"("vote_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vote_option" ADD CONSTRAINT "vote_option_item_id_vote_item_item_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."vote_item"("item_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vote_tally" ADD CONSTRAINT "vote_tally_vote_id_vote_vote_id_fk" FOREIGN KEY ("vote_id") REFERENCES "public"."vote"("vote_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vote_voter" ADD CONSTRAINT "vote_voter_vote_id_vote_vote_id_fk" FOREIGN KEY ("vote_id") REFERENCES "public"."vote"("vote_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vote_voter" ADD CONSTRAINT "vote_voter_user_id_users_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("user_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vote" ADD CONSTRAINT "vote_creator_id_users_user_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."users"("user_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "vote_ballot_vote_idx" ON "vote_ballot" USING btree ("vote_id");--> statement-breakpoint
CREATE UNIQUE INDEX "vote_ballot_receipt_unique_idx" ON "vote_ballot" USING btree ("receipt_hash");--> statement-breakpoint
CREATE INDEX "vote_item_vote_sort_idx" ON "vote_item" USING btree ("vote_id","sort_order");--> statement-breakpoint
CREATE INDEX "vote_option_item_sort_idx" ON "vote_option" USING btree ("item_id","sort_order");--> statement-breakpoint
CREATE INDEX "vote_voter_vote_status_idx" ON "vote_voter" USING btree ("vote_id","status","has_voted");--> statement-breakpoint
CREATE INDEX "vote_status_schedule_idx" ON "vote" USING btree ("status","starts_at","ends_at");
--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "double_major";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "minor";
--> statement-breakpoint
CREATE TABLE "executive_contact_department" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name_ko" varchar(100) NOT NULL,
	"name_en" varchar(100) DEFAULT '' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "executive_contact" ADD COLUMN "student_number" varchar(30);--> statement-breakpoint
CREATE UNIQUE INDEX "executive_contact_department_name_ko_uq" ON "executive_contact_department" USING btree ("name_ko");--> statement-breakpoint
CREATE INDEX "executive_contact_department_sort_idx" ON "executive_contact_department" USING btree ("sort_order");
--> statement-breakpoint
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

--> statement-breakpoint
CREATE TABLE "roadmap_offering" (
	"offering_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"term" varchar(32) NOT NULL,
	"course_code" varchar(64) NOT NULL,
	"current_code" varchar(64) NOT NULL,
	"name_ko" text NOT NULL,
	"section" varchar(30),
	"instructor" text,
	"credits" varchar(40),
	"time" text,
	"room" text,
	"capacity" integer,
	"enrolled" integer,
	"delivery" varchar(80),
	"in_english" boolean DEFAULT false NOT NULL,
	"source_data" jsonb NOT NULL,
	"source_file_name" varchar(255),
	"imported_by" uuid,
	"imported_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "roadmap_offering" ADD CONSTRAINT "roadmap_offering_imported_by_users_user_id_fk" FOREIGN KEY ("imported_by") REFERENCES "public"."users"("user_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "roadmap_offering_term_idx" ON "roadmap_offering" USING btree ("term");--> statement-breakpoint
CREATE INDEX "roadmap_offering_course_idx" ON "roadmap_offering" USING btree ("course_code");--> statement-breakpoint
CREATE INDEX "roadmap_offering_import_idx" ON "roadmap_offering" USING btree ("imported_at");
--> statement-breakpoint
ALTER TABLE "executive_contact_department" ADD COLUMN "description_ko" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "executive_contact_department" ADD COLUMN "description_en" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "executive_contact_department" ADD COLUMN "inquiry_email" varchar(255) DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE "article" ADD COLUMN "event_location" varchar(255);
--> statement-breakpoint
CREATE TABLE "roadmap_course_relation" (
	"relation_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"prerequisite_course_id" uuid NOT NULL,
	"postrequisite_course_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "roadmap_course" (
	"course_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"course_code" varchar(64) NOT NULL,
	"legacy_course_code" varchar(64),
	"name_ko" text NOT NULL,
	"name_en" text DEFAULT '' NOT NULL,
	"category" varchar(32) DEFAULT 'major-elective' NOT NULL,
	"credits" varchar(40) DEFAULT '' NOT NULL,
	"semesters" varchar(20) DEFAULT 'S/F' NOT NULL,
	"track_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"ai" boolean DEFAULT false NOT NULL,
	"position_x" integer DEFAULT 0 NOT NULL,
	"position_y" integer DEFAULT 0 NOT NULL,
	"is_visible" boolean DEFAULT true NOT NULL,
	"source" varchar(20) DEFAULT 'MANUAL' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "roadmap_term" (
	"term_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"term" varchar(32) NOT NULL,
	"source_file_name" varchar(255),
	"imported_by" uuid,
	"imported_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "roadmap_course_relation" ADD CONSTRAINT "roadmap_course_relation_prerequisite_course_id_roadmap_course_course_id_fk" FOREIGN KEY ("prerequisite_course_id") REFERENCES "public"."roadmap_course"("course_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roadmap_course_relation" ADD CONSTRAINT "roadmap_course_relation_postrequisite_course_id_roadmap_course_course_id_fk" FOREIGN KEY ("postrequisite_course_id") REFERENCES "public"."roadmap_course"("course_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roadmap_term" ADD CONSTRAINT "roadmap_term_imported_by_users_user_id_fk" FOREIGN KEY ("imported_by") REFERENCES "public"."users"("user_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "roadmap_course_relation_pair_uq" ON "roadmap_course_relation" USING btree ("prerequisite_course_id","postrequisite_course_id");--> statement-breakpoint
CREATE INDEX "roadmap_course_relation_target_idx" ON "roadmap_course_relation" USING btree ("postrequisite_course_id");--> statement-breakpoint
CREATE UNIQUE INDEX "roadmap_course_code_uq" ON "roadmap_course" USING btree ("course_code");--> statement-breakpoint
CREATE INDEX "roadmap_course_legacy_code_idx" ON "roadmap_course" USING btree ("legacy_course_code");--> statement-breakpoint
CREATE INDEX "roadmap_course_visible_idx" ON "roadmap_course" USING btree ("is_visible");--> statement-breakpoint
CREATE UNIQUE INDEX "roadmap_term_term_uq" ON "roadmap_term" USING btree ("term");--> statement-breakpoint
CREATE INDEX "roadmap_term_imported_idx" ON "roadmap_term" USING btree ("imported_at");
--> statement-breakpoint
CREATE TABLE "google_spreadsheet_sync_job" (
	"google_spreadsheet_sync_job_id" serial PRIMARY KEY NOT NULL,
	"resource_type" varchar(32) NOT NULL,
	"resource_key" varchar(255) NOT NULL,
	"status" varchar(16) DEFAULT 'PENDING' NOT NULL,
	"revision" integer DEFAULT 1 NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"available_at" timestamp with time zone DEFAULT now() NOT NULL,
	"locked_at" timestamp with time zone,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "google_spreadsheet_sync_job_status_check" CHECK ("google_spreadsheet_sync_job"."status" in ('PENDING', 'PROCESSING', 'SUCCEEDED', 'FAILED')),
	CONSTRAINT "google_spreadsheet_sync_job_revision_check" CHECK ("google_spreadsheet_sync_job"."revision" >= 1),
	CONSTRAINT "google_spreadsheet_sync_job_attempts_check" CHECK ("google_spreadsheet_sync_job"."attempts" >= 0)
);
--> statement-breakpoint
CREATE INDEX "google_spreadsheet_sync_job_due_idx" ON "google_spreadsheet_sync_job" USING btree ("status","available_at");--> statement-breakpoint
CREATE UNIQUE INDEX "google_spreadsheet_sync_job_resource_idx" ON "google_spreadsheet_sync_job" USING btree ("resource_type","resource_key");
--> statement-breakpoint
ALTER TABLE "calendar_event" ADD COLUMN "is_all_day" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "calendar_event" ADD COLUMN "is_always" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE "board" ADD COLUMN "write_access_scope" varchar(30) DEFAULT 'ANYONE' NOT NULL;
--> statement-breakpoint
UPDATE "board"
SET "write_access_scope" = CASE
  WHEN "write_permission_id" IS NULL THEN 'AUTHENTICATED'
  ELSE 'PERMISSION'
END;

--> statement-breakpoint
ALTER TABLE "roadmap_course" DROP COLUMN "position_x";--> statement-breakpoint
ALTER TABLE "roadmap_course" DROP COLUMN "position_y";--> statement-breakpoint

UPDATE "board"
SET "code" = CASE "code"
  WHEN '공지' THEN 'notice'
  WHEN 'HoC' THEN 'hoc'
  WHEN '홍보글' THEN 'promotions'
  WHEN '건의사항' THEN 'suggestions'
  WHEN '연구실' THEN 'labs'
  WHEN 'FAQ' THEN 'faq'
  ELSE "code"
END
WHERE "code" IN ('공지', 'HoC', '홍보글', '건의사항', '연구실', 'FAQ');--> statement-breakpoint

UPDATE "roadmap_course" AS course
SET "legacy_course_code" = aliases."legacy_course_code"
FROM (VALUES
  ('CS10001', 'CS101'),
  ('CS10009', 'CS109'),
  ('CS10003', 'CS103'),
  ('CS20002', 'CS202'),
  ('CS20004', 'CS204'),
  ('CS20006', 'CS206'),
  ('CS20101', 'CS211'),
  ('CS20200', 'CS220'),
  ('CS20300', 'CS230'),
  ('CS20700', 'CS270'),
  ('CS30000', 'CS300'),
  ('CS30100', 'CS310'),
  ('CS30101', 'CS311'),
  ('CS30200', 'CS320'),
  ('CS30202', 'CS322'),
  ('CS30300', 'CS330'),
  ('CS30401', 'CS341'),
  ('CS30408', 'CS348'),
  ('CS30500', 'CS350'),
  ('CS30600', 'CS360'),
  ('CS30601', 'CS361'),
  ('CS30700', 'CS370'),
  ('CS30701', 'CS371'),
  ('CS30702', 'CS372'),
  ('CS30703', 'CS470'),
  ('CS30704', 'CS374'),
  ('CS30705', 'CS40804'),
  ('CS30706', 'CS376'),
  ('CS30707', 'CS377'),
  ('CS30800', 'CS380'),
  ('CS40002', 'CS402'),
  ('CS40008', 'CS408'),
  ('CS40101', 'CS411'),
  ('CS40200', 'CS420'),
  ('CS40202', 'CS422'),
  ('CS40203', 'CS423'),
  ('CS40204', 'CS424'),
  ('CS40301', 'CS431'),
  ('CS40402', 'CS442'),
  ('CS40403', 'CS443'),
  ('CS40407', 'CS447'),
  ('CS40503', 'CS453'),
  ('CS40504', 'CS454'),
  ('CS40507', 'CS457'),
  ('CS40508', 'CS458'),
  ('CS40509', 'CS459'),
  ('CS40701', 'CS471'),
  ('CS40703', 'CS473'),
  ('CS40704', 'CS474'),
  ('CS40705', 'CS475'),
  ('CS40707', 'CS477'),
  ('CS40709', 'CS479'),
  ('CS40801', 'CS481'),
  ('CS40802', 'CS482'),
  ('CS40805', 'CS485'),
  ('CS40806', 'CS486'),
  ('CS40809', 'CS489'),
  ('CS49900', 'CS492'),
  ('CS49902', 'CS494'),
  ('CS93000', 'CS496')
) AS aliases("course_code", "legacy_course_code")
WHERE course."course_code" = aliases."course_code"
  AND course."legacy_course_code" IS NULL;

--> statement-breakpoint
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

--> statement-breakpoint
ALTER TYPE "public"."site_content_key" ADD VALUE IF NOT EXISTS 'about.hero.title';--> statement-breakpoint
ALTER TYPE "public"."site_content_key" ADD VALUE IF NOT EXISTS 'about.hero.cta.events';--> statement-breakpoint
ALTER TYPE "public"."site_content_key" ADD VALUE IF NOT EXISTS 'about.hero.cta.suggestions';--> statement-breakpoint
ALTER TYPE "public"."site_content_key" ADD VALUE IF NOT EXISTS 'about.nav.intro';--> statement-breakpoint
ALTER TYPE "public"."site_content_key" ADD VALUE IF NOT EXISTS 'about.nav.work';--> statement-breakpoint
ALTER TYPE "public"."site_content_key" ADD VALUE IF NOT EXISTS 'about.nav.organization';--> statement-breakpoint
ALTER TYPE "public"."site_content_key" ADD VALUE IF NOT EXISTS 'about.nav.partnership';--> statement-breakpoint
ALTER TYPE "public"."site_content_key" ADD VALUE IF NOT EXISTS 'about.intro.eyebrow';--> statement-breakpoint
ALTER TYPE "public"."site_content_key" ADD VALUE IF NOT EXISTS 'about.work.title';--> statement-breakpoint
ALTER TYPE "public"."site_content_key" ADD VALUE IF NOT EXISTS 'about.work.card.1.title';--> statement-breakpoint
ALTER TYPE "public"."site_content_key" ADD VALUE IF NOT EXISTS 'about.work.card.1.description';--> statement-breakpoint
ALTER TYPE "public"."site_content_key" ADD VALUE IF NOT EXISTS 'about.work.card.2.title';--> statement-breakpoint
ALTER TYPE "public"."site_content_key" ADD VALUE IF NOT EXISTS 'about.work.card.2.description';--> statement-breakpoint
ALTER TYPE "public"."site_content_key" ADD VALUE IF NOT EXISTS 'about.work.card.3.title';--> statement-breakpoint
ALTER TYPE "public"."site_content_key" ADD VALUE IF NOT EXISTS 'about.work.card.3.description';--> statement-breakpoint
ALTER TYPE "public"."site_content_key" ADD VALUE IF NOT EXISTS 'about.work.card.cta';--> statement-breakpoint
ALTER TYPE "public"."site_content_key" ADD VALUE IF NOT EXISTS 'about.pledges.title';--> statement-breakpoint
ALTER TYPE "public"."site_content_key" ADD VALUE IF NOT EXISTS 'about.organization.title';--> statement-breakpoint
ALTER TYPE "public"."site_content_key" ADD VALUE IF NOT EXISTS 'about.organization.description';--> statement-breakpoint
ALTER TYPE "public"."site_content_key" ADD VALUE IF NOT EXISTS 'about.organization.reference.eyebrow';--> statement-breakpoint
ALTER TYPE "public"."site_content_key" ADD VALUE IF NOT EXISTS 'about.organization.reference.title';--> statement-breakpoint
ALTER TYPE "public"."site_content_key" ADD VALUE IF NOT EXISTS 'about.partnership.title';--> statement-breakpoint
ALTER TYPE "public"."site_content_key" ADD VALUE IF NOT EXISTS 'about.partnership.description';--> statement-breakpoint
ALTER TYPE "public"."site_content_key" ADD VALUE IF NOT EXISTS 'about.partnership.cta';--> statement-breakpoint
ALTER TYPE "public"."site_content_key" ADD VALUE IF NOT EXISTS 'about.partnership.area.1';--> statement-breakpoint
ALTER TYPE "public"."site_content_key" ADD VALUE IF NOT EXISTS 'about.partnership.area.2';--> statement-breakpoint
ALTER TYPE "public"."site_content_key" ADD VALUE IF NOT EXISTS 'about.partnership.area.3';

--> statement-breakpoint
ALTER TABLE "survey_sections" ADD COLUMN "next_section_id" text;

--> statement-breakpoint
CREATE TABLE "student_fee_payment_batch" (
	"batch_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_user_id" uuid NOT NULL,
	"idempotency_key" varchar(128) NOT NULL,
	"payload_hash" varchar(64) NOT NULL,
	"result" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "student_fee_payment_batch" ADD CONSTRAINT "student_fee_payment_batch_actor_user_id_users_user_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "student_fee_payment_batch_actor_key_idx" ON "student_fee_payment_batch" USING btree ("actor_user_id","idempotency_key");
--> statement-breakpoint
CREATE TABLE "asset_cleanup_lease" (
	"lease_name" varchar(64) PRIMARY KEY NOT NULL,
	"owner_token" varchar(64) NOT NULL,
	"lease_until" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bulk_email_delivery_attempt" (
	"attempt_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email_id" uuid NOT NULL,
	"attempt_number" integer NOT NULL,
	"message_id" varchar(255) NOT NULL,
	"status" varchar(16) DEFAULT 'PENDING' NOT NULL,
	"accepted_count" integer DEFAULT 0 NOT NULL,
	"rejected_count" integer DEFAULT 0 NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"error_code" varchar(120)
);
--> statement-breakpoint
ALTER TABLE "calendar_sync_job" ADD COLUMN "revision" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "calendar_sync_job" ADD COLUMN "lease_until" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "calendar_sync_job" ADD COLUMN "claim_token" varchar(64);--> statement-breakpoint
ALTER TABLE "google_spreadsheet_sync_job" ADD COLUMN "lease_until" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "google_spreadsheet_sync_job" ADD COLUMN "claim_token" varchar(64);--> statement-breakpoint
ALTER TABLE "bulk_email_delivery_attempt" ADD CONSTRAINT "bulk_email_delivery_attempt_email_id_bulk_email_id_fk" FOREIGN KEY ("email_id") REFERENCES "public"."bulk_email"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "bulk_email_delivery_attempt_email_number_idx" ON "bulk_email_delivery_attempt" USING btree ("email_id","attempt_number");--> statement-breakpoint
CREATE INDEX "bulk_email_delivery_attempt_email_idx" ON "bulk_email_delivery_attempt" USING btree ("email_id","started_at");
--> statement-breakpoint
ALTER TABLE "asset" ADD COLUMN "upload_status" varchar(16) DEFAULT 'COMPLETED' NOT NULL;--> statement-breakpoint
ALTER TABLE "asset" ADD COLUMN "upload_expires_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "asset_upload_status_expiry_idx" ON "asset" USING btree ("upload_status","upload_expires_at");
--> statement-breakpoint
CREATE TABLE "asset_upload_reservation" (
	"reservation_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"uploaded_by" uuid NOT NULL,
	"size_bytes" integer NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "asset_upload_reservation" ADD CONSTRAINT "asset_upload_reservation_uploaded_by_users_user_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "asset_upload_reservation_owner_expiry_idx" ON "asset_upload_reservation" USING btree ("uploaded_by","expires_at");
--> statement-breakpoint
ALTER TABLE "executive_contact" ADD COLUMN "publicly_listed" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE "calendar_sync_job" ADD COLUMN "resource_updated_at" timestamp with time zone;
UPDATE "calendar_sync_job" AS job
SET "resource_updated_at" = event."updated_at"
FROM "calendar_event" AS event
WHERE event."calendar_event_id" = job."calendar_event_id";
ALTER TABLE "calendar_sync_job" ALTER COLUMN "resource_updated_at" SET NOT NULL;

--> statement-breakpoint
ALTER TABLE "vote" ADD COLUMN "quorum_percent" integer;--> statement-breakpoint
ALTER TABLE "vote" ADD COLUMN "quorum_inclusive" boolean DEFAULT true NOT NULL;
--> statement-breakpoint
UPDATE "board" SET "write_access_scope" = 'AUTHENTICATED', "write_permission_id" = NULL WHERE "code" = 'labs';

--> statement-breakpoint
ALTER TABLE "executive_contact" ADD COLUMN "portal_user_id" uuid;--> statement-breakpoint
ALTER TABLE "executive_contact" ADD COLUMN "activities" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "executive_contact" ADD CONSTRAINT "executive_contact_portal_user_id_users_user_id_fk" FOREIGN KEY ("portal_user_id") REFERENCES "public"."users"("user_id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
UPDATE "executive_contact" SET "activities" = jsonb_build_array(jsonb_build_object(
 'year', CASE WHEN "cohort" < 100 THEN 2000 + "cohort" ELSE "cohort" END,
 'departmentKo', coalesce("department_ko", ''), 'departmentEn', coalesce("department_en", ''),
 'roleKo', "role_ko", 'roleEn', "role_en"
)) WHERE "cohort" IS NOT NULL AND ("cohort" BETWEEN 1 AND 99 OR "cohort" BETWEEN 1900 AND 3000);

--> statement-breakpoint
CREATE TABLE "student_fee_policy" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"effective_semester" varchar(6) NOT NULL,
	"amount" integer NOT NULL,
	"coverage_semesters" smallint DEFAULT 6 NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "student_fee_policy" ADD CONSTRAINT "student_fee_policy_created_by_users_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("user_id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "executive_contact_portal_user_uq" ON "executive_contact" USING btree ("portal_user_id");
--> statement-breakpoint
UPDATE survey SET is_published = false, lifecycle_status = 'DRAFT', show_on_calendar = false WHERE survey_id = '7a110000-0000-4000-8000-000000000003';
--> statement-breakpoint
UPDATE article SET content_ko = '후원 및 제휴 제안은 학생회 소개 → 후원 및 제휴에서 채널톡으로 보내 주세요. 기관명, 회신 연락처와 제안 내용을 함께 알려 주세요.', content_en = 'Send sponsorship and partnership proposals through Channel Talk under About → Partnerships. Include your organization, contact details, and proposal.' WHERE board_id IN (SELECT board_id FROM board WHERE code = 'faq') AND title_ko = '기업 후원이나 제휴를 제안하려면 어떻게 하나요?';

--> statement-breakpoint
DELETE FROM user_role_group WHERE role_group_id IN (SELECT role_group_id FROM role_group WHERE name_ko = '개발 관리자');
--> statement-breakpoint
DELETE FROM role_group_permission WHERE role_group_id IN (SELECT role_group_id FROM role_group WHERE name_ko = '개발 관리자');
--> statement-breakpoint
DELETE FROM role_group WHERE name_ko = '개발 관리자';

--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN IF EXISTS "phone_number";
