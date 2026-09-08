# 실제 모바일 해상도 QA 결과 및 수정 작업서

작성: 2026-09-08 · 후속 구현 담당: GPT-5.6 Luna / reasoning max

## 1. 판단 기준과 이번 작업 범위

현재 실행 화면과 현재 소스만으로 점검했다. 과거 기획서, 디자인 방향 문서, 이전 모바일 계획서는 구현 요구사항으로 참조하지 않는다. 이 문서도 후속 작업 시 현재 화면에서 재현한 뒤 적용한다.

사용자가 말한 테스트는 **실기기 테스트가 아니라 컴퓨터 브라우저에서 실제 모바일 CSS viewport 크기로 실행하는 테스트**다. 기기의 물리 픽셀 수를 그대로 브라우저 폭으로 넣지 않는다. 모바일 구현이 이미 존재해도 사용성과 시각적 완성도가 개선된다면 해당 구조를 다시 설계한다. 단순히 기존 CSS를 보존하는 것을 목표로 하지 않는다.

이번에는 `.env`를 로컬 Python SSO로 전환하고, 실제 애플리케이션·DB를 연결한 상태에서 화면과 상호작용을 점검했다. UI 수정은 후속 작업이다. SSO 응답만 합성하고 게시판·설문·권한 API 자체는 실제 앱을 사용했다.

- 기준 checkout: `221203a` + 현재 작업 디렉터리. 문서 변경 등 기존 작업은 보존했다.
- 브라우저: Codex in-app Chromium 계열 브라우저, 마우스/키보드 입력.
- 확인 크기: 320×740, 390×844, 430×932, 768×1024, 844×390, 1440×900 CSS px.
- 수직 스크롤바가 있는 화면에서는 `innerWidth=390`일 때 `clientWidth=375`였다. 결과 수치는 이 실제 조건을 함께 적었다.
- 스크린샷으로 시각 확인하고, DOM bounding rect·scrollWidth·접근성 트리·실제 클릭으로 교차 확인했다. 스크린샷은 세션에서 확인했으며 별도 이미지 파일은 이 문서에 첨부하지 않았다.
- 실행 컨테이너의 `header.tsx`, `styles.css`, `modal.tsx`, `channel-talk-provider.tsx`와 작업 디렉터리 파일의 SHA-256 일치를 확인했다.
- 물리 터치, iOS Safari, Android Chrome, 가상 키보드, 기기 safe area, DPR별 이미지 품질은 검증 범위 밖이다. 모든 페이지를 모든 크기로 전수 검사한 결과는 아니다.

## 2. 로컬 테스트 환경

### 현재 실행 상태

접속 주소: **http://192.168.0.3:8765/**

Python이 같은 origin에서 웹/API 요청을 `http://127.0.0.1:8080`의 개발 Nginx로 전달한다. API 컨테이너는 Python의 token endpoint에 접근한다. Docker API가 위 LAN 주소에 도달하는 것도 확인했다. 컴퓨터에서만 테스트해도 이 주소를 사용하면 된다. 이 개발 환경에서 `host.docker.internal:8765`는 LAN 인터페이스에만 bind한 서버에 연결되지 않아 사용하지 않았다.

```text
브라우저 → Python :8765 → 개발 Nginx :8080 → web / API
로그인 시작 → Python 계정 선택 → API callback
API → Python token 교환 → 원래 nonce 확인 → 동의 → 실제 세션 쿠키
```

설정 파일/도구:

- [configure_env.py](../tools/mobile_qa/configure_env.py): 개발 환경 확인, 지정 키 백업, fixture 전환/복원.
- [sso_server.py](../tools/mobile_qa/sso_server.py): Python 표준 라이브러리 SSO fixture와 웹/API reverse proxy.
- [smoke_test.py](../tools/mobile_qa/smoke_test.py): 인증 응답 계약, 잘못된 요청, 일회용 코드, proxy health 검증.

### `.env` 변경 내용

| 키 | 테스트 설정 |
| --- | --- |
| `SSO_LOGIN_URL` | `/__local-sso/authorize` |
| `SSO_REDIRECT_URI` | `/api/auth/login` |
| `SSO_AUTH_API_URL` | `http://192.168.0.3:8765/__local-sso/token` |
| `SSO_CLIENT_ID` | `soc-mobile-qa` |
| `SSO_CLIENT_SECRET` | 임의 생성한 로컬 전용 값. 문서/로그에 기록하지 않음 |
| `INITIAL__ADMIN_STDNOS` | 기존 값에 합성 관리자 학번 `90990001` 추가 |
| `LOCAL_QA_BIND`, `LOCAL_QA_PORT` | `192.168.0.3`, `8765` |
| `LOCAL_QA_UPSTREAM` | `http://127.0.0.1:8080` |
| `EMAIL_DRY_RUN` | `true` |
| `BULK_EMAIL_SCHEDULER_ENABLED` | `false` |
| `GOOGLE_CALENDAR_SYNC_ENABLED` | `false` |
| `KAIST_CALENDAR_SYNC_ENABLED` | `false` |
| `ASSET_ORPHAN_CLEANUP_ENABLED` | `false` |

