# SOC Web 디자인 규칙

- 작성일: 2026-08-20
- 대상: `apps/web` 공개 화면과 관리자 화면
- 상태: 현재 코드와 로컬 렌더링을 기준으로 한 작업 규칙 초안
- 기준 화면: `http://localhost:8080/board/%EA%B3%B5%EC%A7%80`

이 문서는 “더 화려하게” 만드는 가이드가 아니다. SOC를 마케팅 랜딩 페이지보다 학생회 운영 포털에 가깝게 보이게 하기 위해, 콘텐츠·상태·조작성이 장식보다 먼저 읽히도록 정리한 규칙이다.

## 0. 작성·수정 화면과 마이페이지 확정 규칙

이번 구현에서 사용자가 직접 확정한 사항은 아래 규칙을 기존 원칙보다 우선한다.

- 글 작성·수정 화면은 텍스트에디터를 두 개의 독립 카드로 렌더링하지 않는다. 하나의 에디터 shell, 하나의 공통 툴바, 국문·영문 좌우 편집 영역으로 구성한다. `한국어 콘텐츠만`이 선택되면 영문 영역과 가운데 구분선을 숨긴다.
- 에디터의 제목과 본문은 페이지 본문 컨테이너의 전체 가변 너비를 사용한다. 바깥 카드의 임의 `p-6` 때문에 에디터 폭이 줄어들거나 두 겹의 외곽 카드가 생기지 않게 한다.
- 임시저장은 `임시저장` 텍스트 영역과 숫자·chevron 영역을 분리한다. 텍스트 영역은 즉시 저장하고 `임시저장되었습니다.` 토스트를 보여준다. 숫자 영역은 저장된 초안 목록 popover/drawer를 열고 각 초안에 `불러오기`와 `삭제`를 제공한다. 자동 저장은 내용이 실제로 변경된 경우에만 주기적으로, 페이지 이탈 시에 수행한다.
- 비밀글 체크박스의 노출·저장 가능 여부는 프론트의 공개 작성 예외가 아니라 게시판의 `allowSecret` 설정을 기준으로 한다. 건의사항은 비밀글 허용 게시판으로 설정한다.
- 작성·수정 페이지의 제목과 액션은 한 줄에 배치한다. 순서는 `취소`, `임시저장 (n) ▾`, `등록`이며, 긴 폼을 스크롤할 때는 GNB 바로 아래의 얇은 반투명 sticky action row로 동작한다.
- 마이페이지의 `스크랩`과 `임시저장글`은 별도 사이드바 메뉴가 아니라 `활동 내역` 내부 탭이다. 사이드바에는 `로그아웃`을 넣지 않는다.
- `내 정보`와 `활동 내역`의 설명성 문장은 기본적으로 제거한다. 정보 카드 내용은 compact 2열 grid, 본문 weight 400을 기본으로 하되 섹션 제목만 필요한 만큼 강조한다.
- 개인정보 동의·최근 로그인 등 날짜시간은 `YYYY.MM.DD HH:mm` 형식으로 표시한다. 예: `2026.08.21 18:57`.

## 1. 판단 기준

### 1.1 근거의 우선순위

1. 현재 프론트엔드 코드와 실제 로컬 렌더링을 1순위 근거로 삼는다.
2. 첨부된 다른 에이전트의 피드백은 제안 목록으로만 사용한다. 현재 코드와 맞지 않는 표현은 그대로 사실로 확정하지 않는다.
3. 브랜드 가이드, 실제 운영 콘텐츠, 접근성 요구가 확인되면 이 문서의 장식적 제안보다 우선한다.

### 1.2 이번 점검에서 확인한 사실

| 환경 | 확인 결과 | 디자인상 의미 |
|---|---|---|
| 데스크톱 1280×720, `/board/공지` | decorative hero 없이 compact page context, 카테고리/검색, 목록이 바로 이어진다 | 콘텐츠 시작을 밀어내는 장식 상단 영역을 두지 않는다. |
| 모바일 390×844, `/board/공지` | decorative hero 없이 탭·검색·목록을 세로로 배치하고 제목은 다중 행을 허용한다 | 모바일에서 탐색 도구가 콘텐츠보다 커지지 않게 한다. |
| `/events-surveys?tab=event` | 상태 소제목 없이 필터 chip과 3/2/1열 카드 grid가 바로 이어진다 | 카드 수·viewport에 맞춰 밀도를 조절하고 반복 제목을 제거한다. |
| 공지 화면 우측 하단 | Channel Talk 고정 위젯이 마지막 행·페이지네이션 주변과 시각적으로 겹친다 | 고정형 지원 UI에 safe area와 겹침 방지 규칙이 필요하다. |
| 공통 소스 | `rounded-2xl` 87회, `rounded-3xl` 21회, `shadow-xl` 13회, `shadow-2xl` 4회, `animate-in` 34회 | 개별 컴포넌트보다 반복되는 장식 문법의 통일/절제가 우선이다. |

현재 공지 화면은 구조와 가독성이 무너진 상태는 아니다. 문제는 운영형 화면에도 큰 hero, 강한 초록 surface, 둥근 카드, 강조 배지, 그림자, 애니메이션이 반복되어 정보보다 “시안의 문법”이 먼저 보인다는 점이다.

## 2. 첨부 피드백의 반영 범위

| 첨부 피드백 | 판단 | 이 문서의 규칙 |
|---|---|---|
| 짙은 그라데이션·glow 제거 | 채택 | 운영 화면은 기본적으로 단색 surface와 얇은 border를 사용한다. 브랜드 hero나 실제 이미지가 필요한 곳만 예외로 둔다. |
| 서브페이지 hero를 대폭 축소 | 완전 채택 | decorative hero 자체를 제거하고 compact page context, breadcrumb/back link, 탭·도구 영역만 남긴다. |
| Footer를 가로 재배치하고 compact하게 구성 | 현재 구조는 대체로 채택되어 있음 | 현재 Footer는 데스크톱에서 이미 가로 배치이고 `py-5`다. 높이 제거보다 모바일 줄바꿈, 대비, 공식 연락처·최종 갱신 정보 보강을 우선한다. |
| radius를 8~12px로 조절 | 채택 | 기본 surface 8px, 강조 card 12px, hero/media 16px 이하를 기준으로 한다. |
| 완전한 Flat + 미세 shadow | 부분 채택 | 표·목록은 border 중심, card·popover에만 한 종류의 미세 shadow를 사용한다. 모든 elevation을 제거하지는 않는다. |
| 전문가형 페이지네이션과 범위 표시 | 조건부 채택 | 현재도 상단 페이지 크기 선택과 하단 이전/현재/다음이 있다. 2페이지 이상일 때 `총 N건 중 x–y`를 추가하고, 모바일에서는 범위 문구를 줄인다. |
| 배지를 pill에서 둥근 사각형으로 변경 | 채택 | 기본 radius 4~6px, 상태·필터처럼 압축이 필요한 경우에만 pill을 허용한다. |
| Google Calendar 스타일 | 방향 채택 | 셀 선·숫자 대비를 낮추고 오늘/선택/일정을 구분한다. 색상만으로 의미를 전달하지 않는다. |
| 설명 문구를 과감히 삭제 | 부분 채택 | 반복적인 홍보 문장은 줄이되, 대상·신청·마감·권한처럼 행동에 필요한 설명은 남긴다. |

## 3. 현재 모던하지 않게 보이는 요소와 수정 규칙

### DR-01. 운영 화면에 반복되던 마케팅형 hero를 제거한다

근거: `apps/web/src/components/organisms/page-context.tsx`, `apps/web/src/styles.css:137-174`.

- 이전 구현에서는 `PageHero`가 짙은 초록 `linear-gradient`와 radial glow를 기본으로 사용했다.
- 이전 공지·행사 화면은 header·hero·카테고리/검색 영역이 겹쳐 목록 시작을 과도하게 밀어냈다.
- `/events-surveys`도 이전에는 큰 hero와 긴 설명 문장을 사용해 운영 목록보다 캠페인 페이지처럼 보였다. 현재는 decorative hero를 삭제했다.

규칙:

- decorative `PageHero`는 홈을 포함한 모든 화면에서 기본값으로 사용하지 않는다. 시각 자료가 꼭 필요하면 의미 있는 콘텐츠 block으로 배치한다.
- 게시판·검색·행사·설문·상세·관리자·소개 화면은 compact page context/header를 기본으로 한다.
- 목록 화면의 page header는 데스크톱 88~112px, 모바일 72~96px을 목표로 한다.
- 제목은 유지하되 설명은 선택 사항으로 만든다. 한 줄로도 이해되는 화면에 홍보성 설명을 반복하지 않는다.
- 페이지 상세 화면은 hero 대신 breadcrumb, category/status, 제목, 메타데이터로 시작한다.
- `gradient`, `radial-gradient`, glow는 운영 화면에서 기본값으로 금지한다.

### DR-02. 추상 이미지와 장식용 오버레이가 실제 콘텐츠를 대체함

근거: `apps/web/src/features/events-surveys/events-surveys-grid.tsx:27-37,182-196`.

- 이전 행사 카드는 `imageUrl`이 있으면 업로드 이미지를 사용했지만, seed 화면에서 추상적인 보라색 이미지가 대표 이미지처럼 보였다.
- 이전 카드 위에는 `bg-gradient-to-t` 오버레이가 일괄 적용되어 이미지 자체보다 템플릿 효과가 앞섰다.

규칙:

- 대표 이미지는 행사 내용과 직접 관련된 실제 이미지, 또는 SOC가 승인한 공통 placeholder만 사용한다.
- 랜덤 색상·랜덤 gradient로 행사를 구분하지 않는다.
- 이미지가 정보 전달에 필요하지 않은 행사 목록은 media 영역을 없애고 날짜·상태·장소·CTA를 앞세운다.
- 이미지 위 텍스트가 없으면 어두운 오버레이를 넣지 않는다.
- 실제 이미지가 없을 때도 “이미지가 없는 상태”를 숨기지 말고 공식 유형·날짜·아이콘으로 안정적으로 표시한다.

### DR-03. radius와 shadow의 반복으로 모든 것이 카드처럼 보임

근거: `apps/web/src/styles.css:58-77`, `apps/web/src/features/events-surveys/events-surveys-grid.tsx:176`, `apps/web/src/features/board-list/board-page-sections.tsx:262`.

규칙:

| 용도 | radius | elevation |
|---|---:|---|
| 입력·버튼·표면 | 6~8px | 없음 또는 border |
| 일반 card·filter panel | 8~12px | `0 1px 2px rgba(16,24,40,.04)` 수준 |
| popover·dialog | 8~12px | 한 단계 높은 미세 shadow |
| hero/media | 최대 16px | 필요할 때만 |
| pill | 예외적으로만 | 상태·필터·짧은 값에 한정 |

- `rounded-2xl`, `rounded-3xl`을 새 UI의 기본값으로 사용하지 않는다.
- 데이터 표 안에 card를 중첩하지 않는다.
- 목록 행 hover는 배경색만 아주 약하게 바꾸고 `translateY`나 강한 shadow를 사용하지 않는다.
- 같은 페이지 안에서 border-only card와 강한 shadow card를 무작위로 섞지 않는다.

### DR-04. 과도하게 무거운 타이포그래피와 폰트 불일치

근거: `apps/web/index.html`, `apps/web/src/styles.css:110`, `apps/web/src/components/atoms/logo.tsx:16`, `apps/web/src/components/organisms/hero.tsx:55-58`.

- HTML은 `Roboto Slab`만 외부 로드하지만 소스에는 로드 근거가 없는 `font-outfit`이 반복된다.
- body는 Pretendard/Noto Sans를 우선하지만, hero는 `Roboto Slab`, 일부 제목은 `font-outfit`을 사용해 브랜드 계층이 불명확하다.
- `font-black`, `font-extrabold`, `tracking-tight`가 넓은 범위에 사용되어 일반 목록도 광고 문구처럼 보인다.

규칙:

- 한국어·본문·표·메타데이터는 실제로 로드되는 Pretendard Variable 또는 Noto Sans KR 한 계열을 기본으로 한다.
- display font는 홈 hero나 로고처럼 명확한 역할이 있는 곳에만 사용한다.
- 본문 400~500, 일반 제목 600~700, 강조 제목 700~800을 기본으로 하고 900 weight는 로고·특수 숫자에 제한한다.
- 작은 label에서 `tracking-tight`와 과한 uppercase를 반복하지 않는다.
- 사용하지 않는 `font-outfit` 클래스는 실제 font를 로드하거나 제거한다.

### DR-05. 모바일 게시판이 표를 축소하면서 제목을 잃음

근거: `apps/web/src/features/board-list/board-page-sections.tsx:286-360`와 390px 렌더링.

- 모바일에서는 작성자·조회수 열을 숨기지만 제목은 `truncate` 한 줄로 유지한다.
- 공지 화면에서 “2026 봄학기 전산…”처럼 업무상 중요한 제목이 잘린다.
- 카테고리 탭은 두 줄로 wrap되어 검색/필터가 아래로 밀린다.

규칙:

- 모바일은 데스크톱 표의 축소판이 아니라 목록 card로 전환한다.
- 모바일 항목은 `category/status → title 2줄 → author/date/attachment` 순으로 보여준다.
- 제목은 한 줄 강제 대신 최대 2줄을 허용하고, 상세 화면으로 이동할 수 있는 전체 click target을 둔다.
- 카테고리 탭은 한 줄 horizontal scroll 또는 별도 filter drawer 중 하나를 선택한다. 임의 줄바꿈을 기본값으로 두지 않는다.
- 검색·필터 도구는 모바일에서 한 줄씩 정렬하되 화면의 첫 1/3 이상을 차지하지 않도록 한다.
- 모든 조작 요소는 최소 44×44px target을 유지한다.

### DR-06. 표·배지·페이지네이션의 시각 계층이 약함

근거: `apps/web/src/features/board-list/board-page-sections.tsx:262-402`, `apps/web/src/components/ui/pagination.tsx`.

규칙:

- 표 header는 옅은 surface와 1px 하단 선만 사용한다. 세로선과 강한 zebra striping은 기본적으로 사용하지 않는다.
- 행 구분은 `#E5E7EB`에 가까운 얇은 가로선으로 통일하고 hover 때만 아주 옅은 배경을 적용한다.
- 배지는 낮은 채도의 배경과 의미가 맞는 텍스트를 사용한다. 색상만으로 진행 중·마감·권한을 표현하지 않는다.
- `N` 같은 단독 색상 원형 표시 대신 `새 글` 텍스트 또는 점+accessible label을 사용한다.
- 페이지 크기 선택은 목록 상단에 유지한다. 2페이지 이상이면 `총 N건 중 x–y`를 함께 제공한다.
- 페이지 버튼은 32~36px, radius 6~8px, 그림자 없음이 기본이다. 현재 페이지는 brand 배경, 비활성 버튼은 border/텍스트 대비로 구분한다.
- 페이지네이션이 표 하단의 글쓰기 버튼과 겹치지 않도록 모바일에서는 세로 배치한다.

### DR-07. 입력·필터 control이 둥글고 무거움

근거: `apps/web/src/features/board-list/board-page-sections.tsx:106-178`, `apps/web/src/features/events-surveys/events-surveys-filter-bar.tsx:45-104`.

규칙:

- input/select/button의 기본 radius는 6~8px로 한다.
- 평상시에는 1px border, focus 시에만 brand border와 2~3px translucent ring을 사용한다.
- 입력 control에 `shadow-sm`를 기본으로 넣지 않는다.
- segmented control은 선택 상태를 배경·텍스트·선으로 구분하되, 화면 전체에 큰 pill container를 만들지 않는다.
- 필터 이름은 짧고 명확하게 유지하고, 현재 적용된 조건은 removable chip 또는 summary로 알려준다.
- 상태별 세부 규칙은 아래 `인터랙션 상태 규칙`을 공통으로 적용한다. 컴포넌트마다 hover/focus/active 문법을 새로 만들지 않는다.

### DR-08. 행사 목록이 고정 3열 grid로 빈 공간을 만든다

근거: `apps/web/src/features/events-surveys/events-surveys-grid.tsx:125-176`와 `/events-surveys?tab=event` 렌더링.

규칙:

- 항목 수가 1개인 상태 그룹은 1열, 2개는 2열, 충분한 경우에만 3열을 사용한다.
- 운영 목록의 기본 정렬 기준은 마감/시작일이며, 카드 수가 적으면 date-led list를 우선 검토한다.
- 시작 전·진행 중 항목을 먼저 보여주고, 마감 항목은 접기·archive·낮은 강조 중 하나를 명확히 선택한다.
- 카드 안에서 상태, 날짜, 장소, 신청 가능 여부, 제한 조건이 제목보다 먼저 또는 즉시 뒤에 읽혀야 한다.

### DR-09. 고정형 Channel Talk 위젯의 겹침

근거: `/board/공지` 화면의 우측 하단 고정 상담 위젯.

규칙:

- fixed widget은 마지막 content와 최소 24px 이상 간격을 확보한다.
- tooltip/popover는 페이지네이션·CTA·마지막 행을 가리지 않는 위치를 선택한다.
- 모바일에서는 `env(safe-area-inset-bottom)`을 반영하고, 필요하면 표 하단에 위젯 높이만큼 padding을 예약한다.
- QnA/건의사항처럼 문의 의도가 높은 화면에는 인라인 문의 CTA를 함께 제공하되, 고정 위젯과 중복 설명을 과하게 노출하지 않는다.

### DR-10. 캘린더가 숫자와 셀 장식에 집중됨

근거: `apps/web/src/components/organisms/calendar.tsx`.

규칙:

- 셀 border는 아주 옅게 하거나 제거하고, 날짜 간격과 선택 상태로 구조를 만든다.
- 오늘은 포인트 원형 또는 얇은 outline 하나로 표시한다. 현재 구현의 진한 검정 원은 brand 규칙과 맞는지 재검토한다.
- 일정은 색상 점만으로 전달하지 말고 일정 유형 label/icon과 agenda를 함께 제공한다.
- 이벤트 bar는 두껍고 둥근 pill보다 얇은 직사각형/점+텍스트를 기본으로 한다.
- 모바일은 month grid보다 선택일 agenda가 먼저 읽히도록 한다.

### DR-11. Footer는 높이보다 정보 구조와 대비를 관리함

근거: `apps/web/src/components/organisms/footer.tsx`.

- 현재 Footer는 데스크톱에서 정보와 Instagram을 가로 배치하고 있어 첨부 피드백의 핵심 제안이 이미 반영되어 있다.
- 현재 점검에서 desktop 약 113px, mobile 약 169px로 확인되었으므로 “무조건 대폭 축소”를 우선 과제로 삼지 않는다.

규칙:

