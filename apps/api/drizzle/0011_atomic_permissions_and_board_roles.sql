ALTER TABLE "board"
  ADD COLUMN IF NOT EXISTS "allow_official_reply" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "board_role_group" (
  "board_id" integer NOT NULL,
  "role_group_id" integer NOT NULL,
  "is_active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "board_role_group_pk" PRIMARY KEY("board_id", "role_group_id")
);
--> statement-breakpoint
ALTER TABLE "board_role_group"
  ADD CONSTRAINT "board_role_group_board_id_board_board_id_fk"
  FOREIGN KEY ("board_id") REFERENCES "public"."board"("board_id")
  ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "board_role_group"
  ADD CONSTRAINT "board_role_group_role_group_id_role_group_role_group_id_fk"
  FOREIGN KEY ("role_group_id") REFERENCES "public"."role_group"("role_group_id")
  ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "board_role_group_board_idx"
  ON "board_role_group" USING btree ("board_id", "is_active");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "board_role_group_role_idx"
  ON "board_role_group" USING btree ("role_group_id", "is_active");
--> statement-breakpoint
INSERT INTO "permission" ("permission_id", "code", "bit_value", "name_ko", "name_en", "description", "is_active")
VALUES
  (1024, 'POST_CREATE', 1024, '게시글 작성', 'Create Posts', '게시판 설정에서 역할에 연결된 게시판에 게시글을 작성할 수 있습니다.', true),
  (2048, 'POST_OFFICIAL', 2048, '공식 명의 발행', 'Publish Officially', '게시글과 댓글을 공식 명의로 발행할 수 있습니다.', true),
  (4096, 'POST_ANNOUNCEMENT', 4096, '공지·고정글 권한', 'Manage Announcements', '게시글을 공지로 표시하거나 게시판 상단에 고정할 수 있습니다.', true),
  (8192, 'VIEW_SECRET_POST', 8192, '비밀글 열람', 'View Secret Posts', '비밀글 내용을 열람할 수 있습니다. 익명 작성자의 신원은 공개하지 않습니다.', true),
  (16384, 'COMMENT_CREATE', 16384, '댓글 작성', 'Create Comments', '댓글 작성이 허용된 게시글에 댓글을 작성할 수 있습니다.', true),
  (32768, 'MODERATE_POST_COMMENT', 32768, '게시글·댓글 관리·제재', 'Moderate Posts and Comments', '게시글과 댓글을 수정·삭제·숨김 처리하고 작성자 이용 제한을 적용할 수 있습니다.', true),
  (65536, 'MANAGE_SUGGESTION_REPLY', 65536, '공식 답변 관리', 'Manage Official Replies', '공식 답변이 허용된 게시판에서 공식 답변을 작성할 수 있습니다.', true),
  (131072, 'MANAGE_BOARD_SETTINGS', 131072, '게시판 설정 관리', 'Manage Board Settings', '게시판을 만들고 작성 역할 매핑과 게시판 기능을 관리할 수 있습니다.', true),
  (262144, 'MANAGE_PERMISSIONS', 262144, '권한 관리', 'Manage Permissions', '역할 그룹과 역할별 권한·구성원을 관리할 수 있습니다.', true),
  (524288, 'MANAGE_FINANCE', 524288, '과비 관리', 'Manage Finance', '학생회비 납부 상태와 수납 내역을 확인·수정하고 원장과 동기화할 수 있습니다.', true),
  (1048576, 'MANAGE_SITE_CONTENT', 1048576, '사이트 콘텐츠 관리', 'Manage Site Content', '홈 화면과 배너, 소개 콘텐츠를 수정할 수 있습니다.', true),
  (2097152, 'MANAGE_POLL', 2097152, '투표 관리', 'Manage Polls', '투표를 만들고 투표 결과를 관리할 수 있습니다.', true),
  (4194304, 'VIEW_USERS', 4194304, '유저 DB 열람', 'View User Database', '사용자 목록과 사용자 프로필을 열람할 수 있습니다.', true),
  (8388608, 'MANAGE_USERS', 8388608, '유저 DB 관리', 'Manage User Database', '사용자 계정의 활성 상태와 운영 정보를 관리할 수 있습니다.', true),
  (16777216, 'VIEW_CONTACTS', 16777216, '집행위 연락망 열람', 'View Executive Contacts', '집행위원회 연락망을 열람할 수 있습니다.', true),
  (33554432, 'MANAGE_CONTACTS', 33554432, '집행위 연락망 관리', 'Manage Executive Contacts', '집행위원회 연락망을 등록·수정·삭제할 수 있습니다.', true),
  (67108864, 'SEND_EMAIL', 67108864, '메일 발송', 'Send Email', '승인된 수신자에게 운영 메일을 작성하고 발송할 수 있습니다.', true),
  (134217728, 'MANAGE_SURVEY', 134217728, '설문조사 관리', 'Manage Surveys', '투표를 제외한 설문·신청·행사형 콘텐츠와 응답을 관리할 수 있습니다.', true),
  (268435456, 'MANAGE_CALENDAR', 268435456, '캘린더 일정 관리', 'Manage Calendar', '캘린더 일정을 등록·수정·삭제할 수 있습니다.', true),
  (536870912, 'VIEW_AUDIT_LOG', 536870912, '운영 로그 열람', 'View Audit Logs', '운영 변경 이력과 감사 로그를 열람할 수 있습니다.', true),
  (1073741824, 'SUPER_ADMIN', 1073741824, '시스템 관리자', 'Super Admin', '부트스트랩과 장애 대응을 위한 시스템 전용 권한입니다.', true)