원래 값은 git에서 무시하는 `tmp/mobile-qa/env-backup.json`에 저장했다. `.env`와 백업에는 비밀값이 있으므로 작업 결과물에 포함하지 않는다. 설정 스크립트는 명시적 `NODE_ENV=development`에서만 전환한다. 서버는 지정한 사설 IP에만 bind한다. 실제 KAIST 자격 증명이나 운영 인증 동작을 검증하는 환경은 아니다.

ChannelTalk은 화면 충돌을 확인하기 위해 기존 개발 설정대로 켜져 있다. SSO 외의 모든 외부 서비스를 가짜 서버로 바꾼 것은 아니다. 테스트에서 메시지 전송·이메일 발송·Google Sheets 연결 버튼은 실행하지 않았다.

### 재실행

현재는 설정 적용 및 API 재생성이 완료되었다. 서버가 종료된 경우 프로젝트 루트에서 다음을 실행한다.

```powershell
python tools/mobile_qa/sso_server.py
```

다른 터미널에서 확인한다.

```powershell
python tools/mobile_qa/smoke_test.py
```

최초 설정 또는 복원 후 재설정할 때만 다음을 실행한다. 이미 백업이 있으면 재설정을 거부하도록 되어 있다.

```powershell
python tools/mobile_qa/configure_env.py --host 192.168.0.3
docker compose up -d --no-deps --force-recreate api
python tools/mobile_qa/sso_server.py
```

IP가 바뀌면 서버를 종료하고 설정을 복원한 뒤, 현재 컴퓨터의 사설 IPv4를 `--host`에 전달해 다시 설정한다. API를 재생성하고 로그인 시작부터 다시 진행한다. fixture 승인 거래와 코드는 120초 후 만료되며 각각 한 번만 사용할 수 있다.

**후속 UI 수정 반영:** 현재 Docker 개발 컨테이너는 소스를 이미지에 복사한다. 파일 수정만으로 실행 화면이 바뀌었다고 가정하지 않는다. 웹 변경 후 다음으로 이미지를 갱신하고 브라우저를 새로 고친다. Docker 설정이 후속 작업에서 달라졌다면 실제 mount/build 구성을 확인한다.

```powershell
docker compose up -d --build --no-deps web
```

### 합성 계정 및 데이터 변화

앱 메뉴의 로그인 → Python 계정 선택 → 최초 개인정보 동의 순서로 사용한다.

| 선택 | 학번 | 이메일 | 용도 |
| --- | --- | --- | --- |
| 모바일 QA 관리자 | `90990001` | `mobile-qa-admin@example.invalid` | 관리자 페이지 및 작성 화면 |
| 모바일 QA 학생 | `90990002` | `mobile-qa-student@example.invalid` | 일반 사용자. 영문 이름이 긴 사례 |
| 모바일 QA 동의테스트 | `90990003` | `mobile-qa-consent@example.invalid` | 아직 저장 동의를 하지 않은 초기 동의 재현용 |

관리자와 학생의 저장 동의를 완료하여 두 합성 계정이 로컬 DB에 추가되었다. 학생의 `/admin/users` 접근은 마이페이지로 이동했으며 일반 사용자 권한 표시를 확인했다. 이는 UI 접근 구분 확인이며 서버 권한 전체 감사 결과는 아니다.

설문 편집기는 `/admin/surveys/new` 진입만으로 실제 서버에 DRAFT를 자동 생성한다. 이번 테스트에서 합성 관리자 소유의 비공개 `설문조사` 초안이 자동 생성되어 복구 배너로 다시 표시된 것을 확인했다. 문항 추가 UI도 열었으므로 후속 테스트 시 이 합성 계정의 초안 내용을 확인해 재사용하거나 앱에서 정리한다. 게시 버튼은 누르지 않았다. 게시글·댓글 작성, 설문 응답 제출, 실제 투표는 실행하지 않았다. 마지막에는 합성 계정을 로그아웃하고 언어/viewport를 복원했다.

### 원래 SSO로 복원

Python 서버 터미널에서 Ctrl+C로 종료한 뒤 실행한다.

```powershell
python tools/mobile_qa/configure_env.py --restore
docker compose up -d --no-deps --force-recreate api
```

