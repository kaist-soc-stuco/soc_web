# GPT-5.6 Luna max 최종 보안 수정 지시서

## Selected Design And Constraints

**최종 권장: 개인정보·파일 접근 정책을 같은 도메인 안에서 공통화하고, 인증·동시성·외부 발송은 각 상태 전이를 원자적으로 고친다. 현재 NestJS/Postgres/Redis 구조를 유지한다.**

이번 보고서는 유용한 수정 후보 목록이다. 43건 전체를 확정 취약점 또는 확정 High라고 부를 근거는 부족하지만, 실제 비밀글 fixture가 없었다는 이유로 소스와 합성 하네스에서 드러난 검사 누락을 미룰 이유도 없다. 나는 현재 소스에서 비밀글 본문에만 있는 검사, 댓글/파일의 scope-only 검사, 설문 파일 ID 해석 차이를 다시 확인했다. 먼저 이 경로에 실패하는 통합 테스트를 고정하고 수정하는 것이 가장 효과적이다.

아래 H00~H09는 **실행 순서**다. 설계 대안 번호가 아니다. [설계 비교](../proposals/resource-policy.md)의 Option 2를 권장하며, 사용자 요청에 맞춰 이 문서를 구현 가능한 수준으로 작성했다. 이 턴에서는 앱 코드를 고치거나 다른 task에 전송하지 않았다.

작업 담당 모델/설정: **GPT-5.6 Luna · reasoning max**. 한 작업 단위가 끝날 때마다 재현·수정·검증 결과를 남기고 다음으로 진행한다. 기존 모바일 개선은 보존한다. 과거 제품·디자인·보안 계획을 정답으로 취급하지 않는다. 이번 보안 결과는 재현할 증거이며 현재 소스와 테스트가 최종 근거다.

우선순위는 exploit severity와 다르다.

- **P0:** 배포 전에 닫아야 할 인증·접근·개인정보·명확한 입력/의존성 결함. 로컬 통합 재현으로 현재 영향 범위를 확정하고 즉시 수정.
- **P1:** 기능 무결성·자원 제한·외부 동작. 해당 기능 활성화 전에 검증.
- **P2/Ops:** 이미지·공급망·복구와 실제 운영 설정. 소스 패치 완료와 운영 확인 완료를 분리.

## Source Revision And Drift Check

- 입력 보고서 revision: `13c4b9d0c039362bf32b0c8d08ede8370ca9842d`.
- 판단 시 checkout: `221203ac24a642a3494a3133a63b9e518bbe616c` + 모바일 미커밋 변경.
- 두 commit 사이 API/shared/infra/lockfile 차이는 없다. Web에는 commit 및 미커밋 변경이 있으므로 원래 보고서 line number만 보고 덮어쓰지 않는다.
- 입력 collection SHA-256: `914ad6b64629881d74e69451a4b977fabf735392bae3bc82500ad6b698829ae5`. 세부 identity는 [context](../context.md).
- 현재 `.env`는 사용자가 요청한 Python 모바일 QA SSO이다. 운영 SSO/TLS 결과로 간주하지 않는다. 현재 설정·백업을 덮어쓰거나 production Compose에 넣지 않는다.

H00에서 `git status`, HEAD, 관련 diff, 현재 적용 설정의 **키 이름/기능 상태만** 기록한다. 입력과 코드가 달라졌으면 해당 finding만 새로 판단한다. 보안 결과 원본을 수정 완료 보고서로 덮어쓰지 말고 `hardening/security-2026-09-08/implementation/RESULTS.md`에 후속 결과를 만든다.

## Affected Components

| 수정 경계 | 확인/수정할 현재 위치 |
| --- | --- |
| 게시글·댓글·파일 | `apps/api/src/features/board/article.service.ts`, `comment.service.ts`, `repositories/article.repository.ts`, `apps/api/src/features/asset/asset.service.ts` 및 asset repository |
| 설문 입력·공개/관리 DTO | `apps/api/src/features/surveys/survey-responses.service.ts`, `survey-answer-validation.ts`, survey/question/section 서비스·repository, `shared/contracts/src` |
| 인증 상태 | `apps/api/src/features/auth/auth.service.ts`, `auth-session.service.ts`, `auth-session.repository.ts`, `pending-login.repository.ts`, `auth.controller.ts`, cookie/guard, Web login callback/auth 저장 |
| 위임·PII·외부 동기화 | `features/role-groups`, `features/contacts`, `features/users`, Google Sheets 관련 서비스 |
| 입력·자원·외부 작업 | `features/email`, `features/calendar`, `features/votes`, rich-text/CMS schema·sanitizer, Nginx/bootstrap |
| 공급망·배포 | manifests/`pnpm-lock.yaml`, API/Web production Dockerfile, `infra/docker/compose.prod.yml`, `.github/workflows` |

경로 prefix는 `apps/api/src`를 기본으로 한다. 공통화는 제어가 실제로 반복되는 지점에 한정한다. 모든 기능을 거대한 universal authorization engine으로 옮기지 않는다.

## Ordered Work Packages

### H00 · 증거 고정과 격리 테스트 환경

**목표:** 보고서의 “하네스 PASS”를 보안 PASS로 오독하지 않고 현재 실패를 검증 가능하게 만든다.

