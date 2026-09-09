# 독립 보안 재점검 및 H00–H09 구현 결과 — 2026-09-09

대상은 현재 `HEAD 8fff1013bfa8ee811e9bbafab19e0705545c39b2`와 작업 트리다. 과거 계획·결과 문서를 요구사항으로 재사용하지 않았으며, 현재 코드·설정·테스트와 이번 독립 재점검에서 재현된 문제를 기준으로 수정했다. 기존 사용자 변경사항과 모바일 개선 작업은 보존했다. H00–H09는 결과를 묶기 위한 보고 단계이지 과거 문서의 요구사항을 재활용한 것이 아니다.

## 최종 판정

`fixed_verified`는 현재 코드 경계와 합성/격리 테스트에서 수정 효과를 확인했다는 뜻이다. `mitigated`는 코드 방어는 확인했지만 실제 외부 provider·배포 환경의 증거가 없어 운영 확인이 남았다는 뜻이다. 따라서 아래 판정은 운영 전체의 보안 완료 선언이 아니다.

| 단계 | 판정 | 현재 결과 | 남은 전제 |
| --- | --- | --- | --- |
| H00 | `fixed_verified` | 현재 checkout, 변경 보존, 격리 DB 기준을 고정 | 없음 |
| H01 | `fixed_verified` | 게시글·익명 작성자·asset·설문 reference 경계 수정 | 기존 데이터의 불법 reference inventory는 운영 작업 |
| H02 | `fixed_verified` | session/revoke, SSO browser binding, CSRF, cookie/proxy 경계 수정 | 실제 TLS terminator·IdP 연동은 운영 확인 |
| H03 | `fixed_verified` | dependency advisory 0건, URL, draft namespace, regex 실행 경계 수정 | legacy draft inventory는 별도 정리 가능 |
| H04 | `fixed_verified` | role ceiling, 공개 DTO, consent 재확인, 민감 응답 no-store | 실제 Google ACL·기존 외부 row 정리는 운영 확인 |
| H05 | `fixed_verified` | fee 원자성/idempotency와 vote DB fencing 검증 | 외부 결제 provider 계약은 합성 범위 |
| H06 | `mitigated` | SMTP `UNKNOWN`, 명시 retry, queue/resource fencing, cleanup DB fence | provider idempotency·reconciliation은 운영 확인 |
| H07 | `mitigated` | quota reservation, streaming/cap, rate/fetch/regex 제한 | 실제 S3 정책·운영 부하 검증 필요 |
| H08 | `mitigated` | health/mock/runtime/supply-chain/CI 방어 적용 | hosted CI scan, TLS/ACL/secret/backup 확인 필요 |
| H09 | `fixed_verified` | build·typecheck·lint·audit·로컬 Docker smoke 및 fake SSO browser context 통과; 이번 로컬 API 실행 152 pass/0 fail/21 skip | 전용 DB를 붙인 concurrency 재실행과 실제 IdP·실배포는 별도 범위 |

## 후속 UI·seed 회귀 보정

