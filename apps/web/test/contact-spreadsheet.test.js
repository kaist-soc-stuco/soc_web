const assert = require("node:assert/strict");
const test = require("node:test");
const XLSX = require("xlsx");
const { BulkImportContactsSchema } = require("@soc/contracts");
const { CONTACT_XLSX_TEMPLATE_ROWS, createContactTemplate, parseContactSpreadsheet } = require("../dist/test-src/lib/contact-spreadsheet.js");

function parse(rows) {
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(rows), "연락망");
  return parseContactSpreadsheet(XLSX.write(book, { bookType: "xlsx", type: "array" }));
}

test("the Korean template records an explicit activity year without consent or display-order columns", () => {
  assert.deepEqual(CONTACT_XLSX_TEMPLATE_ROWS[0], ["이름", "학번", "부서", "직책", "이메일", "전화번호", "연도"]);
  const result = parse([...CONTACT_XLSX_TEMPLATE_ROWS, ["합성 학생", "90990001", "전산관리부", "부원", "member@example.invalid", "01098765432", 2025], ["", "", "", "", "", "", ""]]);
  assert.deepEqual(result.errors, []);
  assert.equal(result.rows.length, 1);
  assert.equal(result.rows[0].nameKo, "합성 학생");
  assert.equal(result.rows[0].privacyConsented, true);
  assert.equal(result.rows[0].activities[0].year, 2025);
  assert.equal(Object.hasOwn(result.rows[0], "sortOrder"), false);
  assert.ok(BulkImportContactsSchema.safeParse({ items: result.rows }).success);
});

test("multiple years and concurrent positions group by student number into a single upsert item", () => {
  const header = CONTACT_XLSX_TEMPLATE_ROWS[0];
  const result = parse([header,
    ["합성", "90990001", "기획부", "부원", "", "01012345678", 2025],
    ["합성", "90990001", "전산관리부", "부장", "member@example.invalid", "", 2026],
    ["합성", "90990001", "TF", "TF원", "", "", 2026],
  ]);
  assert.deepEqual(result.errors, []);
  assert.equal(result.rows.length, 1);
  assert.equal(result.rows[0].activities.length, 3);
  assert.equal(result.rows[0].cohort, 2026);
  assert.equal(result.rows[0].email, "member@example.invalid");
  assert.equal(result.rows[0].phoneNumber, "01012345678");
  assert.equal(BulkImportContactsSchema.safeParse({items:result.rows}).success, true);
});

test("explicit activity imports reject duplicate activities, conflicting identities and invalid years", () => {
  const header = CONTACT_XLSX_TEMPLATE_ROWS[0];
  const row = ["합성", "90990001", "기획부", "부원", "", "", 2025];
  assert.match(parse([header, row, row]).errors[0], /연도·부서·직책이 중복/);
  assert.match(parse([header, row, ["다른 이름", "90990001", "TF", "TF원", "", "", 2026]]).errors[0], /서로 다릅니다/);
  assert.match(parse([header, [...row.slice(0, 6), "2025년"]]).errors[0], /연도/);
  assert.match(parse([header, [...row.slice(0, 6), 1800]]).errors[0], /연도/);
});

test("a downloaded contact template cannot register its example and preserves text fields", async () => {
  const bytes = await createContactTemplate().arrayBuffer();
  const empty = parseContactSpreadsheet(bytes);
  assert.equal(empty.rows.length, 0);
  assert.match(empty.errors[0], /예시를 제외/);
  const book = XLSX.read(bytes, { type: "array", cellNF: true });
  assert.equal(book.Sheets["연락망"].F3.z, "@");
  assert.equal(book.Sheets["연락망"].B3.z, "@");
  XLSX.utils.sheet_add_aoa(book.Sheets["연락망"], [["합성", "90990001", "", "부원", "", "01001234567"]], { origin: "A3" });
  // An instructions tab moved to the front must not become the import source.
  book.SheetNames.reverse();
  const result = parseContactSpreadsheet(XLSX.write(book, {type:"array",bookType:"xlsx"}));
  assert.deepEqual(result.errors, []);
  assert.equal(result.rows.length, 1);
  assert.equal(result.rows[0].phoneNumber, "01001234567");
});

test("ambiguous columns, server-invalid lengths and oversized batches are rejected before preview confirmation", () => {
  assert.match(parse([["이름", "nameKo", "직책"], ["첫 이름", "다른 이름", "부원"]]).errors[0], /중복된 열/);
  const long = parse([["이름", "학번", "직책", "전화번호"], ["가".repeat(101), "90990001", "부원", ""], ["합성", "90990002", "부원", "1".repeat(51)]]);
  assert.equal(long.rows.length, 0);
  assert.match(long.errors[0], /2행.*이름/);
  assert.match(long.errors[1], /3행.*전화번호/);
  const tooMany = parse([["이름", "학번", "직책"], ...Array.from({length:501}, (_, index)=>[`합성${index}`,String(90990000 + index),"부원"])]);
  assert.equal(tooMany.rows.length, 0);
  assert.match(tooMany.errors[0], /최대 500명/);
  assert.match(parse([["이름", "학번", "직책", "전화번호"], ["합성", "90990001", "부원", 1012345678]]).errors[0], /전화번호 앞의 0/);
});

test("contact imports follow column names and ignore retired spreadsheet metadata", () => {
  const result = parse([
    ["직책", "전화번호", "이름", "부서", "활동 이력", "개인정보동의", "표시순서", "학번"],
    ["부원", "010-1234-5678", "테스트", "전산관리부", "이전 양식의 이력", "미동의", "숫자 아님", "90990001"],
  ]);
  assert.deepEqual(result.errors, []);
  assert.equal(result.rows[0].departmentKo, "전산관리부");
  assert.equal(result.rows[0].roleKo, "부원");
  assert.equal(result.rows[0].phoneNumber, "01012345678");
  assert.equal(result.rows[0].privacyConsented, true);
  assert.equal(Object.hasOwn(result.rows[0], "activities"), false);
});

test("missing required contact values and invalid emails have Korean error messages", () => {
  assert.match(parse([["이메일"], ["a@example.com"]]).errors[0], /이름, 학번, 직책/);
  const result = parse([["이름", "학번", "직책", "이메일"], ["", "90990001", "부원", ""], ["테스트", "90990002", "부원", "잘못된 이메일"]]);
  assert.equal(result.rows.length, 0);
  assert.match(result.errors[0], /2행: 이름/);
  assert.match(result.errors[1], /3행: 이메일/);
});

test("upsert requires an eight-digit student number and rejects ambiguous duplicate rows", () => {
  const header = ["이름", "학번", "직책"];
  assert.match(parse([header, ["합성", "", "부원"]]).errors[0], /학번/);
  assert.match(parse([header, ["합성", "12345", "부원"]]).errors[0], /학번\(8자리\)/);
  const duplicate = parse([header, ["합성", "90990001", "부원"], ["다른 이름", "90990001", "부장"]]);
  assert.match(duplicate.errors[0], /3행: 2행과 학번이 중복/);
  const item = { nameKo: "합성", studentNumber: "90990001", roleKo: "부원" };
  assert.equal(BulkImportContactsSchema.safeParse({items:[item, item]}).success, false);
  assert.equal(BulkImportContactsSchema.safeParse({items:[{nameKo:"합성",roleKo:"부원"}]}).success, false);
  assert.equal(BulkImportContactsSchema.safeParse({items:[item],replaceExisting:true}).success, false);
});
