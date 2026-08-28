# SOC Web 개발 계획

- 작성일: 2026-08-20
- 대상: `apps/web`, `apps/api`, `shared/contracts`, `shared/api-client`
- 상태: 사용자 요구사항을 현재 코드 구조에 연결한 실행 계획
- 관련 디자인 기준: [`docs/DESIGN_RULES.md`](./DESIGN_RULES.md)

이 문서는 이번 요청의 기능 범위와 구현 순서를 정리한다. 아직 구현을 완료했다는 의미가 아니며, 각 단계는 데이터 모델·API 계약·권한·UI·테스트를 함께 완료해야 “완료”로 표시한다.

## 0. 요구사항의 출처와 해석 원칙

### 0.1 직접 지시와 첨부 이미지 구분

이번 계획에서 기능 요구사항으로 우선하는 것은 사용자가 직접 입력한 문장이다. 첨부 이미지는 다음처럼 참고 자료로만 취급한다.

| 자료 | 반영 방법 | 그대로 복사하지 않는 부분 |
|---|---|---|
| Image #1 (`codex-clipboard-8ae418fb-5b87-4825-9f83-4f6ac59a348c.png`) | 페이지 크기 선택, `총 N건 중 x-y`, 이전/현재/전체 페이지/다음 구조의 시각 참고 | 색상·간격·픽셀 단위의 복제는 요구하지 않는다. 모바일에서는 더 단순한 조작으로 재배치한다. |
| Image #2 (`codex-clipboard-28ea5147-93b0-4913-8bf8-141ede7e6200.png`) | 권한 기능의 범위와 관리자 메뉴가 필요한 영역을 파악하는 참고 | 이미지의 번호, `Default: 3, 8`, 문구, 권한 비트 값을 그대로 사용하지 않는다. 현재 프로젝트의 `PERMISSION_REGISTRY`를 기준으로 권한을 재설계한다. |
| Image #3 (`codex-clipboard-7ede1a77-2f61-44c1-af81-4dc99117706b.png`) | 과비 필터·검색·체크박스 테이블·페이지네이션·일괄 적용 UI의 참고 | 빨간 박스와 설명의 배치를 그대로 재현하지 않는다. 정보 밀도와 업무 흐름만 반영한다. |

### 0.2 현재 코드에서 확인된 전제

- 게시판 스키마에는 `allowSecret`, `allowLike`, `isPinned`, `pinOrder`, `viewCount`, `deletedAt`가 이미 있다. 실제 사용자 흐름·API·관리 UI가 완성되어 있는지는 별도로 검증한다.
- 댓글 스키마에는 `parentCommentId`가 있어 대댓글 데이터 구조의 기반이 있다. 댓글 트리 조회·작성 UI·권한·깊이 제한을 보완해야 한다.
- 첨부파일은 `AssetStorageProvider` 추상화 뒤의 local provider 또는 private S3 provider로 저장한다. 운영 S3 전환은 provider 교체만으로 끝나지 않고 presigned direct upload/read, 기존 파일 migration, 접근 정책까지 포함해야 한다.
- 권한은 `shared/contracts/src/permissions-registry.ts`의 bitmask가 SSOT다. 현재 정의를 깨지 않고 새 capability를 추가하거나, 역할 그룹과 기능 권한을 분리한다.
- Redis가 이미 있으므로 임시저장 debounce/중복 요청 방지/알림·메일 작업 큐에 활용할 수 있다. 단, 큐를 추가할 때는 재시도와 idempotency를 먼저 정의한다.

### 0.3 공통 원칙

1. 기존 게시글·설문·회비·사용자 데이터를 삭제하는 migration은 기본값으로 사용하지 않는다. 비활성화·soft delete·archive를 우선한다.
2. 기능을 만들기 전에 `shared/contracts`의 request/response와 권한 요구사항을 먼저 확정한다.
3. 민감정보는 화면에 필요한 최소 필드만 반환하고, 브라우저·로그·메일 미리보기에 불필요한 개인정보를 남기지 않는다.
4. 모든 일괄 작업은 preview → 대상 확인 → 적용 → 결과/실패 목록의 순서를 따른다.
5. 공개 화면에서 닫힌 행사나 비공개 글을 숨기더라도 관리자·작성자에게는 복구·검토 경로를 남긴다.
6. UI 완료만으로 완료 처리하지 않는다. DB 제약, 권한 guard, API 테스트, 모바일/키보드 상태까지 확인한다.

### 0.4 요구사항 확정 권장안

아래 결정은 직접 지시를 우선 반영하면서도 서로 충돌하거나 구현 위험이 큰 부분에 대한 기본값이다. 이후 기능 구현은 이 결정을 기준으로 하며, 변경 시 해당 결정과 영향을 함께 기록한다.

| 항목 | 확정 기본값 |
|---|---|
| 홈 스크롤 | 데스크톱은 `100dvh` 고정 canvas로 body/nested scroll을 제거한다. 모바일은 콘텐츠 접근성을 위해 문서 스크롤을 허용한다. |
| 홈 마감 행사 | 홈 행사 카드에서는 마감 항목을 제외한다. 행사 전체 화면의 `마감` 필터에서는 조회할 수 있다. |
| 행사 정렬 | `pinned → pinOrder → 마감/시작 임박순 → 시작일 → 안정적인 ID` 순으로 정렬한다. 마감일이 있으면 마감일을 임박 기준으로 사용한다. |
| Q&A | 신규 Q&A 게시판과 작성 경로는 제거하고 Channel Talk으로 대체한다. 기존 데이터는 삭제하지 않고 read-only/archive 및 안내 redirect를 제공한다. |
| 소개 IA | 최상위 GNB는 `게시판`, `행사·참여`, `학생회 소개` 3개로 고정한다. 소개의 기본 탭은 `학생회 소개`, `당해 학생회 소개`, `조직도`, `Contact me`를 유지하고, 공약·FAQ는 별도 compact route/link로 제공한다. |
| 설문 응답 마감 | 응답 `closeAt` 로직은 제거한다. 게시/비게시와 관리자 수동 종료로 응답 가능 여부를 제어한다. |
| 캘린더 외부 연동 | 1차는 자체 일정 CRUD, 검색, ICS import/export, 가능할 때 KAIST 학사일정 read-only feed를 구현한다. Google Calendar OAuth 양방향 동기화는 후속 범위다. |
| 댓글 | `parentCommentId` 기반 1단계 대댓글을 우선 구현하며 무한 깊이 트리는 만들지 않는다. |
| 결제 | Toss 결제는 1차 범위에서 제외하고 XLSX·수동 납부 관리 흐름을 안정화한다. |
| 파일 저장 | 운영 환경은 private S3와 presigned upload/read를 사용한다. 로컬 개발과 테스트는 provider 추상화 뒤 local provider를 허용한다. |
| 권한 | 첨부 이미지의 숫자나 문구를 복사하지 않고 `PERMISSION_REGISTRY` capability와 role group을 기준으로 한다. 사용자 일괄 권한 변경은 필터 → 체크박스 → preview → apply → 결과 순서로 처리한다. |

이 결정은 이미지의 시각적 배치보다 사용자가 직접 입력한 기능 요구사항과 데이터 보존·접근성 원칙을 우선한다.

## 1. 실행 순서와 우선순위

### Phase 0 — 계약·데이터·보안 기반

모든 기능의 선행 단계다.

- 요구사항을 기능별 acceptance criteria와 permission matrix로 분해한다.
- 기존 DB schema와 API를 inventory하고, 중복 기능과 이미 구현된 기반을 구분한다.
- `shared/contracts/src/http`에 API 계약을 먼저 추가하고, frontend mock/real client가 같은 타입을 사용하게 한다.
- migration은 forward-only로 작성하고 seed/demo 데이터의 영향을 확인한다.
- audit log에 actor, action, target, before/after summary, request id, createdAt를 남길 기준을 정한다.
- 권한 오류(401/403), 비공개 데이터, 개인정보 노출, 파일 접근을 endpoint 단위로 테스트한다.
- 로컬 Docker stack(Postgres, Redis, API, Web, nginx)의 health/readiness와 migration 순서를 고정한다.

### Phase 1 — 홈·공개 탐색·게시판 핵심 흐름

#### 1.1 홈 화면

- 홈 화면은 데스크톱에서 기본 viewport 안에 들어오는 고정 canvas로 만든다. body scroll을 무조건 잠그지 않고, 모바일은 콘텐츠 접근성을 위해 문서 스크롤을 허용한다. 홈 전용 shell은 `100dvh`/safe-area를 기준으로 설계한다.
- 홈에 노출하는 행사 카드는 `closed` 상태를 제외한다. 종료된 행사는 전체 행사/관리자/검색 등 별도 경로에서만 확인할 수 있게 한다.
- 행사 노출 정렬은 `pinned 우선 → 시작/마감이 가까운 순 → 시작일 → 안정적인 id` 순으로 정의한다. “임박”의 기준이 마감 임박인지 시작 임박인지 화면별로 명시하고, 기본 공개 카드에서는 마감 임박을 우선한다.
- pinned 글과 행사는 목록에서 시각적으로 강조하되, 색상 하나만으로 표시하지 않고 pin 아이콘·라벨·정렬 위치를 함께 사용한다.
- carousel은 버튼만 누르는 구조가 아니라 pointer/touch drag, keyboard, previous/next, `scroll-snap`을 지원한다. drag threshold와 release 시점의 페이지 이동을 정의해 작은 움직임이 오작동하지 않게 한다.
- 이미지 carousel은 현재 위치, 다음/이전 affordance, 접근 가능한 label, reduced-motion 동작을 제공한다. 브라우저 기본 가로 scrollbar를 콘텐츠 UI로 노출하지 않는다.
- 홈 캘린더 위젯은 카드의 남는 공간에 억지로 들어가는 작은 모듈이 아니라, 카드 폭과 높이를 충분히 차지하는 주요 위젯으로 재배치한다.
- 홈 게시글/일정 위젯은 내부 세로 scrollbar를 만들지 않는다. 화면에 표시할 우선 항목 수를 고정하고 전체 목록의 `더보기` 경로로 이동하게 하며, 캘린더는 데스크톱 고정 canvas 안에 월 grid가 들어오도록 밀도를 조정한다.
- 위젯 내부에는 중첩 scrollbar를 만들지 않는다. 우선순위가 낮은 항목은 line clamp·요약·더보기로 처리하고, 전체 목록은 별도 화면으로 보낸다.

