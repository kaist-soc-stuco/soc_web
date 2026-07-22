# Architecture Audit - 2026-06-12

이 문서는 SOC Web 모노레포가 더 커지기 전에 우선 정리해야 할 구조적 결함과 리팩토링 항목을 기록한다.

## 감사 범위

- Monorepo: `pnpm-workspace.yaml`, 루트 `package.json`, shared 패키지 export 정책
- Backend: NestJS module 구조, auth/user/permission 경계, Drizzle schema/query 구조
- Frontend: React route/page 구조, API client 사용 방식, board metadata fallback
- Infra: Dockerfile, compose, nginx, migration/seed scripts, gitignore/docs 정책

## P0 - 배포/협업 전 차단 리스크

이번 정리에서 A-001, A-002의 기본 조치와 A-004의 compose 역할 분리를 반영했다. A-003은 shared package export를 `dist` 중심으로 통일하고, shared build/test/Dockerfile 경로를 보강했다. A-101은 guard 위치와 Nest module graph를 먼저 정리해 `forwardRef`를 제거했다. A-102는 mock login bootstrap을 controller 밖으로 분리했다. A-103은 핵심 조회 인덱스 migration 추가와 Drizzle schema 도메인 파일 분리를 반영했다. A-104는 request contract 타입을 Zod schema 기반으로 파생하도록 정리했다. A-105는 일반/관리자 대형 page 파일의 UI 블록, data fetching, form/submission 흐름을 feature-local 모듈로 분리해 모든 route page를 300줄 아래로 낮췄다.

### A-001. Node/pnpm 실행 환경 불일치

현재 README는 Node 20+를 안내했지만, 실제 `pnpm@11.1.2` 실행은 더 높은 Node 버전을 요구한다. WSL 환경에서는 Node 18.19.1 때문에 `pnpm --filter ... typecheck`가 실패했고, Windows UNC 경로에서는 pnpm store rename `EPERM`이 발생했다.

조치:

- 루트 `.node-version`을 `22.13.0`으로 고정한다.
- 루트 `package.json`에 `engines.node >=22.13.0`, `engines.pnpm 11.1.2`를 선언한다.
- README 요구사항을 Node 22.13+로 갱신한다.
- CI 또는 로컬 bootstrap 스크립트에서 Node/pnpm 버전을 먼저 확인한다.

수용 기준:

- WSL 내부에서 `node --version`, `pnpm --version`, `pnpm typecheck`가 같은 경로 기준으로 재현된다.
- Windows UNC 경로가 아니라 WSL 실제 경로 또는 devcontainer/CI 경로에서 검증 명령을 실행하도록 문서화된다.

### A-002. 문서와 외부자료 추적 정책 역전

`docs/`는 아키텍처, 보안, 운영 문서를 담고 있지만 `.gitignore`의 `/docs` 때문에 git에 새로 추적되지 않는다. 반대로 `[etc]/SSO-Login-Guide`의 PDF/JAR/JSP 샘플은 추적 중이다.

조치:

- `/docs` ignore 규칙을 제거한다.
- `docs/`를 프로젝트 의사결정 기록의 공식 위치로 삼는다.
- 외부 벤더 문서는 `vendor-docs/` 또는 `[etc]/`에 유지하되, 보관 이유와 라이선스/민감정보 점검 기준을 README에 남긴다.

수용 기준:

- 새 감사/운영 문서가 `git status`에 나타난다.
- 외부 JAR/PDF가 의도적으로 추적되는지 별도 이슈에서 확인된다.

### A-003. shared 패키지 export/build 정책 혼재

`@soc/contracts`는 `types`와 `require`는 `dist`를 보지만 `import`는 `src/index.ts`를 본다. `@soc/shared`도 production 조건은 `dist`, 기본값은 `src`다. `@soc/api-client`는 build/typecheck script 없이 `src`만 export한다.

적용 현황:

- `@soc/contracts`, `@soc/shared`, `@soc/api-client`의 `main`, `types`, `exports`를 `dist` 산출물 기준으로 통일했다.
- `@soc/api-client`에 `main`, `types`, `files`, `build`, `typecheck`, `tsconfig.json`을 추가했다.
- `@soc/api-client` ESM 산출물이 Node에서 해석되도록 내부 relative import를 `.js` 확장자 포함 형태로 정리했다.
- 루트 `build:shared`, `dev`, `dev:api`, `dev:web`, `typecheck`가 shared build를 먼저 수행하도록 조정했다.
- API/Web Dockerfile도 shared dist export 정책에 맞춰 필요한 shared package를 먼저 빌드하도록 조정했다.
- `apps/web/test/shared-exports.test.js`로 `node --conditions=production` package import 검증을 추가했다.

