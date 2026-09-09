# SOC Web 전체 보안 점검 실행 계획

- 작성일: 2026-09-08
- 실행 예정 모델: GPT-5.6 Luna
- 대상: 현재 저장소의 프론트엔드, API, 공유 계약, DB/Redis, 파일 저장소, 외부 연동, 빌드·배포·운영 구성
- 상태: 현재 코드·설정·테스트를 기반으로 한 계획서. S00/S01 범위·위협 모델, S02 인증 경로, S03 권한·객체 경계·관리자 bootstrap 1차 검증, S04 프록시·쿠키·CORS/CSRF·보안 헤더·로그 경계 1차 검증, S05 게시판·댓글·초안·검색·알림 개인정보 경계 1차 검증, S06 업로드·다운로드·S3 직접 업로드 경계 1차 검증, S07 설문 자격·응답·편집·집계 경계 1차 검증, S08 과비·연락망·내보내기·감사 로그 경계 1차 검증, S09 XSS·입력 검증·주입·브라우저 저장 경계 1차 검증, S10 Google·메일·일정·채널톡 외부 연동 경계 1차 검증, S11 투표·개발 기능·health 노출 경계 1차 검증, S12 비밀정보·공급망·컨테이너·CI 1차 검증, S13 자원 제한·운영 실패·복구 1차 검증, S14 누락·중복 정리·최종 판정을 실행했으며 결과는 SECURITY_AUDIT_SCOPE_2026-09-08.md 및 SECURITY_AUDIT_RESULTS_2026-09-08.md에 기록했다. S15는 사용자 수정 요청 이후 진행한다.
- 최신 사용자 방향: 과거 문서는 점검 기준에서 제외한다. 과거 요구사항·감사·완료 기록의 복원이나 대조를 선행 작업으로 요구하지 않는다.
- 목표: 실제 공격 경로와 방어 근거를 확인하고 검증된 취약점, 정책 확인 필요, 방어 보강 제안, 미검증 항목을 구분해 수정 가능한 결과를 만든다.

## 1. 이번 계획의 기본 방향

1. 파일 검색이나 패키지 검사만으로 완료하지 않는다. 외부 입력 → 인증 → 기능 권한 → 대상 객체 권한 → 서비스 → DB/스토리지/외부 시스템 → 응답·로그까지 추적한다.
2. 보안 처리나 테스트가 이미 있어도 실제 호출 경로, 우회 경로, 실패·동시성·설정 차이를 재검증한다. 반대로 보호 코드가 있는 후보를 일부 줄만 보고 취약점으로 확정하지 않는다.
3. 현재 코드·실행 설정·테스트·실제 요청 결과를 근거로 사용한다. 현재 구현이나 기존 테스트 통과를 안전성의 증명으로 간주하지 않는다. 권한 없는 데이터 접근·변조, 비밀 노출 등 보안 속성을 독립적으로 평가하고, 업무 정책이 불명확한 부분만 확인 필요로 기록한다.
4. 기존 UI 변경 작업과 분리해 진행한다. 점검 시작 시 commit, 변경 파일, 실행 환경을 기록하고 진행 중 관련 파일이 바뀌면 영향을 받은 결론만 재검증한다.
5. 점검은 순차 작업 단위로 진행한다. 각 작업은 후보 발견부터 검증·기록까지 끝낸다. 동일 후보를 다음 작업에서 새 취약점으로 중복 집계하지 않는다.
6. 이번 요청은 계획 수립이다. 이후 점검 실행 시에도 앱 수정·배포·운영 설정 변경을 자동으로 포함하지 않는다. 수정 요청을 받으면 검증된 항목을 대상으로 S15 절차를 진행한다.
7. 코드 검토의 기준은 공격자가 통제할 수 있는 값, 필요한 권한, 도달 가능성, 방어 통제, 실제 영향이다. 관리자만 바꿀 수 있는 환경변수와 익명 입력을 같은 위험으로 평가하지 않는다.

### 점검 환경

- 소스·설정 검토는 저장소 안에서 수행하고 동적 검증은 별도 로컬 테스트 환경의 합성 데이터로 진행한다.
- 기본 `compose.yml`은 개발 설정이며 기존 DB/업로드 볼륨을 사용할 수 있다. 보안 테스트용 compose/환경을 별도로 준비하고 DB명, 포트, 볼륨, Redis, 업로드 디렉터리가 격리됐는지 확인한 후 사용한다.
- 실제 SSO/Google/SMTP/S3 자격증명 대신 로컬 stub 또는 테스트용 자원을 사용한다. 서버 시작만으로 scheduler가 운영 메일·Sheets·일정 동기화를 실행하지 않게 차단한다.
- 운영 DB 변경, 실제 메일 발송, 운영 Sheets 수정, 비밀정보 회전·폐기, Git 이력 재작성은 이 점검의 기본 실행에 포함하지 않는다. 해당 작업은 구체적인 조치안과 대상이 정해진 후 별도 요청 범위에서 수행한다.
- 비밀값·개인정보는 보고서·터미널·스크린샷·커밋에 출력하지 않는다. 경로, 변수명, 마스킹된 식별자와 증거 위치만 기록한다. 확장된 compose 설정 출력에도 비밀값이 포함될 수 있으므로 전체 출력을 공유하지 않는다.
- 대량 요청으로 장애를 유발하는 검증 대신 격리 환경에서 작은 상한을 둔 경계·동시 요청 검증을 사용한다. 실제 외부 시스템을 공격 대상으로 사용하지 않는다.

## 2. 현재 프로젝트에서 확인한 점검 출발점

