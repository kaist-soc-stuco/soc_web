# 모바일 반응형 M09 검증 기록

- 검증일: 2026-09-08 (Asia/Seoul)
- 대상: `docs/MOBILE_RESPONSIVE_PLAN_2026-09-07.md`의 M09
- 범위: 마이페이지, 소개, 로드맵, 로그인 콜백·권한 보호 흐름, 404, 약관·개인정보
- 원칙: 기존 데이터·라우트·실제 SSO 흐름을 유지하고, M09 범위의 모바일 탐색·가독성 문제만 수정

## 1. 사전 재현 감사

로컬 Docker 스택을 기준으로 브라우저에서 실제 라우트를 열고 측정했다.

| 화면 | 재현 결과 |
| --- | --- |
| `/about` 390px | 페이지 전체 가로 넘침은 없었지만 기존 섹션 내비게이션이 `clientWidth 343px`, `scrollWidth 401px`인 내부 가로 스크롤 구조였다. 마지막 섹션을 한눈에 선택할 수 없었다. |
| `/life/roadmap` 390px·320px | 목록·검색·상세는 존재했지만 모바일 트랙 필터 버튼 높이가 36px이었다. 과목명은 `truncate`되어 긴 제목의 정보가 손실될 수 있었다. |
| `/mypage` 390px·320px | 인증된 화면의 데스크톱 사이드바가 모바일에서 숨겨지고 대체 메뉴가 없었다. 익명 복귀 링크도 390px에서 33.6px로 측정됐다. |
| `/terms`, `/privacy`, 320px | 긴 본문은 마지막 문의 정보까지 도달했고 가로 넘침은 없었다. |
| 404, 320px | 홈·이전 페이지 액션이 모두 44px이고 가로 넘침이 없었다. |

## 2. 적용 내용

- 소개 섹션 내비게이션을 768px 미만에서 전체 옵션을 가진 접근성 있는 네이티브 선택기로 전환했다. 데스크톱의 기존 수평 내비게이션과 해시·스크롤 스파이 동작은 유지했다.
- 로드맵 모바일 트랙 필터, 학기 선택, 개설 과목 체크 영역, 상세 탭·관계 항목을 최소 44px 터치 영역으로 맞췄다.
- 로드맵 과목명·개설 분반·관계 과목명을 줄바꿈 가능하게 바꾸고, 목록 과목명은 최대 두 줄로 표시해 320px에서도 식별할 수 있게 했다.
- 마이페이지에 모바일 메뉴 선택기를 추가해 `내 정보`와 `활동 내역` 사이를 이동할 수 있게 했다. 활동·스크랩 목록은 모바일에서 날짜와 본문이 세로로 재배치되며 긴 텍스트가 잘리지 않는다.
- 마이페이지 로그인 복귀 링크와 로그인 콜백 실패 시 `다시 로그인` 버튼을 최소 44px로 맞췄다. 오류 배너에는 `role="alert"`을 추가했다.
- Mock 로그인 UI·라우트를 다시 도입하지 않았고 로그인 진입은 실제 SSO 콜백 흐름을 유지했다.

주요 변경 파일:

- `apps/web/src/features/about/about-page-sections.tsx`
- `apps/web/src/styles.css`
- `apps/web/src/features/roadmap/roadmap-graph.tsx`
- `apps/web/src/pages/my-page.tsx`
- `apps/web/src/features/my-page/my-page-sections.tsx`
- `apps/web/src/pages/login-callback-page.tsx`

## 3. 실제 화면 검증

### 390px

- `/about`: 선택기 `343.2 × 44px`, 옵션 4개, 데스크톱 내비게이션은 `display:none`, 페이지 가로 넘침 없음.
- 소개 선택기에서 `후원 및 제휴`를 선택하면 URL이 `/about#partnership`로 바뀌고 해당 섹션이 화면 상단 기준 222px에 도달했다.
- `/life/roadmap`: 검색 래퍼·학기 선택·개설 체크 영역 모두 44px, 트랙 필터 9개가 모두 최소 44px, 모바일 목록 65개, 페이지 가로 넘침 없음.
- `데이터 과학` 필터 적용 후 3개 목록, `CS30600` 검색 후 1개 목록으로 줄어들었다. 과목을 열면 상세 탭 2개가 각각 44px이고 `CS20006` 선수 과목 관계 버튼도 44px이었다. 관계 버튼 선택 후 `/life/roadmap?course=CS20006`으로 이동했다.
- `/login?status=consent-required&pendingLoginToken=browser-check`: 실제 콜백 화면의 동의 모달과 두 선택 버튼이 모두 44px, 가로 넘침 없음. 테스트 토큰은 UI 상태를 표시하기 위한 합성 값이며 인증을 완료하지 않았다.

### 320px

