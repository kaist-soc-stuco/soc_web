# SOC Web 보안 점검 범위·위협 모델 (S00/S01/S02/S03/S04/S05/S06/S07/S08/S09/S10/S11/S12/S13/S14)

- 작성일: 2026-09-08 (Asia/Seoul)
- 기준 revision: 13c4b9d0c039362bf32b0c8d08ede8370ca9842d (main, Implement mobile board and search flows)
- 상태: S00 기준 버전·현재 동작·실행 환경, S01 위협 모델·API 권한 표, S02 인증 경로, S03 권한·객체 경계·관리자 bootstrap 1차 검증, S04 프록시·쿠키·CORS/CSRF·보안 헤더·로그 경계 1차 검증, S05 게시판·댓글·초안·검색·알림 개인정보 경계 1차 검증, S06 업로드·다운로드·S3 직접 업로드 경계 1차 검증, S07 설문 자격·응답·편집·집계 경계 1차 검증, S08 과비·연락망·내보내기·감사 로그 경계 1차 검증, S09 XSS·입력 검증·주입·브라우저 저장 경계 1차 검증, S10 Google·메일·일정·채널톡 외부 연동 경계 1차 검증, S11 투표·개발 기능·health 노출 경계 1차 검증, S12 비밀정보·공급망·컨테이너·CI 1차 검증, S13 자원 제한·운영 실패·복구 1차 검증, S14 누락·중복 정리·최종 판정을 완료했다. S02-S14 결과와 예비 finding은 결과 문서에 기록했으며, S15는 사용자 수정 요청 이후에만 진행한다.
- 판정 원칙: 현재 checkout의 코드·설정·테스트·실제 로컬 요청만 사용한다. 과거 제품 요구사항, 과거 보안 감사, 과거 Gate/완료 문서는 판단 근거에서 제외했다.
- 변경 범위: 애플리케이션·설정·배포·사용자·역할·권한·콘텐츠·자산 데이터는 변경하지 않았다. S04의 유효 세션 없는 로그아웃 헤더 probe와 S08의 연락망·과비·감사 export probe가 append-only audit 경로를 호출해 audit log가 151건에서 154건으로 늘어난 side effect는 별도로 남긴다. 사용자가 이미 작업 중인 변경은 보존했다.
- 증거 형식: 아래의 path:line은 현재 checkout의 소스 근거다. S00/S01 관찰은 범위·위협 모델 근거로 유지하고, S02-S12의 검증 결과와 예비 severity는 SECURITY_AUDIT_RESULTS_2026-09-08.md에 분리했다.

## 1. S00 기준 버전과 변경 상태

### 1.1 Git 상태

현재 작업 트리에서 확인한 변경은 다음과 같다. 이 점검에서는 어느 파일도 되돌리거나 덮어쓰지 않았다.

| 상태 | 경로 |
|---|---|
| M | apps/web/src/components/organisms/rich-text-editor.tsx |
| M | apps/web/src/components/ui/attachment-list.tsx |
| M | apps/web/src/components/ui/comment-section.tsx |
| M | apps/web/src/components/ui/rich-text-content.tsx |
| M | apps/web/src/features/board-detail/board-detail-sections.tsx |
| M | apps/web/src/features/board-write/board-write-form-sections.tsx |
| M | apps/web/src/features/board-write/use-board-write-page-controller.ts |
| M | apps/web/src/pages/board-detail-page.tsx |
| M | apps/web/src/pages/board-edit-page.tsx |
| M | apps/web/src/pages/board-write-page.tsx |
| M | apps/web/src/styles.css |
| M | docs/MOBILE_DESIGN_DIRECTION_2026-09-07.md |
| ?? | docs/MOBILE_RESPONSIVE_PLAN_2026-09-07.md |
| ?? | docs/SECURITY_AUDIT_PLAN_2026-09-08.md |
| ?? | docs/SECURITY_AUDIT_RESULTS_2026-09-08.md |
| ?? | docs/SECURITY_AUDIT_SCOPE_2026-09-08.md |

현재 branch는 main이며 HEAD는 위 revision이다. 첫 번째 표의 Web 변경은 사용자의 작업으로 보존했고, 기존 실행 계획은 입력 기준으로 유지했으며 범위·결과 문서는 이번 점검 산출물로 갱신했다.

### 1.2 도구와 실행 환경

| 항목 | 확인값 |
|---|---|
| Node | v25.6.1 |
| pnpm | 11.1.2 |
| Docker | 29.6.2 |
| Docker Compose | v5.3.1 |
| Compose services | postgres, redis, db-migrate, api, web, nginx |
| .env.production | 없음 |
| 현재 기본 .env profile | NODE_ENV=development, SEED_MODE=demo |
| 현재 asset provider | s3 |
| 현재 calendar sync flags | GOOGLE_CALENDAR_SYNC_ENABLED=true, KAIST_CALENDAR_SYNC_ENABLED=true |
| 현재 email profile | EMAIL_DRY_RUN=true, BULK_EMAIL_SCHEDULER_ENABLED=false |
| 현재 asset cleanup | ASSET_ORPHAN_CLEANUP_ENABLED=false |
| 현재 local stack | 이미 실행 중인 Compose stack을 관찰함. 테스트용으로 재구성하거나 격리하지 않음 |
| read-only request | http://localhost:8080/health GET → HTTP 200 |

현재 .env와 secrets 파일의 값은 문서·터미널·로그에 출력하지 않았다. 비밀값 자체, 외부 계정, 실제 메일·Google·S3 호출은 점검 근거로 사용하지 않았다.

### 1.3 기본 품질 검사

| 명령 | 결과 | 해석 |
|---|---|---|
| pnpm build:shared | PASS | contracts, common, api-client build |
| secret pattern scan | PASS | `.env.example` 변수명/placeholder 4건만 매칭; 실제 값은 출력·판정 근거로 사용하지 않음 |
| S02 in-process auth harness | PASS | local SSO callback stub, concurrent refresh/consent, result-token one-time consumption, revoked-session access-token check |
| S03 permission/object harness | PASS | permission guard semantics, all current permission IDs through role service, role/member cache invalidation, inactive-user session revocation, DTO server-field stripping |
| S03 current-stack route/object checks | PASS | 12 admin route permission matrix; cross-survey section/question and cross-article comment IDs returned 404; no persistent fixture mutation |
| S03 public roadmap visibility check | CANDIDATE | public service returns repository admin dataset and would return `isVisible=false` course; current DB hidden-course count was 0, so current-row disclosure was not observed |
| S04 proxy/cookie/header HTTP checks | CANDIDATE | Nginx `nginx -t` PASS; injected upstream HTTPS marker was overwritten at HTTP Nginx and clear cookies lacked `Secure`; front response had four security headers but no CSP/HSTS |
| S04 CORS/CSRF HTTP checks | CANDIDATE | exact configured Origin received ACAO; sibling/null/disallowed origins did not; disallowed-origin logout POST still reached handler with HTTP 201, so CORS is not CSRF rejection |
| S04 access-log marker | CONFIRMED SINK | current Nginx access log contained a non-secret query marker; this strengthens S02-F05 and is not counted as a duplicate finding |
| Redis GETDEL smoke | PASS | running Redis: PING, ephemeral SET EX, GETDEL, post-GETDEL missing |
| auth HTTP smoke | PASS | existing local stack: anonymous session 200, me 401, refresh without token 400, logout without session 201, admin boards anonymous 401 |
| pnpm lint | PASS | API ESLint, Web UI unit contract 및 ESLint |
| pnpm typecheck | PASS | shared, API, Web |
| pnpm test | PASS | API 120개 중 107 pass, 0 fail, 13 skipped; Web 35 pass, 0 fail |
| pnpm build | PASS | 전체 workspace build. not-found-page chunk 경고와 500 kB 초과 chunk 경고가 남음 |
| pnpm audit --prod --json | CANDIDATE | 현재 registry 기준 runtime advisory 4건(Moderate 4, High/Critical 0); 설치 버전·전이 경로·사용 위치를 대조 |
| pnpm audit --json | CANDIDATE / LIMITATION | 전체 advisory 17건(High 9, Moderate 6, Low 2, Critical 0); 개발/빌드 경로와 CDN tarball·container OS 미포함을 분리 |
| secret/path/history scan | PASS / OPERATIONAL ACTION | tracked `.env`/`secrets/**`/key path 없음, ignore 규칙 적용. 현재 ignored local credential material 존재, rotation/유효성은 미확인 |
| Docker/Compose/CI review | CANDIDATE / LIMITATION | production data host-port 차단은 확인했지만 API image root/non-minimal runtime 및 전용 secret/container scan 증거 미확인 |
| isolated Postgres/Redis, route matrix HTTP test | 미실행 | 현재 실행 중인 개발 stack은 격리 검증 환경이 아님 |
| external SSO, Google, SMTP, S3, KAIST/holiday API | 미실행 | 실제 외부 시스템·실제 자격 증명을 사용하지 않음 |

13개 skipped 테스트는 student fee 및 survey response PostgreSQL 동시성/locking 시나리오다. 따라서 현재 테스트 통과는 동시성 안전성, 배포 경계, 외부 egress 안전성의 증명이 아니다.

### 1.4 과거 문서 제외

이번 점검에서 읽고 기준으로 삼은 문서는 현재 요청의 실행 계획인 docs/SECURITY_AUDIT_PLAN_2026-09-08.md뿐이다. 그 밖의 docs 아래 과거 방향서·요구사항·감사·완료 기록은 검색·대조·승계하지 않았다. generated dist 산출물도 소스 근거에서 제외했다. 저장소 루트에서 AGENTS.md와 SECURITY.md는 확인되지 않았으므로 별도 repository policy는 없고, 실행 계획과 현재 코드/설정/테스트가 이번 점검의 적용 기준이다.

## 2. 현재 런타임·웹 경로·설정

### 2.1 실제 모듈 등록

apps/api/src/app.module.ts:30-61 기준으로 ScheduleModule, ConfigModule, PostgresModule, RedisModule, GoogleModule, AuthModule, AssetModule, BoardModule, UsersHttpModule, SurveysModule, ContactsModule, BulkEmailModule, CalendarModule, AuditLogHttpModule, SiteContentModule, NotificationsModule, VotesModule, RoadmapModule, RoleGroupsModule, HealthModule이 등록된다. MockModule은 process.env.NODE_ENV가 production이 아닐 때만 devOnlyModules로 등록된다(app.module.ts:28-29, 61).

- API bootstrap은 Nest app을 만들고 trust proxy를 1로 설정한다(main.ts:10-15).
- CORS는 CORS_ORIGIN allowlist와 credentials=true를 사용한다(main.ts:17-27).
- cookieParser가 설치되고, global ZodValidationPipe 설치 코드는 주석 상태다(main.ts:29-33).
- 전역 prefix는 v1이고 GET health만 제외된다(main.ts:35-37).
- 현재 controller 파일은 24개, HTTP route decorator는 196개다. 아래 S01 표는 이 196개를 모두 열거한다.
- Web은 public/login/board/survey/vote/user/admin 경로를 App.tsx:201-294에서 등록하고, AdminLayout이 client-side permission gate를 추가하지만 server guard/service가 권위 있는 통제다.

### 2.2 기본 Compose와 Nginx

| 경계/자원 | 현재 코드·설정상 유효한 값 | 근거 |
|---|---|---|
| Browser → Nginx | /api/는 /v1/로 rewrite, /health는 API로 직접 proxy, /는 Web으로 proxy | infra/docker/nginx/web.conf:12-36 |
| Nginx listen | container 80; 기본 Compose host binding은 loopback의 NGINX_PORT 또는 8080 | compose.yml:96-107 |
| API host port | 기본 Compose는 API_PORT 또는 3000으로 host publish | compose.yml:18-19 |
| Web host port | 기본 Compose는 WEB_PORT 또는 5173으로 host publish | compose.yml:47-48 |
| PostgreSQL host port | 기본 Compose는 POSTGRES_PORT 또는 5432로 host publish | compose.yml:53-60 |
| Redis | 기본 Compose에서는 host ports를 publish하지 않지만 Redis 설정은 0.0.0.0:6379 bind | compose.yml:89-94, infra/docker/redis/redis.conf:1-4 |
| API → data | POSTGRES_HOST=postgres, REDIS_URL=redis://redis:6379, upload dir bind mount | compose.yml:10-21 |
| production claim | infra/docker/compose.prod.yml은 별도 stack이며 .env.production이 현재 checkout에 없음 | infra/docker/compose.prod.yml:1-154 |

