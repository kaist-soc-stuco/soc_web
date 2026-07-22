# SOC Web 전체 화면 디자인 감사

- 작성일: 2026-07-15
- 감사 대상: 현재 작업 트리의 공개·인증·관리자 전체 라우트
- 기술 감사: `docs/PROJECT_AUDIT_2026-07-15.md`

> **후속 구현 안내:** 아래 화면 평가는 감사 시점 관찰을 보존한다. 공개 설문 원문 차단, `PRIVATE` 기본값, 회비 시각 무결성 등 이후 Gate 0 상태는 `docs/GATE0_IMPLEMENTATION_2026-07-15.md`를 함께 확인한다.

## 결론

사용자가 말한 “실제 운영 페이지가 아니라 AI가 그럴듯하게 만든 페이지처럼 보인다”는 평가는 타당하다. 개별 컴포넌트의 완성도가 낮아서라기보다, 실제 학생회 운영 정보보다 장식 문법이 앞서고 페이지마다 다른 시각 체계를 사용하기 때문이다.

현재 화면의 대표적인 인상은 다음과 같다.

- 초록 gradient hero, radial glow, 둥근 흰 카드, pill badge, Lucide 아이콘, 약한 그림자가 거의 모든 페이지에서 반복된다.
- 실제 사진이 없을 때 서로 다른 색의 추상 gradient를 행사 대표 이미지처럼 사용해 생성형 시안 느낌이 강하다.
- 제목과 설명은 그럴듯하지만 장소, 담당자, 신청 마감, 갱신일, 근거 링크 같은 운영 정보가 부족하다.
- 홈, About, 설문, 로그인, 관리자 설문 편집기가 서로 다른 제품처럼 보인다.
- 모바일 홈에는 로고와 hero가 사라지고, 게시판은 390px에서 내용이 잘린다.
- 테스트 글 `ㅇㅇ`, `아`가 실제 콘텐츠 사이에 노출되어 신뢰를 크게 떨어뜨린다.
- 오류를 빈 목록으로 바꾸는 화면이 많아 “정말 데이터가 없음”과 “사이트가 고장남”을 구분할 수 없다.

개선의 핵심은 더 화려한 디자인이 아니다. 공통 shell, 실제 콘텐츠 규격, 명확한 상태, 업무 중심 관리자 UI, 모바일 전용 정보 구조가 필요하다.

## 확인 환경

- 데스크톱 공개/관리자: 1440×1000
- 모바일 공개: 390×844
- 언어: 한국어를 기본으로 확인하고 영어 전환과 영문 데이터 존재 여부를 점검
- 상태: 비로그인, Mock 관리자 로그인, 빈 목록, 마감 설문, 공개 결과, 없는 응답, 404
- 데이터: 로컬 API/PostgreSQL의 현재 seed 및 기존 개발 데이터

### 스크린샷 아카이브와 증거 범위

이번 감사의 로컬 스크린샷 아카이브는 `C:\Users\Newbiedev\.codex\visualizations\2026\07\15\019f6408-22dd-7543-b118-ee3ef838a5cd`에 있다. PNG 41장과 viewport JPG 3장, 총 44장이다. 대표 파일은 `soc-home-desktop.png`, `soc-home-mobile-viewport.jpg`, `soc-board-mobile-viewport.jpg`, `soc-events-desktop.png`, `soc-admin-survey-edit-desktop.png`, `soc-admin-finance-desktop.png`다. 이 경로는 로컬 감사 증거이며 저장소 배포 자산은 아니다.

스크린샷은 대표 상태를 보존한 것이고 상태마다 한 장씩 저장한 것은 아니다. `/about/roadmap`, `/login` callback·동의, 게시글 수정, 관리자 콘텐츠, 응답 상세는 전용 캡처 파일 없이 실제 렌더링·DOM 점검과 소스 검토를 함께 사용했다. 아래 표에서 `확인`은 실제 렌더링, `소스`는 코드 경로 검토를 뜻한다.

브라우저에서 확인한 주요 사실:

| 화면 | 실제 관찰 |
|---|---|
| 데스크톱 홈 | `h-screen` 내부에 콘텐츠를 가둬 작은 높이에서는 하단이 잘리고 Footer가 없음 |
| 모바일 홈 | 상단에 로고/브랜드가 보이지 않고 아이콘 세 개만 남음. Footer도 없음 |
| 모바일 게시판 | hero 설명, 탭, 검색, 표가 가로로 잘리거나 어색하게 줄바꿈됨 |
| 행사 목록 | 항목이 1개인 상태 그룹도 3열 grid 자리를 유지해 오른쪽이 크게 비어 있음 |
| 영문 행사 목록 | 영문 제목 아래 5개 행사 설명이 모두 한국어로 남음 |
| 영문 게시판 | 공식 작성자명이 `전산학부 학생회`로 남아 언어가 혼합됨 |
| About 구성원 | 큰 hero와 카드 뒤에 “등록된 구성원이 없습니다”만 표시 |
| 설문·결과 | Footer가 없고 별도 card shell을 사용해 공개 사이트와 단절됨 |
| 관리자 설문 편집 | 업무 도구에 큰 gradient hero와 glow가 사용됨. 감사 시점 결과 공개 기본값은 전체 공개였으며 후속 패치에서 `PRIVATE`로 변경됨 |
| 회비 관리 | 깔끔한 표 골격은 있으나 검색·이력·저장 피드백이 없고 통계가 잘못될 수 있음 |
| 이메일 | 화면 전체가 비활성 상태이며 실제 발송은 불가능 |

## 라우트·상태 점검표

