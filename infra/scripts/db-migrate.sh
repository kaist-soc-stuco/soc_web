#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
COMPOSE_FILE="$ROOT_DIR/infra/docker/compose.dev.yml"
MIGRATION_FILE="$ROOT_DIR/apps/api/src/database/postgres/migrations/001_init.sql"

if [[ ! -f "$MIGRATION_FILE" ]]; then
  echo "Migration file not found: $MIGRATION_FILE"
  exit 1
fi

docker compose -f "$COMPOSE_FILE" exec -T postgres \
  psql -U "${POSTGRES_USER:-soc}" -d "${POSTGRES_DB:-soc_web}" < "$MIGRATION_FILE"

echo "Migration completed: $MIGRATION_FILE"
