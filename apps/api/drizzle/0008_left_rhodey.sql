ALTER TYPE "public"."content_block_type" ADD VALUE IF NOT EXISTS 'PLEDGE';--> statement-breakpoint
ALTER TABLE "survey" ADD COLUMN IF NOT EXISTS "eligible_soc_affiliations" jsonb DEFAULT '["PRIMARY","DOUBLE","MINOR"]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "survey" ADD COLUMN IF NOT EXISTS "academic_eligibility" varchar(30) DEFAULT 'ENROLLED_OR_LEAVE' NOT NULL;--> statement-breakpoint
ALTER TABLE "survey" ADD COLUMN IF NOT EXISTS "allow_anonymous" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "survey" ADD COLUMN IF NOT EXISTS "spreadsheet_id" varchar(255);--> statement-breakpoint
ALTER TABLE "survey" ADD COLUMN IF NOT EXISTS "spreadsheet_url" text;--> statement-breakpoint
ALTER TABLE "survey" ADD COLUMN IF NOT EXISTS "spreadsheet_sync_status" varchar(20) DEFAULT 'NOT_CONNECTED' NOT NULL;--> statement-breakpoint
ALTER TABLE "survey" ADD COLUMN IF NOT EXISTS "spreadsheet_last_synced_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "executive_contact" ADD COLUMN IF NOT EXISTS "department_ko" varchar(100);--> statement-breakpoint
ALTER TABLE "executive_contact" ADD COLUMN IF NOT EXISTS "department_en" varchar(100);--> statement-breakpoint
ALTER TABLE "executive_contact" ADD COLUMN IF NOT EXISTS "avatar_storage_key" varchar(255);--> statement-breakpoint
ALTER TABLE "content_block" ADD COLUMN IF NOT EXISTS "image_url_en" varchar(2000);--> statement-breakpoint
DELETE FROM "survey" WHERE "kind" NOT IN ('SURVEY', 'APPLICATION');--> statement-breakpoint
WITH ranked_links AS (
  SELECT "survey_id", ROW_NUMBER() OVER (
    PARTITION BY "connected_article_id"
    ORDER BY "updated_at" DESC, "survey_id" DESC
  ) AS row_number
  FROM "survey"
  WHERE "connected_article_id" IS NOT NULL
)
UPDATE "survey"
SET "connected_article_id" = NULL
WHERE "survey_id" IN (
  SELECT "survey_id" FROM ranked_links WHERE row_number > 1
);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "survey_connected_article_unique_idx" ON "survey" USING btree ("connected_article_id");--> statement-breakpoint
ALTER TABLE "survey" ADD CONSTRAINT "survey_kind_check" CHECK ("survey"."kind" in ('SURVEY', 'APPLICATION'));--> statement-breakpoint
ALTER TABLE "survey" ADD CONSTRAINT "survey_academic_eligibility_check" CHECK ("survey"."academic_eligibility" in ('ANY', 'ENROLLED_ONLY', 'ENROLLED_OR_LEAVE'));--> statement-breakpoint
ALTER TABLE "survey" ADD CONSTRAINT "survey_spreadsheet_sync_status_check" CHECK ("survey"."spreadsheet_sync_status" in ('NOT_CONNECTED', 'CONNECTED', 'ERROR'));
--> statement-breakpoint
INSERT INTO "permission" ("permission_id", "code", "bit_value", "name_ko", "name_en", "description", "is_active") VALUES
  (512, 'MODERATE_CONTENT', 512, '게시글·댓글 관리', 'Moderate content', '게시글과 댓글을 숨기고 복원하며 익명 작성자를 확인할 수 있습니다.', true),
  (1024, 'MANAGE_BOARDS', 1024, '게시판 설정', 'Manage boards', '게시판과 읽기·쓰기 범위, 제공 기능을 설정할 수 있습니다.', true),
  (2048, 'SEND_BULK_EMAIL', 2048, '이메일 일괄 발송', 'Send bulk email', '수신자를 필터링하고 템플릿과 일괄 발송을 관리할 수 있습니다.', true),
  (4096, 'VIEW_AUDIT_LOG', 4096, '운영 로그 조회', 'View audit log', '관리자 작업과 보안 관련 운영 로그를 조회할 수 있습니다.', true),
  (8192, 'MANAGE_ROLES', 8192, '권한·역할 관리', 'Manage roles', '운영 역할을 만들고 권한과 구성원을 관리할 수 있습니다.', true),
  (16384, 'SUPER_ADMIN', 16384, '최고 관리자', 'Super administrator', '모든 운영 권한을 부여받는 비상용 최고 관리자 권한입니다.', true)