`확인`은 실제 렌더링과 DOM을 점검했다는 뜻이고, `소스`는 변경을 일으킬 수 있는 상태를 코드로 추가 확인했다는 뜻이다.

| 영역 | 경로·상태 | Desktop | Mobile | 비고 |
|---|---|---:|---:|---|
| 홈 | `/`, KO/EN, 로그인 전/관리자 | 확인 | 확인 | loading, 실제 데이터 포함 |
| About | `/about?tab=intro` | 확인 | 확인 | KO/EN |
| About | `history`, `org`, `members` | 확인 | members 확인 | 나머지는 소스 반응형 확인 |
| Roadmap | `/about/roadmap` | 확인 | 확인 | 정적 유지 대상 |
| 게시판 | `/board`, `/board/:category` | 확인 | 확인 | loading과 loaded 모두 확인 |
| 게시글 | `/board/행사/48` | 확인 | 확인 | 행사·연결 설문·댓글 0 |
| 작성 | `/board/write` | 확인 | 소스 | 비로그인 SSO 이동, 관리자 form |
| 수정 | `/board/행사/48/edit` | 확인 | 소스 | 관리자 form |
| 행사 허브 | `/events-surveys?tab=event` | 확인 | 확인 | KO/EN, 시작 전/진행/마감 |
| 설문 허브 | `?tab=survey` | 확인 | 소스 | 현재 empty state |
| 일정 | `?tab=calendar`, `/calendar` redirect | 확인 | 확인 | 월 grid와 선택일 detail |
| 설문 참여 | `/survey/:id` | 확인 | 확인 | 마감 상태 실제 확인 |
| 설문 참여 상태 | 시작 전, 로그인 필요, 기응답, 수정, preview, 제출 성공·실패 | 소스 | 소스 | 지속 저장 동의가 없는 임시 로그인도 로그인 필요로 처리 |
| 설문 자격 | 학생회비 납부자 전용, 정원 도달 | 소스 | 소스 | 현재 사전 상태가 아니라 403/409의 포괄 오류로 합쳐짐 |
| 설문 결과 | `/survey/:id/results`, public | 확인 | 확인 | 공개 결과 실제 확인 |
| 설문 결과 권한 | private, admin-only | 소스 | 소스 | 접근정책별 상태 검토 |
| 검색 | `/search`, 검색어 없음 | 확인 | 확인 | About 정적 결과 4개 |
| 개인정보 | `/privacy`, KO/EN | 확인 | 확인 | 정책 초안 |
| 로그인 | `/login`, SSO 시작·processing | 확인 | 소스 | 외부 SSO로 자동 POST |
| 로그인 callback | consent-required, success, error, 유효하지 않은 result token | 소스 | 소스 | 동의 선택은 persisted/temporary 두 갈래 |
| 마이페이지 | `/mypage`, 로그아웃/관리자 | 확인 | 확인 | 개요·활동 navigation |
| 마이페이지 저장 모드 | temporary/persisted | 소스 | 소스 | temporary는 마이페이지 이용 불가 |
| 404 | 임의 없는 경로 | 확인 | 확인 | NotFound page |
| 관리자 진입 | `/admin` | 확인 | 소스 | 권한별 첫 허용 화면으로 이동 |
| 관리자 권한 경계 | 각 `/admin/*` 직접 URL, 권한 없음 | 소스 | 소스 | page별 guard가 현재 `/mypage`로 이동시킴 |
| 설문 관리 | `/admin/surveys` | 확인 | 소스 | 5개 seed survey |
| 설문 편집 | `/admin/surveys/new`, `/:id/edit` | 확인 | 소스 | 새 설문·마감 설문 |
| 응답 관리 | `/:id/responses`, `/:responseId` | 확인 | 소스 | empty와 없는 response |
| 사용자 | `/admin/users` | 확인 | 소스 | 2명 |
| 운영 로그 | `/admin/audit-logs` | 확인 | 소스 | 7개 row |
| 권한 | `/admin/permissions` | 확인 | 소스 | 개발 관리자 역할 |
| 회비 | `/admin/finance` | 확인 | 실패 방식 확인 | 사용자 2명, PAID/UNPAID |
| 콘텐츠 | `/admin/content` | 확인 | 소스 | 10개 고정 문구 |
| 연락망 | `/admin/contacts` | 확인 | 소스 | empty state |
| 이메일 | `/admin/emails` | 확인 | 소스 | 전체 비활성 |

## 왜 AI 시안처럼 보이는가

### 1. 디자인 문법이 콘텐츠보다 먼저 보임

소스 전체에 `rounded-2xl`이 최소 85회, `rounded-3xl`이 21회, 임의 shadow가 63회 이상 등장한다. 중요한 정보와 장식 카드가 같은 문법을 사용해 위계가 약하다.

개선:

- 기본 surface radius를 8px, 강조 card를 12px로 줄인다.
- 그림자는 overlay와 한 단계 높은 panel에만 사용한다.
- 표·목록·정책 문서는 border와 spacing으로 구분하고 카드 안에 다시 카드를 넣지 않는다.
- pill은 상태와 compact filter에만 사용한다.

### 2. 추상 gradient가 실제 운영 콘텐츠를 대체함

대표 이미지 없는 행사마다 보라·파랑·초록 추상 이미지가 붙는다. 서로 다른 행사가 같은 생성형 template의 색상 variant처럼 보인다.

개선:

