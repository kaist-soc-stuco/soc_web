# Operations Runbook

운영자가 정기적으로 확인하거나 장애 대응 시 참고할 절차를 모아둔 문서입니다.

## Deployment Preflight

배포 직전에는 아래 명령을 한 번에 확인합니다.

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

`pnpm db:seed`는 배포 전 검증 명령이 아닙니다. `SEED_MODE=demo`는 개발용 샘플 데이터를 정리하고 다시 만들기 때문에 production에서 실행이 차단됩니다. 운영에서 권한·게시판 기준 데이터만 맞춰야 할 때에만 `SEED_MODE=reference pnpm db:seed`를 명시적으로 사용합니다.

## DB Migration And Seed

`apps/api/drizzle/0000_baseline.sql`은 빈 PostgreSQL용 기준 스키마이며, 이후 번호의 migration을 순서대로 적용합니다. 운영 DB에는 적용 이력이 남은 migration 파일을 삭제하거나 다시 squash하지 않습니다. 최초 운영 배포는 개발 DB volume을 복사하지 말고 빈 DB에서 migration 전체를 재현합니다.

운영 최초 배포:

```bash
docker compose --env-file .env.production -f infra/docker/compose.prod.yml run --rm db-migrate
docker compose --env-file .env.production -f infra/docker/compose.prod.yml run --rm \
  -e SEED_MODE=reference api pnpm db:seed
```

reference seed는 권한·게시판·상시 신청형 설문과 `최고 관리자` 시스템 역할만 생성하며 개발 사용자나 샘플 콘텐츠를 만들지 않습니다. `.env.production`의 `INITIAL__ADMIN_STDNOS`에 쉼표로 구분한 8자리 학번을 설정하면 해당 사용자가 SSO로 영구 계정을 만들거나 다시 로그인할 때 `최고 관리자` 역할이 부여됩니다. 목록에서 학번을 제거해도 이미 부여된 역할은 자동 회수하지 않으므로 관리자 화면에서 명시적으로 회수합니다.

로컬 compose 기준:

```bash
pnpm db:migrate
SEED_MODE=demo pnpm db:seed
```

API 워크스페이스 단독 확인:

```bash
set -a && source .env && set +a
pnpm --filter @soc/api db:generate
pnpm --filter @soc/api db:migrate
SEED_MODE=demo pnpm --filter @soc/api db:seed
```

정상 로그 기준:

- `No schema changes, nothing to migrate` 또는 `migrations applied successfully`
- `Upserted 16 permission(s)`
- `Upserted the initial administrator system role`
- `Upserted 7 board(s)`
- `Seeded ... articles`
- `Seed finished`

`db:seed`는 일회성 runner인 `ts-node --transpile-only`로 실행되어야 하며, 완료 후 프로세스가 남지 않아야 합니다.

## Auth And Permission Smoke QA

배포 후 로그인/권한은 최소 아래 흐름을 확인합니다.

1. 비로그인 사용자가 공개 게시판과 공개 설문을 볼 수 있는지 확인합니다.
2. 비로그인 사용자가 로그인 전용/관리자 전용 리소스에 접근할 때 차단되는지 확인합니다.
3. 일반 사용자가 비공개 설문 결과와 미공개 설문에 접근할 때 차단되는지 확인합니다.
4. 설문 관리자 권한 사용자가 미공개 설문 preview와 비공개 결과를 볼 수 있는지 확인합니다.
5. 회비 납부자 전용 설문/행사는 백엔드 응답 기준으로 차단되는지 확인합니다.
6. production에서는 mock login endpoint가 막혀 있어야 합니다.
7. `INITIAL__ADMIN_STDNOS`에 포함된 학번은 첫 개인정보 동의 직후 최고 관리자 메뉴에 접근할 수 있어야 합니다.
8. 목록에 없는 일반 사용자는 기본 권한만 받아야 합니다.

## Backup And Restore Rehearsal

배포 및 migration 직전 PostgreSQL 백업을 만들고, 별도 임시 DB에서 복원 여부를 확인합니다. 백업 파일과 `VOTE_BALLOT_ENCRYPTION_KEY`는 함께 보존해야 기존 투표 데이터를 복호화할 수 있습니다.

```bash
docker compose --env-file .env.production -f infra/docker/compose.prod.yml exec -T postgres \
  pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc > "soc-web-$(date +%Y%m%d-%H%M).dump"
```

Google OAuth client/token, 서비스 계정 파일과 S3 데이터도 DB와 별도로 백업합니다. 백업 파일은 Git 저장소와 웹 서버 공개 경로에 두지 않습니다.

관련 자동 테스트:

```bash
pnpm --filter @soc/api test
pnpm --filter @soc/web test
```

## Google Survey Sheets OAuth

설문 결과 시트는 Gmail과 분리된 Google Drive·Sheets 사용자 OAuth로 연결합니다. 최초 배포 또는 refresh token 교체 시에만 아래 명령을 실행합니다.

```bash
pnpm --filter @soc/api google:oauth:authorize
```

브라우저에서 운영 Google 계정으로 로그인하고 `drive.file` 및 운영 폴더 메타데이터를 확인하는 `drive.metadata.readonly` 범위를 승인합니다. 두 범위는 앱이 만든 Google Sheets의 생성·수정과 지정 폴더 확인에만 사용하며 Gmail에는 접근하지 않습니다. 완료 후 생성되는 `secrets/google-oauth-token.json`은 서버 비밀 파일로 배포하며 Git에 커밋하지 않습니다. API 컨테이너에는 OAuth client와 token 파일을 모두 읽기 전용으로 마운트합니다.