| 영역 | 현재 코드 관찰 | 이번 점검에서 확인할 질문 |
|---|---|---|
| 구성 | React/Vite web, Nest/Express API, Drizzle/PostgreSQL, Redis, nginx, Docker compose | 개발/운영 구성과 실제 외부 진입 경로가 일치하는가? |
| 인증 | `auth`에 SSO state/nonce, 로그인 결과 토큰, 동의, 임시/영구 세션, access/refresh/session cookie 구현 | 각 자격증명의 용도·만료·폐기·동시 갱신이 일관되는가? |
| 세션·권한 | `AuthGuard`는 세션 저장소와 사용자 활성 상태를 확인하고 권한을 계산함. `RequirePermissions`/`RequireAnyPermissions` 존재 | 직접 API 호출·OptionalAuth 경로·객체 ID 바꾸기·권한 회수 후 접근도 보호되는가? |
| 전송 경계 | `main.ts`의 `trust proxy=1`, 요청의 secure 여부에 따라 cookie 플래그 결정. 내부 nginx는 `X-Forwarded-Proto $scheme` 설정 | 외부 TLS 종료 프록시를 거친 실제 요청에서 HTTPS 정보가 보존되는가? API 직접 접근 시 헤더를 신뢰하는가? |
| 입력 검증 | `main.ts`의 global Zod pipe는 주석 처리 상태 | controller/서비스별 schema parse가 충분한가? global pipe 부재 자체를 취약점으로 단정하지 않는다. |
| 콘텐츠 | 서버 `sanitize-html`, 공통 리치 텍스트 렌더러, 게시판/설문/CMS 입력 존재 | 모든 저장·수정·가져오기·복원 경로가 정화와 객체 권한을 거치는가? |
| 파일 | 로컬/S3 저장, presign/complete/content, 게시글·설문·CMS 참조, cleanup/migrate 기능 존재 | 원본 다운로드·직접 업로드·참조 변경·공개 전환 모두 동일한 접근 정책을 적용하는가? |
| 개인정보 | 비밀글/익명 작성자, 설문 원문·파일, 연락망, 과비, 운영 로그·내보내기 존재 | 검색·알림·목록·다운로드·Sheets·로그에서 간접 유출되는가? |
| 외부 연동 | Google OAuth/Sheets/Calendar, KAIST/ICS 가져오기, Dooray SMTP, 채널톡 구성 | 외부 전송 범위·대상 검증·재시도·비밀 관리·자원 제한이 충분한가? |
| 브라우저 저장 | 세션용 sessionStorage와 글/설문/메일 초안용 localStorage 사용처 존재 | 로그아웃·계정 전환·공용 기기에서 이전 사용자의 데이터가 노출되는가? |
| 기존 테스트 | asset·게시글·설문 권한, sanitizer, 초기 관리자, Google·메일, 과비·설문 DB 동시성 테스트 존재 | 서비스 mock 통과와 실제 HTTP/DB/Redis 검증을 구분하고 누락을 채우는가? |
| CI | lint/typecheck/test/build, PostgreSQL migration·동시성 변수, Actions SHA 고정이 있음 | 실제 실행/skip/실패 상태, 공급망·비밀 스캔·Redis/프록시 검증도 관리되는가? |

위 관찰은 확인할 영역을 정한 것이며 검증된 취약점 목록이 아니다.

### 현재 실행 경로에서 먼저 확인할 사항

- `AppModule`에 `VotesModule`과 투표 controller가 있다. 현재 runtime에서 접근 가능한지 확인하고, 가능하면 다른 기능과 동일하게 점검한다. 과거의 제거/유지 요구는 판단 근거로 사용하지 않는다.
- 설문은 현재의 수정·제출·집계 코드와 DB 관계를 읽어 상태 전이를 도출한다. 응답이 존재할 때 정의를 변경할 수 있는지, 허용되면 원문과 참조가 어떻게 보존되는지 확인한다. 동결/편집 허용 중 어느 하나를 미리 정답으로 두지 않는다.
- 이메일에는 발송·예약·취소·재시도 API와 서비스가 있다. 실제 활성 조건과 scheduler 등록을 확인하고 외부 발송 경로를 범위에 포함한다.
- 파일은 현재 `assets/:assetId/content`, presign/complete, 서비스 권한 검사와 실제 저장소 접근을 추적한다. 우회 가능한 static/bucket 경로도 확인한다.
- 비밀정보 노출은 현재 파일과 Git 이력을 직접 검사해 판단한다. 발견 시 실제 폐기 여부는 현재 운영 증거로 확인하고 과거 감사 상태를 승계하지 않는다.

## 3. 점검 범위와 보호 대상

### 소스 범위

- `apps/api/src/**`, `apps/api/test/**`, `apps/api/drizzle/**`, `apps/api/scripts/**`
- `apps/web/src/**`, `apps/web/test/**`, Vite 설정·HTML·배포 nginx
- `shared/contracts/**`, `shared/api-client/**`, `shared/common/**`, `shared/config/**`
- `compose.yml`, `infra/docker/**`, Dockerfile, `.github/workflows/**`, package/lockfile, `.gitignore`, `.dockerignore`, 현재 환경 schema와 예제
- 현재 추적 파일 및 로컬에 존재하는 Git 이력. 원격 저장소의 접근 권한·브랜치 보호·CI secret·클라우드 IAM·S3 정책·TLS/CDN·운영 백업은 코드 검토와 구분한 외부 확인 범위다.

### 신뢰 경계

브라우저 → 외부 TLS 프록시(있다면) → nginx → Nest → PostgreSQL/Redis/로컬 파일/S3 → Google·SMTP·외부 캘린더. 각 경계에서 입력, 권한, 비밀값, 개인정보, 오류와 재시도를 확인한다.

### 테스트 주체

| 주체 | 주요 검증 |
|---|---|
| 비로그인 | 공개 데이터만 접근, 자격 제한 없는 공개 설문만 허용된 방식으로 제출 |
| 임시 세션 | 동의/계정 저장 상태에 따른 허용 기능만 접근 |
| 일반 사용자 A/B | 본인 글·초안·응답·파일과 타인 데이터의 수평 권한 분리 |
| 단일 권한 관리자 | 설문/과비/연락망/메일/역할 등 각각 하나의 권한만 부여하고 업무 간 우회 여부 검증 |
| 공식 답변·콘텐츠 관리 권한자 | 비밀 건의 읽기, 공식 답변, 숨김/복원, 신원 확인, 타인 수정의 개별 정책 검증 |
| 비활성·권한 회수·만료 사용자 | 이전 쿠키/토큰/캐시를 보유해도 현재 제한이 반영되는지 검증 |
| 최고 관리자 | bootstrap·회수·감사 추적과 권한 부여 경계 검증 |

파일·설문·게시글별 소유자 A/B, 공개/비공개, 숨김/삭제/보관, 정상/만료 상태를 조합한다. 최고 관리자 계정 하나만으로 테스트하지 않는다.

## 4. 실행 작업 단위

기본 순서: **S00 → S01 → S02 → S03 → S04 → S05 → S06 → S07 → S08 → S09 → S10 → S11 → S12 → S13 → S14**. S15는 수정 요청 이후의 절차다. 위험도가 높은 검증 후보가 나오면 기록과 영향 설명을 먼저 완료하고 해당 영역의 검증 우선순위를 조정한다.

### S00 — 기준 버전·현재 동작·실행 환경 확정