- 대표 카드형 행사는 16:9 대표 이미지 또는 SOC 로고·행사 유형·날짜만 담은 공식 공통 placeholder 중 하나를 요구한다.
- 날짜 중심 compact list를 선택한 구역은 모든 항목에서 media 영역 자체를 생략한다.
- 같은 구역 안에서 임의 gradient와 이미지 없는 card를 섞거나, 색상을 행사마다 임의 배정하지 않는다.

### 3. 모든 페이지가 landing page처럼 말함

게시판 목록·상세, 검색, 설문 편집기까지 큰 hero가 반복된다. 사용자는 제목을 다시 읽는 대신 게시글, 신청 마감, 필터, 저장 상태를 보고 싶다.

개선:

- full hero는 홈과 About 첫 화면에만 사용한다.
- 게시판·행사·검색은 120~180px의 compact section header를 사용한다.
- 상세·작성·관리자는 breadcrumb + 32px 이하 page title로 시작한다.
- 관리자에서는 gradient hero를 제거한다.

### 4. 운영의 흔적이 없음

실제 사이트는 누가 언제 무엇을 관리하는지가 드러난다. 현재는 일반적인 소개 문장과 CTA가 많고 다음이 빠져 있다.

- 게시·최종 갱신일
- 담당 부서와 공식 연락처
- 행사 장소, 신청 기간, 정원, 신청 상태
- 정책 시행일과 개정 이력
- 콘텐츠 검수자와 번역 상태
- 장애·부분 실패 상태

이 정보를 먼저 모델링하고 화면에서 일관되게 보여야 한다.

### 5. 실제 데이터가 시각 신뢰를 깨뜨림

관리자 로그인 후 홈과 행사 목록에서 `ㅇㅇ`, `아` 같은 개발 글이 정상 공지 사이에 나타났다. 구성원은 비어 있고 연혁·조직은 검증되지 않은 하드코딩이다.

개선:

- reference seed와 demo seed를 분리한다.
- production에는 demo seed와 테스트 글을 절대 넣지 않는다.
- 공개 콘텐츠에는 `draft`, `review`, `published`, `archived` 상태를 둔다.
- 실제 정보가 준비되지 않은 섹션은 가짜 내용을 채우지 말고 navigation에서 숨기거나 검증된 최소 안내만 둔다.

## 제안하는 디자인 방향

키워드: `공식적`, `학생 친화적`, `업무 중심`, `이중언어`, `콘텐츠 우선`

SOC 사이트는 마케팅 landing보다 학생회 운영 포털에 가깝게 설계한다.

### 공개 shell

```text
상단 유틸리티: SOC 정체성 · KO/EN · 검색 · 로그인/마이페이지
주요 탐색: 게시판 · 행사/설문 · 소개
페이지 본문: compact header 또는 필요한 경우에만 hero
하단: 공식 연락처 · 개인정보 · Instagram · 최종 갱신 정보
```

- desktop header 높이 64~72px, 모바일 56~64px
- 모바일에서도 KAIST/SOC를 식별할 수 있는 축약 로고를 항상 표시
- 모바일 menu drawer 안에 언어, 로그인, 모든 하위 탐색을 포함
- Footer를 홈·설문·결과를 포함한 모든 공개 페이지에 적용

### 관리자 shell

```text
상단: 현재 사용자 · 환경 표시 · 전역 검색(필요할 때만) · 저장/동기화 상태
좌측: 업무 도메인별 navigation
본문 header: breadcrumb · 제목 · 짧은 설명 · primary action
본문: 필터/요약 → 데이터 목록/폼 → 변경 이력
```

- 알림 기능이 없으면 빈 Bell 버튼을 제거한다.
- `/admin`은 설문 목록 redirect가 아니라 실제 운영 대시보드로 만든다.
- desktop 우선 폭은 1280px 이상으로 명시한다.
- 모바일 관리자에서는 억지로 표를 축소하지 말고 “데스크톱 권장” 안내와 읽기 전용 핵심 요약을 제공한다.

## 디자인 토큰 권장안

| 토큰 | 권장 기준 |
|---|---|
| Brand 900 | `#004B2B` — hero와 강조 배경 |
| Brand 700 | `#006E3F` — primary action |
| Brand 100 | `#DDEFE5` — 선택·정보 배경 |
| Canvas | `#F5F7F6` |
| Surface | `#FFFFFF` |
| Text strong | `#17211C` |
| Text muted | `#66736C` |
| Border | `#D9E1DC` |
| Danger | rose/red, 텍스트·아이콘과 함께 사용 |
| Warning | amber, 마감·주의 상태에 한정 |
| Radius | 8px 기본, 12px 강조, 16px hero media만 |
| Shadow | `0 4px 16px rgba(14,35,24,.06)` 한 종류 중심 |

폰트는 실제 bundle 또는 신뢰할 수 있는 webfont source로 명시한다. `font-outfit`을 클래스만 쓰고 font를 로드하지 않는 상태는 제거한다.

권장 조합:

- 한국어·숫자·본문: Pretendard Variable 또는 Noto Sans KR
- 영문 보조: Inter
- 별도 display font는 사용하지 않거나 로고에만 한정

크기 기준:

- public page title: 32~40px desktop, 28~32px mobile
- admin page title: 28~32px desktop
- section title: 20~24px
- body: 15~16px
- metadata/table: 13~14px, 대비는 WCAG AA 유지

## 공통 상태 설계

모든 데이터 화면에 같은 상태 component와 문구 정책을 적용한다.

