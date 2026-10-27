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
  assert.doesNotMatch(source, /성별|gender/);
  assert.match(source, /href="\/privacy" target="_blank" rel="noopener noreferrer"/);
  assert.match(source, /Privacy Policy/);
  assert.match(source, /개인정보처리방침/);
});

test("privacy policy names configured processors", () => {
  const source = fs.readFileSync(
    path.join(__dirname, "../src/components/organisms/legal-document.tsx"),
    "utf8",
  );

  assert.match(source, /SPARCS: 서비스 운영 서버 및 데이터베이스 인프라 호스팅 관리/);
  assert.match(source, /Channel Corporation \(Channel Talk\):/);
  assert.match(source, /label:\s*t\(\s*"SSO 연동 정보"/);
  assert.doesNotMatch(source, /label:\s*t\(\s*"(?:필수 항목|선택 항목)"/);
});