복원은 fixture가 변경한 키만 되돌린다. 그 키가 이후 다른 값으로 수정되었으면 덮어쓰지 않고 중단하므로 충돌 키를 확인한다. 다른 `.env` 수정은 보존한다. 합성 사용자/관리자 역할/초안과 브라우저 세션 데이터는 `.env` 복원으로 삭제되지 않는다. 필요 시 합성 학번/소유자를 기준으로 별도 정리한다.

## 3. 실제 확인 범위

`공통 헤더 결함`은 아래 일반 페이지에 반복되므로 별도 중복 이슈를 만들지 않는다.

| 화면/상태 | 실제 확인 크기 | 확인 내용 |
| --- | --- | --- |
| 홈 `/` | 320, 390, 768, 1440 | 게스트/로그인 헤더, hero, 행사 카드, overflow. 게스트 320 메뉴 열기 성공 |
| 검색/알림 팝업 | 390, 430, 844×390 | 검색 입력·알림 빈 상태 패널 열기, 좌표와 잘림 |
| 최초 동의 | 390×844, 844×390 | 관리자/학생 첫 로그인, 버튼 겹침, 저장 동의 성공 |
| `/board/notice` | 320, 390 | 8개 목록, 제목 줄바꿈, 검색/작성, 가로 스크롤 |
| `/board/notice/2` | 320 | 이미지·본문·첨부 링크·댓글 2개, 댓글 입력 focus |
| `/board/write` | 320, 390 | 상단 작업바, 제목 입력, 편집 도구, 게시 설정 표시 |
| `/board/faq` | 390 | FAQ 목록/카테고리/검색의 초기 배치 |
| `/events`, `/events/15` | 390 | 필터·날짜·카드·연결 설문 CTA·본문 |
| `/calendar` | 390 | 2026년 9월, 9/11 선택, 13개 일정, 상세 위치 |
| `/life/roadmap` | 390 | 모바일 과목 목록, CS20006 상세 열기, 선수/후속 과목 표시 |
| `/surveys` | 390 | 실제 설문 4개 목록, 상태/기간 필터 |
| 종합 테스트 설문 | 320, 390 | 11문항, 섹션 이동, 행렬 radio 선택, 고정 제출 영역 |
| `/votes` 및 마감 투표 상세 | 320 | 마감 카드·안내. 현재 fixture 투표가 마감 상태여서 투표 입력은 미검증 |
| `/mypage` | 320, 390, 844×390 | 관리자/학생 역할 표시, 한글/영문 긴 이름·이메일 줄바꿈 |
| `/about` | 390 | hero·CTA·모바일 섹션 선택·소개/공약/조직 영역 DOM |
| `/admin/users` | 320, 390 | 합성 학번으로 검색, 사용자 카드, 연락처/시각 폭 |
| 사용자 상세 drawer | 390, 844×390 | 상세 열기, 본문/고정 하단 작업 배치 |
| `/admin/surveys/new` | 320, 390 | 질문/설정 탭, 문항 추가, 기본 설정·기간·접근·응답 규칙 |

종합 설문: `/survey/7d59c469-d158-48d3-9061-c2051bc2e02f`

마감 투표: `/votes/ccb8badd-942c-4e62-97a0-7077d883e1f5`

미검증: 관리자 과비·연락망·권한·이메일·운영 로그 등 나머지 화면의 상세 조작, 게시/투표/설문 최종 제출, 파일 선택/업로드, 네트워크 실패·느린 응답, 200% 확대, 모든 breakpoint 경계, 모바일 브라우저 키보드. 후속 작업에서 해당 코드를 수정하면 관련 흐름을 추가 검증한다.

## 4. 확정 수정 항목 7개

P1은 주요 기능 접근 또는 핵심 작업/읽기를 방해하는 결함이다. P2는 접근 가능하지만 조작성·정보 탐색을 개선할 항목이다. 보안 취약점 등급이 아니다.

### V01 · P1 · 로그인 후 헤더 메뉴가 화면 밖으로 밀림

**재현:** 합성 관리자 또는 학생 로그인 → 홈 또는 `/board/notice` → 320×740. 게스트 홈에서는 메뉴가 들어맞지만 로그인하면 알림/프로필이 추가되어 깨진다.

**측정:** `innerWidth=320`, `clientWidth=305`. 검색 x=192..236, 알림 242..286, 프로필 292..336, 메뉴 342..386, 각 높이 44px. 메뉴는 화면 밖이고 프로필은 일부만 보인다. 홈은 `scrollWidth=305`로 잘림을 숨기지만 메뉴 열기를 클릭해도 열리지 않았다. 일반 게시판은 `scrollWidth=398`로 페이지 전체 가로 스크롤이 발생했다. 390에서도 `clientWidth=375`보다 메뉴 오른쪽 386이 커서 완전한 터치 영역이 확보되지 않는다.