Nginx는 nosniff, SAMEORIGIN, strict-origin-when-cross-origin, camera/microphone/geolocation 차단 header를 설정한다(infra/docker/nginx/web.conf:7-10). 실제 인터넷 TLS 종료, WAF, rate limit, access log, proxy hop 수와 방화벽은 repository에서 확인되지 않았다.

### 2.3 현재 .env의 기능 profile

| 설정 | 현재 값 또는 안전한 요약 | 보안 영향 |
|---|---|---|
| NODE_ENV / SEED_MODE | development / demo | MockModule 및 demo seed 경로의 경계. production 배포의 유효값은 미확인 |
| ENABLE_MOCK_AUTH | true | 현재 source는 이 flag가 아니라 NODE_ENV로 MockModule을 선택한다(app.module.ts:28-29). mock controller에는 greeting route만 존재 |
| API/Web/Nginx | 3000 / 5173 / 8080 | API/Web/Postgres host publish와 함께 로컬 stack의 직접 노출 경계 |
| VITE_API_BASE_URL / CORS_ORIGIN | /api / http://localhost:8080 | Browser base path와 credentialed CORS allowlist |
| ASSET_STORAGE_PROVIDER | s3 | S3 bucket/IAM/public-access/lifecycle은 외부 미확인 |
| ASSET_ORPHAN_CLEANUP_ENABLED | false | 현재 자동 orphan cleanup 비활성 |
| GOOGLE_CALENDAR_SYNC_ENABLED / KAIST_CALENDAR_SYNC_ENABLED | true / true | calendar background path와 외부 egress 대상 |
| EMAIL_DRY_RUN / BULK_EMAIL_SCHEDULER_ENABLED | true / false | 현재 SMTP delivery/polling은 config상 비활성. production override 미확인 |
| secrets | Google service account, OAuth client/token 파일 3개가 secrets/에 존재하고 Compose에서 read-only bind | 파일 내용·권한·Google scope/Drive sharing 미확인 |

정확한 secret, password, token, API key, bucket/ID는 scope 문서와 로그에 기록하지 않았다. 현재 .env key 위치는 .env:1-79에서 확인했고 값은 비밀 여부에 따라 생략했다.

## 3. 데이터·신뢰 경계·테스트 주체

### 3.1 보호 대상

1. persisted session, refresh/access token, temporary survey bearer, pending-login record, JWT/encryption keys
2. KAIST identity PII: student number, name, email, mobile, major, department, academic status, gender, identity code
3. fee/payment status와 payment evidence
4. survey definition, eligibility, responses, free text/date/time answers, uploaded answer files
5. articles, comments, drafts, anonymous-author identity, official/private content, site content, roadmap, calendar and attachments
6. vote voter roll, encrypted ballots, receipt hashes/codes, tally and published results
7. PostgreSQL, Redis, asset store, audit logs, background-job state
8. SSO, Google, SMTP, S3, calendar provider credentials and external copies of PII

### 3.2 신뢰 경계

| 경계 | 들어오는 값 | 나가는 값/보호 대상 | 핵심 근거 |
|---|---|---|---|
| 인터넷/Browser → Nginx | URL, cookie, bearer, body, multipart, forwarded request | API/Web 요청 | infra/docker/nginx/web.conf:12-36 |
| Nginx → API/Web container | rewritten path, proxy headers, cookies | Nest route, React app | web.conf:15-21, 30-36 |
| API → PostgreSQL | user IDs, content, PII, permissions, job state | DB rows, audit, locks | app.module.ts:43-60, postgres provider |
| API → Redis | sessions, permissions cache, pending login | token/session state, Redis persistence | redis provider, redis.conf:1-4 |
| API → local/S3 assets | upload metadata, object key, file bytes | article/survey/site files | asset.storage.ts:72-321 |
| API → external providers | SSO code, Google tokens/data, calendar requests, SMTP message | provider-side identity/content/PII | auth.service.ts, calendar clients, Google sheet handlers, email delivery |
| Actor class boundaries | anonymous, temporary bearer, persisted session, permissioned admin | identity, capability mask, object ownership | auth.guard.ts:22-68, optional-auth.guard.ts:17-66, require-permissions.decorator.ts:20-70 |

### 3.3 테스트 주체와 계정 조합

후속 S02-S13에서 다음 actor matrix를 사용한다.

| 주체 | 기대 capability |
|---|---|
| anonymous | public visibility와 public discovery만 |
| temporary session | 허용된 survey access/submit 경로만; persisted account/admin 기능 없음 |
| normal user A/B | 자기 object와 board policy 범위만; 서로의 data 접근 금지 |
| single-permission admin | 해당 permission bit의 기능만 |
| official response/content admin | WRITE_REPLY, MANAGE_SITE_CONTENT 등 부여된 기능만 |
| inactive/revoked/expired | 기존 cookie/bearer가 거부되거나 무해한 anonymous 처리 |
| superadmin | 전체 관리자 기능. bootstrap/role mutation 및 self-lockout 검증 필요 |
| compromised infrastructure actor | 애플리케이션 guard를 우회할 수 있는 별도 out-of-scope/high-impact 가정. DB/Redis/S3/IAM 접근은 운영 검증으로 분리 |

## 4. S01 공통 인증·권한 모델

### 4.1 Permission registry

shared/contracts/src/permissions-registry.ts:13-29, 52-158의 현재 registry는 다음 15개 bit를 정의한다.

| permission | bit |
|---|---:|
| WRITE_OFFICIAL | 1 |
| WRITE_LAB | 2 |
| WRITE_REPLY | 4 |
| MANAGE_SURVEY | 8 |
| MANAGE_FINANCE | 16 |
| MANAGE_SITE_CONTENT | 32 |
| MANAGE_CALENDAR | 64 |
| MANAGE_CONTACTS | 128 |
| MANAGE_USERS | 256 |
| MODERATE_CONTENT | 512 |
| MANAGE_BOARDS | 1024 |
| SEND_BULK_EMAIL | 2048 |
| VIEW_AUDIT_LOG | 4096 |
| MANAGE_ROLES | 8192 |
| MANAGE_VOTE | 32768 |

Permissions.has는 필요한 모든 bit를 AND로 검사하고, hasAny는 하나라도 OR로 검사한다(permissions-registry.ts:219-230). 기본 authenticated permission은 WRITE_LAB이다(permissions-registry.ts:263-264).

### 4.2 Guard와 token

- AuthGuard는 soc_session_id cookie를 찾아 Redis session을 읽고 persisted mode, userId, revoked/expiry, active user를 확인한 뒤 permission bitmask를 다시 계산한다(auth.guard.ts:22-68).
- OptionalAuthGuard는 cookie가 없으면 Authorization bearer를 temporary access token으로 시도하고, invalid/expired optional credential은 anonymous로 처리한다(optional-auth.guard.ts:17-66).
- RequirePermissions는 AuthGuard와 PermissionBitsGuard를 함께 설치하고 required bits를 AND 검사한다(require-permissions.decorator.ts:20-70).
- auth-cookie.service.ts:12-66은 httpOnly, path /, SameSite=Lax를 사용하며 secure는 request.secure에 의존한다.
- auth.tokens.ts:9-20에서 access 30분, refresh 30일, temporary access 10분 정책을 정의한다.
- Web의 temporary access, pending-login, return path는 sessionStorage를 사용하고(auth-storage.ts:1-68), shared API client는 credentials include 및 401 refresh를 사용한다(core.ts:177-425).
- 전역 AuthGuard/PermissionBitsGuard는 bootstrap에 설치되지 않는다. 따라서 각 controller decorator와 service/repository object check가 route coverage의 핵심 통제다. 이것은 현재 구조 관찰이며, 누락 route 여부는 전체 표와 후속 S03에서 검증한다.
- global ZodValidationPipe가 주석 처리되어 있으므로 compile-time DTO만으로 runtime validation을 가정하지 않는다(main.ts:29-33). handler/service별 검증을 S09까지 독립 확인한다.

### 4.3 주요 현재 통제와 후속 검증

| 영역 | 현재 보이는 통제 | 후속 확인 |
|---|---|---|
| board/article/comment | visibility, board write scope, owner/moderator, composite parent checks, soft delete, HTML sanitization | 타 object ID 교차 입력, anonymous-author/official response 범위, 검색/숨김 우회 |
| asset | 20 MiB, MIME allowlist, S3 key/HeadObject, local path containment, article/survey/uploader access | direct upload race, object public ACL, SVG/active content, orphan deletion, S3 policy |
| survey | published/open/close/eligibility/fee checks, answer validation, response ownership, row locks | temporary token isolation, private analytics, file answer access, skipped concurrency tests |
| vote | AES-GCM ballot/key wrapping, hashed receipt, publication gate | voter-roll access, receipt linkability, ballot user FK/metadata, key separation |
| role/user/finance | permission decorator, role cache invalidation, self/admin route split, finance permission | stale permission/revocation race, self-lockout, cross-user mutation, exports; S03 role ceiling/bootstrap result |
| external/background | Google queue claim/retry, calendar/email/asset schedules, audit context | PII minimization, duplicate workers, retry leakage, failure atomicity |
| proxy/cookie/CORS/logging | one-hop proxy trust, request-aware cookie `Secure`, exact configured CORS origin, SameSite=Lax, four Nginx security headers | outer TLS scheme preservation, server-side CSRF/origin validation, direct published-port bypass, CSP/HSTS, query-token log redaction/cache policy |
| diagnostic/dev | health public, mock module non-production, default demo seed, host port publishes | error disclosure, production profile drift, remote reachability, seed exposure |

## 5. S01 API route matrix

### 5.1 표기

아래 표의 각 행은 controller decorator에서 자동 집계한 실제 route 하나다. endpoint는 Nginx를 통과하면 /v1 prefix가 붙고, GET /health만 prefix가 없다.

- G: public = guard 없음, A = AuthGuard, O = OptionalAuthGuard, P(X) = RequirePermissions(X), resolver = token/cookie/pending flow를 service가 해석
- B: 공개/visibility = public service policy, self = 현재 사용자 자신의 object, owner/mod = owner 또는 moderation policy, perm = permission이 주는 기능 범위 + 대상 object validation, resource = parent/asset/survey eligibility policy
- 입력에는 path parameter ID와 query/body/file 유무를 적었다.
- R/W는 반환 또는 side effect의 성격을 요약한다. PII, answer, file, ballot, secret은 민감도가 높은 데이터다.
- S는 주된 후속 security workstream이다. 이 표는 S02-S14 결과가 반영되기 전의 범위·가설 표다.

### 5.2 전체 196개 route