#### 1.2 Header/nav toolbar

- 검색·언어·프로필/로그인 영역의 slot 폭을 텍스트 길이에 맡기지 않는다.
- KO/EN 전환이나 긴 사용자 이름이 로고·주요 nav를 밀어내지 않도록 icon button, 고정 min-width, flex-shrink 정책을 둔다.
- 모바일에서는 검색·메뉴·언어·프로필을 우선순위에 따라 배치하고, 숨겨진 텍스트는 accessible name으로 보존한다.

#### 1.3 게시판

- 게시판 추가/삭제를 관리자 기능으로 제공한다. 삭제는 기본적으로 `isActive=false` 또는 archive로 처리하고, 게시글과 첨부파일이 갑자기 고아가 되지 않게 한다.
- 게시판 설정에서 `비밀글 허용 여부`, 댓글 허용 여부, 외부 사용자 열람 여부, 좋아요 허용 여부, 작성 권한, 관리 권한을 설정한다.
- 비밀글은 게시판이 허용할 때만 작성할 수 있고, 작성자·권한 있는 운영자·허용된 참여자 외에는 제목/본문/첨부파일을 노출하지 않는다. 목록에서 제목을 그대로 반환하지 않는다.
- pinned 게시글은 일반 글보다 먼저 정렬하고 `pinOrder`를 지원한다. 같은 pinned 그룹 안의 정렬 기준을 고정한다.
- QnA 게시판은 신규 노출·작성 경로를 제거하고 Channel Talk으로 안내한다. 기존 글은 보존·archive 또는 읽기 전용 전환 여부를 migration 전에 결정한다.
- 페이지네이션은 Image #1의 정보 구조를 참고해 `페이지 크기`, `총 N건 중 x-y`, `이전`, `현재/전체`, `다음`을 제공한다. 대량 페이지에서는 일부 번호만 노출하고 현재 위치를 잃지 않게 한다.
- 모바일 페이지네이션은 44px hit area와 짧은 범위 문구를 사용한다.

#### 1.4 조회수·좋아요·스크랩·댓글

- 조회수는 인증 사용자 기준으로 동일 사용자가 같은 게시글을 1회만 증가시키도록 unique constraint와 idempotent API를 사용한다. 비로그인 조회를 허용할 경우 별도의 signed cookie/Redis rate limit 정책을 먼저 확정한다.
- 좋아요와 스크랩은 게시글 리스트·게시글 상세·행사 카드·행사 상세에서 동일한 조작 모델로 제공한다.
- 좋아요와 스크랩은 사용자-대상 unique constraint를 두고, count와 `viewerHasLiked/viewerHasScrapped`를 함께 반환한다.
- toggle API는 중복 click과 retry를 안전하게 처리하고, UI는 `aria-pressed`, optimistic state, 실패 rollback을 지원한다.
- 댓글은 기존 `parentCommentId`를 사용해 1단계 대댓글을 우선 구현한다. 깊은 무한 트리는 만들지 않고, 삭제·신고·권한·정렬 규칙을 함께 정의한다.

#### 1.5 공개 IA·행사/설문 목록 개편

- 소개 페이지들에 남아있는 hero는 완전히 제거한다. 공개 운영 화면의 첫 화면은 GNB → 필요한 경우 breadcrumb → 해당 화면의 sub-tab/filter → content 순서로 시작한다.
- 행사/설문 화면의 대제목 `행사 / 설문·투표`를 별도 큰 제목으로 반복하지 않는다. 최상단에 `행사` | `설문·투표` | `일정` sub-tab을 바로 배치하고, 탭 자체가 화면의 맥락과 현재 상태를 설명하게 한다.
- `시작 전 1`, `진행 중 1`, `마감 1`처럼 본문을 상태별 section으로 반복하지 않는다. 상단 filter chip `전체`, `시작 전`, `진행 중`, `마감`을 클릭하면 하나의 카드 grid 안에서 해당 항목만 필터링한다.
- 공개 desktop 목록은 화면 폭에 맞춰 3열을 기본으로 하고, 중간 breakpoint에서는 2열로 전환한다. 카드가 하나뿐이어도 desktop에서 불필요하게 전체 1열 폭을 차지하지 않도록 max-width/auto layout을 정의한다.
- 행사 thumbnail은 `aspect-ratio: 16 / 9` 또는 `4 / 3`을 사용한다. 포스터형 이미지는 `object-contain`/배경 여백 정책을 사용해 제목·일정·중요 내용이 잘리지 않게 한다. 이미지 비율을 맞추려고 원본을 과도하게 crop하지 않는다.
- 카드 우측 구석의 `자세히 보기 >` 같은 별도 CTA는 제거한다. 카드 전체를 semantic link로 만들고, hover/focus-visible/active 상태와 명확한 accessible name을 제공한다. 카드 안에 또 다른 링크/버튼을 중첩하지 않는다.
- 행사 카드는 이미지·상태·제목·기간·참여 범위·주요 action을 하나의 click target 안에 배치한다. 카드 내부의 action text는 별도 버튼처럼 떠 보이지 않고 링크 전체의 affordance를 보조한다.
- 페이지 배경 계층은 다음으로 고정한다: GNB는 흰색 + 하단 1px border, 페이지 body는 아주 연한 cool gray canvas, content card는 white surface. filter bar가 별도 흰색 박스로 body를 다시 자르는 sandwich layer가 되지 않도록 transparent/neutral surface를 우선한다.
- 게시글 상세와 행사/설문 상세에는 breadcrumb 또는 슬림한 back link를 둔다. 예: `게시판 > 공지`, `← 공지사항으로 돌아가기`. 상세 화면에서 기존 탭이 사라져도 사용자가 목록으로 돌아갈 경로를 잃지 않게 한다.

#### 1.6 GNB·메가메뉴 정보 구조

- 메가메뉴는 제거한다. hover로 여러 단계 메뉴를 펼치지 않고, 최상단 GNB를 3개 축으로 단순화한다.

| GNB | 성격 | 내부 sub-tab/페이지 제안 |
|---|---|---|
| 게시판 | 정보 공유·커뮤니티 | 공지사항, 홍보, 연구실(Lab), HoC, 건의사항 |
| 행사·참여 | 일정 확인·학생 참여 | 행사 신청, 설문·투표, 학사 일정(캘린더) |
| 학생회 소개 | 집행부 정보·신뢰도 | 소개·조직도, 공약 이행 현황, FAQ |

- 게시판의 `행사`는 `행사·참여`로 일원화해 중복 노출하지 않는다.
- 공약은 커뮤니티 게시판이 아니라 학생회 소개의 공약 이행 영역으로 이동한다.
- FAQ는 학생회 소개의 하위 페이지/section으로 둔다.
- QnA는 신규 게시판 메뉴·작성 경로에서 제외하고 Channel Talk으로 대체한다. 기존 QnA 글은 삭제하지 않고 read-only/archive로 보존하며, 기존 deep link에는 Channel Talk 안내 또는 보존 목록 redirect를 제공한다.
- 소개의 기본 탭은 직접 지시한 `학생회 소개 | 당해 학생회 소개 | 조직도 | Contact me`를 유지한다. 공약 이행 현황과 FAQ는 탭을 과도하게 늘리지 않도록 학생회 소개 GNB 아래 별도 compact route/link로 제공한다.
- GNB label을 바꿀 때 기존 deep link는 redirect/alias를 제공하고, 북마크·검색엔진·외부 링크가 404가 되지 않게 한다.

### Phase 2 — 작성기·임시저장·파일 저장소

#### 2.1 언어별 작성 화면

- 국문/영문 제목과 내용을 데스크톱에서 5:5로 함께 수정할 수 있는 layout을 제공한다.
- 한국어 콘텐츠인 게시판/문서에서는 국문 입력만 표시한다. 영문을 숨길 때 기존 영문 데이터가 삭제되지 않도록 데이터 보존을 분리한다.
- 모바일에서는 5:5를 억지로 유지하지 않고 국문 → 영문 순서로 stack한다.
- 게시판과 설문이 같은 텍스트 에디터 공통 컴포넌트를 사용하도록 editor state, toolbar, sanitizer, HTML/JSON 저장 형식을 통일한다.
- Markdown 단축키를 등록한다. 최소 `Ctrl/Cmd+B` 굵게, `Ctrl/Cmd+I` 기울임, `Ctrl/Cmd+U` 밑줄을 지원하고, 브라우저 기본 동작과 충돌하는 단축키는 명시적으로 방지한다.
- Markdown만으로 제한하지 않고 글자 색상과 font size를 toolbar/popover에서 설정할 수 있게 한다. 허용값을 semantic token/whitelist로 제한하고 임의 CSS 주입을 막는다.
- 링크·이미지·첨부파일 삽입, 붙여넣기, HTML sanitize, 모바일 toolbar overflow, keyboard focus를 테스트한다.

#### 2.2 임시저장

- 마이페이지의 “내가 쓴 글”과 작성 화면에서 임시저장글을 별도 목록으로 보여준다.
- 사용자가 직접 저장 버튼을 누르지 않아도 debounce 저장과 일정 간격 저장을 수행한다. 기본 제안값은 편집 후 2초 debounce + 마지막 성공 저장 후 15초 interval이며, 실제 값은 API 부하와 UX 테스트로 조정한다.
- 페이지 이탈 시 `visibilitychange`, `pagehide`, router navigation hook에서 best-effort 저장을 시도한다. 브라우저 종료 이벤트만을 유일한 저장 수단으로 사용하지 않는다.
- 저장 요청은 제목·본문·설정·첨부 참조를 canonicalize한 fingerprint와 함께 보낸다. fingerprint가 마지막 성공 저장과 같으면 요청하지 않는다.
- 자동 생성 제목은 사용자가 식별할 수 있는 고정 형식(예: `[임시저장] 새 글 · 2026-08-20 15:30`)으로 저장하고, 사용자가 제목을 입력하면 그 제목을 우선한다.
- 동일 초안의 동시 편집은 draft version/updatedAt를 이용해 충돌을 감지하고, 조용히 덮어쓰지 않는다.
- 초안 복구, 삭제, 만료 정책, 첨부파일 고아 정리, 인증 만료 시 저장 실패 메시지를 정의한다.

