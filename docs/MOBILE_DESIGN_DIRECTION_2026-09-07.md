# Mobile Responsive Design Direction

작성일: 2026-09-07

범위: `M00-D` 설계 방향 확정

성격: 이번 모바일 재설계의 구현 목표안. 실제 진행 상태는 후속 작업 기록에서 확인한다.

기준 정정(2026-09-08): 과거 프로젝트 문서의 디자인 규칙·요구사항·수정 이력은 판단 근거에서 제외한다. 현재 코드·실제 화면·사용 흐름과 이번 사용자 지시를 기준으로 한다. 이 문서의 선택도 개선 효과가 더 분명한 대안이 확인되면 근거와 검증 결과를 기록하고 갱신할 수 있다. 이미 허용된 모바일 재설계를 별도로 승인받는 절차를 만들지 않는다.

입력 문서: [M00 감사 문서](./MOBILE_RESPONSIVE_AUDIT_2026-09-07.md), [모바일 반응형 실행 계획](./MOBILE_RESPONSIVE_PLAN_2026-09-07.md)

## 1. 결정 요약

이번 문서는 실제 화면에서 확인한 M00 결과를 다음 구현 단계에서 바로 사용할 수 있는 화면·컴포넌트 결정으로 고정한다. 이번 단계에서는 앱 소스 구현을 하지 않는다.

전체 방향은 **content-first, viewport-bounded mobile shell**이다.

- 320–639px: 한 열 콘텐츠, 페이지 가로 스크롤 금지
- 640–1023px: 태블릿 폭을 활용하되 모바일 정보 구조와 접근 가능한 drawer를 유지
- 1024–1279px: header는 drawer를 유지해 GNB 충돌을 피하고, 본문만 점진적으로 확장
- 1280px 이상: 기존 desktop GNB와 정보 밀도를 유지
- 좁은 화면에서 정보를 삭제하기보다, 우선순위 순서와 progressive disclosure로 한 번에 보이는 양을 줄인다.
- 탭·표·코드·캐러셀처럼 내용 자체가 가로 방향인 영역만 내부 가로 스크롤을 허용한다. 문서 전체의 가로 스크롤은 허용하지 않는다.

### 확정하는 것

| 영역 | 결정 |
| --- | --- |
| 모바일 메뉴 | header 아래 고정된 full-height sheet/drawer. 메뉴 본문만 세로 스크롤하고 하단 액션은 항상 노출 |
| 게시판 카테고리 | 320–639px에서는 숨은 가로 탭 대신 현재 카테고리 버튼 + bottom sheet 목록 |
| 게시판 목록 | 표가 아닌 카드형 목록. 제목·분류·작성자·날짜를 1차 정보로 고정 |
| 상세/작성 | 본문은 한 열. 언어 입력은 세로 적층. 저장/취소는 safe-area를 포함한 하단 action bar |
| 설문 | 한 페이지 한 열 질문 흐름. matrix는 행을 세로 카드로 변환 |
| 관리자 | 모바일은 검색·필터·요약·상세 확인 중심. 복잡한 편집은 명시적인 desktop 권장 안내와 함께 단계적으로 제공 |
| section navigation | 숨겨진 overflow 탭을 기본값으로 두지 않고, 현재 위치가 보이는 selector/sheet 패턴으로 전환 |

### 구현 순서

다음 구현은 `M01 토큰/기초 컴포넌트` → `M02 overlay/focus` → `M03 header/menu` 순서로 시작한다. 그 뒤 `M04`부터 화면군을 진행한다. 이 문서의 결정만으로 각 단계의 구현 방향을 다시 선택하지 않아도 되도록 한다.

## 2. 공통 원칙과 레이아웃 규칙

### 2.1 viewport 규칙

| 폭 | 기본 구조 | 규칙 |
| --- | --- | --- |
| 320–359px | narrow mobile | 좌우 rail 16px, 한 열, 제목/라벨은 자연 줄바꿈, 페이지 x-overflow 0 |
| 360–639px | mobile | 좌우 rail 20px, 한 열, 카드 내부만 필요한 경우 밀도 확장 |
| 640–1023px | tablet | 좌우 rail 24px, 본문은 1–2열, header/menu는 모바일 drawer 모델 |
| 1024–1279px | compact desktop/tablet | 본문은 2열까지 허용하되 header는 drawer 유지, 복잡한 표는 contained scroll |
| 1280px 이상 | desktop | 기존 GNB와 desktop 정보 밀도 유지, 변경은 모바일 개선으로 인한 회귀만 수정 |

