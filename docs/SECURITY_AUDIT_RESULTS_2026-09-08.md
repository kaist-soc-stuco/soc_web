# SOC Web 보안 점검 결과 (S00/S01/S02/S03/S04/S05/S06/S07/S08/S09/S10/S11/S12/S13/S14)

- 작성일: 2026-09-08 (Asia/Seoul)
- 기준 revision: 13c4b9d0c039362bf32b0c8d08ede8370ca9842d (main, Implement mobile board and search flows)
- 기준 범위: 현재 코드·설정·테스트·실행 중인 로컬 stack의 제한된 smoke/route/object/header 요청 및 S02-S14 전용 local harness/audit 도구
- 제외: 과거 docs 기준, generated dist 자체를 source of truth로 삼는 판단, production 외부 시스템 검증, 실제 secret/외부 계정 사용. current source에서 build한 dist는 재현 harness 실행에만 사용했다.
- 상세 범위·위협 모델: docs/SECURITY_AUDIT_SCOPE_2026-09-08.md
- 한눈에 보는 요약: docs/SECURITY_AUDIT_SUMMARY_2026-09-08.md

## 1. 결론

S00과 S01을 완료했고 S02의 인증 경로, S03의 기능 권한·객체 경계·관리자 bootstrap 1차 검증, S04의 프록시·쿠키·CORS/CSRF·보안 헤더·로그 경계 1차 검증, S05의 게시판·댓글·초안·검색·알림 개인정보 경계 1차 검증, S06의 업로드·다운로드·S3 직접 업로드 경계 1차 검증, S07의 설문 자격·응답·편집·집계·첨부 참조 경계 1차 검증, S08의 과비·연락망·내보내기·감사 로그 경계 1차 검증, S09의 XSS·입력 검증·주입·브라우저 저장 경계 1차 검증, S10의 Google·메일·일정·채널톡 외부 연동 경계 1차 검증, S11의 투표·개발 기능·health 노출 경계 1차 검증, S12의 비밀정보·공급망·컨테이너·CI 1차 검증, S13의 자원 제한·운영 실패·복구 1차 검증, S14의 누락·중복 정리·최종 판정을 마쳤다. 현재 checkout에서 24 controller와 196 HTTP route를 자동 집계하고, 각 route에 입력 ID/transport, guard/permission, object boundary, 반환·side effect·민감 데이터, 후속 S 번호, source evidence를 매핑했다. scheduler, queue, CLI, import/export, storage 및 external egress path도 별도로 기록했다. 코드 수정 요청이 없는 현재 단계의 다음 작업은 없다.

S00/S01은 범위 확정과 threat modeling 단계이므로 그 단계에서 확정한 취약점은 없다. S02에서는 현재 코드와 재현 하네스에서 확인된 인증 상태 불일치·경쟁 조건을, S03에서는 권한 상승 정책 후보와 public/admin dataset 경계 후보를, S04에서는 외부 TLS 체인과 서버 측 CSRF 검증에 의존하는 후보를, S05에서는 게시판 privacy gate 누락 후보를, S06에서는 asset secret-reference와 direct-upload resource-boundary 후보를, S07에서는 설문 공개 DTO·응답 첨부파일·설문 이미지 참조의 경계 후보를, S08에서는 공개 연락망·철회된 연락망의 외부 동기화·과비 batch/ledger·민감 export cache·감사 완전성 후보를, S09에서는 CMS 링크 scheme·정규식 ReDoS·계정 비분리 브라우저 초안 경계 후보를, S10에서는 SMTP 외부 성공과 DB 상태의 비원자 재시도·외부 ICS/공휴일 응답 경계·Google egress/공유 정책 확인 필요 항목을, S11에서는 vote close/submit 경합·health raw error·production profile에 따른 mock 등록 보강 후보를, S12에서는 runtime dependency advisory·local credential hygiene·SheetJS source pinning·container hardening 후보를, S13에서는 unbounded materialization·rate/timeout·multi-replica job lock·Redis/backup 운영 경계를 별도 기록한다. 아래 severity는 production 외부 경계, 실제 토큰·세션 탈취 가능성, 업무 정책, 전체 route impact를 아직 검증하지 않은 예비 판정이다.

애플리케이션·설정·배포·사용자·역할·권한·콘텐츠·자산 데이터는 변경하지 않았다. 다만 S04의 로그아웃 probe와 S08의 관리자 연락망·과비·감사 export smoke는 의도된 append-only 감사 기록을 남겼다. S08 점검 전 audit log 151건에서 현재 154건으로 증가했고, 이 side effect는 기능 데이터 변경과 구분해 기록한다. 작업 중 추가된 사용자의 Web 변경도 보존했다. S12-S14는 문서·read-only inspection·무상태 harness만 추가했다.

## 2. 실행 증거

| 검사 | 결과 | 비고 |
|---|---|---|
| Git baseline | PASS | main, HEAD 13c4b9d0c039362bf32b0c8d08ede8370ca9842d; dirty Web 작업은 보존 |
| module/controller scan | PASS | 24 controller, 196 route |
| pnpm build:shared | PASS | contracts/common/api-client |
| secret pattern scan | PASS | `.env.example` 변수명/placeholder 4건만 매칭; 실제 값은 출력하지 않음 |
| pnpm lint | PASS | API ESLint, Web UI unit contract/ESLint |
| pnpm typecheck | PASS | shared, API, Web |
| pnpm test | PASS | API 107 pass, 0 fail, 13 skipped; Web 35 pass, 0 fail |
| pnpm build | PASS | 전체 workspace. chunk size와 dynamic/static import 경고만 |
| S02 local SSO stub/harness | PASS | callback state/error/success, result-token GETDEL, concurrent refresh/consent, revoked access-token behavior; token/secret/PII 미출력 |
| S02 Redis primitive smoke | PASS | Redis PING 및 임시 key의 SET EX → GETDEL → GET missing |
| S02 auth HTTP smoke | PASS | `/api/auth/session` 200, `/api/auth/me` 401, `/api/auth/refresh` without token 400, `/api/auth/logout` without session 201, `/api/boards/admin` anonymous 401 |
| S03 role/permission harness | PASS | current 15 permission IDs accepted by role service; assignment path invalidated affected permission cache; guard AND/OR semantics and inactive-user session behavior covered |
| S03 role/object HTTP matrix | PASS | 12 representative admin paths: no-permission session 403, all-permission session 200; ephemeral Redis sessions only |
| S03 composite-object HTTP checks | PASS | cross-survey section/question deletes 404; cross-article comment delete 404; no persistent fixture mutation |
| S03 targeted authorization tests | PASS | 46 API tests across article/asset/survey/response/initial-admin/site-content; 0 fail, 0 skipped |
| S03 roadmap public visibility check | CANDIDATE | service harness returned hidden course from public list; current DB hidden-course count 0; anonymous response had admin dataset metadata |
| S04 Nginx configuration test | PASS | running Nginx configuration syntax/test successful |
| S04 cookie/proxy HTTP check | CANDIDATE | Nginx overwrote an incoming `X-Forwarded-Proto: https`; clear cookies through Nginx lacked `Secure`; direct API honored the header and emitted `Secure` |
| S04 CORS/CSRF HTTP check | CANDIDATE | configured local Origin allowed; sibling/null/disallowed Origin had no ACAO; disallowed-Origin logout POST still returned 201 |
| S04 security-header HTTP check | CANDIDATE | front Nginx returned nosniff/XFO/referrer/permissions headers; CSP and HSTS were absent; direct web port bypassed those headers |
| S04 query-log marker | CONFIRMED SINK | Nginx access log retained a non-secret query marker; strengthens S02-F05 URL-bearer exposure, not a duplicate finding |
| S05 current DB privacy fixture check | PASS / LIMITATION | article 38건은 모두 published·non-secret·non-anonymous·public scope; comment 2건은 published; draft/notification 0건. 익명·비밀·숨김·초안·알림 실데이터 disclosure는 관찰하지 못함 |
| S05 public/current HTTP boundary smoke | PASS / LIMITATION | public article/search/detail/comments는 200; unauthenticated My Page, notifications, drafts routes는 401; public data에는 현재 익명·비밀 row가 없음 |
| S05 current-build privacy harness | CANDIDATE | anonymous article author raw fields, scope-only secret-comment access, secret previous/next metadata pass-through를 합성 서비스 harness로 재현 |
| S05 targeted board/privacy tests | PASS | 19 API tests across article access/assets/sanitization/comment board policy; 0 fail, 0 skipped |
| S06 current DB asset reference check | PASS / LIMITATION | assets 20건, article links 18건, unlinked assets 2건, public content refs 0건, survey answer refs 0건; secret article fixture는 0건 |
| S06 asset HTTP/header smoke | PASS / LIMITATION | 현재 asset content 5건의 200 응답에서 Content-Type/Disposition/CSP/nosniff 확인; unauthenticated upload/presign/complete/cleanup/migrate는 401 |
| S06 current-build asset harness | CANDIDATE | secret article에 연결된 asset이 scope readability만 true일 때 anonymous read; S3 presign 응답에 Content-Length/checksum/size condition 없음 재현 |
| S06 targeted asset/reference tests | PASS | 37 API tests across asset security/upload, article asset access, site content, survey answer/definition validation; 0 fail, 0 skipped |
| S07 current DB survey fixture check | PASS / LIMITATION | survey 13건( published 12, draft 1), public-result 1, anonymous 1, multiple 3, affiliation/academic 제한 2/2; response/answer 0, file question 2; survey asset ref 0 |
| S07 public/current HTTP boundary smoke | PASS / LIMITATION | public list/detail/analytics 200; mine 403; manager response paths 401; public list 12건 |
| S07 current-build survey harness | CANDIDATE | public full `SurveyRecord` metadata pass-through; mixed `assetId`/`assetIds` owner-check bypass; arbitrary survey asset ref가 sanitizer/public chain을 통과 |
| S07 survey targeted tests | PASS / LIMITATION | 59 tests: 49 pass, 0 fail, 10 skipped; 10건 모두 전용 PostgreSQL concurrency URL 부재로 skip; mocked OAuth warning만 존재 |
| S08 current DB PII/finance/audit check | PASS / LIMITATION | contacts 4건(동의 4, 철회 0), departments 5건, users 3건, fee status/payment 0건, audit log 154건; Sheets queue 2건은 SUCCEEDED |
| S08 public/admin HTTP and cache smoke | PASS / CANDIDATE | public `/contacts` 200 및 연락처 PII field 반환; contacts/fee/audit protected list/export는 ephemeral 권한 세션에서 200; JSON/XLSX 응답의 Cache-Control은 비어 있음; anonymous protected route는 401 |
| S08 current-build business harness | CANDIDATE | privacy 철회 행이 contact Sheets sync row에 포함됨; fee bulk 두 번째 항목 실패 뒤 첫 번째 mutation/audit/queue가 남음; 동일 payment 2건 schema 허용; audit 저장 실패가 mutation을 거부하지 않음 |
| S08 export/sync audit side-effect check | PASS / LIMITATION | 연락망·과비·audit export 각각 1건의 audit row가 기록됨; background Sheets sync action은 0건으로 확인; 실제 Google/Drive sharing은 미실행 |
| S08 targeted fee/contact/Sheets tests | PASS / LIMITATION | 18 tests: 15 pass, 0 fail, 3 skipped; skipped 3건은 전용 fee PostgreSQL concurrency URL 부재 |
| S10 external-integration targeted tests | PASS | Google/SMTP/Sheets/email targeted tests 11 pass, 0 fail, 0 skipped |
| S10 current-build provider-boundary harness | CANDIDATE / LIMITATION | SMTP success 뒤 DB status update failure와 retry 재발송, BCC recipient isolation, ChannelTalk HMAC/anonymous identity, external fetch timeout/redirect flags를 synthetic provider로 확인; 실제 provider·OAuth·ACL·SMTP 발송은 미실행 |
| S10 vote/health route smoke | PASS / LIMITATION | public vote list/detail/receipt-invalid 200, admin/voter/ballot unauthenticated paths 401; health 200; current DB vote 1건·voter 1건·ballot/tally 0건 |
| S11 vote crypto/route checks | PASS / LIMITATION | vote crypto 3 pass; public vote/detail/invalid receipt smoke 200; admin/voter/ballot anonymous paths 401; current vote fixture has no ballot/tally |
| S11 vote close/submit race harness | CANDIDATE | synthetic service/repository timing shows vote status can change to CLOSED after pre-check and before submit transaction, while repository contract still accepts; no persistent DB mutation |
| S11 health failure harness | CANDIDATE | synthetic Postgres/Redis errors are returned as dependency `message`; normal `/health` remains 200 |
| S11 AppModule registration check | PASS / LIMITATION | production `NODE_ENV` excludes MockModule; unset process env includes it because module selection occurs before ConfigModule `.env` load; production Compose/Dockerfile explicitly set production |
| S13 current-stack health/limit smoke | PASS / LIMITATION | Nginx `nginx -t` PASS; health 200; oversized article/search query limit requests completed 200; calendar search/range public smoke 200; invalid holiday range 400. No load/stress or dependency stop |
| S13 runtime/resource inspection | CANDIDATE / LIMITATION | DB pool max 10/5s connect timeout; Redis `maxRetriesPerRequest=1` + offline queue; current Redis `noeviction`, maxmemory 0; running dev containers memory/CPU/PID limits all 0; queue statuses calendar 144 SUCCEEDED, Sheets 2 SUCCEEDED |
| S13 scheduler/queue source review | CANDIDATE | Sheets/Calendar cron and asset/email intervals are process-local; processing locks become stale after 10 minutes; Calendar completion path lacks a revision/current-claim check; actual multi-replica or provider timeout race not run |
| S13 backup/restore review | UNVERIFIED | PostgreSQL/Redis/uploads are volumes and production logs rotate, but tracked `pg_dump`/restore, backup encryption/retention, key/session/attachment restore procedure, RPO/RTO evidence not found |
| S14 route reconciliation | PASS | scope matrix route IDs are contiguous 1–196; every row has input/transport, auth/permission, object boundary, output/side effect, follow-up S02–S11, and source evidence; 13 non-HTTP rows are also mapped |
| S14 finding reconciliation | PASS / LIMITATION | 43 unique S02–S13 finding IDs are present. Same-root observations are cross-referenced without merging distinct sinks; no item was marked a false positive solely from absent current fixture or absent external environment |
| GET http://localhost:8080/health | HTTP 200 | 이미 실행 중인 개발 Compose stack에 대한 read-only 요청 |
| pnpm audit --prod --json | CANDIDATE | 현재 registry 기준 runtime advisory 4건: Moderate 4, High/Critical 0; `sanitize-html`, `@tiptap/core`, `qs` 설치 경로 대조 |
| pnpm audit --json | CANDIDATE / LIMITATION | 전체 advisory 17건: High 9, Moderate 6, Low 2, Critical 0. 개발/빌드 전용 경로를 runtime과 분리했으며 CDN tarball·container OS는 audit가 포괄하지 않음 |
| secret/path/history scan | PASS / OPERATIONAL ACTION | tracked `.env`/`secrets/**`/key path는 확인되지 않았고 ignore 규칙은 적용됨. 현재 ignored local `.env`·`secrets`에는 runtime credential material이 있으나 값은 출력하지 않았고 rotation/실제 유효성은 미확인 |
| lockfile/lifecycle/source check | CANDIDATE | lifecycle hook은 별도 확인되지 않았고, SheetJS CDN tarball resolution에 lockfile integrity line이 없으며 registry advisory coverage 밖임 |
| production Docker/Compose/CI review | CANDIDATE / LIMITATION | API final image의 root 실행·build `node_modules` 복사·digest/런타임 hardening 부재; production data ports는 host publish 없음. CI는 frozen lock/quality 검사는 있으나 전용 secret/container scan 증거 없음 |
| isolated DB/Redis route tests | 미실행 | 기존 stack을 격리·재구성하지 않음 |
| SSO/Google/SMTP/S3/KAIST/holiday external calls | 미실행 | 실제 provider·credential을 사용하지 않음 |

API의 13 skipped는 fee 및 survey response PostgreSQL concurrency/locking 시나리오다. 따라서 PASS는 해당 skipped 경로, 운영 boundary, external egress, revocation race의 검증 완료를 의미하지 않는다.

## 3. S00 결과

### 완료 항목

- 현재 Git revision과 dirty worktree를 캡처했다.
- 실제 AppModule 등록 모듈을 확인했다. VotesModule과 MockModule 조건부 등록을 포함한다.
- Web client routing, API global prefix, Nginx rewrite/proxy, CORS/cookie path를 확인했다.
- current .env 기능 profile을 secret 값 없이 확인했다.
- Compose service, host port publication, Redis config, read-only secret mounts를 확인했다.
- scheduler, Google spreadsheet queue, calendar sync, email, asset cleanup, OAuth CLI, seed/migration, import/export 경로를 목록화했다.
- 기본 build/lint/typecheck/test를 실행하고 skipped와 미실행 범위를 기록했다.
- 과거 docs 및 generated dist를 판단 근거에서 제외했다.

### S00에서 남은 외부 전제

- .env.production이 없어 production effective config는 미확인이다.
- 실제 TLS termination, WAF, rate limit, CSRF, access log, proxy hop 및 host firewall은 미확인이다.
- PostgreSQL/Redis auth·TLS·backup·operator access, S3 IAM/bucket policy, Google Drive sharing/scope, SMTP relay policy는 미확인이다.
- 현재 default Compose는 API/Web/Postgres host port를 publish하고, alternate dev Compose는 Redis도 publish한다. production Compose와의 차이를 S12-S13에서 확인한다.
- local Compose는 NODE_ENV=development와 SEED_MODE=demo를 사용한다. production deployment에서 동일 profile이 사용되지 않는다는 외부 증거는 아직 없다.

## 4. S01 결과

### 보안 경계와 정책

- persisted AuthGuard는 session cookie → Redis session → active user → recalculated permission bitmask 순서로 확인한다.
- OptionalAuthGuard는 persisted cookie와 temporary bearer를 분리하고 invalid optional credential을 anonymous로 처리한다.
- RequirePermissions는 AuthGuard와 PermissionBitsGuard를 함께 사용하며 required bits는 AND다.
- global AuthGuard/PermissionBitsGuard는 bootstrap에 설치되지 않았다. route decorator와 service/repository object check가 보안 경계다.
- global ZodValidationPipe 설치 코드는 주석 상태다. DTO compile-time type만으로 runtime validation을 가정하지 않는다.
- public route도 board visibility, survey publication/eligibility, asset readability, vote publication, service-level policy를 별도로 가진다.

### 현재 코드 관찰과 검증 우선순위

