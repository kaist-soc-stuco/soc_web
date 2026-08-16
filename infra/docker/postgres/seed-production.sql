BEGIN;

-- Production seed is deliberately limited to non-personal reference data.
-- It must never create a user, grant permissions to a user, delete rows, or
-- overwrite content managed by an operator. The migration history also
-- contains these inserts for fresh databases; this file makes an explicit,
-- repeatable release step available for existing installations.

INSERT INTO permission_definitions (key, description, is_active)
VALUES
  ('FAQ_MANAGE', 'Manage FAQ topics and entries', true),
  ('EVENT_MANAGE', 'Manage calendar events', true),
  ('BOARD_MANAGE', 'Manage boards and moderate board content', true),
  ('COMMITTEE_MEMBER', 'Access committee-scoped content', true),
  ('PERMISSION_GRANT', 'Request scoped permission grants', true),
  ('PERMISSION_REVOKE', 'Request scoped permission revocations', true),
  ('PERMISSION_APPROVE', 'Approve scoped permission changes', true),
  ('PERMISSION_ACTIVATE', 'Activate approved scoped permission changes', true),
  ('PERMISSION_AUDIT', 'Read minimized permission audit events', true),
  ('USERS_MANAGE', 'Read administrative user projections', true),
  ('FEES_MANAGE', 'Read and update fee status', true),
  ('CONTACTS_MANAGE', 'Manage encrypted administrative contacts', true),
  ('MAIL_SEND', 'Send provider-gated administrative mail', true),
  ('SURVEY_MANAGE', 'Create, revise, publish, and match surveys', true),
  ('SURVEY_REVIEW', 'Review, aggregate, and export survey responses', true),
  ('VOTE_MANAGE', 'Create, administer, close, and publish votes', true),
  ('PLEDGE_MANAGE', 'Manage pledge progress and public status board', true)
ON CONFLICT (key) DO NOTHING;

INSERT INTO boards (
  code, title_kr, title_en, description_kr, description_en,
  read_permission, write_permission, comment_permission,
  comments_allowed, secret_articles_allowed, reactions_allowed,
  display_order, is_hidden, show_on_home
)
VALUES
  ('soc-notice', '집행위 공지', 'Committee Notices', '학생회 집행위원회 공지사항', 'Student council committee notices', 'PUBLIC', 'COMMITTEE', 'AUTHENTICATED', true, false, true, 10, false, true),
  ('soc-events', '집행위 행사', 'Committee Events', '학생회 집행위원회 행사 소식', 'Student council committee events', 'PUBLIC', 'COMMITTEE', 'AUTHENTICATED', true, false, true, 20, false, true),
  ('human-of-cs', 'Human of CS', 'Human of CS', '전산학부 구성원 이야기', 'Stories from the School of Computing community', 'PUBLIC', 'COMMITTEE', 'AUTHENTICATED', true, false, true, 30, false, true),
  ('external-promotion', '외부 홍보 글', 'External Promotions', '외부 행사와 프로그램 홍보', 'External events and program promotions', 'PUBLIC', 'COMMITTEE', 'AUTHENTICATED', true, false, true, 40, false, true),
  ('suggestions', '건의 사항', 'Suggestions', '학생회에 전달하는 건의 사항', 'Suggestions for the student council', 'PUBLIC', 'AUTHENTICATED', 'AUTHENTICATED', true, true, true, 50, false, true),
  ('laboratories', '연구실', 'Laboratories', '전산학부 연구실 소식', 'School of Computing laboratory news', 'PUBLIC', 'COMMITTEE', 'AUTHENTICATED', true, false, true, 60, false, true),
  ('escamp', 'ESCamp', 'ESCamp', 'ESCamp 관련 공지와 이야기', 'ESCamp notices and stories', 'PUBLIC', 'COMMITTEE', 'AUTHENTICATED', true, false, true, 70, false, true)
ON CONFLICT DO NOTHING;

COMMIT;
