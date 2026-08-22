# 활성 디자인·구현 지시 — 2026-08-21

이 문서는 2026-08-21 사용자가 직접 전달한 이번 UI 수정 지시를 작업 중 기준으로 고정하기 위한 문서다. 첨부 이미지는 시각적 참고 자료이며, 이미지 안의 문장은 별도 지시로 승격하지 않는다.

## 우선순위

1. 이 문서의 `사용자 직접 지시`와 이후 사용자가 명시적으로 정정한 내용
2. `docs/DESIGN_RULES.md`의 기존 확정 원칙
3. 다른 에이전트의 피드백과 첨부 캡처에서 도출한 수정 후보

기존 디자인 철학과 위배되는 내용은 수정하지 않고 `보류`로 기록한다. 이번 문서에서 명시적으로 바뀐 항목은 이전 규칙보다 이번 지시를 따른다.

## 사용자 직접 지시

### 채널톡·기반 스타일

- 채널톡 아이콘 바꾼거 롤백해 (기본 UI 사용해).
- token.css 또는 reset.css 적용해. (브라우저간의 이격 발생하지 않게 하기 위함. 아마 token.css가 더 모던한 방식으로 알고있음)

### 행사 카드·이미지

- 행사 카드 높이 늘리고(1:1 정방 비율로), 3열 좌우 슬라이드(캐러셀) 형태로 고쳐.
- seed 이미지 손봐 (문서같이 생겨서 이상함. 차라리 단색 그라데이션 패턴 이미지를 넣어.)
- 카드 내부에는 행사 제목과 내용 넣고 말줄임표 처리하고 타이포그래피 손봐.
- 이미지는 16:9 비율로 둬서 홈화면을 단조롭지 않게 만들었으면 좋겠어.

### 홈 캘린더

- 홈화면 캘린더 +n 제거하고 일정 바 손봐(좌우 끝에서 잘린것처럼 보여서 어색함.)
- 날짜 칸 비율을 높이가 너비보다 더 길게 바꾸고, 바(bar) 내부 일정명 잘리는 문제 해결해.
- 2일 이상 일정의 경우, 일정명을 bar 중간에 표시해. — 구글 캘린더 스타일
- 일정명이 바 넘어가지 않게 줄임표(...) 처리하고 마우스 hover시 툴팁으로 컴팩트하게 날짜와 일정명 표시해.
- 캘린더 하단 행 ("선택한 날짜") 제거해.
- 바가 날짜 칸 넘어가지 않게 해.
- 캘린더 이전/다음 버튼 테두리 제거해.
- 홈 캘린더 하단의 남는 공간은 다가오는 주요 일정 D-Day 리스트로 채워.
- 달력이 페이지 하단까지 채워지게 해.

### 날짜 표기

- 날짜 표기때 연도는 생략하고, 당해(올해)가 아닌 경우엔 예외적으로 연도 표시 가능해.
- 표기 방법을 `8월 21일` / `08.21`로 통일해.
- 잘못된 예시는 `8월21일`, `08. 21.`이다. 이 규칙을 문서와 가능한 lint/공통 formatter 기준에 명시한다.

### 홈 게시판 위젯

- 게시판 위젯은 5줄에서 8줄로 확장해.
- `전체` 탭에서만 위젯 행 옆에 뱃지를 두고, 다른 개별 탭에서는 생략해.
- 두껍고 짙은 색의 둥근 알약 뱃지 대신, 연한 배경에 작은 글씨로 톤 낮춰.
- 고정도 핀으로 표시하지 말고 배경색과 가로 구분선으로 구분하는 등 세련된 방법을 써.

### GNB·프로필·퀵 서비스

- GNB 바에서는 텍스트를 빼고 프로필 드롭다운 상단에 카드 형태로 보여줘(이름 / 권한 등).
- nav 하단에 퀵 서비스 바를 둬.
- 알록달록한 원색 아이콘 대신 `bg-white border rounded-xl` 카드 위에 미니멀한 단색 라인 아이콘 + 라벨 조합을 사용해.

### 게시판 목록

- 게시판 테이블 행 높이를 낮춰.
- 핀 아이콘을 제거하고 고정 공지 영역을 분리해.
- 실제 정렬 기준이 되는 1개 컬럼(예: 작성일)에만 화살표(↓)를 진하게 표시하고, 다른 컬럼은 화살표를 없애거나 호버 시에만 나타나도록 처리해.
- GNB의 게시판과 바로 아래 서브 탭의 초록색 언더라인 시각 언어가 겹치므로, 서브 탭은 언더라인 대신 알약형 또는 세그먼트 컨트롤로 바꿔.
- 서브 탭 배경색은 본문 배경색과 맞춰(white로 하지 않음).
- wide 해상도에서는 작성일, 조회수, 작성자 메타 정보를 고정폭으로 붙이고 남는 가변 공간 전체를 제목 컬럼에 몰아줘.
- `글쓴이` 표현은 `작성자`로 수정해.
- 페이지네이션을 `n개씩 보기 | 총 n건 중 n-n | ... | (이전) 1/4 (다음)` 형태로 고도화해.
- 페이지 헤더의 설명을 완전히 제거해.
- 페이지 헤더의 중간 가로선을 걷어내고 헤더 배경을 완전히 통일해.

### 필터·검색·상태

- 포커스 링 색깔 투명도를 30% 더 줘(연하게).
- 포커스 링 외의 일반 테두리도 너무 진하지 않게 낮춰.
- 버튼/필터 클릭 배경색도 너무 진하지 않게 해.
- 검색 input에 텍스트 입력 시 검색어 삭제(Clear `×`) 버튼을 노출해.
- 필터 적용 상태라면 버튼에 점 인디케이터 또는 카운트 뱃지를 띄워.
- 필터 내부의 검색 기준은 제거하고, 검색창 placeholder는 `제목, 내용 검색`처럼 표시해.
- 조회 기간에 `오늘`을 추가하고 시인성을 높여.
- 컴포넌트 높이와 곡률은 공통 토큰과 일치시켜.
- 필터 내부에 초기화 텍스트 버튼을 두고, 바깥 영역을 클릭하면 필터 팝오버를 닫아.

### 전역 시각 언어

- 사이트 전체에서 불필요한 bold, extra bold와 색상 남발을 줄여.
- 굳이 강조할 대상이 아니면 굵기를 1~2단계 낮추고 무채색을 적극적으로 사용해.
- 테이블 헤더, 버튼 내부 텍스트, 푸터, `게시글이 없습니다`, 버튼 클릭 피드백 등도 같은 원칙을 적용해.

### 푸터

