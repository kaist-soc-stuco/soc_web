const assert = require("node:assert/strict");
const test = require("node:test");

const {
  getKoreanHolidayName,
} = require("../dist/test-src/lib/korean-holidays.js");

test("localizes known Korean public holiday names", () => {
  assert.equal(getKoreanHolidayName("한글날", "ko"), "한글날");
  assert.equal(getKoreanHolidayName("한글날", "en"), "Hangeul Day");
  assert.equal(getKoreanHolidayName("설날 연휴", "en"), "Lunar New Year holiday");
});

test("preserves unknown government API holiday names", () => {
  assert.equal(getKoreanHolidayName("임시공휴일", "en"), "임시공휴일");
});