#### 2.3 S3 파일 저장소 전환

현재 확인 결과: `apps/api/src/features/asset/asset.storage.ts`의 `LocalAssetStorageProvider`가 파일을 `ASSET_UPLOAD_DIR`에 저장하고, compose에서 `./apps/api/uploads:/app/apps/api/uploads` volume으로 연결한다.

목표 구조:

1. `AssetStorageProvider` 인터페이스는 유지한다.
2. `S3AssetStorageProvider`를 추가하고 운영 환경에서는 S3를 선택한다.
3. 권장 업로드 흐름은 API가 presigned multipart/PUT URL을 발급하고 클라이언트가 S3에 직접 업로드하는 방식이다. 파일 bytes를 API 메모리와 로컬 디스크에 통과시키지 않는다.
4. DB에는 asset id, object key, original filename, MIME, size, checksum, owner, createdAt, link 상태를 저장한다. DB에 public URL을 저장하지 않는다.
5. 읽기는 권한 확인 후 짧은 만료의 signed URL 또는 API proxy로 제공한다. private board asset을 public bucket URL로 노출하지 않는다.
6. 기존 local asset을 checksum 검증과 함께 S3로 migrate하고, migration 완료 전까지는 read fallback을 허용한다.
7. orphan cleanup, multipart abort lifecycle, 삭제/retention 정책을 S3 lifecycle과 애플리케이션 job에 나눠 정의한다.

AWS에서 사용자가 해야 할 작업:

- S3 bucket을 생성하고 public access block, Bucket owner enforced, 기본 암호화(SSE-S3 또는 KMS)를 켠다.
- API 전용 IAM role/user를 만들고 필요한 bucket/prefix에만 `PutObject`, `GetObject`, `DeleteObject`, 필요 시 multipart 권한을 부여한다. `ListBucket`은 prefix 조건으로 제한한다.
- 로컬 개발용 key와 배포용 IAM role을 분리한다. 배포 환경에서 장기 access key를 쓰지 않는 것을 우선한다.
- CORS는 허용할 로컬/운영 origin과 `PUT`, `POST`, `GET`, 필요한 headers만 등록한다.
- incomplete multipart, 임시 draft asset, 삭제 예정 object의 lifecycle rule을 만든다.
- 기존 local 파일의 migration 시점과 bucket prefix를 정하고, rollback/read fallback 기간을 승인한다.
- 선택 사항으로 CloudFront를 앞에 둘 경우 private origin access와 signed URL 정책을 추가한다.

필요한 secret/config 값:

| 이름 | 용도 | 비고 |
|---|---|---|
| `AWS_REGION` | S3 리전 | 예: `ap-northeast-2` |
| `AWS_S3_BUCKET` | 대상 bucket | public URL을 저장하지 않음 |
| `AWS_S3_PREFIX` | object key namespace | 예: `soc/assets` |
| `AWS_ACCESS_KEY_ID` | 로컬/비-IAM-role 실행 시 access key | 운영에는 IAM role 우선 |
| `AWS_SECRET_ACCESS_KEY` | 위 access key의 secret | 저장소·채팅·프론트에 노출 금지 |
| `AWS_S3_ENDPOINT` | LocalStack 등 로컬 대체 endpoint | 실제 AWS에서는 비워둘 수 있음 |
| `AWS_S3_FORCE_PATH_STYLE` | 대체 endpoint 호환 옵션 | boolean |
| `AWS_CLOUDFRONT_BASE_URL` | 선택적 CDN base URL | signed URL 정책과 함께 사용 |

`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`는 사용자에게 받아야 하는 값이지만, 프론트의 `VITE_*`로 만들거나 Git에 커밋하지 않는다. 먼저 bucket/IAM/CORS를 만들고, 로컬에서는 최소 권한 key를 사용한다.

현재 구현 상태: `ASSET_STORAGE_PROVIDER=s3`일 때 API가 presigned PUT URL을 발급하고 브라우저가 S3에 직접 업로드한 뒤 complete 계약으로 asset을 확정한다. 기존 multipart 업로드는 호환 fallback으로 남아 있으며, 관리자용 local-to-S3 migration endpoint도 추가했다. 실제 bucket migration과 운영 전환은 AWS 설정·자격 증명·rollback 승인 이후 실행한다.

### Phase 3 — 행사·캘린더·소개·콘텐츠

#### 3.1 행사와 캘린더

- 홈 행사 카드에서는 마감된 항목을 숨기고, 행사 전체 페이지에는 필터로 접근할 수 있게 한다.
- 캘린더는 데스크톱 Google Calendar 스타일을 목표로 한다. 날짜 셀 안에 작은 dot만 찍지 않고, 일정명이 들어간 가로 event bar를 렌더링한다.
- 여러 날 이어지는 일정은 첫날·중간날·마지막날 segment가 같은 색과 연결된 모서리 규칙을 사용해 하나의 bar처럼 보이게 한다.
- 일정 bar에는 title과 필요 시 시간/상태를 표시하며, 같은 날 일정이 많을 때는 표시 가능한 행 수를 예약하고 “+N more”로 상세로 이동한다.
- 오늘, 선택 날짜, 주말, 외부 연동 일정은 색상·label·border를 함께 사용한다.
- 일정 페이지에서 일정 추가/수정/삭제를 제공한다. 권한 없는 사용자는 읽기 전용이다.
- `.ics` download는 RFC 5545 형식의 timezone/UID/DTSTAMP/DTSTART/DTEND/SUMMARY/DESCRIPTION을 생성한다.
- `.ics` import는 파일 미리보기 → 중복 판정 → 일괄 반영 순서로 처리하고, 기존 일정을 조용히 덮어쓰지 않는다.
- Google Calendar는 1차에 ICS import/export로 제공하고 OAuth 양방향 동기화는 후속 범위로 둔다. KAIST 학사일정은 공식 feed/API/다운로드 가능한 iCal이 있는 경우에만 read-only로 연동하고, 없으면 관리자 import로 대체한다.
- 일정 검색은 제목·설명·태그·기간을 대상으로 하며 결과가 캘린더 위치와 목록에서 연결되어야 한다.

#### 3.2 소개 페이지와 sticky shell

- 소개 페이지 탭을 `학생회 소개 | 당해 학생회 소개 | 조직도 | Contact me`로 변경한다.
- 탭바는 스크롤 시 sticky로 유지하고 현재 탭을 URL query/route와 동기화한다.
- 사이드바 header, 사이드바 footer action, 관리자 shell의 주요 toolbar처럼 화면을 고정해야 하는 요소를 전수 점검한다.
- sticky 요소는 z-index와 상단 offset을 명시하고, 본문 첫 행·모달·Channel Talk·safe area를 가리지 않게 한다.

#### 3.3 사이트 콘텐츠와 Footer

- 홈에서 돌아가는 사진/콘텐츠는 CMS에서 교체·순서 변경·활성화할 수 있게 한다.
- 홈 버튼 로고와 소개/로드맵은 현재 화면 템플릿을 강제로 복제하지 않고, 관리자가 콘텐츠 구조를 수정할 수 있는 block/section 모델로 검토한다.
- Footer는 연회색 배경의 짧은 한 줄 구조를 기본으로 한다.
- Footer에는 메일, Instagram, 이용약관, 개인정보처리방침, Copyright만 우선 표시한다. 요청하지 않은 장식 정보와 긴 설명은 넣지 않는다.

### Phase 4 — 마이페이지·인증·알림

#### 4.1 마이페이지

- 주전공·복수전공·부전공을 표시한다.
- “내 정보”에는 로그인 결과로 받은 정보 중 서비스 운영에 필요한 항목을 저장·표시한다. 주민등록번호 등 불필요한 민감정보는 저장하지 않는다.
- 과비 납부 여부와 기준일/학기를 표시한다.
- 스크랩한 글과 행사 목록을 별도 섹션으로 제공한다.
- 활동 내역은 게시글·댓글·설문 응답·스크랩을 통합하되, 유형/기간/검색어로 필터링한다.
- 임시저장글은 게시글 목록과 분리된 상태/필터로 제공한다.

#### 4.2 인증 상태와 알림

- SSO 응답의 소속/학적 정보를 검증한다.
- 전산학부생이 아니면 로그인 세션과 서비스 권한을 만료시키고 접근을 차단한다. 계정 DB row를 즉시 삭제하지 않고, `INELIGIBLE`/`EXPIRED` 같은 상태와 만료 사유·시각을 기록한다.
- 관리자 override가 필요한 경우 승인자·사유·만료일을 audit log에 남긴다.
- 알림은 게시글 댓글/대댓글, 좋아요/스크랩 대상 변경, 설문/행사 상태, 관리자 공지를 구분한다.
- 로그인 전에는 사용자별 알림 상호작용을 수행하지 않고, 로그인 후에만 읽음/삭제/환경설정을 허용한다.

현재 구현 상태: 전산학부 소속을 `AUTH_ELIGIBLE_DEPARTMENTS`로 검증하고, 소속 불일치·비활성 계정은 세션을 revoke한 뒤 접근을 차단한다. 댓글·대댓글 알림 저장, unread count, 단건/전체 읽음 처리는 구현했다. 좋아요·스크랩·행사·관리자 공지 알림과 사용자별 알림 설정은 후속 확장으로 남아 있다.

### Phase 5 — 관리자: 사용자·권한·과비·설문·메일·연락망·로그