| ID | 현재 관찰 | 분류 | 다음 확인 |
|---|---|---|---|
| OBS-01 | controller별 guard가 opt-in이고 global guard가 없다 | 구조적 공격면 관찰 | S03: 196 route의 guard 및 service authorization 누락/우회 |
| OBS-02 | global ZodValidationPipe가 주석 상태다 | 입력 검증 범위 관찰 | S09: auth와 각 write/import route의 runtime validation |
| OBS-03 | pending-login Redis record는 email/mobile만 encrypt하고 나머지 identity fields를 JSON으로 보관한다 | 저장 데이터 보호 관찰 | S02/S12: Redis ACL/TLS/dump/backup와 필요 암호화 범위 |
| OBS-04 | GET /contacts는 guard가 없고 privacy false record를 purge한 뒤 student number, email, phone, consent flag를 포함한 map을 반환한다 | 공개 PII 경계 후보 | S08: 공개 필드 최소화 및 product policy |
| OBS-05 | GET /roadmap/offerings의 listPublic()이 findAdminData()를 호출한다 | public/admin dataset 경계 후보 | S09: public contract와 실제 returned fields 비교 |
| OBS-06 | GET /health는 dependency failure 시 error.message를 반환할 수 있다 | 진단 정보 노출 후보 | S11: Postgres/Redis failure stub 및 response redaction |
| OBS-07 | AuditLogService.record는 저장 실패를 warn하고 mutation을 계속한다 | audit completeness 관찰 | S08: transactionality, availability, tamper evidence |
| OBS-08 | Google contact/fee/survey handlers가 PII 또는 answer를 Sheet row로 변환한다 | 외부 egress 경계 관찰 | S10: minimization, folder sharing, token scope, retry |
| OBS-09 | ENABLE_MOCK_AUTH=true가 현재 module selection에 사용되지 않고 MockModule은 NODE_ENV로만 선택된다 | 설정 의미 drift 관찰 | S11/S12: production profile, dev-only route reachability |
| OBS-10 | asset cleanup/email polling/calendar sync는 in-process schedule이고 Google Sheet queue만 DB claim/retry 경로가 보인다 | multi-replica 중복 실행 가설 | S13: replica/scheduler topology와 idempotency |

근거:

- OBS-01/02: apps/api/src/main.ts:20-37, apps/api/src/features/auth/guards/auth.guard.ts:22-68, apps/api/src/features/auth/guards/require-permissions.decorator.ts:20-70
- OBS-03: apps/api/src/features/auth/pending-login.repository.ts:20-35, 98-116
- OBS-04: apps/api/src/features/contacts/contacts.controller.ts:44, apps/api/src/features/contacts/contacts.service.ts:30-33, apps/api/src/features/contacts/contacts.repository.ts:25-50
- OBS-05: apps/api/src/features/roadmap/roadmap.controller.ts:61, apps/api/src/features/roadmap/roadmap.service.ts:34-37, apps/api/src/features/roadmap/roadmap.repository.ts:113-121
- OBS-06: apps/api/src/features/health/health.service.ts:25-37, 39-79
- OBS-07: apps/api/src/features/audit/audit-log.service.ts:15-25
- OBS-08: apps/api/src/features/contacts/google-contact-sheets.service.ts:19-114, apps/api/src/features/users/google-fee-sheets.service.ts:33-148, apps/api/src/features/surveys/google-survey-sheets.service.ts:19-163
- OBS-09: apps/api/src/app.module.ts:28-29, 61; apps/api/src/features/mock/mock.controller.ts:5-9
- OBS-10: apps/api/src/features/asset/asset.service.ts:38-46, apps/api/src/features/email/bulk-email.service.ts:105-145, apps/api/src/features/calendar/calendar-sync.service.ts:352-378, apps/api/src/infrastructure/google/google-spreadsheet-sync-queue.service.ts:75-207

## 5. Threat model 요약

### Assets

- sessions, refresh/access/temporary tokens, pending-login records, signing/encryption keys
- student identity/contact/fee/payment PII
- survey definitions, eligibility, raw answers, files
- articles, comments, drafts, anonymous-author identity, site/roadmap/calendar content
- voter rolls, encrypted ballots, receipts, tallies, published results
- PostgreSQL, Redis, assets, audit logs, background-job state
- SSO, Google, SMTP, S3, calendar credentials and provider-side copies

### Actors

- anonymous caller
- temporary bearer holder
- persisted normal user
- single-permission admin
- content/finance/survey/calendar/contact/user/role/email/vote admin
- malicious authenticated caller changing object IDs or issuing concurrent requests
- compromised host/container/DB/Redis/S3/CI operator
- unavailable, malformed, duplicated, or misconfigured external provider

### Objectives

- persisted and temporary authentication isolation
- permission, ownership, visibility, eligibility and lifecycle integrity
- minimal disclosure of contact/fee/survey/anonymous/vote data
- ballot secrecy and receipt/result integrity
- bounded upload/import/HTML/external fetch/email behavior
- database, cache, storage and egress isolation
- auditability and concurrency integrity

### Main attack stories

1. Cross-object IDOR on article/comment/draft/asset/response/user/role/vote IDs
2. temporary bearer or pending token reused against persisted/admin routes
3. revoked account or changed permission remaining effective through refresh/cache/race
4. public contact/roadmap/health/analytics returning more than intended
5. direct-upload, active MIME, local path, S3 key, asset complete or orphan cleanup bypass
6. survey capacity/single-response, fee status or role mutation race
7. vote voter-roll, ballot metadata, receipt linkability or key-separation failure
8. Google/SMTP/calendar retry causing excess PII egress or duplicate side effects
9. rich-text/workbook/query parser causing XSS, injection or resource exhaustion
10. dev seed/mock, host ports, proxy trust, cookie/CORS/CSRF or health failure path expanding attack surface

## 6. S02 결과 — SSO·세션·동의·로그아웃

### 6.1 검증 범위와 방법

- 현재 `apps/api/src/features/auth`의 SSO callback, Redis state/pending/result 저장소, JWT 발급·검증, Redis session, refresh rotation, consent, logout, AuthGuard/OptionalAuthGuard와 Web callback/storage/client를 읽었다.
- `pnpm build` 직후 생성된 현재 API 실행 산출물로 서비스 메서드 하네스를 실행했다. race를 재현하기 위해 session/pending repository에는 지연을 넣었고, 실제 token/secret/PII는 출력하지 않았다. 이 하네스는 full HTTP integration이 아니라 source-backed behavior test다.
- `127.0.0.1` local SSO HTTP stub에서 error/success callback을 각각 1회 처리했다. Redis state에는 `createdAt`, `expiresAt`, `nonce`만 저장되고, provider error 뒤에는 남아 있으며, 성공 nonce 뒤에는 제거되고 pending token redirect가 생성됨을 확인했다.
- 이미 실행 중인 개발 Compose의 Redis에 임시 key를 `SET EX`한 뒤 `GETDEL`하고 후속 `GET`이 missing인지 확인했다. Redis 자체의 원자 primitive는 동작했지만, 현재 `AuthSessionRepository`의 read-then-save가 원자적이라는 뜻은 아니다.

### 6.2 인증 상태 허용표

| 상태/credential | 허용되는 현재 경로 | 거부 또는 주의 경로 | 근거·검증 |
|---|---|---|---|
| anonymous | public route, `/v1/auth/session`의 anonymous summary | `/v1/auth/me`는 401, `/v1/boards/admin`은 401, token 없는 refresh는 400 | 현재 local HTTP smoke |
| temporary bearer | `/v1/auth/session`, `/v1/auth/me`, survey의 OptionalAuth 경로에서 최소 eligibility 주체 | refresh 불가, persisted `AuthGuard` route에 bearer만으로 진입 불가, PostgreSQL/Redis persisted session 없음 | `auth-session.service.ts:203-217,262-306`, `optional-auth.guard.ts:28-42`, `core.ts:195-223` |
| persisted session cookie | Redis session이 active이고 user가 active일 때 `AuthGuard` route 및 permission bitmask | session missing/revoked/expired/inactive이면 `AuthGuard` 거부 | `auth.guard.ts:34-67`, `auth-session.repository.ts:43-72` |
| persisted access token | `/v1/auth/me`와 controller가 직접 `getOptionalCurrentUser`를 호출하는 public read/visibility 경로에서 JWT·user active만으로 accepted | access token 자체에 session ID가 없고 `getCurrentUser`가 Redis revoke를 조회하지 않음. revoked session 뒤에도 유효 기간 동안 accepted | `auth-session.service.ts:136-201,525-602`, S02 harness (S02-F01) |
| refresh token | JWT가 valid하고 persisted session, active user, `refreshJti`가 일치할 때 rotation | temporary refresh 금지, mismatch는 session revoke | `auth-session.service.ts:311-365` |
| pending-login token | `/v1/auth/login/consent`에서 consent 또는 temporary decision; persisted user는 KAIST UID 기준 upsert | 10분 bearer token의 `find`와 `delete`가 atomic하지 않아 동시 제출이 모두 처리될 수 있음 | `auth-session.service.ts:377-433`, `users.service.ts:82-113`, S02 harness (S02-F03) |
| login result token | `/v1/auth/login/result`에서 60초 동안 access/refresh/session cookie로 교환 | Redis `GETDEL`로 정상 동시 재사용은 1회만 성공 | `auth.service.ts:493-534`, S02 harness (control) |
| revoked/inactive | cookie 기반 protected route는 거부; inactive user는 guard에서 session revoke | persisted access bearer 검증은 Redis revoked flag를 보지 않음 | `auth.guard.ts:45-67`, S02-F01 |

### 6.3 S02 findings와 예비 severity

| ID | 현재 확인된 동작 | 보안 영향과 예비 판정 | 상태 |
|---|---|---|---|
| S02-F01 | persisted access JWT에는 `sid`가 없고, `getCurrentUser`/`getOptionalCurrentUser`는 JWT 서명·만료와 active user만 확인한다. Redis session revoke 후 같은 access token을 하네스에 넣어도 `authenticated: true`였다. | 로그아웃·session revoke가 access bearer에 즉시 전파되지 않는다. 현재 `AuthGuard` mutation route는 별도로 session cookie를 요구하므로 관찰된 직접 영향은 `/me`와 optional visibility/read 경로이며, 탈취된 access token 재사용 창은 최대 30분이다. **예비 Medium**; route가 access bearer를 권한 경계로 사용하면 High로 재평가한다. | source + dynamic 재현 확인 |
| S02-F02 | `rotateRefreshToken`이 `findBySessionId` → JTI 비교 → 새 JTI `save`를 순차적으로 수행하지만 compare-and-set/락이 없다. 지연된 repository 하네스에서 동일 refresh token 동시 2회가 모두 성공하고 rotation save도 2회 발생했다. | refresh token one-time rotation 및 reuse detection이 동시 요청에서 깨진다. refresh token 탈취가 선행되어야 하고 최종 저장 JTI가 하나만 남아 availability/session confusion이 생길 수 있다. **예비 Medium**. | source + forced-race dynamic 재현 |
| S02-F03 | consent handler가 pending record를 `find`한 뒤 user upsert/session 발급 후 `delete`한다. 같은 pending token 동시 2회에서 두 요청 모두 persisted session을 만들고 delete도 2회 호출됐다. | bearer pending token의 단일 소비 보장이 없다. token이 URL/history/storage/log에 노출되면 중복 계정·세션 발급과 consent side effect 중복으로 확대될 수 있다. **예비 Medium; token exposure와 결합 시 High 후보**. | source + forced-race dynamic 재현 |
| S02-F04 | SSO state Redis payload는 `nonce`, 생성/만료 시각뿐이며 initiating browser/session cookie와 binding하지 않는다. callback은 해당 state와 provider nonce만 확인한다. | 공격자가 자신의 정상 SSO callback(code/state)을 피해자 브라우저에 전달하는 login CSRF/account swapping 경로가 성립할 수 있다. provider code 전달 가능성과 브라우저 end-to-end 재현은 아직 외부 SSO 없이 검증하지 못했다. **예비 High 후보**. | source 확인 + local callback stub; full browser exploit 미검증 |
| S02-F05 | success redirect의 `resultToken`(60초)과 consent redirect의 `pendingLoginToken`(10분)이 URL query로 전달되고 Web이 pending token을 `sessionStorage`에 보관한다. callback URL을 API로 소비한 뒤에야 `/`로 replace navigation한다. | browser history, reverse-proxy/access log, referrer·지원 도구 등 query 수집 지점에서 bearer credential이 노출될 수 있다. result token은 `GETDEL`로 단회지만 payload가 access/refresh/session을 포함하므로 노출 창의 영향이 크다. **예비 Medium/High 후보**; production logging/referrer topology 미확인. | source + current Nginx config review |
| S02-OBS-01 | JWT `verify` 호출에 allowed algorithm/issuer/audience를 명시하지 않고 access claims에 token-use/sid가 없다. `auth.types.ts`에도 해당 claim TODO가 남아 있다. | 현재 secret이 안전하다는 가정에서는 즉시 exploit을 확정할 수 없지만 key/purpose 혼용 시 cross-purpose acceptance 방어가 약하다. **Hardening/validation follow-up**. | source observation |
| S02-OBS-02 | provider error/error response에서는 stored state를 지우지 않고, callback 예외는 `error.message`를 frontend `reason` query로 전달한다. | state 재시도 창과 error metadata 노출 가능성이 있다. nonce mismatch/success 경로는 state를 삭제한다. **예비 Low/Medium observation**. | source observation + local stub |

### 6.4 동적·HTTP 증거

| 시나리오 | 결과 |
|---|---|
| local SSO HTTP stub: provider error | 요청 1회, `stateRemainsAfterProviderError=true` |
| local SSO HTTP stub: nonce success | 요청 1회, `stateRemovedAfterSuccess=true`, pending token redirect 생성 |
| login result token 동시 소비 | 2 attempts 중 success 1, failure 1; `GETDEL` 2회 |
| 동일 refresh token 동시 rotation | success 2, failure 0, initial issue 뒤 repository save 2회 |
| session revoke 후 persisted access token | `getCurrentUser`가 `authenticated=true` 반환 |
| 동일 pending-login token 동시 consent | success 2, `find` 2회, `delete` 2회, persisted session save 2회 |
| pending-login Redis serialization | 이메일/휴대전화 raw 포함 여부 false, 복원 round-trip true; KAIST UID·이름 등 나머지 identity field는 raw JSON에 존재 |
| token matrix | 정상 temporary access는 temporary 검증만 통과; persisted access를 refresh/temporary로 교차 사용, temporary access를 refresh로 사용, forged/expired access·refresh는 모두 거부 |
| Redis failure matrix | failing repository에서 persisted issue/refresh/session 조회는 모두 rejected; 같은 Redis failure 가정에서도 `/auth/me`의 access-token 검증은 `authenticated=true` (session lookup 없음) |
| 실제 실행 중 Redis primitive | `PING=PONG`, ephemeral `SET EX=OK`, `GETDEL=ok`, 후속 `GET=missing` |
| 기존 local HTTP stack anonymous/protected smoke | `/api/auth/session` 200, `/api/auth/me` 401, `/api/auth/refresh` without token 400, `/api/auth/logout` without session 201, `/api/boards/admin` anonymous 401 |

### 6.5 확인된 통제와 미확인 범위

- access token TTL은 30분, refresh/session TTL은 30일, temporary access token은 pending expiry와 최대 10분 중 짧은 값이다. temporary mode에는 refresh token과 Redis persisted session record가 없다.
- auth cookie는 `httpOnly`, `SameSite=Lax`, `/` path를 사용한다. `secure`와 proxy protocol 신뢰는 S04에서 별도 확인한다.
- pending-login repository는 email과 mobile을 AES-256-GCM으로 저장하고 복원 시 인증 태그를 검증한다. consent는 pending의 KAIST UID를 `upsertByKaistUid`에 전달한다. 다만 이름·학번·학과·SSO subject 등 다른 identity field는 Redis JSON 평문이고 Redis 접근 통제/암호화·dump/backup은 S12에서 확인한다.
- persisted protected route의 `AuthGuard`는 access JWT가 아니라 session cookie → Redis record → active user → permission 순서를 사용한다. 따라서 S02-F01은 모든 mutation route의 즉시 우회로 단정하지 않는다.
- login result token은 `GETDEL`로 atomic one-time consume을 구현한 긍정 통제다. Redis 자체 primitive도 현재 stack에서 동작했다.
- 실제 SSO provider, 실제 browser cookie/history/referrer, production access log, real HTTP concurrent refresh/consent, Redis restart 자체와 production proxy trust/CSRF/secret rotation은 이 단계에서 미실행이다. Redis failure는 deterministic repository harness로 fail-closed/fail-open 경로를 분리 확인했으며, 실제 restart/latency topology는 S12-S13에서 재평가한다. 따라서 예비 severity와 production impact는 S03/S04 및 운영 검증에서 재평가한다.

### 6.6 S02 판정

S02의 source review, local SSO stub, deterministic race harness, Redis primitive 및 제한된 local HTTP smoke를 완료했다. S02-F01~F05는 수정하지 않았으며, 현재 상태에서 우선 triage할 인증 경로 후보로 남긴다. S02-F01의 access-token route 영향과 F04/F05의 실제 browser/proxy exposure는 S04에서 확인한 repo-local 증거에 외부 운영 증거를 더해 최종 reconciliation에서 재평가한다.

## 7. S03 결과 — 기능 권한·객체 권한·관리자 bootstrap

### 7.1 검증 범위와 방법

- 현재 permission registry, `AuthGuard`/`OptionalAuthGuard`/`PermissionBitsGuard`, role-groups/users/finance/initial-admin 구현, 전체 controller의 permission decorator와 service/repository object check를 읽었다. 프론트 권한 편집 화면은 서버 통제가 아닌 보조 관찰로만 사용했다.
- 현재 build 산출물의 in-process harness로 required permission의 AND, any permission의 OR, missing user 거부, role service의 현재 permission ID 처리, role/member 변경 후 cache invalidation, inactive user/session revoke 및 DTO의 server-owned field stripping을 검증했다.
- 이미 실행 중인 local Compose의 DB를 read-only 조회하고, ephemeral Redis session record만 생성·삭제해 12개 대표 관리자 route의 no-permission/전체-permission 응답을 비교했다. 두 세션의 Redis key는 검증 직후 삭제했고 DB/업로드/권한/role 데이터는 변경하지 않았다.
- 현재 데이터에서 서로 다른 설문의 section/question과 서로 다른 게시글의 comment ID를 교차시킨 삭제 요청을 보냈다. 부모-자식 composite lookup이 교차 대상을 거부하는지 확인했으며, response/draft 교차 검증은 현재 해당 fixture가 없어 실행하지 못했다.
- public roadmap은 source harness에서 `isVisible=false` course가 public service 결과에 남는지 확인하고, 현재 DB의 hidden-course count와 익명 HTTP 응답 필드를 별도로 확인했다.

### 7.2 기능 권한과 관리자 경계