공통 container는 `width: 100%`, `max-width: 1200px`, `margin-inline: auto`를 사용한다. rail과 safe-area를 더한 결과가 viewport를 넘지 않도록 한다.

```text
viewport
└─ safe rail: max(16px/20px/24px, env(safe-area-inset-* ))
   └─ page container: width 100%, max-width 1200px
      └─ content block: min-width 0
```

### 2.2 터치·고정 액션

- 주요 버튼, 닫기, 뒤로가기, checkbox/radio의 클릭 영역은 최소 44×44px로 한다.
- 36px compact control은 badge·보조 필터처럼 독립적인 주요 행동이 아닌 경우에만 사용한다.
- 하단 고정 action bar에는 `padding-bottom: max(12px, env(safe-area-inset-bottom))`를 적용하고, 본문에는 bar 높이만큼 bottom padding을 예약한다.
- 키보드가 올라왔을 때 action bar가 입력을 가리지 않아야 한다. 모바일 브라우저의 `dvh`를 기준으로 overlay 높이를 계산한다.
- fixed/sticky 요소는 페이지 스크롤을 가로채지 않는다. overlay 내부에 별도의 `overflow-y: auto` 영역을 명시한다.

### 2.3 상태·언어·긴 콘텐츠

모든 대표 화면은 정상 데이터만으로 판단하지 않는다. 다음 상태를 같은 정보 구조로 제공한다.

- loading: 레이아웃이 뛰지 않는 skeleton 또는 명확한 loading state
- empty: 원인과 다음 행동이 있는 empty state
- error: 재시도·돌아가기·로그인 필요 여부가 보이는 error state
- long content: 제목·라벨·본문·표·코드가 잘리지 않고 필요한 영역만 내부 스크롤
- KO/EN: 텍스트 길이가 늘어도 버튼·header·메뉴가 충돌하지 않음

responsive 전환으로 DOM field를 복제하지 않는다. 설문·작성 폼의 field name, payload, validation target은 desktop/mobile에서 동일하게 유지한다.

## 3. 토큰과 공통 패턴

### 3.1 M01에서 사용할 방향 토큰

| 토큰 그룹 | mobile target | 사용 원칙 |
| --- | --- | --- |
| page rail | 16px (320–359), 20px (360–639), 24px (640–1023) | section마다 별도 음수 margin으로 rail을 깨지 않음 |
| control height | 44px 기본, 48px primary/submit | icon-only도 동일한 hit area를 가짐 |
| header height | 64px mobile/tablet, desktop은 기존 값 유지 | menu sheet의 top 기준으로 공유 |
| section gap | 24px 기본, 32px 주요 section | 8px 단위 체계를 유지 |
| card padding | 16px mobile, 20px tablet | 제목과 metadata의 읽기 순서 고정 |
| radius | 12px card, 10px control, 기존 브랜드 radius 우선 | 장식보다 상태/계층 구분에 사용 |
| text | body 16px/24px, metadata 13–14px/20px, title 24–32px | 320px에서는 title 크기를 줄여도 3줄 이내 우선 |
| bottom bar | 56px 이상 + safe-area | 버튼 2개를 넘기지 않음 |

기존 디자인 토큰과 값이 충돌하면 M01에서 토큰 이름을 먼저 통합하고, 화면별 임의 숫자 추가는 하지 않는다. 색상은 현재 브랜드 색을 유지하되 text 대비와 disabled/error/success 상태를 별도 토큰으로 명시한다.

### 3.2 공통 컴포넌트 패턴

다음 이름은 구현 시 사용할 역할 단위다. 정확한 파일명은 M01/M02에서 현재 컴포넌트 구조에 맞춰 결정하되, 동작 계약은 변경하지 않는다.

