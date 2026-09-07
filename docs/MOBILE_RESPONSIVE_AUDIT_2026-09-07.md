# 모바일 반응형 M00 화면·문제 감사 — 2026-09-07

> 참고: 이 문서의 Mock 로그인 관찰은 2026-09-07 M00 감사 당시의 화면/환경 기록이다. 후속 정리에서 Mock 로그인 UI·API·개발 세션 발급 경로는 제거했으며, 아래의 당시 관찰값은 과거 재현 근거로 보존한다.

## 0. 범위와 결론

- 실행 기준: `docs/MOBILE_RESPONSIVE_PLAN_2026-09-07.md`
- 이번 실행 범위: M00 기준 화면 확인, 문제 재현, route 매핑, 개선 기회와 우선순위 기록
- 구현 범위: 없음. 앱 소스와 스타일은 변경하지 않았다.
- 현재 상태: M00 감사 완료. 다음 작업은 `M00-D`다.
- 주의: 아래 `확인`은 실제 Chrome 화면·DOM·뷰포트 측정으로 재현한 사실이며, `미검증`은 API·인증·fixture 차단으로 판단할 수 없었던 상태다. 기존 문서의 소스 관찰만으로 화면 버그를 확정하지 않았다.

핵심 결과는 다음과 같다.

1. `320×740`에서 모바일 메뉴의 English/로그인/Mock 액션이 화면 아래에 배치되고 메뉴를 연 상태에서 스크롤되지 않아 도달할 수 없다. (`P1`, `M03`)
2. `320×740`의 `/about`는 헤더 유틸리티가 문서 폭을 넘어 실제 가로 스크롤바가 생긴다. (`P1`, `M03`)
3. `390×844`에서 데이터가 로드된 게시판 분류 탭과 소개 목차의 마지막 항목이 잘려 보이며, 두 영역 모두 스크롤 affordance가 숨겨져 있다. (`P1`, `M05`/`M09`)
4. 현재 API health는 HTTP 200이지만 `degraded`이며 PostgreSQL 연결이 실패한다. 행사·설문·달력·검색·인증·관리자 화면은 데이터가 있는 정상 상태로 확정할 수 없다. (`P0 환경 차단`, UI 버그로 집계하지 않음)

## 1. 감사 대상과 실행 조건

### 1.1 저장소와 실행 상태

| 항목 | 결과 |
|---|---|
| branch | `main` |
| 감사 시작 시 working tree | 기존 사용자 파일 `docs/MOBILE_RESPONSIVE_PLAN_2026-09-07.md`가 untracked 상태였음. 보존함. |
| Web | Vite 직접 실행, `http://localhost:5173`, 화면 렌더링 가능 |
| API | Node 직접 실행, `http://localhost:3000`, 프로세스는 기동했으나 health는 `degraded` |
| PostgreSQL | 현재 실행 환경에서 `postgres` 호스트를 해석하지 못함(`getaddrinfo ENOTFOUND postgres`) 및 연결 timeout |
| Redis | 프로세스 연결 재시도/`MaxRetriesPerRequestError` 발생 |
| Docker | 실행 가능한 `docker` 명령을 찾지 못해 compose로 DB를 복구하지 못함 |
| Nginx/8080 | 감사 중 사용할 수 있는 8080 서비스가 없어 Vite 5173을 기준으로 확인 |

README의 로컬 실행 안내는 Docker로 DB/Redis를 올린 뒤 `pnpm dev`를 실행하는 방식이다. 현재 `.env`의 API는 Docker compose 내부 호스트명인 `postgres`를 바라보고 있어, 이번 세션의 직접 실행 환경에서는 API 데이터를 제공하지 못했다. `GET http://localhost:3000/health`는 HTTP 200을 반환했지만 PostgreSQL 상태가 `ok: false`인 degraded 응답이었다.

### 1.2 브라우저와 상태