- `메일`은 제거해.
- `전산학부 집행위원회`를 추가하고 `/about`으로 연결해.
- `(c) KAIST SOC All rights Reserved.`로 바꾸고 좌측으로 옮겨.
- 푸터 우측에는 소통 창구(Instagram 등)를 둬.

## 충돌 처리 메모

- 일정명을 유지하는 bar와 다일 일정의 연결은 기존 확정 원칙과 일치하므로 유지한다. 이번 지시는 홈에서 `+N`을 제거하라고 명시했으므로 홈에는 `+N`을 렌더링하지 않고, 제한된 lane과 hover 상세로 정보 밀도를 관리한다. 전체 캘린더의 overflow 정책은 별도 화면으로 유지한다.
- 이전에 보류했던 홈의 `선택한 날짜` 행 제거는 이번 지시가 명시적으로 재확정했으므로 제거한다. 대신 하단 공간을 D-Day 리스트로 사용한다.
- 홈 행사 영역은 실제 카드 수가 부족할 때 빈 placeholder를 추가하지 않는다. 3열 carousel track과 indicator를 사용하고, 마지막 페이지의 빈 칸은 자연스럽게 정렬한다.

## 2026-08-22 작성·수정·마이페이지 추가 확정

- 작성·수정 화면은 한 개의 에디터 shell 안에 공통 툴바와 국문/영문 좌우 편집 pane을 둔다. 한국어 콘텐츠만 선택하면 영문 pane과 구분선을 숨긴다. 두 개의 완성형 에디터 카드를 세로로 쌓지 않는다.
- 에디터는 페이지 본문 폭과 일치해야 한다. 에디터 내부에는 일반 input처럼 보이는 hover/focus 장식을 추가하지 않는다.
- `임시저장` 텍스트 클릭은 즉시 저장하고 `임시저장되었습니다.` 토스트를 띄운다. 숫자/chevron 클릭은 저장 초안 목록 popover/drawer를 열어 `[불러오기]`와 `[삭제]`를 제공한다. 자동 저장은 실제 변경이 있을 때만 수행한다.
- 비밀글 체크박스는 게시판 설정의 `allowSecret`이 true일 때 노출한다. 공개 작성 게시판이라는 이유만으로 숨기지 않으며, 건의사항 설정은 허용으로 변경한다.
- 글 작성/수정 제목 행의 우측에 `취소`, `임시저장 (n) ▾`, `등록`을 배치하고 긴 본문 스크롤 시 GNB 아래에 얇은 반투명 action bar가 유지된다.
- 마이페이지에서 스크랩·임시저장글은 활동 내역 내부 탭으로 통합하고, 사이드바 로그아웃과 반복 설명 문장은 제거한다. 내 정보는 compact 2열 grid로 정리하고 개인정보 동의·최근 로그인은 `2026.08.21 18:57` 형식으로 포맷한다.

## 충돌·보류 원칙 재확인

- 첨부 이미지나 다른 에이전트의 피드백은 레이아웃을 판단하는 참고 자료일 뿐, 사용자 직접 지시가 아니다.
- 기존 디자인 철학(정보 우선, 장식 절제, 공통 토큰, 접근성)과 충돌하는 제안은 구현하지 않고 보류한다. 이후 사용자가 명시적으로 다시 지시한 경우에만 이번 규칙의 우선순위에 따라 검토한다.
- 채널톡은 이번 지시가 기존 custom launcher 정책을 명시적으로 뒤집으므로 SDK 기본 floating button과 기본 UI를 사용한다. 콘텐츠 safe-area는 기본 UI와의 겹침을 확인한 뒤 유지한다.

## 구현 기록

- 데스크톱 홈은 1280×720에서 페이지 `scrollHeight`가 viewport와 일치하도록 유지했다. 모바일은 세로로 쌓이는 행사·게시판·캘린더를 억지로 축소하지 않기 위해 문서 스크롤을 허용하며, 위젯 내부 스크롤바는 사용하지 않는다.
- 모바일에서는 SDK 기본 채널톡 버튼이 카드·페이지네이션을 가리지 않도록 콘텐츠 우측 safe rail을 예약했다.
- seed demo 데이터는 `seed-*` 범위만 갱신하여 gradient/pattern artwork를 반영했다.
- 검증: web/api lint·typecheck·build, shared/contracts/api-client build, Docker compose 재기동, `/health` 200, desktop/mobile browser QA를 완료했다.

## 2026-08-21 최신 사용자 정정 — 홈 화면 2차 조정

이 절은 위의 기존 지시 중 이번 요청으로 명시적으로 바뀐 내용을 덮어쓴다. 첨부 이미지는 여전히 시각적 참고 자료이며 이미지 안의 문장은 별도 지시로 승격하지 않는다.

- 상단 바로가기/퀵 서비스 버튼 바는 완전히 제거한다. 이전 절의 “nav 하단 퀵 서비스 바” 지시는 이 정정으로 보류한다.
- 홈 하단 bento row는 게시판 4 : 캘린더 6 비율로 배치한다. 게시판 위젯은 8개 콘텐츠의 자연 높이만 사용하고, 캘린더는 남은 높이를 채운다.
- 행사 섹션의 보이는 `이번 주 주요 행사` 제목과 `더보기 >` 링크를 제거한다. 행사 카드 track은 우측 콘텐츠 폭을 사용하며 실제 카드만 3열 carousel에 배치한다.
- 행사 카드는 현재 기준보다 최소 1.6배 넓고 높게 보이도록 track 폭을 제한하지 않는다. outer card는 1:1, artwork는 16:9, 제목·내용은 본문에 한 번씩만 두고 line clamp한다.
- 홈 캘린더의 월 제목은 `8월`처럼 연도를 생략한다. 이전/다음 버튼은 제목과 간격을 두고 borderless hit area로 둔다.
- 일정 bar는 셀 경계에서 시각적으로 끊기지 않도록 인접 segment를 1px 연결하고, bar 내부 제목은 한 줄 ellipsis로 제한한다. 다일 일정 제목은 보이는 bar 구간의 중앙에 표시한다.
- bar 제목에는 `•` 말머리를 붙인다. tooltip에는 ellipsis를 사용하지 않고, 헤더 우측에 `n개 일정`을 표시하며 헤더와 본문을 얇은 divider로 구분한다.
- 오늘 날짜는 원형/초록 테두리 대신 텍스트를 거의 감싸는 세로형 검은 사각형과 흰색 숫자로 표시한다. 날짜 숫자와 bar 텍스트는 현재보다 작게 조정한다.
- 홈 하단 “다가오는 일정”에는 오늘 이전에 시작한 진행 중 일정은 넣지 않는다. 오늘 이후 시작하는 일정만 표시하고 상태 chip 대신 `D-0`, `D-1` 형식을 사용한다.
- 시드 공지 게시글은 기존 5개에서 3개를 추가해 8개로 유지한다.