| 영역 | 현재 확인된 동작 | 증거·판정 |
|---|---|---|
| permission guard | `RequirePermissions`는 `AuthGuard` 후 `PermissionBitsGuard`를 적용하고 required bits는 AND, any bits는 OR다. 현재 실제 controller는 단일 required bit 호출이 주류이며 `RequireAnyPermissions` 사용 route는 확인되지 않았다. | source + in-process harness; 의도된 의미와 일치 |
| admin route gate | role-groups, boards, surveys, users, fee status, contacts, calendar, site-content, roadmap, bulk email, audit, votes의 대표 관리자 route에서 no-permission session은 모두 403, 전체 permission session은 모두 200이었다. | current HTTP matrix; route handler side effect는 만들지 않는 GET/관리자 목록 요청 사용 |
| session/user state | `AuthGuard`는 매 요청 active user와 permission을 다시 계산하고 inactive user를 거부·session revoke한다. permission cache TTL은 있지만 role/member mutation은 영향을 받는 user cache를 DEL한다. | source + harness; stale-cache/Redis 장애 및 concurrent invalidation은 후속 운영 검증 대상 |
| role management | role-group controller 전체가 `MANAGE_ROLES` 하나로 보호된다. system role은 update/delete가 막히지만 custom role에는 현재 registry의 15개 permission을 모두 넣을 수 있고, actor permission의 상한/자기 권한 상승 금지는 없다. | source + fake-repository harness; 정책에 따라 finding 여부가 갈림 |
| initial admin | `INITIAL__ADMIN_STDNOS`에 매칭되는 8자리 학번은 로그인 시 system 최고 관리자 role을 다시 부여받는다. env에서 제거하거나 수동 membership을 제거해도 자동 revoke 경로는 없다. | source + targeted tests; 운영 bootstrap 정책 확인 필요 |
| server-owned fields | role/fee/sanction DTO는 알 수 없는 필드를 strip하고, fee verifier 등 server-owned 값은 controller/service가 request user와 상태에서 산출한다. | source + DTO harness |

### 7.3 객체 경계와 교차 ID 검증

| 시나리오 | 결과 |
|---|---|
| 다른 설문의 section을 첫 설문 아래에서 delete | HTTP 404; section lookup에 `sectionId + surveyId` composite binding |
| 다른 설문의 question을 첫 설문/section 아래에서 delete | HTTP 404; section 소속 확인 후 `questionId + sectionId` binding |
| 다른 게시글의 comment를 첫 게시글 comment route에서 delete | HTTP 404; `commentId + articleId + boardId` binding |
| survey response detail/mine/update service checks | source confirms `responseId + surveyId`, caller user ID, and `responseId + surveyId + userId` bindings; current response fixture absent for live cross-object request |
| draft read/delete | controller/service is owner-bound; current local DB had no draft fixture for live cross-user request |
| role/user/fee admin IDs | route gate uses the relevant permission; target user/role lookups and row locks were reviewed. Live mutation was not performed. |

### 7.4 S03 findings와 예비 severity

| ID | 현재 확인된 동작 | 보안 영향과 예비 판정 | 상태 |
|---|---|---|---|
| S03-F01 | `MANAGE_ROLES` 보유자는 role-group를 만들고 수정할 수 있으며, service/repository가 actor permission mask를 기준으로 assigned permission을 제한하지 않는다. system role만 update/delete가 제한되고 custom role에는 현재 15개 permission과 `MANAGE_ROLES` 자체를 포함할 수 있다. UI도 custom role에 모든 permission checkbox를 노출한다. | `MANAGE_ROLES`가 위임형 role editor라면 단일 권한 관리자가 자신/타인에게 `MANAGE_USERS`, `MANAGE_FINANCE`, `MANAGE_VOTE` 등 전체 권한을 부여하는 privilege-escalation 경로다. 반대로 조직 정책상 `MANAGE_ROLES`가 unrestricted RBAC administrator라면 의도된 설계일 수 있다. **예비 High 후보; 권한 위임/최고 관리자 ceiling 정책 확인 필요**. | source + current-build role-service harness; DB mutation·실제 role 변경 없음 |
| S03-F02 | `roadmapService.listPublic()`이 `findAdminData()`를 사용하고 repository의 catalog query가 `isVisible`을 서버에서 filter하지 않는다. `isVisible=false` course는 public service 결과에 남고 Web `roadmap-graph.tsx`가 뒤늦게 client filter한다. 현재 DB hidden-course count는 0이어서 현재 데이터 행의 공개는 관찰되지 않았지만, 익명 response에는 admin dataset metadata(`source`/`sourceFileName`)가 포함됐다. | 비공개 course가 존재하면 public API가 이를 반환하므로 client filter를 우회한 직접 호출로 unpublished catalog가 노출된다. 현재 fixture 기준 실제 hidden-row disclosure는 미관찰이며 metadata 공개 정책도 별도 확인이 필요하다. **예비 Medium/Low 후보; 현재 데이터 영향 미확정**. | source + fake-repository service harness + current DB/anonymous HTTP |

### 7.5 긍정 통제·관찰·미확인 범위

- survey section/question, response, article/comment의 parent-child composite binding은 현재 교차 ID 요청에서 404를 반환했다. 이 결과는 전체 S05/S07 route가 안전하다는 증명이 아니며, response/draft의 live fixture 부재를 남긴다.
- permission cache는 role update/delete/add/replace의 영향을 받는 member를 invalidate하고, AuthGuard는 user active 상태와 permission을 매 요청 재평가한다. Redis 장애·동시 membership 변경에서의 stale cache는 S12-S13에서 확인한다.
- initial-admin은 configured student number에 대한 자동 grant만 구현하며, env 변경에 따른 자동 revoke는 없다. 이는 보안 취약점으로 확정하지 않고 bootstrap 정책과 운영 회수 절차 확인 항목으로 남긴다.
- role member removal은 존재하지 않는 target user에 대해 no-op 성공/audit이 될 수 있어 audit 정확성 관찰로 남긴다. 현재 권한 상승 경로로는 확인하지 않았다.
- 현재 HTTP matrix는 대표적인 permission gate만 확인했다. 모든 mutation route의 side effect-free negative request, 각 public dataset의 field minimization, production proxy/Redis/DB topology는 S05-S13에서 계속 검증한다.

### 7.6 S03 판정

S03 1차의 source review, permission/role harness, current-stack representative HTTP matrix, cross-object 404 checks 및 46개 표적 테스트를 완료했다. S03-F01은 `MANAGE_ROLES`의 조직 정책이 확정되기 전의 privilege-escalation 후보이고, S03-F02는 현재 DB에 hidden course가 없어 실제 행 노출은 미관찰이지만 server-side visibility enforcement가 없는 후보다. 두 항목 모두 수정하지 않았으며 S04의 운영 경계 확인, 정책 확인, S05-S11의 기능별 전수 검증을 거쳐 severity를 재평가한다.

## 8. S04 결과 — HTTPS·프록시·쿠키·CSRF·CORS·보안 헤더·로그

### 8.1 검증 범위와 방법

- 현재 `main.ts`, `auth-cookie.service.ts`/auth controller, env validation, shared API client, Web API base URL, Nginx 설정, dev/local/prod Compose, request-id/logging/filter 구현을 읽었다. 과거 문서와 production 외부 TLS 장비 설정은 근거에서 제외했다.
- 실행 중인 local Compose의 Nginx front(`localhost:8080`), 직접 API(`localhost:3000`), 직접 Web(`localhost:5173`)에 제한된 GET/OPTIONS 요청을 보냈다. 허용·비허용·null Origin, 명시적 `X-Forwarded-Proto`, 빈/무효 로그아웃, dummy result-token query를 사용했으며 실제 세션·토큰·외부 계정은 사용하지 않았다.
- 빈/무효 로그아웃 요청은 쿠키 플래그를 관찰하기에 부수 효과가 가장 작은 state-changing auth path였지만 controller가 audit 기록을 시도한다. 따라서 사용자·역할·권한·콘텐츠·자산·세션 fixture는 건드리지 않았고, test-generated `auth.logout` audit 행 가능성만 남긴다.
- Nginx `nginx -t`와 front/direct 응답 헤더, CORS preflight/실제 GET·POST, access-log의 비밀이 아닌 query marker 보존을 확인했다. 실제 browser cookie jar, 외부 TLS terminator, production access-log sink/retention은 아직 검증하지 못했다.

### 8.2 현재 코드·구성 관찰

| 영역 | 현재 확인된 동작 | source evidence |
|---|---|---|
| proxy trust | API는 `trust proxy=1`로 설정하고 `request.secure`를 cookie `Secure` 결정에 사용한다. | `apps/api/src/main.ts:11-27`; `apps/api/src/features/auth/auth-cookie.service.ts:14-24` |
| Nginx forwarding | front Nginx는 API에 `X-Forwarded-Proto $scheme`를 설정한다. Nginx/Compose의 production-like path는 HTTP port 80만 repo에 있고 outer TLS terminator는 범위 밖이다. | `infra/docker/nginx/web.conf:15-28`; `infra/docker/compose.prod.yml:1-144` |
| cookie | auth cookie는 HttpOnly, host-only(`Domain` 없음), `Path=/`, `SameSite=Lax`; `Secure`는 request protocol에 따라 달라진다. | `apps/api/src/features/auth/auth-cookie.service.ts:14-24` |
| CORS | `CORS_ORIGIN`을 comma-separated exact list로 사용하고 credentials를 true로 켠다. 값이 없으면 production은 false, non-production은 any-origin fallback이다. | `apps/api/src/main.ts:17-27`; current container `CORS_ORIGIN`은 exact local front origin |
| CSRF | server-side Origin/Referer/CSRF token 검사는 확인되지 않았다. shared client는 credentials를 포함하지만 CSRF nonce/header를 추가하지 않는다. | `apps/api/src/main.ts:17-27`; `shared/api-client/src/core.ts:216-258` |
| response headers | Nginx front는 nosniff, XFO SAMEORIGIN, strict-origin referrer, restrictive Permissions-Policy를 설정하지만 CSP/HSTS는 없다. direct Web/API port는 front Nginx header를 우회한다. | `infra/docker/nginx/web.conf:7-28`; Compose port mapping |
| logging/correlation | Nginx access log 포맷/쿼리 redaction 설정이 없고, `RequestIdMiddleware`와 `LoggingInterceptor`는 정의돼 있으나 bootstrap/module 등록은 확인되지 않았다. auth/audit metadata는 actor/IP 중심이다. | `infra/docker/nginx/web.conf:1-30`; `apps/api/src/shared/middleware/request-id.middleware.ts:6-11`; `apps/api/src/shared/interceptors/logging.interceptor.ts:6-16`; `apps/api/src/features/audit/audit-context.ts:1-18` |

### 8.3 동적·HTTP 증거

| 시나리오 | 결과 |
|---|---|
| Nginx front `/`·`/health`·`/api/auth/session` | HTTP 200; nosniff/XFO/referrer/Permissions-Policy present; CSP/HSTS absent |
| direct Web `:5173/` | HTTP 200; Vite `Cache-Control: no-cache`는 있으나 Nginx front 보안 헤더는 없음 |
| allowed Origin `http://localhost:8080` | preflight 204 및 GET 200; exact `Access-Control-Allow-Origin` + credentials 반환 |
| sibling/null/disallowed Origin | preflight 204/GET 200이지만 `Access-Control-Allow-Origin` 없음; browser read은 차단되는 형태 |
| disallowed Origin state-changing probe | `Origin: https://evil.example`의 빈 세션 로그아웃 POST가 HTTP 201까지 handler에 도달하고 cookie clear를 반환; CORS는 CSRF request rejection이 아님 |
| Nginx에 `X-Forwarded-Proto: https` 주입 | Nginx가 `$scheme=http`로 덮어써 front 응답 clear cookies에 `Secure` 없음 |
| direct API에 `X-Forwarded-Proto: https` 주입 | API가 one-hop header를 신뢰해 clear cookies에 `Secure`를 추가; 직접 공개 port에서 header가 client-controlled임을 확인 |
| invalid login result GET | dummy result token에 HTTP 401; `Cache-Control: no-store` 없음 |
| Nginx query marker | non-secret marker를 `resultToken` query로 요청한 뒤 current Nginx access log에 marker가 존재함을 boolean으로 확인; 실제 token 값은 사용/출력하지 않음 |
| Nginx configuration | `nginx -t`: syntax okay/test successful |

### 8.4 S04 findings와 예비 severity

| ID | 현재 확인된 동작 | 보안 영향과 예비 판정 | 상태 |
|---|---|---|---|
| S04-F01 | 외부에서 전달된 HTTPS 표시를 front Nginx가 `X-Forwarded-Proto $scheme`로 덮어쓴다. 내부 Nginx는 HTTP로 listen하고 API cookie의 `Secure`는 `request.secure`에 의존한다. 따라서 outer TLS terminator가 HTTPS를 종료한 뒤 HTTP로 Nginx에 전달하면 public HTTPS 응답도 `Secure` 없는 auth cookie를 발급할 수 있다. | TLS downgrade/HTTP 노출과 세션 cookie 보호 약화 가능성이 있다. 외부 TLS 장비가 HSTS를 강제하거나 HTTP 접근을 차단하는지 repo 밖 증거가 없어 현재 production exploit은 확정하지 않는다. **예비 Medium 후보; outer TLS/HSTS/HTTP reachability 확인 필요**. | source + Nginx HTTP 동적 확인 |
| S04-F02 | cookie-backed state-changing route에 Origin/Referer/CSRF token 검사가 없고, disallowed Origin POST도 CORS 응답 헤더만 빠진 채 handler에 도달한다. 현재 보호는 `SameSite=Lax`와 browser CORS 동작에 의존한다. | 일반 cross-site POST는 Lax가 줄일 수 있지만 same-site cross-origin/subdomain, browser·proxy topology, login CSRF와 결합한 state change는 별도 방어가 없다. **예비 Medium 후보; 실제 site 관계와 browser 재현 필요**. | source + disallowed-Origin logout probe |

### 8.5 긍정 통제·관찰·미확인 범위

- 현재 local CORS 설정은 `http://localhost:8080` exact allowlist로 동작하고 disallowed Origin을 응답에서 허용하지 않는다. 다만 non-production에서 `CORS_ORIGIN`이 없으면 any-origin fallback + credentials가 되고, env validation은 이 값의 URL/정책을 별도 검증하지 않는다. 현재 local profile 자체의 설정 관찰이며 production 취약점으로 확정하지 않는다.
- auth cookie는 HttpOnly, host-only, SameSite=Lax이고 direct API 테스트에서 request-aware Secure 분기가 실제 응답에 반영됐다. 반면 S04-F01의 외부 TLS 체인 보존은 repo 내 Nginx 설정만으로 만족되지 않는다.
- front Nginx의 네 가지 보안 헤더는 API와 Web front 응답에 적용됐지만 CSP/HSTS는 없다. CSP 부재는 S09 XSS 검증과 함께, HSTS는 외부 TLS termination 확인과 함께 재평가한다.
- Nginx query marker가 access log에 남는 것이 확인돼 S02-F05의 URL bearer 노출 후보에 실제 로그 sink 증거를 추가했다. 이는 S02-F05의 보강 증거이며 별도 finding으로 중복 집계하지 않는다. production 로그 수집기·접근자·보존기간은 Compose logging 설정만으로 확정하지 않는다.
- auth result/session/me 응답에는 `Cache-Control: no-store`가 확인되지 않았다. current Nginx에 proxy cache 설정은 없지만 browser·outer proxy cache 정책은 미확인이므로 token URL/개인정보 응답 hardening 관찰로 남긴다.
- `RequestIdMiddleware`와 `LoggingInterceptor`는 구현돼 있으나 등록 evidence가 없어 요청 correlation·표준 access log가 보장되지 않는다. audit metadata의 actor/IP와 Nginx 기본 로그를 구분해 S08/S12 운영 검증에서 확인한다.
- Compose default/local은 API·Web·Postgres를 host에 publish하고 front Nginx만 loopback bind한다. 이는 development boundary이며 production Compose의 `expose`/external proxy 구성이 실제 운영과 일치하는지는 S12-S13에서 확인한다.

### 8.6 S04 판정

S04의 현재 source review, Nginx config test, front/direct HTTP 헤더·쿠키·CORS/CSRF probe 및 query-log sink 확인을 완료했다. S04-F01~F02는 외부 TLS/site topology가 확정되기 전의 예비 후보이고, CSP/HSTS/cache/correlation은 hardening·운영 확인 항목으로 남긴다. 앱·설정은 수정하지 않았으며, 다음은 S05의 게시판·댓글·초안·검색·알림 개인정보 경계다.

## 9. S05 결과 — 게시판·댓글·초안·검색·알림 개인정보 경계

### 9.1 검증 범위와 방법

- 현재 `features/board`, `features/notifications`, `features/users`, 공유 board/user 계약 및 Web 게시글 렌더러를 읽었다. 게시글 공개 범위·비밀·익명·숨김 상태, 댓글 parent/owner, draft/notification self-boundary, 검색·My Page의 간접 노출 경로를 함께 추적했다.
- 현재 DB는 read-only aggregate query로 상태별 행 수만 확인했다. article 38건은 모두 `PUBLISHED`·`PUBLIC`·non-secret·non-anonymous였고, comment 2건은 모두 published, draft/notification은 0건이었다. 식별자·제목·본문·PII는 출력하지 않았다.
- 현재 build 산출물의 서비스 harness에서 (a) 익명 게시글의 raw author 반환, (b) `isReadableArticle`만 true인 비밀글의 익명 댓글 목록 반환, (c) 비밀 이웃 글의 이전 글 metadata pass-through를 재현했다. 이는 합성 데이터 기반 source-backed behavior test이며 실DB fixture 생성은 하지 않았다.
- 실행 중인 local front에 public article/search/detail/comments GET, unauthenticated My Page·notification·draft GET/PATCH를 보냈다. public read는 200, self/protected routes는 401이었다. `limit=999999`는 article aggregate에서 100으로 clamp됐다.
- 현재 관련 표적 테스트 19개를 재실행했으며 19 pass, 0 fail, 0 skipped였다. 기존 테스트는 secret/anonymous/draft/notification 실DB 경계의 완전한 증명이 아니다.

### 9.2 현재 코드·구성 관찰

