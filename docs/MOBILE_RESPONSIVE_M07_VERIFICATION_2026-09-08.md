# M07 모바일 반응형 검증 기록

작성일: 2026-09-08

대상: 설문 참여·검증·결과, 투표 목록·상세·결과

기준: `docs/MOBILE_RESPONSIVE_PLAN_2026-09-07.md`의 M07 및 `docs/MOBILE_DESIGN_DIRECTION_2026-09-07.md`의 설문·투표 목표안

## 1. 실행 환경

- 로컬 PostgreSQL·Redis가 포함된 `compose.yml` 기준으로 `docker compose -f compose.yml up -d --build api web nginx`를 실행했다.
- `db-migrate`는 성공적으로 종료했고, API·web·nginx·PostgreSQL·Redis가 실행 중이며 PostgreSQL은 healthy 상태였다.
- `GET http://127.0.0.1:3000/health`: `status=ok`, PostgreSQL `ok=true`, Redis `ok=true`
- 브라우저 실제 화면은 `http://127.0.0.1:5173`의 Docker web과 실제 DB seed를 사용했다.
- 인증 우회나 Mock 로그인은 사용하지 않았다. `POST /v1/auth/login/mock`은 `404`이며 현재 앱 소스에도 Mock 로그인 참조가 없다.

## 2. 구현 전 실제 화면 재현

- `/survey/7a110000-0000-4000-8000-000000000003`(로그인 없이 참여 가능한 기업 후원 문의)를 390px/320px에서 확인했다. 기본 입력·드롭다운·서술형은 화면 안에 들어오고 input은 44px 높이였지만 진행률·미응답 수·문항 번호·제출 오류 요약은 없었다.
- 구현 전 설문 응답 폼은 한 번에 하나의 섹션만 보여 주고 하단에 `현재 섹션 / 전체 섹션`만 표시했다. 문항을 검토하거나 이전 응답을 수정하려면 단계 전환을 반복해야 했다.
- `/survey/7d59c469-d158-48d3-9061-c2051bc2e02f`(문항 유형 종합 테스트)는 실제 DB에 존재하지만 `LOGIN_REQUIRED` 상태라 로그인 화면에서 멈췄다. 인증을 우회해 표형·파일 문항을 재현하지 않았다.
- `/votes`의 실제 seed 투표는 2026-09-07에 종료되어 목록·종료 상태만 확인할 수 있었다. 390px/320px에서 페이지 전체 가로 넘침은 없었지만 긴 상태/기간/참여 조건을 한 줄 행에 의존하고 오류·재시도 상태가 없었다.
- 공개 결과 `/survey/439deaf9-e8c1-43e6-9ab8-f876f8c334e4/results`는 390px/320px에서 가로 넘침 없이 열렸지만 결과 문항·선택지 라벨이 좁은 폭에서 한 줄 flex 배치에 의존했고, 그리드 결과는 데스크톱용 최소 폭 표 구조였다.

## 3. 변경 내용

- 설문 응답을 한 페이지 세로 흐름으로 전환했다. 보이는 모든 섹션을 순서대로 렌더링하고, 상단에 응답 진행률·답변 수·미응답 수·필수 미응답 수를 표시했다. 섹션이 여러 개면 44px 앵커 탐색을 제공한다.
- 문항 번호를 보이는 문항 순서로 표시하고, 제출 검증 실패 시 각 필드 오류를 유지하면서 상단 오류 요약에서 해당 문항으로 이동할 수 있게 했다. 기존 `questionErrors`, 조건부 분기, draft localStorage, 이전 응답 수정, 제출/update payload는 유지했다.
- 표형 문항은 같은 input 집합 하나를 유지한 채 데스크톱에서는 열 기반 grid, 모바일에서는 각 행의 문항명 아래 선택지를 세로 카드로 표현한다. 기존 `name`, 선택 값, 행별 grid answer 구조와 필수 검증을 변경하지 않았다.
- 모바일 input/textarea·평점·표형 선택지·파일 삭제/추가/재시도 액션의 조작 영역을 44px 이상으로 맞추고, 긴 선택지·파일명은 안전하게 줄바꿈한다. 업로드 오류에는 명시적인 `다시 시도` 액션을 추가했다.
- 투표 목록과 상세의 상태·기간·조건·긴 제목/설명을 좁은 폭에서 여러 행으로 재배치하고, 목록/상세 초기 로드 실패에는 오류 안내와 다시 시도 액션을 제공했다. 투표 선택지는 최소 44px 카드로 유지하고 제출 오류는 `role=alert`로 노출했다.
- 설문 결과와 투표 결과의 긴 라벨/수치를 모바일에서 세로로 쌓고, 설문 grid 결과는 모바일 row card로 전환했다. 데스크톱 결과 표와 읽기 순서는 유지했다.

## 4. 실제 화면 검증