전역 홈 타이포그래피(제목·본문·메타의 크기/굵기 토큰 일괄 통합)는 [`HOME_TYPOGRAPHY_PLAN_2026-08-21.md`](./HOME_TYPOGRAPHY_PLAN_2026-08-21.md)에 적은 계획으로 사용자 승인 대기 상태다. 이번 요청에서 지정한 캘린더 숫자·bar·tooltip·다가오는 일정의 국소 조정만 승인 없이 적용하고, 전역 일괄 조정은 보류한다.

## 2026-08-21 최신 승인 — 홈 타이포그래피·행사 카드

- 홈 타이포그래피 계획을 승인했으므로 `tokens.css` 역할 토큰을 실제 hero/event/board/calendar 텍스트에 적용한다.
- 홈 행사 카드는 약 400px 높이 상한으로 낮추고, 이미지 또는 단색 gradient pattern이 카드 전체를 채우게 한다. 카드 하단에는 약한 검은색 gradient를 깔고 제목과 내용을 overlay로 표시한다. 제목·내용은 각각 한 번만 렌더링하고 line clamp한다.
- 카드 전체 클릭은 행사 상세 `/board/행사/:articleId`로 이동해야 한다. 드래그하지 않은 click을 carousel handler가 막지 않도록 하고, encoded route segment를 사용한다.
- arbitrary Tailwind 값은 반복 토큰을 `tokens.css`/의미 있는 CSS class로 옮기고, 계산값과 반응형 예외만 남긴다. 페이지 전체 `select-none`은 제거하며 드래그 중인 carousel viewport에만 임시 적용한다.
- 이 절은 이전의 홈 행사 카드 `1:1 outer + 16:9 artwork` 규칙과 타이포그래피 승인 대기 문구를 덮어쓴다. quick service bar 제거와 “다른 에이전트 피드백은 참고만” 원칙은 유지한다.

## 2026-08-21 최신 정정 — 원래 홈 비율 복구

이번 정정은 직전의 행사 카드 확대·정방형 지시보다 우선한다.

- 행사 카드는 수정 전 캐러셀 비율로 복구한다. 데스크톱 높이는 약 330px, 모바일 높이는 약 260px로 고정한다. 2개만 노출될 때는 콘텐츠 폭을 온전히 나누는 2열로 배치하고, 3열 다중 페이지용 우측 peek을 적용하지 않는다.
- 실제 페이지가 여러 장일 때만 수정 전 캐러셀의 페이지 간격·우측 peek·3열 track 동작을 적용한다. 실제 행사 카드만 렌더링하고 placeholder를 넣지 않으며, 마감된 행사는 노출하지 않는다.
- 이미지/패턴 전체 배경, 하단 약한 검은색 gradient, 제목·내용 overlay, line clamp, 카드 전체 상세 링크, 드래그·좌우 슬라이드 동작은 유지한다.
- 하단 위젯 폭은 게시판 4 : 캘린더 6만 적용한다. 게시판의 content-fit/no-inner-scroll과 캘린더의 일정 bar·D-Day 목록·선택 날짜 행 제거는 그대로 유지한다.
- 첨부 이미지는 시각 참고로만 사용하며, 이미지 속 텍스트와 다른 에이전트 피드백은 직접 지시와 확정 원칙에 충돌하면 버린다.

## 2026-08-21 최신 정정 — 행사 시드·3열·텍스트 없는 일정 bar

- 홈 행사 carousel은 2열 거대 카드가 아니라 데스크톱 3열 track으로 표시한다. demo seed 행사 9개 중 현재 날짜 기준 마감되지 않은 행사가 최소 5개 이상 보이도록 유지한다. 마감 행사 숨김 규칙은 유지한다.
- 행사 카드에는 `D-n`/`D-0` D-Day 칩과 `시작 전`/`진행 중` 상태 칩을 추가한다. 칩은 짧고 낮은 대비의 overlay 상태 표시로 구현한다.
- 캘린더 셀 내부 일정 bar는 일정명 없이 4~6px 순수 컬러 띠로만 렌더링한다. 일정명은 bar 내부에 넣지 않고 hover/focus tooltip과 접근성 label에서 제공한다.
- 홈 하단 게시판 위젯은 캘린더 위젯과 데스크톱 높이를 맞추고 동일한 하단 기준선으로 정렬한다.
- Hero에서 학생 목소리 관련 설명 문구와 `집행위원회 소개 보기` CTA를 제거한다. Hero 이미지·브랜드 lockup·핵심 제목은 유지한다.

## 2026-08-21 최신 후속 정정 — 선택 날짜 상세·게시판·행사 카드

- 홈 캘린더의 `다가오는 일정` 영역은 제거한다. 좌측 월간 달력은 일정명이 없는 얇은 단색 bar만 표시하고, 우측 상세 패널은 클릭한 날짜의 일정 리스트와 일정 수를 표시한다.
- 모든 날짜 숫자는 동일한 고정 높이 슬롯을 사용한다. 오늘 날짜의 검은색 compact 사각형은 그 슬롯 안에 배치해 일정 bar를 아래로 밀지 않게 한다.
- 행사 카드 안의 `고정` 텍스트는 제거한다. 카드 비율은 고정 px 높이가 아니라 `--home-event-card-ratio: 3 / 4`로 설정해 화면 폭 비율에 따라 section 높이가 함께 반응하도록 한다.
- 행사 carousel은 수평 이동 임계값을 넘은 drag에서만 넘기고, 단순 click은 카드 상세 링크로 이동한다. 수직 touch 이동은 페이지 스크롤로 남긴다.
- 홈 게시판 위젯은 응답 데이터에서 가능한 많이 보여주되 내부 스크롤바는 두지 않는다. 고정 글은 최대 3개로 제한하고, 행의 메타데이터는 `작성자 · 날짜` 순서로 표시한다.
- 게시판 목록에서 `게시글 목록`과 `고정 공지` 텍스트/분리 영역은 제거한다. 고정 글은 목록 안에서 작은 line pin icon으로만 표시한다. 날짜는 `05.21` 형식의 고정폭 숫자로 통일하고 조회수 헤더는 오른쪽 정렬한다.
- 게시판 페이지네이션은 왼쪽의 개수 선택/범위와 오른쪽의 이전·현재 페이지 input·`/`·총 페이지·다음 구조로 맞춘다. 권한이 있으면 글쓰기 버튼은 필터 버튼 바로 오른쪽에 둔다.
- 이 절은 이미지 및 다른 에이전트 피드백보다 우선한다. 확정된 디자인 철학과 충돌하는 제안은 구현하지 않고 보류한다.

