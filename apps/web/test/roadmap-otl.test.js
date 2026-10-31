const assert = require("node:assert/strict");
const test = require("node:test");
const { getRoadmapOtlUrl, OTL_COURSE_IDS } = require("../dist/test-src/features/roadmap/roadmap-otl.js");

test("links dotted, canonical and legacy codes to the same verified OTL course", () => {
  for (const code of ["CS.30600", "CS30600", " cs360 "]) {
    assert.equal(getRoadmapOtlUrl(code), "https://otl.kaist.ac.kr/dictionary?courseId=754");
  }
  assert.equal(getRoadmapOtlUrl("CS101"), "https://otl.kaist.ac.kr/dictionary?courseId=744");
  assert.equal(getRoadmapOtlUrl("CS361"), "https://otl.kaist.ac.kr/dictionary?courseId=23890");
  assert.equal(getRoadmapOtlUrl("CS485"), "https://otl.kaist.ac.kr/dictionary?courseId=24078");
});

test("retains all supplied courses, including graduate courses", () => {
  assert.equal(Object.keys(OTL_COURSE_IDS).length, 126);
  assert.equal(getRoadmapOtlUrl("CS.50600"), "https://otl.kaist.ac.kr/dictionary?courseId=1295");
  assert.equal(getRoadmapOtlUrl("CS.91200"), "https://otl.kaist.ac.kr/dictionary?courseId=23273");
});

test("does not guess a course ID for missing courses", () => {
  assert.equal(getRoadmapOtlUrl("CS99999"), null);
  assert.equal(getRoadmapOtlUrl("MAS10009"), null);
  assert.equal(getRoadmapOtlUrl(""), null);
});