+| # | endpoint | input IDs/transport | G | B | R/W 및 민감 데이터 | S | source evidence |
|---:|---|---|---|---|---|---|---|
| 1 | GET /v1/assets/:assetId/content | path: assetId; query optional | public | public/article/site/uploader/survey resource check | R:file bytes and headers; asset access audit | S06 | apps/api/src/features/asset/asset.controller.ts:77 |
| 2 | POST /v1/assets/upload | path: none; multipart file | A | authenticated actor; self/resource policy | W:asset metadata/object; uploader ownership | S06 | apps/api/src/features/asset/asset.controller.ts:104 |
| 3 | POST /v1/assets/presign | path: none; body | A | authenticated actor; self/resource policy | W:asset metadata/object; uploader ownership | S06 | apps/api/src/features/asset/asset.controller.ts:141 |
| 4 | POST /v1/assets/complete | path: none; body | A | authenticated actor; self/resource policy | W:asset metadata/object; uploader ownership | S06 | apps/api/src/features/asset/asset.controller.ts:172 |
| 5 | POST /v1/assets/cleanup-orphans | path: none; body | P(MANAGE_SITE_CONTENT) | permission-scoped; service must validate target/parent | W:asset storage/DB cleanup or migration; audit | S06 | apps/api/src/features/asset/asset.controller.ts:195 |
| 6 | POST /v1/assets/migrate-local | path: none; body | P(MANAGE_SITE_CONTENT) | permission-scoped; service must validate target/parent | W:asset storage/DB cleanup or migration; audit | S06 | apps/api/src/features/asset/asset.controller.ts:201 |
| 7 | GET /v1/audit-logs | path: none; query optional | P(VIEW_AUDIT_LOG) | permission-scoped; service must validate target/parent | R:audit actor/target/action/payload/IP; XLSX export | S08 | apps/api/src/features/audit/audit-log.controller.ts:20 |
| 8 | GET /v1/audit-logs/export.xlsx | path: none; query optional | P(VIEW_AUDIT_LOG) | permission-scoped; service must validate target/parent | R:audit actor/target/action/payload/IP; XLSX export | S08 | apps/api/src/features/audit/audit-log.controller.ts:48 |
| 9 | GET /v1/auth/login/start | path: none; query optional | public | token/cookie/pending-login state boundary | R/redirect:SSO state and provider URL | S02/S04 | apps/api/src/features/auth/auth.controller.ts:53 |
| 10 | GET /v1/auth/channel-talk | path: none; query optional | O | token/cookie/pending-login state boundary | R/W:auth state and identity | S02/S04 | apps/api/src/features/auth/auth.controller.ts:58 |
| 11 | POST /v1/auth/login | path: none; body | public | token/cookie/pending-login state boundary | W:pending login, session and auth cookies | S02/S04 | apps/api/src/features/auth/auth.controller.ts:67 |
| 12 | GET /v1/auth/login/result | path: none; query optional | public | token/cookie/pending-login state boundary | R:login result/status token | S02/S04 | apps/api/src/features/auth/auth.controller.ts:88 |
| 13 | POST /v1/auth/login/consent | path: none; body | pending-token | token/cookie/pending-login state boundary | W:consent, user creation/update and persisted session | S02/S04 | apps/api/src/features/auth/auth.controller.ts:116 |
| 14 | GET /v1/auth/session | path: none; query optional | resolver | token/cookie/pending-login state boundary | R:current session/user identity and permission | S02/S04 | apps/api/src/features/auth/auth.controller.ts:157 |
| 15 | GET /v1/auth/me | path: none; query optional | resolver | token/cookie/pending-login state boundary | R:current session/user identity and permission | S02/S04 | apps/api/src/features/auth/auth.controller.ts:172 |
| 16 | POST /v1/auth/refresh | path: none; body | resolver | token/cookie/pending-login state boundary | W:refresh rotation and access cookie | S02/S04 | apps/api/src/features/auth/auth.controller.ts:185 |
| 17 | POST /v1/auth/logout | path: none; body | resolver | token/cookie/pending-login state boundary | W:session revoke/cookie clear | S02/S04 | apps/api/src/features/auth/auth.controller.ts:210 |
| 18 | GET /v1/drafts | path: none; query optional | A | self draft ownership | R/W:draft body, assets and owner state | S05 | apps/api/src/features/board/article-draft.controller.ts:38 |
| 19 | GET /v1/drafts/:draftId | path: draftId; query optional | A | self draft ownership | R/W:draft body, assets and owner state | S05 | apps/api/src/features/board/article-draft.controller.ts:52 |
| 20 | POST /v1/drafts | path: none; body | A | self draft ownership | R/W:draft body, assets and owner state | S05 | apps/api/src/features/board/article-draft.controller.ts:60 |
| 21 | POST /v1/drafts/:draftId | path: draftId; body | A | self draft ownership | R/W:draft body, assets and owner state | S05 | apps/api/src/features/board/article-draft.controller.ts:73 |
| 22 | DELETE /v1/drafts/:draftId | path: draftId; body | A | self draft ownership | R/W:draft body, assets and owner state | S05 | apps/api/src/features/board/article-draft.controller.ts:87 |
| 23 | GET /v1/articles | path: none; query optional | public | public/service visibility policy | R:public/search article metadata and snippets | S05 | apps/api/src/features/board/article-search.controller.ts:21 |
| 24 | GET /v1/articles/search | path: none; query optional | public | public/service visibility policy | R:public/search article metadata and snippets | S05 | apps/api/src/features/board/article-search.controller.ts:49 |
| 25 | GET /v1/boards/:code/articles | path: none; query optional | public | public/service visibility policy | R:article body, author/visibility, comments/assets | S05 | apps/api/src/features/board/article.controller.ts:54 |
| 26 | GET /v1/boards/:code/articles/moderation/hidden | path: none; query optional | A | authenticated + owner/board/moderation policy | R:article body, author/visibility, comments/assets | S05 | apps/api/src/features/board/article.controller.ts:78 |
| 27 | GET /v1/boards/:code/articles/:articleId | path: articleId; query optional | public | public/service visibility policy | R:article body, author/visibility, comments/assets | S05 | apps/api/src/features/board/article.controller.ts:87 |
| 28 | POST /v1/boards/:code/articles | path: none; body | A | authenticated + owner/board/moderation policy | R/W:article body/assets/visibility/status; audit | S05 | apps/api/src/features/board/article.controller.ts:106 |
| 29 | PATCH /v1/boards/:code/articles/:articleId | path: articleId; body | A | authenticated + owner/board/moderation policy | R/W:article body/assets/visibility/status; audit | S05 | apps/api/src/features/board/article.controller.ts:116 |
| 30 | DELETE /v1/boards/:code/articles/:articleId | path: articleId; body | A | authenticated + owner/board/moderation policy | R/W:article body/assets/visibility/status; audit | S05 | apps/api/src/features/board/article.controller.ts:132 |
| 31 | PATCH /v1/boards/:code/articles/admin/reorder | path: none; body | A | authenticated + owner/board/moderation policy | R/W:article body/assets/visibility/status; audit | S05 | apps/api/src/features/board/article.controller.ts:142 |
| 32 | POST /v1/boards/:code/articles/admin | path: none; body | A | authenticated + owner/board/moderation policy | R/W:article body/assets/visibility/status; audit | S05 | apps/api/src/features/board/article.controller.ts:151 |
| 33 | PATCH /v1/boards/:code/articles/:articleId/admin | path: articleId; body | A | authenticated + owner/board/moderation policy | R/W:article body/assets/visibility/status; audit | S05 | apps/api/src/features/board/article.controller.ts:160 |
| 34 | DELETE /v1/boards/:code/articles/:articleId/admin | path: articleId; body | A | authenticated + owner/board/moderation policy | R/W:article body/assets/visibility/status; audit | S05 | apps/api/src/features/board/article.controller.ts:170 |
| 35 | POST /v1/boards/:code/articles/:articleId/hide | path: articleId; body | A | authenticated + owner/board/moderation policy | W:article moderation state | S05 | apps/api/src/features/board/article.controller.ts:179 |
| 36 | POST /v1/boards/:code/articles/:articleId/restore | path: articleId; body | A | authenticated + owner/board/moderation policy | W:article moderation state | S05 | apps/api/src/features/board/article.controller.ts:190 |
| 37 | GET /v1/boards/:code/articles/:articleId/anonymous-author | path: articleId; query optional | A | authenticated + owner/board/moderation policy | R:sensitive anonymous author identity; audit | S05 | apps/api/src/features/board/article.controller.ts:200 |
| 38 | PUT /v1/boards/:code/articles/:articleId/engagements/:kind | path: articleId, kind; body | A | authenticated + owner/board/moderation policy | W:article engagement | S05 | apps/api/src/features/board/article.controller.ts:210 |
| 39 | DELETE /v1/boards/:code/articles/:articleId/engagements/:kind | path: articleId, kind; body | A | authenticated + owner/board/moderation policy | W:article engagement | S05 | apps/api/src/features/board/article.controller.ts:227 |
| 40 | GET /v1/boards | path: none; query optional | public | public/service visibility policy | R:board metadata and read/write scope | S05 | apps/api/src/features/board/board.controller.ts:38 |
| 41 | GET /v1/boards/admin | path: none; query optional | P(MANAGE_BOARDS) | permission-scoped; service must validate target/parent | R:board metadata and read/write scope | S05 | apps/api/src/features/board/board.controller.ts:43 |
| 42 | POST /v1/boards | path: none; body | P(MANAGE_BOARDS) | permission-scoped; service must validate target/parent | W:board config/order/delete; audit | S05 | apps/api/src/features/board/board.controller.ts:49 |
| 43 | PATCH /v1/boards/admin/order | path: none; body | P(MANAGE_BOARDS) | permission-scoped; service must validate target/parent | W:board config/order/delete; audit | S05 | apps/api/src/features/board/board.controller.ts:58 |
| 44 | GET /v1/boards/:code | path: code; query optional | public | public/service visibility policy | R:board metadata and read/write scope | S05 | apps/api/src/features/board/board.controller.ts:67 |
| 45 | PATCH /v1/boards/:code | path: code; body | P(MANAGE_BOARDS) | permission-scoped; service must validate target/parent | W:board config/order/delete; audit | S05 | apps/api/src/features/board/board.controller.ts:72 |
| 46 | DELETE /v1/boards/:code/permanent | path: code; body | P(MANAGE_BOARDS) | permission-scoped; service must validate target/parent | W:board config/order/delete; audit | S05 | apps/api/src/features/board/board.controller.ts:82 |
| 47 | DELETE /v1/boards/:code | path: code; body | P(MANAGE_BOARDS) | permission-scoped; service must validate target/parent | W:board config/order/delete; audit | S05 | apps/api/src/features/board/board.controller.ts:93 |
| 48 | GET /v1/comment-moderation/hidden | path: none; query optional | A | authenticated + owner/board/moderation policy | R:hidden comments and moderation data | S05 | apps/api/src/features/board/comment-moderation.controller.ts:16 |
| 49 | GET /v1/boards/:code/articles/:articleId/comments | path: none; query optional | public | public/service visibility policy | R:scoped comments and author display | S05 | apps/api/src/features/board/comment.controller.ts:54 |
| 50 | POST /v1/boards/:code/articles/:articleId/comments | path: none; body | A | authenticated + owner/board/moderation policy | R:scoped comments and author display | S05 | apps/api/src/features/board/comment.controller.ts:75 |
| 51 | PATCH /v1/boards/:code/articles/:articleId/comments/:commentId | path: commentId; body | A | authenticated + owner/board/moderation policy | R/W:comment body, ownership, notifications and audit | S05 | apps/api/src/features/board/comment.controller.ts:91 |
| 52 | DELETE /v1/boards/:code/articles/:articleId/comments/:commentId | path: commentId; body | A | authenticated + owner/board/moderation policy | R/W:comment body, ownership, notifications and audit | S05 | apps/api/src/features/board/comment.controller.ts:109 |
| 53 | POST /v1/boards/:code/articles/:articleId/comments/:commentId/hide | path: commentId; body | A | authenticated + owner/board/moderation policy | W:comment moderation state | S05 | apps/api/src/features/board/comment.controller.ts:125 |
| 54 | POST /v1/boards/:code/articles/:articleId/comments/:commentId/restore | path: commentId; body | A | authenticated + owner/board/moderation policy | W:comment moderation state | S05 | apps/api/src/features/board/comment.controller.ts:137 |
| 55 | PUT /v1/boards/:code/articles/:articleId/comments/:commentId/engagements/:kind | path: commentId, kind; body | A | authenticated + owner/board/moderation policy | W:comment engagement | S05 | apps/api/src/features/board/comment.controller.ts:148 |
| 56 | DELETE /v1/boards/:code/articles/:articleId/comments/:commentId/engagements/:kind | path: commentId, kind; body | A | authenticated + owner/board/moderation policy | W:comment engagement | S05 | apps/api/src/features/board/comment.controller.ts:167 |
| 57 | GET /v1/calendar/events | path: none; query optional | public | public/service visibility policy | R:public calendar/holiday data | S10 | apps/api/src/features/calendar/calendar.controller.ts:51 |
| 58 | GET /v1/calendar/search | path: none; query optional | public | public/service visibility policy | R:public calendar/holiday data | S10 | apps/api/src/features/calendar/calendar.controller.ts:72 |
| 59 | GET /v1/calendar/manual | path: none; query optional | P(MANAGE_CALENDAR) | permission-scoped; service must validate target/parent | R:admin/manual calendar data | S10 | apps/api/src/features/calendar/calendar.controller.ts:80 |
| 60 | GET /v1/calendar/admin/events | path: none; query optional | P(MANAGE_CALENDAR) | permission-scoped; service must validate target/parent | R:admin/manual calendar data | S10 | apps/api/src/features/calendar/calendar.controller.ts:86 |
| 61 | PATCH /v1/calendar/admin/events/:id/presentation | path: id; body | P(MANAGE_CALENDAR) | permission-scoped; service must validate target/parent | R/W:calendar event/presentation data; audit | S10 | apps/api/src/features/calendar/calendar.controller.ts:92 |
| 62 | GET /v1/calendar/manual/export | path: none; query optional | P(MANAGE_CALENDAR) | permission-scoped; service must validate target/parent | R:ICS calendar export | S10 | apps/api/src/features/calendar/calendar.controller.ts:108 |
| 63 | POST /v1/calendar/manual | path: none; body | P(MANAGE_CALENDAR) | permission-scoped; service must validate target/parent | R/W:calendar event/presentation data; audit | S10 | apps/api/src/features/calendar/calendar.controller.ts:116 |
| 64 | POST /v1/calendar/manual/sync-external | path: none; body | P(MANAGE_CALENDAR) | permission-scoped; service must validate target/parent | W:external fetch/import and calendar DB | S10 | apps/api/src/features/calendar/calendar.controller.ts:130 |
| 65 | POST /v1/calendar/manual/sync-kaist | path: none; body | P(MANAGE_CALENDAR) | permission-scoped; service must validate target/parent | W:external fetch/import and calendar DB | S10 | apps/api/src/features/calendar/calendar.controller.ts:141 |
| 66 | POST /v1/calendar/manual/sync-google | path: none; body | P(MANAGE_CALENDAR) | permission-scoped; service must validate target/parent | W:external fetch/import and calendar DB | S10 | apps/api/src/features/calendar/calendar.controller.ts:157 |
| 67 | POST /v1/calendar/manual/import | path: none; body | P(MANAGE_CALENDAR) | permission-scoped; service must validate target/parent | W:external fetch/import and calendar DB | S10 | apps/api/src/features/calendar/calendar.controller.ts:165 |
| 68 | PATCH /v1/calendar/manual/:id | path: id; body | P(MANAGE_CALENDAR) | permission-scoped; service must validate target/parent | R/W:calendar event/presentation data; audit | S10 | apps/api/src/features/calendar/calendar.controller.ts:179 |
| 69 | DELETE /v1/calendar/manual/:id | path: id; body | P(MANAGE_CALENDAR) | permission-scoped; service must validate target/parent | W:calendar delete | S10 | apps/api/src/features/calendar/calendar.controller.ts:194 |
| 70 | GET /v1/calendar/holidays | path: none; query optional | public | public/service visibility policy | R:public calendar/holiday data | S10 | apps/api/src/features/calendar/calendar.controller.ts:206 |
| 71 | GET /v1/contacts | path: none; query optional | public | public contact-directory policy | R:PII contact directory (name, student no, email, phone, consent) | S08 | apps/api/src/features/contacts/contacts.controller.ts:44 |
| 72 | GET /v1/contacts/departments | path: none; query optional | public | public contact-directory policy | R:PII contact directory (name, student no, email, phone, consent) | S08 | apps/api/src/features/contacts/contacts.controller.ts:50 |
| 73 | GET /v1/contacts/manage/export.xlsx | path: none; query optional | P(MANAGE_CONTACTS) | permission-scoped; service must validate target/parent | R:PII export/Google Sheet | S08 | apps/api/src/features/contacts/contacts.controller.ts:55 |
| 74 | GET /v1/contacts/manage/departments | path: none; query optional | P(MANAGE_CONTACTS) | permission-scoped; service must validate target/parent | R:managed contacts/departments/portal-member PII | S08 | apps/api/src/features/contacts/contacts.controller.ts:97 |
| 75 | GET /v1/contacts/portal-members | path: none; query optional | P(MANAGE_CONTACTS) | permission-scoped; service must validate target/parent | R:managed contacts/departments/portal-member PII | S08 | apps/api/src/features/contacts/contacts.controller.ts:103 |
| 76 | GET /v1/contacts/manage | path: none; query optional | P(MANAGE_CONTACTS) | permission-scoped; service must validate target/parent | R:managed contacts/departments/portal-member PII | S08 | apps/api/src/features/contacts/contacts.controller.ts:116 |
| 77 | POST /v1/contacts | path: none; body | P(MANAGE_CONTACTS) | permission-scoped; service must validate target/parent | R/W:contact records/departments/order; audit | S08 | apps/api/src/features/contacts/contacts.controller.ts:133 |
| 78 | POST /v1/contacts/spreadsheet/sync | path: none; body | P(MANAGE_CONTACTS) | permission-scoped; service must validate target/parent | W:Google Contacts Sheet PII egress | S08/S10 | apps/api/src/features/contacts/contacts.controller.ts:142 |
| 79 | GET /v1/contacts/spreadsheet | path: none; query optional | P(MANAGE_CONTACTS) | permission-scoped; service must validate target/parent | R:PII export/Google Sheet | S08/S10 | apps/api/src/features/contacts/contacts.controller.ts:150 |
| 80 | POST /v1/contacts/departments | path: none; body | P(MANAGE_CONTACTS) | permission-scoped; service must validate target/parent | R/W:contact records/departments/order; audit | S08 | apps/api/src/features/contacts/contacts.controller.ts:161 |
| 81 | PATCH /v1/contacts/departments/:id | path: id; body | P(MANAGE_CONTACTS) | permission-scoped; service must validate target/parent | R/W:contact records/departments/order; audit | S08 | apps/api/src/features/contacts/contacts.controller.ts:170 |
| 82 | DELETE /v1/contacts/departments/:id | path: id; body | P(MANAGE_CONTACTS) | permission-scoped; service must validate target/parent | R/W:contact records/departments/order; audit | S08 | apps/api/src/features/contacts/contacts.controller.ts:180 |
| 83 | POST /v1/contacts/bulk | path: none; body records | P(MANAGE_CONTACTS) | permission-scoped; service must validate target/parent | R/W:contact records/departments/order; audit | S08 | apps/api/src/features/contacts/contacts.controller.ts:190 |
| 84 | PATCH /v1/contacts/order | path: none; body | P(MANAGE_CONTACTS) | permission-scoped; service must validate target/parent | R/W:contact records/departments/order; audit | S08 | apps/api/src/features/contacts/contacts.controller.ts:200 |
| 85 | PATCH /v1/contacts/:id | path: id; body | P(MANAGE_CONTACTS) | permission-scoped; service must validate target/parent | R/W:contact records/departments/order; audit | S08 | apps/api/src/features/contacts/contacts.controller.ts:210 |
| 86 | DELETE /v1/contacts/:id | path: id; body | P(MANAGE_CONTACTS) | permission-scoped; service must validate target/parent | R/W:contact records/departments/order; audit | S08 | apps/api/src/features/contacts/contacts.controller.ts:220 |
| 87 | GET /v1/admin/emails/history | path: none; query optional | P(SEND_BULK_EMAIL) | permission-scoped; service must validate target/parent | R:email history/templates/drafts and recipient metadata | S10 | apps/api/src/features/email/bulk-email.controller.ts:35 |
| 88 | GET /v1/admin/emails/templates | path: none; query optional | P(SEND_BULK_EMAIL) | permission-scoped; service must validate target/parent | R:email history/templates/drafts and recipient metadata | S10 | apps/api/src/features/email/bulk-email.controller.ts:42 |
| 89 | POST /v1/admin/emails/templates | path: none; body | P(SEND_BULK_EMAIL) | permission-scoped; service must validate target/parent | R/W:templates/drafts/email jobs; possible SMTP delivery | S10 | apps/api/src/features/email/bulk-email.controller.ts:48 |
| 90 | PATCH /v1/admin/emails/templates/:templateId | path: templateId; body | P(SEND_BULK_EMAIL) | permission-scoped; service must validate target/parent | R/W:templates/drafts/email jobs; possible SMTP delivery | S10 | apps/api/src/features/email/bulk-email.controller.ts:57 |
| 91 | DELETE /v1/admin/emails/templates/:templateId | path: templateId; body | P(SEND_BULK_EMAIL) | permission-scoped; service must validate target/parent | R/W:templates/drafts/email jobs; possible SMTP delivery | S10 | apps/api/src/features/email/bulk-email.controller.ts:67 |
| 92 | GET /v1/admin/emails/drafts | path: none; query optional | P(SEND_BULK_EMAIL) | permission-scoped; service must validate target/parent | R:email history/templates/drafts and recipient metadata | S10 | apps/api/src/features/email/bulk-email.controller.ts:73 |
| 93 | POST /v1/admin/emails/drafts | path: none; body | P(SEND_BULK_EMAIL) | permission-scoped; service must validate target/parent | R/W:templates/drafts/email jobs; possible SMTP delivery | S10 | apps/api/src/features/email/bulk-email.controller.ts:79 |
| 94 | DELETE /v1/admin/emails/drafts/:draftId | path: draftId; body | P(SEND_BULK_EMAIL) | permission-scoped; service must validate target/parent | R/W:templates/drafts/email jobs; possible SMTP delivery | S10 | apps/api/src/features/email/bulk-email.controller.ts:88 |
| 95 | POST /v1/admin/emails/send | path: none; body | P(SEND_BULK_EMAIL) | permission-scoped; service must validate target/parent | R/W:templates/drafts/email jobs; possible SMTP delivery | S10 | apps/api/src/features/email/bulk-email.controller.ts:97 |
| 96 | POST /v1/admin/emails/test | path: none; body | P(SEND_BULK_EMAIL) | permission-scoped; service must validate target/parent | R/W:templates/drafts/email jobs; possible SMTP delivery | S10 | apps/api/src/features/email/bulk-email.controller.ts:106 |
| 97 | POST /v1/admin/emails/:emailId/cancel | path: emailId; body | P(SEND_BULK_EMAIL) | permission-scoped; service must validate target/parent | R/W:templates/drafts/email jobs; possible SMTP delivery | S10 | apps/api/src/features/email/bulk-email.controller.ts:115 |
| 98 | POST /v1/admin/emails/:emailId/retry | path: emailId; body | P(SEND_BULK_EMAIL) | permission-scoped; service must validate target/parent | R/W:templates/drafts/email jobs; possible SMTP delivery | S10 | apps/api/src/features/email/bulk-email.controller.ts:124 |
| 99 | POST /v1/admin/emails/preview | path: none; body | P(SEND_BULK_EMAIL) | permission-scoped; service must validate target/parent | R:rendered email and selected recipient data | S10 | apps/api/src/features/email/bulk-email.controller.ts:133 |
| 100 | GET /health | path: none; query optional | public | public diagnostic/dev boundary | R:Postgres/Redis status, latency, possible failure message | S11 | apps/api/src/features/health/health.controller.ts:9 |
| 101 | GET /v1/mock/greeting | path: none; query optional | public | public diagnostic/dev boundary | R:development greeting response | S11 | apps/api/src/features/mock/mock.controller.ts:9 |
| 102 | GET /v1/notifications | path: none; query optional | A | self notification ownership | R:self notifications | S05 | apps/api/src/features/notifications/notifications.controller.ts:21 |
| 103 | PATCH /v1/notifications/read-all | path: none; body | A | self notification ownership | W:self read state | S05 | apps/api/src/features/notifications/notifications.controller.ts:33 |
| 104 | PATCH /v1/notifications/:notificationId/read | path: notificationId; body | A | self notification ownership | W:self read state | S05 | apps/api/src/features/notifications/notifications.controller.ts:40 |
| 105 | GET /v1/roadmap/offerings | path: none; query optional | public | public offering dataset policy | R:course/offering/catalog data | S03/S09 | apps/api/src/features/roadmap/roadmap.controller.ts:61 |
| 106 | GET /v1/roadmap/admin | path: none; query optional | P(MANAGE_SITE_CONTENT) | permission-scoped; service must validate target/parent | R:admin roadmap/catalog/relations/terms | S03/S09 | apps/api/src/features/roadmap/roadmap.controller.ts:66 |
| 107 | POST /v1/roadmap/admin/import/preview | path: none; multipart workbook/body | P(MANAGE_SITE_CONTENT) | permission-scoped; service must validate target/parent | R/W:workbook rows and roadmap DB | S03/S09 | apps/api/src/features/roadmap/roadmap.controller.ts:72 |
| 108 | POST /v1/roadmap/admin/import/commit | path: none; multipart workbook/body | P(MANAGE_SITE_CONTENT) | permission-scoped; service must validate target/parent | R/W:workbook rows and roadmap DB | S03/S09 | apps/api/src/features/roadmap/roadmap.controller.ts:82 |
| 109 | POST /v1/roadmap/admin/import | path: none; multipart workbook/body | P(MANAGE_SITE_CONTENT) | permission-scoped; service must validate target/parent | R/W:workbook rows and roadmap DB | S03/S09 | apps/api/src/features/roadmap/roadmap.controller.ts:100 |
| 110 | POST /v1/roadmap/admin/courses | path: none; body | P(MANAGE_SITE_CONTENT) | permission-scoped; service must validate target/parent | R/W:course/offering/term data; audit | S03/S09 | apps/api/src/features/roadmap/roadmap.controller.ts:111 |
| 111 | PATCH /v1/roadmap/admin/courses/:courseCode | path: courseCode; body | P(MANAGE_SITE_CONTENT) | permission-scoped; service must validate target/parent | R/W:course/offering/term data; audit | S03/S09 | apps/api/src/features/roadmap/roadmap.controller.ts:120 |
| 112 | POST /v1/roadmap/admin/offerings | path: none; body | P(MANAGE_SITE_CONTENT) | permission-scoped; service must validate target/parent | R/W:course/offering/term data; audit | S03/S09 | apps/api/src/features/roadmap/roadmap.controller.ts:130 |
| 113 | PATCH /v1/roadmap/admin/offerings/:offeringId | path: offeringId; body | P(MANAGE_SITE_CONTENT) | permission-scoped; service must validate target/parent | R/W:course/offering/term data; audit | S03/S09 | apps/api/src/features/roadmap/roadmap.controller.ts:139 |
| 114 | DELETE /v1/roadmap/admin/offerings/:offeringId | path: offeringId; body | P(MANAGE_SITE_CONTENT) | permission-scoped; service must validate target/parent | R/W:course/offering/term data; audit | S03/S09 | apps/api/src/features/roadmap/roadmap.controller.ts:149 |
| 115 | GET /v1/role-groups/permissions | path: none; query optional | P(MANAGE_ROLES) | permission-scoped; service must validate target/parent | R:permission/role/member PII and membership | S03 | apps/api/src/features/role-groups/role-groups.controller.ts:23 |
| 116 | GET /v1/role-groups | path: none; query optional | P(MANAGE_ROLES) | permission-scoped; service must validate target/parent | R:permission/role/member PII and membership | S03 | apps/api/src/features/role-groups/role-groups.controller.ts:28 |
| 117 | POST /v1/role-groups | path: none; body | P(MANAGE_ROLES) | permission-scoped; service must validate target/parent | R/W:role groups, permission masks, user membership; audit | S03 | apps/api/src/features/role-groups/role-groups.controller.ts:33 |
| 118 | PATCH /v1/role-groups/:roleGroupId | path: roleGroupId; body | P(MANAGE_ROLES) | permission-scoped; service must validate target/parent | R/W:role groups, permission masks, user membership; audit | S03 | apps/api/src/features/role-groups/role-groups.controller.ts:44 |
| 119 | GET /v1/role-groups/:roleGroupId/users | path: roleGroupId; query optional | P(MANAGE_ROLES) | permission-scoped; service must validate target/parent | R:permission/role/member PII and membership | S03 | apps/api/src/features/role-groups/role-groups.controller.ts:56 |
| 120 | GET /v1/role-groups/:roleGroupId/users/candidates | path: roleGroupId; query optional | P(MANAGE_ROLES) | permission-scoped; service must validate target/parent | R:permission/role/member PII and membership | S03 | apps/api/src/features/role-groups/role-groups.controller.ts:61 |
| 121 | POST /v1/role-groups/:roleGroupId/users | path: roleGroupId; body | P(MANAGE_ROLES) | permission-scoped; service must validate target/parent | R/W:role groups, permission masks, user membership; audit | S03 | apps/api/src/features/role-groups/role-groups.controller.ts:95 |
| 122 | PUT /v1/role-groups/:roleGroupId/users | path: roleGroupId; body | P(MANAGE_ROLES) | permission-scoped; service must validate target/parent | R/W:role groups, permission masks, user membership; audit | S03 | apps/api/src/features/role-groups/role-groups.controller.ts:108 |
| 123 | DELETE /v1/role-groups/:roleGroupId/users/:userId | path: roleGroupId, userId; body | P(MANAGE_ROLES) | permission-scoped; service must validate target/parent | R/W:role groups, permission masks, user membership; audit | S03 | apps/api/src/features/role-groups/role-groups.controller.ts:121 |
| 124 | DELETE /v1/role-groups/:roleGroupId | path: roleGroupId; body | P(MANAGE_ROLES) | permission-scoped; service must validate target/parent | R/W:role groups, permission masks, user membership; audit | S03 | apps/api/src/features/role-groups/role-groups.controller.ts:133 |
| 125 | GET /v1/site-content/admin | path: none; query optional | P(MANAGE_SITE_CONTENT) | permission-scoped; service must validate target/parent | R:admin CMS content/editor identity | S03/S09 | apps/api/src/features/site-content/site-content.controller.ts:48 |
| 126 | GET /v1/site-content/blocks/admin | path: none; query optional | P(MANAGE_SITE_CONTENT) | permission-scoped; service must validate target/parent | R:admin CMS content/editor identity | S03/S09 | apps/api/src/features/site-content/site-content.controller.ts:54 |
| 127 | GET /v1/site-content/blocks/public | path: none; query optional | public | public/service visibility policy | R:public CMS content/assets | S03/S09 | apps/api/src/features/site-content/site-content.controller.ts:60 |
| 128 | POST /v1/site-content/blocks | path: none; body | P(MANAGE_SITE_CONTENT) | permission-scoped; service must validate target/parent | R/W:CMS content/order/publish/key/assets; audit | S03/S09 | apps/api/src/features/site-content/site-content.controller.ts:65 |
| 129 | PATCH /v1/site-content/blocks/reorder | path: none; body | P(MANAGE_SITE_CONTENT) | permission-scoped; service must validate target/parent | R/W:CMS content/order/publish/key/assets; audit | S03/S09 | apps/api/src/features/site-content/site-content.controller.ts:77 |
| 130 | PATCH /v1/site-content/blocks/:contentBlockId | path: contentBlockId; body | P(MANAGE_SITE_CONTENT) | permission-scoped; service must validate target/parent | R/W:CMS content/order/publish/key/assets; audit | S03/S09 | apps/api/src/features/site-content/site-content.controller.ts:91 |
| 131 | POST /v1/site-content/blocks/:contentBlockId/publish | path: contentBlockId; body | P(MANAGE_SITE_CONTENT) | permission-scoped; service must validate target/parent | R/W:CMS content/order/publish/key/assets; audit | S03/S09 | apps/api/src/features/site-content/site-content.controller.ts:104 |
| 132 | DELETE /v1/site-content/blocks/:contentBlockId | path: contentBlockId; body | P(MANAGE_SITE_CONTENT) | permission-scoped; service must validate target/parent | R/W:CMS content/order/publish/key/assets; audit | S03/S09 | apps/api/src/features/site-content/site-content.controller.ts:116 |
| 133 | GET /v1/site-content | path: none; query optional | public | public/service visibility policy | R:public CMS content/assets | S03/S09 | apps/api/src/features/site-content/site-content.controller.ts:129 |
| 134 | PUT /v1/site-content/:key | path: key; body | P(MANAGE_SITE_CONTENT) | permission-scoped; service must validate target/parent | R/W:CMS content/order/publish/key/assets; audit | S03/S09 | apps/api/src/features/site-content/site-content.controller.ts:134 |
| 135 | DELETE /v1/site-content/:key | path: key; body | P(MANAGE_SITE_CONTENT) | permission-scoped; service must validate target/parent | R/W:CMS content/order/publish/key/assets; audit | S03/S09 | apps/api/src/features/site-content/site-content.controller.ts:149 |
| 136 | POST /v1/surveys/:surveyId/sections/:sectionId/questions | path: none; body | P(MANAGE_SURVEY) | permission-scoped; service must validate target/parent | R/W:survey definition, branching, order; audit | S07 | apps/api/src/features/surveys/survey-questions.controller.ts:32 |
| 137 | PATCH /v1/surveys/:surveyId/sections/:sectionId/questions/reorder | path: none; body | P(MANAGE_SURVEY) | permission-scoped; service must validate target/parent | R/W:survey definition, branching, order; audit | S07 | apps/api/src/features/surveys/survey-questions.controller.ts:42 |
| 138 | PATCH /v1/surveys/:surveyId/sections/:sectionId/questions/:questionId | path: questionId; body | P(MANAGE_SURVEY) | permission-scoped; service must validate target/parent | R/W:survey definition, branching, order; audit | S07 | apps/api/src/features/surveys/survey-questions.controller.ts:52 |
| 139 | DELETE /v1/surveys/:surveyId/sections/:sectionId/questions/:questionId | path: questionId; body | P(MANAGE_SURVEY) | permission-scoped; service must validate target/parent | R/W:survey definition, branching, order; audit | S07 | apps/api/src/features/surveys/survey-questions.controller.ts:63 |
| 140 | POST /v1/surveys/:surveyId/responses | path: none; body | O | optional actor + visibility/publication/eligibility service policy | W:survey response/answers/files; queue Sheets | S07 | apps/api/src/features/surveys/survey-responses.controller.ts:42 |
| 141 | GET /v1/surveys/:surveyId/responses | path: none; query optional | P(MANAGE_SURVEY) | permission-scoped; service must validate target/parent | R:response identity, status, answers/files for manager | S07 | apps/api/src/features/surveys/survey-responses.controller.ts:52 |
| 142 | GET /v1/surveys/:surveyId/responses/mine | path: none; query optional | O | self response ownership | R:self response/answers | S07 | apps/api/src/features/surveys/survey-responses.controller.ts:58 |
| 143 | PATCH /v1/surveys/:surveyId/responses/mine | path: none; body | O | self response ownership | W:self response/answers/files; queue Sheets | S07 | apps/api/src/features/surveys/survey-responses.controller.ts:67 |
| 144 | GET /v1/surveys/:surveyId/responses/with-answers | path: none; query optional | P(MANAGE_SURVEY) | permission-scoped; service must validate target/parent | R:response identity, status, answers/files for manager | S07 | apps/api/src/features/surveys/survey-responses.controller.ts:77 |
| 145 | GET /v1/surveys/:surveyId/responses/:responseId | path: responseId; query optional | P(MANAGE_SURVEY) | permission-scoped; service must validate target/parent | R:response identity, status, answers/files for manager | S07 | apps/api/src/features/surveys/survey-responses.controller.ts:83 |
| 146 | POST /v1/surveys/:surveyId/sections | path: none; body | P(MANAGE_SURVEY) | permission-scoped; service must validate target/parent | R/W:survey definition, branching, order; audit | S07 | apps/api/src/features/surveys/survey-sections.controller.ts:32 |
| 147 | PATCH /v1/surveys/:surveyId/sections/reorder | path: none; body | P(MANAGE_SURVEY) | permission-scoped; service must validate target/parent | R/W:survey definition, branching, order; audit | S07 | apps/api/src/features/surveys/survey-sections.controller.ts:41 |
| 148 | PATCH /v1/surveys/:surveyId/sections/:sectionId | path: sectionId; body | P(MANAGE_SURVEY) | permission-scoped; service must validate target/parent | R/W:survey definition, branching, order; audit | S07 | apps/api/src/features/surveys/survey-sections.controller.ts:50 |
| 149 | DELETE /v1/surveys/:surveyId/sections/:sectionId | path: sectionId; body | P(MANAGE_SURVEY) | permission-scoped; service must validate target/parent | R/W:survey definition, branching, order; audit | S07 | apps/api/src/features/surveys/survey-sections.controller.ts:60 |
| 150 | GET /v1/surveys | path: none; query optional | P(MANAGE_SURVEY) | permission-scoped; service must validate target/parent | R:survey definition/publication/audience | S07 | apps/api/src/features/surveys/surveys.controller.ts:50 |
| 151 | GET /v1/surveys/list/public | path: none; query optional | O | optional actor + visibility/publication/eligibility service policy | R:survey definition/publication/audience | S07 | apps/api/src/features/surveys/surveys.controller.ts:56 |
| 152 | GET /v1/surveys/:id | path: id; query optional | O | optional actor + visibility/publication/eligibility service policy | R:survey definition/publication/audience | S07 | apps/api/src/features/surveys/surveys.controller.ts:62 |
| 153 | GET /v1/surveys/:id/analytics | path: id; query optional | O | optional actor + visibility/publication/eligibility service policy | R:publication-gated aggregate analytics; raw answer exclusion | S07 | apps/api/src/features/surveys/surveys.controller.ts:68 |
| 154 | POST /v1/surveys | path: none; body | P(MANAGE_SURVEY) | permission-scoped; service must validate target/parent | R/W:survey definition/lifecycle/duplicate; audit | S07 | apps/api/src/features/surveys/surveys.controller.ts:74 |
| 155 | PATCH /v1/surveys/:id | path: id; body | P(MANAGE_SURVEY) | permission-scoped; service must validate target/parent | R/W:survey definition/lifecycle/duplicate; audit | S07 | apps/api/src/features/surveys/surveys.controller.ts:83 |
| 156 | DELETE /v1/surveys/:id | path: id; body | P(MANAGE_SURVEY) | permission-scoped; service must validate target/parent | R/W:survey definition/lifecycle/duplicate; audit | S07 | apps/api/src/features/surveys/surveys.controller.ts:93 |
| 157 | POST /v1/surveys/:id/duplicate | path: id; body | P(MANAGE_SURVEY) | permission-scoped; service must validate target/parent | R/W:survey definition/lifecycle/duplicate; audit | S07 | apps/api/src/features/surveys/surveys.controller.ts:99 |
| 158 | POST /v1/surveys/:id/spreadsheet | path: id; body | P(MANAGE_SURVEY) | permission-scoped; service must validate target/parent | R/W:survey response Sheet and PII egress | S07/S10 | apps/api/src/features/surveys/surveys.controller.ts:108 |
| 159 | POST /v1/surveys/:id/spreadsheet/sync | path: id; body | P(MANAGE_SURVEY) | permission-scoped; service must validate target/parent | R/W:survey response Sheet and PII egress | S07/S10 | apps/api/src/features/surveys/surveys.controller.ts:117 |
| 160 | GET /v1/users/me/articles | path: none; query optional | A | authenticated actor; self/resource policy | R:self activity/articles/comments/responses/scraps | S05 | apps/api/src/features/users/users.controller.ts:51 |
| 161 | GET /v1/users/me/comments | path: none; query optional | A | authenticated actor; self/resource policy | R:self activity/articles/comments/responses/scraps | S05 | apps/api/src/features/users/users.controller.ts:66 |
| 162 | GET /v1/users/me/survey-responses | path: none; query optional | A | authenticated actor; self/resource policy | R:self activity/articles/comments/responses/scraps | S05 | apps/api/src/features/users/users.controller.ts:81 |
| 163 | GET /v1/users/me/activity | path: none; query optional | A | authenticated actor; self/resource policy | R:self activity/articles/comments/responses/scraps | S05 | apps/api/src/features/users/users.controller.ts:96 |
| 164 | GET /v1/users/me/scraps | path: none; query optional | A | authenticated actor; self/resource policy | R:self activity/articles/comments/responses/scraps | S05 | apps/api/src/features/users/users.controller.ts:111 |
| 165 | GET /v1/users/:userId/persisted-profile | path: userId; query optional | P(MANAGE_FINANCE) | permission-scoped; service must validate target/parent | R:student PII, fee/payment status and evidence | S08 | apps/api/src/features/users/users.controller.ts:127 |
| 166 | PUT /v1/users/:userId/status | path: userId; body | P(MANAGE_USERS) | permission-scoped; service must validate target/parent | W:user status/sanction; audit | S03 | apps/api/src/features/users/users.controller.ts:136 |
| 167 | GET /v1/users/:userId/sanctions/posting | path: userId; query optional | P(MANAGE_USERS) | permission-scoped; service must validate target/parent | R:user status/sanction | S03 | apps/api/src/features/users/users.controller.ts:157 |
| 168 | PUT /v1/users/:userId/sanctions/posting | path: userId; body | P(MANAGE_USERS) | permission-scoped; service must validate target/parent | W:user status/sanction; audit | S03 | apps/api/src/features/users/users.controller.ts:163 |
| 169 | GET /v1/users/admin/list | path: none; query optional | P(MANAGE_USERS) | permission-scoped; service must validate target/parent | R:user directory/account administration; possible PII | S03 | apps/api/src/features/users/users.controller.ts:177 |
| 170 | GET /v1/users | path: none; query optional | P(MANAGE_USERS) | permission-scoped; service must validate target/parent | R:user directory/account administration; possible PII | S03 | apps/api/src/features/users/users.controller.ts:214 |
| 171 | GET /v1/users/fee-status/list | path: none; query optional | P(MANAGE_FINANCE) | permission-scoped; service must validate target/parent | R:student PII, fee/payment status and evidence | S08 | apps/api/src/features/users/users.controller.ts:226 |
| 172 | GET /v1/users/fee-status/stats | path: none; query optional | P(MANAGE_FINANCE) | permission-scoped; service must validate target/parent | R:student PII, fee/payment status and evidence | S08 | apps/api/src/features/users/users.controller.ts:268 |
| 173 | POST /v1/users/fee-status/spreadsheet/sync | path: none; body | P(MANAGE_FINANCE) | permission-scoped; service must validate target/parent | R/W:fee/payment state; audit and possible Sheet sync | S08 | apps/api/src/features/users/users.controller.ts:287 |
| 174 | GET /v1/users/fee-status/spreadsheet | path: none; query optional | P(MANAGE_FINANCE) | permission-scoped; service must validate target/parent | R:student PII, fee/payment status and evidence | S08 | apps/api/src/features/users/users.controller.ts:323 |
| 175 | GET /v1/users/fee-status/export.xlsx | path: none; query optional | P(MANAGE_FINANCE) | permission-scoped; service must validate target/parent | R:student PII, fee/payment status and evidence | S08 | apps/api/src/features/users/users.controller.ts:334 |
| 176 | POST /v1/users/fee-status/bulk | path: none; body | P(MANAGE_FINANCE) | permission-scoped; service must validate target/parent | R/W:fee/payment state; audit and possible Sheet sync | S08 | apps/api/src/features/users/users.controller.ts:405 |
| 177 | POST /v1/users/fee-status/payments | path: none; body | P(MANAGE_FINANCE) | permission-scoped; service must validate target/parent | R/W:fee/payment state; audit and possible Sheet sync | S08 | apps/api/src/features/users/users.controller.ts:418 |
| 178 | GET /v1/users/fee-status/detail/:userId | path: userId; query optional | P(MANAGE_FINANCE) | permission-scoped; service must validate target/parent | R:student PII, fee/payment status and evidence | S08 | apps/api/src/features/users/users.controller.ts:431 |
| 179 | GET /v1/users/:userId/fee-status | path: userId; query optional | P(MANAGE_FINANCE) | permission-scoped; service must validate target/parent | R:student PII, fee/payment status and evidence | S08 | apps/api/src/features/users/users.controller.ts:439 |
| 180 | PUT /v1/users/:userId/fee-status | path: userId; body | P(MANAGE_FINANCE) | permission-scoped; service must validate target/parent | R/W:fee/payment state; audit and possible Sheet sync | S08 | apps/api/src/features/users/users.controller.ts:450 |
| 181 | GET /v1/votes/public | path: none; query optional | public | public/service visibility policy | R:public vote metadata | S11 | apps/api/src/features/votes/votes.controller.ts:28 |
| 182 | GET /v1/votes/admin | path: none; query optional | P(MANAGE_VOTE) | permission-scoped; service must validate target/parent | R:vote config/status/eligibility metadata | S11 | apps/api/src/features/votes/votes.controller.ts:31 |
| 183 | POST /v1/votes/admin | path: none; body | P(MANAGE_VOTE) | permission-scoped; service must validate target/parent | R/W:vote definition/lifecycle/tally/results; audit | S11 | apps/api/src/features/votes/votes.controller.ts:35 |
| 184 | GET /v1/votes/admin/:id/voters | path: id; query optional | P(MANAGE_VOTE) | permission-scoped; service must validate target/parent | R:voter roll PII | S11 | apps/api/src/features/votes/votes.controller.ts:43 |
| 185 | POST /v1/votes/admin/:id/voters | path: id; body | P(MANAGE_VOTE) | permission-scoped; service must validate target/parent | R/W:voter inclusion/exclusion | S11 | apps/api/src/features/votes/votes.controller.ts:47 |
| 186 | POST /v1/votes/admin/:id/voters/exclude | path: id; body | P(MANAGE_VOTE) | permission-scoped; service must validate target/parent | R/W:voter inclusion/exclusion | S11 | apps/api/src/features/votes/votes.controller.ts:55 |
| 187 | PATCH /v1/votes/admin/:id | path: id; body | P(MANAGE_VOTE) | permission-scoped; service must validate target/parent | R/W:vote definition/lifecycle/tally/results; audit | S11 | apps/api/src/features/votes/votes.controller.ts:63 |
| 188 | DELETE /v1/votes/admin/:id | path: id; body | P(MANAGE_VOTE) | permission-scoped; service must validate target/parent | R/W:vote definition/lifecycle/tally/results; audit | S11 | apps/api/src/features/votes/votes.controller.ts:71 |
| 189 | POST /v1/votes/admin/:id/publish | path: id; body | P(MANAGE_VOTE) | permission-scoped; service must validate target/parent | R/W:vote definition/lifecycle/tally/results; audit | S11 | apps/api/src/features/votes/votes.controller.ts:78 |
| 190 | POST /v1/votes/admin/:id/close | path: id; body | P(MANAGE_VOTE) | permission-scoped; service must validate target/parent | R/W:vote definition/lifecycle/tally/results; audit | S11 | apps/api/src/features/votes/votes.controller.ts:86 |
| 191 | POST /v1/votes/admin/:id/tally | path: id; body | P(MANAGE_VOTE) | permission-scoped; service must validate target/parent | R/W:vote definition/lifecycle/tally/results; audit | S11 | apps/api/src/features/votes/votes.controller.ts:94 |
| 192 | POST /v1/votes/admin/:id/publish-results | path: id; body | P(MANAGE_VOTE) | permission-scoped; service must validate target/parent | R:publication-gated tally/results | S11 | apps/api/src/features/votes/votes.controller.ts:102 |
| 193 | GET /v1/votes/:id/results | path: id; query optional | O | optional actor + visibility/publication/eligibility service policy | R:publication-gated tally/results | S11 | apps/api/src/features/votes/votes.controller.ts:110 |
| 194 | GET /v1/votes/:id/receipts/:code | path: id, code; query optional | public | public receipt-code check | R:receipt validity/result relation | S11 | apps/api/src/features/votes/votes.controller.ts:116 |
| 195 | POST /v1/votes/:id/ballots | path: id; body | A | authenticated voter eligibility | W:encrypted ballot and receipt | S11 | apps/api/src/features/votes/votes.controller.ts:121 |
| 196 | GET /v1/votes/:id | path: id; query optional | O | optional actor + visibility/publication/eligibility service policy | R:vote config/status/eligibility metadata | S11 | apps/api/src/features/votes/votes.controller.ts:135 |

