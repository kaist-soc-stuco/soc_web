#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
COMPOSE_FILE="$ROOT_DIR/infra/docker/compose.dev.yml"
MIGRATIONS_DIR="$ROOT_DIR/apps/api/src/infrastructure/postgres/migrations"

if [[ ! -d "$MIGRATIONS_DIR" ]]; then
  echo "Migrations directory not found: $MIGRATIONS_DIR"
  exit 1
fi

migration_files=("$MIGRATIONS_DIR"/*.sql)

if [[ ${#migration_files[@]} -eq 0 ]]; then
  echo "No migration files found in: $MIGRATIONS_DIR"
  exit 0
fi

for migration_file in "${migration_files[@]}"; do
  echo "Applying migration: $migration_file"
  docker compose -f "$COMPOSE_FILE" exec -T postgres \
    psql -v ON_ERROR_STOP=1 -U "${POSTGRES_USER:-soc}" -d "${POSTGRES_DB:-soc_web}" < "$migration_file"
done

echo "Migrations completed"
