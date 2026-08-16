# SoC Web

KAIST SoC 웹 모노레포입니다.

- Web: React + Vite
- API: NestJS
- Data: PostgreSQL 16, Redis 7
- Local runtime: Docker Compose + nginx
- UI 표기 규칙: [`docs/ui-conventions.md`](docs/ui-conventions.md)

## 요구 사항

- Docker Engine 및 Docker Compose v2
- 호스트에서 실행하거나 테스트할 때만 Node.js 20+ 및 pnpm 10+

## Docker로 로컬 실행

운영/사이트 테스트 배포의 기본 진입점은 루트 `compose.yml`입니다. 개발 환경은 `infra/docker/compose.dev.yml`로 명시적으로 선택합니다. 루트 maintenance seed는 기존 `pnpm db:seed`와 같은 결정적 사이트 테스트 fixture를 포함하지만, 운영 이미지에는 개발 로그인 endpoint가 포함되지 않습니다.

```bash
node infra/scripts/generate-dev-env.mjs
docker compose --env-file .env -f infra/docker/compose.dev.yml up -d --build
docker compose --env-file .env -f infra/docker/compose.dev.yml ps
```

브라우저는 `http://localhost:8080`으로 접속합니다.

- API: `http://127.0.0.1:3000`
- Web 개발 서버: `http://127.0.0.1:5173`
- nginx 통합 진입점: `http://localhost:8080`
- PostgreSQL: `localhost:5432`

`generate-dev-env.mjs`는 `.env.example`에서 `.env`를 만들고 JWT·PII·HMAC용 개발 키를 새로 생성합니다. 이 명령은 개발 환경에서만 실행하며 운영 호스트에서는 사용하지 않습니다.

실행 상태와 로그:

```bash
docker compose --env-file .env -f infra/docker/compose.dev.yml ps
docker compose --env-file .env -f infra/docker/compose.dev.yml logs -f api web db-migrate db-seed
curl http://127.0.0.1:3000/health/ready
```

포트 충돌 시 nginx 포트를 바꿉니다.

```bash
NGINX_PORT=18080 docker compose --env-file .env -f infra/docker/compose.dev.yml up -d --build
```

이 경우 `.env`의 `PUBLIC_ORIGIN`도 `http://localhost:18080`으로 맞춰야 쿠키 기반 POST 요청이 허용됩니다.

### 개발 계정 로그인

개발 Compose의 `db-seed`는 로컬 UI 검증을 위한 개발 fixture만 생성합니다. 이 서비스와 개발용 로그인 endpoint는 운영 Compose에서 실행되지 않습니다.

이 엔드포인트는 `NODE_ENV=development`에서만 동작하며 실제 SSO 자격 증명을 우회하기 위한 로컬 개발 전용 기능입니다.

### 중지와 초기화

```bash
# 컨테이너만 중지하고 DB/Redis 데이터는 유지
docker compose --env-file .env -f infra/docker/compose.dev.yml down

# DB/Redis 볼륨까지 삭제하고 완전히 초기화
docker compose --env-file .env -f infra/docker/compose.dev.yml down -v
```

`down -v` 뒤에는 개발 Compose 명령을 다시 실행하면 migration과 개발 fixture가 적용됩니다.

### 기본 게시판과 관리

빈 DB에는 migration으로 다음 게시판이 순서대로 생성됩니다.

`공지`, `행사`, `HoC`, `홍보글`, `건의사항 및 QnA`, `연구실`, `ESCamp`

표시 이름과 순서는 DB의 게시판 카탈로그가 기준이며, 헤더도 이 공개 카탈로그를 사용합니다. 글로벌 `BOARD_MANAGE` 권한이 있는 계정은 `/admin/boards`에서 게시판을 추가하거나 설정을 변경하고 빈 게시판을 삭제할 수 있습니다. 게시글 행이 하나라도 남아 있는 게시판은 보존 정책과 데이터 무결성을 위해 삭제되지 않으며 `board_has_articles` 충돌을 반환합니다.

기존 DB에서 관리자가 수정한 게시판 설정은 migration이 덮어쓰지 않습니다. 새 기본 명칭은 기존 seed 값 전체가 그대로인 행에만 적용됩니다.

## 운영 배포

운영 호스트에서는 개발용 `.env.example`을 복사하지 않습니다.

```bash
cp .env.production.example .env
node infra/scripts/verify-production-env.mjs --env-file .env
docker compose config --quiet
docker compose up -d --build
```

일반 배포는 `docker compose up -d --build`만 실행합니다. migration과 production seed는 API의 시작 의존성이 아니며, 승인된 maintenance 작업에서만 별도로 실행합니다.