수용 기준:

- `pnpm -r build` 후 API production start가 shared package의 `src/*.ts`에 의존하지 않는다.
- `node --conditions=production` 기반 테스트가 shared package resolution 때문에 깨지지 않는다.

### A-004. compose/Dockerfile 역할 혼재

루트 `compose.yml`은 API/Web 개발 Dockerfile을 사용한다. 운영 compose의 `db-migrate`도 prod Dockerfile이 아니라 `apps/api/Dockerfile`을 사용했다. 또한 운영 compose가 `.env` 전체를 web/postgres/db-migrate에 주입하면 API secret과 `NODE_ENV=development`가 불필요한 컨테이너까지 퍼질 수 있다.

적용 현황:

- 루트 `compose.yml`을 DB/Redis 전용 개발 인프라 compose로 단순화했다.
- 기존 full-stack 개발 Docker stack은 `infra/docker/compose.local.yml`로 분리했다.
- 운영 compose는 `infra/docker/compose.prod.yml`로 유지하고 API/Web prod Dockerfile을 사용한다.
- local/prod compose에서 web, postgres, db-migrate에 불필요한 API/SSO secret이 주입되지 않도록 환경 변수를 제한했다.

수용 기준:

- prod compose에서 dev server, `ts-node-dev`, `--no-frozen-lockfile` 설치 경로가 사용되지 않는다.
- migration container와 API runtime container가 같은 schema/build 산출물을 기준으로 동작한다.
- prod compose에서 web/postgres 컨테이너에 API/SSO secret이 주입되지 않는다.

## P1 - 구조 리팩토링

### A-101. Auth/User/Guard 순환 의존

감사 당시 `AuthGuard`가 shared guard 폴더에 있으면서 `features/auth`, `features/users`를 직접 import했다. `AuthModule`과 `UsersModule`도 `forwardRef`로 서로를 참조했다.

적용 현황:

- `AuthGuard`, `OptionalAuthGuard`, `RequirePermissions`, `PermissionBitsGuard`를 `features/auth/guards`로 이동했다.
- `UsersModule`은 service/repository provider만 담당하고, `UsersHttpModule`이 `UsersController`와 `AuthModule` 조합을 담당하도록 분리했다.
- `SurveysModule`, `RoleGroupsModule`의 인증/유저 provider 중복 등록을 `AuthModule`, `UsersModule` import로 대체했다.
- `AuthModule`과 `UsersModule` 사이의 `forwardRef`를 제거했다.

조치:

- user 조회와 permission bitmask 계산은 후속 단계에서 `CurrentUserResolver` 또는 `PermissionResolver` port로 분리한다.
- users HTTP adapter와 users domain module의 파일 위치를 더 명확히 분리할지 검토한다.

수용 기준:

- users domain module/service/repository는 `features/auth`를 import하지 않는다.
- shared 계층은 feature module을 import하지 않는다.

### A-102. Controller의 DB 직접 접근

감사 당시 `AuthController`가 Drizzle DB를 직접 주입받아 mock admin role/permission을 구성했다. 이는 controller-service-repository 흐름의 예외이며, 권한 seed와 dev mock bootstrap이 섞여 있었다.

적용 현황:

- `AuthController`에서 `DRIZZLE_DB`와 postgres schema 직접 import를 제거했다.
- 개발용 mock admin 사용자/권한/role group 구성은 `AuthDevLoginService`, `AuthDevLoginRepository`로 분리했다.
- controller는 mock session 발급 요청과 쿠키 설정만 담당한다.
- 인증 쿠키 설정/삭제는 `AuthCookieService`로 분리했다.
- `auth/login/mock` route는 `AuthDevController`, `AuthDevModule`로 분리하고 production `AppModule` graph에서 제외했다.
- `MockModule`과 `AuthDevModule`은 production `AppModule` graph에서 제외되도록 조건부 import로 바꿨다.

조치:

- role group/permission bootstrap 정책을 seed/migration과 dev bootstrap 중 어디에 둘지 확정한다.

수용 기준:

- controller는 request/response orchestration만 담당한다.
- mock login이 production module graph에서 제거된다.

### A-103. Drizzle schema 단일 파일과 인덱스 부족