| 상태 | 보여줄 내용 | 금지 |
|---|---|---|
| Loading | skeleton과 대상 이름 | 전체 빈 화면, `null` |
| Empty | 왜 비었는지 + 다음 행동 | 장애를 빈 상태로 위장 |
| Partial | 성공한 영역 + 실패 영역 재시도 | 전체 페이지 실패 |
| Error | 네트워크·5xx 원인 범주 + 재시도 + 문의 ID | 장애를 404나 empty로 위장 |
| Forbidden | 접근정책이 존재 공개를 허용할 때 필요한 자격과 돌아갈 경로 | 내부 오류 코드까지 404와 합침 |
| Not found | 찾을 수 없음 + 검색/목록 | 실제 서버 장애를 “없음”으로 표시 |
| Fallback | 기본 콘텐츠 사용 중 + telemetry | 정상 최신 콘텐츠처럼 표시 |
| Success | 저장 시각·저장 주체·다음 행동 | native `alert`만 사용 |

403과 404는 내부 오류 코드·로그·telemetry에서 반드시 구분한다. 다만 비공개 글이나 민감한 관리자 리소스처럼 존재 자체를 숨겨야 하는 경우에는 access policy에 따라 사용자 문구와 외부 status를 404로 통합할 수 있다. 이 예외는 화면마다 임의로 정하지 않고 리소스 정책으로 명시한다.

## 라우트별 디자인 평가 — 공개 영역

### `/` 홈

현재:

- desktop은 좌측 사진 hero와 우측 bento dashboard가 한 viewport에 고정된다.
- 작은 높이에서 하단 공지·달력이 잘리고 자연스러운 페이지 scroll이 없다.
- 모바일은 hero와 로고가 모두 사라져 검색·사용자·menu 아이콘만 보인다.
- “이번 주 주요 행사”는 실제 이번 주 일정이 아니라 최근 행사 게시글이다.
- 행사 이미지가 generic gradient이고, Footer가 없다.

개선안:

1. 고정 `100vh`와 내부 overflow를 제거하고 자연스러운 문서 흐름으로 바꾼다.
2. 상단에는 `오늘 기준 가장 가까운 마감/행사` 1~2개만 강하게 보여준다.
3. 다음 행에 공지 5개, 이번 주 일정, 진행 중 설문을 실제 날짜 기준으로 배치한다.
4. 행사가 없으면 빈 calendar보다 다음 30일 일정과 학사/학생회 주요 날짜를 보여준다.
5. 모바일 첫 화면에 SOC 축약 로고, 오늘의 핵심 공지, 마감 CTA가 모두 들어오게 한다.
6. test 글과 demo image를 제거한다.

완료 기준:

- 390px와 1440px에서 가로 clipping이 없다.
- 모든 높이에서 scroll로 Footer까지 도달한다.
- “이번 주” 문구와 조회 기간이 실제로 일치한다.

### `/about?tab=intro`

현재:

- 큰 초록 hero 뒤에 다시 큰 카드가 온다.
- 소개 문구는 일반 학생회 template 수준이고 실제 담당·대표성·연락 방식이 부족하다.

개선안:

- hero를 절반 높이로 줄이고 임기, 대표 대상, 주요 역할, 공식 문의를 첫 화면에 표시한다.
- “우리가 하는 일”을 추상 가치 3개 대신 실제 서비스와 담당 부서 목록으로 바꾼다.
- 최근 활동 3개를 게시글과 연결하고 최종 갱신일을 표시한다.
- 알 수 없는 `tab` 값은 빈 card를 만들지 말고 `intro`로 정규화한다.

### `/about?tab=history`

현재:

- 2024~2026 연혁이 검증되지 않은 하드코딩으로 보인다.
- 연혁 카드가 일반적인 AI 작성 성과 문장처럼 읽힌다.

개선안:

- 확인된 연도, 사건, 근거 링크 또는 기록 문서만 게시한다.
- 각 항목에 실제 사업명·기간·결과를 짧게 적는다.
- 사실 확인 전에는 tab 자체를 숨기는 편이 가짜 연혁보다 낫다.

### `/about?tab=org`

현재:

- 조직도가 gradient box와 연결선 중심의 장식 diagram이다.
- 권한 화면에 적힌 역할과 실제 조직/기능이 일치하지 않는다.

개선안:

- 실제 기수의 조직명, 책임, 공식 연락 채널을 단순한 tree/list로 표현한다.
- 모바일에서는 연결선 diagram 대신 부서별 accordion을 사용한다.
- 운영 기능이 없는 POM grader·챗봇·배너 관리 같은 역할 설명을 제거한다.

### `/about?tab=members`

현재:

- 큰 hero와 card 이후 “등록된 구성원이 없습니다”만 보여 페이지가 미완성처럼 보인다.
- 소스 문구에 “집행위원회 집행위원회 명단” 중복이 있다.

개선안:

- 공개 동의가 있는 구성원만 이름, 직책, 임기, 직책용 이메일, 담당 업무로 표시한다.
- 개인 전화번호는 기본 비공개로 둔다.
- 구성원이 없으면 navigation에서 tab을 숨기거나 대표 문의만 표시한다.

### `/about/roadmap`

현재:

- 현재 공개 페이지 중 구조가 가장 안정적이다.
- “공식 이수 기준 아님” 안내도 적절하다.
- 다만 KAIST 고유 과목·URP·연구실·교환·학사 링크와 검토일이 없어 일반적인 CS 조언처럼 보인다.

개선안:

- 정적 페이지로 유지한다.
- 책임 부서, 최종 검토일, 공식 학사 안내 링크를 상단에 추가한다.
- 단계마다 KAIST 실제 리소스 링크와 SOC 관련 게시판 검색 링크를 붙인다.
- 학년 label보다 현재 준비 상태를 우선하는 현재 방향은 유지한다.

