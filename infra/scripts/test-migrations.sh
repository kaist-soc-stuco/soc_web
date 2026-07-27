#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
CONTAINER_NAME="soc-migrations-test-$(< /proc/sys/kernel/random/uuid)"
POSTGRES_DB="migration_test"
POSTGRES_USER="migration_test"
POSTGRES_PASSWORD="migration_test"
CONTAINER_CREATED=false

cleanup() {
  if [[ "$CONTAINER_CREATED" == true ]]; then
    docker rm --force "$CONTAINER_NAME" >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM


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

node "$SCRIPT_DIR/verify-migrations.mjs"
DATABASE_URL="$DATABASE_URL" pnpm --dir "$ROOT_DIR/apps/api" run db:migrate
migration_ledger_before="$(docker exec "$CONTAINER_NAME" psql --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" --tuples-only --no-align --command 'SELECT id, hash, created_at FROM "drizzle"."__drizzle_migrations" ORDER BY id;')"
DATABASE_URL="$DATABASE_URL" pnpm --dir "$ROOT_DIR/apps/api" run db:migrate
migration_ledger_after="$(docker exec "$CONTAINER_NAME" psql --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" --tuples-only --no-align --command 'SELECT id, hash, created_at FROM "drizzle"."__drizzle_migrations" ORDER BY id;')"
if [[ "$migration_ledger_after" != "$migration_ledger_before" ]]; then
  echo "Migration ledger changed after a second migrate" >&2
  exit 1
fi

users_table="$(docker exec "$CONTAINER_NAME" psql --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" --tuples-only --no-align --command "SELECT to_regclass('public.users');")"
if [[ "$users_table" != "users" ]]; then
  echo "Migration test did not create the users table" >&2
  exit 1
fi

expected_migrations="$(node --eval "process.stdout.write(String(JSON.parse(require('node:fs').readFileSync(process.argv[1], 'utf8')).entries.length))" "$ROOT_DIR/apps/api/drizzle/meta/_journal.json")"
applied_migrations="$(docker exec "$CONTAINER_NAME" psql --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" --tuples-only --no-align --command 'SELECT count(*) FROM "drizzle"."__drizzle_migrations";')"
if [[ "$applied_migrations" != "$expected_migrations" ]]; then
  echo "Migration journal count mismatch: expected $expected_migrations, found $applied_migrations" >&2
  exit 1
fi

echo "Migration test passed"