1. 현재 브라우저 QA DB와 분리한 임시 PostgreSQL·Redis/키 namespace를 사용한다. 실제 OAuth/SSO/SMTP/S3/Sheets 자격 증명을 쓰지 않는 fixture adapter를 구성한다. 기존 DB reset/seed 덮어쓰기를 하지 않는다.
2. 게스트, A/B 일반 사용자, 작성자, WRITE_REPLY, MODERATE_CONTENT, MANAGE_SURVEY만 가진 사용자, MANAGE_ROLES만 가진 사용자, 명시적 system admin을 준비한다.
3. 공개/비밀/익명/hidden/draft 게시글, 공개·비밀글 연결 파일, 미연결 A/B 파일, 설문 응답 파일, 철회 연락처를 만든다. 모든 식별자·내용은 합성한다.
4. 기존 실패 하네스가 임시 파일로만 남아 있으면 재사용 가능한 테스트로 옮긴다. 서비스 mock만으로 객체 경계가 닫혔다고 판정하지 않는다. HTTP → guard → service → 실제 repository → storage spy까지 확인한다.
5. `FEE_CONCURRENCY_TEST_DATABASE_URL`, `SURVEY_CONCURRENCY_TEST_DATABASE_URL`을 전용 DB에 연결한다. 보고서의 13 skipped는 필수 검증 부채다. DB가 없으면 해당 gate는 미완료로 남기고, 독립적인 다른 패치는 계속한다.

**완료:** H01~H07의 원래 실패를 보이는 회귀 테스트 목록, 테스트 데이터 정리 방법, 로그/이메일/외부 호출 side effect 범위가 기록되어야 한다.

### H01 · P0 · 게시판·자산·설문 접근 경계

대상: 익명 작성자 노출 S05-F01, 비밀글 댓글 S05-F02, 비밀 이전/다음 글 S05-F03, 비밀 첨부파일 S06-F01, 설문 파일 혼합 ID S07-F02, 설문 이미지 참조 S07-F03.

**지시:**

- 현재 본문의 `canReadSecretArticle` 의미를 출발점으로, board 활성/읽기 범위·published/hidden·작성자·비밀 권한을 한 정책 경계에서 계산한다. 댓글 read/create/engagement와 파일 bytes를 읽는 경로에도 같은 객체 정책을 적용한다. 삭제/수정/답글 권한은 읽기 권한과 별도로 유지한다.
- 정책 판단은 원본 author ID와 원본 resource metadata로 먼저 한다. 익명 DTO로 바꾼 빈 author ID를 권한 검사에 다시 사용하지 않는다.
- 공개 list/detail/search/prev-next/notification payload에 익명 작성자 이름·userId·영문명·다른 원본 식별자가 나오지 않게 명시적 public DTO를 만든다. 서버 내부 감사 식별자는 보존한다. 관리 화면의 신원 접근은 별도 권한 경로로만 제공한다.
- 비밀글 neighbor의 제목·작성자·첨부 thumbnail 등 부가 데이터도 같은 정책으로 필터/마스킹한다. 응답 코드만 바꾸고 bytes/snippet을 남기지 않는다.
- 파일 입력은 **단 한 번 정규화한 canonical assetIds**를 validation·ownership·persistence·download authorization에 동일하게 쓴다. `assetId`와 `assetIds`를 동시에 보낸 요청은 400. legacy 단일 필드만 허용할지는 클라이언트 호환성을 확인하되, 허용하면 canonical 배열로 변환한 뒤 전체 ID를 검사한다. 중복·빈 값·형식 오류·개수 상한도 검증한다.
- 설문 image/body/question reference의 **저장뿐 아니라 publish/edit/import/duplicate**에서 소유 또는 명시적 재사용 권한을 확인한다. `MANAGE_SURVEY`만으로 타인의 private file을 공개할 수 없게 한다. 단순히 공개 문서에서 참조되었다는 사실이 불법 참조의 승인으로 변하지 않게 한다.
- 기존 다중 참조 파일의 공개 의미를 정의한다. 일반 공개 파일은 참조해도 되지만, private 파일을 public 문서에 끼워 넣어 자동 공개하는 승격은 금지한다. 작성자가 자기 파일을 의도적으로 공개하는 기존 흐름은 유지한다. 기존 위반 reference는 읽기 전용 inventory부터 만들고 일괄 삭제하지 않는다.

**수용 테스트:** 게스트/B는 A의 비밀 댓글·직접 asset URL을 읽거나 engagement를 만들지 못하고, 거절 시 `storage.read` 호출이 0이어야 한다. A와 기존 허용 운영진은 정상 사용한다. `{assetId:A의 파일, assetIds:[B의 파일]}`은 응답/참조 생성 없이 실패한다. survey-only 관리자가 B의 private asset을 공개할 수 없어야 한다. 익명 응답 전체를 검사해 author PII가 없어야 한다. 페이지별 성공 경로도 동시에 확인한다.

### H02 · P0 · 인증 수명·SSO·CSRF·쿠키

대상: S02-F01~F05(세션 철회, refresh/consent 경합, browser binding, URL bearer), S04-F01~F02(proxy cookie, 서버 CSRF).

**지시:**