- Footer는 공식 연락처, 개인정보처리방침, 구성원/공식 채널, 저작권, 최종 갱신 정보를 compact하게 묶는다.
- desktop은 1~2행 가로 구조, mobile은 의미 그룹 단위의 짧은 세로 구조를 사용한다.
- 전체 페이지를 짙은 초록으로 끝내는 것이 콘텐츠보다 강해지지 않도록 brand surface와 neutral surface 중 하나를 제품 전반에서 일관되게 선택한다.
- 링크 대비와 focus ring을 유지한다. 단순히 높이를 줄여 작은 글씨를 만들지 않는다.

## 4. 인터랙션 상태 규칙

인터랙션은 장식을 추가하는 수단이 아니라 “지금 조작할 수 있는가, 어떤 상태인가, 눌렸는가”를 즉시 알려주는 affordance다. 모든 상태는 레이아웃을 움직이지 않고, 키보드·마우스·터치에서 서로 방해하지 않아야 한다.

### 4.1 공통 상태 모델

| 상태 | 적용 기준 | 기본 시각 규칙 |
|---|---|---|
| Default | 아무 상호작용이 없는 상태 | neutral border/surface, 명확한 텍스트 대비, 고정된 크기 |
| Hover | `hover: hover`이고 `pointer: fine`인 환경에서만 | 배경을 4~6% 틴트하거나 border를 한 단계 진하게 한다. 크기를 키우지 않는다. |
| Focus-visible | 키보드 Tab, 보조 입력 등 탐색 의도가 감지된 포커스 | 1px border를 유지한 채 brand border + 2~3px ring을 바깥에 표시한다. |
| Active | 마우스 버튼·터치·키보드로 누르고 있는 순간 | 배경을 한 단계 강조하고, 필요한 버튼만 `scale(0.98)`로 순간 축소한다. |
| Open/Selected/Checked | dropdown, tab, checkbox, switch가 현재 선택·열림 상태일 때 | `aria-expanded`, `aria-selected`, `aria-checked`와 시각 상태를 함께 유지한다. |
| Disabled | 사용 불가 상태 | hover/active를 제거하고, 텍스트·아이콘·cursor로 비활성 상태를 설명한다. opacity만으로 전달하지 않는다. |
| Loading | 요청 처리 중 | 버튼/입력의 폭과 label 위치를 유지하고 `aria-busy`와 진행 표시를 제공한다. |

### 4.2 레이아웃 시프트 방지

- Default, hover, focus-visible에서 border-width는 항상 1px로 고정한다. focus 때 2px border로 바꾸지 않는다.
- hover에서 padding, font-size, width, height를 바꾸지 않는다. active의 `transform: scale(0.97~0.98)`은 주변 레이아웃을 재배치하지 않는 요소에만 사용한다.
- focus ring은 `box-shadow` 또는 `outline-offset`로 요소 바깥에 그린다. 콘텐츠 영역 안쪽에 ring을 넣어 text/caret가 밀리지 않게 한다.
- loading spinner, chevron, trailing action의 공간은 기본 상태부터 예약한다. 로딩 label이 나타나도 버튼 폭이 변하지 않아야 한다.
- 메뉴를 열 때 height를 애니메이션하지 않는다. `opacity + transform: scale(0.98 → 1)` 정도만 사용하고 transform-origin을 trigger 가까이에 둔다.

### 4.3 입력·검색창

| 상태 | 규칙 |
|---|---|
| Default | `1px solid #D9E1DC`, 흰색 또는 현재 surface 배경, 고정 높이 40~44px. placeholder는 muted text로 둔다. |
| Hover | 배경색은 바꾸지 않고 border만 `#AAB8B0` 수준으로 한 단계 진하게 한다. |
| Focus-visible | border는 1px brand 색으로 바꾸고 바깥에 2~3px 반투명 brand ring을 추가한다. focus 시 input 내부 padding은 변하지 않는다. |
| Active/Click/Touch | focus 상태를 즉시 유지하고 caret을 활성화한다. 별도 scale이나 배경 flash는 사용하지 않는다. |
| Disabled/Read-only | disabled는 muted surface와 cursor로 구분한다. read-only는 읽을 수 있는 대비를 유지하고 disabled처럼 흐리게 만들지 않는다. |

- 검색 icon은 `:focus-within`에서 muted에서 body/brand text로 바꿔 현재 입력 위치를 보조한다.
- 검색창 안의 clear/submit icon은 44px에 가까운 click target을 갖고, icon-only인 경우 accessible name을 제공한다.
- input error는 border만 빨갛게 바꾸지 말고 field message와 `aria-describedby`를 연결한다. 에러 ring은 brand ring과 혼동되지 않게 danger 색을 사용한다.

### 4.4 버튼

| 유형 | Default | Hover | Focus-visible | Active/Touch |
|---|---|---|---|---|
| Primary | brand fill + 대비가 충분한 text | 색상 명도를 5~10% 조정하거나 약한 overlay | 2~3px 반투명 brand ring, 외곽 2px offset | 배경을 한 단계 진하게 하고 `scale(0.98)`을 80~120ms 동안 적용 |
| Ghost/Outline | 투명 또는 surface 배경 + 연한 border | `rgba(0,0,0,.04)` 수준 tint + border 진하게 | primary와 같은 ring | tint를 한 단계 높이고 필요할 때만 `scale(0.98)` |
| Destructive | danger 색은 삭제/위험 작업에만 사용 | danger 명도 5~10% 조정 | danger ring | 확인 가능한 경우에만 scale 축소; 삭제 동작은 확인 단계를 생략하지 않는다. |
| Icon-only | 40px 이상, 모바일은 44px target, 명확한 icon | 약한 neutral/brand tint | icon 주위 ring | 배경 tint를 강화한다. 아이콘 자체를 확대하지 않는다. |

- hover에서 버튼이 커지거나 padding이 변하지 않는다. 시각적 반응은 색·border·shadow·transform으로 제한한다.
- active scale은 링크·표 행·큰 card 전체보다 “눌리는 버튼”에 우선 적용한다. 목록 행을 축소하면 주변 콘텐츠가 흔들려 보일 수 있다.
- 버튼 높이와 label 폭은 상태별로 고정한다. `aria-busy="true"`일 때도 spinner를 추가해 폭이 달라지지 않게 한다.
- primary 버튼의 text/background 대비는 WCAG AA를 만족시키고, hover 색 변경 후에도 대비가 유지되는지 확인한다.

### 4.5 Dropdown / Select

| 상태 | Trigger | Menu / Item |
|---|---|---|
| Default | input과 같은 1px neutral border, 우측 chevron, pointer cursor | 닫힘 |
| Hover | trigger border를 한 단계 진하게 하고 배경은 아주 약하게만 틴트 | pointer 환경에서 item hover는 `#F4F4F5` 수준 neutral tint |
| Focus-visible | brand border + 2~3px ring | focus된 item도 같은 focus 인지 규칙을 사용 |
| Open | `aria-expanded="true"`, border/ring 유지, chevron 180° 회전 | opacity + scale 0.98→1의 짧은 등장, 충분한 z-index와 viewport 내 위치 |
| Active/Touch | trigger는 pressed tint를 사용 | 선택된 item은 check/icon + text로 표시하고 색상만으로 표현하지 않는다. |

- chevron 회전은 약 150~180ms로 처리하며, menu open/close에서 height를 움직이지 않는다.
- menu item의 hover 배경은 전체 row에 적용하고 텍스트만 부분적으로 반전시키지 않는다.
- custom dropdown은 keyboard Arrow, Enter, Escape, Tab 순서를 native select와 동등하게 제공한다.
- outside click, Escape, 선택 완료 후 focus return을 일관되게 처리한다.

### 4.6 Checkbox / Switch / Radio

- Default는 neutral border/track으로 두고 checked/on 상태는 brand fill + 명확한 check/knob 위치로 표현한다.
- pointer 환경의 hover는 border/track 대비를 올리는 정도로 제한한다. unchecked control의 배경을 갑자기 채우지 않는다.
- `:focus-visible`은 control 바깥으로 2~3px ring을 그린다. ring이 label이나 다른 control과 붙어 보이지 않도록 간격을 확보한다.
- active는 check/track 색상 전환과 짧은 knob 이동만 사용한다. 과한 spring/bounce나 3D 효과는 사용하지 않는다.
- label까지 click target에 포함하고, checkbox/switch의 현재 상태를 텍스트나 accessible state로 확인할 수 있게 한다.

### 4.7 Tabs, Links, Rows, Cards

- tab은 기본적으로 muted text, hover는 text color 변화, active는 2px underline 또는 surface tint로 표시한다. active underline 공간은 처음부터 예약해 tab 높이가 변하지 않게 한다.
- 링크 underline은 본문 링크에는 유지하고, navigation link는 color/underline indicator 중 하나를 일관되게 사용한다.
- 표 행과 card의 hover는 배경 tint와 border 변화로 표현한다. 데이터 행에 hover lift/scale을 적용하지 않는다.
- clickable card는 `role`, keyboard activation, focus-visible ring을 제공한다. 단순 정보 card에는 pointer cursor를 붙이지 않는다.
- selected card/filter는 hover와 다른 지속 상태를 가져야 한다. hover를 제거해도 현재 선택 상태가 사라지면 안 된다.

### 4.8 Touch 및 접근성 분리

```css
.control {
  border: 1px solid var(--border);
  transition:
    color 150ms cubic-bezier(.4, 0, .2, 1),
    background-color 150ms cubic-bezier(.4, 0, .2, 1),
    border-color 150ms cubic-bezier(.4, 0, .2, 1),
    box-shadow 150ms cubic-bezier(.4, 0, .2, 1),
    transform 100ms cubic-bezier(.4, 0, .2, 1);
}

.control:focus {
  outline: none;
}

.control:focus-visible {
  border-color: var(--brand);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--brand) 22%, transparent);
}

@media (hover: hover) and (pointer: fine) {
  .control:hover {
    border-color: var(--border-strong);
  }
}

.button:active:not(:disabled) {
  transform: scale(.98);
}

@media (prefers-reduced-motion: reduce) {
  .control {
    transition: none;
  }

  .button:active:not(:disabled) {
    transform: none;
  }
}
```

- 위 예시처럼 `:focus-visible`을 시각 focus의 기준으로 삼고, `:focus`만으로 두꺼운 outline을 항상 표시하지 않는다. 단, focus-visible 대체 스타일 없이 `outline: none`만 선언하지 않는다.
- hover는 `@media (hover: hover) and (pointer: fine)` 안에서만 선언해 모바일·태블릿의 sticky hover를 피한다.
- `transition: all`은 예측하지 못한 크기·레이아웃 변화까지 애니메이션할 수 있으므로 사용하지 않고 color/background/border/shadow/transform/opacity만 명시한다.
- 터치 target은 최소 44×44px을 유지하며, 작은 icon은 시각 크기와 hit area를 분리한다.
- `prefers-reduced-motion: reduce`에서는 transform, spring, slide, shimmer를 제거하거나 즉시 전환한다.

## 5. 공통 토큰 규칙

아래 값은 현재 KAIST/SOC green 토큰을 정리하기 위한 시작점이다. 실제 KAIST brand guideline이 확인되면 색상 값은 그 문서를 우선한다.

| 의미 | 기준값 | 사용 |
|---|---|---|
| Canvas | `#F6F8F7` | 전체 페이지 배경 |
| Surface | `#FFFFFF` | 카드·표·입력 배경 |
| Text strong | `#17211C` | 제목·핵심 데이터 |
| Text body | `#35433B` | 본문·작성자 |
| Text muted | `#66736C` | 날짜·보조 설명 |
| Border | `#D9E1DC` | 입력·card·표 선 |
| Brand 700 | `#006E3F` | primary action·active |
| Brand 900 | `#004B2B` | 제한적인 강조 surface |
| Brand 100 | `#DDEFE5` | 선택·정보 배경 |
| Danger | `#B4234D` | 삭제·오류·마감 보조 |
| Warning | `#A16207` | 시작 전·주의 |

추가 규칙:

- green의 명도 변형을 컴포넌트마다 임의로 만들지 말고 `brand`, `brand-soft`, `brand-border` 같은 semantic token으로만 사용한다.
- 운영 화면의 gradient는 기본값이 아니다.
- card shadow는 `0 1px 2px rgba(16,24,40,.04)` 중심으로 통일하고, popover/dialog만 한 단계 높인다.
- spacing은 4px 단위로 쌓되, 페이지 좌우 여백은 desktop 32px, mobile 20~24px을 기준으로 한다.
- `prefers-reduced-motion`에서는 hover lift, slide-in, bounce, shimmer를 줄이거나 제거한다.

## 6. 콘텐츠·언어 규칙

- 설명 문장은 “왜 필요한가/무엇을 할 수 있는가”가 아니면 생략한다.
- 공지·행사·설문에는 제목만큼 게시/갱신일, 신청·마감일, 담당/문의, 공개 범위가 중요하다.
- 한국어/영어 전환 시 제목·설명·작성자명·상태 label을 섞어 보여주지 않는다.
- 번역이 없으면 조용히 한국어를 대체 노출하지 말고 `한국어 전용` 또는 관리자 번역 상태를 표시한다.
- placeholder, empty, error, forbidden을 같은 카드와 같은 문구로 처리하지 않는다.
- 실제 콘텐츠가 없을 때 임의의 행사명·구성원·연혁·이미지를 만들어 시각적 빈틈을 채우지 않는다.

## 7. 화면별 적용 순서

### P0 — 공통 문법과 모바일 정보 손실

1. decorative `PageHero`는 추가하지 않고, 필요한 제목·breadcrumb·탭만 compact page context로 구성한다.
2. 폰트 로드와 `font-outfit` 사용 여부를 확정한다.
3. radius, shadow, badge, input, focus ring을 semantic token으로 통합한다.
4. 게시판 모바일을 card list로 전환하고 제목 2줄·작성자/날짜/첨부 정보를 보존한다.
5. Channel Talk 위젯이 마지막 행과 페이지네이션을 가리지 않도록 safe area를 고정한다.

### P1 — 목록과 행사 허브

1. 표 header/행/페이지네이션을 border 중심으로 정리한다.
2. 행사 목록을 항목 수 기반 auto-fit 또는 date-led list로 바꾼다.
3. 추상 대표 이미지와 공통 dark overlay를 공식 placeholder 정책으로 대체한다.
4. 상태 badge·필터·검색 control의 radius와 대비를 통일한다.

### P2 — 캘린더·Footer·관리자

1. 캘린더에 today/selected/agenda/유형 label을 추가한다.
2. Footer에 공식 문의·최종 갱신 정보를 보완하고 색상 대비를 재검토한다.
3. 관리자 화면에서 marketing hero, glow, 큰 rounded-3xl, 장식 animation을 제거하고 업무 밀도를 높인다.

## 8. 완료 기준

- 1280×720에서 게시판 목록의 제목·검색·첫 행이 첫 화면 안에 들어온다.
- 390px에서 카테고리 탭은 임의로 두 줄로 깨지지 않고, 게시글 제목은 최소 2줄까지 읽을 수 있다.
- 공지/행사/설문 목록에 random gradient, 의미 없는 dark overlay, 내용 없는 장식 카드가 없다.
- 표·카드·popover의 radius와 shadow가 위 토큰 범위를 벗어나지 않는다.
- 상태는 색상·아이콘·텍스트 중 최소 두 가지로 구분된다.
- hover는 fine pointer 환경에서만 적용되고, focus-visible·active·disabled·loading 상태가 컴포넌트별로 정의되어 있다.
- focus 또는 active 전환으로 border width, padding, font size, 주변 레이아웃이 변하지 않는다.
- primary/ghost 버튼, input/search, dropdown, checkbox/switch, tab/row가 같은 focus ring·transition·touch target 규칙을 따른다.
- 페이지네이션은 페이지 수가 많아져도 범위·현재 상태·이전/다음 조작을 이해할 수 있다.
- 고정 위젯이 행·페이지네이션·primary CTA를 가리지 않는다.
- 모든 입력·탭·dropdown·페이지 버튼에 keyboard focus가 보인다.
- KO/EN 전환 후 title, 설명, 상태, 작성자/담당자, `html lang`이 일관된다.
- `prefers-reduced-motion`에서 장식 애니메이션이 사용자를 방해하지 않는다.

## 9. 근거 파일

- `apps/web/src/styles.css`
- `apps/web/src/components/organisms/page-context.tsx`
- `apps/web/src/components/organisms/header.tsx`
- `apps/web/src/components/organisms/footer.tsx`
- `apps/web/src/features/board-list/board-page-sections.tsx`
- `apps/web/src/components/ui/pagination.tsx`
- `apps/web/src/features/events-surveys/events-surveys-grid.tsx`
- `apps/web/src/features/events-surveys/events-surveys-filter-bar.tsx`
- `apps/web/src/components/organisms/calendar.tsx`
- `docs/UI_UX_GUIDE.md`
- `docs/DESIGN_AUDIT_2026-07-15.md`
- `docs/DEVELOPMENT_PLAN.md`

## 10. 신규 요구사항에 대한 디자인 규칙

이 절은 `docs/DEVELOPMENT_PLAN.md`의 기능 요구사항 중 화면·상태·정보 구조에 직접 영향을 주는 규칙을 정리한다. 기능의 DB/API 순서와 권한 세부사항은 개발 계획 문서를 우선한다.

### DR-12. 홈은 viewport 중심의 고정 canvas로 설계한다

- 데스크톱 홈 화면은 기본적으로 body/page scroll이 생기지 않는 `100dvh` canvas를 사용한다. 모바일은 좁은 viewport에서 콘텐츠를 숨기지 않도록 문서 스크롤을 허용한다.
- 헤더·hero·주요 widget·하단 action이 좁은 viewport에서 잘리지 않도록 safe-area와 breakpoint별 밀도를 먼저 설계한다.
- 콘텐츠를 숨겨서 스크롤을 없애지 않는다. 우선순위가 낮은 내용은 요약·line clamp·더보기·별도 전체 보기로 이동한다.
- 홈 안에 또 다른 세로 scrollbar를 만드는 nested scroll을 기본값으로 사용하지 않는다.
- 브라우저 zoom, 키보드 탐색, reduced motion을 켠 상태에서 중요한 action이 사라지거나 포커스가 잘리지 않는지 확인한다.

### DR-13. Carousel은 drag affordance와 keyboard affordance를 함께 제공한다