| 영역 | 현재 확인된 동작 | source evidence |
|---|---|---|
| article secret gate | 목록은 `canReadSecretArticle`이 false면 `maskSecretListItem`을 적용하고, 상세는 같은 gate에서 403을 반환한다. | `apps/api/src/features/board/article.service.ts:61-95,145-156,215-229,254-278` |
| anonymous author | repository가 `isAnonymous`와 별개로 `users.userId/nameKo`를 `author`에 채워 반환하고, service는 secret만 mask한다. Web은 표시 시에만 `익명`으로 바꾼다. | `apps/api/src/features/board/repositories/article.repository.ts:223-229,284-292,635-636,759-762`; `apps/web/src/features/board-detail/board-detail-sections.tsx:108-112`; `apps/web/src/features/board-list/board-page-sections.tsx:208-213` |
| previous/next | 상세의 prev/next query는 board/status/visibility만 조건으로 사용하고 `isSecret` filter나 masking이 없다. 반환 contract에도 title·author가 포함된다. | `apps/api/src/features/board/repositories/article.repository.ts:694-738,798-823`; `shared/contracts/src/http/board.ts:151-179` |
| comments vs secret | public comment list와 authenticated create/engagement/update/delete는 article scope/readability를 확인하지만 `isSecret`을 확인하지 않는다. `isReadableArticle`와 `findCommentPermissionInfo`도 `isSecret` 조건이 없다. | `apps/api/src/features/board/comment.service.ts:56-107,140-205,237-345,412-447`; `apps/api/src/features/board/repositories/article.repository.ts:972-1000,1190-1212` |
| comment object boundary | comment update/delete/engagement는 `commentId + articleId + boardId` permission lookup을 사용하고, reply 생성은 parent의 `articleId`를 비교한다. | `apps/api/src/features/board/comment.service.ts:182-198,264-277,319-332,438-445`; `apps/api/src/features/board/repositories/comment.repository.ts:208-230` |
| drafts | controller 전체가 `AuthGuard`이고 get/list/update/delete repository 조건은 owner user ID에 bound된다. `targetArticleId`와 `linkedSurveyId`는 save schema에 들어오지만, 현재 코드 검색에서 이를 이용해 기존 article/survey를 변경하는 publish path는 확인되지 않았다. | `apps/api/src/features/board/article-draft.controller.ts:33-97`; `apps/api/src/features/board/article-draft.service.ts:58-167`; `apps/api/src/features/board/repositories/article-draft.repository.ts:106-253`; `shared/contracts/src/schemas.ts:324-350` |
| notifications | list/read/read-all은 모두 `request.user.id`를 서비스·repository에 전달하고 notification ID에도 user ID 조건을 건다. article link는 기존 published active article만 표시한다. | `apps/api/src/features/notifications/notifications.controller.ts:16-47`; `apps/api/src/features/notifications/notifications.repository.ts:73-125,172-197` |
| My Page/activity | `/users/me/*`는 AuthGuard 후 request user ID만 사용한다. own article/comment/activity query는 caller user ID에 bound되며, 본인 데이터 외 cross-user selector는 없다. | `apps/api/src/features/users/users.controller.ts:51-122`; `apps/api/src/features/users/repositories/users.repository.ts:1431-1464,1497-1533,1636-1688` |

### 9.3 동적·하네스 증거

| 시나리오 | 결과 |
|---|---|
| 현재 DB 상태 집계 | articles total 38; published 38; anonymous 0; secret 0; non-public scope 0; hidden/deleted 0; comments total/published 2/2; drafts 0; notifications 0 |
| `GET /api/articles?limit=999999` | HTTP 200; 8 items; 응답 `limit=100`; anonymous/secret item 0; content preview 필드 0 |
| `GET /api/articles/search?limit=999999&q=` | HTTP 200; 8 items; snippets 8; anonymous item 0. 검색 endpoint는 현재 공개 aggregate의 content preview를 반환하는 구조 |
| 현재 첫 public article detail/comments | detail HTTP 200; prev metadata 존재; comments HTTP 200; 현재 선택 article의 comment item 0 |
| unauthenticated self routes | `/users/me/articles`, `/users/me/comments`, `/users/me/activity`, `/users/me/scraps`, `/users/me/survey-responses`, `/notifications`, `/drafts` 및 dummy draft GET은 401; `/notifications/read-all` PATCH도 401 |
| anonymous author service harness | `getArticle`와 `getArticles` 모두 `isAnonymous=true`인 item에 raw author userId/name을 보존하고 `isAnonymous`만 true로 표시 |
| secret comment service harness | article scope readability만 true로 주어진 경우 anonymous `getComments`가 comment item 1개를 반환. service에서 `isSecret` 확인이 호출되지 않음 |
| secret previous/next service harness | main article이 public일 때 `prevArticle.isSecret=true`인 neighbor의 title·author·ID가 그대로 반환됨 |
| S05 targeted tests | 19 pass, 0 fail, 0 skipped |

### 9.4 S05 findings와 예비 severity

| ID | 현재 확인된 동작 | 보안 영향과 예비 판정 | 상태 |
|---|---|---|---|
| S05-F01 | public article list/detail/search 경로가 `isAnonymous=true`를 별도 server-side redaction하지 않는다. repository는 raw `author.userId/name`을 만들고 service의 masking은 `isSecret`에만 적용된다. Web UI는 렌더링 시에만 `익명`으로 표시한다. | 익명 게시글의 raw 작성자 식별자와 이름을 API 직접 호출자가 얻어 다른 공개 활동과 상관분석할 수 있다. 현재 DB에는 anonymous article이 0건이어서 실데이터 행 노출은 관찰하지 못했다. 익명성 보호가 현재 정책이면 **예비 High 후보**이며, userId가 완전한 opaque identifier이고 이름 노출이 허용된 정책이면 severity를 낮추거나 close할 수 있다. | source + current-build harness; live fixture 없음 |
| S05-F02 | `GET /boards/:code/articles/:articleId/comments`와 댓글 create/engagement 경로가 `isReadableArticle`/`findCommentPermissionInfo`만 사용한다. 두 repository query에는 `isSecret` 조건이 없고, 본문 상세 경로의 별도 `canReadSecretArticle` gate는 댓글 service에 없다. | board scope가 readable이면 비로그인 caller가 secret article의 댓글을 읽을 수 있고, authenticated caller가 secret article에 댓글을 작성하거나 engagement를 남길 수 있다. 이는 secret post의 comment confidentiality/integrity 및 owner notification 경계를 우회한다. 현재 DB secret article이 0건이라 live disclosure는 미관찰이며, 댓글 update/delete의 owner check는 별도 positive control이다. **예비 High 후보; secret post에 댓글도 비밀이어야 한다는 현재 정책과 fixture 검증 필요**. | source + current-build harness; live fixture 없음 |
| S05-F03 | `findDetailById`의 prev/next query가 published + visibility scope만 확인하고 neighbor의 `isSecret`을 제외하거나 mask하지 않는다. main article만 `canReadSecretArticle`로 검사한다. | public article detail에서 같은 board/scope의 secret neighbor가 있으면 secret title·author·article ID metadata가 노출된다. 현재 DB secret article이 0건이고 현재 detail의 neighbor도 non-secret이어서 실제 행 노출은 미관찰이다. **예비 Medium 후보; title/author가 confidential이면 High로 재평가**. | source + current-build harness; live fixture 없음 |

### 9.5 긍정 통제·정책 관찰·미확인 범위

- main article detail은 secret article을 author 또는 `WRITE_REPLY`/`MODERATE_CONTENT` 보유자 외에는 403으로 막고, list는 민감 필드를 mask한다. anonymous identity reveal은 `MODERATE_CONTENT`와 audit log를 요구한다. 이 통제들은 댓글·prev/next 경로의 누락을 상쇄하지 않는다.
- comment parent는 target article에 bound되고 update/delete는 owner에 bound된다. 현재 S03에서 cross-article comment delete가 404였으므로, S05-F02의 핵심은 타인 comment mutation IDOR가 아니라 secret article 경계의 read/create/engagement 누락이다.
- draft read/list/update/delete는 owner user ID를 query 조건으로 사용하고, notification list/read도 recipient user ID를 bound한다. 현재 draft/notification fixture가 없어 A/B 실데이터 교차 요청은 실행하지 못했다.
- public search는 `includeContentPreview: true`로 현재 공개 article content snippet을 반환한다. 공개 본문 검색 정책상 의도된 것일 수 있어 finding으로 확정하지 않고, 비밀·숨김·삭제 상태가 search scope에서 제외되는지 S07/S09와 함께 재확인할 정책 관찰로 남긴다.
- secret list mask는 `articleId`, status, visibility scope, `isSecret` 같은 존재 metadata를 남긴다. 존재 자체가 민감한 정책이면 별도 metadata minimization을 검토해야 하지만, 현재 secret fixture가 없어 영향은 판단하지 않는다.
- `targetArticleId`/`linkedSurveyId`의 저장 시 cross-object 존재·소유권 검사는 보이지 않지만, 현재 코드에서 draft 값을 이용해 article/survey를 직접 변경하는 downstream path는 찾지 못했다. 따라서 S05 finding으로 승격하지 않고 S06/S07의 publish/link 경계에서 재확인한다.
- 댓글·게시글의 asset 직접 접근은 `isReadableArticle` 공통 경계를 사용하므로 `isSecret` 전파 여부를 S06에서 별도 검증했다. S05-F02와 동일 finding으로 합치지 않는다.

### 9.6 S05 판정

S05의 현재 source review, current DB read-only 상태 집계, public/protected HTTP smoke, current-build privacy harness 및 19개 표적 테스트를 1차 완료했다. S05-F01~F03은 현재 데이터 fixture가 없어 live exploit row를 관찰하지 못했지만 서로 다른 server-side privacy gate 누락 후보로 남긴다. 앱·설정·데이터는 수정하지 않았으며, S06에서 자산 경계를 계속 검증했다.

## 10. S06 결과 — 업로드·다운로드·S3 직접 업로드 및 참조 경계

### 10.1 검증 범위와 방법

- 현재 `features/asset/*`, `article-asset-access`, asset reference/repository, survey answer/CMS asset reference, storage 설정과 response header builder를 읽었다. multipart upload, presign/complete, linked/unlinked asset read, local/S3 key parsing, cleanup/migrate의 실제 호출 경계를 분리해 확인했다.
- 현재 DB는 read-only aggregate query로 자산 상태만 확인했다. assets 20건, article links 18건, unlinked assets 2건, public content refs 0건, survey answer refs 0건이며 secret article fixture는 0건이었다. 파일명·storage key·본문·PII는 출력하지 않았다.
- 현재 source에서 build한 산출물의 서비스 harness로 (a) public-scope secret article에 연결된 asset을 anonymous caller가 읽는 경로, (b) S3 presign 응답에 `Content-Length`·checksum·size condition이 없는 경로를 재현했다. presigned URL과 자격증명은 출력하지 않았다.
- 실행 중인 local API에서 현재 asset content 5건의 header/bytes smoke를 수행했고, unauthenticated upload/presign/complete/cleanup/migrate가 모두 401인지 확인했다. 실제 S3 PUT/HeadObject, bucket ACL/IAM, 외부 public URL은 호출하지 않았다.
- 현재 관련 표적 테스트 37개를 재실행했으며 37 pass, 0 fail, 0 skipped였다. 이 결과는 테스트 fixture와 현재 local configuration의 증거이지 실제 S3 정책의 증명은 아니다.

### 10.2 현재 코드·구성 관찰

| 영역 | 현재 확인된 동작 | source evidence |
|---|---|---|
| multipart upload | controller가 인증을 요구하고 20MiB 경계와 허용 MIME allowlist를 적용한 뒤 storage upload와 asset metadata 생성을 수행한다. 현재 source에는 파일 magic bytes/악성 문서 검사도 별도로 없다. | `apps/api/src/features/asset/asset.controller.ts:50-68,104-139`; `apps/api/src/features/asset/asset.service.ts:91-137` |
| linked asset read | linked asset은 active board, caller readable scope, `isReadableArticle(boardId, articleId, scopes)` 순서로 판정된다. 이 경로에는 `isSecret` 검사가 별도로 없고, read 성공 뒤에만 storage를 연다. | `apps/api/src/features/asset/asset.service.ts:292-355`; `apps/api/src/features/asset/repositories/asset.repository.ts:48-155` |
| direct presign/complete | presign은 인증된 caller가 입력 metadata를 최대 20MiB로 제출하면 asset row를 먼저 만들고 10분 URL을 반환한다. S3 `PutObjectCommand`에는 ContentType/SSE만 있고 ContentLength·checksum 조건이 없으며, complete는 owner-bound storage key를 찾은 뒤 HeadObject의 실제 size/MIME를 사후 비교한다. | `apps/api/src/features/asset/asset.controller.ts:141-193`; `apps/api/src/features/asset/asset.service.ts:139-241`; `apps/api/src/features/asset/asset.storage.ts:181-220` |
| asset reference | article attachment는 존재·uploader·unlinked 상태를 확인하고 edit 시 다른 article에 연결된 자산을 거부한다. survey answer 파일은 owner-bound asset details 조회를 사용하고, CMS/public survey image reference는 public service가 참조를 구성한다. | `apps/api/src/features/board/article-asset-access.ts:1-36`; `apps/api/src/features/asset/repositories/asset.repository.ts:157-247`; `apps/api/src/features/surveys/survey-responses.service.ts:65-98` |
| response/storage boundary | local provider는 basename과 upload-root containment를 확인하고, S3 provider는 bucket prefix와 `..`을 거부한다. 응답은 attachment 기본값, `nosniff`, sandbox CSP, private cache를 적용한다. | `apps/api/src/features/asset/asset.storage.ts:56-133,240-250`; `apps/api/src/features/asset/asset-response.ts:1-42` |
| cleanup/migrate | cleanup은 unlinked candidate를 조회한 뒤 storage delete와 ID 기반 DB delete를 별도 수행하며, 그 사이 재참조를 재검사하지 않는다. 현재 자동 cleanup flag는 false이고 migrate/cleanup은 permission route다. | `apps/api/src/features/asset/asset.service.ts:426-470`; `apps/api/src/features/asset/repositories/asset.repository.ts:284-360`; `apps/api/src/features/asset/asset.controller.ts:195-211` |

### 10.3 S06 findings와 예비 severity

| ID | 현재 확인된 동작 | 보안 영향과 예비 판정 | 상태 |
|---|---|---|---|
| S06-F01 | asset content service가 linked article의 board scope와 `isReadableArticle`만 확인하고 `isSecret`을 별도 확인하지 않는다. public scope인 secret article에 연결된 asset을 합성 데이터로 넣으면 anonymous caller가 storage read와 file bytes 반환까지 도달한다. | secret article의 첨부 파일이 본문과 동일한 confidentiality를 가져야 한다면 비로그인 사용자가 파일 원문을 직접 획득하는 경로다. 현재 DB secret article이 0건이라 live disclosure는 관찰하지 못했다. **예비 High 후보; secret article asset 정책과 실제 fixture 확인 필요**. S05-F02 댓글 경계와 다른 file-byte sink로 별도 집계한다. | source + current-build harness; live fixture 없음 |
| S06-F02 | S3 direct presign은 입력 `sizeBytes`를 DB metadata로 저장하지만 signed `PutObject` 조건에는 ContentLength·checksum·max-size condition이 없다. complete는 object가 이미 생성된 후 실제 HeadObject size/MIME를 비교하고, 호출 quota/rate limit이나 one-time upload state는 현재 source에서 확인하지 못했다. | 인증된 사용자가 반복 presign 또는 metadata보다 큰 object를 S3에 먼저 쓰게 되면 저장 비용·orphan object·가용성 부담이 생길 수 있다. 실제 provider가 외부에 노출됐는지와 S3 정책은 확인하지 않았다. **예비 Medium 후보; 청구/공개 S3 노출과 실제 PUT 동작이 확인되면 High까지 재평가**. | source + presign preparation harness; actual S3 PUT 미실행 |

### 10.4 긍정 통제·정책 관찰·미확인 범위

- multipart endpoint는 unauthenticated request를 거부하고, 20MiB 초과와 허용되지 않은 MIME을 storage 이전에 거부한다. direct complete는 storage key와 uploader를 함께 조회하고 실제 size/MIME mismatch를 거부한다.
- asset link mutation은 타인 uploader asset과 다른 article에 이미 연결된 asset을 막는다. local path traversal과 S3 `s3://` key traversal에는 containment 검사가 있고, response는 active content의 브라우저 실행 범위를 제한한다.
- 현재 source에서 공개 asset의 별도 static/bucket URL route는 확인하지 못했다. 다만 S3 bucket public access, IAM, lifecycle, malware scanning, CDN/cache, Range 정책과 production `ASSET_STORAGE_PROVIDER` 유효값은 외부 운영 증거가 필요하다.
- cleanup은 candidate scan과 delete 사이의 재참조 경합을 방어하지 않으며 inline content의 모든 asset reference를 동일하게 재검사하는지도 추가 확인이 필요하다. 현재 자동 cleanup이 꺼져 있어 live 삭제 영향은 관찰하지 못했으며 S13의 race/recovery 검증 항목으로 남긴다.
- client가 선언한 MIME과 S3 HeadObject의 ContentType 비교는 수행하지만 파일 내용의 magic bytes 검증은 별도 확인되지 않았다. 현재 response의 download/sandbox 통제가 있어 즉시 실행형 콘텐츠 취약점으로 확정하지 않고 S09 parser/content 검증과 함께 보강 후보로 둔다.

### 10.5 S06 판정

S06의 현재 source review, 자산 DB read-only aggregate, local asset HTTP/header smoke, current-build asset harness 및 37개 표적 테스트를 1차 완료했다. S06-F01~F02는 source-backed deterministic behavior와 제한된 local evidence가 있으나 현재 secret fixture·실제 S3 외부 동작·IAM/bucket 정책·업무 confidentiality 정책이 열려 있어 예비 severity로 유지한다. 앱·설정·데이터는 수정하지 않았으며, 다음은 S07의 설문 자격·응답·편집·집계 경계다.

## 11. S07 결과 — 설문 자격·응답·편집·집계 및 첨부 경계

### 11.1 검증 범위와 방법

- 현재 `features/surveys`의 public/admin controller, survey/response/section/question service·repository, mutation policy, eligibility·answer validation·branching·definition validation, survey schema와 shared contract를 읽었다. public/optional-auth 경로와 manager-only 경로, 응답 소유권·수정·중복·정원 경쟁, 설문 첨부파일·이미지 참조, public/private analytics를 분리해 추적했다.
- 현재 DB는 read-only aggregate query로 설문 상태와 응답·첨부 참조의 존재만 확인했다. survey 13건 중 published 12건·draft 1건, public-result 1건, anonymous 1건, multiple 3건, affiliation/academic 제한 2/2건이었다. response·answer는 0건, file question은 2건, survey asset reference는 0건이었다. 제목·식별자·응답 내용·파일명은 출력하지 않았다.
- 현재 source에서 build한 산출물의 서비스 하네스로 public `findPublished`/`findDetail`이 full `SurveyRecord`를 그대로 전달하는 동작, 응답의 `assetId`/`assetIds` 혼합 시 owner-check와 persistence 대상이 갈리는 동작, 형식만 검증된 survey image asset path가 sanitizer와 public asset 분류 체인에 도달하는 동작을 재현했다. 하네스에는 실제 사용자·파일·외부 URL을 사용하지 않았다.
- 실행 중인 local front에 public survey list/detail/analytics, mine response, manager response list/detail 요청을 보냈다. public list/detail/analytics는 200, anonymous mine는 403, manager response 경로는 401이었다. 현재 public list는 12건이었다.
- 현재 관련 표적 테스트 59개를 재실행했으며 49 pass, 0 fail, 10 skipped였다. skipped 10건은 모두 `SURVEY_CONCURRENCY_TEST_DATABASE_URL` 부재로 인한 전용 PostgreSQL concurrency integration case였고, mocked OAuth warning 외 실패는 없었다.