- 확인 파일: `AppModule`, `App.tsx`, 현재 controller/service/schema/test, package scripts, compose, 현재 Git 상태. 과거 제품 요구사항·보안 감사·Gate 문서는 제외한다.
- commit과 변경 파일을 기록하고 실행 시점의 보안 관련 변경을 구분한다. 이번 조사 당시 로그인 콜백·모달 등 web 변경이 있었으므로 실행 시 상태를 다시 확인한다.
- 현재 동작을 `입력 / 허용 주체 / 검사 위치 / 데이터·부수 효과`로 정리한다. 코드만으로 의도가 불명확한 업무 규칙은 정책 확인 필요로 기록하고, 독립적으로 판단할 수 있는 실제 접근 경로 검토는 계속한다.
- 실제 런타임 등록 모듈, 환경별 활성 기능, controller route, scheduler, CLI·가져오기·내보내기 경로를 목록화한다.
- 격리 PostgreSQL/Redis/업로드/외부 stub과 역할별 계정을 준비할 구성을 정한다. 시작 시 외부 부수 효과가 차단됐는지 확인한다.
- 산출물: `docs/SECURITY_AUDIT_SCOPE_2026-09-08.md`.
- 완료: 점검 버전·환경·범위·정책·제외/외부 확인 항목이 명시돼 있다. 아직 실행하지 않은 테스트를 통과로 적지 않는다.

### S01 — 위협 모델과 API 권한 표

- 확인 파일: 모든 controller와 실제 module 등록, guard/decorator, `permissions-registry.ts`, 기능별 access helper.
- endpoint별 method/path, 입력 ID, 인증 방식, 기능 권한, 객체 소유권, 반환 민감 필드, 부수 효과, 담당 S번호를 연결한다. 정규식 검색은 출발점이며 class/메서드 decorator와 실제 서비스 검사를 함께 읽는다.
- 모든 쓰기 API 및 민감 조회를 우선 검토하고, 공개 검색·알림·통계·파일이 보호된 데이터의 우회 통로가 되는지 모델링한다.
- 보안 속성: 타인 데이터 변경 불가, 임시 세션의 권한 상승 불가, 권한 회수 반영, 비공개 데이터의 공개 출력 차단, 동시 요청의 무결성, 외부 전송 최소화.
- 완료: 전체 등록 endpoint와 비HTTP 작업이 범위에 매핑되고 공개/관리자 분류에 근거가 있다. 자세한 분석 상태는 이 표에서 갱신한다.

### S02 — SSO·세션·동의·로그아웃

- 주요 파일: `features/auth/*`, auth guards, `shared/contracts/src/http/auth.ts`, `shared/api-client/src/auth.ts`, `core.ts`, web `auth-storage.ts`, 로그인 콜백·세션 hook.
- A: state/nonce와 시작 브라우저의 결합, code 교환, callback·결과 토큰의 TTL/일회성/원자적 소비, redirect 허용 대상, pending login 암호화와 동의 시 사용자 연결.
- B: access/refresh/session 식별자의 교차 사용, JWT 허용 알고리즘·필수 claim·용도, 임시→영구 전환, refresh 회전·재사용·동시 갱신, 로그아웃과 비활성 계정의 모든 자격증명 폐기.
- Redis 실패·지연·재시작 시 검증 우회나 무기한 세션이 생기는지 확인한다. front guard와 API guard가 다른 자격증명을 신뢰하는 경로를 대조한다.
- 로컬 SSO stub과 실제 테스트 Redis로 정상/만료/위조/반복/동시 요청을 검증한다. 보안 테스트를 위해 production 인증 우회 경로를 추가하지 않는다.
- 완료: 인증 상태별 허용 표와 HTTP·Redis 검증 결과가 있으며, 로그인 결과 토큰·쿠키가 URL·로그·스토리지에 남는 경로가 평가됐다.

### S03 — 기능 권한·객체 권한·관리자 bootstrap

- 주요 파일: auth guards, `role-groups`, `users`, `initial-admin.*`, permission registry, controller 전체의 권한 호출.
- A/B 사용자와 단일 권한 관리자 각각으로 URL/path/body/query의 사용자·객체 ID를 바꿔 조회/수정/삭제/일괄 작업을 검증한다.
- parent/child ID를 섞는다. 예: 다른 설문의 section/question/response, 다른 게시글의 comment/asset, 다른 사용자의 draft/notification.
- DTO에 `ownerId`, `permission`, 상태·금액 등 서버 소유 필드를 추가해 mass assignment 여부를 확인한다. 허용되지 않는 필드가 실제 persistence에 도달하는지 추적한다.
- additive 권한, all/any 의미, 게시판별 권한, 역할 편집 가능 범위, 최고 관리자 부여, `INITIAL__ADMIN_STDNOS` 재로그인 부여와 역할 회수 정책을 검증한다.
- 완료: 민감 endpoint의 허용/거부 양쪽 검증과 권한 변경 후 기존 세션/캐시 검증이 있다. 프론트 버튼 숨김은 서버 방어 증거로 사용하지 않는다.

### S04 — HTTPS·프록시·쿠키·CSRF·CORS

- 주요 파일: `main.ts`, `auth-cookie.service.ts`, nginx 설정, prod/dev compose, 프론트 API base URL과 cookie 사용.
- 외부 TLS 종료가 있는 경우와 직접 HTTP/API 접근을 각각 모델링한다. 프록시 hop 수, forwarded 헤더 덮어쓰기, origin/host 신뢰, 실제 Set-Cookie 속성을 확인한다.
- CORS allowlist와 credentials 조합, Origin 누락/null/다른 origin, 같은 site의 다른 origin, form과 JSON 요청을 구분해 state-changing API의 CSRF 방어를 검증한다. CORS나 SameSite 설정만으로 완료하지 않는다.
- HTTP method별 부수 효과, login CSRF, refresh/logout, cookie Path/Domain/Secure/HttpOnly/SameSite, 캐시 정책을 확인한다.
- CSP/HSTS/frame/referrer/nosniff를 실제 제공 응답에서 점검한다. 헤더 부재는 도달 경로와 영향을 검토해 보강 또는 취약점으로 분류한다.
- 완료: 로컬 production 유사 프록시의 헤더·쿠키·요청 재현 결과가 있다. 외부 TLS 장비 설정 미확인은 별도 남긴다.

### S05 — 게시판·댓글·초안·검색·알림의 개인정보 경계