## 2026-08-21 최신 정정 — 타이포그래피 적용만 롤백

- 직전의 홈 타이포그래피 토큰 적용으로 사이트 글자가 전반적으로 얇고 크게 보인다는 사용자 판단을 반영한다. `tokens.css`의 홈 역할 토큰과 해당 의미 클래스는 적용 전의 선명한 제목·작고 중간 굵기의 본문/메타 계층으로 되돌린다.
- 이 정정은 타이포그래피만 대상으로 한다. 홈 레이아웃, 행사 carousel/상세 이동, 캘린더 bar·선택일 상세, 게시판 목록·페이지네이션, GNB·드롭다운·탭바의 구조와 상호작용은 유지한다.
- Hero의 설명/CTA를 다시 추가하지 않으며, 행사 카드 비율·seed·이미지/overlay·드래그 동작도 변경하지 않는다.
- 다른 에이전트의 피드백과 첨부 이미지는 참고만 한다. 확정 원칙과 충돌하는 내용은 버리고, 수정 완료한 타이포그래피 범위만 디자인 문서에 기록한다.

## 2026-08-21 최신 정정 — 홈 정보 밀도·컨트롤 완성도

이 절은 직전 홈 화면 캡처를 사용자가 직접 눈으로 검수한 결과다. 홈 비율과 시각 완성도에 관해서는 앞선 상충 지시보다 우선한다.

### 홈 레이아웃·행사

- 데스크톱 Hero는 화면을 과점하지 않도록 전체 폭의 24%로 줄이고, 콘텐츠 영역은 76%를 사용한다.
- 행사 카드는 세로형 `3 / 4`에서 가로형 `4 / 3`으로 낮춘다. 이미지가 탐색 정보를 밀어내지 않아야 한다.
- 데스크톱 carousel은 잘린 다음 카드를 노출하지 않고 한 페이지에 실제 카드 3개를 정확히 배치한다.
- 좌우 이동 버튼은 이미지 위에 겹치지 않고 페이지 indicator와 함께 카드 아래에 둔다.
- 행사 fallback 색상과 상태 chip은 원색 대신 저채도 색과 반투명 중립색을 사용한다.

### 홈 게시판

- 게시판 헤더와 카테고리 탭은 게시글 제목보다 크지 않게 한다. 헤더는 더 작고 굵게, 게시글 제목은 조금 더 크고 중간 굵기로 설정한다.
- `게시판` 제목과 `전체 보기`를 독립된 header row에 두고, 카테고리 탭은 그 아래의 보조 탐색으로 분리한다.
- 새 글 표시는 굵은 텍스트 badge 대신 작은 저채도 점으로 표시한다.
- 행 높이는 제목·작성자·날짜가 한 덩어리로 뭉치지 않을 만큼 확보하되, 운영 포털의 밀도를 유지한다.

### 홈 캘린더

- 월 header의 불필요한 높이를 줄이고 이전/다음 버튼은 32px 정사각 hit area, 6~8px radius의 중립 버튼으로 사용한다.
- 우측 선택 날짜 패널의 회색 배경·외곽 카드·count badge를 제거한다. 캘린더 본문과는 얇은 divider만 사용한다.
- 일정 bar 높이는 4px로 줄인다.
- 서로 다른 일정은 ID 기반으로 안정적으로 배정한 저채도 5색 palette로 구분한다. 초록/회색 두 색으로 통일하지 않는다.
- 선택 날짜는 옅은 중립 배경과 얇은 테두리, 오늘은 검은 compact 숫자 표시로 서로 구분한다.
- 우측 일정 목록은 카드 중첩 대신 가로 구분선이 있는 text list로 표시한다.

### 사람이 다듬은 듯한 버튼·input·text 기준

- 버튼과 input은 먼저 기능 밀도에 맞는 높이(작은 아이콘 32px, 일반 control 36~40px)를 정한 뒤 radius를 6~10px 범위에서 통일한다. 기본 control에 큰 pill radius를 쓰지 않는다.
- 기본 상태는 무채색 surface·얇은 border·중간 굵기 텍스트를 사용하고, 브랜드 색은 주요 action·선택 상태·focus에만 제한한다.
- hover는 배경/테두리 명도 변화, pressed는 미세한 scale, focus-visible은 저투명도 ring으로 구분한다. 여러 효과를 동시에 과장하지 않는다.
- text hierarchy는 크기만으로 만들지 않는다. `section label = 작고 굵게`, `content title = 한 단계 크고 medium`, `metadata = 작고 낮은 대비` 관계를 우선한다.
- input은 placeholder와 실제 입력값의 대비가 분명해야 하며, label·도움말·오류 문구를 placeholder로 대체하지 않는다.
- 구현 후에는 각 요소를 단독으로 평가하지 않고 인접한 제목·행·카드와 크기 및 굵기를 비교해 역전된 위계가 없는지 검수한다.

## 2026-08-21 최신 정정 — 홈 carousel 조작·게시판 밀도

- 행사 이전/다음 버튼은 카드 아래에 상시 노출하지 않는다. 행사 section hover 또는 내부 focus 시 section 좌우 중앙에 40px 원형 버튼으로 노출한다.
- 행사 page 이동은 약 460ms의 감속 곡선을 사용하며, 버튼·indicator뿐 아니라 mouse/touch drag로도 같은 page snap이 동작해야 한다.
- 별도의 D-Day badge는 제거한다. 상태 badge 하나에 `진행 중 (~08.14)`, `시작 예정 (08.15~)`처럼 상태와 날짜 범위를 함께 표시한다.
- 홈 캘린더 bar는 각 날짜 cell 좌우에서 4px 안쪽으로 들여 인접 일정과 구분한다.
- 일정 색은 ID 기반 저채도 10색 palette로 안정적으로 배정하며 빨강·초록·파랑·보라·주황·청록·분홍 계열을 포함한다.
- 게시판 category tab은 별도 행을 사용하지 않고 widget header 안에 둔다. tab은 이전보다 작고 굵게 표시한다.
- 게시판 고정 글은 제목 왼쪽에 얇은 line pin icon을 표시한다.
- 게시판 목록은 최대 8개 행을 남은 widget 높이에 균등 배치해 빈 하단 공간을 만들지 않는다.
- 게시판 header action 문구는 `전체 보기`가 아니라 `더보기`로 표시한다.

## 2026-08-21 최신 정정 — 홈 기능 수정·공통 UI 체계

