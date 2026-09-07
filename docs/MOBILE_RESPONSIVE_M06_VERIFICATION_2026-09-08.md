# M06 모바일 반응형 검증 기록

작성일: 2026-09-08

대상: 게시글 상세, 작성, 수정

기준: `docs/MOBILE_RESPONSIVE_PLAN_2026-09-07.md`의 M06 및 `docs/MOBILE_DESIGN_DIRECTION_2026-09-07.md`의 게시글 상세·작성 목표안

## 1. 실행 환경

- `docker compose -f compose.yml up -d --build api web nginx`로 최신 웹/API 이미지를 재빌드하고 로컬 DB 볼륨을 유지했다.
- `db-migrate`는 성공적으로 종료했다.
- `docker compose -f compose.yml ps`에서 API·web·nginx·PostgreSQL·Redis가 실행 중이며 PostgreSQL은 healthy 상태였다.
- `GET http://127.0.0.1:3000/health`: `status=ok`, PostgreSQL `ok=true`, Redis `ok=true`
- 실제 DB의 공지 게시글 `/board/notice/1`, `/board/notice/2`와 첨부파일·댓글을 사용했다. Mock 로그인이나 인증 우회는 사용하지 않았다.

## 2. 구현 전 실제 화면 재현

- 게시글 상세는 390px/320px에서도 문서 전체 가로 넘침은 없었지만, 모바일 카드 안쪽 여백과 제목·메타·본문의 읽기 위계가 데스크톱 밀도에 가까웠다.
- 첨부파일 다운로드와 댓글 입력 등 상세 액션의 실제 조작 영역이 모바일 권장 44px보다 작아질 수 있었다.
- 긴 제목·작성자·댓글 메타가 한 줄 행에 의존해 좁은 폭에서 줄바꿈 여유가 부족했다.
- 본문 sanitizer가 `TABLE` 계열 태그를 허용하지 않아 표 콘텐츠를 그대로 보존할 수 없었고, 코드 블록과 긴 본문 콘텐츠를 위한 내부 overflow 계약도 명시되어 있지 않았다.
- `/board/write?category=notice`와 `/board/notice/2/edit`는 실제 인증을 요구하며 `https://ssodev.kaist.ac.kr/auth/kaist/error/code`로 이동한 뒤 `오류가 발생하였습니다. / 서버 내부 오류가 발생하였습니다.`를 표시했다. 로컬 SSO 개발 오류로 인증된 작성 화면을 열 수 없었다.

## 3. 변경 내용

- 상세 본문을 화면 폭에 맞추고 제목·인접 게시글 링크는 2줄까지 보존하며 긴 단어/URL을 안전하게 줄바꿈하도록 조정했다.
- 상세 메타와 댓글 헤더를 좁은 폭에서 세로·다중 행으로 재배치했다. 댓글 입력은 모바일 16px/최소 44px 높이를 사용하고 대댓글 들여쓰기를 줄여 입력 폭을 보존했다.
- 첨부 목록을 고정 테이블 레이아웃으로 바꾸고 파일명은 안전하게 말줄임 처리했다. 다운로드 링크는 44×44px 터치 영역을 갖는다.
- `RichTextContent` sanitizer에 표 관련 태그와 안전한 `colspan`/`rowspan`/`scope`를 추가하고 모든 표를 `rich-content-table-scroll` 내부 overflow 컨테이너로 감쌌다. 코드 블록도 본문을 밀어내지 않고 자체 가로 스크롤을 사용한다.
- 작성·수정 화면의 국문·영문 에디터에 언어 라벨과 44px 제목 입력을 추가하고, 모바일에서는 두 편집 영역을 세로로 쌓는다. 기존 editor 인스턴스·상태·`Ctrl+S`/`Ctrl+Enter`/언어 단축키는 유지했다.
- 모바일 게시 설정은 기본 접힘 `<details>`로 제공하고 데스크톱에서는 기존처럼 펼쳐 둔다. 설문 선택에는 visible label을 추가하고 설정 체크박스도 44px 행을 확보했다.
- 작성·수정 공통 액션을 모바일 하단 safe-area 액션 바로 재배치했다. `취소·임시저장·등록/수정`을 직접 누를 수 있으며, 기존 자동저장·복원과 서버 초안 상태를 공유한다. 템플릿 액션은 편집 헤더로 이동했다.