## 6. 비HTTP 작업·외부 egress 범위

S01은 HTTP route뿐 아니라 실제 module 등록으로 도달 가능한 scheduler, queue, CLI, import/export, storage path도 매핑했다.

| 경로 | 현재 동작 | 외부/민감 side effect | 후속 |
|---|---|---|---|
| apps/api/src/features/asset/asset.service.ts:38, 426-485 | ASSET_ORPHAN_CLEANUP_ENABLED가 true일 때 interval; unlinked asset cleanup | PostgreSQL asset row와 local/S3 object 삭제 | S06/S13. 현재 flag false |
| apps/api/src/features/email/bulk-email.service.ts:105, 465-724 | BULK_EMAIL_SCHEDULER_ENABLED가 true일 때 in-process polling | PostgreSQL job claim, SMTP delivery, personalized recipients/attachments | S10/S13. 현재 flag false, dry-run true |
| apps/api/src/infrastructure/google/google-spreadsheet-sync-queue.service.ts:28-207 | mutation이 DB queue를 만들고 10초 cron이 claim/retry/backoff 처리 | Contacts, fee, survey identity/answer PII가 Google Sheets로 이동 | S08/S10 |
| apps/api/src/features/calendar/calendar-sync.service.ts:50-105, 285-378 | manual enqueue, minute cron, Asia/Seoul daily KAIST job | Google Calendar, KAIST source, holiday/ICS, calendar DB | S10 |
| apps/api/src/features/calendar/google-calendar.client.ts:156-275 | bearer/service-account/token file, 15초 timeout, ETag | Google Calendar read/write와 calendar identifiers | S10 |
| apps/api/src/features/calendar/kaist-academic-calendar.source.ts:38-145 | 12 sequential POST, 300 ms delay, 15초 timeout, HTML parse | KAIST academic calendar response | S10/S13 |
| apps/api/scripts/google-oauth-authorize.ts:1-4, 56-155 | loopback callback, state/PKCE 검증, refresh token file mode 0600 | Google OAuth token file | S10/S12 |
| apps/api/drizzle/seed.ts:3285-3317 | default/local Compose demo seed; production은 demo seed 거부 | PostgreSQL demo users/roles/content | S03/S11 |
| apps/api/src/features/roadmap/roadmap-importer.ts와 controller:72-100 | workbook preview/commit/import | imported rows와 catalog mutation | S09/S13 |
| apps/api/src/features/users/users.controller.ts:287-450 | fee export, bulk update/payment, spreadsheet sync | fee/payment PII, audit, Google egress | S08/S10 |
| apps/api/src/features/contacts/contacts.controller.ts:55-221 | contact export/sheet sync/bulk/departments | contact PII and Google egress | S08/S10 |
| apps/api/src/features/surveys/surveys.controller.ts:108-118 | publication/sync spreadsheet paths | response PII/answers to Google | S07/S10 |
| apps/api/src/features/auth/auth.service.ts와 pending-login.repository.ts:52-169 | SSO state/nonce, pending-login Redis TTL 600초 | SSO identity, pending profile, cookies | S02/S04 |

