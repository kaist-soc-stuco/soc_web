#!/usr/bin/env node
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { readFile, readdir } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const canonicalMigrationsDir = resolve(scriptDir, "../../apps/api/drizzle");

function migrationRoot() {
  const args = process.argv.slice(2);
  let argumentRoot;

  if (args.length > 0) {
    if (args.length !== 2 || args[0] !== "--migration-root" || args[1].startsWith("-")) {
      fail("usage: verify-migrations.mjs [--migration-root <path>]");
    }
    argumentRoot = args[1];
  }

  const environmentRoot = process.env.MIGRATION_VERIFIER_ROOT;
  if (argumentRoot !== undefined && environmentRoot !== undefined) {
    fail("migration root may be supplied by either --migration-root or MIGRATION_VERIFIER_ROOT, not both");
  }

  const suppliedRoot = argumentRoot ?? environmentRoot;
  if (suppliedRoot !== undefined && suppliedRoot.trim().length === 0) {
    fail("migration root must not be empty");
  }

  return suppliedRoot === undefined ? canonicalMigrationsDir : resolve(suppliedRoot);
}

const migrationsDir = migrationRoot();
const metadataDir = join(migrationsDir, "meta");
const journalPath = join(metadataDir, "_journal.json");
const baselineTag = "0000_dizzy_hawkeye";
const baselineSqlPath = join(migrationsDir, `${baselineTag}.sql`);
const baselineSnapshotPath = join(metadataDir, "0000_snapshot.json");
const baselineSqlSha256 = "74dc8f8b8756a07fc236f8c62ee9f308711b5387b9fc5c0b6eb31d4ec9fa65cf";
const baselineSnapshotSha256 = "1e1c2bd8642a7b5f851d41094eb9f172772dfe3833735e6a05f44fde723ba4d4";

function fail(message) {
  throw new Error(`Migration verification failed: ${message}`);
}

function checksum(content) {
  return createHash("sha256").update(content).digest("hex");
}

for (const [path, label] of [
  [journalPath, "apps/api/drizzle/meta/_journal.json"],
  [baselineSqlPath, `apps/api/drizzle/${baselineTag}.sql`],
  [baselineSnapshotPath, "apps/api/drizzle/meta/0000_snapshot.json"],
]) {
  if (!existsSync(path)) {
    fail(`required immutable baseline file is missing: ${label}`);
  }
}

let journal;
try {
  journal = JSON.parse(await readFile(journalPath, "utf8"));
} catch (error) {
  fail(`journal is not valid JSON: ${error.message}`);
}

if (!Array.isArray(journal.entries) || journal.entries.length === 0) {
  fail("journal must contain at least the immutable baseline entry");
}

const tags = new Set();
const migrationFiles = [];
for (let position = 0; position < journal.entries.length; position += 1) {
  const entry = journal.entries[position];
  if (!Number.isInteger(entry.idx) || entry.idx !== position) {
    fail(`journal entry at position ${position} must have contiguous index ${position}`);
  }
  if (typeof entry.tag !== "string" || !/^\d{4}_[a-z0-9_]+$/.test(entry.tag)) {
    fail(`journal entry ${position} has an invalid migration tag`);
  }
  if (tags.has(entry.tag)) {
    fail(`journal contains duplicate migration tag: ${entry.tag}`);
  }
  tags.add(entry.tag);

  const sqlPath = join(migrationsDir, `${entry.tag}.sql`);
  if (!existsSync(sqlPath)) {
    fail(`journal migration is missing its SQL file: ${entry.tag}`);
  }
  const sql = await readFile(sqlPath, "utf8");
  if (sql.trim().length === 0) {
    fail(`migration SQL must not be empty: ${entry.tag}`);
  }
  const sha256 = checksum(sql);
  if (entry.tag === baselineTag && sha256 !== baselineSqlSha256) {
    fail(`immutable baseline SQL checksum mismatch: ${baselineTag}`);
  }
  migrationFiles.push({ path: sqlPath, sha256 });
}
if (journal.entries[0]?.idx !== 0 || journal.entries[0]?.tag !== baselineTag) {
  fail(`immutable baseline must remain journal entry 0: ${baselineTag}`);
}

if (!tags.has(baselineTag)) {
  fail(`journal is missing immutable baseline entry: ${baselineTag}`);
}

const sqlDirectoryEntries = await readdir(migrationsDir, { withFileTypes: true });
const sqlTags = new Set(
  sqlDirectoryEntries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".sql"))
    .map((entry) => entry.name.slice(0, -4)),
);
for (const tag of tags) {
  if (!sqlTags.has(tag)) {
    fail(`journal migration is missing its SQL file: ${tag}`);
  }
}
for (const tag of sqlTags) {
  if (!tags.has(tag)) {
    fail(`SQL migration is missing a journal entry: ${tag}`);
  }
}

const snapshot = await readFile(baselineSnapshotPath, "utf8");
try {
  JSON.parse(snapshot);
} catch (error) {
  fail(`immutable baseline snapshot is not valid JSON: ${error.message}`);
}
if (checksum(snapshot) !== baselineSnapshotSha256) {
  fail("immutable baseline snapshot checksum mismatch");
}

console.log(
  JSON.stringify({
    migrationCount: journal.entries.length,
    checksums: [
      { path: "apps/api/drizzle/meta/_journal.json", sha256: checksum(await readFile(journalPath)) },
      { path: "apps/api/drizzle/meta/0000_snapshot.json", sha256: checksum(snapshot) },
      ...migrationFiles.map(({ path, sha256 }) => ({
        path: `apps/api/drizzle/${basename(path)}`,
        sha256,
      })),
    ],
  }),
);