## 4. 실제 화면 검증

| 화면 | 실제 데이터/측정 | 가로 오버플로 | 결과 |
| --- | --- | --- | --- |
| 공지 상세 390px | 제목·포스터·본문·댓글 입력. `documentWidth=375`, `article=335.2px`, 포스터 `300×168.8px`, 댓글 입력 `293.6×44px` | 없음 | 통과 |
| 공지 상세 320px | 첨부 2건·댓글 2건. `documentWidth=305`, `article=272.8px`, 포스터 `237.6×133.7px`, 첨부 표 `237.6px`, 다운로드 링크 각 `44×44px`, 댓글 입력 `239.2×68px` | 없음 | 통과 |
| 공지 상세 1440px | 데스크톱 상세 카드 `976px`, 포스터 `868.8px` | 없음 | 통과 |
| 표·코드 | 실제 seed 게시글에는 표·코드 fixture가 없어 sanitizer 결과를 브라우저 콘텐츠로 재현하지 못함. 허용 태그·wrapper·CSS는 소스와 production build로 확인 | fixture 부재로 부분 검증 | 후속 QA 필요 |
| 작성 390px | 실제 SSO 인증 게이트에서 외부 오류 페이지로 이동 | 해당 없음 | 인증 환경 차단 |
| 수정 390px | 실제 SSO 인증 게이트에서 외부 오류 페이지로 이동 | 해당 없음 | 인증 환경 차단 |

모바일 상세 화면의 `document.documentElement.scrollWidth`와 `document.body.scrollWidth`는 viewport CSS 폭 이하였고, 첨부·댓글 영역도 페이지 전체 가로 스크롤을 만들지 않았다. 브라우저 캡처는 Codex CUA 인라인 캡처로 남겼으며 작업 디렉터리에는 별도 이미지 파일을 만들지 않았다.

## 5. M06 완료 기준별 상태

| 기준 | 상태 | 근거 |
| --- | --- | --- |
| 제목·메타·본문·이미지·첨부·댓글의 모바일 읽기/조작 | 통과 | 실제 DB 게시글 1·2를 390px/320px에서 확인 |
| 본문 표·코드의 내부 가로 스크롤 | 부분 통과 | sanitizer와 CSS 계약 구현. 실제 표·코드 fixture 없음 |
| 작성/수정 툴바, 국문·영문 입력, 이미지·링크 팝업 | 코드 반영, 브라우저 미검증 | 공유 editor 상태·명령 처리는 유지했으나 SSO 오류로 작성 화면 진입 불가 |
| 설정 필드와 취소·임시저장·등록/수정 액션 | 코드 반영, 브라우저 미검증 | 공통 모바일 액션 바와 기존 저장/복원 핸들러 확인. 인증 화면 차단 |
| 비밀글 권한·번역 입력·초안 동작 보존 | 코드 경로 유지, 인증 E2E 미검증 | 기존 controller/API 상태와 핸들러를 유지하고 Mock 우회는 사용하지 않음 |

## 6. 검사 결과

- web TypeScript `--noEmit`: 통과
- web ESLint: 통과
- UI unit contract: 통과
- web Node tests: 35 passed, 0 failed
- web production build: 통과
- `git diff --check`: 통과
- Docker migration/API health: 통과

다음 단위는 M07 설문·투표 참여 화면이다. M06의 표·코드와 인증된 작성/수정 키보드·첨부·초안·등록 E2E는 SSO가 정상화된 환경에서 후속 회귀 검증이 필요하다.