| 항목 | 조건 |
|---|---|
| 브라우저 | Chrome, Codex computer-use CUA의 별도 감사 탭 |
| 공개 인증 상태 | 비로그인 |
| 언어 | 기본 KO. `/` 모바일 메뉴에서 English 전환을 실제 확인한 뒤 KO로 복구 |
| Mock 인증 | 모바일 메뉴의 Mock을 한 번 시도했으나 API HTTP 500으로 session 발급 실패 |
| SSO/실계정 | 입력하지 않음. 실제 테스트 계정 session을 확보하지 못함 |
| 데이터 상태 | 정적 화면과 empty/loading/error 상태는 확인 가능했으나 DB-backed 정상 데이터는 미검증 |
| 뷰포트 | 우선 `390×844`, `1440×900`; 위험 폭 `320×740`, `768×1024`, `1024×768` 추가 확인 |

### 1.3 코드·검사 기준

| 검사 | 결과 |
|---|---|
| `pnpm --filter @soc/web typecheck` | pnpm engine gate에서 중단: 저장소 요구 `11.1.2`, 현재 `11.19.0` |
| Web TypeScript 직접 실행 | 통과 (`tsc --noEmit -p apps/web/tsconfig.json`) |
| UI unit contract 직접 실행 | 통과: `UI unit contract passed.` |
| Web ESLint 직접 실행 | 통과, 출력된 lint error 없음 |
| Web Vite production build 직접 실행 | 통과. dynamic import/static import와 500KB 초과 chunk warning만 발생 |
| Web Node tests 직접 실행 | 통과: 35 passed, 0 failed. test TypeScript를 먼저 compile한 뒤 실행 |
| Playwright 설정 | 저장소에서 별도 Playwright 설정을 발견하지 못함. 실제 화면은 사용 가능한 Chrome CUA로 확인 |

공식 pnpm 명령의 실패는 현재 pnpm 버전 차이로 인한 환경 차단이며, 코드 실패로 분류하지 않았다. 직접 실행 가능한 web 검사와 테스트는 별도로 기록했다.

### 1.4 스크린샷 증거 표기

이번 CUA 도구는 화면을 작업 로그에 inline으로 표시했지만 workspace 파일로 PNG를 내보내는 기능은 제공하지 않았다. 따라서 존재하지 않는 파일 경로를 만들지 않고, 감사 문서에서는 `CUA-inline:<ID>`를 실제 캡처 증거로 표기한다. 해당 ID의 화면은 이 task의 도구 로그에서 route와 viewport를 함께 확인할 수 있다.

| 증거 ID | 화면 | viewport |
|---|---|---:|
| `CUA-inline:M00-CAP-HOME-390` | 홈 | 390×844 |
| `CUA-inline:M00-CAP-HOME-1440` | 홈 | 1440×900 |
| `CUA-inline:M00-CAP-MENU-390` | 홈 모바일 메뉴 | 390×844 |
| `CUA-inline:M00-CAP-MENU-320` | 홈 모바일 메뉴 | 320×740 |
| `CUA-inline:M00-CAP-BOARD-390` | 게시판 목록 | 390×844 |
| `CUA-inline:M00-CAP-BOARD-1440` | 게시판 목록 | 1440×900 |
| `CUA-inline:M00-CAP-ABOUT-390` | 소개 | 390×844 |
| `CUA-inline:M00-CAP-ABOUT-320` | 소개 | 320×740 |
| `CUA-inline:M00-CAP-ABOUT-1024` | 소개 | 1024×768 |
| `CUA-inline:M00-CAP-ABOUT-1440` | 소개 | 1440×900 |
| `CUA-inline:M00-CAP-HOME-768` | 홈 | 768×1024 |
| `CUA-inline:M00-CAP-ROADMAP-390` | 로드맵 목록/과목 상세 | 390×844 |
| `CUA-inline:M00-CAP-ROADMAP-1440` | 로드맵 그래프 | 1440×900 |

## 2. 뷰포트 실측 요약

Chrome desktop의 classic vertical scrollbar 때문에 `innerWidth`와 `document.documentElement.clientWidth`가 다를 수 있다. 아래에서 outer overflow는 `scrollWidth > innerWidth` 또는 실제 body/root 가로 scrollbar가 있는 경우로 판단하고, 내부 탭 스크롤은 별도로 표시했다.

