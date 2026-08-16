#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"

cd "$ROOT_DIR"

if [[ ! -f "$ROOT_DIR/.env" ]]; then
  echo "Environment file not found: $ROOT_DIR/.env" >&2
  echo "Create the test server .env first, then run 'pnpm db:reset'." >&2
  exit 1
fi

echo "Resetting disposable test database and Redis volumes..."
docker compose down -v

echo "Starting PostgreSQL and Redis..."
docker compose up -d --build postgres redis

echo "Applying migrations without the production cutover gates..."
docker compose --profile maintenance run --rm db-migrate \
  pnpm --filter @soc/api db:migrate

echo "Loading site-test users, permissions, and mock content..."
docker compose --profile maintenance run --rm seed-production

echo "Building and starting the test site..."
docker compose up -d --build

echo "Test reset completed"