- carousel은 previous/next button, 현재 위치, keyboard 이동, pointer/touch drag를 모두 제공한다.
- drag 중에는 pointer capture를 사용하고, 작은 움직임은 클릭으로 처리한다. 일정 threshold 이상 이동했을 때만 다음/이전 slide로 전환한다.
- `scroll-snap` 또는 동일한 페이지 단위 이동을 사용해 놓인 위치가 애매하게 끝나지 않게 한다.
- drag 중 텍스트가 선택되거나 내부 링크가 오작동하지 않게 처리하되, 링크·버튼의 keyboard/assistive technology 접근은 유지한다.
- 기본 scrollbar를 시각적 carousel UI로 노출하지 않는다. 대신 위치 indicator와 accessible label로 현재 상태를 알린다.
- hover 확대, 과도한 관성, 무한 자동재생은 기본값으로 사용하지 않는다. 자동재생이 필요하면 pause/stop과 reduced-motion을 제공한다.

### DR-14. 홈 위젯은 남는 공간에 끼워 넣지 않고 정보 우선순위로 크기를 정한다

- 홈 캘린더는 게시글 카드 옆의 작은 보조 위젯이 아니라, 카드의 폭·높이를 충분히 차지하는 주요 정보 블록으로 설계한다.
- widget 높이를 고정해 내용이 잘리지 않게 하며, 일정이 많을 때는 전체 캘린더로 이동하는 CTA를 제공한다.
- 게시글·행사 card 내부에 세로 scrollbar를 넣지 않는다. 최대 노출 수, 요약, pagination, 더보기 중 하나를 사용한다.
- “스크롤바를 숨겨서” 넘치는 내용을 감추지 않는다. 내용이 더 있다는 사실을 label 또는 count로 알린다.

### DR-15. 행사·게시글 목록의 상태와 우선순위를 시각적으로 설명한다

- 홈 행사 카드에는 마감된 항목을 기본 노출하지 않는다. 마감 항목이 별도 목록에 존재한다면 보관/종료 상태를 명확히 표시한다.
- 정렬된 pinned 항목은 pin icon 또는 `고정` label과 지속적인 순서로 강조한다. 단순히 초록색을 진하게 칠하는 것으로 끝내지 않는다.
- 임박 순서는 날짜만 나열하지 않고 `D-day`, 마감일, 시작일 중 필요한 값을 함께 보여준다.
- pinned, open, upcoming, closed, draft 같은 상태는 색상만으로 구분하지 않는다. text/icon/border/position 중 최소 두 가지를 사용한다.
- 목록의 hover가 pinned/selected/closed 같은 지속 상태를 덮어쓰지 않게 한다.

### DR-16. Pagination은 정보 밀도와 조작 안정성을 함께 유지한다

- 기본 정보 구조는 `페이지 크기 선택 → 총 N건 중 x-y → 이전 → 현재/전체 → 다음` 순서를 따른다.
- 페이지 크기와 범위 문구가 바뀌어도 주변 요소의 폭이 갑자기 움직이지 않도록 slot/min-width를 둔다.
- 현재 페이지는 배경·border·`aria-current`로 명확히 표시하고, disabled 이전/다음은 낮은 대비로 구분하되 접근 가능한 텍스트를 유지한다.
- 모바일에서는 숫자 버튼을 모두 늘어놓지 않고 현재 위치와 이전/다음 조작을 우선한다. hit area는 44px 이상으로 유지한다.
- 페이지 이동 후 focus가 사라지지 않게 하고, 목록 갱신은 `aria-live` 또는 적절한 상태 문구로 알린다.

### DR-17. 언어에 따라 toolbar가 흔들리지 않게 한다

- 검색·언어·프로필/로그인 slot의 크기는 번역된 문장 길이에 종속되지 않는다.
- 텍스트가 필요한 action은 고정 min-width 또는 별도 label 영역을 사용하고, icon-only action은 44px hit area와 accessible name을 제공한다.
- KO/EN 전환, 긴 사용자 이름, 로그인/로그아웃 상태 전환에서도 logo와 primary navigation의 위치가 급격히 이동하지 않아야 한다.
- 모바일에서는 toolbar를 줄여도 기능을 삭제하지 않고 menu/overflow로 이동한다. tooltip만으로 중요한 기능을 전달하지 않는다.

### DR-18. 작성기는 locale과 편집 밀도에 따라 적응한다

- 다국어 콘텐츠는 데스크톱에서 국문/영문 제목·본문을 5:5로 동시에 볼 수 있다. 두 편집 영역의 label과 저장 상태를 분명히 한다.
- 한국어 전용 콘텐츠는 영문 입력 영역을 숨기고 국문 편집 영역을 전체 폭으로 사용한다. 숨김은 기존 번역 데이터를 삭제하는 의미가 아니다.
- 모바일에서는 5:5를 유지하지 않고 국문/영문을 세로 stack하며, 현재 편집 언어가 화면 상단에 남아 있어야 한다.
- Markdown 단축키는 toolbar에서 확인 가능해야 하며, `Ctrl/Cmd+B` 같은 shortcut의 결과가 시각적으로 즉시 확인되어야 한다.
- 글자 색상과 font size는 임의 CSS 입력이 아닌 허용된 token/scale 선택으로 제공한다. 선택된 mark의 상태를 `aria-pressed` 또는 equivalent state로 표시한다.
- toolbar가 긴 화면에서는 줄바꿈·overflow menu를 사용하되, 본문을 가리거나 내부 세로 scrollbar를 만들지 않는다.
- autosave 상태는 `저장됨`, `저장 중`, `변경 없음`, `충돌 확인 필요`, `저장 실패`를 text와 icon으로 표시한다. 저장 때문에 제목·본문 폭이 흔들리지 않게 한다.

### DR-19. Sticky는 고정 자체보다 겹침 방지를 함께 설계한다

- 소개 탭바, 관리자 sidebar header/footer action, 주요 toolbar를 sticky로 만들 때 각각의 top offset·z-index·background를 명시한다.
- sticky 영역은 본문 첫 줄, modal, dropdown, Channel Talk, mobile safe-area를 가리지 않아야 한다.
- sticky 요소가 여러 개 겹치면 하나의 shell stack으로 관리하고, 임의의 `z-index` 숫자를 컴포넌트마다 만들지 않는다.
- 모바일 탭바는 한 줄 horizontal scroll 또는 compact menu로 유지하며, 두 줄 wrap으로 콘텐츠를 아래로 밀지 않는다.
- sticky action은 keyboard focus 시 화면 밖으로 밀리지 않고, focus ring이 상위 surface에 잘리지 않아야 한다.

### DR-20. 캘린더는 dot가 아닌 제목이 있는 연속 bar를 정보 단위로 사용한다

- 일정은 날짜 셀 안의 dot만으로 표현하지 않는다. title이 들어간 event bar를 기본 단위로 사용한다.
- 여러 날 일정은 첫날·중간날·마지막날의 bar가 같은 일정으로 이어져 보이고, 중간 날짜의 모서리가 끊겨 보이지 않게 한다.
- bar 내부 text는 최소 한 줄을 읽을 수 있어야 하며, 넘치는 일정은 `+N more`와 상세 목록으로 연결한다.
- 일정 유형, 외부 연동 여부, 오늘/선택 상태는 색상 외에 label, icon, border, shape 중 하나를 추가한다.
- 월/주/일 전환, 검색, 일정 추가 버튼은 동일한 toolbar hierarchy를 사용한다. 캘린더 grid 안에 별도 scrollbar를 기본으로 넣지 않는다.
- `.ics` import preview와 외부 calendar sync 상태도 정상/중복/충돌/실패를 색상만이 아닌 상태 문구로 표시한다.

### DR-21. 개인정보와 권한은 “보여줄 수 있음”과 “보여야 함”을 구분한다

- 마이페이지의 주전공·복수전공·부전공·학적·과비 상태는 정보 그룹과 label을 분리해 보여준다.
- 전화번호·메일·동의 여부 같은 개인정보는 기본적으로 필요한 범위만 노출하고, 관리자 화면에서는 권한에 따라 mask한다.
- 사용자의 소속 부적격/권한 만료 상태는 일반적인 네트워크 오류처럼 보이지 않게 `접근 권한 만료`, 사유, 필요한 문의 경로를 제공한다.
- 비밀글은 목록·검색·알림·스크랩 카드에서 제목/미리보기로 정보가 새지 않아야 한다.
- 권한 그룹 bulk selection과 과비 bulk update는 선택 수·필터 조건·적용 결과를 visible summary로 제공한다. 선택된 row가 hover나 pagination 때문에 사라지지 않게 한다.

### DR-22. 관리자 테이블은 filter·checkbox·pagination을 하나의 업무 흐름으로 만든다

- 관리자 데이터 테이블은 기본적으로 filter/search bar, checkbox column, pagination을 갖춘다.
- 전체 선택은 “현재 필터의 전체”와 “현재 페이지”를 구분한다. 선택이 유지되는 범위와 해제 action을 명확히 한다.
- bulk action은 선택 전 비활성, 선택 후 대상 수 표시, 실행 전 preview/확인, 실행 후 성공/실패 summary의 상태를 사용한다.
- 테이블 header는 sticky가 필요할 때만 사용하고, sticky footer/action과 겹치지 않게 한다.
- 스프레드시트 import/export는 `.xlsx`를 표준으로 하며 mapping/validation/error row와 파일 상태를 별도 단계로 보여준다. 다운로드 버튼이 실제 export 대상 filter를 잃지 않게 한다.
- audit log와 fee management처럼 dense table인 화면도 row height를 지나치게 줄이지 않고, 모바일에서는 card/column priority로 전환한다.

### DR-23. Footer는 정보만 남기고 세로 공간을 줄인다

- Footer는 연회색 surface를 기본으로 하고, 메일·Instagram·이용약관·개인정보처리방침·Copyright 정도를 한 줄 정보 구조로 제공한다.
- 요청하지 않은 장식 문구, 큰 로고, 불필요한 링크 그룹을 추가하지 않는다.
- desktop에서는 한 줄 또는 짧은 두 줄, mobile에서는 자연스러운 wrap을 허용하되 큰 세로 여백을 만들지 않는다.
- footer text와 link contrast, focus-visible, external link label은 유지한다.

### DR-24. 알림·초안·동기화는 데이터 상태를 먼저 보여준다

- 알림 unread/read, 초안 saved/saving/failed/conflict, S3 uploading/complete/failed, ICS imported/duplicate/error는 서로 다른 상태로 표시한다.
- toast만으로 중요한 실패를 전달하지 않고, 해당 컴포넌트 안에 재시도·복구·상세 보기 경로를 둔다.
- optimistic like/scrap은 즉각적인 pressed state를 보여주되 실패 시 원래 상태로 돌아가고 실패 이유를 알린다.
- 자동 저장·동기화가 진행 중이어도 primary CTA의 label 폭과 위치가 변하지 않게 한다.

### 10.1 이번 요구사항의 디자인 완료 기준

- 홈에서 body/nested scrollbar 없이 주요 콘텐츠와 carousel/calendar action을 사용할 수 있다.
- 홈 행사 카드에는 마감 항목이 노출되지 않고, pinned·임박 순서와 상태가 text/icon/position으로 확인된다.
- drag carousel이 pointer/touch/keyboard에서 동작하고, scrollbar 대신 위치 indicator를 사용한다.
- 게시글·행사 card 내부에는 scrollbar가 없으며 더보기 또는 전체 목록으로 이동할 수 있다.
- KO/EN 전환과 긴 사용자 이름에도 nav toolbar 폭이 흔들리지 않는다.
- 작성기는 한국어 전용과 국문/영문 5:5 상태를 올바르게 보여주고, shortcut·color·font size·autosave 상태가 접근 가능하다.
- 소개 탭과 관리자 sticky surface가 콘텐츠·Channel Talk·modal을 가리지 않는다.
- 캘린더의 다일 일정은 제목이 있는 이어진 bar로 보이고, dot만 있는 일정은 기본 표현이 아니다.
- 관리자 filter/checkbox/pagination의 선택 상태와 bulk action 결과가 항상 화면에서 추적된다.
- Footer는 연회색·compact·최소 링크 구조를 따른다.

## 11. 추가 IA·행사 화면·배경 계층 규칙

### DR-25. 소개 페이지의 hero는 완전히 제거한다

- 소개·조직도·연혁·구성원·Contact me·공약·FAQ처럼 운영 콘텐츠를 읽는 화면에는 decorative hero/page hero를 두지 않는다.
- 첫 화면은 GNB와 필요한 breadcrumb 또는 sub-tab 다음에 바로 콘텐츠가 시작되어야 한다.
- 제목이 필요하면 콘텐츠 영역의 compact heading으로 한 번만 표시한다. hero title, section title, tab title이 같은 문구를 2~3회 반복하지 않는다.
- 사진·슬로건이 실제 콘텐츠라면 hero 장식으로 재사용하지 말고 해당 section의 의미 있는 콘텐츠 block으로 배치한다.

### DR-26. 행사·설문 목록은 카드 grid를 기본으로 한다

- desktop은 3열, 중간 폭은 2열, 좁은 모바일은 1열로 전환한다. desktop에서 카드 하나가 불필요하게 전체 콘텐츠 폭을 차지하는 고정 1열 layout을 기본값으로 사용하지 않는다.
- card width는 같은 grid 안에서 동일하게 유지하고, 행 높이는 가장 긴 콘텐츠 때문에 지나치게 늘어나지 않게 title/description line clamp와 meta 우선순위를 정의한다.
- 카드 간 gap은 일관된 spacing token을 사용하고, 배경·filter·card surface의 경계가 줄무늬처럼 반복되지 않게 한다.

### DR-27. 썸네일은 16:9 또는 4:3 media frame을 사용한다

- 극단적으로 납작한 banner strip을 행사 card의 기본 thumbnail로 사용하지 않는다.
- `aspect-ratio: 16 / 9` 또는 `4 / 3`을 frame에 고정하고, 원본 비율이 다른 이미지도 frame 자체가 흔들리지 않게 한다.
- 사진처럼 crop이 가능한 이미지는 `object-fit: cover`를 사용하되, 포스터·공지·텍스트가 포함된 이미지는 `contain`과 neutral letterbox를 사용해 핵심 내용이 잘리지 않게 한다.
- 이미지가 없을 때는 랜덤 gradient를 넣지 말고 공식 placeholder icon/type/date를 표시한다.
- thumbnail 안에 읽어야 할 텍스트를 overlay로 중첩하지 않는다. 이미지와 텍스트 정보의 대비를 분리한다.

### DR-28. 행사 상태는 filter chip으로 제어하고 본문 section 제목으로 반복하지 않는다

- `시작 전 1`, `진행 중 1`, `마감 1`처럼 목록 본문을 상태별 section으로 쪼개지 않는다.
- 상단 filter chip은 `전체`, `시작 전`, `진행 중`, `마감`의 단일 control group으로 제공하고, 선택 상태를 `aria-pressed`/selected state와 색상·border로 함께 표시한다.
- chip을 바꾸면 같은 grid의 카드만 필터링한다. 카드 grid의 위치·폭·기본 높이가 불필요하게 변하지 않게 한다.
- 결과가 없을 때는 section heading을 추가하지 말고, 현재 filter와 일치하는 empty state를 사용한다.

### DR-29. 행사 화면의 제목 계층은 한 번만 말한다

- `행사 / 설문·투표` 같은 대제목을 GNB, page hero, sub-tab에서 중복 노출하지 않는다.
- 행사 화면에서는 `행사 | 설문·투표 | 일정` sub-tab을 화면 상단의 primary context로 사용한다.
- sub-tab active state는 2px indicator 또는 surface tint 중 하나를 일관되게 사용하고, active tab 때문에 높이가 변하지 않게 underline 공간을 예약한다.
- filter chip과 sub-tab은 서로 다른 계층으로 구분한다. sub-tab은 콘텐츠 종류 전환, chip은 현재 목록 상태 필터다.

### DR-30. 카드 전체를 하나의 semantic link로 만든다

- 우측 하단의 `자세히 보기 >` 같은 별도 CTA를 기본으로 넣지 않는다. 카드 전체가 하나의 link/click target이 되어야 한다.
- 카드에는 hover, focus-visible, active 상태를 제공한다. hover에서는 border/background/shadow 정도만 변경하고 카드 전체를 확대하거나 주변 layout을 밀지 않는다.
- 카드 전체 link 안에 또 다른 link/button을 중첩하지 않는다. 좋아요·스크랩처럼 별도 action이 필요한 경우에는 카드 link와 action 영역의 semantic 경계를 별도로 설계한다.
- hover가 없는 touch 환경에서도 카드가 clickable하다는 사실을 title·arrow·pointer-independent affordance로 확인할 수 있게 한다.
- keyboard focus는 카드 전체를 감싸는 ring으로 표시하고, 클릭 후 이동하면 새 화면의 heading 또는 breadcrumb로 focus가 자연스럽게 이동한다.

### DR-31. 배경 계층은 세 단계로 제한한다

- GNB와 header: white surface + 하단 1px subtle border.
- page canvas: `#F8FAFC`에 가까운 아주 연한 cool gray. 제목 영역만 별도의 white band로 분리하지 않는다.
- content card: white surface + subtle border 또는 한 단계 shadow.
- `white → gray → white → gray → white`가 같은 화면에서 반복되는 filter wrapper/section wrapper를 만들지 않는다.
- filter bar가 필요하면 page canvas 위의 transparent/neutral toolbar로 설계하고, card와 같은 white box를 또 하나 중첩하지 않는다.
- 예외적으로 dialog/popover/selected surface가 layer를 만들 수 있지만, layer의 목적·z-index·닫힘 상태를 명확히 한다.

### DR-32. 상세 화면에는 슬림한 맥락 복귀 경로를 둔다

- 게시글·행사·설문 상세처럼 목록 탭이 사라지는 화면에는 breadcrumb 또는 back link를 페이지 헤더에 둔다.
- `게시판 > 공지`, `행사·참여 > 행사`, `← 공지사항으로 돌아가기`처럼 짧고 현재 위치가 분명한 표현을 사용한다.
- breadcrumb는 hero 대체용 큰 영역이 아니다. compact text, small icon, 1줄 높이로 유지한다.
- back link는 브라우저 history가 아니라 명시된 목록 route로 이동해야 하는 경우 해당 route를 사용한다.

### DR-33. 메가메뉴 없이 3단 GNB를 유지한다

- 최상단 GNB는 `게시판`, `행사·참여`, `학생회 소개` 3개 축을 기본으로 한다.
- hover/click mega menu로 모든 하위 메뉴를 한 번에 펼치지 않는다. 각 축의 landing page에서 sub-tab 또는 내부 navigation을 제공한다.
- 게시판 안의 `행사`와 상단의 `행사·참여`처럼 같은 목적의 메뉴를 중복 노출하지 않는다.
- `공약`은 학생회 소개의 이행 현황, `FAQ`는 학생회 소개의 자주 묻는 질문으로 배치하는 정보 구조를 기본안으로 한다.
- QnA는 신규 GNB·게시판 작성 경로에서 제거하고 Channel Talk으로 대체한다. 기존 QnA 데이터는 삭제하지 않고 read-only/archive와 legacy redirect로 보존한다.
- GNB label 변경 시 기존 route의 redirect/alias와 active state를 유지해 사용자가 길을 잃지 않게 한다.

