ALTER TABLE "article" ADD COLUMN "faq_category" varchar(30);
--> statement-breakpoint
ALTER TABLE "article" ADD CONSTRAINT "article_faq_category_check" CHECK ("faq_category" IN ('account', 'fees', 'events-surveys', 'other'));
--> statement-breakpoint
UPDATE article SET faq_category = CASE
  WHEN title_ko IN ('KAIST 계정으로 어떻게 로그인하나요?', '게시글·댓글 작성 권한은 어떻게 되나요?', '프로필 정보가 잘못 표시되면 어떻게 하나요?', '계정 비활성화 안내가 표시되면 어떻게 하나요?') THEN 'account'
  WHEN title_ko IN ('과비는 어떻게 납부하나요?', '제 과비 납부 여부는 어디서 확인하나요?', '과비를 환급받을 수 있나요?') THEN 'fees'
  WHEN title_ko IN ('행사·일정은 어디서 확인하나요?', '행사는 어떻게 신청하나요?', '행사 신청을 수정하거나 취소하려면 어떻게 하나요?', '설문이나 투표에 참여할 수 없다고 표시되는 이유는 무엇인가요?') THEN 'events-surveys'
  ELSE 'other'
END
WHERE board_id IN (SELECT board_id FROM board WHERE code = 'faq') AND faq_category IS NULL;
