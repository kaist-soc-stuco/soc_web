# SOC Web UI/UX Guide

이 문서는 메인 페이지, 공지사항 페이지, 설문조사 관리 페이지를 기준으로 정리한 UI/UX 작업 기준이다.

## Current Visual Direction

- 공식 대외 브랜드는 `SOC`로 통일한다. 녹색 계열은 브랜드 색으로 사용하되 상태 색상과 혼용하지 않는다.
- 배경은 `#fafafa`, `slate-50`, 흰색 카드, 얕은 border와 매우 약한 shadow를 주로 사용한다.
- 주요 CTA와 active state는 `kaist-darkgreen` 또는 `#137333` 계열을 쓴다.
- 정보 밀도는 높은 편이다. 학생회 운영 도구와 공지/설문 관리에는 이 방향이 적합하다.
- 둥근 카드와 pill/badge가 많다. 새 UI는 과도하게 장식적이기보다 읽기 쉽고 빠르게 조작 가능한 쪽을 우선한다.

## Page-Specific Observations

### Main Page

- `HomePage`는 desktop에서 좌측 1/3 hero, 우측 2/3 운영 정보 패널 구조를 사용한다.
- `Hero`는 이미지 기반이라 첫 화면 인상이 좋고 사이트 정체성을 잘 드러낸다.
- `NoticeBoard`와 `Calendar`는 카드형 운영 대시보드처럼 배치되어 사이트의 실사용 목적에 맞다.
- 단점은 `h-screen overflow-hidden` 구조 때문에 작은 화면이나 노트북 저해상도에서 내용이 잘릴 수 있다는 점이다.
- `Calendar`에는 2026년 5월 21일을 오늘로 하드코딩한 로직과 샘플 일정이 남아 있다. 실제 운영 전 제거가 필요하다.

### Notice Board Page

- `PageHero`, 하단 탭, 검색/필터, 표형 목록으로 구성되어 게시판 페이지의 구조가 명확하다.
- 표 컬럼 비율과 pagination UI가 admin 설문 목록과 비슷해 제품 내 일관성이 있다.
- 현재 게시판 카테고리/한국어 텍스트가 일부 인코딩 깨짐처럼 보이는 코드가 있다. 실제 파일 또는 표시 환경 기준으로 반드시 정리해야 한다.
- 검색/필터가 100개를 받아 client-side로 처리한다. 게시글이 늘면 정확도와 pagination이 어긋날 수 있다.
- mobile에서는 표형 grid가 좁아질 가능성이 높다. 공지사항은 mobile에서 카드형 리스트로 전환하는 패턴이 더 안전하다.

### Survey Admin Page

- 운영자가 반복 사용하기 좋은 밀도와 조작성을 갖춘 화면이다.
- 검색, 상태, 유형, 기간, 정렬이 한 줄 filter card로 잘 모여 있다.
- 행 action은 lucide icon 중심이라 공간 효율이 좋다.
- 단점은 페이지 내부에 `CustomDropdown`, 날짜 formatter, badge renderer, pagination 생성 로직이 모두 들어 있어 파일이 비대해진다는 점이다.
- dropdown, pagination, status/type badge는 다른 admin 목록에서도 재사용될 확률이 높으므로 공통화 우선순위가 높다.

## Design Rules

- 실사용 화면을 첫 화면에 둔다. 학생회 사이트에는 마케팅형 landing hero보다 바로 공지/일정/설문으로 들어가는 구성이 적합하다.
- admin 화면은 조용하고 밀도 있게 만든다. 큰 hero, 과한 장식, 설명형 카드 남발은 피한다.
- 카드 radius는 새 컴포넌트에서는 8-12px를 기본으로 검토한다. 현재 16-24px 카드가 많으므로 기존 화면 안에서는 주변과 맞춘다.
- 버튼 텍스트가 길어질 때 줄바꿈 또는 min/max width를 고려한다.
- destructive action은 rose/red 계열과 confirm 또는 별도 modal을 사용한다.
- 목록 row hover는 배경만 약하게 바꾸고 layout shift를 만들지 않는다.
- tooltip, dropdown, popover는 viewport 밖으로 나가지 않도록 portal 또는 placement 계산을 사용한다.
- 색상은 녹색 하나에만 의존하지 않는다. 상태 구분에는 emerald, amber, rose, blue, purple 등을 제한적으로 사용한다.

