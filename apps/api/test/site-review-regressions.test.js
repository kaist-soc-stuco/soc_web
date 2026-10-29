const { test } = require("node:test");
const assert = require("node:assert/strict");
const { AuditLogController } = require("../dist/apps/api/src/features/audit/audit-log.controller.js");
const { UsersRepository } = require("../dist/apps/api/src/features/users/repositories/users.repository.js");
const { BulkEmailService } = require("../dist/apps/api/src/features/email/bulk-email.service.js");

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

test("fee detail and ledger show current completion independently of the viewing semester", async () => {
  const user = { userId: "u", nameKo: "QA", nameEn: "QA", email: "qa@example.invalid", primaryMajor: "CS", joinedAt: new Date("2026-09-01T00:00:00Z") };
  const legacy = { userId: "u", status: "PAID", coverageSemesters: 1, paidAt: new Date("2026-09-20T00:00:00Z"), paidAmount: 45000, verifiedAt: null, verifiedBy: null, note: null, updatedAt: new Date("2026-09-20T00:00:00Z") };
  const payment = { ...legacy, paymentId: "p", userId: "u", amount: 45000, effectiveStartSemester: "2026-2", createdAt: legacy.paidAt };
  for (const semester of ["2026-1", "2026-2", "2035-1"]) {
    const expected = "PAID";
    const repo = new UsersRepository(database([[{ ...user, ...legacy }], [payment], [user], [payment]]));
    repo.getStudentFeePolicy = async () => ({ amount: 45000 });
    repo.listStudentFeeRoster = async () => [{ userId: "u", status: "PAID", totalPaidAmount: 45000, requiredAmount: 45000, remainingAmount: 0 }];
    repo.getStudentFeeStatus = async () => repo.mapFeeStatusRow(legacy);
    const ledger = await repo.listStudentsByFeeStatus(undefined, 1, 20, "name", "asc", undefined, undefined, undefined, semester);
    const detail = await repo.getStudentFeeDetail("u", semester);
    assert.equal(ledger.students[0].status, expected);
    assert.equal(detail.status.status, expected);
    assert.equal(detail.history[0].paymentId, payment.paymentId);
    assert.equal(detail.status.updatedAt, legacy.updatedAt.toISOString());
  }
});

test("email preview rejects a missing or foreign restored attachment before review", async () => {
  const context = { assetService: { hasOwnedAsset: async (id, owner) => id === "1" && owner === "sender" }, usersService: { listEmailRecipients: async () => [] } };
  const request = { recipientType: "ALL", attachmentAssetIds: ["1"] };
  await BulkEmailService.prototype.previewRecipients.call(context, request, "sender");
  await assert.rejects(BulkEmailService.prototype.previewRecipients.call(context, { ...request, attachmentAssetIds: ["2"] }, "sender"), /bulk_email_attachment_unavailable:2/);
});