### 6.1 현재 코드에서 확인된 후속 검증 후보

아래 항목은 S00/S01의 확인 후보다. 코드 관찰만으로 exploitability, 실제 공개 도달성, 운영 영향까지 확정하지 않는다.

- Pending login은 email/mobile만 AES-256-GCM으로 encrypt하고 academic status, department, major, gender, identity code, names, SSO subject, stdNo는 JSON field로 저장한다(pending-login.repository.ts:20-35, 98-116). Redis ACL/TLS/backups는 미확인이다.
- GET /contacts는 controller guard가 없고 service가 privacyConsented=false를 purge한 뒤 repository map의 studentNumber, email, phoneNumber, privacyConsented 등을 반환한다(contacts.controller.ts:44, contacts.service.ts:30-33, contacts.repository.ts:25-50). 공개 필드가 정책상 허용되는지는 S08에서 확인한다.
- GET /roadmap/offerings는 listPublic()이 findAdminData()를 호출하고 repository가 courses/items/relations/terms 전체를 구성한다(roadmap.controller.ts:61, roadmap.service.ts:34-37, roadmap.repository.ts:113-121). 공개 데이터셋이 의도한 범위인지 S09에서 확인한다.
- GET /health는 Postgres/Redis 실패 시 raw error.message를 반환할 수 있다(health.service.ts:25-37, 39-79). 현재 정상 로컬 요청은 200이지만 실패 경로는 S11에서 stub으로 확인한다.
- AuditLogService.record는 repository 실패를 warn으로 남기고 mutation을 실패시키지 않는다(audit-log.service.ts:15-25). audit completeness/transactionality는 S08에서 확인한다.
- Google handlers는 contacts, fee, survey response PII를 Sheet row로 만든다(contacts/google-contact-sheets.service.ts:19-114, users/google-fee-sheets.service.ts:33-148, surveys/google-survey-sheets.service.ts:19-163). 실제 Drive sharing/IAM/token ownership은 외부 확인 사항이다.
- current .env의 ENABLE_MOCK_AUTH=true는 source의 module selection에 사용되지 않으며, MockModule은 NODE_ENV 기준이다(app.module.ts:28-29). mock route는 non-production 모듈의 greeting으로 S11에서 확인한다.
- 자산 content route는 linked article마다 board read scope와 `isReadableArticle`만 확인하고 `isSecret`을 별도로 전달하지 않는다(asset.service.ts:322-348). secret article이 public scope와 결합될 때 asset confidentiality를 우회하는지 S06 하네스로 확인했다.
- S3 direct presign은 `PutObjectCommand`에 ContentType와 SSE만 서명하고 size/checksum 조건은 포함하지 않는다(asset.storage.ts:181-204). controller의 20MiB metadata 검증과 complete 단계의 HeadObject size/MIME 비교는 업로드 이후 검사이며, 사용자별 quota/rate limit은 현재 source에서 확인하지 못했다(asset.controller.ts:141-193; asset.service.ts:184-241). S06에서 resource-abuse 후보로 기록한다.
- orphan cleanup은 unlinked candidate 조회 후 storage delete와 ID 기반 DB delete를 별도 단계로 수행하며 재참조 재검사가 없다(asset.service.ts:426-470; asset.repository.ts:284-360). 현재 자동 cleanup flag는 false이므로 즉시 live finding이 아닌 S13 race/availability 검증 항목으로 둔다.
- public survey list/detail은 frontend가 사용하지 않는 `creatorId`, previous/derived version metadata, spreadsheet ID/URL/sync state까지 `SurveyRecord` 전체로 반환한다(surveys.service.ts:253-330; surveys.repository.ts:26-64; shared/contracts/src/http/survey.ts:46-85). 현재 spreadsheet 값은 0건이지만 public DTO 최소화와 Google Sheet sharing은 S07/S10에서 확인한다.
- survey response file ownership는 service가 `assetId`를 우선 추출하고, answer validator는 `assetIds`를 우선 추출한다(survey-responses.service.ts:48-99; survey-answer-validation.ts:124-160,295-308). 두 필드가 함께 오면 타인 asset reference가 persistence와 manager download path에 도달하는지 S07에서 확인한다.
- survey description/question image reference는 형식만 검사하고 survey/question mutation에서 uploader ownership lookup을 호출하지 않는다(schemas.ts:376-378,453-459,479-524; surveys.repository.ts:114-168; survey-questions.service.ts:38-123). published survey reference를 asset repository가 public image로 분류하는 체인(asset.repository.ts:120-147)과 함께 S07 후보로 둔다.
- `GET /contacts`는 controller guard가 없고 ContactRecord 전체를 반환하며, 현재 DB의 4개 행은 모두 privacy consent 상태다(contacts.controller.ts:44-58; contacts.repository.ts:25-50). 공개 연락망의 필드 범위는 정책 확인이 필요하다.
- 연락망 생성·가져오기는 `privacyConsented=false`를 허용하고 sync queue를 만들 수 있지만, background handler는 `ContactsService.purgeRevoked()`를 거치지 않고 repository를 직접 호출해 Google Sheet 행을 만든다(contacts.service.ts:155-186; contacts.repository.ts:25-50; google-contact-sheets.service.ts:28-35,57-112; google-spreadsheet-sync-queue.service.ts:45-73,110-145). 현재-build harness에서 합성 철회 행이 전송 행에 포함되는 것을 확인했다.
- `bulkUpdateStudentFeeStatuses`는 항목별 별도 transaction을 순차 실행하고, 납부 입력·저장 경로에는 idempotency key나 외부 거래 reference가 없다(users.service.ts:314-379; users.repository.ts:843-925; schemas.ts:643-684). 부분 실패와 동일 납부 재전송을 S08 후보로 기록했다.
- 인증된 연락망·과비·감사 JSON/XLSX 응답에서 명시적인 `Cache-Control`이 현재 local HTTP 응답에 없고, 감사 export는 raw payload/IP 필드를 포함한다. export 상한·메모리 사용은 S13에서 계속 확인한다.
- 연락망·과비·설문 background Sheets sync handler는 queue claim/retry는 수행하지만 sync별 감사 metadata/record를 전달하지 않는다. 현재 queue 성공 2건에 대응하는 `.spreadsheet.sync` audit action은 0건이었다. 실제 Google/Drive ACL과 token scope는 S10에서 확인한다.