#### 5.1 사용자 관리

- 재학/휴학/졸업, 개인정보 제공 동의, 전화번호, 주전공/복수전공/부전공, 과비 납부 여부를 저장·검색·필터링한다.
- 민감한 필드는 기본 마스킹하고, 권한에 따라 표시 범위를 다르게 한다.
- SSO 재동기화와 수동 수정의 우선순위, 충돌 표시, 마지막 동기화 시각을 보여준다.

현재 구현 상태: 사용자 row와 mock/SSO session에 학적 상태, 개인정보 동의, 전화번호, 주전공·복수전공·부전공, 성별, 과비 상태를 연결했고 마이페이지의 내 정보·스크랩·활동 검색에 표시한다. 관리자용 상태 편집·동기화 충돌 UI는 추가 고도화 대상으로 둔다.

#### 5.2 권한 그룹

- Image #2의 목록을 그대로 구현하지 않는다. 현재 bitmask SSOT의 기능 capability를 기준으로 `기능 권한`과 `역할 그룹`을 분리한다.
- 권한 그룹 구성원 추가는 수동 이름 추가가 아니라 DB 사용자 목록을 띄운 뒤 검색/필터링하고 체크박스로 선택해 적용한다.
- 필터 조건, 선택 수, 적용 전 preview, 적용 결과, 실패/제외 사용자를 표시한다.
- 일괄 권한 변경은 transaction과 audit log를 사용한다. 마지막 관리자 제거, 자기 자신의 권한 회수, 권한 상승은 별도 확인/보호한다.
- 관리자 메뉴는 최소 하나 이상의 관리자 capability가 있는 사용자만 접근하게 하고, 이미지의 “Default: 3, 8”을 하드코딩하지 않는다.

#### 5.3 과비 납부 관리

- 이 화면은 총무 계좌 입금 내역을 기준으로 수납 상태와 간식·복지 혜택 자격, 미납자 알림 대상을 결정하는 **단일 원장(Single Source of Truth)** 작업대다.
- 2026년 기본 체계는 6학기 일시납 45,000원이지만, 2025년 이전 기납부자의 차액과 향후 변동 금액을 처리해야 하므로 정액을 하드코딩하지 않는다. 납부 원장에는 학생별 수납액, 기준 학기에서 자동 결정되는 적용 시작 학기, 적용 학기 수, 납부 유형·수단, 납부일, 비고를 저장한다.
- 별도 학생/통계 탭을 두지 않고 3칸 KPI(총 수납 금액, 기준 학기 납부율, 미납 인원)와 기준 학기·전공·검색·`전체/완납/미납` 상태 control을 한 화면에 둔다. 6학기 유효기간이 지난 학생은 기준 학기에서 자동 미납으로 분류한다.
- 툴바·학생 table·pagination은 하나의 white container 안에 통합한다. 내보내기는 현재 필터 또는 선택 대상의 파일을 확인 모달 없이 즉시 다운로드하고, 불러오기는 형식 검증 모달을 거친다.
- 체크박스 선택으로 별도 행을 삽입하지 않는다. 선택 수와 `일괄 납부 처리` action이 table header 영역을 부드럽게 교체하며, 검색·필터·페이지 이동 후에도 선택 Set을 보존한다. 선택 수를 누르면 선택 학생 태그와 개별 제거 popover를 연다. 내보내기 라벨은 선택 수를 반영한다.
- `PaymentModal`은 선택 학생별 금액 input을 제공하고 기본값 45,000원을 채운다. 관리자는 학생별 차액을 수정할 수 있으며 납부 유형, 기준 학기에서 자동 결정되는 적용 시작 학기, 적용 학기 수, 결제 수단, 납부일, 입금자명 차이 등 비고를 함께 기록한다. 적용 시작 학기를 별도 UI로 중복 입력하지 않는다.
- table은 체크박스·이름(영문명)·학번·이메일·전공·상태·수납액 컬럼을 사용한다. 작업 컬럼이나 행 끝 아이콘은 두지 않으며 행 클릭은 우측 detail sheet로 연결한다. 학기별 납부 이력·차액/감면 사유·관리자 메모를 보여주고, 원장 이력은 감사 추적을 위해 보존하며 정정은 새 기록과 사유로 남긴다.
- 첫 진입에만 skeleton을 표시한다. 검색·필터·정렬 중에는 기존 rows를 유지하고 새 응답 도착 시 교체하며, 150ms opacity transition만 사용하고 “불러오는 중입니다” spinner/문구는 사용하지 않는다.

현재 구현 상태: `student_fee_payment` 원장과 6학기 coverage 계산, 기준 학기 기반 `완납/미납` 조회, 3 KPI, 단일 table container, persistent bulk selection, PaymentModal, XLSX import/export, detail sheet, API audit action을 연결했다. 기존 legacy 상태는 호환 조회하되 신규 납부는 원장에 기록한다. Toss 결제 연동과 자동 계좌 대사는 이번 범위에 포함하지 않는다.

#### 5.4 설문조사

- Google Forms에서 제공하는 핵심 유형을 조사해 단일/복수 선택, grid, scale, short/long text, 날짜/시간, 파일 업로드, 조건부 section을 지원한다.
- 응답 마감시각과 `closeAt` 기반 자동 종료 로직은 제거한다. 설문은 게시/비게시 및 관리자 수동 종료로 상태를 제어하며, 행사 일정 종료와 혼동하지 않는다.
- 게시판과 같은 텍스트 에디터 공통 컴포넌트를 사용한다.
- 제목/설명/공개범위/응답자 범위/결과 공개/필수 여부/질문 메타데이터가 저장되지 않거나 잠기는 오류를 재현하고 수정한다.
- 파일 업로드는 S3 asset 정책과 동일한 접근·용량·MIME·retention 정책을 사용한다.
- 질문/section 변경, 응답 제출, 결과 export, 삭제/보관 정책을 version과 audit log로 추적한다.

현재 구현 상태: 객관식/체크박스 grid와 파일 업로드 문항의 config 저장·편집·응답 입력을 구현했고, 파일 응답은 제출자 소유 asset인지 서버에서 검증한다. 게시판과 설문 설정·문항 설명이 같은 `RichTextEditor`를 사용하며, 서버는 공통 sanitizer에서 허용한 `color`/`font-size` inline style만 보존하고 공개 화면은 `RichTextContent`로 안전하게 렌더링한다. 파일 응답은 질문별 MIME(와일드카드 포함)·용량·질문 타입을 서버에서 재검증한다. 선택지별 `goToSectionByValue`를 이용한 조건부 section 이동/`SUBMIT` 종료, 공개 화면의 도달 문항만 검증, 복제 시 section ID 재매핑까지 연결했다. 설문 버전 lineage는 구현되어 있고, 구조 변경/응답 제출 audit과 결과 export 이력은 후속 범위다.

#### 5.5 메일 발송

- 발송 대상을 주전공/복수전공/부전공, 학번, 학적, 과비 상태 등으로 필터링한다.
- AND/OR 조건을 명시적으로 조합하고, 발송 전 대상 수·샘플·제외 사유를 preview한다.
- HTML 서식 입력, 템플릿 저장/불러오기, 미리보기, 첨부파일, 예약 발송, 임시저장을 제공한다.
- 이메일은 무조건 Dooray SMTP를 사용한다. generic SMTP fallback을 기본 운영 경로로 두지 않는다.
- 예약/재시도/중복 발송 방지는 queue job과 idempotency key로 구현하고, 수신자별 성공·실패·반송 결과를 기록한다.
- Dooray SMTP host, port, username, password/app password, TLS mode, from/reply-to 정책을 외부 설정으로 받는다. secret은 저장소에 넣지 않는다.

현재 구현 상태: 주전공·복수전공·부전공·학번·학적 상태 기반 AND 필터, 발송 전 대상 수/샘플 preview, HTML/plain 선택, HTML sanitize, Dooray SMTP 전용 환경변수, private asset 첨부(소유권·총 용량 검증), 예약 worker/DB claim, 서버 임시저장, 사용자 템플릿 CRUD, idempotency key, 예약 취소·실패 재시도를 연결했다. Redis queue와 수신자별 delivery result/반송 결과는 아직 후속 범위다.

#### 5.6 집행위 연락망

- 필드는 이름, 성별, 직책, 기수(optional), 메일, 전화번호로 정의한다.
- 검색·필터·정렬을 제공하고, XLSX 일괄 입력/출력을 지원한다.
- 개인정보 제공 미동의 상태가 확인되면 정책에 따라 공개 노출을 제거하거나 익명화한다. 삭제 대상과 보존 대상은 audit log에 남긴다.
- 공개 Contact 화면은 필요한 최소 정보만 표시하고, 관리자 화면은 권한에 따라 전화번호·메일을 마스킹한다.

현재 구현 상태: 성별·기수·개인정보 동의 필드를 schema/계약/XLSX import에 연결했고, 관리자 전용 `/contacts/manage`에 이름·직책·메일·전화번호·성별·기수 검색, 페이지네이션, 필터 기준 XLSX 출력을 연결했다. 관리자 화면의 전화번호·메일 기본 masking/표시 토글을 제공하며, 개인정보 미동의 row 자동 purge와 `CONTACT_PRIVACY_PURGE` audit 기록을 연결했다.

#### 5.7 운영 로그