**원인 근거:** `styles.css:1715`의 모바일 브랜드 rail 12rem, `header.tsx:423`의 shrink 방지, `header.tsx:544` 이하 로그인 utility 4개와 간격/우측 padding.

**수정 방향:** 좁은 화면에서 브랜드 공간을 줄이거나 작은 브랜드 변형을 도입한다. 필요하면 프로필/부가 기능을 메뉴 안으로 옮기되 검색·주요 메뉴의 발견성을 유지한다. 헤더의 각 요소별 최소 폭을 먼저 합산하고 구조를 설계한다. `overflow-x:hidden`만 추가해 완료 처리하지 않는다.

**완료 기준:** 320/360/375/390/430에서 게스트·학생·관리자 모두 헤더 버튼 rect가 clientWidth 안에 포함되고 메뉴/프로필을 클릭할 수 있어야 한다. 홈/일반 페이지 모두 불필요한 가로 스크롤이 없어야 한다. 768/1440 회귀 확인.

### V02 · P1 · 검색·알림 팝업의 왼쪽이 잘림

**재현:** 로그인 → 390×844 → 헤더 검색 또는 알림 열기. 430에서도 검색 패널 잘림을 관찰했다.

**측정:** 검색 패널 x=-106.6, width=341.8, right=235.2. 검색 입력 시작 x=-55.8. 알림 패널 x=-57.4, width=343.4, right=286. 검색어 앞부분과 알림 제목이 viewport 밖에 있다. 844×390에서는 검색 패널이 들어맞았다.

**원인 근거:** `header.tsx:561`과 `:631`에서 아이콘 기준 `right-0 top-full`로 큰 panel을 정렬한다. 폭을 `100vw`로 제한해도 패널의 왼쪽 위치를 제한하지 못한다.

**수정 방향:** 모바일에서 viewport 기준 좌우 inset을 가진 패널 또는 sheet로 전환한다. 검색은 전용 검색 페이지로 자연스럽게 연결하는 구조도 허용한다. anchor와 viewport 양쪽을 고려한 충돌 보정이 필요하다. 공통 `PopoverPanel` 수정 시 profile 등 다른 팝업도 확인한다.

**완료 기준:** 320~430 및 가로 화면에서 panel·입력·닫기/지우기 제어가 모두 화면 안에 있어야 한다. 검색어 입력 후 Enter 이동, 빈/많은 알림, Escape/바깥 클릭 닫기, focus 복귀를 확인한다.

### V03 · P1 · ChannelTalk이 동의/설문 제출 버튼을 덮음

**재현 A:** 새 합성 계정으로 첫 로그인 → 390×844 개인정보 제공 동의.

**측정 A:** 동의하고 저장 x=20.8..369.6, y=779.2..823.2. 채팅 launcher x=310.4..366.4, y=764..820. 동의 버튼 우측과 약 56×40.8px 겹친다. 실제 스크린샷에서도 채팅 버튼이 동의 버튼 위에 보인다.

**재현 B:** 종합 설문 → 390×844 또는 320×740 → 고정 제출 영역.

**측정 B:** 390 기준 제출 x=285.4..375.2, y=772.8..816.8. launcher x=295.2..351.2, y=748.8..804.8. 약 56×32px가 겹쳐 제출 라벨이 가려진다. 행렬 문항으로 이동해도 겹침이 유지된다.

**원인 근거:** `channel-talk-provider.tsx:86`에서 SDK zIndex=90. 공통 `modal.tsx`의 outer layer는 z=70. 주석의 모달 우선 설명과 실제 숫자가 반대다. 설문 footer와 launcher의 공간 예약도 충돌한다.

**수정 방향:** 공통 layer 순서를 명시하고 모달/드로어 표시 중 launcher를 숨기거나 modal 아래로 둔다. 고정 제출/저장바가 있는 페이지에서는 launcher 위치를 올리거나 해당 페이지에서 대체 상담 진입점을 제공한다. 임의의 큰 z-index를 페이지마다 추가하지 않는다. `channel-talk-safe-area` 클래스 유무만으로 안전하다고 판단하지 말고 실제 rect 교차를 확인한다.

**완료 기준:** 동의·설문 제출·작성 저장바·모바일 메뉴에서 launcher와 핵심 제어의 rect 교차가 0이어야 한다. 모달 중 배경 채팅 버튼을 클릭/focus할 수 없어야 한다. 모달을 닫으면 상담 진입점이 정상 복구되어야 한다.