모든 도메인 테이블이 `postgres.schema.ts`에 있으며 감사 당시 명시 인덱스는 사실상 `article_board_idx` 하나였다. 실제 쿼리는 FK join, status/date 정렬, `ilike`, count subquery, pagination을 많이 사용한다.

적용 현황:

- `article`, `comment`, `article_asset`, `survey`, `survey_responses`, `survey_answers`, `survey_sections`, `survey_questions`, `user_role_group`, `student_fee_status`, `asset`, `audit_log`, `executive_contact`, `bulk_email`, `users`에 첫 번째 조회 인덱스 세트를 추가했다.
- `drizzle/0002_numerous_sphinx.sql` migration과 Drizzle meta snapshot을 생성했다.
- 게시글 목록/상세 주변글, 댓글 count/list, 첨부 exists, 설문 공개 목록/응답 count, 권한 bitmask 계산, 학생회비 필터링 조회를 우선 커버한다.
- 단일 `postgres.schema.ts` 정의를 `schema/auth.schema.ts`, `fee.schema.ts`, `board.schema.ts`, `survey.schema.ts`, `audit.schema.ts`, `contact.schema.ts`, `email.schema.ts`로 분리했다.
- 기존 repository import 호환성을 위해 `postgres.schema.ts`는 barrel export로 유지한다.
- `drizzle-kit generate --config drizzle.config.ts` 기준으로 schema 분리 후 추가 migration이 생성되지 않음을 확인했다.

조치:

- 운영 DB에서 `EXPLAIN (ANALYZE, BUFFERS)`로 새 인덱스 채택 여부를 확인한다.
- 게시글/사용자 검색은 trigram 또는 full-text search 도입 여부를 별도 검토한다.

수용 기준:

- 주요 list endpoint에 대해 `EXPLAIN` 기준 full scan 후보가 정리된다.
- migration에 인덱스 추가가 반영된다.

### A-104. contract interface와 Zod schema 이중 관리

request schema와 request interface가 따로 관리된다. `schemas.ts`는 `z.infer` 사용을 언급하지만 실제로는 대부분 수동 interface가 별도 존재한다.

적용 현황:

- auth, board/article/comment, survey/section/question/response, role group, finance, contact, bulk email request 타입을 `z.infer<typeof Schema>` 기반 type alias로 전환했다.
- `QuestionTypeSchema`, `QuestionOptionSchema`, `ArticleAssetRequestSchema`, `VisibilityScopeSchema`를 export하고 기존 공개 타입 이름은 유지했다.
- `questionType` 런타임 검증을 string에서 명시 enum으로 좁혔다.
- `shared/contracts` build 산출물도 갱신했다.

조치:

- `kind`, `resultVisibility`, `feeRequirementPolicy` 같은 survey 값도 프론트 폼 state를 정리한 뒤 enum/union으로 좁힌다.
- response schema는 auth/session/survey/board부터 점진 도입한다.

수용 기준:

- 같은 request shape이 interface와 schema에 중복 선언되지 않는다.
- API boundary에서 런타임 검증과 TypeScript 타입이 같은 원천을 본다.

### A-105. frontend page 비대화

여러 page 파일이 700-1100줄 규모이며, data fetching, form state, filtering, rendering, permission UI가 한 파일에 쌓여 있다.

적용 현황:

- `events-surveys-page.tsx`의 필터/정렬 바를 `features/events-surveys/events-surveys-filter-bar.tsx`로 분리했다.
- 행사/설문 카드 그리드를 `features/events-surveys/events-surveys-grid.tsx`로 분리했다.
- 월간 달력, hover preview, 선택일 상세 패널을 `features/events-surveys/events-surveys-calendar.tsx` 하위의 grid/details 컴포넌트로 분리했다.
- 행사/설문 목록 조회, 공휴일 월별 캐시, 필터/정렬 파생값을 `features/events-surveys/use-events-surveys-page-controller.ts`로 분리했다.
- `events-surveys-page.tsx`는 1119줄에서 150줄로 줄었고, route tab UI와 상태별 콘텐츠 조립 중심으로 책임이 줄었다.
- `survey-page.tsx`의 질문 입력, 응답 변환 helper, 상태별 안내 화면, 응답 폼, 요약 카드를 `features/survey`로 분리했다.
- 설문 조회, 기존 응답 초기화, 제출/수정 요청, 제출 오류 매핑을 `features/survey/use-survey-page-controller.ts`로 분리했다.
- `survey-page.tsx`는 1019줄에서 131줄로 줄었고, 접근 분기와 feature component 조립만 담당한다.
- `board-write-page.tsx`의 draft, 업로드, 게시글 제출, 설문 연결, 권한 기반 게시판 선택 흐름을 `features/board-write/use-board-write-page-controller.ts`로 분리했다.
- 글쓰기 에디터 header/toolbar, 국영문 입력 필드, 행사 필드, 설문 연결, 첨부 목록, 게시 옵션 패널을 `features/board-write/board-write-form-sections.tsx`로 분리했다.
- `board-write-page.tsx`는 911줄에서 192줄로 줄었고, route-level page shell과 feature section 조립만 담당한다.
- `board-edit-page.tsx`의 게시글 로딩/수정/설문 재연결/첨부 업로드 흐름을 `features/board-write/use-board-edit-page-controller.ts`로 분리했다.
- edit 화면은 write 화면의 feature-local editor/event/survey/attachment/options 섹션을 재사용하도록 정리했다.
- `board-edit-page.tsx`는 751줄에서 199줄로 줄었고, 로딩/오류/편집 shell 조립만 담당한다.
- `my-page.tsx`의 세션/활동/내 글/댓글/설문 응답 조회와 통계 파생값을 `features/my-page/use-my-page-controller.ts`로 분리했다.
- 마이페이지 sidebar, loading/unavailable state, overview/profile/activity 패널을 `features/my-page/my-page-sections.tsx`로 분리했다.
- `my-page.tsx`는 749줄에서 103줄로 줄었고, 메뉴 상태에 따른 feature panel 조립만 담당한다.
- `board-page.tsx`의 게시글 조회, 검색/필터/정렬, 페이지네이션, 글쓰기 권한 계산을 `features/board-list/use-board-page-controller.ts`로 분리했다.
- 게시판 탭/검색/필터 바와 게시글 목록 테이블을 `features/board-list/board-page-sections.tsx`로 분리했다.
- `board-page.tsx`는 658줄에서 88줄로 줄었고, board list shell과 feature section 조립만 담당한다.
- `board-detail-page.tsx`의 게시글/보드/댓글 조회, 댓글 작성/삭제, 게시글 삭제, 권한 파생값을 `features/board-detail/use-board-detail-page-controller.ts`로 분리했다.
- 게시판 탭, breadcrumb, 게시글 본문 카드, 이전/다음 링크를 `features/board-detail/board-detail-sections.tsx`로 분리했다.
- `board-detail-page.tsx`는 606줄에서 122줄로 줄었고, loading/not-found/detail shell 조립만 담당한다.
- `survey-results-page.tsx`의 결과 조회/권한 오류 상태를 `features/survey-results/use-survey-results-page-controller.ts`로 분리했다.
- 설문 결과 요약, choice/text/temporal question 결과 렌더링, private/error/loading state를 `features/survey-results/survey-results-sections.tsx`로 분리했다.
- `survey-results-page.tsx`는 542줄에서 36줄로 줄었고, back action과 결과 content 조립만 담당한다.
- `search-page.tsx`의 통합 검색 API 호출, survey/about 필터링, board label 파생값을 `features/search/use-search-page-controller.ts`와 `search-utils.ts`로 분리했다.
- 검색 폼, 상태 표시, 게시글/설문/about 결과 렌더링을 `features/search/search-page-sections.tsx`로 분리했다.
- `search-page.tsx`는 419줄에서 68줄로 줄었고, search page shell과 feature section 조립만 담당한다.
- `about-page.tsx`의 tab URL 상태와 구성원 조회를 `features/about/use-about-page-controller.ts`로 분리했다.
- 소개 hero, tab bar, intro/history/org/members 섹션을 `features/about/about-page-sections.tsx`로 분리했다.
- `about-page.tsx`는 329줄에서 37줄로 줄었고, about page shell과 feature section 조립만 담당한다.
- 관리자 설문 목록/편집/응답 목록 구현을 `features/admin-surveys`로 이동하고, 기존 admin route page는 feature wrapper만 담당하도록 정리했다.
- 관리자 권한 관리 구현을 `features/admin-permissions`로 이동하고, `permission-page.tsx`는 918줄에서 5줄로 줄였다.
- 학생회비 관리 구현을 `features/admin-finance`로 이동하고, `fee-management-page.tsx`는 332줄에서 5줄로 줄였다.
- 연락망 관리 구현을 `features/admin-contacts`로 이동하고, `contacts-page.tsx`는 339줄에서 5줄로 줄였다.
- `apps/web/src/pages` 하위의 모든 route page는 recursive line count 기준 300줄 미만이다.