### DR-34. 추가 화면 개편의 시각 완료 기준

- 소개 관련 모든 화면에서 decorative hero가 사라지고, 첫 콘텐츠가 과도한 상단 여백 없이 시작된다.
- 행사/설문 화면은 title 중복 없이 sub-tab → filter chip → 2/3열 card grid 순서로 보인다.
- card thumbnail은 16:9 또는 4:3 frame이며 포스터의 핵심 정보가 잘리지 않는다.
- 상태 section heading 대신 filter chip이 목록을 제어하고, empty state가 현재 filter를 설명한다.
- 카드 우측의 별도 “자세히 보기” 버튼 없이 카드 전체가 hover/focus 가능한 link로 동작한다.
- GNB/header는 white + 1px border, body는 cool gray, card는 white의 3-layer 구조를 따른다.
- 상세 화면에서 breadcrumb/back link로 목록 복귀가 가능하고, mega menu 없이 3단 GNB와 내부 sub-tab으로 탐색할 수 있다.

### DR-35. 게시판·캘린더 관리자 설정은 보존과 상태를 먼저 보여준다

- 게시판과 직접 일정의 `삭제` action은 기본적으로 archive/비활성화로 표시하고, 기존 글·첨부·일정이 보존된다는 설명을 확인 단계에 포함한다.
- 관리자 설정 화면은 이름·코드·정렬 순서·공개 범위·권한과 기능 허용 여부를 한 표 흐름에서 비교할 수 있게 한다. 작은 아이콘만으로 설정 의미를 전달하지 않는다.
- 비활성 row는 목록에서 제거하지 않고 muted 상태·`비활성` badge·`복구` action을 함께 제공한다.
- 직접 일정 추가 form은 제목, 시작/종료, 장소를 먼저 배치하고, import/export는 저장 action과 분리한다. `.ics` 중복·실패 결과는 count와 문장으로 알린다.
- 캘린더 검색은 현재 표시 범위의 결과를 같은 calendar surface에서 갱신하며, loading 중 input 폭·toolbar 높이·calendar cell 위치가 변하지 않게 한다.
- 다일 일정은 각 날짜 셀에 같은 제목 bar를 이어 보이게 하고, 첫날/중간/마지막 날의 radius만 조정한다. dot만 있는 상태를 기본 일정 표현으로 사용하지 않는다.

### DR-36. 카드 링크와 별도 action의 경계를 명시한다

- 게시글 목록·행사 카드의 본문 정보는 하나의 semantic link로 묶는다. 좋아요·스크랩·답글처럼 페이지 이동이 아닌 action은 link 바깥의 별도 action row에 둔다.
- link 안에 button/link를 중첩하지 않는다. action을 누를 때 카드 navigation이 함께 발생하지 않게 하고, action 자체에 `aria-label`, `aria-pressed`, loading/disabled 상태를 제공한다.
- optimistic count/state는 즉시 반영하되 요청 실패 시 이전 상태로 되돌리고, toast만이 아니라 해당 action 영역에 재시도 가능한 오류 상태를 연결할 수 있어야 한다.
- 로그인 전 action은 아무 변화 없이 실패시키지 않고 로그인 필요 안내를 제공한다. hover는 fine pointer media query에서만 적용하고 touch에서는 sticky hover에 의존하지 않는다.
- 댓글 대댓글은 기본 1단계만 보여준다. 대댓글 composer는 부모 댓글 아래에 들여쓰기와 좌측 연결선으로 표시하고, submit 중에도 composer의 크기와 주변 row 위치가 변하지 않게 한다.

### DR-37. 설문 일정과 응답 상태를 혼동하지 않는다

- 설문에는 응답 마감시각을 기본 UI로 두지 않는다. `상시 응답 가능` 또는 `시작 시각부터`만 표시하고, 종료는 게시/보관·응답 수 제한 같은 명시적 운영 상태로 표현한다.
- 행사 카드의 종료일과 설문 응답 종료일을 같은 필드나 배지로 합치지 않는다. 행사 종료일은 행사 일정의 일부이고, 설문은 별도 응답 정책이다.
- 설문 상태의 `마감`은 자동 계산된 시간 경과를 뜻하지 않으며, 접근 불가·보관·수동 운영 상태처럼 실제 이유를 함께 제공해야 한다.
- 이전 버전 데이터의 레거시 시간 컬럼이 남아 있어도 공개 카드·관리자 목록·캘린더에 다시 노출하지 않는다.

### DR-38. 관리자 업무 상태는 필터·선택·적용 결과를 한 화면에서 추적한다

- 관리자 dense table은 검색어, 상태/기간/전공 같은 filter, checkbox column, 페이지네이션을 함께 제공한다.
- `전체`, `현재 페이지`, `필터 결과 전체`의 범위를 구분하고 선택 수와 적용 대상 조건을 visible summary로 보여준다.
- 과비 상태는 `완납`, `부분 납부`, `미납`처럼 실제 업무 의미가 분명한 label을 사용하며 색상만으로 상태를 구분하지 않는다.
- XLSX import/export는 파일 선택 → validation preview → 적용 또는 다운로드의 단계와 결과/실패 행을 보여준다. 다운로드가 현재 filter를 잃지 않게 한다.
- bulk action은 선택 전 disabled, 선택 후 대상 수, 실행 전 확인, 실행 후 성공/실패 summary를 고정된 action 영역에 제공한다.

### DR-39. 알림·자동저장·업로드는 진행 상태와 복구 경로를 노출한다

- 알림은 unread/read를 색상·굵기·`aria` 상태로 함께 표시하고, 읽음 처리 후에도 사용자가 현재 위치를 잃지 않게 한다.
- 자동저장은 `저장 중`, `저장됨`, `저장 실패`, `충돌`을 구분한다. toast만으로 실패를 끝내지 말고 해당 입력 영역에 재시도/복구를 둔다.
- S3 파일 upload는 파일명·크기·진행/완료/실패 상태를 표시하고 실패 시 같은 자리에서 재시도한다. 상태 변화 때문에 input/button 폭이나 layout이 이동하지 않게 한다.
- optimistic like/scrap은 `aria-pressed`와 count를 함께 갱신하며 실패 시 원상복구한다. 로그인 필요 상태는 조용히 무시하지 않고 안내한다.

### DR-40. 설문 grid와 파일 질문은 구조를 읽을 수 있게 만든다

- grid 질문은 행 label과 열 label을 항상 함께 노출하고, 모바일에서는 가로 스크롤보다 행별 stacked layout을 우선 검토한다. 불가피한 overflow에는 표의 가로축과 현재 위치를 설명한다.
- `required` grid는 미응답 행을 구체적으로 표시하고, 셀 선택 상태를 색상·체크/텍스트로 함께 표현한다.
- 파일 업로드 질문은 허용 확장자/MIME·최대 개수·크기를 입력 전부터 설명하고, 업로드 중 제출 버튼을 중복 실행할 수 없게 한다.
- 설문 문항 유형이 바뀌어도 질문 제목·설명·필수 상태의 위치와 spacing은 고정해 화면이 흔들리지 않게 한다.
- 선택지 기반 조건부 section은 `다음 섹션`·`여기서 제출 완료`를 명시적인 select/label로 편집하고, 응답 화면에는 현재 경로에 도달한 section만 노출한다. 조건부로 건너뛴 required 문항을 제출하라고 요구하지 않는다.
- 조건부 section의 대상이 삭제·복제되어도 잘못된 ID가 남지 않도록 저장 시 검증하고, 복제 시 대상 section ID를 새 설문에 맞춰 재매핑한다.

### DR-44. 설문 설명도 게시판과 같은 rich-text 문법을 사용한다

- 설문 제목·선택지·메타데이터처럼 구조화된 값은 일반 input으로 유지하고, 설문/section/문항 설명은 게시판과 같은 `RichTextEditor`를 재사용한다.
- 편집기에는 굵게·기울임·밑줄·목록·링크·제목·글자색·글자 크기와 `Ctrl/Cmd+B` 같은 단축키를 제공한다. compact modal에서는 toolbar와 canvas 높이를 줄이되 control 순서와 focus 규칙은 바꾸지 않는다.
- 서버 저장 시 허용 tag와 `color`/`font-size` 값만 sanitize한다. 브라우저 viewer도 legacy/plain text를 HTML로 오해하지 않도록 escape하고, 링크 scheme과 inline style을 다시 검증한다.
- 빈 Tiptap paragraph는 `null`로 정규화한다. 공개 설문·검색·관리자 목록에서는 rich HTML을 그대로 문자열로 노출하지 않고 viewer 또는 text summary를 사용한다.

### DR-41. 메일 수신자 확정과 HTML 미리보기는 안전한 단계로 분리한다

- 주전공·복수전공·부전공·학번·학적 등 AND filter는 적용된 조건을 chip/summary로 보여주고, 발송 전에 총 대상 수와 일부 샘플을 확인하게 한다.
- HTML 메일 preview는 sanitizer를 거친 결과를 사용하고, 발송 format/plain·HTML을 명시한다. 원본 HTML을 그대로 preview/발송하지 않는다.
- Dooray 발송 설정 오류, dry-run, 대상 0명, 예약/실패 상태는 각각 다른 feedback을 사용한다.
- 템플릿/첨부/예약/임시저장 기능을 추가할 때도 편집 중인 본문과 발송 대상 filter가 서로 덮어써지지 않도록 영역과 저장 상태를 분리한다.
- 사용자 템플릿은 저장·업데이트·삭제 대상과 정적 기본 템플릿을 구분하고, 예약 발송에는 `예약됨`·`취소됨`, 실패 발송에는 같은 자리의 `재시도` action을 제공한다. 동일 요청 재시도는 idempotency key로 중복 발송을 막는다.

### DR-42. 개인정보 스프레드시트와 연락망은 동의 상태를 기본값으로 삼는다

- 연락망에 표시하는 이름·성별·직책·기수·메일·전화번호는 운영 목적에 필요한 범위만 노출하고, 전화번호·메일은 권한별 masking을 적용한다.
- 개인정보 제공 미동의 row는 공개 화면과 일반 조회에서 즉시 제외한다. 자동 purge가 발생하면 운영자가 이유와 시각을 추적할 수 있는 audit 정책을 둔다.
- XLSX import/export는 동의 여부를 명시적 boolean/label로 처리하고, 빈 값·알 수 없는 값·민감 필드의 오류를 행 단위로 알려준다.
- 관리자 연락망은 `/contacts/manage`의 검색·성별·기수·동의 필터와 pagination을 같은 업무 흐름으로 묶고, 현재 필터를 유지한 XLSX 출력과 기본 masking/표시 토글을 제공한다.
- 개인정보 purge는 조회 시 자동으로 수행하되 `CONTACT_PRIVACY_PURGE` audit action과 삭제 건수를 남긴다. 공개 Contact 조회와 관리자 조회 모두 purge 이후 결과만 사용한다.

### DR-42a. 외부 캘린더는 opt-in read-only sync로 다룬다

- Google/KAIST 캘린더는 OAuth나 사용자 입력 URL을 기본 활성화하지 않는다. `CALENDAR_EXTERNAL_ICS_URLS` 환경 설정이 있을 때만 HTTPS ICS feed를 관리자 action으로 가져온다.
- UID 중복은 건너뛰고, 외부 feed에서 사라진 일정은 자동 삭제하지 않는다. 동기화 결과는 source 수·추가 수·중복 수·실패 host를 문구로 표시한다.

### DR-43. 반응형과 sticky surface는 콘텐츠를 가리지 않는다

- 데스크톱 관리자 표는 정보 밀도를 유지하되 390px 전후에서는 우선순위가 낮은 열을 접거나 card로 전환한다. 가로 overflow를 무심코 중첩 scrollbar로 만들지 않는다.
- sticky 탭·sidebar header/footer·toolbar는 상단 offset, z-index, safe-area를 명시하고 modal, Channel Talk, 첫 콘텐츠 행과 겹치지 않게 한다.
- hover는 `(hover: hover) and (pointer: fine)`에서만 적용한다. 터치에서는 hover 고착에 의존하지 말고 pressed/focus-visible/selected 상태로 affordance를 제공한다.

### DR-45. 캘린더 공급원과 발행 상태를 분리한다

- 사이트에서 만든 일정과 KAIST 학사일정은 같은 화면에서 보여도 source badge, 편집 가능 여부, Google 발행 상태를 분리한다. `KAIST 학사일정`은 읽기 전용이며 수정·숨김 action을 제공하지 않는다.
- 행사 학생회 캘린더와 KAIST 학사일정 캘린더는 서로 다른 Google Calendar ID를 사용한다. 두 공급원의 일정·상태·동기화 오류를 하나의 badge나 하나의 색상으로 합치지 않는다.
- 관리자 캘린더 toolbar는 `일정 추가`, `ICS 가져오기/내보내기`, `KAIST 학사일정 동기화`, `Google 발행`을 구분한다. 수동 동기화 결과에는 확인·추가·수정·숨김·실패 월 수를 표시한다.
- Google 발행은 비동기 상태를 `대기`, `동기화됨`, `실패`, `충돌`, `설정 안 됨`으로 보여준다. API 요청이 끝났다는 사실만으로 Google 반영 완료라고 표현하지 않는다.
- all-day 다일 일정은 첫날부터 마지막 날까지 같은 일정 bar가 이어져야 한다. Google/ICS export에서만 exclusive end를 사용하고, 화면의 마지막 날짜가 하루 줄어들지 않게 한다.
- 캘린더가 외부 원본을 수집할 때 부분 실패를 빈 결과로 해석하지 않는다. 실패한 월이 있으면 기존 일정 archive를 보류하고, 사용자가 실패 월을 확인할 수 있는 상태를 남긴다.

## 12. 2026-08-21 화면 피드백 반영 결정

### DR-46. 목록에서는 참여 action을 덜어내고 상세에서 제공한다

- 게시판 목록 row와 행사·설문 목록 card에는 좋아요·스크랩 action과 count를 표시하지 않는다. 목록의 primary action은 제목/카드 전체를 통한 상세 이동으로 한정한다.
- 좋아요·스크랩은 게시글·행사 상세 화면에서 계속 제공한다. 기능을 삭제한 것이 아니라 목록의 정보 밀도와 link/button 충돌을 줄인 것이다.
- 이 결정은 기존 DR-36의 “별도 action은 link 바깥에 둔다” 원칙보다 우선하는 이번 요구사항의 명시적 화면 정책이다. 향후 목록에서 다시 노출할 때는 별도 action row와 이벤트 버블링 방지 검증이 필요하다.

### DR-47. 홈과 전체 캘린더 모두 title bar를 정보 단위로 사용한다

- 홈 캘린더도 날짜 셀 안에 일정명이 들어간 bar를 표시한다. 같은 일정의 `id`와 날짜 범위를 묶어 여러 날짜에 걸친 bar가 한 일정처럼 이어지게 하며, 시작·중간·종료 구간의 모서리만 다르게 처리한다.
- 홈의 제한된 높이에서는 주차별 bar lane을 최대 2개까지 노출하고, 초과 일정은 `+N`으로 표시한다. 일정명은 bar의 시작 또는 현재 grid에서 보이는 첫 구간에만 노출해 셀 안의 반복 텍스트와 줄바꿈을 줄인다. (홈 화면에 한해서는 2026-08-21의 DR-62가 `+N` 제거와 중간 구간 제목 표시를 우선한다.)
- 날짜를 선택하면 하단에 선택 날짜·일정 개수와 전체 일정 링크를 제공한다. 상세 일정명·시간은 bar와 전체 캘린더에서 확인하며, hover tooltip만을 유일한 정보 경로로 사용하지 않는다. (홈 선택일 하단 행은 DR-62에 따라 제거하고 D-Day list로 대체한다.)
- `/events-surveys?tab=calendar` 데스크톱 캘린더도 title이 들어간 연속 bar와 다일 일정의 이어짐을 유지한다. 홈은 동일한 정보 규칙을 더 작은 surface에 맞춰 lane 수와 글자 크기만 조정한다.

### DR-48. 행사 card는 한 개의 surface로 인지되게 한다

- 행사 목록은 `sub-tab → flat filter chips → adaptive grid` 순서를 사용한다. filter bar를 흰색 카드 안에 다시 넣어 배경이 줄무늬처럼 겹치게 만들지 않는다.
- 상태 chip은 `시작 전`, `진행 중`, `마감`, `D-Day`/`D-N`처럼 짧은 label을 사용한다. `진행중 (오늘 마감)`처럼 한 chip 안에 긴 설명을 조합하지 않는다.
- 카드의 모든 행은 `h-full`과 최소 높이를 공유하고, metadata·progress 영역의 text/icon 대비를 확보한다. 포스터 이미지에 이미 제목이 포함된 행사 card는 하단 제목을 시각적으로 반복하지 않되, link의 accessible name은 유지한다.
- 카드가 1·2·3열 중 어느 breakpoint로 렌더링되어도 남는 빈 칸을 강제로 채우기 위해 비어 있는 placeholder card를 만들지 않는다. 마지막 행은 실제 카드 수에 맞춰 center 또는 자연스러운 grid 정렬을 사용한다.

### DR-49. GNB와 게시판 IA의 현재 위치를 계속 보여준다

- GNB는 `게시판`, `행사·참여`, `학생회 소개` 3개만 유지하며 현재 route에 `aria-current="page"`, text color, underline 또는 selected surface를 함께 적용한다. mobile navigation도 같은 active state를 사용한다.
- 게시판 public sub-tab에서는 `행사`와 `공약`을 제거하고, QnA 신규 진입은 Channel Talk으로 대체한다. 기존 route/data는 legacy 보존 정책에 따라 삭제하지 않는다.
- 게시판 toolbar와 table은 wide viewport에서 임의로 양 끝에 벌어지지 않도록 `max-width: 1200px` 내에서 정렬하며, 중간 폭에서는 sub-tab과 검색/필터가 충돌하지 않도록 세로 stack을 허용한다.

### DR-50. 이번 피드백에서 보류한 항목

- full calendar와 홈 calendar의 title bar·다일 일정 연속성은 DR-20/DR-45 및 최신 사용자 요구사항과 일치하므로 동일한 정보 단위를 사용한다. 전체 캘린더의 `+N` 정책은 유지하되, 홈은 DR-62에 따라 `+N`을 제거하고 tooltip/D-Day list로 보완한다.
- 상세 화면의 좋아요·스크랩은 이번 “목록에서 제거” 지시의 범위를 벗어나지 않으므로 유지했다.
- 소개·조직도 등 페이지의 decorative hero 제거는 DR-25에 따라 유지한다. 실제 소개 콘텐츠인 사진·슬로건을 삭제하는 것과는 구분한다.