### V04 · P1 · 게시글 작성 고정 작업바가 상단에서 제목·헤더와 충돌

**재현:** 관리자 → `/board/write` → 320×740, scrollY=0.

**측정:** 헤더 bottom=68.8. 작성 header y=68.8..159.6. 임시저장 y=54.8..98.8이라 사이트 헤더 아래로 일부 가려진다. 등록 y=106.8..150.8. 390에서는 버튼 3개가 y=106.8에 한 줄로 나오지만 제목 영역과 겹치고, 의도한 하단 고정바가 아니다.

**원인 근거:** `styles.css:1978`의 sticky `.board-write-page-header`에 backdrop-filter가 있다. 그 자손 `.board-write-page-actions`는 `:2012`에서 fixed/bottom:0으로 설정된다. 이 조합은 fixed의 기준 영역을 viewport 대신 조상으로 만들 수 있으며 관찰된 위치와 일치한다. `board-write-page.tsx:279`부터의 DOM 포함 관계도 확인할 것.

**수정 방향:** 모바일 작업바를 filter/transform 등이 없는 상위 layer로 옮기거나 portal로 분리한다. viewport 하단 고정 또는 페이지 내 sticky 중 한 구조로 명확히 설계한다. 320에서 취소·임시저장·등록 우선순위를 정하고 버튼/여백이 자연스럽게 들어가게 한다. 제목과 form 시작 영역을 정상 문서 흐름에 남긴다.

**완료 기준:** scroll=0/중간/끝에서 작업바 위치가 일관되고 제목·입력·마지막 설정을 가리지 않아야 한다. 320에서도 모든 action이 잘리지 않아야 한다. `/board/edit`에 해당하는 실제 편집 route, 행사 작성/편집의 공통 컴포넌트도 회귀 확인한다. 게시 없이 draft 저장 성공 경로를 별도로 검증한다.

### V05 · P1 · 관리자 사용자 카드의 연락처가 한 글자씩 줄바꿈

**재현:** 관리자 `/admin/users` → 320×740 → 검색에 `90990001` 입력.

**측정:** 카드 내부 연락처 cell 폭=62.1px, 이메일 요소 폭=13.24px, 연락처 행 높이=448px. 동의 시각 행 높이도 308px. 390에서도 이메일 행 높이 168px로 3~4글자씩 끊긴다. 페이지 scrollWidth는 정상이라 가로 overflow 검사만으로 발견되지 않는다.

**원인 근거:** `styles.css:3189`에서 card row를 `minmax(0,1fr) auto` 2열로 바꾸고, 각 td를 label/value flex로 다시 분할한다. 고정 label 공간과 두 번째 열이 첫 번째 열의 실제 값을 압박한다. 사용자 데이터 문제로 처리하면 안 된다.

**수정 방향:** 좁은 모바일 카드는 필드별 한 행을 기본으로 한다. label 위/value 아래 배치 또는 충분한 value 폭을 주는 단일 열 label-value 구조를 사용한다. 이메일·URL·시간 같은 긴 값에 불필요한 2열 배치를 적용하지 않는다. `AdminDataTable` 공통 규칙을 수정하고 다른 관리자 목록도 표본 확인한다.

**완료 기준:** 320에서 해당 이메일이 의미 있는 문자열 단위로 최대 2~3줄 이내에 읽히고 동의 시각이 정상 줄 단위로 읽혀야 한다. 긴 영문명·빈 값·행 action·카드 클릭을 유지한다. 768 카드/1024 이상 표 전환과 정렬/선택도 확인한다. `word-break:break-all`만 바꾸는 수정을 피한다.

### V06 · P2 · 모바일 달력의 날짜 선택 결과를 찾기 어려움

**재현:** `/calendar` 390×844 → 2026년 9월 → 9/11(13개 일정) 클릭.

**관찰:** 월간 grid에 제목 없는 긴 일정 막대와 +숫자가 반복된다. 선택 후에도 상세 heading `9월 11일 (금)`이 viewport y=1193.8에 있어 현재 화면 밖이다. 당시 scrollY=272였고 추가 확인에서도 같은 위치였다. 날짜 선택은 동작하지만 결과를 보기 위해 다시 길게 내려야 한다. hover 툴팁도 화면 우측에서 잘리는 장면을 확인했다.

**관련 소스:** `features/events-surveys/events-surveys-calendar-grid.tsx`, `events-surveys-calendar.tsx`, `events-surveys-day-details.tsx`, `events-surveys-calendar-utils.ts`.