## 7. 위협 모델

### 7.1 Overview

SOC Web은 Browser/Internet에서 Nginx를 통해 NestJS API와 Vite/React Web으로 진입하고, API는 PostgreSQL, Redis, local/S3 asset storage와 연결된다. 인증은 persisted cookie session과 짧은 temporary survey bearer를 분리하고, permission bitmask와 service-level visibility/ownership/eligibility checks로 기능을 제한한다. API는 SSO, Google Sheets/Calendar, SMTP, S3, KAIST/holiday/ICS source와 통신하며, 일부 작업은 in-process scheduler 또는 DB-backed retry queue로 비동기 실행된다.

### 7.2 Attacker capabilities

1. anonymous caller: public board, contacts, roadmap, calendar, survey discovery, vote public/receipt, health, auth flow를 호출할 수 있다.
2. temporary bearer holder: temporary survey flow에 허용된 optional route를 호출할 수 있다. 이 token으로 persisted user/admin route에 진입할 수 없어야 한다.
3. persisted normal user: authenticated write/read route를 호출하고 자신의 content/response/notification/activity에 접근할 수 있다.
4. single-permission admin: 해당 permission bit를 가진 route를 호출할 수 있다. 다른 기능의 bit 또는 대상 object ownership을 자동으로 얻지 않아야 한다.
5. malicious authenticated user: path/body/query ID, parent ID, asset ID, response ID, user ID, roleGroupId, vote ID를 바꾸거나 동시 요청을 보낼 수 있다.
6. compromised infra/operator: DB, Redis, mounted secrets, uploads, S3, container network, CI 또는 host 접근을 가정하면 application guard 밖의 별도 위험이다.
7. unreliable/malicious external provider: malformed calendar/HTML/Sheet/SMTP response, timeout, duplicate callback, provider-side sharing/IAM misconfiguration을 일으킬 수 있다.

