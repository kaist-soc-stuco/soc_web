# Architecture Review And Priorities

현재 프로젝트는 학생회 사이트 규모에 비해 기반이 꽤 잘 잡혀 있다. 프론트/백엔드/공유 계약이 분리되어 있고, NestJS feature module과 typed api-client가 있어 앞으로 기능을 얹기 좋은 편이다. 다만 기능 추가 속도가 빨라질수록 반복 UI, client-side list 처리, 계약/구현 불일치가 유지보수 비용을 키울 수 있다.

## Snapshot

- Monorepo: pnpm workspace로 `apps/*`, `shared/*`를 관리한다.
- Web: React 19, Vite, Tailwind CSS v4, React Router, React Query 일부 사용, lucide-react.
- API: NestJS 11, Drizzle ORM, Postgres, Redis, cookie/session 기반 인증.
- Shared: `@soc/contracts`가 HTTP 타입과 Zod schema를 제공하고, `@soc/api-client`가 typed fetch wrapper를 제공한다.
- Current user-facing feature areas: auth, board/article/comment, surveys/responses, permissions/role groups, contacts, email, finance.

## Priority 0: Hygiene Before More Features

### 1. Generated artifacts are visible in the repo tree

`apps/api/dist`, `apps/web/dist`, package-level `node_modules`, `tsconfig.tsbuildinfo`가 작업 트리에 보인다. 실제로 추적 중인지 확인하고, 추적 중이라면 제거해야 한다.

Why: 새 기능 diff가 산출물과 섞이면 review가 어려워지고 충돌 가능성이 커진다.

Suggested action:

- `.gitignore`가 산출물을 충분히 제외하는지 확인한다.
- 이미 추적 중인 산출물이 있다면 별도 PR/커밋으로 정리한다.

### 2. Omitted

### 3. Remove demo/hardcoded date data

`Calendar`에 오늘 날짜를 2026년 5월 21일로 고정하는 로직과 샘플 일정 표시가 있다.

Why: 운영 사이트에서 날짜 정보는 신뢰도가 중요하다.

Suggested action:

- 오늘 강조는 실제 현재 날짜 기준으로 변경한다.
- 샘플 일정은 제거한다.

## Priority 1: Small Structural Refactors With High Return

### 1. Centralize board metadata

게시판 카테고리, permission bit, 한/영 label, 설명이 프론트 페이지 내부에 하드코딩되어 있다.

Suggested action:

- 서버 `boards` 데이터를 source of truth로 삼고, 프론트는 `getBoards()` 또는 shared metadata를 사용한다.
- URL에는 display name보다 안정적인 board code를 쓰는 방향을 검토한다.
- label은 `nameKo`, `nameEn`으로 렌더링한다.

### 2. Extract shared list primitives

게시판과 설문 관리가 pagination, page size dropdown, filter dropdown, empty/loading state, badge 패턴을 반복한다.

Suggested action:

- `components/ui` 또는 기능 인접 폴더에 `Pagination`, `DataState`, `FilterDropdown`, `StatusBadge` 같은 재사용 단위를 만든다.
- `atoms/molecules/organisms` 분류는 기존 파일을 이해하는 힌트로만 보고, 새 컴포넌트 위치 결정의 필수 규칙으로 삼지 않는다.

Scope: 한 번에 전면 개편하지 말고 다음 목록 화면을 만들 때 필요한 것부터 추출한다.

### 3. Move large page-local helpers out of page files

`survey-list-page.tsx`는 UI helper, formatter, dropdown, table rendering이 한 파일에 모여 있다.

Suggested action:

- `pages/admin/surveys/*` 또는 `features/surveys/admin/*` 같은 feature-local 폴더를 도입한다.
- page 파일은 data orchestration과 layout assembly 중심으로 얇게 유지한다.

### 4. Normalize API data fetching policy

React Query와 manual `useEffect` fetch가 혼재한다.

Suggested action:

- React Query를 무조건 기본값으로 두지 말고, 캐싱/무효화/공유 서버 상태가 필요한 화면에 사용한다.
- manual fetch를 유지하는 화면은 loading/error/cancelled 처리 패턴을 일관되게 둔다.
- 한 화면에서 두 방식을 섞어 복잡도를 키우지 않는다.

