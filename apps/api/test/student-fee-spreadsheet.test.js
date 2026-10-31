const assert = require("node:assert/strict");
const test = require("node:test");
const XLSX = require("xlsx");
const { UsersController } = require("../dist/apps/api/src/features/users/users.controller.js");

async function exportWorkbook(records) {
  const controller = new UsersController({ exportStudentFeeRoster: async () => ({ records }) }, {});
  const file = await controller.exportStudentFeeRoster({ user: { id: "synthetic" } }, encodeURIComponent("합성 자료 확인"));
  const parts = [];
  for await (const part of file.getStream()) parts.push(part);
  return XLSX.read(Buffer.concat(parts), { type: "buffer", cellNF: true });
}

test("an empty roster exports a usable workbook with the same headers as a populated roster", async () => {
  const book = await exportWorkbook([]);
  const rows = XLSX.utils.sheet_to_json(book.Sheets[book.SheetNames[0]], { header: 1 });
  assert.deepEqual(rows[0], ["학번", "이름", "비고", "누적 수납액", "상태"]);
});

test("export preserves numeric totals and literal notes without retired metadata columns", async () => {
  const updatedAt = "2026-10-31T00:00:00.000Z";
  const book = await exportWorkbook([{ stdNo: "90990001", nameKo: "합성 납부자", admissionYear: 2026,
    paidSemesters: 2, paidAmount: 10000, note: "=1+1", joinedAt: null, totalPaidAmount: 15000, status: "PARTIAL", updatedAt }]);
  const sheet = book.Sheets[book.SheetNames[0]];
  assert.equal(sheet.A2.t, "s");
  assert.equal(sheet.D2.t, "n");
  assert.equal(sheet.D2.v, 15000);
  assert.equal(sheet.D2.w, "15,000");
  assert.equal(sheet.C2.v, "=1+1");
  assert.equal(sheet.C2.f, undefined);
  assert.equal(sheet.F2, undefined);
});
