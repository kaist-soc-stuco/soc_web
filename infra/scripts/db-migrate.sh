#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
COMPOSE_FILE_PATH="${COMPOSE_FILE_PATH:-$ROOT_DIR/compose.yml}"
API_DIR="$ROOT_DIR/apps/api"

: "${DATABASE_URL:?DATABASE_URL is required}"
: "${CUTOVER_EVIDENCE_DIR:?CUTOVER_EVIDENCE_DIR is required}"
: "${MIGRATION_0024_PHASE:?MIGRATION_0024_PHASE is required}"

if [[ "$#" -ne 5 || "$1" != "--staged" || "$2" != "--maintenance-window" || "$3" != "--rehearsed" || "$4" != "--review-query-explained" || "$5" != "--0024-phase" ]]; then
  echo "Refusing unrestricted migration. Use the staged maintenance flags and MIGRATION_0024_PHASE." >&2
  exit 2
fi

for gate in MIGRATION_MAINTENANCE_WINDOW MIGRATION_REHEARSAL_COMPLETED MIGRATION_RESPONSE_REVIEW_EXPLAIN_VERIFIED; do
  : "${!gate:?$gate is required}"
  if [[ "${!gate}" != "approved" ]]; then
    echo "Refusing migration until $gate=approved." >&2
    exit 2
  fi
done

case "$MIGRATION_0024_PHASE" in
  preflight|migrate|reconcile|smoke|reopen) ;;
  *) echo "MIGRATION_0024_PHASE must be preflight, migrate, reconcile, smoke, or reopen." >&2; exit 2 ;;
esac

umask 077
mkdir -p "$CUTOVER_EVIDENCE_DIR"
marker_path() { printf '%s/0024-%s.complete\n' "$CUTOVER_EVIDENCE_DIR" "$1"; }
require_marker() {
  local marker
  marker="$(marker_path "$1")"
  [[ -s "$marker" ]] || { echo "Refusing 0024 $MIGRATION_0024_PHASE phase: missing completed $1 evidence marker." >&2; exit 2; }
}
record_marker() {
  local phase="$1" marker temporary
  marker="$(marker_path "$phase")"
  [[ ! -e "$marker" ]] || { echo "Refusing 0024 $phase phase: evidence marker already exists." >&2; exit 2; }
  temporary="$(mktemp "$CUTOVER_EVIDENCE_DIR/.0024-${phase}.XXXXXX")"
  printf '{"phase":"%s","completedAt":"%s","operator":"%s"}\n' "$phase" "$(date -u +%FT%TZ)" "${USER:-unknown}" > "$temporary"
  mv "$temporary" "$marker"
}

require_quiescent_services() {
  command -v docker >/dev/null || { echo "Refusing 0024 cutover: Docker CLI is required to verify serving containers are stopped." >&2; exit 2; }
  local running
  running="$(docker compose -f "$COMPOSE_FILE_PATH" ps --status running --services api web nginx 2>/dev/null || true)"
  [[ -z "$running" ]] || { echo "Refusing 0024 cutover while serving containers are active: $running" >&2; exit 2; }
}
require_no_active_database_clients() {
  (
    cd "$API_DIR"
    node --input-type=module <<'EOF'
import { Pool } from "pg";
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
try {
  const { rows } = await pool.query(`
    SELECT count(*)::integer AS count
    FROM pg_stat_activity
    WHERE datname = current_database()
      AND pid <> pg_backend_pid()
      AND backend_type = 'client backend'
      AND state = 'active'
  `);
  if (rows[0].count !== 0) {
    throw new Error(`active database readers/writers: ${rows[0].count}`);
  }
} finally {
  await pool.end();
}
EOF
  )
}

run_migrations() {
  local migrations_dir="$1"
  (
    cd "$API_DIR"
    MIGRATIONS_DIR="$migrations_dir" node --input-type=module <<'EOF'
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';

const pool = new Pool({ connectionString: process.env.DATABASE_URL, options: '-c lock_timeout=5000 -c statement_timeout=30000' });
try {
  await migrate(drizzle(pool), { migrationsFolder: process.env.MIGRATIONS_DIR });
} finally {
  await pool.end();
}
EOF
  )
}

case "$MIGRATION_0024_PHASE" in
  preflight)
    for prior_phase in preflight migrate reconcile smoke reopen; do
      [[ ! -e "$(marker_path "$prior_phase")" ]] || { echo "Refusing 0024 preflight: evidence directory is not empty." >&2; exit 2; }
    done
    : "${MIGRATION_0024_CUTOVER_APPROVED:?MIGRATION_0024_CUTOVER_APPROVED is required}"
    : "${MIGRATION_0024_BACKUP_PATH:?MIGRATION_0024_BACKUP_PATH is required}"
    [[ "$MIGRATION_0024_CUTOVER_APPROVED" == "approved" ]] || { echo "Refusing unapproved 0024 cutover." >&2; exit 2; }
    [[ -s "$MIGRATION_0024_BACKUP_PATH" ]] || { echo "Refusing 0024 cutover: backup file is missing or empty." >&2; exit 2; }
    require_quiescent_services
    require_no_active_database_clients
    record_marker preflight
    echo "0024 preflight completed: services quiesced and backup recorded."
    ;;
  migrate)
    require_marker preflight
    require_quiescent_services
    require_no_active_database_clients
    : "${PII_ENCRYPTION_ACTIVE_KID:?PII_ENCRYPTION_ACTIVE_KID is required for the PII backfill}"
    : "${PII_ENCRYPTION_KEYS_JSON:?PII_ENCRYPTION_KEYS_JSON is required for the PII backfill}"
    tmp_dir="$(mktemp -d)"
    trap 'rm -rf "$tmp_dir"' EXIT
    cp -R "$API_DIR/drizzle" "$tmp_dir/drizzle"
    rm "$tmp_dir/drizzle/0013_phase2_pii_contract_gate.sql"
    node -e '
const fs = require("fs");
const path = process.argv[1];
const journal = JSON.parse(fs.readFileSync(path, "utf8"));
journal.entries = journal.entries.filter((entry) => entry.idx < 13);
fs.writeFileSync(path, JSON.stringify(journal, null, 2) + "\n");
' "$tmp_dir/drizzle/meta/_journal.json"
    run_migrations "$tmp_dir/drizzle"
    ( cd "$API_DIR"; pnpm exec ts-node --transpile-only src/commands/user-pii-backfill.ts )
    run_migrations "$API_DIR/drizzle"
    record_marker migrate
    echo "0024 migration phase completed."
    ;;
  reconcile)
    require_marker migrate
    : "${MIGRATION_0024_RECONCILIATION_EVIDENCE:?MIGRATION_0024_RECONCILIATION_EVIDENCE is required}"
    [[ -s "$MIGRATION_0024_RECONCILIATION_EVIDENCE" ]] || { echo "Refusing 0024 reconciliation: evidence file is missing or empty." >&2; exit 2; }
    record_marker reconcile
    echo "0024 reconciliation evidence recorded."
    ;;
  smoke)
    require_marker reconcile
    : "${MIGRATION_0024_SMOKE_URL:?MIGRATION_0024_SMOKE_URL is required}"
    curl --fail --silent --show-error --max-time 30 "$MIGRATION_0024_SMOKE_URL" >/dev/null
    record_marker smoke
    echo "0024 compatible artifact smoke check completed."
    ;;
  reopen)
    require_marker smoke
    record_marker reopen
    echo "0024 reopen phase completed."
    ;;
esac