| 패턴 | 책임 |
| --- | --- |
| `ResponsiveHeaderMenu` | 고정 sheet/drawer, group/leaf navigation, focus trap, Escape/뒤로가기, 언어·로그인 액션 |
| `MobileSectionSelector` | 현재 위치를 표시하고 전체 항목을 sheet에서 선택. 선택 후 원래 콘텐츠 위치 유지 |
| `MobileListCard` | 목록의 1차/2차 정보 계층, 제목 줄 수, metadata, 상태 badge |
| `StickyActionBar` | 저장/취소/제출/뒤로가기와 safe-area, 본문 bottom padding 계약 |
| `ResponsiveDataState` | loading/empty/error의 높이·문구·재시도 행동을 일관화 |
| `DetailSheet` 또는 full-page detail | 목록에서 선택한 항목의 모바일 상세. 닫기/뒤로가기 후 목록 위치 복원 |
| `ContainedOverflow` | 표·코드·가로 탭·캐러셀에만 `overflow-x: auto`를 부여하고 page root로 전파하지 않음 |

## 4. 대표 화면 목표안

아래 wireframe은 390px을 기준으로 하며, 320px에서는 같은 순서를 유지한 채 rail과 텍스트가 줄어든다.

### 4.1 홈 — `M04`

핵심 행동은 `현재 중요한 일정/게시물 확인 → 필요한 상세로 이동`이다. 첫 화면에 장식용 hero보다 사용자의 다음 행동을 먼저 둔다.

```text
┌──────────────────────────────┐
│ logo             search  ☰  │  64px header
├──────────────────────────────┤
│ hero title                    │  180–220px, 최대 3줄
│ short supporting copy        │
├──────────────────────────────┤
│ 우선 확인                    │
│ ┌──────────────────────────┐ │  deadline/event/notice 중 데이터 우선순위
│ │ status · title           │ │
│ │ date/time       자세히 › │ │
│ └──────────────────────────┘ │
├──────────────────────────────┤
│ 공지/게시판  더보기 ›         │
│ ┌──────────────────────────┐ │  1열 list/card
│ │ category · title         │ │
│ │ date                     │ │
│ └──────────────────────────┘ │
├──────────────────────────────┤
│ 예정 일정                    │
│ selected-day agenda cards    │
└──────────────────────────────┘
```

현재의 hero·데이터 위젯 구조는 유지하되 다음을 개선한다.

- `loading/empty/error`에서도 섹션 제목과 다음 행동을 유지한다.
- 390px에서는 카드 1열, 768px에서는 충분한 카드 폭이 확보될 때만 2열을 사용한다.
- 캐러셀은 내부 가로 영역으로 제한하고 좌우 버튼/현재 위치를 제공한다. 페이지 전체 x-scroll은 금지한다.
- 데이터가 없을 때 빈 위젯 여러 개를 같은 높이로 쌓지 않고, 한 문단의 empty state로 합친다.

대안으로 hero를 완전히 제거하는 안은 선택하지 않는다. 브랜드 첫인상은 유지하되, hero 높이와 콘텐츠 우선순위를 줄이는 것이 기존 desktop과의 연속성·구현 비용 측면에서 적절하다.

### 4.2 모바일 navigation menu — `M03`

M00에서 확인한 320px의 핵심 문제는 menu panel이 viewport보다 길지만 내부 스크롤이 없어서 마지막 링크와 login action에 도달할 수 없다는 점이다.

```text
┌──────────────────────────────┐
│ logo             search  ×  │  header remains visible
├──────────────────────────────┤
│ 메뉴                          │
│ 주요 메뉴                 ⌃  │
│   홈                          │
│   게시판                      │  nav only: overflow-y auto
│   설문/투표                   │  leaf row min 44px
│ ...                           │
│ 소개/로드맵                ⌄  │
│   ...                         │
├──────────────────────────────┤
│ 한국어                       │  footer action always visible
│ 로그인                       │  safe-area 포함
└──────────────────────────────┘
```

**선택안:** 0–1279px는 header 아래의 고정 sheet/drawer를 사용한다. mobile에서는 viewport 폭, 640px 이상에서는 우측 정렬 `max-width: 480px` drawer로 확장한다. `header height` 아래부터 `100dvh`까지를 차지하고, `nav`만 스크롤한다. 하단 언어·로그인 영역은 flex footer로 항상 노출한다.