- 재현: 행사 seed가 SVG의 실제 바이트 수가 아닌 nominal `sizeBytes`를 `Content-Length`로 저장해 행사 목록 브라우저 요청이 잘린 응답으로 실패했다. 이미지가 없거나 로드에 실패한 행사 카드에는 fallback이 없었고, 설문 카드에도 장소 행이 함께 표시됐다. 홈 소식·일정에는 skeleton이 남아 있었으며 로그인 버튼이 클릭 중 문구로 바뀌었다.
- 수정: `apps/api/drizzle/seed.ts`가 파일의 실제 바이트 수를 저장하고, `apps/web/src/features/events-surveys/events-surveys-grid.tsx`와 `apps/web/src/components/organisms/event-carousel.tsx`가 이미지 실패·부재 fallback과 행사 전용 `📍 장소 미정`을 렌더링한다. 설문 카드에는 장소 행을 만들지 않으며, 홈 소식·일정 skeleton과 로그인 중 문구를 제거했다. `tools/security_qa/run_browser_e2e.ps1`는 Windows PowerShell 5.1에서도 합성 SSO child process 환경을 전달하도록 호환성을 보완했다.
- 검증: seed 후 행사 포스터 8개가 HTTP 200으로 실제 바이트를 끝까지 반환했다. 행사 asset 요청을 격리 브라우저에서 차단한 경우에도 `/events`에 fallback 아이콘 8개·깨진 이미지 0개·`장소 미정` 8개가 렌더링됐다. 로컬 `/events`, `/surveys`, `/`의 DOM·화면에서 행사/설문 카드 배치를 확인했고, `pnpm --filter @soc/web test` 37/37, root build/typecheck/lint 및 격리 fake SSO Playwright browser context E2E를 통과했다.
- seed 기준: 이미지 3의 8개 공약 문구는 `REFERENCE_PLEDGE_SEEDS`에 원문으로 복원했다. 현재 `.env`의 `SEED_MODE=demo`는 기존 설계대로 demo 공약 3개를 생성하므로, 8개 reference 화면을 보려면 별도 격리 DB에서 `SEED_MODE=reference`를 사용해야 한다.
- 로그인 확인: 현재 개발 `.env`의 `SSO_LOGIN_URL=/__local-sso/authorize`는 Python fixture와 같은 origin에서만 동작한다. 앱을 `localhost:8080`으로 열면 해당 POST가 404이고, fixture를 띄운 `http://192.168.0.3:8765/`에서는 정상 응답한다. 격리 Compose에서는 이 origin을 사용한 fake SSO smoke와 temporary/persisted browser context를 통과했다. 이는 실제 KAIST IdP·운영 redirect/TLS 설정의 증거가 아니다.

## 독립 재점검 항목별 재현·수정·검증

### 1. 게시글 첨부와 익명 작성자 회귀

- 수정 전 재현: `ArticleAssetsSchema`의 `min(1)` 때문에 `assets: []`인 첨부 없는 글, 빈 첨부 초안, 기존 첨부 전체 제거가 거절됐다. 익명 author DTO에서 `userId`를 제거한 뒤 Web이 그 값을 기준으로 `canEdit`을 계산해 본인 익명글도 편집할 수 없었다.
- 수정: `shared/contracts/src/schemas.ts`에서 최소 개수 제약만 제거하고 최대 50개·중복 검사는 유지했다. `apps/api/src/features/board/article-access.ts`와 `shared/contracts/src/http/board.ts`에 서버 계산 `canEdit`을 추가했다. 내부 author ID로만 소유권을 판단한 뒤 공개 DTO에서는 익명 `userId`를 생략한다. `article.service.ts`는 실제 owner ID로 update/delete를 검사한다.
- 검증: `article-access.test.js`, `article-html-sanitization.test.js`에서 빈 목록, 51개, 중복, 익명 DTO JSON, 본인 익명글 수정, 타 사용자 거절을 확인했다. 기존 격리 실행은 API 173/173 통과했고, 이번 로컬 재실행에서도 관련 회귀 테스트가 통과했다.
- 잔여 제한: 관리자 전용 익명 신원 공개 경로 외에는 익명 신원을 응답하지 않는다.

### 2. SMTP 후속 DB/audit 실패에 따른 중복 발송

- 수정 전 재현: `SMTP 성공 → 성공 audit 저장 실패`가 aggregate를 `FAILED`로 만들고 명시 retry가 새 SMTP 호출을 수행했다.
- 수정: `apps/api/src/features/email/bulk-email.service.ts`에서 provider 결과와 audit/결과 persistence를 분리했다. provider 수락·부분 수락·timeout·결과 저장 실패는 attempt와 aggregate를 `UNKNOWN`으로 보수적으로 기록한다. `bulk-email.repository.ts`는 `SENDING/SENT/UNKNOWN` attempt가 있으면 `FAILED` retry claim을 거절하고, aggregate/attempt 전이를 조건부 update로 방어한다. 명시 retry는 확실한 pre-send `FAILED`만 대상으로 한다.
- 검증: `email-delivery-state.test.js`에서 SMTP 성공 후 audit 실패, SMTP 성공 후 결과 저장 실패, timeout, 일부 수신자 수락, aggregate/attempt 불일치, 확실한 pre-send 실패 후 1회 retry를 각각 실행했다. 후속 DB/audit 실패 뒤 SMTP 호출 횟수 증가는 `0`이었다.
- 잔여 제한: provider가 idempotency key 또는 결과 조회를 제공하지 않으면 이미 수락된 외부 메일을 DB만으로 취소할 수 없다. `UNKNOWN` reconciliation과 provider 계약은 운영 확인이다.