**수정 방향:** 모바일은 작고 명확한 월간 날짜 선택 + 선택일 agenda 목록으로 다시 설계한다. 일정 수/범례는 유지하고, 상세를 달력 가까이에 두거나 접근 가능한 bottom sheet로 연다. 날짜 선택 후 사용자가 결과 위치를 알아볼 수 있어야 한다. 다일 일정의 색상 막대만으로 정보를 전달하지 않는다.

**완료 기준:** 320/390/430에서 날짜 선택 직후 선택일/일정 수/첫 일정 제목을 확인할 수 있어야 한다. 긴 제목, 0개/13개, 이전·다음 달, 오늘, 선택 URL, 키보드 탐색을 유지한다. 데스크톱 월간 보기와 분리 구현을 허용한다.

### V07 · P2 · 댓글의 답글/좋아요/관리 아이콘 클릭 영역이 작음

**재현:** `/board/notice/2` 320×740 → 댓글 영역.

**측정:** 댓글 좋아요 약 36.7×28px, 답글 약 34.1×28px, 댓글 숨기기 28×28px. 댓글 등록은 44×44px여서 크기가 일관되지 않다.

**수정 방향:** 댓글 action의 실제 클릭 영역을 프로젝트 모바일 목표인 최소 44×44px로 맞춘다. 텍스트/아이콘 자체를 과도하게 키울 필요는 없다. 관리자 전용 action은 더보기로 모아도 된다. 작성자·시간·댓글 본문과 클릭 영역이 충돌하지 않게 한다.

**관련 소스 찾기:** `features/board-detail/board-detail-sections.tsx`에서 렌더링하는 댓글 컴포넌트와 그 하위 `IconButton`/reply action 구현을 따라갈 것. 이 파일만 수정 대상으로 단정하지 않는다.

**완료 기준:** 320에서 답글·좋아요·더보기의 클릭 영역이 서로 겹치지 않고 44px 목표를 충족한다. 긴 작성자명/대댓글/관리 권한 여부에도 줄바꿈과 정렬이 유지되어야 한다.

## 5. 유지할 현재 구현

- 로드맵의 모바일 과목 목록 → 인라인 과목 상세 전환은 실제로 동작한다. 모바일에 거대한 그래프를 강제로 축소할 필요가 없다.
- 설문 행렬형 문항은 모바일에서 항목별 radio/checkbox 그룹으로 바뀌며 실제 선택이 된다. 데스크톱 table을 그대로 밀어 넣는 방식으로 되돌리지 않는다.
- 사용자 상세 drawer는 390 세로 및 844×390 가로에서 상세와 하단 action을 분리해 표시한다.
- 게시판/행사/투표 본문과 이미지의 기본 모바일 줄바꿈은 확인한 표본에서 유지되었다.
- 마이페이지의 긴 영문 이름은 정상 줄바꿈된다.

이 항목은 전체 디자인을 변경하지 말라는 뜻이 아니다. 개선이 필요하면 변경하되, 이미 동작하는 흐름을 회귀 기준으로 삼는다.

## 6. Luna max 실행 단위

한 번에 전체 CSS를 재작성하지 말고 아래 순서로 구현·재현·기록한다. 각 단위는 별도 commit으로 나눌 수 있지만 기존 미커밋 작업을 임의로 묶지 않는다.

| 작업 | 범위 | 선행 | 검증 산출물 |
| --- | --- | --- | --- |
| L00 | 로컬 환경 smoke test, 7개 이슈 현재 재현 | 없음 | 기준 viewport·계정·재현 여부 기록 |
| L01 | V01 헤더 + V02 검색/알림 패널 | L00 | 320/390/430 로그인 상태별 rect·클릭 결과 |
| L02 | V03 공통 layer와 launcher 배치 | L00 | 동의/제출/메뉴 겹침 0, focus·복구 결과 |
| L03 | V04 작성 action 구조 | L01, L02 | 320/390 작성·편집 scroll 위치별 캡처 |
| L04 | V05 관리자 카드 구조 | L00 | 긴 이메일/시간/다른 표본 목록 전후 비교 |
| L05 | V06 모바일 달력 재설계 | L01, L02 | 날짜 선택→상세 확인, 다일/다수/빈 일정 |
| L06 | V07 댓글 action 및 전체 회귀 | L01~L05 | 댓글 조작, 필수 viewport matrix, 미검증 목록 |

실행 프롬프트:

