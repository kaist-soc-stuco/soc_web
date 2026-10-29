const assert = require("node:assert/strict");
const test = require("node:test");
const { GoogleSpreadsheetSyncQueueService, GOOGLE_SHEET_RESOURCE } = require("../dist/apps/api/src/infrastructure/google/google-spreadsheet-sync-queue.service.js");
const { enqueueSpreadsheetSync } = require("../dist/apps/api/src/infrastructure/google/enqueue-spreadsheet-sync.js");

test("retired Sheets queues do not create jobs or process old jobs", async () => {
  const forbidden = new Proxy({}, { get() { assert.fail("retired Sheets queue accessed the database"); } });
  const queue = new GoogleSpreadsheetSyncQueueService(forbidden);
  queue.registerHandler(GOOGLE_SHEET_RESOURCE.STUDENT_FEES, () => assert.fail("retired worker ran"));
  await enqueueSpreadsheetSync(forbidden, GOOGLE_SHEET_RESOURCE.STUDENT_FEES);
  await queue.enqueue(GOOGLE_SHEET_RESOURCE.STUDENT_FEES);
  await queue.processQueue();
  assert.deepEqual(await queue.processPendingJobs(), { processedCount: 0, succeededCount: 0, failedCount: 0 });
});