| route/state | viewport | 실측 | 결과 |
|---|---:|---|---|
| `/` 홈 | 390×844 | `clientWidth=375`, `scrollWidth=375` | 문서 outer overflow 없음 |
| `/` 홈 | 768×1024 | `clientWidth=753`, `scrollWidth=753` | 문서 outer overflow 없음 |
| `/about#intro` | 1024×768 | `clientWidth=1009`, `scrollWidth=1009` | 문서 outer overflow 없음 |
| `/` 홈 | 1440×900 | `clientWidth=1425`, `scrollWidth=1425` | 문서 outer overflow 없음 |
| `/about#intro` | 320×740 | `clientWidth=305`, `scrollWidth=330` | 실제 가로 scrollbar; 헤더 유틸리티가 폭 초과 |
| 홈 메뉴 open | 320×740 | menu nav `top=84.8`, `bottom=672.8`; English `top=705.6`, login/Mock `top=761.6` | 하단 액션이 viewport 밖. 메뉴 open 상태의 스크롤 시도에서 `scrollY=0` 유지 |
| `/about#intro` 목차 | 390×844 | 마지막 `후원 및 제휴` link `left≈317`, `right≈417` | 내부 목차에서 마지막 link 42px가 첫 화면 밖 |
| `/about#intro` 목차 | 320×740 | 마지막 link `left≈316.7`, `right≈417` | 내부 목차에서 마지막 link가 크게 잘림 |
| 데이터가 로드된 `/board` | 390×844 | category links `연구실≈329–392`, `FAQ≈396–446` | outer overflow는 없지만 내부 탭 마지막 항목이 clipped |

## 3. 확정된 문제와 개선 기회

우선순위는 이 문서에서 `P0=검증을 막는 차단`, `P1=핵심 경로의 접근/조작에 영향을 주는 높은 우선순위`, `P2=중간 우선순위 개선`, `P3=낮은 우선순위`로 사용한다.

### M00-UI-001 — 320px 모바일 메뉴 하단 액션 도달 불가

- 분류: `버그 / 조작 편의`
- 우선순위: `P1`
- 담당 M번호: `M03` (M02의 overlay/scroll 처리와 연계 가능)
- route/state: `/`, KO, 비로그인, DEV build, 모바일 메뉴 open, `320×740`
- 증거: `CUA-inline:M00-CAP-MENU-320`
- 관찰 사실:
  - 메뉴 본문은 `top=84.8`, `bottom=672.8`까지 보인다.
  - English 버튼은 `top=705.6`, `bottom=749.6`, 로그인과 Mock은 `top=761.6`, `bottom=805.6`이다.
  - viewport의 bottom은 740이므로 세 액션이 화면 아래에 배치된다.
  - 메뉴를 연 상태에서 CUA scroll을 시도했을 때 `scrollY=0`으로 남았고, 메뉴 내부에는 세로 overflow가 없다. 따라서 문서 스크롤로 하단 액션을 가져올 수 없다.
  - 320px 화면에서는 메뉴 항목명이 `전산학부 로드맵`, `학번톡 참여 신청`, `집행위원회 소개`, `공약 이행 상황판`처럼 2줄로 줄바꿈된다. 링크 자체는 눌릴 수 있지만 메뉴 높이를 추가로 밀어 하단 접근성을 악화시킨다.
- 코드 상관관계: `apps/web/src/components/organisms/header.tsx`의 mobile panel은 `absolute ... top-full ... xl:hidden`이고, panel에 viewport 높이·내부 `overflow-y-auto`가 없다. 하위 링크는 `min-h-10`, 하단 액션은 nav 다음에 별도 grid로 렌더링된다.
- 판정: `개선`. 기존 목적지와 기능은 보존하되, 320px에서 마지막 메뉴와 로그인/마이페이지에 접근하는 목표 구조를 `M00-D`에서 먼저 선택해야 한다.

