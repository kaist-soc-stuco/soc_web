#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
COMPOSE_FILE="$ROOT_DIR/infra/docker/compose.dev.yml"

docker compose -f "$COMPOSE_FILE" exec -T postgres psql \
  -U "${POSTGRES_USER:-soc}" -d "${POSTGRES_DB:-soc_web}" <<'SQL'
INSERT INTO demo_events (event_name)
VALUES ('seeded-event')
ON CONFLICT DO NOTHING;
SQL

echo "Seed completed"
