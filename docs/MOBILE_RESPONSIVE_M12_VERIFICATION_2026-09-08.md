# 모바일 반응형 M12 최종 회귀·인계 감사 — 2026-09-08

## 1. 범위와 최종 판정

- 기준: `docs/MOBILE_RESPONSIVE_PLAN_2026-09-07.md`의 M12
- 대상: M00에서 기록한 공개·인증·관리자 route, M00 문제 목록, M00-D 목표안, M01–M11 변경 이후의 회귀
- 실행 환경: Docker Compose 로컬 스택, 실제 PostgreSQL/Redis 데이터, Codex in-app Chromium
- 최종 판정: 접근 가능한 공개 범위의 P1 반응형 문제는 재현되지 않았다. M00의 관리자·인증 관련 항목은 실제 SSO 경계까지 확인했으나 승인된 테스트 계정이 없어 인증 후 UI와 저장은 미검증이다.
- 외부 효과: 실제 메일 발송·예약, 결제·납부 확정, 원장 반영, 운영 데이터 삭제는 실행하지 않았다.

M12 완료 기준에 따라 미검증 환경을 통과로 바꾸지 않았다. 따라서 이 문서는 구현 완료 목록과 남은 QA 범위를 분리한 인계 문서다.

## 2. M00 문제 목록 갱신

| ID | M00 문제 | 현재 판정 | 근거 |
|---|---|---|---|
| M00-UI-001 | 320px 모바일 메뉴의 English/로그인 하단 액션 도달 불가 | 해결·재현 확인 | 320×740에서 메뉴 패널 `top=68`, `bottom=740`. 내부 nav는 `overflow-y:auto`, `clientHeight=538`, `scrollHeight=1052`. English `top=620–664`, 로그인 `top=676–720`으로 viewport 안에 접근 가능했다. |
| M00-UI-002 | 320px 소개 헤더의 문서 outer horizontal overflow | 해결·재현 확인 | `/about`, 320×740에서 `document.clientWidth=305`, `scrollWidth=305`, `body.clientWidth=305`, `body.scrollWidth=305`. |
| M00-UI-003 | 게시판 분류 탭 뒤쪽 항목 발견성 부족 | 해결·회귀 확인 | M05에서 320px selector/sheet로 전환했고, 현재 `/board` 320×740에서도 문서 outer overflow가 없다. 모든 분류 접근은 M05 실제 데이터 검증에 기록됐다. |
| M00-UI-004 | 소개 section navigation 마지막 목적지 clipped | 해결·회귀 확인 | M09에서 768px 미만 native selector로 전환했다. 현재 `/about` 390px AX tree에서 `후원 및 제휴`를 포함한 4개 옵션이 모두 존재하고, 320px outer overflow도 없다. |
| M00-OBS-005 | 모바일 핵심 control의 34–40px 목표 미달 | 개선 반영·대표 확인 | M09–M11에서 주요 모바일 control, 카드 action, modal/drawer action에 44px 목표와 safe-area 규칙을 적용했다. 모든 복잡 편집 조작의 인증 후 픽셀 검증은 아래 제한 사항에 포함한다. |
| M00-ENV-001 | DB/API degraded로 데이터·인증·관리자 검증 차단 | DB/API 해결, 인증 후 상태 미검증 | `postgres healthy`, API health `status=ok`, `postgres.ok=true`, `redis.ok=true`. 관리자 대표 route는 실제 SSO error page로 이동했다. Mock 로그인·쿠키 주입·토큰 우회는 사용하지 않았다. |

## 3. 실제 브라우저 회귀 결과

### 3.1 390×844 공개 route 전체

브라우저 viewport override를 `390×844`로 설정하고 API·이미지 로딩 후 다음 route를 실제로 열었다. 모든 route에서 `document.documentElement.scrollWidth`와 `document.body.scrollWidth`가 CSS viewport 폭 이하였으며, 아래의 `375px` client width는 Chromium classic scrollbar를 제외한 값이다.