### 3. 정규식 ReDoS

- 수정 전 재현: `^((a|aa))+$`가 안전성 검사를 통과했고, `'a'.repeat(40) + '!'`에서 동기 `RegExp.test`가 실행 제한을 넘겼다.
- 수정: `apps/api/src/features/surveys/survey-regex-policy.ts`에서 패턴 문법만 API에서 compile하고 실제 실행은 종료 가능한 `worker_threads` 격리 worker에서 한다. 100ms timeout 시 worker를 terminate하고, pattern 256자·입력 10,000자 상한을 적용했다. `Promise.race`로 동기 실행을 감싸지 않았다. 기존 JavaScript 정규식 문법(lookaround/backreference 포함)은 compile 허용하고, 문법 오류만 명확히 거절한다.
- 검증: `resource-limits.test.js`에서 해당 pathological pattern의 syntax 통과, 악성 입력의 `answer_regex_timeout`, invalid/과대 패턴 거절, 정상 email 정규식의 정상 동작을 확인했다.
- 잔여 제한: worker 단위 실행은 bounded지만 실제 운영 동시 worker 포화와 route별 부하 튜닝은 운영 telemetry/stress 확인이 필요하다.

### 4. 요청 제한 우회

- 수정 전 재현: 같은 IP에서 임의 Bearer 문자열만 바꿔 auth 요청 100개가 모두 허용됐다.
- 수정: `apps/api/src/infrastructure/redis/request-rate-limit.service.ts`는 항상 IP 예산을 먼저 사용하고, 인증 예산은 `AuthGuard`/`OptionalAuthGuard`가 세션 또는 temporary token을 검증한 뒤 전달한 user ID로만 별도 계산한다. raw cookie·Authorization은 identity key가 아니다. `auth/session`·`auth/me` 읽기 요청은 별도의 bounded `auth_read` IP/user 예산으로 분리해 정상 UI polling이 token-issuing 예산을 소진하지 않게 했다. `main.ts`의 proxy trust는 명시된 IP와 hop에서만 활성화한다. Redis 장애 시 auth/auth_read/survey/upload/receipt는 fail-closed, search/calendar은 10,000개 bounded fallback을 사용한다.
- 검증: `rate-limit.test.js`에서 Bearer 교체 100회, 위조 전달 헤더, Redis 장애, fallback map 상한, 검증된 사용자 예산과 IP 예산, 읽기 전용 auth budget, 정상 검색·calendar category 분리를 확인했다.
- 잔여 제한: 실제 edge/NAT 환경의 trusted proxy 주소·hop과 budget 튜닝은 운영 확인이다.

### 5. 업로드 할당량 원자성

- 수정 전 재현: 최대 100개·기존 99개에서 병렬 prepare 3개가 모두 성공해 102개가 됐다.
- 수정: `apps/api/src/features/asset/repositories/asset.repository.ts`와 `asset.service.ts`에서 owner row를 `FOR UPDATE`로 잠그고 완료 asset·유효한 pending asset·유효한 reservation을 함께 세어 reservation을 원자적으로 만든다. 미완료 업로드도 quota에 포함하며, 만료·실패·정리에서 reservation을 회수한다. migration은 `0020_late_genesis.sql`이다. 완료 endpoint는 `PENDING` 조건부 update로 일회성이다. S3 body는 streaming cap을 사용한다.
- 검증: `asset-quota-concurrency.test.js`에서 3개 중 1개만 남은 quota를 획득, 만료 회수, finalize/replay 방지를 확인했다. `asset-storage-bounds.test.js`와 multipart 테스트에서 transform-only body 거절, 20MiB 경계 수락, 초과 body 중단을 확인했다. Multer 보안 버전 상향 후 multipart 회귀를 재현해 초과 파일을 413으로 매핑하고 해당 HTTP 테스트를 통과시켰다.
- 잔여 제한: presigned POST와 DB 완료 상태만으로 S3 object key의 provider-level write-once를 주장하지 않는다. 현재는 random key·짧은 만료·exact content-type/SSE/size policy로 위험을 줄였고, overwrite/replay 차단을 위한 실제 bucket policy·versioning/object-lock은 운영 확인이다.

