const assert = require("node:assert/strict");
const test = require("node:test");
const { feeRosterRow, feeRosterUpdate, importFeeRoster, pasteFeeRoster } = require("../dist/test-src/lib/fee-roster.js");

const record = { stdNo: "90990001", nameKo: "합성", admissionYear: 2026, paidSemesters: 2, paidAmount: 10000,
  note: "메모", userId: null, joinedAt: null, updatedAt: "2026-10-29T00:00:00.000Z" };

test("pasting existing and unregistered rows preserves optimistic-concurrency versions", () => {
  const [existing, added] = pasteFeeRoster("학번\t이름\t입학 연도\t납부 학기 수\t납부 금액\t비고\n90990001\t합성 수정\t2026\t6\t30000\t확인\n90990002\t합성 미가입\t2026\t0\t0\t", [feeRosterRow(record)]);
  assert.equal(existing.updatedAt, record.updatedAt);
  assert.equal(feeRosterUpdate(existing).paidAmount, 30000);
  assert.equal(added.userId, null);
  assert.equal(feeRosterUpdate(added).expectedUpdatedAt, null);
});

test("invalid or duplicate pasted rows do not mutate the current draft", () => {
  const original = [feeRosterRow(record)];
  const snapshot = structuredClone(original);
  assert.throws(() => pasteFeeRoster("90990001\t합성\t2026\t6\t-100\t", original));
  assert.throws(() => pasteFeeRoster("90990001\t합성\t2026\t6\t30000\t\n90990001\t중복\t2026\t6\t30000\t", original));
  assert.deepEqual(original, snapshot);
});

test("omitted paste columns retain existing values, including roster notes", () => {
  const [row] = pasteFeeRoster("90990001\t합성 이름 변경", [feeRosterRow(record)]);
  assert.equal(row.nameKo, "합성 이름 변경");
  assert.equal(row.paidAmount, "10000");
  assert.equal(row.note, "메모");
});

test("Excel import includes unregistered students and does not trust exported account metadata", () => {
  const XLSX = require("xlsx");
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet([
    ["학번", "이름", "입학 연도", "납부 학기 수", "납부 금액", "비고", "가입 일시"],
    ["90990003", "합성 신규", 2026, 6, 30000, "", "2026-01-01"],
  ]), "명부");
  const [row] = importFeeRoster(XLSX.write(book, { type: "array", bookType: "xlsx" }), []);
  assert.equal(row.stdNo, "90990003");
  assert.equal(row.userId, null);
  assert.equal(row.joinedAt, null);
  assert.equal(feeRosterUpdate(row).paidAmount, 30000);
});

test("formatted Excel amounts import without losing thousands separators or accepting malformed numbers", () => {
  const base = { key:"20990001",stdNo:"20990001",nameKo:"합성",admissionYear:"2026",paidSemesters:"6",paidAmount:"45,000",note:"",userId:null,joinedAt:null,updatedAt:null };
  assert.equal(feeRosterUpdate(base).paidAmount,45000);
  assert.ok(Number.isNaN(feeRosterUpdate({...base,paidAmount:"45,00"}).paidAmount));
});
