CREATE TABLE "audit_log" (
	"audit_log_id" serial PRIMARY KEY NOT NULL,
	"actor_user_id" bigint,
	"action" varchar(50) NOT NULL,
	"target_type" varchar(50) NOT NULL,
	"target_id" varchar(50),
	"payload" text,
	"ip_address" varchar(45),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
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
	"role_group_id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "role_group_role_group_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
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
	"user_id" bigint PRIMARY KEY NOT NULL,
	"coverage_semesters" smallint DEFAULT 4 NOT NULL,
	"status" varchar(20) NOT NULL,
	"paid_at" timestamp with time zone,
	"verified_by" bigint,
	"verified_at" timestamp with time zone,
	"note" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "survey" (
	"survey_id" serial PRIMARY KEY NOT NULL,
	"kind" varchar(20) NOT NULL,
	"title_ko" varchar(255) NOT NULL,
	"title_en" varchar(255),
	"description_ko" text,
	"description_en" text,
	"status" varchar(20) DEFAULT 'DRAFT' NOT NULL,
	"fee_requirement_policy" varchar(20) NOT NULL,
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
	"user_id" bigint NOT NULL,
	"role_group_id" integer NOT NULL,
	"granted_by" bigint,
	"granted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"valid_from" timestamp with time zone,
	"valid_to" timestamp with time zone,
	"is_active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
ALTER TABLE "users" RENAME COLUMN "id" TO "user_id";--> statement-breakpoint
ALTER TABLE "users" RENAME COLUMN "sso_user_id" TO "sso_subject";--> statement-breakpoint
ALTER TABLE "users" RENAME COLUMN "name" TO "name_ko";--> statement-breakpoint
ALTER TABLE "users" RENAME COLUMN "permission" TO "email";--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "email" TYPE varchar(255) USING "email"::text;--> statement-breakpoint
ALTER TABLE "users" DROP CONSTRAINT "users_sso_user_id_unique";--> statement-breakpoint
ALTER TABLE "article" DROP CONSTRAINT "article_author_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "asset" DROP CONSTRAINT "asset_uploaded_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "comment" DROP CONSTRAINT "comment_author_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "article_asset" ALTER COLUMN "usage_type" SET DATA TYPE varchar(20);--> statement-breakpoint
ALTER TABLE "article" ALTER COLUMN "author_user_id" SET DATA TYPE bigint;--> statement-breakpoint
ALTER TABLE "article" ALTER COLUMN "title_ko" SET DATA TYPE varchar(255);--> statement-breakpoint
ALTER TABLE "article" ALTER COLUMN "title_en" SET DATA TYPE varchar(255);--> statement-breakpoint
ALTER TABLE "article" ALTER COLUMN "status" SET DATA TYPE varchar(20);--> statement-breakpoint
ALTER TABLE "article" ALTER COLUMN "status" SET DEFAULT 'PUBLISHED';--> statement-breakpoint
ALTER TABLE "article" ALTER COLUMN "visibility_scope" SET DATA TYPE varchar(20);--> statement-breakpoint
ALTER TABLE "article" ALTER COLUMN "visibility_scope" SET DEFAULT 'PUBLIC';--> statement-breakpoint
ALTER TABLE "asset" ALTER COLUMN "uploaded_by" SET DATA TYPE bigint;--> statement-breakpoint
ALTER TABLE "board" ALTER COLUMN "code" SET DATA TYPE varchar(20);--> statement-breakpoint
ALTER TABLE "board" ALTER COLUMN "name_ko" SET DATA TYPE varchar(20);--> statement-breakpoint
ALTER TABLE "board" ALTER COLUMN "name_en" SET DATA TYPE varchar(100);--> statement-breakpoint
ALTER TABLE "board" ALTER COLUMN "description" SET DATA TYPE varchar(255);--> statement-breakpoint
ALTER TABLE "board" ALTER COLUMN "read_scope" SET DATA TYPE varchar(20);--> statement-breakpoint
ALTER TABLE "board" ALTER COLUMN "read_scope" SET DEFAULT 'PUBLIC';--> statement-breakpoint
ALTER TABLE "board" ALTER COLUMN "write_permission_id" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "board" ALTER COLUMN "write_permission_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "board" ALTER COLUMN "comment_permission_id" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "board" ALTER COLUMN "comment_permission_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "board" ALTER COLUMN "manage_permission_id" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "board" ALTER COLUMN "manage_permission_id" DROP NOT NULL;--> statement-breakpoint
UPDATE "board"
SET
	"write_permission_id" = NULL,
	"comment_permission_id" = NULL,
	"manage_permission_id" = NULL
WHERE
	"write_permission_id" = 0
	OR "comment_permission_id" = 0
	OR "manage_permission_id" = 0;--> statement-breakpoint
ALTER TABLE "board" ALTER COLUMN "allow_comment" SET DEFAULT false;--> statement-breakpoint
ALTER TABLE "comment" ALTER COLUMN "author_user_id" SET DATA TYPE bigint;--> statement-breakpoint
ALTER TABLE "comment" ALTER COLUMN "status" SET DATA TYPE varchar(20);--> statement-breakpoint
ALTER TABLE "comment" ALTER COLUMN "status" SET DEFAULT 'PUBLISHED';--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "kaist_uid" varchar(20) NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "std_no" varchar(20);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "name_en" varchar(100);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "dept_ko" varchar(100);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "dept_en" varchar(100);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "academic_status" varchar(20);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "identity_code" varchar(10);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "is_active" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "last_login_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_actor_user_id_users_user_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_group_permission" ADD CONSTRAINT "role_group_permission_role_group_id_role_group_role_group_id_fk" FOREIGN KEY ("role_group_id") REFERENCES "public"."role_group"("role_group_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_group_permission" ADD CONSTRAINT "role_group_permission_permission_id_permission_permission_id_fk" FOREIGN KEY ("permission_id") REFERENCES "public"."permission"("permission_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_fee_status" ADD CONSTRAINT "student_fee_status_user_id_users_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_fee_status" ADD CONSTRAINT "student_fee_status_verified_by_users_user_id_fk" FOREIGN KEY ("verified_by") REFERENCES "public"."users"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_role_group" ADD CONSTRAINT "user_role_group_user_id_users_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_role_group" ADD CONSTRAINT "user_role_group_role_group_id_role_group_role_group_id_fk" FOREIGN KEY ("role_group_id") REFERENCES "public"."role_group"("role_group_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_role_group" ADD CONSTRAINT "user_role_group_granted_by_users_user_id_fk" FOREIGN KEY ("granted_by") REFERENCES "public"."users"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "article" ADD CONSTRAINT "article_author_user_id_users_user_id_fk" FOREIGN KEY ("author_user_id") REFERENCES "public"."users"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asset" ADD CONSTRAINT "asset_uploaded_by_users_user_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "board" ADD CONSTRAINT "board_write_permission_id_permission_permission_id_fk" FOREIGN KEY ("write_permission_id") REFERENCES "public"."permission"("permission_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "board" ADD CONSTRAINT "board_comment_permission_id_permission_permission_id_fk" FOREIGN KEY ("comment_permission_id") REFERENCES "public"."permission"("permission_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "board" ADD CONSTRAINT "board_manage_permission_id_permission_permission_id_fk" FOREIGN KEY ("manage_permission_id") REFERENCES "public"."permission"("permission_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comment" ADD CONSTRAINT "comment_author_user_id_users_user_id_fk" FOREIGN KEY ("author_user_id") REFERENCES "public"."users"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "article_board_idx" ON "article" USING btree ("board_id");--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "user_email";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "user_mobile";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "privacy_consent_at";--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_sso_subject_unique" UNIQUE("sso_subject");--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_kaist_uid_unique" UNIQUE("kaist_uid");--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_std_no_unique" UNIQUE("std_no");--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_email_unique" UNIQUE("email");