```bash
# 스키마가 아직 최신이 아닌 경우: README의 staged migration 절차를 먼저 완료
docker compose --profile maintenance run --rm seed-production
```

`seed-production`은 기본 게시판·권한 정의 뒤에 기존 `pnpm db:seed`에서 사용하던 개발 관리자/사용자, 권한 부여, 게시글·행사·설문·투표·공약 fixture를 순서대로 실행합니다. fixture는 고정된 테스트 행을 idempotent하게 갱신하므로 사이트 검증 서버에서 반복 실행할 수 있습니다. 실제 운영 데이터에 fixture를 섞지 않을 때는 이 명령을 실행하지 말고, 별도의 개발 Compose를 사용합니다.

DB와 Redis를 버려도 되는 사이트 테스트 서버를 처음부터 재구성할 때는 다음 한 명령으로 초기화, migration, mock seed, 전체 서비스 기동을 수행합니다.

```bash
pnpm db:reset
```

이 명령은 `docker compose down -v`를 포함하므로 실제 보존 데이터가 있는 환경에서는 실행하지 않습니다. 테스트 서버에서는 production cutover 승인 게이트를 거치지 않는 일반 Drizzle migration을 적용한 뒤, `seed-production` fixture를 넣습니다.

```bash
docker compose --env-file .env -f infra/docker/compose.dev.yml up -d --build
pnpm db:seed:dev
```

### 최초 운영 관리자 bootstrap

사이트 테스트 seed에는 `development-admin` fixture 계정과 전체 권한이 포함됩니다. 실제 운영 관리자 계정은 fixture 계정에 의존하지 않고, PassNi SSO로 한 번 로그인한 사용자의 canonical SSO subject를 확인한 뒤 운영 `.env`에 일시적으로 다음 값을 넣습니다.

```dotenv
AUTHORIZATION_BOOTSTRAP_SSO_SUBJECT=<exact-canonical-sso-subject>
AUTHORIZATION_OPERATIONS_ENABLED=true
```

API를 재시작하고 해당 SSO 세션으로 `POST /api/permissions/bootstrap`을 한 번 호출합니다. 이 작업은 빈 권한 상태에서 한 번만 성공하며 audit log를 남깁니다. 완료 즉시 두 값을 비우고 `AUTHORIZATION_OPERATIONS_ENABLED=false`로 되돌린 뒤 API를 재시작합니다.

## API 구조화 보안 로그 운영

API는 관리자 설문 집계 요청의 성공, 권한 거부, 처리 오류를 응답 완료 시점에 구조화된 stdout 이벤트로 기록합니다. 이벤트에는 request ID, actor ID, survey ID, route version, outcome만 포함하며 응답 수·답변·쿠키·전화번호 등 PII는 기록하지 않습니다. 루트 `compose.yml`의 `json-file` 로그 수집기가 이를 보존하며 기본 한도는 파일당 20 MiB, 최대 10개입니다. 운영 환경에서는 `API_LOG_MAX_SIZE`와 `API_LOG_MAX_FILES`로 조정합니다.

로그 접근은 프로덕션 Docker 호스트 운영자에게만 허용합니다. request ID로 조회하며 애플리케이션 컨테이너 내부 파일을 직접 수정하지 않습니다.

```bash
docker compose logs api
```

로그 수집 실패나 회전은 API 응답을 실패시키지 않습니다. 보안 조사 시 같은 request ID의 reverse-proxy 기록과 API 이벤트를 함께 확인합니다.
## 설문 retention 운영

`retention` profile은 기본적으로 비활성화되어 있습니다. 비활성화 상태에서 profile을 올려도 scheduler는 한 번의 disabled 이벤트를 남기고 종료하며 `restart: "no"`이므로 restart loop가 생기지 않습니다. 활성화할 scheduler의 env와 alert owner/sink를 production `.env`에 모두 설정합니다.

```dotenv
SURVEY_RESPONSE_PURGE_ENABLED=true
SURVEY_RESPONSE_PURGE_CADENCE_SECONDS=900
SURVEY_RESPONSE_PURGE_BATCH_SIZE=100
SURVEY_RESPONSE_PURGE_ALERT_OWNER=team-or-oncall-owner
SURVEY_RESPONSE_PURGE_ALERT_SINK=https://alerts.example.invalid/survey-retention
SURVEY_IMAGE_CLEANUP_ENABLED=true
SURVEY_IMAGE_CLEANUP_CADENCE_SECONDS=900
SURVEY_IMAGE_CLEANUP_BATCH_SIZE=25
SURVEY_IMAGE_CLEANUP_GRACE_MS=3600000
SURVEY_IMAGE_CLEANUP_ALERT_OWNER=team-or-oncall-owner
SURVEY_IMAGE_CLEANUP_ALERT_SINK=https://alerts.example.invalid/survey-retention
```