### M00-UI-002 — 320px 소개 헤더의 문서 outer horizontal overflow

- 분류: `버그 / 시각 품질`
- 우선순위: `P1`
- 담당 M번호: `M03` (소개 목차는 `M09`와 연계)
- route/state: `/about#intro`, KO, 비로그인, `320×740`
- 증거: `CUA-inline:M00-CAP-ABOUT-320`
- 관찰 사실:
  - `innerWidth=320`, `documentElement.clientWidth=305`, `documentElement.scrollWidth=330`이다.
  - `.home-header-utilities`의 rect가 `left=240`, `right=330`으로 측정되어 viewport 오른쪽을 10px 넘는다.
  - 실제 캡처 하단에 가로 scrollbar가 보인다. 이는 소개 목차 내부의 의도된 가로 탐색과 별개로 문서/root 폭 자체가 늘어난 상태다.
- 코드 상관관계: 공통 header의 `home-header-utilities` flex rail과 320px 조건의 좌우 여백 조합에서 발생한다. 현재 root의 `overflow-x`는 auto다.
- 판정: `개선`. M03에서 320px 헤더의 로고·검색·메뉴·로그인/언어 유틸리티가 viewport 안에서 함께 정렬되는 규칙을 확정해야 한다.

### M00-UI-003 — 390px 게시판 분류 탭의 마지막 항목 발견성 부족

- 분류: `사용성 / 시각 품질`
- 우선순위: `P1`
- 담당 M번호: `M05`
- route/state: `/board`, KO, 비로그인, 게시판 catalog가 로드된 첫 390px run, `390×844`
- 증거: `CUA-inline:M00-CAP-BOARD-390`
- 관찰 사실:
  - outer `scrollWidth`는 375로 page 전체 가로 overflow는 없었다.
  - category link 위치는 `전체 20–70`, `공지 74–124`, `HoC 128–179`, `홍보글 183–246`, `건의사항 250–325`, `연구실 329–392`, `FAQ 396–446`으로 측정됐다.
  - 첫 화면 오른쪽에서 `연구실`이 잘리고 `FAQ`는 보이지 않는다. 내부 가로 스크롤은 가능하지만 scrollbar가 숨겨져 있고 다음 항목이 있다는 affordance가 없다.
  - API가 degraded인 상태로 다시 진입했을 때는 catalog 자체가 `전체`만 남아 정상 데이터가 있는 목록 상태를 재검증할 수 없었다.
- 코드 상관관계: `apps/web/src/components/ui/page-layout.tsx`의 `PageTabs`는 `overflow-x-auto`와 hidden scrollbar를 사용한다. 내부 스크롤 자체는 계획에서 허용한 패턴이지만, 핵심 게시판 목적지가 첫 상태에서 발견되지 않는 문제는 별도 개선 대상이다.
- 판정: `개선`. `M00-D`에서 한 줄 tabs를 유지할지, filter/sheet 또는 compact select로 바꿀지 결정하고 정상 catalog에서 재검증한다.

### M00-UI-004 — 소개 페이지 section navigation의 마지막 목적지 clipped

- 분류: `사용성 / 시각 품질`
- 우선순위: `P1`
- 담당 M번호: `M09`
- route/state: `/about#intro`, KO, 비로그인, `390×844` 및 `320×740`
- 증거: `CUA-inline:M00-CAP-ABOUT-390`, `CUA-inline:M00-CAP-ABOUT-320`
- 관찰 사실:
  - 390px에서 마지막 `후원 및 제휴` link가 `left≈317`, `right≈417`로 측정되어 첫 화면에서 오른쪽 약 42px가 잘린다.
  - 320px에서는 같은 link가 `left≈316.7`, `right≈417`로 측정되어 대부분이 처음 보이지 않는다.
  - 목차는 내부 horizontal scroll이지만 scrollbar를 숨긴다. 사용자는 가로로 밀어야만 마지막 목적지를 발견할 수 있다.
  - 소개 hero와 본문 자체는 390px에서 세로 흐름으로 읽히고, 1024px·1440px에서는 hero와 목차가 정상적으로 맞았다. 문제는 목차의 좁은 폭 대응이다.
