const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

test("privacy consent shows every required notice item", () => {
  const source = fs.readFileSync(
    path.join(__dirname, "../src/pages/login-callback-page.tsx"),
    "utf8",
  );

  for (const heading of [
    "수집·이용 목적",
    "수집 항목",
    "보유·이용 기간",
    "동의 거부권 및 불이익",
  ]) {
    assert.match(source, new RegExp(heading.replace("·", "\\·")));
  }
});

test("privacy policy names configured processors", () => {
  const source = fs.readFileSync(
    path.join(__dirname, "../src/components/organisms/legal-document.tsx"),
    "utf8",
  );

  assert.match(source, /label: t\("SPARCS"/);
  assert.match(source, /label: t\("Google Sheets\(선택 기능\)"/);
  assert.match(source, /성별, 학적 상태, 신분코드/);
});
