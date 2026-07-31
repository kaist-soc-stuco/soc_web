#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
CONTAINER_NAME="soc-migrations-test-$(< /proc/sys/kernel/random/uuid)"
POSTGRES_DB="migration_test"
POSTGRES_USER="migration_test"
POSTGRES_PASSWORD="migration_test"
CONTAINER_CREATED=false
DATABASE_URL="${MIGRATION_TEST_DATABASE_URL:-}"
PSQL_BIN="${PSQL_BIN:-psql}"

cleanup() {
  if [[ "$CONTAINER_CREATED" == true ]]; then
    docker rm --force "$CONTAINER_NAME" >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

query_database() {
  local statement="$1"
  if [[ -n "${MIGRATION_TEST_DATABASE_URL:-}" ]]; then
    "$PSQL_BIN" "$DATABASE_URL" --set ON_ERROR_STOP=1 --tuples-only --no-align --command "$statement"
  else
    docker exec "$CONTAINER_NAME" psql --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" --set ON_ERROR_STOP=1 --tuples-only --no-align --command "$statement"
  fi
}

if [[ -n "$DATABASE_URL" ]]; then
  if [[ "$DATABASE_URL" != postgresql://* && "$DATABASE_URL" != postgres://* ]]; then
    echo "MIGRATION_TEST_DATABASE_URL must be a PostgreSQL URL" >&2
    exit 1
  fi
  if ! command -v "$PSQL_BIN" >/dev/null 2>&1 && [[ ! -x "$PSQL_BIN" ]]; then
    echo "PSQL_BIN is not executable: $PSQL_BIN" >&2
    exit 1
  fi
  query_database 'SELECT 1;' >/dev/null
else
  docker run --detach --rm \
    --name "$CONTAINER_NAME" \
    --env "POSTGRES_DB=$POSTGRES_DB" \
    --env "POSTGRES_USER=$POSTGRES_USER" \
    --env "POSTGRES_PASSWORD=$POSTGRES_PASSWORD" \
    --publish "127.0.0.1::5432" \
    postgres:16-alpine >/dev/null
  CONTAINER_CREATED=true

  for attempt in {1..30}; do
    if docker exec "$CONTAINER_NAME" pg_isready --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" >/dev/null; then
      break
    fi
    if [[ "$attempt" == "30" ]]; then
      echo "Postgres did not become ready for migration test" >&2
      exit 1
    fi
    sleep 1
  done

  port_mapping="$(docker port "$CONTAINER_NAME" 5432/tcp)"
  POSTGRES_PORT="${port_mapping##*:}"
  DATABASE_URL="postgresql://$POSTGRES_USER:$POSTGRES_PASSWORD@127.0.0.1:$POSTGRES_PORT/$POSTGRES_DB?sslmode=disable"
fi

node "$SCRIPT_DIR/verify-migrations.mjs"
DATABASE_URL="$DATABASE_URL" pnpm --dir "$ROOT_DIR/apps/api" run db:migrate
migration_ledger_before="$(query_database 'SELECT id, hash, created_at FROM "drizzle"."__drizzle_migrations" ORDER BY id;')"
DATABASE_URL="$DATABASE_URL" pnpm --dir "$ROOT_DIR/apps/api" run db:migrate
migration_ledger_after="$(query_database 'SELECT id, hash, created_at FROM "drizzle"."__drizzle_migrations" ORDER BY id;')"
if [[ "$migration_ledger_after" != "$migration_ledger_before" ]]; then
  echo "Migration ledger changed after a second migrate" >&2
  exit 1
fi

users_table="$(query_database "SELECT to_regclass('public.users');")"
if [[ "$users_table" != "users" ]]; then
  echo "Migration test did not create the users table" >&2
  exit 1
fi

expected_migrations="$(node --eval "process.stdout.write(String(JSON.parse(require('node:fs').readFileSync(process.argv[1], 'utf8')).entries.length))" "$ROOT_DIR/apps/api/drizzle/meta/_journal.json")"
applied_migrations="$(query_database 'SELECT count(*) FROM "drizzle"."__drizzle_migrations";')"
if [[ "$applied_migrations" != "$expected_migrations" ]]; then
  echo "Migration journal count mismatch: expected $expected_migrations, found $applied_migrations" >&2
  exit 1
fi

# Re-run the reconciliation SQL against an upgraded-style fixture. The test
# database is disposable, so this can prove exact-fingerprint updates without
# rewriting migration history or touching a developer database.
query_database "UPDATE boards SET title_kr = '집행위 공지' WHERE code = 'soc-notice'; UPDATE boards SET title_kr = '관리자 행사' WHERE code = 'soc-events';" >/dev/null
board_timestamps_before="$(query_database "SELECT code || '|' || created_at || '|' || updated_at FROM boards WHERE code IN ('soc-notice', 'soc-events') ORDER BY code;")"
query_database "$(< "$ROOT_DIR/apps/api/drizzle/0015_board_title_reconciliation.sql")" >/dev/null
reconciled_notice="$(query_database "SELECT title_kr FROM boards WHERE code = 'soc-notice';")"
customized_events="$(query_database "SELECT title_kr FROM boards WHERE code = 'soc-events';")"
board_timestamps_after="$(query_database "SELECT code || '|' || created_at || '|' || updated_at FROM boards WHERE code IN ('soc-notice', 'soc-events') ORDER BY code;")"
if [[ "$reconciled_notice" != "공지" || "$customized_events" != "관리자 행사" ]]; then
  echo "Board title reconciliation did not preserve the exact-fingerprint boundary" >&2
  exit 1
fi
if [[ "$board_timestamps_after" != "$board_timestamps_before" ]]; then
  echo "Board title reconciliation changed board timestamps" >&2
  exit 1
fi

echo "Migration test passed"
