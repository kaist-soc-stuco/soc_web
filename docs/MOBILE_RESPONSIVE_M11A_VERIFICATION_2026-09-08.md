# 모바일 반응형 M11-A 검증 기록

- 검증일: 2026-09-08 (Asia/Seoul)
- 대상: `docs/MOBILE_RESPONSIVE_PLAN_2026-09-07.md`의 M11-A
- 범위: 관리자 설문 편집기, 문항·선택지 편집, 섹션 편집·재정렬 모달, 관리자 투표 편집기
- 원칙: 기존 API·저장 계약·실제 SSO·권한 경계를 유지하고, 좁은 화면에서 입력·재정렬·저장 작업을 세로 흐름과 충분한 터치 영역으로 제공한다.

## 1. 실행 전 재현 감사

익명 브라우저에서 실제 관리자 편집 route를 열어 인증 경계를 확인했다. 승인된 관리자 테스트 계정이 없는 환경이므로 Mock 로그인·쿠키 주입·토큰 우회는 사용하지 않았다.

| 확인 대상 | 실제 결과 | 판정 |
| --- | --- | --- |
| `/admin/surveys/new` 익명 진입 | 로컬 앱에서 실제 SSO URL `https://ssodev.kaist.ac.kr/auth/kaist/error/code`로 이동하고 `오류가 발생하였습니다. 서버 내부 오류가 발생하였습니다.`가 표시됨 | 인증 후 편집기 렌더링은 계정 제약으로 보류 |
| 설문·문항·섹션 저장 | 인증 전 route 접근 단계에서 중단됨 | 서버 저장 계약은 코드와 자동검증으로 확인; 실제 저장은 승인된 관리자 계정 필요 |
| 투표 편집기 접근 | 동일한 관리자 권한 보호 범위에 있음 | Mock 로그인 없이 실제 SSO 경계 유지 |

## 2. 적용 내용

- 공통 `Modal`에 `mobileFullscreen` 선택 속성을 추가했다. 모바일에서는 지정된 복잡 편집 모달이 화면 높이를 사용하고 safe-area 상단 여백과 충분한 닫기 영역을 갖도록 하며, 데스크톱 모달 크기·모서리·레이아웃은 유지한다.
- `SectionEditorModal`과 설문 섹션 재정렬 모달을 모바일 full-screen으로 열고, 본문 좌우 여백과 언어 탭을 모바일 폭에 맞췄다. 섹션 드래그 핸들의 터치 영역도 확대했다.
- 설문 편집기 본문과 sticky header의 좌우 여백·간격을 좁은 폭에서 줄이고, 섹션 선택 컨트롤을 모바일에서 44px 높이로 제공했다. 데스크톱 breakpoint에서는 기존 밀도를 복원한다.
- 문항 inline editor를 모바일에서 패딩·입력 폭·컨트롤 높이에 맞춰 세로로 읽고 입력할 수 있게 했다. 선택지 이미지 추가/변경 조작은 hover에 의존하지 않고 모바일에서 바로 접근할 수 있다.
- 드래그 정렬과 서버의 순서 저장 핸들러를 유지하면서 문항과 선택지에 위/아래 이동 버튼을 추가했다. 첫 항목·마지막 항목·진행 중인 설문에서는 경계/잠금 상태를 비활성화한다. 버튼 이동도 기존 순서 저장 API와 optimistic UI 경로를 사용한다.
- 선택지 branching 컨트롤은 모바일에서 다음 줄 전체 폭으로 배치하고, 선택지 이미지·순서 버튼과 함께 좁은 화면에서 겹치지 않도록 했다. 문항 추가/삭제와 문항 옵션 메뉴의 조작 영역도 모바일 최소 터치 크기에 맞췄다.
- 투표 편집기 header 작업 버튼은 좁은 폭에서 wrapping 되고, 기본 정보·선거인 조건·문항·선거인 검색 영역은 모바일 패딩과 입력 wrapping을 적용했다. 저장·게시·마감·집계·결과 공개의 기존 버튼·권한·핸들러는 변경하지 않았다.
- Mock 로그인 UI·라우트·토큰은 추가하지 않았다.

주요 변경 파일:

- `apps/web/src/components/ui/modal.tsx`
- `apps/web/src/styles.css`
- `apps/web/src/components/organisms/section-editor-modal.tsx`
- `apps/web/src/components/organisms/question-editor-modal.tsx`
- `apps/web/src/features/admin-surveys/survey-editor-page.tsx`
- `apps/web/src/pages/admin/vote-editor-page.tsx`

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

- 실제 Codex in-app Chromium에서 로컬 `http://127.0.0.1:5173/admin/surveys/new`를 열었다.
- 익명 관리자 보호에 따라 외부 SSO error page로 이동하는 것을 확인했다. 따라서 인증 후 설문 입력, 문항/섹션 순서 변경, 투표 저장을 임의 세션으로 통과 처리하지 않았다.
- 인증 후 UI의 실제 픽셀 치수·모바일 저장 결과·데스크톱 회귀는 승인된 관리자 테스트 계정이 제공되면 390px·320px·768px·1440px에서 재검증해야 한다.

## 4. 자동 검증

| 명령 | 결과 |
| --- | --- |
| `pnpm --filter @soc/web typecheck` | 통과 |
| `pnpm --filter @soc/web lint` | 통과 (`UI unit contract passed`) |
| `pnpm --filter @soc/web build` | 통과 |
| `pnpm --filter @soc/web test` | 35 pass, 0 fail |
| `git diff --check` | 통과 |

빌드의 기존 informational warning(큰 청크, `not-found-page.tsx`의 동적·정적 import 중복)은 실패가 아니며 이번 변경으로 새 오류가 발생하지 않았다.

## 5. 제한 사항과 다음 작업

- SSO 테스트 계정 부재로 인증 후 편집기에서 실제 데이터 입력·저장·순서 변경을 브라우저로 완료하지 못했다. 이는 Mock 로그인으로 우회하지 않고 남긴 검증 보류 항목이다.
- 네이티브 iOS·Android 기기와 VoiceOver/TalkBack은 검증하지 않았다. 브라우저 검증은 실제 SSO 경계까지 수행했다.
- M11-B에서 CMS·일정·로드맵 편집 화면의 모바일 입력·미리보기·재정렬 흐름을 확인한다.
- M11-C에서 bulk email·수납 등 긴 입력 업무의 draft-safe 상태와 모바일 action flow를 확인한다. 발송·결제 같은 외부 부수 효과는 실행하지 않는다.

## 판정

M11-A의 설문/투표 편집기와 문항·섹션 모달에 모바일 세로 입력 흐름, full-screen 복잡 편집 모달, 최소 터치 영역, 위/아래 순서 이동 조작을 적용했다. 기존 저장·권한·SSO 계약은 유지했고 Docker·DB·API는 정상이다. 인증 후 실제 데이터 조작만 SSO 계정 부재로 보류한다.