- 코드 상관관계: `apps/web/src/styles.css`의 `.about-section-nav-inner`가 `overflow-x:auto`이고 scrollbar를 숨기며, 각 link는 `white-space:nowrap`이다.
- 판정: `개선`. 현재 anchor 목적지는 유지하면서 `M00-D`에서 visible affordance, compact navigation, 또는 다른 모바일 정보 구조를 비교한다.

### M00-OBS-005 — 모바일 핵심 control의 계획상 44px 목표 미달

- 분류: `개선 기회 / 조작 편의`
- 우선순위: `P2`
- 담당 M번호: `M01`, `M03`
- route/state: 홈 header와 mobile menu, KO, 비로그인, `390×844` 및 `320×740`
- 관찰 사실:
  - header의 icon button은 실제 화면에서 약 36px 정사각형으로 측정됐다. `IconButton`의 기본 `md`는 `--ui-control-height-compact=2.25rem`이다.
  - mobile menu leaf link는 `min-h-10`, 즉 40px이다. group header와 하단 액션은 44px 이상이다.
  - 이 항목은 현재 run에서 직접 조작 불가로 이어지지는 않았으므로 P1 버그가 아닌 P2 개선 기회로 분리했다.
- 판정: `개선`. M00-D에서 44×44 목표와 메뉴 높이/320px 도달성의 trade-off를 함께 정한다.

## 4. 환경 차단과 미검증 상태

### M00-ENV-001 — API/DB degraded로 데이터·인증·관리자 검증 차단

- 분류: `환경 차단` (반응형 UI 버그로 집계하지 않음)
- 우선순위: `P0 검증 차단`
- 영향 M번호: `M07`, `M08`, `M10`, `M11`; 일부 `M04`, `M05`, `M06`
- 확인 근거:
  - API는 `http://localhost:3000`에서 기동했지만 health 응답은 `status=degraded`, PostgreSQL `ok=false`였다.
  - API log에서 `getaddrinfo ENOTFOUND postgres`, PostgreSQL connection timeout, Redis `MaxRetriesPerRequestError`를 확인했다.
  - Vite proxy를 통해 `/v1/site-content/blocks/public`, `/v1/boards`, `/v1/boards/_EVENT/articles`, `/v1/calendar/events`, `/v1/surveys/list/public`, `/v1/auth/session` 등이 실패하거나 장시간 loading 상태였다.
  - Mock 로그인은 모바일 메뉴에서 시도했으나 `handleMockLogin`의 API 요청이 HTTP 500으로 종료됐다.
- 화면 영향:
  - 홈의 행사/소식/일정은 skeleton, 빈 상태 또는 API 실패 후 empty 상태가 섞여 보였다.
  - `/events`, `/surveys`, `/calendar`는 error/loading 상태로 남아 정상 카드·달력 데이터의 폭을 확인할 수 없었다.
  - `/search`는 검색 shell은 보였으나 결과 요청 실패 문구가 나왔다.
  - `/survey/:id`는 header 아래 main이 비어 보였고, `/survey/:id/results`는 `목록으로`만 보이는 상태였다.
  - `/admin`, `/admin/users`, `/admin/surveys/new` 직접 진입은 인증 query가 끝나지 않아 정상 관리자 shell/editor가 나타나지 않고 public header 또는 빈 main만 남았다.
- 판정: `미검증`. DB/Redis를 복구하고 reference/demo seed 및 승인된 SSO test account를 확보한 뒤 data-rich 상태를 다시 측정해야 한다. 이 차단 화면을 근거로 UI 구현을 먼저 시작하지 않는다.

## 5. 대표 화면 결과