- group header와 leaf link는 한 열로 배치하며 각 hit area는 44px 이상이다.
- sheet가 열리면 배경 페이지는 scroll lock한다.
- focus는 sheet의 첫 interactive element로 이동하고, Tab은 sheet 안에서 순환한다. Escape/닫기/뒤로가기는 원래 trigger로 focus를 돌린다.
- 320px에서 마지막 메뉴·언어·로그인 action은 page scroll 없이 내부 scroll로 도달 가능해야 한다.
- KO/EN 전환은 같은 위치의 sheet action으로 제공하고, 언어가 길어져도 row가 겹치지 않는다.

대안으로 전체 화면 아래로 메뉴를 이어 붙이는 flow panel은 선택하지 않는다. flow panel은 이번에 재현한 “하단 action이 viewport 밖으로 밀림”을 다시 만들 수 있기 때문이다.

### 4.3 게시판 목록·상세·작성 — `M05`, `M06`

핵심 행동은 `분류 선택 → 검색/목록 확인 → 상세 진입 → 뒤로 목록 복귀`이며, 작성 화면에서는 `언어별 입력 → 검증 → 저장/등록`이다.

#### 목록 목표안

```text
┌──────────────────────────────┐
│ 게시판                  글쓰기 │
│ [전체 · 게시판 선택      ˅]  │  one action opens all categories
│ [검색어                 🔍]  │
│ 24개 결과                    │
│ ┌──────────────────────────┐ │
│ │ 공지  제목 2줄까지       │ │
│ │ 작성자 · 2026.09.07      │ │
│ │ 조회/댓글/첨부            │ │
│ └──────────────────────────┘ │
│ ...                          │
│  ‹ 1 2 3 … ›                 │
└──────────────────────────────┘
```

M00에서 확인한 hidden horizontal tab은 390px에서 `연구실` 일부와 `FAQ`가 첫 화면 밖에 있었다. 따라서 320–639px에서는 `MobileSectionSelector` + bottom sheet 목록을 선택한다. 640px 이상에서도 항목 수가 container를 넘으면 같은 selector를 유지하고, 모두 들어가는 경우에만 일반 tab으로 바꾼다.

- 카드의 고정 순서는 category/status → title → author/date → counts/attachment다.
- 제목은 2줄까지 보이고 그 이상은 말줄임한다. 제목 전체는 상세에서 읽을 수 있어야 한다.
- 검색 결과 없음, API error, pagination 없음 상태도 같은 toolbar 위치를 유지한다.
- 목록 카드 선택 후 상세로 이동하며, 뒤로가기하면 검색어·카테고리·페이지·scroll position을 복원한다.

#### 상세 목표안

본문은 한 열이고, `뒤로가기 → breadcrumb/category → 제목 → metadata → body → attachments → comments/actions` 순서를 고정한다. 표와 code block만 카드 안의 `ContainedOverflow`를 사용한다. 본문 전체에 `min-width`를 강제하지 않는다.

#### 작성/편집 목표안

- KO/EN 입력은 같은 field model의 세로 stack으로 배치한다.
- editor toolbar는 내부 가로 스크롤 가능하지만 editor 본문은 viewport 폭에 맞춘다.
- 고급 설정은 collapsed section으로 시작하고, validation error가 있으면 자동으로 펼쳐 해당 field로 이동한다.
- `StickyActionBar`에는 `취소`와 `저장/등록`만 둔다. 저장 중 disabled/loading, 실패 시 retry와 오류 위치를 제공한다.

대안으로 390px에도 모든 category를 horizontal tab으로 유지하는 안은 선택하지 않는다. 현재 구현의 clipped affordance를 그대로 보존하고 사용자가 좌우 이동을 추측해야 하므로, 항목 수가 많은 게시판에는 selector가 더 명확하다.

### 4.4 설문 입력·투표 결과 — `M07`

실제 데이터 연결이 복구되면 가장 먼저 모든 question type을 확인해야 한다. 화면 방향은 다음과 같다.

```text
┌──────────────────────────────┐
│ 설문 제목              2/5   │  progress stays visible
│ ━━━━━━━━━━━━━━━━━━━━━━━     │
│ 안내/마감                    │
│ 1. 단일 선택                 │
│ ○ 긴 선택지 라벨도 줄바꿈   │
│ ○ 선택지                    │
│ 2. matrix                    │
│ ┌──────────────────────────┐ │
│ │ 항목 A                    │ │
│ │ 매우 낮음 ○  보통 ○ 높음 │ │  row becomes vertical card
│ └──────────────────────────┘ │
│ ...                          │
├──────────────────────────────┤
│             [이전] [제출]    │  sticky, keyboard/safe-area aware
└──────────────────────────────┘
```