시작, 관찰, 중지는 다음 명령을 사용합니다. disabled/configuration/cleanup/purge/backlog 이벤트와 `lastSuccessAt`을 alert owner가 감시합니다.

```bash
docker compose --env-file .env --profile retention up -d --build
docker compose --env-file .env logs -f survey-image-cleanup survey-response-purge
docker compose --env-file .env --profile retention stop survey-image-cleanup survey-response-purge
```

## 프로덕션 migration 0022 및 0024 cutover 운영 절차

`0022_survey_response_review_queue_index`는 승인된 유지보수 창에서만 적용합니다. 롤아웃 전 production과 동등한 데이터 규모의 rehearsal DB에서 전체 staged migration을 완료하고, 아래 response-review 페이지 조회의 `EXPLAIN (ANALYZE, BUFFERS)` 결과에 `survey_responses_review_queue_idx` 사용과 `LIMIT 50 + 1`을 기록합니다. rehearsal 또는 EXPLAIN 결과가 없거나 계획이 인덱스를 사용하지 않으면 롤아웃을 중단하고 원인을 해결한 뒤 rehearsal부터 다시 수행합니다.

```bash
psql "$DATABASE_URL" -v survey_id='REHEARSAL_SURVEY_UUID' -v state='SUBMITTED' <<'SQL'
EXPLAIN (ANALYZE, BUFFERS)
SELECT *
FROM "survey_responses"
WHERE "survey_id" = :'survey_id'::uuid
  AND "state" = :'state'
ORDER BY "submitted_at" DESC, "id" DESC
LIMIT 50 + 1;
SQL
```

0024는 future approval env를 미리 선언하지 않는다. 동일한 `CUTOVER_EVIDENCE_DIR`를 사용하여 순서대로 실행한다. `preflight`와 `migrate`는 Docker CLI로 `api`, `web`, `nginx`가 모두 멈췄는지, PostgreSQL에 active reader/writer가 없는지를 확인하므로 하나라도 실행 중이면 fail-closed 한다. backup은 실제 파일이어야 하며 marker는 해당 phase가 성공한 뒤에만 원자적으로 기록된다. timeout 발생 시 즉시 중단하고 새 승인 창에서 rehearsal과 EXPLAIN 검증부터 다시 수행한다.

```bash
export CUTOVER_EVIDENCE_DIR=/var/lib/soc-0024-cutover
export MIGRATION_MAINTENANCE_WINDOW=approved
export MIGRATION_REHEARSAL_COMPLETED=approved
export MIGRATION_RESPONSE_REVIEW_EXPLAIN_VERIFIED=approved
export MIGRATION_0024_CUTOVER_APPROVED=approved
export PII_ENCRYPTION_ACTIVE_KID PII_ENCRYPTION_KEYS_JSON
mkdir -p "$CUTOVER_EVIDENCE_DIR"
docker compose --env-file .env stop nginx web api
pg_dump --format=custom --file=/var/backups/soc-0024-before.dump "$DATABASE_URL"
MIGRATION_0024_BACKUP_PATH=/var/backups/soc-0024-before.dump MIGRATION_0024_PHASE=preflight \
  ./infra/scripts/db-migrate.sh --staged --maintenance-window --rehearsed --review-query-explained --0024-phase
MIGRATION_0024_PHASE=migrate \
  ./infra/scripts/db-migrate.sh --staged --maintenance-window --rehearsed --review-query-explained --0024-phase
```

migration 뒤 reconciliation query/결과를 증빙 파일에 저장한 뒤 `reconcile`을 실행한다. 그 다음 compatible artifact인 `api`와 `web`을 시작하고, 운영자가 접근 가능한 health endpoint로 smoke를 실행한다. 마지막 `reopen` marker 뒤에만 nginx를 시작해 외부 writer를 연다.