- 운영 로그는 CRUD 목록이 아니라 변경·실행 내역을 보존하는 불변 증적 콘솔이다. 상단 `/health` 상태 배너와 새로고침 action은 화면에서 제거한다.
- 단일 white container 안에 담당자·대상·액션 검색, 도메인 filter, 기간 filter, 총 건수, table, pagination을 배치한다. 내보내기는 현재 검색/도메인/기간 조건에 맞는 전체 구간을 `.xlsx` 바이너리로 생성해 즉시 다운로드한다.
- checkbox와 눈알 action column은 두지 않는다. row 전체를 click/keyboard focus할 수 있게 하고 우측 `AuditLogDetailSheet`를 연다.
- API는 문장형 action 대신 `domainLabel + actionLabel`과 `eventKind`를 제공한다. 대상 UUID를 목록에 직접 노출하지 않고, 사용자 대상은 `이름 (학번)`, 콘텐츠는 제목, batch 수납은 `N명 학생회비 수납 대상`처럼 읽을 수 있는 label로 치환한다.
- 상세 Sheet는 UPDATE의 before/after diff, EXECUTE/BATCH의 파라미터·성공/실패 요약, CREATE/DELETE의 대상 snapshot을 다형적으로 표시한다. IP·event ID·raw payload는 최하단 `기술 메타데이터 (JSON)` 접이식 영역으로 격리한다.
- 첫 진입에만 skeleton을 보여주며 검색/기간 변경 시 기존 rows를 유지하고 새 응답 도착 때 교체한다. spinner·상태 배너가 layout을 밀어내지 않도록 한다.

현재 구현 상태: 기간·도메인·검색·정렬 filter, filtered `.xlsx` export, 도메인/명사형 action/사람이 읽는 target label API, row click detail Sheet의 UPDATE/EXECUTE/CREATE/DELETE 분기, technical metadata accordion, 공통 pagination과 initial skeleton/old-row opacity transition을 연결했다. export 자체를 감사 이벤트로 다시 기록하는 정책은 이벤트 폭증과 자기참조 문제를 검토한 뒤 별도 결정한다.

## 2. 데이터·API 변경 묶음

정확한 테이블/endpoint 이름은 Phase 0 계약 확정 때 결정하지만, 다음 aggregate를 기준으로 분리한다.

| 묶음 | 필요한 모델/제약 | 핵심 API/작업 |
|---|---|---|
| Board | board settings, active/archive, secret policy, pin order | board CRUD/settings, article secret validation, pinned list |
| Article engagement | article view unique, like, scrap, counts | idempotent view/like/scrap toggle, list/detail viewer state |
| Draft | draft owner, target type, fingerprint, version, expiresAt | create/update/recover/delete draft, conflict response |
| Comment | parent depth, status, moderation metadata | reply list/create/delete/report, permission guard |
| Calendar | event source, recurrence/ICS UID, external source, search index | CRUD, ICS import/export, external sync, search |
| Asset | provider/object key/checksum/link/retention | presign/complete/read/delete/migrate/cleanup |
| User profile | academic status, majors, consent, fee status, access status | SSO sync, admin filters, profile summary |
| Notification | recipient, type, target, readAt, preference | list/read/read-all/preferences |
| Permission | role group, capability, membership, effective dates | filtered member selection, bulk apply, preview/audit |
| Survey | rich question types, file response, version, no response deadline | editor/mutation/response/export |
| Email | audience query, template, draft, schedule, delivery result | preview/draft/schedule/send/cancel/export |
| Audit | structured action, target, before/after summary, request id | filter, pagination, export |

모든 unique constraint와 권한 판정은 DB/API 양쪽에서 검증한다. frontend에서 버튼을 숨기는 것은 권한 보장의 대체물이 아니다.

## 3. 테스트와 완료 기준

### 기능 테스트

- board 추가/비활성화/복구, secret 허용/차단, pinned ordering, QnA read-only 전환
- 동일 사용자 조회수 1회, like/scrap 중복 요청, 권한 없는 대상 접근
- 초안 fingerprint no-op, interval/autosave, pagehide best-effort, 충돌 복구
- 한국어 전용/한영 split editor, Markdown shortcut, color/font-size sanitize
- S3 presign/complete/read/delete, local-to-S3 migration, orphan cleanup
- multi-day calendar bar, ICS round-trip, duplicate import, search
- academic eligibility login expiry, notification read state, user profile privacy
- permission filtered checkbox apply/rollback/audit, fee XLSX preview/bulk update/statistics
- survey grid/file upload/no-deadline, email audience preview/Dooray SMTP/draft/schedule, contacts consent purge, audit export

### UI·접근성 테스트

- desktop 1280px, mobile 390px, keyboard-only, screen reader label, reduced motion
- 홈 body scroll 잠금과 zoom/좁은 화면에서의 fallback
- carousel pointer drag/keyboard/press-and-hold, scrollbar 미노출, focus return
- sticky tab/sidebar/header/footer의 겹침과 safe area
- 5:5 editor의 desktop split과 mobile stack
- 이미지 #1 정보 구조에 맞는 pagination과 관리자 테이블의 checkbox/필터/페이지네이션

### 운영·보안 테스트

- migration fresh DB와 기존 DB upgrade
- Docker health/readiness, API `/health`, Postgres/Redis 장애 상태
- S3 bucket public access 차단과 signed URL 만료
- secret scan, upload MIME/size/path traversal, HTML/editor sanitize
- 민감정보가 API response, access log, audit payload, mail preview에 과다 포함되지 않는지
- 일괄 작업 idempotency, retry, partial failure, export 권한

## 4. 사용자에게 필요한 외부 준비 작업

### AWS S3

1. bucket/region/prefix 결정
2. public access block·암호화·lifecycle·CORS 설정
3. API용 최소권한 IAM role 또는 로컬 전용 access key 발급
4. 기존 local uploads migration 승인 및 rollback 기간 결정
5. 아래 환경변수를 배포 secret/config에 주입

애플리케이션에 전달할 값:

```dotenv
ASSET_STORAGE_PROVIDER=s3
AWS_REGION=ap-northeast-2
AWS_S3_BUCKET=<private-bucket-name>
AWS_S3_PREFIX=soc/assets
AWS_S3_ENDPOINT=
AWS_S3_FORCE_PATH_STYLE=false
AWS_ACCESS_KEY_ID=<local-or-ci-only-key>
AWS_SECRET_ACCESS_KEY=<local-or-ci-only-secret>
```

`AWS_ACCESS_KEY_ID`와 `AWS_SECRET_ACCESS_KEY`는 배포 환경에서 IAM role을 사용할 수 있으면 넣지 않는 것을 권장한다. 장기 access key를 저장소에 commit하거나 채팅으로 보내지 말고 `.env.local`, CI secret, 배포 secret manager에만 넣는다. 현재 구현은 presigned direct upload/complete와 API 권한 확인 후 private object proxy를 지원한다. 운영 전환 뒤에는 기존 local asset을 migration endpoint로 옮기고, S3 CORS·bucket policy·rollback을 검증한다.

### Dooray SMTP

1. 발신 도메인/계정과 SMTP 사용 가능 여부 확인
2. SMTP host/port/TLS 방식 확인
3. SMTP username/password 또는 app password 발급
4. 허용된 From/Reply-To 주소 확정
5. 개발에서는 반드시 dry-run/allowlist로 테스트한 뒤 운영 발송 활성화

현재 메일 발송 경로는 generic `SMTP_*` fallback을 사용하지 않고 `DOORAY_SMTP_HOST`, `DOORAY_SMTP_PORT`, `DOORAY_SMTP_USER`, `DOORAY_SMTP_PASSWORD`, `DOORAY_SMTP_SECURE`, `EMAIL_FROM`을 기준으로 한다. HTML/plain 본문, 수신 대상 preview, Dooray 첨부파일, 예약 발송(`BULK_EMAIL_SCHEDULER_*`), 관리자별 임시저장과 정적 템플릿 불러오기를 구현했다. 운영 전에는 예약 worker를 단일 runner로 둘지, 다중 API 인스턴스에서 DB claim을 유지할지 결정하고, 영속 사용자 템플릿 CRUD는 후속 범위로 남긴다.

### 외부 캘린더

1. Google Calendar를 read-only iCal로 제공할지 OAuth로 연결할지 결정
2. KAIST 학사일정의 공식 iCal/API/feed 위치 확인
3. 동기화 주기, 중복 판정, 외부 일정 수정 권한(기본 read-only) 결정

## 5. 원문 요구사항 보존

아래는 이번 계획을 만들 때 요약으로 소실하지 않기 위해 사용자의 직접 지시를 보존한 것이다. 첨부 이미지의 문구나 레이아웃 지시는 여기에 포함하지 않고, 위 0장 표에서 참고 자료로 구분했다.

