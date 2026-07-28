#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
API_DIR="$ROOT_DIR/apps/api"

: "${DATABASE_URL:?DATABASE_URL is required}"

run_migrations() {
  local migrations_dir="$1"
  (
    cd "$API_DIR"
    MIGRATIONS_DIR="$migrations_dir" node --input-type=module <<'EOF'
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
try {
  await migrate(drizzle(pool), { migrationsFolder: process.env.MIGRATIONS_DIR });
} finally {
  await pool.end();
}
EOF
  )
}

if [[ "${1:-}" != "--staged" ]]; then
  echo "Refusing unrestricted migration. Use --staged to apply 0000–0012, run the PII backfill, then apply 0013." >&2
  exit 2
fi

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
(
  cd "$API_DIR"
  pnpm exec tsx src/commands/user-pii-backfill.ts
)
run_migrations "$API_DIR/drizzle"

echo "Staged direct migrations and verified PII backfill completed."
