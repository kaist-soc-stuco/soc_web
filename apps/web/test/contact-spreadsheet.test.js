const assert = require("node:assert/strict");
const test = require("node:test");
const XLSX = require("xlsx");
const { parseContactSpreadsheet } = require("../dist/test-src/lib/contact-spreadsheet.js");

function parse(rows) {
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(rows), "연락망");
  return parseContactSpreadsheet(XLSX.write(book, { bookType: "xlsx", type: "array" }));
}

test("contact sheet preserves multiple years without a separate year column", () => {
  const result = parse([
    ["이름", "학번", "부서", "직책", "이메일", "전화번호", "활동 이력"],
    ["테스트", "20250001", "기획부", "부원", "", "", "2025년 · 기획부 · 부원\n2026년 · 전산관리부 · 부장"],
  ]);
  assert.deepEqual(result.errors, []);
  assert.equal(result.rows[0].activities.length, 2);
  assert.equal(result.rows[0].cohort, 2026);
  assert.equal(result.rows[0].departmentKo, "전산관리부");
  assert.equal(result.rows[0].roleKo, "부장");
});

test("legacy year columns remain importable and malformed history is rejected", () => {
  const legacy = parse([["이름", "직책", "활동 연도"], ["테스트", "부원", 26]]);
  assert.deepEqual(legacy.errors, []);
  assert.equal(legacy.rows[0].cohort, 2026);
  const malformed = parse([["이름", "직책", "활동 이력"], ["테스트", "부원", "잘못된 이력"]]);
  assert.equal(malformed.rows.length, 0);
  assert.equal(malformed.errors.length, 1);
});
