const assert = require("node:assert/strict");
const test = require("node:test");
const { parsePickerDate, formatPickerDate, replacePickerDate } = require("../dist/test-src/lib/date-picker.js");

test("picker dates round-trip local calendar components, including leap days", () => {
  for (const day of ["2026-01-01", "2028-02-29", "2026-12-31"]) {
    const date = parsePickerDate(day);
    assert.equal(formatPickerDate(date), day);
    assert.equal(date.getHours(), 0);
  }
  assert.equal(parsePickerDate("2026-02-29"), undefined);
  assert.equal(parsePickerDate("2026-13-01"), undefined);
  assert.equal(parsePickerDate(""), undefined);
});

test("changing the calendar date preserves time and seconds without UTC conversion", () => {
  const day = parsePickerDate("2026-10-26");
  assert.equal(replacePickerDate("2026-10-25T23:59:37", day, true), "2026-10-26T23:59:37");
  assert.equal(replacePickerDate("", day, true), "2026-10-26T00:00");
  assert.equal(replacePickerDate("2026-10-25T23:59", day, false), "2026-10-26");
});

test("date selection respects same-day minimum and maximum times", () => {
  const day = parsePickerDate("2026-10-26");
  assert.equal(replacePickerDate("", day, true, "2026-10-26T12:30"), "2026-10-26T12:30");
  assert.equal(replacePickerDate("2026-10-25T23:59", day, true, "", "2026-10-26T18:00"), "2026-10-26T18:00");
});