| 화면·폭 | 실제 데이터/측정 | 가로 오버플로 | 결과 |
| --- | --- | --- | --- |
| 익명 설문 390px | `documentWidth=375`, `bodyWidth=375`, 문항 카드 `x=16,width=359.2px`, input `317.6×44px`, textarea `317.6×100px`, progress `317.6×8px`, action `x=16,right=375.2px` | 없음 | 통과 |
| 익명 설문 320px | `documentWidth=305`, `bodyWidth=305`, 문항 카드 `x=16,width=288.8px`, input 폭 `247.2px`, progress 폭 `247.2px`, action `288.8px` | 없음 | 통과 |
| 폭 변경 값 보존 | 익명 설문 첫 input에 `모바일 회귀 테스트 기관` 입력 후 320px→390px로 변경 | 값 유지 | 통과 |
| 필수 검증 390px | 첫 문항만 입력하고 제출. 필드 오류 4개와 상단 `확인이 필요한 문항` 오류 요약/문항 링크가 생성됨 | 없음 | 통과 |
| 설문 결과 390px | 공개 결과 실제 데이터, `documentWidth=375`, 결과 카드 폭 `343.2px`, 긴 제목·문항·선택지 라벨 표시 | 없음 | 통과 |
| 설문 결과 320px | `documentWidth=305`, 결과 카드 폭 `272.8px`, 제목·긴 문항명이 여러 행으로 표시됨. 결과 grid fixture가 없어 grid card 자체는 CSS 전환 계약으로 확인 | 없음 | 부분 통과 |
| 투표 목록 390px | 실제 종료 투표 카드 `x=20,width=335.2px`, 제목 `301.6px` 폭 | 없음 | 통과 |
| 투표 목록 320px | 실제 종료 투표 카드 `x=16,width=272.8px`, 상태·기간·참여 조건이 세로/다중 행으로 표시됨 | 없음 | 통과 |
| 투표 상세 320px | 실제 종료 상태, 상세 카드 `x=16,width=272.8px`, 제목 `239.2px` 폭 | 없음 | 통과 |

브라우저 측정은 `document.documentElement.scrollWidth`, `document.body.scrollWidth`와 주요 카드의 `getBoundingClientRect()`로 확인했다. 브라우저 캡처는 Codex CUA 인라인 캡처로 남겼으며 작업 디렉터리에 별도 이미지 파일은 만들지 않았다.

## 5. 실제 fixture·상태 범위

| 범위 | 확인 결과 |
| --- | --- |
| 문항 유형 종합 fixture | `7d59c469-d158-48d3-9061-c2051bc2e02f`에 3개 섹션(8문항·빈 섹션·3문항), `short_text`, `long_text`, `single_choice`, `multiple_choice`, `dropdown`, `rating` 외에 `grid_single`, `grid_multiple`, `file_upload`, `date`, `time` 계약을 확인했다. 실제 응답 API에 10개 유형이 존재하며 그리드는 각 3행/2행·3열, 파일은 최대 2개·5MB·PDF/PNG/JPEG다. 단, 이 fixture는 로그인 필수다. |
| 익명 설문 입력 | `7a110000-0000-4000-8000-000000000003`에서 short text 4개, dropdown 1개, long text 1개를 실제 브라우저로 확인했다. |
| 조건부 분기 | 현재 공개 seed에는 `goToSectionByValue`가 있는 fixture가 없고 빈 섹션 1개가 있다. API 테스트에서 `survey branching follows a selected option into the target section`, 제출 종료, 잘못된 target 검증을 통과했으며 클라이언트는 `getVisibleSurveySectionIds` 결과를 그대로 사용한다. |
| 공개 결과 | `439deaf9-e8c1-43e6-9ab8-f876f8c334e4`의 객관식·복수 선택·서술형 및 응답 0개 상태를 실제 브라우저로 확인했다. |
| 투표 | 실제 투표는 단일 선택 1개·복수 선택 1개이며 `LOGIN_REQUIRED` 상태다. 현재 날짜에는 종료되어 참여 선택/확인 모달을 실행할 수 없었다. |

## 6. 제한 및 후속 검증

- 실제 로그인 세션이 제공되지 않아 로그인 필수 종합 fixture의 표형 선택·파일 업로드 성공/실패·재시도와 투표의 선택→확인 모달→제출 완료 흐름은 브라우저 E2E로 실행하지 않았다.
- 현재 DB의 유일한 공개 투표는 2026-09-07에 종료되었고 결과도 공개되지 않아, 테스트를 위해 seed나 시스템 시간을 변경하지 않았다.
- 따라서 위 제한 항목은 API 계약·소스·production build 및 실제 공개 상태로 검증했으며, 인증 가능한 QA 계정과 활성 투표 fixture가 있는 환경에서 후속 실행해야 한다.

## 7. 검사 결과

- 저장소 전체 TypeScript typecheck: 통과
- 저장소 전체 lint 및 Web UI unit contract: 통과
- 저장소 전체 test: API 120개 중 107 passed / 13 skipped / 0 failed, Web 35 passed / 0 failed
- Web production build: 통과
- `git diff --check`: 통과
- Docker migration 및 API health: 통과

다음 단위는 M08 행사·설문 목록과 전체 달력이다. M07의 인증 필요 문항, 파일 업로드 실패/재시도, 활성 투표 확인·완료 상태는 테스트 가능한 인증·fixture 환경에서 후속 회귀 검증이 필요하다.
