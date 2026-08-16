#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
COMPOSE_FILE_PATH="${COMPOSE_FILE_PATH:-$ROOT_DIR/infra/docker/compose.dev.yml}"
ENV_FILE_PATH="${ENV_FILE_PATH:-$ROOT_DIR/.env}"

[[ -f "$COMPOSE_FILE_PATH" ]] || { echo "Compose file not found: $COMPOSE_FILE_PATH" >&2; exit 1; }
[[ -f "$ENV_FILE_PATH" ]] || { echo "Environment file not found: $ENV_FILE_PATH" >&2; exit 1; }

docker compose \
  --env-file "$ENV_FILE_PATH" \
  -f "$COMPOSE_FILE_PATH" \
  run --rm db-seed

echo "Development seed completed"
