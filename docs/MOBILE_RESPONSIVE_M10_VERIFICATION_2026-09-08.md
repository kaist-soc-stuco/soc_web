# 모바일 반응형 M10 검증 기록

- 검증일: 2026-09-08 (Asia/Seoul)
- 대상: `docs/MOBILE_RESPONSIVE_PLAN_2026-09-07.md`의 M10
- 범위: 관리자 공통 헤더·탐색·toolbar·표, 사용자·설문·투표·콘텐츠 조정·운영 로그 목록, 연락망 목록·상세 진입, 공통 관리자 drawer
- 원칙: 기존 API·실제 SSO·권한별 메뉴 노출·선택/정렬/일괄 처리 핸들러를 유지하고, 모바일에서 정보 위계와 조작 영역을 개선한다.

## 1. 실행 전 재현 감사

M00/M09에서 관리자 route를 실제 브라우저로 열었을 때 익명 상태는 실제 SSO로 이동했고, 관리자 데이터 화면까지 진행할 수 없었다. 이번 실행에서도 같은 조건을 확인했다.

| 확인 대상 | 실제 결과 | 판정 |
| --- | --- | --- |
| `/admin/users` 익명 진입 | 로컬 앱에서 `https://ssodev.kaist.ac.kr/auth/kaist/error/code`로 이동하고 `오류가 발생하였습니다. 서버 내부 오류가 발생하였습니다.`가 표시됨 | 관리자 UI 인증 후 렌더링은 계정 제약으로 보류 |
| `/admin/permissions` 익명 진입 | 동일한 실제 SSO 보호 흐름으로 이동함 | Mock 로그인·쿠키 주입 없이 인증 경계를 유지 |
| 관리자 모바일 탐색 | 기존 구조는 모든 관리 목적지를 한 줄 수평 내비게이션에 나열함. 목적지가 늘어날수록 현재 위치와 다른 업무 전환을 동시에 파악하기 어려움 | 선택형 업무 전환으로 개선 |
| 관리자 목록 | `AdminDataTable`은 표 내부 가로 스크롤을 제공하지만, 사용자·설문·투표·운영 로그처럼 개별 항목 확인/처리가 중심인 목록은 모바일 카드 정보 위계가 필요함 | 카드 모드를 opt-in으로 추가 |
| 연락망 | 드래그 정렬 가능한 1120px 그리드가 좁은 화면에서도 표 폭을 유지함 | 동일 데이터·정렬 핸들러를 유지하는 연락처 카드로 재배치 |

## 2. 적용 내용

- 관리자 모바일 내비게이션을 권한으로 필터링된 native `select`로 바꿨다. 현재 경로를 선택 상태로 표시하고, 데스크톱 사이드바와 메뉴 노출 조건은 유지했다.
- 관리자 공통 페이지 여백·페이지 제목·작업 영역·pagination을 좁은 폭에서 줄어들도록 조정했다. 제목은 잘리지 않고 줄바꿈하며, 작업 버튼은 좁은 행 안에서 wrapping 된다.
- `AdminDataTable`에 기본값이 표인 `mobileMode="cards" | "table"`을 추가했다. 카드 모드에서도 같은 `<tr>`·상태·정렬·키보드·row action 핸들러를 사용한다.
- 다음 개별 항목 중심 목록을 모바일 카드로 전환했다.
  - 사용자: `/admin/users`
  - 설문: `/admin/surveys`
  - 투표: `/admin/votes`
  - 숨김 게시글·댓글: `/admin/moderation`
  - 운영 로그: `/admin/audit-logs`
- 카드의 보조 값에는 `data-mobile-label`을 붙여 상태·일시·담당자·작업 등의 의미를 잃지 않게 했다. 카드의 action button과 연락망 순서 변경 핸들은 모바일 최소 터치 영역 기준을 따른다.
- 연락망 `/admin/contacts`는 native table이 아닌 sortable grid이므로 별도 모바일 row layout을 추가했다. 이름·학번·활동 연도·직책·연락처를 한 사람 단위 카드로 읽을 수 있고, row click·키보드 열기·드래그 정렬 핸들러는 그대로 유지된다.
- `AdminDrawer`의 모바일 좌우 여백을 줄이고 하단 safe-area를 유지했다. close button의 한국어/영어 accessible label도 현재 언어에 맞춘다.
- 과비·권한처럼 선택·다중 처리·값 비교가 핵심인 표, 게시판·FAQ·로드맵처럼 재정렬/복잡한 편집이 중심인 화면은 기본 표와 내부 가로 스크롤을 유지했다. 페이지 전체가 아니라 표 viewport만 가로로 이동하는 기존 계약을 보존한 선택이다.
- Mock 로그인 UI·라우트·토큰을 추가하지 않았고, 실제 SSO 보호 흐름을 유지했다.