- 주요 파일: `features/board/*`, `notifications/*`, `users` 활동 조회, 관련 API 계약과 web controller.
- 공개/로그인 전용/비밀/익명/숨김 상태별로 목록·상세·검색·이전/다음·관련 글·알림·활동 내역·스크랩·첨부의 필드를 비교한다.
- 익명 작성자 신원 확인의 개별 권한과 감사 기록, 공식 답변자의 비밀 건의 접근, 관리자 타인 글 수정 허용 범위를 현재 코드에서 도출한다. 동일 데이터의 경로별 권한 차이와 불필요한 신원·원문 노출을 검증한다.
- 작성자 변경, 댓글의 다른 article 연결, 타인 초안 불러오기/삭제, 비공개 원문이 snippet·알림 payload·정렬/총 개수에 노출되는 경로를 검증한다.
- 기존 `article-access`, `article-asset-access`, `official-response-and-board-access` 테스트를 읽고 실제 HTTP 음성 테스트를 보완한다.
- 완료: 존재/상태·본문·신원의 공개 범위와 서버 통제를 구분한 결과가 있다. 의도된 노출 여부가 불명확하면 정책 질문과 실제 노출 증거를 분리한다.
- 진행 상태(2026-09-08): 1차 완료. 현재 DB에 익명·비밀·숨김 게시글, 초안, 알림 fixture가 없어 live disclosure는 관찰하지 못했지만, 익명 작성자 응답·비밀글 댓글 경계·이전/다음 글의 비밀 metadata 경로를 source와 current-build harness로 확인했다. 결과는 `SECURITY_AUDIT_RESULTS_2026-09-08.md` 9절에 기록했으며, 자산 직접 접근과 설문/외부 전송 경계는 S06-S10에서 계속한다.

### S06 — 업로드·다운로드·S3 직접 업로드

- 주요 파일: `features/asset/*`, `board/article-asset-access.ts`, asset reference와 repository, survey 첨부 검증, 스토리지 설정.
- A: multipart 크기/MIME/실제 내용/확장자/파일명, 경로 이탈, 파일 응답 헤더, HTML/SVG 등 active content의 처리, 업로드 전 인증.
- B: presign → 업로드 → complete → 연결 → 다운로드 전체에서 uploader·object key·실제 크기·내용·완료 상태 검증. 재사용/다른 사용자 완료/연결 후 덮어쓰기 가능성을 확인한다.
- C: 게시글·설문·CMS가 같은 파일을 참조할 때 공개 범위, 공개→비공개 전환, 미연결 파일, 타인 파일 연결, 다운로드 감사 기록, 직접 bucket/local URL 우회, cache/Range 요청.
- cleanup·migrate가 참조 중 파일 또는 범위 밖 파일을 처리하는지 격리 경로에서 확인한다. 필요한 경우 제한된 크기의 악성 형식 fixture를 사용하고 실행은 하지 않는다.
- 완료: 로컬 저장소와 S3 경로의 검증 수준을 따로 표시한다. S3 mock 통과를 실제 IAM·bucket 비공개 검증으로 대신하지 않는다.
- 진행 상태(2026-09-08): 1차 완료. 현재 source에서 자산 조회의 article readability와 `isSecret` 전파, multipart MIME/크기, local path containment, safe response header, uploader-bound direct upload/complete, S3 presign 사후 크기 검증, article/survey/CMS 참조를 대조했다. 현재 DB aggregate는 assets 20건·article links 18건·unlinked 2건·survey answer refs 0건이며 secret article refs는 0건이다. current-build harness에서 secret article에 연결된 asset의 anonymous read 경로와 presign 응답의 크기 조건 부재를 재현했고 관련 표적 테스트 37개가 통과했다. S06-F01~F02와 cleanup race·실제 S3 IAM/bucket 설정 미확인은 결과 문서 10절에 기록하고, 설문·외부 egress는 S07/S10에서 계속한다.

### S07 — 설문 자격·응답·편집·집계

- 주요 파일: `features/surveys/*`, survey 계약·DB schema, `features/survey/*`, `features/survey-results/*`.
- A: 익명/임시/영구 세션별 자격, 주전공·학적·과비 조건, 비활성 사용자, 응답 생성과 수정 시 재검증, 본인 응답 식별 수단의 위조·재사용.
- B: 다른 설문의 문항/선택지/섹션/파일 ID, 분기상 비활성 문항, 필수값·배열·수치·길이, 중복 제출, 정원/마감과 동시에 발생하는 요청.
- C: 현재 허용된 편집에서의 응답 원문 보존, 삭제 문항 참조, 정의 변경과 제출의 경합, 결과 공개 설정과 자유서술/개인정보 출력, 관리자 파일 다운로드.
- DB unique/transaction/lock과 서비스 검증을 함께 본다. 계정 없는 공개 설문에 사람당 1회 보장을 임의 요구하지 않고, 명시된 요청 제한과 자동화 방어를 점검한다.
- 진행 상태(2026-09-08): 1차 완료. 현재 공개 설문 list/detail의 field minimization, 자격·임시 세션·fee/학적 조건, 응답·답변·첨부 소유권, branching/validation, public/private analytics, definition mutation과 row-lock 구조를 대조했다. 공개 응답의 내부 survey metadata 노출, `assetId`/`assetIds` 혼용에 따른 타인 자산 참조, 설문 이미지 참조의 uploader 소유권 부재를 source와 current-build harness로 확인했다. 현재 DB는 survey 13건(공개 12·draft 1), response/answer 0건이며 전용 PostgreSQL 동시성 테스트 10개는 URL 부재로 skip됐다. 결과는 `SECURITY_AUDIT_RESULTS_2026-09-08.md` 11절에 기록하고, fee/contact/Google egress는 S08/S10에서 계속한다.
- 기존 access/eligibility/branching/answer-validation/response-concurrency 테스트가 현재 서비스와 DB 경계를 실제로 검증하는지 대조한다. 테스트 자체의 불충분한 허용 조건도 검토한다.
- 완료: 주요 자격 조합·타인 응답 접근·공개 집계 필드·실DB 경합의 양성/음성 결과가 있다.

### S08 — 과비·연락망·내보내기·감사 로그

