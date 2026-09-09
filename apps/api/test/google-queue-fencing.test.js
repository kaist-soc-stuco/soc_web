const assert = require("node:assert/strict");
const { after, before, beforeEach, test } = require("node:test");
const { and, eq, sql } = require("drizzle-orm");
const { drizzle } = require("drizzle-orm/node-postgres");
const { Pool } = require("pg");

const {
  GoogleSpreadsheetSyncQueueService,
  GOOGLE_SHEET_RESOURCE,
} = require("../dist/apps/api/src/infrastructure/google/google-spreadsheet-sync-queue.service.js");
const schema = require("../dist/apps/api/src/infrastructure/postgres/postgres.schema.js");

const databaseUrl = process.env.GOOGLE_QUEUE_FENCING_TEST_DATABASE_URL;
if (process.env.CI && !databaseUrl) {
  throw new Error("GOOGLE_QUEUE_FENCING_TEST_DATABASE_URL_is_required_in_CI");
}
const integrationOptions = { skip: !databaseUrl };
const resourceKey = "synthetic-queue-fencing-20260908";

let pool;
let db;
let queue;

before(async () => {
  if (!databaseUrl) return;
  pool = new Pool({ connectionString: databaseUrl, max: 4 });
  db = drizzle(pool, { schema });
  queue = new GoogleSpreadsheetSyncQueueService(db);
});

beforeEach(async () => {
  if (!db) return;
  await db
    .delete(schema.googleSpreadsheetSyncJobs)
    .where(
      and(
        eq(schema.googleSpreadsheetSyncJobs.resourceType, GOOGLE_SHEET_RESOURCE.CONTACTS),
        eq(schema.googleSpreadsheetSyncJobs.resourceKey, resourceKey),
      ),
    );
});

after(async () => {
  await pool?.end();
});

test(
  "a stale Google Sheets worker cannot mark a re-claimed revision successful",
  integrationOptions,
  async () => {
    await queue.enqueue(GOOGLE_SHEET_RESOURCE.CONTACTS, resourceKey);
    queue.registerHandler(GOOGLE_SHEET_RESOURCE.CONTACTS, async (_resourceKey, context) => {
      await db
        .update(schema.googleSpreadsheetSyncJobs)
        .set({
          status: "PENDING",
          revision: sql`${schema.googleSpreadsheetSyncJobs.revision} + 1`,
          lockedAt: null,
          leaseUntil: null,
          claimToken: null,
          availableAt: new Date(),
        })
        .where(eq(schema.googleSpreadsheetSyncJobs.googleSpreadsheetSyncJobId, Number(context.jobId)));
    });

    const result = await queue.processPendingJobs(1);
    const [row] = await db
      .select()
      .from(schema.googleSpreadsheetSyncJobs)
      .where(
        and(
          eq(schema.googleSpreadsheetSyncJobs.resourceType, GOOGLE_SHEET_RESOURCE.CONTACTS),
          eq(schema.googleSpreadsheetSyncJobs.resourceKey, resourceKey),
        ),
      );

    assert.deepEqual(result, {
      processedCount: 1,
      succeededCount: 0,
      failedCount: 0,
    });
    assert.equal(row.status, "PENDING");
    assert.equal(row.revision, 2);
    assert.equal(row.claimToken, null);
  },
);

test(
  "a stale Google Sheets worker cannot mark a re-claimed revision failed",
  integrationOptions,
  async () => {
    await queue.enqueue(GOOGLE_SHEET_RESOURCE.CONTACTS, resourceKey);
    queue.registerHandler(GOOGLE_SHEET_RESOURCE.CONTACTS, async (_resourceKey, context) => {
      await db
        .update(schema.googleSpreadsheetSyncJobs)
        .set({
          status: "PENDING",
          revision: sql`${schema.googleSpreadsheetSyncJobs.revision} + 1`,
          lockedAt: null,
          leaseUntil: null,
          claimToken: null,
          availableAt: new Date(),
        })
        .where(eq(schema.googleSpreadsheetSyncJobs.googleSpreadsheetSyncJobId, Number(context.jobId)));
      throw new Error("synthetic_stale_worker_failure");
    });

    const result = await queue.processPendingJobs(1);
    const [row] = await db
      .select()
      .from(schema.googleSpreadsheetSyncJobs)
      .where(
        and(
          eq(schema.googleSpreadsheetSyncJobs.resourceType, GOOGLE_SHEET_RESOURCE.CONTACTS),
          eq(schema.googleSpreadsheetSyncJobs.resourceKey, resourceKey),
        ),
      );

    assert.deepEqual(result, {
      processedCount: 1,
      succeededCount: 0,
      failedCount: 0,
    });
    assert.equal(row.status, "PENDING");
    assert.equal(row.revision, 2);
    assert.equal(row.claimToken, null);
    assert.equal(row.lastError, null);
  },
);
