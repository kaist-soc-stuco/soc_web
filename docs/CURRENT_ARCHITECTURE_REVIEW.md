# Current Architecture Review

작성일: 2026-05-29

이 문서는 현재 코드베이스를 기준으로 한 구조 리뷰입니다. 학생회 사이트 규모에 맞게, 과한 엔터프라이즈식 분리보다 기능 추가 시 흔들리지 않는 현실적인 구조를 목표로 합니다.

## 현재 구조

```text
apps/
  api/   NestJS API, Drizzle/Postgres, Redis session, feature modules
  web/   React/Vite, page routes, UI components, hooks, frontend lib
shared/
  common/      시간/권한 등 공통 유틸리티
  contracts/   API request/response 타입, Zod schema, permission registry
  api-client/  typed fetch client
  config/      공유 tsconfig/eslint config
infra/
  docker/   compose/nginx/redis 설정
  scripts/  DB migrate/seed helper
docs/       개발 규칙과 리뷰 문서
```

## 잘 잡힌 부분

- `shared/contracts`와 `shared/api-client`가 있어 프론트/백엔드 계약을 맞추기 쉽습니다.
- API는 `features/*` 중심으로 나뉘어 있어 board, survey, auth, role-groups 같은 경계가 비교적 분명합니다.
- 권한 bit 값은 `shared/contracts/src/permissions-registry.ts`를 원천으로 두고 seed와 프론트 표시가 따라가는 방향이 잡혀 있습니다.
- Docker compose, nginx reverse proxy, Postgres, Redis, 업로드 volume이 단일 서버 배포 규모에는 충분히 단순합니다.
- atomic design을 강제하지 않고 `components/ui`, page-local helper, feature-local extraction을 상황에 따라 쓰는 방향이 이 프로젝트 규모에 맞습니다.

## 구조적 문제와 우선순위

### P0: 배포 전 정리

1. 산출물과 의존성 폴더 정리 확인
   - `dist`, `node_modules`, `*.tsbuildinfo`, 업로드 샘플 파일이 작업 트리에 보입니다.
   - 실제 git 추적 여부를 확인하고, 추적 중이면 별도 정리 작업으로 제거해야 합니다.

2. 환경 변수 단순화 유지
   - `DATABASE_URL`, `REDIS_HOST`, `REDIS_PORT`, 프론트용 `VITE_SSO_*`는 기본 환경에서 제거했습니다.
   - DB 도구는 `POSTGRES_*`에서 URL을 파생하고, SSO 설정은 API 서버의 `SSO_*`로만 관리합니다.
   - 운영 배포 시 `.env`의 개발 secret은 반드시 교체해야 합니다.

3. 런타임 검증
   - 사용자가 별도로 완료했습니다.

### P1: 유지보수성 개선

1. 게시판 메타데이터의 최종 원천 정리
   - 프론트 fallback metadata는 `apps/web/src/lib/board-metadata.ts`에 두고, 주요 게시판 탭/헤더/글쓰기 권한은 서버 `GET /boards` 응답을 우선 사용하도록 전환했습니다.
   - 게시판 전체 탭의 검색/정렬/페이지네이션도 서버 endpoint로 전환했습니다.

2. 큰 page 파일 축소
   - `board-detail-page`, `events-surveys-page`, `permission-page`는 이미 기능이 많아졌습니다.
   - 전면 폴더 이동보다, 다음 수정 시 `components` 또는 page 옆 feature-local 파일로 `AttachmentList`, `CommentThread`, `RolePermissionMatrix`, `EventSurveyCard` 같은 단위를 빼는 방식이 안전합니다.

3. 목록 API의 서버 측 검색/정렬/페이지네이션
   - 게시판 전체 탭은 서버의 all-board endpoint로 전환했습니다.
   - 남은 우선순위는 survey admin list, my page activity 순서가 적절합니다.

4. 업로드 파일 lifecycle
   - 현재 로컬 폴더 저장과 DB asset 연결은 충분히 현실적입니다.
   - 다만 글 작성 중 업로드 후 글을 저장하지 않은 파일, 글 수정 시 제거된 파일 cleanup 정책이 필요합니다.

### P2: 점진 개선

1. data fetching 기준 정리
   - React Query는 세션처럼 공유/캐시가 필요한 상태에 적합합니다.
   - 단일 페이지 내부에서 닫히는 목록은 기존 manual fetch도 허용하되 loading/error/cancel 패턴을 맞추는 정도가 현실적입니다.

2. response runtime schema 확대
   - request body는 Zod pipe가 적용되어 있습니다.
   - 외부 SSO 응답, auth session, board detail처럼 오류 비용이 큰 경계부터 response schema를 추가하면 효과가 큽니다.

3. UI layout 기준 통일
   - 공지/설문관리/과비관리의 compact density를 기준으로 page title, body max-width, section gap을 맞추는 편이 좋습니다.
   - 새 화면마다 새 dashboard 스타일을 만들지 말고, 운영툴형 compact layout을 기본값으로 둡니다.

## 추천 작업 순서

1. 로그인/세션/권한 E2E 흐름 확인.
2. 큰 page 파일에서 반복 UI만 작게 추출.
3. confirm dialog / attachment list 같은 반복 UI를 공유화.
4. 운영 secret/CORS/SSO redirect 설정 최종 확인.