### 6. 공개 연락처 최소화

- 수정 전 재현: 인증 없는 `GET /contacts` JSON에 학번·개인 이메일·전화번호가 포함됐다.
- 수정: `PublicContactRecord`와 관리자 `ContactRecord`를 분리하고, `contacts.repository.ts`의 public select에는 이름·부서·직책·정렬 순서만 남겼다. `publiclyListed` 공개 승인과 `privacyConsented` 저장 동의를 별도 조건으로 요구한다. 관리자/export 경로는 `MANAGE_CONTACTS`를 유지하며 `inquiryEmail`은 public department DTO에서 제외했다. migration은 `0021_vengeful_vision.sql`이다.
- 검증: `contacts-public.test.js`가 JSON 원문과 `Object.keys`를 기준으로 student number/email/phone/privacy/createdAt/updatedAt/cohort 부재를 확인하고, managed response에는 관리자 PII가 남는 것을 확인했다.
- 잔여 제한: 인터넷 공개 정책의 필드별 최종 승인과 기존 외부 복사본 정리는 운영/정책 확인이다.

### 7. 임시 계정 간 draft 격리

- 수정 전 재현: 같은 탭에서 임시 사용자 A가 logout 후 B로 전환하면 같은 설문 draft key가 생성됐다.
- 수정: `apps/api/src/features/auth/auth-session.service.ts`가 temporary session마다 random opaque namespace를 발급하고, legacy temporary token에 namespace가 없으면 `sub`로 fallback하지 않는다. persisted session namespace는 session ID의 HMAC이며, Web `draft-storage.ts`는 namespace와 tab session만 사용한다. token 원문·학번·개인정보는 key에 넣지 않는다. login/logout/계정 전환 시 survey·bulk-email 화면이 namespace 변경을 감지해 이전 상태를 복원하지 않는다.
- 검증: API auth hardening과 Web `draft-storage.test.js`에서 A→logout→B, temporary→persisted, persisted A→B namespace 변경과 credential 부재를 확인했다. 추가로 격리 Compose의 실제 Playwright browser context에서 temporary A→logout→B와 persisted A→logout→B를 같은 탭으로 재현해 이전 draft 미복원, namespace 변경, storage key의 token/PII 부재를 확인했다.
- 잔여 제한: legacy ownerless draft의 실제 storage inventory와 사용자 안내/정리 정책은 운영 작업이다.

### 8. background sync 감사 누락

- 수정 전 재현: 과비 background sync에서 Google 외부 write 1회 후 audit 0회가 됐고, 설문 refresh에도 감사 누락 경로가 있었다.
- 수정: `google-fee-sheets.service.ts`, `google-survey-sheets.service.ts`, `google-contact-sheets.service.ts`에 성공·실패 audit과 `jobId/resource/revision/executor/result`를 넣었다. 개인정보 snapshot과 credential은 넣지 않는다. audit persistence는 `recordAuditSafely`로 외부 write와 분리한다. 과비 batch의 DB mutation transaction은 commit 후 audit와 enqueue를 실행한다. 실제 설명도 이 post-commit 동작에 맞췄다.
- 검증: `google-survey-sheets.test.js`, `google-contact-sheets.test.js`에서 외부 write 후 audit 실패가 외부 write 재실행으로 이어지지 않는 것과 성공/실패 metadata를 확인했다. fee batch 회귀 및 전체 API 테스트가 통과했다.
- 잔여 제한: 외부 Google write의 취소는 지원 범위가 아니므로 retry는 audit 재시도와 분리하고 reconciliation을 운영한다.

