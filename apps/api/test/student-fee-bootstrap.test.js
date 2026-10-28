const assert = require("node:assert/strict");
const test = require("node:test");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { Logger } = require("@nestjs/common");
const { getStudentFeeBootstrap, getStudentFeeBootstrapRecords, BootstrapRecordsSchema } = require("../dist/apps/api/src/features/users/student-fee-bootstrap-loader.js");

const record = { stdNo: "90990001", admissionYear: 2026, paidSemesters: 6, paidAmount: 1 };

function fixture(t) {
  const previous = process.env.STUDENT_FEE_BOOTSTRAP_PATH;
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "soc-fee-bootstrap-"));
  t.after(() => {
    if (previous === undefined) delete process.env.STUDENT_FEE_BOOTSTRAP_PATH;
    else process.env.STUDENT_FEE_BOOTSTRAP_PATH = previous;
    fs.rmSync(directory, { recursive: true, force: true });
  });
  process.env.STUDENT_FEE_BOOTSTRAP_PATH = path.join(directory, "fees.json");
  return directory;
}

test("first-login matching reads private data and is optional when unconfigured", (t) => {
  fixture(t);
  const file = process.env.STUDENT_FEE_BOOTSTRAP_PATH;
  delete process.env.STUDENT_FEE_BOOTSTRAP_PATH;
  assert.equal(getStudentFeeBootstrap(record.stdNo), null);
  fs.writeFileSync(file, JSON.stringify([record]));
  process.env.STUDENT_FEE_BOOTSTRAP_PATH = file;
  assert.deepEqual(getStudentFeeBootstrap(` ${record.stdNo} `), record);
  assert.equal(getStudentFeeBootstrap("90990002"), null);
  assert.equal(getStudentFeeBootstrap(undefined), null);
  assert.equal(getStudentFeeBootstrap("not-a-student-number"), null);
});

test("missing, directory, malformed JSON and invalid records skip import without touching fee records", async (t) => {
  const directory = fixture(t);
  const warnings = t.mock.method(Logger.prototype, "warn", () => {});
  const cases = [
    ["missing.json", undefined],
    ["directory", "directory"],
    ["broken.json", "{sensitive-invalid-json"],
    ["invalid.json", JSON.stringify([{ ...record, paidSemesters: -1 }])],
  ];
  for (const [name, contents] of cases) {
    const file = path.join(directory, name);
    if (contents === "directory") fs.mkdirSync(file);
    else if (contents !== undefined) fs.writeFileSync(file, contents);
    process.env.STUDENT_FEE_BOOTSTRAP_PATH = file;
    assert.equal(getStudentFeeBootstrapRecords(), null);
  }
  assert.equal(warnings.mock.callCount(), cases.length);
  assert.ok(warnings.mock.calls.every(call => !String(call.arguments[0]).includes("sensitive-invalid-json")));
});

test("a failed import warns once per retry window and recovers after file repair", (t) => {
  fixture(t);
  let now = Date.now();
  t.mock.method(Date, "now", () => now);
  const warnings = t.mock.method(Logger.prototype, "warn", () => {});
  assert.equal(getStudentFeeBootstrap(record.stdNo), null);
  assert.equal(getStudentFeeBootstrap(record.stdNo), null);
  assert.equal(warnings.mock.callCount(), 1);
  fs.writeFileSync(process.env.STUDENT_FEE_BOOTSTRAP_PATH, JSON.stringify([record]));
  now += 60_000;
  assert.deepEqual(getStudentFeeBootstrap(record.stdNo), record);
  assert.equal(warnings.mock.callCount(), 1);
  fs.writeFileSync(process.env.STUDENT_FEE_BOOTSTRAP_PATH, "broken");
  now += 60_000;
  assert.equal(getStudentFeeBootstrap(record.stdNo), null, "Do not apply stale paid data after an invalid refresh");
  assert.equal(warnings.mock.callCount(), 2);
});

test("changing to an unavailable source never reuses records from the previous file", (t) => {
  const directory = fixture(t);
  t.mock.method(Logger.prototype, "warn", () => {});
  fs.writeFileSync(process.env.STUDENT_FEE_BOOTSTRAP_PATH, JSON.stringify([record]));
  assert.deepEqual(getStudentFeeBootstrap(record.stdNo), record);
  process.env.STUDENT_FEE_BOOTSTRAP_PATH = path.join(directory, "missing.json");
  assert.equal(getStudentFeeBootstrap(record.stdNo), null);
});


test("initial ledger rejects duplicate student numbers before importing and accepts optional names", () => {
  assert.equal(BootstrapRecordsSchema.safeParse([record, { ...record, paidAmount: 2 }]).success, false);
  assert.deepEqual(BootstrapRecordsSchema.parse([{ ...record, nameKo: "합성 사용자" }]), [{ ...record, nameKo: "합성 사용자" }]);
});