### 11.2 현재 코드·구성 관찰

| 영역 | 현재 확인된 동작 | source evidence |
|---|---|---|
| public survey DTO | `findPublished`/`findDetail`이 full `SurveyRecord`를 spread하여 creator ID, version lineage, spreadsheet ID/URL/sync state, eligibility/settings 등 public client에 불필요할 수 있는 필드를 반환한다. | `apps/api/src/features/surveys/surveys.service.ts:253-330`; `apps/api/src/features/surveys/surveys.repository.ts:26-64`; `shared/contracts/src/http/survey.ts:46-85` |
| eligibility | public list/detail은 participation eligibility를 계산한다. submit service가 academic/major/login/temp/fee를 사전 확인하지만, repository transaction의 authoritative 재확인은 state/fee/questions/capacity/duplicate 중심이며 academic/major/active profile은 같은 경계에서 재확인하지 않는다. | `apps/api/src/features/surveys/surveys.service.ts:154-233`; `apps/api/src/features/surveys/survey-responses.service.ts:102-168`; `apps/api/src/features/surveys/repositories/survey-responses.repository.ts:351-457` |
| response ownership | mine 조회·수정은 caller user ID에 bound되고, manager response route는 `MANAGE_SURVEY`를 요구하며 response detail query도 survey ID와 response ID를 함께 사용한다. | `apps/api/src/features/surveys/survey-responses.controller.ts:1-150`; `apps/api/src/features/surveys/survey-responses.service.ts:216-314`; `apps/api/src/features/surveys/repositories/survey-responses.repository.ts:303-310,514-658` |
| answer validation | required/unknown/duplicate answer, choice/rating/grid/date/time/file 형식과 reachable branching question을 검증하고 publish 시 definition validation을 수행한다. | `apps/api/src/features/surveys/survey-answer-validation.ts:1-330`; `apps/api/src/features/surveys/survey-branching.ts:1-190`; `apps/api/src/features/surveys/survey-definition-validation.ts:1-210` |
| response file | service는 `assetId`를 먼저 추출해 ownership을 확인하지만 validator/persistence 경로는 `assetIds`를 우선 취급한다. survey answer file로 표시된 unlinked asset은 `MANAGE_SURVEY` 권한 경로의 storage read 대상이 된다. | `apps/api/src/features/surveys/survey-responses.service.ts:48-99`; `apps/api/src/features/surveys/survey-answer-validation.ts:124-160,295-308`; `apps/api/src/features/asset/repositories/asset.repository.ts:120-147`; `apps/api/src/features/asset/asset.service.ts:310-321` |
| survey image reference | image reference schema는 `asset:<digits>` 또는 URL 형식만 확인하며 survey/question mutation에서 uploader ownership lookup을 호출하지 않는다. rich-text sanitizer는 asset content path를 보존하고 published survey 참조는 asset을 public content image로 분류한다. | `shared/contracts/src/schemas.ts:376-378,453-459,479-524`; `apps/api/src/features/surveys/surveys.repository.ts:114-168`; `apps/api/src/features/surveys/survey-questions.service.ts:38-123`; `apps/api/src/features/board/article-html-sanitizer.ts`; `apps/api/src/features/asset/repositories/asset.repository.ts:120-147` |
| analytics/concurrency | public analytics는 free-text/date/time raw value를 제외하고 choice/grid 집계를 반환하며 private analytics는 manager 경로다. response insert/update는 survey row lock과 single-response unique index를 사용해 중복·정원 경쟁을 방어한다. | `apps/api/src/features/surveys/surveys.service.ts:640-824`; `apps/api/src/features/surveys/repositories/survey-responses.repository.ts:351-658`; `apps/api/src/infrastructure/postgres/schema/survey.schema.ts` |

### 11.3 S07 findings와 예비 severity

| ID | 현재 확인된 동작 | 보안 영향과 예비 판정 | 상태 |
|---|---|---|---|
| S07-F01 | public survey list/detail이 `SurveyRecord` 전체를 반환해 `creatorId`, previous/derived version lineage, spreadsheet ID/URL/sync state 및 기타 내부 설정 필드가 응답에 포함된다. 현재 DB에는 spreadsheet 연결 값이 없었지만, current-build 하네스에서 non-null 합성 값 7개가 그대로 반환됐다. | public metadata 최소화 경계를 넘고 내부 actor·버전·외부 문서 연결 정보를 노출한다. spreadsheet URL이 외부에서 읽히거나 sync metadata가 민감하면 문서·개인정보로 이어질 수 있다. **예비 Medium; 외부 sheet sharing 또는 민감한 lineage가 확인되면 High까지 재평가**. | source + current HTTP field check + current-build harness; live spreadsheet fixture 없음 |
| S07-F02 | response file validation service는 `assetId`를 우선 owner-check하지만 answer validator는 `assetIds`를 우선 읽는다. 두 필드를 함께 보낸 하네스에서 ownership lookup은 첫 ID에만 수행되고 다른 ID가 persisted answer 대상이 됐다. 해당 target이 `surveyAnswerFile`로 분류되면 `MANAGE_SURVEY` caller의 unlinked asset read 경로에 도달한다. 현재 response·survey answer asset ref는 0건이다. | 응답자가 타인 소유의 숫자 asset ID를 혼합 필드로 주입해 응답 첨부파일 참조를 만들고, 그 파일이 설문 관리자 다운로드 경계로 이동할 수 있다. private 파일이면 **예비 High**, manager가 모든 survey answer asset을 읽는 정책이면 실제 confidentiality에 따라 Medium으로 조정한다. | source + current-build validator/asset harness; live response fixture 없음 |
| S07-F03 | survey/question image reference는 숫자 asset 또는 URL 형식만 검사하고 uploader ownership을 확인하지 않는다. publish된 survey가 이를 참조하면 asset repository가 public image로 표시하고 AssetService가 anonymous content read를 허용한다. 현재 survey image asset ref는 0건이다. | `MANAGE_SURVEY` 권한 보유자가 타인 또는 unlinked/private asset을 survey description/question image에 삽입·publish해 익명 asset disclosure를 유발할 수 있다. target asset이 private이면 **예비 High**, manager에게 의도된 unrestricted publishing 권한이 있으면 Medium으로 재평가한다. | source + current-build sanitizer/public-chain harness; live survey image fixture 없음 |

### 11.4 긍정 통제·정책 관찰·미확인 범위

- response insert/update는 survey row lock, single-response unique index, capacity 재확인을 사용하고 response owner와 survey ID를 함께 bound한다. 다만 전용 PostgreSQL concurrency integration 10건을 실행하지 못했으므로 실제 DB race 결과는 아직 확인하지 않았다.
- temporary caller는 `findMine`과 file upload의 persisted user 경계로 들어가지 못하고, manager response route는 `MANAGE_SURVEY`를 요구한다. answer validator의 required/choice/grid/date/time/branching 검증과 public analytics의 free-text/date/time raw value 제외는 긍정 통제다.
- submit transaction은 state/fee/questions/capacity/duplicate를 authoritative하게 재확인하지만 academic/major/affiliation eligibility는 사전 검사와 transaction 사이의 race·stale profile을 별도로 방어하지 않는다. 이는 현재 코드의 consistency hardening 후보로 S13에서 재검토한다.
- 현재 테스트는 submitted response가 있어도 question definition mutation을 허용하는 정책을 명시한다. 해당 정책이 의도된 것인지, 기존 answer와 question 삭제·변경의 무결성 및 분석 재현성이 허용되는지는 S13 정책 확인 대상으로 남긴다.
- `findBySurveyId`는 status filter 없이 응답을 조회하고 map 단계는 status를 submitted로 고정하는 경로가 있다. 현재 app path에서 draft response 생성은 확인하지 못했고 DB non-submitted response도 0건이므로 즉시 finding으로 승격하지 않고 S10/S13 unknown으로 남긴다.
- 현재 response·survey image fixture가 모두 0건이어서 S07-F02/F03의 live disclosure는 관찰하지 못했다. 반면 S07-F01의 public response field pass-through는 현재 public HTTP shape와 합성 non-null 값으로 확인됐다. 앱·설정·데이터는 수정하지 않았다.

### 11.5 S07 판정

S07의 현재 source review, survey DB read-only aggregate, public/manager HTTP smoke, current-build survey harness 및 59개 표적 테스트를 1차 완료했다. S07-F01~F03은 서로 다른 public metadata·response asset·survey image reference 경계 후보로 기록하며, 실제 spreadsheet sharing과 survey response/image fixture가 확인되기 전까지 예비 severity로 유지한다. 이어서 S08의 fee/contact/export/audit-log 민감 데이터와 side effect 경계를 검증했다.

## 12. S08 결과 — 과비·연락망·내보내기·감사 로그 경계

### 12.1 검증 범위와 방법

- 현재 `features/users`, `features/contacts`, `features/audit`, fee/contact/audit schema와 shared HTTP contract, XLSX export controller, Google Sheets service/client, DB-backed Sheets queue를 읽었다. 과비 상태·납부 원장·학기 계산·bulk mutation·연락망 privacy purge·공개/관리자 조회·XLSX/Sheets 필드·감사 로그 기록과 열람 경계를 분리해 추적했다.
- 현재 DB는 read-only aggregate query로 contacts 4건(privacy consent 4, revoked 0), departments 5건, users 3건, student fee status/payment 0건, audit log 154건, Sheets queue 2건(SUCCEEDED)을 확인했다. S08의 관리자 export smoke가 `executive_contact.export`, `student_fee.export`, `audit.export` 감사 행을 각각 1건 추가했으며, 연락망·과비·사용자·역할·콘텐츠·자산 원본은 변경하지 않았다.
- 실행 중인 local front에서 public `/contacts`와 `/contacts/departments`는 200, unauthenticated manager/finance/audit list/export는 401이었다. 임시 Redis persisted session으로 필요한 단일 권한을 부여해 관리자 list/export를 200으로 확인했고, JSON/XLSX 응답의 `Cache-Control` 값은 비어 있었다. 임시 세션 key는 검사 후 삭제했다.
- current-build harness로 (a) `privacyConsented=false` contact row가 `GoogleContactSheetsService.sync`의 output row가 되는 경로, (b) fee bulk 두 번째 항목의 synthetic failure 뒤 첫 번째 mutation·audit·queue가 남는 경로, (c) 동일 payment object 두 건을 schema가 허용하는 경로, (d) audit repository failure를 `AuditLogService.record`가 warn 후 삼키는 경로를 재현했다. 실제 Google·Drive·SMTP·결제 provider와 실제 revoked/fee fixture는 사용하지 않았다.
- XLSX writer에 무해한 `=`, `+`, `@` 문자열을 넣은 current-build check에서 formula field 없이 string cell로 round-trip됐고, Google Sheets write path는 `valueInputOption=RAW`와 protected range를 사용한다. 현재 source에는 CSV export path가 없고, formula/link 처리와 외부 sharing/IAM은 S09/S10에서 별도로 확인한다.
- 관련 표적 테스트 18개를 재실행했으며 15 pass, 0 fail, 3 skipped였다. skipped 3건은 `FEE_CONCURRENCY_TEST_DATABASE_URL` 부재로 인한 전용 PostgreSQL concurrency integration case였다.

### 12.2 현재 코드·구성 관찰

| 영역 | 현재 확인된 동작 | source evidence |
|---|---|---|
| public contacts | `GET /contacts`에는 guard가 없고 `ContactRecord` 전체(name, student number, email, phone, consent flag, timestamps)를 반환한다. service는 먼저 `privacyConsented=false` row를 삭제하지만, current DB의 revoked row는 0건이다. | `apps/api/src/features/contacts/contacts.controller.ts:37-48`; `apps/api/src/features/contacts/contacts.service.ts:30-33,251-263`; `apps/api/src/features/contacts/contacts.repository.ts:25-50,211-217`; `shared/contracts/src/http/contact.ts:11-27` |
| manager contacts/export | 관리 list/export/import/update/delete/reorder/sync는 `MANAGE_CONTACTS`를 요구한다. export는 최대 500건을 한 번에 만들고 audit payload는 safe snapshot/count 중심이다. | `apps/api/src/features/contacts/contacts.controller.ts:55-228`; `apps/api/src/features/contacts/contacts.service.ts:121-145,155-249,266-287`; `apps/api/src/features/contacts/contacts.repository.ts:159-209` |
| revoked contact egress | contact create/import schema는 `privacyConsented=false`를 허용하고 mutation 뒤 sync를 enqueue한다. 그러나 queue handler의 `GoogleContactSheetsService.sync`는 `ContactsRepository.findManaged`를 직접 호출해 `ContactsService.purgeRevoked`를 거치지 않는다. repository list에도 privacy filter가 없다. | `shared/contracts/src/schemas.ts:690-729`; `apps/api/src/features/contacts/contacts.service.ts:155-186`; `apps/api/src/features/contacts/google-contact-sheets.service.ts:28-35,57-95`; `apps/api/src/features/contacts/contacts.repository.ts:159-209,211-217`; `apps/api/src/infrastructure/google/google-spreadsheet-sync-queue.service.ts:45-73,110-145` |
| fee status boundary | fee list/detail/status/bulk/payment/export/sync routes는 `MANAGE_FINANCE`를 요구하고 user ID를 대상으로 사용한다. status update는 parent user와 fee row를 transaction 안에서 lock하고, payment batch는 user row와 fee row를 lock해 payment와 summary row를 같은 transaction에 쓴다. | `apps/api/src/features/users/users.controller.ts:226-470`; `apps/api/src/features/users/repositories/users.repository.ts:843-925,928-1026`; `apps/api/src/infrastructure/postgres/schema/fee.schema.ts:14-56` |
| fee bulk failure/idempotency | bulk status endpoint는 대상 resolve를 먼저 모두 수행하지만 각 `updateStudentFeeStatus`를 별도 transaction으로 순차 실행한다. payment input에는 request idempotency key가 없고 repository는 배열의 각 항목마다 새 payment row를 insert한다. | `apps/api/src/features/users/users.service.ts:314-350,360-379`; `apps/api/src/features/users/repositories/users.repository.ts:843-925`; `shared/contracts/src/schemas.ts:643-656` |
| exports/cache | contact/fee/audit export는 fixed filename과 XLSX `aoa_to_sheet`를 사용한다. fee/audit export는 여러 page를 모두 메모리에 모으고, current authorized JSON/XLSX smoke 응답에는 `Cache-Control`이 없었다. | `apps/api/src/features/contacts/contacts.controller.ts:55-95`; `apps/api/src/features/users/users.controller.ts:334-403`; `apps/api/src/features/audit/audit-log.controller.ts:48-110`; `apps/api/src/features/users/users.service.ts:412-471`; `apps/api/src/features/audit/audit-log.service.ts:41-50` |
| Sheets write/protection | Google Sheets write는 `valueInputOption=RAW`, clear→put, frozen header·protected range·read-only description을 사용하고 destination folder writable/parent를 확인한다. 실제 provider sharing/IAM과 external viewer 범위는 source 밖이다. | `apps/api/src/infrastructure/google/google-sheets.client.ts:77-198`; `apps/api/src/features/contacts/google-contact-sheets.service.ts:66-95`; `apps/api/src/features/users/google-fee-sheets.service.ts:87-129` |
| audit log | audit list/export는 `VIEW_AUDIT_LOG`로 보호되고 page size는 100으로 clamp된다. response에는 stored raw payload, actor/target ID, IP가 포함되며 delete/update endpoint는 없다. `record`는 DB write failure를 warn만 하고 호출 mutation을 실패시키지 않는다. | `apps/api/src/features/audit/audit-log.controller.ts:15-110`; `apps/api/src/features/audit/audit-log.service.ts:15-50`; `apps/api/src/features/audit/audit-log.repository.ts:278-356,444-468`; `apps/api/src/infrastructure/postgres/schema/audit.schema.ts:13-30` |
| background sync audit | contacts/fee queue handler는 audit metadata 없이 `sync()`를 호출하고, survey queue는 `refresh()`에 audit hook이 없다. current DB에서 `.spreadsheet.sync` audit action은 0건이고 queue job 2건은 SUCCEEDED였다. | `apps/api/src/features/contacts/google-contact-sheets.service.ts:28-31,103-112`; `apps/api/src/features/users/google-fee-sheets.service.ts:42-45,137-145`; `apps/api/src/features/surveys/google-survey-sheets.service.ts:32-35,103-164`; current DB aggregate |

### 12.3 S08 findings와 예비 severity

| ID | 현재 확인된 동작 | 보안 영향과 예비 판정 | 상태 |
|---|---|---|---|
| S08-F01 | `GET /contacts`가 인증 없이 연락망 전체 DTO를 반환하고, current HTTP response에 student number·email·phone 등 PII field가 포함됐다. 현재 DB의 4건은 모두 privacy consent 상태다. | 이 endpoint가 공개 조직도 계약이 아니라 관리자 전용 잔여 route라면 비로그인 PII 대량 노출이다. 반대로 consented executive directory가 의도된 public policy라면 허용될 수 있다. **예비 Medium 후보(정책 의존); non-public 또는 consent 철회 data가 노출되면 High로 재평가**. | source + current HTTP; current revoked fixture 없음 |
| S08-F02 | contact create/import는 `privacyConsented=false`를 저장할 수 있고 mutation 뒤 Sheets job을 enqueue한다. queue worker는 service purge 없이 repository `findManaged`를 직접 호출해 false row도 Sheet row로 만든다. current-build harness에서 revoked synthetic row 1건이 written row가 됐다. | privacy withdrawal 이후에도 Google-side copy가 생성·갱신될 수 있어 제3자 외부 egress 및 보존 경계를 우회한다. **예비 High 후보(철회가 external retention 금지를 의미하는 경우); 외부 sharing과 실제 fixture 확인 전까지 Medium/High 경계**. | source + current-build sync harness; live revoked fixture/Google account 없음 |
| S08-F03 | `bulkUpdateStudentFeeStatuses`는 항목별 `updateStudentFeeStatus` transaction을 순차 호출한다. 두 번째 synthetic failure에서 첫 번째 status mutation은 반환·audit·queue enqueue까지 완료된 채 전체 요청은 실패했다. | 재시도나 운영자 복구 시 일부 학생만 변경된 상태가 남아 과비 상태·Sheets snapshot·감사 결과가 요청 단위와 어긋난다. **예비 Medium 후보; batch atomicity가 업무 요구이면 High 쪽으로 재평가**. | source + current-build service harness; live DB failure fixture 없음 |
| S08-F04 | `BulkProcessStudentFeePaymentsSchema`는 동일 payment object 두 건을 허용하고 idempotency key/external reference가 없다. repository는 batch의 각 item마다 새 payment row를 insert하고 summary row를 갱신한다. | timeout 후 동일 요청 재전송 또는 operator double-submit이 원장 event와 누적 paid amount를 중복시킬 수 있다. multiple legitimate payments 정책과 외부 결제 reference가 확인돼야 확정할 수 있다. **예비 Medium 후보; financial entitlement에 직접 영향을 주면 High**. | source + current-build schema harness; current payment rows 0 |
| S08-F05 | authorized contact/fee/audit JSON 및 XLSX response에 `Cache-Control`이 설정되지 않았다. 현재 ephemeral manager HTTP smoke에서 세 endpoint 계열 모두 header가 비어 있었다. | browser/proxy가 student/contact/fee/audit PII response를 보관·재사용할 수 있는 배포 경계가 생긴다. 실제 cache topology와 `Set-Cookie`/private cache 정책 확인 전에는 확정하지 않는다. **예비 Medium 후보**. | current authorized HTTP/header smoke; production cache 미확인 |
| S08-F06 | background contact/fee/survey Sheet sync는 queue job status만 갱신하고 per-sync `AuditLogService.record`를 호출하지 않는다. current DB에는 SUCCEEDED job 2건이 있지만 corresponding `.spreadsheet.sync` action은 0건이다. | PII 외부 동기화와 response export side effect가 actor·시각·대상별 audit trail에서 빠져 사후 추적·철회 확인·incident scope 계산이 불완전해진다. **예비 Medium 후보; 감사가 compliance/control이면 유지, queue table 자체가 충분한 정책이면 Low/observation**. | source + current DB aggregate; external sync not executed |