- 행사 정렬은 고정 → 진행 중(종료 임박 순) → 시작 예정(시작 임박 순) → 상시 순서로 고정한다. 종료 행사는 제외한다.
- 행사 카드와 carousel viewport에서 브라우저 native link/image drag를 차단하고 pointer drag만 page 이동으로 처리한다.
- 홈 게시판 날짜는 현재 연도 `05.21`, 다른 연도 `2025.05.21` 형식으로 표시한다.
- 고정 글 pin은 14px에 가까운 검정 line icon으로 제목 바로 왼쪽에 표시한다.
- 게시판 행을 widget 높이에 맞춰 강제로 늘리지 않는다. 기본 최소 높이 40px의 compact row로 렌더링하고 card는 content 높이를 사용한다.
- 캘린더 header는 `2026년 8월`처럼 연도를 포함하며 이전/다음 버튼과 함께 달력 본문 중앙에 배치한다.
- 다일 일정은 날짜 cell별 bar 복제가 아니라 주 단위 grid-column span 하나로 렌더링한다. 실제 시작·종료 지점에만 radius와 4px inset을 적용한다.
- 일정 색은 겹치는 기간을 검사해 동시에 노출되는 일정끼리 palette가 충돌하지 않도록 배정한다. 동일 일정은 월 전체에서 같은 색을 유지한다.
- 날짜 hover tooltip은 우측 선택 날짜 상세와 정보를 중복하고 콘텐츠를 덮으므로 제거한다.
- 공통 UI는 `Button`, `IconButton`, `TextInput`, `Badge`, `PopoverPanel`, `SectionHeader`를 기준으로 한다. header 검색·언어·알림·프로필, confirm dialog, status chip, 홈 widget header부터 공통 컴포넌트를 적용한다.
- 공통 icon button은 36px hit area, 18px icon, 1.75 stroke를 기본으로 한다. 일반 input/button은 40px, compact control은 32px, 기본 radius는 8px로 통일한다.
## 게시판 헤더 텍스트 위계 보정

- 섹션 제목은 `12px / 800`, 탭은 `11px / 700`, 게시글 제목은 `13.5px / 500`을 사용한다. 섹션 제목은 굵기로 역할을 드러내되 게시글 제목보다 크게 만들지 않는다.
- 비활성 탭도 `slate-500` 이상의 대비를 유지한다. 작은 글자를 옅게 처리해 실제보다 가늘어 보이게 하지 않는다.
- 섹션 제목과 첫 탭 사이에는 `16px` 간격을 둔다. 활성 탭은 옅은 배경과 테두리로 상태를 표시한다.
- 개별 수치 변경만으로 완료 처리하지 않고, 제목·탭·행 제목을 한 화면에서 비교해 상대 위계를 검수한다.

## 공통 control 전역 적용 보정

- raw HTML 버튼은 `Button`, 텍스트·날짜·숫자 input은 `UiInput`, textarea는 `UiTextarea`, native select는 `UiSelect`를 거치도록 전역 연결했다. 예외는 해당 공통 컴포넌트 자체의 내부 native element뿐이다.
- 기본 버튼은 무채색 ghost/outline을 사용하고, primary/destructive 의미가 있을 때만 강한 색을 사용한다. outline 버튼의 장식성 shadow는 제거한다.
- 일반 form control의 radius는 8px로 고정하고, 높이는 화면 문맥에 따라 32/36/40px만 허용한다. checkbox·radio·file 등 브라우저 고유 control은 텍스트 input 외형을 강제하지 않는다.
- 공통 컴포넌트를 가져오기만 하고 화면별 class가 모든 기준을 다시 덮어쓰는 상태를 완료로 보지 않는다. 이후 변경은 공통 control을 우선 수정한다.

## 홈 3차 시각 검수 보정

- demo 데이터의 `전산학부 커리어 밋업`은 고정 행사로 취급하지 않는다. 따라서 현재 순서는 진행 중 종료 임박 → 시작 예정 시작 임박 순으로 보인다. 실제 `isPinned` 행사가 생기면 그 행사만 최우선에 둔다.
- 게시판과 캘린더 카드는 같은 bento row 높이를 사용한다. 게시판은 header 아래의 남은 높이를 최대 8개 행이 균등하게 채우고, 결과가 없을 때도 카드 자체 높이는 유지한다.
- 홈 게시판 탭은 raw button이나 범용 Button class 조합을 화면에서 직접 작성하지 않고 `WidgetTabButton`을 사용한다. 탭은 `10.5px / 700`, 섹션 label은 `12px / 800`, 게시글 제목은 `13.5px / 500`으로 고정한다.

## 홈 4차 시각 검수·공개 페이지 공통화

- 홈 게시판 widget의 `게시판` label은 제거한다. category tab 자체가 문맥을 설명하며, 탭은 `10px / 800`으로 더 작고 굵게 표시한다.
- 새 게시글은 제목 뒤에 작은 빨간 dot으로만 표시한다. 텍스트 `NEW` badge는 사용하지 않는다.
- 행사 carousel은 유한한 목록이다. 첫 page에서는 이전 버튼, 마지막 page에서는 다음 버튼을 렌더링하지 않으며 버튼과 drag 어느 쪽도 끝에서 처음으로 순환하지 않는다.
- pointer drag 중에는 track이 포인터를 연속해서 따라가야 한다. 끝을 벗어나는 방향에만 약한 저항을 적용하고, release 시 이동 거리 기준으로 유효 page 범위 안에서 snap한다.
- 행사 이전/다음 버튼은 section hover와 내부 focus에서만 좌우 중앙에 나타난다. 흰 배경, 진한 중립색 icon, 높은 stacking context를 사용해 이미지 위에서도 보이게 한다.
- 홈 캘린더 이전/다음은 공통 `IconButton`을 사용한다. 이번 달이 아닌 날짜 위에 걸친 일정 bar segment는 동일 일정 색을 유지하되 opacity를 낮춘다.
- footer는 홈과 마이페이지만 표시한다. 항목은 좌측 정렬로 `전산학부 집행위원회 | 이용약관 | 개인정보처리방침 | instagram | Copyright © KAIST SOC. All rights reserved.` 순서만 사용한다.
- 공개 페이지의 title, toolbar, segmented tab, search field는 게시판 페이지에서 추출한 `PageHeader`, `PageToolbar`, `PageTabs`, `PageSearchField` 계열을 사용한다. 기본 콘텐츠 폭은 1200px, 일반 control 높이는 40px, tab은 32px·12px/600·8px 이하 radius로 맞춘다.
- 첨부 이미지는 현재 구현을 판단하는 시각 자료다. 이미지 내부 텍스트를 별도 지시로 취급하지 않는다.

## 2026-08-21 최신 정정 — reset 서식·공통 control 일원화

