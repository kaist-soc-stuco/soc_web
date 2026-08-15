BEGIN;

INSERT INTO boards (
  code,
  title_kr,
  title_en,
  description_kr,
  description_en,
  read_permission,
  write_permission,
  comment_permission,
  comments_allowed,
  secret_articles_allowed,
  reactions_allowed,
  display_order,
  is_hidden,
  show_on_home
)
VALUES
  ('soc-notice', '공지', 'Notices', '학생회 집행위원회 공지사항', 'Student council notices', 'PUBLIC', 'COMMITTEE', 'AUTHENTICATED', true, false, true, 10, false, true),
  ('soc-events', '행사', 'Events', '학생회 집행위원회 행사 소식', 'Student council events', 'PUBLIC', 'COMMITTEE', 'AUTHENTICATED', true, false, true, 20, false, true),
  ('human-of-cs', 'HoC', 'HoC', '전산학부 구성원 이야기', 'Stories from the School of Computing', 'PUBLIC', 'COMMITTEE', 'AUTHENTICATED', true, false, true, 30, false, true),
  ('external-promotion', '홍보글', 'Promotions', '외부 행사와 프로그램 홍보', 'External events and programs', 'PUBLIC', 'COMMITTEE', 'AUTHENTICATED', true, false, true, 40, false, true),
  ('suggestions', '건의사항 및 QnA', 'Suggestions and Q&A', '학생회에 전달하는 건의 사항', 'Suggestions for the student council', 'PUBLIC', 'AUTHENTICATED', 'AUTHENTICATED', true, true, true, 50, false, true),
  ('laboratories', '연구실', 'Laboratories', '전산학부 연구실 소식', 'School of Computing laboratory news', 'PUBLIC', 'COMMITTEE', 'AUTHENTICATED', true, false, true, 60, false, true),
  ('escamp', 'ESCamp', 'ESCamp', 'ESCamp 관련 공지와 이야기', 'ESCamp news and stories', 'PUBLIC', 'COMMITTEE', 'AUTHENTICATED', true, false, true, 70, false, true)
ON CONFLICT (code) DO UPDATE
SET title_kr = EXCLUDED.title_kr,
    title_en = EXCLUDED.title_en,
    description_kr = EXCLUDED.description_kr,
    description_en = EXCLUDED.description_en,
    read_permission = EXCLUDED.read_permission,
    write_permission = EXCLUDED.write_permission,
    comment_permission = EXCLUDED.comment_permission,
    comments_allowed = EXCLUDED.comments_allowed,
    secret_articles_allowed = EXCLUDED.secret_articles_allowed,
    reactions_allowed = EXCLUDED.reactions_allowed,
    display_order = EXCLUDED.display_order,
    is_hidden = EXCLUDED.is_hidden,
    show_on_home = EXCLUDED.show_on_home,
    updated_at = NOW();

INSERT INTO articles (
  id,
  board_id,
  public_no,
  author_user_id,
  title_kr,
  title_en,
  body_kr,
  body_en,
  status,
  scope,
  is_pinned,
  pinned_order,
  published_at
)
SELECT
  'a1111111-1111-4111-8111-111111111111',
  board.id,
  1,
  admin.id,
  '[Codex 기능검증] 사이트 점검 안내',
  '[Codex verification] Site check notice',
  '최신 로컬 환경의 게시판 기능을 확인하기 위한 테스트 공지입니다.',
  'A test notice for verifying the latest local board functionality.',
  'PUBLISHED',
  'ALL',
  false,
  NULL,
  TIMESTAMPTZ '2026-08-05 16:00:00+09'
FROM boards AS board
JOIN users AS admin ON admin.sso_user_id = 'development-admin'
WHERE board.code = 'soc-notice'
ON CONFLICT (id) DO UPDATE
SET board_id = EXCLUDED.board_id,
    public_no = EXCLUDED.public_no,
    author_user_id = EXCLUDED.author_user_id,
    title_kr = EXCLUDED.title_kr,
    title_en = EXCLUDED.title_en,
    body_kr = EXCLUDED.body_kr,
    body_en = EXCLUDED.body_en,
    status = 'PUBLISHED',
    scope = 'ALL',
    is_pinned = false,
    pinned_order = NULL,
    published_at = COALESCE(articles.published_at, EXCLUDED.published_at),
    deleted_at = NULL,
    purge_after = NULL,
    updated_at = NOW();

INSERT INTO article_reactions (article_id, user_id, type)
SELECT article.id, user_row.id, 'LIKE'
FROM articles AS article
JOIN users AS user_row ON user_row.sso_user_id = 'development-user-1'
WHERE article.id = 'a1111111-1111-4111-8111-111111111111'
ON CONFLICT (article_id, user_id) DO NOTHING;

INSERT INTO comments (id, article_id, author_user_id, body, status)
SELECT
  'f7777777-7777-4777-8777-777777777777',
  article.id,
  admin.id,
  '[Codex 기능검증] 댓글 작성 테스트',
  'PUBLISHED'
FROM articles AS article
JOIN users AS admin ON admin.sso_user_id = 'development-admin'
WHERE article.id = 'a1111111-1111-4111-8111-111111111111'
ON CONFLICT (id) DO NOTHING;

-- Always-on development fixtures: several boards and notices make pagination, links, and permissions observable.
INSERT INTO articles (
  id, board_id, public_no, author_user_id, title_kr, title_en, body_kr, body_en,
  status, scope, is_pinned, pinned_order, published_at
)
SELECT
  fixture.id, board.id, fixture.public_no, admin.id, fixture.title_kr, fixture.title_en,
  fixture.body_kr, fixture.body_en, 'PUBLISHED', 'ALL', false, NULL, fixture.published_at
FROM (VALUES
  ('a1111111-1111-4111-8111-111111111112'::uuid, 'soc-notice', 2, '[Mock] 2학기 운영 공지', '[Mock] Fall term operations notice', '[Mock] 게시판 번호와 상세 링크를 확인하기 위한 두 번째 공지입니다.', '[Mock] A second notice for checking public numbers and detail links.', TIMESTAMPTZ '2026-08-06 10:00:00+09'),
  ('a1111111-1111-4111-8111-111111111113'::uuid, 'soc-events', 1, '[Mock] 개강 간담회 안내', '[Mock] Term-opening town hall', '[Mock] 행사와 게시글 연결을 확인하기 위한 테스트 게시글입니다.', '[Mock] A post for checking event and article navigation.', TIMESTAMPTZ '2026-08-07 10:00:00+09'),
  ('a1111111-1111-4111-8111-111111111114'::uuid, 'external-promotion', 1, '[Mock] 외부 프로그램 홍보', '[Mock] External program promotion', '[Mock] 홍보 게시판 표시를 확인하기 위한 테스트 게시글입니다.', '[Mock] A post for checking the promotions board.', TIMESTAMPTZ '2026-08-07 11:00:00+09')
) AS fixture(id, code, public_no, title_kr, title_en, body_kr, body_en, published_at)
JOIN boards AS board ON board.code = fixture.code
JOIN users AS admin ON admin.sso_user_id = 'development-admin'
ON CONFLICT (id) DO UPDATE SET
  board_id = EXCLUDED.board_id,
  public_no = EXCLUDED.public_no,
  author_user_id = EXCLUDED.author_user_id,
  title_kr = EXCLUDED.title_kr,
  title_en = EXCLUDED.title_en,
  body_kr = EXCLUDED.body_kr,
  body_en = EXCLUDED.body_en,
  status = 'PUBLISHED',
  scope = 'ALL',
  is_pinned = false,
  pinned_order = NULL,
  published_at = EXCLUDED.published_at,
  deleted_at = NULL,
  purge_after = NULL,
  updated_at = NOW();