- 질문은 한 열로 흐르고 질문 번호·필수 여부·오류를 질문 제목 근처에 둔다.
- matrix는 행을 세로 카드로 분리한다. 320px에서 열 제목을 억지로 한 줄에 배치하지 않는다.
- 긴 선택지·textarea·파일/날짜 입력은 page x-scroll 없이 세로 확장한다.
- progress와 미응답 수를 상단에 표시하고, 제출 전 오류 요약에서 오류 질문으로 이동한다.
- responsive 전환에서 field를 복제하지 않으며, 모바일에서 입력한 값이 desktop 폭 전환 후에도 유지된다.
- 결과 차트는 모바일에서 카드/막대 순서로 표시하고, 축·범례 라벨이 겹치면 값 label을 카드 안으로 이동한다.

### 4.5 관리자 목록·상세 — `M10`, `M11`

관리자 모바일의 기본 목적은 `검색/필터 → 상태 파악 → 항목 상세 확인 → 단순 상태 변경`이다. 표를 그대로 축소하지 않는다.

```text
┌──────────────────────────────┐
│ Admin                        │
│ 모바일에서는 데스크톱 편집 권장│  dismissible guidance
│ [검색                    🔍]  │
│ [필터] [상태] [기간]          │
│ 요약  전체 24 · 대기 3        │
│ ┌──────────────────────────┐ │
│ │ #1024  제목              │ │
│ │ 대기 · 작성자 · 날짜      │ │  card, not compressed table
│ │                 상세 ›    │ │
│ └──────────────────────────┘ │
│ ...                          │
└──────────────────────────────┘
```

- 0–639px는 카드 목록 + full-screen detail sheet를 사용한다.
- 640–1023px는 카드 목록 + 우측 detail drawer(`max-width: 560px`)를 사용한다.
- `선택`이 필요한 경우 선택 시에만 contextual toolbar를 표시하고, 선택 전 공간을 점유하지 않는다.
- 표가 정말 필요한 데이터는 표 container 안에서만 x-scroll한다. body/document에는 x-scroll을 만들지 않는다.
- 복잡한 CMS/editor/reorder는 모바일에서 숨기지 않고 `데스크톱에서 계속` 링크와 작업 손실 없는 draft 상태를 제공한다. 간단한 순서 변경은 drag-only가 아니라 위/아래 버튼을 함께 제공한다.
- 저장/취소/오류 계약은 desktop과 같다. 상세 sheet를 닫아도 목록 필터와 scroll position이 유지된다.

대안으로 모바일 관리자에도 desktop table을 가로로 스크롤하게 하는 안은 선택하지 않는다. 핵심 상태를 한눈에 비교할 수 없고, page-level overflow와 selection 오류를 유발하기 쉽다.

## 5. 보조 화면 방향

### About·Roadmap — `M09`

- 현재 확인된 about section nav의 hidden overflow를 selector/sheet로 바꾼다. 현재 section label은 항상 보이고, sheet 안에서 `소개`, `조직`, `후원 및 제휴`, `문의`를 모두 선택할 수 있어야 한다.
- hero는 390px에서 제목·설명·CTA를 한 열로 유지하고, 조직/pledge/contact는 section card로 쌓는다.
- roadmap은 모바일 기본값을 graph보다 list/filter/detail 순서로 둔다. 관계 정보는 상세의 “연결된 단계” summary로 제공하고, graph가 필요하면 내부 가로 canvas로 제한한다.

### 검색·FAQ·투표·법적 문서

- 검색은 search → result count → result card → pagination/detail의 순서를 유지한다. 결과 없음과 API 오류가 같은 toolbar 위치에서 설명되어야 한다.
- FAQ는 질문 accordion을 한 열로 제공하고, 열림 상태에서 focus와 scroll 위치를 잃지 않는다.
- 투표 목록/상세는 board card 패턴을 재사용하되, 결과 수치·차트 label의 모바일 우선순위를 별도로 둔다.
- terms/privacy는 긴 본문을 자연스럽게 세로 흐르게 하고, 표·code가 있을 때만 contained overflow를 허용한다.