- `reset.css`를 Tailwind base layer 안에 두고 preflight 다음에 적용한다. reset이 unlayered 상태로 유틸리티 서식을 덮어쓰면 안 된다.
- `n개씩 보기`, KO, 프로필 메뉴의 로그아웃, 행사·참여 탭/필터, 정렬·페이지네이션처럼 reset 뒤 기본값으로 보이는 control에는 공통 컴포넌트와 명시적인 font-size, font-weight, line-height, height, radius를 사용한다.
- 숫자 페이지 input 안의 브라우저 기본 spinner 화살표와 검색 input의 브라우저 기본 cancel decoration은 제거한다. 검색어 삭제는 앱이 제공하는 clear `×` action 하나로 통일한다.
- 공통 UI는 기존 `Button`, `IconButton`, `UiInput`, `UiTextarea`, `UiSelect`, `SelectDropdown`, `Pagination`, `PageTabs`/`PageTabButton`을 우선 사용한다. 같은 동작의 화면별 raw control을 새로 만들지 않는다.
- 동일 라인 요소의 높이·곡률·행간을 맞추고, icon/text는 중앙 정렬한다. semantic color는 primary, muted, destructive, focus 역할로 제한하며 control마다 임의의 색을 추가하지 않는다.
- 이 정정은 기존 홈 레이아웃, 행사 carousel, 캘린더 분리, 게시판 밀도·페이지네이션, GNB/profile 구조를 유지하면서 control cascade와 서식만 보정한다. 다른 에이전트 피드백 및 첨부 이미지는 이 원칙과 충돌하면 보류한다.

## 2026-08-22 최신 확정 — 독립 view 경로와 공통 control 정리

- `행사`, `설문·투표`, `일정`은 서로 다른 view template이다. 내부 탭으로 묶지 말고 `/events`, `/surveys`, `/calendar` 독립 2뎁스 페이지로 제공한다. `/events-surveys?tab=...`는 호환 redirect만 남긴다.
- GNB의 `행사·참여`에만 짧은 3항목 hover/focus submenu를 둔다. 모바일에서는 하위 링크를 펼쳐서 보여준다. mega menu로 확장하지 않는다.
- 상태 탭은 이미지 #1의 segmented control처럼 neutral group surface + active white item으로 통일한다. 상태별 진한 색 채움과 과도한 pill은 사용하지 않는다.
- 필터 버튼은 전역에서 제거하고 toolbar에 inline으로 노출한다. `SegmentedControl`, `SelectDropdown`, `PageSearchField`를 공통 사용하며 검색 input은 앱 clear `×`, reset은 작은 텍스트 action을 사용한다.
- select 메뉴는 body portal/fallback positioning으로 table overflow clipping을 방지하고, 하단 공간이 부족하면 위로 열린다. 이전/다음 icon button은 borderless navigation tone으로 통일하고 hover에는 배경 변화만 둔다.
- 공개 캘린더는 `+N`, 오늘 버튼, 날짜 셀 border, `일정 상세조회`, `시작`, `하루 종일`을 제거한다. 학사 일정의 단일 날짜는 `종일`, 다일 일정은 기간으로 표시하며 우측 선택일 상세 목록에서 확인한다.
- 마이페이지의 `개요` view/menu는 제거하고 `내 정보`를 기본 진입으로 한다.
- 관리자 메뉴 순서는 사이트 콘텐츠, 유저 관리, 권한 관리, 과비 납부 관리, 설문조사 관리, 이메일 일괄발송, 연락망, 로그 순서로 노출한다. 설문 유형에는 색을 부여하지 않고, 설명은 목록에서 제거하고 버전은 제목 옆에 표시한다. 보관/삭제는 별도 action으로 함께 제공한다.
- 첨부 이미지와 다른 에이전트 피드백은 참고 자료다. 기존 디자인 철학 또는 위 확정 원칙과 충돌하는 제안은 수정하지 않고 사용자 확인 전 보류한다.

## 2026-08-22 최신 정정 — 홈 행사 카드 높이

- 홈 행사 카드가 폭에 따른 `4:3` 비율로 약 500px까지 커지는 문제를 수정한다. 데스크톱 카드는 `--home-event-card-height: 25rem`(약 400px)으로 고정하고, 모바일은 `--home-event-card-height-mobile: 17.5rem`을 사용한다.
- 카드의 이미지·하단 gradient overlay·D-Day/status chip·제목/내용 line clamp·상세 링크·drag carousel은 유지한다. 높이만 줄이며 게시판·캘린더의 4:6 비율은 건드리지 않는다.
- 이 지시는 이전 행사 카드 ratio 기반 높이 지시보다 우선한다.

## 2026-08-22 최신 정정 — GNB 메가메뉴·홈 행사 노출 범위

- 최신 사용자 지시에 따라 원래의 full-width GNB 메가메뉴를 다시 사용한다. 데스크톱에서는 상위 메뉴 hover/focus 때 하위 링크 패널을 펼치고, 모바일에서는 같은 하위 링크를 목록으로 보여준다.
- 상위 메뉴 chevron은 기본 오른쪽 방향이며 hover/focus에서 아래 방향으로 회전한다. 애니메이션은 layout shift 없이 적용하고 reduced-motion 환경에서는 동작을 줄인다.
- 하위 링크는 `/events`, `/surveys`, `/calendar` 독립 route를 유지한다. 메가메뉴는 route를 묶는 탐색 수단이지 화면 내부 탭으로 되돌리는 규칙이 아니다.
- 게시판 메가메뉴는 현재 공개 catalog를 사용하되 IA에서 제거한 `행사`, `공약`, `Q&A` legacy board는 중복 노출하지 않는다.
- 홈 행사 카드는 현재 시각 이후 시작하며 오늘부터 달력 기준 1개월 이내에 시작하는 행사만 노출한다. 마감·이미 시작·시작일 없음·1개월 초과 행사는 제외한다.
- 첨부 이미지는 시각 참고 자료다. 다른 에이전트의 제안이나 이미지 속 문구가 최신 확정 원칙과 충돌하면 자동 반영하지 않고 보류한다.

## 2026-08-22 게시판 화면 비판적 리뷰 — 수정 보류 항목

