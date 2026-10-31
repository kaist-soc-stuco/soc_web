const assert = require("node:assert/strict");
const test = require("node:test");
const { feeRosterRow, feeRosterUpdate } = require("../dist/test-src/lib/fee-roster.js");

test("baseline corrections preserve revisions without turning total receipts into the initial amount", () => {
  const record = { stdNo: "90990001", nameKo: "합성", admissionYear: 2026, paidSemesters: 2, paidAmount: 10000,
    totalPaidAmount: 15000, note: "메모", userId: null, joinedAt: null, updatedAt: "2026-10-31T00:00:00.000Z" };
  const update = feeRosterUpdate(feeRosterRow(record));
  assert.equal(update.paidAmount, 10000);
  assert.equal(update.expectedUpdatedAt, record.updatedAt);
  assert.equal("totalPaidAmount" in update, false);
});

test("formatted amounts accept proper grouping and reject malformed monetary input", () => {
  const row = { key: "90990001", stdNo: "90990001", nameKo: "합성", admissionYear: "2026", paidSemesters: "6",
    paidAmount: "45,000", note: "", userId: null, joinedAt: null, updatedAt: null };
  assert.equal(feeRosterUpdate(row).paidAmount, 45000);
  assert.ok(Number.isNaN(feeRosterUpdate({ ...row, paidAmount: "45,00" }).paidAmount));
});
