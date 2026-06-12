# SoC Web Development Guide

이 문서는 전산학부 집행위원회 사이트에 기능을 추가할 때 우선 따를 개발 규칙이다. 현재 코드베이스의 구조와 관성을 존중하되, 작은 학생회 사이트 규모에서 유지보수성을 높이는 방향을 기준으로 한다.

## Repository Shape

- `apps/web`: React 19 + Vite 프론트엔드. 라우팅, 페이지, UI 컴포넌트, 브라우저 API 호출을 담당한다.
- `apps/api`: NestJS 백엔드. 기능 단위 `features/*` 모듈, Drizzle/Postgres 저장소, 인증/권한, Redis 인프라를 담당한다.
- `shared/contracts`: 프론트와 백엔드가 공유하는 HTTP 타입과 Zod request schema의 원천이다.
- `shared/api-client`: 브라우저에서 사용하는 typed fetch wrapper이다.
- `shared/common`: 시간/권한 같은 양쪽 공통 유틸리티를 둔다.
- `shared/config`: 공통 TypeScript/ESLint 설정을 둔다.
- `infra`: Docker, DB migration/seed 스크립트를 둔다.

## Default Workflow

1. 새 API나 데이터 shape가 필요하면 `shared/contracts`를 먼저 수정한다.
2. request body가 있는 API는 `shared/contracts/src/schemas.ts`에 Zod schema를 추가하거나 갱신한다.
3. `apps/api/src/features/<feature>`에 module/controller/service를 우선 맞추고, DB 접근이 복잡하거나 재사용될 때 repository를 둔다.
4. `shared/api-client/src/index.ts`에 프론트에서 쓸 메서드를 추가한다.
5. `apps/web/src/pages` 또는 관련 컴포넌트에서 api-client를 사용한다.
6. 변경 범위에 맞춰 `pnpm typecheck`, 가능하면 `pnpm build`를 실행한다.

## Frontend Rules

- 라우트는 `apps/web/src/App.tsx`에 선언한다. 페이지 컴포넌트는 `apps/web/src/pages` 아래에 둔다.
- 기존 import alias인 `@/`를 사용한다.
- 기존 `atoms`, `molecules`, `organisms` 폴더는 존중하되 새 기능에서 atomic design 분류에 억지로 맞추지 않는다. 재사용 범위가 명확하면 `components/ui`, 기능별 하위 폴더, 또는 가까운 페이지 폴더에 둔다.
- 단일 페이지에만 쓰이는 작은 helper는 해당 페이지 파일 내부에 두되, 두 페이지 이상 반복되면 `components` 또는 `lib`로 올린다.
- API 호출은 직접 `fetch`보다 `createApiClient`를 우선 사용한다.
- 세션/권한은 `useCurrentSession`, `AuthGuard`, `hasPermission`, `Permissions` 계열을 우선 확인한다.
- 새 아이콘은 `lucide-react`에서 가져온다.
- Tailwind 유틸리티를 기본으로 쓰되, 반복되는 버튼/카드/드롭다운 스타일은 기존 `components/ui` 또는 새 공통 컴포넌트로 정리한다.

## Backend Rules

- 기능은 `apps/api/src/features/<feature>` 단위로 묶는다.
- Nest module은 필요한 provider를 명시적으로 등록한다.
- controller는 라우팅, guard, pipe, DTO 검증만 담당한다.
- service는 권한/상태 전이/도메인 규칙을 담당한다.
- repository는 선택 사항이다. 단순 CRUD나 한 service에서만 쓰는 짧은 query는 service 내부에 둘 수 있고, query가 길어지거나 여러 service에서 재사용되거나 row mapping이 분리될 때 repository로 뺀다.
- request body 검증은 `ZodValidationPipe`와 `shared/contracts`의 schema를 사용한다.
- 권한이 필요한 endpoint는 `@RequirePermissions(Permissions.*)` 또는 기존 guard 패턴을 사용한다.
- 프론트에 노출되는 response shape는 가능한 한 `shared/contracts` 타입과 이름을 맞춘다.

## Contracts And API Client

- 타입 이름은 `FeatureRecord`, `CreateFeatureRequest`, `UpdateFeatureRequest`, `FeatureListResponse`처럼 현재 패턴을 따른다.
- API path 생성 로직은 `shared/api-client/src/index.ts`의 base URL resolver 패턴을 따른다.
- 새 API client 메서드는 반환 타입을 명시한다.
- 인증이 필요한 API는 `{ retryOnUnauthorized: true }`를 붙이는 것을 기본으로 검토한다.
- `any`는 외부/legacy 응답 경계에서만 임시로 허용하고, 새 기능에는 구체 타입을 둔다.

## Data Fetching

- 현재 프로젝트는 React Query와 로컬 `useEffect` fetch가 혼재한다.
- React Query는 필수가 아니라 선택지다. 캐싱, mutation 후 무효화, 중복 요청 제거, 여러 컴포넌트 간 서버 상태 공유가 필요할 때 우선 사용한다.
- 단순 1회성 조회, 페이지 안에서만 닫히는 작은 admin tool, 기존 manual fetch 흐름에 붙이는 좁은 변경은 로컬 `useEffect`와 state를 사용해도 된다.
- 한 화면 안에서는 React Query와 manual fetch를 불필요하게 섞지 않는다. 기존 흐름을 유지하거나, 전환할 때는 해당 화면의 서버 상태를 한 방향으로 정리한다.
- 검색/정렬/페이지네이션은 데이터 수가 작으면 client-side도 허용하되, 공지사항/설문 응답처럼 커질 수 있는 목록은 API query로 옮기는 것을 우선 검토한다.

## Testing And Verification

- 최소 검증은 `pnpm typecheck`이다.
- shared contract나 api-client를 수정하면 루트 `pnpm build`까지 확인하는 것이 좋다.
- UI 변경은 desktop/mobile viewport를 모두 확인한다.
- 인증/권한이 걸린 admin 페이지는 비로그인, 권한 없음, 권한 있음 상태를 구분해서 확인한다.
- 현재 테스트는 Node 내장 test runner를 사용한다.
- API smoke/regression은 `pnpm --filter @soc/api test`로 실행한다.
- Web smoke/regression은 `pnpm --filter @soc/web test`로 실행한다.
- 전체 회귀 확인은 `pnpm test`로 실행한다.
- 권한, 공개/비공개, 행사-설문 연결, 상시 설문처럼 운영 사고로 이어질 수 있는 규칙은 테스트를 먼저 보강한다.

## Git And Generated Files

- 사용자가 만든 기존 수정은 되돌리지 않는다.
- `dist`, `node_modules`, `*.tsbuildinfo` 같은 산출물이 작업 트리에 보일 수 있으나 기능 변경에 포함하지 않는다.
- 문서나 설정 변경과 기능 구현은 가능하면 커밋 단위를 분리한다.