ON CONFLICT ("permission_id") DO NOTHING;
--> statement-breakpoint
INSERT INTO "role_group_permission" ("role_group_id", "permission_id")
SELECT "role_group_id", 512 FROM "role_group_permission" WHERE "permission_id" = 128
ON CONFLICT DO NOTHING;
--> statement-breakpoint
INSERT INTO "role_group_permission" ("role_group_id", "permission_id")
SELECT "role_group_id", 16384 FROM "role_group_permission" WHERE "permission_id" = 256
ON CONFLICT DO NOTHING;
--> statement-breakpoint
INSERT INTO "role_group_permission" ("role_group_id", "permission_id")
SELECT "role_group_id", 256 FROM "role_group_permission" WHERE "permission_id" = 128
ON CONFLICT DO NOTHING;
--> statement-breakpoint
DELETE FROM "role_group_permission" WHERE "permission_id" IN (64, 128);
--> statement-breakpoint
INSERT INTO "role_group_permission" ("role_group_id", "permission_id")
SELECT "role_group_id", expanded."permission_id"
FROM "role_group_permission"
CROSS JOIN (VALUES (64), (128)) AS expanded("permission_id")
WHERE "role_group_permission"."permission_id" = 32
ON CONFLICT DO NOTHING;
--> statement-breakpoint
UPDATE "permission" SET "code" = 'WRITE_OFFICIAL', "name_ko" = '공지·행사·HoC·홍보 작성', "name_en" = 'Write official content', "description" = '공지, 행사, HoC와 홍보 게시글을 작성할 수 있습니다.' WHERE "permission_id" = 1;
UPDATE "permission" SET "code" = 'WRITE_LAB', "name_ko" = '연구실 게시판 작성', "name_en" = 'Write lab posts', "description" = '연구실 게시판에 글을 작성할 수 있습니다.' WHERE "permission_id" = 2;
UPDATE "permission" SET "code" = 'MANAGE_SITE_CONTENT', "name_ko" = '사이트 설정', "name_en" = 'Manage site content', "description" = '홈 히어로, 띠배너, 퀵링크, 조직도와 공약을 관리할 수 있습니다.' WHERE "permission_id" = 32;
UPDATE "permission" SET "code" = 'MANAGE_CALENDAR', "name_ko" = '일정 관리', "name_en" = 'Manage calendar', "description" = '학생회 일정과 외부 동기화 일정을 관리할 수 있습니다.' WHERE "permission_id" = 64;
UPDATE "permission" SET "code" = 'MANAGE_CONTACTS', "name_ko" = '연락망 관리', "name_en" = 'Manage contacts', "description" = '집행위원회 내부 연락망을 관리하고 내보낼 수 있습니다.' WHERE "permission_id" = 128;
UPDATE "permission" SET "code" = 'MANAGE_USERS', "name_ko" = '사용자 관리', "name_en" = 'Manage users', "description" = '사용자 정보와 계정 상태, 운영 제재를 관리할 수 있습니다.' WHERE "permission_id" = 256;
--> statement-breakpoint
SELECT setval(pg_get_serial_sequence('permission', 'permission_id'), (SELECT MAX("permission_id") FROM "permission"));