## 13. 2026-08-21 추가 캡처의 비판적 검토

### DR-51. 외부 피드백은 근거로 사용하되, 디자인 철학보다 우선하지 않는다

- 다른 에이전트의 피드백과 첨부 캡처는 문제 후보를 찾기 위한 참고 자료다. 피드백 문장 자체를 구현 사실이나 최종 요구사항으로 간주하지 않는다.
- **기존 디자인 철학과 위배되는 내용은 수정을 보류해.** 충돌하는 제안은 바로 코드에 반영하지 않고, 충돌하는 기존 원칙·사용자 요구사항·대안·확인 필요 여부를 이 문서에 남긴다.
- 캡처에서 직접 확인한 사실, 현재 코드에서 확인한 상태, 캡처만으로는 판단할 수 없어 재현해야 하는 추정을 다음처럼 구분한다.
  - `확인`: 첨부 화면 또는 현재 코드에서 반복적으로 확인된 문제
  - `재현 필요`: 캡처가 이전 빌드이거나 viewport·권한·데이터 조건을 알 수 없어 현재 화면에서 재확인해야 하는 문제
  - `보류`: 일정명 bar·상세 action 유지·공개 IA처럼 이미 확정한 원칙과 충돌하는 제안
  - `수정 후보`: 기존 원칙과 충돌하지 않고 개선 효과가 분명한 항목
- 정적인 스크린샷에는 hover, `:focus-visible`, pressed/touch, loading, error, 권한별 상태, 모바일 breakpoint가 보이지 않는다. 보이지 않는 상태가 없다고 추정하지 말고 interaction QA에서 확인한다.

### DR-52. 게시글 상세는 읽기 흐름과 legacy IA를 분리한다

- 캡처의 상세 화면에는 목록용 게시판 sub-tab이 남아 있다. 상세 화면에서는 목록 탐색용 탭을 반복하지 않고, `← 공지사항으로 돌아가기` 또는 `게시판 > 공지사항` 수준의 슬림한 breadcrumb/back link만 제공한다.
- 현재 public sub-tab에서 숨긴 `공약`·`행사`·`QnA`가 legacy 직접 URL이나 기존 데이터에서는 계속 나타날 수 있다. breadcrumb가 `게시판 > 공약`을 가리킬 때 사용자가 갈 수 있는 public IA와 불일치하므로, 새 진입은 허용된 게시판으로 redirect하거나 `이전 분류`임을 명시한다. 기존 글과 직접 URL을 임의 삭제하지 않는다.
- 본문은 줄바꿈·번호 목록·불릿·강조·링크를 editor의 구조화된 rich text로 보존한다. `1. ... 2. ... 3. ...`가 하나의 긴 paragraph로 합쳐지면 viewer 문제가 아니라 저장/변환/렌더링 경로의 결함으로 우선 조사한다.
- 이전/다음 글이 모두 없을 때 빈 행을 큰 카드처럼 남기지 않는다. 해당 action을 숨기거나 한 줄의 비활성 안내로 축약하되, 목록으로 돌아가는 기본 경로는 유지한다.
- `목록으로` action은 카드 밖에 고립시키지 않는다. breadcrumb/back link와 중복하지 않는 한 곳에 두고, detail container의 max-width와 수평 정렬선을 따른다.
- 상세의 좋아요·스크랩은 DR-46에 따라 유지한다. 본문 위가 항상 잘못된 것은 아니므로 하단 이동을 자동 적용하지 않는다. 본문을 읽은 뒤 action을 원하는지, header-level affordance가 더 빠른지 실제 사용성 검증 또는 A/B 비교 후 결정한다.
- 댓글 empty state, 입력 placeholder, 등록 버튼, metadata는 로그인/권한 상태에 따라 명확히 달라야 한다. 입력할 수 없는 사용자를 활성 버튼처럼 보이게 하지 말고, `로그인 후 댓글 작성` 또는 disabled/설명 상태를 제공한다.
- 본문 읽기 폭은 목록 폭과 같게 늘리지 않는다. detail은 읽기 가능한 약 960–1040px, list는 약 1200px, calendar는 더 넓은 별도 token을 사용해 화면별 목적을 보존한다.

### DR-53. 게시판 목록은 public IA, 우선순위, pagination을 일관되게 보인다

- 캡처에서 public sub-tab에는 없는 `공약`·`행사` 말머리가 `전체` 목록 row에 보인다. 이는 현재 public IA와 데이터 분류의 불일치로 `수정 후보`다. 새 public 전체 목록에서 숨길지, legacy 분류 chip으로 표시할지는 콘텐츠 보존 정책을 확인한 뒤 결정한다. 숨기더라도 legacy detail URL과 관리자 데이터는 보존한다.
- 첨부 캡처에서 `총 11건 (1–10)` 아래 pagination이 보이지 않는 것은 화면 하단 crop 때문일 수 있다. 현재 코드에 Pagination이 존재하므로 “pagination 완전 누락”으로 확정하지 않는다. viewport 하단·페이지 끝·키보드 탐색에서 실제 노출, disabled 상태, page-size 변경 후 reset, URL query 보존을 검증한다.
- page-size, total range, 이전/다음, 현재 page는 DR-34의 하나의 pagination primitive를 사용한다. `총 11건 · 1–10`, `10건 보기`, `1 / 2`처럼 같은 숫자 의미를 중복 표기하지 않고, 테이블이 짧아도 pagination 위치가 갑자기 사라지지 않게 한다.
- sub-tab과 검색/필터가 한 줄에서 충돌하지 않도록 wide에서는 한 toolbar grid로 정렬하고, 중간 폭에서는 `탭 → 검색/필터` 순서로 stack한다. 390px 전후에서는 탭을 가로 scroll 또는 compact select로 바꾸되 잘린 탭을 클릭 불가능한 상태로 남기지 않는다.
- pin은 모든 중요 글에 붙이는 장식이 아니다. red pin, category chip, status chip의 의미를 분리하고, 실제 pinned 글만 제한적으로 표시한다. red는 위험/오류 의미와 충돌할 수 있으므로 brand-compatible priority token 또는 좌측 accent를 우선 검토한다.
- row 높이는 현재의 넓은 scanability를 유지하되, 제목·작성자·날짜·조회수 사이의 빈 공간을 고정 token으로 줄인다. wide viewport에서 양 끝으로 과도하게 벌리지 않고 list max-width 안에서 열 간격을 관리한다.
- 목록에서는 좋아요·스크랩을 다시 노출하지 않는다. 제목/row 전체 이동과 별도 버튼을 섞어 event bubbling을 재도입하지 않는다.

### DR-54. 홈은 빈 칸을 억지로 채우지 않고, 작은 캘린더의 정보 밀도를 관리한다

- 주요 행사 카드가 2개뿐일 때 3번째 placeholder를 만들어 그리드를 채우지 않는다. 실제 카드 수가 2개면 center/natural grid 정렬을 사용하며, carousel이면 빈 공간 없는 track과 현재 위치 indicator를 사용한다.
- 홈 캘린더는 사용자 요구사항과 DR-47에 따라 dot-only로 되돌리지 않는다. 일정명이 들어간 bar와 다일 일정의 연속성을 유지하되, 홈 surface에서는 lane 수·font size·truncate·`+N`을 제한해 날짜 숫자를 가리지 않는다.
- 캡처의 “선택한 날짜와 개수만 있고 일정 리스트가 없다”는 지적은 2026-08-21 직접 지시로 보류가 해제됐다. 홈은 선택일 요약을 되살리지 않고 calendar 아래 D-Day list를 제공한다. 모바일은 기존 반응형 문서 스크롤 원칙을 유지한다.
- hero와 우측 위젯의 하단선은 desktop과 좁은 desktop에서 함께 확인한다. 홈 hero를 제거하자는 제안은 DR-50의 “홈 hero 허용”과 충돌하므로, 정렬 문제만 수정하고 콘텐츠 hero 삭제는 보류한다.
- Channel Talk FAB는 달력 footer, event carousel, board widget action과 겹치지 않아야 한다. `padding-bottom`, fixed offset, safe-area, z-index를 page shell에서 통합하고, 모바일에서 pagination이나 마지막 bar를 가리지 않는지 확인한다.

### DR-55. 행사 card는 단일 surface와 안정적인 grid를 우선한다

- 캡처의 상단 poster-like 영역과 하단 본문 사이 seam 때문에 하나의 card가 두 블록처럼 읽힌다. outer surface, border, radius, hover elevation을 하나로 묶고, 실제 poster 이미지가 없으면 장식용 텍스트 포스터와 본문 제목을 중복하지 않는다.
- 상단 artwork 안의 제목과 하단 description이 실제로 같은 문자열인지 데이터로 확인한다. 캡처만으로 “완전 중복”을 확정하지 않고, 이미지에 제목이 포함된 경우 visual duplicate가 되지 않도록 accessible name만 유지한다.
- 캡처의 2행 card 하단 잘림은 이전 빌드·viewport crop·실제 grid height 버그를 구분해야 한다. 모든 card에 `h-full`, 공유 min-height, metadata 영역의 flex anchoring을 적용하고, 1·2·3열과 마지막 row에서 regression test한다.
- 상태 chip은 `시작 전`, `진행 중`, `마감`, `D-Day`/`D-N`처럼 짧게 유지한다. 현재 캡처의 긴 label 문제는 수정 후보지만, 이미 축약된 코드/최신 화면이라면 stale feedback으로 기록하고 중복 수정하지 않는다.
- 카드별 보라·파랑·청록 accent를 임의로 순환하지 않는다. source/status/category에 의미가 없는 무지개색은 줄이고, semantic token과 neutral surface를 중심으로 사용한다.
- 아이콘과 보조 metadata는 muted color만으로 구분하지 않는다. 본문과의 대비, disabled/interactive 여부, `aria-label`, focus-visible ring을 함께 검증한다.

### DR-56. 전체 캘린더는 일정명 bar를 유지하면서 공급원 의미와 밀도를 개선한다

- `dot + count`만 사용하자는 제안은 DR-20, DR-45, DR-47 및 최신 사용자 요구사항인 “홈과 전체 캘린더에 일정명 bar, 다일 일정은 하나의 bar로 연결”과 충돌한다. 따라서 전환을 보류한다.
- 밀도 문제는 bar를 제거하는 대신 lane 계산, 셀 높이/뷰 전환, title truncate, `+N` overflow, 선택일 상세 패널로 해결한다. 일정 제목을 숨겨야 할 때도 색만으로 정보를 전달하지 않고 tooltip 이외의 접근 가능한 상세 경로를 둔다.
- 캡처에서 `학위수여기준일`, `강의 종료`가 `행사`·`진행 중`·`00:00 시작`처럼 학생회 행사와 동일하게 보이는 것은 우선순위 높은 의미 오류다. `sourceType=KAIST_ACADEMIC`, `KAIST 학사일정` source badge, read-only 상태, all-day/기간 표기를 분리하고 학생회 행사 status chip을 재사용하지 않는다.
- 우측 상세 패널의 `자세히 보기`와 `보기`는 하나의 action label 규칙으로 통일한다. source별로 target이 다르면 label은 통일하고 icon/secondary text로 차이를 설명한다.
- 우측 상세 패널 내부 scrollbar는 무조건 제거하지 않는다. 일정 접근성을 잃지 않는 범위에서 고정 높이 + `+N개 더보기`/확장 action 또는 페이지 전체 scroll 중 하나로 정리한다. nested scrollbar를 남길 때는 focus, wheel, touch scroll이 어느 영역에 적용되는지 명확히 한다.
- 월/년 제목, 이전·다음·오늘, view switch, 검색은 하나의 calendar toolbar primitive로 정렬한다. 검색 위치를 옮기자는 제안은 사용 빈도와 반응형 공간을 확인한 뒤 결정하며, 기존 search 기능을 임의로 삭제하지 않는다.
- grid의 반복 rounded cell과 강한 border는 Google Calendar식 light divider, 선택일 surface, bar layer로 정돈할 수 있다. 다만 cell 구분과 keyboard focus가 사라질 정도로 flat하게 만들지 않는다.
- source legend 또는 `학생회 행사 / KAIST 학사일정` 설명을 제공해 색상·badge만 보고 사용자가 공급원을 추측하지 않게 한다.

### DR-57. 전역 QA는 정적 캡처 밖의 상태까지 포함한다

- 캡처에서 GNB active underline은 정상적으로 보이는 화면도 있으므로 기존 active-state 규칙을 유지한다. 페이지마다 헤더·sub-tab·breadcrumb가 중복 노출되지 않는지만 화면 유형별로 확인한다.
- breadcrumb, 댓글 empty state, event metadata, calendar secondary text의 대비를 실제 token 기준으로 측정한다. “연회색이면 모던하다”는 이유로 WCAG 대비를 낮추지 않는다.
- `max-width`는 페이지 목적별 token으로 관리한다. detail·board list·event grid·calendar에 하나의 전역 폭을 강제해 빈 공간 또는 읽기 폭 악화를 만들지 않는다.
- Channel Talk과 fixed action은 `z-index`만 올려 해결하지 않는다. 콘텐츠 하단 safe padding, fixed offset, mobile safe-area, keyboard focus 순서를 함께 테스트한다.
- 최소 QA matrix: 390px touch, 768px tablet, 1280px desktop, 1920px wide desktop; 로그인/비로그인; 관리자/일반 사용자; 일정 0·1·다수; 다일 일정; legacy category; pagination 1·2페이지; keyboard Tab/Enter/Escape; reduced motion.

## 14. 2026-08-21 추가 캡처 후속 구현

### DR-58. 확정 원칙과 충돌하지 않는 후속 수정은 구현한다

- 게시글 상세에서는 목록용 게시판 sub-tab을 렌더링하지 않는다. `breadcrumb/back link → article → comment → adjacent/list action` 순서로 읽기 흐름을 유지한다.
- rich text viewer는 plain text의 줄바꿈을 `<br>`로 보존하고, HTML 본문은 허용된 tag/style만 sanitize한 공통 `RichTextContent`를 사용한다. 번호 목록이 한 문단으로 합쳐지지 않아야 한다.
- 이전/다음 글이 모두 없으면 빈 navigation row를 만들지 않는다. 목록 action은 detail container의 navigation 영역 안에 정렬한다.
- public aggregate board feed에서는 행사·공약·QnA legacy board를 제외한다. 단, 기존 데이터와 `/board/:category/:articleId` 직접 URL은 삭제하지 않으며 legacy breadcrumb badge로 맥락을 표시한다.
- 캘린더에서 `KAIST_ACADEMIC`은 neutral source bar/badge, `읽기 전용`, `하루 종일` 또는 기간으로 표시한다. 학생회 행사 상태 chip과 `00:00 시작` 메타데이터를 재사용하지 않는다.
- 캘린더 상세 action label은 linkable article/survey에 `자세히 보기`로 통일한다. academic/manual처럼 public detail route가 없는 원본에는 가짜 `/survey` 링크를 만들지 않는다.
- 전체 캘린더의 title bar·다일 일정 연결은 유지하되, 한 날짜의 노출 lane을 제한하고 `+N`으로 overflow를 알린다. dot-only로 되돌리지 않는다.
- Channel Talk은 기존 custom launcher 규칙보다 2026-08-21 직접 지시가 우선한다. 현재는 SDK 기본 floating button/popup을 사용하고, launcher 전용 CSS와 `hidePopup`을 사용하지 않는다. 다만 콘텐츠 하단 padding과 데스크톱 우측 safe zone으로 footer·pagination·calendar detail과 겹치지 않게 한다.

## 15. 2026-08-21 사용자 직접 지시 고정 및 후속 결정

### DR-59. 활성 사용자 지시의 우선순위와 보류 규칙

- 이번 작업의 세부 기준은 [`ACTIVE_DESIGN_DIRECTIVES_2026-08-21.md`](./ACTIVE_DESIGN_DIRECTIVES_2026-08-21.md)에 고정한다. 컨텍스트가 압축되어도 해당 문서를 먼저 읽고 작업한다.
- 사용자 직접 지시와 이후 사용자의 명시적 정정이 최우선이다. 기존 디자인 규칙과 충돌하는 지시는 이번 문서의 `충돌 처리 메모`에 적은 범위에서만 갱신한다.
- 다른 에이전트의 피드백과 첨부 이미지는 문제 후보를 찾는 참고 자료다. 사용자 직접 지시나 확정 원칙과 충돌하는 내용은 구현하지 않고 `보류`로 남긴다.

### DR-60. 전역 토큰·리셋과 인터랙션 밀도

- 브라우저 기본 margin, box sizing, form font 상속, media display 차이는 공통 `reset.css`에서 제거한다. 색상·spacing·height·radius·border·focus ring·font weight는 `tokens.css`에서 관리한다.
- 기본 control height와 radius는 토큰을 공유해 input, select, button, filter가 나란히 놓일 때 높이와 곡률이 어긋나지 않게 한다.
- `:focus` 대신 `:focus-visible`을 사용한다. 이번 지시의 focus ring은 기존 값보다 약 30% 더 투명하게 유지하되 키보드 사용자가 알아볼 수 있는 대비는 보존한다.
- 일반 border와 pressed/selected background는 강한 색으로 채우지 않는다. hover는 fine pointer에서만 적용하고, active는 layout shift 없이 짧은 pressed feedback만 제공한다.

### DR-61. 홈 행사 carousel과 seed artwork (카드 비율은 DR-68로 대체)

- 홈 주요 행사는 실제 카드만 3열 track에 배치하는 좌우 carousel이다. 카드가 2개라고 빈 placeholder를 추가하지 않는다.
- 카드 artwork는 16:9를 기본으로 한다. 카드 전체 비율과 높이는 최신 복구 규칙인 `DR-68`을 따르며, artwork에 제목을 인쇄하지 않고 카드 본문에 제목·내용을 한 번씩만 표시하며 line clamp로 줄인다.
- seed artwork는 문서/포스터처럼 보이는 텍스트 중심 이미지가 아니라 단색 계열 gradient/pattern으로 만든다. artwork는 정보를 대체하지 않는 장식 layer다.

### DR-62. 홈 캘린더의 bar·tooltip·D-Day 규칙