```text
docs/MOBILE_VIEWPORT_QA_2026-09-08.md를 작업서로 삼아 모바일 UI를 수정해라.
과거 기획/디자인/모바일 계획 문서를 요구사항으로 참조하지 마라.
현재 코드와 실제 실행 화면을 우선하고, 이미 모바일 구현이 있어도 더 좋은 구조로 다시 설계해도 된다.

모델은 GPT-5.6 Luna, reasoning max로 작업한다.
먼저 tools/mobile_qa/smoke_test.py로 로컬 Python SSO 환경을 확인해라.
SSO를 우회한 프론트엔드 가짜 로그인이나 권한 검사 제거로 대체하지 마라.
합성 관리자/학생 계정으로 320×740, 390×844, 430×932에서 결함을 직접 재현해라.
L00~L06 순서로 완료하고 768×1024, 844×390, 1440×900에서도 회귀 확인해라.

특히 overflowWidth만 검사하지 말고 각 버튼의 위치, 클릭 가능 여부,
popup의 음수 x, 채팅 버튼과 CTA의 교차, 긴 값의 실제 표시 폭을 확인해라.
현재 Docker web은 이미지에 소스를 복사하므로 변경한 코드가 실행 화면에 반영됐는지 검증해라.

UI/스타일 공통 구조부터 수정하고 계정·권한·동의·게시/설문 API 계약은 유지해라.
외부 메시지/메일 발송이나 Google Sheets 연결을 테스트에 사용하지 마라.
초안 자동 생성 등 테스트 중 발생한 로컬 데이터 변경을 기록해라.
.env나 원래 값 백업을 commit하거나 출력하지 마라.

변경 범위에 맞는 typecheck/lint와 실제 UI 검증을 수행하고,
각 V01~V07의 수정 파일·전후 근거·완료 기준 충족 여부를 같은 문서의 후속 결과에 추가해라.
실제 수행하지 않은 저장/제출, 브라우저 또는 기기 검증을 완료했다고 쓰지 마라.
```

후속 기본 검사:

```powershell
python tools/mobile_qa/smoke_test.py
pnpm build:shared
pnpm --filter @soc/web typecheck
pnpm --filter @soc/web lint
```

컴포넌트 동작을 바꾸면 관련 기존 테스트를 수행하고, 좌표 문제는 실제 브라우저에서 확인한다. CSS 문자열이 존재하는지만 확인하는 테스트로 시각 결함 해결을 증명하지 않는다.

## 7. 이번 환경 검증 결과

- Python SSO fixture health와 실제 API/Postgres/Redis health 정상.
- 실제 브라우저에서 관리자·학생 로그인 → 개인정보 저장 동의 → 세션 → 프로필/권한 표시 성공.
- 잘못된 client/transaction 거부, state 반환, nonce 일치, 합성 프로필 응답, 거래/인증 코드 재사용 거부 smoke test 통과.
- 임시 `.env`를 사용한 설정/복원 왕복, 후속 변경 충돌 거부, 무관한 키의 수정 보존 검증 통과. 실제 `.env`는 이 검사로 복원하지 않았다.
- Python 3개 스크립트 구문 검사 통과. `.env`, 원래 값 백업, Python 캐시의 git ignore 적용 확인.
- UI 수정 미실시. 따라서 이 문서의 V01~V07은 아직 해결되지 않았다.

## 8. 후속 구현 및 실제 화면 재검증 결과 — Codex (2026-09-08)

### 실행 조건

- Docker `web`, PostgreSQL, Redis를 다시 기동하고 `http://192.168.0.3:8765/` 로컬 SSO 프록시를 통해 실행했다. 로그인은 `90990001` 합성 관리자, `90990002` 합성 학생, `90990003` 동의 테스트 계정으로만 수행했다.
- 실제 브라우저 viewport `320×740`, `360×800`, `375×812`, `390×844`, `430×932`, `768×1024`, `844×390`, `1440×900`에서 DOM rect, clientWidth, scrollWidth, 포커스, 레이어 교차를 측정했다.
- 외부 메일·메시지·Google Sheets 연결은 사용하지 않았다. 게시글 등록, 임시저장, 설문 제출, 투표 제출은 실행하지 않았다.

### V01~V07 결과