## Typography And Spacing

- 한 화면의 제목 계층은 page title, section title, table/list header, row/body text, metadata 순서로만 둔다. 같은 화면에서 비슷한 의미의 제목 크기를 여러 개 만들지 않는다.
- public page title은 대략 `text-3xl` 전후, admin page title은 `text-2xl` 전후, card/section title은 `text-base`에서 `text-lg`, table header와 metadata는 `text-xs`에서 `text-sm` 범위를 기본으로 한다.
- font weight는 정보 구조를 만들기 위해 쓴다. page title은 `font-black` 또는 `font-extrabold`, section title은 `font-bold`, body는 `font-medium` 이하를 기본으로 한다.
- compact admin UI의 기본 간격은 filter/control 내부 `gap-2`에서 `gap-4`, card padding `p-4`에서 `p-6`, page section 간격 `gap-5`에서 `gap-8` 사이에서 고른다.
- public page는 admin보다 여백을 조금 더 허용하되, 공지/일정/설문처럼 반복 확인하는 정보는 과한 vertical padding을 피한다.
- table row, card row, toolbar button의 높이는 화면 안에서 일관되게 유지한다. hover, badge, loading text가 들어와도 높이가 흔들리지 않게 한다.
- letter spacing은 기본값을 유지한다. 작은 label의 과한 tracking이나 hero가 아닌 곳의 과한 굵기/크기는 피한다.

## Component Reuse Targets

- `Pagination`: 게시판과 설문 관리가 거의 같은 page item 생성 로직을 사용한다.
- `FilterDropdown` 또는 `SelectDropdown`: 설문 관리의 `CustomDropdown`과 기존 select 계열 컴포넌트를 통합한다.
- `StatusBadge`: 설문 상태, 타입, 게시글 카테고리 badge를 공통 API로 정리한다.
- `AdminListPageShell`: breadcrumb, title/description, primary action, filter card, table card의 반복 구조를 묶는다.
- `DataState`: loading, empty, error 상태 표현을 공통화한다.

## Accessibility And Interaction

- 아이콘-only 버튼에는 `title`만이 아니라 가능하면 `aria-label`도 넣는다.
- dropdown button은 `aria-expanded`, `aria-haspopup`를 제공한다.
- modal/dropdown은 Escape 닫기와 focus 이동을 고려한다.
- 표형 화면은 keyboard focus ring이 보여야 한다.
- 색상만으로 상태를 구분하지 말고 텍스트 badge를 함께 사용한다.

## Responsive Rules

- public 페이지는 mobile 우선으로 깨지지 않아야 한다.
- 게시판 표는 `md` 이하에서 카드형 리스트 또는 horizontal scroll 중 하나를 명확히 선택한다.
- admin table은 horizontal scroll을 허용하되 action column과 제목 column의 최소 폭을 안정적으로 둔다.
- `h-screen overflow-hidden`은 특별한 kiosk/dashboard 의도가 있을 때만 사용하고, 일반 public page는 자연 scroll을 우선한다.

## Content And Language

- 한국어/영어 전환이 있는 페이지는 label source를 상수로 분리한다.
- 새 한국어 문자열은 UTF-8로 저장하고 깨짐 여부를 화면에서 확인한다.
- 날짜는 한국 사용자를 기준으로 `YYYY.MM.DD` 또는 `MM.DD`를 일관되게 쓴다.
- 상대 시간은 admin 목록에서 유용하지만, 정확한 마감/시작 시간은 절대 시간을 함께 제공한다.