| 화면/route | 390×844 | 1440×900 | 위험 폭 확인 | 로그인/언어 | 판정 | 담당 |
|---|---|---|---|---|---|---|
| 홈 `/` | hero, KO/SoC brand, heading, footer 확인. data widget은 empty/loading 영향 | desktop GNB와 큰 hero 확인. API 이후 widget data는 empty/미검증 | 320 메뉴, 768×1024 홈 확인. 320 메뉴 하단 접근 불가 | 비로그인 KO; English 메뉴도 390에서 확인 후 KO 복구 | `개선` (콘텐츠 상태는 API 복구 후 재평가) | M04/M03 |
| 모바일 메뉴 `/` | 390에서는 전체 목적지와 로그인/Mock을 한 화면에서 확인 | desktop GNB 확인 | 320에서 하단 액션 도달 불가, 일부 link 2줄 | KO/EN 메뉴 모두 390에서 확인 | `개선` | M03 |
| 게시판 목록 `/board`, `/board/:category` | empty/loading shell, 390에서 category clipping을 한 번 확인 | empty DataViewCard와 pagination shell이 폭 안에 맞음. 정상 catalog 미검증 | 320/768/1024 data-rich table 미검증 | 비로그인 KO | `개선` | M05 |
| 게시판 상세 `/board/:category/:articleId`, 행사 상세 `/events/:articleId` | 존재하는 fixture/DB 응답을 못 받아 정상 본문 미검증 | 미검증 | 미검증 | 비로그인 | `미검증` | M06 |
| 게시판 작성/수정 `/board/write`, `/board/:category/write`, `/board/:category/:articleId/edit`, 행사 write/edit | auth/API query가 끝나지 않아 정상 editor 미검증 | 미검증 | 미검증 | 비로그인; 승인된 SSO test account 없음 | `미검증` | M06 |
| 행사·설문 목록 `/events`, `/surveys` | error/loading 상태. 정상 1열 카드와 긴 제목 미검증 | 정상 data 상태 미검증 | 미검증 | 비로그인 KO | `미검증` | M08 |
| 전체 달력 `/calendar` | API 실패 상태. 7열 grid와 선택일 agenda 미검증 | 미검증 | 기존 min-width/내부 overflow는 소스 관찰일 뿐 화면 버그로 확정하지 않음 | 비로그인 KO | `미검증` | M08 |
| 설문 참여/결과 `/survey/:id`, `/survey/:id/results` | 알려진 ID로 진입했으나 main이 비거나 `목록으로`만 보임 | 미검증 | 문항 유형·표형 문항·검증 오류 미검증 | 비로그인 KO | `미검증` | M07 |
| 투표 `/votes`, `/votes/:id` | 목록의 `현재 공개된 투표가 없습니다.` empty state는 폭 안에 맞음. 상세는 loading | 미검증 | 긴 선택지/결과 차트 미검증 | 비로그인 KO | 목록 `유지`, 상세 `미검증` | M07 |
| 소개 `/about` | hero와 CTA는 세로로 읽힘. 목차 마지막 link clipped | 2열 hero와 목차가 폭 안에 맞음 | 320 header outer overflow, 1024×768 hero/목차 확인 | 비로그인 KO | `개선` | M09/M03 |
| 로드맵 `/life/roadmap` | 검색·학기·chip·과목 list 확인. 과목 선택 시 inline detail card 확인 | graph와 legend 확인 | 320/768의 긴 과목명·확대/드래그 미검증 | 비로그인 KO | `유지(측정 범위)`; M00-D에서 관계 탐색 검토 | M09 |
| 통합검색 `/search` | search shell과 filter는 폭 안에 맞음. 결과 요청은 API 실패 | 정상 결과 미검증 | 결과가 많은 경우 미검증 | 비로그인 KO | shell `유지`, 결과 `미검증` | M05 |
| FAQ `/board/faq`, `/board/faq/:articleId` | empty/loading shell 확인. 정상 FAQ data/상세 미검증 | 미검증 | category/filter 상태 미검증 | 비로그인 KO | `미검증` | M05/M06 |
| 로그인 `/login` | callback query 없이 `로그인 처리 중` 상태 확인 | 미검증 | 실제 SSO·동의·복귀 미검증 | 비로그인 KO | `미검증` | M09 |
| 마이페이지 `/mypage` | 비로그인 안내와 로그인 link 확인 | 미검증 | authenticated profile/activity/scrap/draft 미검증 | 비로그인 KO | `유지(비로그인 상태)`, authenticated `미검증` | M09 |
| 약관/개인정보 `/terms`, `/privacy` | 긴 TOC와 본문 확인, 390 outer overflow 없음 | 미검증 | 320/영문/글자 확대 미검증 | 비로그인 KO | `유지(측정 범위)` | M09 |
| 관리자 목록 `/admin`, `/admin/users`, `/admin/surveys`, 기타 admin list | auth/API 차단으로 public header 또는 빈 main만 확인 | 미검증 | 1024 미만 관리자 안내, 표 내부 scroll 미검증 | 인증 session 없음 | `미검증` | M10 |
| 관리자 편집 `/admin/surveys/new`, `/admin/surveys/:id/edit`, responses, votes editor 및 기타 편집 | auth/API 차단으로 정상 editor 미검증 | 미검증 | modal/form/keyboard/저장 상태 미검증 | 인증 session 없음 | `미검증` | M11 |

