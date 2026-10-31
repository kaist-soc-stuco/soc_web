const assert = require("node:assert/strict");
const test = require("node:test");
const XLSX = require("xlsx");
const { createFeePaymentTemplate, parseFeePaymentSpreadsheet } = require("../dist/test-src/lib/fee-payment-spreadsheet.js");
const headers = ["학번", "이름", "입금액", "입금일", "메모"];
function workbook(rows) {
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(rows), "입금 등록");
  return XLSX.write(book, { type: "array", bookType: "xlsx" });
}
test("the payment template includes an identifiable example and formats input cells", async () => {
  const book = XLSX.read(await createFeePaymentTemplate().arrayBuffer(), { type: "array" });
  const sheet = book.Sheets["입금 등록"];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, blankrows: false });
  assert.deepEqual(rows[0], headers);
  assert.equal(rows[1][1], "홍길동(예시)");
  assert.equal(rows[1][4], "예시 행 · 업로드 시 제외");
  assert.throws(() => parseFeePaymentSpreadsheet(XLSX.write(book, { type: "array", bookType: "xlsx" })), /실제 입금 내역/);
  assert.ok(book.Sheets["작성 안내"]);
});
test("reordered columns, Excel date cells and grouped money preserve separate receipts for one student", () => {
  const rows = parseFeePaymentSpreadsheet(workbook([
    ["이름", "입금일", "학번", "입금액", "메모"],
    ["합성 학생", 46326, "90990001", "10,000", "첫 입금"],
    ["합성 학생", "2026-10-31", 90990001, 35000, "추가 입금"],
  ]));
  assert.equal(rows.length, 2);
  assert.equal(rows[0].stdNo, rows[1].stdNo);
  assert.equal(rows[0].amount, 10000);
  assert.equal(rows[0].paidDate, "2026-10-31");
  assert.equal(rows[1].paidDate, "2026-10-31");
});
test("summary exports, invalid dates and nonpositive amounts are rejected", () => {
  assert.throws(() => parseFeePaymentSpreadsheet(workbook([["학번", "이름", "누적 수납액"], ["90990001", "합성", 45000]])), /입금 등록 양식/);
  for (const [amount, date] of [[0, "2026-10-31"], [-1, "2026-10-31"], [1000, "2026-02-30"]]) {
    assert.throws(() => parseFeePaymentSpreadsheet(workbook([headers, ["90990001", "합성", amount, date, ""]])), /2행/);
  }
  assert.throws(() => parseFeePaymentSpreadsheet(workbook([headers])), /1~1,000/);
});

test("common Korean and compact payment dates normalize to the same day", () => {
  for (const date of ["2026.10.31", "2026/10/31", "20261031", 20261031, "26-10-31", "2026년 10월 31일", "2026-10-31 09:30:00"]) {
    const [row] = parseFeePaymentSpreadsheet(workbook([headers, ["90990001", "합성", "45,000원", date, ""]]));
    assert.equal(row.paidDate, "2026-10-31");
    assert.equal(row.amount, 45000);
  }
});