### 12.4 긍정 통제·정책 관찰·미확인 범위

- fee status와 payment batch는 `MANAGE_FINANCE` route guard와 Zod schema를 사용하고, status update/payment insert는 user/fee row lock을 통해 primary-key 및 기본 concurrent integrity를 방어한다. 다만 전용 PostgreSQL concurrency 3건은 URL 부재로 실행하지 못했다.
- contact manager mutation/export는 `MANAGE_CONTACTS`로 보호되고, contact audit snapshot은 이메일·전화번호·학번을 저장하지 않도록 최소화되어 있다. import max 500, fee payment max 1,000, audit page max 100 같은 입력/페이지 상한이 있다.
- XLSX 결과는 current `xlsx` round-trip에서 formula field가 만들어지지 않았고 Sheets는 `RAW` write 및 protected range를 사용했다. CSV export는 현재 source에서 찾지 못했다. XLSX parser/import와 브라우저 저장은 S09에서 계속한다.
- audit list/export에는 별도 delete route가 없고 export 요청 자체는 현재 smoke에서 기록됐다. 그러나 audit write failure는 mutation을 계속 진행시키며, background sync에는 별도 sync action이 없다. 이 차이가 업무상 허용되는지는 정책 결정이 필요하다.
- public contacts의 PII field가 실제 공개 조직도에 필요한지, privacy consent의 의미가 공개·Google 복사까지 포함하는지, Google Drive folder/share/IAM/token 범위는 S10에서 확인한다.
- fee export/list는 전체 users와 payment rows를 메모리로 구성하고 export는 모든 page를 합친다. 현재 데이터가 작아 availability 영향은 보이지 않았고, 대규모 resource limit은 S13에서 확인한다.

### 12.5 S08 판정

S08의 현재 source review, DB aggregate, public/authorized HTTP 및 cache-header smoke, current-build business harness, Sheets/XLSX checks와 18개 표적 테스트를 1차 완료했다. S08-F01~F06은 공개·외부 egress·finance integrity·cache·audit 정책과 production provider 경계가 열려 있어 예비 severity로 유지한다. 앱·설정·업무 원본 데이터는 수정하지 않았으며, export probe가 남긴 3건의 audit append만 side effect로 기록했다. 이어서 S09의 XSS·입력 검증·주입·브라우저 저장 경계를 1차 검증했다.

## 13. S09 결과 — XSS·입력 검증·주입·브라우저 저장 경계

### 13.1 검증 범위와 방법

- 현재 board/article HTML sanitizer와 service/controller, survey rich-text·answer/definition schema와 validation, site-content controller/service/repository, web RichTextContent/site-content/board/survey/email/auth storage, roadmap importer, Drizzle query 및 API bootstrap을 읽었다. HTML 저장·복원·렌더링, CMS 링크·이미지 scheme, 정규식 sink, 입력 상한, raw query/command/path sink, 로그아웃·계정 전환 시 browser storage를 분리해 추적했다.
- 서버 게시글·FAQ·설문 rich text는 저장 전 공통 sanitizer를 거치고, web RichTextContent는 DOMParser와 별도 tag/attribute/scheme allowlist로 다시 정화한다. 댓글은 HTML renderer가 아니라 React text interpolation으로 출력된다. 반면 site-content의 URL schema는 z.string().url()만 사용해 javascript:, data: 및 ftp: scheme을 거부하지 않으며, public operational content와 hero quick-link는 이 값을 직접 href에 사용한다.
- 현재 DB read-only aggregate에서 content block은 9건 모두 published이고 dangerous link scheme은 0건이었다. survey question은 46건이며 configured answer regex는 0건(최대 길이 0)이었다. public /api/site-content/blocks/public은 200·9건이었고 위험 scheme은 없었다. 실제 업무 데이터와 외부 provider는 수정·호출하지 않았다.
- current-build harness에서 synthetic CMS javascript: link가 schema와 service를 통과해 보존되는 경로, server sanitizer가 script/event/javascript-href/unsafe-image marker를 제거하는 경로, section title·answerRegex·answer array 상한의 부재, (a+)+$ 정규식이 25자 synthetic input에서 약 4.3초 걸리는 경로를 확인했다. 실제 악성 데이터를 DB에 저장하거나 public route를 반복 호출하지 않았다.
- 현재 관련 표적 테스트 31개를 실행했으며 31 pass, 0 fail, 0 skipped였다. git diff --check도 통과했다. 점검 중 애플리케이션·설정·업무 데이터는 변경하지 않았다.

### 13.2 현재 코드·구성 관찰

