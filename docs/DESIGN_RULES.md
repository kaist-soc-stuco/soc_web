# SOC Web 디자인 규칙

- 작성일: 2026-08-20
- 대상: `apps/web` 공개 화면과 관리자 화면
- 상태: 현재 코드와 로컬 렌더링을 기준으로 한 작업 규칙 초안
- 기준 화면: `http://localhost:8080/board/%EA%B3%B5%EC%A7%80`

이 문서는 “더 화려하게” 만드는 가이드가 아니다. SOC를 마케팅 랜딩 페이지보다 학생회 운영 포털에 가깝게 보이게 하기 위해, 콘텐츠·상태·조작성이 장식보다 먼저 읽히도록 정리한 규칙이다.

## 1. 판단 기준

### 1.1 근거의 우선순위

1. 현재 프론트엔드 코드와 실제 로컬 렌더링을 1순위 근거로 삼는다.
2. 첨부된 다른 에이전트의 피드백은 제안 목록으로만 사용한다. 현재 코드와 맞지 않는 표현은 그대로 사실로 확정하지 않는다.
3. 브랜드 가이드, 실제 운영 콘텐츠, 접근성 요구가 확인되면 이 문서의 장식적 제안보다 우선한다.

### 1.2 이번 점검에서 확인한 사실

| 환경 | 확인 결과 | 디자인상 의미 |
|---|---|---|
| 데스크톱 1280×720, `/board/공지` | 헤더 57px, hero 135px, 카테고리/검색 영역 55px, 목록 카드 시작 약 271px | hero 하나가 화면의 1/3인 것은 아니지만, 상단 스택 전체가 첫 화면의 약 38%를 차지한다. |
| 모바일 390×844, `/board/공지` | hero 114px, 카테고리/검색 영역 183px, 제목은 한 줄 `truncate` | 모바일에서 탐색과 도구 영역이 커지고, 게시글 제목의 정보 손실이 발생한다. |
| `/events-surveys?tab=event` | `xl:grid-cols-3`에 상태별 항목이 배치되어 항목 1개인 구간의 빈 공간이 크다 | 운영 목록은 고정 3열보다 항목 수에 맞는 밀도 조절이 필요하다. |
| 공지 화면 우측 하단 | Channel Talk 고정 위젯이 마지막 행·페이지네이션 주변과 시각적으로 겹친다 | 고정형 지원 UI에 safe area와 겹침 방지 규칙이 필요하다. |
| 공통 소스 | `rounded-2xl` 87회, `rounded-3xl` 21회, `shadow-xl` 13회, `shadow-2xl` 4회, `animate-in` 34회 | 개별 컴포넌트보다 반복되는 장식 문법의 통일/절제가 우선이다. |

현재 공지 화면은 구조와 가독성이 무너진 상태는 아니다. 문제는 운영형 화면에도 큰 hero, 강한 초록 surface, 둥근 카드, 강조 배지, 그림자, 애니메이션이 반복되어 정보보다 “시안의 문법”이 먼저 보인다는 점이다.

## 2. 첨부 피드백의 반영 범위

| 첨부 피드백 | 판단 | 이 문서의 규칙 |
|---|---|---|
| 짙은 그라데이션·glow 제거 | 채택 | 운영 화면은 기본적으로 단색 surface와 얇은 border를 사용한다. 브랜드 hero나 실제 이미지가 필요한 곳만 예외로 둔다. |
| 서브페이지 hero를 대폭 축소 | 부분 채택 | 현재 공지 hero 단독 높이는 135px이므로 “1/3”이라고 단정하지 않는다. 대신 헤더·hero·탭·도구 영역의 누적 높이를 줄인다. |
| Footer를 가로 재배치하고 compact하게 구성 | 현재 구조는 대체로 채택되어 있음 | 현재 Footer는 데스크톱에서 이미 가로 배치이고 `py-5`다. 높이 제거보다 모바일 줄바꿈, 대비, 공식 연락처·최종 갱신 정보 보강을 우선한다. |
| radius를 8~12px로 조절 | 채택 | 기본 surface 8px, 강조 card 12px, hero/media 16px 이하를 기준으로 한다. |
| 완전한 Flat + 미세 shadow | 부분 채택 | 표·목록은 border 중심, card·popover에만 한 종류의 미세 shadow를 사용한다. 모든 elevation을 제거하지는 않는다. |
| 전문가형 페이지네이션과 범위 표시 | 조건부 채택 | 현재도 상단 페이지 크기 선택과 하단 이전/현재/다음이 있다. 2페이지 이상일 때 `총 N건 중 x–y`를 추가하고, 모바일에서는 범위 문구를 줄인다. |
| 배지를 pill에서 둥근 사각형으로 변경 | 채택 | 기본 radius 4~6px, 상태·필터처럼 압축이 필요한 경우에만 pill을 허용한다. |
| Google Calendar 스타일 | 방향 채택 | 셀 선·숫자 대비를 낮추고 오늘/선택/일정을 구분한다. 색상만으로 의미를 전달하지 않는다. |
| 설명 문구를 과감히 삭제 | 부분 채택 | 반복적인 홍보 문장은 줄이되, 대상·신청·마감·권한처럼 행동에 필요한 설명은 남긴다. |