화면 판정에서 `유지`는 모든 상태가 완성됐다는 뜻이 아니라, 이번에 실제로 볼 수 있었던 상태에서 반응형 문제가 재현되지 않았다는 뜻이다. 정상 API 데이터와 영문/인증 상태가 필요한 화면에는 유지 판정을 확장하지 않았다.

## 6. 현재 route → 작업 ID 매핑

아래는 `apps/web/src/App.tsx`의 현재 route 선언을 기준으로 한 누락 방지용 매핑이다. redirect route도 별도 표기했다.

| 현재 route pattern | M00에서의 상태 | 후속 작업 |
|---|---|---|
| `/` | 홈 shell, 390/768/1440 확인; data widget은 API 영향 | M04, 공통 메뉴는 M03 |
| `/about` 및 `/about#intro`, `#pledges`, `#people`, `#partnership` | 소개 hero/본문 확인; 390/320 목차 clipping | M09, header는 M03 |
| `/life/roadmap` | 390 list/detail, 1440 graph 확인 | M09 |
| `/about/roadmap` | `/life/roadmap`으로 redirect되는 route | M09 |
| `/events-surveys` | legacy redirect route; 정상 목록은 `/events` 기준 | M08 |
| `/events`, `/surveys`, `/calendar` | API degraded로 error/loading; 정상 data 미검증 | M08 |
| `/events/:articleId` | 행사 상세 정상 본문 미검증 | M06 |
| `/events/write`, `/events/:articleId/edit` | 인증/정상 editor 미검증 | M06 |
| `/privacy`, `/terms` | 390 긴 문서 확인, outer overflow 없음 | M09 |
| `/board/faq` | empty/loading shell 확인; 정상 catalog/data 미검증 | M05 |
| `/board/faq/:articleId` | FAQ 상세 미검증 | M06 |
| `/about/faq` | `/board/faq` redirect route | M05 |
| `/about/pledges` | `/about#work` redirect route | M09 |
| `/search` | search shell 확인; result API 미검증 | M05 |
| `/board` 및 `/board/:category` | list shell 확인; 정상 catalog run에서 tabs clipping | M05 |
| `/board/FAQ` | `/board/faq` legacy redirect route | M05 |
| `/board/_EVENT` | `/events` legacy redirect route | M08 |
| `/board/_EVENT/write` | `/events/write` legacy redirect route | M06 |
| `/board/write`, `/board/:category/write` | 인증/작성 editor 미검증 | M06 |
| `/board/:category/:articleId` | 게시글 상세 미검증 | M06 |
| `/board/:category/:articleId/edit` | 게시글 수정 editor 미검증 | M06 |
| `/survey/:id`, `/survey/:id/results` | 참여/결과 main이 API 영향으로 미검증 | M07 |
| `/votes`, `/votes/:id` | 목록 empty state 확인, 상세 loading | M07 |
| `/login` | callback loading 확인; 실제 SSO 미검증 | M09 |
| `/mypage` | 비로그인 안내 확인; 인증 후 기능 미검증 | M09 |
| `/admin` index, `/admin/surveys`, `/admin/users`, `/admin/audit-logs`, `/admin/permissions`, `/admin/finance`, `/admin/boards`, `/admin/faq`, `/admin/moderation`, `/admin/votes`, `/admin/content`, `/admin/roadmap`, `/admin/calendar`, `/admin/contacts`, `/admin/emails` | 인증/API 차단으로 정상 관리자 목록·shell 미검증 | M10 |
| `/admin/surveys/new`, `/admin/surveys/:id/edit`, `/admin/surveys/:id/responses`, `/admin/surveys/:id/responses/:responseId`, `/admin/votes/new`, `/admin/votes/:id` | 인증/API 차단으로 editor/detail/modal 미검증 | M11 |
| `*` | 404 전용 화면을 정상 데이터 조건에서 별도 확인하지 못함 | M09 |