### `/board`, `/board/:category`

현재:

- desktop에서 hero와 category tab이 많은 세로 공간을 차지한다.
- 모바일 390px 스크린샷에서 hero 설명, tab, 검색, 표 우측이 잘렸다.
- 전체 게시판과 카테고리 게시판의 서버/클라이언트 페이지네이션 방식이 다르다.
- loading 때 “총 0건”이 먼저 보여 잘못된 상태가 노출된다.
- 영문 화면에서도 공식 작성자명이 한국어로 남는다.

개선안:

- hero를 compact header로 줄이고 category는 horizontally scroll 가능한 tab 또는 filter drawer로 만든다.
- desktop은 표를 유지하되 제목이 유연하게 늘고 작성자·날짜·조회는 고정 폭으로 둔다.
- 모바일은 표 축소가 아니라 `category / 제목 / 작성자·날짜 / 상태` 카드 목록으로 전환한다.
- 고정 공지는 별도 top block으로 분리한다.
- 검색·정렬·페이지네이션을 모두 서버 기준으로 통일한다.

완료 기준:

- 320~430px에서 어떤 텍스트·control도 clipping되지 않는다.
- loading 중 총 개수와 pagination을 숨기거나 skeleton으로 표시한다.

### `/board/:category/:articleId`

현재:

- category hero와 tab을 상세에서도 반복해 본문보다 장식 비중이 크다.
- 403, 404, 서버 오류가 비슷한 “없거나 볼 수 없음”으로 처리된다.
- 댓글은 첫 50개만 표시한다.

개선안:

- hero를 제거하고 breadcrumb, category badge, 제목, 게시·수정일, 담당자 순으로 시작한다.
- 행사 글은 장소, 전체 일정, 신청 상태, 정원, 연락처, calendar 추가를 별도 정보 block으로 둔다.
- 첨부와 연결 설문은 본문 뒤 명확한 section으로 둔다.
- 관련 글보다 이전/다음과 같은 board의 최신 글을 compact하게 제공한다.
- 공개 글처럼 존재 공개가 허용된 리소스는 403·404·5xx 화면을 분리한다. 비공개 리소스는 존재 은닉 정책에 따라 외부 404를 사용할 수 있지만 내부 telemetry는 원인을 보존한다.

### `/board/write`, `/board/:category/:articleId/edit`

현재:

- 인증 확인 중 1초 이상 빈 화면이 나타날 수 있다.
- 한국어/영어가 숨겨진 tab이라 번역 누락을 동시에 확인하기 어렵다.
- 게시글 설정, 행사 일정, 첨부, 설문 연동이 한 긴 form에 섞인다.
- 임시저장은 사용자별 key가 아니고 첨부·연결 설문을 복원하지 않는다.

개선안:

- AuthGuard loading shell을 표시한다.
- desktop은 본문 2/3 + 설정 1/3 sticky panel로 구성한다.
- KO/EN 완성도 badge와 병렬 preview를 제공한다.
- 행사·공지의 영어 필수 여부를 서버와 함께 검증한다.
- autosave 시각과 사용자별 draft를 표시하고 이탈 방지를 추가한다.
- 게시+설문 연결을 단일 서버 transaction으로 처리한다.

### `/events-surveys?tab=event`

현재:

- 시작 전/진행 중/마감 그룹이 명확한 점은 좋다.
- 항목 1개도 3열 grid의 한 칸만 차지해 큰 빈 공간이 생긴다.
- 추상 gradient, 작은 metadata와 반복 카드가 prototype 인상을 만든다.
- 장소·주최·연락처·정원·calendar 추가가 없다.
- 영문 화면에서 제목은 영어지만 확인한 행사 설명 5개가 모두 한국어로 남았다.

개선안:

- desktop은 항목 수에 따라 1~3열 auto-fit 또는 date-led list를 사용한다.
- 진행 중/곧 마감만 상단에 두고 종료 항목은 접거나 archive로 보낸다.
- 이미지보다 날짜, 상태, 장소, 신청 CTA를 우선한다.
- 공식 공통 placeholder 하나만 사용한다.
- 공식 행사는 제목·설명·metadata의 KO/EN completeness가 충족된 경우에만 영문 공개한다.
- 알 수 없는 `tab` query는 `event`로 정규화하고 URL도 교정한다.

### `/events-surveys?tab=survey`

현재:

- 현재 데이터에서는 종료된 연결 설문이 있어도 빈 tab으로 보인다.
- “다른 탭을 확인” 외에 왜 비었는지 설명이 없다.

개선안:

- 진행 중, 시작 예정, 종료·결과 공개를 분리한다.
- 연결 행사와 설문 관계를 양쪽 화면에서 보여준다.
- 로그인 필요, 회비 납부자 전용, 응답 수정 가능 여부를 참여 전에 표시한다.

### `/events-surveys?tab=calendar`, `/calendar`

현재:

- 데스크톱과 모바일 모두 calendar grid는 동작한다.
- 날짜 상세 영역이 페이지 목적 대비 크고 일정이 없을 때 정보 밀도가 낮다.

개선안:

- desktop은 월 grid + 선택일 agenda, 모바일은 agenda를 기본으로 하고 월 grid를 전환형으로 둔다.
- 행사, 설문 마감, 학교 공휴일을 색상뿐 아니라 icon/label로 구분한다.
- Google/Apple/ICS 추가 기능과 timezone을 명시한다.

### `/survey/:id`

현재:

- 마감·로그인·이미 응답 상태 분기는 비교적 충실하다.
- 공개 shell과 달리 Footer가 없다.
- 긴 설문의 진행률, autosave, 개인정보·회비 자격 안내가 없다.

