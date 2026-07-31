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
    if (args.length !== 2 || args[0] !== "--migration-root" || args[1].startsWith("-")) fail("usage: verify-migrations.mjs [--migration-root <path>]");
    argumentRoot = args[1];
  }
  const environmentRoot = process.env.MIGRATION_VERIFIER_ROOT;
  if (argumentRoot !== undefined && environmentRoot !== undefined) fail("migration root may be supplied by either --migration-root or MIGRATION_VERIFIER_ROOT, not both");
  const suppliedRoot = argumentRoot ?? environmentRoot;
  if (suppliedRoot !== undefined && suppliedRoot.trim().length === 0) fail("migration root must not be empty");
  return suppliedRoot === undefined ? canonicalMigrationsDir : resolve(suppliedRoot);
}
const migrationsDir = migrationRoot();
const metadataDir = join(migrationsDir, "meta");
const journalPath = join(metadataDir, "_journal.json");
const baselineTag = "0000_dizzy_hawkeye";
const pinned = {
  "0000_dizzy_hawkeye": ["74dc8f8b8756a07fc236f8c62ee9f308711b5387b9fc5c0b6eb31d4ec9fa65cf", "1e1c2bd8642a7b5f851d41094eb9f172772dfe3833735e6a05f44fde723ba4d4"],
  "0001_open_giant_girl": ["29858ae18f2d2b29cbcc104e5e71e81976fceb0c0a47adea836ee8c12c834af5", "e6c793af5ea2dcc05f949e108be16a7994f319af5f8c39994f749be8c4b9bf9e"],
  "0002_steep_firestar": ["7797249a070d9cd052ecaec7b0a1906981180572719c86f6ab0f60b5cc5ed481", "ded9bc3aef8934b57deb99b72bfabeb366a84bb311486db28d7a6d3344e3868b"],
  "0003_flimsy_silhouette": ["77a712362216a7bd9006976bd5888e7b9bca3561a3a71f34f6c58a05d36b57ef", "c13de471c378061c309070ce6e70ee4fff2e0f747bddd15517b40b48d78213c2"],
  "0004_cute_hedge_knight": ["7bd4f4dd68c0da9e3945cb1e7d01b89d2b454fd97ca7c644b697cbfa05bddaa9", "51b184508c776b408e1e0019c4d6d38bf0e3d1f073ed06480c599882cf560859"],
  "0005_ancient_loki": ["9d7fc456687687d1fd860606df893dbd597ba7c8b895f6c2b29e39910fb62d1e", "48cf9d729bfc264dcb0e2403d2c7313133f9239ed1dc72151370a5d4b9c84579"],
  "0006_phase6_contacts": ["1d3ceb28788194b819e6be1e5574a899348c130e1685027e510626619db95624", "06ac3c2e077c12aac8dec8cd54171f8c3a80e4386550b0b2dc62783e8e62efcd"],
  "0007_phase2_migration_repair": ["7ee1afb4da8d60b116286517c81cc3686e0e65c3975e12266a9f3e45c274b285", "6b32c88a5271b8161156beab337a1abc4ea5798be46c53b4bb6f21e5b04a3282"],
  "0008_phase2_user_pii": ["e328b826c96e9389821e83c2a9d1c24cb97283e2381d7f7e5a8ca8f3ec21b8c5", "fbf1b41bbf7192d9abdeceeeaa776f975e8dda51d83009d50026752ad769ab16"],
  "0009_phase2_fee_idempotency": ["bcc8f7072636236057c07ffb3d0840b62d6b720358ecdc6babf5b45a0c162a43", "938705175c0c3aef64af3fdb95d27101b64fe92052ba31ac5daf94fdd94b5ec5"],
  "0010_phase2_backfill_boundary": ["31d2ca8a763f52b7dcc76a665221802d394a5319197832c781107bafe68ae383", "7f042cb0b839a8e404a2940b38351fd4d02b330e45763474a2e546b90ed0f3b1"],
  "0011_phase2_permission_audit_append_only": ["18ba1f3bd32470e5ac12c22fdcd6e4eb0ac44b6c98cddb3a45de9fded50c91b9", "ffc8e70e62a94f95e14365b45dcc44c92da1305820c73bf22fa1b4413bd85003"],
  "0012_phase2_pii_contract": ["7db6199bf86039c5b54fbdcf0c992b4248898bf0685c9264fddecfaaee61cdfd", "cb4cc1e2f9e7be32e8877ad64966a9257c87b7499f15e8ae282dab73adf70909"],
  "0013_phase2_pii_contract_gate": ["facf473a42a76e7c2bc4394179a395f359aa7aad54922b3d43a7693f1a4e79d1", "214c7b2061b0e05a7d58f6aa67be6708c7b7fb29ebf6897983ea0b17ac052635"],
  "0014_phase2_permission_transition_cursor": ["de2a7611f15f3d4e81f8a89799aa4c35c6253230e20c6a62a3dfb77472cfc85f", "3c9bfe7caaf0630bbe2932a11f0cd05b27abe547292a77b667490fc9c37fc25f"],
  "0015_board_title_reconciliation": ["0ed063c5dc890ba8516466d449b425590675f10b8f5e45d1a17f1773c825bde1", "36ed981e98e6119de897df3e8aa8c19163ae66e047f5b9ea7191cea3024781c3"],
};
const canonicalJournal = {
  version: "7",
  dialect: "postgresql",
  entries: [
    [0, "0000_dizzy_hawkeye", 1774792770091, true],
    [1, "0001_open_giant_girl", 1785128695306, true],
    [2, "0002_steep_firestar", 1785133158266, true],
    [3, "0003_flimsy_silhouette", 1785133226463, true],
    [4, "0004_cute_hedge_knight", 1785145142795, true],
    [5, "0005_ancient_loki", 1785149579244, true],
    [6, "0006_phase6_contacts", 1785166946887, true],
    [7, "0007_phase2_migration_repair", 1785170070557, true],
    [8, "0008_phase2_user_pii", 1785171000000, true],
    [9, "0009_phase2_fee_idempotency", 1785172000000, true],
    [10, "0010_phase2_backfill_boundary", 1785171619782, true],
    [11, "0011_phase2_permission_audit_append_only", 1785173000000, true],
    [12, "0012_phase2_pii_contract", 1785174000000, true],
    [13, "0013_phase2_pii_contract_gate", 1785175000000, true],
    [14, "0014_phase2_permission_transition_cursor", 1785176000000, true],
    [15, "0015_board_title_reconciliation", 1785177000000, true],
  ],
};
function fail(message) { throw new Error(`Migration verification failed: ${message}`); }
function checksum(content) { return createHash("sha256").update(content).digest("hex"); }
if (!existsSync(journalPath)) fail("required immutable journal file is missing");
let journal;
try { journal = JSON.parse(await readFile(journalPath, "utf8")); } catch (error) { fail(`journal is not valid JSON: ${error.message}`); }
if (!Array.isArray(journal.entries) || journal.entries.length === 0) fail("journal must contain at least the immutable baseline entry");
const canonicalEntries = canonicalJournal.entries;
const isCanonicalJournal = journal.entries.length === canonicalEntries.length
  && journal.entries.every((entry, position) => entry.tag === canonicalEntries[position][1]);
