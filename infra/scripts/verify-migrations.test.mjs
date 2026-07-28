import assert from "node:assert/strict";
import { execFile as execFileCallback } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import test from "node:test";

const execFile = promisify(execFileCallback);
const scriptDir = dirname(fileURLToPath(import.meta.url));
const scriptPath = join(scriptDir, "verify-migrations.mjs");
const canonicalMigrationsDir = resolve(scriptDir, "../../apps/api/drizzle");
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
];

async function releasedFixture(t) {
  const root = await fixture(t, releasedTags.map((tag, idx) => ({ idx, tag })));
  for (const [idx, tag] of releasedTags.entries()) {
    await writeFile(join(root, `${tag}.sql`), await readFile(join(canonicalMigrationsDir, `${tag}.sql`)));
    await writeFile(join(root, "meta", `${String(idx).padStart(4, "0")}_snapshot.json`), await readFile(join(canonicalMigrationsDir, "meta", `${String(idx).padStart(4, "0")}_snapshot.json`)));
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

async function verify(root, options = {}) {
  const args = options.environment ? [scriptPath] : [scriptPath, "--migration-root", root];
  const env = { ...process.env };

  if (options.environment) {
    env.MIGRATION_VERIFIER_ROOT = root;
  } else {
    delete env.MIGRATION_VERIFIER_ROOT;
  }

  return execFile(process.execPath, args, { env });
}

async function expectFailure(root, pattern) {
  await assert.rejects(verify(root), (error) => {
    assert.notEqual(error.code, 0);
    assert.match(error.stderr, pattern);
    return true;
  });
}

test("verifies a valid journal using an explicit migration root", async (t) => {
  const root = await fixture(t);
  const { stdout } = await verify(root);
  assert.equal(JSON.parse(stdout).migrationCount, 1);
});

test("verification is repeatable and supports the environment migration root", async (t) => {
  const root = await fixture(t);
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
