const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

test("audit log table exposes all five required access-record fields", () => {
  const source = fs.readFileSync(
    path.join(__dirname, "../src/features/admin-audit/audit-log-page.tsx"),
    "utf8",
  );

  for (const label of [
    "계정(식별자)",
    "접속 일시",
    "접속지 정보",
    "처리한 정보주체",
    "수행 업무(처리 내역)",
  ]) {
    assert.match(source, new RegExp(label.replace(/[()]/g, "\\$&")));
  }
  assert.match(source, /getSeconds\(\)/);
  assert.match(source, /log\.actorKaistUid/);
  assert.match(source, /log\.ipAddress/);
  assert.match(source, /subjectIdentifierSummary\(log\)/);
  assert.match(source, /log\.actionLabel/);
});

test("student fee access events are displayed as reads", () => {
  const pageSource = fs.readFileSync(
    path.join(__dirname, "../src/features/admin-audit/audit-log-page.tsx"),
    "utf8",
  );
  const repositorySource = fs.readFileSync(
    path.join(__dirname, "../../api/src/features/audit/audit-log.repository.ts"),
    "utf8",
  );

  assert.match(pageSource, /READ:\s*"조회"/);
  for (const action of ["detail", "list", "preview", "status"]) {
    assert.match(
      repositorySource,
      new RegExp(`"student_fee_status\\.${action}"[^\\n]+kind: "READ"`),
    );
  }
});