- `/about`: 선택기 `272.8 × 44px`, 4개 옵션, 페이지 가로 넘침 없음.
- `/life/roadmap`: 검색·학기 선택·필터 최소 높이 44px, 첫 목록 행 64.8px, 65개 목록 유지, 페이지 가로 넘침 없음.
- `/mypage`: 익명 안내의 `로그인 페이지로 이동` 링크 44px, 모바일 메뉴는 인증 상태에서만 노출되며 익명 화면에는 노출되지 않음, 페이지 가로 넘침 없음.
- `/terms`, `/privacy`: 각각 마지막 `문의`·이메일 정보까지 렌더링되고 페이지 가로 넘침 없음. 측정된 article bottom은 각각 8,448px·10,195.2px이다.
- 404: `홈으로 이동`·`이전 페이지` 버튼이 각각 44px, 페이지 가로 넘침 없음.
- 영어 상태에서도 `/terms`, `/privacy`, 404의 긴 본문·복귀 액션을 확인했으며 320px 가로 넘침이 없었다.

### 768px·1440px

- 768px `/life/roadmap`: 모바일 목록 65개, 첫 행 64.8px, 필터 최소 높이 44px, 페이지 가로 넘침 없음.
- 1440px `/life/roadmap`: 데스크톱 2열 그래프 화면 유지, React Flow 노드 91개, 그래프 viewport `1052.8 × 692px`, viewport 내부 `scrollWidth 1051px = clientWidth 1051px`, 페이지 가로 넘침 없음.
- 1440px `/about`: 데스크톱 수평 섹션 내비게이션과 기존 레이아웃 유지, 모바일 선택기는 숨김, 페이지 가로 넘침 없음.

### 영어·권한 흐름

- 헤더 메뉴에서 `English`를 실제 선택한 뒤 `/about`와 `/life/roadmap`을 확인했다. 선택기·검색·트랙 라벨이 영어로 바뀌고 가로 넘침이 없었다. 검증 뒤 한국어로 복원했다.
- 익명 상태에서 `/admin/permissions`에 접근하면 보호된 SSO 흐름으로 이동하여 `https://ssodev.kaist.ac.kr/auth/kaist/error/code`가 표시됐다. 관리자 권한 계정·SSO 자격 증명이 없는 환경이므로 내부 권한 관리 화면의 인증 후 상태는 검증하지 않았다. 이는 모바일 레이아웃 결함으로 판정하지 않았다.

## 4. Docker·데이터 상태

- Postgres는 이미 `healthy`였으므로 데이터 볼륨을 삭제하거나 DB를 초기화하지 않았다.
- M09 코드 반영을 위해 `docker compose -f compose.yml build web` 및 `docker compose -f compose.yml up -d web`만 실행했다.
- 최종 상태: `soc_web-postgres-1 Up (healthy)`, `soc_web-api-1 Up`, `soc_web-web-1 Up`, `soc_web-redis-1 Up`.
- `GET http://127.0.0.1:3000/health` 결과: `status=ok`, `postgres.ok=true`, `redis.ok=true`.

## 5. 자동 검증

| 명령 | 결과 |
| --- | --- |
| `pnpm --filter @soc/web typecheck` | 통과 |
| `pnpm --filter @soc/web lint` | 통과 (`UI unit contract passed`) |
| `pnpm --filter @soc/web test` | 35 pass, 0 fail |
| `pnpm --filter @soc/web build` | 통과 |

빌드의 기존 informational warning(큰 청크, `not-found-page.tsx`의 동적·정적 import 중복)은 실패가 아니며 M09 변경으로 새 오류가 발생하지 않았다.

## 6. 제한 사항

- 실제 인증된 저장 프로필 세션과 활동·스크랩 데이터가 이 환경에 없어, 마이페이지의 인증 후 API 데이터 표시와 모바일 선택기로 `활동 내역`을 여는 화면은 코드 경로와 레이아웃 변경으로 검증하고 실제 계정 데이터로는 실행하지 못했다.
- 네이티브 iOS·Android 기기와 VoiceOver/TalkBack은 검증하지 않았다. 브라우저 접근성 트리에서 모바일 선택기, 검색, 목록 버튼, 상세 탭, 관계 버튼을 확인했다.
- 저장소의 소개 섹션 모델은 `소개`, `공약 이행 상황판`, `조직도`, `후원 및 제휴`의 4개 경로다. 별도 `문의` 섹션을 새로 만들지 않고 기존 제휴 섹션의 문의 CTA를 보존했다.

## 판정

M09의 모바일 탐색·터치 영역·긴 내용·복귀 동작 범위는 구현 및 실제 브라우저 검증을 완료했다. 인증 계정이 필요한 마이페이지 데이터 표시와 권한 내부 화면만 환경 제약으로 보류한다.