### 9. 오래된 worker의 상태 덮어쓰기

- 수정 전 재현: claim을 잃은 설문 worker의 실패가 새 작업의 `CONNECTED`를 `ERROR`로 덮어썼다.
- 수정: Google queue의 job ID·claim token·lease·revision 조건을 실제 DB update에 결합했다. `calendarSyncJobs`에 `resourceUpdatedAt`을 추가하고 `calendarEvents.updatedAt`까지 조건에 묶었다. 성공·실패와 resource metadata 모두 조건부 update이며, pre-flight `isCurrentClaim()`은 최적화일 뿐 권한 검사가 아니다. asset cleanup은 candidate/reference 조회 뒤 DB asset row lock과 같은 predicate로 삭제하고, reference writer도 asset row를 잠근다. migration은 `0022_square_manta.sql`이다.
- 검증: `google-queue-fencing.test.js`에서 stale success와 stale failure 모두 새 revision을 덮어쓰지 못하는 것을 확인했다. `asset-quota-concurrency.test.js`에서 reference writer와 cleanup 경쟁 시 참조가 보존되는 것을 확인했다.
- 잔여 제한: DB fencing은 이미 전송된 Google/SMTP 외부 write를 취소하지 않는다. 외부 write의 idempotency/ETag/reconciliation은 운영 계약이다.

### 10. 무상한 데이터 처리

- 수정 전 재현: 공개 설문 목록, 응답·답변 전체 조회, S3 body가 한 번에 materialize될 수 있었다.
- 수정: `surveys.repository.ts`의 public list는 page/pageSize/total을 사용하고 관리 목록·설문 section/question에도 명시 상한을 둔다. `survey-responses.repository.ts`는 response page를 최대 100으로 제한하고 response ID batch, response answers, analytics rows에 query-bound cap을 둔다. 초과 시 오류를 반환한다. Web public list는 `total > items.length`를 조용히 버리지 않고 오류로 표시하며, 관리자 응답 목록은 서버 pagination을 사용한다. `asset.storage.ts`는 SDK의 무제한 `transformToByteArray()`를 사용하지 않고 async body를 20MiB cap으로 읽거나 stream으로 전달한다.
- 검증: `resource-limits.test.js`, `asset-storage-bounds.test.js`에서 oversized declared/chunked/slow response, oversized response ID set, S3 body overflow를 확인했다. 설문 Sheets refresh는 100건을 넘으면 명시 오류를 내고 잘라내지 않는다.
- 잔여 제한: route별 상한 값은 현재 합성 fixture와 제품 동작을 보존하는 보수적 값이며, 실제 트래픽 telemetry에 따른 상향·페이지 UX는 운영/제품 검토다.

### 11. CI와 완료 보고

- 수정: `.github/workflows/quality.yml`의 전용 Postgres 환경에 `VOTE_CONCURRENCY_TEST_DATABASE_URL`과 `GOOGLE_QUEUE_FENCING_TEST_DATABASE_URL`을 추가했고, fee/survey/asset concurrency 및 `DATABASE_URL`도 함께 설정했다. migration apply 후 `pnpm test`를 실행한다. `RESULTS.md`의 과비 설명은 “mutation transaction commit 후 audit/enqueue”로 정정했다. 이번 보정에서는 `nodemailer`를 9.1.1로, `multer` override를 2.3.0으로 올려 기존 hosted run의 dependency audit 실패 원인을 해소했다.
- 검증: 로컬 `pnpm install --frozen-lockfile`, audit 0건, API 173건(152 pass/0 fail/21 skip), Web 37건(37 pass)을 실행했다. 21개 skip은 이번 로컬 명령에 전용 concurrency DB URL을 주지 않았기 때문이며, 이전 격리 PostgreSQL 실행의 173/173 결과와 구분한다. `.github/workflows/quality.yml`에는 두 전용 concurrency DB 변수가 모두 설정되어 있다. 버전 보정 후 hosted CI는 아직 push하지 않아 재실행 전이다.
- 보고 구분: service/DB/fake provider 테스트와 로컬 fake SSO + Playwright browser context E2E는 실행했다. 이는 실제 KAIST IdP/운영 브라우저·외부 provider·hosted CI의 증거가 아니다. TLS/proxy 실배포, Google ACL/철회 행, SMTP provider 정책, S3 실제 정책, credential 노출 판단, backup/restore는 증거 부족으로 운영 확인 필요다.

