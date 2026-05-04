#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
COMPOSE_FILE="$ROOT_DIR/infra/docker/compose.dev.yml"

if [ -f "$ROOT_DIR/.env" ]; then
  # .env 파일에서 변수들을 읽어와 현재 쉘의 환경 변수로 등록합니다.
  export $(grep -v '^#' "$ROOT_DIR/.env" | xargs)
fi

POSTGRES_USER="${POSTGRES_USER}"
POSTGRES_PASSWORD="${POSTGRES_PASSWORD}"
POSTGRES_DB="${POSTGRES_DB}"
POSTGRES_HOST="${POSTGRES_HOST}"
POSTGRES_PORT="${POSTGRES_PORT}"
DATABASE_URL="${DATABASE_URL}"

docker compose -p soc_web -f "$COMPOSE_FILE" up -d postgres

cd "$ROOT_DIR"
DATABASE_URL="$DATABASE_URL" pnpm --filter @soc/api db:seed

echo "Seed completed"
exit 0