> 홈화면 스크롤 안되게 하기, 행사 카드 마감된거 안뜨게, 핀을 우선순위로, 임박 순으로 정렬, 드래그해도 carousel 넘어가지게 변경(모던한 방식으로 고치기) 홈화면 캘린더를 카드 너비와 높이 충분히 차지하게 변경. 위젯(ex: 게시글 카드) 안의 스크롤바 제거. nav 툴바 (검색, 언어, 프로필)의 너비의 텍스트 의존성 제거. 글 작성 페이지에서 국문/영문 제목/내용이 5:5로 같이 보여서 수정할 수 있게(한국어 콘텐츠면 국문만), 마크다운 단축키 등록(ex: 굵게 - Ctrl+B)
>
> 게시판의 추가와 삭제가 가능하게 만들기, 비밀글 기능 만들기 (게시판 설정에서 비밀글 허용 여부 결정), 마이페이지에서 내가 쓴 글에서 임시저장글 따로 볼 수 있게 하기. (임시저장은 사용자가 직접 누르지 않아도 자동 간격으로/페이지 나갈때 진행하고(특정 제목으로), 수정된게 있어야 요청되고 DB에 작성되게 하기. (대충 임시저장 로직 어떻게 만들어야 하는지 알지? 그렇게 하면 된다) 텍스트에디터에 글자 색상, font size도 설정 가능하게 하기(not only markdown). 지금 이미지랑 첨부파일 등 어디에 저장되는지 확인하고, 서버에 저장되고 있다면 그렇게 하지 말고 aws s3에 저장하도록 로직 수정하기. (그 대신 내가 aws에서 해야 하는 작업들과 줘야하는 secret 값 알려줘.)
>
> QnA 게시판 삭제(채널톡으로 대체), FAQ 페이지 추가, 조회수 유저 한명이 1번 늘리게 변경, 좋아요/스크랩 기능 추가(게시글 리스트, 행사 페이지 어디서든 가능해야 함), pinned 글 리스트에서 강조, 페이지네이션 고도화(이미지 참고), 대댓글 기능 추가
>
> 캘린더 모던하게 변경(데스크탑 구글 캘린더 스타일로, 여러 날 이어진 일정은 일정 bar도 이어져야 함. dot이 아니라 일정명이 들어간 일정 bar가 있어야 함.) 일정 페이지에서 별도로 일정 추가 기능을 구현하기 (+ .ics download/import, 구글 캘린더와 카이스트 학사일정 연동 가능하면 매우 좋을듯) 일정 검색 기능도 구현하기.
>
> 소개 페이지 탭: 학생회 소개 | 당해 학생회 소개 | 조직도 | Contact me 로 변경. 탭바 fix하기(외에도 사이드바 헤더, 사이드바 푸터 액션 버튼 등 sticky 적용해야하는 애들 찾아서 적용하기)
>
> 마이페이지에 주전공/복수전공/부전공 표시해야 함. "내 정보" 탭에다가 로그인 결과 나오는 모든 정보들 다 저장해서 표시하기. 과비 납부 여부도 표시하고 유저 정보들 중 중요한것만 표시. 마이페이지에서 스크랩한 글/행사 볼 수 있어야 함. 활동내역 검색기능.
> 알림기능 추가. 로그인했을때 전산학부생 아니면 계정 권한 expire,
> 유저 관리 페이지 고도화하기 (재학/휴학/졸업, 개인정보 제공동의, 전화번호, 주전/복전/부전, 과비 납부 여부, ...)
>
> (이미지 2 참고) 권한 로직 수정해. (저걸 그대로 구현할 필요는 없음. 너의 판단 하에 구현하고 이미지에 나와있는 지시와 달라진 부분만 정리해.) 권한 그룹 구성원에서 사용자 추가가 아니라 DB 띄워서 filtering 기능 있고 체크박스로 체크하고 적용할 수 있게 하기.
>
> (이미지 3 참고) 과비 납부 관리 기능 고도화
>
> 설문조사 기능 고도화 (구글폼에서 가능한건 다 되어야 함 (ex: 그리드, 첨부파일도 업로드 가능해야 함, 응답 마감시각 필요없으니 관련로직삭제), 설문조사도 게시판과 똑같은 텍스트에디터 공통 컴포넌트 적용. 메타데이터 설정이 막혀있는 등 각종 오류 있음.
>
> 메일 발송 기능 고도화: 주전/복전/부전, 학번 등 필터링, AND 등 보낼 대상 자세하게 확정할 수 있게 하기. HTML 서식 붙이고 서식 불러오기(템플릿) 기능 추가. 메일 예약, 파일 첨부, 서식 미리보기, 임시저장 기능 추가. 이메일 발송은 무조건 Dooray SMTP로 수정.
>
> 집행위 연락망 관리는 이름/성별/직책/기수(optional)/메일/전화번호, 필터링 검색 있어야 하고 개인정보 갱신 자동으로 (개인정보 제공 미동의면 날리기), 일괄입력/출력(.xlsx)
>
> 사이트 콘텐츠 고도화 (홈에서 돌아가는 사진, 홈 버튼 로고, 소개/로드맵은 변경되는 소개 페이지에 맞추어 수정 가능하게(이상한 템플릿 강제하지 말고), 푸터 높이 매우 줄이고(연회색 배경) 정보는 한줄로 표시. 메일/instagram 기본 정보랑 이용약관 / 개인정보처리방침 / Copyright 정도만 넣기 (이상한거 넣지마)
>
> 운영 로그 너무 기능이 없고, 어려움 (backend server /health 창 정도의 수준으로 올리면 좋을듯), 기간 filter와 filtered logs export 가능해야함. (이런 테이블은 항상 체크박스 컬럼/페이지네이션 두기)

## 6. 다음 구현 시작점

기반 batch는 이미 반영했으므로 다음 순서는 미완료 항목의 의존성을 기준으로 한다.

1. Docker fresh/upgrade migration과 설문 grid·파일 upload runtime smoke
2. Redis queue 전환과 수신자별 delivery result/반송 결과, 메일 worker 운영 hardening
3. 설문 질문별 MIME/용량 서버 검증, version/audit과 관리자 metadata 편집 보강
4. S3 운영 bucket 설정 후 local asset migration 및 signed read 전환
5. 설문 version/audit와 응답 결과의 변경 이력
6. S3 운영 bucket 설정 후 local asset migration 및 signed read 전환
7. Google/KAIST 외부 calendar URL을 실제로 설정하고 read-only sync 운영 검증
8. 관리자 사용자 SSO 동기화 충돌 UI와 Redis queue/수신자별 email delivery result

각 batch가 끝날 때 `typecheck`, `lint`, 관련 API test, migration test, 브라우저 desktop/mobile 검증과 변경된 권한 목록을 함께 기록한다.

## 8. 이번 구현 배치 기록 (2026-08-20)

이번 배치에서 실제로 코드와 로컬 DB까지 반영한 범위는 다음과 같다.

- 공개 shell: decorative hero 제거, compact page context/breadcrumb, 3단 GNB, compact footer, 행사·설문 3/2/1열 카드와 전체 카드 링크를 적용했다.
- 홈: 데스크톱 `100dvh` canvas와 모바일 문서 스크롤 정책, 종료 행사 제외, pinned/임박 정렬, pointer/touch carousel drag, 홈 캘린더의 제목 bar를 적용했다.
- 홈 visual QA: 위젯 내부 세로 scrollbar를 제거하고, seed poster를 neutral flat SVG로 교체했으며, 포스터는 `object-contain`으로 렌더링한다. desktop home의 body/main scrollHeight가 viewport와 일치하는 것을 확인했다.
- 작성기: 국문/영문 입력 구조, `Ctrl/Cmd+B` 등 editor 단축키, 글자 색상/font size, 비밀글 설정을 반영했다.
- 게시판 데이터: `is_secret`, 인증 사용자당 1회 조회수, 사용자별 LIKE/SCRAP unique 상태·count, secret 접근 마스킹/권한 검사를 추가했다.
- 임시저장: `article_draft`와 fingerprint/version 기반 저장 API, 2초 debounce·pagehide/visibility best-effort, 마이페이지 별도 임시저장 목록을 연결했다.
- 게시판 관리: `ADMIN` 전용 추가/수정/비활성화/복구 API와 화면을 추가했다. 삭제는 게시글·첨부파일을 보존하는 archive(`is_active=false`)다.
- Q&A/FAQ: 신규 QnA 작성·공개 탐색은 막고 기존 deep link는 읽기 전용 경로로 남겼으며, Channel Talk 안내와 `/about/faq` 페이지를 추가했다.
- 캘린더: `calendar_event` 별도 테이블, 운영진 직접 일정 CRUD/archive, 제목·장소 검색, `.ics` import/export를 추가하고 행사 일정은 `startAt/endAt` 범위로 반환하도록 확장했다. `CALENDAR_EXTERNAL_ICS_URLS`를 설정한 경우 관리자 화면의 외부 동기화가 HTTPS ICS feed를 읽고 UID 중복을 건너뛰며, 실제 Google/KAIST feed 주소 설정과 운영 검증은 외부 준비 이후로 남겼다.
- 파일 저장소: 기존 Docker `apps/api/uploads` local provider를 개발 기본값으로 유지하면서, `ASSET_STORAGE_PROVIDER=s3`일 때 private S3에 저장·조회·삭제하는 provider와 환경변수 검증을 추가했다. 브라우저 직결 presigned upload/complete와 관리자용 기존 local asset migration endpoint를 연결했으며, 실제 migration 실행은 AWS secret·bucket 설정 이후로 남겼다.
- 상호작용: 게시글 목록·행사 카드에서 카드 링크와 분리된 좋아요·스크랩 action을 추가하고, optimistic update 실패 rollback·로그인 안내·`aria-pressed`를 적용했다. 댓글은 1단계 대댓글 작성 UI와 깊이 제한 validation을 추가했다.
- 정책 화면: 푸터의 `/terms` 링크에 compact 이용약관 화면을 연결했다.
- 설문 응답 일정: `closeAt` 기반 응답 마감/자동 종료와 문항별 `editDeadlineAt` 입력·검증을 제거했다. 설문은 상시 또는 `openAt` 이후 공개 상태로 운영하고, 응답 수 제한·게시/보관 상태를 별도 정책으로 사용한다. 기존 DB의 레거시 시간 컬럼은 호환성을 위해 남겨 두되 API/UI/캘린더에서는 읽거나 쓰지 않는다.
- 사용자·마이페이지: 전산학부 eligibility fail-closed, 프로필/학적/전공/과비 필드, 스크랩 목록, 활동 검색, 댓글·대댓글 알림과 읽음 처리를 연결했다.
- 관리자: 권한 그룹 후보 DB filtering/checkbox apply, `PAID/PARTIAL/UNPAID` 과비 관리·XLSX·통계, audit 기간 filter/export를 연결했다.
- 설문: grid single/multiple와 file upload 문항 config/응답/소유권 검증, 게시판 공통 `RichTextEditor` 기반의 설문·section·문항 설명 입력, 공통 서버 style sanitizer와 공개 rich-text viewer를 추가했다. 제출 시 질문별 MIME/용량/질문 타입을 서버에서 재검증하고, 선택지별 조건부 section 이동/제출 종료와 복제 시 branch target 재매핑을 연결했다. version lineage는 구현되어 있고 구조 변경/응답 결과 audit은 남아 있다.
- 메일·연락망: Dooray SMTP 전용 환경변수, HTML/plain 본문, 수신 대상 AND filter/preview, 예약 발송 worker, 첨부 asset 소유권·용량 검증, 관리자별 임시저장, 정적·사용자 정의 템플릿 CRUD, idempotency key, 예약 취소/실패 재시도, 연락망 성별·기수·동의/XLSX·필터·masking·purge audit을 연결했다. Redis queue와 수신자별 delivery result/반송·재시도 이력은 남아 있다.

검증 결과: contracts/api/api-client/web의 build·typecheck·lint와 `git diff --check`를 반복 통과했다. Docker에 `0018`/`0019` 이메일 예약·첨부·임시저장·template/idempotency migration을 적용했고, health·draft 조회/저장·예약 발송 후 `DRY_RUN` 전환·첨부 발송 레코드(`attachmentCount=1`)·template CRUD·idempotency·예약 취소·contacts manage/XLSX를 smoke test했다. survey file MIME/용량 서버 검증과 외부 ICS sync는 실제 feed/AWS 준비 이후 운영 검증한다.

## 9. Google·KAIST 캘린더 연동 확정안 (2026-08-20)

이번 배치에서 캘린더 공급원과 발행 방향을 다음처럼 확정한다.

- 사이트 DB가 학생회 직접 등록 일정의 canonical source다. 사이트에서 만든·수정한·숨긴 일정은 `GOOGLE_CALENDAR_ID`의 학생회 행사 캘린더로만 단방향 발행한다.
- KAIST 학사일정은 KAIST 공식 월별 POST endpoint를 순차적으로 수집하여 사이트 DB에 `KAIST_ACADEMIC`·`isReadOnly=true`로 저장한다. 관리자 화면에서는 읽기만 가능하고, 수집된 일정은 `GOOGLE_KAIST_CALENDAR_ID`의 별도 학사일정 캘린더로 단방향 발행한다.
- Google에서 사이트로 역동기화하지 않는다. Google 캘린더에서 임의로 수정한 값은 사이트 canonical source를 덮어쓰지 않으며, 사이트가 관리하는 event id/etag로 충돌을 감지해 `CONFLICT` 상태를 남긴다.
- Google API 호출은 DB `calendar_sync_job` outbox를 거친다. 직접 등록·수집·숨김 변경은 pending job으로 만들고, 1분 worker가 처리하며 실패는 최대 8회 지수 backoff로 재시도한다.
- KAIST 수집은 `@Cron("0 4 * * *", { timeZone: "Asia/Seoul" })`에서 실행한다. 12개월을 `Promise.all`로 동시에 요청하지 않고 `for...of`와 요청 사이 300ms delay를 사용한다. 12개월 중 일부가 실패하면 기존 일정 archive를 실행하지 않는다.
- `sourceUid`는 정제된 제목과 전체 기간을 포함한 SHA-256을 사용한다. 형식은 `${year}-${startMonth}-${startDate}-${endDate}-${cleanTitle}`을 기반으로 하며, 월별 endpoint에서 같은 일정이 반복되어도 정규화 후 하나만 남긴다.
- ICS의 all-day `DTEND`와 Google all-day `end.date`는 RFC 5545의 non-inclusive 규칙을 따른다. 사이트 UI/DB의 종료일은 사용자가 보는 inclusive 날짜로 유지하고 외부 발행 시 다음 날을 exclusive end로 변환한다.
- 서비스 계정 JSON은 `secrets/google-calendar-service-account.json`에 두고 `.gitignore`로 제외한다. Docker는 이 파일을 API 컨테이너의 `/run/secrets/google-calendar-service-account.json`에 read-only로 mount한다. Google Calendar API에는 `calendar.events` scope만 사용한다. 운영 환경에서는 저장소에 파일을 배치하지 않고 secret mount를 사용한다.
- 실제 AWS S3 사용 시 `AWS_S3_ENDPOINT`는 빈 값이다. endpoint는 LocalStack 같은 S3 호환 로컬 서버가 필요할 때만 지정하고, AWS SDK의 기본 regional endpoint와 `AWS_S3_FORCE_PATH_STYLE=false`를 사용한다.
- Dooray SMTP는 AutoConfig 결과인 `smtp.dooray.com:465` SSL, `kaist.helloworld@kaist.ac.kr` 계정/from을 사용한다. `EMAIL_DRY_RUN=true`는 실제 발송 전 검증이 끝날 때까지 유지한다.

검증 acceptance: ① 2026년 수동 KAIST sync에서 source UID 중복이 없고 KST 날짜가 맞다. ② 부분 월 실패 시 기존 row가 숨겨지지 않는다. ③ 학생회/KAIST Google 캘린더가 서로 섞이지 않는다. ④ Google 변경은 사이트를 덮어쓰지 않고 etag 충돌을 표시한다. ⑤ 서비스 계정·SMTP password·AWS secret이 build log와 문서 출력에 노출되지 않는다.

외부 운영자가 해야 할 작업은 별도 prerequisite로 둔다. Google Cloud에서 Calendar API를 활성화하고, 서비스 계정 JSON의 `client_email`을 학생회 행사 캘린더와 KAIST 학사일정 캘린더에 각각 `이벤트 변경` 권한으로 공유해야 한다. 현재 로컬 검증에서는 서비스 계정 토큰 발급은 성공했지만 두 캘린더 metadata 조회가 HTTP 403이어서 이 공유 단계가 아직 완료되지 않은 것으로 확인했다. 공유가 완료되기 전에는 `GOOGLE_CALENDAR_SYNC_ENABLED`와 `KAIST_CALENDAR_SYNC_ENABLED`를 켜더라도 outbox가 Google에 발행하지 못한다.

## 7. 추가 피드백 원문 보존

아래는 이후 구현에서 의도를 잃지 않기 위해 이번에 추가된 피드백을 가능한 한 원문에 가깝게 보존한 것이다. 구현 시에는 위 계획의 충돌·의존성·현재 코드 전제를 함께 확인한다.

> 소개 페이지들에 남아있는 hero도 완전히 제거해.
>
> * **레이아웃 3열 그리드화**
> 화면 전체를 채우는 1열 배치를 **3열(또는 2열) 카드 그리드**로 변경
>
> * **썸네일 비율 정상화**
> 극단적으로 납작한 띠 형태를 **16:9 또는 4:3 비율**로 변경 (포스터/이미지 잘림 방지)
>
> * **본문 소제목(`시작 전 1`, `진행 중 1`) 제거**
> 본문 텍스트를 없애고, 상단 필터 칩(`전체`, `시작 전`, `진행 중`, `마감`) 클릭 시 해당 카드만 필터링되도록 통일
>
> * **상단 타이틀 3중 중복 정리**
> 대제목(`행사 / 설문·투표`)을 없애고 서브 탭(`행사` | `설문·투표` | `일정`)을 바로 최상단에 배치
>
> * **카드 클릭 인터랙션 개선**
> 우측 구석의 `자세히 보기 >` 버튼을 없애고, 카드 전체를 클릭 가능한 링크(Hover 효과 포함)로 변경
>
> 배경색 계층(Layer) 정리: "줄무늬 현상" 제거
> 현재 화면은 GNB(흰색) → 제목 영역(흰색) → 본문(회색) → 필터 바(흰색 박스) → 본문(회색) → 카드(흰색)처럼 흰색과 옅은 배경색이 샌드위치처럼 번갈아 나타나 시선이 분산됩니다. (GNB&헤더 배경은 흰색+하단 1px 연한 테두리, 페이지 본문 배경은 아주 연한 쿨그레이로, 콘텐츠 카드는 디자인 문서 참고)
>
> 게시글 상세 화면 등에서는 페이지 헤더에 breadcrumb 추가. (글을 읽는 화면에서는 탭이 사라지므로, 좌측 상단에 ← 공지사항으로 돌아가기 형태의 슬림한 백링크나 미니멀한 텍스트 경로(게시판 > 공지)를 두면 충분)
>
> 메가메뉴 제거해.
>
> 세부사항:
>
> 복잡하게 느껴지는 이유는 메뉴 간 중복(게시판에도 '행사'가 있고, 상단에도 '행사'가 있음)과 **너무 잘게 쪼개진 '소개' 하위 메뉴들** 때문입니다.
>
> 공약과 FAQ를 포함해 가장 깔끔하게 떨어지는 **최종 3단 GNB 구조**로 정리합니다.
>
> | GNB 메뉴 | 성격 | 내부 서브 탭 (또는 하위 페이지) |
> | --- | --- | --- |
> | **게시판** | 정보 공유 및 커뮤니티 | `공지사항` `홍보` `연구실(Lab)` `HoC` `건의사항` `Q&A` |
> | **행사·참여** | 일정 확인 및 학생 참여 | `행사 신청` `설문·투표` `학사 일정(캘린더)` |
> | **학생회 소개** | 집행부 정보 및 신뢰도 | `소개·조직도` `공약 이행 현황` `자주 묻는 질문(FAQ)` |
>
> - **게시판 내 '행사' 제거**: 게시판 목록에 있던 '행사'는 `행사·참여` 탭으로 일원화하여 중복을 없앱니다.
> - **공약의 위치**: 공약은 커뮤니티가 아니라 '학생회 소개'에 들어가는 것이 정석입니다. 집행부의 약속과 현재 이행률(Progress)을 보여주는 영역이기 때문입니다.
> - **FAQ의 위치**: 학생회 복지사업, 과방 이용, 물품 대여 등에 관한 질문이 주를 이루므로 **'학생회 소개'** 하위 탭으로 두는 것이 자연스럽습니다.
>
> - **'행사 / 설문·투표 / 일정' 탭 유지 여부**: 탭으로 유지하는 것이 맞습니다. 이 셋은 '학생들이 직접 일정을 확인하고 참여(신청/투표)하는 행동'이라는 공통 맥락(Context)을 가지므로 한 페이지 안에서 탭(`[행사] [설문·투표] [일정]`)으로 전환하게 둡니다.
> - **'소개 / 연혁 / 조직도 / 구성원' 처리 방법**: 이 4개를 각각 개별 페이지로 분리하면 클릭만 많아지고 내용이 텅 비어 보입니다. **`소개·조직도`라는 1개 단일 페이지로 합치고**, 위에서부터 `학생회 슬로건 → 조직도 및 구성원 카드 → 하단 연혁 타임라인` 순서로 스크롤되게 구성합니다.
>
> 화면 상단 헤더 최종 가이드 예시:
>
> ```text
> [ GNB ] KAIST SOC        게시판      [행사·참여]      학생회 소개
> ---------------------------------------------------------------------
> (Header - 흰색 배경)
> 행사·참여                 [ 행사 신청 ]  [ 설문·투표 ]  [ 학사 일정 ]
> ---------------------------------------------------------------------
> (Body - 연회색 캔버스 #F8FAFC)
> [전체] [진행 중] [마감]                                 [최신순 ▼]
>
> [ 카드 1 (3열) ]        [ 카드 2 (3열) ]        [ 카드 3 (3열) ]
> ```
>
> 이렇게 구성하면 메가메뉴를 완전히 걷어내도 GNB 3개만으로 모든 기능을 직관적으로 분류합니다.

## 11. 작성/수정 에디터 후속 구현 기록 — 2026-08-22

이번 작업의 직접 요구사항은 기존 화면 구조와 공통 control 규칙을 유지하면서 다음처럼 반영한다.

- `BoardWriteEditorFields`는 언어 탭 없이 국문·영문 editor를 세로로 배치한다. 한국어 전용이면 영문 editor와 중간 divider를 렌더링하지 않는다. 이벤트 설명 입력도 같은 규칙을 사용한다.
- 에디터 폭은 `PageContainer`의 본문 폭을 공유한다. 설정 제목/아이콘은 제거하고, 게시판의 비밀글 허용 설정이 true일 때만 비밀글 checkbox를 노출·전송한다.
- 하단 action은 왼쪽 취소(ArrowLeft), 오른쪽 임시저장·등록/수정 순서로 정렬하고 기존 공통 `Button`을 사용한다.
- `RichTextEditor`는 custom `SelectDropdown`으로 지정된 8~96px 목록을 제공하고, 글자색/배경색은 8색 palette와 HEX 입력을 제공한다. 저빈도 서식은 세로 점 3개 메뉴로 이동한다.
- native select와 raw editor toolbar를 새로 만들지 않으며, reset이 control의 기본 서식을 덮어쓰지 않도록 공통 Button/Dropdown 스타일을 명시한다. 에디터 캔버스에는 별도 hover/focus decoration을 두지 않는다.
- 참고 사이트 `https://v26.jshsus.kr/boards/free/new`는 버튼·dropdown 밀도와 동작을 비교하는 시각 참고로만 사용했다. 기존 디자인 철학과 충돌하는 피드백은 수정하지 않고 보류한다.

검증: `pnpm --filter @soc/web lint`, `pnpm --filter @soc/web build` 통과. Docker web image는 `docker compose up -d --build web`로 갱신했고, API health check도 200을 확인했다. 로컬 Chrome에서는 API 기동 직후 일시적인 mock SSO/API 502가 있었지만 복구 후 작성 화면에 진입해 글자 크기 dropdown, 더보기 메뉴, 글자색/배경색 palette와 HEX 입력, 한국어 전용 토글을 실제로 확인했다. 저장/등록을 실행하지 않아 데이터 변경은 발생시키지 않았다.

## 12. 게시글 상세 액션·댓글 후속 구현 기록 — 2026-08-22

- 상세 헤더의 수정/삭제를 작성자 전용 icon-only action으로 옮기고, 본문 헤더의 가로 구분선과 기존 헤더 engagement row를 제거했다. 좋아요·스크랩·공유는 하단 floating dock로 이동했으며 공유는 Web Share API 또는 URL clipboard fallback을 사용한다.
- 게시글 메타데이터는 `YYYY.MM.DD HH:mm`/medium/muted 규칙을 적용했다. 이전글·다음글 카드는 제거하고 `목록으로` back-link를 카드 바깥에 배치했다.
- 댓글 제목·수·본문·작성자·메타데이터 위계를 직접 지정했다. 댓글 입력은 공통 `CommentComposer`로 분리하고, 빈 입력과 입력 완료 상태의 원형 ArrowUp action을 구분한다.
- 댓글 좋아요와 신고는 `comment_engagement`, `comment_report` 테이블 및 사용자별 unique key를 추가했다. `/comments/:commentId/engagements/like`와 `/comments/:commentId/report` API는 로그인·게시글 가독성·댓글 존재를 확인한다. 신고는 확인 dialog를 거치며 같은 사용자의 중복 신고는 idempotent 처리한다.
- 당시 개별 migration으로 적용했던 댓글 반응 변경은 2026-08-28 migration squash 후 `apps/api/drizzle/0000_baseline.sql`에 포함되었다.

검증: 공유 contracts/api-client build, API typecheck/lint, Web lint/build 통과. `GET /health` 200 및 댓글 목록 API의 `likeCount`, `viewerHasLiked`, `viewerHasReported` 계약을 확인했다. 댓글 좋아요/신고는 테스트 데이터 변조를 피하기 위해 실제 클릭 등록까지 수행하지 않았다.

## 13. 권한 관리 화면 안정화 및 공통 초안 복구 — 2026-08-23

### 직접 요청 반영

- 권한 관리의 역할 추가 모달과 운영 콘텐츠 편집/생성 폼에서 input 이벤트 값을 functional state updater 안에서 읽지 않도록 수정했다. 이벤트 핸들러에서 `value`/`checked`를 먼저 추출해 입력 중 페이지가 깨지는 React `currentTarget` 수명 문제를 차단했다.
- 구성원 편집 modal의 별도 `검색` 버튼을 제거하고 220ms debounce 검색으로 변경했다. 첫 진입에 데이터가 없을 때만 skeleton을 보여주고, 검색/페이지 이동 중에는 기존 rows를 150ms opacity transition으로 유지한 뒤 최신 응답으로 교체한다.
- 구성원 후보 요청에 최신 request id guard를 두어 빠르게 검색어를 바꿀 때 늦게 도착한 이전 응답이 현재 결과를 덮지 못하게 했다.
- 구성원 선택 Set은 검색어·페이지 변경에도 유지하며, select-all은 현재 페이지 ID만 추가/제거한다. 공통 `Pagination`은 유지하고 modal footer에 누적 선택 수를 표시한다.
- `DraftRestoredBanner` 공통 컴포넌트를 추가했다. 게시글 작성/수정, 설문 편집, 메일 작성에서 저장 시각·`새로 쓰기`·X 닫기와 `role=status`를 공유한다. X는 배너만 닫고 내용을 지우지 않으며, 새로 쓰기는 editor별 초기화 또는 새 route를 사용한다.

### 비판적 검토 결과

- 현재 권한 화면의 핵심 위험은 색상이나 카드 외형보다 `역할/권한/구성원`의 상태 구분과 변경 피드백이다. 시스템 역할 disabled 상태, 부분 선택, dirty 저장 상태를 checkbox 색상만으로 전달하지 않도록 한다.
- 구성원 검색에서 결과를 통째로 skeleton으로 바꾸면 체크 대상이 사라지고 사용자가 요청이 끝났는지 판단할 수 없다. old rows 보존과 selection persistence를 기본 규칙으로 고정한다.
- 검색 버튼과 상시 로딩 문구는 작업대의 흐름을 끊으므로 제거한다. 초기 진입 skeleton과 이후의 미세한 pending opacity를 구분한다.
- 첨부 캡처의 강한 blur/어두운 배경/ASCII 프레임/임의 권한 항목은 기존 디자인 철학과 도메인 계약을 확인하지 않고 이식하지 않는다. 화면 구조를 확장하기보다 재현 가능한 크래시와 상태 전달부터 해결한다.

### 검증 계획

- `pnpm --filter @soc/web typecheck`, lint, build를 실행한다.
- 역할 추가 모달에서 역할명·설명 입력, 운영 콘텐츠에서 제목·본문·URL·날짜·checkbox 입력을 각각 수행하고 페이지 예외가 없는지 확인한다.
- 구성원 modal에서 최초 skeleton → 검색어 입력 → 이전 rows 유지/opacity → 최신 rows 교체, 페이지 이동 후 선택 유지, select-all 해제를 확인한다.
- 작성/수정·설문·메일 editor에서 배너 X가 안내만 닫고, `새로 쓰기`가 의도된 초기화/route 동작을 수행하는지 확인한다.

## 14. 과비·권한 화면 최신 정정 — 2026-08-23

- 구성원 편집 modal은 `h-[min(720px,calc(100dvh-3rem))]` 고정 surface와 내부 결과 scroll을 사용한다. footer에는 `전체 n명 · 선택 n명`을 한 줄로 표시하고 검색 debounce 안내 문구는 제거한다.
- 과비 목록은 `체크박스 | 이름(영문명) | 학번 | 이메일 | 전공 | 상태 | 수납액` 7개 컬럼으로 정리한다. `작업` 컬럼과 행 끝 화살표를 삭제하고 행 click만 상세 드로어 진입점으로 유지한다.
- 선택 상태에서도 table header의 첫 셀과 현재 페이지 전체선택 checkbox는 유지한다. 나머지 header 영역만 선택 수·일괄 납부 action으로 교체해 header 높이와 column alignment가 변하지 않도록 한다.
- 납부 modal에서는 `적용 시작 학기`를 제거하고 화면의 기준 학기를 원장 적용 시작 학기로 자동 사용한다. `적용 학기 수` dropdown 폭을 확보하고, 납부 table 용어를 `수납액`, `현재 상태`로 정리한다. XLSX 내보내기 컬럼도 `수납액`으로 통일한다.
- 납부 상세 502는 API 기능 오류와 Docker 재기동 중 nginx upstream stale IP를 분리해 확인한다. 로컬 nginx는 Docker DNS resolver로 `api` service를 재조회하고 `/api/...`를 `/v1/...`로 rewrite하도록 하여 API container 재생성 후에도 새 IP로 복귀하게 한다.

검증: permission/finance web typecheck·lint·build, API typecheck·lint, `git diff --check`, Docker API/Web/nginx 재빌드 후 `/health`와 인증된 과비 상세 GET을 확인한다. 첨부 이미지는 기존 문제를 파악하는 참고 자료이며, 최신 직접 지시와 확정 디자인 원칙에 충돌하는 표현은 이식하지 않는다.