```bash
psql "$DATABASE_URL" -c 'SELECT count(*) AS section_items FROM "survey_section_items";' \
  > "$CUTOVER_EVIDENCE_DIR/reconcile.txt"
MIGRATION_0024_RECONCILIATION_EVIDENCE="$CUTOVER_EVIDENCE_DIR/reconcile.txt" MIGRATION_0024_PHASE=reconcile \
  ./infra/scripts/db-migrate.sh --staged --maintenance-window --rehearsed --review-query-explained --0024-phase
docker compose --env-file .env up -d --build api web
MIGRATION_0024_SMOKE_URL=https://maintenance.example.invalid/health MIGRATION_0024_PHASE=smoke \
  ./infra/scripts/db-migrate.sh --staged --maintenance-window --rehearsed --review-query-explained --0024-phase
MIGRATION_0024_PHASE=reopen \
  ./infra/scripts/db-migrate.sh --staged --maintenance-window --rehearsed --review-query-explained --0024-phase
docker compose --env-file .env up -d nginx
```

`approved` 값과 marker는 증빙 자체가 아니다. backup, reconciliation output, smoke output과 maintenance 기록을 변경 불가능한 배포 기록에 보관하며, marker 삭제/수정 또는 phase 순서 우회로 재개하지 않는다.

## 호스트에서 개발 서버 실행

먼저 DB와 Redis만 실행합니다.

```bash
docker compose --env-file .env -f infra/docker/compose.dev.yml up -d postgres redis
pnpm install
pnpm dev
```

호스트 Vite(`http://localhost:5173`)를 사용할 때는 `.env`의 `PUBLIC_ORIGIN`을 `http://localhost:5173`으로 변경해야 합니다. `VITE_API_PROXY_TARGET=http://localhost:3000`이 `/api` 요청을 API 서버로 프록시합니다.

개별 실행:

```bash
pnpm dev:api
pnpm dev:web
```

## 환경 설정

`.env.example`은 로컬 Docker 기본값과 모든 필수 환경 변수의 형태를 제공합니다. 다음 값은 생성 스크립트가 안전한 랜덤 값으로 채웁니다.

- `AUTH_JWT_*`
- `AUTH_PENDING_LOGIN_ENCRYPTION_KEY`
- `PII_ENCRYPTION_*`
- `SURVEY_PHONE_HASH_HMAC_KEY`
- `SSO_CLIENT_SECRET`

실제 SSO를 검증할 때만 발급받은 `VITE_SSO_CLIENT_ID`, `SSO_CLIENT_SECRET`, redirect URI와 API URL로 교체합니다. 로컬 개발 계정 로그인에는 실제 SSO 설정이 필요하지 않습니다.

운영 배포는 루트 `compose.yml`을 사용하며 API가 `NODE_ENV=production`으로 실행됩니다. 운영 `.env`는 [`.env.production.example`](.env.production.example)을 기준으로 만들고, 배포 전 환경변수 검증을 통과해야 합니다.

```env
PUBLIC_ORIGIN=https://soc-student-council.kws.inet.sparcs.net
VITE_SSO_REDIRECT_URI=https://soc-student-council.kws.inet.sparcs.net/api/auth/login
VITE_SSO_LOGIN_URL=https://sso.kaist.ac.kr/auth/user/single/login/authorize
VITE_SSO_CLIENT_ID=<issued-client-id>
SSO_AUTH_API_URL=https://sso.kaist.ac.kr/auth/api/single/auth
SSO_CLIENT_SECRET=<issued-client-secret>
```

운영에서 `local-development`, `http://localhost:3000/...`, placeholder secret을 사용하면 API가 시작되지 않도록 검증합니다. 실제 발급 secret인지 여부는 배포 전 PassNi 설정과 대조해야 합니다. PostgreSQL 비밀번호에 URL 예약문자가 들어가면 `DATABASE_URL` 안에서는 percent-encoding하고, `POSTGRES_PASSWORD`에는 원문을 유지합니다.

## 검증 명령

```bash
node infra/scripts/verify-production-env.mjs --env-file .env
docker compose --env-file .env config --quiet
pnpm typecheck
pnpm build
pnpm test
pnpm test:migrations
pnpm test:api:http
pnpm test:web:unit
```

전체 API 테스트에는 폐기 가능한 로컬 PostgreSQL(`soc_web_test_*`)과 Redis가 필요합니다. 개발 Compose의 PostgreSQL에 테스트 전용 DB를 한 번 만든 뒤 아래처럼 지정합니다. CI는 동일한 구성을 서비스 컨테이너로 자동 제공합니다.

```bash
docker compose --env-file .env -f infra/docker/compose.dev.yml exec -T postgres \
  psql -U soc -d soc_web -c 'CREATE DATABASE soc_web_test_local;'
TEST_DATABASE_URL=postgresql://soc:soc@127.0.0.1:5432/soc_web_test_local \
TEST_REDIS_URL=redis://127.0.0.1:6379 \
pnpm test
```