if (isCanonicalJournal) {
  if (journal.version !== canonicalJournal.version) fail(`immutable journal version mismatch: expected ${canonicalJournal.version}`);
  if (journal.dialect !== canonicalJournal.dialect) fail(`immutable journal dialect mismatch: expected ${canonicalJournal.dialect}`);
  journal.entries.forEach((entry, position) => {
    const [idx, tag, when, breakpoints] = canonicalEntries[position];
    if (entry.idx !== idx || entry.tag !== tag || entry.when !== when || entry.breakpoints !== breakpoints || entry.version !== canonicalJournal.version) {
      fail(`immutable journal metadata mismatch: ${tag}`);
    }
  });
}
const tags = new Set(); const migrationFiles = [];
for (let position = 0; position < journal.entries.length; position += 1) {
  const entry = journal.entries[position];
  if (!Number.isInteger(entry.idx) || entry.idx !== position) fail(`journal entry at position ${position} must have contiguous index ${position}`);
  if (typeof entry.tag !== "string" || !/^\d{4}_[a-z0-9_]+$/.test(entry.tag)) fail(`journal entry ${position} has an invalid migration tag`);
  if (tags.has(entry.tag)) fail(`journal contains duplicate migration tag: ${entry.tag}`);
  tags.add(entry.tag);
  const sqlPath = join(migrationsDir, `${entry.tag}.sql`);
  if (!existsSync(sqlPath)) fail(`journal migration is missing its SQL file: ${entry.tag}`);
  const sql = await readFile(sqlPath, "utf8");
  if (sql.trim().length === 0) fail(`migration SQL must not be empty: ${entry.tag}`);
  const sha256 = checksum(sql); const expected = pinned[entry.tag];
  if (!expected) fail(`journal migration is not pinned: ${entry.tag}`);
  if (sha256 !== expected[0]) fail(`${entry.tag === baselineTag ? "immutable baseline SQL checksum mismatch" : "immutable migration SQL checksum mismatch"}: ${entry.tag}`);
  const snapshotPath = join(metadataDir, `${String(position).padStart(4, "0")}_snapshot.json`);
  if (!existsSync(snapshotPath)) fail(`journal snapshot is missing: ${entry.tag}`);
  const snapshot = await readFile(snapshotPath, "utf8");
  try { JSON.parse(snapshot); } catch (error) { fail(`migration snapshot is not valid JSON: ${entry.tag}: ${error.message}`); }
  if (checksum(snapshot) !== expected[1]) fail(`${entry.tag === baselineTag ? "immutable baseline snapshot checksum mismatch" : "immutable migration snapshot checksum mismatch"}${entry.tag === baselineTag ? "" : `: ${entry.tag}`}`);
  migrationFiles.push({ path: sqlPath, sha256 });
}
if (journal.entries[0]?.idx !== 0 || journal.entries[0]?.tag !== baselineTag) fail(`immutable baseline must remain journal entry 0: ${baselineTag}`);
const sqlDirectoryEntries = await readdir(migrationsDir, { withFileTypes: true });
const sqlTags = new Set(sqlDirectoryEntries.filter((entry) => entry.isFile() && entry.name.endsWith(".sql")).map((entry) => entry.name.slice(0, -4)));
for (const tag of tags) if (!sqlTags.has(tag)) fail(`journal migration is missing its SQL file: ${tag}`);
for (const tag of sqlTags) if (!tags.has(tag)) fail(`SQL migration is missing a journal entry: ${tag}`);
console.log(JSON.stringify({ migrationCount: journal.entries.length, checksums: [{ path: "apps/api/drizzle/meta/_journal.json", sha256: checksum(await readFile(journalPath)) }, ...migrationFiles.map(({ path, sha256 }) => ({ path: `apps/api/drizzle/${basename(path)}`, sha256 }))] }));