### 5. Define typography and spacing hierarchy

현재 화면들은 시각적으로 잘 정돈되어 있지만, title/body/metadata 크기와 card/table 간격 기준이 문서화되어 있지 않다.

Suggested action:

- public page, admin page, card, table/list에 대한 기본 type scale과 spacing range를 `UI_UX_GUIDE.md` 기준으로 맞춘다.
- 새 화면 구현 전에 page title, section title, row title, metadata의 계층을 먼저 정한다.
- 기존 화면 리팩터링 때는 색상보다 typography/spacing 불일치를 먼저 줄인다.

## Priority 2: Scalability And Correctness

### 1. Server-side list filtering and pagination

공지사항 페이지는 `limit: 100` 조회 후 검색/정렬/기간/페이지네이션을 client-side로 처리한다. 설문 관리도 전체 목록을 받아 client-side 처리한다.

Why: 데이터가 늘면 총 개수, 페이지 수, 검색 결과가 API의 실제 데이터와 어긋날 수 있다.

Suggested action:

- board articles API에 `searchCriteria`, `sortBy`, `period`, `page`, `limit`를 정식 query로 추가한다.
- admin surveys API에도 `q`, `status`, `kind`, `period`, `sort`, `page`, `limit`를 추가한다.
- 작은 규모에서는 board부터 우선 적용하고, surveys는 목록이 커질 때 적용해도 된다.

### 2. Contracts should include more runtime schemas

현재 request body schema는 공유하지만 response는 TypeScript interface 중심이다.

Suggested action:

- 외부 입력이나 불안정한 legacy 응답부터 response schema를 추가한다.
- 모든 response를 한 번에 Zod화하지 말고 인증/설문/게시판 핵심 경계부터 적용한다.

### 3. API client size and path resolvers

`shared/api-client/src/index.ts`가 모든 기능 메서드와 base URL resolver를 한 파일에 담고 있다.

Suggested action:

- 기능별 client factory 또는 내부 module로 분리한다.
- public API는 `createApiClient()` 하나를 유지해 호출부 변경을 줄인다.

### 4. Permission model documentation

권한 bit와 role group이 코드 여러 곳에 흩어질 수 있다.

Suggested action:

- `shared/contracts/src/permissions-registry.ts`를 source of truth로 유지한다.
- 권한별 사용자-facing 설명을 문서화한다.
- 새 admin page 추가 시 필요한 permission을 먼저 정한다.

## Priority 3: Quality Gates

### 1. Add first meaningful tests

현재 package `test` script는 placeholder이다.

Suggested action:

- backend: permission guard, survey state computation, board access logic 단위 테스트.
- frontend: formatter, pagination item generator, permission-gated rendering 정도의 순수 함수 테스트.
- E2E는 로그인/권한 setup 비용이 있으므로 핵심 flow 1-2개부터 시작한다.

### 2. Improve README encoding and onboarding

README 한국어가 깨져 보인다. 새 기여자가 바로 실행할 수 있도록 정리할 필요가 있다.

Suggested action:

- UTF-8 README로 복구한다.
- local dev, Docker dev, env variables, common commands를 최신화한다.

### 3. Visual review checklist

UI 변경마다 최소 확인할 viewport와 상태를 정한다.

Suggested action:

- desktop public, mobile public, desktop admin table, empty/loading/error 상태를 체크리스트화한다.

## Suggested Near-Term Order

1. 산출물/gitignore 상태 확인 및 README/한국어 인코딩 복구.
2. Calendar의 hardcoded today/sample data 제거.
3. 게시판 metadata를 code/label/permission 구조로 정리.
4. Pagination, dropdown, data state를 작게 공통화.
5. 다음 신규 기능부터 화면별 데이터 fetching 방식을 명확히 선택하고, 필요한 경우에만 React Query를 적용.
6. board list API의 server-side 검색/정렬/페이지네이션 확장.

## Product Stabilization Backlog

실제 배포 가능한 상태를 목표로 할 때의 구현 후보 우선순위이다. 예시 이미지는 `apps/web/images`의 게시글 상세, 마이페이지, 권한 관리, 게시판, 메인, 설문조사 관리 페이지를 기준으로 삼는다.

