const assert = require("node:assert/strict");
const test = require("node:test");
const XLSX = require("xlsx");
const { BulkImportContactsSchema } = require("@soc/contracts");
const { CONTACT_XLSX_TEMPLATE_ROWS, parseContactSpreadsheet } = require("../dist/test-src/lib/contact-spreadsheet.js");

function parse(rows) {
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(rows), "연락망");
  return parseContactSpreadsheet(XLSX.write(book, { bookType: "xlsx", type: "array" }));
}

test("the six-column Korean template imports without history, consent or display-order fields", () => {
  assert.deepEqual(CONTACT_XLSX_TEMPLATE_ROWS[0], ["이름", "학번", "부서", "직책", "이메일", "전화번호"]);
  const result = parse([...CONTACT_XLSX_TEMPLATE_ROWS, ["", "", "", "", "", ""]]);
  assert.deepEqual(result.errors, []);
  assert.equal(result.rows.length, 1);
  assert.equal(result.rows[0].privacyConsented, true);
  assert.equal(Object.hasOwn(result.rows[0], "activities"), false);
  assert.equal(Object.hasOwn(result.rows[0], "sortOrder"), false);
  assert.ok(BulkImportContactsSchema.safeParse({ items: result.rows }).success);
});

test("contact imports follow column names and ignore retired spreadsheet metadata", () => {
  const result = parse([
    ["직책", "전화번호", "이름", "부서", "활동 이력", "개인정보동의", "표시순서"],
    ["부원", "010-1234-5678", "테스트", "전산관리부", "이전 양식의 이력", "미동의", "숫자 아님"],
  ]);
  assert.deepEqual(result.errors, []);
  assert.equal(result.rows[0].departmentKo, "전산관리부");
  assert.equal(result.rows[0].roleKo, "부원");
  assert.equal(result.rows[0].phoneNumber, "01012345678");
  assert.equal(result.rows[0].privacyConsented, true);
  assert.equal(Object.hasOwn(result.rows[0], "activities"), false);
});

test("missing required contact values and invalid emails have Korean error messages", () => {
  assert.match(parse([["이메일"], ["a@example.com"]]).errors[0], /이름, 직책/);
  const result = parse([["이름", "직책", "이메일"], ["", "부원", ""], ["테스트", "부원", "잘못된 이메일"]]);
  assert.equal(result.rows.length, 0);
  assert.match(result.errors[0], /2행: 이름/);
  assert.match(result.errors[1], /3행: 이메일/);
});