INSERT INTO articles (
  id, board_id, public_no, author_user_id, title_kr, title_en, body_kr, body_en,
  status, scope, is_pinned, pinned_order, published_at
)
SELECT
  fixture.id, board.id, fixture.public_no, admin.id, fixture.title_kr, fixture.title_en,
  fixture.body_kr, fixture.body_en, 'PUBLISHED', 'ALL', false, NULL, fixture.published_at
FROM (VALUES
  ('a1111111-1111-4111-8111-111111111115'::uuid, 'soc-notice', 3, '[Mock] Homepage notice layout QA', '[Mock] Homepage notice layout QA', '[Mock] Extra notice for checking multi-row homepage lists.', '[Mock] Extra notice for checking multi-row homepage lists.', TIMESTAMPTZ '2026-08-08 09:00:00+09'),
  ('a1111111-1111-4111-8111-111111111116'::uuid, 'soc-notice', 4, '[Mock] Scholarship application reminder', '[Mock] Scholarship application reminder', '[Mock] Extra notice for spacing and date alignment.', '[Mock] Extra notice for spacing and date alignment.', TIMESTAMPTZ '2026-08-09 09:00:00+09'),
  ('a1111111-1111-4111-8111-111111111117'::uuid, 'soc-notice', 5, '[Mock] Lab tour registration open', '[Mock] Lab tour registration open', '[Mock] Extra notice for list density checks.', '[Mock] Extra notice for list density checks.', TIMESTAMPTZ '2026-08-10 09:00:00+09'),
  ('a1111111-1111-4111-8111-111111111118'::uuid, 'soc-events', 2, '[Mock] Coffee chat signup', '[Mock] Coffee chat signup', '[Mock] Extra event-board article for tab switching.', '[Mock] Extra event-board article for tab switching.', TIMESTAMPTZ '2026-08-08 12:00:00+09'),
  ('a1111111-1111-4111-8111-111111111119'::uuid, 'soc-events', 3, '[Mock] Seminar volunteer call', '[Mock] Seminar volunteer call', '[Mock] Extra event-board article for list rendering.', '[Mock] Extra event-board article for list rendering.', TIMESTAMPTZ '2026-08-09 12:00:00+09'),
  ('a1111111-1111-4111-8111-11111111111a'::uuid, 'suggestions', 1, '[Mock] Q&A board sample question', '[Mock] Q&A board sample question', '[Mock] Extra suggestion-board article for empty-state avoidance.', '[Mock] Extra suggestion-board article for empty-state avoidance.', TIMESTAMPTZ '2026-08-08 15:00:00+09')
) AS fixture(id, code, public_no, title_kr, title_en, body_kr, body_en, published_at)
JOIN boards AS board ON board.code = fixture.code
JOIN users AS admin ON admin.sso_user_id = 'development-admin'
ON CONFLICT (id) DO UPDATE SET
  board_id = EXCLUDED.board_id,
  public_no = EXCLUDED.public_no,
  author_user_id = EXCLUDED.author_user_id,
  title_kr = EXCLUDED.title_kr,
  title_en = EXCLUDED.title_en,
  body_kr = EXCLUDED.body_kr,
  body_en = EXCLUDED.body_en,
  status = 'PUBLISHED',
  scope = 'ALL',
  is_pinned = false,
  pinned_order = NULL,
  published_at = EXCLUDED.published_at,
  deleted_at = NULL,
  purge_after = NULL,
  updated_at = NOW();

-- Notice board pagination fixtures: 15 public notices make the page controls visible with a 10-row list.
INSERT INTO articles (
  id, board_id, public_no, author_user_id, title_kr, title_en, body_kr, body_en,
  status, scope, is_pinned, pinned_order, published_at
)
SELECT
  fixture.id, board.id, fixture.public_no, admin.id, fixture.title_kr, fixture.title_en,
  fixture.body_kr, fixture.body_en, 'PUBLISHED', 'ALL', false, NULL, fixture.published_at