### P0: Deployment Blockers

1. 로그인/세션/권한 흐름 점검
   - 프론트 `useCurrentSession`, `AuthGuard`, 헤더 노출 조건, admin route 접근 제어를 확인한다.
   - 백엔드 cookie, JWT refresh, Redis 세션 TTL, DB user/role group 권한 계산이 일관되는지 확인한다.
   - 이 작업은 모든 admin 페이지와 글쓰기/댓글/첨부 권한의 기반이므로 최우선이다.

2. 게시글 이미지/첨부파일 업로드
   - 현재 asset upload는 실제 파일 저장이 아니라 key 생성에 가깝고, guard 설정도 점검이 필요하다.
   - 우선 서버 로컬 폴더에 blob을 저장하고 정적 URL로 제공한다. 기존 article asset 연결 구조를 활용하되, 불필요한 FileDB 확장은 하지 않는다.
   - 상세 페이지에서 이미지와 일반 첨부를 구분해 표시한다.

3. 게시글 상세 페이지 완성
   - 예시 이미지의 구조를 유지하면서 실제 article, assets, connected survey, prev/next data를 안정적으로 렌더링한다.
   - 댓글과 첨부가 붙는 public 핵심 페이지이므로 업로드 직후 이어서 작업한다.

4. 게시글 댓글
   - 백엔드 API와 api-client는 이미 존재하므로 상세 페이지 UI, 작성/수정/삭제, 로그인 안내, error/loading 상태를 붙인다.
   - 댓글 권한은 board 설정과 session 권한을 따르도록 한다.

### P1: Core User/Admin Pages

5. 마이페이지
   - 예시 이미지처럼 프로필 요약, 통계, 최근 활동, 참여 내역, 작성 글/댓글을 한 화면에서 스캔 가능하게 정리한다.
   - 기존 API(`me/articles`, `me/comments`, `me/survey-responses`)를 우선 활용한다.

6. 권한 관리 페이지
   - 기존 role group 기능은 있으므로 예시 이미지 기준으로 정보 구조와 테이블 UX를 정리한다.
   - 사용자 추가/제거와 역할 수정은 현재 기능을 유지하되, admin layout과 visual hierarchy를 맞춘다.

### P2: Header And Interaction Polish

7. 헤더 검색
   - 전역 게시글 검색을 우선 구현하고, 결과는 작은 command/search popover로 제공한다.
   - 이후 설문/행사까지 확장할 수 있게 result type을 분리한다.

8. 헤더 알림
   - 초기에는 최근 공지/마감 임박 설문 같은 read-only notification popover로 시작한다.
   - DB 알림 테이블이나 개인별 읽음 상태는 실제 필요가 생길 때 추가한다.

9. 헤더 프로필 드롭다운 UI 수정
   - 예시 이미지의 compact admin/user 메뉴 톤에 맞춰 avatar, role, quick links, logout을 정리한다.
   - 검색/알림과 함께 header interaction을 한 번에 QA한다.

### Sequencing Notes

- P0는 서로 의존성이 있다. 세션/권한 점검 후 업로드를 고치고, 업로드 결과를 상세 페이지에서 보여주며, 같은 상세 페이지에 댓글을 붙인다.
- P1 페이지들은 기능 자체가 일부 존재하므로 UI/정보 구조 안정화 중심으로 진행한다.
- P2는 배포 직전 polish로 분류하지만, 검색은 운영자가 실제로 많이 쓸 수 있으므로 P1 이후 바로 진행한다.
- 현재 UI/UX 스타일은 유지한다. 새 visual system을 만들지 않고 예시 이미지의 녹색 accent, 흰 카드, 얕은 border/shadow, compact admin density를 따른다.

## What To Avoid

- 학생회 사이트 규모를 넘어서는 과한 domain layer나 design system 패키지 분리.
- 모든 페이지를 한 번에 feature 폴더 구조로 이동하는 대형 리팩터링.
- API client를 여러 호출 방식으로 갈라 프론트 호출부를 복잡하게 만드는 변경.
- 색상/타이포/카드 스타일을 새 기능마다 새로 만드는 방식.