## 6. 화면별 성공 기준

| 화면 | 390px 필수 기준 | 320px/768px 추가 기준 | desktop 회귀 기준 |
| --- | --- | --- | --- |
| home | 첫 viewport에 hero 제목과 우선 콘텐츠가 보이고 카드가 1열 | 320px 제목/카드가 rail 안에 있고, 768px은 필요할 때만 2열 | 1440px 기존 hero·widget 밀도 유지 |
| mobile menu | 한 번의 메뉴 열기로 구조를 이해하고 내부 scroll로 모든 leaf/action 접근 | 320px page x-scroll 0, login/언어가 항상 도달 가능; 768px drawer와 backdrop 정상 | GNB/desktop header 충돌·위치 회귀 없음 |
| board list | 모든 category를 selector 한 번으로 발견, 검색·결과·pagination 접근 | 상세 back 시 상태/scroll 복구; 768px 카드 폭만큼 정보 확장 | desktop tabs/table/pagination 동작 유지 |
| board detail/write | 제목·metadata·본문·첨부 순서, 저장/취소가 viewport 밖으로 밀리지 않음 | matrix-like table/code만 내부 x-scroll; KO/EN field value 보존 | editor payload·validation contract 유지 |
| survey/vote | 모든 질문 type, 오류, 제출 action이 한 열에서 사용 가능 | matrix row 가로 overflow 0, keyboard가 action을 가리지 않음 | chart/table의 desktop 읽기 순서 유지 |
| admin | search/filter/list/detail의 흐름이 카드와 sheet로 끝남 | 768px drawer, 표 overflow contained, simple save 가능 | desktop table/editor 기능 손실 없음 |
| about/roadmap | section 위치가 selector에 보이고 list/filter/detail 흐름 가능 | 마지막 section 및 relation detail 도달 가능 | 1440px 2-column/graph 유지 |

공통으로 `document.documentElement.scrollWidth === clientWidth`를 320·390·768px에서 만족해야 한다. 예외는 표·코드·tabs·carousel의 명시된 내부 scroll container뿐이다.

## 7. 검증 시나리오와 차단 조건

M01 이후 각 화면은 다음 순서로 검증한다.

1. 320×740, 390×844, 768×1024, 1440×900에서 cold load
2. KO/EN 전환 후 같은 화면에서 다시 측정
3. loading → populated → empty → error → long content 확인
4. keyboard focus, Escape/back, touch target, virtual keyboard 확인
5. 목록 → 상세 → back, 작성 → validation → save/cancel 확인
6. `scrollWidth`, overlay bounds, 마지막 actionable element 도달 여부를 기록

현재 M00에서 확인된 API/Postgres/Redis degraded 상태는 UI 결함과 별도의 검증 차단 조건이다. `postgres` hostname이 해석되고 seed/login이 가능한 상태가 되기 전에는 다음 항목을 최종 완료로 판정하지 않는다.

- 게시판 실제 category/search/detail/pagination
- 설문 question type/matrix/payload
- 이벤트·캘린더 monthly/selected-day agenda
- 관리자 인증 후 list/detail/editor

## 8. 다음 단계의 작업 경계

이번 `M00-D` 산출물은 방향과 성공 기준 확정까지다. 변경된 앱 파일은 없다.

다음 구현 단계는 다음 범위로 제한한다.

- `M01`: 위 mobile rail/control/header/action/typography 토큰과 공통 primitive 정리
- `M02`: sheet/drawer, body scroll lock, focus trap, Escape/back, safe-area 계약
- `M03`: header/menu를 구현하고 320px에서 마지막 메뉴·언어·로그인 도달을 먼저 회귀 검증
- 이후: `M04` 홈, `M05–M06` 게시판, `M07` 설문/투표, `M08` 이벤트/캘린더, `M09` about/roadmap, `M10–M11` 관리자/editor 순서

이 문서에서 선택한 구조는 `M01–M03` 구현을 시작하기 위한 최종 방향이다. 구현 중 발견되는 데이터 계약 변경은 화면 구조 변경과 분리해 기록한다.