## 검증 증거

| 명령/검사 | 결과 |
| --- | --- |
| `pnpm install --frozen-lockfile` | PASS |
| `pnpm build` | PASS (shared/API/Web) |
| `pnpm typecheck` | PASS |
| `pnpm lint` | PASS (UI unit contract 포함) |
| `pnpm audit --prod --json` | PASS; info/low/moderate/high/critical 0, advisories `{}`; nodemailer 9.1.1 / multer 2.3.0 |
| `node tools/security/verify-supply-chain.mjs` | PASS |
| `pwsh -NoProfile -File tools/security_qa/run_browser_e2e.ps1` | PASS; 격리 Compose + fake SSO smoke + Playwright 390×844 context, temporary/persisted A→logout→B |
| 격리 PostgreSQL migration | PASS; `0017`–`0022` 적용 |
| 격리 DB 환경의 API/Web test | 기존 실행 PASS; API 173/173 + Web 37/37, fail/skip/todo 0. 이번 로컬 재실행은 API 152 pass/0 fail/21 skip + Web 37/37 |
| API production Docker build | PASS; pinned base digest, runtime non-root |
| Web production Docker build | PASS; pinned base digest, runtime non-root |
| API/Web image UID smoke | PASS; `nodeapp` UID 100, `nginx` UID 101 |
| Web `nginx -t` as non-root | PASS; syntax ok |
| `git diff --check` | PASS; line-ending normalization warning만 출력 |

`pnpm audit` 기준 dependency metadata는 production 361개, optional 4개이며 취약점은 0건이다. 로컬에는 `trivy` 실행 파일이 없어 hosted CI의 pinned Trivy/Gitleaks job 자체를 로컬 PASS로 기록하지 않았다. 공급망 스크립트의 lockfile·secret-pattern·container policy 검사는 PASS다.

## 격리·side effect 범위

- 테스트 DB는 `codex-security-postgres-20260909`와 `soc-security-e2e`라는 합성/격리 PostgreSQL·Redis 환경만 사용했고, 실제 SSO·SMTP·Google·S3 credential과 실외부 write는 사용하지 않았다.
- 테스트 종료 후 해당 합성 container·E2E volume/network는 제거했다. 작업 중 기존 `playmanual-*` stack에는 reset, seed overwrite, migration, 설정 변경을 수행하지 않았고 최종 확인 시 기존 stack이 그대로 실행 중이었다.
- 테스트 로그의 SMTP/Google 오류는 synthetic provider가 실패 경로를 검증하기 위해 의도적으로 발생시킨 것이며 credential·PII를 포함하지 않는다.

## 운영 확인 필요

1. 실제 TLS terminator → Nginx → API hop, `Secure` cookie, trusted proxy 및 CSRF origin 전달.
2. 실제 Google operations/result folder, IAM/ACL, Sheet row ownership, retention과 철회된 기존 외부 row 제거.
3. SMTP provider의 idempotency/result lookup, `UNKNOWN` reconciliation과 늦은 수락 결과 처리.
4. S3 presigned POST의 실제 bucket policy, object overwrite/replay 방어, versioning/object-lock, egress/private DNS와 production quota/rate tuning.
5. hosted CI에서 dependency/container/secret scan을 실제 실행하고 결과를 보관하는 것.
6. credential 노출 여부 판단 및 필요 시 rotation. 현재 evidence 없이 노출·안전 판정을 내리지 않았다.
7. PostgreSQL, asset metadata/bytes, 암호화 key의 별도 환경 backup/restore drill과 Redis session invalidation/RPO/RTO.
8. 실제 KAIST IdP를 통한 브라우저 context E2E, staging 배포 후 모니터링/telemetry. 로컬 fake SSO + Playwright context 검증은 완료했지만 운영 IdP 증거는 아니다.
