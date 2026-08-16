#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
COMPOSE_FILE_PATH="${COMPOSE_FILE_PATH:-$ROOT_DIR/compose.yml}"
ENV_FILE_PATH="${ENV_FILE_PATH:-$ROOT_DIR/.env}"

if [[ ! -f "$COMPOSE_FILE_PATH" ]]; then
  echo "Compose file not found: $COMPOSE_FILE_PATH" >&2
  exit 1
fi

if [[ ! -f "$ENV_FILE_PATH" ]]; then
  echo "Environment file not found: $ENV_FILE_PATH" >&2
  echo "Run 'node infra/scripts/generate-dev-env.mjs' first, or set ENV_FILE_PATH to a valid .env file." >&2
  exit 1
fi

# Production seed is an explicit maintenance operation. It is never a
# dependency of the serving API and therefore cannot run during every deploy.
docker compose \
  --env-file "$ENV_FILE_PATH" \
  -f "$COMPOSE_FILE_PATH" \
  --profile maintenance \
  run --rm seed-production

echo "Production seed completed"