| route | 최종 URL/상태 | h1 또는 확인 내용 | document/body 폭 |
|---|---|---|---|
| `/` | 로컬 렌더링 | `KAIST School of Computing Student Council` | `375 / 375` |
| `/about` | `/about#intro` 로컬 렌더링 | `전산학부집행위원회` | `375 / 375` |
| `/life/roadmap` | 로컬 렌더링 | 목록·검색 shell 로드 | `375 / 375` |
| `/events` | 로컬 렌더링 | `행사` | `375 / 375` |
| `/surveys` | 로컬 렌더링 | `설문` | `375 / 375` |
| `/calendar` | 로컬 렌더링 | `일정` | `375 / 375` |
| `/board` | 로컬 데이터 렌더링 | `전체 게시판` | `375 / 375` |
| `/search` | 로컬 렌더링 | `통합검색` | `375 / 375` |
| `/votes` | 로컬 렌더링 | `투표` | `375 / 375` |
| `/mypage` | 비로그인 로컬 상태 | 로그인 안내/복귀 흐름 | `375 / 375` |
| `/terms` | 로컬 렌더링 | `서비스 이용약관` | `375 / 375` |
| `/privacy` | 로컬 렌더링 | `개인정보처리방침` | `375 / 375` |

현재 브라우저 캡처는 파일로 내보내지 않고 인라인 증거로 남겼다.

- `browser-inline:M12-CAP-PUBLIC-390-ABOUT`: `/about#intro`, 390×844. native section selector와 `후원 및 제휴` 옵션이 AX tree에 표시됨.
- `browser-inline:M12-CAP-MENU-320`: `/`, 320×740, 모바일 메뉴 open. 모든 기존 목적지와 English/로그인이 AX tree에 표시됨.

### 3.2 위험 폭과 데스크톱 대표 회귀

| viewport | route | 결과 |
|---:|---|---|
| 320×740 | `/about`, `/board`, `/calendar`, `/life/roadmap` | 각 `document.clientWidth=305`, `scrollWidth=305`; outer overflow 없음 |
| 320×740 | `/` 메뉴 open | 내부 nav scroll 가능, English와 로그인 action이 viewport 안에 있음 |
| 1440×900 | `/about`, `/board`, `/calendar`, `/life/roadmap` | 각 `document.clientWidth=1425`, `scrollWidth=1425`; 데스크톱 outer overflow 없음 |

M05–M09에서 이미 실제 DB 데이터로 게시판 검색·상세 복귀, 행사·달력 날짜 선택·상세 이동, 설문 입력·검증·결과, 로드맵 필터·상세·관계 이동, 소개 section selector, 320px·390px·1440px을 검증했다. M12에서는 그 결과를 현재 HEAD에서 다시 route-level로 확인하고 M00 문제의 재발 여부를 측정했다.

### 3.3 관리자 route·인증 경계

`apps/web/src/App.tsx`에 선언된 관리자 route family는 다음과 같다.

- 목록/index: `/admin`, `/admin/surveys`, `/admin/users`, `/admin/audit-logs`, `/admin/permissions`, `/admin/finance`, `/admin/boards`, `/admin/faq`, `/admin/moderation`, `/admin/votes`, `/admin/content`, `/admin/roadmap`, `/admin/calendar`, `/admin/contacts`, `/admin/emails`
- 편집·상세: `/admin/surveys/new`, `/admin/surveys/:id/edit`, `/admin/surveys/:id/responses`, `/admin/surveys/:id/responses/:responseId`, `/admin/votes/new`, `/admin/votes/:id`

390×844에서 다음 대표 route를 각각 실제로 열고 2.5초 동안 인증 흐름을 기다렸다.

| route | 실제 결과 | 판정 |
|---|---|---|
| `/admin/users` | `https://ssodev.kaist.ac.kr/auth/kaist/error/code`, `Error Page`, `서버 내부 오류` | 인증 후 UI 미검증 |
| `/admin/content` | 동일한 SSO error page | 인증 후 UI 미검증 |
| `/admin/emails` | 동일한 SSO error page | 인증 후 UI 미검증 |
| `/admin/finance` | 동일한 SSO error page | 인증 후 UI 미검증 |
| `/admin/surveys/new` | 동일한 SSO error page | 인증 후 UI 미검증 |

모든 관리자 화면은 소스상 기존 `AuthGuard`와 권한별 permission contract를 유지한다. 하지만 관리자 테스트 계정이 없으므로 카드/표, drawer, 복잡 editor, draft 복원, 저장 성공·오류의 실제 픽셀 및 상호작용을 완료로 주장하지 않는다.

