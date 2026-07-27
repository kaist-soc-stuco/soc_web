CREATE TYPE "public"."article_scope" AS ENUM('ALL', 'KAIST', 'SOC', 'AUTHOR_AND_STAFF', 'STAFF');--> statement-breakpoint
CREATE TYPE "public"."article_status" AS ENUM('DRAFT', 'PUBLISHED', 'DELETED', 'HIDDEN');--> statement-breakpoint
CREATE TYPE "public"."asset_object_deletion_status" AS ENUM('PENDING', 'DELETED', 'FAILED');--> statement-breakpoint
CREATE TYPE "public"."asset_status" AS ENUM('INITIATED', 'COMPLETED', 'DELETED');--> statement-breakpoint
CREATE TYPE "public"."asset_type" AS ENUM('IMAGE', 'ATTACHMENT', 'IMAGE_THUMBNAIL');--> statement-breakpoint
CREATE TYPE "public"."board_permission" AS ENUM('PUBLIC', 'AUTHENTICATED', 'COMMITTEE', 'ADMIN');--> statement-breakpoint
CREATE TYPE "public"."comment_status" AS ENUM('PUBLISHED', 'SECRET', 'DELETED');--> statement-breakpoint
CREATE TYPE "public"."legal_hold_status" AS ENUM('ACTIVE', 'RELEASED');--> statement-breakpoint
CREATE TYPE "public"."purge_action" AS ENUM('SCHEDULED', 'HELD', 'PURGED', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."purge_subject_type" AS ENUM('ARTICLE', 'COMMENT', 'ASSET');--> statement-breakpoint
CREATE TYPE "public"."reaction_type" AS ENUM('LIKE', 'DISLIKE');--> statement-breakpoint
CREATE TABLE "article_reactions" (
	"article_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"type" "reaction_type" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "articles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"board_id" uuid NOT NULL,
	"author_user_id" uuid NOT NULL,
	"title_kr" text NOT NULL,
	"title_en" text NOT NULL,
	"body_kr" text NOT NULL,
	"body_en" text NOT NULL,
	"status" "article_status" DEFAULT 'DRAFT' NOT NULL,
	"scope" "article_scope" NOT NULL,
	"is_pinned" boolean DEFAULT false NOT NULL,
	"pinned_order" integer,
	"published_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	"purge_after" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "articles_title_kr_nonempty" CHECK (btrim("articles"."title_kr") <> ''),
	CONSTRAINT "articles_title_en_nonempty" CHECK (btrim("articles"."title_en") <> ''),
	CONSTRAINT "articles_body_kr_nonempty" CHECK (btrim("articles"."body_kr") <> ''),
	CONSTRAINT "articles_body_en_nonempty" CHECK (btrim("articles"."body_en") <> ''),
	CONSTRAINT "articles_pinned_order_nonnegative" CHECK ("articles"."pinned_order" IS NULL OR "articles"."pinned_order" >= 0),
	CONSTRAINT "articles_pinned_state" CHECK ("articles"."is_pinned" = ("articles"."pinned_order" IS NOT NULL)),
	CONSTRAINT "articles_deleted_at_status" CHECK (("articles"."status" = 'DELETED') = ("articles"."deleted_at" IS NOT NULL)),
	CONSTRAINT "articles_purge_lifecycle" CHECK (("articles"."status" = 'DELETED' AND "articles"."deleted_at" IS NOT NULL AND "articles"."purge_after" IS NOT NULL AND "articles"."purge_after" >= "articles"."deleted_at") OR ("articles"."status" <> 'DELETED' AND "articles"."deleted_at" IS NULL AND "articles"."purge_after" IS NULL)),
	CONSTRAINT "articles_published_at_lifecycle" CHECK (("articles"."status" <> 'PUBLISHED' OR "articles"."published_at" IS NOT NULL) AND ("articles"."status" <> 'DRAFT' OR "articles"."published_at" IS NULL))
);
--> statement-breakpoint
CREATE TABLE "assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"article_id" uuid NOT NULL,
	"display_order" integer NOT NULL,
	"type" "asset_type" NOT NULL,
	"status" "asset_status" DEFAULT 'INITIATED' NOT NULL,
	"provider" text NOT NULL,
	"object_key" text NOT NULL,
	"content_type" text NOT NULL,
	"byte_size" integer NOT NULL,
	"checksum_sha256" text,
	"object_deletion_status" "asset_object_deletion_status" DEFAULT 'PENDING' NOT NULL,
	"object_deletion_attempts" integer DEFAULT 0 NOT NULL,
	"last_object_deletion_error_code" text,
	"initiated_by_user_id" uuid NOT NULL,
	"completed_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	"purge_after" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "assets_display_order_nonnegative" CHECK ("assets"."display_order" >= 0),
	CONSTRAINT "assets_byte_size_positive" CHECK ("assets"."byte_size" > 0),
	CONSTRAINT "assets_object_deletion_attempts_nonnegative" CHECK ("assets"."object_deletion_attempts" >= 0),
	CONSTRAINT "assets_object_deletion_error_code_technical_identifier" CHECK ("assets"."last_object_deletion_error_code" IS NULL OR "assets"."last_object_deletion_error_code" ~ '^[A-Z][A-Z0-9_]{1,63}$'),
	CONSTRAINT "assets_completed_at_lifecycle" CHECK (("assets"."status" = 'INITIATED' AND "assets"."completed_at" IS NULL) OR ("assets"."status" = 'COMPLETED' AND "assets"."completed_at" IS NOT NULL) OR "assets"."status" = 'DELETED'),
	CONSTRAINT "assets_deleted_at_status" CHECK (("assets"."status" = 'DELETED') = ("assets"."deleted_at" IS NOT NULL)),
	CONSTRAINT "assets_purge_lifecycle" CHECK (("assets"."status" = 'DELETED' AND "assets"."deleted_at" IS NOT NULL AND "assets"."purge_after" IS NOT NULL AND "assets"."purge_after" >= "assets"."deleted_at") OR ("assets"."status" <> 'DELETED' AND "assets"."deleted_at" IS NULL AND "assets"."purge_after" IS NULL)),
	CONSTRAINT "assets_object_deletion_status_lifecycle" CHECK ("assets"."object_deletion_status" <> 'DELETED' OR "assets"."status" = 'DELETED')
);
--> statement-breakpoint
CREATE TABLE "boards" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"title_kr" text NOT NULL,
	"title_en" text NOT NULL,
	"description_kr" text NOT NULL,
	"description_en" text NOT NULL,
	"read_permission" "board_permission" NOT NULL,
	"write_permission" "board_permission" DEFAULT 'AUTHENTICATED' NOT NULL,
	"comment_permission" "board_permission" DEFAULT 'AUTHENTICATED' NOT NULL,
	"comments_allowed" boolean DEFAULT true NOT NULL,
	"secret_articles_allowed" boolean DEFAULT false NOT NULL,
	"reactions_allowed" boolean DEFAULT true NOT NULL,
	"display_order" integer NOT NULL,
	"is_hidden" boolean DEFAULT false NOT NULL,
	"show_on_home" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "boards_code_nonempty" CHECK (btrim("boards"."code") <> ''),
	CONSTRAINT "boards_title_kr_nonempty" CHECK (btrim("boards"."title_kr") <> ''),
	CONSTRAINT "boards_title_en_nonempty" CHECK (btrim("boards"."title_en") <> ''),
	CONSTRAINT "boards_description_kr_nonempty" CHECK (btrim("boards"."description_kr") <> ''),
	CONSTRAINT "boards_description_en_nonempty" CHECK (btrim("boards"."description_en") <> ''),
	CONSTRAINT "boards_display_order_nonnegative" CHECK ("boards"."display_order" >= 0)
);
--> statement-breakpoint
CREATE TABLE "comments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"article_id" uuid NOT NULL,
	"parent_comment_id" uuid,
	"author_user_id" uuid NOT NULL,
	"body" text NOT NULL,
	"status" "comment_status" DEFAULT 'PUBLISHED' NOT NULL,
	"deleted_at" timestamp with time zone,
	"purge_after" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "comments_article_id_unique" UNIQUE("article_id","id"),
	CONSTRAINT "comments_body_nonempty" CHECK (btrim("comments"."body") <> ''),
	CONSTRAINT "comments_deleted_at_status" CHECK (("comments"."status" = 'DELETED') = ("comments"."deleted_at" IS NOT NULL)),
	CONSTRAINT "comments_purge_lifecycle" CHECK (("comments"."status" = 'DELETED' AND "comments"."deleted_at" IS NOT NULL AND "comments"."purge_after" IS NOT NULL AND "comments"."purge_after" >= "comments"."deleted_at") OR ("comments"."status" <> 'DELETED' AND "comments"."deleted_at" IS NULL AND "comments"."purge_after" IS NULL))
);
--> statement-breakpoint
CREATE TABLE "legal_holds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"article_id" uuid,
	"comment_id" uuid,
	"asset_id" uuid,
	"status" "legal_hold_status" DEFAULT 'ACTIVE' NOT NULL,
	"reason_code" text NOT NULL,
	"placed_by_user_id" uuid NOT NULL,
	"released_by_user_id" uuid,
	"released_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "legal_holds_one_subject" CHECK (num_nonnulls("legal_holds"."article_id", "legal_holds"."comment_id", "legal_holds"."asset_id") = 1),
	CONSTRAINT "legal_holds_release_state" CHECK (("legal_holds"."status" = 'RELEASED') = ("legal_holds"."released_at" IS NOT NULL)),
	CONSTRAINT "legal_holds_released_by_lifecycle" CHECK (("legal_holds"."status" = 'RELEASED') = ("legal_holds"."released_by_user_id" IS NOT NULL)),
	CONSTRAINT "legal_holds_reason_code_technical_identifier" CHECK ("legal_holds"."reason_code" ~ '^[A-Z][A-Z0-9_]{1,63}$')
);
--> statement-breakpoint
CREATE TABLE "purge_audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"subject_type" "purge_subject_type" NOT NULL,
	"subject_id" uuid NOT NULL,
	"action" "purge_action" NOT NULL,
	"actor_user_id" uuid,
	"legal_hold_id" uuid,
	"correlation_id" text NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "purge_audit_log_correlation_identifier" CHECK ("purge_audit_log"."correlation_id" ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$')
);
--> statement-breakpoint
ALTER TABLE "article_reactions" ADD CONSTRAINT "article_reactions_article_id_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."articles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "article_reactions" ADD CONSTRAINT "article_reactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "articles" ADD CONSTRAINT "articles_board_id_boards_id_fk" FOREIGN KEY ("board_id") REFERENCES "public"."boards"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "articles" ADD CONSTRAINT "articles_author_user_id_users_id_fk" FOREIGN KEY ("author_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assets" ADD CONSTRAINT "assets_article_id_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."articles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assets" ADD CONSTRAINT "assets_initiated_by_user_id_users_id_fk" FOREIGN KEY ("initiated_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_article_id_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."articles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_author_user_id_users_id_fk" FOREIGN KEY ("author_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_parent_same_article_fk" FOREIGN KEY ("article_id","parent_comment_id") REFERENCES "public"."comments"("article_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legal_holds" ADD CONSTRAINT "legal_holds_article_id_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."articles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legal_holds" ADD CONSTRAINT "legal_holds_comment_id_comments_id_fk" FOREIGN KEY ("comment_id") REFERENCES "public"."comments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legal_holds" ADD CONSTRAINT "legal_holds_asset_id_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legal_holds" ADD CONSTRAINT "legal_holds_placed_by_user_id_users_id_fk" FOREIGN KEY ("placed_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legal_holds" ADD CONSTRAINT "legal_holds_released_by_user_id_users_id_fk" FOREIGN KEY ("released_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purge_audit_log" ADD CONSTRAINT "purge_audit_log_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "article_reactions_article_user_unique" ON "article_reactions" USING btree ("article_id","user_id");--> statement-breakpoint
CREATE INDEX "article_reactions_article_type_idx" ON "article_reactions" USING btree ("article_id","type");--> statement-breakpoint
CREATE INDEX "articles_board_list_idx" ON "articles" USING btree ("board_id","status","published_at");--> statement-breakpoint
CREATE INDEX "articles_purge_idx" ON "articles" USING btree ("status","purge_after");--> statement-breakpoint
CREATE UNIQUE INDEX "assets_article_display_order_unique" ON "assets" USING btree ("article_id","display_order") WHERE "assets"."status" <> 'DELETED';--> statement-breakpoint
CREATE INDEX "assets_purge_idx" ON "assets" USING btree ("status","purge_after");--> statement-breakpoint
CREATE UNIQUE INDEX "boards_code_unique" ON "boards" USING btree ("code");--> statement-breakpoint
CREATE UNIQUE INDEX "boards_display_order_unique" ON "boards" USING btree ("display_order");--> statement-breakpoint
CREATE INDEX "boards_home_idx" ON "boards" USING btree ("show_on_home","is_hidden","display_order");--> statement-breakpoint
CREATE INDEX "comments_article_list_idx" ON "comments" USING btree ("article_id","created_at");--> statement-breakpoint
CREATE INDEX "comments_purge_idx" ON "comments" USING btree ("status","purge_after");--> statement-breakpoint
CREATE INDEX "legal_holds_active_article_idx" ON "legal_holds" USING btree ("article_id") WHERE "legal_holds"."status" = 'ACTIVE';--> statement-breakpoint
CREATE INDEX "legal_holds_active_comment_idx" ON "legal_holds" USING btree ("comment_id") WHERE "legal_holds"."status" = 'ACTIVE';--> statement-breakpoint
CREATE INDEX "legal_holds_active_asset_idx" ON "legal_holds" USING btree ("asset_id") WHERE "legal_holds"."status" = 'ACTIVE';--> statement-breakpoint
CREATE INDEX "purge_audit_log_subject_idx" ON "purge_audit_log" USING btree ("subject_type","subject_id","occurred_at");--> statement-breakpoint
CREATE INDEX "purge_audit_log_occurred_at_idx" ON "purge_audit_log" USING btree ("occurred_at");
--> statement-breakpoint
CREATE FUNCTION "public"."prevent_active_legal_hold_subject_delete"() RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $$
BEGIN
  IF (
    (TG_TABLE_NAME = 'articles' AND EXISTS (SELECT 1 FROM "public"."legal_holds" WHERE "status" = 'ACTIVE' AND "article_id" = OLD."id"))
    OR (TG_TABLE_NAME = 'comments' AND EXISTS (SELECT 1 FROM "public"."legal_holds" WHERE "status" = 'ACTIVE' AND "comment_id" = OLD."id"))
    OR (TG_TABLE_NAME = 'assets' AND EXISTS (SELECT 1 FROM "public"."legal_holds" WHERE "status" = 'ACTIVE' AND "asset_id" = OLD."id"))
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '23503', MESSAGE = 'active_legal_hold';
  END IF;
  RETURN OLD;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER "articles_active_legal_hold_delete_guard"
BEFORE DELETE ON "public"."articles"
FOR EACH ROW EXECUTE FUNCTION "public"."prevent_active_legal_hold_subject_delete"();
--> statement-breakpoint
CREATE TRIGGER "comments_active_legal_hold_delete_guard"
BEFORE DELETE ON "public"."comments"
FOR EACH ROW EXECUTE FUNCTION "public"."prevent_active_legal_hold_subject_delete"();
--> statement-breakpoint
CREATE TRIGGER "assets_active_legal_hold_delete_guard"
BEFORE DELETE ON "public"."assets"
FOR EACH ROW EXECUTE FUNCTION "public"."prevent_active_legal_hold_subject_delete"();
--> statement-breakpoint
INSERT INTO "permission_definitions" ("key", "description")
VALUES
  ('BOARD_MANAGE', 'Manage boards and moderate board content'),
  ('COMMITTEE_MEMBER', 'Access committee-scoped content')
ON CONFLICT ("key") DO NOTHING;
--> statement-breakpoint
INSERT INTO "boards" (
  "code", "title_kr", "title_en", "description_kr", "description_en",
  "read_permission", "write_permission", "comment_permission",
  "comments_allowed", "secret_articles_allowed", "reactions_allowed",
  "display_order", "is_hidden", "show_on_home"
)
VALUES
  ('soc-notice', '집행위 공지', 'Committee Notices', '학생회 집행위원회 공지사항', 'Student council committee notices', 'PUBLIC', 'COMMITTEE', 'AUTHENTICATED', true, false, true, 10, false, true),
  ('soc-events', '집행위 행사', 'Committee Events', '학생회 집행위원회 행사 소식', 'Student council committee events', 'PUBLIC', 'COMMITTEE', 'AUTHENTICATED', true, false, true, 20, false, true),
  ('human-of-cs', 'Human of CS', 'Human of CS', '전산학부 구성원 이야기', 'Stories from the School of Computing community', 'PUBLIC', 'COMMITTEE', 'AUTHENTICATED', true, false, true, 30, false, true),
  ('external-promotion', '외부 홍보 글', 'External Promotions', '외부 행사와 프로그램 홍보', 'External events and program promotions', 'PUBLIC', 'COMMITTEE', 'AUTHENTICATED', true, false, true, 40, false, true),
  ('suggestions', '건의 사항', 'Suggestions', '학생회에 전달하는 건의 사항', 'Suggestions for the student council', 'PUBLIC', 'AUTHENTICATED', 'AUTHENTICATED', true, true, true, 50, false, true),
  ('laboratories', '연구실', 'Laboratories', '전산학부 연구실 소식', 'School of Computing laboratory news', 'PUBLIC', 'COMMITTEE', 'AUTHENTICATED', true, false, true, 60, false, true),
  ('escamp', 'ESCamp', 'ESCamp', 'ESCamp 관련 공지와 이야기', 'ESCamp notices and stories', 'PUBLIC', 'COMMITTEE', 'AUTHENTICATED', true, false, true, 70, false, true)
ON CONFLICT ("code") DO NOTHING;