- 홈 캘린더는 `+N`을 표시하지 않는다. 날짜 숫자를 가리는 텍스트 붕괴를 막기 위해 노출 lane을 제한하고, 각 일정 bar의 title은 bar 내부에서 truncate한다.
- 다일 일정의 bar는 중간 구간에 title을 배치하고, 날짜 셀의 좌우 경계를 넘지 않는다. bar의 hover tooltip에는 `8월 21일` 또는 `08.21` 형식의 날짜와 일정명을 compact하게 표시한다.
- 홈의 `선택한 날짜` 하단 행은 제거하고, calendar grid 아래 남는 영역에는 다가오는 주요 일정의 D-Day list를 배치한다.
- 월 이동 control은 border 없는 transparent button으로 표시하되, hover/focus-visible affordance와 hit area는 유지한다. 날짜 셀은 내용이 숨 막히지 않도록 가로보다 세로 여유가 큰 비율을 우선한다.

### DR-63. 날짜 표기 formatter

- 날짜만 표시할 때 현재 연도는 생략한다. 올해가 아닌 날짜만 연도를 추가한다.
- 한국어는 `8월 21일`, 숫자형 표기는 `08.21`을 사용한다. `8월21일`, `08. 21.`처럼 띄어쓰기와 구분점을 혼용하지 않는다.
- 화면별 formatter를 새로 만들지 않고 공통 date-display helper를 사용한다. ISO/UTC 값을 표시할 때는 서비스의 local date 규칙을 먼저 적용한다.

### DR-64. 홈 위젯·GNB·게시판 list hierarchy

- 홈 게시판 위젯은 8줄을 표시한다. `전체`에서만 muted category badge를 표시하고, 개별 category 탭에서는 생략한다. pinned row는 pin icon 대신 subtle surface와 horizontal divider로 구분한다.
- GNB profile trigger에는 이름 텍스트를 반복하지 않고 icon-only control을 둔다. dropdown 상단 card에 이름과 권한을 표시한다. nav 아래 quick service bar는 white card + subtle border + monochrome line icon + label을 사용하며 mega menu가 아니다.
- 게시판 list는 pinned notice 영역과 일반 row를 분리하고 pin icon을 제거한다. 작성일처럼 실제 정렬 기준인 한 컬럼만 기본 sort arrow를 진하게 표시하며, 다른 arrow는 숨기거나 hover에서만 보인다.
- 게시판 sub-tab은 GNB와 같은 green underline을 반복하지 않고 body background와 맞는 segmented/pill control을 사용한다. 제목은 가변폭, 작성자·작성일·조회수는 고정폭으로 배치한다.
- 게시판 목록에는 좋아요·스크랩을 다시 넣지 않는다. 그 action은 상세 화면에서만 제공한다.

### DR-65. 보류와 구현 완료 기록

- 기존 확정 원칙을 깨는 제안은 수정 완료로 기록하지 않는다. 특히 dot-only calendar, 목록 engagement 재노출, placeholder card 강제 채우기, 기본 Channel Talk을 custom launcher로 숨기는 정책은 이번 직접 지시가 바뀐 범위 외에는 보류한다. 홈 `+N` 제거·홈 선택일 행 제거·SDK 기본 Channel Talk 복귀는 이번 직접 지시로 확정된 예외다.
- 모바일 홈 전체 문서 스크롤은 3개 위젯을 동시에 제공하는 반응형 공간 제약 때문에 유지한다. 대신 위젯 내부 스크롤바는 제거하고 SDK 기본 채널톡 버튼용 우측 safe rail을 둔다. 데스크톱 홈의 no-scroll은 유지한다.
- 구현 후에는 이 문서와 활성 지시 문서에 실제 적용 범위, 의도적으로 남긴 보류 항목, typecheck/lint/build/browser/Docker 검증 결과를 기록한다. 이번 배치에서는 tokens/reset, SDK 기본 Channel Talk, seed gradient artwork, 홈 carousel/calendar/D-Day, 게시판 segmented toolbar/filter/pagination, footer/GNB safe-area를 적용했고 web/api lint·typecheck·build, shared package build, Docker 재기동, `/health=200`, 1280px desktop·390px mobile browser QA를 완료했다.

### DR-67. 2026-08-21 승인된 홈 타이포그래피·행사 카드 정정

- 사용자가 [`HOME_TYPOGRAPHY_PLAN_2026-08-21.md`](./HOME_TYPOGRAPHY_PLAN_2026-08-21.md)를 승인했다. 홈 hero, 행사 카드, 게시판 위젯, 캘린더 제목·메타는 `tokens.css`의 역할 토큰을 기준으로 구현한다.
- `font-black`·`font-extrabold`·과도한 색상은 의미가 있는 브랜드 hero 외에는 사용하지 않는다. 본문·메타는 한 단계 낮은 굵기와 무채색을 우선한다.
- 홈 전체에 `select-none`을 적용하지 않는다. 공지·일정·연락처는 복사할 수 있어야 하며, 캐러셀을 실제로 드래그하는 동안에만 viewport에 일시적으로 선택 방지를 적용한다.
- 홈 행사 카드의 “약 400px 상한”은 최신 비율 복구 요청으로 `DR-68`에 대체되었다. 이미지/패턴이 카드 전체를 채우고, 하단에는 약한 검은색 gradient overlay를 두며 제목·내용은 그 위에 한 번씩 표시하고 line clamp한다.
- 행사 카드 전체는 `/board/행사/:articleId` 상세 링크여야 한다. 캐러셀 drag 종료 시에만 클릭을 억제하고, 단순 pointer click은 라우팅을 막지 않는다. URL segment는 route-safe하게 encode한다.
- Tailwind arbitrary value를 전면 금지하지는 않는다. 반복되는 색·크기·굵기·높이·radius는 `tokens.css`와 의미 있는 CSS class로 승격하고, viewport 계산·동적 carousel 이동·calendar lane처럼 계산이 필요한 값만 예외로 남긴다.
- 첨부 이미지와 다른 에이전트의 피드백은 문제 후보와 시각 참고로만 취급한다. 최신 직접 지시·확정 원칙과 충돌하는 1:1 카드, quick service bar, 전체 `select-none` 같은 내용은 구현하지 않고 최신 규칙을 따른다.

### DR-66. 2026-08-21 홈 화면 최신 정정

- `DR-64`의 quick service bar 규칙은 최신 사용자 지시로 덮어쓴다. 홈과 공통 GNB에서 상단 바로가기 버튼 바를 렌더링하지 않는다. 프로필 이름·권한은 기존처럼 profile dropdown 상단 card에 둔다.
- 행사 섹션은 visible heading과 `더보기` text link 없이 카드 track만 제공한다. 실제 카드 수가 2개면 2열로 자연스럽게 넓히고, 3개 이상이면 3열 carousel을 사용한다. placeholder로 빈 칸을 채우지 않는다.
- 홈의 lower row는 board 4 : calendar 6이다. board widget은 content-fit, calendar는 row의 남은 높이를 사용한다.
- 행사 card의 비율과 track 폭 확대 규칙은 최신 비율 복구 요청으로 `DR-68`에 대체한다. 카드의 artwork·overlay·line clamp 정보 구조는 유지한다.
- 홈 calendar month title은 연도 없이 표시한다. 오늘 날짜는 검은색 compact rectangle + 흰색 숫자이며 원형 highlight와 강한 셀 border를 사용하지 않는다. bar는 셀 사이를 1px 연결하고 낮은 높이·한 줄 ellipsis를 사용한다.
- 다일 bar의 제목은 현재 보이는 범위의 가운데 segment에 표시한다. title 앞에는 `•`를 붙이고, tooltip은 원문을 줄이지 않는다. tooltip header 오른쪽에는 일정 수를 두고 header/body 사이에 얇은 divider를 둔다.
- 홈 “다가오는 일정”은 오늘 이후 시작하는 일정만 보여주며 `진행 중` 대신 `D-0` 이상을 사용한다. 달력 아래의 선택 날짜 요약 row는 두지 않는다.
- 날짜 formatter는 여전히 `8월 21일` / `08.21` 규칙을 사용하고, 올해가 아닌 경우에만 연도를 추가한다.
- 전역 홈 타이포그래피 일괄 통합은 [`docs/HOME_TYPOGRAPHY_PLAN_2026-08-21.md`](./HOME_TYPOGRAPHY_PLAN_2026-08-21.md)의 사용자 승인 대기 계획이다. 캘린더·bar·tooltip처럼 이번 요청에서 직접 지정한 국소 크기 변경은 예외적으로 적용할 수 있지만, 전체 제목/본문/메타 토큰 교체는 승인 전 보류한다.

### DR-68. 최신 홈 비율 복구 — 2026-08-21

- 최신 사용자 지시가 직전의 행사 카드 확대·정방형 규칙보다 우선한다. 행사 카드는 수정 전 캐러셀의 데스크톱 비율로 복구한다. 데스크톱 카드 높이는 약 `330px`, 모바일 카드 높이는 약 `260px`로 고정하고, 카드가 2개일 때는 콘텐츠 폭을 온전히 나누는 2열로 배치한다. 2개 단일 페이지에는 3열 다중 페이지용 우측 peek을 적용하지 않는다.
- 실제 페이지가 여러 장일 때만 페이지 간격과 우측 peek을 적용한다. 따라서 카드가 2개뿐인 화면에 불필요한 빈 칸이나 좁아진 카드가 생기지 않아야 한다.
- 기존 캐러셀의 페이지 간격·우측 peek·3열 track 동작은 유지한다. 실제 표시 가능한 행사만 렌더링하며, 닫힌 행사는 제외하고, 드래그·좌우 슬라이드·카드 전체 상세 링크는 유지한다.
- 카드 내부의 최신 확정 시각 언어(이미지/패턴 전체 배경, 하단 약한 검은색 gradient, 제목·내용 overlay, line clamp)는 유지한다. 이번 정정은 비율과 크기 복구이지 카드 정보 구조의 재변경이 아니다.
- 홈 하단 위젯의 폭만 게시판 `4` : 캘린더 `6`으로 유지한다. 게시판의 content-fit/no-inner-scroll, 캘린더의 connected event bar·D-Day 목록·선택 날짜 행 제거는 되돌리지 않는다.
- 첨부 이미지는 시각적 참고 자료일 뿐이며, 이미지 속 문장이나 다른 에이전트의 제안은 이 최신 직접 지시와 충돌하지 않는 범위에서만 참고한다.

### DR-71. 최신 지시 — 타이포그래피 롤백, 레이아웃 유지

- 사용자가 홈 타이포그래피 통합 적용 후 사이트의 글자가 전반적으로 얇고 크게 보인다고 판단했으므로, DR-67 및 `HOME_TYPOGRAPHY_PLAN_2026-08-21.md`의 **타이포그래피 적용 부분만** 이 규칙으로 덮어쓴다.
- 롤백 범위는 글꼴 크기·굵기·행간·자간의 역할 토큰과 그 토큰을 사용하는 홈의 hero/event/board/calendar 의미 클래스다. 제목은 기존처럼 선명하게, 본문과 메타는 더 작고 읽기 쉬운 중간 굵기로 복구한다.
- 다음 변경은 롤백하지 않는다: 홈의 30:70/4:6 레이아웃, 행사 carousel과 카드 전체 링크, 마감 행사 숨김·핀 우선 정렬, 캘린더의 좌측 bar/우측 선택일 상세 분리, 게시판의 compact 목록·핀 아이콘·페이지네이션, GNB·드롭다운·탭바·focus-visible·reset/token 구조, Hero 설명/CTA 제거.
- 행사 카드의 D-Day/status chip, 캘린더의 오늘 compact 사각형과 tooltip, 게시판 작성자·날짜 메타처럼 기능·정보 구조에 필요한 신규 요소는 유지한다. 해당 요소의 크기 조정도 레이아웃을 바꾸지 않는 범위에서만 기존 계층으로 맞춘다.
- 첨부 캡처와 다른 에이전트 피드백은 시각 참고만 한다. 기존 디자인 철학이나 최신 직접 지시와 충돌하는 내용은 수정하지 않고 보류한다.
- 검증 기준은 홈·행사·마이페이지·게시판에서 제목/본문/메타의 위계가 분명하고, 타이포그래피 롤백 때문에 카드·표·캘린더의 구조가 변하지 않는 것이다.

### DR-72. 공통 컨트롤 서식과 reset cascade — 2026-08-21

- `reset.css`는 반드시 Tailwind의 `base` layer 안에서, Tailwind preflight 이후에 적용한다. unlayered reset으로 두어 `text-*`, `font-*`, `leading-*` 유틸리티를 무력화하지 않는다.
- 공통 control의 최소 서식은 `tokens.css`의 `--ui-control-font-size`, `--ui-control-font-weight`, `--ui-control-line-height`로 정의한다. 화면별 raw control이 생겨도 브라우저 기본 16px/400으로 튀지 않게 하되, `Button`, `UiInput`, `UiTextarea`, `UiSelect`, `SelectDropdown`, `Pagination`이 문맥별 서식을 명시한다.
- number input의 브라우저 spinner는 제거한다. 검색 input은 앱의 clear `×` 버튼 하나만 사용하도록 브라우저 기본 cancel decoration을 제거한다.
- 같은 한 줄의 control은 공통 높이·radius·line-height를 공유한다. icon-only control은 고정 hit area 안에서 icon을 중앙 정렬하고, icon과 text는 `inline-flex items-center` 및 일관된 gap으로 맞춘다.
- 공통 컴포넌트를 우선 수정하고, 화면별 class 조합을 새로 복제하지 않는다. 사용처가 확인되지 않은 legacy selector/component만 근거를 확인한 뒤 삭제하며, 사용 중인 legacy class는 임의로 제거하지 않는다.
- 텍스트 위계는 `font-size`만 키우지 않고 weight·line-height·대비를 함께 조정한다. 버튼/탭/필터는 명시된 12~13px control scale을 사용하고, 강조 의미가 없는 곳에는 `font-extrabold`/강한 색을 사용하지 않는다.

### DR-69. 홈 행사·캘린더·위젯 높이 최신 정정 — 2026-08-21

- 홈 행사 track은 2열 거대 카드가 아니라 데스크톱 3열 carousel로 표시한다. 실제 카드가 5개 이상 존재하면 3개씩 페이지를 구성하고, 마감된 행사는 기존 규칙대로 제외한다. demo seed에는 9개 행사를 두어 현재 시점에도 최소 5개 이상이 활성 상태로 남도록 한다.
- 각 행사 카드에는 카드 본문 상단에 짧은 `D-n` 또는 `D-0` 칩과 `시작 전`·`진행 중` 상태 칩을 함께 표시한다. 칩은 카드 이미지 위에서 읽히는 낮은 밀도의 상태 표시이며, 제목·설명보다 시각적 우선순위가 높아서는 안 된다.
- 캘린더 날짜 셀 안의 일정 bar에는 일정명을 렌더링하지 않는다. bar는 4~6px 두께의 순수 컬러 띠로 날짜 칸 사이를 연결하고, 일정명은 hover/focus tooltip과 접근성 label에서만 제공한다.
- 홈 하단 게시판과 캘린더 위젯은 데스크톱에서 같은 높이와 하단 기준선을 사용한다. 게시판의 8행 콘텐츠와 캘린더의 grid·다가오는 일정이 한 row 안에서 서로 다른 높이로 붕괴하지 않게 한다.
- Hero의 설명 문구(“학생들의 목소리…” 계열)와 `집행위원회 소개 보기` CTA는 제거한다. Hero 이미지, 브랜드 lockup, 핵심 제목은 유지한다.
- 첨부 캡처는 bar 밀도와 정보 배치의 시각 참고로만 사용하며, 이미지 안의 터미널 문법이나 문구를 UI 텍스트로 이식하지 않는다.

### DR-70. 2026-08-21 선택 날짜 상세·게시판·행사 카드 후속 정정

- DR-62와 DR-69의 홈 캘린더 하단 “다가오는 일정” 규칙은 이 직접 지시로 대체한다. 홈 캘린더는 좌측에 일정명이 없는 4~6px 컬러 bar만 있는 월간 grid를 두고, 우측에 클릭한 날짜의 일정 목록과 일정 수를 표시한다. 선택 날짜 목록에는 일정명, 일정 출처, 날짜 범위를 제공하며 별도 upcoming/D-Day 영역은 두지 않는다.
- 날짜 숫자는 모든 셀에서 고정 높이 슬롯을 사용한다. 오늘의 검은색 세로형 compact rectangle은 일반 날짜와 같은 슬롯 안에 배치해 bar의 시작 위치를 아래로 밀지 않는다.
- 행사 카드의 `고정` 텍스트는 표시하지 않는다. 카드 전체는 실제 행사 상세 링크이며, 드래그와 단순 클릭은 서로 다른 동작으로 처리한다. 8px 미만의 pointer 이동은 click으로 남기고, 수평 drag가 임계값을 넘은 경우에만 페이지를 전환하고 click을 억제한다. 수직 touch 이동은 문서 스크롤을 방해하지 않는다.
- 행사 카드 비율은 고정 px 높이 대신 `tokens.css`의 `--home-event-card-ratio: 3 / 4`를 사용한다. 따라서 카드 section의 높이는 콘텐츠 폭에 비례해 해상도별로 같은 비율로 커지며, 카드 전체 artwork·overlay·line clamp 구조는 유지한다.
- 홈 게시판 위젯은 사용 가능한 응답 데이터 범위에서 가능한 많은 글을 렌더링하되 내부 scrollbar는 만들지 않는다. 고정 글은 앞쪽에서 최대 3개까지만 노출하고, 나머지는 최신순 일반 글로 채운다. 각 행의 우측 메타는 `작성자 · 날짜` 순서로 표시한다.
- 게시판 목록에는 `게시글 목록` 제목 strip과 `고정 공지` 전용 영역을 두지 않는다. 고정 행도 일반 목록 안에서 렌더링하고 제목 앞에 작은 Lucide Pin line icon만 둔다. 목록 날짜는 `MM.DD`와 tabular numerals를 사용하며, 조회수 헤더는 우측 정렬한다.
- 게시판 페이지네이션은 select/count를 왼쪽에, 이전 버튼·현재 페이지 input·`/`·총 페이지·다음 버튼을 오른쪽에 둔다. 글쓰기 버튼은 권한이 있을 때만 검색/필터 toolbar에서 필터 바로 오른쪽에 표시한다.
- 다른 에이전트의 첨부 이미지와 피드백은 시각 참고만 한다. 이 최신 직접 지시 또는 그 이전에 확정된 디자인 철학과 충돌하는 제안은 수정하지 않고 보류한다.

## DR-73. 2026-08-22 독립 뷰 라우팅·공통 필터·캘린더 정리

