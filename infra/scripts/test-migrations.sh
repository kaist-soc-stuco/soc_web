#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
CONTAINER_NAME="soc-migrations-test-$(< /proc/sys/kernel/random/uuid)"
POSTGRES_DB="migration_test"
POSTGRES_USER="migration_test"
POSTGRES_PASSWORD="migration_test"
CONTAINER_CREATED=false
DATABASE_URL="${MIGRATION_TEST_DATABASE_URL:-}"
PSQL_BIN="${PSQL_BIN:-psql}"
CUTOVER_STAGE_DIR=""

cleanup() {
  if [[ -n "$CUTOVER_STAGE_DIR" ]]; then
    rm -rf "$CUTOVER_STAGE_DIR"
  fi
  if [[ "$CONTAINER_CREATED" == true ]]; then
    docker rm --force "$CONTAINER_NAME" >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

query_database() {
  local statement="$1"
  if [[ -n "${MIGRATION_TEST_DATABASE_URL:-}" ]]; then
    "$PSQL_BIN" "$DATABASE_URL" --set ON_ERROR_STOP=1 --tuples-only --no-align --command "$statement"
  else
    docker exec "$CONTAINER_NAME" psql --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" --set ON_ERROR_STOP=1 --tuples-only --no-align --command "$statement"
  fi
}

if [[ -n "$DATABASE_URL" ]]; then
  if [[ "$DATABASE_URL" != postgresql://* && "$DATABASE_URL" != postgres://* ]]; then
    echo "MIGRATION_TEST_DATABASE_URL must be a PostgreSQL URL" >&2
    exit 1
  fi
  if ! command -v "$PSQL_BIN" >/dev/null 2>&1 && [[ ! -x "$PSQL_BIN" ]]; then
    echo "PSQL_BIN is not executable: $PSQL_BIN" >&2
    exit 1
  fi
  query_database 'SELECT 1;' >/dev/null
else
  docker run --detach --rm \
    --name "$CONTAINER_NAME" \
    --env "POSTGRES_DB=$POSTGRES_DB" \
    --env "POSTGRES_USER=$POSTGRES_USER" \
    --env "POSTGRES_PASSWORD=$POSTGRES_PASSWORD" \
    --publish "127.0.0.1::5432" \
    postgres:16-alpine >/dev/null
  CONTAINER_CREATED=true

  for attempt in {1..30}; do
    if docker exec "$CONTAINER_NAME" pg_isready --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" >/dev/null; then
      break
    fi
    if [[ "$attempt" == "30" ]]; then
      echo "Postgres did not become ready for migration test" >&2
      exit 1
    fi
    sleep 1
  done

  port_mapping="$(docker port "$CONTAINER_NAME" 5432/tcp)"
  POSTGRES_PORT="${port_mapping##*:}"
  DATABASE_URL="postgresql://$POSTGRES_USER:$POSTGRES_PASSWORD@127.0.0.1:$POSTGRES_PORT/$POSTGRES_DB?sslmode=disable"
fi

node "$SCRIPT_DIR/verify-migrations.mjs"
CUTOVER_STAGE_DIR="$(mktemp -d "$ROOT_DIR/apps/api/.migration-cutover.XXXXXX")"

cp -R "$ROOT_DIR/apps/api/drizzle" "$CUTOVER_STAGE_DIR/drizzle"
rm -f \
  "$CUTOVER_STAGE_DIR/drizzle/0024_survey_section_items.sql" \
  "$CUTOVER_STAGE_DIR/drizzle/0025_governance_and_article_public_no.sql" \
  "$CUTOVER_STAGE_DIR/drizzle/meta/0024_snapshot.json" \
  "$CUTOVER_STAGE_DIR/drizzle/meta/0025_snapshot.json"
node --eval '
const fs = require("node:fs");
const path = process.argv[1];
const journal = JSON.parse(fs.readFileSync(path, "utf8"));
journal.entries = journal.entries.filter((entry) => entry.idx < 24);
fs.writeFileSync(path, JSON.stringify(journal));
' "$CUTOVER_STAGE_DIR/drizzle/meta/_journal.json"
cat > "$CUTOVER_STAGE_DIR/drizzle.config.ts" <<EOF
import { defineConfig } from "drizzle-kit";
export default defineConfig({
  schema: "$ROOT_DIR/apps/api/src/infrastructure/postgres/postgres.schema.ts",
  out: "$CUTOVER_STAGE_DIR/drizzle",
  dialect: "postgresql",
  dbCredentials: { url: process.env.DATABASE_URL! },
});
EOF
DATABASE_URL="$DATABASE_URL" pnpm --dir "$ROOT_DIR/apps/api" exec drizzle-kit migrate --config "$CUTOVER_STAGE_DIR/drizzle.config.ts"

query_database "
INSERT INTO users (id, sso_user_id, major_mask, fee_status, permission)
VALUES ('10000000-0000-4000-8000-000000000001', 'migration-cutover-user', 0, 'UNKNOWN', 0);
INSERT INTO surveys (id, state, guest_allowed, phone_required, fee_restriction, closes_at, response_retention_days, created_by_user_id, updated_by_user_id)
VALUES ('20000000-0000-4000-8000-000000000001', 'DRAFT', true, true, 'ANY', '2099-01-01', 7, '10000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001');
INSERT INTO survey_revisions (id, survey_id, revision, title_kr, title_en, created_by_user_id)
VALUES ('30000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', 1, 'cutover', 'cutover', '10000000-0000-4000-8000-000000000001');
INSERT INTO survey_sections (id, survey_revision_id, ordinal, title_kr, title_en, description_kr, description_en)
VALUES ('40000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001', 0, 'section', 'section', 'legacy description', 'legacy description');
INSERT INTO survey_questions (id, section_id, ordinal, type, prompt_kr, prompt_en, required)
VALUES ('50000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000001', 0, 'SINGLE_CHOICE', 'one', 'one', false),
       ('50000000-0000-4000-8000-000000000002', '40000000-0000-4000-8000-000000000001', 1, 'SINGLE_CHOICE', 'two', 'two', false);
INSERT INTO survey_choice_options (id, question_id, ordinal, value_kr, value_en)
VALUES ('60000000-0000-4000-8000-000000000001', '50000000-0000-4000-8000-000000000001', 0, 'one', 'one'),
       ('60000000-0000-4000-8000-000000000002', '50000000-0000-4000-8000-000000000002', 0, 'two', 'two');
INSERT INTO survey_responses (id, survey_id, survey_revision_id, campus_user_id, state, submitted_at, retention_deadline_at)
VALUES ('70000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'SUBMITTED', now(), '2099-01-08');
INSERT INTO survey_response_answers (response_id, question_id, choice_option_ids)
VALUES ('70000000-0000-4000-8000-000000000001', '50000000-0000-4000-8000-000000000001', '[\"60000000-0000-4000-8000-000000000001\"]');
INSERT INTO survey_presentation_blocks (id, survey_revision_id, ordinal, type, description_kr, description_en)
VALUES ('80000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001', 0, 'DESCRIPTION', 'legacy block', 'legacy block');
UPDATE survey_revisions
SET published_at = now()
WHERE id = '30000000-0000-4000-8000-000000000001';
" >/dev/null
cutover_identity_before="$(query_database "SELECT id FROM survey_questions WHERE id::text LIKE '50000000%' ORDER BY id; SELECT id FROM survey_choice_options WHERE id::text LIKE '60000000%' ORDER BY id; SELECT id FROM survey_responses WHERE id = '70000000-0000-4000-8000-000000000001'; SELECT response_id || '|' || question_id FROM survey_response_answers WHERE response_id = '70000000-0000-4000-8000-000000000001';")"
DATABASE_URL="$DATABASE_URL" pnpm --dir "$ROOT_DIR/apps/api" exec drizzle-kit migrate --config "$ROOT_DIR/apps/api/drizzle.config.ts"
cutover_identity_after="$(query_database "SELECT id FROM survey_questions WHERE id::text LIKE '50000000%' ORDER BY id; SELECT id FROM survey_choice_options WHERE id::text LIKE '60000000%' ORDER BY id; SELECT id FROM survey_responses WHERE id = '70000000-0000-4000-8000-000000000001'; SELECT response_id || '|' || question_id FROM survey_response_answers WHERE response_id = '70000000-0000-4000-8000-000000000001';")"
if [[ "$cutover_identity_before" != "$cutover_identity_after" ]]; then
  echo "0024 cutover changed question, choice, response, or answer identity" >&2
  exit 1
fi
cutover_items="$(query_database "SELECT count(*) || '|' || min(ordinal) || '|' || max(ordinal) FROM survey_section_items WHERE section_id = '40000000-0000-4000-8000-000000000001' AND kind = 'QUESTION';")"
if [[ "$cutover_items" != "2|0|1" ]]; then
  echo "0024 cutover did not create one continuous QUESTION item per legacy question" >&2
  exit 1
fi
cutover_discard="$(query_database "SELECT
  (NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'survey_sections' AND column_name = 'description_kr'))::int::text ||
  (to_regclass('public.survey_presentation_blocks') IS NULL)::int::text;")"
if [[ "$cutover_discard" != "11" ]]; then
  echo "0024 cutover did not intentionally discard legacy section descriptions and presentation blocks" >&2
  exit 1
fi
cutover_topology="$(query_database "SELECT
  (SELECT count(*) FROM survey_section_items WHERE section_id = '40000000-0000-4000-8000-000000000001' AND kind = 'QUESTION')::text ||
  '|' || (SELECT count(*) FROM survey_image_block_memberships)::text ||
  '|' || (SELECT count(*) FROM survey_image_cleanup_claims)::text ||
  '|' || (SELECT count(*) FROM pg_constraint WHERE conname = 'survey_image_blocks_mode_counts')::text ||
  '|' || (SELECT count(*) FROM pg_indexes WHERE indexname = 'survey_image_block_memberships_asset_reachability_idx')::text;")"
if [[ "$cutover_topology" != "2|0|0|1|1" ]]; then
  echo "0024 cutover counters, reachability, or cleanup constraints are invalid" >&2
  exit 1
fi
DATABASE_URL="$DATABASE_URL" pnpm --dir "$ROOT_DIR/apps/api" run db:migrate
migration_ledger_before="$(query_database 'SELECT id, hash, created_at FROM "drizzle"."__drizzle_migrations" ORDER BY id;')"
DATABASE_URL="$DATABASE_URL" pnpm --dir "$ROOT_DIR/apps/api" run db:migrate
migration_ledger_after="$(query_database 'SELECT id, hash, created_at FROM "drizzle"."__drizzle_migrations" ORDER BY id;')"
if [[ "$migration_ledger_after" != "$migration_ledger_before" ]]; then
  echo "Migration ledger changed after a second migrate" >&2
  exit 1
fi

users_table="$(query_database "SELECT to_regclass('public.users');")"
if [[ "$users_table" != "users" ]]; then
  echo "Migration test did not create the users table" >&2
  exit 1
fi

expected_migrations="$(node --eval "process.stdout.write(String(JSON.parse(require('node:fs').readFileSync(process.argv[1], 'utf8')).entries.length))" "$ROOT_DIR/apps/api/drizzle/meta/_journal.json")"
applied_migrations="$(query_database 'SELECT count(*) FROM "drizzle"."__drizzle_migrations";')"
if [[ "$applied_migrations" != "$expected_migrations" ]]; then
  echo "Migration journal count mismatch: expected $expected_migrations, found $applied_migrations" >&2
  exit 1
fi

# Re-run the reconciliation SQL against an upgraded-style fixture. The test
# database is disposable, so this can prove exact-fingerprint updates without
# rewriting migration history or touching a developer database.
query_database "UPDATE boards SET title_kr = '집행위 공지' WHERE code = 'soc-notice'; UPDATE boards SET title_kr = '관리자 행사' WHERE code = 'soc-events';" >/dev/null
board_timestamps_before="$(query_database "SELECT code || '|' || created_at || '|' || updated_at FROM boards WHERE code IN ('soc-notice', 'soc-events') ORDER BY code;")"
query_database "$(< "$ROOT_DIR/apps/api/drizzle/0015_board_title_reconciliation.sql")" >/dev/null
reconciled_notice="$(query_database "SELECT title_kr FROM boards WHERE code = 'soc-notice';")"
customized_events="$(query_database "SELECT title_kr FROM boards WHERE code = 'soc-events';")"
board_timestamps_after="$(query_database "SELECT code || '|' || created_at || '|' || updated_at FROM boards WHERE code IN ('soc-notice', 'soc-events') ORDER BY code;")"
if [[ "$reconciled_notice" != "공지" || "$customized_events" != "관리자 행사" ]]; then
  echo "Board title reconciliation did not preserve the exact-fingerprint boundary" >&2
  exit 1
fi
if [[ "$board_timestamps_after" != "$board_timestamps_before" ]]; then
  echo "Board title reconciliation changed board timestamps" >&2
  exit 1
fi

ordered_schema="$(query_database "SELECT
  (to_regclass('public.survey_section_items') IS NOT NULL)::int::text ||
  (to_regclass('public.survey_section_description_items') IS NOT NULL)::int::text ||
  (to_regclass('public.survey_image_blocks') IS NOT NULL)::int::text ||
  (to_regclass('public.survey_image_block_memberships') IS NOT NULL)::int::text ||
  (to_regclass('public.survey_image_cleanup_claims') IS NOT NULL)::int::text ||
  (to_regclass('public.survey_presentation_blocks') IS NULL)::int::text ||
  (NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'survey_sections'
      AND column_name IN ('description_kr', 'description_en')
  ))::int::text;")"
if [[ "$ordered_schema" != "1111111" ]]; then
  echo "0024 ordered-item cutover schema or intentional legacy discard is invalid" >&2
  exit 1
fi
ordered_constraints="$(query_database "SELECT
  (EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'survey_section_items_section_ordinal_unique'))::int::text ||
  (EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'survey_section_items_question_unique'))::int::text ||
  (EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'survey_image_block_memberships_set_order_unique'))::int::text ||
  (EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'survey_image_cleanup_claims_open_asset_unique'))::int::text;")"
if [[ "$ordered_constraints" != "1111" ]]; then
  echo "0024 ordered-item counters, reachability, or cleanup invariants are missing" >&2
  exit 1
fi
echo "Migration test passed"
