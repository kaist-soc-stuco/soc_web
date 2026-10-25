const assert = require("node:assert/strict");
const test = require("node:test");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const {getStudentFeeBootstrap} = require("../dist/apps/api/src/features/users/student-fee-bootstrap-loader.js");

test("first-login matching reads private data and is optional when unconfigured", (t) => {
  const previous = process.env.STUDENT_FEE_BOOTSTRAP_PATH;
  const directory = fs.mkdtempSync(path.join(os.tmpdir(),"soc-fee-bootstrap-"));
  t.after(() => {
    if (previous === undefined) delete process.env.STUDENT_FEE_BOOTSTRAP_PATH;
    else process.env.STUDENT_FEE_BOOTSTRAP_PATH = previous;
    fs.rmSync(directory,{recursive:true,force:true});
  });
  delete process.env.STUDENT_FEE_BOOTSTRAP_PATH;
  assert.equal(getStudentFeeBootstrap("90990001"),null);
  const file = path.join(directory,"fees.json");
  fs.writeFileSync(file,JSON.stringify([{stdNo:"90990001",admissionYear:2026,paidSemesters:6,paidAmount:1}]));
  process.env.STUDENT_FEE_BOOTSTRAP_PATH=file;
  assert.equal(getStudentFeeBootstrap(" 90990001 ").paidSemesters,6);
  assert.equal(getStudentFeeBootstrap("90990002"),null);
  process.env.STUDENT_FEE_BOOTSTRAP_PATH=path.join(directory,"missing.json");
  assert.throws(()=>getStudentFeeBootstrap("90990001"),/student_fee_bootstrap_file_invalid/);
});