개선안:

- PublicShell과 Footer를 사용한다.
- 시작 전에 소요 시간, 문항 수, 실명/익명, 결과 공개, 보유 기간, 자격을 요약한다.
- section progress, autosave, resume, 제출 전 review를 제공한다.
- 로그인 후 같은 설문으로 돌아온다.

### `/survey/:id/results`

현재:

- 선택형·자유서술 question을 같은 결과 card 문법으로 표현한다.
- 자유서술 원문 공개 위험이 있고 Footer가 없다.
- “이전 페이지”가 외부 referrer까지 나갈 수 있다.

개선안:

- 공개용은 선택형 aggregate와 표본 수, 집계 시각만 보여준다.
- 자유서술은 운영자가 작성한 검토 요약만 공개한다.
- 결과 공개 기준과 익명화 방식을 상단에 설명한다.
- 목록/원 설문으로 가는 명시적 link를 사용한다.

### `/search`

현재:

- 검색어가 없어도 About 결과 4개가 보여 가짜 검색 결과처럼 보인다.
- 게시판 0, 설문 0, 소개 4가 동시에 노출된다.
- 결과 highlight, 관련도, pagination과 부분 실패가 없다.

개선안:

- 검색 전에는 인기 검색어가 아니라 검색 범위와 예시만 보여준다.
- 검색 후 tab별 개수, match highlight, 필터, 정렬을 제공한다.
- 한 API 실패가 전체 결과를 막지 않도록 section별 오류를 둔다.

### `/privacy`

현재:

- 수집, 목적, 보관, 문의 네 문단뿐인 임시 안내 수준이다.

개선안:

- sticky TOC 또는 anchor navigation을 둔다.
- 운영 주체, 수집 항목, 목적, 보유 기간, SSO·위탁, 쿠키·로그·업로드·설문·회비, 제3자 제공, 권리 행사, 담당 연락처, 시행일·개정 이력을 한·영으로 제공한다.
- 법률 문구를 card 여러 개로 장식하기보다 읽기 좋은 policy document로 만든다.

### `/login`

현재:

- 로컬 `/login`은 일반 로그인 form이 아니라 즉시 authorize 요청을 시작해 외부 KAIST SSO로 POST하는 callback·상태 route다. 이동 전 잠깐 보이는 중앙 status card와 callback UI가 SOC PublicShell과 단절된다.
- 외부 KAIST SSO 화면은 SOC가 직접 디자인할 범위가 아니며, 로컬 callback에서 processing, consent-required, success, error와 잘못된 token 상태를 책임져야 한다.
- callback 동의 화면의 정책 링크·버전·보유 기간·철회 방법이 부족하다.
- 원래 요청 경로로 돌아오지 않는다.

개선안:

- SSO redirect 전 SOC branded handoff 화면에 이동 대상과 개인정보 요약을 보여준다.
- 동의 checkbox 옆에 policy link와 버전을 표시한다.
- `returnTo`를 안전하게 검증해 원래 화면으로 복귀한다.

### `/mypage`

현재:

- desktop sidebar는 명확하지만 모바일에서는 숨고 대체 탐색이 없다.
- 모바일 실제 화면에는 개요와 “전체 보기”만 남아 내 정보·활동으로 이동하기 어렵다.
- 학생에게 중요한 회비 납부 상태와 개인정보 요청이 없다.

개선안:

- 모바일 segmented tab 또는 select navigation을 둔다.
- 상단 요약에 회비 상태, 마지막 로그인, 동의 버전, 진행 중 설문을 표시한다.
- 내 정보, 게시글, 댓글, 설문 응답을 독립적으로 실패·재시도하게 한다.
- 동의 철회, 데이터 export/삭제 요청과 공식 문의를 제공한다.

### `*` 404

현재:

- 기본 구조와 문구는 무난하다.

개선안:

- 홈/게시판/행사 CTA와 검색창을 제공한다.
- 잘못된 category나 tab이면 가장 가까운 유효 경로를 안내한다.

## 라우트별 디자인 평가 — 관리자 영역

### `/admin`

현재:

- 독립 대시보드가 아니라 사용자의 권한에 따라 설문·사용자·운영 로그·권한·학생회비 중 첫 허용 화면으로 redirect된다.
- 상단 Bell 버튼은 동작하지 않는다.

개선안:

- 오늘 처리할 작업, 진행 중 설문, 미납 인원, 번역 미완료, 실패한 이메일, 최근 위험 감사 로그를 보여주는 실제 운영 대시보드를 만든다.
- 동작 없는 Bell은 제거한다.

### `/admin/surveys`

현재:

- filter와 table 골격은 관리자 업무에 적합하다.
- 795줄 단일 feature로 모든 상태와 mutation이 섞여 있다.
- archive, 보존, 결과 공개 안전장치가 없다.

개선안:

- 상태, 유형, 기간, 공개 범위, 응답 수를 서버 filter로 통일한다.
- row primary action 하나와 overflow menu로 정리한다.
- `draft / scheduled / active / closed / archived` lifecycle을 명확히 한다.
- 공개 결과 경고와 응답 존재 시 구조 동결 상태를 row에서 보여준다.

### `/admin/surveys/new`, `/admin/surveys/:id/edit`

현재:

- 큰 gradient hero, rounded-3xl, glow, animation이 업무 도구보다 marketing page에 가깝다.
- 메타데이터 panel은 우측에 잘 배치됐지만 감사 시점 결과 공개 기본값이 전체 공개였다. 후속 패치에서 `PRIVATE`로 변경됐다.
- 감사 시점에는 공개·응답 존재 여부와 무관하게 문항을 수정할 수 있었다. 후속 행 잠금 동결은 실DB 경쟁 테스트까지 통과했다.

