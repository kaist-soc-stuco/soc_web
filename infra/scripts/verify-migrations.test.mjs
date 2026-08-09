import assert from "node:assert/strict";
import { execFile as execFileCallback } from "node:child_process";
import { cp, mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import test from "node:test";

const execFile = promisify(execFileCallback);
const scriptDir = dirname(fileURLToPath(import.meta.url));
const scriptPath = join(scriptDir, "verify-migrations.mjs");
const projectRoot = resolve(scriptDir, "../..");
const canonicalMigrationsDir = resolve(projectRoot, "apps/api/drizzle");
const baselineTag = "0000_dizzy_hawkeye";
const baselineSql = await readFile(join(canonicalMigrationsDir, `${baselineTag}.sql`));
const baselineSnapshot = await readFile(join(canonicalMigrationsDir, "meta", "0000_snapshot.json"));
const releasedTags = [
  "0000_dizzy_hawkeye",
  "0001_open_giant_girl",
  "0002_steep_firestar",
  "0003_flimsy_silhouette",
  "0004_cute_hedge_knight",
  "0005_ancient_loki",
  "0006_phase6_contacts",
  "0007_phase2_migration_repair",
  "0008_phase2_user_pii",
  "0009_phase2_fee_idempotency",
  "0010_phase2_backfill_boundary",
  "0011_phase2_permission_audit_append_only",
  "0012_phase2_pii_contract",
  "0013_phase2_pii_contract_gate",
  "0014_phase2_permission_transition_cursor",
  "0015_board_title_reconciliation",
  "0016_survey_section_descriptions",
  "0017_sso_identity_profile",
  "0018_content_relationships",
  "0019_like_only_reactions",
  "0020_admin_user_exact_search",
  "0021_survey_definition_version",
  "0022_survey_response_review_queue_index",
  "0023_survey_presentation_blocks",
  "0024_survey_section_items",
  "0025_governance_and_article_public_no",
];

async function releasedFixture(t) {
  const root = await fixture(t, releasedTags.map((tag, idx) => ({ idx, tag })));
  await writeFile(join(root, "meta", "_journal.json"), await readFile(join(canonicalMigrationsDir, "meta", "_journal.json")));
  for (const [idx, tag] of releasedTags.entries()) {
    await writeFile(join(root, `${tag}.sql`), await readFile(join(canonicalMigrationsDir, `${tag}.sql`)));
    const snapshotPath = join(canonicalMigrationsDir, "meta", `${String(idx).padStart(4, "0")}_snapshot.json`);
    await writeFile(join(root, "meta", `${String(idx).padStart(4, "0")}_snapshot.json`), await readFile(snapshotPath));
  }
  return root;
}

async function fixture(t, entries = [{ idx: 0, tag: baselineTag }]) {
  const root = await mkdtemp(join(tmpdir(), "verify-migrations-"));
  t.after(() => rm(root, { force: true, recursive: true }));
  await mkdir(join(root, "meta"));
  await writeFile(join(root, "meta", "_journal.json"), JSON.stringify({ entries }));
  await writeFile(join(root, `${baselineTag}.sql`), baselineSql);
  await writeFile(join(root, "meta", "0000_snapshot.json"), baselineSnapshot);
  return root;
}
async function safetyContractFixture(t) {
  const root = await mkdtemp(join(tmpdir(), "verify-migration-safety-"));
  t.after(() => rm(root, { force: true, recursive: true }));
  await mkdir(join(root, "infra", "scripts"), { recursive: true });
  await mkdir(join(root, "infra", "docker"), { recursive: true });
  await Promise.all([
    cp(join(projectRoot, "infra/scripts/db-migrate.sh"), join(root, "infra/scripts/db-migrate.sh")),
    cp(join(projectRoot, "infra/docker/compose.prod.yml"), join(root, "infra/docker/compose.prod.yml")),
    cp(join(projectRoot, "README.md"), join(root, "README.md")),
  ]);
  return root;
}

async function verify(root, options = {}) {
  const args = options.environment ? [scriptPath] : [scriptPath, "--migration-root", root];
  const env = { ...process.env };

  if (options.environment) {
    env.MIGRATION_VERIFIER_ROOT = root;
  } else {
    delete env.MIGRATION_VERIFIER_ROOT;
  }
  if (options.repositoryRoot) {
    env.MIGRATION_VERIFIER_REPOSITORY_ROOT = options.repositoryRoot;
  } else {
    delete env.MIGRATION_VERIFIER_REPOSITORY_ROOT;
  }

  return execFile(process.execPath, args, { env });
}

async function expectFailure(root, pattern, options = {}) {
  await assert.rejects(verify(root, options), (error) => {
    assert.notEqual(error.code, 0);
    assert.match(error.stderr, pattern);
    return true;
  });
}

test("verifies a complete released journal using an explicit migration root", async (t) => {
  const root = await releasedFixture(t);
  const { stdout } = await verify(root);
  assert.equal(JSON.parse(stdout).migrationCount, releasedTags.length);
});

test("verification is repeatable and supports the environment migration root", async (t) => {
  const root = await releasedFixture(t);
  await verify(root, { environment: true });
  await verify(root, { environment: true });
});

test("rejects a journal migration without SQL", async (t) => {
  const root = await fixture(t, [{ idx: 0, tag: baselineTag }, { idx: 1, tag: "0001_missing_sql" }]);
  await expectFailure(root, /missing its SQL file: 0001_missing_sql/);
});

test("rejects empty migration SQL", async (t) => {
  const root = await fixture(t);
  await writeFile(join(root, `${baselineTag}.sql`), " \n\t");
  await expectFailure(root, /migration SQL must not be empty/);
});

test("rejects noncontiguous journal indexes", async (t) => {
  const root = await fixture(t, [{ idx: 1, tag: baselineTag }]);
  await expectFailure(root, /must have contiguous index 0/);
});

test("rejects duplicate journal tags", async (t) => {
  const root = await fixture(t, [
    { idx: 0, tag: baselineTag },
    { idx: 1, tag: baselineTag },
  ]);
  await expectFailure(root, /duplicate migration tag/);
});

test("rejects orphan SQL migrations", async (t) => {
  const root = await fixture(t);
  await writeFile(join(root, "0001_orphan.sql"), "CREATE TABLE orphaned (id integer);\n");
  await expectFailure(root, /SQL migration is missing a journal entry: 0001_orphan/);
});

test("rejects an invalid immutable baseline snapshot", async (t) => {
  const root = await fixture(t);
  await writeFile(join(root, "meta", "0000_snapshot.json"), "not json");
  await expectFailure(root, /migration snapshot is not valid JSON: 0000_dizzy_hawkeye/);
});

test("rejects immutable baseline SQL changes", async (t) => {
  const root = await fixture(t);
  await writeFile(join(root, `${baselineTag}.sql`), "CREATE TABLE rewritten (id integer);\n");
  await expectFailure(root, /immutable baseline SQL checksum mismatch/);
});

test("rejects immutable baseline snapshot changes", async (t) => {
  const root = await fixture(t);
  await writeFile(join(root, "meta", "0000_snapshot.json"), "{}\n");
  await expectFailure(root, /immutable baseline snapshot checksum mismatch/);
});

test("requires the immutable baseline at journal entry zero", async (t) => {
  const root = await fixture(t, [
    { idx: 0, tag: "0000_other" },
    { idx: 1, tag: baselineTag },
  ]);
  await writeFile(join(root, "0000_other.sql"), "CREATE TABLE other_table (id integer);\n");
  await expectFailure(root, /journal migration is not pinned: 0000_other/);
});
test("rejects rewrites of every released migration SQL and snapshot", async (t) => {
  for (const [idx, tag] of releasedTags.entries()) {
    const sqlRoot = await releasedFixture(t);
    await writeFile(join(sqlRoot, `${tag}.sql`), "CREATE TABLE rewritten (id integer);\n");
    await expectFailure(sqlRoot, new RegExp(`${tag === "0000_dizzy_hawkeye" ? "immutable baseline SQL" : "immutable migration SQL"} checksum mismatch: ${tag}`));

    const snapshotRoot = await releasedFixture(t);
    await writeFile(join(snapshotRoot, "meta", `${String(idx).padStart(4, "0")}_snapshot.json`), "{}\n");
    await expectFailure(snapshotRoot, new RegExp(`${tag === "0000_dizzy_hawkeye" ? "immutable baseline snapshot checksum mismatch" : `immutable migration snapshot checksum mismatch: ${tag}`}`));
  }
});
test("requires the 0024 cutover's executable identity, discard, topology, and cleanup invariants", async () => {
  const sql = await readFile(join(canonicalMigrationsDir, "0024_survey_section_items.sql"), "utf8");
  for (const invariant of [
    'FULL OUTER JOIN "survey_section_items" AS item',
    'question_section IS DISTINCT FROM NEW."section_id"',
    'DROP COLUMN "description_kr", DROP COLUMN "description_en"',
    'DROP TABLE "survey_presentation_blocks"',
    'survey_image_block_memberships_set_order_unique',
    'CREATE TABLE "survey_image_cleanup_claims"',
    'published_survey_definition_immutable',
    'image membership counter mismatch',
    'AFTER INSERT OR UPDATE OR DELETE ON "survey_section_description_items"',
    'AFTER INSERT OR UPDATE OR DELETE ON "survey_image_blocks"',
    'DESCRIPTION item requires description subtype',
    'IMAGE_BLOCK item requires image block subtype',
  ]) assert.ok(sql.includes(invariant), `0024 must retain ${invariant}`);
  const snapshot = JSON.parse(await readFile(join(canonicalMigrationsDir, "meta", "0024_snapshot.json"), "utf8"));
  assert.equal(snapshot.tables["public.survey_sections"].columns.description_kr, undefined);
  assert.equal(snapshot.tables["public.survey_sections"].columns.description_en, undefined);
  assert.equal(snapshot.tables["public.survey_presentation_blocks"], undefined);
});
test("rejects a released migration with a missing snapshot", async (t) => {
  const root = await releasedFixture(t);
  await rm(join(root, "meta", "0022_snapshot.json"));
  await expectFailure(root, /journal snapshot is missing: 0022_survey_response_review_queue_index/);
});
test("rejects released journal metadata changes", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "verify-migrations-canonical-"));
  t.after(() => rm(root, { force: true, recursive: true }));
  await rm(root, { force: true, recursive: true });
  await cp(canonicalMigrationsDir, root, { recursive: true });
  const journalPath = join(root, "meta", "_journal.json");
  const journal = JSON.parse(await readFile(journalPath, "utf8"));
  journal.entries[1].when += 1;
  await writeFile(journalPath, JSON.stringify(journal));
  await expectFailure(root, /immutable journal metadata mismatch: 0001_open_giant_girl/);
});
test("rejects a journal missing a released entry", async (t) => {
  const root = await releasedFixture(t);
  const journalPath = join(root, "meta", "_journal.json");
  const journal = JSON.parse(await readFile(journalPath, "utf8"));
  journal.entries.pop();
  await writeFile(journalPath, JSON.stringify(journal));
  await expectFailure(root, /immutable journal is missing released entries/);
});
test("rejects reordered released journal entries", async (t) => {
  const root = await releasedFixture(t);
  const journalPath = join(root, "meta", "_journal.json");
  const journal = JSON.parse(await readFile(journalPath, "utf8"));
  [journal.entries[1], journal.entries[2]] = [journal.entries[2], journal.entries[1]];
  journal.entries.forEach((entry, idx) => { entry.idx = idx; });
  const firstSnapshotPath = join(root, "meta", "0001_snapshot.json");
  const secondSnapshotPath = join(root, "meta", "0002_snapshot.json");
  const [firstSnapshot, secondSnapshot] = await Promise.all([readFile(firstSnapshotPath), readFile(secondSnapshotPath)]);
  await Promise.all([writeFile(firstSnapshotPath, secondSnapshot), writeFile(secondSnapshotPath, firstSnapshot)]);
  await writeFile(journalPath, JSON.stringify(journal));
  await expectFailure(root, /immutable journal released entry mismatch at position 1: expected 0001_open_giant_girl/);
});
test("reconciles exactly five default board titles without touching timestamps, policy, or customized rows", async () => {
  const sql = await readFile(join(canonicalMigrationsDir, "0015_board_title_reconciliation.sql"), "utf8");
  const updates = sql.match(/UPDATE "boards"[\s\S]*?;/g) ?? [];
  assert.equal(updates.length, 5);
  assert.deepEqual(
    updates.map((statement) => statement.match(/SET "title_kr" = '([^']+)'/)?.[1]),
    ["공지", "행사", "HoC", "홍보글", "건의사항 및 QnA"],
  );
  for (const statement of updates) {
    assert.match(statement, /^UPDATE "boards"\nSET "title_kr" = '[^']+'\nWHERE "code" = '[a-z-]+'/);
    assert.match(statement, /^UPDATE "boards"\nSET "title_kr" = '[^']+'\nWHERE /);
    for (const preservedColumn of [
      "title_kr", "title_en", "description_kr", "description_en", "read_permission",
      "write_permission", "comment_permission", "comments_allowed", "secret_articles_allowed",
      "reactions_allowed", "display_order", "is_hidden", "show_on_home",
    ]) assert.match(statement, new RegExp(`"${preservedColumn}" = `));
  }
});
test("pins the definition-version migration and its legacy-row default/backfill contract", async () => {
  const sql = await readFile(join(canonicalMigrationsDir, "0021_survey_definition_version.sql"), "utf8");
  assert.match(sql, /ADD COLUMN "definition_version" integer NOT NULL DEFAULT 1/);
  assert.match(sql, /"surveys_definition_version_positive" CHECK \("definition_version" > 0\)/);
});
test("pins the survey response review queue index ordering", async () => {
  const sql = await readFile(join(canonicalMigrationsDir, "0022_survey_response_review_queue_index.sql"), "utf8");
  assert.match(sql, /CREATE INDEX "survey_responses_review_queue_idx" ON "survey_responses" USING btree \("survey_id","state","submitted_at" DESC,"id" DESC\)/);
});
test("rejects a migration safety script without bounded timeout gates", async (t) => {
  const root = await releasedFixture(t);
  const safetyRoot = await safetyContractFixture(t);
  const script = await readFile(join(safetyRoot, "infra/scripts/db-migrate.sh"), "utf8");
  await writeFile(join(safetyRoot, "infra/scripts/db-migrate.sh"), script.replace("options: '-c lock_timeout=5000 -c statement_timeout=30000'", ""));
  await expectFailure(root, /migration safety script is missing required gate: options:/, { repositoryRoot: safetyRoot });
});
test("rejects a migration runbook without limit-plus-one EXPLAIN verification", async (t) => {
  const root = await releasedFixture(t);
  const safetyRoot = await safetyContractFixture(t);
  const runbook = await readFile(join(safetyRoot, "README.md"), "utf8");
  await writeFile(join(safetyRoot, "README.md"), runbook.replaceAll("LIMIT 50 + 1", "LIMIT 50"));
  await expectFailure(root, /migration safety runbook is missing required instruction: LIMIT 50 \+ 1/, { repositoryRoot: safetyRoot });
});
test("rejects a production Compose migration command that omits a required script flag", async (t) => {
  const root = await releasedFixture(t);
  const safetyRoot = await safetyContractFixture(t);
  const composePath = join(safetyRoot, "infra/docker/compose.prod.yml");
  const compose = await readFile(composePath, "utf8");
  await writeFile(composePath, compose.replace("      - --rehearsed\n", ""));
  await expectFailure(root, /production Compose db-migrate command does not satisfy the migration script invocation contract/, { repositoryRoot: safetyRoot });
});
test("rejects a production Compose migration service without a required approval gate", async (t) => {
  const root = await releasedFixture(t);
  const safetyRoot = await safetyContractFixture(t);
  const composePath = join(safetyRoot, "infra/docker/compose.prod.yml");
  const compose = await readFile(composePath, "utf8");
  await writeFile(composePath, compose.replace("MIGRATION_REHEARSAL_COMPLETED=approved", "MIGRATION_REHEARSAL_COMPLETED=not-approved"));
  await expectFailure(root, /production Compose db-migrate service must require MIGRATION_REHEARSAL_COMPLETED=approved/, { repositoryRoot: safetyRoot });
});
test("rejects a production Compose migration service without an explicit 0024 phase", async (t) => {
  const root = await releasedFixture(t);
  const safetyRoot = await safetyContractFixture(t);
  const composePath = join(safetyRoot, "infra/docker/compose.prod.yml");
  const compose = await readFile(composePath, "utf8");
  await writeFile(composePath, compose.replace("      MIGRATION_0024_PHASE:", "      # MIGRATION_0024_PHASE:"));
  await expectFailure(root, /production Compose db-migrate service must require an explicit current 0024 phase/, { repositoryRoot: safetyRoot });
});
test("rejects a production image-cleanup scheduler without bounded grace", async (t) => {
  const root = await releasedFixture(t);
  const safetyRoot = await safetyContractFixture(t);
  const composePath = join(safetyRoot, "infra/docker/compose.prod.yml");
  const compose = await readFile(composePath, "utf8");
  await writeFile(composePath, compose.replace("${SURVEY_IMAGE_CLEANUP_GRACE_MS:-3600000}", "${SURVEY_IMAGE_CLEANUP_GRACE_MS:-60000}"));
  await expectFailure(root, /production Compose survey-image-cleanup service must pin SURVEY_IMAGE_CLEANUP_GRACE_MS/, { repositoryRoot: safetyRoot });
});
test("rejects a retention scheduler that restart-loops while disabled", async (t) => {
  const root = await releasedFixture(t);
  const safetyRoot = await safetyContractFixture(t);
  const composePath = join(safetyRoot, "infra/docker/compose.prod.yml");
  const compose = await readFile(composePath, "utf8");
  await writeFile(composePath, compose.replaceAll('    restart: "no"\n    command:', "    restart: unless-stopped\n    command:"));
  await expectFailure(root, /survey-image-cleanup service is missing required ownership or observability contract/, { repositoryRoot: safetyRoot });
});
test("rejects a production Compose migration service with a missing approval gate", async (t) => {
  const root = await releasedFixture(t);
  const safetyRoot = await safetyContractFixture(t);
  const composePath = join(safetyRoot, "infra/docker/compose.prod.yml");
  const compose = await readFile(composePath, "utf8");
  await writeFile(composePath, compose.replace("      MIGRATION_RESPONSE_REVIEW_EXPLAIN_VERIFIED:", "      # MIGRATION_RESPONSE_REVIEW_EXPLAIN_VERIFIED:"));
  await expectFailure(root, /production Compose db-migrate service must require MIGRATION_RESPONSE_REVIEW_EXPLAIN_VERIFIED=approved/, { repositoryRoot: safetyRoot });
});
