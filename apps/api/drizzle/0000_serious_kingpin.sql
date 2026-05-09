CREATE TABLE "article_asset" (
	"article_asset_id" serial PRIMARY KEY NOT NULL,
	"article_id" integer NOT NULL,
	"asset_id" integer NOT NULL,
	"usage_type" varchar(20) NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "article" (
	"article_id" serial PRIMARY KEY NOT NULL,
	"board_id" integer NOT NULL,
	"author_user_id" integer NOT NULL,
	"title_ko" varchar(255) NOT NULL,
	"title_en" varchar(255),
	"content_ko" text NOT NULL,
	"content_en" text,
	"status" varchar(20) DEFAULT 'PUBLISHED' NOT NULL,
	"visibility_scope" varchar(20) DEFAULT 'PUBLIC' NOT NULL,
	"is_pinned" boolean DEFAULT false NOT NULL,
	"pin_order" integer,
	"posted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
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
	"uploaded_by" integer NOT NULL,
	CONSTRAINT "asset_storage_key_unique" UNIQUE("storage_key")
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"audit_log_id" serial PRIMARY KEY NOT NULL,
	"actor_user_id" integer,
	"action" varchar(50) NOT NULL,
	"target_type" varchar(50) NOT NULL,
	"target_id" varchar(50),
	"payload" text,
	"ip_address" varchar(45),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "board" (
	"board_id" serial PRIMARY KEY NOT NULL,
	"code" varchar(20) NOT NULL,
	"name_ko" varchar(20) NOT NULL,
	"name_en" varchar(100),
	"description" varchar(255),
	"read_scope" varchar(20) DEFAULT 'PUBLIC' NOT NULL,
	"write_permission_id" integer,
	"comment_permission_id" integer,
	"manage_permission_id" integer,
	"allow_comment" boolean DEFAULT false NOT NULL,
	"allow_secret" boolean DEFAULT false NOT NULL,
	"allow_like" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "board_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "comment" (
	"comment_id" serial PRIMARY KEY NOT NULL,
	"article_id" integer NOT NULL,
	"parent_comment_id" integer,
	"author_user_id" integer NOT NULL,
	"content" text NOT NULL,
	"status" varchar(20) DEFAULT 'PUBLISHED' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
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
	"code" varchar(50) NOT NULL,
	"name_ko" varchar(100) NOT NULL,
	"name_en" varchar(100),
	"description" text,
	"is_system" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "role_group_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "student_fee_status" (
	"user_id" integer PRIMARY KEY NOT NULL,
	"coverage_semesters" smallint DEFAULT 4 NOT NULL,
	"status" varchar(20) NOT NULL,
	"paid_at" timestamp with time zone,
	"verified_by" integer,
	"verified_at" timestamp with time zone,
	"note" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
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
	"answer_regex" text,
	"is_required" boolean DEFAULT true NOT NULL,
	"edit_deadline_at" timestamp with time zone,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "survey_responses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"survey_id" uuid NOT NULL,
	"user_id" integer,
	"external_phone" text,
	"status" text DEFAULT 'draft' NOT NULL,
	"submitted_at" timestamp with time zone,
	"reviewed_at" timestamp with time zone,
	"review_admin_id" integer,
	"review_reason" text,
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
	"creator_id" integer,
	"kind" varchar(20) NOT NULL,
	"title_ko" varchar(255) NOT NULL,
	"title_en" varchar(255),
	"description_ko" text,
	"description_en" text,
	"status" varchar(20) DEFAULT 'DRAFT' NOT NULL,
	"connected_article_id" integer,
	"fee_requirement_policy" varchar(20) DEFAULT 'NONE' NOT NULL,
	"allow_guest_response" boolean DEFAULT false NOT NULL,
	"result_visibility" varchar(20) NOT NULL,
	"max_response_count" integer,
	"open_at" timestamp with time zone,
	"close_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_role_group" (
	"user_role_group_id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"role_group_id" integer NOT NULL,
	"granted_by" integer,
	"granted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"valid_from" timestamp with time zone,
	"valid_to" timestamp with time zone,
	"is_active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"user_id" serial PRIMARY KEY NOT NULL,
	"sso_subject" varchar(100) NOT NULL,
	"kaist_uid" varchar(20) NOT NULL,
	"std_no" varchar(20),
	"name_ko" varchar(100) NOT NULL,
	"name_en" varchar(100),
	"email" varchar(255) NOT NULL,
	"dept_ko" varchar(100),
	"dept_en" varchar(100),
	"academic_status" varchar(20),
	"identity_code" varchar(10),
	"is_active" boolean DEFAULT true NOT NULL,
	"last_login_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_sso_subject_unique" UNIQUE("sso_subject"),
	CONSTRAINT "users_kaist_uid_unique" UNIQUE("kaist_uid"),
	CONSTRAINT "users_std_no_unique" UNIQUE("std_no"),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "article_asset" ADD CONSTRAINT "article_asset_article_id_article_article_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."article"("article_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "article_asset" ADD CONSTRAINT "article_asset_asset_id_asset_asset_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."asset"("asset_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "article" ADD CONSTRAINT "article_board_id_board_board_id_fk" FOREIGN KEY ("board_id") REFERENCES "public"."board"("board_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "article" ADD CONSTRAINT "article_author_user_id_users_user_id_fk" FOREIGN KEY ("author_user_id") REFERENCES "public"."users"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asset" ADD CONSTRAINT "asset_uploaded_by_users_user_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_actor_user_id_users_user_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "board" ADD CONSTRAINT "board_write_permission_id_permission_permission_id_fk" FOREIGN KEY ("write_permission_id") REFERENCES "public"."permission"("permission_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "board" ADD CONSTRAINT "board_comment_permission_id_permission_permission_id_fk" FOREIGN KEY ("comment_permission_id") REFERENCES "public"."permission"("permission_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "board" ADD CONSTRAINT "board_manage_permission_id_permission_permission_id_fk" FOREIGN KEY ("manage_permission_id") REFERENCES "public"."permission"("permission_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comment" ADD CONSTRAINT "comment_article_id_article_article_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."article"("article_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comment" ADD CONSTRAINT "comment_author_user_id_users_user_id_fk" FOREIGN KEY ("author_user_id") REFERENCES "public"."users"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comment" ADD CONSTRAINT "comment_parent_comment_id_comment_comment_id_fk" FOREIGN KEY ("parent_comment_id") REFERENCES "public"."comment"("comment_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_group_permission" ADD CONSTRAINT "role_group_permission_role_group_id_role_group_role_group_id_fk" FOREIGN KEY ("role_group_id") REFERENCES "public"."role_group"("role_group_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_group_permission" ADD CONSTRAINT "role_group_permission_permission_id_permission_permission_id_fk" FOREIGN KEY ("permission_id") REFERENCES "public"."permission"("permission_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_fee_status" ADD CONSTRAINT "student_fee_status_user_id_users_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_fee_status" ADD CONSTRAINT "student_fee_status_verified_by_users_user_id_fk" FOREIGN KEY ("verified_by") REFERENCES "public"."users"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "survey_answers" ADD CONSTRAINT "survey_answers_response_id_survey_responses_id_fk" FOREIGN KEY ("response_id") REFERENCES "public"."survey_responses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "survey_answers" ADD CONSTRAINT "survey_answers_question_id_survey_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."survey_questions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "survey_questions" ADD CONSTRAINT "survey_questions_section_id_survey_sections_id_fk" FOREIGN KEY ("section_id") REFERENCES "public"."survey_sections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "survey_responses" ADD CONSTRAINT "survey_responses_survey_id_survey_survey_id_fk" FOREIGN KEY ("survey_id") REFERENCES "public"."survey"("survey_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "survey_responses" ADD CONSTRAINT "survey_responses_user_id_users_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "survey_responses" ADD CONSTRAINT "survey_responses_review_admin_id_users_user_id_fk" FOREIGN KEY ("review_admin_id") REFERENCES "public"."users"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "survey_sections" ADD CONSTRAINT "survey_sections_survey_id_survey_survey_id_fk" FOREIGN KEY ("survey_id") REFERENCES "public"."survey"("survey_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "survey" ADD CONSTRAINT "survey_creator_id_users_user_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."users"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "survey" ADD CONSTRAINT "survey_connected_article_id_article_article_id_fk" FOREIGN KEY ("connected_article_id") REFERENCES "public"."article"("article_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_role_group" ADD CONSTRAINT "user_role_group_user_id_users_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_role_group" ADD CONSTRAINT "user_role_group_role_group_id_role_group_role_group_id_fk" FOREIGN KEY ("role_group_id") REFERENCES "public"."role_group"("role_group_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_role_group" ADD CONSTRAINT "user_role_group_granted_by_users_user_id_fk" FOREIGN KEY ("granted_by") REFERENCES "public"."users"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "article_board_idx" ON "article" USING btree ("board_id");