| 항목 | 후속 구현 | 실제 검증 결과 |
| --- | --- | --- |
| V01 | 모바일 브랜드 rail/utility 폭 축소, 버튼 shrink 방지, 헤더 상태 클래스 추가 | **PASS**. 관리자 320px에서 검색 `128.8..172.8`, 알림 `172.8..216.8`, 프로필 `216.8..260.8`, 메뉴 `260.8..304.8`, `clientWidth=305`, `scrollWidth=305`. 360/375/390/430 및 768/1440에서도 모든 표시 버튼이 clientWidth 안에 있었다. 메뉴·프로필 실제 클릭 성공. |
| V02 | 검색·알림 panel을 모바일 viewport 좌우 inset 기준으로 배치하고 Escape 포커스 복원 | **PASS**. 320px panel `x=12..292.8`, 390px `12..363.2`, 430px `12..403.2`, 가로 844px 검색 `292.4..644.4`/알림 `332.8..732.8`. 검색어 `공지` Enter 후 `/search?q=공지` 이동, Escape 후 panel 닫힘 및 검색/알림 trigger 포커스 복귀 확인. |
| V03 | 모달·모바일 메뉴 중 ChannelTalk shadow UI 전체 숨김, 작성/설문 고정 영역에서는 bottom offset, z-index 정리 | **PASS**. 390px 동의 모달의 두 CTA 및 390/320px 설문 제출 CTA와 상담 fixed rect 교차가 모두 0. 메뉴 중 visible fixed 상담 레이어 0개. 모달을 닫으면 390px 상담 launcher가 `x=295.2..351.2`, `y=764..820`으로 복구됐다. |
| V04 | 모바일 작성 header의 backdrop/sticky 충돌 제거, 작업바를 viewport 하단 fixed layer로 분리 | **PASS**. `/board/write` 320px 작업바 `x=0..304.8`, `y=679.2..740`, 버튼 3개 모두 `h=44`, 상·중·하 scroll에서 동일 위치. `/board/notice/2/edit` 390px도 작업바 `y=783.2..844`, 버튼 `h=44`, 상담 launcher와 교차 0. |
| V05 | 관리자 카드 row 단일 열, label/value 단일 열 표시, 긴 값의 의미 단위 줄바꿈 | **PASS**. 320px `90990001` 카드의 이메일 value 폭이 `209.6px`, 2줄(`mobile-qa-`/`admin@example.invalid`), row 높이 `427.2px`로 측정됐다. 기존 이메일 요소 `13.24px`/row `929.2px` 대비 한 글자 단위 압축이 제거됐고 `scrollWidth=305`였다. |
| V06 | 모바일 선택일 요약(날짜·일정 수·첫 일정) 추가, grid row 축소 및 tooltip viewport clamp | **PASS(13개 일정 기준)**. 320/390/430px에서 9/11 선택 직후 `9월 11일 (금) · 13개의 일정 · 첫 일정` 요약이 달력 바로 앞에 표시되고 상세 heading도 즉시 확인됐다. 390px tooltip `x=94..195.4`로 viewport 안에 있었다. URL은 `/calendar`를 유지했고 `오늘`/다음 달 이동 후 기준 월 복구를 확인했다. 현재 fixture에는 0개 일정 날짜가 없어 0개 분기만 미검증이다. 1440px에서는 모바일 요약이 숨고 데스크톱 grid가 유지됐다. |
| V07 | 댓글 좋아요·답글·관리 action에 모바일 최소 touch target 적용, 데스크톱 원래 compact height 유지 | **PASS**. 320px 좋아요·답글·관리 action이 모두 `44×44px`이고 서로 겹치지 않았다(`x=66.8..110.8`, `112.8..156.8`, `158.8..202.8`). 768px에서는 기존 compact 높이 좋아요 `40.7×28`, 답글 `38.1×28`, 관리 `28×28`로 회귀했다. |

### 변경 파일

- `apps/web/src/components/organisms/header.tsx`: 헤더 모바일 상태 클래스, popover viewport inset, Escape 포커스 복원
- `apps/web/src/components/ui/modal.tsx`: 모달 open 상태 공통 body layer 상태
- `apps/web/src/features/channel-talk/channel-talk-provider.tsx`: 상담 launcher offset 및 모달/메뉴 중 shadow layer 숨김
- `apps/web/src/features/events-surveys/events-surveys-calendar.tsx`: 모바일 선택일 요약
- `apps/web/src/features/events-surveys/events-surveys-calendar-grid.tsx`: 모바일 tooltip clamp와 grid row 변수
- `apps/web/src/components/ui/comment-section.tsx`, `apps/web/src/styles.css`: 댓글 touch target, 작성/관리자 카드/헤더 공통 responsive 규칙

### 검사 결과

- `python tools/mobile_qa/smoke_test.py` PASS
- `pnpm build:shared` PASS
- `pnpm --filter @soc/web typecheck` PASS
- `pnpm --filter @soc/web lint` PASS
- `pnpm --filter @soc/web build` PASS
- `git diff --check` PASS (기존 줄바꿈 변환 경고만 출력)
- API health `postgres.ok=true`, `redis.ok=true`; Docker web 이미지 재빌드 및 컨테이너 재기동 완료

남은 검증 범위는 0개 일정용 별도 fixture, 실제 모바일 기기/브라우저 키보드, 200% 확대, 모든 breakpoint 경계와 문서에 명시된 저장·제출 성공 경로다. 이번 수정에서는 데이터·권한·API 계약을 변경하지 않았으며, 실제 게시·저장·제출은 의도적으로 수행하지 않았다.