## 4. 구현·회귀 검사

### Docker·DB·API

- `docker compose -f compose.yml ps`: `soc_web-postgres-1 Up (healthy)`, API/web/nginx/Redis `Up`
- `GET http://127.0.0.1:3000/health`: `{"status":"ok","postgres":{"ok":true},"redis":{"ok":true}}`
- DB 볼륨 삭제·drop·초기화·재시드는 실행하지 않았다.
- 로컬 DB 데이터가 실제 공개 화면에 표시되는 것을 확인했다. `/board`에는 공지 8건과 분류가 표시되고, 홈에는 행사·일정 데이터가 표시된다.

### web 검사 전체

| 명령 | 결과 |
|---|---|
| `pnpm --filter @soc/web typecheck` | 통과 |
| `pnpm --filter @soc/web lint` | 통과, `UI unit contract passed` |
| `pnpm --filter @soc/web test` | 35 pass, 0 fail |
| `pnpm --filter @soc/web build` | 통과, 2374 modules transformed |
| `git diff --check` | 통과 |

빌드의 기존 informational warning(500KB 초과 chunk, `not-found-page.tsx` dynamic/static import 중복)은 실패가 아니며 이번 M12에서 새 실패로 분류할 항목은 없었다.

### Mock 로그인 제거 회귀

다음 범위에서 `mock-login`, `login-mock`, `테스트 로그인`, `가짜 로그인` 문자열을 검색했다.

```text
apps/web apps/api shared → NO_MOCK_LOGIN_MATCHES
```

실제 SSO 로그인·권한 보호 흐름은 남아 있으며, dev용 `/v1/mock/greeting`은 Mock 인증 경로가 아니므로 변경하지 않았다. 외부 인증을 우회하는 테스트 세션도 만들지 않았다.

## 5. 현재 계획 진행 상태

| 단계 | 상태 | 근거 |
|---|---|---|
| M00 기준 감사 | 완료 | `MOBILE_RESPONSIVE_AUDIT_2026-09-07.md`에 실제 재현·route 매핑·미검증 상태 기록 |
| M00-D 목표안 | 완료 | `MOBILE_DESIGN_DIRECTION_2026-09-07.md` |
| M01–M09 공개 반응형 | 구현·검증 완료 | 각 M별 verification 문서와 실제 Docker/브라우저 기록 |
| M10 관리자 공통·목록 | 구현 완료, 인증 후 브라우저 미검증 | 실제 SSO 경계와 자동 검사 기록 |
| M11-A/B/C 관리자 복잡 편집 | 구현 완료, 인증 후 브라우저 미검증 | 설문/투표, CMS/일정/로드맵, 이메일/수납 verification 문서 |
| M12 최종 회귀·인계 | 본 문서로 완료 | 공개 390px 전체, 위험 폭, 데스크톱 대표, 관리자 SSO 경계, web 검사 기록 |

주요 구현 커밋은 `019ac6a`, `48343c1`, `b348479`, `7507940`, `13c4b9d`, `ac55921`, `5ee2dde`, `64b5e85`, `4ff5e0b`, `522f741`, `9b305f6`, `73a6df2`, `98f14c1`이며 현재 `HEAD`와 `origin/main`은 `98f14c1`이다. Mock 로그인 제거 커밋은 `95a75c4`다.

## 6. 남은 검증과 다음 작업

계획서의 미검증 범위를 완료로 바꾸려면 다음 조건이 필요하다.

1. 승인된 KAIST SSO 관리자 테스트 계정과 실제 권한 조합을 제공한다.
2. 그 계정으로 모든 관리자 목록·편집 route를 390px에서 열고, 대표 복잡 화면을 320px·768px·1440px에서 확인한다.
3. 관리자 카드/표의 선택→상세→수정/확인, 설문·CMS 초안 복원, 이메일 검토, 수납 오류 상태를 실제 로컬 데이터로 확인한다. 메일 발송·결제·원장 반영은 계속 실행하지 않는다.
4. 실제 Android Chrome·iOS Safari 기기에서 키보드, 주소창, safe-area, 회전, VoiceOver/TalkBack을 별도 검증한다.

이 조건들은 현재 코드 검사 실패가 아니라 외부 인증·실기기·부수 효과 제한으로 남은 QA 범위다.