### 7.3 Security objectives

- session, refresh, temporary token의 수명·취소·격리를 유지한다.
- route permission과 service-level object ownership/visibility/eligibility를 일관되게 적용한다.
- 다른 사용자의 article/comment/draft/response/file/fee/role/notification을 읽거나 바꾸지 못하게 한다.
- anonymous-author identity, official/private response, survey raw answer, contact/fee PII, vote ballot을 최소 범위로만 노출한다.
- ballot secrecy와 receipt integrity를 보존하고 published result와 private analytics를 분리한다.
- upload/import/HTML/external fetch/email을 크기·형식·대상·재시도 범위로 제한한다.
- DB/Redis/assets/external provider egress와 background job을 intended deployment boundary 안에 둔다.
- mutation의 auditability와 concurrency/integrity를 보존한다.

### 7.4 Assumptions and unknowns

| 가정/미확인 | 영향 |
|---|---|
| 현재 source와 현재 non-secret .env values가 이번 분석의 기준이다 | production profile이 다르면 effective route/feature가 달라질 수 있음 |
| Nest decorators와 module registration이 runtime path다 | 실제 배포 runtime smoke test가 아직 필요 |
| 외부 TLS termination, WAF, rate limiting, CSRF, access logging은 repository 밖일 수 있다 | S04/S12/S13에서 운영 증거 없이는 확정할 수 없음 |
| .env.production이 없고 어느 Compose file이 production-authoritative인지 확인되지 않았다 | host ports, Redis/DB exposure, secret mount, sync flags의 drift 가능 |
| PostgreSQL/Redis auth/TLS/backup/dump/operator access가 미확인 | application-level protection과 storage-level confidentiality를 분리해야 함 |
| S3 bucket policy/IAM/object public access/lifecycle/malware scanning이 미확인 | asset confidentiality/integrity는 S06/S12에서 외부 검증 필요 |
| Google Drive sharing, service-account scopes, OAuth token ownership/retention 미확인 | PII egress impact는 provider boundary까지 평가해야 함 |
| public contacts fields와 roadmap admin-shaped dataset이 product intent상 허용되는지 미확인 | S08/S09에서 policy decision 필요 |
| 실제 replica 수와 scheduler single-runner 제약이 미확인 | duplicate cleanup/email/calendar work 가능성은 S13 hypothesis |
| route matrix HTTP tests와 skipped concurrency tests는 아직 실행하지 않음 | 현재 PASS는 source/static test baseline일 뿐 |