개선안:

- hero를 제거하고 title + 상태 + 저장 시각 + preview + publish action의 compact header로 바꾼다.
- 결과 공개 기본값 `비공개`, 자유서술 포함 시 공개 선택을 차단한다.
- form error summary, 이탈 방지, 실제 응답자 preview, keyboard reorder를 제공한다.
- 첫 응답 후 locked banner와 “새 버전 만들기”를 보여준다.

### `/admin/surveys/:id/responses`

현재:

- 빈 응답 목록과 CSV 버튼이 존재한다.
- “엑셀 다운로드”지만 실제 CSV이고 모든 데이터를 브라우저로 가져온다.

개선안:

- 서버 pagination, 응답 상태·날짜 filter, column 선택을 제공한다.
- 버튼 이름을 CSV로 맞추거나 실제 XLSX를 생성한다.
- export 전 PII 범위, 보유 목적, 파일 보관 경고와 재확인을 표시한다.
- export job과 다운로드를 감사 로그에 남긴다.

### `/admin/surveys/:id/responses/:responseId`

현재:

- 없는 응답도 동일 detail shell 안에서 처리해 오류 구분이 약하다.
- PII masking과 접근 이유가 없다.

개선안:

- not found, deleted, forbidden을 구분한다.
- 기본 masked view와 “원문 보기” 권한/감사를 둔다.
- 삭제 예정일, 동의 버전, export 포함 여부를 표시한다.

### `/admin/users`

현재:

- “유저 관리”지만 사실상 이름 검색과 상태 조회만 가능하다.

개선안:

- 사용자 detail drawer에 SSO profile, 역할, 회비, 동의, 활동, 상태 이력을 묶는다.
- 비활성화·데이터 요청은 이유와 확인이 있는 별도 command로 둔다.
- search debounce와 서버 filter를 적용한다.

### `/admin/audit-logs`

현재:

- 발생 시각, 담당자, action, 대상과 raw detail 조회만 있다.
- 날짜·행위·행위자 filter, correlation ID와 export가 없다.

개선안:

- 시간 범위, actor, action, target, 위험도 filter를 제공한다.
- 변경 전/후 값을 사람이 읽을 수 있는 diff로 보여준다.
- request ID, IP 정책, 결과 성공/실패를 연결한다.

### `/admin/permissions`

현재:

- 1,032줄 단일 화면이다.
- 학생회비 독촉 메일, 배너·calendar, POM grader·챗봇처럼 없는 기능을 제공하는 것처럼 설명한다.
- 역할 추가를 누르는 즉시 placeholder 역할이 DB에 저장될 수 있다.

개선안:

- 역할 목록, 역할 편집, 구성원을 명확한 3단 구조로 나눈다.
- 실제 route/API가 있는 권한만 노출한다.
- 새 역할은 client draft에서 작성 후 명시적으로 저장한다.
- 위험 권한과 변경 영향, 최근 변경 이력을 표시한다.

### `/admin/finance`

현재:

- 사용자당 수기 납부 상태라는 확정 요구와 기본 표 구조는 맞다.
- 전체/납부/미납 중 납부·미납 수가 현재 페이지 행만 세어 잘못될 수 있다.
- 검색, 변경 이력, 저장 feedback이 없고 상태 한 번 클릭으로 즉시 바뀐다.
- 감사 시점에는 비고만 바꿔도 납부일이 갱신될 수 있었다. 후속 패치에서 비고와 상태 patch를 분리했다.

개선안:

- 이름·학번·이메일 검색, 상태 filter, 전체 서버 집계를 제공한다.
- row에서 상태 변경 → 확인 → 저장 → 성공 시각을 표시한다.
- 비고와 상태 patch를 분리한다.
- 사용자당 단일 현재 상태는 유지하되 변경 이력을 side panel로 제공한다.
- 학기별 거래 원장, 자동 입금 대조, 환불 UI는 현재 범위에 추가하지 않는다.

### `/admin/content`

현재:

- KO/EN 병렬 입력과 좌측 영역 탐색은 현재 관리자 화면 중 비교적 좋은 패턴이다.
- 이름은 CMS지만 실제로는 10개 문구 override만 지원한다.
- 저장 즉시 공개되며 preview, draft, revision, rollback이 없다.
- 이탈 방지를 위해 history/popstate를 길게 가로채는 방식은 과도하다.

개선안:

- 정적 문구 editor와 구조화 콘텐츠 관리 영역을 분리한다.
- member, banner, content block, featured event를 entity로 관리한다.
- 번역 상태, preview, draft/publish, 예약, revision/rollback을 제공한다.
- 표준 router blocker/form dirty state로 이탈 방지를 단순화한다.

### `/admin/contacts`

현재:

- 실제 데이터가 없어 빈 관리자 화면처럼 보인다.
- 임기, 기수, 활성, 공개 동의, 사진, 공개/비공개 구분이 없다.

개선안:

- 구성원 CMS와 통합하거나 동일 entity를 사용한다.
- 직책, 부서, 임기, 표시 순서, KO/EN 역할, 공식 이메일, 공개 동의, active/archive를 관리한다.
- 개인 연락처는 별도 제한 권한으로 둔다.

### `/admin/emails`

후속 결정: 사용자가 구현 여부를 보류했다. 현재는 비활성 상태를 유지하고 desktop admin 개편의 필수 범위에서 제외한다.

