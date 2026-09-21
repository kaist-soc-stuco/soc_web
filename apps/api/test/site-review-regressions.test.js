const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { AuditLogController } = require("../dist/apps/api/src/features/audit/audit-log.controller.js");
const { UsersRepository } = require("../dist/apps/api/src/features/users/repositories/users.repository.js");
const { GoogleFeeSheetsService } = require("../dist/apps/api/src/features/users/google-fee-sheets.service.js");
const { BulkEmailService } = require("../dist/apps/api/src/features/email/bulk-email.service.js");

test("vote image repair runs after every previously recorded migration", () => {
  const directory = path.join(__dirname, "../drizzle");
  const { entries } = JSON.parse(fs.readFileSync(path.join(directory, "meta/_journal.json"), "utf8"));
  const repair = entries.find(entry => entry.tag === "0008_repair_vote_item_image");
  assert.ok(repair.when > Math.max(...entries.filter(entry => entry.idx < repair.idx).map(entry => entry.when)));
  assert.match(fs.readFileSync(path.join(directory, `${repair.tag}.sql`), "utf8"), /ADD COLUMN IF NOT EXISTS "image_url"/);
});

test("audit day filters include the Korean midnight boundary, not UTC midnight", async () => {
  let received;
  const controller = new AuditLogController({ list: async input => { received = input; return []; } });
  await controller.listAuditLogs(undefined, "1", "20", undefined, undefined, undefined, undefined, "2026-09-21", "2026-09-21");
  assert.equal(received.dateFrom, "2026-09-20T15:00:00.000Z");
  assert.equal(received.dateTo, "2026-09-21T14:59:59.999Z");
});

function database(results) {
  let index = 0;
  return { select: () => {
    const result = results[index++];
    const chain = { from: () => chain, where: () => chain, leftJoin: () => chain, limit: () => chain, orderBy: () => chain,
      then: (resolve, reject) => Promise.resolve(result).then(resolve, reject) };
    return chain;
  } };
}

test("fee detail and ledger agree before, during, and after paid coverage", async () => {
  const user = { userId: "u", nameKo: "QA", nameEn: "QA", email: "qa@example.invalid", primaryMajor: "CS" };
  const legacy = { status: "PAID", coverageSemesters: 1, paidAt: new Date("2026-09-20T00:00:00Z"), paidAmount: 45000, verifiedAt: null };
  const payment = { ...legacy, paymentId: "p", userId: "u", amount: 45000, effectiveStartSemester: "2026-2", createdAt: legacy.paidAt };
  for (const [semester, expected] of [["2026-1", "UNPAID"], ["2026-2", "PAID"], ["2027-1", "UNPAID"]]) {
    const repo = new UsersRepository(database([[{ ...user, ...legacy }], [payment], [user], [payment]]));
    repo.getStudentFeePolicy = async () => ({ amount: 45000 });
    repo.getStudentFeeStatus = async () => ({ ...legacy, paidAt: legacy.paidAt.toISOString() });
    const ledger = await repo.listStudentsByFeeStatus(undefined, 1, 20, "name", "asc", undefined, undefined, undefined, semester);
    const detail = await repo.getStudentFeeDetail("u", semester);
    assert.equal(ledger.students[0].status, expected);
    assert.equal(detail.status.status, expected);
  }
});

test("fee sheet lookup never creates, synchronizes, or records a connection", async () => {
  const reference = { spreadsheetId: "s", spreadsheetUrl: "https://example.invalid/s" };
  const sheets = { getSpreadsheetReference: async () => reference, getOrCreateSpreadsheet: () => assert.fail("read created sheet") };
  const service = new GoogleFeeSheetsService(sheets, {}, { enqueue: () => assert.fail("read enqueued sync") }, { record: () => assert.fail("read recorded connection") });
  assert.deepEqual(await service.getReference(), reference);
  assert.deepEqual(await service.connect(), reference);
});

test("first explicit fee sheet connection creates and enqueues one sync", async () => {
  let syncs = 0, logs = 0;
  const service = new GoogleFeeSheetsService({ getSpreadsheetReference: async () => null, getOrCreateSpreadsheet: async () => ({ spreadsheetId: "s" }) }, {},
    { enqueue: async () => { syncs++; } }, { record: async () => { logs++; } });
  await service.connect();
  assert.equal(syncs, 1);
  assert.equal(logs, 1);
});

test("email preview rejects a missing or foreign restored attachment before review", async () => {
  const context = { assetService: { hasOwnedAsset: async (id, owner) => id === "1" && owner === "sender" }, usersService: { listEmailRecipients: async () => [] } };
  const request = { recipientType: "ALL", attachmentAssetIds: ["1"] };
  await BulkEmailService.prototype.previewRecipients.call(context, request, "sender");
  await assert.rejects(BulkEmailService.prototype.previewRecipients.call(context, { ...request, attachmentAssetIds: ["2"] }, "sender"), /bulk_email_attachment_unavailable:2/);
});