### 7.5 Attacker stories와 후속 workstream

| ID | 공격 이야기/검증 가설 | 우선 후속 |
|---|---|---|
| TM-01 | path ID를 다른 article/comment/draft/asset/response/user/role/vote로 바꿔 cross-object read/write | S03, S05-S08, S11 |
| TM-02 | temporary bearer나 pending token을 persisted session/admin route로 재사용 | S02/S03 |
| TM-03 | revoked/inactive account 또는 변경된 role permission이 refresh/cache/동시 요청에서 계속 유효 | S02/S03 |
| TM-04 | public contacts/roadmap/health/analytics가 intended minimum보다 많은 PII/raw/error를 노출 | S07-S09, S11 |
| TM-05 | direct S3 upload, asset complete, local path, active MIME/SVG, orphan cleanup으로 파일 경계를 우회 | S06 |
| TM-06 | survey submission/update, fee update, capacity/single-response race에서 duplicate/over-capacity/stale state가 발생 | S07/S08/S13 |
| TM-07 | receipt, voter list, ballot metadata, encryption key separation으로 vote anonymity 또는 result integrity가 약화 | S11 |
| TM-08 | Sheets/Google Calendar/KAIST/holiday/SMTP retry path가 과도한 PII를 외부로 보내거나 duplicate delivery | S10/S13 |
| TM-09 | rich text/import/workbook/query가 stored XSS, parser abuse, injection, resource exhaustion을 만든다 | S09/S13 |
| TM-10 | dev-only mock/demo seed, default host ports, health failure message, proxy trust/cookie/CORS/CSRF 구성으로 외부 공격면이 확대 | S04, S11-S13 |

### 7.6 Severity calibration

후속 검증에서 다음 기준을 적용한다.

- Critical: 인증/권한 우회로 전체 관리자 기능 또는 대규모 PII/secret/ballot이 즉시 획득되거나 RCE/SQL-level compromise가 가능한 경우
- High: 다른 사용자의 민감 object read/write, 공개 PII 대량 노출, ballot anonymity 붕괴, 임의 파일 read/write, 무단 대량 메일/외부 egress
- Medium: 제한된 범위의 IDOR, stored/reflected XSS, CSRF가 실제 state change에 도달, 동시성으로 fee/survey/vote integrity 손상, audit loss
- Low: 내부 host/error metadata, non-sensitive metadata, 제한된 availability·hardening 누락
- 단순히 guard가 없거나 DTO type만 있는 구조 관찰은 exploit path와 impact가 검증되기 전까지 finding severity가 아니다.

## 8. S00/S01/S02/S03/S04/S05/S06/S07/S08/S09/S10/S11/S12/S13/S14 완료 상태와 다음 단계

- S00: 기준 revision, dirty worktree, runtime module/route, current config profile, Compose/Nginx boundary, scheduler/CLI/import/export, baseline checks, 현재 stack 상태를 확정했다.
- S01: 24 controller와 196 route, auth/permission/ownership/PII/side-effect/S mapping, non-HTTP paths, actor/threat model을 기록했다.
- S02: SSO state/nonce, result/pending token, temporary/persisted token separation, Redis session, refresh rotation, consent, logout, cookie/client flow를 source와 local test evidence로 검증했다. 예비 findings는 SECURITY_AUDIT_RESULTS_2026-09-08.md 6절에 기록했다.
- S03 1차: permissioned route matrix, role permission assignment/cache invalidation, inactive-user handling, bootstrap grant, DTO server-owned field stripping, survey/article/comment composite object boundaries, public roadmap visibility를 현재 소스와 제한된 local HTTP/harness evidence로 검증했다. 기능별 전수 endpoint/side-effect 검증은 S05-S11에서 이어가며, 예비 findings는 SECURITY_AUDIT_RESULTS_2026-09-08.md 7절에 기록했다.
- S04 1차: API trust proxy/cookie flag path, Nginx rewrite/header path, current CORS allowlist, SameSite/CSRF boundary, auth response cache headers, access-log query retention을 현재 소스와 local HTTP/Nginx evidence로 검증했다. 예비 findings와 운영 미확인은 SECURITY_AUDIT_RESULTS_2026-09-08.md 8절에 기록했다.
- S05 1차: public article list/detail/search, anonymous author field, secret article comment/read-write path, previous/next article metadata, comment parent/owner binding, draft owner binding, notification user binding, My Page self-activity routes를 현재 소스·current DB read-only 조회·local HTTP·current-build harness·표적 테스트로 대조했다. 결과와 예비 findings는 SECURITY_AUDIT_RESULTS_2026-09-08.md 9절에 기록했다.
- S06 1차: asset content/upload/presign/complete/cleanup/migrate controller, local/S3 storage, article asset link, survey answer/CMS references와 response headers를 현재 소스·current DB read-only aggregate·local HTTP·current-build harness·37개 표적 테스트로 대조했다. secret article에 연결된 asset의 scope-only read와 S3 presign 크기 조건 부재를 예비 finding으로 기록하고, 실제 S3 IAM/bucket 설정과 cleanup race는 미확인으로 남겼다. 결과는 SECURITY_AUDIT_RESULTS_2026-09-08.md 10절에 기록했다.
- S07 1차: survey controller/service/repository/schema/contract, eligibility·temporary caller, response ownership, file answer validation, branching, definition mutation, analytics, spreadsheet boundary를 현재 소스·current DB read-only aggregate·local HTTP·current-build harness·59개 설문 테스트로 대조했다. public survey metadata pass-through, mixed asset field ownership bypass, arbitrary survey asset reference publication을 예비 finding으로 기록했고, response/answer fixture와 전용 PostgreSQL 동시성 테스트 10개 skip은 미확인으로 남겼다. 결과는 SECURITY_AUDIT_RESULTS_2026-09-08.md 11절에 기록했다.
- S08 1차: 연락망·과비·감사 controller/service/repository/schema, XLSX export, Google Sheets client와 queue를 현재 소스·current DB read-only aggregate·local HTTP·ephemeral 권한 세션·current-build harness·18개 표적 테스트로 대조했다. public ContactRecord의 PII 범위, privacy 철회 행의 background Sheets egress, 과비 bulk 부분 커밋, 납부 재전송 idempotency 부재, 민감 export Cache-Control 부재, background sync audit gap을 예비 finding으로 기록했다. 현재 DB는 contacts 4건(동의 4·철회 0), departments 5건, users 3건, fee status/payment 0건, audit 154건, Sheets queue 2건(SUCCEEDED)이며 실제 Google/Drive ACL은 미확인이다. 결과는 SECURITY_AUDIT_RESULTS_2026-09-08.md 12절에 기록했다.
- S09 1차: board/article·survey·CMS rich-text 저장/복원/렌더링, ContentBlock URL scheme, 입력 상한과 실제 route validation, Drizzle/raw sink, roadmap import, 정규식 실행, auth/board/survey/email browser storage를 현재 소스·current DB/public HTTP·current-build harness·31개 표적 테스트로 대조했다. CMS javascript: link 보존, 계정 비분리 draft storage, administrator-controlled regex resource consumption을 예비 finding으로 기록했다. 현재 DB content block은 9건 모두 published이고 dangerous link scheme 0건, survey question 46건·regex 0건이며 실제 브라우저/외부 provider는 사용하지 않았다. 결과는 SECURITY_AUDIT_RESULTS_2026-09-08.md 13절에 기록했다.
- S10 1차: Google Sheets/Drive·Calendar·KAIST/ICS/공휴일 fetch, SMTP bulk delivery·idempotency·retry·BCC·attachment, ChannelTalk HMAC/로그아웃 identity path를 현재 source·current config/DB safe summary·local HTTP·current-build provider harness·11개 표적 테스트로 대조했다. SMTP 성공 뒤 DB status failure와 retry 재발송, ICS redirect 최종 URL 재검증 부재, public holiday provider timeout/response-size 부재, Google operations folder/ACL policy 확인 필요를 예비 finding으로 기록했다. 현재 external ICS URL은 0개, email dry-run/scheduler disabled, vote DB는 1건·voter 1건·ballot/tally 0건이며 실제 Google/OAuth/SMTP/KAIST/holiday/ChannelTalk provider는 호출하지 않았다. 결과는 SECURITY_AUDIT_RESULTS_2026-09-08.md 14절에 기록했다.
- S11 1차: vote public/admin/ballot/receipt/result route, eligibility·duplicate·close/tally·ballot secrecy, vote crypto key separation, health failure, MockModule registration timing, seed production/demo guard를 현재 source·current DB/public HTTP·current-build crypto/race/health/module harness와 3개 vote 테스트로 대조했다. 현재 DB는 vote 1건·voter 1건·ballot/tally 0건이며 public list/detail/invalid receipt는 200, admin/voter/ballot anonymous path는 401이었다. vote close/submit cutoff 재확인 부재, health raw error, launcher-dependent mock registration을 예비 finding으로 기록했다. 결과는 SECURITY_AUDIT_RESULTS_2026-09-08.md 15절에 기록했다.
- S12 1차: current registry `pnpm audit --prod/--json`, package/lock dependency path, local secret/path/history scan, lifecycle/source, Docker/Compose, GitHub Actions를 대조했다. runtime advisory 4건(Moderate 4, High/Critical 0)과 전체 17건(High 9, Moderate 6, Low 2, Critical 0)을 runtime·dev/build 경로로 분리했으며, ignored local credential material, SheetJS CDN tarball integrity 부재, API image root/non-minimal runtime, CI 전용 secret/container scan 부재를 기록했다. 결과는 SECURITY_AUDIT_RESULTS_2026-09-08.md 16절에 기록했다.
- S13 1차: API parser/upload/body limits, public calendar/survey/article, response/export/S3 buffering, bulk email fan-out, DB/Redis pool와 Redis eviction, queue stale lock/process-local scheduler, current Docker resource limits, Nginx/Compose, backup/restore evidence를 대조했다. 현재 smoke는 정상이고 route별 일부 상한은 존재하지만, global rate/timeout, unbounded materialization/cardinality, multi-replica stale-worker, Redis maxmemory, backup/restore drill/RPO-RTO 증거가 미확인이다. S13-F01~F04는 결과 문서 SECURITY_AUDIT_RESULTS_2026-09-08.md 17절에 기록했다.
- S14 1차: scope matrix의 route ID 1–196 연속성, 비HTTP 작업 13개 매핑, S02-S13의 43개 unique finding ID와 same-root 중복을 대조했다. 같은 원인은 중복 집계하지 않고 독립 sink는 분리했으며, exploit path와 production impact가 함께 검증된 Critical/High는 없고 S12-F02~F04는 설치 버전상 advisory 영향으로 수정 우선 항목으로 분류했다. 결과는 SECURITY_AUDIT_RESULTS_2026-09-08.md 18절에 기록했다.
- 현재 확정된 보안 취약점: S00/S01 범위 확정 단계에서는 없음. S02-S14의 source/dynamic/harness 검증 결과는 결과 문서의 예비 findings 및 S14 최종 분류를 따른다.
- 현재 예비 findings: S02-F01~F05, S03-F01~F02, S04-F01~F02, S05-F01~F03, S06-F01~F02, S07-F01~F03, S08-F01~F06, S09-F01~F03, S10-F01~F04, S11-F01~F03, S12-F01~F06, S13-F01~F04. source/deterministic local 재현과 현재 registry advisory는 확인했지만 현재 데이터 fixture, production route impact, 업무 정책, external exposure, 운영 rotation, load/failure/restore evidence가 일부 열려 있으므로 예비 severity로 유지한다.
- 다음 우선순위: 사용자 수정 요청 이후 S15에서 finding별 원인 제거·회귀 테스트·재검증.
- 실제 production readiness나 release 판단은 이 문서만으로 내리지 않는다.
