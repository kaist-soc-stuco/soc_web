CREATE TABLE "article_asset" (
	"article_asset_id" serial PRIMARY KEY NOT NULL,
	"article_id" integer NOT NULL,
	"asset_id" integer NOT NULL,
	"usage_type" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "article" (
	"article_id" serial PRIMARY KEY NOT NULL,
	"board_id" integer NOT NULL,
	"author_user_id" integer NOT NULL,
	"title_ko" text NOT NULL,
	"title_en" text,
	"content_ko" text NOT NULL,
	"content_en" text,
	"status" text DEFAULT 'PUBLISHED' NOT NULL,
	"visibility_scope" text DEFAULT 'PUBLIC' NOT NULL,
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
CREATE TABLE "board" (
	"board_id" serial PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"name_ko" text NOT NULL,
	"name_en" text,
	"description" text,
	"read_scope" text DEFAULT 'PUBLIC' NOT NULL,
	"write_permission_id" integer DEFAULT 0 NOT NULL,
	"comment_permission_id" integer DEFAULT 0 NOT NULL,
	"manage_permission_id" integer DEFAULT 0 NOT NULL,
	"allow_comment" boolean DEFAULT true NOT NULL,
	"allow_secret" boolean DEFAULT false NOT NULL,
	"allow_like" boolean DEFAULT true NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "board_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "comment" (
	"comment_id" serial PRIMARY KEY NOT NULL,
	"article_id" integer NOT NULL,
	"parent_comment_id" integer,
	"author_user_id" integer NOT NULL,
	"content" text NOT NULL,
	"status" text DEFAULT 'PUBLISHED' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"sso_user_id" text NOT NULL,
	"name" text,
	"permission" integer DEFAULT 0 NOT NULL,
	"user_email" text,
	"user_mobile" text,
	"privacy_consent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_sso_user_id_unique" UNIQUE("sso_user_id")
);
--> statement-breakpoint
ALTER TABLE "article_asset" ADD CONSTRAINT "article_asset_article_id_article_article_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."article"("article_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "article_asset" ADD CONSTRAINT "article_asset_asset_id_asset_asset_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."asset"("asset_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "article" ADD CONSTRAINT "article_board_id_board_board_id_fk" FOREIGN KEY ("board_id") REFERENCES "public"."board"("board_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "article" ADD CONSTRAINT "article_author_user_id_users_id_fk" FOREIGN KEY ("author_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asset" ADD CONSTRAINT "asset_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comment" ADD CONSTRAINT "comment_article_id_article_article_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."article"("article_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comment" ADD CONSTRAINT "comment_author_user_id_users_id_fk" FOREIGN KEY ("author_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comment" ADD CONSTRAINT "comment_parent_comment_id_comment_comment_id_fk" FOREIGN KEY ("parent_comment_id") REFERENCES "public"."comment"("comment_id") ON DELETE set null ON UPDATE no action;