주요 변경 파일:

- `apps/web/src/components/organisms/admin-layout.tsx`
- `apps/web/src/components/organisms/admin-sidebar.tsx`
- `apps/web/src/components/ui/admin-data-table.tsx`
- `apps/web/src/components/ui/admin-drawer.tsx`
- `apps/web/src/components/ui/admin-page.tsx`
- `apps/web/src/styles.css`
- `apps/web/src/features/admin-users/user-management-page.tsx`
- `apps/web/src/features/admin-surveys/survey-list-page.tsx`
- `apps/web/src/pages/admin/vote-list-page.tsx`
- `apps/web/src/pages/admin/content-moderation-page.tsx`
- `apps/web/src/features/admin-audit/audit-log-page.tsx`
- `apps/web/src/features/admin-contacts/contacts-page.tsx`

## 3. 실제 런타임 검증

### Docker·API·DB

- `docker compose -f compose.yml build web`: 통과
- `docker compose -f compose.yml up -d web`: 통과
- Postgres: `soc_web-postgres-1 Up (healthy)`
- API: `soc_web-api-1 Up`
- Redis: `soc_web-redis-1 Up`
- Web: `soc_web-web-1 Up`
- `GET http://127.0.0.1:3000/health`: `status=ok`, `postgres.ok=true`, `redis.ok=true`
- migration one-shot container도 정상 종료했다. 데이터 볼륨 삭제·DB 초기화는 하지 않았다.

### 브라우저

- 로컬 `http://127.0.0.1:5173/admin/users`를 실제 in-app Chromium 탭에서 열었다.
- 앱의 익명 관리자 보호에 따라 외부 SSO URL로 이동한 뒤 오류 페이지가 표시됐다. 승인된 관리자 SSO 계정이 없는 환경이므로 사용자 목록 카드, row detail drawer, 작업 저장 결과를 임의 세션으로 재현하지 않았다.
- M00/M09에서 확인한 `/admin/permissions`의 동일한 SSO redirect 결과와 일치한다.
- 따라서 이번 문서에서 인증 후 카드의 실제 픽셀 치수나 관리자 데이터 조작 성공을 통과로 주장하지 않는다. 해당 항목은 승인된 관리자 테스트 계정이 제공되면 390px·320px·768px·1440px에서 재검증해야 한다.

## 4. 자동 검증

| 명령 | 결과 |
| --- | --- |
| `pnpm --filter @soc/web typecheck` | 통과 |
| `pnpm --dir apps/web lint:units` | 통과 (`UI unit contract passed`) |
| `pnpm --filter @soc/web lint` | 통과 |
| `pnpm --filter @soc/web build` | 통과 |
| `pnpm --filter @soc/web test` | 35 pass, 0 fail |
| `git diff --check` | 통과 |

빌드의 기존 informational warning(큰 청크, `not-found-page.tsx`의 동적·정적 import 중복)은 실패가 아니며 이번 변경으로 새 오류가 발생하지 않았다.

## 5. 제한 사항과 다음 작업

- 실제 관리자 권한 계정과 SSO 인증 상태가 없어 관리자 목록 데이터, 카드 높이, detail drawer 열기, 선택→상세→수정/확인 흐름은 브라우저에서 완료하지 못했다.
- 네이티브 iOS·Android 기기와 VoiceOver/TalkBack은 검증하지 않았다. 브라우저 자동 검증은 실제 SSO 경계까지만 수행했다.
- 과비·권한·일정·게시판·FAQ·로드맵의 표/복잡 편집은 M10에서 기존 내부 viewport와 기능을 유지했다. 카드 전환 또는 모바일 단순 재정렬 안내가 필요한 화면은 M11의 화면별 검증 대상으로 남긴다.

## 판정

M10의 공통 관리자 탐색·여백·drawer·목록 표현 기반과 개별 항목 중심 목록의 모바일 카드 전환을 구현했다. DB/API와 Docker 런타임은 정상이다. 인증 후 관리자 데이터 화면의 실제 브라우저 상호작용만 SSO 테스트 계정 부재로 보류하며, Mock 로그인은 도입하지 않았다.

다음 작업: `M11` — 관리자 복잡 편집·재정렬 화면과 인증 후 대표 관리자 route의 모바일/데스크톱 상호작용 검증.