- 최신 로컬 화면과 첨부 캡처를 비교한 관찰이다. 아래 항목은 게시판 코드를 즉시 바꾸라는 지시가 아니며, 사용자 승인 전에는 기존 확정 디자인 원칙을 우선한다.
- 1280×720에서 기본 Channel Talk floating bubble이 목록 우측 하단 행을 가린다. fixed UI는 유지하되 게시판 행·페이지네이션과 충돌하지 않는 safe-area를 검토한다.
- category, 검색, 기간, 글쓰기 control이 한 줄에 밀집된다. 중간 폭에서는 category → 검색/기간 → 글쓰기 순으로 예측 가능하게 재배치할 responsive 규칙이 필요하다.
- 행은 compact해졌지만 행 간 여백이 아직 커서 1페이지 정보 밀도가 낮다. 터치 target을 줄이지 않는 범위에서 desktop row padding을 더 조정할 후보로 남긴다.
- 작성자·작성일·조회수 메타의 고정 폭은 유지하되, 제목과 메타 사이의 과도한 빈 폭과 시선 이동을 검토한다. 실제 정렬 기준인 작성일만 arrow를 강조하고 나머지는 hover/focus와 `aria-sort`로 처리한다.
- 비활성 tab·기간·table header는 너무 옅어지지 않게 하고, active는 neutral surface·얇은 border를 유지한다. pinned row·engagement action 재구성이나 강한 색상 도입은 보류한다.
- 전체 행/검색/필터/페이지네이션의 `:focus-visible`, responsive duplicate metadata의 보조기술 중복 노출 여부를 QA 항목으로 추가한다.

## 2026-08-22 최신 확정 — 데스크톱 툴바·목록 밀도·고정 공지

- 데스크톱의 기간·상태 필터는 팝오버 안에 숨기지 않고 툴바에 직접 노출한다. 모바일에서만 검색 옆 필터 버튼과 하단 바텀시트를 사용한다.
- 툴바는 좌측에 탐색/카테고리, 우측에 검색·필터·정렬·CTA를 두고 `justify-between`으로 가변 여백을 확보한다. 모든 요소를 한쪽이나 중앙에 밀집시키지 않는다.
- 게시판 페이지당 개수는 `20`, `50`, `100`만 제공하며 기본값은 `20`이다.
- 데이터가 적을 때 남는 페이지 하단 여백은 자연스럽게 유지한다. 행 높이를 viewport에 맞춰 늘리거나 빈 더미 행을 추가하지 않는다.
- 고정 공지는 고인지 정보이므로 옅은 배경, 공지 분류 badge, 검은 line pin을 함께 유지한다. 세 표시는 각각 영역·분류·고정 상태를 전달하므로 임의로 하나만 남기지 않는다.
- Channel Talk의 기본 launcher와 기본 동작은 변경하지 않는다.
- 페이지 공통 기준은 제목 `24px/700`, 페이지 tab `13px/600`·높이 `34px`, 검색 `14px/400`·높이 `40px`, 게시글 제목 `14px/600`, 메타 `12.5~13px/400`, 목록 행 `56~58px`, pagination `36px`로 유지한다.
- 행사 카드의 이미지 존재 여부와 무관하게 제목을 화면에 표시한다. 제목 `15px/600`, 설명 `13px/400`, 메타 `12px/400` 위계를 사용하고 viewport를 채우기 위한 고정 최소 높이를 강제하지 않는다.

## 2026-08-22 최신 확정 — 공통 셸·통합 데이터 카드·GNB 고정 규격

- 공개 페이지는 `PageShell → Header → PageMain → PageHeader/PageToolbar/PageContainer` 구조를 공통 사용한다. 개별 페이지에서 같은 max-width와 좌우 padding을 다시 선언하지 않는다.
- 게시판 category tab은 회색 canvas에 두고, 검색·기간 filter·CTA·table·pagination은 하나의 흰색 `DataViewCard` 안에서 header/body/footer로 묶는다. 데이터가 적을 때 카드 아래 여백은 그대로 둔다.
- toolbar control은 공통 token을 사용한다. 기본 높이 `40px`, compact 높이 `36px`, radius `8px`, 본문 `14px/500`을 기준으로 하고 segmented item은 `32px` 높이로 고정한다.
- 데스크톱 GNB 높이는 `68px`, brand rail은 `240px`, 상위 메뉴 column은 `176px`로 고정한다. 홈과 내부 route에서 logo와 상위 메뉴의 x/y/width/height가 바뀌지 않아야 한다. 홈은 같은 logo geometry에 inverse color만 적용한다.
- 상위 메뉴는 `15px/600`, 하위 메뉴는 `14px/500`과 `rgb(52, 64, 84)`를 사용한다. 메가메뉴의 가로·세로 divider는 `rgb(229, 233, 236)`로 통일하고 GNB 하단 border와 겹치는 별도 top border는 두지 않는다.
- dropdown과 button의 pressed feedback은 `active: scale(0.98)`로 통일한다. 목록 count는 `전체 n건`으로 표기한다.
- 화면별 raw shell, legacy page context, 중복 toolbar wrapper를 새로 만들지 않는다. 공통 primitive로 대체된 outdated 코드는 제거한다.

## 2026-08-22 최신 확정 — 작성/수정 에디터 control

- 작성/수정 에디터는 페이지 본문 폭을 그대로 사용한다. `국문 / 영문` 탭버튼은 제거하고 국문·영문을 세로로 배치하며, 한국어 콘텐츠만이면 영문과 구분선을 숨긴다.
- 설정 제목/아이콘은 제거한다. 비밀글은 게시판이 허용한 경우에만 checkbox와 payload를 활성화한다. 취소 버튼은 하단 왼쪽에 `ArrowLeft + 취소`로, 임시저장·등록/수정은 오른쪽에 배치한다.
- 글자 크기는 custom dropdown으로 `8/9/10/11/12/14/16/18/20/22/24/28/30/36/50/72/96`px를 제공한다. 글자색·배경색은 각각 8색 palette + HEX input + 적용/초기화 action을 갖는 popover로 만든다.
- 자주 사용하지 않는 Tiptap 기능(인용/취소선/코드/제목/링크 해제)은 세로 점 3개 메뉴로 이동한다. 에디터 본문 자체에는 hover/focus 장식을 넣지 않고 toolbar만 공통 control 상태를 사용한다.
- native select 기본 화살표와 reset으로 생긴 브라우저 기본 서식이 화면에 노출되지 않게 공통 `SelectDropdown`/`Button`을 사용하고, 동일 라인 control의 높이·radius·font-size·weight·line-height와 icon/text alignment를 맞춘다.
- 참고 URL은 시각/동작 참고 자료일 뿐이며, 기존 확정 원칙과 충돌하는 다른 에이전트 피드백은 구현하지 않고 사용자 확인 전 보류한다.

## 2026-08-22 최신 확정 — platform control 이식·홈/GNB·목록 타이포

