const assert = require("node:assert/strict");
const test = require("node:test");
const { overlapsDateRange } = require("../dist/test-src/lib/date-range-filter.js");
test("date ranges include overlapping periods and both day boundaries", () => {
  const range = { from: "2026-09-21", to: "2026-09-21" };
  assert.equal(overlapsDateRange("2026-09-20T15:00:00Z", "2026-09-20T15:00:00Z", range), true);
  assert.equal(overlapsDateRange("2026-09-21T14:59:59.999Z", "2026-09-21T14:59:59.999Z", range), true);
  assert.equal(overlapsDateRange("2026-09-19T00:00:00Z", "2026-09-20T14:59:59Z", range), false);
  assert.equal(overlapsDateRange("2026-09-21T15:00:00Z", "2026-09-22T15:00:00Z", range), false);
  assert.equal(overlapsDateRange("2026-09-01T00:00:00Z", "2026-10-01T00:00:00Z", range), true);
  assert.equal(overlapsDateRange(null, null, range), true);
  assert.equal(overlapsDateRange("2026-10-01T00:00:00Z", null, { from: "", to: "" }), true);
});
