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
- `Upserted 9 permission(s)`
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

관련 자동 테스트:

```bash
pnpm --filter @soc/api test
pnpm --filter @soc/web test
```

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
docker compose -p soc_web -f infra/docker/compose.prod.yml ps
docker compose -p soc_web -f infra/docker/compose.prod.yml logs --tail=200 api
docker compose -p soc_web -f infra/docker/compose.prod.yml logs --tail=200 web
docker compose -p soc_web -f infra/docker/compose.prod.yml logs --tail=200 postgres
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