## 7. M00-D로 넘길 설계 결정

M00-D에서 구현 전에 아래 목표를 확정한다.

1. `M03`: 320px 메뉴가 viewport 안에서 내부 scroll을 갖거나 하단 action을 별도 고정/접근 가능한 구조로 제공해야 한다. 모든 하위 목적지, English, 로그인, 로그인 후 마이페이지 접근을 보존한다.
2. `M03`: 320px header의 brand rail과 utility rail을 viewport 안에 맞추고, KO/EN 문자열이 바뀌어도 outer horizontal scroll이 생기지 않게 한다.
3. `M05`: 게시판/FAQ category navigation을 hidden-scroll tabs로 유지할지, visible scroll cue·compact select·filter sheet로 바꿀지 390px 목표안을 비교한다. 정상 catalog와 결과 목록을 기준으로 결정한다.
4. `M09`: 소개 section navigation에서 모든 anchor의 발견성과 현재 위치 표시를 보존한다. 로드맵은 현재 list와 1440 graph의 장점을 비교해 관계 탐색 목표를 정한다.
5. `M07`, `M08`, `M10`, `M11`: DB/Redis 및 승인된 SSO 관리자 test account를 확보한 뒤 정상 데이터의 카드·달력·문항·표·editor를 확인하고 나서 목표안을 정한다. 현재 error/loading 화면만으로 재설계하지 않는다.

## 8. 남은 검증 범위

- PostgreSQL/Redis 복구, migration/seed 후 API 정상 health와 data-rich 상태
- 승인된 SSO 관리자 test account로 관리자 사용자 목록·설문 목록·설문 editor·response detail
- 정상 게시글/행사/설문 fixture가 있는 상세·작성·수정 흐름
- 설문 문항 유형, 표형 문항, 긴 보기, validation error, upload 실패/재시도, 결과 차트
- 전체 달력의 month grid, 선택일 agenda, 다일 일정과 내부 overflow
- 390px의 정상 목록 상태와 320px/768px 위험 화면의 data-rich 상태 재확인
- English의 모든 route, `html lang`, 긴 번역 문자열
- 844×390 가로 모바일, 200% 확대, Tab/Escape/focus return, 모바일 키보드와 safe-area
- Android Chrome/iOS Safari 실기기 동작 및 reduced-motion
- CUA inline 캡처를 파일로 내보낼 수 있는 환경에서 기준 PNG 경로 보강

## 9. 변경 파일과 다음 작업

- 이번 실행에서 추가한 파일: `docs/MOBILE_RESPONSIVE_AUDIT_2026-09-07.md`
- 앱 구현 파일: 변경 없음
- 기존 untracked 계획서: `docs/MOBILE_RESPONSIVE_PLAN_2026-09-07.md`, 변경·삭제 없음
- 다음 작업: `M00-D` — 감사 결과를 바탕으로 390px 대표 목표안, 320px·768px 배치 규칙, 유지/개선/재설계 선택을 문서화한다.