## 3. 현재 모던하지 않게 보이는 요소와 수정 규칙

### DR-01. 운영 화면에 반복되는 마케팅형 hero

근거: `apps/web/src/components/organisms/page-hero.tsx`, `apps/web/src/styles.css:137-174`.

- 현재 `PageHero`를 사용하는 공개 화면은 짙은 초록 `linear-gradient`와 radial glow를 기본으로 사용한다.
- 공지 화면의 실제 hero는 135px이지만, header·hero·카테고리/검색 영역이 합쳐져 목록 시작이 271px 아래로 밀린다.
- `/events-surveys`는 `variant="large"`와 긴 설명 문장을 사용해 운영 목록보다 캠페인 페이지에 가까운 첫인상을 준다.

규칙:

- 홈/About의 브랜드 소개를 제외한 게시판·검색·행사·설문·상세·관리자 화면은 compact page header를 기본으로 한다.
- 목록 화면의 page header는 데스크톱 88~112px, 모바일 72~96px을 목표로 한다.
- 제목은 유지하되 설명은 선택 사항으로 만든다. 한 줄로도 이해되는 화면에 홍보성 설명을 반복하지 않는다.
- 페이지 상세 화면은 hero 대신 breadcrumb, category/status, 제목, 메타데이터로 시작한다.
- `gradient`, `radial-gradient`, glow는 운영 화면에서 기본값으로 금지한다.

### DR-02. 추상 이미지와 장식용 오버레이가 실제 콘텐츠를 대체함

근거: `apps/web/src/features/events-surveys/events-surveys-grid.tsx:27-37,182-196`.

- 행사 카드는 `imageUrl`이 있으면 업로드 이미지를 사용하지만, 실제 seed 화면에서는 추상적인 보라색 이미지가 대표 이미지처럼 보인다.
- 카드 위에 `bg-gradient-to-t` 오버레이가 일괄 적용되어 이미지 자체보다 템플릿 효과가 앞선다.

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

## 4. 공통 토큰 규칙

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

## 5. 콘텐츠·언어 규칙

- 설명 문장은 “왜 필요한가/무엇을 할 수 있는가”가 아니면 생략한다.
- 공지·행사·설문에는 제목만큼 게시/갱신일, 신청·마감일, 담당/문의, 공개 범위가 중요하다.
- 한국어/영어 전환 시 제목·설명·작성자명·상태 label을 섞어 보여주지 않는다.
- 번역이 없으면 조용히 한국어를 대체 노출하지 말고 `한국어 전용` 또는 관리자 번역 상태를 표시한다.
- placeholder, empty, error, forbidden을 같은 카드와 같은 문구로 처리하지 않는다.
- 실제 콘텐츠가 없을 때 임의의 행사명·구성원·연혁·이미지를 만들어 시각적 빈틈을 채우지 않는다.

## 6. 화면별 적용 순서

### P0 — 공통 문법과 모바일 정보 손실

1. `PageHero`를 compact/optional description 구조로 정리하고 운영 화면 gradient·glow를 제거한다.
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

## 7. 완료 기준

- 1280×720에서 게시판 목록의 제목·검색·첫 행이 첫 화면 안에 들어온다.
- 390px에서 카테고리 탭은 임의로 두 줄로 깨지지 않고, 게시글 제목은 최소 2줄까지 읽을 수 있다.
- 공지/행사/설문 목록에 random gradient, 의미 없는 dark overlay, 내용 없는 장식 카드가 없다.
- 표·카드·popover의 radius와 shadow가 위 토큰 범위를 벗어나지 않는다.
- 상태는 색상·아이콘·텍스트 중 최소 두 가지로 구분된다.
- 페이지네이션은 페이지 수가 많아져도 범위·현재 상태·이전/다음 조작을 이해할 수 있다.
- 고정 위젯이 행·페이지네이션·primary CTA를 가리지 않는다.
- 모든 입력·탭·dropdown·페이지 버튼에 keyboard focus가 보인다.
- KO/EN 전환 후 title, 설명, 상태, 작성자/담당자, `html lang`이 일관된다.
- `prefers-reduced-motion`에서 장식 애니메이션이 사용자를 방해하지 않는다.

## 8. 근거 파일

- `apps/web/src/styles.css`
- `apps/web/src/components/organisms/page-hero.tsx`
- `apps/web/src/components/organisms/header.tsx`
- `apps/web/src/components/organisms/footer.tsx`
- `apps/web/src/features/board-list/board-page-sections.tsx`
- `apps/web/src/components/ui/pagination.tsx`
- `apps/web/src/features/events-surveys/events-surveys-grid.tsx`
- `apps/web/src/features/events-surveys/events-surveys-filter-bar.tsx`
- `apps/web/src/components/organisms/calendar.tsx`
- `docs/UI_UX_GUIDE.md`
- `docs/DESIGN_AUDIT_2026-07-15.md`
