#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
# COMPOSE_FILE="$ROOT_DIR/infra/docker/compose.prod.yml"
COMPOSE_FILE="$ROOT_DIR/compose.yml"

if [ -f "$ROOT_DIR/.env" ]; then
  # .env 파일에서 변수들을 읽어와 현재 쉘의 환경 변수로 등록합니다.
  export $(grep -v '^#' "$ROOT_DIR/.env" | xargs)
fi

docker compose -p soc_web -f "$COMPOSE_FILE" up -d postgres

cd "$ROOT_DIR"
pnpm --filter @soc/api db:migrate
pnpm --filter @soc/api db:seed

echo "Seed completed"
exit 0