| 영역 | 현재 확인된 동작 | source evidence |
|---|---|---|
| server rich text | article/FAQ create·update와 survey rich-text mutation은 저장 전에 공통 sanitizer를 적용하고, 50k 수준의 본문 상한을 둔다. sanitizer는 script/event attribute/javascript href와 허용되지 않은 image source를 제거하고 span style을 제한한다. | apps/api/src/features/board/article-html-sanitizer.ts; apps/api/src/features/board/article.service.ts:281-447,488-585; apps/api/src/features/surveys/survey-rich-text.ts |
| client rich text | RichTextContent는 dangerouslySetInnerHTML 직전에 tag·attribute·href·image source·style을 다시 정화한다. 댓글과 일반 title/body는 HTML로 해석하지 않는다. client link의 target/rel 검사는 server보다 느슨하지만 server 저장값과 별도의 defense-in-depth 관찰이다. | apps/web/src/components/ui/rich-text-content.tsx; apps/web/src/components/ui/comment-section.tsx; apps/web/src/features/site-content/public-operational-content.tsx |
| CMS URL | ContentBlock URL schema는 valid URL 여부와 길이만 검사한다. service/repository는 scheme 재검증 없이 보존하고 public operational content와 hero quick-link가 raw href sink가 된다. current live content에는 위험 scheme이 없었다. | shared/contracts/src/schemas.ts:92-111; apps/api/src/features/site-content/site-content.controller.ts; apps/api/src/features/site-content/site-content.service.ts; apps/web/src/features/site-content/public-operational-content.tsx; apps/web/src/components/organisms/hero.tsx |
| regex sink | survey answerRegex는 길이·복잡도·safe-regex 제한 없이 입력되고 publish에서는 syntax compile만 한다. 제출 때마다 new RegExp(question.answerRegex).test(...)가 동기 실행된다. | shared/contracts/src/schemas.ts; apps/api/src/features/surveys/survey-definition-validation.ts; apps/api/src/features/surveys/survey-answer-validation.ts |
| body/input bounds | route별 Zod pipe와 feature schema는 존재하지만 global Zod pipe와 global exception filter는 등록되어 있지 않다. survey title/regex/answers와 article event text/date 등 일부 필드는 상한·형식 검사가 없거나 약하다. roadmap import는 파일·행 상한을 갖지만 invalid-header 경로와 전 기능별 resource limit은 별도 확인 대상이다. | apps/api/src/main.ts; apps/api/src/features/surveys/*; apps/api/src/features/board/article-draft.service.ts; shared/contracts/src/schemas.ts; apps/api/src/features/roadmap/* |
| query/import/command sinks | 현재 조사한 repository query는 Drizzle parameter binding을 사용하고 audit sorting은 allowlist로 제한된다. shell/eval/template sink는 확인하지 못했다. import parser에는 10 MiB 파일 및 5,000행 상한이 있으나 모든 parser와 error/response size 경계는 S13에서 이어간다. | apps/api/src/infrastructure/postgres/**; apps/api/src/features/audit/audit-log.repository.ts; apps/api/src/features/roadmap/* |
| browser storage | auth token/result는 sessionStorage에 있고 return path는 local path만 소비한다. survey authenticated draft는 user ID를 key에 포함하지만 anonymous draft는 브라우저 전체가 공유한다. board draft(draft_<category>), admin bulk-email draft, templates와 일부 UI state는 origin/account namespace 없이 localStorage에 남고 logout은 이를 일괄 삭제하지 않는다. | apps/web/src/lib/auth-storage.ts; apps/web/src/features/survey/use-survey-page-controller.ts; apps/web/src/features/board-write/use-board-write-page-controller.ts; apps/web/src/pages/admin/bulk-email-page.tsx; apps/web/src/layouts/admin-layout.tsx |

### 13.3 S09 findings와 예비 severity

| ID | 현재 확인된 동작 | 보안 영향과 예비 판정 | 상태 |
|---|---|---|---|
| S09-F01 | ContentBlock의 link URL에 scheme allowlist가 없고, MANAGE_SITE_CONTENT 경로에서 저장·게시된 값이 public operational content와 hero quick-link의 <a href>로 직접 전달된다. current-build harness에서 synthetic javascript: 값이 schema와 service를 통과해 보존됐다. | 콘텐츠 관리 권한자 또는 그 계정 탈취자가 방문자에게 same-origin script URL을 제공하는 stored XSS 경로가 된다. current live content에는 위험 scheme이 0건이고 실제 브라우저 marker 실행은 하지 않았으므로 예비 High 후보; trusted-admin-only 운영 정책과 CSP/브라우저 정책 확인 시 Medium hardening으로 재평가한다. | source + current-build schema/service harness + current public HTTP; live dangerous fixture/browser execution 없음 |
| S09-F02 | board local draft, admin bulk-email draft/template, anonymous survey draft가 user ID 또는 계정 namespace 없이 same-origin browser storage에 남는다. logout은 auth/session/query state를 정리하지만 이 draft keys를 지우지 않는다. authenticated survey draft의 user-scoped key는 긍정 통제다. | 공용 브라우저·동일 profile의 계정 전환에서 이전 사용자의 게시글·메일·설문 초안 또는 PII가 다음 사용자에게 복원될 수 있다. 예비 Medium 후보; 공용기기·민감 메일/응답 초안 사용이 실제 정책이면 High로 재평가한다. | source trace; cross-account UI replay와 실제 stored PII fixture 없음 |
| S09-F03 | survey answerRegex에 길이·safe-regex 제한이 없고 publish 시 syntax만 확인한다. 제출 요청의 답변 검증은 해당 pattern을 동기 RegExp.test로 실행한다. current DB에는 regex 문항이 0개지만 synthetic catastrophic-backtracking marker에서 25자 입력 하나가 약 4.3초 걸렸다. | MANAGE_SURVEY 권한자 또는 탈취 계정이 복잡한 pattern을 게시하면 public response traffic이 API event loop를 지연시킬 수 있다. 예비 Medium 후보; 현재 live pattern이 없고 관리자 설정·실제 route amplification이 확인되지 않아 High로 확정하지 않는다. | source + current-build timing harness; live regex fixture/public DoS 검증 없음 |

### 13.4 긍정 통제·정책 관찰·미확인 범위

- server/client rich-text sanitizer와 관련 표적 테스트는 script, event attribute, unsafe image, javascript href marker를 제거했다. 다만 CMS URL은 rich-text sanitizer 경로가 아니라 일반 anchor sink이므로 별도 scheme validation이 필요하다.
- article/FAQ/survey mutation의 명시적 Zod pipe, body/content 상한, roadmap import의 파일·행 상한, Drizzle parameterization과 audit sort allowlist는 긍정 통제다. global Zod pipe와 AllExceptionsFilter는 현재 bootstrap에 등록되지 않아 방어 근거로 계산하지 않았다.
- 댓글은 서버에서 sanitize하지 않지만 현재 web 경로는 React text로 렌더링하고, bulk email content는 발송 전 service sanitizer 경로를 가진다. import·clone·draft restore는 raw 값을 저장할 수 있어 최종 publish/렌더 경계별 재검증을 계속 확인한다.
- auth session/result token은 sessionStorage에 있고 query cache는 logout 후 full reload로 메모리에서 사라진다. anonymous survey draft와 board/email draft는 계정 분리·logout cleanup이 미확인이다. malformed localStorage object가 local UI error를 일으킬 수 있는 경로는 local availability 관찰로 남긴다.
- 현재 조사 범위에서 raw SQL concatenation, shell command, eval 또는 template injection sink는 확인하지 못했다. parser 전체의 압축 해제·응답 크기·timeout·regex 안전성, 실제 브라우저 CSP와 저장소의 cross-account replay는 S10/S13에서 이어간다.
- S09-F01~F03은 현재 데이터에 위험 link/regex가 없어 live exploit impact를 관찰하지 못한 예비 finding이다. 앱·설정·업무 데이터는 수정하지 않았다.

### 13.5 S09 판정

S09의 현재 source review, current DB/public HTTP read-only check, current-build sanitizer/schema/regex/browser-storage harness와 31개 표적 테스트를 1차 완료했다. S09-F01~F03은 각각 CMS anchor scheme, browser draft account boundary, administrator-controlled regex resource consumption의 독립 경계 후보로 기록하며, 실제 정책·fixture·브라우저/운영 증거가 확인되기 전까지 예비 severity로 유지한다. S10 외부 연동 경계까지 이어서 검증했으며, 다음 단계는 S11의 투표·mock/seed·health 노출이다.

## 14. S10 결과 — Google·메일·일정·채널톡 외부 연동

### 14.1 검증 범위와 방법

- 현재 `infrastructure/google`, Google Sheets 연락망·과비·설문 동기화, Google Calendar와 KAIST/ICS/공휴일 fetch, bulk email delivery/queue/retry, auth의 ChannelTalk 설정과 Web provider를 읽었다. OAuth token·service-account key·Drive folder/ACL, SMTP recipient/attachment/idempotency, 외부 응답 timeout/redirect/size, ChannelTalk identity egress를 분리해 추적했다.
- 외부 provider는 호출하지 않았다. 현재 build에 연결한 synthetic fetch/SMTP/repository harness로 메일 외부 성공 뒤 DB 상태 저장 실패, FAILED retry 재발송, BCC 전달, ChannelTalk HMAC/anonymous 분기와 외부 fetch guard 조건을 확인했다. 실제 OAuth grant, Google Drive ACL, SMTP 발송, KAIST/공휴일 provider, 외부 ICS, ChannelTalk SDK network는 미실행이다.
- 현재 non-secret 설정 요약은 `EMAIL_DRY_RUN=true`, bulk-email scheduler disabled, Google Calendar/KAIST sync enabled, external ICS URL count 0, `NODE_ENV=development`였다. OAuth/client·service-account·SMTP/holiday key 파일과 local secret은 존재하지만 값은 기록하지 않았다. 현재 DB에는 calendar event/job, bulk email/template가 0건이고, vote와 무관한 외부 sync queue aggregate는 S08에서 확인한 성공 2건이다.
- Google/SMTP/Calendar/ChannelTalk 관련 표적 테스트는 11 pass, 0 fail, 0 skipped였다. 테스트 fixture와 harness는 실제 account/credential을 사용하지 않았으며, local stack에는 권한 세션 없이 관리자 외부-sync route가 401로 거부되는 것을 확인했다.

### 14.2 현재 코드·구성 관찰

| 영역 | 현재 확인된 동작 | source evidence |
|---|---|---|
| Google Sheets/Drive | OAuth refresh는 client/token file을 읽고 Google token endpoint에 요청하며 access token은 process memory에 cache한다. Drive folder는 Google folder·non-trashed·`canAddChildren`를 확인하고 spreadsheet parent를 operations folder로 정리한다. Sheet write는 `valueInputOption=RAW`, header freeze/protected range를 사용하고 ID/query 값은 encoding/escaping한다. share/ACL grant 코드는 찾지 못했다. | apps/api/src/infrastructure/google/google-sheets.client.ts:86-184,417-505 |
| Google Calendar | service-account JWT scope는 `calendar.events`로 제한되고 API/token timeout은 15초다. ID encoding, ETag/If-Match conflict, deterministic event ID와 queue claim/retry가 있다. KAIST parser는 고정 URL·월별 요청·15초 timeout을 사용하지만 응답 size cap은 없다. | apps/api/src/features/calendar/google-calendar.client.ts:158-268; apps/api/src/features/calendar/calendar-sync.service.ts |
| External ICS/holiday | ICS는 설정된 HTTPS 또는 non-production HTTP URL만 초기 검사하고 `fetch` 기본 redirect를 허용하며 최종 URL을 재검사하지 않는다. 15초 timeout과 ICS 2,000,000-character import limit은 있다. Korean holiday public route는 year/month를 제한하지만 provider fetch에 timeout·response size cap이 없고 API key가 query parameter로 전송된다. 현재 external ICS 목록은 비어 있고 holiday provider는 호출하지 않았다. | apps/api/src/features/calendar/calendar.service.ts:473-520,583-635; apps/api/src/features/calendar/calendar.controller.ts:206-211 |
| SMTP/bulk email | dry-run은 현재 활성이다. 실제 delivery는 recipient를 BCC로 전달하고 attachment 총량/개수와 HTML scheme을 제한한다. `deliver()`가 SMTP 성공 후 DB `updateStatus`를 호출하므로 상태 저장 실패 시 request가 실패/FAILED 처리되고 retry가 다시 SMTP를 호출할 수 있다. personalized mail은 recipient마다 별도 call이다. SMTP `secure`는 config가 false면 평문 transport가 가능하고 `requireTLS` 강제는 없다. | apps/api/src/features/email/email-delivery.service.ts:30-65; apps/api/src/features/email/bulk-email.service.ts:293-330,630-753 |
| ChannelTalk | anonymous에는 plugin key만 주고 authenticated user에는 user ID의 HMAC-SHA256과 name/email profile을 만든다. secret은 response에 넣지 않으며 Web provider는 identity 변경 시 config를 재검증하고 logout/admin route에서 SDK를 shutdown한다. name/email의 SaaS egress 허용 여부는 운영 privacy policy 확인이 필요하다. | apps/api/src/features/auth/auth.service.ts:119-168; apps/web/src/features/channel-talk/channel-talk-provider.tsx:32-85 |

### 14.3 S10 findings와 예비 severity

| ID | 현재 확인된 동작 | 보안 영향과 예비 판정 | 상태 |
|---|---|---|---|
| S10-F01 | bulk email delivery가 외부 SMTP 성공과 DB 상태 갱신을 하나의 원자 경계로 묶지 않는다. synthetic harness에서 첫 SMTP call 뒤 status update failure로 request가 거부/FAILED 처리됐고, 같은 record retry가 두 번째 SMTP call을 수행했다. DB unique idempotency key는 두 번째 record 생성을 막지만 이미 성공한 외부 발송의 재전송은 막지 못한다. | 실제 SMTP가 활성화된 뒤 network/DB 장애 또는 worker 재시도에서 동일 수신자에게 중복 메일이 갈 수 있다. `SEND_BULK_EMAIL` 권한과 현재 dry-run을 고려한 예비 Medium 후보; 자동 retry·업무 중요 메일·대량 수신자 영향이 확인되면 High로 재평가한다. | source + current-build SMTP/repository failure harness; 실제 발송·worker 장애는 미실행 |
| S10-F02 | `CALENDAR_EXTERNAL_ICS_URLS`는 초기 URL protocol만 검사하고 default redirect를 허용하며 redirect 후 최종 URL/host를 재검사하지 않는다. 현재 설정된 source는 0개이고 설정 변경 주체는 deployment/operator 경계로 남아 있다. | untrusted configuration 또는 공격자가 설정을 주입할 수 있는 배포 경계라면 외부 ICS fetch가 내부/비허용 endpoint로 redirect될 SSRF 후보가 된다. 현재 사용자 제어 입력과 실제 provider는 확인되지 않아 예비 Medium/운영 보강으로 유지한다. | source + synthetic fetch guard; current external URL empty, redirect hop/production network 미검증 |
| S10-F03 | public holiday route의 provider `fetch`에 AbortSignal timeout과 response-size bound가 없고 text/JSON/XML parse가 동기 경로에서 수행된다. year/month 범위는 제한되지만 provider stall/large response와 public request amplification에 대한 별도 rate limit은 source에서 확인되지 않았다. | 외부 provider 지연·비정상 응답이 API worker의 대기/메모리 사용을 늘려 availability를 낮출 수 있다. 예비 Medium 후보; 현재 provider 호출과 실제 amplification은 안전상 실행하지 않았다. | source review; current local route reachability only, provider/DoS 검증 없음 |
| S10-F04 | contacts/fee/survey Sheets handler가 PII·fee state·survey answer를 `GOOGLE_OPERATIONS_FOLDER_ID` 아래 외부 spreadsheet로 보낸다. `GOOGLE_SURVEY_RESULTS_FOLDER_ID`는 validation되지만 client path에서는 사용되지 않고, Drive share/ACL을 코드가 설정하지 않는다. | operations folder의 실제 ACL·service-account role·retention이 분리되지 않으면 contact/fee/answer dataset이 의도보다 넓은 Google 사용자에게 노출될 수 있다. 코드만으로 ACL을 확정할 수 없으므로 정책 확인 필요/예비 Medium으로 분류한다. | source + current config presence summary; 실제 Google API/ACL/recipient sharing 미검증 |

### 14.4 긍정 통제·미확인 범위

- Google request는 encoded resource IDs, token timeout, limited error text를 사용하고, Sheet values는 `RAW`로 쓰며 protected range를 유지한다. Google Calendar는 최소 scope(`calendar.events`), timeout, ETag conflict와 deterministic retry를 가진다. 다만 OAuth grant의 실제 scope, token file ownership/rotation, Drive folder sharing/IAM은 외부 증거가 없으므로 안전하다고 판정하지 않았다.
- SMTP는 BCC 사용으로 recipient 주소를 서로에게 노출하지 않았고, current Nodemailer compile harness에서 CRLF subject marker가 단일 sanitized header로 처리됐다. HTML scheme sanitizer, attachment 10개/총량 제한, idempotency unique index, scheduled row claim은 긍정 통제다. 현재 `secure=true` 설정과 dry-run 때문에 평문/실발송 경로는 live로 확인하지 않았으며 TLS certificate/`requireTLS` 운영 정책은 별도 확인이 필요하다.
- ChannelTalk HMAC harness는 authenticated identity hash와 name/email profile, anonymous no-identity, server secret non-return을 확인했다. 실제 SDK egress, provider-side retention/deletion, account logout browser network는 미검증이다.
- ICS는 현재 URL이 비어 있고, holiday/KAIST/Google/SMTP/S3 등 실제 외부 provider 호출과 OAuth/ACL/SMTP grant는 실행하지 않았다. API key·client secret·private key·token 값과 외부 response body는 출력하지 않았다.

### 14.5 S10 판정

S10의 현재 source review, 설정·DB safe summary, 관리자 외부-sync route 401 및 public route/health smoke, current-build provider-boundary harness와 11개 표적 테스트를 1차 완료했다. S10-F01은 외부 발송과 내부 상태의 비원자 경계, S10-F02~F03은 외부 fetch redirect/resource 경계, S10-F04는 Google PII egress와 ACL 정책 경계의 독립 후보다. 실제 provider account·ACL·SMTP 발송·production network가 확인되기 전까지 예비 severity와 운영 미확인을 유지한다. 다음 단계는 S11의 투표 암호·receipt·mock/seed/health 노출 경계다.

## 15. S11 결과 — 투표·개발 기능·노출 경로

### 15.1 검증 범위와 방법

- 현재 `features/votes`, vote contract/schema/crypto/repository/service/controller, `MockModule`, `AppModule`, health service, env validation과 seed를 읽었다. 공개·관리자·인증 제출·receipt/result 경로, eligibility·중복 방지·마감/집계 상태, ballot와 voter의 연결 가능성, production mock/demo seed guard와 health failure 응답을 분리해 확인했다.
- 현재 DB의 vote aggregate는 vote 1건(공개 상태), voter 1건, ballot 0건, tally 0건이었다. public list/detail/invalid receipt는 200, admin/voter list 및 unauthenticated ballot 제출은 401이었다. 실제 ballot·tally·관리자 mutation은 만들지 않았다.
- current build의 vote crypto 표적 테스트 3개를 실행해 key wrap/unwrap, 동일 ballot의 randomized ciphertext/receipt, production dedicated key requirement를 확인했다. 추가 synthetic service harness에서 vote pre-check 뒤 CLOSED 상태로 바뀐 뒤 submit repository가 수락할 수 있는 경계를 재현했고, health harness에서 synthetic dependency error가 raw `message`로 반환되는 것을 확인했다.

### 15.2 현재 코드·구성 관찰

| 영역 | 현재 확인된 동작 | source evidence |
|---|---|---|
| public/admin route | `/votes/public`은 DRAFT가 아닌 vote만 반환하고, `/:id`는 OptionalAuth로 public detail/eligibility를 반환한다. voter list·create/update/delete/publish/close/tally/result publish는 `MANAGE_VOTE`이고 ballot submit은 `AuthGuard` 후 eligibility를 다시 확인한다. receipt verification은 고엔트로피 code의 hash 존재 여부만 public boolean으로 반환한다. | apps/api/src/features/votes/votes.controller.ts:28-139; votes.service.ts:81-118,247-269 |
| vote integrity | vote definition은 item 30개·option 100개·answer 30개/option 100개와 UUID/schema 범위를 갖는다. submit transaction은 해당 `(voteId,userId)` voter row를 `FOR UPDATE`하고 `hasVoted` 확인·ballot insert·voter update를 원자화한다. close/publish/result publish는 상태 조건부 update다. | shared/contracts/src/http/vote.ts:10-78; apps/api/src/features/votes/votes.repository.ts:234-250,253-284 |
| ballot secrecy/key | ballot row에는 vote ID·ciphertext·IV·authTag·receiptHash만 있고 user ID/FK는 없다. vote별 random key를 master key로 wrap하며 production에서는 `VOTE_BALLOT_ENCRYPTION_KEY`가 없으면 service construction을 거부한다. voter snapshot에는 name/student number/email/major/status가 저장되고 manager-only voter route로 반환된다. | apps/api/src/infrastructure/postgres/schema/vote.schema.ts:75-107; apps/api/src/features/votes/vote-crypto.service.ts:15-49; votes.repository.ts:141-178 |
| health | `/health`는 인증 없이 Postgres/Redis latency와 status를 반환한다. dependency 실패 시 `error.message`를 `message` field로 그대로 반환하며, 정상 local response는 200/ok였다. | apps/api/src/main.ts:35-37; apps/api/src/features/health/health.service.ts:25-79 |
| mock/seed profile | MockModule은 `process.env.NODE_ENV !== production`일 때만 module metadata에 포함되고 greeting은 Redis counter와 DB time을 읽는다. 그러나 selection은 ConfigModule의 `.env` loading 전에 평가되므로 process env가 비어 있으면 production-like `.env`만으로도 mock module이 포함된다. production Compose/Dockerfile은 NODE_ENV를 명시하고, seed는 production에서 demo mode를 거부한다. `ENABLE_MOCK_AUTH`는 현재 source에서 참조되지 않는다. | apps/api/src/app.module.ts:28-61; apps/api/src/features/mock/mock.controller.ts:5-12; apps/api/drizzle/seed.ts:3285-3305; apps/api/Dockerfile.prod:25-30; infra/docker/compose.prod.yml:8-24 |

### 15.3 S11 findings와 예비 severity

| ID | 현재 확인된 동작 | 보안 영향과 예비 판정 | 상태 |
|---|---|---|---|
| S11-F01 | `VotesService.submit`은 vote 상태·기간을 먼저 확인하지만, 실제 `VotesRepository.submitBallot` transaction은 voter row만 lock하고 vote 상태/마감 시각을 재확인하지 않는다. synthetic harness에서 pre-check는 PUBLISHED였고 그 뒤 CLOSED로 바뀐 상태에서도 submit repository가 수락했다. | 마감 동시 요청 또는 의도적으로 지연된 제출이 마감 후 ballot으로 기록될 수 있어 투표 기간 무결성이 약화된다. 허용할 in-flight request semantics가 확인되지 않은 상태의 예비 Medium 후보; 실제 격리 PostgreSQL에서 close/submit 순서와 business cutoff가 확인되면 확정/재평가한다. | source + synthetic race harness; persistent DB concurrency/real request race 미실행 |
| S11-F02 | public health failure branch가 Postgres/Redis exception의 `message`를 JSON으로 반환한다. synthetic error detail이 그대로 response field에 나타났고 정상 상태에서는 latency만 노출된다. | 외부 비인증 caller가 DB/Redis host·port·driver detail 등 내부 진단 정보를 수집할 수 있는 정보 노출/availability 관찰이다. 현재 synthetic 값 외 실제 provider error와 secret 포함 여부를 확인하지 않았으므로 예비 Low 후보(보강)로 둔다. | source + failure harness; 실제 dependency failure/provider message 미검증 |
| S11-F03 | MockModule이 production Compose/Dockerfile에서는 제외되지만, module selection이 `process.env.NODE_ENV`를 ConfigModule `.env` load 전에 평가한다. unset process env build harness에서는 MockModule이 등록됐다. mock route 자체는 일반 greeting/counter/DB time만 반환한다. | Compose/Dockerfile 외 production launcher가 `.env`의 NODE_ENV만 의존하면 `/v1/mock/greeting`이 의도치 않게 공개되고 Redis counter/DB reachability를 추가한다. 현재 repository의 production path는 명시적으로 production을 설정하므로 예비 Low/배포 보강 후보이며 active production vulnerability로 확정하지 않는다. | source + current-build AppModule metadata harness; production launcher/runtime 미검증 |

### 15.4 긍정 통제·미확인 범위

- Vote controller의 admin route permission과 ballot AuthGuard, service-level DRAFT/public/result/eligibility checks가 분리되어 있다. current anonymous route smoke에서 admin/voter/ballot path는 401이고 public detail은 `LOGIN_REQUIRED`를 포함한 metadata만 반환했다.
- `submitBallot`의 voter row lock과 transaction, `(voteId,userId)` primary key, `hasVoted` 조건, receipt hash unique index는 중복 제출 방어다. ballot persistence에 user ID/FK가 없고 AES-256-GCM과 random IV를 사용하지만, DB operator가 voter snapshot/ballot timing/log를 결합할 수 있는 운영 threat와 key rotation/backup 접근은 이번 단계에서 검증하지 않았다.
- publish는 DRAFT 상태 조건과 transaction 안의 voter snapshot/ballot key 저장을 사용하고, result는 tally 존재 및 `resultsPublishedAt` 또는 manager permission이 필요하다. 다만 tally 저장과 vote status update는 별도 SQL 문장이어서 failure recovery는 S13에서 확인한다.
- vote schema에는 vote/item/option/answer count·length와 UUID validation이 있다. public result/receipt brute-force rate limit, actual published result fixture, isolated PostgreSQL close/submit race, production seed execution과 launcher가 없는 상태에서의 mock exposure는 미확인이다.
- health와 mock에는 현재 정상 요청 외 dependency outage 검증이 없으며, application·설정·업무 데이터는 변경하지 않았다.

### 15.5 S11 판정

S11의 현재 vote source/schema/crypto, seed/module profile, public/admin/ballot HTTP smoke, current DB aggregate, vote crypto 3개 테스트와 synthetic close/submit·health/module harness를 1차 완료했다. S11-F01은 투표 cutoff 재확인 부재, S11-F02는 health raw diagnostic, S11-F03은 launcher-dependent mock registration의 독립 후보로 기록한다. 실제 ballot fixture·격리 DB concurrency·production launcher/health failure 증거가 확인되기 전까지 예비 severity를 유지한다. 다음은 S12의 비밀정보·공급망·컨테이너·CI 점검이다.

## 16. S12 결과 — 비밀정보·공급망·컨테이너·CI

### 16.1 실행 범위와 증거

- 현재 lockfile/package manifest, API/Web Dockerfile, 기본·production Compose, Nginx/ignore 파일, Git 이력, GitHub Actions workflow를 읽고 `pnpm audit --prod --json` 및 전체 `pnpm audit --json`을 2026-09-08 현재 registry에 질의했다. `audit --fix`, dependency update, secret rotation, 실제 자격증명 시험 호출은 하지 않았다.
- `pnpm audit --prod --json`은 exit 1로 종료됐고 runtime dependency advisory는 4건(Moderate 4, High 0, Critical 0)이었다. `sanitize-html` 2.17.6은 2.17.7 이상, `@tiptap/core` 3.26.1은 3.30.4 이상, `qs` 6.15.3은 advisory별로 6.15.4 또는 6.16.0 이상이 패치 기준이다. 설치 버전과 API/Web의 실제 import·사용 경로를 대조했으며, advisory 자체를 exploit 성공으로 확대하지 않았다.
- 전체 audit은 17건(High 9, Moderate 6, Low 2, Critical 0)이었다. esbuild/Vite/Babel/brace-expansion/browserslist 등 개발·빌드 경로 advisory는 현재 production HTTP 경로와 분리해 관찰 항목으로 두었다. Web final image는 정적 Nginx이고, production API image는 build stage의 `node_modules`를 복사하므로 image minimization 관점의 hardening은 별도 기록한다.
- tracked `.env`, `secrets/**`, PEM/key 경로는 확인되지 않았고 `.gitignore`/`.dockerignore`도 local env와 secrets를 제외한다. 그러나 현재 무시된 로컬 `.env`와 `secrets`에는 AWS/Google/SMTP/SSO/holiday/ChannelTalk 관련 runtime credential material이 존재한다. 값은 출력·기록하지 않았고, 실제 유효성·노출 이력·폐기/rotation은 확인하지 않았다. Git 이력의 현재 스캔 marker와 민감 경로에서는 tracked secret 증거를 찾지 못했다.
- lifecycle script는 별도 확인되지 않았고 root `pnpm.onlyBuiltDependencies`는 `esbuild`, `@nestjs/core`로 제한되어 있다. SheetJS 0.20.3은 CDN tarball URL에서 설치되며 lockfile resolution에 registry integrity line이 없어 registry audit 범위 밖의 source pinning 관찰로 기록한다.
- production Compose는 PostgreSQL/Redis host port를 publish하지 않고 API는 host port를 publish하지 않는다. 반면 API final image는 명시적 `USER` 없이 기본 사용자로 실행되고, `read_only`, `cap_drop`, digest pinning 근거가 없으며 build stage의 `node_modules`를 그대로 복사한다. CI는 frozen lock install과 lint/typecheck/test/build, read-only contents permission을 수행하지만 전용 secret scan·container scan·배포 보호의 실행 증거는 없다. 현재 container scanner(Trivy/Grype/Docker Scout/Syft)는 설치돼 있지 않아 OS/image CVE 결과는 미검증이다.

### 16.2 S12 findings와 예비 severity

| ID | 현재 확인된 동작 | 보안 영향과 예비 판정 | 상태 |
|---|---|---|---|
| S12-F01 | 현재 무시된 로컬 `.env`와 `secrets` 파일에 runtime credential material이 있다. 파일은 Git 추적 대상이 아니고 Docker build context에서도 제외되지만, host/backup/CI 작업공간 접근자가 값을 읽을 수 있는지와 실제 rotation 상태는 확인되지 않았다. | 활성 자격증명이라면 AWS·Google·SMTP·SSO·외부 연동 접근으로 이어질 수 있다. 저장소 유출은 확인되지 않은 운영 위생·노출 범위 문제이며, 실제 운영값이거나 외부 노출 이력이 있으면 예비 High 운영 조치로 평가한다. 값 자체는 이번 보고서에 남기지 않는다. | 현재 파일 존재 확인; tracked/이력 유출·유효성·rotation 미확인 |
| S12-F02 | API runtime dependency인 `sanitize-html` 2.17.6이 현재 advisory의 영향 버전이다. 서버 rich-text/email sanitization 경로에서 사용되며 자체 allowlist가 있지만, 설치 버전은 패치 기준보다 낮다. | 알려진 SVG/URI scheme-policy bypass 계열 stored XSS advisory에 대한 수정 필요. 현재 설정과 입력 도달 경로를 함께 고려한 예비 Moderate; exploitability는 별도 재현·패치 후 검증이 필요하다. | 설치 버전·사용 경로·registry advisory 확인; exploit 미검증 |
| S12-F03 | Web production bundle에 포함되는 `@tiptap/core` 3.26.1이 advisory 영향 버전이다. editor가 서버/초안 content를 `setContent`로 복원하고 server/client sanitizer가 별도로 존재한다. | `mergeAttributes`의 `__proto__` DOM attribute 처리 advisory가 알려져 있어 editor runtime 업데이트가 필요하다. 현재 sanitizer/브라우저 경로가 known payload를 차단하는지는 미검증인 예비 Moderate다. | 설치 버전·browser 사용 경로·registry advisory 확인; exploit 미검증 |
| S12-F04 | Express/body-parser를 통해 API runtime에 들어오는 transitive `qs` 6.15.3이 array-limit bypass 및 isBuffer DoS advisory 영향 버전이다. | URL-encoded query/body와 parser 옵션이 실제 advisory 조건에 도달하는지 route별 확인이 필요하다. public parser resource consumption 위험의 예비 Moderate; 현재 서비스에서 exploit/DoS는 재현하지 않았다. | transitive path·registry advisory 확인; 도달성·DoS 미검증 |
| S12-F05 | SheetJS 0.20.3을 `cdn.sheetjs.com` tarball URL로 설치하고 lockfile resolution에 registry integrity line이 없다. `pnpm audit`의 registry advisory만으로 이 source를 검증할 수 없다. | upstream/CDN 변조 또는 공급망 신뢰 경계가 registry package보다 약하게 검증될 수 있다. 현재 변조는 확인하지 못한 source pinning/무결성 보강 후보로 예비 Low/Medium이다. | 현재 lock/source 확인; CDN·upstream 무결성·재현성 미검증 |
| S12-F06 | production API image가 명시적 non-root `USER` 없이 실행되고, build stage `node_modules`를 final image에 복사한다. Compose/Dockerfile에 read-only filesystem, capability drop, image digest pinning 근거가 없다. | application/container compromise 시 권한·도구·변경 가능 범위가 커질 수 있다. 현재 exploit은 없고, production hardening 및 image minimization의 예비 Low/Medium 보강 항목이다. | 현재 Dockerfile/Compose 정적 확인; runtime effective user·OS CVE 미검증 |

### 16.3 S12 관찰 항목과 반례

- `pnpm audit`의 개발/빌드 advisory 17건 중 runtime 직접 경로로 분류하지 않은 항목은 production에 dev server가 노출됐다는 뜻이 아니다. 다만 API final image의 dev dependency 복사와 CI/build input은 배포 hardening 관점에서 남는다.
- `.gitignore`와 `.dockerignore`는 현재 local secret 파일의 tracked/build-context 유입을 막고, Git history scan에서도 이번 marker 기준 증거가 없었다. 이는 host/backup/CI 접근 통제나 외부 rotation이 완료됐다는 증거가 아니다.
- production Compose의 data service host-port 차단은 기본 dev Compose의 API/Web/Postgres 공개 포트와 구분된다. 실제 cloud firewall, registry provenance, image scanning, secret manager와 backup 접근은 repository 밖이다.

### 16.4 S12 판정

S12의 현재 registry audit, lock/source, local secret/path/history, Docker/Compose, CI 정적 검토를 완료했다. 네 runtime advisory는 설치 버전상 수정 우선순위가 있으나 애플리케이션 exploit 성공으로 확정하지 않았고, local credential material은 저장소 추적 유출과 실제 유효성·rotation을 분리했다. S12-F01~F06은 수정 또는 운영 확인이 필요한 예비 항목으로 기록한다. 다음은 S13의 자원 제한·장애/복구·복제 경계다.

## 17. S13 결과 — 자원 제한·운영 실패·복구

### 17.1 실행 범위와 현재 증거

- `main.ts`에는 명시적 JSON/urlencoded parser limit, request timeout 또는 global rate-limit middleware가 없고, 현재 Nginx는 `/api/`에 `client_max_body_size 21m`만 설정한다. multipart asset은 20 MiB, roadmap import는 10 MiB, ICS body는 2,000,000자 상한을 갖지만, 이 상한이 모든 JSON/배열·응답에 공통 적용되지는 않는다.
- 현재 코드에는 게시글·댓글·관리 사용자·감사 로그 목록의 페이지/limit 상한이 다수 있지만, 공개 calendar range는 최대 370일 동안 세 종류의 전체 결과를 읽고, calendar search는 전체 결과를 만든 뒤 100개로 자른다. public survey list와 관리자 survey response/with-answers는 pagination 없이 전체 row/answer를 반환한다. audit/fee export는 page 100/1,000 단위로 끝까지 모아 XLSX buffer를 한 번에 만든다.
- `SubmitResponseSchema.answers`, `ArticleAssetsSchema`, bulk email `content`, email recipient query result에는 해당 경로의 명시적 cardinality/content max가 없다. personalized bulk email은 recipient마다 `Promise.all`로 SMTP 호출을 만들고, S3 object read는 stream chunks를 끝까지 Buffer로 합친다. 현재 fixture가 작다는 사실은 대규모 입력의 한도를 증명하지 않는다.
- Postgres pool은 `max: 10`, idle 30초, connection timeout 5초다. Redis는 `maxRetriesPerRequest: 1`, `enableOfflineQueue: true`이고 앱 코드에서 command timeout을 별도로 지정하지 않는다. Redis 설정은 AOF를 켜고 `maxmemory`/eviction cap을 지정하지 않아 `maxmemory=0`, `maxmemory-policy=noeviction`으로 확인됐다.
- Google Sheets queue와 Calendar queue는 DB claim을 사용하지만 두 구현 모두 10분 stale lock을 `PENDING`으로 되돌린다. Calendar scheduler/queue는 1분·daily cron, Sheets queue는 10초 cron이다. Asset cleanup과 bulk-email scheduler는 process-local `setInterval`/in-progress flag다. 현재 `.env`에서는 asset cleanup과 bulk-email scheduler가 false이고, 현재 DB queue 상태는 calendar 144건·Sheets 2건 모두 `SUCCEEDED`다.
- 실행 중 기본 dev stack은 API/Web/Postgres host port가 publish되고 Nginx는 loopback 8080에만 publish된다. `docker inspect`에서 current dev services의 memory/CPU/PID limits는 모두 0이었다. production Compose는 data/API를 `expose`로 두지만, backup/restore job, backup encryption/retention, key/session/attachment recovery procedure, RPO/RTO를 입증하는 repository evidence는 찾지 못했다.
- read-only smoke는 health 200, 큰 query `limit`을 준 articles/search 200, calendar search/range 200, 잘못된 holiday range 400이었다. 서비스 중단·Redis/Postgres 재시작·실제 부하·외부 provider failure·복원은 현재 사용 중인 stack과 데이터를 보존하기 위해 실행하지 않았다. 별도 unreachable Redis client harness는 retry를 끈 상태에서 오류를 반환했지만 현재 앱의 재접속/트래픽 조건을 대표하지 않는다.

### 17.2 S13 findings와 예비 severity

| ID | 현재 확인된 동작 | 보안 영향과 예비 판정 | 상태 |
|---|---|---|---|
| S13-F01 | public calendar/survey 및 관리자 survey response/with-answers, S3 read, audit/fee export는 데이터 전체 또는 큰 집합을 메모리에 materialize한다. `answers`, article assets, email content/recipients 같은 입력도 route별 명시적 cardinality/content max가 일관되지 않다. 현재 파일·본문 상한과 일부 pagination은 존재하지만 global invariant는 없다. | 공격자 또는 권한 있는 호출자가 큰 dataset/반복 요청으로 DB connection·heap·CPU를 소모시켜 availability를 낮출 수 있다. 현재 fixture와 단일 smoke에서는 장애가 재현되지 않은 예비 Medium; public volume·manager 권한·실제 heap profile에 따라 High로 재평가한다. | source + current smoke; load/stress·large fixture 미실행 |
| S13-F02 | global rate limit이 package/source에서 확인되지 않았고 Nginx에는 `limit_req`, proxy connect/read/send timeout이 없다. 앱은 explicit body parser/request timeout을 설정하지 않으며, 기본 dev Compose에서는 API 3000/Web 5173/Postgres 5432가 host publish된다. production Compose는 이 포트를 publish하지 않는 별도 경로다. | public auth/search/calendar/survey/health 및 upload 경계에 반복 요청·slow client·parser workload가 누적될 수 있다. 외부 WAF/ingress가 보완하는지 미확인인 배포·availability 보강 후보로 예비 Low/Medium; production route와 실제 rate/timeout 정책 확인 시 확정한다. | source + header/smoke; external WAF/load/proxy behavior 미검증 |
| S13-F03 | Sheets/Calendar processing은 replica마다 cron이 실행되고 10분 stale lock을 되돌린다. Calendar `processJob`의 완료/실패 update는 job id 중심이며 reclaimed claim의 revision/current-lock을 확인하지 않는다. Asset cleanup의 running flag는 process-local이다. 외부 API 지연이 lock window를 넘거나 여러 replica가 실행되면 동일 external side effect/last-write race가 가능하다. | Google Calendar/Sheets 중복 write, stale worker의 상태 덮어쓰기, cleanup 중복 실행으로 업무 데이터/외부 동기화 일관성이 약화될 수 있다. 현재 prod replica 수와 provider 지연은 미확인이고 current jobs는 성공 상태이므로 예비 Medium; 비멱등 external operation 또는 실제 multi-replica deployment면 High로 재평가한다. | source + current queue aggregate; multi-replica/provider delay/lock expiry 미실행 |
| S13-F04 | Redis는 AOF를 사용하지만 maxmemory cap이 없고, Postgres/Redis/uploads는 Compose volume에 의존한다. repository에는 `pg_dump`/restore, backup encryption/retention, restore drill, session·attachment·application encryption key recovery evidence가 없다. | 저장소 장애·디스크 고갈·잘못된 volume/backup 복구 시 데이터 유실 또는 인증/첨부 복구 불능을 탐지·회복하지 못할 운영 위험이다. 코드 취약점으로 확정하지 않는 예비 Medium 운영 확인 항목이며 실제 backup provider/복원 정책 확인 전에는 RPO/RTO를 판정하지 않는다. | source/volume/config review; backup provider·restore drill 미확인 |

### 17.3 보호 코드와 한계

- asset/roadmap multipart와 Nginx body cap, calendar range/year/month validation, article/comment/user/audit page cap, fee/contact/reorder array cap, queue attempt/backoff, DB pool connection timeout, healthcheck/restart/log rotation은 확인된 보호 코드다.
- 이 보호 코드가 global rate limiting, stream backpressure, response-size cap, bounded export, distributed lease, backup restore 검증을 대신하지는 않는다. S10의 external fetch timeout/size 및 S10-F01의 SMTP/DB 비원자 경계는 S13에서 중복 finding으로 세지 않고 관련 자원·복구 전제로만 교차 참조한다.

### 17.4 S13 판정

S13의 route/resource cap, process/queue retry, DB/Redis pool, current Compose/Nginx limits, current queue state와 backup/restore evidence review를 완료했다. 정상 smoke와 현재 작은 fixture는 통과했지만 실제 부하·의존성 중단·multi-replica·백업 복원은 실행하지 않았다. S13-F01~F04는 availability/운영 복구 측면의 예비 항목으로 기록하고, S14에서 S01 route/non-HTTP mapping 및 S02-S13 findings를 최종 reconciliation한다.

## 18. S14 결과 — 누락·중복 정리와 최종 판정

### 18.1 범위와 route/non-HTTP reconciliation

- `SECURITY_AUDIT_SCOPE_2026-09-08.md`의 HTTP matrix는 1번부터 196번까지 연속이며, 각 행에 input/transport, auth/permission, object boundary, 반환·side effect, 후속 S 번호, current source path가 있다. route follow-up은 S02-S11로 표시되어 있고, S12/S13의 공급망·자원·운영 통제는 route별 항목이 아닌 cross-cutting 경계로 결과 문서에 연결했다.
- 비HTTP 작업 표 13개(scheduler, queue, CLI, seed, import/export, storage, external egress)는 모두 최소 하나 이상의 S02-S13으로 매핑됐고 미매핑 행은 없었다. Google/Calendar queue와 asset/email scheduler는 route 표와 별도로 중복 실행·복구를 평가했다.
- 43개 unique finding ID(S02-F01~S13-F04)가 결과 표에 존재한다. 현재 데이터 fixture가 없다는 이유로 후보를 닫지 않았고, 실제 provider/production/WAF/backup 증거가 없다는 이유로 확정 severity로 올리지 않았다.

### 18.2 중복·원인 경계 정리

| 관계 | 최종 처리 |
|---|---|
| S02-F05 URL bearer 노출과 S04 access-log marker | 같은 URL credential 노출 원인의 증거 보강으로 유지하며 별도 finding으로 세지 않음 |
| S05-F02 secret article 댓글과 S06-F01 secret article asset | 같은 privacy 전제지만 댓글 read/write와 file-byte read라는 독립 sink이므로 분리 유지 |
| S06-F02 direct-upload quota/size와 S13-F01/F02 resource/rate | S06은 S3 object boundary, S13은 공통 availability/limit control이므로 분리 유지 |
| S09-F03 regex CPU와 S10-F03 holiday provider, S13-F01/F02 | 각각 admin-controlled regex, 외부 provider response, 공통 resource control로 공격 전제가 달라 분리 유지. S13은 S10을 duplicate로 세지 않음 |
| S10-F01 SMTP/DB non-atomic retry와 S13-F03 stale worker | 전자는 delivery 상태·재발송, 후자는 queue fencing·replica 중복이므로 분리 유지 |
| S12-F06 container hardening과 S13-F02/F04 | image privilege/minimization, ingress/resource limit, backup/recovery가 서로 다른 통제라 분리 유지 |

### 18.3 최종 분류와 우선순위

| 분류 | 항목 | 최종 의미 |
|---|---|---|
| advisory 영향 버전 — 수정 우선 | S12-F02~F04 | 현재 lock/install version과 registry advisory가 일치한다. 애플리케이션 exploit 성공은 미검증이지만 패치와 동일 경로 회귀 테스트가 필요하다. |
| High 재검증 우선 후보 | S02-F04~F05, S03-F01, S05-F01~F02, S06-F01, S07-F02~F03, S08-F02, S09-F01, S10-F01, S12-F01, S13-F03 | 로그인 CSRF, 권한 위임, secret/privacy asset·comment, 외부 발송, 자격증명, multi-replica side effect가 실제 production 정책·fixture·배포 전제에서 성립하는지 먼저 확인한다. 현재 exploit/production impact까지 확정된 High는 없다. |
| Medium 또는 Low 보강 후보 | S02-F01~F03, S03-F02, S04-F01~F02, S05-F03, S06-F02, S07-F01, S08-F01, S08-F03~F06, S09-F02~F03, S10-F02~F03, S11-F01~F02, S12-F05~F06, S13-F01~F02 | 코드·설정에서 방어 공백 또는 조건부 영향은 확인됐지만, 실제 외부 노출·업무 정책·부하·provider/launcher 조건이 닫히지 않은 예비 항목이다. |
| 정책·운영 확인 필요 | S04-F01, S05-F01~F02, S07-F01/F03, S08-F01/F02/F06, S10-F02/F04, S11-F03, S12-F01/F05/F06, S13-F02/F03/F04 | ACL, anonymity, public directory, secret/attachment policy, secret rotation, CDN/image provenance, replica count, WAF, backup/restore의 외부 증거가 있어야 final status를 정할 수 있다. |

위 표의 분류는 서로 배타적인 severity 확정표가 아니라 실행 순서다. 예를 들어 S03-F01은 High 후보이면서 권한 위임 정책 확인 필요 항목이고, S10-F01은 SMTP가 활성화되고 retry가 허용될 때만 영향이 커진다. `S11-F03`은 현재 production Compose/Dockerfile에서 MockModule이 제외되므로 active production finding이 아닌 launcher hardening 항목으로 유지한다. `S13-F04`는 코드 취약점이 아니라 backup/restore evidence 부재다.

### 18.4 권장 조치 순서

1. `sanitize-html`, `@tiptap/core`, `qs`를 패치 기준 이상으로 올리고 rich-text/editor/parser 회귀 테스트와 `pnpm audit --prod` 재검증을 수행한다.
2. 현재 local `.env`·`secrets`가 실제 운영 또는 재사용 credential인지 운영자가 확인하고, 활성값이거나 노출 이력이 있으면 외부 rotation/revocation과 host/backup/CI 접근 검토를 별도로 완료한다. 이번 점검에서는 값을 시험하거나 rotation하지 않았다.
3. secret article/comment/asset, survey answer asset의 canonical field/ownership/privacy gate와 public PII/anonymous author DTO를 공통 policy로 정하고 실패 재현 테스트를 추가한다.
4. body/array/response/export/stream/cardinality 상한, public endpoint rate limit·timeout, distributed queue lease/fencing, SMTP idempotency와 duplicate delivery 회복을 공통 운영 기준으로 고정한다.
5. CDN tarball provenance/integrity, non-root/minimal/digest-pinned image, CI secret/dependency/container scan, PostgreSQL/Redis/asset backup encryption·retention·restore drill을 운영 증거로 남긴다.

### 18.5 남은 미검증 범위와 최종 판단

- 외부 TLS terminator/WAF/rate limit/cache, 실제 `.env.production`과 cloud firewall/secret manager, S3 IAM/bucket/object public policy, Google Drive ACL/retention, SMTP/OAuth/holiday/ICS/ChannelTalk provider는 확인하지 않았다.
- 실제 browser login CSRF·query history/referrer, production multi-replica stale lock, dependency exploit payload, large-fixture/load/slow-client, Postgres/Redis outage 및 backup restore는 실행하지 않았다. 전용 survey/fee PostgreSQL concurrency 테스트 일부는 URL 부재로 skip된 baseline을 그대로 기록한다.
- 따라서 현재 점검에서 exploit path와 production impact까지 검증된 Critical/High 애플리케이션 finding은 0건으로 유지한다. 다만 S12-F02~F04는 설치 버전상 advisory 영향이 확인된 수정 우선 항목이고, 위의 High 재검증 후보·운영 조치는 release 전에 닫아야 한다. 이 보고서는 “전체 안전” 또는 release approval/production security attestation이 아니다.

### 18.6 S14 완료

S14의 route/non-HTTP coverage, finding 중복, 보호 코드·반례, severity/운영 의존성, 우선순위와 미검증 범위를 정리했다. S00-S14 점검 산출물은 현재 checkout 기준으로 완료됐으며, 실제 코드 수정·secret rotation·deployment/backup 조치는 사용자 요청과 운영 권한이 별도 필요한 S15 이후 작업이다.

## 19. 다음 실행 순서

1. S15: 사용자 수정 요청 이후 finding별 원인 제거·회귀 테스트·재검증

S02-S13 severity는 외부 SSO/browser/proxy/production logging, 실제 fixture/provider/ACL, 격리 DB/production launcher, 업무 정책, load/failure/restore evidence가 확인되기 전의 예비 판정이다. 현재 문서는 release approval 또는 production security attestation이 아니다.
