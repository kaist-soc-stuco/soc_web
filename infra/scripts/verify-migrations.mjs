#!/usr/bin/env node
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { readFile, readdir } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(scriptDir, "../..");
const canonicalMigrationsDir = resolve(projectRoot, "apps/api/drizzle");
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
  "0016_survey_section_descriptions": ["ca2aea03da1d4c0409fa6eecb45e9fb6a89adfb475731da462165d632bed895f", "36ed981e98e6119de897df3e8aa8c19163ae66e047f5b9ea7191cea3024781c3"],
  "0017_sso_identity_profile": ["5c6ac280d5ca1275a44da4d493c6192f34983ff5e18a110ad6753dd28797ab33", "36ed981e98e6119de897df3e8aa8c19163ae66e047f5b9ea7191cea3024781c3"],
  "0018_content_relationships": ["2519d02e7409bcc378666019681b3beb16e745704dc96ff42fb062ff31b6370e", "36ed981e98e6119de897df3e8aa8c19163ae66e047f5b9ea7191cea3024781c3"],
  "0019_like_only_reactions": ["2ad71995205b8725425122dfc4c61453ed552f7963e607819dce7939cba823eb", "525eda7d12bf1e68e098086e9f13a6c83ef28bf2aeaf5b0afd36031ee6f074e1"],
  "0020_admin_user_exact_search": ["9830acdf7729584bb8865d797c120e54a6e686777ec6aa8958e281c798724e3f", "9c1bf837cbda20736a1a4555e31a820dbd538117614ef9e49e7ed6be23502e68"],
  "0021_survey_definition_version": ["15e35a0c15363c1e2fc06f83b5a9a38e999b286c359a2d853120490b8740c6a0", "7d5d7197ffe5fd10d595c3adab908301d20fd59e8c7eb2b04e59d37bf6c1dc44"],
  "0022_survey_response_review_queue_index": ["2e6d94ebfe659d30e7722eeac5348fb75e8f1f26b956144e3b1a3fd745b37723", "141e6208b2c84f83da65c22be2c869d24b06ab296b4084bcd0ffcb5a783f2997"],
  "0023_survey_presentation_blocks": ["95efc3ee396274be0058b0a2a146d5c4367e82b45de3871a1b4b074add0db51d", "ff490292c0205f1bd5e49b05c84f823253e630582b9c5aaa5789e528e84763e6"],
  "0024_survey_section_items": ["c4129d2dd949ff4cd12eab65872826c853bd8270a6f76890e40e5bad91bbdd7f", "1f7671b69cd10781146eb598c16bdb0c0c93198b4eefccb7c23163272fb439f8"],
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
    [16, "0016_survey_section_descriptions", 1785480800000, true],
    [17, "0017_sso_identity_profile", 1785550000000, true],
    [18, "0018_content_relationships", 1785592800000, true],
    [19, "0019_like_only_reactions", 1785596400000, true],
    [20, "0020_admin_user_exact_search", 1785685000000, true],
    [21, "0021_survey_definition_version", 1785688600000, true],
    [22, "0022_survey_response_review_queue_index", 1785749328339, true],
    [23, "0023_survey_presentation_blocks", 1785772800000, true],
    [24, "0024_survey_section_items", 1785859200000, true],
  ],
};
function fail(message) { throw new Error(`Migration verification failed: ${message}`); }
function checksum(content) { return createHash("sha256").update(content).digest("hex"); }
const requiredMigrationInvocation = [
  "/bin/bash",
  "/app/infra/scripts/db-migrate.sh",
  "--staged",
  "--maintenance-window",
  "--rehearsed",
  "--review-query-explained",
  "--0024-phase",
];
const requiredMigrationApprovals = [
  "MIGRATION_MAINTENANCE_WINDOW",
  "MIGRATION_REHEARSAL_COMPLETED",
  "MIGRATION_RESPONSE_REVIEW_EXPLAIN_VERIFIED",
  "MIGRATION_0024_CUTOVER_APPROVED",
];
const requiredCutoverPhases = ["preflight", "migrate", "reconcile", "smoke", "reopen"];

function composeServiceBlock(compose, service) {
  const match = compose.match(new RegExp(`^  ${service}:\\n([\\s\\S]*?)(?=^  \\S|$(?![\\s\\S]))`, "m"));
  if (!match) fail(`production Compose service is missing: ${service}`);
  return match[1];
}

function composeList(block, key) {
  const match = block.match(new RegExp(`^    ${key}:\\n((?:      - .*(?:\\n|$))*)`, "m"));
  return match ? [...match[1].matchAll(/^      - (.*)$/gm)].map(([, value]) => value) : [];
}

function composeEnvironment(block) {
  const match = block.match(/^    environment:\n((?:      [^\n]*\n?)*)/m);
  if (!match) return new Map();
  return new Map([...match[1].matchAll(/^      ([A-Z0-9_]+): (.*)$/gm)].map(([, key, value]) => [key, value]));
}

