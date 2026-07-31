BEGIN;

UPDATE "boards"
SET "title_kr" = '공지'
WHERE "code" = 'soc-notice'
  AND "title_kr" = '집행위 공지'
  AND "title_en" = 'Committee Notices'
  AND "description_kr" = '학생회 집행위원회 공지사항'
  AND "description_en" = 'Student council committee notices'
  AND "read_permission" = 'PUBLIC'
  AND "write_permission" = 'COMMITTEE'
  AND "comment_permission" = 'AUTHENTICATED'
  AND "comments_allowed" = true
  AND "secret_articles_allowed" = false
  AND "reactions_allowed" = true
  AND "display_order" = 10
  AND "is_hidden" = false
  AND "show_on_home" = true;

UPDATE "boards"
SET "title_kr" = '행사'
WHERE "code" = 'soc-events'
  AND "title_kr" = '집행위 행사'
  AND "title_en" = 'Committee Events'
  AND "description_kr" = '학생회 집행위원회 행사 소식'
  AND "description_en" = 'Student council committee events'
  AND "read_permission" = 'PUBLIC'
  AND "write_permission" = 'COMMITTEE'
  AND "comment_permission" = 'AUTHENTICATED'
  AND "comments_allowed" = true
  AND "secret_articles_allowed" = false
  AND "reactions_allowed" = true
  AND "display_order" = 20
  AND "is_hidden" = false
  AND "show_on_home" = true;

UPDATE "boards"
SET "title_kr" = 'HoC'
WHERE "code" = 'human-of-cs'
  AND "title_kr" = 'Human of CS'
  AND "title_en" = 'Human of CS'
  AND "description_kr" = '전산학부 구성원 이야기'
  AND "description_en" = 'Stories from the School of Computing community'
  AND "read_permission" = 'PUBLIC'
  AND "write_permission" = 'COMMITTEE'
  AND "comment_permission" = 'AUTHENTICATED'
  AND "comments_allowed" = true
  AND "secret_articles_allowed" = false
  AND "reactions_allowed" = true
  AND "display_order" = 30
  AND "is_hidden" = false
  AND "show_on_home" = true;

UPDATE "boards"
SET "title_kr" = '홍보글'
WHERE "code" = 'external-promotion'
  AND "title_kr" = '외부 홍보 글'
  AND "title_en" = 'External Promotions'
  AND "description_kr" = '외부 행사와 프로그램 홍보'
  AND "description_en" = 'External events and program promotions'
  AND "read_permission" = 'PUBLIC'
  AND "write_permission" = 'COMMITTEE'
  AND "comment_permission" = 'AUTHENTICATED'
  AND "comments_allowed" = true
  AND "secret_articles_allowed" = false
  AND "reactions_allowed" = true
  AND "display_order" = 40
  AND "is_hidden" = false
  AND "show_on_home" = true;

UPDATE "boards"
SET "title_kr" = '건의사항 및 QnA'
WHERE "code" = 'suggestions'
  AND "title_kr" = '건의 사항'
  AND "title_en" = 'Suggestions'
  AND "description_kr" = '학생회에 전달하는 건의 사항'
  AND "description_en" = 'Suggestions for the student council'
  AND "read_permission" = 'PUBLIC'
  AND "write_permission" = 'AUTHENTICATED'
  AND "comment_permission" = 'AUTHENTICATED'
  AND "comments_allowed" = true
  AND "secret_articles_allowed" = true
  AND "reactions_allowed" = true
  AND "display_order" = 50
  AND "is_hidden" = false
  AND "show_on_home" = true;

COMMIT;