- persisted access JWT에 세션 식별자를 넣고 bearer를 받는 모든 경로에서 활성 Redis session·사용자 상태를 확인한다. 로그아웃/계정 정지/세션 revoke 이후 재사용을 거부한다. 기존 `sid` 없는 persisted JWT는 짧은 재로그인 전환으로 종료한다. 임시 로그인은 개인정보 비저장 의도를 유지하며 별도 수명 정책을 문서화한다. 이 작업을 이유로 동의 거부 사용자를 영구 저장하지 않는다.
- Redis에서 refresh JTI 검증+rotation과 revoke를 원자적으로 처리한다. Lua/CAS 등 현재 Redis로 구현하고 process-local mutex로 끝내지 않는다. revoke와 경쟁한 늦은 save가 세션을 부활시키지 않아야 한다. 동시 refresh는 하나의 유효 전환만 허용한다. 재사용 시 revoke 정책과 프론트 single-flight를 맞춘다.
- pending consent도 단일 소비/claim을 보장한다. 두 병렬 요청이 서로 다른 결정을 적용하거나 세션을 두 번 만들면 안 된다. 실패 시 재로그인이 필요한 fail-closed 처리는 허용하되 재사용 가능한 pending token을 복구하지 않는다. 관련 DB side effect는 가능한 범위에서 transaction/unique로 보호한다.
- SSO state를 **로그인을 시작한 브라우저의 HttpOnly transaction cookie**와 결합한다. provider nonce 검증도 유지한다. 다른 브라우저가 받은 code/state로 피해자가 공격자 계정에 로그인되는 테스트를 추가한다.
- 실제 callback은 cross-site POST일 수 있다. `SameSite=Lax` 쿠키가 그 POST에 항상 온다고 가정하지 않는다. 권장 구조는 callback에서 아직 로그인 확정하지 않은 서버 transaction을 기록하고, 고정된 same-site completion 경로에서 최초 browser binding을 검증한 뒤 세션을 발급하는 것이다. 필요한 HTTPS cookie 설정과 로컬 HTTP fixture의 차이를 명시한다. callback 수신만으로 session을 확정하는 우회 경로를 두지 않는다.
- `resultToken`/`pendingLoginToken` 같은 로그인 bearer를 URL·history·sessionStorage에 전달하는 구조를 없앤다. opaque HttpOnly transaction cookie + 서버 상태로 완료/동의를 처리한다. URL에 토큰을 두고 `replaceState`만 빨리 호출하는 것을 최종 해결로 삼지 않는다. access log·telemetry·오류 문자열에도 credential을 남기지 않는다.
- cookie 기반 unsafe method에 CSRF token/허용 Origin 검증을 적용한다. same-site 다른 origin도 거부해야 한다. CORS만으로 대체하지 않는다. 실제 SSO callback은 정확한 route에 한해 별도 state/browser-binding 검증을 적용한다. `/auth/*` 전체를 예외로 두지 않는다.
- production의 Secure/HttpOnly/path/domain/SameSite와 신뢰 proxy hop을 명시한다. 임의의 X-Forwarded-Proto를 신뢰하거나 trust proxy를 무조건 true로 하지 않는다. 내부 HTTP Nginx에서 upstream HTTPS 정보가 덮어써지는 현재 체인을 교정하고, production HTTPS cookie가 항상 Secure임을 확인한다. 로컬 HTTP 개발은 별도 profile로 유지한다.

**수용 테스트:** 두 browser context 간 callback 전달 거부, 정상 SSO POST→completion→동의 성공, consent/refresh 동시 요청 각각 유효 전환 하나, revoke race 후 세션 부활 없음, revoke된 bearer 거부. same-origin 정상 mutation 성공/불허 Origin·CSRF 누락 거부. TLS terminator→Nginx→API 모사에서 cookie flags 검증. 동의/완료 URL·browser storage·로그에 bearer가 없어야 한다.

### H03 · P0 · 의존성 패치·안전한 URL·초안 격리

대상: S12-F02~F04, CMS URL S09-F01, 계정 비분리 초안 S09-F02.

2026-09-08에 `pnpm audit --prod --json`을 다시 실행해 Moderate advisory 4건이 그대로임을 확인했다. 패키지별 최소 패치 기준은 아래와 같다. 실행 시 advisory와 lockfile의 **실제 해석 버전**을 다시 확인한다.