ON CONFLICT (code) DO UPDATE SET
  bit_value = excluded.bit_value,
  name_ko = excluded.name_ko,
  name_en = excluded.name_en,
  description = excluded.description,
  is_active = excluded.is_active;
--> statement-breakpoint
SELECT setval(
  pg_get_serial_sequence('permission', 'permission_id'),
  GREATEST((SELECT COALESCE(MAX(permission_id), 1) FROM "permission"), 1),
  true
);
--> statement-breakpoint
WITH legacy_to_atomic(old_code, new_code) AS (
  VALUES
    ('WRITE_NOTICE', 'POST_CREATE'),
    ('WRITE_NOTICE', 'POST_OFFICIAL'),
    ('WRITE_NOTICE', 'POST_ANNOUNCEMENT'),
    ('WRITE_GENERAL', 'POST_CREATE'),
    ('WRITE_REPLY', 'MANAGE_SUGGESTION_REPLY'),
    ('WRITE_REPLY', 'POST_OFFICIAL'),
    ('MANAGE_SURVEY', 'MANAGE_SURVEY'),
    ('MANAGE_SURVEY', 'MANAGE_POLL'),
    ('MANAGE_FINANCE', 'MANAGE_FINANCE'),
    ('MANAGE_CONTENT', 'MANAGE_SITE_CONTENT'),
    ('MANAGE_CONTENT', 'MANAGE_CALENDAR'),
    ('MANAGE_CONTENT', 'VIEW_CONTACTS'),
    ('MANAGE_CONTENT', 'MANAGE_CONTACTS'),
    ('MODERATOR', 'VIEW_SECRET_POST'),
    ('MODERATOR', 'MODERATE_POST_COMMENT'),
    ('EXECUTIVE', 'POST_CREATE'),
    ('EXECUTIVE', 'POST_OFFICIAL'),
    ('ADMIN', 'POST_CREATE'),
    ('ADMIN', 'POST_OFFICIAL'),
    ('ADMIN', 'POST_ANNOUNCEMENT'),
    ('ADMIN', 'VIEW_SECRET_POST'),
    ('ADMIN', 'COMMENT_CREATE'),
    ('ADMIN', 'MODERATE_POST_COMMENT'),
    ('ADMIN', 'MANAGE_SUGGESTION_REPLY'),
    ('ADMIN', 'MANAGE_BOARD_SETTINGS'),
    ('ADMIN', 'MANAGE_PERMISSIONS'),
    ('ADMIN', 'MANAGE_FINANCE'),
    ('ADMIN', 'MANAGE_SITE_CONTENT'),
    ('ADMIN', 'MANAGE_POLL'),
    ('ADMIN', 'VIEW_USERS'),
    ('ADMIN', 'MANAGE_USERS'),
    ('ADMIN', 'VIEW_CONTACTS'),
    ('ADMIN', 'MANAGE_CONTACTS'),
    ('ADMIN', 'SEND_EMAIL'),
    ('ADMIN', 'MANAGE_SURVEY'),
    ('ADMIN', 'MANAGE_CALENDAR'),
    ('ADMIN', 'VIEW_AUDIT_LOG'),
    ('ADMIN', 'SUPER_ADMIN')
)
INSERT INTO "role_group_permission" ("role_group_id", "permission_id")
SELECT old_assignment.role_group_id, new_permission.permission_id
FROM "role_group_permission" AS old_assignment
JOIN "permission" AS old_permission
  ON old_permission.permission_id = old_assignment.permission_id
JOIN legacy_to_atomic
  ON legacy_to_atomic.old_code = old_permission.code
JOIN "permission" AS new_permission
  ON new_permission.code = legacy_to_atomic.new_code
ON CONFLICT DO NOTHING;
--> statement-breakpoint
UPDATE "permission"
SET "is_active" = false
WHERE "code" IN (
  'WRITE_NOTICE', 'WRITE_GENERAL', 'WRITE_REPLY',
  'MANAGE_CONTENT', 'MANAGE_TOOL', 'MODERATOR',
  'ADMIN', 'EXECUTIVE'
);