- `행사`, `설문·투표`, `일정`은 데이터 분류 탭이 아니라 서로 다른 view template이다. 각 화면은 `/events`, `/surveys`, `/calendar` 독립 2뎁스 경로를 사용하며, 화면 내부에서 이 세 경로를 전환하는 탭바를 다시 만들지 않는다. 레거시 `/events-surveys?tab=...` 링크는 해당 독립 경로로 redirect만 한다.
- GNB의 `행사·참여`는 hover와 keyboard focus에서만 2뎁스 메뉴를 펼친다. 데스크톱에서는 parent link와 submenu를 함께 제공하고, 모바일에서는 동일한 하위 링크를 펼쳐진 목록으로 제공한다. 이것은 mega menu가 아니라 짧은 3개 항목의 contextual submenu다.
- 상태 필터는 이미지 참고처럼 밝은 neutral surface 안의 segmented control로 만든다. 활성 항목은 흰색 surface와 얇은 border/shadow로만 표시하고, 짙은 초록색 채움·과도한 pill·상태별 무지개색을 사용하지 않는다.
- 필터를 숨기는 `필터` 버튼은 사용하지 않는다. 기간·상태·정렬은 상단 toolbar에 inline으로 노출하고, 반복되는 control은 `SegmentedControl`, `SelectDropdown`, `PageSearchField` 같은 공통 컴포넌트로 묶는다. 검색어가 있으면 앱 제공 clear `×`를 표시하고 reset은 작은 텍스트 action으로 둔다.
- `SelectDropdown` 메뉴는 table/card의 `overflow-hidden` 경계에 종속되지 않도록 document body portal로 렌더링하고, trigger 아래 공간이 부족하면 위로 flip한다. 메뉴가 화면 하단에서 잘리거나 table footer 밖으로 사라지지 않아야 한다.
- 이전/다음 같은 icon-only navigation control은 `IconButton`의 borderless navigation tone을 사용한다. 기본은 투명 surface, hover는 배경색만 바꾸며, 장식성 border·shadow를 추가하지 않는다. disabled 상태도 layout shift가 없어야 한다.
- 게시판 table header는 낮은 고정 높이와 `items-center` 수직 정렬을 사용한다. 실제 정렬 기준인 active column만 기본 arrow를 표시하고, 기타 arrow는 숨기거나 상호작용 시에만 노출한다. 게시판 페이지 크기 메뉴는 공통 portal dropdown을 사용한다.
- 캘린더 공개 화면에서는 오늘 버튼, `+N`, 날짜 셀의 장식성 border, `일정 상세조회` 제목, `시작`/`하루 종일` 같은 불필요한 보조 문구를 제거한다. 학사 일정은 `종일` 또는 기간으로 표시하고, 선택한 날짜의 일정 목록은 우측 상세 패널에 둔다. 이전/다음 월은 공통 borderless icon control을 사용한다.
- 마이페이지는 `개요` 메뉴와 overview view를 제공하지 않는다. 진입 기본 화면은 `내 정보`이며 활동 내역·스크랩은 별도 메뉴로 유지한다.
- 관리자 sidebar 기본 순서는 `사이트 콘텐츠 → 유저 관리 → 권한 관리 → 과비 납부 관리 → 설문조사 관리 → 이메일 일괄발송 → 연락망 → 로그`다. 기존 게시판 관리 기능은 삭제하지 않고 운영 핵심 메뉴 뒤에 둔다.
- 설문 관리 화면에서는 유형을 색으로 코딩하지 않는다. 설명문은 목록에서 생략하고, 버전은 제목 오른쪽의 muted metadata로 둔다. 더보기에는 `보관하기`와 `삭제하기`를 별도 action으로 함께 제공하며, 응답/파생 버전 때문에 삭제가 제한되는 경우 서버 정책과 오류를 그대로 안내한다. 응답 수와 결과 화면은 표 중심의 통계 진입점으로 유지한다.
- 기존 디자인 철학과 충돌하는 제안은 자동으로 구현하지 않는다. 특히 독립 route를 다시 탭으로 합치는 안, 목록에 engagement action을 재노출하는 안, 날짜 셀을 장식성 border로 채우는 안은 사용자 확인 전 보류한다. 첨부 이미지와 다른 에이전트의 피드백은 문제 후보·시각 참고로만 취급한다.

## DR-74. 홈 행사 카드 높이 보정 — 2026-08-22

- 홈 행사 카드의 데스크톱 높이는 `tokens.css`의 `--home-event-card-height: 25rem`(약 400px)으로 고정한다. 카드 폭에 `4 / 3` 비율을 적용해 화면이 넓어질수록 카드가 과도하게 세로로 늘어나는 방식은 사용하지 않는다.
- 모바일 행사 카드 높이는 `--home-event-card-height-mobile: 17.5rem`으로 별도 지정한다. 이미지·오버레이·상태 칩·제목·설명·전체 링크·carousel drag 동작은 유지하고 높이만 보정한다.
- 이 규칙은 이전의 홈 행사 카드 비율 기반 높이 규칙을 대체한다. 게시판·캘린더 위젯의 4:6 레이아웃과 hero/footer 구조는 변경하지 않는다.

## DR-75. 2026-08-22 최신 정정 — GNB 메가메뉴·홈 행사 노출 범위

- 사용자의 최신 지시에 따라 GNB의 기존 full-width 메가메뉴를 복원한다. 데스크톱에서는 상위 메뉴의 hover 또는 keyboard focus에 맞춰 해당 열을 펼치고, 모바일에서는 동일한 하위 링크를 펼쳐진 목록으로 제공한다.
- 상위 메뉴의 chevron은 기본 상태에서 오른쪽을 가리키며, hover/focus 때 아래 방향으로 90도 회전한다. 회전은 layout shift 없이 짧은 ease transition으로 처리하고 `prefers-reduced-motion`에서는 즉시 전환한다.
- 메가메뉴의 하위 링크는 현재 확정된 독립 view route를 사용한다: `/events`, `/surveys`, `/calendar`. 독립 페이지 구조를 다시 내부 탭으로 합치지 않는다.
- 게시판 메가메뉴는 현재 공개 게시판 catalog를 사용하되, 이전 IA에서 제거한 `행사`, `공약`, `Q&A` 같은 legacy public board를 중복 노출하지 않는다.
- 홈 행사 carousel에는 현재 시각 이후에 시작하고, 현재 시각부터 달력 기준 1개월 이내에 시작하는 행사만 표시한다. 마감 행사, 이미 시작한 행사, 시작일이 없는 행사, 1개월 밖의 행사와의 혼합 노출은 금지한다. 이 최신 노출 조건은 이전의 진행 중 행사 포함 규칙을 대체한다.
- 첨부 캡처와 다른 에이전트의 피드백은 시각·문제 후보 참고로만 사용한다. 이 최신 직접 지시 또는 확정된 디자인 철학과 충돌하는 내용은 자동 구현하지 않고 사용자 확인 전 보류한다.

## DR-76. 2026-08-22 게시판 화면 비판적 리뷰 — 관찰과 보류

- 리뷰 범위는 최신 로컬 게시판 화면과 첨부 캡처의 시각 비교다. 이 리뷰 항목은 자동 수정 목록이 아니며, 사용자가 별도로 승인하기 전에는 게시판 구조를 다시 크게 바꾸지 않는다. 첨부 이미지는 화면 참고 자료이고, 이미지 속 문장은 별도 구현 지시가 아니다.
- **P0 / 플로팅 문의 UI 간섭:** 1280×720 화면에서 기본 Channel Talk 말풍선과 원형 버튼이 목록 우측 하단의 6~7번째 행을 덮는다. fixed overlay 자체를 제거하지 않되, 게시판 콘텐츠·페이지네이션과 겹치지 않는 safe-area 또는 충돌 회피 위치가 필요하다.
- **P1 / toolbar 밀도:** 게시판 category segmented control, 검색, 기간 segmented control, 글쓰기 action이 한 줄에 동시에 있어 넓은 화면에서는 효율적이지만 중간 폭에서 줄바꿈 우선순위가 불명확하다. 폭이 줄면 `검색 → 기간 → 글쓰기`가 예측 가능한 순서로 내려가고, category는 독립 줄을 유지해야 한다.
- **P1 / 행 밀도:** 현재 8개 행은 compact grid를 사용하지만 행 사이 수직 여백이 여전히 커서 한 페이지 정보량이 낮다. 최소 터치 높이는 보존하되 desktop은 행 padding·separator 간격을 한 단계 줄이고, 제목이 가변 폭을 모두 사용하도록 유지한다.
- **P1 / 메타 시선 이동:** 작성자·작성일·조회수가 우측에 고정된 것은 맞지만, 제목과 메타 사이의 빈 폭이 넓어 한 행을 읽을 때 시선이 길게 이동한다. 1200px max-width와 고정 메타 폭은 유지하면서 작성자 폭을 과도하게 늘리지 않는다.
- **P2 / 정렬 affordance:** 현재 기본 정렬 기준인 `작성일 ↓`만 강조하는 방향은 적절하다. 나머지 컬럼에 상시 화살표를 추가하지 말고, 정렬 가능한 경우에만 hover/focus와 `aria-sort`로 상태를 알린다.
- **P2 / 상태 대비:** 비활성 category·기간 control과 table header는 연한 색을 쓰더라도 본문 메타보다 한 단계 또렷해야 한다. 굵기와 대비를 동시에 과도하게 올리지 말고, active는 밝은 surface·얇은 border 중심으로 유지한다.
- **P2 / one-page 빈 공간:** 게시글이 1페이지에 끝날 때 하단 빈 공간을 억지로 행으로 채우지 않는다. count·페이지네이션은 유지하되, empty state와 footer가 플로팅 UI에 가리지 않는지만 검증한다.
- **접근성:** 전체 행 링크, category link, 검색 input, 기간 control, pagination input은 `:focus-visible` 상태를 제공하고, pin·첨부 같은 아이콘은 텍스트/label로 의미를 보완한다. 모바일 responsive variant가 동일 메타를 중복 노출한다면 숨김 variant가 보조기술에 중복 읽히지 않는지도 확인한다.
- 기존 확정 원칙인 목록 engagement action 제거, 게시판의 compact metadata, pin line icon, 공통 portal pagination, neutral segmented control은 유지한다. 카드식 목록 전환이나 강한 색상·고정 공지 영역 재도입은 이 리뷰만으로 승인하지 않는다.

## DR-77. 2026-08-22 작성·수정 에디터 확정 규칙

