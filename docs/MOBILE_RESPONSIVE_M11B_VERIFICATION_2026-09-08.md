# 모바일 반응형 M11-B 검증 기록

- 검증일: 2026-09-08 (Asia/Seoul)
- 대상: `docs/MOBILE_RESPONSIVE_PLAN_2026-09-07.md`의 M11-B
- 범위: 관리자 사이트 콘텐츠(CMS), 일정 관리, 로드맵·학기별 개설·엑셀 검토
- 원칙: 복잡한 입력은 모바일 세로 흐름과 저장 전 주의 안내를 제공하고, 목록·상세·미리보기·정렬의 기존 데이터/API 계약은 유지한다.

## 1. 실행 전 재현 감사

익명 브라우저에서 실제 관리자 CMS route를 열어 인증 경계를 확인했다. 승인된 관리자 테스트 계정이 없는 환경이므로 Mock 로그인·쿠키 주입·토큰 우회는 사용하지 않았다.

| 확인 대상 | 실제 결과 | 판정 |
| --- | --- | --- |
| `/admin/content` 익명 진입 | 로컬 앱에서 실제 SSO URL `https://ssodev.kaist.ac.kr/auth/kaist/error/code`로 이동하고 `오류가 발생하였습니다. 서버 내부 오류가 발생하였습니다.`가 표시됨 | 인증 후 CMS UI 조작은 계정 제약으로 보류 |
| CMS 콘텐츠 선택·입력·미리보기·적용 | 인증 전 route 접근 단계에서 중단됨 | 코드상 저장하지 않은 변경 확인/취소 흐름과 API 저장 계약을 유지; 실제 저장은 승인된 관리자 계정 필요 |
| 일정·로드맵 편집 | 동일한 관리자 권한 보호 범위에 있음 | 임의 세션으로 데이터 조작을 통과 처리하지 않음 |

## 2. 적용 내용

### CMS

- 모바일에서 복잡한 CMS 입력·정렬을 수행할 때 데스크톱 진행을 권장하고, 저장하지 않은 변경 사항을 저장하기 전 페이지를 이동하지 않도록 안내하는 공통 관리자 안내를 추가했다.
- 콘텐츠 목록은 모바일에서 페이지 전체가 스크롤하도록 바꾸고, 데스크톱에서만 목록 내부 높이 제한/스크롤을 유지해 중첩 스크롤 충돌을 줄였다.
- 드래그 정렬과 `reorderContentBlocks` 서버 저장 계약을 유지하면서 콘텐츠 항목에 위/아래 이동 버튼을 추가했다. 저장 중·미저장 편집 중·첫/마지막 항목은 기존 잠금/경계에 맞춰 비활성화한다.
- CMS 편집·미리보기 카드의 모바일 패딩과 적용 sticky action bar의 safe-area 하단 여백을 조정했다. 이미지 선택/교체 버튼은 모바일 최소 높이를 사용한다.
- 새 콘텐츠 등록 모달은 좁은 화면에서 full-screen으로 열리고 세로 입력·safe-area-aware footer를 사용한다. 기존 생성 후 publish 흐름과 취소/오류 상태는 유지한다.

### 일정

- `/admin/calendar` 목록은 기존 데이터와 row 클릭/키보드 상세 진입을 유지하면서 모바일에서 제목·분류·출처·기간 카드로 표현한다. 일정 비교가 필요한 데스크톱 표 폭은 유지한다.
- 일정 편집은 기존 full-height `AdminDrawer`와 footer 저장/취소 동작을 유지한다. 제목·기간·장소·설명과 노출 분류/공개 상태의 세로 입력 흐름, source별 읽기 전용 안내를 보존한다.

### 로드맵