- 주요 파일: `features/users/*`, `contacts/*`, `audit/*`, fee/contact/audit schema, XLSX 생성과 공유 계약.
- 과비 대상·학기·금액·상태·비고 변경, 대량 수정의 부분 실패/재시도/동시성, 권한 없는 사용자 필드 수정, 원장·집계 일관성을 확인한다.
- 공개 구성원 API와 내부 연락망 조회/검색/내보내기/Sheets 전송의 필드 및 권한을 비교한다.
- XLSX/CSV/Sheets 각각의 수식·링크·텍스트 처리, 대량 export 상한, 응답 caching, 감사 로그의 개인정보 최소화·위조·열람/삭제 권한을 검증한다.
- 기록해야 하는 신원 확인·권한 변경·파일 다운로드·과비 변경·외부 동기화가 실제 기록되는지 확인한다. 감사 저장 실패 시 행동은 업무 중요도에 따른 정책으로 평가한다.
- 완료: 일반 사용자와 단일 관리자 간 개인정보 범위, 실DB 과비 동시성, export 결과와 감사 증거가 있다.
- 진행 상태(2026-09-08): 1차 완료. current source에서 contacts/users/audit 및 fee schema/controller/service/repository, XLSX/Google Sheets client와 queue를 대조했다. 현재 DB는 contacts 4건(동의 4·철회 0), departments 5건, users 3건, fee status/payment 0건, audit 154건, Sheets queue 2건(SUCCEEDED)이었다. public `/contacts`의 full PII DTO, 철회 contact의 background Sheet egress, fee bulk partial commit, payment replay idempotency 부재, 민감 export `Cache-Control` 부재, background sync audit gap을 source·current HTTP·current-build harness로 확인하고 S08-F01~F06을 결과 문서 12절에 기록했다. 표적 테스트 18개는 15 pass, 0 fail, 3 skipped(전용 fee PostgreSQL concurrency URL 부재)였다. 실제 Google/Drive sharing·production cache와 fee fixture는 S10/S12/S13에서 계속한다.

### S09 — XSS·입력 검증·주입·브라우저 저장

- 주요 파일: sanitizer, survey rich text, `site-content`, `rich-text-content.tsx`, schema parse, repository SQL, 가져오기 parser, web 저장소 사용처.
- HTML을 받는 생성/수정/복제/초안 복원/관리자 CMS/가져오기 각각을 저장부터 렌더링까지 추적한다. 링크·이미지 URL scheme, 이벤트 속성, 스타일, 인코딩 변형과 sanitizer 이후 변형을 확인한다.
- DB query는 Drizzle 사용 여부만 확인하지 말고 raw SQL·정렬 필드·필터·배열 입력의 결합까지 추적한다. command/template/path/정규식 등 실제 존재하는 sink도 검토한다.
- JSON/body/query의 타입·길이·중첩·숫자 범위, 예외 직렬화와 실제 등록 filter/interceptor를 확인한다. 정의만 있고 등록되지 않은 방어는 적용된 것으로 계산하지 않는다.
- 글/설문/메일 초안과 로그인 결과의 localStorage/sessionStorage key, 사용자 분리, 로그아웃/계정 전환/브라우저 뒤로가기·query cache 정리를 검증한다.
- 완료: 격리된 무해한 실행 표식으로 XSS 여부를 확인하고, 서버 저장/클라이언트 출력/브라우저 보관의 각 경계가 기록돼 있다.
- 진행 상태(2026-09-08): 1차 완료. 현재 source에서 server/client rich-text sanitizer, CMS URL scheme, survey answerRegex sink, route별 입력 상한, Drizzle/raw sink, roadmap import limit과 auth/board/survey/email browser storage를 대조했다. current DB에는 dangerous CMS link와 regex question이 없었지만, current-build harness에서 CMS javascript: 값 보존, user/account namespace 없는 draft storage, catastrophic-backtracking 정규식의 약 4.3초 동기 지연을 확인했다. 관련 표적 테스트 31개는 31 pass, 0 fail, 0 skipped였고 S09-F01~F03은 결과 문서 13절에 기록했다. 실제 browser marker 실행·cross-account replay·public regex DoS와 외부 provider 검증은 S10/S13에서 계속한다.

### S10 — Google·메일·일정·채널톡 외부 연동

- 주요 파일: `infrastructure/google/*`, `google-*-sheets.service.ts`, `calendar/*`, `email/*`, `auth.service.ts`의 채널톡 설정, OAuth script.
- A: OAuth scope·token 파일·refresh, 지정 폴더/시트 ID 검증, 연결/재연결/동기화 권한, 의도치 않은 공개 공유, 수식 해석, 로그의 토큰/응답 원문 노출.
- B: 메일 preview/test/send/예약/cancel/retry, 수신자 재검증, idempotency의 DB·외부 발송 경계, 여러 worker의 중복 실행, 실패 후 재시도, 첨부 접근, 템플릿/헤더 주입, 수신자 간 주소 노출.
- C: ICS/KAIST/Google 응답, SSRF·redirect·timeout·응답 크기·압축/파싱 상한·오류 처리. 현재 ICS URL은 설정에서 읽으므로 설정을 바꿀 수 있는 주체와 redirect 통제 가능성을 먼저 확인한다.
- 채널톡에 제공하는 식별·프로필 필드와 member hash, 익명/로그아웃 이후 상태, 서버 비밀의 프론트 전송 여부를 확인한다.
- 완료: 외부 호출은 stub/테스트 자원으로 검증하고, 실제 OAuth grant·공유 ACL·SMTP 운영 정책 확인은 별도로 표시한다.
- 진행 상태(2026-09-08): 1차 완료. 현재 source에서 Google OAuth/Drive·Sheets·Calendar, SMTP bulk delivery/idempotency/retry/BCC/attachment, external ICS/KAIST/holiday fetch와 ChannelTalk HMAC/logout identity를 대조했다. current config/DB safe summary와 local HTTP, provider-boundary harness에서 SMTP 성공 뒤 DB status failure 후 retry 재발송, ICS redirect 최종 URL 재검증 부재, public holiday provider timeout/response-size 부재, Google operations folder/ACL 정책 확인 필요를 확인했다. 표적 테스트 11개는 11 pass, 0 fail, 0 skipped였다. 현재 external ICS URL은 0개이고 email dry-run/scheduler disabled이며 실제 OAuth/Google/SMTP/KAIST/holiday/ChannelTalk provider는 호출하지 않았다. S10-F01~F04는 결과 문서 14절에 기록했고 다음은 S11이다.

### S11 — 투표·개발 기능·노출 경로