- 글 작성/수정 화면의 에디터 폭은 페이지 본문 컨테이너와 동일하게 맞춘다. 별도의 좁은 `max-width`를 에디터에 다시 주지 않는다.
- `국문 / 영문` 탭버튼은 사용하지 않는다. 국문 에디터와 영문 에디터를 세로로 함께 보여주고 중간에 얇은 구분선을 둔다. `한국어 콘텐츠만`이 체크되면 영문 에디터와 구분선을 모두 제거한다.
- 게시판 설정 제목/아이콘은 표시하지 않는다. 비밀글 체크박스는 게시판 설정에서 비밀글을 허용한 경우에만 노출하고, 서버 payload도 같은 조건으로 강제한다.
- 취소 버튼은 하단 액션의 왼쪽에 두고 `ArrowLeft` 아이콘과 취소 텍스트를 함께 표시한다. 임시저장·등록/수정 액션은 오른쪽에 둔다.
- 에디터의 글자 크기는 브라우저 native select가 아니라 공통 custom `SelectDropdown`으로 선택한다. 선택지는 `8, 9, 10, 11, 12, 14, 16, 18, 20, 22, 24, 28, 30, 36, 50, 72, 96`px이며 기본값은 별도 `기본` 항목이다. native select의 기본 화살표는 노출하지 않는다.
- 글자색과 배경색은 각각 공통 toolbar popover로 제공한다. 클릭 시 8색 팔레트, HEX 입력, 적용 및 기본값 복원 action을 보여준다. 팔레트는 시맨틱 역할을 벗어난 무지개색 장식으로 사용하지 않고 편집 기능 안에서만 제공한다.
- 자주 사용하지 않는 Tiptap 명령(제목 1~3, 취소선, 인용, 코드 블록, 링크 해제 등)은 세로 점 3개 `더보기` 메뉴 아래에 모은다. 굵게·기울임·밑줄과 색상/배경색처럼 빈도가 높은 기능은 toolbar에 남긴다.
- 본문 캔버스와 제목 input에는 별도의 hover 장식이나 focus 스타일을 넣지 않는다. toolbar 버튼·dropdown·palette 같은 조작 control은 공통 `Button`/`SelectDropdown`의 `:focus-visible`, hover, active 규칙을 사용한다. 에디터 내부 링크에도 페이지 전용 hover CSS를 덧붙이지 않는다.
- reset cascade 때문에 브라우저 기본 `16px/400`이 튀지 않도록 모든 toolbar control의 크기·굵기·행간·높이·곡률을 명시한다. 동일 라인의 icon/text는 중앙 정렬하고, 페이지별 raw select/button을 새로 만들지 않는다.
- 사용자 제공 참고 페이지(https://v26.jshsus.kr/boards/free/new)는 버튼/드롭다운의 동작과 밀도 참고로만 사용한다. 기존 확정 디자인 철학과 충돌하는 내용은 자동 반영하지 않고 사용자 확인 전 보류한다.
- React/Tiptap 에디터는 중복 extension을 등록하지 않으며, unmount된 editor의 HTML을 읽지 않는다. `isDestroyed`/schema guard와 안전한 HTML 동기화를 유지해 화면 전체가 오류로 무너지지 않게 한다.

## DR-78. 2026-08-22 게시글 상세 액션·댓글 규칙

- 게시글 상세 헤더의 수정/삭제는 작성자 본인에게만 노출한다. 텍스트 버튼이 아니라 우측 하단의 icon-only control로 배치하고, `aria-label`과 `title`을 제공한다. 삭제 API의 기존 운영진 권한은 유지하되, 일반 상세 화면에서는 작성자 외 사용자에게 액션을 렌더링하지 않는다.
- 게시글 좋아요·스크랩·공유는 본문 헤더에서 제거하고 화면 하단의 compact floating dock에 `좋아요 → 스크랩 → 공유` 순서로 배치한다. dock는 본문을 가리지 않도록 하단 safe padding을 확보하며, 공유는 Web Share API를 우선 사용하고 불가능하면 현재 URL을 클립보드에 복사한다.
- 상세 헤더의 기존 가로 구분선은 제거한다. 정보 위계는 선보다 여백, medium 메타 폰트와 muted gray 색상으로 구분한다. 게시글 날짜는 `YYYY.MM.DD HH:mm` 형식으로 통일한다.
- 댓글 제목은 18px로 표시하고 댓글 수만 브랜드 초록색으로 강조한다. 댓글 본문은 14px/500, 작성자명은 본문보다 한 단계 높은 weight, 작성일 등 메타데이터는 연한 회색으로 둔다.
- 댓글 행 우측 상단에는 좋아요와 신고 action을 둔다. 좋아요는 사용자별 중복 방지 API와 optimistic update를 사용하며, 신고는 로그인 사용자만 실행하고 확인 단계를 거쳐 사용자별 중복 신고를 막는다. 신고 결과는 `신고됨` 상태로 남긴다.
- 댓글 등록 control은 텍스트 `등록` 버튼을 사용하지 않는다. input 오른쪽 끝에 원형 위쪽 화살표 버튼을 두고, 입력값이 비어 있으면 neutral fill, 내용이 있으면 브랜드 초록색 fill을 적용한다. Enter는 등록, Shift+Enter는 줄바꿈이다.
- 이전글/다음글 navigation card는 상세 화면에서 제거한다. `목록으로`는 카드 밖의 슬림한 back-link로 제공한다.
- 다른 에이전트의 피드백과 첨부 캡처는 참고만 한다. 위 확정 원칙과 충돌하는 구조 변경은 자동 반영하지 않고 사용자 확인 전 보류한다.

## DR-79. 2026-08-22 최신 후속 — 홈 경계·로딩·공통 상태

이번 지시는 최신 사용자 직접 지시다. 첨부 캡처와 다른 에이전트의 피드백은 문제 후보로만 사용하며, 아래 규칙과 충돌하면 구현하지 않고 보류한다.

- 홈 hero의 실제 폭을 `--ui-home-hero-width` 하나로 공유한다. 홈 header의 brand rail, 상위 GNB 시작점, full-width mega menu의 left/width 기준이 서로 다른 고정값을 사용하면 안 된다. white nav/mega menu는 hero 오른쪽 경계에서 시작해 hero 이미지를 덮지 않아야 한다. 내부 페이지의 고정 brand rail은 별도 규칙으로 유지한다.
- 페이지 제목은 공통 `PageHeader`/`AdminPageTitle`에서 30px(기존 24px보다 6px 확대)와 `mb-6` 간격을 사용한다. 페이지별 h1의 임의 크기와 설명성 문구를 다시 추가하지 않는다.
- 홈 캘린더는 게시판보다 상세 패널을 넓게 배분하고, 오른쪽 선택일 상세는 고정된 최소 폭과 overflow-safe list를 갖는다. 월 이동은 공통 borderless `IconButton`을 사용한다. 홈 행사 이전/다음 버튼은 hover 전에도 낮은 불투명도의 흰색 surface를 보여주며, hover에서만 조금 선명해진다.
- 홈 게시판의 작성자·구분점·날짜 메타는 고정 grid column을 사용한다. 언어를 KO/EN으로 바꾸어도 중간점의 좌우 여백과 날짜 column이 이동하지 않아야 한다.
- 최초 데이터 진입에는 회색 skeleton을 사용한다. 이미 표시된 게시글 목록을 category/language 변경 중 지우거나 spinner 텍스트로 대체하지 않는다. 새 응답이 도착할 때까지 이전 목록을 유지하고 `opacity`만 낮추며 150ms `transition-opacity`를 적용한다. 게시판 본문과 홈 게시판 widget 모두 같은 규칙을 사용한다.
- “불러오는 중입니다” 같은 전체 목록 overlay 문구는 사용하지 않는다. route fallback도 텍스트가 아닌 skeleton surface를 사용한다. 오류·권한·빈 상태 문구는 loading 문구와 분리한다.
- 버튼 pressed feedback은 `active:scale-[0.98] active:duration-75 active:transition-transform`을 기준으로 한다. color/background/border transition과 transform transition을 섞어 layout이 흔들리게 하지 않는다.
- 게시판 table header는 14px/500 slate text, 수직 중앙 정렬, 상단 2px brand rule, 약간 늘린 고정 높이를 사용한다. 실제 정렬 기준 column만 12px Lucide `ArrowDown`을 기본 표시하고, 나머지는 active/hover에서만 표시하거나 숨긴다. 작성일·조회수는 우측 정렬한다. 행 본문은 제목 15px, 작성자·작성일·조회수 14px/400, 날짜는 tabular `MM.DD`다.
- 게시판 toolbar는 공통 control 높이를 유지하되 과도한 세로 padding을 줄인다. count는 `전체 n건` 14px, `rgb(102,102,102)`, `letter-spacing:-1px`로 표시하고 작성 CTA label은 `작성`으로 통일한다. 페이지 폭은 `--ui-page-max-width`를 통해 board/events가 같은 넓은 컨테이너를 공유한다.
- EmptyState는 중앙의 얇은 문서 아이콘과 “등록된 게시글이 없습니다.” 문구를 공통 컴포넌트로 제공한다. 개별 화면에서 굵은 빈 상태 문장을 복제하지 않는다.
- profile dropdown에서는 관리자만 이름 왼쪽에 낮은 대비의 role badge를 표시하고 일반 사용자는 badge 없이 이름만 표시한다.
- 세션은 access 30분, persisted refresh 30일 정책을 사용하고 refresh rotation 때 만료 시각을 sliding 갱신한다. 클라이언트는 활성 route 변경·visible 복귀·10분 주기에서만 refresh를 시도하며, 백그라운드 탭에서 계속 요청하지 않는다.

검증 체크: Docker 재빌드 후 1280px 홈 화면에서 hero 오른쪽 경계와 white GNB/mega menu의 left가 일치하는지 스크린샷으로 확인하고, 게시판/홈의 첫 진입 skeleton 및 category 전환 opacity 유지, lint·typecheck·build를 함께 확인한다.

## DR-80. 2026-08-23 최신 정정 — 설문 문항 자연스러운 순서 이동

- 설문 편집기의 문항 순서 이동은 브라우저 기본 HTML5 `draggable`을 사용하지 않고 `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`를 사용한다. 기본 drag ghost가 흐릿한 복제 이미지로 표시되는 문제를 피한다.
- 문항 카드의 실제 목록은 `SortableContext`/`verticalListSortingStrategy`로 관리한다. 포인터가 다른 문항 위로 이동하면 기존 카드들이 `transform`과 약 200ms ease transition으로 부드럽게 비켜서야 한다.
- 드래그 중인 문항은 `DragOverlay`로 `document.body` 최상단 레이어에 표시한다. overlay는 원본 카드와 같은 폭을 유지하고 `shadow-2xl`, `rotate-2`, `cursor-grabbing`으로 손끝에 붙는 시각 피드백을 준다. 원본 자리에는 레이아웃 보존용 placeholder를 둔다.
- 드래그는 명확한 Grip 핸들에서 시작하고 PointerSensor·KeyboardSensor를 함께 제공한다. `touch-action: none`, 키보드 coordinate getter, `aria-label`을 제공하며 편집/삭제 버튼 클릭과 순서 이동을 분리한다.
- 드래그 중에는 Sortable이 시각 순서를 즉시 반영하고, 포인터를 놓은 뒤 서버의 `sortOrder`를 저장한다. 저장 실패 시 드래그 시작 전 순서로 복원하고 오류를 알린다.
- 첨부 캡처는 기본 drag ghost 문제를 설명하는 참고 자료이며, 기존 확정 디자인 철학과 충돌하는 별도 시각 변경은 이 지시만으로 추가하지 않는다.

## DR-81. 2026-08-23 과비 납부 관리 원장·업무대

- 과비 관리 화면은 총무 계좌 입금 내역을 기준으로 수납 상태, 간식·복지 혜택 자격, 미납자 알림 대상을 결정하는 단일 원장(Single Source of Truth)이다. 화면의 KPI나 상태 badge가 원장과 다른 별도 계산 결과를 갖지 않도록 한다.
- 2026년 기본값은 6학기 일시납 45,000원이지만 금액을 정액으로 고정하지 않는다. 2025년 이전 기납부자의 차액과 향후 회비 변동을 처리할 수 있도록 학생별 수납액, 적용 시작 학기(화면의 기준 학기에서 자동 결정), 적용 학기 수, 납부 유형·수단, 납부일, 비고를 기록한다.
- 별도 학생/통계 탭과 분리된 summary strip을 만들지 않는다. 화면 상단에는 `총 수납 금액`, `기준 학기 납부율`, `미납 인원` 3개의 compact KPI만 두고, 툴바·table·pagination은 하나의 white container에 통합한다.
- `납부 연도` 대신 `기준 학기`를 사용하며 기본값은 당해 학기다. 상태 control은 `[전체] [완납] [미납]`만 제공하고, 6학기 coverage가 만료된 학생은 선택한 기준 학기에서 자동으로 미납 처리한다.
- `[내보내기]`는 현재 filter 또는 선택 대상의 결과를 확인 모달 없이 즉시 다운로드한다. `[불러오기]`는 업로드 전용 validation modal을 사용한다. 파일 교환 기능을 하나의 모호한 “파일 관리” action으로 합치지 않는다.
- 선택 상태 때문에 table 위에 새 action row를 삽입하지 않는다. 한 명 이상 선택하면 기존 table header가 `[N명 선택됨 | 💳 일괄 납부 처리]`로 부드럽게 교체된다. 선택 Set은 검색·필터·페이지 변경에도 유지하고, 선택 수를 누르면 선택 학생 태그 popover와 개별 제거를 제공한다. export label은 `내보내기 (N)`으로 갱신한다.
- `PaymentModal`은 선택 학생별 수납액을 table input으로 노출하고 45,000원을 기본값으로 채운다. 기납부 차액은 행 단위로 수정 가능해야 하며, 납부 유형·기준 학기에서 자동 결정되는 적용 시작 학기·적용 학기 수·결제 수단·납부일·비고를 같은 처리 단위로 기록한다. 적용 시작 학기 자체를 별도 UI로 중복 입력하지 않는다.
- table 컬럼은 `체크박스 | 이름(영문명) | 학번 | 이메일 | 전공 | 상태 | 수납액` 순서를 사용한다. legacy 연필 수정 아이콘과 작업 컬럼은 두지 않고 행 전체 click으로 우측 detail sheet를 연다. sheet에서는 학기별 납부 이력, 감면·차액 사유, 관리자 메모를 확인하고 요약 정보를 수정할 수 있게 한다. 원장 이력은 임의 삭제·덮어쓰기를 하지 않고 정정 기록을 추가한다.
- 첫 진입에만 회색 skeleton을 보여준다. 검색/필터/정렬 중에는 기존 table rows를 유지하고 새 값 도착 시 교체하며 `opacity`와 150ms `transition-opacity`만 적용한다. “불러오는 중입니다” 문구와 spinner를 다시 넣지 않는다. selection과 old rows 보존이 layout shift보다 우선한다.
- 관리자 업무 화면의 상태 색은 의미를 제한한다. 완납/미납은 텍스트와 badge 형태로도 구분되어야 하며 색상만으로 의미를 전달하지 않는다. 금액은 tabular numerals와 우측 정렬을 사용하고, 행 높이·control 높이는 공통 admin token을 따른다.
- 첨부 이미지는 정보 구조와 밀도를 참고하는 자료일 뿐이다. 기존 디자인 철학과 충돌하는 통계 탭 재도입, 과도한 색상 코딩, 상시 납부 action, layout-shifting bulk row는 구현하지 않고 사용자 확인 전 보류한다.

## DR-82. 2026-08-23 운영 로그 증적 콘솔

- 운영 로그는 일반 CRUD가 아니라 변경·실행 내역을 추적하고 보존하는 불변 증적 콘솔이다. 삭제·수정·일괄 상태 변경 action을 제공하지 않으며, 화면에 `/health` dependency banner나 상태 새로고침 영역을 두지 않는다.
- 타이틀 아래에는 하나의 white container만 둔다. 검색(담당자·대상·액션), 도메인, 기간 filter, `총 n건`, table, pagination을 이 container 안에서 이어지게 배치한다. 상단에 떠 있는 count badge나 헬스체크 카드로 데이터 영역을 밀어내지 않는다.
- 버튼 표시는 `내보내기`로 통일하고, 결과는 현재 검색·도메인·기간 filter에 일치하는 전체 로그를 서버에서 XLSX 바이너리로 생성해 즉시 다운로드한다. UTF-8 CSV를 기본 운영 산출물로 사용하지 않는다.
- 불변 로그에는 checkbox와 눈알 icon column을 만들지 않는다. row 전체를 hover/focus 가능한 단일 interaction target으로 만들고 click 또는 Enter/Space로 우측 detail Sheet를 연다. 별도 작업 column은 두지 않는다.
- 목록의 텍스트는 `[도메인] + 명사형 액션` 구조를 사용한다. 예를 들어 `[과비] 수납 상태 변경`, `[메일] 일괄 발송`, `[집행위] 부원 정보 수정`처럼 domain badge와 action label을 분리한다. `~했습니다` 문장형 action을 목록에 노출하지 않는다.
- 목록의 대상에는 raw UUID를 표시하지 않는다. 사용자·학생회비 상태는 `이름 (학번)`, 콘텐츠/게시글은 제목, 역할은 역할명, 일괄 수납은 `N명 학생회비 수납 대상`처럼 사람이 즉시 식별할 수 있는 target label을 API에서 제공한다. UUID·IP·raw action code는 기술 metadata 영역에서만 볼 수 있다.
- Detail Sheet는 `eventKind`에 따라 본문을 바꾼다. UPDATE는 before→after diff, EXECUTE/BATCH는 실행 파라미터와 성공·실패 요약, CREATE/DELETE는 대상 snapshot을 사용한다. IP·event ID·raw JSON payload는 하단 `기술 메타데이터 (JSON)` accordion에 격리한다.
- 첫 진입에만 회색 skeleton을 표시한다. 검색·도메인·기간 변경 중에는 기존 table rows를 유지하고 새 응답 도착 시 교체하며 150ms opacity transition만 사용한다. “불러오는 중입니다” 문구와 spinner로 table 전체를 교체하지 않는다.
- 첨부 문서의 문장과 이미지는 구현 의도를 파악하는 참고 자료다. 기존 확정 디자인 철학과 충돌하는 상시 checkbox, `/health` 상단 배너, CSV 기본 export, 강한 색상 상태 코딩은 자동 복원하지 않고 사용자 확인 전 보류한다.

## DR-83. 2026-08-23 관리자 사용자 목록·XLSX 업무 표준

- 관리자 연락망·과비·운영 로그·설문 응답의 파일 교환 포맷은 `.xlsx`로 통일한다. 화면의 실행 버튼은 내보내기/불러오기로 통일하고, 템플릿처럼 목적이 다른 보조 동작만 `양식 내보내기`처럼 구체적으로 표시한다. `.csv`를 기본 확장자나 사용자 안내 문구로 새로 도입하지 않는다.
- 내보내기는 현재 filter 또는 선택 대상에 해당하는 XLSX를 즉시 다운로드한다. 불러오기는 파일 선택 → 헤더/형식 검증 → 오류 행 확인 → 적용 순서로 진행하며, 서버가 생성한 XLSX를 다시 불러와도 열 이름이 호환되어야 한다.
- 유저 관리 목록의 컬럼은 `이름 | 학번 | 이메일 | 소속 · 전공 | 상태 | 최근 접속`으로 고정한다. `작업`, `동의 시간`, `가입 일시`는 목록에서 제거한다. 가입 일시·개인정보 동의·계정 식별 코드·과비 상세 같은 정보는 행을 열었을 때만 우측 상세 드로어에 표시한다.
- 이름 셀은 한글명을 첫 줄, 영문명을 그 아래 보조 텍스트로 표시한다. `연락처`는 `이메일`로, `최근 활동`은 `최근 접속`으로 표현한다. 최근 접속은 `방금 전`, `1일 전`, `3일 전`, `1주 전`, `1년 전`처럼 상대 시간으로 표시하고 정확한 시각은 hover/상세 정보에서만 제공한다.
- 작업 컬럼을 다시 만들지 않는다. 데이터 행 전체가 hover/focus 가능한 단일 target이며 click 또는 Enter/Space로 우측 상세 드로어를 연다. 상태 변경 같은 관리자 action은 드로어 footer에서만 제공하고 확인·성공·실패 피드백을 유지한다.
- 상세 드로어는 프로필(한글명/영문명/활성 상태), 학번·KAIST UID·이메일·소속·전공, 계정 metadata, 과비 상태를 정보 그룹으로 나눈다. 스크린샷의 장식적인 ASCII 프레임·과도한 위험 강조는 기존 flat/clean 디자인 철학과 충돌하므로 이 규칙만으로 복원하지 않는다.
- 이 규칙은 첨부 스크린샷과 과거 문서의 `작업` 컬럼·CSV 표기를 현재 직접 지시보다 우선하지 않는다. 기존 디자인 철학과 위배되는 제안은 사용자 확인 전 보류한다.

## DR-84. 2026-08-23 권한 관리·초안 복구·비동기 구성원 검색

### 권한 관리 화면 비판 피드백

- 역할 목록과 권한 상세가 한 화면에 함께 있어도 정보 구조는 `역할 선택 → 권한 확인/수정 → 구성원 관리` 순서가 즉시 읽혀야 한다. 역할 이름·설명·구성원 수·권한 수를 같은 위계로 굵게 쌓지 않고, 역할명만 primary emphasis, 설명·수치는 secondary text로 둔다.
- 시스템 역할은 수정 불가 상태를 단순히 회색 checkbox로만 표현하면 disabled와 미선택을 혼동할 수 있다. `시스템 역할` badge와 설명으로 잠금 이유를 함께 알리고, 저장 action도 disabled affordance를 유지한다.
- 권한 카드의 전체 선택 checkbox와 개별 checkbox는 현재 선택 상태·수정 가능 여부·부분 선택 상태를 구분해야 한다. 색상만으로 상태를 전달하지 않고 native checkbox semantics와 label을 유지한다.
- 구성원 편집 modal에 별도 `검색` 버튼을 두면 입력 → 버튼 클릭이라는 불필요한 단계를 만든다. 입력 후 짧은 debounce로 검색하고, 결과가 오는 동안 기존 행을 유지하는 것이 실무형 화면에서 더 안정적이다.
- 구성원 목록의 초기 skeleton은 첫 진입에만 사용한다. 검색·페이지 이동 중 기존 rows를 제거하거나 spinner 문구로 대체하지 않고, 이전 rows에 `opacity`와 150ms `transition-opacity`만 적용한 뒤 응답 도착 시 교체한다.
- 구성원 선택은 현재 페이지의 select-all과 전체 검색 결과의 선택을 분리한다. 선택 Set은 query·page 변경에도 유지하고, 현재 페이지의 해제는 현재 페이지 ID만 제거한다. 선택 수는 modal footer에서 계속 보여준다.
- 공통 `Pagination`을 사용하고, 페이지 크기·높이·곡률·text hierarchy를 다른 관리자 테이블과 임의로 다르게 만들지 않는다.
- 역할 추가와 운영 콘텐츠 입력이 키 입력 순간 깨지는 문제는 모달 자체의 장식 문제가 아니라 React SyntheticEvent의 `currentTarget` 수명 문제일 수 있다. functional state updater 안에서 `event.currentTarget`을 참조하지 말고, 핸들러 진입 시 value/checked를 primitive로 추출한 뒤 updater에 전달한다.

### 초안 복구 배너

- `DraftRestoredBanner`는 게시글 작성/수정, 설문 편집, 메일 작성 등 복구 가능한 editor에서 공유한다. `role="status"`, `aria-live="polite"`, 저장 시각, `새로 쓰기`, 우측 X 닫기 action을 포함한다.
- X는 안내 배너만 닫고 현재 작성 내용을 삭제하지 않는다. `새로 쓰기`는 각 editor가 정의한 명시적 초기화/새 route 동작을 실행하며, 사용자가 저장 내용을 잃을 수 있는 경우 별도 확인을 거친다.
- 배너는 editor 본문보다 먼저 보이되 레이아웃을 크게 밀어내지 않는 compact surface를 사용한다. 스크린샷의 강한 blur/ASCII 프레임/과도한 초록 fill은 flat & clean 원칙과 충돌하므로 복원하지 않는다.

### 구현 우선순위 및 보류 원칙

- 이번 수정은 입력 크래시, 검색 UX, 로딩 전환, 선택 보존, 배너 재사용처럼 재현 가능한 기능·접근성 문제를 우선한다. 권한 도메인 자체를 새로 설계하거나 스크린샷의 권한 항목을 임의로 추가하지 않는다.
- 다른 에이전트의 피드백과 첨부 이미지는 문제 후보와 밀도 참고 자료일 뿐이다. 확정된 flat/clean, neutral semantic color, 공통 control, `:focus-visible`, no layout shift 원칙과 충돌하는 제안은 사용자 확인 전 보류한다.

## DR-85. 2026-08-23 최신 과비·권한 화면 정정

- 이 규칙은 DR-81의 현재 UI 표현을 보완한다. 과비 목록의 최종 컬럼은 `체크박스 | 이름(영문명) | 학번 | 이메일 | 전공 | 상태 | 수납액`이며 `작업` 컬럼과 행 끝 아이콘은 두지 않는다. 행 전체 click으로 상세 드로어를 연다.
- 납부 모달에서 `적용 시작 학기`는 별도 입력으로 노출하지 않는다. 선택한 `기준 학기`를 납부 원장의 적용 시작 학기로 사용하고, 사용자가 실제로 조정해야 하는 `적용 학기 수`만 충분한 폭의 공통 dropdown으로 제공한다.
- 납부 입력 table의 표현은 `대상 | 학번 | 수납액 | 현재 상태`로 고정한다. `현재 적용`처럼 의미가 불분명한 표현과 `실제 수납액` 표현은 사용하지 않는다. 상세 드로어의 요약 금액도 `수납액`으로 통일한다.
- 과비 표의 선택 상태는 table header 높이를 바꾸지 않는다. 첫 번째 셀의 현재 페이지 전체선택 checkbox는 항상 유지하고, 선택 시 나머지 header 영역만 `N명 선택됨`과 일괄 납부 action으로 교체한다. 검색·페이지 이동 중에도 선택 Set을 보존한다.
- 구성원 편집 modal은 고정 높이 surface와 내부 결과 영역 scroll을 사용한다. `전체 n명 · 선택 n명`은 modal footer의 한 줄로 표시하고, 검색 debounce 안내 문구를 별도로 노출하지 않는다.
- API 컨테이너 재생성으로 nginx가 이전 Docker IP를 잡아 502를 내지 않도록 nginx proxy는 Docker resolver(`127.0.0.11`)로 `api` service를 재해석한다. `/api/...` 요청은 `/v1/...`로 명시적으로 rewrite한 뒤 전달하며, 단일 backend가 일시 중지된 순간의 502를 애플리케이션 오류로 숨기지 않되 정상 재기동 후 새 IP로 자동 복귀해야 한다.
- 이 최신 정정은 첨부 스크린샷의 기존 `작업`, `실납부액`, `현재 적용`, 상시 액션 행을 그대로 복원하지 않는다. 스크린샷은 레이아웃 문제 확인용 참고 자료이고, 직접 작성한 최신 명칭·동작 요구와 기존 flat/clean 원칙이 우선한다.