- `/admin/roadmap`에 복잡한 과목·분반 편집과 엑셀 검토의 데스크톱 권장 안내를 추가했다.
- 과목 통합 편집 모달과 전체개설교과목 검토 모달을 모바일 full-screen으로 전환하고 safe-area footer를 사용한다. 기본 정보/학기별 개설 탭과 분반 추가·저장·삭제 계약은 유지한다.
- 과목/분반 입력 grid는 모바일에서 세로로 쌓이고, 분반 목록의 학기·과목명·분반 열은 좁은 폭에 맞춰 최소 폭을 조정한다.
- 엑셀 검토 summary는 모바일에서 1열로, 신규 과목별 교육 분야·로드맵 표시 결정은 카드형 세로 행으로 배치했다. 데스크톱에서는 기존 3열 비교 레이아웃을 유지한다.

주요 변경 파일:

- `apps/web/src/components/ui/admin-page.tsx`
- `apps/web/src/features/admin-site-content/site-content-page.tsx`
- `apps/web/src/features/admin-calendar/calendar-management-page.tsx`
- `apps/web/src/pages/admin/roadmap-management-page.tsx`
- `apps/web/src/styles.css`

## 3. 실제 런타임 검증

### Docker·API·DB

- `docker compose -f compose.yml build web`: 통과
- `docker compose -f compose.yml up -d web`: 통과
- `soc_web-postgres-1`: `Up (healthy)`
- `soc_web-api-1`, `soc_web-redis-1`, `soc_web-web-1`: `Up`
- migration one-shot container: 정상 종료
- `GET http://127.0.0.1:3000/health`: `status=ok`, `postgres.ok=true`, `redis.ok=true`
- DB 볼륨 삭제·초기화는 하지 않았다.

### 브라우저

- 실제 Codex in-app Chromium에서 로컬 `http://127.0.0.1:5173/admin/content`를 열었다.
- 익명 관리자 보호에 따라 외부 SSO error page로 이동하는 것을 확인했다. 따라서 CMS 입력/미리보기/적용, 일정 drawer 저장, 로드맵 과목·분반 저장, 엑셀 검토 반영을 임의 세션으로 통과 처리하지 않았다.
- 인증 후 UI의 실제 픽셀 치수·모바일 저장 결과·데스크톱 회귀는 승인된 관리자 테스트 계정이 제공되면 390px·320px·768px·1440px에서 재검증해야 한다.

## 4. 자동 검증

| 명령 | 결과 |
| --- | --- |
| `pnpm --filter @soc/web typecheck` | 통과 |
| `pnpm --filter @soc/web lint` | 통과 (`UI unit contract passed`) |
| `pnpm --filter @soc/web test` | 35 pass, 0 fail |
| `pnpm --filter @soc/web build` | 통과 |
| `git diff --check` | 통과 |

빌드의 기존 informational warning(큰 청크, `not-found-page.tsx`의 동적·정적 import 중복)은 실패가 아니며 이번 변경으로 새 오류가 발생하지 않았다.

## 5. 제한 사항과 다음 작업

- SSO 테스트 계정 부재로 인증 후 CMS·일정·로드맵 데이터를 브라우저에서 실제로 저장하지 못했다. 이는 Mock 로그인으로 우회하지 않고 남긴 검증 보류 항목이다.
- 네이티브 iOS·Android 기기와 VoiceOver/TalkBack은 검증하지 않았다. 브라우저 검증은 실제 SSO 경계까지 수행했다.
- M11-C에서 bulk email·수납 등 긴 입력 업무의 draft-safe 상태와 모바일 action flow를 확인한다. 발송·결제 같은 외부 부수 효과는 실행하지 않는다.

## 판정

M11-B의 CMS·일정·로드맵 화면에 모바일 세로 입력 흐름, 복잡 편집 데스크톱 권장 안내, full-screen 편집/검토 모달, 카드형 일정 목록, 모바일 순서 위/아래 대체 조작을 적용했다. 기존 저장·권한·SSO 계약은 유지했고 Docker·DB·API는 정상이다. 인증 후 실제 데이터 조작만 SSO 계정 부재로 보류한다.