- 주요 파일: `votes/*`, `vote-crypto.service.ts`, vote schema/계약/route, `mock/*`, `AppModule`, env validation, seed와 진단 경로.
- 메뉴 노출 여부와 무관하게 호출 가능한 기능을 점검한다. 투표의 실제 등록과 인증·상태별 접근 범위를 먼저 확인한다.
- 노출된 투표는 자격·중복 투표·마감/집계·결과 공개·receipt 조회·암호문과 신원의 연결·키 분리/rotation·관리자 권한을 검토한다. 암호 round-trip 테스트만으로 익명성·무결성을 보장했다고 판단하지 않는다.
- production bootstrap에서 mock/진단/데모 계정 경로가 실제 등록되는지, NODE_ENV 적용 시점과 누락/오타 시 동작, seed 종류·초기 관리자 계정을 확인한다.
- 완료: 각 경로를 `접근 가능 / 차단 확인 / 코드만 존재 / 미검증`으로 구분한다. 불필요한 노출이 확인되면 차단/제거를 보강 또는 수정안으로 제안하고 감사 단계에서 임의 삭제하지 않는다.
- 진행 상태(2026-09-08): 1차 완료. 현재 vote controller/service/repository/schema/crypto, health, MockModule/AppModule, env와 seed를 대조하고 public/admin/ballot/receipt HTTP smoke, current DB aggregate, vote crypto 3개 테스트를 실행했다. `submit`의 pre-check와 DB transaction 사이에 vote 상태 재확인이 없어 CLOSED 전환 뒤에도 합성 repository가 제출을 수락하는 경합 후보, health raw dependency message, ConfigModule load 전 `process.env.NODE_ENV`에 의존하는 mock registration 보강 후보를 확인했다. production Compose/Dockerfile은 NODE_ENV를 명시하고 demo seed를 거부하므로 mock 후보는 active production finding이 아니다. S11-F01~F03은 결과 문서 15절에 기록했으며 다음은 S12다.

### S12 — 비밀정보·공급망·컨테이너·CI

- 주요 파일: lockfile/package, Dockerfile, `.github/workflows/quality.yml`, env validation/예제, `.gitignore`, `.dockerignore`, Git 이력.
- A: 현재 파일과 로컬 Git 이력을 redaction 가능한 도구로 스캔한다. 삭제된 파일·이전 버전도 범위에 포함한다. 의심 값은 위치·종류·증거 상태만 기록하고 실제 자격증명 시험 호출은 하지 않는다.
- B: `pnpm audit`로 알려진 advisory를 조회하고 정확한 설치 버전·전이 의존 경로·사용 위치·도달 가능성을 대조한다. CDN tarball로 설치한 SheetJS, container OS/image도 별도 확인한다. 검사 시각·도구·대상 버전을 기록한다.
- C: lifecycle script·lockfile 무결성·registry/source, Docker build context·runtime user·dev dependency 포함·이미지 태그/버전, Actions 권한·PR 입력·artifact/cache·배포 비밀 경계를 검토한다.
- 공급망 조회 실패를 “취약점 없음”으로 기록하지 않는다. 자동 업데이트/`audit --fix`나 대규모 라이브러리 교체는 실행하지 않는다.
- 완료: 실제 secret 존재 여부·노출 범위·폐기 증거는 구분돼 있고, advisory는 직접 영향/잠재 영향/비해당 근거가 있다. 도구가 다루지 못한 의존성이 명시돼 있다.
- 진행 상태(2026-09-08): 1차 완료. 현재 registry 기준 `pnpm audit --prod --json`에서 runtime dependency advisory 4건(모두 Moderate, High/Critical 0)을 확인하고 설치 버전·전이 경로·실제 사용 위치를 대조했다. 전체 audit의 17건(High 9, Moderate 6, Low 2, Critical 0) 중 개발/빌드 경로는 별도 분리했다. 추적되지 않는 로컬 `.env`·`secrets`에 runtime credential material이 존재하고 Git 이력에는 현재 스캔한 민감 경로·marker가 확인되지 않았지만, 폐기·rotation은 외부 운영 증거가 없어 미완료다. SheetJS CDN tarball의 lockfile integrity 부재, production API image의 root 실행·dev dependency 복사·digest/런타임 hardening 부재, CI의 전용 secret/container scan 부재를 기록했다. 결과는 `SECURITY_AUDIT_RESULTS_2026-09-08.md` 16절의 S12-F01~F06 및 관찰 항목에 기록했으며 다음은 S13이다.

### S13 — 자원 제한·운영 실패·복구

- 주요 파일: API body/upload limits, 공개 제출·로그인·검색/export 경로, queue/scheduler, Redis provider, DB pool, prod compose/nginx, 현재 사용 중인 운영 설정과 스크립트.
- 실제 경로별 rate limit/timeout/pagination/최대 배열·파일·본문·export·parser 작업량을 확인한다. IP 헤더 우회와 다중 API instance에서도 제한이 의미 있는지 확인한다.
- DB/Redis/외부 provider가 실패하거나 재시작될 때 인증 허용 전환, 작업 중복, 데이터 유실, 무한 재시도·메모리 증가가 생기는지 작은 격리 실험으로 확인한다.
- DB/Redis/API 노출 포트, network 접근, 최소 권한, health 오류 정보, 로그 보존·접근, backup 암호화·보존·복원·key 의존성을 확인한다.
- 백업은 테스트 데이터로 복원 연습을 하여 관계/첨부/암호화 키/세션 복구 정책까지 확인한다. 운영 RPO/RTO는 근거가 없으면 임의 시간으로 채우지 않는다.
- 완료: 서비스별 실패 모드, 제한 적용 증거, 복원 테스트 결과와 운영 확인이 필요한 항목이 정리돼 있다.
- 진행 상태(2026-09-08): 1차 완료. current source에서 body/upload/parser, public calendar/survey/article, response/export, S3 buffering, bulk email, DB/Redis pool, queue/scheduler, Nginx/Compose를 대조하고 실행 중 stack의 health/limit smoke와 Docker resource inspection을 수행했다. route별 파일·문서 상한은 일부 확인했지만 global rate limit/명시적 parser·proxy timeout, 일부 public/full-materialization 및 privileged export/response 상한, multi-replica stale-lock/cleanup lock, Redis maxmemory와 backup/restore 증거에 공백이 있었다. S13-F01~F04는 결과 문서 17절에 기록했으며 실제 부하·의존성 중단·복원 실험은 서비스 중단과 데이터 변경을 피하기 위해 미실행으로 남겼다. 다음은 S14다.

### S14 — 누락·중복 정리와 최종 판정