async function verifyMigrationSafetyContract() {
  const repositoryRoot = process.env.MIGRATION_VERIFIER_REPOSITORY_ROOT === undefined
    ? projectRoot
    : resolve(process.env.MIGRATION_VERIFIER_REPOSITORY_ROOT);
  const migrationScriptPath = join(repositoryRoot, "infra/scripts/db-migrate.sh");
  const composePath = join(repositoryRoot, "infra/docker/compose.prod.yml");
  const runbookPath = join(repositoryRoot, "README.md");
  if (!existsSync(migrationScriptPath)) fail("migration safety script is missing");
  if (!existsSync(composePath)) fail("production Compose file is missing");
  if (!existsSync(runbookPath)) fail("migration safety runbook is missing");
  const [migrationScript, compose, runbook] = await Promise.all([
    readFile(migrationScriptPath, "utf8"),
    readFile(composePath, "utf8"),
    readFile(runbookPath, "utf8"),
  ]);
  for (const required of [
    "options: '-c lock_timeout=5000 -c statement_timeout=30000'",
    ...requiredMigrationInvocation.slice(2),
    ...requiredMigrationApprovals,
    ...requiredCutoverPhases,
    "CUTOVER_EVIDENCE_DIR",
    "require_quiescent_services",
    "require_no_active_database_clients",
    "active database readers/writers",
  ]) if (!migrationScript.includes(required)) fail(`migration safety script is missing required gate: ${required}`);
  for (const forbidden of [
    "MIGRATION_0024_QUIESCENCE_DECLARED",
    "MIGRATION_0024_COMPATIBLE_ARTIFACT_DECLARED",
    "MIGRATION_0024_BACKUP_RESTORE_VERIFIED",
    "MIGRATION_0024_RECONCILIATION_VERIFIED",
    "MIGRATION_0024_SMOKE_VERIFIED",
    "MIGRATION_0024_REOPEN_APPROVED",
  ]) if (migrationScript.includes(forbidden)) fail(`migration safety script must not pre-attest future phase work: ${forbidden}`);

  const migrationService = composeServiceBlock(compose, "db-migrate");
  if (JSON.stringify(composeList(migrationService, "profiles")) !== JSON.stringify(["maintenance"])) {
    fail("production Compose db-migrate service must be limited to the maintenance profile");
  }
  if (JSON.stringify(composeList(migrationService, "command")) !== JSON.stringify(requiredMigrationInvocation)) {
    fail("production Compose db-migrate command does not satisfy the migration script invocation contract");
  }
  const environment = composeEnvironment(migrationService);
  for (const approval of requiredMigrationApprovals) {
    if (!environment.get(approval)?.startsWith(`\${${approval}:?Set ${approval}=approved`)) {
      fail(`production Compose db-migrate service must require ${approval}=approved`);
    }
  }
  if (!environment.get("MIGRATION_0024_PHASE")?.startsWith("${MIGRATION_0024_PHASE:?Set MIGRATION_0024_PHASE")) {
    fail("production Compose db-migrate service must require an explicit current 0024 phase");
  }
  if (environment.get("CUTOVER_EVIDENCE_DIR") !== "/var/lib/0024-cutover" || !migrationService.includes("survey_0024_cutover_evidence:/var/lib/0024-cutover")) {
    fail("production Compose db-migrate service must persist 0024 phase evidence");
  }
  const cleanupService = composeServiceBlock(compose, "survey-image-cleanup");
  if (JSON.stringify(composeList(cleanupService, "profiles")) !== JSON.stringify(["retention"])) {
    fail("production Compose survey-image-cleanup service must be limited to the retention profile");
  }
  const cleanupEnvironment = composeEnvironment(cleanupService);
  for (const [key, value] of [
    ["SURVEY_IMAGE_CLEANUP_ENABLED", "${SURVEY_IMAGE_CLEANUP_ENABLED:-false}"],
    ["SURVEY_IMAGE_CLEANUP_CADENCE_SECONDS", "${SURVEY_IMAGE_CLEANUP_CADENCE_SECONDS:-900}"],
    ["SURVEY_IMAGE_CLEANUP_BATCH_SIZE", "${SURVEY_IMAGE_CLEANUP_BATCH_SIZE:-25}"],
    ["SURVEY_IMAGE_CLEANUP_GRACE_MS", "${SURVEY_IMAGE_CLEANUP_GRACE_MS:-3600000}"],
  ]) if (cleanupEnvironment.get(key) !== value) fail(`production Compose survey-image-cleanup service must pin ${key}`);
  for (const required of [
    "SURVEY_IMAGE_CLEANUP_ALERT_OWNER",
    "SURVEY_IMAGE_CLEANUP_ALERT_SINK",
    "survey:images:cleanup",
    "survey_image_cleanup_backlog_detected",
    "survey_image_cleanup_failed",
    "survey_image_cleanup_bounds_must_be_900_25_3600000",
    'restart: "no"',
  ]) if (!cleanupService.includes(required)) fail(`production Compose survey-image-cleanup service is missing required ownership or observability contract: ${required}`);
  const purgeService = composeServiceBlock(compose, "survey-response-purge");
  if (!purgeService.includes('restart: "no"')) fail("production Compose survey-response-purge service must not restart-loop when retention is disabled");

  for (const required of [
    "0022_survey_response_review_queue_index",
    "EXPLAIN (ANALYZE, BUFFERS)",
    'survey_responses_review_queue_idx',
    "LIMIT 50 + 1",
    "MIGRATION_REHEARSAL_COMPLETED=approved",
    "MIGRATION_RESPONSE_REVIEW_EXPLAIN_VERIFIED=approved",
    "--review-query-explained",
    "MIGRATION_0024_PHASE=preflight",
    "MIGRATION_0024_PHASE=migrate",
    "MIGRATION_0024_PHASE=reconcile",
    "MIGRATION_0024_PHASE=smoke",
    "MIGRATION_0024_PHASE=reopen",
    "SURVEY_IMAGE_CLEANUP_ENABLED=true",
    "SURVEY_IMAGE_CLEANUP_ALERT_OWNER",
    "SURVEY_IMAGE_CLEANUP_ALERT_SINK",
    "즉시 중단",
  ]) if (!runbook.includes(required)) fail(`migration safety runbook is missing required instruction: ${required}`);
}
if (!existsSync(journalPath)) fail("required immutable journal file is missing");
let journal;
try { journal = JSON.parse(await readFile(journalPath, "utf8")); } catch (error) { fail(`journal is not valid JSON: ${error.message}`); }
if (!Array.isArray(journal.entries) || journal.entries.length === 0) fail("journal must contain at least the immutable baseline entry");
const canonicalEntries = canonicalJournal.entries;
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
for (const tag of sqlTags) if (!tags.has(tag) && !pinned[tag]) fail(`SQL migration is missing a journal entry: ${tag}`);
if (journal.entries.length < canonicalEntries.length) {
  fail(`immutable journal is missing released entries: expected at least ${canonicalEntries.length}, found ${journal.entries.length}`);
}
for (const tag of tags) if (!sqlTags.has(tag)) fail(`journal migration is missing its SQL file: ${tag}`);
for (const tag of sqlTags) if (!tags.has(tag)) fail(`SQL migration is missing a journal entry: ${tag}`);
canonicalEntries.forEach(([, tag, when, breakpoints], position) => {
  const entry = journal.entries[position];
  if (entry?.tag !== tag) fail(`immutable journal released entry mismatch at position ${position}: expected ${tag}`);
  if (entry.idx !== position || entry.when !== when || entry.breakpoints !== breakpoints || entry.version !== canonicalJournal.version) {
    fail(`immutable journal metadata mismatch: ${tag}`);
  }
});
if (journal.version !== canonicalJournal.version) fail(`immutable journal version mismatch: expected ${canonicalJournal.version}`);
if (journal.dialect !== canonicalJournal.dialect) fail(`immutable journal dialect mismatch: expected ${canonicalJournal.dialect}`);
await verifyMigrationSafetyContract();
const orderedItemsMigration = await readFile(join(migrationsDir, "0024_survey_section_items.sql"), "utf8");
for (const required of [
  'FULL OUTER JOIN "survey_section_items" AS item',
  'question_section IS DISTINCT FROM NEW."section_id"',
  'DROP COLUMN "description_kr", DROP COLUMN "description_en"',
  'DROP TABLE "survey_presentation_blocks"',
  'CREATE TABLE "survey_image_cleanup_claims"',
  'survey_image_block_memberships_set_order_unique',
  'question item section mismatch',
  'published_survey_definition_immutable',
  'image membership counter mismatch',
  'AFTER INSERT OR UPDATE OR DELETE ON "survey_section_description_items"',
  'AFTER INSERT OR UPDATE OR DELETE ON "survey_image_blocks"',
  'DESCRIPTION item requires description subtype',
  'IMAGE_BLOCK item requires image block subtype',
]) if (!orderedItemsMigration.includes(required)) fail(`0024 ordered-item cutover invariant is missing: ${required}`);
const orderedSnapshot = JSON.parse(await readFile(join(metadataDir, "0024_snapshot.json"), "utf8"));
const snapshotSections = orderedSnapshot.tables?.["public.survey_sections"];
if (!snapshotSections || "description_kr" in snapshotSections.columns || "description_en" in snapshotSections.columns) {
  fail("0024 snapshot must remove legacy survey section description columns");
}
if (orderedSnapshot.tables?.["public.survey_presentation_blocks"]) fail("0024 snapshot must remove legacy presentation blocks");
for (const table of ["public.survey_section_items", "public.survey_section_description_items", "public.survey_image_blocks", "public.survey_image_block_memberships", "public.survey_image_cleanup_claims"]) {
  if (!orderedSnapshot.tables?.[table]) fail(`0024 snapshot is missing cutover table: ${table}`);
}
console.log(JSON.stringify({ migrationCount: journal.entries.length, checksums: [{ path: "apps/api/drizzle/meta/_journal.json", sha256: checksum(await readFile(journalPath)) }, ...migrationFiles.map(({ path, sha256 }) => ({ path: `apps/api/drizzle/${basename(path)}`, sha256 }))] }));
