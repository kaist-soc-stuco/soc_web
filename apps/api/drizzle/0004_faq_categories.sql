ALTER TABLE "article" DROP CONSTRAINT "article_faq_category_check";--> statement-breakpoint
ALTER TABLE "article" ADD CONSTRAINT "article_faq_category_check" CHECK ("article"."faq_category" IN ('account', 'fees', 'events-surveys', 'communication', 'academics', 'council', 'other'));
--> statement-breakpoint
-- Split only known legacy questions; preserve custom categories and unrelated boards.
UPDATE "article" AS a
SET "faq_category" = mapping.category
FROM "board" AS b,
  (VALUES
    ('학생회에 사업이나 정책을 건의하려면 어떻게 하나요?', 'communication'),
    ('비밀 건의사항과 공식 답변은 누가 볼 수 있나요?', 'communication'),
    ('댓글이나 공식 답변 알림은 어디서 확인하나요?', 'communication'),
    ('사이트 오류는 어떻게 신고하나요?', 'communication'),
    ('행사나 동아리 홍보글 게시를 요청하려면 어떻게 하나요?', 'communication'),
    ('학번별 단체 카카오톡방에 참여하려면 어떻게 하나요?', 'academics'),
    ('졸업 요건과 교과목 이수 순서는 어디서 확인하나요?', 'academics'),
    ('연구실, 교수진, 시설 정보는 어디서 확인하나요?', 'academics'),
    ('집행위원회 모집은 언제 하나요?', 'council'),
    ('학생회 활동인증서는 어디에 요청하나요?', 'council'),
    ('기업 후원이나 제휴를 제안하려면 어떻게 하나요?', 'council'),
    ('전산학부 학생회칙은 어디서 확인하나요?', 'council')
  ) AS mapping(title, category)
WHERE a."board_id" = b."board_id" AND b."code" = 'faq'
  AND a."title_ko" = mapping.title
  AND (a."faq_category" IS NULL OR a."faq_category" = 'other');