FROM (VALUES
  ('a1111111-1111-4111-8111-11111111111b'::uuid, 'soc-notice', 6, '[Mock] 공지 게시판 페이지네이션 QA 06', '[Mock] Notice pagination QA 06', '[Mock] 공지 게시판 두 번째 페이지 이동을 확인하기 위한 테스트 게시글입니다.', '[Mock] Test notice for checking the second page of the notice board.', TIMESTAMPTZ '2026-08-11 09:00:00+09'),
  ('a1111111-1111-4111-8111-11111111111c'::uuid, 'soc-notice', 7, '[Mock] 공지 게시판 페이지네이션 QA 07', '[Mock] Notice pagination QA 07', '[Mock] 공지 게시판 행 간격과 번호 표시를 확인합니다.', '[Mock] Test notice for row spacing and public number rendering.', TIMESTAMPTZ '2026-08-12 09:00:00+09'),
  ('a1111111-1111-4111-8111-11111111111d'::uuid, 'soc-notice', 8, '[Mock] 공지 게시판 페이지네이션 QA 08', '[Mock] Notice pagination QA 08', '[Mock] 공지 게시판 목록 hover 상태를 확인합니다.', '[Mock] Test notice for list hover state rendering.', TIMESTAMPTZ '2026-08-13 09:00:00+09'),
  ('a1111111-1111-4111-8111-11111111111e'::uuid, 'soc-notice', 9, '[Mock] 공지 게시판 페이지네이션 QA 09', '[Mock] Notice pagination QA 09', '[Mock] 공지 게시판 날짜 정렬을 확인합니다.', '[Mock] Test notice for date alignment.', TIMESTAMPTZ '2026-08-14 09:00:00+09'),
  ('a1111111-1111-4111-8111-11111111111f'::uuid, 'soc-notice', 10, '[Mock] 공지 게시판 페이지네이션 QA 10', '[Mock] Notice pagination QA 10', '[Mock] 첫 페이지 마지막 행의 표시 상태를 확인합니다.', '[Mock] Test notice for the final row of the first page.', TIMESTAMPTZ '2026-08-15 09:00:00+09'),
  ('a1111111-1111-4111-8111-111111111120'::uuid, 'soc-notice', 11, '[Mock] 공지 게시판 페이지네이션 QA 11', '[Mock] Notice pagination QA 11', '[Mock] 두 번째 페이지 첫 행의 표시 상태를 확인합니다.', '[Mock] Test notice for the first row of the second page.', TIMESTAMPTZ '2026-08-16 09:00:00+09'),
  ('a1111111-1111-4111-8111-111111111121'::uuid, 'soc-notice', 12, '[Mock] 공지 게시판 페이지네이션 QA 12', '[Mock] Notice pagination QA 12', '[Mock] 페이지 이동 후 리스트 폭을 확인합니다.', '[Mock] Test notice for list width after pagination.', TIMESTAMPTZ '2026-08-17 09:00:00+09'),
  ('a1111111-1111-4111-8111-111111111122'::uuid, 'soc-notice', 13, '[Mock] 공지 게시판 페이지네이션 QA 13', '[Mock] Notice pagination QA 13', '[Mock] 페이지 이동 후 탭 위치를 확인합니다.', '[Mock] Test notice for tab position after pagination.', TIMESTAMPTZ '2026-08-18 09:00:00+09'),
  ('a1111111-1111-4111-8111-111111111123'::uuid, 'soc-notice', 14, '[Mock] 공지 게시판 페이지네이션 QA 14', '[Mock] Notice pagination QA 14', '[Mock] 페이지 이동 후 검색 영역 위치를 확인합니다.', '[Mock] Test notice for search position after pagination.', TIMESTAMPTZ '2026-08-19 09:00:00+09'),
  ('a1111111-1111-4111-8111-111111111124'::uuid, 'soc-notice', 15, '[Mock] 공지 게시판 페이지네이션 QA 15', '[Mock] Notice pagination QA 15', '[Mock] 두 번째 페이지 마지막 행의 표시 상태를 확인합니다.', '[Mock] Test notice for the final row of the second page.', TIMESTAMPTZ '2026-08-20 09:00:00+09')
) AS fixture(id, code, public_no, title_kr, title_en, body_kr, body_en, published_at)
JOIN boards AS board ON board.code = fixture.code
JOIN users AS admin ON admin.sso_user_id = 'development-admin'
ON CONFLICT (id) DO UPDATE SET
  board_id = EXCLUDED.board_id,
  public_no = EXCLUDED.public_no,
  author_user_id = EXCLUDED.author_user_id,
  title_kr = EXCLUDED.title_kr,
  title_en = EXCLUDED.title_en,
  body_kr = EXCLUDED.body_kr,
  body_en = EXCLUDED.body_en,
  status = 'PUBLISHED',
  scope = 'ALL',
  is_pinned = false,
  pinned_order = NULL,
  published_at = EXCLUDED.published_at,
  deleted_at = NULL,
  purge_after = NULL,
  updated_at = NOW();

INSERT INTO events (
  id,
  title_kr,
  title_en,
  description_kr,
  description_en,
  start_at,
  end_at,
  all_day,
  all_day_start_date,
  all_day_end_date,
  location,
  visibility,
  created_by_user_id,
  updated_by_user_id
)
SELECT
  'b2222222-2222-4222-8222-222222222222',
  '[Codex 기능검증] 개발자 간담회',
  '[Codex verification] Developer meetup',
  '행사 목록과 캘린더 표시를 확인하기 위한 테스트 행사입니다.',
  'A test event for verifying the event list and calendar.',
  TIMESTAMPTZ '2026-08-12 09:00:00+09',
  TIMESTAMPTZ '2026-08-12 10:30:00+09',
  false,
  NULL,
  NULL,
  'N5 101호',
  'PUBLIC',
  admin.id,
  admin.id
FROM users AS admin
WHERE admin.sso_user_id = 'development-admin'
ON CONFLICT (id) DO UPDATE
SET title_kr = EXCLUDED.title_kr,
    title_en = EXCLUDED.title_en,
    description_kr = EXCLUDED.description_kr,
    description_en = EXCLUDED.description_en,
    start_at = EXCLUDED.start_at,
    end_at = EXCLUDED.end_at,
    all_day = false,
    all_day_start_date = NULL,
    all_day_end_date = NULL,
    location = EXCLUDED.location,
    visibility = 'PUBLIC',
    updated_by_user_id = EXCLUDED.updated_by_user_id,
    updated_at = NOW();

INSERT INTO events (
  id, title_kr, title_en, description_kr, description_en, start_at, end_at,
  all_day, all_day_start_date, all_day_end_date, location, visibility,
  created_by_user_id, updated_by_user_id
)
SELECT fixture.id, fixture.title_kr, fixture.title_en, fixture.description_kr, fixture.description_en,
  fixture.start_at, fixture.end_at, false, NULL, NULL, fixture.location, 'PUBLIC', admin.id, admin.id
FROM (VALUES
  ('b2222222-2222-4222-8222-222222222223'::uuid, '[Mock] 개강 간담회', '[Mock] Term-opening town hall', '[Mock] 행사 목록과 캘린더 표시를 확인합니다.', '[Mock] Check event list and calendar rendering.', TIMESTAMPTZ '2026-08-20 18:00:00+09', TIMESTAMPTZ '2026-08-20 19:30:00+09', 'N5 101'),
  ('b2222222-2222-4222-8222-222222222224'::uuid, '[Mock] 학생회 업무 설명회', '[Mock] Student council briefing', '[Mock] 앞으로의 운영 계획을 소개합니다.', '[Mock] An event for the governance navigation flow.', TIMESTAMPTZ '2026-09-02 12:00:00+09', TIMESTAMPTZ '2026-09-02 13:00:00+09', 'Online')
) AS fixture(id, title_kr, title_en, description_kr, description_en, start_at, end_at, location)
CROSS JOIN users AS admin
WHERE admin.sso_user_id = 'development-admin'
ON CONFLICT (id) DO UPDATE SET
  title_kr = EXCLUDED.title_kr,
  title_en = EXCLUDED.title_en,
  description_kr = EXCLUDED.description_kr,
  description_en = EXCLUDED.description_en,
  start_at = EXCLUDED.start_at,
  end_at = EXCLUDED.end_at,
  location = EXCLUDED.location,
  visibility = 'PUBLIC',
  updated_by_user_id = EXCLUDED.updated_by_user_id,
  updated_at = NOW();

-- Additional event cards for pagination QA.
INSERT INTO events (
  id, title_kr, title_en, description_kr, description_en, start_at, end_at,
  all_day, all_day_start_date, all_day_end_date, location, visibility,
  created_by_user_id, updated_by_user_id
)
SELECT
  ('b2222222-2222-4222-8222-' || lpad((222222222226 + n)::text, 12, '0'))::uuid,
  '[Mock] 카드 페이지네이션 행사 ' || lpad(n::text, 2, '0'),
  '[Mock] Card pagination event ' || lpad(n::text, 2, '0'),
  '행사 카드 목록의 5열 2행 페이지네이션을 확인하기 위한 테스트 행사입니다.',
  'A test event for checking the 5 by 2 card pagination layout.',
  TIMESTAMPTZ '2026-08-21 12:00:00+09' + (n || ' days')::interval,
  TIMESTAMPTZ '2026-08-21 13:30:00+09' + (n || ' days')::interval,
  false,
  NULL,
  NULL,
  'N5 ' || (100 + n)::text,
  'PUBLIC',
  admin.id,
  admin.id