OAuth 동의 화면의 publishing status가 `Testing`이면 refresh token은 7일 후 만료됩니다. 장기 운영 전 `In production`으로 전환한 다음 위 명령으로 최종 토큰을 한 번 다시 발급합니다. 이후에는 사용자가 접근 권한을 취소하거나 토큰이 장기간 사용되지 않는 등의 예외가 아니면 재로그인이 필요하지 않습니다.

`.env`와 `.env.production`의 `GOOGLE_OPERATIONS_FOLDER_ID`에는 과비 납부·집행위 연락망·설문 응답 시트를 모을 공통 Drive 폴더 ID를 지정합니다. 설문 응답 시트는 초안이 최초 게시되는 시점에 자동 생성되며, 연동에 실패한 경우 응답 관리 화면의 재시도 액션으로 복구합니다. Gmail 받은편지함·보낸편지함에는 접근하지 않습니다.

## Log Check

로컬 compose:

```bash
docker compose -p soc_web -f compose.yml ps
docker compose -p soc_web -f compose.yml logs --tail=200 api
docker compose -p soc_web -f compose.yml logs --tail=200 web
docker compose -p soc_web -f compose.yml logs --tail=200 postgres
```

운영 compose:

```bash
docker compose --env-file .env.production -p soc_web -f infra/docker/compose.prod.yml ps
docker compose --env-file .env.production -p soc_web -f infra/docker/compose.prod.yml logs --tail=200 api
docker compose --env-file .env.production -p soc_web -f infra/docker/compose.prod.yml logs --tail=200 web
docker compose --env-file .env.production -p soc_web -f infra/docker/compose.prod.yml logs --tail=200 postgres
```

실시간 확인:

```bash
docker compose -p soc_web -f compose.yml logs -f api web
```

우선 확인할 로그:

- API 시작 시 env validation 실패
- DB 연결 실패, migration 실패, seed validation 실패
- SSO callback 실패, cookie `SameSite`/`Secure`/origin 관련 경고
- `/uploads/assets/*` 404 또는 reverse proxy 502
- 설문 제출 400/403/404
- 게시글 작성/수정 upload 실패

## Upload Orphan Cleanup

게시글 작성 중 업로드했지만 최종 게시글에 연결되지 않은 파일은 `asset` 레코드와 로컬 업로드 파일로 남을 수 있습니다.
현재 단계에서는 별도 관리자 UI를 만들지 않습니다. 운영자가 수동 API를 호출할 수 있고, 단일 runner로 지정한 API 프로세스에서만 자동 정리를 켤 수 있습니다.

### 전제

- 관리자 권한을 가진 계정으로 인증되어 있어야 합니다.
- 정리 기준 시간은 `ASSET_ORPHAN_GRACE_HOURS`로 조정합니다.
- 기본값은 24시간입니다.
- 자동 점검은 `ASSET_ORPHAN_CLEANUP_ENABLED=true`인 API 프로세스에서만 실행합니다.
- 기본값은 false입니다.
- 자동 점검 주기는 `ASSET_ORPHAN_CLEANUP_INTERVAL_HOURS`로 조정합니다.
- 기본값은 6시간입니다.
- 서버 시작 직후 바로 삭제하지 않고, 다음 점검 주기부터 실행합니다.
- 연결된 게시글 파일은 삭제하지 않습니다.

### 자동 실행

`ASSET_ORPHAN_CLEANUP_ENABLED=true`로 설정된 API 서버는 `ASSET_ORPHAN_CLEANUP_INTERVAL_HOURS` 간격으로 자동 점검합니다.
삭제 대상은 항상 `ASSET_ORPHAN_GRACE_HOURS`보다 오래된 미연결 asset으로 제한합니다.

예시:

```env
ASSET_ORPHAN_GRACE_HOURS=24
ASSET_ORPHAN_CLEANUP_ENABLED=true
ASSET_ORPHAN_CLEANUP_INTERVAL_HOURS=6
```

위 설정은 6시간마다 점검하되, 업로드 후 24시간이 지나지 않은 파일은 삭제하지 않습니다.
API replica를 둘 때는 별도 worker 또는 distributed lock을 도입하기 전까지 runner 1개에만 `ASSET_ORPHAN_CLEANUP_ENABLED=true`를 지정합니다.

### 수동 실행

```bash
curl -X POST "$API_BASE_URL/v1/assets/cleanup-orphans" \
  -H "Authorization: Bearer $ACCESS_TOKEN"
```

응답 예시:

```json
{
  "scanned": 3,
  "deleted": 3,
  "failed": 0,
  "olderThanHours": 24
}
```

### 운영 기준

- 배포 직후 자동 점검을 켰더라도 grace window 때문에 최근 업로드 파일은 삭제되지 않습니다.
- 운영자가 즉시 정리가 필요하다고 판단하면 수동 API를 호출합니다.
- 삭제 대상이 예상보다 많으면 즉시 재실행하지 말고, 업로드 실패 로그와 게시글 작성 오류를 먼저 확인합니다.
- local filesystem 기반 업로드를 유지하는 동안 API replica에서 자동 정리를 중복 실행하지 않습니다.
