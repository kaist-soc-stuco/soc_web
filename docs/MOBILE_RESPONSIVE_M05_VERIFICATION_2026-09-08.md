# M05 모바일 반응형 검증 기록

작성일: 2026-09-08

대상: 게시판 목록, 통합검색, FAQ 목록

기준: `docs/MOBILE_RESPONSIVE_PLAN_2026-09-07.md`의 M05 및 `docs/MOBILE_DESIGN_DIRECTION_2026-09-07.md`의 게시판 목록 목표안

## 1. 실행 환경

- `docker compose up -d postgres redis`로 기존 데이터 볼륨을 유지한 채 PostgreSQL·Redis를 기동했다.
- `docker compose up -d --build api web nginx`로 API·웹 이미지를 최신 소스로 재빌드했다.
- `db-migrate`는 성공적으로 종료했다.
- `GET /health`: `status=ok`, PostgreSQL `ok=true`, Redis `ok=true`
- Mock 로그인 API `POST /v1/auth/login/mock`: `404` (이전 이미지가 아닌 최신 API 이미지 확인)

실제 DB 데이터 확인:

| 데이터 | 결과 |
| --- | ---: |
| 게시판 catalog | 7건 |
| 공지 게시글 | 8건 |
| FAQ | 22건 |
| 2026-09-01~2026-10-31 일정 | 4건 |
| `전산` 통합검색 | 23건 |

## 2. 구현 전 재현 결과

320px 화면에서 게시판 분류와 검색 결과 필터가 가로 탭으로 표시됐다. `연구실`, `FAQ`, `설문`, `투표`처럼 뒤쪽 항목이 첫 화면에서 잘려 있어 좌우 이동을 추측해야 했다.

통합검색 결과의 제목은 `truncate` 한 줄로 제한되어 긴 제목의 핵심 정보가 모바일에서 바로 잘렸다.

게시판·검색·FAQ의 조회 실패는 빈 상태처럼 보였고, 해당 화면에서 즉시 재시도할 수 있는 액션이 없었다.

## 3. 변경 내용

- 320–767px 게시판 분류를 현재 항목이 보이는 `MobileSectionSelector`로 전환했다. 전체 분류는 M02 공통 overlay 동작을 사용하는 bottom sheet에서 선택한다.
- 320–767px 통합검색 결과 필터도 같은 selector/sheet 패턴으로 전환했다. 결과가 0건인 필터를 선택해도 빈 화면이 아니라 `검색 결과가 없습니다.`를 표시한다.
- 768px 이상은 기존 trackless tab을 유지한다.
- 게시판 오류, 검색 오류, FAQ 오류에 `role=alert`와 `다시 시도` 액션을 추가했다.
- 검색 결과 제목을 최대 2줄로 표시하고 단어 단위 줄바꿈을 허용했다.
- 게시판 목록의 검색어·페이지·페이지당 표시 수를 URL `q/page/limit`로 보존했다.
- 목록별 scroll 위치를 session storage에 저장하고 상세 진입 후 뒤로가기 시 복원한다.

## 4. 실제 화면 검증

| 화면 | 실제 데이터/동작 | 가로 오버플로 | 결과 |
| --- | --- | --- | --- |
| 게시판 320px | selector에서 전체, 공지, HoC, 홍보글, 건의사항, 연구실, FAQ 접근 | 없음 | 통과 |
| 게시판 390px | 긴 제목·댓글·첨부 아이콘·작성자·날짜 표시 | 없음 | 통과 |
| 검색 320px | 23건 결과, 제목 2줄, 결과 필터 sheet | 없음 | 통과 |
| 검색 320px | `투표 0` 필터 선택 후 결과 없음 상태 | 없음 | 통과 |
| FAQ 320px | 실제 FAQ 22건, 질문 accordion 열림/답변 region | 없음 | 통과 |
| 게시판 768px | 기존 desktop tab 표시 | 없음 | 통과 |
| 게시판 1440px | 기존 desktop tab 및 목록 표시 | 없음 | 통과 |

브라우저 측정 결과 `document.documentElement.scrollWidth`와 `document.body.scrollWidth`가 각 viewport의 CSS 폭 이하였고, 허용된 내부 overflow 외 document-level 가로 스크롤은 만들지 않았다.

목록에서 실제로 `q=2026` 검색 → 게시글 상세 → 브라우저 뒤로가기를 실행했다. URL의 `q=2026`, 검색 input 값, 목록 scroll 위치가 복원됐다.

## 5. 검사 결과

- web TypeScript `--noEmit`: 통과
- web ESLint: 통과
- UI unit contract: 통과
- web Node tests: 35 passed, 0 failed
- web production build: 통과
- Docker migration/API health: 통과

다음 단위는 M06 글 상세·작성·수정이다.