FROM generate_series(1, 12) AS series(n)
CROSS JOIN users AS admin
WHERE admin.sso_user_id = 'development-admin'
ON CONFLICT (id) DO UPDATE SET
  title_kr = EXCLUDED.title_kr,
  title_en = EXCLUDED.title_en,
  description_kr = EXCLUDED.description_kr,
  description_en = EXCLUDED.description_en,
  start_at = EXCLUDED.start_at,
  end_at = EXCLUDED.end_at,
  all_day = false,
  all_day_start_date = NULL,
  all_day_end_date = NULL,
  location = EXCLUDED.location,
  visibility = 'PUBLIC',
  updated_by_user_id = EXCLUDED.updated_by_user_id,
  updated_at = NOW();

INSERT INTO faq_topics (id, title_kr, title_en, display_order, created_by_user_id, updated_by_user_id)
SELECT
  'c3333333-3333-4333-8333-333333333333',
  '[Codex 기능검증] 이용 안내',
  '[Codex verification] Usage guide',
  0,
  admin.id,
  admin.id
FROM users AS admin
WHERE admin.sso_user_id = 'development-admin'
ON CONFLICT (id) DO UPDATE
SET title_kr = EXCLUDED.title_kr,
    title_en = EXCLUDED.title_en,
    display_order = EXCLUDED.display_order,
    updated_by_user_id = EXCLUDED.updated_by_user_id,
    updated_at = NOW();

INSERT INTO faqs (
  id,
  topic_id,
  question_kr,
  question_en,
  answer_kr,
  answer_en,
  display_order,
  status,
  created_by_user_id,
  updated_by_user_id
)
SELECT
  'd4444444-4444-4444-8444-444444444444',
  topic.id,
  '테스트 FAQ가 보이나요?',
  'Can you see the test FAQ?',
  '네, 기능 검증용으로 등록된 FAQ입니다.',
  'Yes. This FAQ was added for functional verification.',
  0,
  'PUBLISHED',
  admin.id,
  admin.id
FROM faq_topics AS topic
JOIN users AS admin ON admin.sso_user_id = 'development-admin'
WHERE topic.id = 'c3333333-3333-4333-8333-333333333333'
ON CONFLICT (id) DO UPDATE
SET topic_id = EXCLUDED.topic_id,
    question_kr = EXCLUDED.question_kr,
    question_en = EXCLUDED.question_en,
    answer_kr = EXCLUDED.answer_kr,
    answer_en = EXCLUDED.answer_en,
    display_order = EXCLUDED.display_order,
    status = 'PUBLISHED',
    updated_by_user_id = EXCLUDED.updated_by_user_id,
    updated_at = NOW();

INSERT INTO surveys (
  id,
  state,
  current_revision,
  definition_version,
  guest_allowed,
  only_for_korean_speaker,
  phone_required,
  fee_restriction,
  cap,
  opens_at,
  closes_at,
  edit_deadline_at,
  response_retention_days,
  created_by_user_id,
  updated_by_user_id
)
SELECT
  'e6666666-6666-4666-8666-666666666666',
  'DRAFT',
  1,
  1,
  true,
  false,
  false,
  'ANY',
  NULL,
  TIMESTAMPTZ '2026-08-01 00:00:00+09',
  TIMESTAMPTZ '2026-12-31 23:59:59+09',
  TIMESTAMPTZ '2026-12-31 23:59:59+09',
  30,
  admin.id,
  admin.id
FROM users AS admin
WHERE admin.sso_user_id = 'development-admin'
ON CONFLICT (id) DO NOTHING;

INSERT INTO survey_revisions (
  id,
  survey_id,
  revision,
  title_kr,
  title_en,
  description_kr,
  description_en,
  created_by_user_id,
  published_at
)
SELECT
  'e6666666-6666-4666-8666-666666666667',
  survey.id,
  1,
  '[Codex 기능검증] 컴퓨팅 전공 설문',
  '[Codex verification] Computing survey',
  '설문 목록·상세·응답 제출·관리자 응답 확인을 점검하는 테스트 설문입니다.',
  'A test survey for verifying listing, detail, submission, and admin review.',
  admin.id,
  NULL
FROM surveys AS survey
JOIN users AS admin ON admin.sso_user_id = 'development-admin'
WHERE survey.id = 'e6666666-6666-4666-8666-666666666666'
  AND NOT EXISTS (
    SELECT 1
    FROM survey_revisions AS existing
    WHERE existing.id = 'e6666666-6666-4666-8666-666666666667'
  )
ON CONFLICT (id) DO NOTHING;

INSERT INTO survey_sections (id, survey_revision_id, ordinal, title_kr, title_en)
SELECT
  'e6666666-6666-4666-8666-666666666668',
  'e6666666-6666-4666-8666-666666666667',
  0,
  '기본 의견',
  'General feedback'