현재:

- 발송 불가 경고가 명확하다는 점은 좋다.
- 전체 화면과 기본 menu에 노출되지만 실제 기능은 전혀 동작하지 않는다.

개선안:

- provider 연결 전에는 route를 feature flag 뒤에 두거나 현재처럼 준비 상태를 명확히 유지한다.
- 구현 후 audience estimate, preview, test send, 승인, schedule, queue status, 실패·반송·수신 거부를 한 workflow로 제공한다.
- 기존 “SUCCESS”가 실제 전달 성공이 아니라는 문구는 provider 상태 모델이 완성될 때까지 유지한다.

## 반응형·접근성 기준

### 공개 모바일

- 모든 주요 기능을 320px부터 사용 가능하게 한다.
- desktop table을 단순 축소하지 않고 mobile list/card로 바꾼다.
- category/tab은 한 줄 horizontal scroll 또는 filter drawer를 사용한다.
- 최소 touch target 44×44px, icon-only button에는 accessible name을 둔다.
- hero는 화면 높이를 점유하지 않고 핵심 정보와 CTA가 첫 viewport에 들어오게 한다.

### 관리자 모바일

desktop admin 우선이라는 요구를 유지한다.

- 1024px 미만에서는 desktop 권장 안내와 홈/읽기 요약을 제공한다.
- 긴 표와 form을 숨은 가로 영역에 밀어 넣지 않는다.
- 긴급 회비 상태 확인, 설문 마감, 이메일 발송 상태 정도만 읽기 가능하게 한다.
- 실제 수정 workflow는 desktop에서 수행하도록 명확히 표시한다.

### 접근성

- color만으로 상태를 구분하지 않는다.
- 모든 form error를 field와 page summary 양쪽에 연결한다.
- modal/drawer의 focus trap, Escape, focus return을 검증한다.
- 표 header/sort 상태, tab selected 상태, dropdown expanded 상태를 ARIA로 제공한다.
- KO/EN 전환 후 `html lang`, page title, live region을 함께 갱신한다.
- 애니메이션은 `prefers-reduced-motion`을 따른다.

## 콘텐츠 운영 규격

### 행사 최소 필드

- KO/EN 제목과 짧은 설명
- 시작·종료·신청 마감, timezone
- 장소 또는 온라인 링크
- 주최 부서와 공식 연락처
- 대상, 정원, 신청 상태
- 대표 이미지 또는 공식 placeholder
- 연결 설문/게시글
- calendar export
- 게시·갱신일

### 공지 최소 필드

- KO/EN 제목과 본문 또는 “한국어 전용”의 명시적 사유
- 담당 부서, 문의처
- 게시·수정일
- 첨부와 유효 기간
- 공개 범위와 고정 기간

### 구성원 최소 필드

- 이름 공개 동의
- 직책·부서·임기
- 직책용 이메일
- KO/EN 역할 설명
- 활성/보관 상태
- 개인 연락처 공개 여부

## 개편 순서

### 1단계 — 콘텐츠 진실성과 상태

1. test/demo 데이터 제거
2. 오류/빈/권한/부분 실패 공통 상태
3. 실제 About·연락처·정책 확인
4. 설문 결과 개인정보 차단

### 2단계 — desktop admin

1. 공통 AdminShell과 실제 `/admin` dashboard
2. 회비 관리 정확성·검색·이력
3. 설문 lifecycle·동결·결과 공개 안전장치
4. 사용자·권한·감사 로그
5. 구조화 CMS
6. 이메일 workflow는 사용자가 기능을 다시 채택할 때 별도 계획으로 편성

### 3단계 — 공개 shell과 모바일

1. Header/Footer/compact page header 통합
2. 홈 자연 scroll과 실제 일정
3. 모바일 게시판 list
4. 행사·설문·calendar
5. survey/mypage/privacy
6. About와 정적 roadmap

### 4단계 — 품질 고정

1. Storybook 또는 동등한 component state catalog
2. axe 접근성 검사
3. 390/768/1280/1440 시각 회귀
4. 실제 KO/EN 긴 문자열 screenshot
5. loading/empty/error/permission snapshot

## 화면 개편 완료 기준

- 모든 `App.tsx` route와 주요 tab이 route matrix에 있고 owner가 정해졌다.
- 공개 모든 페이지가 같은 Header/Footer와 상태 문법을 사용한다.
- 390px에서 홈, 게시판, 행사, 설문, 검색, 마이페이지가 clipping 없이 동작한다.
- 관리자 모든 변경 화면에 저장 중·성공·실패·변경 이력이 있다.
- gradient placeholder와 검증되지 않은 demo copy가 공개 화면에서 사라졌다.
- KO/EN 콘텐츠 completeness가 관리되고, 공개 전에 누락을 차단한다.
- 403, 404, 500, network, empty가 내부 코드와 telemetry에서 구분되고, 사용자 문구는 리소스 존재 공개 정책을 따른다.
- 핵심 viewport와 상태의 자동 screenshot regression이 CI에서 통과한다.

## 확인이 필요한 실제 콘텐츠

아래 정보는 디자인으로 만들어낼 수 없다. 확인 전에는 가짜 내용을 채우지 않는다.

1. SOC의 실제 연혁, 현재 기수, 조직명, 임원과 담당 업무
2. 공개 가능한 직책용 이메일과 개인 연락처 공개 동의
3. 공식 개인정보 담당자와 문의 주소
4. 이메일 발신 도메인·발신자명·회신 주소
5. 각 행사의 실제 장소, 담당 부서, 정원, 신청 링크의 데이터 출처
