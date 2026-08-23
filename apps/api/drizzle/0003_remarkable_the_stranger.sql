ALTER TYPE "public"."content_block_type" ADD VALUE IF NOT EXISTS 'PLEDGE';--> statement-breakpoint
UPDATE "board"
SET "code" = '_EVENT', "name_ko" = '행사 콘텐츠', "name_en" = 'Event content'
WHERE "code" = '행사'
  AND NOT EXISTS (SELECT 1 FROM "board" WHERE "code" = '_EVENT');--> statement-breakpoint
DELETE FROM "article_draft"
WHERE "board_id" IN (SELECT "board_id" FROM "board" WHERE "code" IN ('공약', 'QnA'));--> statement-breakpoint
DELETE FROM "board" WHERE "code" IN ('공약', 'QnA');--> statement-breakpoint
INSERT INTO "board" (
  "code", "name_ko", "name_en", "description_ko", "description_en",
  "write_permission_id", "allow_comment", "allow_secret", "allow_like", "is_active", "sort_order"
)
SELECT 'FAQ', 'FAQ', 'FAQ', '자주 묻는 질문과 답변을 확인하세요',
  'Browse frequently asked questions and answers.', 1, false, false, false, true, 6
WHERE NOT EXISTS (SELECT 1 FROM "board" WHERE "code" = 'FAQ');--> statement-breakpoint
ALTER TABLE "comment" ADD COLUMN "is_official" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "content_block" ADD COLUMN "pledge_status" varchar(20);