- S01의 전체 endpoint/비HTTP 작업과 S02–S13 결과를 대조한다. 민감 조회/쓰기와 공개 진입점에 미분류 경로가 없어야 한다.
- 같은 원인으로 여러 endpoint에 생긴 문제는 하나의 finding에 영향 범위를 기록한다. 다른 공격 전제나 독립된 수정이 필요한 문제는 구분한다.
- 후보에 대해 보호 코드와 반례를 마지막으로 확인하고 검증됨/미확정/오탐/보강/정책 확인 필요를 정리한다.
- 과거 감사의 결론과 완료 상태를 인용하지 않는다. 이번 버전에서 직접 확인한 증거와 현재 외부 조치 증거를 구분한다.
- 완료 보고서는 위험 순서, 구체적인 피해, 발생 전제, 증거, 수정 방향, 회귀 테스트, 미검증 범위와 다음 조치를 포함한다. “전체 안전” 대신 검증한 범위와 남은 한계를 명시한다.
- 진행 상태(2026-09-08): 1차 완료. scope matrix의 route ID 1–196 연속성, 비HTTP 작업 13개 매핑, S02-S13의 43개 unique finding ID와 same-root 중복을 대조했다. 독립 sink는 분리하고 같은 원인은 중복 집계하지 않았으며, exploit path와 production impact가 함께 검증된 Critical/High는 없고 S12-F02~F04는 설치 버전상 advisory 영향으로 수정 우선 항목에 남겼다. 결과는 `SECURITY_AUDIT_RESULTS_2026-09-08.md` 18절에 기록했으며 S15는 사용자 수정 요청 이후 진행한다.

### S15 — 수정 요청 이후: 원인 제거와 재검증

- 검증된 Critical/High와 외부 조치가 필요한 노출부터 다룬다. 한 번에 같은 원인의 수정 묶음을 처리한다.
- controller의 개별 차단만으로 여러 우회 경로가 남으면 공통 권한 정책, 파일 접근, 세션 원자성, 데이터 제약 등 실제 경계를 수정한다.
- 수정 전 실패하는 재현을 고정하고 수정 후 같은 경로가 차단되는지 확인한다. 정상 사용자 흐름·권한·데이터 보존도 검증한다.
- 수정 commit/파일·실행 검사·남은 운영 조치·rollback을 기록한다. 취약점 상태는 재검증까지 끝난 경우에만 해결로 바꾼다.
- deployment·secret rotation·Git 이력 재작성은 코드 수정 완료와 분리한다. 보고서 작성만으로 외부 조치를 완료 처리하지 않는다.

## 5. 검증과 증거 규칙

### 후보를 취약점으로 확정하는 조건

각 항목에는 공격자 역할과 통제 입력, 실제 도달 경로, 누락/우회된 방어, 민감 출력 또는 부수 효과, 원인 코드 위치, 재현/정적 증거, 반례 검토가 필요하다.

- service 단위 테스트는 해당 함수 동작의 증거다. 실제 guard·DTO·HTTP 경계를 검증한 것으로 확대하지 않는다.
- 401/403/404만 확인하지 않는다. 거부된 요청이 DB/스토리지/발송에 이미 부수 효과를 만들지 않았는지도 확인한다.
- 허용 요청과 거부 요청을 함께 검사해 기능을 전부 막은 수정을 성공으로 판단하지 않는다.
- 동시성은 실제 격리 PostgreSQL/Redis에서 중복 성공 수, 최종 데이터, rollback을 검사한다.
- 정적 추적만으로도 충분히 입증되는 문제는 그 근거를 기록하되 “동적 재현 완료”라고 표현하지 않는다.
- severity와 confidence를 분리한다. severity는 인증 전제·권한·도달 범위·데이터/업무 피해를 기준으로 정하고, CVSS를 쓰면 vector와 판단 근거를 함께 남긴다.

### 기록 형식

```text
ID / 제목 / 분류(취약점·보강·정책 확인 필요) / 상태
심각도 / 확신도 / 점검 버전·환경
공격자와 필요 권한 / 통제 가능한 입력
입력 → 인증·권한 → 서비스 → 저장소·응답의 경로
파일:줄 및 관련 방어 코드 / 재현 절차와 비밀값을 제거한 결과
실제 영향 / 검토한 반례 / 미검증 조건
수정 방향 / 회귀 검증 / 외부 운영 조치
```

증거에는 테스트 데이터만 포함하고 발견한 실제 비밀값이나 응답 원문을 붙이지 않는다.

### 검사 명령과 해석

다음은 현재 root scripts 기준이다. S00에서 실행 버전과 테스트 DB/Redis 환경을 준비한 후 사용한다.

```sh
pnpm build:shared
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm audit --json
```

- baseline 검사는 한 번 기록하고 후속에는 관련 테스트부터 실행한다. 최종 또는 수정 통합 시 전체 검사를 실행한다.
- `FEE_CONCURRENCY_TEST_DATABASE_URL`, `SURVEY_CONCURRENCY_TEST_DATABASE_URL`은 각각 격리 테스트 DB를 가리켜야 한다. 로컬에서 값이 없으면 해당 테스트가 skip될 수 있으므로 실행/skip 수를 기록한다. 실제 CI 구성과 테스트 코드를 실행 시 재확인한다.
- API test script는 Node test runner를 사용한다. 새 보안 회귀도 가능한 한 같은 구조를 재사용하고 실제 HTTP·Redis·DB 검증이 필요한 곳만 별도 fixture를 추가한다.
- `pnpm audit`은 알려진 의존성 advisory를 조회하는 보조 도구다. 인증/권한/개인정보/업무 무결성 검토를 대체하지 않는다. 명령 옵션은 실행 버전의 help로 확인한다.
- secret scanner, container scanner, 브라우저 검증 도구는 설치·사용 가능한 버전부터 확인한다. 미설치/실행 실패/접근 불가를 결과에 기록한다.
- CI 통과와 “보안 검증 완료”는 다르다. 보안 속성별로 정적 검토/단위 테스트/HTTP/실DB/실Redis/브라우저/운영 증거 중 실제 수행한 검증 수준을 표시한다.

## 6. 산출물과 완료 기준

### 기본 산출물

1. `docs/SECURITY_AUDIT_SCOPE_2026-09-08.md`: 점검 버전·정책·환경·위협 경계·API/비HTTP 범위와 검토 상태.
2. `docs/SECURITY_AUDIT_RESULTS_2026-09-08.md`: 증거가 연결된 결과, 우선순위, 미검증 범위, 다음 조치. 동일 파일에 작업별 결과를 갱신한다.
3. 재현용 테스트/fixture와 실행 로그: 합성 데이터와 redaction된 출력만 저장한다. 코드 테스트는 해당 테스트 폴더, 임시 로그는 저장소의 ignored 임시 폴더를 사용한다.
4. 수정 요청 이후에만 수정 기록·운영 조치 상태를 결과 문서에 추가한다.