WHERE NOT EXISTS (
  SELECT 1
  FROM survey_sections AS existing
  WHERE existing.id = 'e6666666-6666-4666-8666-666666666668'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO survey_questions (id, section_id, ordinal, type, prompt_kr, prompt_en, required, number_min, number_max)
SELECT
  'e6666666-6666-4666-8666-666666666669',
  'e6666666-6666-4666-8666-666666666668',
  0,
  'SHORT_TEXT',
  '가장 유용한 기능은 무엇인가요?',
  'Which feature is most useful?',
  true,
  NULL,
  NULL
WHERE NOT EXISTS (
  SELECT 1
  FROM survey_questions AS existing
  WHERE existing.id = 'e6666666-6666-4666-8666-666666666669'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO survey_questions (id, section_id, ordinal, type, prompt_kr, prompt_en, required, number_min, number_max)
SELECT
  'e6666666-6666-4666-8666-66666666666a',
  'e6666666-6666-4666-8666-666666666668',
  1,
  'SINGLE_CHOICE',
  '사이트 사용 빈도는 어느 정도인가요?',
  'How often do you use the site?',
  true,
  NULL,
  NULL
WHERE NOT EXISTS (
  SELECT 1
  FROM survey_questions AS existing
  WHERE existing.id = 'e6666666-6666-4666-8666-66666666666a'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO survey_questions (id, section_id, ordinal, type, prompt_kr, prompt_en, required, number_min, number_max)
SELECT
  'e6666666-6666-4666-8666-66666666666b',
  'e6666666-6666-4666-8666-666666666668',
  2,
  'NUMBER',
  '만족도를 1에서 5로 평가해 주세요.',
  'Rate your satisfaction from 1 to 5.',
  false,
  1,
  5
WHERE NOT EXISTS (
  SELECT 1
  FROM survey_questions AS existing
  WHERE existing.id = 'e6666666-6666-4666-8666-66666666666b'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO survey_choice_options (id, question_id, ordinal, value_kr, value_en)
SELECT
  'e6666666-6666-4666-8666-66666666666c',
  'e6666666-6666-4666-8666-66666666666a',
  0,
  '매일',
  'Daily'
WHERE NOT EXISTS (
  SELECT 1
  FROM survey_choice_options AS existing
  WHERE existing.id = 'e6666666-6666-4666-8666-66666666666c'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO survey_choice_options (id, question_id, ordinal, value_kr, value_en)
SELECT
  'e6666666-6666-4666-8666-66666666666d',
  'e6666666-6666-4666-8666-66666666666a',
  1,
  '가끔',
  'Sometimes'
WHERE NOT EXISTS (
  SELECT 1
  FROM survey_choice_options AS existing
  WHERE existing.id = 'e6666666-6666-4666-8666-66666666666d'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO survey_section_items (id, section_id, ordinal, kind, question_id)
SELECT
  'e6666666-6666-4666-8666-66666666666e',
  'e6666666-6666-4666-8666-666666666668',
  0,
  'QUESTION',
  'e6666666-6666-4666-8666-666666666669'
WHERE NOT EXISTS (
  SELECT 1
  FROM survey_section_items AS existing
  WHERE existing.id = 'e6666666-6666-4666-8666-66666666666e'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO survey_section_items (id, section_id, ordinal, kind, question_id)
SELECT
  'e6666666-6666-4666-8666-66666666666f',
  'e6666666-6666-4666-8666-666666666668',
  1,
  'QUESTION',
  'e6666666-6666-4666-8666-66666666666a'
WHERE NOT EXISTS (
  SELECT 1
  FROM survey_section_items AS existing
  WHERE existing.id = 'e6666666-6666-4666-8666-66666666666f'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO survey_section_items (id, section_id, ordinal, kind, question_id)
SELECT
  'e6666666-6666-4666-8666-666666666670',
  'e6666666-6666-4666-8666-666666666668',
  2,
  'QUESTION',
  'e6666666-6666-4666-8666-66666666666b'
WHERE NOT EXISTS (
  SELECT 1
  FROM survey_section_items AS existing
  WHERE existing.id = 'e6666666-6666-4666-8666-666666666670'
)
ON CONFLICT (id) DO NOTHING;

UPDATE survey_revisions
SET published_at = TIMESTAMPTZ '2026-08-05 16:00:00+09'
WHERE id = 'e6666666-6666-4666-8666-666666666667'
  AND published_at IS NULL;

UPDATE surveys
SET state = 'OPEN',
    updated_at = NOW()
WHERE id = 'e6666666-6666-4666-8666-666666666666'
  AND state = 'DRAFT';

INSERT INTO survey_responses (
  id,
  survey_id,
  survey_revision_id,
  campus_user_id,
  state,
  submitted_at,
  reviewed_at,
  reviewed_by_user_id,
  retention_deadline_at
)
SELECT
  'e6666666-6666-4666-8666-666666666671',
  'e6666666-6666-4666-8666-666666666666',
  'e6666666-6666-4666-8666-666666666667',
  respondent.id,
  'APPROVED',
  TIMESTAMPTZ '2026-08-05 16:05:00+09',
  TIMESTAMPTZ '2026-08-05 16:10:00+09',
  admin.id,
  TIMESTAMPTZ '2027-01-30 23:59:59+09'
FROM users AS respondent
JOIN users AS admin ON admin.sso_user_id = 'development-admin'
WHERE respondent.sso_user_id = 'development-user-1'
ON CONFLICT (id) DO NOTHING;

INSERT INTO survey_response_answers (response_id, question_id, text_value)
VALUES (
  'e6666666-6666-4666-8666-666666666671',
  'e6666666-6666-4666-8666-666666666669',
  '게시판과 설문 기능'
)
ON CONFLICT (response_id, question_id) DO NOTHING;

INSERT INTO survey_response_answers (response_id, question_id, choice_option_ids)
VALUES (
  'e6666666-6666-4666-8666-666666666671',
  'e6666666-6666-4666-8666-66666666666a',
  '["e6666666-6666-4666-8666-66666666666c"]'
)
ON CONFLICT (response_id, question_id) DO NOTHING;

INSERT INTO survey_response_answers (response_id, question_id, number_value)
VALUES (
  'e6666666-6666-4666-8666-666666666671',
  'e6666666-6666-4666-8666-66666666666b',
  5
)
ON CONFLICT (response_id, question_id) DO NOTHING;

-- A second scheduled survey keeps the public tab useful before and after the first fixture closes.
INSERT INTO surveys (
  id, state, current_revision, definition_version, guest_allowed, only_for_korean_speaker,
  phone_required, fee_restriction, cap, opens_at, closes_at, edit_deadline_at,
  response_retention_days, created_by_user_id, updated_by_user_id
)
SELECT
  'f6666666-6666-4666-8666-666666666666', 'SCHEDULED', 1, 1, true, false,
  false, 'ANY', NULL, TIMESTAMPTZ '2026-08-15 00:00:00+09', TIMESTAMPTZ '2026-09-30 23:59:59+09', TIMESTAMPTZ '2026-09-30 23:59:59+09',
  30, admin.id, admin.id
FROM users AS admin
WHERE admin.sso_user_id = 'development-admin'
ON CONFLICT (id) DO UPDATE SET
  state = 'SCHEDULED',
  opens_at = EXCLUDED.opens_at,
  closes_at = EXCLUDED.closes_at,
  edit_deadline_at = EXCLUDED.edit_deadline_at,
  updated_by_user_id = EXCLUDED.updated_by_user_id,
  updated_at = NOW();

INSERT INTO survey_revisions (id, survey_id, revision, title_kr, title_en, description_kr, description_en, created_by_user_id, published_at)
SELECT 'f6666666-6666-4666-8666-666666666667', survey.id, 1,
  '[Mock] 행사 만족도 조사', '[Mock] Event satisfaction survey',
  '행사 운영 개선을 위한 테스트 설문입니다.', 'A scheduled survey for testing the public survey flow.', admin.id, NULL
FROM surveys AS survey
JOIN users AS admin ON admin.sso_user_id = 'development-admin'
WHERE survey.id = 'f6666666-6666-4666-8666-666666666666'
ON CONFLICT (id) DO NOTHING;

INSERT INTO survey_sections (id, survey_revision_id, ordinal, title_kr, title_en)
SELECT 'f6666666-6666-4666-8666-666666666668', 'f6666666-6666-4666-8666-666666666667', 0, '행사 피드백', 'Event feedback'
WHERE NOT EXISTS (
  SELECT 1 FROM survey_sections AS existing WHERE existing.id = 'f6666666-6666-4666-8666-666666666668'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO survey_questions (id, section_id, ordinal, type, prompt_kr, prompt_en, required)
SELECT 'f6666666-6666-4666-8666-666666666669', 'f6666666-6666-4666-8666-666666666668', 0, 'LONG_TEXT', '다음 행사에 바라는 점을 적어주세요.', 'What should we improve for the next event?', false
WHERE NOT EXISTS (
  SELECT 1 FROM survey_questions AS existing WHERE existing.id = 'f6666666-6666-4666-8666-666666666669'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO survey_section_items (id, section_id, ordinal, kind, question_id)
SELECT 'f6666666-6666-4666-8666-66666666666a', 'f6666666-6666-4666-8666-666666666668', 0, 'QUESTION', 'f6666666-6666-4666-8666-666666666669'
WHERE NOT EXISTS (
  SELECT 1 FROM survey_section_items AS existing WHERE existing.id = 'f6666666-6666-4666-8666-66666666666a'
)
ON CONFLICT (id) DO NOTHING;

UPDATE survey_revisions
SET published_at = TIMESTAMPTZ '2026-08-07 12:00:00+09'
WHERE id = 'f6666666-6666-4666-8666-666666666667'
  AND published_at IS NULL;

-- Additional survey cards for pagination QA.
INSERT INTO surveys (
  id, state, current_revision, definition_version, guest_allowed, only_for_korean_speaker,
  phone_required, fee_restriction, cap, opens_at, closes_at, edit_deadline_at,
  response_retention_days, created_by_user_id, updated_by_user_id
)
SELECT
  ('f7777777-7777-4777-8777-' || lpad((777777777700 + n)::text, 12, '0'))::uuid,
  CASE WHEN n % 3 = 0 THEN 'SCHEDULED'::survey_state ELSE 'OPEN'::survey_state END,
  1,
  1,
  true,
  false,
  false,
  'ANY',
  NULL,
  TIMESTAMPTZ '2026-08-01 00:00:00+09' + (n || ' days')::interval,
  TIMESTAMPTZ '2026-12-31 23:59:59+09',
  TIMESTAMPTZ '2026-12-31 23:59:59+09',
  30,
  admin.id,
  admin.id
FROM generate_series(1, 12) AS series(n)
CROSS JOIN users AS admin
WHERE admin.sso_user_id = 'development-admin'
ON CONFLICT (id) DO UPDATE SET
  state = EXCLUDED.state,
  opens_at = EXCLUDED.opens_at,
  closes_at = EXCLUDED.closes_at,
  edit_deadline_at = EXCLUDED.edit_deadline_at,
  updated_by_user_id = EXCLUDED.updated_by_user_id,
  updated_at = NOW();

INSERT INTO survey_revisions (id, survey_id, revision, title_kr, title_en, description_kr, description_en, created_by_user_id, published_at)
SELECT
  ('f7777777-7777-4777-8777-' || lpad((777777777800 + n)::text, 12, '0'))::uuid,
  ('f7777777-7777-4777-8777-' || lpad((777777777700 + n)::text, 12, '0'))::uuid,
  1,
  '[Mock] 카드 페이지네이션 설문 ' || lpad(n::text, 2, '0'),
  '[Mock] Card pagination survey ' || lpad(n::text, 2, '0'),
  '설문 카드 목록의 5열 2행 페이지네이션을 확인하기 위한 테스트 설문입니다.',
  'A test survey for checking the 5 by 2 card pagination layout.',
  admin.id,
  NULL
FROM generate_series(1, 12) AS series(n)
CROSS JOIN users AS admin
WHERE admin.sso_user_id = 'development-admin'
ON CONFLICT (id) DO NOTHING;

INSERT INTO survey_sections (id, survey_revision_id, ordinal, title_kr, title_en)
SELECT
  ('f7777777-7777-4777-8777-' || lpad((777777777900 + n)::text, 12, '0'))::uuid,
  ('f7777777-7777-4777-8777-' || lpad((777777777800 + n)::text, 12, '0'))::uuid,
  0,
  '기본 응답',
  'Basic response'
FROM generate_series(1, 12) AS series(n)
WHERE NOT EXISTS (
  SELECT 1
  FROM survey_sections AS existing
  WHERE existing.id = ('f7777777-7777-4777-8777-' || lpad((777777777900 + n)::text, 12, '0'))::uuid
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO survey_questions (id, section_id, ordinal, type, prompt_kr, prompt_en, required)
SELECT
  ('f7777777-7777-4777-8777-' || lpad((777777778000 + n)::text, 12, '0'))::uuid,
  ('f7777777-7777-4777-8777-' || lpad((777777777900 + n)::text, 12, '0'))::uuid,
  0,
  'SHORT_TEXT',
  '확인용 응답을 입력해 주세요.',
  'Enter a test response.',
  false
FROM generate_series(1, 12) AS series(n)
WHERE NOT EXISTS (
  SELECT 1
  FROM survey_questions AS existing
  WHERE existing.id = ('f7777777-7777-4777-8777-' || lpad((777777778000 + n)::text, 12, '0'))::uuid
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO survey_section_items (id, section_id, ordinal, kind, question_id)
SELECT
  ('f7777777-7777-4777-8777-' || lpad((777777778100 + n)::text, 12, '0'))::uuid,
  ('f7777777-7777-4777-8777-' || lpad((777777777900 + n)::text, 12, '0'))::uuid,
  0,
  'QUESTION',
  ('f7777777-7777-4777-8777-' || lpad((777777778000 + n)::text, 12, '0'))::uuid
FROM generate_series(1, 12) AS series(n)
WHERE NOT EXISTS (
  SELECT 1
  FROM survey_section_items AS existing
  WHERE existing.id = ('f7777777-7777-4777-8777-' || lpad((777777778100 + n)::text, 12, '0'))::uuid
)
ON CONFLICT (id) DO NOTHING;

UPDATE survey_revisions
SET published_at = TIMESTAMPTZ '2026-08-07 12:00:00+09'
WHERE survey_id IN (
  SELECT ('f7777777-7777-4777-8777-' || lpad((777777777700 + n)::text, 12, '0'))::uuid
  FROM generate_series(1, 12) AS series(n)
)
  AND published_at IS NULL;

INSERT INTO content_matchers (id, event_id, survey_id, relation_type, sync_mode, created_by_user_id, updated_by_user_id, synchronized_at)
SELECT 'b2222222-2222-4222-8222-222222222225', event.id, survey.id, 'SURVEY_PERIOD', 'NONE', admin.id, admin.id, NULL
FROM events AS event
JOIN surveys AS survey ON survey.id = 'e6666666-6666-4666-8666-666666666666'
JOIN users AS admin ON admin.sso_user_id = 'development-admin'
WHERE event.id = 'b2222222-2222-4222-8222-222222222222'
ON CONFLICT (id) DO NOTHING;

INSERT INTO content_matchers (id, event_id, survey_id, relation_type, sync_mode, created_by_user_id, updated_by_user_id, synchronized_at)
SELECT 'b2222222-2222-4222-8222-222222222226', event.id, survey.id, 'SURVEY_PERIOD', 'NONE', admin.id, admin.id, NULL
FROM events AS event
JOIN surveys AS survey ON survey.id = 'f6666666-6666-4666-8666-666666666666'
JOIN users AS admin ON admin.sso_user_id = 'development-admin'
WHERE event.id = 'b2222222-2222-4222-8222-222222222223'
ON CONFLICT (id) DO NOTHING;

-- A live vote fixture: only turnout and eligibility are visible until an administrator publishes the count.
INSERT INTO votes (
  id, title_kr, title_en, description_kr, description_en, state, opens_at, closes_at,
  anonymous, valid_turnout_percent, created_by_user_id, updated_by_user_id
)
SELECT
  '91111111-1111-4111-8111-111111111111',
  '[Mock] 2026 학생회 공약 우선순위 투표', '[Mock] 2026 student council priority vote',
  '테스트용 공개 투표입니다. 후보자별 득표수는 개표 전 공개되지 않습니다.', 'A live vote fixture. Candidate counts remain hidden until publication.',
  'OPEN', TIMESTAMPTZ '2026-08-01 00:00:00+09', TIMESTAMPTZ '2026-12-31 23:59:59+09', true, 50, admin.id, admin.id
FROM users AS admin
WHERE admin.sso_user_id = 'development-admin'
ON CONFLICT (id) DO UPDATE SET state = 'OPEN', closes_at = EXCLUDED.closes_at, updated_by_user_id = EXCLUDED.updated_by_user_id, updated_at = NOW();

INSERT INTO vote_candidates (id, vote_id, ordinal, name_kr, name_en, description_kr, description_en, image_url)
VALUES
  ('91111111-1111-4111-8111-111111111112', '91111111-1111-4111-8111-111111111111', 0, '공약 후보 A', 'Candidate A', '학생 복지 확대안을 제안합니다.', 'A student welfare proposal.', NULL),
  ('91111111-1111-4111-8111-111111111113', '91111111-1111-4111-8111-111111111111', 1, '공약 후보 B', 'Candidate B', '학부 커뮤니티 개선안을 제안합니다.', 'An undergraduate community proposal.', NULL)
ON CONFLICT (id) DO UPDATE SET name_kr = EXCLUDED.name_kr, name_en = EXCLUDED.name_en, description_kr = EXCLUDED.description_kr, description_en = EXCLUDED.description_en;

INSERT INTO vote_voter_rolls (vote_id, identity_kind, identity_hash)
VALUES
  ('91111111-1111-4111-8111-111111111111', 'SSO_SUBJECT', 'd7d772eca7a3611941b388382e3681bb6e1aeb1ccc615d32c4522b928a06abc7'),
  ('91111111-1111-4111-8111-111111111111', 'SSO_SUBJECT', '951d64e91213e7b94f40c3c4353e28f58d454ff5f80426da7359d17f6125c5ae'),
  ('91111111-1111-4111-8111-111111111111', 'SSO_SUBJECT', '71535913e08b4eb1c20e90cac2c648c149d855b8ac0c770e5fcb1a098a4c326a')
ON CONFLICT (vote_id, identity_kind, identity_hash) DO NOTHING;

INSERT INTO vote_participants (id, vote_id, user_id, voted_at)
SELECT '91111111-1111-4111-8111-111111111114', vote.id, user_row.id, TIMESTAMPTZ '2026-08-05 09:00:00+09'
FROM votes AS vote
JOIN users AS user_row ON user_row.sso_user_id = 'development-user-1'
WHERE vote.id = '91111111-1111-4111-8111-111111111111'
ON CONFLICT (vote_id, user_id) DO NOTHING;

INSERT INTO vote_ballots (id, vote_id, candidate_id, created_at)
VALUES ('91111111-1111-4111-8111-111111111115', '91111111-1111-4111-8111-111111111111', '91111111-1111-4111-8111-111111111112', TIMESTAMPTZ '2026-08-05 09:00:00+09')
ON CONFLICT (id) DO NOTHING;

-- Additional vote cards for pagination QA.
INSERT INTO votes (
  id, title_kr, title_en, description_kr, description_en, state, opens_at, closes_at,
  anonymous, valid_turnout_percent, created_by_user_id, updated_by_user_id
)
SELECT
  ('93333333-3333-4333-8333-' || lpad((333333333300 + n)::text, 12, '0'))::uuid,
  '[Mock] 카드 페이지네이션 투표 ' || lpad(n::text, 2, '0'),
  '[Mock] Card pagination vote ' || lpad(n::text, 2, '0'),
  '투표 카드 목록의 5열 2행 페이지네이션을 확인하기 위한 테스트 투표입니다.',
  'A test vote for checking the 5 by 2 card pagination layout.',
  CASE WHEN n % 4 = 0 THEN 'SCHEDULED'::vote_state ELSE 'OPEN'::vote_state END,
  TIMESTAMPTZ '2026-08-01 00:00:00+09' + (n || ' days')::interval,
  TIMESTAMPTZ '2026-12-31 23:59:59+09',
  true,
  50,
  admin.id,
  admin.id
FROM generate_series(1, 12) AS series(n)
CROSS JOIN users AS admin
WHERE admin.sso_user_id = 'development-admin'
ON CONFLICT (id) DO UPDATE SET
  title_kr = EXCLUDED.title_kr,
  title_en = EXCLUDED.title_en,
  description_kr = EXCLUDED.description_kr,
  description_en = EXCLUDED.description_en,
  state = EXCLUDED.state,
  opens_at = EXCLUDED.opens_at,
  closes_at = EXCLUDED.closes_at,
  updated_by_user_id = EXCLUDED.updated_by_user_id,
  updated_at = NOW();

INSERT INTO vote_candidates (id, vote_id, ordinal, name_kr, name_en, description_kr, description_en, image_url)
SELECT
  ('93333333-3333-4333-8333-' || lpad((333333333400 + n)::text, 12, '0'))::uuid,
  ('93333333-3333-4333-8333-' || lpad((333333333300 + n)::text, 12, '0'))::uuid,
  0,
  '찬성',
  'Approve',
  '테스트 선택지 A입니다.',
  'Test candidate A.',
  NULL
FROM generate_series(1, 12) AS series(n)
UNION ALL
SELECT
  ('93333333-3333-4333-8333-' || lpad((333333333500 + n)::text, 12, '0'))::uuid,
  ('93333333-3333-4333-8333-' || lpad((333333333300 + n)::text, 12, '0'))::uuid,
  1,
  '반대',
  'Reject',
  '테스트 선택지 B입니다.',
  'Test candidate B.',
  NULL
FROM generate_series(1, 12) AS series(n)
ON CONFLICT (id) DO UPDATE SET
  name_kr = EXCLUDED.name_kr,
  name_en = EXCLUDED.name_en,
  description_kr = EXCLUDED.description_kr,
  description_en = EXCLUDED.description_en;

INSERT INTO pledges (
  id, ordinal, title_kr, title_en, description_kr, description_en, status,
  progress_percent, progress_kr, progress_en, target_date, is_published,
  created_by_user_id, updated_by_user_id
)
SELECT fixture.id, fixture.ordinal, fixture.title_kr, fixture.title_en, fixture.description_kr, fixture.description_en,
  fixture.status, fixture.progress_percent, fixture.progress_kr, fixture.progress_en, fixture.target_date, true, admin.id, admin.id
FROM (VALUES
  ('92222222-2222-4222-8222-222222222221'::uuid, 0, '수업·학사 정보 개선', 'Improve academic information', '학사 정보를 한 곳에서 찾기 쉽게 정리합니다.', 'Make academic information easier to find.', 'IN_PROGRESS'::pledge_status, 75, '학사 캘린더와 공지 연결을 점검하고 있습니다.', 'Academic calendar and notice links are being checked.', DATE '2026-09-30'),
  ('92222222-2222-4222-8222-222222222222'::uuid, 1, '학생 의견 수렴 강화', 'Strengthen student feedback', '정기 설문과 공개 답변을 운영합니다.', 'Run regular surveys and public responses.', 'IN_PROGRESS'::pledge_status, 55, '설문 기능을 운영 중입니다.', 'The survey flow is operational.', DATE '2026-10-31'),
  ('92222222-2222-4222-8222-222222222223'::uuid, 2, '공약 이행 공개', 'Publish pledge progress', '공약별 진행 상황을 공개합니다.', 'Publish progress for each pledge.', 'DONE'::pledge_status, 100, '현황판을 공개했습니다.', 'The status board is published.', DATE '2026-08-07'),
  ('92222222-2222-4222-8222-222222222224'::uuid, 3, '행사 접근성 확대', 'Improve event access', '행사 일정과 참여 정보를 안정적으로 제공합니다.', 'Provide reliable event and participation information.', 'IN_PROGRESS'::pledge_status, 40, '행사·캘린더 연결을 구현하고 있습니다.', 'Event and calendar linking is in progress.', DATE '2026-11-30'),
  ('92222222-2222-4222-8222-222222222225'::uuid, 4, '커뮤니티 운영 개선', 'Improve community operations', '게시판과 댓글 운영 원칙을 정비합니다.', 'Improve board and comment operations.', 'IN_PROGRESS'::pledge_status, 35, '게시판 번호와 권한 흐름을 정비했습니다.', 'Board numbering and permissions are being improved.', DATE '2026-12-31'),
  ('92222222-2222-4222-8222-222222222226'::uuid, 5, '투명한 투표 운영', 'Run transparent elections', '선거인명부와 개표 공개 절차를 제공합니다.', 'Provide voter-roll and result-publication procedures.', 'IN_PROGRESS'::pledge_status, 45, '투표 초안·명부·개표 흐름을 구현했습니다.', 'The draft, roll, and count flow is implemented.', DATE '2026-12-31'),
  ('92222222-2222-4222-8222-222222222227'::uuid, 6, '학생회 자료 아카이브', 'Archive council materials', '공지와 행사 자료를 오래 찾을 수 있게 합니다.', 'Make notices and event materials discoverable.', 'PLANNED'::pledge_status, 10, '자료 구조를 설계 중입니다.', 'The archive structure is being designed.', DATE '2027-01-31'),
  ('92222222-2222-4222-8222-222222222228'::uuid, 7, '다국어 이용성 개선', 'Improve bilingual access', '주요 기능을 한국어와 영어로 제공합니다.', 'Provide core features in Korean and English.', 'IN_PROGRESS'::pledge_status, 30, '공개 콘텐츠의 영문 필드를 함께 관리합니다.', 'English fields are managed with public content.', DATE '2027-02-28')
) AS fixture(id, ordinal, title_kr, title_en, description_kr, description_en, status, progress_percent, progress_kr, progress_en, target_date)
CROSS JOIN users AS admin
WHERE admin.sso_user_id = 'development-admin'
ON CONFLICT (id) DO UPDATE SET
  ordinal = EXCLUDED.ordinal,
  title_kr = EXCLUDED.title_kr,
  title_en = EXCLUDED.title_en,
  description_kr = EXCLUDED.description_kr,
  description_en = EXCLUDED.description_en,
  status = EXCLUDED.status,
  progress_percent = EXCLUDED.progress_percent,
  progress_kr = EXCLUDED.progress_kr,
  progress_en = EXCLUDED.progress_en,
  target_date = EXCLUDED.target_date,
  is_published = true,
  updated_by_user_id = EXCLUDED.updated_by_user_id,
  updated_at = NOW();

-- Additional pledge cards for pagination QA.
INSERT INTO pledges (
  id, ordinal, title_kr, title_en, description_kr, description_en, status,
  progress_percent, progress_kr, progress_en, target_date, is_published,
  created_by_user_id, updated_by_user_id
)
SELECT
  ('92222222-2222-4222-8222-' || lpad((222222222228 + n)::text, 12, '0'))::uuid,
  7 + n,
  '[Mock] 카드 페이지네이션 공약 ' || lpad(n::text, 2, '0'),
  '[Mock] Card pagination pledge ' || lpad(n::text, 2, '0'),
  '공약 카드 목록의 5열 2행 페이지네이션을 확인하기 위한 테스트 공약입니다.',
  'A test pledge for checking the 5 by 2 card pagination layout.',
  CASE WHEN n % 3 = 0 THEN 'PLANNED'::pledge_status WHEN n % 3 = 1 THEN 'IN_PROGRESS'::pledge_status ELSE 'DONE'::pledge_status END,
  LEAST(100, 15 + n * 6),
  '카드 페이지네이션 확인을 위한 진행 상황입니다.',
  'Progress text for card pagination QA.',
  DATE '2027-03-01' + n,
  true,
  admin.id,
  admin.id
FROM generate_series(1, 8) AS series(n)
CROSS JOIN users AS admin
WHERE admin.sso_user_id = 'development-admin'
ON CONFLICT (id) DO UPDATE SET
  ordinal = EXCLUDED.ordinal,
  title_kr = EXCLUDED.title_kr,
  title_en = EXCLUDED.title_en,
  description_kr = EXCLUDED.description_kr,
  description_en = EXCLUDED.description_en,
  status = EXCLUDED.status,
  progress_percent = EXCLUDED.progress_percent,
  progress_kr = EXCLUDED.progress_kr,
  progress_en = EXCLUDED.progress_en,
  target_date = EXCLUDED.target_date,
  is_published = true,
  updated_by_user_id = EXCLUDED.updated_by_user_id,
  updated_at = NOW();

COMMIT;