조치:

- page는 route-level orchestration만 담당하게 한다.
- 신규 admin, survey, permission 화면이 생기면 같은 feature-local component/hook 패턴으로 분리한다.
- 반복되는 loading/error/empty/pagination/filter는 shared UI 또는 feature-local component로 추출한다.

수용 기준:

- 신규 기능은 page 파일에 300줄 이상 누적하지 않는다.
- 기존 route page는 모두 300줄 미만이며, 변경이 들어갈 때마다 feature-local 단위로 유지한다.

## P2 - 운영 안정화

### A-201. board metadata fallback 중복

프론트의 board fallback metadata가 서버 board metadata와 어긋날 수 있다.

적용 현황:

- `useBoardCatalog`가 초기값부터 fallback을 쓰지 않고, `GET /boards` 실패 시에만 fallback catalog를 쓰도록 변경했다.
- Header의 별도 board fetch/fallback 흐름을 `useBoardCatalog`로 통합했다.
- fallback metadata는 게시판 코드 기반의 최소 표시값만 제공하고, fallback write permission은 쓰기 가능으로 해석되지 않는 값으로 고정했다.
- board title/label/description/write permission helper는 서버 board metadata가 있으면 서버 값을 우선 사용하도록 정리했다.
- `apps/web/test/board-metadata.test.js`로 fallback 권한 차단과 서버 metadata 우선순위를 고정했다.

조치:

- board catalog의 영문 description이 필요하면 프론트 fallback이 아니라 서버 contract/schema에 `descriptionEn`을 추가한다.

수용 기준:

- 정상 응답 시 board label/description/write permission은 `GET /boards` 응답을 우선한다.
- API 장애 fallback은 탐색용 최소 표시만 제공하고 글쓰기 권한을 열지 않는다.

### A-202. audit log 미사용

`audit_log` 테이블은 존재하지만 실제 write path가 없다.

적용 현황:

- `AuditLogModule`, `AuditLogService`, `AuditLogRepository`를 추가해 감사 로그 write path를 feature 공통 provider로 분리했다.
- 감사 로그 저장은 best-effort로 처리해 로그 저장 실패가 관리자 작업 성공 경로를 깨지 않도록 했다.
- role group 생성/수정/삭제, role group 구성원 추가/삭제에 actor, IP, target, payload 기록을 추가했다.
- 학생회비 상태 변경에 actor, IP, target 사용자, 변경 입력과 결과 레코드 기록을 추가했다.

조치:

- 감사 로그 조회/필터링 API가 필요해지는 시점에 별도 admin endpoint를 추가한다.

수용 기준:

- 관리자 권한 변경과 학생회비 상태 변경은 `audit_log`에 actor/target/action이 남는다.
- 감사 로그 저장 실패는 원래 관리자 작업을 실패시키지 않는다.

### A-203. upload storage lifecycle

업로드는 local filesystem 기반이고 cleanup interval이 API 프로세스마다 돌 수 있다.

적용 현황:

- `ASSET_ORPHAN_CLEANUP_ENABLED`를 추가해 자동 cleanup scheduler가 명시적으로 켜진 API 프로세스에서만 실행되도록 변경했다.
- 환경 검증에서 `ASSET_ORPHAN_CLEANUP_ENABLED` boolean 값을 검증하고 기본값을 false로 둔다.
- local/prod compose의 API service에 cleanup runner 여부를 명시했다.
- README와 operations runbook에 local filesystem 업로드는 단일 runner 정책이며, replica에서는 worker 또는 distributed lock 전까지 자동 cleanup을 중복 실행하지 말아야 한다고 문서화했다.

조치:

- replica 또는 오브젝트 스토리지 전환 시 Redis/DB distributed lock 또는 별도 cleanup worker를 도입한다.

수용 기준:

- 기본 설정에서는 API 프로세스마다 cleanup interval이 자동 생성되지 않는다.
- 자동 cleanup은 운영자가 지정한 단일 runner에서만 켤 수 있다.
- 수동 cleanup endpoint는 기존처럼 관리자 권한으로 사용할 수 있다.

## 권장 작업 순서

1. Node/pnpm/docs 정책 정리.
2. shared package export/build 정책 통일.
3. Auth/User 순환 의존 제거.
4. DB schema 분리와 핵심 인덱스 추가.
5. contract schema/type 중복 제거.
6. 대형 frontend page를 feature 단위로 점진 분리.