Codex Security Standard의 실제 스캔을 사용하는 경우 실행 시 설치된 스킬의 host/preflight/보고서 절차를 따른다. 해당 도구가 소유하는 canonical scan 파일과 보고서는 도구 절차로 생성하고 위 프로젝트 문서는 범위·후속 작업 요약으로 사용한다. 이 계획의 S번호는 점검 영역과 작업 순서이며 도구의 scan phase나 독립적인 여러 전수 스캔을 뜻하지 않는다. 도구가 없으면 수동 소스 감사임을 명시한다.

### 점검 완료와 출시 판단 구분

- 점검 완료: 전체 범위가 검토 상태와 연결되고 후보가 판정됐으며 증거·영향·미검증·조치가 보고됐다. 취약점이 발견돼도 감사 자체는 완료할 수 있다.
- 수정 완료: 해당 finding의 실패 재현과 정상 동작 검증이 통과했고 필요한 운영 조치도 별도 확인됐다.
- 출시 판단 제안: 검증된 미해결 Critical/High, 확인되지 않은 중대한 credential 노출, 핵심 권한/비공개 데이터 경계의 검증 공백이 있으면 해결 또는 명시적 위험 판단 전까지 출시 준비 완료로 표시하지 않는다.
- coverage는 `검토한 등록 endpoint / 전체 등록 endpoint`, 민감 경로의 동적 검증 수, 검토한 비HTTP 작업, 제외/미검증 사유로 제시한다. 추정 비율이나 읽은 파일 수만으로 완전성을 주장하지 않는다.

### Luna 작업량 관리

S00/S01에서 범위와 테스트 준비 비용을 파악하고 이후에는 S번호 하나씩 진행한다. S02, S06, S07, S10, S12는 위 A/B/C 단위로 분할할 수 있다. 작업 종료마다 현재 버전, 읽은 핵심 경로, 후보 판정, 실제 검증, 미검증, 다음 작업을 남긴다. 실패가 없는 검사나 끝난 분석을 이유 없이 반복하지 않는다.

## 7. Luna에 전달할 프롬프트

### 시작: 현재 코드 기준 범위 확정

```text
docs/SECURITY_AUDIT_PLAN_2026-09-08.md를 읽고 S00과 S01을 진행해줘.
과거 제품 요구사항·감사·운영 문서는 무시하고 현재 코드·설정·테스트·실제 요청을 근거로 삼아.
현재 commit·미커밋 변경·실행 환경을 기록하고 투표·설문·이메일 등의 실제 활성 경로를 확인해.
현재 구현이나 기존 테스트 통과를 안전성의 증명으로 간주하지 마.
업무 의도가 불명확한 부분은 정책 확인 필요로 기록하고 그 외 경로의 점검은 계속해.
등록된 전체 API와 scheduler·가져오기·내보내기를 실제 권한/데이터 경계에 연결해.
현재 코드 관찰을 검증된 취약점으로 단정하지 마.
로컬 테스트 DB·Redis·업로드·외부 stub의 격리 방안을 준비하고 기존 환경을 훼손하지 마.
운영 비밀·개인정보를 출력하지 말고 외부 전송이나 운영 데이터 변경은 하지 마.
결과는 SECURITY_AUDIT_SCOPE_2026-09-08.md에 기록해.
이번에는 범위와 위협 모델을 완성하고 앱 수정이나 배포는 하지 마.
```

### 영역별 점검

```text
docs/SECURITY_AUDIT_PLAN_2026-09-08.md의 [S02 또는 하위 작업]을 수행해줘.
이번 점검에서 작성한 범위·결과만 이어받고 과거 프로젝트 문서는 판단 근거에서 제외해.
현재 버전에서 해당 영역의 입력부터 최종 데이터/부수 효과까지 추적해.
방어 코드가 이미 있어도 실제 적용과 우회/실패/동시성 경로를 검증해.
후보마다 공격자 권한, 통제 입력, 실제 도달 경로, 방어, 영향과 반례를 확인해.
기존 테스트를 재사용하고 필요한 검증은 합성 데이터·격리 HTTP/DB/Redis 환경에서 수행해.
정적 검토, mock, 실제 HTTP, 실DB/Redis, 브라우저, 운영 증거를 구분해 보고해.
취약점·보강·정책 확인 필요·미검증을 구분하고 근거 없이 심각도를 확정하지 마.
점검 범위의 검토 상태와 SECURITY_AUDIT_RESULTS_2026-09-08.md를 갱신해.
발견 사항의 수정은 제안까지만 하고 이번 단계에서 앱이나 운영 설정을 바꾸지 마.
끝에 핵심 결과, 실제 실행/skip/실패한 검사, 남은 조건과 다음 작업을 보고해.
```

### 수정 요청 시

```text
보안 결과 문서의 [검증된 finding ID]를 S15 절차로 수정해줘.
기존 사용자 변경을 보존하고 실패 재현을 먼저 고정해.
단일 화면이 아니라 실제 인증/권한/저장소 경계의 원인을 해결해.
수정 전 실패와 수정 후 차단, 정상 동작을 확인하고 관련 회귀 검사를 실행해.
수정 근거·검증·미완료 운영 조치를 기록해. 운영 배포·실제 발송·비밀 회전·Git 이력 재작성은 별개야.
```

## 8. 외부 기준과 사용 방식

- [OWASP ASVS](https://owasp.org/www-project-application-security-verification-standard/)는 웹 애플리케이션 보안 통제 검증의 기준으로 활용한다. 이번 계획은 5.0.0을 기준 참조로 삼고, 실행 시 필요한 요구사항의 버전과 ID를 확인해 연결한다. 전 항목 검증 없이 ASVS 준수/인증을 주장하지 않는다.
- [OWASP API Security Top 10 2023](https://owasp.org/API-Security/editions/2023/en/0x11-t10/)은 객체·기능·속성 권한, 자원 소비, 민감 업무 흐름, SSRF, 구성·재고·외부 API 소비의 누락 확인에 사용한다.
- [pnpm audit 공식 문서](https://pnpm.io/cli/audit)는 의존성 advisory 조회와 옵션 확인에 사용한다. 버전별 실제 옵션과 실행 결과를 기록한다.

공식 기준은 점검 누락을 줄이는 참고 자료다. 최종 판단은 현재 코드·실행 설정·도달 경로·검증 증거와 이번 대화에서 확인된 정책을 따른다. 과거 프로젝트 문서와 달라졌다는 사실만으로 취약점을 만들지 않는다.