| 패키지 | 패치 기준 | 검증 근거 |
| --- | --- | --- |
| sanitize-html | 2.17.7 이상 호환 버전 | [SVG URI-list scheme bypass](https://github.com/advisories/GHSA-g8qq-57p8-ggw5) |
| @tiptap/core | 3.30.4 이상 호환 버전 | [mergeAttributes advisory](https://github.com/advisories/GHSA-cp6q-959q-f8rh) |
| qs | 두 advisory를 함께 피하는 6.16.0 이상 호환 버전 | [isBuffer advisory](https://github.com/ljharb/qs/security/advisories/GHSA-4mjr-xmp4-gh2g), [array-limit advisory](https://github.com/ljharb/qs/security/advisories/GHSA-x5fp-wj9c-mxmx) |

Tiptap 패키지군/extension/pm peer 호환을 맞춘다. qs는 상위 Express/body-parser 업데이트로 해결하는 것을 먼저 검토하고 override는 필요한 범위에만 적용한다. 무차별 major upgrade나 `audit --fix --force`를 사용하지 않는다. SVG animation 허용이나 qs parse/stringify 옵션 같은 advisory 전제가 앱에서 실제로 성립하는지 기록한다. advisory를 모두 앱 exploit으로 단정하지 않는다.

CMS link는 서버 URL allowlist를 둔다. 필요한 http/https, 상대 내부 링크와 명시적으로 사용하는 mailto/tel만 허용하고 javascript/data/vbscript, control character·혼합 대소문자/encoding 우회를 차단한다. URL 용도별 정책을 분리해 이미지 data URI 허용이 일반 링크에도 전파되지 않게 한다. 기존 저장 데이터는 read/render 시 안전한 fallback과 별도 inventory로 처리한다. React가 일부 javascript URL을 막더라도 서버 계약을 그대로 두지 않는다. 실제 browser marker 실행 전에는 S09-F01을 확정 stored XSS로 표기하지 않는다.

게시글·bulk-email draft/template·anonymous survey draft의 local/session storage key를 사용자/임시 세션/문서로 분리하고 로그아웃·계정 전환 시 민감한 초안 복원을 차단한다. 소유자 불명 legacy draft를 새 사용자 계정으로 자동 귀속하지 않는다. 비민감 UI 설정은 삭제하지 않는다.

**수용 테스트:** 저장→복원→렌더의 rich-text/editor 회귀, 안전/위험 URL test table, 관리자 CMS와 일반 게시판 양쪽 확인. A 로그아웃→B 로그인 시 A의 초안/메일 수신자·내용 복원 0. dependency advisory 4건 해소를 lockfile과 재audit로 입증하고 남은 dev advisory는 분리 기록한다.

### H04 · P0/P1 · 권한 위임·공개 DTO·철회·민감 cache

대상: S03-F01~F02, S07-F01, S08-F01~F02/F05~F06.

**권한 정책 권장 결정:** 일반 `MANAGE_ROLES`는 무제한 최고관리자로 취급하지 않는다. 명시적으로 확인되는 기존 system administrator만 최고 권한 부여를 수행하고, delegated role manager는 자신에게 허용된 위임 범위 안에서만 생성·수정·배정한다. 단순히 “자기가 가진 bit의 부분집합”만 검사하면 role manager끼리 권한을 합치는 우회가 남을 수 있으므로 reserved 권한/위임 가능 집합을 명시한다. system role 배정·기존 강력한 role에 멤버 추가·bulk replace·self assignment도 같은 경계로 검사한다. 기존 역할을 임의로 삭제/강등하지 말고 영향 inventory와 최소 한 명의 관리자 유지 절차를 준비한다. 정확한 최고관리자 의미가 현재 코드에서 결정되지 않으면 그 migration만 open decision으로 남기고 다른 패치를 계속한다.

**공개 데이터 정책 권장 결정:** 공개 조직도는 이름·직책·부서 등 공개 목적 필드만 별도 DTO로 제공한다. 저장 동의 boolean 하나를 학번·개인 이메일·전화번호의 인터넷 공개 동의로 확대하지 않는다. 별도 공개 승인 근거가 없는 필드는 공개 DTO에서 제외하고 관리 endpoint에 남긴다. 현재 consumer를 조사한 뒤 public endpoint를 최소화하거나 unused이면 관리 경로로 통합한다.

- roadmap public repository에서 `isVisible`을 filter하고 source filename 등 관리 metadata를 제거한다.
- survey public list/detail/analytics DTO에서 creator/내부 lineage/Sheets ID·URL·sync metadata를 제거한다. 참여에 필요한 자격·기간·문항 필드는 유지한다.
- 연락처 외부 sync는 실제 write 시점에 consent를 다시 확인한다. 철회는 **다음 payload에서 제외**하는 것과 **이미 Sheets에 남은 행 제거/정정**를 모두 다뤄야 한다. queue에 오래된 PII snapshot을 계속 저장/재시도하지 않는다. 기존 Sheet row를 지우는 범위는 해당 앱이 소유하는 행으로 제한한다.
- contacts/fee/audit/export 및 기타 민감 응답에 `Cache-Control: private, no-store`를 일관 적용하고 intermediary cache bypass도 확인한다.
- 외부 sync는 actor 또는 system job, resource/revision, 결과, job ID로 감사 기록을 남긴다. payload 전체·응답 PII를 감사 로그에 복제하지 않는다. 감사 실패를 무조건 모든 사용자 기능 장애로 확대하지 말고, 권한/금전 변경 같은 필수 추적 경계는 transaction/outbox 정책으로 보장한다.

**수용 테스트:** role-only 사용자의 권한 상승 및 기존 powerful role 배정 거부, 명시 admin 정상 작업. 공개 DTO의 금지 필드 부재, hidden course 미반환. consent=false/철회 뒤 새 외부 payload에 PII가 없고 fake Sheet의 기존 해당 행도 정리됨. export header/감사 trace 검증. 실제 Google ACL/기존 외부 copy 정리는 Ops 상태로 별도 남긴다.

### H05 · P1 · 과비 원장·일괄 변경·투표 마감 원자성

대상: 과비 batch S08-F03, payment 중복 S08-F04, vote close/submit S11-F01.

- fee bulk는 요청 단위 all-or-nothing을 기본 권장으로 한다. 전체 validation → 한 transaction의 mutation/원장/필수 audit 또는 outbox → commit 후 enqueue로 바꾼다. 부분 성공이 필요한 기존 계약이면 항목별 성공/실패와 재시도 semantics를 명시적으로 제공하되, 일부 변경 후 일반 500만 반환하는 상태는 없앤다.
- payment에는 batch idempotency key 및 canonical payload hash를 둔다. 동일 key/동일 payload 재시도는 기존 결과, 동일 key/다른 payload는 conflict. 금액·일시·사용자 값이 같다는 이유만으로 합법적인 반복 입금을 합치지 않는다. 기존 행에 추측한 외부 결제 ID를 채우지 않는다.
- vote 제출은 repository transaction 안에서 vote 상태/마감과 voter eligibility를 다시 확인한다. close와 submit이 공유하는 lock/조건을 정의하고 일관된 lock 순서를 사용한다. 기본 cutoff는 lock 획득 후 저장 경계의 DB 시각이다. 요청 시작 시각만으로 마감 후 ballot을 허용하지 않는다. voter lock·hasVoted·익명 ballot 저장은 유지한다. user ID를 ballot row에 추가하는 방식으로 추적하지 않는다.

**수용 테스트:** 두 번째 fee 항목 실패 후 전체 상태/원장/outbox 일관성, 동일 payment request 동시 재시도 중복 0, 정당한 별도 입금 허용. 실제 격리 Postgres에서 close 선행→submit 거부/submit 선행→정상 완료/동일 voter 병렬 제출 1건. 보고서에서 skip된 fee/survey concurrency 테스트도 전부 실행한다.

### H06 · P1 · SMTP 불확실 상태와 queue 소유권

대상: SMTP 중복 S10-F01, stale worker S13-F03, 외부 sync 감사 S08-F06.

**SMTP는 DB transaction이나 Message-ID만으로 exactly-once가 되지 않는다.** provider가 idempotency 또는 수신 결과 조회를 보장하지 않는 한 “수신 서버가 받았지만 응답/DB 기록이 유실됨”을 완전히 판별할 수 없다.

- delivery attempt와 DB 상태를 분리하고 `PENDING/SENDING/SENT/UNKNOWN/FAILED`에 해당하는 전이를 명시한다. SMTP 수락 이후 DB 실패 또는 결과 불명 timeout은 UNKNOWN으로 유지하며 자동 재발송하지 않는다. SENDING worker가 죽은 경우도 확정 실패로 단정하지 않는다.
- 확실한 전송 전 실패만 자동 retry한다. ambiguous 건은 message/attempt 식별자와 운영 확인 후 명시적 재발송으로 처리한다. Message-ID는 추적 수단이며 recipient 서버의 중복 제거 보장은 아니다. 수신자 일부 수락도 기록해야 한다. 새 전송 전 intent/outbox를 저장하되 외부 중복 위험의 잔여를 보고한다.
- Sheets/Calendar queue에 claim token/generation과 lease를 두고 완료·실패 update가 현재 claim과 일치할 때만 반영되게 한다. 늦은 worker가 새 작업 상태를 덮어쓰지 못하게 한다. 외부 write가 lease 이후 뒤늦게 도착하는 경우 DB fencing만으로 막히지 않으므로 provider idempotent resource key/ETag·revision check·reconciliation을 함께 설계한다.
- cleanup scheduler는 process-local flag 대신 배포 replica 수에 맞는 단일 owner/분산 lease를 적용하고, 삭제 직전 파일 참조를 다시 확인한다. 현재 데이터에 대량 삭제를 수행해 테스트하지 않는다.

**수용 테스트:** fake SMTP 성공→DB 실패→retry에서 발송 호출 증가 없음과 UNKNOWN 표시. 확정 pre-send 실패는 retry 가능. 두 worker·lease 만료·재claim 이후 stale 완료 거부, 외부 결과와 최신 DB revision reconciliation. 임의 실메일/Google 쓰기로 검증하지 않는다.

### H07 · P1 · 업로드·정규식·fetch·공통 자원 상한

대상: S06-F02, S09-F03, S10-F02~F03, S13-F01~F02.

- presign은 저장 전 크기 정책을 enforcement할 수 있는 provider 방식으로 바꾼다. signed Content-Length 문자열만 넣고 S3에서 보장된다고 단정하지 않는다. POST policy content-length-range, 검증 가능한 checksum/완료 상태, 사용자별 개수·바이트 quota와 만료/cleanup을 조합한다. 실제 provider 테스트가 없으면 서버 계약/mock 통과와 provider 보장을 구분한다.
- 사용자 제공 regex에 길이 제한만 추가하지 않는다. 선형 시간 엔진/지원하는 validation preset으로 전환하거나 격리 실행 timeout을 사용한다. 현재 JS regex 문법과 호환 불가 패턴 inventory부터 만들고 명시적 migration error를 낸다. sync RegExp를 Promise.race로 감싸는 방식은 event loop 차단을 중단하지 못한다.
- ICS redirect는 기본 거부 또는 hop별 allowlist/protocol/IP/DNS 검증으로 제한한다. 설정자만 제어할 수 있다는 현재 전제를 기록한다. 사용자 임의 URL SSRF가 확정됐다고 쓰지 않는다.
- holiday/ICS/SSO exchange 등 외부 fetch에 전체 timeout·redirect count·streaming byte cap을 둔다. 응답 전체를 읽은 뒤 size를 검사하는 것으로 메모리 상한을 증명하지 않는다.
- query/body/배열/answers/첨부 목록/메일 수신자·본문에 명시적 상한을 준다. pagination·cursor·stream/bounded export·결과 수 cap을 사용한다. 현재 Zod pipe 주석을 무작정 전역 활성화하지 말고 누락 schema와 route를 보완한다.
- auth/search/calendar/survey/upload/receipt별 rate budget을 구분하고, 사용자/IP key와 신뢰 proxy를 함께 검증한다. 학교 NAT 사용자를 IP 하나로 과도하게 차단하지 않는다. 공유 Redis 실패 시 인증과 anonymous cache/rate 경계의 fail-closed/제한적 fallback을 명시한다.
- ingress와 direct API 우회 양쪽에 request/body/connection/provider timeout·상한을 둔다. 이미 존재하는 20MiB 파일과 21MiB multipart 제한의 차이를 유지해 정상 업로드를 깨지 않게 한다.

**수용 테스트:** 각 상한 바로 아래/같음/초과, chunked·거짓 Content-Length·중단 연결, fake slow/large provider, 악성 regex의 제한 시간 종료, NAT 정상 burst, rate 차단 시 429와 정상 복구. 작은 격리 데이터로 측정하고 로컬 QA/운영 stack에 stress를 가하지 않는다.

### H08 · P2/Ops · 배포·진단·공급망·복구

대상: S10-F04, S11-F02~F03, S12-F01/F05/F06, S13-F04 및 H02/H07 운영 전제.

- public health는 상태/code만 반환하고 raw DB/Redis exception은 correlation ID와 함께 서버에서만 기록한다. 오류에 secret이 섞이지 않게 한다.
- MockModule은 명시적으로 development/test일 때만 등록한다. `.env` 로딩 전 process env가 비었을 때 켜지는 경로를 닫는다. 현재 mock은 greeting/counter 경로이며 운영 인증 우회가 확인된 것은 아니다. Python QA fixture는 production 시작에서 거부하고 배포 artifact와 분리한다.
- SheetJS tarball은 공급자 검증 가능한 integrity/checksum과 재현 가능한 lock을 확보한다. CDN 사용만으로 변조됐다고 판단하지 않는다. 알려진 오래된 registry `xlsx`로 단순 치환하지 않는다. 전용 secret/dependency/container scan을 CI에 추가하되 scan 결과를 실제 실행하지 않고 PASS라 쓰지 않는다.
- production image non-root, runtime dependency 최소화, capability/no-new-privileges, 명시적 writable upload/tmp/secret-read 경로, digest pinning을 적용한다. read-only rootfs를 켜기 전에 migration/업로드/health/restart가 동작하는지 확인한다.
- ignored `.env`/secrets 존재는 유출 증거가 아니다. 값 출력·유효성 실호출 없이 운영값 재사용 여부·접근자·backup/CI 복제 여부를 확인한다. 유출/과도한 공유 증거가 있을 때만 provider별 rotation/revocation 절차를 실행 대상으로 올린다. 토큰/키를 임의 폐기하지 않는다. 암호화 key 회전은 기존 데이터·투표 decrypt/backup 복원을 포함한다.
- 실제 TLS hop/firewall·S3 bucket/IAM·Google folder/Sheet ACL·retention·SMTP 정책은 소스로 확정할 수 없다. 목적별 Google 결과 폴더 설정이 실제 사용되는지 확인하고 의도치 않은 operations folder fallback을 없앤다. 외부 계정 확인이 필요하면 그 항목만 보류한다.
- Redis maxmemory와 메모리 여유를 인증/queue/cache 용도에 맞춰 산정한다. allkeys eviction으로 살아 있는 세션/queue를 임의 제거하지 않는다. backup은 PostgreSQL·asset bytes/metadata·암호화 키를 함께 복원해야 한다. Redis 세션 복원으로 철회된 세션이 부활하지 않게 invalidate 전략을 둔다. 별도 환경에서 복원 drill과 RPO/RTO 실측을 남긴다.

### H09 · 최종 통합 검증과 판정

각 단위가 통과하면 관련 범위 검사를 종료하고 다음 단위로 이동한다. 마지막에 전체 품질 검사와 핵심 공격 경계 회귀를 한 번 수행한다. 새 실패/변경이 없는데 같은 검사를 반복하지 않는다.

## Compatibility And Migration

- public DTO 축소는 API-client/contracts/Web을 함께 바꾼다. private data를 잠시 양쪽 형식으로 계속 반환하는 호환 전략은 사용하지 않는다.
- session sid 전환은 기존 persisted token 재로그인을 허용한다. 임시 로그인과 비저장 동의를 유지한다.
- roles/payments/queue schema는 additive migration부터 하고 기존 데이터의 불변식 위반을 읽기 전용 보고한다. 임의 role 삭제·원장 중복 추측 삭제·private asset 일괄 삭제 금지.
- 응답별 403/404는 기존 객체 은닉 정책을 일관 적용한다. 권한 없는 사용자에게 resource 존재·제목을 새로 노출하지 않는다.

## Tactical Protections During Migration

공통화가 길어지면 기존 댓글/파일/설문 reference sink에 먼저 국소 차단과 regression test를 적용한다. 이후 같은 테스트를 유지하며 정책 경계로 옮긴다. 기능 flag로 격리하더라도 이미 고친 privacy 경로를 재개방하지 않는다. Google/SMTP의 현재 비활성/dry-run을 유지하고, 로컬 Python fixture를 실제 운영 인증 평가로 대체하지 않는다.

## Tests And Security Validation

기본 명령은 현재 package scripts에 맞는다.

```powershell
pnpm build:shared
pnpm typecheck
pnpm lint
pnpm test
pnpm build
pnpm audit --prod --json
```

별도 DB의 실제 concurrency를 포함하여 **대상 보안 회귀 테스트 skipped=0**을 요구한다. 새 테스트는 취약한 버전에서 실패하고 수정 후 통과해야 한다. provider/운영 검증이 불가능하면 mock 계약 통과와 실제 검증 미완료를 명확히 구분한다. 모바일 QA는 320/390/430에서 로그인/동의/작성/설문 흐름이 유지되는지만 관련 범위로 확인한다.

## Performance And Resource Benchmarks

현재 성능/메모리 측정 결과는 없다. 소스 기반 예상은 요청별 추가 session/resource 조회와 DB lock 경합이다. 보안 검사를 생략하는 캐시로 성능을 보정하지 않는다.

- 동일 합성 dataset과 동시성에서 기존/패치 후 list/detail/asset/submit의 p50/p95·SQL count·Redis roundtrip·peak RSS 비교.
- 기본 gate 제안: 새 unbounded buffer/N+1 없음, 핵심 list query 수가 row 수에 비례해 늘지 않음, timeout 후 대기 작업 정리, 정한 body/response cap보다 큰 buffering 없음.
- p95가 같은 테스트에서 20% 이상 악화되면 원인을 기록하고 batching/index/lock 범위를 조정한다. 20%는 측정 결과나 확정 SLO가 아닌 조사 기준이다. 보안 불변식을 통과한 상태에서 운영 budget을 확인한다.

## Rollout And Rollback

현재 task는 수정 handoff이며 배포/merge/실메일/외부 공유를 포함하지 않는다. 후속 구현은 검토 가능한 작은 patch/commit 단위로 진행한다.

schema 확대 → server validation/policy → public DTO/client 전환 → 기존 reference/role/job 정리 → feature 활성화 순서를 권장한다. rollback은 취약한 읽기 경계 복원이 아니라 해당 기능 일시 중지/안전한 이전 patch 유지로 수행한다. 원장/키/queue migration을 단순 down migration으로 데이터 손실시키지 않는다. 복구 절차는 synthetic staging에서 검증한다.

## Acceptance Criteria

| gate | 완료 조건 |
| --- | --- |
| G-A 개인정보·인증 | H01/H02/H03 핵심 회귀 통과. 현재 재현되지 않으면 source/route/fixture 반증을 기록. 운영 HTTPS cookie/browser callback 검증은 별도 명시 |
| G-B 권한·공개 데이터 | H04 최소 공개/위임/철회 정책 구현 또는 해당 기능 비활성. “정책 미정”으로 공개 PII를 그대로 둔 채 완료 처리하지 않음 |
| G-C 기능 무결성 | 과비/투표/메일/외부 sync가 켜지는 배포에서 H05/H06 통과. UNKNOWN SMTP 자동 재발송 없음 |
| G-D 자원·운영 | 활성 public/provider 경로 상한/timeout/rate 확인. 실제 deployment·ACL·backup는 증거가 있을 때만 완료 |
| G-E handoff | 아래 43건 모두 결과 상태·수정 파일·test·잔여 전제·담당이 기록됨. 코드 완료/운영 완료/배포 가능을 별개로 판정 |

### 43건 처리 매핑

이 표의 결정은 권장 처리 방식이며 패치 완료 선언이 아니다. 코드 재확인=이번 직접 소스 읽기, 보고서 근거=기존 하네스/조사 인용, 재audit=이번 registry 재조회다.

| Finding · 내용 | 판정/우선순위 | 작업 |
| --- | --- | --- |
| S02-F01 · 철회 후 persisted bearer | 코드 재확인, 수정 P0 | H02 |
| S02-F02 · refresh 병렬 rotation | 코드 재확인, 실제 Redis race 고정 P0 | H02 |
| S02-F03 · consent 중복 소비 | 코드 재확인, 실제 Redis/DB race 고정 P0 | H02 |
| S02-F04 · initiating browser 미결합 | 코드 재확인, 2-browser 재현 후 수정 P0 | H02 |
| S02-F05 · URL bearer | 코드 재확인, 토큰 전달 구조 수정 P0 | H02 |
| S03-F01 · role 위임 ceiling | 코드 재확인, 정책 기본안+서버 enforcement P0 | H04 |
| S03-F02 · hidden roadmap/관리 metadata | 보고서 근거, public DTO 수정 P1 | H04 |
| S04-F01 · proxy/Secure cookie | 코드 재확인, production chain 의존 P0 | H02/H08 |
| S04-F02 · CSRF 서버 거부 부재 | 코드 재확인, CORS와 구분해 수정 P0 | H02 |
| S05-F01 · 익명 작성자 raw DTO | 코드 재확인, public identity 최소화 P0 | H01 |
| S05-F02 · 비밀글 댓글 | 코드 재확인, 부모 객체 접근 경계 P0 | H01 |
| S05-F03 · 비밀 prev/next metadata | 보고서 근거, 같은 privacy 정책 적용 P0 | H01 |
| S06-F01 · 비밀 첨부파일 bytes | 코드 재확인, storage read 전 차단 P0 | H01 |
| S06-F02 · presign 크기/반복 | 보고서 근거, provider enforcement 조건 P1 | H07 |
| S07-F01 · survey 내부 metadata | 보고서 근거, public DTO 축소 P1 | H04 |
| S07-F02 · assetId/assetIds 불일치 | 코드 재확인, canonical 입력 강제 P0 | H01 |
| S07-F03 · 설문 이미지 공개 승격 | 보고서+asset sink 재확인, 권한 없는 publish 차단 P0 | H01 |
| S08-F01 · public contact PII | 코드 재확인, 공개 최소 필드 권장 P0 | H04 |
| S08-F02 · 철회 연락처 Sheets egress | 코드 재확인, 재전송 및 기존 copy 정리 P0 | H04/H06 |
| S08-F03 · fee batch 부분 실패 | 보고서 근거, 계약 원자성 P1 | H05 |
| S08-F04 · payment 재시도 중복 | 보고서 근거, request idempotency P1 | H05 |
| S08-F05 · 민감 export cache | 보고서 HTTP 근거, no-store 보강 P1 | H04 |
| S08-F06 · sync 감사 누락 | 보고서 근거, PII 비복제 trace P1 | H04/H06 |
| S09-F01 · CMS 위험 scheme | 보고서 근거, URL 계약 수정 P0; browser XSS 확정 아님 | H03 |
| S09-F02 · 계정 비분리 browser 초안 | Web drift 재확인 후 수정 P1 | H03 |
| S09-F03 · regex ReDoS | 보고서 시간 측정 근거, CPU 제한 P1 | H07 |
| S10-F01 · SMTP 성공 후 재발송 | 코드/보고서 근거, UNKNOWN 전이 P1 | H06 |
| S10-F02 · ICS redirect SSRF 후보 | 설정자 제어/현재 비활성, egress 제한 P1 | H07 |
| S10-F03 · holiday fetch 무상한 | 보고서 근거, timeout/byte cap P1 | H07 |
| S10-F04 · Google folder/ACL | 실제 외부 ACL 미확인, 설정 연결 수정+Ops | H08 |
| S11-F01 · vote close/submit race | 코드 재확인, DB cutoff P1 | H05 |
| S11-F02 · raw health error | 보고서 근거, 최소 응답 P2 | H08 |
| S11-F03 · env 순서로 mock 등록 | 보고서 근거, 명시 dev-only P2; auth bypass 아님 | H08 |
| S12-F01 · 로컬 credential material | 유출 확정 아님, 노출 evidence 확인 Ops | H08 |
| S12-F02 · sanitize-html advisory | 재audit 1건, 호환 패치 P0 | H03 |
| S12-F03 · Tiptap advisory | 재audit 1건, 패키지군 패치 P0 | H03 |
| S12-F04 · qs advisory | 재audit 2건, 6.16.0 이상 해소 P0 | H03 |
| S12-F05 · SheetJS tarball integrity | 변조 확정 아님, 재현 가능한 공급망 P2 | H08 |
| S12-F06 · runtime root/최소화 | 방어 심화 P2, writable path 회귀 | H08 |
| S13-F01 · unbounded materialization | 보고서 근거, route별 상한 P1 | H07 |
| S13-F02 · rate/timeout | 보고서+proxy 근거, direct API도 고려 P1 | H07/H08 |
| S13-F03 · stale worker/replica | 보고서 근거, fencing+외부 reconciliation P1 | H06 |
| S13-F04 · memory/backup 복원 | 실제 Ops 미검증, 제한/복원 drill | H08 |

## Open Decisions

정책 기본안은 공개 PII 최소화, 제한된 role delegation, fee all-or-nothing, 저장 경계의 vote cutoff, ambiguous SMTP 자동 retry 금지다. 이를 구현 방향으로 사용한다. 기존 소비자/운영 계약이 충돌한다는 구체적 증거가 나오면 그 항목의 migration만 질문하고, 나머지 독립 작업은 진행한다.

외부 접근/권한 없이는 provider ACL·기존 외부 copy 삭제·credential rotation·실제 복원 drill을 완료로 처리할 수 없다. 이것은 전체 구현을 멈출 이유가 아니다. 결과에 `fixed_verified`, `mitigated`, `not_reproduced_with_evidence`, `policy_or_ops_pending` 중 하나와 근거를 남긴다. 테스트 전체 PASS만으로 미검증 후보를 자동 종료하지 않는다.

### Luna max에게 전달할 시작 지시

```text
hardening/security-2026-09-08/implementation/domain-policy.md의 최종 권장안을 구현해라.
GPT-5.6 Luna, reasoning max로 H00~H09를 순서대로 진행한다.
이 문서를 계획 작성 요청으로 다시 해석하지 말고, 현재 코드에서 재현 테스트를 만든 뒤 수정·검증해라.
기존 모바일 변경과 로컬 Python SSO QA 설정을 보존하고 과거 계획 문서를 요구사항으로 참조하지 마라.
43개 finding을 확정 취약점으로 일괄 취급하지 말되, 현재 코드의 privacy/asset/인증 검사 누락을 fixture 부재로 미루지 마라.
공통 도메인 정책, canonical asset 입력, 원자적인 인증/원장/투표 전이, SMTP UNKNOWN/fencing을 권장안대로 적용해라.
현재 stack/실제 계정 대신 격리 DB·Redis와 합성 provider를 사용하고 13개 skipped concurrency 검사를 실제 실행해라.
외부 운영 확인이 막힌 항목만 pending으로 남기고 다른 수정은 계속 완료해라.
권한 없는 외부 전송, 비밀값 출력/commit, 운영 credential 임의 rotation, 기존 데이터 reset을 하지 마라.
단위별 작은 patch와 원래 실패/수정 후 성공 증거를 남기고, 마지막에 RESULTS.md에 43건 상태와 release gate를 보고해라.
```