- 홈의 inverse logo는 별도의 초록 brand block으로 감싸지 않고 hero 위에 absolute로 배치한다. 내부 route와 같은 `240×68px` brand rail 기하를 유지하고 nav는 항상 `x=240px`에서 시작한다.
- `Desktop/platform`의 `.ui-segmented-control.filter-chips`, breadcrumb, `.data-table-pagination.ui-pagination` 구조와 CSS 수치를 공통 컴포넌트에 이식한다. segmented track은 `padding:4px`, `gap:3px`, `radius:10px`, item은 `34px·14px/400` 기준을 쓴다.
- 홈 게시글 제목·메타는 `14px/400`으로 통일하고 메타 색은 더 연하게 표시한다. 홈 캘린더 본문, 본문의 tab/button, pagination은 `400`을 사용한다.
- 게시판 table 본문은 `500`, column header와 고정 공지 제목은 `600`으로 구분한다. 고정 공지의 pin icon은 제거하고 더 진한 tint와 공지 badge로 즉시 구분한다. 이 항목은 이전 pin 유지 지시보다 우선한다.
- PageHeader의 설명성 문구는 제거하고 글 작성·수정·관리자 화면도 공통 shell/control로 조립한다. 임시저장 복구는 banner가 아닌 modal을 사용한다.
- KO/EN은 borderless trigger로 표시하고 GNB hover에 추가 border를 만들지 않는다. profile menu는 중복 신원/역할 텍스트를 제거하고 `208px` 폭·`40px` row의 compact menu로 표시한다.

## 2026-08-22 최신 정정 — 세그먼트 중립색·GNB hover indicator

- segmented track은 중채도 회색 대신 밝은 cool neutral `#f7f9fc`, border `#e7ebf0`를 사용한다. active item은 순백색 표면·절제된 shadow·`#075f4a` text로 명확히 분리한다.
- desktop GNB는 brand rail 뒤에 responsive start offset을 두고, menu column은 viewport에 따라 `176~192px`로 늘려 메뉴 간 시각적 간격을 확보한다. mega menu column도 같은 offset/width에 정렬한다.
- GNB 하단 초록 indicator는 메뉴별 선을 개별 scale하지 않고 하나의 shared indicator를 `260ms cubic-bezier(0.22,1,0.36,1)`로 이동시킨다. route active 위치를 기준으로 hover 메뉴를 따라갔다가 pointer leave 시 복귀한다.
- 홈 헤더에서는 border utility를 렌더링하지 않고 hero column의 right border도 제거한다. hero는 `y=0`에서 시작하여 1px 흰색 경계선 없이 로고 뒤까지 온전히 연결되어야 한다.

## 2026-08-22 최신 확정 — 게시판 trackless category·기간 필터 제거·GNB route 고정

- 게시판 category는 GNB와 중복되는 underline이나 세그먼트 outer track을 사용하지 않는다. inactive는 투명 텍스트 button, active는 `#eaf5ef` soft surface·`#075f4a`·500으로 표시한다.
- 게시판 기간 필터는 desktop segmented control, mobile filter button/sheet, controller state, API query parameter까지 전체 제거한다.
- 게시판 desktop column은 헤더와 모든 행이 하나의 template token을 공유한다. 전체 목록은 `88px minmax(0,1fr) 168px 112px 88px`, 개별 category는 분류열만 제거하며 제목이 남는 너비를 독점한다.
- 홈 헤더의 brand rail을 hero `vw` 폭으로 바꾸지 않는다. 홈·내부 route 모두 brand `240px`, nav start `264px`, menu column `184px`로 고정하고 mega menu도 같은 offset에 맞춘다.

## 2026-08-22 최신 후속 — 홈 경계·로딩·공통 상태

- 홈 header의 hero 폭, brand 영역, GNB 시작점, mega menu left/width는 `--ui-home-hero-width`를 함께 사용한다. white navigation surface가 hero 영역 안으로 들어오면 안 된다. 내부 페이지의 고정 brand rail은 유지하되 홈에서만 responsive hero boundary를 기준으로 한다.
- 페이지 제목은 30px로 통일하고 제목 section에 `mb-6`을 둔다. 홈 캘린더의 선택일 상세 폭은 이전보다 넓히며, 행사 이동 버튼은 hover 전에도 희미한 white background를 유지한다.
- 홈 게시판 메타는 작성자·중간점·날짜의 고정 grid column으로 배치해 KO/EN 전환에 따른 위치 이동을 막는다.
- 게시판과 홈 게시판은 최초 진입에만 skeleton을 보여준다. category/language 변경 중에는 기존 목록을 유지하고 전체 목록에 `opacity-70`과 150ms `transition-opacity`를 적용한다. 로딩 spinner/“불러오는 중입니다” overlay는 제거한다.
- 버튼 pressed state는 `active:scale-[0.98]`, `active:duration-75`, `active:transition-transform`을 사용하고 색상 transition과 transform transition을 분리한다.
- 게시판 table header는 14px/500 muted slate, 수직 중앙 정렬, 상단 2px brand rule, 우측 정렬 날짜/조회수로 통일한다. `ArrowDown` line icon은 실제 정렬 column만 기본 표시하고, 본문은 제목 15px·작성자/날짜/조회수 14px/400으로 둔다. `전체 n건`은 14px #666, letter spacing -1px, 작성 CTA는 `작성`이다.
- EmptyState는 얇은 문서 아이콘 + `등록된 게시글이 없습니다.` 조합을 공통 사용한다. profile dropdown은 관리자일 때만 이름 왼쪽에 soft role badge를 둔다.
- 인증은 access 30분·persisted refresh 30일로 늘리고 refresh rotation마다 sliding expiry를 갱신한다. 클라이언트는 내부 route 이동, visible 복귀, 10분 간격의 활성 상태에서만 갱신한다.

이번 후속 검증에서 Docker를 재빌드한 뒤 1280×720 홈 기본 상태와 게시판 mega menu 펼침 상태를 캡처했다. 두 캡처 모두 white 영역의 시작점이 hero 오른쪽 경계와 일치했고, menu가 hero를 덮지 않았다. 이 직접 지시와 충돌하는 다른 에이전트 피드백은 계속 보류한다.

## 2026-08-23 최신 후속 — 설문 문항 자연스러운 순서 이동

- 설문 문항은 native HTML5 drag ghost가 아니라 `@dnd-kit`의 `DndContext`/`SortableContext`/`DragOverlay`로 구현한다.
- PointerSensor와 KeyboardSensor를 함께 사용하고, Sortable 카드들은 `transform 200ms ease`로 실시간 비켜선다. DragOverlay는 `document.body` 포털에서 원본 폭, `shadow-2xl`, `rotate-2`를 유지한다.
- 드래그 중 시각 순서는 즉시 반영하고 포인터를 놓을 때만 서버 `sortOrder`를 저장한다. 실패하면 시작 전 순서로 복원한다. 편집·삭제 액션과 drag handle은 분리한다.
